import { describe, expect, it } from 'vitest'
import {
  BS5_AI_PRESET_DECK_CHOICES,
  createDeckForChoice,
  createDemoGame,
  getCardRestriction,
  getDeckFormatLabel,
  OFFICIAL_DECK_RECIPES,
  simulateAiMatchDetailed,
  validateCustomDeck,
} from '.'

const STANDARD_BS5_CHOICES = BS5_AI_PRESET_DECK_CHOICES.slice(0, 5)
const OPEN_BS5_CHOICES = BS5_AI_PRESET_DECK_CHOICES.slice(5)

describe('BS5 五色賽制牌組', () => {
  it.each(STANDARD_BS5_CHOICES)('%s 符合標準賽制', (deckChoice) => {
    const entries = OFFICIAL_DECK_RECIPES[deckChoice]
    const validation = validateCustomDeck(entries, { format: 'standard' })

    expect(validation.errors).toEqual([])
    expect(validation.stats.totalCards).toBe(60)
    expect(createDeckForChoice(deckChoice, 'player-one')).toHaveLength(60)
    expect(entries.every((entry) => entry.cardNumber.startsWith('BS5-'))).toBe(
      true,
    )
  })

  it.each(OPEN_BS5_CHOICES)('%s 可在開放賽制使用', (deckChoice) => {
    const entries = OFFICIAL_DECK_RECIPES[deckChoice]
    const validation = validateCustomDeck(entries, { format: 'open' })

    expect(validation.errors).toEqual([])
    expect(validation.stats.totalCards).toBe(60)
    expect(createDeckForChoice(deckChoice, 'player-one')).toHaveLength(60)
  })

  it.each(OPEN_BS5_CHOICES)('%s 的受限卡在標準賽制會被攔截', (deckChoice) => {
    const entries = OFFICIAL_DECK_RECIPES[deckChoice]
    const validation = validateCustomDeck(entries, { format: 'standard' })

    expect(validation.isValid).toBe(false)
    expect(validation.errors.some((error) => error.includes('標準賽制'))).toBe(
      true,
    )
  })

  it('開放賽制忽略禁卡與限卡，但仍保留基本牌組規則', () => {
    expect(getDeckFormatLabel('open')).toBe('開放賽制（所有卡牌都能用）')
    expect(getDeckFormatLabel('standard')).toBe('標準賽制（套用禁限卡）')
    expect(getCardRestriction('BS2-003', 'open')).toBe('none')
    expect(getCardRestriction('BS2-003', 'standard')).toBe('banned')
    expect(getCardRestriction('BS1-057', 'open')).toBe('none')
    expect(getCardRestriction('BS1-057', 'standard')).toBe('limited')

    const tooManyCards = [
      { cardNumber: 'BS2-003', count: 4 },
      { cardNumber: 'BS5-001', count: 56 },
    ]
    const validation = validateCustomDeck(tooManyCards, { format: 'open' })

    expect(validation.errors.some((error) => error.includes('超過每卡最多 4 張限制'))).toBe(
      true,
    )
  })

  it('BS5 綠色標準牌組遇到結束階段場景效果仍能繼續對戰', () => {
    const seed = 20263006
    const result = simulateAiMatchDetailed(
      createDemoGame(seed, {
        player: 'bs5-green-standard',
        ai: 'bs5-green-standard',
      }),
      2500,
      {
        levels: { 'player-one': 4, 'player-two': 4 },
        seed,
      },
    )

    expect(result.stuck).toBe(false)
    expect(result.state.status).toBe('finished')
  })
})
