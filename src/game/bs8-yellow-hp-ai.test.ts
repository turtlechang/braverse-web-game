import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { takeAiStep } from './ai'
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

const setup = (stageId: 'BS8-049' | 'BS8-050', initialHp: number, eligible = true) => {
  const base = createBattleState()
  const stage = official(stageId, 'stage')
  // A non-LV3 Cookie without another Activate option isolates the Stage decision.
  const target = official(eligible ? 'BS8-026' : 'BS8-040', 'target')
  if (target.type !== 'cookie') throw new Error('Expected a Cookie target')
  const supports = Array.from({ length: 3 }, (_, index) => official('BS8-037', `support-${index}`))
  const initial: GameState = {
    ...base,
    // The baseline AI considers Stage activation on the non-attacking first turn.
    firstPlayerId: 'player-two',
    turnNumber: 1,
    players: {
      ...base.players,
      'player-two': {
        ...base.players['player-two'],
        hand: [stage],
        battleArea: [],
        breakArea: [target],
        supportArea: supports.map((card) => ({ card, rested: false })),
        deck: Array.from({ length: 20 }, (_, index) => official('BS8-046', `deck-${index}`)),
      },
    },
  }
  const placed = applyGameCommand(initial, {
    kind: 'play-stage', playerId: 'player-two', instanceId: stage.instanceId,
    paymentIds: supports.slice(0, stageId === 'BS8-049' ? 2 : 1).map((card) => card.instanceId),
  })
  const state = executeCardEffect(placed, {
    sourcePlayerId: 'player-two', sourceInstanceId: stage.instanceId,
  }, { kind: 'break-to-battle', amount: 1, hpCount: initialHp }, [target.instanceId])
  return { state, stage, target }
}

describe.each([2, 3] as const)('BS8 targeted HP effects through actual AI Lv.%i commands', (level) => {
  it.each([1, 2])('050 selects the legal Cookie at HP%i and completes its locked Then at HP3', (initialHp) => {
    const { state, stage, target } = setup('BS8-050', initialHp)
    const result = takeAiStep(state, 'player-two', { level, seed: 1 })
    expect(result.action).toBe('activate-stage')
    expect(result.effectSelections?.[0].targetIds).toEqual([target.instanceId])
    expect(result.state.players['player-two'].stage).toEqual({ card: stage, rested: true })
    expect(result.state.players['player-two'].battleArea[0].hpCards).toEqual([
      ...state.players['player-two'].battleArea[0].hpCards,
      ...state.players['player-two'].deck.slice(0, 3 - initialHp),
    ])
    expect(result.state.players['player-two'].deck).toEqual(state.players['player-two'].deck.slice(3 - initialHp))
    expect(result.state.pendingAbilityEffect).toBeFalsy()
    expect(result.state.players['player-one']).toEqual(state.players['player-one'])
    expect(state.players['player-two'].stage?.rested).toBe(false)
    // The simulator only supplies the first selection; the authoritative
    // command must still expand Then and inherit the original target.
    const batch = applyGameCommand(state, {
      kind: 'activate-stage', playerId: 'player-two', paymentIds: [],
      effectTargets: [[target.instanceId]],
    })
    expect(result.state.players).toEqual(batch.players)
  })

  it('050 with no legal LV3 target chooses zero, rests, and does not create Then', () => {
    const { state, stage } = setup('BS8-050', 1, false)
    const result = takeAiStep(state, 'player-two', { level, seed: 1 })
    expect(result.action).toBe('activate-stage')
    expect(result.effectSelections?.[0].targetIds).toEqual([])
    expect(result.state.players['player-two'].stage).toEqual({ card: stage, rested: true })
    expect(result.state.players['player-two'].battleArea).toEqual(state.players['player-two'].battleArea)
    expect(result.state.players['player-two'].deck).toEqual(state.players['player-two'].deck)
    expect(result.state.pendingAbilityEffect).toBeFalsy()
  })

  it('049 selects an HP1 Cookie, pays Y1, and rests the Stage for one real HP card', () => {
    const { state, target } = setup('BS8-049', 1)
    const result = takeAiStep(state, 'player-two', { level, seed: 1 })
    expect(result.action).toBe('activate-stage')
    expect(result.effectSelections?.[0].targetIds).toEqual([target.instanceId])
    expect(result.state.players['player-two'].stage?.rested).toBe(true)
    expect(result.state.players['player-two'].supportArea.map((support) => support.rested)).toEqual([true, true, true])
    expect(result.state.players['player-two'].battleArea[0].hpCards).toEqual([
      ...state.players['player-two'].battleArea[0].hpCards,
      state.players['player-two'].deck[0],
    ])
    expect(result.state.players['player-two'].deck).toEqual(state.players['player-two'].deck.slice(1))
    expect(result.state.pendingAbilityEffect).toBeFalsy()
  })
})
