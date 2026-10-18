import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { commandFromLogEntry } from './replay'
import { getTrapCandidates } from './battle'
import { createSt8019AttackStartState, createSt8019PreviewState } from './st8-019-demo'
import type { GameState } from './types'

const owner = 'player-one' as const
const opponent = 'player-two' as const

const trap = (state: GameState) => {
  const source = [
    ...state.players[owner].hand,
    ...state.players[owner].discardPile,
  ].find(card => card.id === 'ST8-019')
  if (!source) throw Error('Original Bad Omen is missing')
  return source
}

const attacker = (state: GameState) => {
  const source = state.players[opponent].battleArea.find(cookie => cookie.card.id === 'BS1-072')
  if (!source) throw Error('Original Pudding Cookie attacker is missing')
  return source
}

const playTrap = (state: GameState, targetIds: string[] = [attacker(state).card.instanceId]) => {
  const source = trap(state)
  const paymentIds = state.players[owner].supportArea
    .filter(support => !support.rested && support.card.energyColor === 'green')
    .slice(0, 2)
    .map(support => support.card.instanceId)
  if (paymentIds.length !== 2) throw Error('Two active green Supports are required')
  return applyGameCommand(state, {
    kind: 'play-trap', playerId: owner, trapInstanceId: source.instanceId,
    paymentIds, targetIds,
  })
}

const replay = (initial: GameState, final: GameState) => {
  let replayed = structuredClone(initial)
  for (const entry of final.commandLog ?? []) replayed = applyGameCommand(replayed, commandFromLogEntry(entry))
  expect(JSON.parse(JSON.stringify(replayed))).toEqual(JSON.parse(JSON.stringify(final)))
}

const modifiersFromTrap = (state: GameState) => state.attackModifiers
  .filter(modifier => modifier.sourceInstanceId === trap(state).instanceId)

describe('ST8-019 physical Bad Omen Trap flow', () => {
  it('uses real 60-card decks and the printed GG Trap response against a four-damage attack', () => {
    const state = createSt8019PreviewState('equal-supports')
    const ids: string[] = []
    for (const playerId of [owner, opponent]) {
      const player = state.players[playerId]
      const cards = [
        ...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile,
        ...player.supportArea.map(support => support.card),
        ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
      ]
      expect(cards).toHaveLength(60)
      ids.push(...cards.map(card => card.instanceId))
      const counts = new Map<string, number>()
      for (const card of cards) {
        expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
        counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
      }
      expect([...counts.values()].every(count => count <= 4)).toBe(true)
      for (const cookie of player.battleArea) expect(cookie.hpCards).toHaveLength(cookie.card.hp)
    }
    expect(new Set(ids).size).toBe(120)
    expect(state.pendingBattle).toMatchObject({ stage: 'trap', declaredDamage: 4 })
    expect(state.players[owner].supportArea).toHaveLength(3)
    expect(state.players[opponent].supportArea).toHaveLength(3)
    expect(getTrapCandidates(state, owner).some(card => card.id === 'ST8-019')).toBe(true)
  })

  it('applies both reductions to the same chosen attacker only when Support counts match', () => {
    const attackStart = createSt8019AttackStartState('equal-supports')
    const before = structuredClone(attackStart)
    const initial = createSt8019PreviewState('equal-supports')
    const source = trap(initial)
    const selectedAttacker = attacker(initial).card
    const played = playTrap(initial)
    expect(played.players[owner].discardPile).toContainEqual(source)
    expect(played.players[owner].supportArea.filter(support => support.rested)).toHaveLength(3)
    expect(modifiersFromTrap(played).map(modifier => ({
      targetInstanceId: modifier.targetInstanceId,
      amount: modifier.amount,
      expiresAfterTurn: modifier.expiresAfterTurn,
    }))).toEqual([
      { targetInstanceId: selectedAttacker.instanceId, amount: -2, expiresAfterTurn: 2 },
      { targetInstanceId: selectedAttacker.instanceId, amount: -1, expiresAfterTurn: 2 },
    ])
    expect(played.pendingBattle?.declaredDamage).toBe(1)
    const settled = applyGameCommand(played, { kind: 'resolve-battle', playerId: opponent })
    expect(settled.players[owner].battleArea[0]?.hpCards).toHaveLength(5)
    expect(settled.pendingBattle).toBeNull()
    expect(settled.commandLog?.map(entry => entry.commandKind)).toEqual([
      'declare-attack', 'play-trap', 'resolve-battle',
    ])
    replay(attackStart, played)
    replay(attackStart, settled)
    expect(attackStart).toEqual(before)

    const unequalStart = createSt8019AttackStartState('unequal-supports')
    const unequalInitial = createSt8019PreviewState('unequal-supports')
    const unequalPlayed = playTrap(unequalInitial)
    expect(unequalStart.players[owner].supportArea).toHaveLength(3)
    expect(unequalStart.players[opponent].supportArea).toHaveLength(4)
    expect(modifiersFromTrap(unequalPlayed).map(modifier => modifier.amount)).toEqual([-2])
    expect(unequalPlayed.pendingBattle?.declaredDamage).toBe(2)
    const unequalSettled = applyGameCommand(unequalPlayed, { kind: 'resolve-battle', playerId: opponent })
    expect(unequalSettled.players[owner].battleArea[0]?.hpCards).toHaveLength(4)
    replay(unequalStart, unequalSettled)
  })

  it('does not apply the target-only Then when no Cookie is selected and permits another opponent target', () => {
    const initial = createSt8019PreviewState('equal-supports')
    const other = initial.players[opponent].battleArea.find(cookie => cookie.card.id === 'ST1-011')
    if (!other) throw Error('The second original opposing Cookie is missing')
    const otherTarget = playTrap(initial, [other.card.instanceId])
    expect(modifiersFromTrap(otherTarget).map(modifier => [modifier.targetInstanceId, modifier.amount]))
      .toEqual([[other.card.instanceId, -2], [other.card.instanceId, -1]])
    expect(otherTarget.pendingBattle?.declaredDamage).toBe(4)

    const zeroTarget = playTrap(initial, [])
    expect(modifiersFromTrap(zeroTarget)).toEqual([])
    expect(zeroTarget.pendingBattle?.declaredDamage).toBe(4)
    replay(createSt8019AttackStartState('equal-supports'), otherTarget)
    replay(createSt8019AttackStartState('equal-supports'), zeroTarget)
  })

  it('rejects wrong-colour payment and a Cookie owned by the Trap player without mutating the response', () => {
    const noGreen = createSt8019PreviewState('no-green-payment')
    const source = trap(noGreen)
    const before = structuredClone(noGreen)
    expect(getTrapCandidates(noGreen, owner).some(card => card.id === 'ST8-019')).toBe(false)
    const redPayment = noGreen.players[owner].supportArea.filter(support => !support.rested)
      .slice(0, 2).map(support => support.card.instanceId)
    expect(redPayment).toHaveLength(2)
    expect(() => applyGameCommand(noGreen, {
      kind: 'play-trap', playerId: owner, trapInstanceId: source.instanceId,
      paymentIds: redPayment, targetIds: [],
    })).toThrow()
    expect(noGreen).toEqual(before)

    const initial = createSt8019PreviewState('equal-supports')
    const ownTarget = initial.players[owner].battleArea[0]!.card.instanceId
    const validPayment = initial.players[owner].supportArea.filter(support => !support.rested)
      .slice(0, 2).map(support => support.card.instanceId)
    const ownBefore = structuredClone(initial)
    expect(() => applyGameCommand(initial, {
      kind: 'play-trap', playerId: owner, trapInstanceId: trap(initial).instanceId,
      paymentIds: validPayment, targetIds: [], effectTargets: [[ownTarget], []],
    })).toThrow()
    expect(initial).toEqual(ownBefore)
  })
})
