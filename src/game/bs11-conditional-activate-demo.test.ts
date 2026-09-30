import { describe, expect, it } from 'vitest'
import { canActivateCookieSkill } from './skills'
import { createBs11ConditionalActivateDemoState, parseTestStateConfig } from './demo'

describe('BS11-021/038 conditional Activate Browser fixtures', () => {
  it.each(['BS11-021', 'BS11-038'] as const)('%s exposes its real condition boundary', (cardNumber) => {
    for (const conditionMet of [true, false]) {
      const scenario = conditionMet ? 'positive' : 'negative'
      expect(parseTestStateConfig(`?test-state=bs11-conditional-activate:${cardNumber}:${scenario}`, 'localhost'))
        .toEqual({ kind: 'bs11-conditional-activate', cardNumber, conditionMet })
      const state = createBs11ConditionalActivateDemoState(cardNumber, conditionMet)
      const player = state.players['player-one']
      const source = player.battleArea.find((entry) => entry.card.id === cardNumber)
      if (!source) throw new Error(`${cardNumber} source missing`)
      expect(canActivateCookieSkill(state, 'player-one', source.card.instanceId, 'activate')).toBe(conditionMet)
      if (cardNumber === 'BS11-021') {
        expect(player.discardPile.map((card) => card.instanceId)).toContain('bs11-021-flip-trash')
      } else {
        expect(player.supportArea.find((entry) => entry.card.instanceId === 'bs11-038-rested-support')?.rested).toBe(true)
      }
    }
  })
})
