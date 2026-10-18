import { describe, expect, it } from 'vitest'
import { takeAiStep } from '../ai'
import { applyGameCommand } from '../commands'
import { createBs12AppleFaerieDemoState, createCardCheckDemoState } from '../demo'
import { getLegalTurnCommands } from '../legal-actions'
import { createPlayerView } from '../player-view'
import type { AiDecision } from './types'

const playerId = 'player-one' as const
const options = { level: 3 as const, seed: 2026101801 }

const fixture = (canAttack = true, targetCount = 2) => {
  const state = createBs12AppleFaerieDemoState('extra-named-rested')
  state.firstPlayerId = playerId
  state.turnNumber = 3
  const player = state.players[playerId]
  player.deck = [...player.hand, ...player.deck]
  player.hand = []
  if (!canAttack) player.supportArea[1].rested = true

  const opponent = state.players['player-two']
  const removed = opponent.battleArea.splice(targetCount)
  opponent.discardPile.push(...removed.flatMap(cookie => [cookie.card, ...cookie.hpCards]))
  return state
}

const followupAmount = (decision: AiDecision) =>
  decision.reason?.actionScore?.contributions.find(
    contribution => contribution.id === 'legal-action-followup',
  )?.amount ?? 0

describe('Lv3 public setup attack follow-up', () => {
  it('values the payable attack opened by a real Arena EXTRA, then declares that attack', () => {
    const state = fixture()
    const original = structuredClone(state)
    expect(getLegalTurnCommands(state, playerId).some(command => command.kind === 'attack')).toBe(false)

    const extra = takeAiStep(state, playerId, options)
    expect(extra.action).toBe('deploy-cookie')
    expect(extra.state.commandLog?.at(-1)?.payload).toMatchObject({
      kind: 'play-extra-deck-cookie',
      instanceId: 'bs12-056-source',
    })
    expect(followupAmount(extra)).toBeGreaterThan(0)
    const attacks = getLegalTurnCommands(extra.state, playerId).filter(
      command => command.kind === 'attack',
    )
    expect(attacks).toHaveLength(2)
    expect(attacks.every(command =>
      command.attackerInstanceId === 'bs12-056-source' &&
      command.supportPaymentIds.length === 2,
    )).toBe(true)

    const attack = takeAiStep(extra.state, playerId, options)
    expect(attack.action).toBe('attack')
    expect(attack.state.commandLog?.at(-1)?.payload).toMatchObject({
      kind: 'declare-attack',
      attackerInstanceId: 'bs12-056-source',
      supportPaymentIds: ['bs12-056-support-0', 'bs12-056-support-1'],
    })
    expect(attack.state.players[playerId].supportArea.every(support => support.rested)).toBe(true)
    expect(state).toEqual(original)
  })

  it('does not forecast an attack when the same legal EXTRA lacks its NN payment', () => {
    const state = fixture(false)
    const extra = takeAiStep(state, playerId, options)
    expect(extra.action).toBe('deploy-cookie')
    expect(extra.state.commandLog?.at(-1)?.payload).toMatchObject({
      kind: 'play-extra-deck-cookie',
      instanceId: 'bs12-056-source',
    })
    expect(getLegalTurnCommands(extra.state, playerId).some(command => command.kind === 'attack')).toBe(false)
    expect(followupAmount(extra)).toBe(0)
  })

  it('takes the best new attack value once when more targets create more commands', () => {
    const oneTarget = takeAiStep(fixture(true, 1), playerId, options)
    const twoTargets = takeAiStep(fixture(), playerId, options)
    const attackCount = (decision: AiDecision) => getLegalTurnCommands(decision.state, playerId)
      .filter(command => command.kind === 'attack').length

    expect(attackCount(oneTarget)).toBe(1)
    expect(attackCount(twoTargets)).toBe(2)
    expect(followupAmount(oneTarget)).toBeGreaterThan(0)
    expect(followupAmount(twoTargets)).toBe(followupAmount(oneTarget))
  })

  it('does not use hidden deck or HP faces to value the EXTRA follow-up', () => {
    const state = fixture()
    const hidden = structuredClone(state)
    for (const player of Object.values(hidden.players)) {
      player.deck.reverse()
      for (const cookie of player.battleArea) cookie.hpCards.reverse()
    }

    const original = takeAiStep(state, playerId, options)
    const reordered = takeAiStep(hidden, playerId, options)
    expect(reordered.state.commandLog?.at(-1)?.payload).toEqual(
      original.state.commandLog?.at(-1)?.payload,
    )
    expect(followupAmount(reordered)).toBe(followupAmount(original))
    expect(followupAmount(reordered)).toBeGreaterThan(0)
  })

  it('waits until a deck-top support is public before using its unknown color for an attack', () => {
    const stageFixture = (topCardId: string) => {
      const state = createCardCheckDemoState('BS9-070')
      const player = state.players[playerId]
      const attacker = player.battleArea.find(cookie => cookie.card.id === 'BS8-014')!
      attacker.rested = true
      const topIndex = player.deck.findIndex(card => card.id === topCardId)
      expect(topIndex).toBeGreaterThanOrEqual(0)
      const [top] = player.deck.splice(topIndex, 1)
      player.deck.unshift(top!)
      return applyGameCommand(state, {
        kind: 'play-stage',
        playerId,
        instanceId: 'bs9-bs9-070-source',
        paymentIds: ['bs9-green-support-1'],
      })
    }
    const redTop = stageFixture('BS8-021')
    const blueTop = stageFixture('BS8-096')
    expect(createPlayerView(redTop, playerId)).toEqual(createPlayerView(blueTop, playerId))

    const red = takeAiStep(redTop, playerId, options)
    const blue = takeAiStep(blueTop, playerId, options)
    expect(red.action).toBe('activate-stage')
    expect(blue.action).toBe('activate-stage')
    expect(red.state.commandLog?.at(-1)?.payload).toEqual(blue.state.commandLog?.at(-1)?.payload)
    expect(followupAmount(red)).toBe(0)
    expect(followupAmount(blue)).toBe(0)
    expect(getLegalTurnCommands(red.state, playerId).some(command => command.kind === 'attack')).toBe(true)
    expect(getLegalTurnCommands(blue.state, playerId).some(command => command.kind === 'attack')).toBe(false)
  })
})
