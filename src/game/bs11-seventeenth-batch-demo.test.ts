import { describe, expect, it } from 'vitest'
import {
  createBs11064ReplacementDemoState,
  createBs11066TrapDemoState,
  createBs11067AttackDemoState,
  createBs11068FaintDemoState,
  createBs11069ResponseDemoState,
  createBs11070OnPlayDemoState,
  createBs11070AttackDemoState,
  parseTestStateConfig,
} from './demo'

describe('BS11-064 candidate On Play replacement fixture', () => {
  it('parses positive and unpaid replacement routes', () => {
    expect(parseTestStateConfig('?test-state=bs11-064-replacement:positive', 'localhost'))
      .toEqual({ kind: 'bs11-064-replacement', conditionMet: true })
    expect(parseTestStateConfig('?test-state=bs11-064-replacement:negative', 'localhost'))
      .toEqual({ kind: 'bs11-064-replacement', conditionMet: false })
  })

  it('uses real item and Cookie commands, with only the replacement payment differing', () => {
    const positive = createBs11064ReplacementDemoState(true)
    const negative = createBs11064ReplacementDemoState(false)
    for (const state of [positive, negative]) {
      expect(state.onPlayReplacementUntilTurn?.['player-one']).toMatchObject({
        cost: { energy: { neutral: 1 } },
        effects: [{ kind: 'draw-up-to', max: 1 }],
      })
      expect(state.pendingOnPlay).toMatchObject({ playerId: 'player-one', origin: 'hand' })
      expect(state.commandLog?.map((entry) => entry.commandKind)).toEqual(
        expect.arrayContaining(['begin-play-item', 'resolve-ability-effect', 'deploy-cookie']),
      )
      expect(state.players['player-one'].hand).toEqual([])
      expect(state.players['player-one'].battleArea[0]?.card.name).toBe('On Play Replacement Witness')
    }
    expect(positive.players['player-one'].supportArea).toHaveLength(1)
    expect(negative.players['player-one'].supportArea).toHaveLength(0)
  })
})

describe('BS11-066 candidate Trap fixture', () => {
  it('keeps the defender alive and changes only payment availability', () => {
    expect(parseTestStateConfig('?test-state=bs11-066-trap:positive', 'localhost'))
      .toEqual({ kind: 'bs11-066-trap', conditionMet: true })
    const positive = createBs11066TrapDemoState(true)
    const negative = createBs11066TrapDemoState(false)
    expect(positive.pendingBattle?.stage).toBe('trap')
    const defenderId = positive.pendingBattle?.targetInstanceId
    expect(positive.players['player-one'].battleArea.find((entry) =>
      entry.card.instanceId === defenderId)?.hpCards).toHaveLength(8)
    expect(negative.players['player-one'].battleArea).toEqual(positive.players['player-one'].battleArea)
    expect(positive.players['player-one'].supportArea.every((support) => !support.rested)).toBe(true)
    expect(negative.players['player-one'].supportArea.every((support) => support.rested)).toBe(true)
  })
})

describe('BS11-067 candidate attack fixture', () => {
  it.each(['BS11-067', 'BS11-067@1'] as const)('%s starts before attack payment', (cardNumber) => {
    expect(parseTestStateConfig(`?test-state=bs11-067-attack:${cardNumber}:positive`, 'localhost'))
      .toEqual({ kind: 'bs11-067-attack', cardNumber, thenPayable: true })
    const positive = createBs11067AttackDemoState(cardNumber, true)
    const negative = createBs11067AttackDemoState(cardNumber, false)
    expect(positive.pendingBattle).toBeNull()
    expect(positive.players['player-one'].battleArea[0]?.card.id).toBe('BS11-067')
    expect(positive.players['player-one'].battleArea[0]?.card.imageUrl).toMatch(/\/data\/en_storage\//)
    expect(positive.players['player-one'].supportArea).toHaveLength(3)
    expect(negative.players['player-one'].supportArea).toHaveLength(2)
    expect(positive.players['player-two'].battleArea[0]?.hpCards).toHaveLength(8)
  })
})

describe('BS11-068 candidate faint fixture', () => {
  it.each(['BS11-068', 'BS11-068@1'] as const)('%s reaches the faint queue by damage', (cardNumber) => {
    expect(parseTestStateConfig(`?test-state=bs11-068-faint:${cardNumber}:positive`, 'localhost'))
      .toEqual({ kind: 'bs11-068-faint', cardNumber, payable: true })
    const positive = createBs11068FaintDemoState(cardNumber, true)
    const negative = createBs11068FaintDemoState(cardNumber, false)
    expect(positive.pendingFaintEffects?.[0]?.sourceCardName).toBe('Black Sapphire Cookie')
    expect(positive.players['player-one'].battleArea.some((entry) => entry.card.id === 'BS11-068')).toBe(false)
    expect(positive.players['player-one'].breakArea.some((card) => card.id === 'BS11-068')).toBe(true)
    expect(positive.players['player-two'].battleArea[0]?.hpCards).toHaveLength(2)
    expect(positive.players['player-one'].supportArea[0]?.rested).toBe(false)
    expect(negative.players['player-one'].supportArea[0]?.rested).toBe(true)
  })
})

describe('BS11-069 candidate opponent attack fixture', () => {
  it.each(['BS11-069', 'BS11-069@1'] as const)('%s checks the five-card hand boundary', (cardNumber) => {
    expect(parseTestStateConfig(`?test-state=bs11-069-response:${cardNumber}:positive`, 'localhost'))
      .toEqual({ kind: 'bs11-069-response', cardNumber, conditionMet: true })
    const positive = createBs11069ResponseDemoState(cardNumber, true)
    const negative = createBs11069ResponseDemoState(cardNumber, false)
    expect(positive.pendingBattle?.stage).toBe('trap')
    expect(positive.players['player-one'].hand).toHaveLength(5)
    expect(negative.players['player-one'].hand).toHaveLength(6)
    expect(positive.commandLog?.some((entry) => entry.commandKind === 'declare-attack')).toBe(true)
  })
})

describe('BS11-070 candidate On Play fixture', () => {
  it.each(['BS11-070', 'BS11-070@1'] as const)('%s exposes an Ancient hand cost', (cardNumber) => {
    expect(parseTestStateConfig(`?test-state=bs11-070-on-play:${cardNumber}:positive`, 'localhost'))
      .toEqual({ kind: 'bs11-070-on-play', cardNumber, payable: true })
    const positive = createBs11070OnPlayDemoState(cardNumber, true)
    const negative = createBs11070OnPlayDemoState(cardNumber, false)
    expect(positive.players['player-one'].hand[0]?.id).toBe('BS11-070')
    expect(positive.players['player-one'].hand[1]?.keywords).toContain('ancient')
    expect(negative.players['player-one'].hand[1]?.keywords ?? []).not.toContain('ancient')
    expect(positive.players['player-one'].battleArea.some((entry) => entry.card.id === 'BS11-070')).toBe(false)
  })
})

describe('BS11-070 candidate attack fixture', () => {
  it.each(['BS11-070', 'BS11-070@1'] as const)('%s starts before BNN attack', (cardNumber) => {
    expect(parseTestStateConfig(`?test-state=bs11-070-attack:${cardNumber}:top`, 'localhost'))
      .toEqual({ kind: 'bs11-070-attack', cardNumber, scenario: 'top' })
    const top = createBs11070AttackDemoState(cardNumber, 'top')
    const skip = createBs11070AttackDemoState(cardNumber, 'skip')
    expect(top.pendingBattle).toBeNull()
    expect(top.players['player-one'].battleArea.map((entry) => entry.card.level)).toEqual([2, 1])
    expect(top.players['player-one'].supportArea).toHaveLength(4)
    expect(skip.players['player-one'].supportArea).toHaveLength(3)
  })
})
