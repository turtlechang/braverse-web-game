import { describe, expect, it } from 'vitest'
import {
  BS4_AI_PRESET_DECK_CHOICES,
  createDeckForChoice,
  OFFICIAL_DECK_RECIPES,
  validateCustomDeck,
} from '.'

describe('BS4 AI preset decks', () => {
  it.each(BS4_AI_PRESET_DECK_CHOICES)('%s is a valid 60-card deck', (deckChoice) => {
    const validation = validateCustomDeck(OFFICIAL_DECK_RECIPES[deckChoice], {
      format: 'open',
    })

    expect(validation.errors).toEqual([])
    expect(validation.stats.totalCards).toBe(60)
    expect(createDeckForChoice(deckChoice, 'player-one')).toHaveLength(60)
  })
})
