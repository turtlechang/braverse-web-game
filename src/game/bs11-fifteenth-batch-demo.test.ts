import { describe, expect, it } from 'vitest'
import {
  createCardCheckDemoState,
  createCardNegativeDemoState,
  parseTestStateConfig,
} from './demo'
import { getAttackResponseSkillCandidates } from './battle'
import { canActivateCookieSkill } from './skills'

describe('BS11-054～058 candidate Browser fixtures', () => {
  it('054 starts with the candidate in hand and an official opponent Cookie target', () => {
    const state = createCardCheckDemoState('BS11-054')
    expect(state.players['player-one'].hand.some((card) => card.id === 'BS11-054')).toBe(true)
    expect(state.players['player-two'].battleArea.map(({ card }) => card.id)).toContain('BS11-055')

    const followThrough = createCardCheckDemoState('BS11-054', { normalAttack: 'payable' })
    expect(followThrough.cookieAttackDiscardRequirements?.['player-one']).toEqual([
      expect.objectContaining({ cookieInstanceId: expect.any(String), count: 2 }),
    ])
    expect(followThrough.players['player-one'].hand).toHaveLength(2)
    const insufficient = createCardNegativeDemoState('BS11-054', { normalAttack: 'blocked' })
    expect(insufficient.players['player-one'].hand).toHaveLength(1)
    expect(insufficient.cookieAttackDiscardRequirements?.['player-one']).toHaveLength(1)
  })

  it('055 has three mixed-color active attack payments and exactly two in the blocked fixture', () => {
    const positive = createCardCheckDemoState('BS11-055', { normalAttack: 'payable' })
    expect(positive.players['player-one'].supportArea.map(({ card }) => card.energyColor)).toEqual([
      'red', 'green', 'purple',
    ])
    const negative = createCardNegativeDemoState('BS11-055', { normalAttack: 'blocked' })
    expect(negative.players['player-one'].supportArea.filter(({ rested }) => !rested)).toHaveLength(2)
  })

  it('056 exposes Cream Soda only in the condition-met fixture', () => {
    const positive = createCardCheckDemoState('BS11-056', { preferSkillSurface: true })
    const source = positive.players['player-one'].battleArea.find(({ card }) => card.id === 'BS11-056')
    expect(source).toBeDefined()
    expect(canActivateCookieSkill(positive, 'player-one', source!.card.instanceId, 'activate')).toBe(true)
    const negative = createCardNegativeDemoState('BS11-056', { preferSkillSurface: true })
    const negativeSource = negative.players['player-one'].battleArea.find(({ card }) => card.id === 'BS11-056')
    expect(negativeSource).toBeDefined()
    expect(canActivateCookieSkill(negative, 'player-one', negativeSource!.card.instanceId, 'activate')).toBe(false)
  })

  it('058 requires two hand cards and provides a real opponent attack response', () => {
    const positive = createCardCheckDemoState('BS11-058', { preferSkillSurface: true })
    expect(positive.pendingBattle?.stage).toBe('trap')
    expect(positive.players['player-one'].hand).toHaveLength(2)
    expect(getAttackResponseSkillCandidates(positive, 'player-one').map(({ card }) => card.id)).toContain('BS11-058')
    const negative = createCardNegativeDemoState('BS11-058', { preferSkillSurface: true })
    expect(negative.players['player-one'].hand).toHaveLength(1)
    expect(getAttackResponseSkillCandidates(negative, 'player-one').map(({ card }) => card.id)).not.toContain('BS11-058')
  })

  it.each(['BS11-056', 'BS11-058'] as const)(
    '%s preserves the generic blocked-attack fixture when normalAttack is blocked',
    (cardNumber) => {
      const route = parseTestStateConfig(
        `?test-state=card-attack-negative:${cardNumber}`,
        'localhost',
      )
      expect(route).toMatchObject({ kind: 'card-negative', cardNumber, normalAttack: 'blocked' })
      if (!route || route.kind !== 'card-negative') throw new Error(`Invalid blocked attack route for ${cardNumber}`)
      const state = createCardNegativeDemoState(cardNumber, { normalAttack: route.normalAttack })
      const player = state.players['player-one']

      expect(player.supportArea.length).toBeGreaterThan(0)
      expect(player.supportArea.every(({ rested }) => rested)).toBe(true)
      expect(state.pendingBattle).toBeFalsy()
    },
  )
})
