import { describe, expect, it } from 'vitest'
import { takeAiStep } from './ai'
import type {
  CardEffect,
  CookieCard,
  GameCard,
  GameState,
  PlayerId,
  PlayerState,
} from './types'

const testCookieCard = (
  instanceId: string,
  options: { level?: number; hp?: number; attack?: number } = {},
): CookieCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'cookie',
  level: options.level ?? 1,
  hp: options.hp ?? 1,
  attack: options.attack ?? 1,
  attackCost: 0,
  attackEnergyCost: {},
})

const testItemCard = (
  instanceId: string,
  effects: CardEffect[],
): GameCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'item',
  item: {
    cost: { energy: {} },
    text: 'test item',
    effects,
  },
})

const buildTestState = (
  activePlayerId: PlayerId,
  overrides: Partial<PlayerState> & { id: PlayerId },
): GameState => {
  const emptyPlayer = (id: PlayerId): PlayerState => ({
    id,
    name: id === 'player-one' ? '玩家' : 'AI 對手',
    deck: [],
    hand: [],
    battleArea: [],
    supportArea: [],
    breakArea: [],
    discardPile: [],
    stage: null,
    hasMulliganed: true,
    startingCookieSelected: true,
    freeMulliganDecided: true,
    forcedMulliganCount: 0,
  })

  return {
    players: {
      'player-one': activePlayerId === 'player-one'
        ? { ...emptyPlayer('player-one'), ...overrides, id: 'player-one' }
        : emptyPlayer('player-one'),
      'player-two': activePlayerId === 'player-two'
        ? { ...emptyPlayer('player-two'), ...overrides, id: 'player-two' }
        : emptyPlayer('player-two'),
    },
    firstPlayerId: activePlayerId,
    activePlayerId,
    turnNumber: 2,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 3,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
    pendingOnPlay: null,
    pendingRefresh: null,
    pendingBattle: null,
    pendingFaintEffects: undefined,
    pendingOpponentHandDiscard: null,
    pendingInspectDeck: null,
    pendingOptionalCostAttack: undefined,
  }
}

const splitDamageEffect = {
  kind: 'split-damage' as const,
  primaryAmount: 2,
  secondaryAmount: 1,
  target: { side: 'opponent' as const, min: 1, max: 2 },
}

describe('AI split-damage target selection', () => {
  it('selects 2 targets when both can be fainted', () => {
    const item = testItemCard('split-item', [splitDamageEffect])
    const source = testCookieCard('source', { level: 1, hp: 3 })
    const opp1 = testCookieCard('opp-1', { level: 1, hp: 2 })
    const opp2 = testCookieCard('opp-2', { level: 1, hp: 1 })
    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [item],
      battleArea: [
        { card: source, hpCards: [], rested: false, battleEntryId: 'source:battle:1' },
      ],
      supportArea: [{ card: { id: 'sup', instanceId: 'sup', name: 'sup', type: 'item', energyColor: 'red' }, rested: false }],
    })
    state.players['player-one'].battleArea = [
      { card: opp1, hpCards: [{ id: 'hp1', instanceId: 'hp1', name: 'hp1', type: 'item' }], rested: false, battleEntryId: 'opp-1:battle:1' },
      { card: opp2, hpCards: [{ id: 'hp2', instanceId: 'hp2', name: 'hp2', type: 'item' }], rested: false, battleEntryId: 'opp-2:battle:1' },
    ]

    const result = takeAiStep(state, 'player-two')
    expect(result.action).toBe('play-item')

    const selections = result.effectSelections ?? []
    expect(selections.length).toBeGreaterThan(0)
    const targetIds = selections[0].targetIds
    expect(targetIds).toHaveLength(2)
  })

  it('selects 1 target when only primary can faint', () => {
    const item = testItemCard('split-item', [splitDamageEffect])
    const source = testCookieCard('source', { level: 1, hp: 3 })
    const opp1 = testCookieCard('opp-1', { level: 1, hp: 2 })
    const opp2 = testCookieCard('opp-2', { level: 1, hp: 5 })
    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [item],
      battleArea: [
        { card: source, hpCards: [], rested: false, battleEntryId: 'source:battle:1' },
      ],
      supportArea: [{ card: { id: 'sup', instanceId: 'sup', name: 'sup', type: 'item', energyColor: 'red' }, rested: false }],
    })
    state.players['player-one'].battleArea = [
      { card: opp1, hpCards: [{ id: 'hp1', instanceId: 'hp1', name: 'hp1', type: 'item' }], rested: false, battleEntryId: 'opp-1:battle:1' },
      { card: opp2, hpCards: [{ id: 'hp2', instanceId: 'hp2', name: 'hp2', type: 'item' }, { id: 'hp3', instanceId: 'hp3', name: 'hp3', type: 'item' }, { id: 'hp4', instanceId: 'hp4', name: 'hp4', type: 'item' }, { id: 'hp5', instanceId: 'hp5', name: 'hp5', type: 'item' }, { id: 'hp6', instanceId: 'hp6', name: 'hp6', type: 'item' }], rested: false, battleEntryId: 'opp-2:battle:1' },
    ]

    const result = takeAiStep(state, 'player-two')
    expect(result.action).toBe('play-item')

    const selections = result.effectSelections ?? []
    expect(selections.length).toBeGreaterThan(0)
    const targetIds = selections[0].targetIds
    expect(targetIds).toHaveLength(1)
    expect(targetIds).toContain('opp-1')
  })

  it('orders targets to maximize dual faints (primary 2, secondary 1)', () => {
    const item = testItemCard('split-item', [splitDamageEffect])
    const source = testCookieCard('source', { level: 1, hp: 3 })
    const opp1 = testCookieCard('hp1-cookie', { level: 1, hp: 1 })
    const opp2 = testCookieCard('hp2-cookie', { level: 1, hp: 2 })
    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [item],
      battleArea: [
        { card: source, hpCards: [], rested: false, battleEntryId: 'source:battle:1' },
      ],
      supportArea: [{ card: { id: 'sup', instanceId: 'sup', name: 'sup', type: 'item', energyColor: 'red' }, rested: false }],
    })
    state.players['player-one'].battleArea = [
      { card: opp1, hpCards: [{ id: 'hp-a', instanceId: 'hp-a', name: 'hp-a', type: 'item' }], rested: false, battleEntryId: 'hp1-cookie:battle:1' },
      { card: opp2, hpCards: [{ id: 'hp-b', instanceId: 'hp-b', name: 'hp-b', type: 'item' }, { id: 'hp-c', instanceId: 'hp-c', name: 'hp-c', type: 'item' }], rested: false, battleEntryId: 'hp2-cookie:battle:1' },
    ]

    const result = takeAiStep(state, 'player-two')
    expect(result.action).toBe('play-item')

    const selections = result.effectSelections ?? []
    expect(selections.length).toBeGreaterThan(0)
    const targetIds = selections[0].targetIds
    expect(targetIds).toHaveLength(2)
    expect(targetIds[0]).toBe('hp2-cookie')
    expect(targetIds[1]).toBe('hp1-cookie')
  })

  it('selects lowest HP when no faints possible', () => {
    const effect = {
      kind: 'split-damage' as const,
      primaryAmount: 1,
      secondaryAmount: 1,
      target: { side: 'opponent' as const, min: 1, max: 2 },
    }
    const item = testItemCard('split-item', [effect])
    const source = testCookieCard('source', { level: 1, hp: 3 })
    const opp1 = testCookieCard('opp-1', { level: 1, hp: 3 })
    const opp2 = testCookieCard('opp-2', { level: 1, hp: 5 })
    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [item],
      battleArea: [
        { card: source, hpCards: [], rested: false, battleEntryId: 'source:battle:1' },
      ],
      supportArea: [{ card: { id: 'sup', instanceId: 'sup', name: 'sup', type: 'item', energyColor: 'red' }, rested: false }],
    })
    state.players['player-one'].battleArea = [
      { card: opp1, hpCards: [{ id: 'hp1', instanceId: 'hp1', name: 'hp1', type: 'item' }, { id: 'hp2', instanceId: 'hp2', name: 'hp2', type: 'item' }, { id: 'hp3', instanceId: 'hp3', name: 'hp3', type: 'item' }], rested: false, battleEntryId: 'opp-1:battle:1' },
      { card: opp2, hpCards: [{ id: 'hp4', instanceId: 'hp4', name: 'hp4', type: 'item' }, { id: 'hp5', instanceId: 'hp5', name: 'hp5', type: 'item' }, { id: 'hp6', instanceId: 'hp6', name: 'hp6', type: 'item' }, { id: 'hp7', instanceId: 'hp7', name: 'hp7', type: 'item' }, { id: 'hp8', instanceId: 'hp8', name: 'hp8', type: 'item' }], rested: false, battleEntryId: 'opp-2:battle:1' },
    ]

    const result = takeAiStep(state, 'player-two')
    expect(result.action).toBe('play-item')

    const selections = result.effectSelections ?? []
    expect(selections.length).toBeGreaterThan(0)
    const targetIds = selections[0].targetIds
    expect(targetIds).toContain('opp-1')
  })

  it('selects only target when max=1', () => {
    const effect = {
      kind: 'split-damage' as const,
      primaryAmount: 2,
      secondaryAmount: 1,
      target: { side: 'opponent' as const, min: 1, max: 1 },
    }
    const item = testItemCard('split-item', [effect])
    const source = testCookieCard('source', { level: 1, hp: 3 })
    const opp1 = testCookieCard('opp-1', { level: 1, hp: 2 })
    const opp2 = testCookieCard('opp-2', { level: 1, hp: 1 })
    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [item],
      battleArea: [
        { card: source, hpCards: [], rested: false, battleEntryId: 'source:battle:1' },
      ],
      supportArea: [{ card: { id: 'sup', instanceId: 'sup', name: 'sup', type: 'item', energyColor: 'red' }, rested: false }],
    })
    state.players['player-one'].battleArea = [
      { card: opp1, hpCards: [{ id: 'hp1', instanceId: 'hp1', name: 'hp1', type: 'item' }], rested: false, battleEntryId: 'opp-1:battle:1' },
      { card: opp2, hpCards: [{ id: 'hp2', instanceId: 'hp2', name: 'hp2', type: 'item' }], rested: false, battleEntryId: 'opp-2:battle:1' },
    ]

    const result = takeAiStep(state, 'player-two')
    expect(result.action).toBe('play-item')

    const selections = result.effectSelections ?? []
    expect(selections.length).toBeGreaterThan(0)
    const targetIds = selections[0].targetIds
    expect(targetIds).toHaveLength(1)
    expect(targetIds).toContain('opp-1')
  })
})
