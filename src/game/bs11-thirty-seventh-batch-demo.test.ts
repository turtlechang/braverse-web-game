import { describe, expect, it } from 'vitest'
import {
  createCardCheckDemoState,
  createCardNegativeDemoState,
  parseTestStateConfig,
} from './demo'

describe('BS11-047 localhost candidate Browser fixture', () => {
  it('loads the inventory card through the normal card-skill route', () => {
    expect(parseTestStateConfig(
      '?test-state=card-skill:BS11-047',
      'localhost',
    )).toEqual({
      kind: 'card-check',
      cardNumber: 'BS11-047',
      preferSkillSurface: true,
    })

    const state = createCardCheckDemoState('BS11-047', {
      preferSkillSurface: true,
    })
    const source = state.players['player-one'].hand.find(
      (card) => card.id === 'BS11-047',
    )

    expect(source).toBeDefined()
    expect(source).toMatchObject({
      name: 'Dumpling Censer',
      type: 'item',
      imageUrl: 'https://cookierunbraverse.com/data/en_storage/jeJ0q4m3sECBV87h0o95oA.webp',
      item: {
        cost: { energy: { green: 1 }, supportToHand: 1 },
        effects: [{ kind: 'replace-opponent-on-play' }],
      },
    })
    expect(state.players['player-one'].supportArea.filter((support) => !support.rested)).toHaveLength(6)
  })

  it('keeps the negative route payment-blocked without promoting the candidate', () => {
    const state = createCardNegativeDemoState('BS11-047', {
      preferSkillSurface: true,
    })
    expect(state.players['player-one'].hand.some((card) => card.id === 'BS11-047')).toBe(true)
    expect(state.players['player-one'].supportArea.every((support) => support.rested)).toBe(true)
    expect(state.activePlayerId).toBe('player-one')
    expect(state.phase).toBe('main')
  })
})
