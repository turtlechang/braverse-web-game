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
})
