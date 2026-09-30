import { describe, expect, it } from 'vitest'
import {
  BS11_FLIP_PREVIEW_CARD_NUMBERS,
  createBs11FlipPreviewDemoState,
  parseTestStateConfig,
} from './demo'

describe('BS11 simple FLIP candidate Browser fixture', () => {
  it.each(BS11_FLIP_PREVIEW_CARD_NUMBERS)(
    'opens %s through a real attack for positive and negative routes',
    (cardNumber) => {
      expect(parseTestStateConfig(
        `?test-state=bs11-flip:${cardNumber}:positive`,
        'localhost',
      )).toEqual({ kind: 'bs11-flip', cardNumber, conditionMet: true })
      expect(parseTestStateConfig(
        `?test-state=bs11-flip:${cardNumber}:negative`,
        'localhost',
      )).toEqual({ kind: 'bs11-flip', cardNumber, conditionMet: false })
      expect(parseTestStateConfig(
        `?test-state=bs11-flip:${cardNumber}:positive`,
        'example.com',
      )).toBeNull()

      const positive = createBs11FlipPreviewDemoState(cardNumber, true)
      const negative = createBs11FlipPreviewDemoState(cardNumber, false)
      for (const state of [positive, negative]) {
        expect(state.pendingBattle?.stage).toBe('flip')
        expect(state.pendingBattle?.revealedHpCard?.id).toBe(cardNumber)
        expect(state.commandLog?.map((entry) => entry.commandKind).slice(0, 3)).toEqual([
          'declare-attack',
          'skip-trap',
          'resolve-next-damage',
        ])
      }

      const expectedNegativeHand = cardNumber === 'BS11-005' ||
        cardNumber === 'BS11-019' ||
        cardNumber === 'BS11-039' ||
        cardNumber === 'BS11-059' ||
        cardNumber === 'BS11-076' ||
        cardNumber === 'BS11-093' ||
        cardNumber === 'BS11-096' ||
        cardNumber === 'BS11-101'
        ? 0
        : 1
      expect(negative.players['player-one'].hand).toHaveLength(expectedNegativeHand)
      expect(positive.players['player-one'].hand).toHaveLength(1)
    },
  )
})
