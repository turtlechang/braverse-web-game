import { describe, expect, it } from 'vitest'
import { getAllCardPoolEntries } from './card-pool'
import {
  OFFICIAL_RED_STARTER_DECK,
} from './starter-deck'
import {
  MAX_FLIP_CARDS,
  validateCustomDeck,
  type CustomDeckEntry,
} from './custom-deck'

const entriesFromNumbers = (cardNumbers: string[]): CustomDeckEntry[] =>
  cardNumbers.map((cardNumber) => ({ cardNumber, count: 4 }))

describe('validateCustomDeck', () => {
  it('accepts a 60-card starter deck with at least one Cookie and no more than 16 FLIP cards', () => {
    const result = validateCustomDeck(OFFICIAL_RED_STARTER_DECK)

    expect(result.isValid).toBe(true)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.stats.totalCards).toBe(60)
    expect(result.stats.cookieCards).toBeGreaterThan(0)
    expect(result.stats.flipCards).toBeLessThanOrEqual(MAX_FLIP_CARDS)
  })

  it('requires exactly 60 cards', () => {
    const entries = OFFICIAL_RED_STARTER_DECK.map((entry, index) =>
      index === 0 ? { ...entry, count: entry.count - 1 } : entry,
    )
    const result = validateCustomDeck(entries)

    expect(result.isValid).toBe(false)
    expect(result.stats.totalCards).toBe(59)
    expect(result.errors).toContain('牌組必須剛好 60 張，目前為 59 張')
  })

  it('rejects more than four copies of the same card number', () => {
    const result = validateCustomDeck([
      { cardNumber: 'ST1-001', count: 5 },
      ...OFFICIAL_RED_STARTER_DECK.slice(1),
    ])

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('ST1-001 超過每卡最多 4 張限制')
  })

  it('rejects duplicate entries whose combined copies exceed four', () => {
    const result = validateCustomDeck([
      { cardNumber: 'ST1-001', count: 4 },
      { cardNumber: 'ST1-001', count: 4 },
      ...OFFICIAL_RED_STARTER_DECK.slice(2),
    ])

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('ST1-001 合計 8 張，超過每卡最多 4 張限制')
  })

  it('requires at least one Cookie card', () => {
    const nonCookieEntries = getAllCardPoolEntries().filter(
      (entry) => entry.type !== 'cookie' && entry.type !== 'flip',
    )
    const result = validateCustomDeck(
      entriesFromNumbers(nonCookieEntries.slice(0, 15).map((entry) => entry.cardNumber)),
    )

    expect(result.stats.totalCards).toBe(60)
    expect(result.stats.cookieCards).toBe(0)
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('牌組至少需要 1 張餅乾卡')
  })

  it('rejects decks with more than 16 FLIP cards', () => {
    const flipEntries = getAllCardPoolEntries().filter(
      (entry) => entry.type === 'flip',
    )
    const cookieEntries = getAllCardPoolEntries().filter(
      (entry) => entry.type === 'cookie',
    )
    const result = validateCustomDeck([
      ...entriesFromNumbers(flipEntries.slice(0, 5).map((entry) => entry.cardNumber)),
      ...entriesFromNumbers(cookieEntries.slice(0, 10).map((entry) => entry.cardNumber)),
    ])

    expect(result.stats.totalCards).toBe(60)
    expect(result.stats.flipCards).toBe(20)
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('FLIP 卡不得超過 16 張，目前為 20 張')
  })
})
