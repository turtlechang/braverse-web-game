import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { commandFromLogEntry } from './replay'
import { selectEnergyPayment } from './energy'
import { createSt9012PreviewState, st9012Zones, type St9012Scenario } from './st9-012-demo'
import type { GameState } from './types'

const owner = 'player-one' as const
const opponent = 'player-two' as const

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`)
  return value
}

const source = (state: GameState) => required(
  state.players[owner].battleArea.find(cookie => cookie.card.id === 'ST9-012'),
  'original ST9-012 in battle area',
)

const replay = (scenario: St9012Scenario, state: GameState) => {
  let independent = createSt9012PreviewState(scenario)
  for (const entry of state.commandLog ?? []) {
    independent = applyGameCommand(independent, commandFromLogEntry(entry))
  }
  expect(JSON.parse(JSON.stringify(independent))).toEqual(JSON.parse(JSON.stringify(state)))
}

const openAttackThen = (initial: GameState): GameState => {
  const attacker = source(initial)
  const target = required(initial.players[opponent].battleArea[0], 'opponent Cookie target')
  const paymentIds = selectEnergyPayment({ blue: 2 }, initial.players[owner].supportArea)
  if (!paymentIds) throw new Error('Two real active blue Supports are required for ST9-012')

  let state = applyGameCommand(initial, {
    kind: 'declare-attack', playerId: owner,
    attackerInstanceId: attacker.card.instanceId,
    targetInstanceId: target.card.instanceId,
    supportPaymentIds: paymentIds,
  })
  for (let step = 0; state.pendingBattle && step < 20; step += 1) {
    if (state.pendingOptionalCostAttack) return state
    switch (state.pendingBattle.stage) {
      case 'trap':
        state = applyGameCommand(state, { kind: 'skip-trap', playerId: opponent })
        break
      case 'flip':
        state = applyGameCommand(state, { kind: 'resolve-flip', playerId: opponent, activate: false })
        break
      case 'damage':
        state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: opponent })
        break
      case 'attack-effect':
        state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: owner, targetIds: [] })
        break
    }
  }
  return state
}

describe('ST9-012 original physical card behavior', () => {
  it.each<St9012Scenario>([
    'on-play', 'on-play-high-hand', 'attack', 'attack-no-sea-fairy', 'attack-then-unpayable',
  ])(
    '%s uses two legal sixty-card decks, unique IDs, printed art and printed HP', scenario => {
      const state = createSt9012PreviewState(scenario)
      const allInstanceIds: string[] = []

      for (const playerId of [owner, opponent]) {
        const cards = st9012Zones(state, playerId)
        expect(cards).toHaveLength(60)
        expect(cards.every(card => card.imageUrl?.startsWith('https://cookierunbraverse.com/') === true)).toBe(true)
        allInstanceIds.push(...cards.map(card => card.instanceId))

        const copiesById = new Map<string, number>()
        const copiesByName = new Map<string, number>()
        for (const card of cards) {
          copiesById.set(card.id, (copiesById.get(card.id) ?? 0) + 1)
          copiesByName.set(card.name, (copiesByName.get(card.name) ?? 0) + 1)
        }
        expect([...copiesById.values()].every(count => count <= 4)).toBe(true)
        expect([...copiesByName.values()].every(count => count <= 4)).toBe(true)
        for (const cookie of state.players[playerId].battleArea) {
          expect(cookie.hpCards).toHaveLength(cookie.card.hp)
        }
      }

      expect(new Set(allInstanceIds).size).toBe(120)
      expect(state.players[owner].battleArea.map(cookie => cookie.card.id)).toEqual(
        scenario === 'attack' || scenario === 'attack-then-unpayable' ? ['ST9-012', 'ST9-006'] :
          scenario === 'attack-no-sea-fairy' ? ['ST9-012'] : [],
      )
    },
  )

  it.each([0, 1, 2])('resolves actual On Play draw-up-to choice %i after deploying White Pearl', drawCount => {
    const initial = createSt9012PreviewState('on-play')
    const before = structuredClone(initial)
    const initialDeckCount = initial.players[owner].deck.length
    const sourceInHand = required(initial.players[owner].hand.find(card => card.id === 'ST9-012'), 'hand source')
    expect(initial.players[owner].hand).toHaveLength(5)
    const deployed = applyGameCommand(initial, { kind: 'deploy-cookie', playerId: owner, instanceId: sourceInHand.instanceId })
    expect(deployed.players[owner].battleArea[0]?.card.id).toBe('ST9-012')
    expect(deployed.players[owner].battleArea[0]?.hpCards).toHaveLength(2)
    expect(deployed.players[owner].hand).toHaveLength(4)
    expect(deployed.players[owner].deck).toHaveLength(initialDeckCount - 2)
    expect(deployed.pendingOnPlay?.sourceInstanceId).toBe(sourceInHand.instanceId)

    const activated = applyGameCommand(deployed, {
      kind: 'begin-activate-skill', playerId: owner,
      sourceInstanceId: sourceInHand.instanceId, trigger: 'on-play', paymentIds: [],
    })
    expect(activated.pendingOnPlay ?? null).toBeNull()
    expect(activated.pendingAbilityEffect).toMatchObject({
      playerId: owner, trigger: 'on-play', sourceInstanceId: sourceInHand.instanceId,
    })
    const drawChoice = applyGameCommand(activated, {
      kind: 'resolve-ability-effect', playerId: owner, targetIds: [],
    })
    expect(drawChoice.pendingDrawUpTo).toMatchObject({ playerId: owner, max: 2, sourceCardId: 'ST9-012' })

    const state = applyGameCommand(drawChoice, { kind: 'resolve-draw-up-to', playerId: owner, drawCount })
    expect(state.players[owner].hand).toHaveLength(4 + drawCount)
    expect(state.players[owner].deck).toHaveLength(initialDeckCount - 2 - drawCount)
    expect(state.players[owner].battleArea[0]?.hpCards).toHaveLength(2)
    expect(state.pendingDrawUpTo ?? null).toBeNull()
    expect(initial).toEqual(before)
    replay('on-play', state)
  })

  it('does not draw when the actual On Play resolves with five cards after deployment', () => {
    const initial = createSt9012PreviewState('on-play-high-hand')
    const initialDeckCount = initial.players[owner].deck.length
    const sourceInHand = required(initial.players[owner].hand.find(card => card.id === 'ST9-012'), 'hand source')
    const deployed = applyGameCommand(initial, {
      kind: 'deploy-cookie', playerId: owner, instanceId: sourceInHand.instanceId,
    })
    expect(initial.players[owner].hand).toHaveLength(6)
    expect(deployed.players[owner].hand).toHaveLength(5)
    expect(() => applyGameCommand(deployed, {
      kind: 'begin-activate-skill', playerId: owner,
      sourceInstanceId: sourceInHand.instanceId, trigger: 'on-play', paymentIds: [],
    })).toThrow()
    const skipped = applyGameCommand(deployed, {
      kind: 'skip-on-play', playerId: owner, sourceInstanceId: sourceInHand.instanceId,
    })
    expect(skipped.pendingOnPlay ?? null).toBeNull()
    expect(skipped.pendingDrawUpTo ?? null).toBeNull()
    expect(skipped.players[owner].hand).toHaveLength(5)
    expect(skipped.players[owner].deck).toHaveLength(initialDeckCount - 2)
    replay('on-play-high-hand', skipped)
  })

  it('pays real BB attack energy, then optional B from Support for one conditional damage', () => {
    const initial = createSt9012PreviewState('attack')
    const before = structuredClone(initial)
    const target = initial.players[opponent].battleArea[0]!
    const then = openAttackThen(initial)
    expect(then.pendingBattle?.stage).toBe('attack-effect')
    expect(then.pendingOptionalCostAttack).toMatchObject({
      sourceInstanceId: source(initial).card.instanceId,
      cost: { energy: { blue: 1 } },
    })
    expect(then.players[owner].supportArea.filter(support => support.rested)).toHaveLength(2)
    expect(then.players[opponent].battleArea[0]?.hpCards).toHaveLength(target.hpCards.length - 2)
    const remainingBlue = required(
      selectEnergyPayment({ blue: 1 }, then.players[owner].supportArea),
      'one remaining real blue Support',
    )

    let state = applyGameCommand(then, {
      kind: 'resolve-optional-cost-attack', playerId: owner,
      action: 'pay', paymentIds: remainingBlue,
      targetIds: [target.card.instanceId],
    })
    for (let step = 0; state.pendingBattle?.effectDamageSequence && step < 10; step += 1) {
      state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: opponent })
    }

    expect(state.players[owner].supportArea.every(support => support.rested)).toBe(true)
    expect(state.players[opponent].battleArea[0]?.hpCards).toHaveLength(target.hpCards.length - 3)
    expect(state.pendingOptionalCostAttack ?? null).toBeNull()
    expect(state.pendingBattle ?? null).toBeNull()
    expect(state.commandLog?.some(entry => entry.commandKind === 'declare-attack')).toBe(true)
    expect(state.commandLog?.some(entry => entry.commandKind === 'resolve-optional-cost-attack')).toBe(true)
    expect(initial).toEqual(before)
    replay('attack', state)
  })

  it('can pay the optional B and select zero damage targets', () => {
    const initial = createSt9012PreviewState('attack')
    const target = initial.players[opponent].battleArea[0]!
    const then = openAttackThen(initial)
    const paymentIds = required(selectEnergyPayment({ blue: 1 }, then.players[owner].supportArea), 'optional B')
    const state = applyGameCommand(then, {
      kind: 'resolve-optional-cost-attack', playerId: owner,
      action: 'pay', paymentIds, targetIds: [],
    })
    expect(state.players[owner].supportArea.every(support => support.rested)).toBe(true)
    expect(state.players[opponent].battleArea[0]?.hpCards).toHaveLength(target.hpCards.length - 2)
    expect(state.pendingBattle ?? null).toBeNull()
    replay('attack', state)
  })

  it('can skip the optional B payment without changing the base attack result', () => {
    const initial = createSt9012PreviewState('attack')
    const target = initial.players[opponent].battleArea[0]!
    const then = openAttackThen(initial)
    const beforeSkip = structuredClone(then.players[owner])
    const state = applyGameCommand(then, {
      kind: 'resolve-optional-cost-attack', playerId: owner, action: 'skip',
    })
    expect(state.players[owner].supportArea).toEqual(beforeSkip.supportArea)
    expect(state.players[owner].battleArea).toEqual(beforeSkip.battleArea)
    expect(state.players[opponent].battleArea[0]?.hpCards).toHaveLength(target.hpCards.length - 2)
    expect(state.pendingOptionalCostAttack ?? null).toBeNull()
    expect(state.pendingBattle ?? null).toBeNull()
    replay('attack', state)
  })

  it('rejects the optional B when only a wrong-color Support remains, then allows skipping', () => {
    const initial = createSt9012PreviewState('attack-then-unpayable')
    const target = initial.players[opponent].battleArea[0]!
    const then = openAttackThen(initial)
    const redSupport = required(
      then.players[owner].supportArea.find(support => !support.rested && support.card.id === 'BS3-018'),
      'the original red Support that cannot pay the blue Then cost',
    )
    expect(then.pendingOptionalCostAttack?.cost).toMatchObject({ energy: { blue: 1 } })
    expect(then.players[owner].supportArea.filter(support => support.rested)).toHaveLength(2)
    expect(selectEnergyPayment({ blue: 1 }, then.players[owner].supportArea)).toBeNull()

    const beforeInvalidPayment = structuredClone(then)
    expect(() => applyGameCommand(then, {
      kind: 'resolve-optional-cost-attack', playerId: owner,
      action: 'pay', paymentIds: [redSupport.card.instanceId], targetIds: [target.card.instanceId],
    })).toThrow()
    expect(then).toEqual(beforeInvalidPayment)

    const supportAfterBaseAttack = structuredClone(then.players[owner].supportArea)
    const skipped = applyGameCommand(then, {
      kind: 'resolve-optional-cost-attack', playerId: owner, action: 'skip',
    })
    expect(skipped.players[owner].supportArea).toEqual(supportAfterBaseAttack)
    expect(skipped.players[opponent].battleArea[0]?.hpCards).toHaveLength(target.hpCards.length - 2)
    expect(skipped.pendingOptionalCostAttack ?? null).toBeNull()
    expect(skipped.pendingBattle ?? null).toBeNull()
    expect(skipped.commandLog?.at(-1)?.commandKind).toBe('resolve-optional-cost-attack')
    replay('attack-then-unpayable', skipped)
  })

  it('does not open the optional Then or spend the third B without Sea Fairy Cookie', () => {
    const initial = createSt9012PreviewState('attack-no-sea-fairy')
    const target = initial.players[opponent].battleArea[0]!
    const before = structuredClone(initial)
    const state = openAttackThen(initial)
    expect(state.pendingOptionalCostAttack ?? null).toBeNull()
    expect(state.pendingBattle ?? null).toBeNull()
    expect(state.players[owner].supportArea.filter(support => support.rested)).toHaveLength(2)
    expect(state.players[owner].supportArea.filter(support => !support.rested)).toHaveLength(1)
    expect(state.players[opponent].battleArea[0]?.hpCards).toHaveLength(target.hpCards.length - 2)
    expect(initial).toEqual(before)
    replay('attack-no-sea-fairy', state)
  })
})
