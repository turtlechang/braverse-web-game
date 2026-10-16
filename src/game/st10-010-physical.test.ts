import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState, createCardNegativeDemoState } from './demo'
import { createSt10010PreviewState, rawSt10010 } from './st10-010-demo'
import type { GameState } from './types'

const settleAttack = (state: GameState): GameState => {
  let current = state.pendingBattle?.stage === 'trap'
    ? applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
    : state
  for (let guard = 0; guard < 8 && current.pendingBattle?.stage === 'damage'; guard += 1) {
    current = applyGameCommand(current, { kind: 'resolve-next-damage', playerId: 'player-two' })
  }
  return current
}

describe('ST10-010 Prophet Cookie printed ordinary attack', () => {
  it('uses the original printing, exact neutral cost, printed HP, and physical deck identities', () => {
    const state = createSt10010PreviewState()
    const printed = rawSt10010()
    const attacker = state.players['player-one'].battleArea[0]!

    expect(printed).toMatchObject({
      cardNumber: 'ST10-010', name: 'Prophet Cookie', type: 'cookie',
      color: 'PURPLE', level: 1, hp: 2, skill: { name: null, text: null },
      attackText: '<{N}> Sparkling Prophecy {da} 1', flipText: null,
    })
    expect(printed.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
    expect(attacker.card).toMatchObject({ id: 'ST10-010', level: 1, hp: 2, attack: 1, attackEnergyCost: { neutral: 1 } })
    expect(attacker.hpCards).toHaveLength(2)
    expect(state.activePlayerId).toBe('player-one')

    for (const playerId of ['player-one', 'player-two'] as const) {
      const player = state.players[playerId]
      const cards = [
        ...player.deck,
        ...player.hand,
        ...player.breakArea,
        ...player.discardPile,
        ...player.supportArea.map(support => support.card),
        ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
      ]
      expect(cards).toHaveLength(60)
      expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
      expect(cards.every(card => card.imageUrl?.startsWith('https://cookierunbraverse.com/'))).toBe(true)
      const counts = new Map<string, number>()
      for (const card of cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
      expect([...counts.values()].every(count => count <= 4)).toBe(true)
    }
  })

  it('pays one off-color support for N and deals exactly one normal damage', () => {
    const initial = createSt10010PreviewState()
    const attacker = initial.players['player-one'].battleArea[0]!
    const target = initial.players['player-two'].battleArea[0]!
    const payment = initial.players['player-one'].supportArea[0]!.card

    expect(attacker.card.attackEnergyCost).toEqual({ neutral: 1 })
    expect(payment.energyColor).toBe('purple')
    expect(target.card.hp).toBeGreaterThan(1)

    const declared = applyGameCommand(initial, {
      kind: 'declare-attack',
      playerId: 'player-one',
      attackerInstanceId: attacker.card.instanceId,
      targetInstanceId: target.card.instanceId,
      supportPaymentIds: [payment.instanceId],
    })
    expect(declared.pendingBattle).toMatchObject({
      stage: 'trap', attackerInstanceId: attacker.card.instanceId,
      targetInstanceId: target.card.instanceId, declaredDamage: 1,
    })
    expect(declared.players['player-one'].battleArea[0]?.rested).toBe(true)
    expect(declared.players['player-one'].supportArea[0]?.rested).toBe(true)

    const settled = settleAttack(declared)
    expect(settled.players['player-two'].battleArea[0]?.hpCards).toHaveLength(target.hpCards.length - 1)
    expect(settled.players['player-two'].discardPile.filter(card =>
      target.hpCards.some(hpCard => hpCard.instanceId === card.instanceId),
    )).toHaveLength(1)
    expect(settled.players['player-one'].battleArea[0]?.hpCards).toHaveLength(attacker.hpCards.length)
    expect(settled.pendingBattle).toBeNull()
  })

  it('rejects the printed attack with no energy and leaves the state unchanged', () => {
    const initial = createSt10010PreviewState('insufficient-energy')
    const before = structuredClone(initial)
    const attacker = initial.players['player-one'].battleArea[0]!
    const target = initial.players['player-two'].battleArea[0]!

    expect(initial.players['player-one'].supportArea).toHaveLength(0)
    expect(() => applyGameCommand(initial, {
      kind: 'declare-attack',
      playerId: 'player-one',
      attackerInstanceId: attacker.card.instanceId,
      targetInstanceId: target.card.instanceId,
      supportPaymentIds: [],
    })).toThrow()
    expect(initial).toEqual(before)
    expect(attacker.rested).toBe(false)
    expect(initial.pendingBattle).toBeNull()
  })

  it('routes positive and insufficient-energy Browser paths through the same physical card', () => {
    const positive = createCardCheckDemoState('ST10-010', { normalAttack: 'payable' })
    const negative = createCardNegativeDemoState('ST10-010', { normalAttack: 'blocked' })

    expect(positive.players['player-one'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST10-010'])
    expect(positive.players['player-one'].supportArea.map(support => support.card.id)).toEqual(['BS9-096'])
    expect(positive.players['player-two'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST10-002'])
    expect(negative.players['player-one'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST10-010'])
    expect(negative.players['player-one'].supportArea).toHaveLength(0)
    expect(negative.players['player-two'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST10-002'])
  })
})
