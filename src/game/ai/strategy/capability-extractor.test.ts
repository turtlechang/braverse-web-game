import { describe, expect, it } from 'vitest'
import type { CardEffect, CardSkill, GameCard } from '../../types'
import { getAllCardPoolEntries } from '../../card-pool'
import { createCard } from '../../starter-deck'
import { extractCardCapabilities, extractDeckCapabilities } from './capability-extractor'
import { createStrategyShadowReport, deriveDeckStrategyProfile } from './deck-profile'
import { buildSynergyGraph } from './synergy-graph'

const skill = (effects: CardEffect[]): CardSkill => ({
  trigger: 'activate',
  oncePerTurn: false,
  yourTurn: true,
  restSource: false,
  cost: { energy: { green: 1 } },
  text: 'display text must not be parsed',
  effects,
})

const cookie = (
  id: string,
  effects: CardEffect[] = [],
  overrides: Partial<GameCard> = {},
): GameCard => ({
  id,
  instanceId: `${id}-instance`,
  name: 'identical visible name',
  type: 'cookie',
  level: 2,
  hp: 3,
  attack: 2,
  attackCost: 1,
  skill: skill(effects),
  ...overrides,
})

const opponentTarget = { side: 'opponent' as const, min: 1, max: 1 }
const selfTarget = { side: 'self' as const, min: 1, max: 1 }

describe('extractCardCapabilities', () => {
  it('只從結構化 effect、cost、timing 與 target 擷取必要能力', () => {
    const card = cookie('fixture-structured', [
      {
        kind: 'damage',
        amount: 2,
        target: opponentTarget,
        condition: { kind: 'support-count-at-least', count: 2 },
      },
      { kind: 'hand-to-support', amount: 1 },
      { kind: 'trash-to-battle', amount: 1 },
      {
        kind: 'inspect-deck',
        lookCount: 2,
        pickCount: 1,
        restDestination: 'bottom',
        pickDestination: 'battle',
      },
      { kind: 'rest-support', side: 'opponent', amount: 1 },
      { kind: 'set-active', supportCount: 1 },
      { kind: 'gain-hp', amount: 1, target: selfTarget },
    ], {
      flip: { text: 'not parsed', cost: {}, effects: [] },
    })
    const model = extractCardCapabilities(card)

    expect(model.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'damage',
        source: 'skill',
        timing: 'activate',
        effectKind: 'damage',
        target: { side: 'opponent', min: 1, max: 1 },
        conditionKinds: ['support-count-at-least'],
        certainty: 'conditional',
      }),
      expect.objectContaining({ kind: 'move', sourceZone: 'hand', destinationZone: 'support' }),
      expect.objectContaining({ kind: 'deploy', sourceZone: 'trash', destinationZone: 'battle' }),
      expect.objectContaining({ kind: 'inspect-deck', destinationZone: 'deck-bottom' }),
      expect.objectContaining({ kind: 'deploy', sourceZone: 'deck', destinationZone: 'battle' }),
      expect.objectContaining({ kind: 'rest' }),
      expect.objectContaining({ kind: 'set-active' }),
      expect.objectContaining({ kind: 'gain-hp' }),
      expect.objectContaining({ kind: 'flip', source: 'flip', timing: 'flip' }),
      expect.objectContaining({
        kind: 'conditional-payoff',
        strategyTags: expect.arrayContaining(['support']),
      }),
    ]))
    expect(model.capabilities.find((entry) => entry.kind === 'damage')?.cost).toEqual({
      energy: { green: 1 },
    })
  })

  it('辨識 block、trap 與牌庫頂移動等非攻擊標記', () => {
    const blocker = cookie('fixture-block', [{
      kind: 'redirect-attack',
      target: selfTarget,
    }], {
      skill: { ...skill([]), trigger: 'block' },
    })
    const topMove = cookie('fixture-top-move', [{
      kind: 'battle-to-deck-top',
      target: opponentTarget,
    }])
    const trap: GameCard = {
      id: 'fixture-trap',
      instanceId: 'fixture-trap-instance',
      name: 'identical visible name',
      type: 'trap',
      trap: {
        text: 'display text must not be parsed',
        cost: { energy: { blue: 1 } },
        effects: [{ kind: 'disable-attack', duration: 'this-turn', target: opponentTarget }],
      },
    }

    expect(extractCardCapabilities(blocker).capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'block', effectKind: null }),
    ]))
    expect(extractCardCapabilities(topMove).capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'move', destinationZone: 'deck-top' }),
    ]))
    expect(extractCardCapabilities(trap).capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'trap', source: 'trap' }),
    ]))
  })

  it('展開 choose-one 與 optional-cost 的內層結構，而非讀取顯示文字', () => {
    const card = cookie('fixture-nested', [
      {
        kind: 'choose-one',
        modes: [
          { label: 'display-only-one', effects: [{ kind: 'draw-up-to', max: 1 }] },
          { label: 'display-only-two', effects: [{ kind: 'damage', amount: 1, target: opponentTarget }] },
        ],
      },
      {
        kind: 'optional-cost-attack',
        cost: { energy: { red: 1 } },
        effectText: 'display-only',
        effects: [{ kind: 'hand-to-battle', amount: 1 }],
      },
    ])
    const capabilities = extractCardCapabilities(card).capabilities

    expect(capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'draw', effectPath: [0, 0, 0] }),
      expect.objectContaining({ kind: 'damage', effectPath: [0, 1, 0] }),
      expect.objectContaining({
        kind: 'deploy',
        sourceZone: 'hand',
        destinationZone: 'battle',
        cost: { energy: { red: 1 } },
      }),
    ]))
  })

  it('具 timing／cost 的能力來源優先於展示用 card.effects，避免雙重計數', () => {
    const damage: CardEffect = { kind: 'damage', amount: 1, target: opponentTarget }
    const card = cookie('fixture-typed-source', [damage], { effects: [damage] })
    const damageCapabilities = extractCardCapabilities(card).capabilities
      .filter((entry) => entry.kind === 'damage')

    expect(damageCapabilities).toEqual([
      expect.objectContaining({ source: 'skill', timing: 'activate' }),
    ])
  })

  it('同名但 card.id 不同的卡只會依各自的結構化效果分類', () => {
    const drawCard = cookie('fixture-draw', [{ kind: 'draw-up-to', max: 1 }])
    const damageCard = cookie('fixture-damage', [{ kind: 'damage', amount: 1, target: opponentTarget }])

    expect(drawCard.name).toBe(damageCard.name)
    expect(extractCardCapabilities(drawCard).capabilities.map((entry) => entry.kind)).toContain('draw')
    expect(extractCardCapabilities(drawCard).capabilities.map((entry) => entry.kind)).not.toContain('damage')
    expect(extractCardCapabilities(damageCard).capabilities.map((entry) => entry.kind)).toContain('damage')
  })

  it('未知效果保守標記為 unsupported，並透過 shadow telemetry 輸出', () => {
    const unknown = { kind: 'fixture-unknown-effect' } as unknown as CardEffect
    const card = cookie('fixture-unknown', [unknown])
    const report = createStrategyShadowReport([card])

    expect(report.cards[0].capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'unsupported',
        effectKind: 'fixture-unknown-effect',
        certainty: 'unsupported',
      }),
    ]))
    expect(report.telemetry).toEqual({
      unsupportedEffectKinds: { 'fixture-unknown-effect': 1 },
      unsupportedCardIds: ['fixture-unknown'],
    })
    expect(report.deckProfile.unsupportedEffectCount).toBe(1)
  })
})

describe('DeckStrategyProfile and synergy graph shadow mode', () => {
  const supportSetup = cookie('fixture-support-setup', [
    { kind: 'hand-to-support', amount: 1 },
  ])
  const supportPayoff = cookie('fixture-support-payoff', [
    {
      kind: 'damage',
      amount: 2,
      target: opponentTarget,
      condition: { kind: 'support-count-at-least', count: 2 },
    },
  ])
  const deckOrder = cookie('fixture-deck-order', [
    { kind: 'field-to-deck-bottom', target: opponentTarget },
    {
      kind: 'inspect-deck',
      lookCount: 2,
      pickCount: 1,
      restDestination: 'bottom',
    },
  ])
  const trashCycle = cookie('fixture-trash-cycle', [
    { kind: 'deck-to-trash', amount: 1, side: 'self' },
    { kind: 'trash-to-hand', max: 1 },
  ])
  const activeRest = cookie('fixture-active-rest', [
    { kind: 'rest-support', side: 'opponent', amount: 1 },
    { kind: 'set-active', supportCount: 1 },
  ])
  const durableHand = cookie('fixture-durable-hand', [
    { kind: 'gain-hp', amount: 1, target: selfTarget },
    {
      kind: 'draw-up-to',
      max: 1,
      condition: { kind: 'hand-count-at-least', count: 3 },
    },
  ])

  const cards = [supportSetup, supportPayoff, deckOrder, trashCycle, activeRest, durableHand]

  it('從六種能力分布推導連續權重，而不是套用牌組名稱或彈數', () => {
    const profile = deriveDeckStrategyProfile(extractDeckCapabilities(cards))

    expect(profile.cardCount).toBe(cards.length)
    expect(profile.axes.aggression.value).toBeGreaterThan(0)
    expect(profile.axes.control.value).toBeGreaterThan(0)
    expect(profile.axes['effect-damage'].value).toBeGreaterThan(0)
    expect(profile.axes['support-engine'].value).toBeGreaterThan(0)
    expect(profile.axes['deck-order-engine'].value).toBeGreaterThan(0)
    expect(profile.axes['trash-cycle'].value).toBeGreaterThan(0)
    expect(profile.axes['active-rest-chain'].value).toBeGreaterThan(0)
    expect(profile.axes['hand-threshold'].value).toBeGreaterThan(0)
    expect(profile.axes.durability.value).toBeGreaterThan(0)
    expect(profile.axes['setup-payoff'].value).toBeGreaterThan(0)
  })

  it('以條件與結構化 setup evidence 連接 setup → payoff', () => {
    const graph = buildSynergyGraph(extractDeckCapabilities([supportSetup, supportPayoff]))

    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        setup: expect.objectContaining({ cardId: 'fixture-support-setup' }),
        payoff: expect.objectContaining({ cardId: 'fixture-support-payoff' }),
        sharedTags: ['support'],
      }),
    ]))
    expect(graph.unresolvedPayoffs).toEqual([])
  })

  it('shadow report deterministic，且沒有接入 AI 行動', () => {
    const first = createStrategyShadowReport(cards)
    const second = createStrategyShadowReport(cards)

    expect(second).toEqual(first)
    expect(first.cards.map((card) => card.cardId)).toEqual(cards.map((card) => card.id))
  })

  it('正式卡池的 shadow scan 可重現，且所有未知效果都經 telemetry 記錄', () => {
    const runtimeCards = getAllCardPoolEntries().map((entry, index) =>
      createCard(entry, 'player-one', index + 1),
    )
    const first = createStrategyShadowReport(runtimeCards)
    const second = createStrategyShadowReport(runtimeCards)
    const telemetryTotal = Object.values(first.telemetry.unsupportedEffectKinds)
      .reduce((total, count) => total + count, 0)

    expect(first.cards).toHaveLength(runtimeCards.length)
    expect(second).toEqual(first)
    expect(telemetryTotal).toBe(first.deckProfile.unsupportedEffectCount)
  })
})
