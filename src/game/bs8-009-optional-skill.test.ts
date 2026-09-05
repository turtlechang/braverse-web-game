import { describe, expect, it } from 'vitest'
import { applyGameCommand, canActivateCookieSkill, getCookieSkillUnavailableReason, getBreakAreaLevel, getEffectiveAttack, type CookieCard } from './index'
import { createCardCheckDemoState } from './demo'

const createBs8009State = () =>
  createCardCheckDemoState('BS8-009', { preferSkillSurface: true })

const addBreakLevels = (
  state: ReturnType<typeof createBs8009State>,
  levels: number[],
) => {
  const player = state.players['player-one']
  const template = player.breakArea.find(
    (card): card is CookieCard => card.type === 'cookie',
  )
  if (!template) throw new Error('BS8-009 fixture requires a Cookie in break')

  return {
    ...state,
    players: {
      ...state.players,
      'player-one': {
        ...player,
        breakArea: [
          ...player.breakArea,
          ...levels.map((level, index) => ({
            ...template,
            id: `BS8-009-break-extra-${level}-${index}`,
            instanceId: `BS8-009-break-extra-${level}-${index}`,
            level,
          })),
        ],
      },
    },
  }
}

const resolveBreakLevelBonus = (
  additionalBreakLevels: number[],
) => {
  const initial = addBreakLevels(createBs8009State(), additionalBreakLevels)
  const sourceInstanceId = initial.players['player-one'].battleArea[0]!.card.instanceId
  const firstPaymentId = initial.players['player-one'].supportArea[0]!.card.instanceId
  const thenPaymentId = initial.players['player-one'].supportArea[1]!.card.instanceId
  let state = applyGameCommand(initial, {
    kind: 'begin-activate-skill',
    playerId: 'player-one',
    sourceInstanceId,
    trigger: 'activate',
    paymentIds: [firstPaymentId],
  })
  state = applyGameCommand(state, {
    kind: 'resolve-ability-effect',
    playerId: 'player-one',
    targetIds: [],
  })
  state = applyGameCommand(state, {
    kind: 'resolve-ability-effect',
    playerId: 'player-one',
    targetIds: [],
  })
  state = applyGameCommand(state, {
    kind: 'resolve-optional-cost-attack',
    playerId: 'player-one',
    action: 'pay',
    paymentIds: [thenPaymentId],
    targetIds: [],
  })
  state = applyGameCommand(state, {
    kind: 'resolve-ability-effect',
    playerId: 'player-one',
    targetIds: [sourceInstanceId],
  })
  return state
}

describe('BS8-009 Burning Spice Cookie skill', () => {
  it.each(['BS8-009', 'BS8-009@1', 'BS8-009@2', 'BS8-009@3'])('%s rejects a solo source and reused payment, then expires its bonus at turn end', (cardNumber) => {
    const initial = createCardCheckDemoState(cardNumber, { preferSkillSurface: true })
    const owner = initial.players['player-one']
    const sourceInstanceId = owner.battleArea[0].card.instanceId
    const solo = { ...initial, players: { ...initial.players, 'player-one': { ...owner, battleArea: owner.battleArea.slice(0, 1) } } }
    expect(canActivateCookieSkill(solo, 'player-one', sourceInstanceId, 'activate')).toBe(false)
    expect(getCookieSkillUnavailableReason(solo, 'player-one', sourceInstanceId, 'activate')).toBe('自己的戰鬥區必須有來源以外的另一張餅乾。')
    let state = applyGameCommand(initial, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId, trigger: 'activate', paymentIds: [owner.supportArea[0].card.instanceId] })
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
    expect(() => applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'pay', paymentIds: [owner.supportArea[0].card.instanceId], targetIds: [] })).toThrow()
    state = applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'pay', paymentIds: [owner.supportArea[1].card.instanceId], targetIds: [] })
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [sourceInstanceId] })
    expect(getEffectiveAttack(state, sourceInstanceId)).toBe(4)
    expect(canActivateCookieSkill(state, 'player-one', sourceInstanceId, 'activate')).toBe(false)
    state = applyGameCommand(state, { kind: 'advance-phase', playerId: 'player-one' })
    state = applyGameCommand(state, { kind: 'advance-phase', playerId: 'player-one' })
    expect(state.activePlayerId).toBe('player-two')
    expect(getEffectiveAttack(state, sourceInstanceId)).toBe(3)
  })
  it('resolves all other Cookies before opening the optional support-energy Then', () => {
    let state = createBs8009State()
    const player = state.players['player-one']
    const sourceInstanceId = player.battleArea[0]!.card.instanceId
    const initialPaymentId = player.supportArea[0]!.card.instanceId

    state = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId,
      trigger: 'activate',
      paymentIds: [initialPaymentId],
    })

    expect(state.players['player-one'].supportArea[0]!.rested).toBe(true)

    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(state.players['player-two'].battleArea.map((entry) => entry.hpCards.length)).toEqual([5, 4])
    expect(state.pendingAbilityEffect?.effectIndex).toBe(1)

    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(state.players['player-one'].battleArea.map((entry) => entry.hpCards.length)).toEqual([1, 3])
    expect(state.pendingOptionalCostAttack).toMatchObject({
      resolution: 'ability',
      sourceInstanceId,
      cost: { energy: { red: 1 }, discardHand: 0 },
      effectText: expect.stringContaining('For each 3 levels'),
    })
    expect(state.pendingOptionalCostAttack?.sourceEnergy).toBeUndefined()
  })

  it('lets the player skip Then or pay one red support for the break-level attack bonus', () => {
    const initial = createBs8009State()
    const sourceInstanceId = initial.players['player-one'].battleArea[0]!.card.instanceId
    const initialPaymentId = initial.players['player-one'].supportArea[0]!.card.instanceId
    const begin = (state: ReturnType<typeof createBs8009State>) =>
      applyGameCommand(
        applyGameCommand(
          applyGameCommand(state, {
            kind: 'begin-activate-skill',
            playerId: 'player-one',
            sourceInstanceId,
            trigger: 'activate',
            paymentIds: [initialPaymentId],
          }),
          {
            kind: 'resolve-ability-effect',
            playerId: 'player-one',
            targetIds: [],
          },
        ),
        {
          kind: 'resolve-ability-effect',
          playerId: 'player-one',
          targetIds: [],
        },
      )

    const skipped = applyGameCommand(begin(createBs8009State()), {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-one',
      action: 'skip',
    })
    expect(skipped.pendingOptionalCostAttack).toBeNull()
    expect(skipped.pendingAbilityEffect).toBeUndefined()
    expect(skipped.attackModifiers).toEqual([])

    const paid = applyGameCommand(begin(createBs8009State()), {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-one',
      action: 'pay',
      paymentIds: [
        initial.players['player-one'].supportArea[1]!.card.instanceId,
      ],
      targetIds: [],
    })
    expect(paid.pendingOptionalCostAttack).toBeNull()
    expect(paid.pendingAbilityEffect?.effectIndex).toBe(2)
    expect(paid.players['player-one'].supportArea[1]!.rested).toBe(true)

    const resolved = applyGameCommand(paid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [sourceInstanceId],
    })
    expect(resolved.pendingAbilityEffect).toBeUndefined()
    expect(resolved.attackModifiers).toContainEqual(
      expect.objectContaining({
        sourceInstanceId,
        targetInstanceId: sourceInstanceId,
        amount: 1,
        expiresAfterTurn: resolved.turnNumber,
      }),
    )
  })

  it.each([
    { additionalBreakLevels: [1], expectedBreakLevel: 4, expectedBonus: 1 },
    { additionalBreakLevels: [1, 3], expectedBreakLevel: 7, expectedBonus: 2 },
  ])(
    'counts each completed group of three Break levels at total LV $expectedBreakLevel',
    ({ additionalBreakLevels, expectedBreakLevel, expectedBonus }) => {
      const state = resolveBreakLevelBonus(additionalBreakLevels)
      expect(getBreakAreaLevel(state, 'player-one')).toBe(expectedBreakLevel)
      expect(state.attackModifiers).toContainEqual(
        expect.objectContaining({ amount: expectedBonus }),
      )
    },
  )
})
