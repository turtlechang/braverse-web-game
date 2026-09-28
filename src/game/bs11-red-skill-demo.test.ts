import { describe, expect, it } from 'vitest'
import { createBs11RedSkillDemoState, parseTestStateConfig } from './demo'

describe('BS11 RED Activate Browser fixtures', () => {
  it.each([
    ['BS11-002', 1, 1, 0],
    ['BS11-007', 2, 1, 0],
    ['BS11-008', 1, 0, 0],
  ] as const)('%s isolates its printed cost', (cardNumber, positiveEnergy, negativeEnergy, negativeHand) => {
    expect(parseTestStateConfig(`?test-state=bs11-red-skill:${cardNumber}:positive`, 'localhost'))
      .toEqual({ kind: 'bs11-red-skill', cardNumber, payable: true })
    const positive = createBs11RedSkillDemoState(cardNumber, true)
    const negative = createBs11RedSkillDemoState(cardNumber, false)
    expect(positive.players['player-one'].battleArea.some((entry) => entry.card.id === cardNumber)).toBe(true)
    expect(positive.players['player-one'].supportArea).toHaveLength(positiveEnergy)
    expect(negative.players['player-one'].supportArea).toHaveLength(negativeEnergy)
    expect(negative.players['player-one'].hand).toHaveLength(negativeHand)
    if (cardNumber === 'BS11-002') {
      expect(positive.players['player-one'].hand[0]?.type).toBe('item')
      expect(positive.players['player-one'].deck[0]?.instanceId).toBe('bs11-002-draw-witness')
    }
  })
})
