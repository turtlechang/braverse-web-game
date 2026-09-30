import { describe, expect, it } from 'vitest'
import { canPlayExtraDeckCookie } from './actions'
import {
  createCardCheckDemoState,
  createCardNegativeDemoState,
  createBs11116ExtraDeckDemoState,
  createBs11116MovementProtectionDemoState,
  parseTestStateConfig,
} from './demo'
import {
  getEffectTargetCandidatesForEffect,
  isOpponentBattleMovementPrevented,
} from './effects/targeting'

describe('BS11-116 localhost fixture', () => {
  it.each(['BS11-116', 'BS11-116@1'] as const)(
    'keeps generic %s test-state in EXTRA Deck on both positive and negative paths',
    (cardNumber) => {
      const positive = createCardCheckDemoState(cardNumber)
      const negative = createCardNegativeDemoState(cardNumber)
      const extraId = 'bs11-116-demo-extra'

      expect(positive.players['player-one'].extraDeck?.map((card) => card.id)).toEqual(['BS11-116'])
      expect(negative.players['player-one'].extraDeck?.map((card) => card.id)).toEqual(['BS11-116'])
      expect(positive.players['player-one'].hand.some((card) => card.id === 'BS11-116')).toBe(false)
      expect(negative.players['player-one'].hand.some((card) => card.id === 'BS11-116')).toBe(false)
      expect(canPlayExtraDeckCookie(positive, 'player-one', extraId)).toBe(true)
      expect(canPlayExtraDeckCookie(negative, 'player-one', extraId)).toBe(false)
    },
  )

  it('parses explicit positive and negative routes', () => {
    expect(parseTestStateConfig(
      '?test-state=bs11-116-extra-deck:positive',
      'localhost',
    )).toEqual({ kind: 'bs11-116-extra-deck', cardNumber: 'BS11-116', conditionMet: true })
    expect(parseTestStateConfig(
      '?test-state=bs11-116-extra-deck:negative',
      'localhost',
    )).toEqual({ kind: 'bs11-116-extra-deck', cardNumber: 'BS11-116', conditionMet: false })
    expect(parseTestStateConfig(
      '?test-state=bs11-116-extra-deck:BS11-116:castle-missing',
      'localhost',
    )).toEqual({
      kind: 'bs11-116-extra-deck',
      cardNumber: 'BS11-116',
      conditionMet: false,
      missingRequirement: 'castle',
    })
    expect(parseTestStateConfig(
      '?test-state=bs11-116-extra-deck:BS11-116@1:break-missing',
      'localhost',
    )).toEqual({
      kind: 'bs11-116-extra-deck',
      cardNumber: 'BS11-116@1',
      conditionMet: false,
      missingRequirement: 'break',
    })
    expect(parseTestStateConfig(
      '?test-state=bs11-116-extra-deck:BS11-116:special-play-missing',
      'localhost',
    )).toEqual({
      kind: 'bs11-116-extra-deck',
      cardNumber: 'BS11-116',
      conditionMet: false,
      missingRequirement: 'special-play',
    })
  })

  it('keeps the positive EXTRA card playable and the negative route blocked', () => {
    const positive = createBs11116ExtraDeckDemoState(true)
    const negative = createBs11116ExtraDeckDemoState(false)
    const extraInstanceId = 'bs11-116-demo-extra'

    expect(canPlayExtraDeckCookie(positive, 'player-one', extraInstanceId)).toBe(true)
    expect(canPlayExtraDeckCookie(negative, 'player-one', extraInstanceId)).toBe(false)
  })
  it('loads the variant EXTRA from its own candidate record', () => {
    expect(parseTestStateConfig('?test-state=bs11-116-extra-deck:BS11-116@1:positive', 'localhost'))
      .toEqual({ kind: 'bs11-116-extra-deck', cardNumber: 'BS11-116@1', conditionMet: true })
    const state = createBs11116ExtraDeckDemoState(true, 'BS11-116@1')
    expect(state.players['player-one'].extraDeck?.[0]?.instanceId).toBe('bs11-116-demo-extra')
    expect(state.players['player-one'].extraDeck?.[0]?.id).toBe('BS11-116')
    expect(canPlayExtraDeckCookie(state, 'player-one', 'bs11-116-demo-extra')).toBe(true)
  })

  it.each(['castle', 'break', 'special-play'] as const)(
    'fails the EXTRA gate when only the %s requirement is missing',
    (missingRequirement) => {
      const state = createBs11116ExtraDeckDemoState(true, 'BS11-116', missingRequirement)
      const player = state.players['player-one']

      if (missingRequirement === 'castle') {
        expect(player.stage).toBeNull()
        expect(player.breakArea.reduce((sum, card) => sum + card.level, 0)).toBeGreaterThanOrEqual(7)
        expect(player.battleArea[0]?.card.skill?.specialPlayCost).toBeDefined()
      } else if (missingRequirement === 'break') {
        expect(player.stage?.card.name).toBe("Dark Enchantress's Castle")
        expect(player.breakArea.reduce((sum, card) => sum + card.level, 0)).toBe(6)
        expect(player.battleArea[0]?.card.skill?.specialPlayCost).toBeDefined()
      } else {
        expect(player.stage?.card.name).toBe("Dark Enchantress's Castle")
        expect(player.breakArea.reduce((sum, card) => sum + card.level, 0)).toBeGreaterThanOrEqual(7)
        expect(player.battleArea[0]?.card.skill?.specialPlayCost).toBeUndefined()
      }

      expect(canPlayExtraDeckCookie(state, 'player-one', 'bs11-116-demo-extra')).toBe(false)
    },
  )

  it('prepares a real ST5-015 On Play against Awakened BS11-116 and an unprotected control', () => {
    expect(parseTestStateConfig('?test-state=bs11-116-movement-protection', 'localhost'))
      .toEqual({ kind: 'bs11-116-movement-protection' })
    const state = createBs11116MovementProtectionDemoState()
    const protectedTarget = state.players['player-two'].battleArea.find(
      (entry) => entry.card.instanceId === 'bs11-116-demo-extra',
    )

    expect(state.activePlayerId).toBe('player-one')
    expect(state.players['player-one'].battleArea[0]?.card).toMatchObject({
      id: 'ST5-015',
      skill: { trigger: 'on-play' },
    })
    expect(state.pendingAbilityEffect).toMatchObject({
      playerId: 'player-one',
      sourcePlayerId: 'player-one',
      trigger: 'on-play',
      sourceKind: 'skill',
    })
    expect(protectedTarget?.card).toMatchObject({
      id: 'BS11-116',
      extraDeckOrigin: 'awakened',
    })
    expect(isOpponentBattleMovementPrevented(state, 'player-one', 'bs11-116-demo-extra')).toBe(true)
    expect(isOpponentBattleMovementPrevented(
      state,
      'player-one',
      'bs11-116-movement-unprotected-target',
    )).toBe(false)

    const source = state.players['player-one'].battleArea[0]!.card
    const removal = source.skill?.effects[0]
    expect(removal?.kind).toBe('field-to-trash')
    if (!removal) throw new Error('ST5-015 fixture is missing its On Play effect')
    const candidates = getEffectTargetCandidatesForEffect(
      state,
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId: source.instanceId,
        sourceCardName: source.name,
      },
      removal,
    )
    expect(candidates.map((entry) => entry.card.instanceId)).toEqual([
      'bs11-116-movement-unprotected-target',
    ])

    expect(getEffectTargetCandidatesForEffect(
      state,
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId: source.instanceId,
        sourceCardName: source.name,
      },
      removal,
    ).map((entry) => entry.card.instanceId)).toEqual([
      'bs11-116-movement-unprotected-target',
    ])
  })
})
