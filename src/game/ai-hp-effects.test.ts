import { describe, expect, it } from 'vitest'
import { takeAiStep } from './ai'
import type {
  CardEffect,
  CardSkill,
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

const createBattleCookie = (
  instanceId: string,
  level: number,
  hp: number,
): {
  card: CookieCard
  hpCards: GameCard[]
  rested: boolean
  battleEntryId: string
} => ({
  card: testCookieCard(instanceId, { level, hp }),
  hpCards: Array.from({ length: hp }, (_, i) => ({
    id: `${instanceId}-hp${i}`,
    instanceId: `${instanceId}-hp${i}`,
    name: `${instanceId}-hp${i}`,
    type: 'item' as const,
  })),
  rested: false,
  battleEntryId: `${instanceId}:battle:1`,
})

describe('AI hp-to-trash target selection', () => {
  it('self: selects cookie with most HP cards', () => {
    const effect: CardEffect = {
      kind: 'hp-to-trash',
      amount: 1,
      target: { side: 'self', min: 1, max: 1 },
    }
    const item = testItemCard('hp-trash-item', [effect])
    const source = testCookieCard('source', { level: 1, hp: 3 })
    const selfLow = createBattleCookie('self-low', 1, 1)
    const selfHigh = createBattleCookie('self-high', 1, 3)
    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [item],
      battleArea: [
        { card: source, hpCards: [], rested: false, battleEntryId: 'source:battle:1' },
        selfLow,
        selfHigh,
      ],
      supportArea: [{ card: { id: 'sup', instanceId: 'sup', name: 'sup', type: 'item', energyColor: 'red' }, rested: false }],
    })

    const result = takeAiStep(state, 'player-two')
    expect(result.action).toBe('play-item')
    const selections = result.effectSelections ?? []
    expect(selections.length).toBeGreaterThan(0)
    expect(selections[0].targetIds).toContain('self-high')
  })

  it('opponent: selects faintable cookie first', () => {
    const effect: CardEffect = {
      kind: 'hp-to-trash',
      amount: 2,
      target: { side: 'opponent', min: 1, max: 1 },
    }
    const item = testItemCard('hp-trash-item', [effect])
    const source = testCookieCard('source', { level: 1, hp: 3 })
    const oppTough = createBattleCookie('opp-tough', 1, 5)
    const oppWeak = createBattleCookie('opp-weak', 1, 2)
    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [item],
      battleArea: [
        { card: source, hpCards: [], rested: false, battleEntryId: 'source:battle:1' },
      ],
      supportArea: [{ card: { id: 'sup', instanceId: 'sup', name: 'sup', type: 'item', energyColor: 'red' }, rested: false }],
    })
    state.players['player-one'].battleArea = [oppTough, oppWeak]

    const result = takeAiStep(state, 'player-two')
    expect(result.action).toBe('play-item')
    const selections = result.effectSelections ?? []
    expect(selections.length).toBeGreaterThan(0)
    expect(selections[0].targetIds).toContain('opp-weak')
  })

  it('opponent: selects lowest HP when no faintable', () => {
    const effect: CardEffect = {
      kind: 'hp-to-trash',
      amount: 1,
      target: { side: 'opponent', min: 1, max: 1 },
    }
    const item = testItemCard('hp-trash-item', [effect])
    const source = testCookieCard('source', { level: 1, hp: 3 })
    const opp1 = createBattleCookie('opp-1', 1, 3)
    const opp2 = createBattleCookie('opp-2', 1, 5)
    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [item],
      battleArea: [
        { card: source, hpCards: [], rested: false, battleEntryId: 'source:battle:1' },
      ],
      supportArea: [{ card: { id: 'sup', instanceId: 'sup', name: 'sup', type: 'item', energyColor: 'red' }, rested: false }],
    })
    state.players['player-one'].battleArea = [opp1, opp2]

    const result = takeAiStep(state, 'player-two')
    expect(result.action).toBe('play-item')
    const selections = result.effectSelections ?? []
    expect(selections.length).toBeGreaterThan(0)
    expect(selections[0].targetIds).toContain('opp-1')
  })
})

describe('AI hp-to-support target selection', () => {
  it('selects cookie with most HP cards', () => {
    const effect: CardEffect = {
      kind: 'hp-to-support',
      amount: 1,
      target: { side: 'self', min: 1, max: 1 },
    }
    const item = testItemCard('hp-support-item', [effect])
    const source = testCookieCard('source', { level: 1, hp: 3 })
    const selfLow = createBattleCookie('self-low', 1, 1)
    const selfHigh = createBattleCookie('self-high', 1, 3)
    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [item],
      battleArea: [
        { card: source, hpCards: [], rested: false, battleEntryId: 'source:battle:1' },
        selfLow,
        selfHigh,
      ],
      supportArea: [{ card: { id: 'sup', instanceId: 'sup', name: 'sup', type: 'item', energyColor: 'red' }, rested: false }],
    })

    const result = takeAiStep(state, 'player-two')
    expect(result.action).toBe('play-item')
    const selections = result.effectSelections ?? []
    expect(selections.length).toBeGreaterThan(0)
    expect(selections[0].targetIds).toContain('self-high')
  })
})

describe('AI disable-flip target selection', () => {
  it('selects highest LV opponent cookie', () => {
    const effect: CardEffect = {
      kind: 'disable-flip',
      duration: 'this-turn',
      target: { side: 'opponent', min: 1, max: 1 },
    }
    const item = testItemCard('disable-flip-item', [effect])
    const source = testCookieCard('source', { level: 1, hp: 3 })
    const oppLow = createBattleCookie('opp-low', 1, 3)
    const oppHigh = createBattleCookie('opp-high', 3, 3)
    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [item],
      battleArea: [
        { card: source, hpCards: [], rested: false, battleEntryId: 'source:battle:1' },
      ],
      supportArea: [{ card: { id: 'sup', instanceId: 'sup', name: 'sup', type: 'item', energyColor: 'red' }, rested: false }],
    })
    state.players['player-one'].battleArea = [oppLow, oppHigh]

    const result = takeAiStep(state, 'player-two')
    expect(result.action).toBe('play-item')
    const selections = result.effectSelections ?? []
    expect(selections.length).toBeGreaterThan(0)
    expect(selections[0].targetIds).toContain('opp-high')
  })
})

describe('AI disable-attack target selection', () => {
  it('selects highest attack opponent cookie', () => {
    const effect: CardEffect = {
      kind: 'disable-attack',
      duration: 'this-turn',
      target: { side: 'opponent', min: 1, max: 1 },
    }
    const item = testItemCard('disable-attack-item', [effect])
    const source = testCookieCard('source', { level: 1, hp: 3 })
    const oppWeak = testCookieCard('opp-weak', { level: 1, hp: 3, attack: 1 })
    const oppStrong = testCookieCard('opp-strong', { level: 1, hp: 3, attack: 5 })
    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [item],
      battleArea: [
        { card: source, hpCards: [], rested: false, battleEntryId: 'source:battle:1' },
      ],
      supportArea: [{ card: { id: 'sup', instanceId: 'sup', name: 'sup', type: 'item', energyColor: 'red' }, rested: false }],
    })
    state.players['player-one'].battleArea = [
      { card: oppWeak, hpCards: [], rested: false, battleEntryId: 'opp-weak:battle:1' },
      { card: oppStrong, hpCards: [], rested: false, battleEntryId: 'opp-strong:battle:1' },
    ]

    const result = takeAiStep(state, 'player-two')
    expect(result.action).toBe('play-item')
    const selections = result.effectSelections ?? []
    expect(selections.length).toBeGreaterThan(0)
    expect(selections[0].targetIds).toContain('opp-strong')
  })
})

describe('AI battle-to-support target selection', () => {
  it('selects lowest HP self cookie', () => {
    const effect: CardEffect = {
      kind: 'battle-to-support',
      target: { side: 'self', min: 1, max: 1 },
    }
    const item = testItemCard('battle-support-item', [effect])
    const selfLow = createBattleCookie('self-low', 1, 1)
    const selfHigh = createBattleCookie('self-high', 1, 3)
    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [item],
      battleArea: [
        selfLow,
        selfHigh,
      ],
      supportArea: [{ card: { id: 'sup', instanceId: 'sup', name: 'sup', type: 'item', energyColor: 'red' }, rested: false }],
    })

    const result = takeAiStep(state, 'player-two')
    expect(result.action).toBe('play-item')
    const selections = result.effectSelections ?? []
    expect(selections.length).toBeGreaterThan(0)
    expect(selections[0].targetIds).toContain('self-low')
  })
})

describe('AI prevent-effect-damage target selection', () => {
  it('selects source cookie via Activate skill (sourceOnly)', () => {
    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: {}, discardHand: 0 },
      text: 'Activate: prevent effect damage',
      effects: [
        {
          kind: 'prevent-effect-damage',
          duration: 'until-source-next-turn',
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        },
      ],
    }
    const source = testCookieCard('bs2-022', { level: 1, hp: 3 })
    source.skill = skill
    const selfOther = createBattleCookie('self-other', 1, 2)
    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [],
      battleArea: [
        { card: source, hpCards: [], rested: false, battleEntryId: 'bs2-022:battle:1' },
        selfOther,
      ],
      supportArea: [],
    })

    const result = takeAiStep(state, 'player-two')
    expect(result.action).toBe('activate-skill')
    expect(result.description).toContain('bs2-022')
    const selections = result.effectSelections ?? []
    expect(selections.length).toBeGreaterThan(0)
    expect(selections[0].targetIds).toContain('bs2-022')
    expect(selections[0].targetIds).not.toContain('self-other')
  })
})
