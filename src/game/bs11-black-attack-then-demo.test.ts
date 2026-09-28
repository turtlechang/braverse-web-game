import { describe, expect, it } from 'vitest'
import { createBs11BlackAttackThenDemoState, parseTestStateConfig } from './demo'

const numbers = [
  'BS11-112', 'BS11-112@1', 'BS11-113', 'BS11-113@1',
  'BS11-114', 'BS11-114@1', 'BS11-115', 'BS11-115@1', 'BS11-115@2', 'BS11-115@3',
] as const

describe('BS11 BLACK attack Then Browser fixtures', () => {
  it.each(numbers)('%s keeps normal attack payable while separating optional cost', (cardNumber) => {
    for (const hasThenCost of [true, false]) {
      const scenario = hasThenCost ? 'positive' : 'negative'
      expect(parseTestStateConfig(`?test-state=bs11-black-attack-then:${cardNumber}:${scenario}`, 'localhost'))
        .toEqual({ kind: 'bs11-black-attack-then', cardNumber, hasThenCost })
      const state = createBs11BlackAttackThenDemoState(cardNumber, hasThenCost)
      const player = state.players['player-one']
      expect(player.battleArea.some((entry) => entry.card.instanceId.includes(cardNumber))).toBe(true)
      expect(player.supportArea).toHaveLength(cardNumber.startsWith('BS11-115')
        ? hasThenCost ? 5 : 3 : cardNumber.startsWith('BS11-114') ? 1 : 3)
      expect(player.hand).toHaveLength(cardNumber.startsWith('BS11-115') || !hasThenCost ? 0 : 1)
      expect(player.discardPile.some((card) => card.name === 'Dark Enchantress Cookie'))
        .toBe(cardNumber.startsWith('BS11-114'))
    }
  })
})
