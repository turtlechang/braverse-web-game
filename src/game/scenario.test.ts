import { describe, expect, it } from 'vitest'
import {
  buildScenarioState,
  type ScenarioSideConfig,
} from './scenario'

const emptySide = (
  overrides: Partial<ScenarioSideConfig> = {},
): ScenarioSideConfig => ({
  battle: [],
  hand: [],
  breakArea: [],
  supportCount: 0,
  supportColors: [],
  ...overrides,
})

describe('buildScenarioState', () => {
  it('builds a single-card item setup with configured hand, HP, and energy colors', () => {
    const result = buildScenarioState({
      player: emptySide({
        battle: [{ cardNumber: 'BS3-017', hp: 4 }],
        hand: ['BS3-018', 'BS3-020'],
        deck: ['BS3-019', 'BS3-096'],
        supportCount: 3,
        supportColors: ['R', 'N', 'blue'],
      }),
      ai: emptySide({
        battle: [{ cardNumber: 'BS1-009', hp: 3 }],
      }),
    })

    expect(result.errors).toEqual([])
    expect(result.state).not.toBeNull()

    const state = result.state!
    const player = state.players['player-one']
    const opponent = state.players['player-two']

    expect(player.hand.map((card) => card.id)).toEqual(['BS3-018', 'BS3-020'])
    expect(player.deck.slice(0, 2).map((card) => card.id)).toEqual([
      'BS3-019',
      'BS3-096',
    ])
    expect(player.battleArea[0].hpCards).toHaveLength(4)
    expect(player.supportArea.map(({ card }) => card.energyColor)).toEqual([
      'red',
      'wild',
      'blue',
    ])
    expect(opponent.battleArea[0].card.id).toBe('BS1-009')
    expect(opponent.battleArea[0].card.skill?.trigger).toBe('block')
  })

  it('builds explicit support, HP, stage, and discard cards for a reproducible match', () => {
    const result = buildScenarioState({
      player: emptySide({
        battle: [{
          cardNumber: 'BS3-017',
          hpCards: ['BS3-018', 'BS3-020'],
        }],
        hand: ['BS3-018'],
        supportCount: 2,
        supportCards: ['BS3-020'],
        supportColors: ['R'],
        stageCard: 'BS3-096',
        discardPile: ['BS3-019'],
      }),
      ai: emptySide(),
    })

    expect(result.errors).toEqual([])
    expect(result.state).not.toBeNull()

    const player = result.state!.players['player-one']
    expect(player.battleArea[0].hpCards.map((card) => card.id)).toEqual([
      'BS3-018',
      'BS3-020',
    ])
    expect(player.supportArea.map(({ card }) => card.id)).toEqual([
      'BS3-020',
      'scenario-energy-token',
    ])
    expect(player.supportArea.map(({ card }) => card.energyColor)).toEqual([
      'red',
      'red',
    ])
    expect(player.supportArea[1].card.name).toBe('紅色能量（測試用）')
    expect(player.stage?.card.id).toBe('BS3-096')
    expect(player.discardPile.map((card) => card.id)).toEqual(['BS3-019'])
  })

  it('rejects a support card without an energy color', () => {
    const result = buildScenarioState({
      player: emptySide({
        battle: [{ cardNumber: 'BS3-017' }],
        supportCount: 1,
        supportCards: ['P-032'],
      }),
      ai: emptySide(),
    })

    expect(result.state).toBeNull()
    expect(result.errors).toContain('支援區卡片「P-032」沒有可支付的能量顏色。')
  })

  it('fills unspecified support colors with wild energy for compact setups', () => {
    const result = buildScenarioState({
      player: emptySide({
        battle: [{ cardNumber: 'BS3-017' }],
        supportCount: 2,
        supportColors: ['red'],
      }),
      ai: emptySide(),
    })

    expect(result.errors).toEqual([])
    expect(result.state?.players['player-one'].supportArea.map(({ card }) => card.energyColor)).toEqual([
      'red',
      'wild',
    ])
  })

  it('reports unknown configured support colors instead of silently creating wild energy', () => {
    const result = buildScenarioState({
      player: emptySide({
        battle: [{ cardNumber: 'BS3-017' }],
        supportCount: 1,
        supportColors: ['orange'],
      }),
      ai: emptySide(),
    })

    expect(result.state).toBeNull()
    expect(result.errors).toContain('無法辨識支援區能量顏色「orange」。')
  })

  it('builds an isolated EXTRA Deck from official EXTRA card records', () => {
    const result = buildScenarioState({
      player: emptySide({
        battle: [{ cardNumber: 'BS3-017' }],
        extraDeck: ['BS8-005', 'BS8-069'],
      }),
      ai: emptySide({
        extraDeck: ['BS8-090'],
      }),
    })

    expect(result.errors).toEqual([])
    expect(result.state).not.toBeNull()

    const player = result.state!.players['player-one']
    const ai = result.state!.players['player-two']
    expect(player.extraDeck?.map((card) => card.id)).toEqual([
      'BS8-005',
      'BS8-069',
    ])
    expect(ai.extraDeck?.map((card) => card.id)).toEqual(['BS8-090'])
    expect(player.extraDeck?.every((card) => card.type === 'extra')).toBe(true)
    expect(player.extraDeck?.[0].playRequirement).toMatchObject({
      kind: 'cookies-fainted-this-turn-at-least',
      count: 2,
    })
    expect(player.deck.every((card) => card.id !== 'BS8-005')).toBe(true)
  })

  it('rejects non-EXTRA cards and invalid EXTRA Deck limits', () => {
    const nonExtra = buildScenarioState({
      player: emptySide({
        battle: [{ cardNumber: 'BS3-017' }],
        extraDeck: ['BS3-018'],
      }),
      ai: emptySide(),
    })
    expect(nonExtra.state).toBeNull()
    expect(nonExtra.errors).toContain('「BS3-018」不是可放入額外牌組的 EXTRA 餅乾卡。')

    const tooMany = buildScenarioState({
      player: emptySide({
        battle: [{ cardNumber: 'BS3-017' }],
        extraDeck: Array.from({ length: 7 }, () => 'BS8-005'),
      }),
      ai: emptySide(),
    })
    expect(tooMany.state).toBeNull()
    expect(tooMany.errors).toContain('EXTRA Deck 最多只能放入 6 張，目前為 7 張。')
  })
})
