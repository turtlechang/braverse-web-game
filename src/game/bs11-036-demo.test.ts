import { describe, expect, it } from 'vitest'
import { createBs11036AttackDemoState, createBs11036SkillDemoState, parseTestStateConfig } from './demo'
import { canActivateCookieSkill } from './skills'

describe('BS11-036 Browser fixtures', () => {
  it.each(['BS11-036', 'BS11-036@1'] as const)('%s skill and attack conditions', (cardNumber) => {
    for (const positive of [true, false]) {
      const scenario = positive ? 'positive' : 'negative'
      expect(parseTestStateConfig(`?test-state=bs11-036-skill:${cardNumber}:${scenario}`, 'localhost'))
        .toEqual({ kind: 'bs11-036-skill', cardNumber, hasOther: !positive })
      const skill = createBs11036SkillDemoState(cardNumber, !positive)
      const source = skill.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS11-036')
      if (!source) throw new Error('Eternal Sugar source missing')
      expect(canActivateCookieSkill(skill, 'player-one', source.card.instanceId, 'activate')).toBe(positive)

      expect(parseTestStateConfig(`?test-state=bs11-036-attack:${cardNumber}:${scenario}`, 'localhost'))
        .toEqual({ kind: 'bs11-036-attack', cardNumber, lowHp: positive })
      const attack = createBs11036AttackDemoState(cardNumber, positive)
      expect(attack.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS11-036')?.hpCards.length)
        .toBe(positive ? 3 : 4)
      expect(attack.players['player-one'].supportArea.length).toBe(3)
    }
  })
})
