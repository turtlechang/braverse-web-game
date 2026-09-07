import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { getCardPoolEntry } from './card-pool'
import { applyGameCommand } from './commands'
import { executeCardEffect } from './effects'
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
const setup = (variant = 'BS8-050', initialHp = 1) => {
  const base = createBattleState()
  const stage = official(variant, 'stage')
  const target = cookie('BS8-026', 'target')
  const other = cookie('BS8-039', 'other-target')
  const support = official('BS8-037', 'placement-payment')
  const initial: GameState = { ...base, players: { ...base.players,
    'player-one': { ...base.players['player-one'], deck: Array.from({ length: 20 }, (_, index) => official('BS8-046', `opponent-deck-${index}`)) },
    'player-two': { ...base.players['player-two'], hand: [stage], stage: null, battleArea: [], breakArea: [target, other],
      supportArea: [{ card: support, rested: false }], deck: Array.from({ length: 24 }, (_, index) => official('BS8-046', `deck-${index}`)),
      discardPile: [cookie('BS8-037', 'refresh-cookie'), ...Array.from({ length: 6 }, (_, index) => official('BS8-046', `trash-${index}`))],
    },
  } }
  const placement = { kind: 'play-stage' as const, playerId: 'player-two' as const, instanceId: stage.instanceId, paymentIds: [support.instanceId] }
  const placed = applyGameCommand(initial, placement)
  const context = { sourcePlayerId: 'player-two' as const, sourceInstanceId: stage.instanceId }
  const first = executeCardEffect(placed, context, { kind: 'break-to-battle', amount: 1, hpCount: initialHp }, [target.instanceId])
  const state = executeCardEffect(first, context, { kind: 'break-to-battle', amount: 1, hpCount: 1 }, [other.instanceId])
  const command = { kind: 'begin-activate-stage' as const, playerId: 'player-two' as const, paymentIds: [] }
  return { initial, placed, state, stage, target, other, placement, context, command }
}
const resolve = (state: GameState, targetIds: string[]) => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-two', targetIds })
const complete = (state: GameState) => state.pendingAbilityEffect ? resolve(state, []) : state

describe.each(['BS8-050', 'BS8-050@1'])('%s City of Eternal Gold', (variant) => {
  it.each([1, 2])('places for Y1, activates without energy by resting, and resolves initial HP%i in order', (initialHp) => {
    const { initial, placed, state, stage, target, other, command } = setup(variant, initialHp)
    expect(placed.players['player-two'].stage).toMatchObject({ card: stage, rested: false })
    expect(placed.players['player-two'].hand).not.toContainEqual(stage)
    expect(placed.players['player-two'].supportArea[0].rested).toBe(true)
    expect(stage.stageAbility).toMatchObject({ placementCost: { yellow: 1 }, cost: { energy: {} }, restSource: true })
    expect(state.players['player-two'].battleArea[0]).toMatchObject({ enteredFrom: 'break', enteredTurn: state.turnNumber })
    const paid = applyGameCommand(state, command)
    expect(paid.players['player-two'].stage?.rested).toBe(true)
    expect(paid.players['player-two'].supportArea).toEqual(placed.players['player-two'].supportArea)
    const first = resolve(paid, [target.instanceId])
    expect(first.players['player-two'].battleArea[0].hpCards).toHaveLength(initialHp + 1)
    expect(first.players['player-two'].battleArea[1].card).toEqual(other)
    expect(first.players['player-two'].battleArea[1].hpCards).toHaveLength(1)
    const result = complete(first)
    expect(result.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
    expect(result.players['player-two'].battleArea[1].hpCards).toHaveLength(1)
    expect(result.players['player-two'].deck).toHaveLength(state.players['player-two'].deck.length - (initialHp === 1 ? 2 : 1))
    expect(result.pendingAbilityEffect).toBeFalsy()
    expect(() => applyGameCommand(result, command)).toThrow()
    const batch = applyGameCommand(state, { ...command, kind: 'activate-stage', effectTargets: [[target.instanceId], []] })
    expect(batch.players).toEqual(result.players)
    expect(initial.players['player-two'].supportArea[0].rested).toBe(false)
  })

  it('selects zero without HP gain but still rests the stage', () => {
    const { state, command } = setup(variant)
    const result = complete(resolve(applyGameCommand(state, command), []))
    expect(result.players['player-two'].stage?.rested).toBe(true)
    expect(result.players['player-two'].battleArea).toEqual(state.players['player-two'].battleArea)
    expect(result.players['player-two'].deck).toEqual(state.players['player-two'].deck)
    expect(result.pendingAbilityEffect).toBeFalsy()
  })

  it('cannot redirect Then to the other otherwise eligible Cookie', () => {
    const { state, target, other, command } = setup(variant)
    const first = resolve(applyGameCommand(state, command), [target.instanceId])
    expect(first.pendingAbilityEffect).toBeTruthy()
    expect(() => resolve(first, [other.instanceId])).toThrow()
    const result = complete(first)
    expect(result.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
    expect(result.players['player-two'].battleArea[1].hpCards).toHaveLength(1)
  })
})

describe('BS8-050 invalid targets and interruptions', () => {
  it('logs the actual A/B/zero outcome without treating the locked Then as zero selected targets', () => {
    for (const scenario of ['one-hp', 'two-hp', 'zero'] as const) {
      const { state, target, command } = setup('BS8-050', scenario === 'two-hp' ? 2 : 1)
      const paid = applyGameCommand(state, command)
      const first = resolve(paid, scenario === 'zero' ? [] : [target.instanceId])
      const result = complete(first)
      const newLogs = result.commandLog?.slice(state.commandLog?.length ?? 0) ?? []
      const text = newLogs.flatMap((entry) => entry.steps ?? []).map((step) => step.text).join('\n')
      if (scenario === 'one-hp') {
        expect(result.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
        expect(text).toContain(`Then HP 效果結果：同一張「${target.name}」HP 2 → 3。`)
        expect(text).not.toContain('選擇 0 個目標')
      } else if (scenario === 'two-hp') {
        expect(result.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
        expect(text).toContain('Then HP 效果結果：條件不成立，未額外增加 HP。')
        expect(text).not.toContain('選擇 0 個目標')
      } else {
        expect(first.pendingAbilityEffect).toBeFalsy()
        expect(result.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
        expect(text).toContain('選擇 0 個目標')
        expect(text).not.toContain('Then HP 效果結果：')
      }
      expect(result.pendingAbilityEffect).toBeFalsy()
    }
  })

  it('preserves the batch Then across first-gain Refresh and finishes at three HP', () => {
    const { state, target, other, command } = setup()
    const short: GameState = { ...state, players: { ...state.players, 'player-two': { ...state.players['player-two'], deck: state.players['player-two'].deck.slice(0, 1) } } }
    const interrupted = applyGameCommand(short, { ...command, kind: 'activate-stage', effectTargets: [[target.instanceId], []] })
    expect(interrupted.pendingRefresh?.playerId).toBe('player-two')
    expect(interrupted.pendingAbilityEffect).toMatchObject({ effectIndex: 1, previousEffectTargetIds: [target.instanceId] })
    expect(interrupted.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
    const refreshed = applyGameCommand(interrupted, { kind: 'refresh-deck', playerId: 'player-two', cookieInstanceId: 'BS8-037:refresh-cookie', shuffleSeed: 1 })
    const result = complete(refreshed)
    expect(result.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
    expect(result.players['player-two'].battleArea[1].card).toEqual(other)
    expect(result.players['player-two'].battleArea[1].hpCards).toHaveLength(1)
    expect(result.pendingAbilityEffect).toBeFalsy()
    expect(result.pendingRefresh).toBeFalsy()
  })

  it.each(['hand', 'previous-turn', 'level-two', 'opponent'] as const)('rejects %s target', (scenario) => {
    const { placed, state, stage, target, context, command } = setup()
    let prepared = state
    let targetId = target.instanceId
    if (scenario === 'hand') {
      const ready: GameState = { ...placed, players: { ...placed.players, 'player-two': { ...placed.players['player-two'], hand: [target], breakArea: [], supportArea: [0, 1, 2].map((index) => ({ card: official('BS8-037', `hand-entry-support-${index}`), rested: false })) } } }
      prepared = applyGameCommand(ready, { kind: 'deploy-cookie', playerId: 'player-two', instanceId: targetId })
      expect(prepared.players['player-two'].battleArea[0].enteredFrom).toBe('hand')
    } else if (scenario === 'previous-turn') {
      for (let step = 0; step < 24 && !(prepared.turnNumber > state.turnNumber && prepared.activePlayerId === 'player-two' && prepared.phase === 'main'); step += 1) prepared = applyGameCommand(prepared, { kind: 'advance-phase', playerId: prepared.activePlayerId })
      expect(prepared.turnNumber).toBeGreaterThan(state.turnNumber)
      expect(prepared.players['player-two'].stage?.card).toEqual(stage)
    } else if (scenario === 'level-two') {
      const low = cookie('BS8-034', 'low-target')
      const ready: GameState = { ...placed, players: { ...placed.players, 'player-two': { ...placed.players['player-two'], breakArea: [low] } } }
      prepared = executeCardEffect(ready, context, { kind: 'break-to-battle', amount: 1 }, [low.instanceId])
      targetId = low.instanceId
    } else {
      targetId = prepared.players['player-one'].battleArea[0].card.instanceId
    }
    const paid = applyGameCommand(prepared, command)
    expect(() => resolve(paid, [targetId])).toThrow()
  })

  it.each(['missing', 'red'] as const)('rejects %s placement payment', (payment) => {
    const { initial, placement } = setup()
    const red = official('BS8-009', 'red-payment')
    const state: GameState = { ...initial, players: { ...initial.players, 'player-two': { ...initial.players['player-two'], supportArea: payment === 'missing' ? [] : [{ card: red, rested: false }] } } }
    expect(() => applyGameCommand(state, { ...placement, paymentIds: payment === 'missing' ? [] : [red.instanceId] })).toThrow()
    expect(state.players['player-two'].stage).toBeNull()
  })

  it('keeps the same target and evaluates its post-gain HP after Refresh, then gives the extra HP', () => {
    const { state, target, other, command } = setup()
    const short: GameState = { ...state, players: { ...state.players, 'player-two': { ...state.players['player-two'], deck: state.players['player-two'].deck.slice(0, 1) } } }
    const interrupted = resolve(applyGameCommand(short, command), [target.instanceId])
    expect(interrupted.pendingRefresh?.playerId).toBe('player-two')
    expect(interrupted.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
    const refreshed = applyGameCommand(interrupted, { kind: 'refresh-deck', playerId: 'player-two', cookieInstanceId: 'BS8-037:refresh-cookie', shuffleSeed: 1 })
    const result = complete(refreshed)
    expect(result.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
    expect(result.players['player-two'].battleArea[1].card).toEqual(other)
    expect(result.players['player-two'].battleArea[1].hpCards).toHaveLength(1)
    expect(result.pendingAbilityEffect).toBeFalsy()
    expect(result.pendingRefresh).toBeFalsy()
  })
})
