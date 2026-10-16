import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import {
  createSt9001To003PreviewState,
  rawSt9001To003,
  st9001To003Zones,
  type St9001To003CardNumber,
} from './st9-001-003-demo'
import type { GameState } from './types'

const owner = 'player-one' as const
const opponent = 'player-two' as const
const costByCard: Record<St9001To003CardNumber, number> = {
  'ST9-001': 3,
  'ST9-002': 1,
  'ST9-003': 3,
}

const beginAttack = (state: GameState, cardNumber: St9001To003CardNumber): GameState => {
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

const finishAttack = (state: GameState, cardNumber: St9001To003CardNumber, activateFlip: boolean): GameState => {
  let current = applyGameCommand(state, { kind: 'skip-trap', playerId: opponent })
  for (let guard = 0; current.pendingBattle && guard < 8; guard += 1) {
    if (current.pendingBattle.revealedHpCard?.id === 'ST9-003') {
      current = applyGameCommand(current, {
        kind: 'resolve-flip', playerId: opponent, activate: activateFlip,
      })
    } else {
      current = applyGameCommand(current, { kind: 'resolve-next-damage', playerId: opponent })
    }
  }
  if (current.pendingBattle) throw new Error('Printed attack damage did not finish')
  expect(current.players[owner].supportArea.filter(support => support.rested)).toHaveLength(costByCard[cardNumber])
  return current
}

describe('ST9-001–003 original printed Cookie flows', () => {
  it.each(['ST9-001', 'ST9-002', 'ST9-003'] as const)(
    'uses original sixty-card physical decks and prints for %s', cardNumber => {
      const state = createSt9001To003PreviewState(cardNumber)
      for (const playerId of [owner, opponent]) {
        const cards = st9001To003Zones(state, playerId)
        expect(cards).toHaveLength(60)
        expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
        expect(cards.every(card => typeof card.imageUrl === 'string' && /^https:\/\/cookierunbraverse\.com\//.test(card.imageUrl))).toBe(true)
        const copies = new Map<string, number>()
        for (const card of cards) copies.set(card.id, (copies.get(card.id) ?? 0) + 1)
        expect([...copies.values()].every(count => count <= 4)).toBe(true)
        for (const cookie of state.players[playerId].battleArea) {
          expect(cookie.hpCards).toHaveLength(cookie.card.hp)
        }
      }

      const source = rawSt9001To003(cardNumber)
      expect(state.players[owner].battleArea[0].card).toMatchObject({
        id: cardNumber,
        name: source.name,
        imageUrl: source.imageUrl,
      })
      expect(state.players[owner].supportArea).toHaveLength(costByCard[cardNumber])
      expect(state.players[owner].supportArea.every(support => support.card.energyColor === 'blue' && !support.rested)).toBe(true)
      expect(state.players[opponent].battleArea[0].card.id).toBe('ST6-003')
    },
  )

  it.each([
    ['ST9-001', 3],
    ['ST9-002', 1],
    ['ST9-003', 3],
  ] as const)('%s pays its printed attack and deals exactly %s ordinary damage', (cardNumber, damage) => {
    const initial = createSt9001To003PreviewState(cardNumber)
    const before = structuredClone(initial)
    const attacked = beginAttack(initial, cardNumber)
    const settled = finishAttack(attacked, cardNumber, true)

    expect(settled.players[opponent].battleArea[0].hpCards).toHaveLength(4 - damage)
    expect(settled.players[owner].battleArea[0].rested).toBe(true)
    expect(settled.pendingAbilityEffect ?? null).toBeNull()
    expect(initial).toEqual(before)
  })

  it.each(['ST9-001', 'ST9-002', 'ST9-003'] as const)(
    'rejects an attack without enough original energy for %s', cardNumber => {
      const initial = createSt9001To003PreviewState(cardNumber, 'insufficient-energy')
      const before = structuredClone(initial)
      expect(() => beginAttack(initial, cardNumber)).toThrow()
      expect(initial).toEqual(before)
      expect(initial.players[owner].battleArea[0].rested).toBe(false)
      expect(initial.players[owner].supportArea.every(support => !support.rested)).toBe(true)
    },
  )

  it('returns only the revealed ST9-003 to its owner and keeps the HP bearer in battle', () => {
    const initial = createSt9001To003PreviewState('ST9-003')
    const before = structuredClone(initial)
    const revealed = initial.players[opponent].battleArea[0].hpCards[1]
    expect(revealed?.id).toBe('ST9-003')

    const attacked = beginAttack(initial, 'ST9-003')
    const settled = finishAttack(attacked, 'ST9-003', true)

    expect(settled.players[opponent].hand.map(card => card.instanceId)).toContain(revealed.instanceId)
    expect(settled.players[opponent].discardPile.some(card => card.instanceId === revealed.instanceId)).toBe(false)
    expect(settled.players[opponent].battleArea[0].card.id).toBe('ST6-003')
    expect(settled.players[opponent].battleArea[0].hpCards).toHaveLength(1)
    expect(settled.players[owner].battleArea[0].card.id).toBe('ST9-003')
    expect(initial).toEqual(before)
  })

  it('leaves the revealed ST9-003 in its owner trash when its FLIP is skipped', () => {
    const initial = createSt9001To003PreviewState('ST9-003')
    const revealed = initial.players[opponent].battleArea[0].hpCards[1]
    const settled = finishAttack(beginAttack(initial, 'ST9-003'), 'ST9-003', false)

    expect(settled.players[opponent].hand.some(card => card.instanceId === revealed.instanceId)).toBe(false)
    expect(settled.players[opponent].discardPile.map(card => card.instanceId)).toContain(revealed.instanceId)
    expect(settled.players[opponent].battleArea[0].hpCards).toHaveLength(1)
  })
})
