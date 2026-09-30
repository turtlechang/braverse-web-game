import { describe, expect, it } from 'vitest'
import {
  createBs111113SpecialPlayDemoState,
  parseTestStateConfig,
} from './demo'

const cardNumbers = [
  'BS11-111',
  'BS11-111@1',
  'BS11-112',
  'BS11-112@1',
  'BS11-113',
  'BS11-113@1',
] as const

describe('BS11-111～113 Special Play demo routes', () => {
  it.each(cardNumbers)('parses positive and negative routes for %s', (cardNumber) => {
    expect(parseTestStateConfig(
      `?test-state=${encodeURIComponent(`bs11-111-113-special-play:${cardNumber}:positive`)}`,
      'localhost',
    )).toEqual({
      kind: 'bs11-111-113-special-play',
      cardNumber,
      conditionMet: true,
    })
    expect(parseTestStateConfig(
      `?test-state=${encodeURIComponent(`bs11-111-113-special-play:${cardNumber}:negative`)}`,
      'localhost',
    )).toEqual({
      kind: 'bs11-111-113-special-play',
      cardNumber,
      conditionMet: false,
    })
  })

  it.each(cardNumbers)('builds a real candidate source and eligible cost for %s', (cardNumber) => {
    const state = createBs111113SpecialPlayDemoState(cardNumber, true)
    const player = state.players['player-one']
    const source = player.hand[0]
    const costCookie = player.battleArea[0]?.card

    expect(source).toMatchObject({ id: cardNumber.split('@')[0], type: 'cookie' })
    expect(source?.skill?.specialPlayCost?.trashBattleCookie).toMatchObject({
      count: 1,
      energyColor: 'black',
      level: 1,
    })
    expect(costCookie).toMatchObject({
      type: 'cookie',
      level: 1,
      energyColor: 'black',
    })
  })

  it.each(cardNumbers)('removes the Special Play candidate from the negative route for %s', (cardNumber) => {
    const state = createBs111113SpecialPlayDemoState(cardNumber, false)
    const costCookie = state.players['player-one'].battleArea[0]?.card

    expect(costCookie).toMatchObject({
      type: 'cookie',
      level: 1,
      energyColor: 'red',
    })
  })

  it('provides the On Play discard witness for BS11-111', () => {
    const state = createBs111113SpecialPlayDemoState('BS11-111', true)
    expect(state.players['player-one'].hand).toHaveLength(2)
  })

  it('provides the trash recovery and draw decks for BS11-112 and BS11-113', () => {
    const recover = createBs111113SpecialPlayDemoState('BS11-112', true)
    const draw = createBs111113SpecialPlayDemoState('BS11-113', true)

    expect(recover.players['player-one'].discardPile).toHaveLength(1)
    expect(recover.players['player-one'].discardPile[0]).toMatchObject({
      id: 'BS11-111',
      type: 'cookie',
    })
    expect(draw.players['player-one'].deck).toHaveLength(6)
  })
})
