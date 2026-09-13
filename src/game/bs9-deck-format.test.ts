import { describe, expect, it } from 'vitest'
import {
  BS9_AI_PRESET_DECK_CHOICES,
  BS9_EXTRA_DECK_RECIPES,
  createDeckForChoice,
  createExtraDeckForChoice,
  getCardPoolEntry,
  OFFICIAL_DECK_RECIPES,
  validateCustomDeck,
  validateCustomDeckDefinition,
  type Bs9AiPresetDeckChoice,
} from './index'

const expectedColor: Record<Bs9AiPresetDeckChoice, string> = {
  'bs9-red-truth': 'red',
  'bs9-yellow-prophecy': 'yellow',
  'bs9-green-support': 'green',
  'bs9-blue-deceit': 'blue',
  'bs9-purple-mill': 'purple',
}

describe('BS9 AI 預設牌組', () => {
  it.each(BS9_AI_PRESET_DECK_CHOICES)('%s 是合法的純 BS9 同色 60 張牌組', (choice) => {
    const entries = OFFICIAL_DECK_RECIPES[choice]
    const validation = validateCustomDeck(entries)
    const extraEntries = BS9_EXTRA_DECK_RECIPES[choice]
    const fullValidation = validateCustomDeckDefinition({
      entries,
      extraDeckEntries: extraEntries,
      format: 'standard',
    })
    const cards = createDeckForChoice(choice, 'player-one')
    const extraCards = createExtraDeckForChoice(choice, 'player-one')

    expect(validation.isValid).toBe(true)
    expect(validation.stats.totalCards).toBe(60)
    expect(fullValidation.isValid).toBe(true)
    expect(fullValidation.stats.extraDeckCards).toBe(4)
    expect(cards).toHaveLength(60)
    expect(cards.every((card) => card.id.startsWith('BS9-'))).toBe(true)
    expect(cards.every((card) =>
      getCardPoolEntry(card.id)?.color?.toLowerCase() === expectedColor[choice],
    )).toBe(true)
    expect(extraEntries).toHaveLength(1)
    expect(extraEntries[0]?.count).toBe(4)
    expect(extraCards).toHaveLength(4)
    expect(extraCards.every((card) =>
      card.type === 'extra' &&
      card.id.startsWith('BS9-') &&
      card.cardColor === expectedColor[choice],
    )).toBe(true)
  })
})
