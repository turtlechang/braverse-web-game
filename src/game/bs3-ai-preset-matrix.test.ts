import { describe, expect, it } from 'vitest'
import {
  BS3_AI_PRESET_DECK_CHOICES,
  createDeckForChoice,
  createDemoGame,
  OFFICIAL_DECK_RECIPES,
  simulateAiMatch,
  validateCustomDeck,
} from '.'

const BS3_MATRIX_SEED = 20260731
const BS3_MATRIX_MAX_ACTIONS = 2000

const bs3MatchupCases = BS3_AI_PRESET_DECK_CHOICES.flatMap((playerDeck) =>
  BS3_AI_PRESET_DECK_CHOICES
    .filter((aiDeck) => aiDeck !== playerDeck)
    .map((aiDeck) => ({ playerDeck, aiDeck })),
)

describe('第三彈 AI 預設牌組', () => {
  it.each(BS3_AI_PRESET_DECK_CHOICES)(
    '%s 可由正式卡池建立為合法 60 張牌組',
    (deckChoice) => {
      const validation = validateCustomDeck(OFFICIAL_DECK_RECIPES[deckChoice], {
        format: 'open',
      })

      expect(validation.errors).toEqual([])
      expect(validation.stats.totalCards).toBe(60)
      expect(createDeckForChoice(deckChoice, 'player-one')).toHaveLength(60)
    },
  )

  it.each(bs3MatchupCases)(
    'Lv.4 完成 $playerDeck 對 $aiDeck 的交叉對戰',
    ({ playerDeck, aiDeck }) => {
      const result = simulateAiMatch(
        createDemoGame(BS3_MATRIX_SEED, { player: playerDeck, ai: aiDeck }),
        BS3_MATRIX_MAX_ACTIONS,
        {
          levels: { 'player-one': 4, 'player-two': 4 },
          seed: BS3_MATRIX_SEED,
        },
      )

      expect(
        result.stuck,
        `${playerDeck} 對 ${aiDeck}: ${result.error ?? ''}`,
      ).toBe(false)
      expect(result.state.status).toBe('finished')
      expect(result.state.result).not.toBeNull()
    },
  )
})
