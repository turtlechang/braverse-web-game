import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createSt8014PreviewState } from './st8-014-demo'
import type { GameState } from './types'

const begin = (scenario: Parameters<typeof createSt8014PreviewState>[0] = 'positive') => {
  const state = createSt8014PreviewState(scenario)
  const item = state.players['player-one'].hand[0]
  const payment = state.players['player-one'].supportArea.find(support =>
    !support.rested && support.card.energyColor === 'green',
  )
  if (!item || item.type !== 'item' || !payment) {
    throw Error('Original Cape of the Vanquisher and active green support required')
  }
  return {
    state: applyGameCommand(state, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: item.instanceId,
      paymentIds: [payment.card.instanceId],
    }),
    itemId: item.instanceId,
    paymentId: payment.card.instanceId,
  }
}

const resolve = (state: GameState, targetIds: string[]) =>
  applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds })

describe('ST8-014 physical Cape of the Vanquisher item flow', () => {
  it('pays G and adds exactly one HP to a green Cookie with 3 remaining while support count is 5', () => {
    const { state: paid, itemId, paymentId } = begin()
    const own = paid.players['player-one']
    const eligible = own.battleArea.find(cookie => cookie.card.id === 'ST8-005' && cookie.hpCards.length === 3)
    const excludedGreen = own.battleArea.find(cookie => cookie.card.id === 'ST8-005' && cookie.hpCards.length === 4)
    const excludedWrongColor = own.battleArea.find(cookie => cookie.card.id === 'ST1-011')
    if (!eligible || !excludedGreen || !excludedWrongColor) throw Error('Printed target fixtures required')

    expect(own.supportArea).toHaveLength(5)
    expect(own.supportArea.find(support => support.card.instanceId === paymentId)?.rested).toBe(true)
    expect(paid.pendingAbilityEffect?.sourceKind).toBe('item')
    const deckCount = own.deck.length

    const resolved = resolve(paid, [eligible.card.instanceId])
    const updatedOwn = resolved.players['player-one']
    expect(updatedOwn.battleArea.find(cookie => cookie.card.instanceId === eligible.card.instanceId)?.hpCards)
      .toHaveLength(4)
    expect(updatedOwn.battleArea.find(cookie => cookie.card.instanceId === excludedGreen.card.instanceId)?.hpCards)
      .toHaveLength(4)
    expect(updatedOwn.battleArea.find(cookie => cookie.card.instanceId === excludedWrongColor.card.instanceId)?.hpCards)
      .toHaveLength(2)
    expect(updatedOwn.deck).toHaveLength(deckCount - 1)
    expect(updatedOwn.discardPile.some(card => card.instanceId === itemId)).toBe(true)
    expect(resolved.pendingAbilityEffect).toBeUndefined()
  })

  it('still pays G and resolves to no effect when there are only 4 support cards', () => {
    const { state: paid, itemId, paymentId } = begin('support-below-threshold')
    expect(paid.players['player-one'].supportArea).toHaveLength(4)
    expect(paid.players['player-one'].supportArea.find(support => support.card.instanceId === paymentId)?.rested).toBe(true)
    expect(paid.pendingAbilityEffect).toBeUndefined()
    expect(paid.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
    expect(paid.players['player-one'].discardPile.some(card => card.instanceId === itemId)).toBe(true)
  })

  it('offers no illegal target when every Cookie is either wrong-color or above 3 remaining HP', () => {
    const { state: paid, itemId } = begin('no-eligible-target')
    const before = structuredClone(paid)
    expect(paid.pendingAbilityEffect?.effectIndex).toBe(0)
    for (const cookie of paid.players['player-one'].battleArea) {
      expect(() => resolve(paid, [cookie.card.instanceId])).toThrow()
      expect(paid).toEqual(before)
    }
    const resolved = resolve(paid, [])
    expect(resolved.players['player-one'].battleArea.map(cookie => cookie.hpCards.length)).toEqual([4, 2])
    expect(resolved.players['player-one'].discardPile.some(card => card.instanceId === itemId)).toBe(true)
    expect(resolved.pendingAbilityEffect).toBeUndefined()
  })

  it('allows choosing zero even when a legal green target exists', () => {
    const { state: paid } = begin()
    const resolved = resolve(paid, [])
    expect(resolved.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
    expect(resolved.pendingAbilityEffect).toBeUndefined()
  })

  it('rejects a wrong-color target and preserves the pending choice', () => {
    const { state: paid } = begin()
    const wrongColor = paid.players['player-one'].battleArea.find(cookie => cookie.card.id === 'ST1-011')
    if (!wrongColor) throw Error('Original red GingerBrave target required')
    const before = structuredClone(paid)
    expect(() => resolve(paid, [wrongColor.card.instanceId])).toThrow()
    expect(paid).toEqual(before)
  })

  it('rejects activation if no active green support can pay and preserves every zone', () => {
    const state = createSt8014PreviewState('no-green-payment')
    const item = state.players['player-one'].hand[0]
    if (!item) throw Error('Original Item required')
    const before = structuredClone(state)
    expect(state.players['player-one'].supportArea.every(support => support.rested || support.card.energyColor !== 'green'))
      .toBe(true)
    expect(() => applyGameCommand(state, {
      kind: 'begin-play-item', playerId: 'player-one', instanceId: item.instanceId, paymentIds: [],
    })).toThrow()
    expect(state).toEqual(before)
  })
})
