import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import {
  createSt10001To003PreviewState,
  rawSt10001To003,
  st10001To003Zones,
  type St10001To003CardNumber,
} from './st10-001-003-demo'
import type { GameState } from './types'

const owner = 'player-one' as const
const opponent = 'player-two' as const

const beginAttack = (state: GameState, cardNumber: St10001To003CardNumber): GameState => {
  const attacker = state.players[owner].battleArea.find(cookie => cookie.card.id === cardNumber)
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

const finishAttack = (
  state: GameState,
  cardNumber: St10001To003CardNumber,
  activateFlip: boolean,
  drawCount = 0,
): GameState => {
  let current = applyGameCommand(state, { kind: 'skip-trap', playerId: opponent })
  for (let guard = 0; current.pendingBattle && guard < 8; guard += 1) {
    if (current.pendingBattle.revealedHpCard?.id === cardNumber) {
      current = applyGameCommand(current, {
        kind: 'resolve-flip', playerId: opponent, activate: activateFlip,
      })
      if (current.pendingDrawUpTo) {
        current = applyGameCommand(current, {
          kind: 'resolve-draw-up-to', playerId: opponent, drawCount,
        })
      }
    } else {
      current = applyGameCommand(current, { kind: 'resolve-next-damage', playerId: opponent })
    }
  }
  if (current.pendingBattle || current.pendingDrawUpTo) throw new Error('Printed attack and FLIP must finish')
  expect(state.players[owner].supportArea.filter(support => support.rested)).toHaveLength(3)
  return current
}

describe('ST10-001–003 original physical attacks and HP FLIP effects', () => {
  it.each(['ST10-001', 'ST10-003'] as const)('uses original sixty-card decks, HP, art, and purple payment for %s', cardNumber => {
    const state = createSt10001To003PreviewState(cardNumber)
    for (const playerId of [owner, opponent]) {
      const cards = st10001To003Zones(state, playerId)
      expect(cards).toHaveLength(60)
      expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
      expect(cards.every(card => typeof card.imageUrl === 'string' && /^https:\/\/cookierunbraverse\.com\//.test(card.imageUrl))).toBe(true)
      const copies = new Map<string, number>()
      for (const card of cards) copies.set(card.id, (copies.get(card.id) ?? 0) + 1)
      expect([...copies.values()].every(count => count <= 4)).toBe(true)
      for (const cookie of state.players[playerId].battleArea) expect(cookie.hpCards).toHaveLength(cookie.card.hp)
    }

    const printed = rawSt10001To003(cardNumber)
    expect(state.players[owner].battleArea[0].card).toMatchObject({
      id: cardNumber, name: printed.name, imageUrl: printed.imageUrl, hp: cardNumber === 'ST10-001' ? 4 : 3,
    })
    expect(state.players[owner].supportArea).toHaveLength(3)
    expect(state.players[owner].supportArea.every(support => support.card.energyColor === 'purple' && !support.rested)).toBe(true)
    expect(state.players[opponent].battleArea[0].card.id).toBe('ST6-003')
    expect(state.players[opponent].battleArea[0].hpCards[1]?.id).toBe(cardNumber)
  })

  it.each(['ST10-001', 'ST10-003'] as const)('%s pays its printed PPP attack and reaches its actual HP FLIP', cardNumber => {
    const initial = createSt10001To003PreviewState(cardNumber)
    const before = structuredClone(initial)
    const attacked = beginAttack(initial, cardNumber)
    const settled = finishAttack(attacked, cardNumber, true, 1)

    expect(settled.players[opponent].battleArea[0].hpCards).toHaveLength(1)
    expect(settled.players[owner].battleArea[0].rested).toBe(true)
    expect(settled.pendingAbilityEffect ?? null).toBeNull()
    expect(settled.pendingDrawUpTo ?? null).toBeNull()
    expect(initial).toEqual(before)
  })

  it('returns only the revealed ST10-001 to its owner and leaves the HP bearer in battle', () => {
    const initial = createSt10001To003PreviewState('ST10-001')
    const before = structuredClone(initial)
    const revealed = initial.players[opponent].battleArea[0].hpCards[1]
    expect(revealed?.id).toBe('ST10-001')

    const settled = finishAttack(beginAttack(initial, 'ST10-001'), 'ST10-001', true)

    expect(settled.players[opponent].hand.map(card => card.instanceId)).toContain(revealed.instanceId)
    expect(settled.players[opponent].discardPile.some(card => card.instanceId === revealed.instanceId)).toBe(false)
    expect(settled.players[opponent].battleArea[0].card.id).toBe('ST6-003')
    expect(settled.players[opponent].battleArea[0].hpCards).toHaveLength(1)
    expect(settled.players[owner].battleArea[0].card.id).toBe('ST10-001')
    expect(initial).toEqual(before)
  })

  it.each([0, 1] as const)('continues ST10-003 FLIP into the printed optional draw choice of %s', drawCount => {
    const initial = createSt10001To003PreviewState('ST10-003')
    const before = structuredClone(initial)
    const revealed = initial.players[opponent].battleArea[0].hpCards[1]
    const deckCount = initial.players[opponent].deck.length
    const settled = finishAttack(beginAttack(initial, 'ST10-003'), 'ST10-003', true, drawCount)

    expect(settled.players[opponent].deck).toHaveLength(deckCount - drawCount)
    expect(settled.players[opponent].hand).toHaveLength(drawCount)
    expect(settled.players[opponent].discardPile.map(card => card.instanceId)).toContain(revealed.instanceId)
    expect(settled.players[opponent].battleArea[0].hpCards).toHaveLength(1)
    expect(initial).toEqual(before)
  })

  it.each(['ST10-001', 'ST10-003'] as const)('declining %s FLIP leaves the revealed physical card in its owner trash', cardNumber => {
    const initial = createSt10001To003PreviewState(cardNumber)
    const revealed = initial.players[opponent].battleArea[0].hpCards[1]
    const settled = finishAttack(beginAttack(initial, cardNumber), cardNumber, false)

    expect(settled.players[opponent].hand.some(card => card.instanceId === revealed.instanceId)).toBe(false)
    expect(settled.players[opponent].discardPile.map(card => card.instanceId)).toContain(revealed.instanceId)
    expect(settled.players[opponent].battleArea[0].hpCards).toHaveLength(1)
  })

  it.each(['ST10-001', 'ST10-003'] as const)('rejects insufficient purple attack payment for %s without mutation', cardNumber => {
    const initial = createSt10001To003PreviewState(cardNumber, 'insufficient-energy')
    const before = structuredClone(initial)
    expect(() => beginAttack(initial, cardNumber)).toThrow()
    expect(initial).toEqual(before)
    expect(initial.players[owner].battleArea[0].rested).toBe(false)
    expect(initial.players[owner].supportArea.every(support => !support.rested)).toBe(true)
  })
})
