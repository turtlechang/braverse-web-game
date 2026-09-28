import { describe, expect, it } from 'vitest'
import {
  createCardCheckDemoState,
  createCardNegativeDemoState,
  parseTestStateConfig,
} from './demo'

const routeConfig = (route: string) =>
  parseTestStateConfig(
    `?${new URLSearchParams({ 'test-state': route }).toString()}`,
    'localhost',
  )

describe('BS11 sixteenth-batch candidate test-state fixtures', () => {
  it('routes BS11-060 neutral attack payment through an active red support', () => {
    expect(routeConfig('card-attack:BS11-060')).toMatchObject({
      kind: 'card-check',
      cardNumber: 'BS11-060',
      normalAttack: 'payable',
    })
    expect(routeConfig('card-attack-negative:BS11-060')).toMatchObject({
      kind: 'card-negative',
      cardNumber: 'BS11-060',
      normalAttack: 'blocked',
    })

    const positive = createCardCheckDemoState('BS11-060', {
      normalAttack: 'payable',
    })
    const blocked = createCardNegativeDemoState('BS11-060', {
      normalAttack: 'blocked',
    })
    expect(positive.players['player-one'].battleArea[0]?.card.id).toBe('BS11-060')
    expect(positive.players['player-one'].supportArea).toMatchObject([
      { card: { energyColor: 'red' }, rested: false },
    ])
    expect(blocked.players['player-one'].supportArea).toMatchObject([
      { card: { energyColor: 'red' }, rested: true },
    ])
  })

  it('provides payable and blocked 2B Activate fixtures for BS11-061', () => {
    expect(routeConfig('card-skill:BS11-061')).toMatchObject({
      kind: 'card-check',
      cardNumber: 'BS11-061',
      preferSkillSurface: true,
    })
    expect(routeConfig('card-skill-negative:BS11-061')).toMatchObject({
      kind: 'card-negative',
      cardNumber: 'BS11-061',
      preferSkillSurface: true,
    })

    const positive = createCardCheckDemoState('BS11-061', {
      preferSkillSurface: true,
    })
    const blocked = createCardNegativeDemoState('BS11-061', {
      preferSkillSurface: true,
    })
    expect(positive.players['player-one'].battleArea[0]?.card.id).toBe('BS11-061')
    expect(positive.players['player-one'].supportArea.filter(({ rested }) => !rested)).toHaveLength(4)
    expect(blocked.players['player-one'].supportArea.filter(({ rested }) => !rested)).toHaveLength(1)
  })

  it('covers BS11-062 2B placement, empty-hand inspection, and unpaid placement', () => {
    const positive = createCardCheckDemoState('BS11-062')
    const emptyHandConfig = routeConfig('card-skill:BS11-062')
    expect(emptyHandConfig).toMatchObject({
      kind: 'card-check',
      cardNumber: 'BS11-062',
      preferSkillSurface: true,
    })
    const emptyHand = createCardCheckDemoState('BS11-062', {
      preferSkillSurface: true,
    })
    const blocked = createCardNegativeDemoState('BS11-062')

    expect(positive.players['player-one'].hand[0]?.id).toBe('BS11-062')
    expect(positive.players['player-two'].hand).toHaveLength(3)
    expect(emptyHand.players['player-one'].hand[0]?.id).toBe('BS11-062')
    expect(emptyHand.players['player-two'].hand).toHaveLength(0)
    expect(emptyHand.players['player-one'].supportArea.filter(({ rested }) => !rested)).toHaveLength(2)
    expect(blocked.players['player-one'].supportArea.filter(({ rested }) => !rested)).toHaveLength(1)
  })

  it.each(['BS11-063', 'BS11-063@1'] as const)(
    'opens candidate trap payment and conditional draw routes for %s',
    (cardNumber) => {
      expect(routeConfig(`card-skill:${cardNumber}`)).toMatchObject({
        kind: 'card-check',
        cardNumber,
        preferSkillSurface: true,
      })
      expect(routeConfig(`card-skill-negative:${cardNumber}`)).toMatchObject({
        kind: 'card-negative',
        cardNumber,
        preferSkillSurface: true,
      })
      expect(routeConfig(`bs11-063-no-condition:${cardNumber}`)).toMatchObject({
        kind: 'card-check',
        cardNumber,
        faintSourceMoved: true,
        preferSkillSurface: true,
      })

      const payable = createCardCheckDemoState(cardNumber, {
        preferSkillSurface: true,
      })
      const noConditionConfig = routeConfig(`bs11-063-no-condition:${cardNumber}`)
      const noCondition = noConditionConfig?.kind === 'card-check'
        ? createCardCheckDemoState(noConditionConfig.cardNumber, {
            preferSkillSurface: noConditionConfig.preferSkillSurface,
            faintSourceMoved: noConditionConfig.faintSourceMoved,
          })
        : null
      const blocked = createCardNegativeDemoState(cardNumber, {
        preferSkillSurface: true,
      })

      expect(payable.pendingBattle).not.toBeNull()
      const trapInHand = payable.players['player-one'].hand.find(
        (card) => card.name === "Sea's Protection",
      )
      expect(trapInHand).toMatchObject({
        id: 'BS11-063',
        instanceId: expect.stringContaining(cardNumber),
      })
      expect(payable.pendingBattle?.declaredDamage).toBe(1)
      expect(payable.players['player-one'].battleArea.some(({ card }) => card.id === 'BS11-069')).toBe(true)
      expect(payable.players['player-one'].supportArea).toMatchObject([
        { card: { energyColor: 'blue' }, rested: false },
      ])
      expect(noCondition?.players['player-one'].battleArea.some(({ card }) => card.id === 'BS11-069')).toBe(false)
      expect(blocked.players['player-one'].supportArea[0]?.rested).toBe(true)
    },
  )
})
