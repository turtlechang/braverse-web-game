import { describe, expect, it } from 'vitest'
import {
  createBs11103104109InspectDemoState,
  parseTestStateConfig,
} from './demo'

const cardNumbers = ['BS11-103', 'BS11-104', 'BS11-109'] as const

describe('BS11-103／104／109 Browser fixture', () => {
  it.each(cardNumbers)('parses positive and negative routes for %s', (cardNumber) => {
    expect(parseTestStateConfig(
      `?test-state=bs11-103-104-109-inspect%3A${cardNumber}%3Apositive`,
      'localhost',
    )).toEqual({
      kind: 'bs11-103-104-109-inspect',
      cardNumber,
      conditionMet: true,
    })
    expect(parseTestStateConfig(
      `?test-state=bs11-103-104-109-inspect%3A${cardNumber}%3Anegative`,
      'localhost',
    )).toEqual({
      kind: 'bs11-103-104-109-inspect',
      cardNumber,
      conditionMet: false,
    })
  })

  it('keeps BS11-103 positive and negative hand thresholds observable', () => {
    const positive = createBs11103104109InspectDemoState('BS11-103', true)
    const negative = createBs11103104109InspectDemoState('BS11-103', false)
    const sourceId = 'bs11-103-demo-source'

    expect(positive.players['player-one'].hand).toHaveLength(5)
    expect(positive.players['player-one'].hand.some((card) => card.instanceId === sourceId)).toBe(true)
    expect(negative.players['player-one'].hand).toHaveLength(7)
    expect(negative.players['player-one'].discardPile).toHaveLength(2)
  })

  it('opens BS11-104 faint inspect with and without a black candidate', () => {
    const positive = createBs11103104109InspectDemoState('BS11-104', true)
    const negative = createBs11103104109InspectDemoState('BS11-104', false)
    const positiveEffect = positive.pendingFaintEffects?.[0]
    const negativeEffect = negative.pendingFaintEffects?.[0]

    expect(positiveEffect?.effect).toMatchObject({
      kind: 'inspect-deck',
      lookCount: 3,
      filterColor: 'black',
      optionalPick: true,
    })
    expect(positive.players['player-one'].deck.some((card) => card.energyColor === 'black')).toBe(true)
    expect(negativeEffect?.effect).toMatchObject({ kind: 'inspect-deck', filterColor: 'black' })
    expect(negative.players['player-one'].deck.some((card) => card.energyColor === 'black')).toBe(false)
  })

  it('keeps BS11-109 playable with black payment while toggling only Special Play', () => {
    const positive = createBs11103104109InspectDemoState('BS11-109', true)
    const negative = createBs11103104109InspectDemoState('BS11-109', false)

    expect(positive.players['player-one'].hand[0]).toMatchObject({
      instanceId: 'bs11-109-demo-source',
      type: 'item',
    })
    expect(positive.players['player-one'].supportArea).toMatchObject([
      { rested: false, card: { energyColor: 'black' } },
    ])
    expect(positive.players['player-one'].deck.some(
      (card) => card.type === 'cookie' && Boolean(card.skill?.specialPlayCost),
    )).toBe(true)
    expect(negative.players['player-one'].deck.some(
      (card) => card.type === 'cookie' && Boolean(card.skill?.specialPlayCost),
    )).toBe(false)
  })
})
