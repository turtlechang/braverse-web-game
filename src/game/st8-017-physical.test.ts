import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { commandFromLogEntry } from './replay'
import { getTrapCandidates } from './battle'
import { createSt8017AttackStartState, createSt8017PreviewState, st8017Scenarios } from './st8-017-demo'
import type { GameState } from './types'

const owner = 'player-one' as const
const opponent = 'player-two' as const
const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === undefined || value === null) throw Error(`Missing ${label}`)
  return value
}

const allCards = (state: GameState, playerId: 'player-one' | 'player-two') => {
  const player = state.players[playerId]
  return [
    ...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile,
    ...player.supportArea.map(support => support.card),
    ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
  ]
}

const trap = (state: GameState) => required(
  state.players[owner].hand.find(card => card.id === 'ST8-017'),
  'original Hindering Darkness',
)

const attacker = (state: GameState) => required(
  state.players[opponent].battleArea.find(cookie => cookie.card.id === 'ST8-005'),
  'opponent Wind Archer Cookie',
)

const declareAttack = (state: GameState) => applyGameCommand(state, {
  kind: 'declare-attack', playerId: opponent,
  attackerInstanceId: attacker(state).card.instanceId,
  targetInstanceId: required(state.players[owner].battleArea[0], 'Wind Archer defender').card.instanceId,
  supportPaymentIds: state.players[opponent].supportArea.slice(0, 3).map(support => support.card.instanceId),
})

const play = (
  state: GameState,
  targetIds: string[] = [attacker(state).card.instanceId],
  paymentIds?: string[],
) => {
  const own = state.players[owner]
  const source = trap(state)
  const selectedPaymentIds = paymentIds ?? own.supportArea
    .filter(support => !support.rested && support.card.energyColor === 'green')
    .slice(0, 2)
    .map(support => support.card.instanceId)
  if (selectedPaymentIds.length !== 2) throw Error('Two active support cards are required')
  return applyGameCommand(state, {
    kind: 'play-trap', playerId: owner, trapInstanceId: source.instanceId,
    paymentIds: selectedPaymentIds, targetIds,
  })
}

const replay = (initial: GameState, final: GameState) => {
  let replayed = structuredClone(initial)
  for (const entry of final.commandLog ?? []) replayed = applyGameCommand(replayed, commandFromLogEntry(entry))
  expect(JSON.parse(JSON.stringify(replayed))).toEqual(JSON.parse(JSON.stringify(final)))
}

describe('ST8-017 physical Hindering Darkness flow', () => {
  it.each(st8017Scenarios)('%s uses original 60-card decks, unique IDs, four-copy limits and printed HP', scenario => {
    const state = createSt8017PreviewState(scenario), ids: string[] = []
    for (const playerId of [owner, opponent]) {
      const cards = allCards(state, playerId)
      expect(cards).toHaveLength(60)
      ids.push(...cards.map(card => card.instanceId))
      const counts = new Map<string, number>()
      for (const card of cards) {
        expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
        counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
      }
      expect([...counts.values()].every(count => count <= 4)).toBe(true)
      for (const cookie of state.players[playerId].battleArea) {
        expect(cookie.hpCards).toHaveLength(cookie.card.hp)
      }
    }
    expect(new Set(ids).size).toBe(120)
    expect(state.pendingBattle?.stage).toBe('trap')
    expect(state.commandLog?.map(entry => entry.commandKind)).toEqual(['declare-attack'])
  })

  it.each([0, 1])('pays GG before comparing support counts and resolves Then draw %i', drawCount => {
    const attackStart = createSt8017AttackStartState('positive')
    const before = structuredClone(attackStart)
    const initial = declareAttack(attackStart)
    const attackerEntry = attacker(initial)
    const defender = required(initial.players[owner].battleArea[0], 'Wind Archer defender')
    const hpBeforeTrap = defender.hpCards.length
    expect(initial.players[owner].supportArea).toHaveLength(3)
    expect(initial.players[opponent].supportArea).toHaveLength(3)
    expect(getTrapCandidates(initial, owner).some(card => card.id === 'ST8-017')).toBe(true)
    expect(initial.commandLog?.map(entry => entry.commandKind)).toEqual(['declare-attack'])

    const paid = play(initial)
    expect(paid.players[owner].supportArea.filter(support => support.rested)).toHaveLength(3)
    expect(paid.players[owner].discardPile).toContainEqual(trap(initial))
    expect(paid.attackModifiers).toContainEqual(expect.objectContaining({
      sourceInstanceId: trap(initial).instanceId,
      targetInstanceId: attackerEntry.card.instanceId,
      amount: -2,
    }))
    expect(paid.pendingBattle?.declaredDamage).toBe(1)
    expect(paid.pendingDrawUpTo).toMatchObject({ playerId: owner, max: 1, sourceInstanceId: trap(initial).instanceId })
    expect(paid.players[owner].battleArea[0]?.hpCards).toHaveLength(hpBeforeTrap)

    const drawn = applyGameCommand(paid, { kind: 'resolve-draw-up-to', playerId: owner, drawCount })
    expect(drawn.players[owner].hand).toHaveLength(initial.players[owner].hand.length - 1 + drawCount)
    expect(drawn.players[owner].deck).toHaveLength(initial.players[owner].deck.length - drawCount)
    expect(drawn.pendingDrawUpTo ?? null).toBeNull()
    expect(drawn.players[owner].battleArea[0]?.hpCards).toHaveLength(hpBeforeTrap)
    const settled = applyGameCommand(drawn, { kind: 'resolve-battle', playerId: opponent })
    expect(settled.pendingBattle).toBeNull()
    expect(settled.players[owner].battleArea[0]?.hpCards).toHaveLength(hpBeforeTrap - 1)
    expect(settled.commandLog?.map(entry => entry.commandKind)).toEqual([
      'declare-attack', 'play-trap', 'resolve-draw-up-to', 'resolve-battle',
    ])
    replay(attackStart, initial)
    replay(attackStart, paid)
    replay(attackStart, drawn)
    replay(attackStart, settled)
    expect(attackStart).toEqual(before)
  })

  it('skips the Then when support counts differ but still applies the optional -2 attack effect', () => {
    const attackStart = createSt8017AttackStartState('unequal-supports')
    const initial = declareAttack(attackStart)
    const attackerEntry = attacker(initial)
    expect(initial.players[owner].supportArea).toHaveLength(3)
    expect(initial.players[opponent].supportArea).toHaveLength(4)

    const paid = play(initial)
    expect(paid.attackModifiers).toContainEqual(expect.objectContaining({
      targetInstanceId: attackerEntry.card.instanceId, amount: -2,
    }))
    expect(paid.pendingBattle?.declaredDamage).toBe(1)
    expect(paid.pendingDrawUpTo).toBeFalsy()
    replay(attackStart, paid)
  })

  it('can select a Cookie other than the current attacker or choose zero, independently of the draw condition', () => {
    const attackStart = createSt8017AttackStartState('positive')
    const initial = declareAttack(attackStart)
    const other = required(
      initial.players[opponent].battleArea.find(cookie => cookie.card.id === 'ST1-011'),
      'other opposing Cookie',
    )
    const paid = play(initial, [other.card.instanceId])
    expect(paid.attackModifiers).toContainEqual(expect.objectContaining({
      targetInstanceId: other.card.instanceId, amount: -2,
    }))
    expect(paid.attackModifiers.some(modifier => modifier.targetInstanceId === attacker(initial).card.instanceId)).toBe(false)
    expect(paid.pendingBattle?.declaredDamage).toBe(3)
    expect(paid.pendingDrawUpTo?.max).toBe(1)

    const zero = play(initial, [])
    expect(zero.attackModifiers.some(modifier => modifier.sourceInstanceId === trap(initial).instanceId)).toBe(false)
    expect(zero.pendingBattle?.declaredDamage).toBe(3)
    expect(zero.pendingDrawUpTo?.max).toBe(1)
    replay(attackStart, paid)
    replay(attackStart, zero)
  })

  it('rejects the actual red support payment when the defender lacks two active green supports', () => {
    const attackStart = createSt8017AttackStartState('no-green-payment')
    const initial = declareAttack(attackStart)
    const source = trap(initial)
    const before = structuredClone(initial)
    const redPaymentIds = initial.players[owner].supportArea
      .filter(support => !support.rested)
      .slice(0, 2)
      .map(support => support.card.instanceId)
    expect(redPaymentIds).toHaveLength(2)
    expect(redPaymentIds.map(id => initial.players[owner].supportArea.find(support => support.card.instanceId === id)?.card.energyColor))
      .toEqual(['red', 'red'])
    expect(getTrapCandidates(initial, owner).some(card => card.id === 'ST8-017')).toBe(false)
    expect(() => play(initial, [attacker(initial).card.instanceId], redPaymentIds)).toThrow()
    expect(initial).toEqual(before)
    expect(initial.players[owner].hand).toContainEqual(source)
    replay(attackStart, initial)
  })

  it('rejects a target belonging to the Trap owner without changing the pending response', () => {
    const initial = createSt8017PreviewState('positive')
    const ownCookie = initial.players[owner].battleArea[0]!.card.instanceId
    const before = structuredClone(initial)
    const paymentIds = initial.players[owner].supportArea
      .filter(support => !support.rested && support.card.energyColor === 'green')
      .slice(0, 2)
      .map(support => support.card.instanceId)
    expect(() => applyGameCommand(initial, {
      kind: 'play-trap', playerId: owner, trapInstanceId: trap(initial).instanceId,
      paymentIds, targetIds: [], effectTargets: [[ownCookie], []],
    })).toThrow()
    expect(initial).toEqual(before)
  })
})
