import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import {
  applyGameCommand,
  createDemoGame,
  executeCardEffect,
  getTrapCandidates,
  getTrapCostOptions,
  getCookieSkillUnavailableReason,
  isEffectConditionMet,
  type CookieCard,
  type GameCard,
  type GameState,
} from './index'
import { createBattleState } from './test-helpers/battle-helpers'
import { getCardPoolEntry } from './card-pool'

const official = (id: string, suffix: string): GameCard => {
  const entry = getCardPoolEntry(id)
  if (!entry) throw new Error(`Missing ${id}`)
  const converted = convertOfficialCardToGameCard(entry)
  if (converted.status !== 'converted') throw new Error(`Unconverted ${id}`)
  return { ...converted.gameCard, instanceId: `${id}:${suffix}` }
}

const cookie = (id: string, suffix: string): CookieCard => {
  const card = official(id, suffix)
  if (card.type !== 'cookie') throw new Error(`Expected Cookie ${id}`)
  return card
}

const hpCard = (suffix: string) => official('BS8-058', `hp-${suffix}`)
const support = (suffix: string, color: GameCard['energyColor'] = 'green') => ({
  ...official('BS8-053', `support-${suffix}`),
  energyColor: color,
})

const withHp = (card: CookieCard, count = card.hp) => ({
  card,
  hpCards: Array.from({ length: count }, (_, index) => hpCard(`${card.instanceId}-${index}`)),
  rested: false,
})

const mysticState = (hasAnotherMystic: boolean): GameState => {
  const base = createDemoGame(8059)
  const source = cookie('BS8-059', 'source')
  const second = cookie('BS8-059', 'second')
  const opponentOne = cookie('BS8-058', 'opponent-one')
  const opponentTwo = cookie('BS8-070', 'opponent-two')
  const energy = support('mystic-energy')
  const returnedOne = support('mystic-return-one')
  const returnedTwo = support('mystic-return-two')
  return {
    ...base,
    activePlayerId: 'player-one',
    phase: 'main',
    skillUsesThisTurn: [],
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        battleArea: [withHp(source), ...(hasAnotherMystic ? [withHp(second)] : [])],
        supportArea: [
          { card: energy, rested: false },
          { card: returnedOne, rested: false },
          { card: returnedTwo, rested: false },
        ],
      },
      'player-two': {
        ...base.players['player-two'],
        battleArea: [withHp(opponentOne, 3), withHp(opponentTwo, 3)],
      },
    },
  }
}

const activateMystic = (state: GameState): GameState =>
  applyGameCommand(state, {
    kind: 'begin-activate-skill',
    playerId: 'player-one',
    sourceInstanceId: 'BS8-059:source',
    trigger: 'activate',
    paymentIds: ['BS8-053:support-mystic-energy'],
    supportToHandIds: [
      'BS8-053:support-mystic-return-one',
      'BS8-053:support-mystic-return-two',
    ],
  })

describe('BS8-059 Mystic Flour Cookie', () => {
  it('does not offer the skill while another Mystic Flour is in battle', () => {
    const state = mysticState(true)
    const handBefore = state.players['player-one'].hand

    expect(() => activateMystic(state)).toThrow(/目前無法發動這個餅乾技能/)
    expect(getCookieSkillUnavailableReason(
      state,
      'player-one',
      'BS8-059:source',
      'activate',
    )).toContain('另一張「Mystic Flour Cookie」')
    expect(state.players['player-one'].supportArea.every((entry) => !entry.rested)).toBe(true)
    expect(state.players['player-one'].hand).toEqual(handBefore)
    expect(state.players['player-two'].battleArea.map((entry) => entry.hpCards.length)).toEqual([3, 3])
  })

  it('removes up to two HP cards from every opponent Cookie when it is the only Mystic Flour', () => {
    let state = activateMystic(mysticState(false))
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })

    expect(state.players['player-two'].battleArea.map((entry) => entry.hpCards.length)).toEqual([1, 1])
  })

  it('requires both returned support cards to be green and rejects mixed-color payment', () => {
    const state = mysticState(false)
    const redSupport = { card: support('mystic-red-extra', 'red'), rested: false }
    const withRed: GameState = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          supportArea: [...state.players['player-one'].supportArea, redSupport],
        },
      },
    }
    const snapshot = structuredClone(withRed)
    expect(() => applyGameCommand(withRed, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: 'BS8-059:source',
      trigger: 'activate',
      paymentIds: ['BS8-053:support-mystic-energy'],
      supportToHandIds: [
        'BS8-053:support-mystic-return-one',
        'BS8-053:support-mystic-red-extra',
      ],
    })).toThrow(/支援區回手費用必須選擇 green 能量顏色的卡牌/)
    expect(withRed).toEqual(snapshot)

    const oneGreenShort: GameState = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          supportArea: state.players['player-one'].supportArea.map((entry, index) =>
            index === 2 ? { ...entry, card: { ...entry.card, energyColor: 'red' as const } } : entry,
          ),
        },
      },
    }
    const unpaidSnapshot = structuredClone(oneGreenShort)
    expect(() => activateMystic(oneGreenShort)).toThrow(/目前無法發動這個餅乾技能/)
    expect(oneGreenShort).toEqual(unpaidSnapshot)
  })
})

describe('BS8-065 Spinach Cookie', () => {
  it('only offers the optional rested-support recovery while behind on support count', () => {
    const source = cookie('BS8-065', 'source')
    const effect = source.skill?.effects[0]
    if (!effect || effect.kind !== 'set-active') throw new Error('Missing BS8-065 set-active effect')
    const base = createDemoGame(8065)
    const restedSupport = support('spinach-rested')
    const opponentSupport = support('spinach-opponent')
    const behind: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [withHp(source)],
          supportArea: [{ card: restedSupport, rested: true }],
        },
        'player-two': {
          ...base.players['player-two'],
          supportArea: [
            { card: opponentSupport, rested: false },
            { card: support('spinach-opponent-two'), rested: false },
          ],
        },
      },
    }
    const context = {
      sourcePlayerId: 'player-one' as const,
      sourceInstanceId: source.instanceId,
      sourceCardName: source.name,
    }

    expect(isEffectConditionMet(behind, context, effect)).toBe(true)
    expect(
      executeCardEffect(behind, context, effect, [restedSupport.instanceId])
        .players['player-one'].supportArea[0]?.rested,
    ).toBe(false)

    const tied: GameState = {
      ...behind,
      players: {
        ...behind.players,
        'player-one': {
          ...behind.players['player-one'],
          supportArea: [
            ...behind.players['player-one'].supportArea,
            { card: support('spinach-self-tied'), rested: true },
          ],
        },
      },
    }
    expect(isEffectConditionMet(tied, context, effect)).toBe(false)
  })
})

const trapState = (
  cardId: 'BS8-073' | 'BS8-074',
  selfSupportCount: number,
  opponentSupportCount: number,
) => {
  const base = createBattleState()
  const trap = official(cardId, 'trap')
  const defender = cookie('BS8-058', 'defender')
  const attacker = cookie('BS8-036', 'attacker')
  const selfSupports = Array.from({ length: selfSupportCount }, (_, index) =>
    support(`self-${index + 1}`),
  )
  const attackSupport = support('attacker-payment', 'yellow')
  const opponentSupports = [
    attackSupport,
    ...Array.from({ length: Math.max(0, opponentSupportCount - 1) }, (_, index) =>
      support(`opponent-${index + 1}`, 'yellow'),
    ),
  ]
  const state: GameState = {
    ...base,
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        hand: [trap],
        battleArea: [withHp(defender)],
        supportArea: selfSupports.map((card) => ({ card, rested: false })),
      },
      'player-two': {
        ...base.players['player-two'],
        battleArea: [withHp(attacker)],
        supportArea: opponentSupports.map((card) => ({ card, rested: false })),
      },
    },
  }
  const declared = applyGameCommand(state, {
    kind: 'declare-attack',
    playerId: 'player-two',
    attackerInstanceId: attacker.instanceId,
    targetInstanceId: defender.instanceId,
    supportPaymentIds: [attackSupport.instanceId],
  })
  return { declared, trap, attacker, selfSupports, opponentSupports }
}

describe('BS8-073 Noodle Cocoon', () => {
  it('uses separate green support payments, then lets the opponent rest an active support only while behind', () => {
    const { declared, trap, attacker, selfSupports, opponentSupports } = trapState('BS8-073', 2, 4)
    const played = applyGameCommand(declared, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: trap.instanceId,
      paymentIds: [selfSupports[0]!.instanceId],
      targetIds: [attacker.instanceId],
    })

    expect(played.attackModifiers).toContainEqual(expect.objectContaining({
      sourceInstanceId: trap.instanceId,
      targetInstanceId: attacker.instanceId,
      amount: -1,
    }))
    expect(played.pendingAbilityEffect).toMatchObject({
      sourceKind: 'trap',
      effectIndex: 1,
      battleContinuation: 'after-trap',
    })

    const offered = applyGameCommand(played, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(offered.pendingOptionalCostAttack).toMatchObject({
      resolution: 'ability',
      cost: { energy: { green: 1 }, discardHand: 0 },
      sourceEnergy: undefined,
    })

    const paid = applyGameCommand(offered, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-one',
      action: 'pay',
      paymentIds: [selfSupports[1]!.instanceId],
    })
    expect(paid.players['player-one'].supportArea.every((entry) => entry.rested)).toBe(true)

    const resolving = applyGameCommand(paid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(resolving.pendingOpponentRestSupport).toMatchObject({
      playerId: 'player-two',
      count: 1,
      activeOnly: true,
    })

    const selected = opponentSupports[1]!.instanceId
    const finished = applyGameCommand(resolving, {
      kind: 'resolve-opponent-rest-support',
      playerId: 'player-two',
      cardIds: [selected],
    })
    expect(
      finished.players['player-two'].supportArea.find((entry) => entry.card.instanceId === selected)?.rested,
    ).toBe(true)
  })

  it('keeps the optional Then visible but does not rest support when the support-count condition is false', () => {
    const { declared, trap, attacker, selfSupports } = trapState('BS8-073', 3, 3)
    const played = applyGameCommand(declared, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: trap.instanceId,
      paymentIds: [selfSupports[0]!.instanceId],
      targetIds: [attacker.instanceId],
    })
    const offered = applyGameCommand(played, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    const paid = applyGameCommand(offered, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-one',
      action: 'pay',
      paymentIds: [selfSupports[1]!.instanceId],
    })
    const resolved = applyGameCommand(paid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })

    expect(resolved.pendingOpponentRestSupport).toBeUndefined()
    expect(resolved.players['player-two'].supportArea.every((entry) => !entry.rested)).toBe(false)
  })
})

describe('BS8-074 White Flour Fog', () => {
  it('has a zero green activation cost only while its owner has at least two fewer supports', () => {
    const reduced = trapState('BS8-074', 0, 2)
    expect(getTrapCostOptions(reduced.trap.trap!, reduced.declared, 'player-one')).toEqual([
      { energy: {} },
    ])
    expect(getTrapCandidates(reduced.declared, 'player-one')).toContainEqual(reduced.trap)
    expect(() => applyGameCommand(reduced.declared, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: reduced.trap.instanceId,
      paymentIds: [],
      targetIds: [reduced.attacker.instanceId],
    })).not.toThrow()

    const normal = trapState('BS8-074', 1, 1)
    expect(getTrapCostOptions(normal.trap.trap!, normal.declared, 'player-one')).toEqual([
      { energy: { green: 1 } },
    ])
    expect(() => applyGameCommand(normal.declared, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: normal.trap.instanceId,
      paymentIds: [],
      targetIds: [normal.attacker.instanceId],
    })).toThrow(/Invalid trap payment/)
    expect(() => applyGameCommand(normal.declared, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: normal.trap.instanceId,
      paymentIds: [normal.selfSupports[0]!.instanceId],
      targetIds: [normal.attacker.instanceId],
    })).not.toThrow()
  })
})
