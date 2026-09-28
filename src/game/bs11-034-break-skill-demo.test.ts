import { describe, expect, it } from 'vitest'
import { createBs11034BreakSkillDemoState, parseTestStateConfig } from './demo'
import { canActivateCookieSkill } from './skills'

describe('BS11-034 Break Activate Browser fixture', () => {
  it.each(['BS11-034', 'BS11-034@1'] as const)('%s requires hand level sum three', (cardNumber) => {
    for (const hasLevelSum of [true, false]) {
      expect(parseTestStateConfig(`?test-state=bs11-034-break-skill:${cardNumber}:${hasLevelSum ? 'positive' : 'negative'}`, 'localhost'))
        .toEqual({ kind: 'bs11-034-break-skill', cardNumber, hasLevelSum })
      const state = createBs11034BreakSkillDemoState(cardNumber, hasLevelSum)
      const player = state.players['player-one']
      const source = player.breakArea[0]
      expect(source?.id).toBe('BS11-034')
      if (!source) throw new Error('Golden Cheese in Break missing')
      expect(canActivateCookieSkill(state, 'player-one', source.instanceId, 'activate')).toBe(hasLevelSum)
      expect(player.hand.length).toBe(hasLevelSum ? 2 : 1)
    }
  })
})
