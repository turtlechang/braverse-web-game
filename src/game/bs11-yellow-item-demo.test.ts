import { describe, expect, it } from 'vitest'
import { createBs11YellowItemDemoState, parseTestStateConfig } from './demo'

describe('BS11-030/031 Item Browser fixtures', () => {
  it.each(['BS11-030', 'BS11-031'] as const)('%s keeps its exact Break boundary', (cardNumber) => {
    for (const conditionMet of [true, false]) {
      expect(parseTestStateConfig(`?test-state=bs11-yellow-item:${cardNumber}:${conditionMet ? 'positive' : 'negative'}`, 'localhost'))
        .toEqual({ kind: 'bs11-yellow-item', cardNumber, conditionMet })
      const state = createBs11YellowItemDemoState(cardNumber, conditionMet)
      const player = state.players['player-one']
      expect(player.hand[0]?.id).toBe(cardNumber)
      expect(player.supportArea[0]?.card.energyColor).toBe('yellow')
      expect(player.breakArea.length).toBe((cardNumber === 'BS11-030' ? 3 : 4) - Number(!conditionMet))
      if (cardNumber === 'BS11-030') expect(player.battleArea[0]?.hpCards.length).toBe(2)
      else expect(state.players['player-two'].battleArea[0]?.card.id).toBe('BS11-026')
    }
  })
})
