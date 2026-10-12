import { describe, expect, it, vi } from 'vitest'
import { takeAiStep } from './ai'
import { applyGameCommand } from './commands'
import { getLegalTurnCommands } from './legal-actions'
import { maskGameStateForViewer } from './masked-state'
import { forecastOnPlayFollowup } from './ai/evaluated-turn-handler'
import { createSpecialPlayAttackFixture, deployMold, lowerLicorice } from './ai-special-play-attack-test-fixture'
import type { SpecialPlayAttackScenario } from './ai-special-play-attack-test-fixture'
import type { AiStepOptions } from './ai/types'
import type { GameState, PlayerId } from './types'

const options = { level: 5 as const, seed: 2026101203, searchNow: () => 0 }
const winning: SpecialPlayAttackScenario[] = [
  { target: 'ST1-011', supports: 2, fodder: false },
  { target: 'ST1-005', supports: 2, fodder: true },
  { target: 'ST6-006', supports: 3, fodder: true, buddyActive: true },
]
const run = (initial: GameState, shield = false) => {
  let state = initial, memory: AiStepOptions['memory']
  const actions: string[] = []
  for (let step = 0; step < 18 && state.status === 'playing' && state.activePlayerId === 'player-one'; step++) {
    const decision = takeAiStep(state, 'player-one', { ...options, memory })
    expect(decision.action).not.toBe('error')
    actions.push(decision.action)
    if (decision.state === state) break
    state = decision.state; memory = decision.reason?.strategyMemory
    if (state.pendingBattle?.stage === 'trap') {
      const foe = state.players['player-two']
      state = applyGameCommand(state, shield ? {
        kind: 'play-trap', playerId: 'player-two', trapInstanceId: foe.hand[0].instanceId,
        paymentIds: foe.supportArea.map(support => support.card.instanceId),
        targetIds: [state.pendingBattle.attackerInstanceId],
        effectTargets: [[state.pendingBattle.attackerInstanceId]],
      } : { kind: 'skip-trap', playerId: 'player-two' })
    }
    if (state.phase !== 'main' && state.status === 'playing') break
  }
  return { state, actions }
}

describe('Lv5 public Special Play attack continuation', () => {
  it.each(winning)('completes the public line against $target', scenario => {
    const initial = createSpecialPlayAttackFixture(scenario), before = structuredClone(initial)
    const result = run(initial)
    expect(result.actions).toContain('activate-skill')
    expect(result.actions).toContain('deploy-cookie')
    expect(result.actions).toContain('attack')
    expect(result.state.result?.winnerId).toBe('player-one')
    expect(initial).toEqual(before)
  })
  it.each(winning.slice(0, 2))('sees attack payoff after lowering against $target', scenario => {
    const state = lowerLicorice(createSpecialPlayAttackFixture(scenario))
    expect(takeAiStep(state, 'player-one', options).action).toBe('deploy-cookie')
  })
  it.each(winning.slice(0, 2))('preserves actual On Play/payment decisions against $target', scenario => {
    const initial = createSpecialPlayAttackFixture(scenario)
    const state = deployMold(lowerLicorice(initial)), before = structuredClone(state)
    const result = run(state)
    expect(result.state.result?.winnerId).toBe('player-one')
    expect(state).toEqual(before)
  })
  it.each([
    { target: 'ST1-005', supports: 1, fodder: true },
    { target: 'ST1-005', supports: 2, fodder: false },
  ] satisfies SpecialPlayAttackScenario[])('does not invent payoff with $supports supports / fodder=$fodder', scenario => {
    const state = createSpecialPlayAttackFixture(scenario)
    expect(takeAiStep(state, 'player-one', options).action).toBe('advance-phase')
  })
  it('keeps the real opposing Trap response, without treating forecast as a guaranteed win', () => {
    const state = createSpecialPlayAttackFixture({ ...winning[0], shield: true })
    const result = run(state, true)
    expect(result.actions[0]).toBe('activate-skill')
    expect(result.actions).toContain('attack')
    expect(result.state.result).toBeNull()
    expect(result.state.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
    expect(result.state.players['player-two'].discardPile.some(card => card.id === 'ST2-020')).toBe(true)
  })
  it.each(winning)('uses original 60-card positions against $target', scenario => {
    const state = createSpecialPlayAttackFixture(scenario)
    for (const player of Object.values(state.players)) {
      const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea,
        ...player.supportArea.map(support => support.card), ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards])]
      expect(cards).toHaveLength(60)
      expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
      const counts = new Map<string, number>()
      for (const card of cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
      expect([...counts.values()].every(count => count <= 4)).toBe(true)
      for (const source of player.battleArea) expect(source.hpCards).toHaveLength(source.card.hp)
    }
  })
  it.each([
    ...winning,
    { target: 'ST1-005', supports: 1, fodder: true },
    { target: 'ST1-005', supports: 2, fodder: false },
    { target: 'ST1-011', supports: 2, fodder: false, shield: true },
  ] satisfies SpecialPlayAttackScenario[])('does not use hidden faces against $target with $supports supports', scenario => {
    const initial = createSpecialPlayAttackFixture(scenario)
    const masked = maskGameStateForViewer(initial, 'player-one')
    const actual = takeAiStep(initial, 'player-one', options)
    const hidden = takeAiStep(masked, 'player-one', options)
    expect(hidden.action).toBe(actual.action)
    expect(hidden.state.commandLog?.at(-1)?.payload).toEqual(actual.state.commandLog?.at(-1)?.payload)
  })
  it('forecasts only masked state while preserving real On Play, HP and payment resources', () => {
    const lowered = lowerLicorice(createSpecialPlayAttackFixture(winning[1]))
    const command = getLegalTurnCommands(lowered, 'player-one').find(command =>
      command.kind === 'deploy-cookie' && command.specialPlayCookieInstanceIds?.length,
    )
    if (!command) throw new Error('Missing actual Special Play')
    const deployed = applyGameCommand(lowered, command), before = structuredClone(deployed)
    const resolve = vi.fn((forecast: GameState, playerId: PlayerId) => {
      for (const player of Object.values(forecast.players)) {
        expect(player.deck.every(card => card.id === 'hidden')).toBe(true)
        expect(player.battleArea.every(source => source.hpCards.every(card => card.id === 'hidden'))).toBe(true)
      }
      return takeAiStep(forecast, playerId, options)
    })
    expect(forecastOnPlayFollowup(deployed, 'player-one', command, resolve, lowered)?.amount).toBeGreaterThan(200)
    expect(resolve).toHaveBeenCalled()
    expect(deployed).toEqual(before)
    expect(deployed.pendingOnPlay).not.toBeNull()
    expect(deployed.players['player-one'].hand).toHaveLength(1)
    expect(deployed.players['player-one'].supportArea.every(support => !support.rested)).toBe(true)
    expect(deployed.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
  })
})
