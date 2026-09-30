import { describe, expect, it } from 'vitest'
import { COLORS, generateRoster, signature, bs11Copies, seedDeck } from './generate-bs11-1024-roster'
import { getCardPoolEntry, validateCustomDeckDefinition } from '../src/game'

describe('BS11 six-color construction', () => {
  it('all six designed main/EXTRA seed decks are legal and use 60 BS11 cards', () => {
    for (const color of COLORS) {
      const deck = seedDeck(color)
      expect(validateCustomDeckDefinition(deck).errors).toEqual([])
      expect(bs11Copies(deck.entries)).toBe(60)
    }
  })
  it('generates 1024 unique legal balanced decks and includes real black decks', () => {
    const decks = generateRoster()
    expect(decks).toHaveLength(1024)
    expect(new Set(decks.map((deck) => signature(deck.entries))).size).toBe(1024)
    expect(COLORS.map((color) => decks.filter((deck) => deck.color === color).length)).toEqual([171, 171, 171, 171, 170, 170])
    for (const deck of decks) {
      expect(validateCustomDeckDefinition(deck).isValid).toBe(true)
      expect(bs11Copies(deck.entries)).toBeGreaterThanOrEqual(48)
      expect(deck.entries.every((entry) => ['pure', deck.color].includes(getCardPoolEntry(entry.cardNumber)?.color?.toLowerCase() ?? ''))).toBe(true)
    }
  }, 30000)
  it('is deterministic and rejects malformed roster sizes', () => {
    expect(generateRoster(12, 123).map((deck) => signature(deck.entries))).toEqual(generateRoster(12, 123).map((deck) => signature(deck.entries)))
    expect(() => generateRoster(7)).toThrow(/even/)
  })
})
