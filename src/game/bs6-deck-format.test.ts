import { describe, expect, it } from 'vitest'
import {
  BS6_AI_PRESET_DECK_CHOICES,
  BS6_COMPETITIVE_AI_PRESET_DECK_CHOICES,
  createDemoGame,
  createDeckForChoice,
  OFFICIAL_DECK_RECIPES,
  validateCustomDeck,
} from '.'
import type { CustomDeck } from './custom-deck'

const COMPETITIVE_DECK_STATS = {
  'bs6-red-competitive': {
    flipCards: 16,
    cookieCards: 43,
    itemCards: 9,
    trapCards: 8,
    stageCards: 0,
  },
  'bs6-yellow-competitive': {
    flipCards: 11,
    cookieCards: 41,
    itemCards: 6,
    trapCards: 13,
    stageCards: 0,
  },
  'bs6-green-competitive': {
    flipCards: 16,
    cookieCards: 40,
    itemCards: 5,
    trapCards: 11,
    stageCards: 4,
  },
  'bs6-blue-competitive': {
    flipCards: 16,
    cookieCards: 44,
    itemCards: 5,
    trapCards: 9,
    stageCards: 2,
  },
  'bs6-purple-competitive': {
    flipCards: 14,
    cookieCards: 40,
    itemCards: 9,
    trapCards: 8,
    stageCards: 3,
  },
} as const

describe('BS6 五色標準牌組 preset', () => {
  it.each(BS6_AI_PRESET_DECK_CHOICES)(
    '%s 是可匯入且可建立的 60 張純 BS6 牌組',
    (deckChoice) => {
      const entries = OFFICIAL_DECK_RECIPES[deckChoice]
      const validation = validateCustomDeck(entries, { format: 'standard' })

      expect(validation.errors).toEqual([])
      expect(validation.stats).toMatchObject({
        totalCards: 60,
        flipCards: 8,
        cookieCards: 48,
        itemCards: 4,
        trapCards: 4,
        stageCards: 4,
      })
      expect(entries.every((entry) => entry.cardNumber.startsWith('BS6-'))).toBe(
        true,
      )
      expect(createDeckForChoice(deckChoice, 'player-one')).toHaveLength(60)
    },
  )

  it.each(BS6_COMPETITIVE_AI_PRESET_DECK_CHOICES)(
    '%s is a valid supplied competitive environment deck without BS6-064',
    (deckChoice) => {
      const entries = OFFICIAL_DECK_RECIPES[deckChoice]
      const validation = validateCustomDeck(entries, { format: 'standard' })

      expect(validation.errors).toEqual([])
      expect(validation.stats).toMatchObject({
        totalCards: 60,
        ...COMPETITIVE_DECK_STATS[deckChoice],
      })
      expect(entries.some((entry) => entry.cardNumber === 'BS6-064')).toBe(
        false,
      )
      expect(createDeckForChoice(deckChoice, 'player-one')).toHaveLength(60)
    },
  )

  it('Browser simulation can build the player side from a custom BS6 deck', () => {
    const customDeck: CustomDeck = {
      id: 'bs6-red-browser-test',
      name: 'BS6 Red Browser Test',
      format: 'standard',
      entries: OFFICIAL_DECK_RECIPES['bs6-red-standard'].map((entry) => ({
        ...entry,
      })),
      createdAt: '2026-08-12T00:00:00.000Z',
      updatedAt: '2026-08-12T00:00:00.000Z',
    }
    const state = createDemoGame(
      20260812,
      { player: 'custom', ai: 'bs6-yellow-standard' },
      customDeck,
    )
    const player = state.players['player-one']
    const playerCards = [
      ...player.deck,
      ...player.hand,
      ...player.supportArea.map((support) => support.card),
      ...player.breakArea,
      ...player.discardPile,
      ...player.battleArea.flatMap((cookie) => [cookie.card, ...cookie.hpCards]),
      ...(player.stage ? [player.stage.card] : []),
    ]

    expect(playerCards.length).toBeGreaterThan(0)
    expect(playerCards.every((card) => card.id.startsWith('BS6-'))).toBe(true)
  })
})
