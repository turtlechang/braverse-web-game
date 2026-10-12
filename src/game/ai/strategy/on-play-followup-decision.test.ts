import { describe, expect, it, vi } from 'vitest'
import { forecastOnPlayFollowup } from '../evaluated-turn-handler'
import { takeAiStep } from '../../ai'
import { getCardPoolEntry } from '../../card-pool'
import { applyGameCommand, type DeployCookieCommand } from '../../commands'
import { createCard } from '../../starter-deck'
import { createBattleState, item } from '../../test-helpers/battle-helpers'
import type { CookieCard, GameState, PlayerId } from '../../types'

const owner = 'player-one' as const
const printed = (id: string, player: PlayerId = owner, copy = 1) => {
  const raw = getCardPoolEntry(id)
  if (!raw) throw new Error(`Missing printing ${id}`)
  return createCard(raw, player, copy)
}
const cookie = (id: string, player: PlayerId = owner): CookieCard => {
  const card = printed(id, player)
  if (card.type !== 'cookie') throw new Error('Expected original Cookie')
  return card
}
// Policy counterexample with original public Cookie definitions and unknown backs;
// not a physical-card or complete deck acceptance fixture.
const fixture = (rested = true) => {
  const state = createBattleState()
  state.activePlayerId = owner; state.phase = 'main'; state.turnNumber = 5
  for (const player of Object.values(state.players)) {
    player.hand = []; player.battleArea = []; player.supportArea = []
    player.breakArea = []; player.discardPile = []; player.stage = null; player.extraDeck = []
    player.deck = Array.from({ length: 16 }, (_, i) => item(`${player.id}:deck:${i}`))
  }
  state.players[owner].battleArea = ['BS11-092', 'BS11-115'].map((id, i) => {
    const card = cookie(id)
    return { card, rested: i === 0 ? rested : true, battleEntryId: `${card.instanceId}:entry`,
      hpCards: Array.from({ length: card.hp }, (_, j) => item(`${id}:hp:${j}`)) }
  })
  state.players[owner].hand = [printed('BS11-111'), printed('ST1-020')]
  state.players[owner].supportArea = [1, 2].map(copy => ({ card: printed('BS11-110', owner, copy), rested: false }))
  const foe = cookie('BS12-059', 'player-two')
  state.players['player-two'].battleArea = [{ card: foe, rested: false,
    battleEntryId: `${foe.instanceId}:entry`, hpCards: [item('foe:last-hp')] }]
  return state
}
const options = { level: 5 as const, seed: 2026121993, searchNow: () => 0 }
const pendingFixture = () => {
  const initial = fixture()
  const lower = takeAiStep(initial, owner, options)
  const command: DeployCookieCommand = { kind: 'deploy-cookie', playerId: owner,
    instanceId: initial.players[owner].hand[0].instanceId,
    specialPlayCookieInstanceIds: [initial.players[owner].battleArea[0].card.instanceId] }
  return { state: applyGameCommand(lower.state, command), command }
}

describe('Lv5 public On Play continuation', () => {
  it.each([false, true])('sees the healthy Licorice / Mold Dough finishing line (rested=%s)', rested => {
    const state = fixture(rested), before = structuredClone(state)
    const lower = takeAiStep(state, owner, options)
    expect(lower.action).toBe('activate-skill')
    expect(lower.state.players[owner].battleArea[0].levelOverride).toBe(1)
    const deploy = takeAiStep(lower.state, owner, { ...options, memory: lower.reason?.strategyMemory })
    expect(deploy.action).toBe('deploy-cookie')
    expect(deploy.state.players[owner].battleArea.map(c => c.card.id)).toEqual(['BS11-115', 'BS11-111'])
    // Forecasting must not pay the actual On Play cost or settle damage early.
    expect(deploy.state.pendingOnPlay?.sourceInstanceId).toBe(state.players[owner].hand[0].instanceId)
    expect(deploy.state.players[owner].hand.map(c => c.id)).toEqual(['ST1-020'])
    expect(deploy.state.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
    const onPlay = takeAiStep(deploy.state, owner, { ...options, memory: deploy.reason?.strategyMemory })
    expect(onPlay.action).toBe('activate-skill')
    expect(onPlay.state.players['player-two'].battleArea).toEqual([])
    let settled = onPlay.state
    for (const playerId of [owner, 'player-two'] as const) {
      settled = applyGameCommand(settled, { kind: 'skip-replacement', playerId })
    }
    expect(settled.status).toBe('finished')
    expect(settled.result?.winnerId).toBe(owner)
    expect(state).toEqual(before)
  })

  it('unseen HP/deck FLIP faces do not change the public setup decision', () => {
    const state = fixture(), hidden = structuredClone(state)
    for (const player of Object.values(hidden.players)) {
      player.deck = player.deck.map(card => ({ ...printed('BS12-060'), instanceId: card.instanceId }))
      for (const source of player.battleArea) source.hpCards = source.hpCards.map(card =>
        ({ ...printed('BS12-060'), instanceId: card.instanceId }))
    }
    for (const input of [state, hidden]) expect(takeAiStep(input, owner, options).action).toBe('activate-skill')
  })

  it('scores a masked continuation without paying or damaging the actual state', () => {
    const { state, command } = pendingFixture(), before = structuredClone(state)
    state.players['player-two'].hand = [printed('BS12-060', 'player-two')]
    const originalHand = structuredClone(state.players['player-two'].hand)
    const resolve = vi.fn((forecast: GameState, playerId: PlayerId) => {
      for (const player of Object.values(forecast.players)) {
        expect(player.deck.every(card => card.id === 'hidden')).toBe(true)
        expect(player.battleArea.every(source => source.hpCards.every(card => card.id === 'hidden'))).toBe(true)
      }
      expect(forecast.players['player-two'].hand[0].id).toBe('hidden')
      return takeAiStep(forecast, playerId, options)
    })
    const score = forecastOnPlayFollowup(state, owner, command, resolve)
    expect(score?.id).toBe('on-play-followup')
    expect(score!.amount).toBeGreaterThan(0)
    expect(score!.amount).toBeLessThanOrEqual(200)
    expect(resolve).toHaveBeenCalledOnce()
    expect(state).toEqual({ ...before, players: { ...before.players,
      'player-two': { ...before.players['player-two'], hand: originalHand } } })
  })

  it.each(['no-pending', 'wrong-source', 'wrong-player', 'missing-payment', 'mixed-effects'] as const)(
    'does not forecast an unsupported or unavailable continuation (%s)', variant => {
      const { state, command } = pendingFixture()
      if (variant === 'no-pending') state.pendingOnPlay = null
      if (variant === 'wrong-source') command.instanceId = 'not-the-pending-source'
      if (variant === 'wrong-player') state.pendingOnPlay!.playerId = 'player-two'
      if (variant === 'missing-payment') state.players[owner].hand = []
      if (variant === 'mixed-effects') {
        const source = state.players[owner].battleArea[1]
        source.card = cookie('BS1-029')
        command.instanceId = source.card.instanceId
        state.pendingOnPlay!.sourceInstanceId = source.card.instanceId
      }
      const resolve = vi.fn(() => null)
      expect(forecastOnPlayFollowup(state, owner, command, resolve)).toBeNull()
      expect(resolve).not.toHaveBeenCalled()
    },
  )
})
