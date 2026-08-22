import { describe, expect, it } from 'vitest'
import {
  BS7_ARENA_AI_PRESET_DECK_CHOICES,
  createDeckForChoice,
  getCardPoolEntry,
  OFFICIAL_DECK_RECIPES,
  validateCustomDeck,
} from '.'

describe('BS7 Arena 五色標準牌組 preset', () => {
  it.each(BS7_ARENA_AI_PRESET_DECK_CHOICES)(
    '%s 是可匯入且可建立的 60 張標準牌組',
    (deckChoice) => {
      const entries = OFFICIAL_DECK_RECIPES[deckChoice]
      const validation = validateCustomDeck(entries, { format: 'standard' })

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toEqual([])
      expect(validation.stats.totalCards).toBe(60)
      expect(createDeckForChoice(deckChoice, 'player-one')).toHaveLength(60)
    },
  )

  it.each(BS7_ARENA_AI_PRESET_DECK_CHOICES)(
    '%s 有足夠 BS7 核心卡且可完整建立 runtime cards',
    (deckChoice) => {
      const entries = OFFICIAL_DECK_RECIPES[deckChoice]
      const bs7CardSlots = entries
        .filter((entry) => entry.cardNumber.startsWith('BS7-'))
        .reduce((total, entry) => total + entry.count, 0)
      const bs7BaseNumbers = new Set(
        entries
          .filter((entry) => entry.cardNumber.startsWith('BS7-'))
          .map(
            (entry) =>
              getCardPoolEntry(entry.cardNumber)?.baseCardNumber ??
              entry.cardNumber,
          ),
      )
      const runtimeCards = createDeckForChoice(deckChoice, 'player-one')

      expect(bs7CardSlots).toBeGreaterThanOrEqual(32)
      expect(bs7BaseNumbers.size).toBeGreaterThanOrEqual(8)
      expect(runtimeCards).toHaveLength(60)
      expect(runtimeCards.every((card) => card.id.length > 0)).toBe(true)
    },
  )
})
