import { describe, expect, it } from 'vitest'
import { isDeepStrictEqual } from 'node:util'
import fixture from './fixtures/r40-blue-extra-masked-physical-parents.json'
import { takeAiStep } from '../ai'
import { getCardPoolEntry } from '../card-pool'
import { applyGameCommand, type GameCommand } from '../commands'
import { getLegalTurnCommands } from '../legal-actions'
import { maskGameStateForViewer } from '../masked-state'
import { createPlayerView } from '../player-view'
import { getDiscardHandCostCandidates } from '../skills'
import { createCard } from '../starter-deck'
import type { GameState, PlayerId } from '../types'
import type { AiDecision } from './types'
import type { AiStrategyMemory } from './strategy/session'
import { forecastPaidExtraAttack } from './evaluated-turn-handler'
import { previewMandatoryExtraState } from './mandatory-extra-preview'

// Actor-view derivatives of a real replay. Hidden HP and deck cards are
// placeholders, so these are not complete physical-game histories. The
// private original was independently checked through all 226 commands.
const actor: PlayerId = 'player-two'
const parent = (index: 158 | 160 | 161 | 163 | 165): GameState =>
  structuredClone(fixture.cases[String(index) as keyof typeof fixture.cases]) as unknown as GameState
const opts = (memory?: AiStrategyMemory) => ({ level: 5 as const, seed: 1, searchNow: () => 0, memory })
const commands = (decision: AiDecision, before: GameState) =>
  (decision.state.commandLog ?? []).slice(before.commandLog?.length ?? 0).map(entry => entry.payload as unknown as GameCommand)
const jagae = (state: GameState) => getLegalTurnCommands(state, actor).find(command =>
  command.kind === 'play-extra-deck-cookie' && state.players[actor].extraDeck?.some(card =>
    card.instanceId === command.instanceId && card.id === 'BS10-098'))

// Restrict the guard to synchronous game calls; Vitest itself uses randomness
// outside them. Ambient randomness within the engine remains a hard failure.
const withoutAmbientRandom = <T,>(fn: () => T): T => {
  const original = Math.random
  Math.random = () => { throw new Error('Unrecorded randomness forbidden') }
  try { return fn() } finally { Math.random = original }
}

describe('Lv.5 paid blue EXTRA on masked physical-parent snapshots', () => {
  it('records the source boundary without exposing the original private replay', () => {
    expect(fixture.schema).toBe('braverse-r40-masked-physical-parents-v1')
    expect(fixture.sourceHash).toBe('6b02e910d1aa89be05948f4e99b83ec3cf51aa90582635da47d036469a355c87')
    for (const index of [158, 160, 161, 163, 165] as const) {
      const state = parent(index)
      expect(state.commandLog).toBeUndefined()
      expect(state.players['player-one'].hand.every(card => card.id === 'hidden')).toBe(true)
      for (const side of Object.values(state.players)) {
        expect(side.deck.every(card => card.id === 'hidden')).toBe(true)
        for (const cookie of side.battleArea) {
          expect(cookie.hpCards.every(card => card.id === 'hidden' ||
            cookie.faceUpHpCardInstanceIds?.includes(card.instanceId))).toBe(true)
        }
      }
      expect(createPlayerView(maskGameStateForViewer(state, actor), actor)).toEqual(createPlayerView(state, actor))
    }
  })

  it('keeps the legal damaged-body OnPlay return', () => {
    const state = parent(158), decision = withoutAmbientRandom(() => takeAiStep(state, actor, opts()))
    expect(decision.error).toBeUndefined()
    const [command] = commands(decision, state)
    expect(command?.kind).toBe('activate-skill')
    if (!command || command.kind !== 'activate-skill') throw new Error('Expected OnPlay activation')
    const returned = state.players[actor].battleArea.find(cookie => cookie.card.instanceId === command.battleToHandIds?.[0])
    expect(returned?.card.id).toBe('BS8-087')
    expect(returned?.hpCards).toHaveLength(1)
  })

  it('previews Jagae only after real hand payment and a legal attack', () => {
    const before = parent(161), command = jagae(before)
    expect(command?.kind).toBe('play-extra-deck-cookie')
    if (!command || command.kind !== 'play-extra-deck-cookie') throw new Error('Missing real EXTRA action')
    const pending = withoutAmbientRandom(() => applyGameCommand(before, command)), cost = pending.pendingOptionalCostAttack
    expect(cost?.mandatory).toBe(true)
    if (!cost) throw new Error('Missing mandatory payment')
    const candidates = getDiscardHandCostCandidates(cost.cost, pending.players[actor].hand, cost.sourceInstanceId)
    expect(candidates.length).toBeGreaterThanOrEqual(2)
    const paid = withoutAmbientRandom(() => applyGameCommand(pending, {
      kind: 'resolve-optional-cost-attack', playerId: actor, action: 'pay',
      discardCardIds: candidates.slice(0, 2).map(card => card.instanceId),
    }))
    expect(paid.players[actor].battleArea.find(cookie => cookie.card.id === 'BS10-098')?.hpCards).toHaveLength(6)
    expect(getLegalTurnCommands(paid, actor).some(candidate =>
      candidate.kind === 'attack' && candidate.attackerInstanceId === command.instanceId)).toBe(true)
    expect(withoutAmbientRandom(() => previewMandatoryExtraState(pending, actor, undefined, { requireAttackPayment: true }))).not.toBeNull()
    const score = withoutAmbientRandom(() => forecastPaidExtraAttack(pending, actor, command, undefined, before))
    expect(score?.amount).toBeGreaterThan(0)
    expect(score!.amount).toBeLessThanOrEqual(120)
  })

  it('keeps skip and underfunded physical-parent boundaries distinct', () => {
    const before = parent(160), decision = withoutAmbientRandom(() => takeAiStep(before, actor, opts())), [command] = commands(decision, before)
    expect(decision.error).toBeUndefined()
    if (!command || command.kind !== 'activate-skill') throw new Error('Expected legal OnPlay action')
    const skipped = withoutAmbientRandom(() => applyGameCommand(before, { kind: 'skip-on-play', playerId: actor, sourceInstanceId: command.sourceInstanceId }))
    expect(skipped.players[actor].hand).toHaveLength(6)
    expect(jagae(skipped)).toBeUndefined()

    for (const [index, deckCount, activeCount] of [[163, 9, 2], [165, 6, 1]] as const) {
      const state = parent(index), extra = jagae(state)
      expect(state.players[actor].deck).toHaveLength(deckCount)
      expect(state.players[actor].supportArea.filter(support => !support.rested)).toHaveLength(activeCount)
      if (!extra || extra.kind !== 'play-extra-deck-cookie') throw new Error('Expected legal EXTRA action')
      const pending = withoutAmbientRandom(() => applyGameCommand(state, extra))
      expect(withoutAmbientRandom(() => previewMandatoryExtraState(pending, actor, undefined, { requireAttackPayment: true }))).toBeNull()
      expect(withoutAmbientRandom(() => forecastPaidExtraAttack(pending, actor, extra, undefined, state))).toBeNull()
    }
    // The deck boundary at 165 also lacks energy; it is not an independent
    // physical deck-only negative.
  })

  it('does not repeat the full-HP same-card exchange before the opponent response', () => {
    let state = parent(160), memory: AiStrategyMemory | undefined, repeats = 0, opponentResponse = false
    for (let index = 0; index < 8; index++) {
      if (state.pendingBattle?.stage === 'trap' && state.pendingBattle.defenderPlayerId !== actor) {
        opponentResponse = true
        break
      }
      const before = state, decision = withoutAmbientRandom(() => takeAiStep(before, actor, opts(memory)))
      expect(decision.error).toBeUndefined()
      const next = commands(decision, before)
      expect(next.length).toBeGreaterThan(0)
      for (const command of next) {
        if (command.kind !== 'activate-skill' || command.trigger !== 'on-play' ||
            command.battleToHandIds?.length !== 1 || command.effectTargets?.length !== 1 || command.effectTargets[0].length !== 0) continue
        const own = before.players[actor]
        const source = own.battleArea.find(cookie => cookie.card.instanceId === command.sourceInstanceId)
        const returned = own.battleArea.find(cookie => cookie.card.instanceId === command.battleToHandIds![0])
        if (source && returned && source.card.id === returned.card.id && returned.hpCards.length >= returned.card.hp) repeats++
      }
      expect(repeats).toBeLessThanOrEqual(1)
      state = decision.state
      memory = decision.reason?.strategyMemory
    }
    expect(opponentResponse).toBe(true)
  })

  it('keeps action and forecast invariant under synthetic unknown-card swaps', () => {
    // These are physical printed cards inserted into masked slots solely for
    // information-boundary checks; no formal parent histories are claimed.
    const first = getCardPoolEntry('BS8-087'), second = getCardPoolEntry('ST9-006')
    if (!first || !second) throw new Error('Missing real printed card data')
    const cardA = createCard(first, 'player-one', 90001), cardB = createCard(second, 'player-one', 90002)
    const base = parent(161), opponent: PlayerId = 'player-one'
    expect(base.players[opponent].hand.length).toBeGreaterThan(0)
    expect(base.players[opponent].deck.length).toBeGreaterThan(1)
    expect(base.players[opponent].battleArea.some(cookie => cookie.hpCards.length > 0)).toBe(true)
    const hpIndex = base.players[opponent].battleArea.findIndex(cookie => cookie.hpCards.length > 0)
    const swaps: Array<(left: GameState, right: GameState) => void> = [
      (left, right) => { left.players[opponent].hand[0] = cardA; left.players[opponent].deck[0] = cardB; right.players[opponent].hand[0] = cardB; right.players[opponent].deck[0] = cardA },
      (left, right) => { left.players[opponent].battleArea[hpIndex].hpCards[0] = cardA; left.players[opponent].deck[0] = cardB; right.players[opponent].battleArea[hpIndex].hpCards[0] = cardB; right.players[opponent].deck[0] = cardA },
      (left, right) => { left.players[opponent].deck[0] = cardA; left.players[opponent].deck[1] = cardB; right.players[opponent].deck[0] = cardB; right.players[opponent].deck[1] = cardA },
      (left, right) => { left.players[actor].deck[0] = cardA; left.players[actor].deck[1] = cardB; right.players[actor].deck[0] = cardB; right.players[actor].deck[1] = cardA },
    ]
    for (const swap of swaps) {
      const left = structuredClone(base), right = structuredClone(base)
      swap(left, right)
      expect(createPlayerView(left, actor)).toEqual(createPlayerView(right, actor))
      expect(maskGameStateForViewer(left, actor)).toEqual(maskGameStateForViewer(right, actor))
      const leftExtra = jagae(left), rightExtra = jagae(right)
      if (!leftExtra || !rightExtra || leftExtra.kind !== 'play-extra-deck-cookie' || rightExtra.kind !== 'play-extra-deck-cookie') throw new Error('Missing EXTRA')
      expect(rightExtra).toEqual(leftExtra)
      const leftScore = withoutAmbientRandom(() => forecastPaidExtraAttack(applyGameCommand(left, leftExtra), actor, leftExtra, undefined, left))
      const rightScore = withoutAmbientRandom(() => forecastPaidExtraAttack(applyGameCommand(right, rightExtra), actor, rightExtra, undefined, right))
      expect(rightScore).toEqual(leftScore)
      const leftDecision = withoutAmbientRandom(() => takeAiStep(left, actor, opts()))
      const rightDecision = withoutAmbientRandom(() => takeAiStep(right, actor, opts()))
      expect(leftDecision.error).toBeUndefined()
      expect(rightDecision.error).toBeUndefined()
      expect(isDeepStrictEqual(commands(leftDecision, left), commands(rightDecision, right))).toBe(true)
    }
  })
})
