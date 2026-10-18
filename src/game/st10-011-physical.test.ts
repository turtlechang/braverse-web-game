import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState, createCardNegativeDemoState } from './demo'
import { createSt10011PreviewState, rawSt10011 } from './st10-011-demo'
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

describe('ST10-011 Cream Unicorn Cookie printed ordinary attack', () => {
  it('uses the original printing, exact NNN cost, printed HP, and physical deck identities', () => {
    const state = createSt10011PreviewState()
    const printed = rawSt10011()
    const attacker = state.players['player-one'].battleArea[0]!
    const supports = state.players['player-one'].supportArea

    expect(printed).toMatchObject({
      cardNumber: 'ST10-011', name: 'Cream Unicorn Cookie', type: 'cookie',
      color: 'PURPLE', level: 2, hp: 4, skill: { name: null, text: null },
      attackText: '<{N}{N}{N}> Fantastic Festival {da} 3', flipText: null,
    })
    expect(printed.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/u5sCEzvhAtt0c5oKi4W3WQ.webp')
    expect(attacker.card).toMatchObject({ id: 'ST10-011', level: 2, hp: 4, attack: 3, attackEnergyCost: { neutral: 3 } })
    expect(attacker.hpCards).toHaveLength(4)
    expect(supports).toHaveLength(3)
    expect(supports.every(support => !support.rested)).toBe(true)
    expect(supports.some(support => support.card.energyColor !== 'purple')).toBe(true)
    expect(state.activePlayerId).toBe('player-one')

    for (const playerId of ['player-one', 'player-two'] as const) {
      const player = state.players[playerId]
      const cards = [
        ...player.deck,
        ...player.hand,
        ...player.breakArea,
        ...player.discardPile,
        ...player.supportArea.map(support => support.card),
        ...(player.stage ? [player.stage.card] : []),
        ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards, ...(cookie.equippedCards ?? [])]),
      ]
      expect(cards).toHaveLength(60)
      expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
      expect(cards.every(card => card.imageUrl?.startsWith('https://cookierunbraverse.com/'))).toBe(true)
      const counts = new Map<string, number>()
      for (const card of cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
      expect([...counts.values()].every(count => count <= 4)).toBe(true)
    }
  })

  it('pays three neutral energy with mixed-color supports and deals exactly three normal damage', () => {
    const initial = createSt10011PreviewState()
    const attacker = initial.players['player-one'].battleArea[0]!
    const target = initial.players['player-two'].battleArea[0]!
    const paymentIds = initial.players['player-one'].supportArea.map(support => support.card.instanceId)

    expect(attacker.card.attackEnergyCost).toEqual({ neutral: 3 })
    expect(new Set(initial.players['player-one'].supportArea.map(support => support.card.energyColor)).size).toBeGreaterThan(1)
    expect(target.card.hp).toBe(6)
    expect(target.hpCards).toHaveLength(6)

    const declared = applyGameCommand(initial, {
      kind: 'declare-attack',
      playerId: 'player-one',
      attackerInstanceId: attacker.card.instanceId,
      targetInstanceId: target.card.instanceId,
      supportPaymentIds: paymentIds,
    })
    expect(declared.pendingBattle).toMatchObject({
      stage: 'trap', attackerInstanceId: attacker.card.instanceId,
      targetInstanceId: target.card.instanceId, declaredDamage: 3,
    })
    expect(declared.players['player-one'].battleArea[0]?.rested).toBe(true)
    expect(declared.players['player-one'].supportArea.every(support => support.rested)).toBe(true)

    const settled = settleAttack(declared)
    expect(settled.players['player-two'].battleArea[0]?.hpCards).toHaveLength(3)
    expect(settled.players['player-two'].discardPile.filter(card =>
      target.hpCards.some(hpCard => hpCard.instanceId === card.instanceId),
    )).toHaveLength(3)
    expect(settled.players['player-one'].battleArea[0]?.hpCards).toHaveLength(4)
    expect(settled.pendingBattle).toBeNull()
  })

  it('rejects the NNN attack with only two supports and leaves the state unchanged', () => {
    const initial = createSt10011PreviewState('insufficient-energy')
    const before = structuredClone(initial)
    const attacker = initial.players['player-one'].battleArea[0]!
    const target = initial.players['player-two'].battleArea[0]!
    const twoSupportIds = initial.players['player-one'].supportArea.map(support => support.card.instanceId)

    expect(twoSupportIds).toHaveLength(2)
    expect(() => applyGameCommand(initial, {
      kind: 'declare-attack',
      playerId: 'player-one',
      attackerInstanceId: attacker.card.instanceId,
      targetInstanceId: target.card.instanceId,
      supportPaymentIds: twoSupportIds,
    })).toThrow()
    expect(initial).toEqual(before)
    expect(attacker.rested).toBe(false)
    expect(initial.pendingBattle).toBeNull()
  })

  it('routes positive and one-short Browser paths through the same physical card', () => {
    const positive = createCardCheckDemoState('ST10-011', { normalAttack: 'payable' })
    const negative = createCardNegativeDemoState('ST10-011', { normalAttack: 'blocked' })

    expect(positive.players['player-one'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST10-011'])
    expect(positive.players['player-one'].supportArea).toHaveLength(3)
    expect(positive.players['player-two'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST10-002'])
    expect(negative.players['player-one'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST10-011'])
    expect(negative.players['player-one'].supportArea).toHaveLength(2)
    expect(negative.players['player-two'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST10-002'])
  })
})
