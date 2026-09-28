import { describe, expect, it } from 'vitest'
import { createBs11018SkillDemoState, parseTestStateConfig } from './demo'
import { canActivateCookieSkill } from './skills'

describe('BS11-018 skill Browser fixtures', () => {
  it.each(['BS11-018', 'BS11-018@1'] as const)('%s offers the faint cost once per turn', (cardNumber) => {
    for (const alreadyUsed of [false, true]) {
      expect(parseTestStateConfig(`?test-state=bs11-018-skill:${cardNumber}:${alreadyUsed ? 'negative' : 'positive'}`, 'localhost'))
        .toEqual({ kind: 'bs11-018-skill', cardNumber, alreadyUsed })
      const state = createBs11018SkillDemoState(cardNumber, alreadyUsed)
      const player = state.players['player-one']
      const source = player.battleArea.find((entry) => entry.card.id === 'BS11-018')
      if (!source) throw new Error('Burning Spice source missing')
      expect(player.battleArea.some((entry) => entry.card.instanceId === 'bs11-018-skill-faint-ally')).toBe(true)
      expect(canActivateCookieSkill(state, 'player-one', source.card.instanceId, 'activate')).toBe(!alreadyUsed)
    }
  })
})
