import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { getCardPoolEntry } from './card-pool'
import { applyGameCommand } from './commands'
import { getCookieEffectiveHp } from './helpers'
import { createBattleState } from './test-helpers/battle-helpers'
import type { GameCard, GameState } from './types'

const official = (id: string, suffix: string): GameCard => {
  const entry = getCardPoolEntry(id)
  if (!entry) throw new Error(`Missing ${id}`)
  const result = convertOfficialCardToGameCard(entry)
  if (result.status !== 'converted') throw new Error(`Unconverted ${id}`)
  return { ...result.gameCard, instanceId: `${id}:${suffix}` }
}
const cookie = (id: string, suffix: string) => {
  const card = official(id, suffix)
  if (card.type !== 'cookie') throw new Error(`Expected Cookie ${id}`)
  return card
}
const setup = (hp = 1, bonus = false) => {
  const base = createBattleState()
  const stage = official('BS8-049', 'stage')
  const target = cookie('BS8-039', 'target')
  const opponent = cookie('BS8-034', 'opponent')
  const supports = Array.from({ length: 4 }, (_, index) => official('BS8-037', `support-${index}`))
  const state: GameState = { ...base, players: { ...base.players,
    'player-two': { ...base.players['player-two'], hand: [stage],
      battleArea: [{ card: target, hpCards: Array.from({ length: hp }, (_, index) => official(bonus ? 'BS8-036' : 'BS8-046', `target-hp-${index}`)), rested: false }],
      supportArea: supports.map((card) => ({ card, rested: false })),
      deck: Array.from({ length: 10 }, (_, index) => official('BS8-046', `owner-deck-${index}`)),
    },
    'player-one': { ...base.players['player-one'],
      battleArea: [{ card: opponent, hpCards: [official('BS8-046', 'opponent-hp')], rested: false }],
      deck: Array.from({ length: 10 }, (_, index) => official('BS8-046', `opponent-deck-${index}`)),
    },
  } }
  const placement = { kind: 'play-stage' as const, playerId: 'player-two' as const, instanceId: stage.instanceId, paymentIds: supports.slice(0, 2).map((card) => card.instanceId) }
  return { state, stage, target, opponent, supports, placement }
}
const activate = (state: GameState, targetIds: string[], kind: 'activate-stage' | 'begin-activate-stage' = 'activate-stage') =>
  applyGameCommand(state, {
    kind, playerId: 'player-two', paymentIds: [state.players['player-two'].supportArea[2].card.instanceId],
    ...(kind === 'activate-stage' ? { effectTargets: [targetIds] } : { targetIds }),
  })

describe('BS8-049 Simmering Lassi Springs stage costs and exact effective HP', () => {
  it('places the real Stage for Y2 without activating or resting it', () => {
    const { state, stage, placement } = setup()
    expect(stage.stageAbility).toMatchObject({ placementCost: { yellow: 2 }, cost: { energy: { yellow: 1 } }, restSource: true })
    expect(stage.stageAbility?.effects).toEqual([{ kind: 'gain-hp', amount: 1, target: { side: 'self', min: 0, max: 1, minRemainingHp: 1, maxRemainingHp: 1 } }])
    expect(() => applyGameCommand(state, { ...placement, paymentIds: placement.paymentIds.slice(0, 1) })).toThrow()
    const placed = applyGameCommand(state, placement)
    expect(placed.players['player-two'].stage).toEqual({ card: stage, rested: false })
    expect(placed.players['player-two'].hand).toEqual([])
    expect(placed.players['player-two'].supportArea.map((entry) => entry.rested)).toEqual([true, true, false, false])
    expect(placed.players['player-two'].battleArea).toEqual(state.players['player-two'].battleArea)
    expect(placed.players['player-two'].deck).toEqual(state.players['player-two'].deck)
  })

  it.each(['activate-stage', 'begin-activate-stage'] as const)('%s pays another Y1 and rests the Stage to add one real HP card', (kind) => {
    const { state, stage, target, placement } = setup()
    const placed = applyGameCommand(state, placement)
    const result = activate(placed, [target.instanceId], kind)
    expect(result.players['player-two'].stage).toEqual({ card: stage, rested: true })
    expect(result.players['player-two'].battleArea[0].hpCards).toEqual([...placed.players['player-two'].battleArea[0].hpCards, placed.players['player-two'].deck[0]])
    expect(getCookieEffectiveHp(result.players['player-two'].battleArea[0])).toBe(2)
    expect(result.players['player-two'].deck).toEqual(placed.players['player-two'].deck.slice(1))
    expect(result.players['player-two'].supportArea.map((entry) => entry.rested)).toEqual([true, true, true, false])
    expect(result.players['player-one']).toEqual(placed.players['player-one'])
    expect(result.pendingAbilityEffect).toBeFalsy()
    expect(() => applyGameCommand(result, { kind: 'activate-stage', playerId: 'player-two', paymentIds: [result.players['player-two'].supportArea[3].card.instanceId], effectTargets: [[]] })).toThrow()
  })

  it.each([1, 2])('may choose zero at effective HP%i while still paying and resting the Stage', (hp) => {
    const { state, stage, placement } = setup(hp)
    const placed = applyGameCommand(state, placement)
    const result = activate(placed, [])
    expect(result.players['player-two'].stage).toEqual({ card: stage, rested: true })
    expect(result.players['player-two'].supportArea[2].rested).toBe(true)
    expect(result.players['player-two'].battleArea).toEqual(placed.players['player-two'].battleArea)
    expect(result.players['player-two'].deck).toEqual(placed.players['player-two'].deck)
  })

  it('accepts one physical HP containing an unrevealed gain-HP FLIP', () => {
    const { state, target, placement } = setup(1, true)
    const placed = applyGameCommand(state, placement)
    expect(getCookieEffectiveHp(placed.players['player-two'].battleArea[0])).toBe(1)
    const result = activate(placed, [target.instanceId])
    expect(result.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
    expect(result.players['player-two'].supportArea[2].rested).toBe(true)
    expect(result.players['player-two'].stage?.rested).toBe(true)
  })

  it.each(['hp-two', 'opponent', 'duplicate', 'unknown'] as const)('rejects %s targets without changing the input state', (scenario) => {
    const { state, target, opponent, placement } = setup(scenario === 'hp-two' ? 2 : 1)
    const placed = applyGameCommand(state, placement)
    const targetIds = scenario === 'opponent' ? [opponent.instanceId] : scenario === 'duplicate' ? [target.instanceId, target.instanceId] : scenario === 'unknown' ? ['missing'] : [target.instanceId]
    const snapshot = structuredClone(placed)
    expect(() => activate(placed, targetIds)).toThrow()
    expect(placed).toEqual(snapshot)
  })

  it.each(['wrong-color', 'rested', 'missing'] as const)('rejects %s activation payment even for zero targets', (scenario) => {
    const { state, placement } = setup()
    const placed = applyGameCommand(state, placement)
    const support = placed.players['player-two'].supportArea[2]
    const modified: GameState = { ...placed, players: { ...placed.players, 'player-two': { ...placed.players['player-two'],
      supportArea: placed.players['player-two'].supportArea.map((entry, index) => index === 2 ? { ...entry, rested: scenario === 'rested', card: scenario === 'wrong-color' ? { ...entry.card, energyColor: 'red' } : entry.card } : entry),
    } } }
    expect(() => applyGameCommand(modified, { kind: 'activate-stage', playerId: 'player-two', paymentIds: scenario === 'missing' ? [] : [support.card.instanceId], effectTargets: [[]] })).toThrow()
    expect(modified.players['player-two'].stage?.rested).toBe(false)
  })

  it('rejects activation outside the owner main phase and restores the Stage on the next owner turn', () => {
    const { state, placement } = setup()
    const placed = applyGameCommand(state, placement)
    expect(() => activate({ ...placed, activePlayerId: 'player-one' }, [])).toThrow()
    expect(() => activate({ ...placed, phase: 'support' }, [])).toThrow()
    let result = activate(placed, [])
    for (let step = 0; step < 16 && !(result.turnNumber > placed.turnNumber && result.activePlayerId === 'player-two' && result.phase === 'main'); step += 1) {
      result = applyGameCommand(result, { kind: 'advance-phase', playerId: result.activePlayerId })
    }
    expect(result.turnNumber).toBeGreaterThan(placed.turnNumber)
    expect(result.activePlayerId).toBe('player-two')
    expect(result.phase).toBe('main')
    expect(result.players['player-two'].stage?.rested).toBe(false)
    expect(result.players['player-two'].supportArea[2].rested).toBe(false)
    expect(activate(result, []).players['player-two'].stage?.rested).toBe(true)
  })
})
