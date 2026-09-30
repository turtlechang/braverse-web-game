import { describe, expect, it } from 'vitest'
import { createBs11026SkillDemoState, parseTestStateConfig } from './demo'
import { canActivateCookieSkill } from './skills'

describe('BS11-026 skill Browser fixture', () => {
  it.each([true, false])('requires a FLIP Cookie hand cost hasFlip=%s', (hasFlip) => {
    expect(parseTestStateConfig(`?test-state=bs11-026-skill:${hasFlip ? 'positive' : 'negative'}`, 'localhost'))
      .toEqual({ kind: 'bs11-026-skill', hasFlip })
    const state = createBs11026SkillDemoState(hasFlip)
    const player = state.players['player-one']
    const source = player.battleArea.find((entry) => entry.card.id === 'BS11-026')
    if (!source) throw new Error('Wizard source missing')
    expect(player.hand[0]?.id).toBe(hasFlip ? 'BS11-019' : 'BS11-022')
    expect(canActivateCookieSkill(state, 'player-one', source.card.instanceId, 'activate')).toBe(hasFlip)
  })
})
