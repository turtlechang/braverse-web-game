import { describe, expect, it, vi } from 'vitest'
import { forecastOnPlayFollowup } from '../evaluated-turn-handler'
import { takeAiStep } from '../../ai'
import { applyGameCommand, type DeployCookieCommand } from '../../commands'
import { createBattleState, item } from '../../test-helpers/battle-helpers'
import { getCardPoolEntry } from '../../card-pool'
import { createCard } from '../../starter-deck'
import type { CookieCard, GameState, PlayerId } from '../../types'

const owner = 'player-one' as const
const printed = (id: string, player: PlayerId = owner, copy = 1) => {
  const raw = getCardPoolEntry(id)
  if (!raw) throw new Error(`Missing original printing ${id}`)
  return createCard(raw, player, copy)
}
const cookie = (id: string, player: PlayerId = owner): CookieCard => {
  const card = printed(id, player)
  if (card.type !== 'cookie') throw new Error('Expected Cookie')
  return card
}
// Original public definitions with unknown backs. A policy counterexample,
// not a complete physical deck or individual card acceptance fixture.
const fixture = (handId = 'BS11-113', hp = 4, rested = true) => {
  const state = createBattleState()
  state.activePlayerId = owner; state.phase = 'main'; state.turnNumber = 5
  for (const player of Object.values(state.players)) {
    player.hand = []; player.battleArea = []; player.supportArea = []
    player.breakArea = []; player.discardPile = []; player.stage = null; player.extraDeck = []
    player.deck = Array.from({ length: 16 }, (_, i) => item(`${player.id}:back:${i}`))
  }
  state.players[owner].battleArea = ['BS11-092', 'BS11-115'].map((id, i) => {
    const card = cookie(id)
    return { card, rested: i === 0 ? rested : true, battleEntryId: `${card.instanceId}:entry`,
      hpCards: Array.from({ length: i === 0 ? hp : card.hp }, (_, j) => item(`${id}:hp:${j}`)) }
  })
  state.players[owner].hand = [printed(handId), printed('ST1-020')]
  state.players[owner].supportArea = [1, 2].map(copy => ({ card: printed('BS11-110', owner, copy), rested: false }))
  const foe = cookie('BS12-059', 'player-two')
  state.players['player-two'].battleArea = [{ card: foe, rested: false,
    battleEntryId: `${foe.instanceId}:entry`, hpCards: [item('foe:last-hp')] }]
  return state
}
const options = { level: 5 as const, seed: 2026121993, searchNow: () => 0 }
const deploy = (initial: GameState) => {
  const lowered = applyGameCommand(initial, { kind: 'activate-skill', playerId: owner,
    sourceInstanceId: initial.players[owner].battleArea[0].card.instanceId,
    trigger: 'activate', paymentIds: [],
    effectTargets: [[initial.players[owner].battleArea[0].card.instanceId]] })
  const command: DeployCookieCommand = { kind: 'deploy-cookie', playerId: owner,
    instanceId: lowered.players[owner].hand[0].instanceId,
    specialPlayCookieInstanceIds: [lowered.players[owner].battleArea[0].card.instanceId] }
  return { before: lowered, state: applyGameCommand(lowered, command), command }
}
const resolve = (state: GameState, playerId: PlayerId) => takeAiStep(state, playerId, options)

describe('Lv5 public On Play resource continuation', () => {
  it.each([false, true])('considers healthy Licorice into Venom draw without settling it early (rested=%s)', rested => {
    const state = fixture('BS11-113', 4, rested), original = structuredClone(state)
    const lower = takeAiStep(state, owner, options)
    expect(lower.action).toBe('activate-skill')
    const entered = takeAiStep(lower.state, owner, { ...options, memory: lower.reason?.strategyMemory })
    expect(entered.action).toBe('deploy-cookie')
    expect(entered.state.pendingOnPlay?.sourceInstanceId).toBe(state.players[owner].hand[0].instanceId)
    expect(entered.state.players[owner].hand).toHaveLength(1)
    const draw = takeAiStep(entered.state, owner, options)
    expect(draw.action).toBe('activate-skill')
    expect(draw.state.pendingDrawUpTo?.max).toBe(2)
    const settled = applyGameCommand(draw.state, { kind: 'resolve-draw-up-to', playerId: owner, drawCount: 2 })
    expect(settled.players[owner].hand).toHaveLength(3)
    expect(state).toEqual(original)
  })

  it.each([false, true])('does not cycle healthy Licorice just to replace the consumed hand card (rested=%s)', rested => {
    expect(takeAiStep(fixture('BS11-112', 4, rested), owner, options).action).toBe('advance-phase')
  })

  it.each(['BS11-112', 'BS11-113'])('still considers replacing damaged Licorice with %s', id => {
    expect(takeAiStep(fixture(id, 1, true), owner, options).action).toBe('activate-skill')
  })

  it('forecasts an actual public trash recovery without changing the real state', () => {
    const { before, state, command } = deploy(fixture('BS11-112'))
    const original = structuredClone(state)
    const score = forecastOnPlayFollowup(state, owner, command, resolve, before)
    expect(score?.amount).toBeGreaterThan(0)
    expect(state).toEqual(original)
    const actual = resolve(state, owner)
    expect(actual.state.players[owner].hand.map(c => c.id)).toContain('BS11-092')
  })

  it('does not expose hidden faces or change the masked resource estimate', () => {
    const { before, state, command } = deploy(fixture())
    const score = forecastOnPlayFollowup(state, owner, command, resolve, before)
    const hidden = structuredClone(state)
    for (const player of Object.values(hidden.players)) {
      player.deck = player.deck.map(c => ({ ...printed('BS12-060'), instanceId: c.instanceId }))
      for (const source of player.battleArea) source.hpCards = source.hpCards.map(c =>
        ({ ...printed('BS12-060'), instanceId: c.instanceId }))
    }
    const checked = vi.fn((masked: GameState, playerId: PlayerId) => {
      expect(masked.players[owner].deck.every(c => c.id === 'hidden')).toBe(true)
      expect(Object.values(masked.players).every(p => p.battleArea.every(c =>
        c.hpCards.every(hp => hp.id === 'hidden')))).toBe(true)
      return resolve(masked, playerId)
    })
    expect(forecastOnPlayFollowup(hidden, owner, command, checked, before)?.amount).toBe(score?.amount)
    expect(checked).toHaveBeenCalledOnce()
  })

  it.each(['hand-limit', 'short-deck'] as const)('rejects unavailable resource forecasts (%s)', variant => {
    const initial = fixture()
    if (variant === 'hand-limit') while (initial.players[owner].hand.length < 7) {
      initial.players[owner].hand.push(item(`limit:${initial.players[owner].hand.length}`))
    }
    else initial.players[owner].deck = initial.players[owner].deck.slice(0, 5)
    const { before, state, command } = deploy(initial)
    expect(forecastOnPlayFollowup(state, owner, command, resolve, before)).toBeNull()
  })

  it('refuses an incomplete exact-draw Refresh forecast', () => {
    const initial = fixture()
    initial.players[owner].deck = initial.players[owner].deck.slice(0, 5)
    const { before, state, command } = deploy(initial)
    const source = state.players[owner].battleArea.find(c => c.card.instanceId === command.instanceId)!
    // Synthetic variation specifically checks the forecast guard, not printed behavior.
    source.card = { ...source.card, skill: { ...source.card.skill!, effects: [{ kind: 'draw', amount: 2 }] } }
    const original = structuredClone(state)
    const checked = vi.fn((masked: GameState, playerId: PlayerId) => {
      const result = resolve(masked, playerId)
      expect(result.state.pendingRefresh?.remainingDraws).toBe(1)
      return result
    })
    expect(forecastOnPlayFollowup(state, owner, command, checked, before)).toBeNull()
    expect(checked).toHaveBeenCalledOnce()
    expect(state).toEqual(original)
  })

  it('counts only net hand gain and introduces no hoarding refund at six starting cards', () => {
    const initial = fixture()
    while (initial.players[owner].hand.length < 6) {
      initial.players[owner].hand.push(item(`six:${initial.players[owner].hand.length}`))
    }
    const { before, state, command } = deploy(initial)
    const onPlayOnly = forecastOnPlayFollowup(state, owner, command, resolve)
    const wholeDeployment = forecastOnPlayFollowup(state, owner, command, resolve, before)
    // Two cards drawn after spending one have one fewer +6 hand-gain bonus.
    // There was no depletion penalty to refund and no new -8 hoarding penalty.
    expect(onPlayOnly!.amount - wholeDeployment!.amount).toBe(6)
    expect(wholeDeployment!.amount).toBeGreaterThan(0)
  })
})
