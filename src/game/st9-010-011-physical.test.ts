import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import {
  createSt9010To011PreviewState,
  rawSt9010To011,
  settleSt9010To011Attack,
  st9010To011Zones,
  type St9010To011CardNumber,
} from './st9-010-011-demo'
import type { GameState } from './types'

const owner = 'player-one' as const
const opponent = 'player-two' as const
const cardNumbers: St9010To011CardNumber[] = ['ST9-010', 'ST9-011']

const beginPrintedAttack = (state: GameState): GameState => {
  const attacker = state.players[owner].battleArea[0]
  const target = state.players[opponent].battleArea[0]
  if (!attacker || !target) throw new Error('Original attacker and target are required')
  return applyGameCommand(state, {
    kind: 'declare-attack',
    playerId: owner,
    attackerInstanceId: attacker.card.instanceId,
    targetInstanceId: target.card.instanceId,
    supportPaymentIds: state.players[owner].supportArea.map(support => support.card.instanceId),
  })
}

describe('ST9-010–011 original physical FLIP cards', () => {
  it.each(cardNumbers)('uses original printings and legal 60-card decks for %s', cardNumber => {
    const state = createSt9010To011PreviewState(cardNumber)
    const printed = rawSt9010To011(cardNumber)
    for (const playerId of [owner, opponent]) {
      const cards = st9010To011Zones(state, playerId)
      expect(cards).toHaveLength(60)
      expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
      expect(cards.every(card => /^https:\/\/cookierunbraverse\.com\//.test(card.imageUrl ?? ''))).toBe(true)
      const copies = new Map<string, number>()
      for (const card of cards) copies.set(card.id, (copies.get(card.id) ?? 0) + 1)
      expect([...copies.values()].every(count => count <= 4)).toBe(true)
      for (const cookie of state.players[playerId].battleArea) {
        expect(cookie.hpCards).toHaveLength(cookie.card.hp)
      }
    }

    const target = state.players[opponent].battleArea[0]
    expect(state.players[owner].battleArea[0]?.card.id).toBe('ST9-002')
    expect(state.players[owner].supportArea).toHaveLength(1)
    expect(target?.card.id).toBe('ST6-003')
    expect(target?.hpCards.at(-1)).toMatchObject({
      id: cardNumber,
      name: printed.name,
      imageUrl: printed.imageUrl,
      flip: { cost: { energy: {}, discardHand: 1 }, attachedHpBonus: 1 },
    })
    expect(state.players[opponent].hand).toHaveLength(1)
  })

  it.each(cardNumbers)('pays one real hand card and adds one real HP for %s', cardNumber => {
    const initial = createSt9010To011PreviewState(cardNumber, 'positive')
    const before = structuredClone(initial)
    const target = initial.players[opponent].battleArea[0]!
    const flip = target.hpCards.at(-1)!
    const costCard = initial.players[opponent].hand[0]!
    const gainedHp = initial.players[opponent].deck[0]!
    const attacked = beginPrintedAttack(initial)
    expect(attacked.pendingBattle?.attackerPlayerId).toBe(owner)
    expect(attacked.players[owner].supportArea[0]?.rested).toBe(true)

    const afterTrap = applyGameCommand(attacked, { kind: 'skip-trap', playerId: opponent })
    const pendingFlip = applyGameCommand(afterTrap, { kind: 'resolve-next-damage', playerId: opponent })
    expect(pendingFlip.pendingBattle).toMatchObject({
      stage: 'flip',
      revealedHpCard: { instanceId: flip.instanceId, id: cardNumber },
      targetInstanceId: target.card.instanceId,
    })

    const beforeInvalidPayment = structuredClone(pendingFlip)
    expect(() => applyGameCommand(pendingFlip, {
      kind: 'resolve-flip',
      playerId: opponent,
      activate: true,
      discardHandIds: [],
    })).toThrow()
    expect(pendingFlip).toEqual(beforeInvalidPayment)

    const settled = settleSt9010To011Attack(pendingFlip, 'activate')
    const updatedTarget = settled.players[opponent].battleArea.find(cookie => cookie.card.instanceId === target.card.instanceId)
    expect(updatedTarget?.hpCards).toHaveLength(target.card.hp)
    expect(updatedTarget?.hpCards.map(card => card.instanceId)).toContain(gainedHp.instanceId)
    expect(settled.players[opponent].deck.map(card => card.instanceId)).not.toContain(gainedHp.instanceId)
    expect(settled.players[opponent].discardPile.map(card => card.instanceId)).toContain(flip.instanceId)
    expect(settled.players[opponent].discardPile.map(card => card.instanceId)).toContain(costCard.instanceId)
    expect(settled.players[opponent].hand).toHaveLength(0)
    expect(settled.pendingBattle ?? null).toBeNull()
    expect(settled.pendingAbilityEffect ?? null).toBeNull()
    expect(initial).toEqual(before)
  })

  it.each(cardNumbers)('cannot activate %s when the printed hand-discard cost is unavailable', cardNumber => {
    const initial = createSt9010To011PreviewState(cardNumber, 'no-payment')
    const target = initial.players[opponent].battleArea[0]!
    const flip = target.hpCards.at(-1)!
    const attacked = beginPrintedAttack(initial)
    const settled = settleSt9010To011Attack(attacked, 'skip')

    expect(initial.players[opponent].hand).toHaveLength(0)
    expect(settled.players[opponent].battleArea[0]?.hpCards).toHaveLength(target.card.hp - 1)
    expect(settled.players[opponent].discardPile.map(card => card.instanceId)).toContain(flip.instanceId)
    expect(settled.players[opponent].discardPile.map(card => card.id)).not.toContain('BS3-091')
    expect(settled.pendingBattle ?? null).toBeNull()
  })
})
