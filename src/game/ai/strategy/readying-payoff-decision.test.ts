import { describe, expect, it } from 'vitest'
import { takeAiStep } from '../../ai'
import { getCardPoolEntry } from '../../card-pool'
import { applyGameCommand } from '../../commands'
import { createDemoGame } from '../../demo'
import { createCard } from '../../starter-deck'
import { item } from '../../test-helpers/battle-helpers'
import type { CookieCard, GameState, PlayerId } from '../../types'
import { assessLv5Deployment } from '../deployment-policy'
import { hasPublicReadyPhasePayoff } from '../public-readying-payoff'

const owner = 'player-one' as const
const printed = (id: string, player: PlayerId = owner, copy = 1) => {
  const raw = getCardPoolEntry(id)
  if (!raw) throw new Error(`Missing printing ${id}`)
  return createCard(raw, player, copy)
}
const printedCookie = (id: string, player: PlayerId = owner): CookieCard => {
  const card = printed(id, player)
  if (card.type !== 'cookie') throw new Error(`Expected Cookie ${id}`)
  return card
}

// Public AI counterexample, with synthetic unknown HP/deck backs.
// This fixture tests policy; it is not physical-card acceptance.
const fixture = (sourceId = 'BS12-015'): GameState => {
  const state = createDemoGame(1)
  state.activePlayerId = owner; state.phase = 'main'; state.turnNumber = 3
  for (const player of Object.values(state.players)) {
    player.hand = []; player.battleArea = []; player.supportArea = []
    player.breakArea = []; player.discardPile = []; player.stage = null
    player.deck = Array.from({ length: 12 }, (_, i) => item(`${player.id}-deck-${i}`))
  }
  const source = printedCookie(sourceId)
  const defender = printedCookie('BS12-059', 'player-two')
  state.players[owner].battleArea = [{ card: source, rested: true, battleEntryId: `${source.instanceId}:entry`,
    hpCards: Array.from({ length: source.hp }, (_, i) => item(`source-hp-${i}`)) }]
  state.players[owner].hand = [printed('BS12-002'), printed('ST1-001')]
  state.players[owner].supportArea = [1, 2, 3].map(copy => ({ card: printed('ST1-020', owner, copy), rested: false }))
  state.players['player-two'].battleArea = [{ card: defender, rested: false, battleEntryId: `${defender.instanceId}:entry`,
    hpCards: Array.from({ length: defender.hp }, (_, i) => item(`defender-hp-${i}`)) }]
  state.players['player-two'].hand = [item('hidden-foe-hand')]
  return state
}

describe('Lv5 public Active Phase payoff', () => {
  it.each([
    ['BS12-014', false], ['BS12-014', true],
    ['BS12-015', false], ['BS12-015', true],
  ] as const)('deploys the Arena companion for %s (reverse hand=%s)', (sourceId, reverse) => {
    const state = fixture(sourceId)
    if (reverse) state.players[owner].hand.reverse()
    const before = structuredClone(state)
    const decision = takeAiStep(state, owner, { level: 5, seed: 2026114387, searchNow: () => 0 })
    expect(decision.action).toBe('deploy-cookie')
    expect(decision.state.players[owner].battleArea.map(cookie => cookie.card.id)).toEqual([sourceId, 'BS12-002'])
    expect(state).toEqual(before)
  })

  it.each([null, 'ST1-001', 'BS12-002'])('only an Arena companion enables the actual next Active Phase (%s)', deployedId => {
    let state = fixture()
    if (deployedId) {
      const card = state.players[owner].hand.find(candidate => candidate.id === deployedId)
      if (!card) throw new Error('Missing companion')
      state = applyGameCommand(state, { kind: 'deploy-cookie', playerId: owner, instanceId: card.instanceId })
    }
    // The opponent advances without attacks: conditional payoff, not guaranteed survival.
    for (let i = 0; i < 12; i++) {
      state = applyGameCommand(state, { kind: 'advance-phase', playerId: state.activePlayerId })
      if (state.activePlayerId === owner && state.phase === 'main') break
    }
    expect([state.activePlayerId, state.phase]).toEqual([owner, 'main'])
    expect(state.players[owner].battleArea[0].rested).toBe(deployedId !== 'BS12-002')
  })

  it('removes only the second-Cookie penalty for a real public readying payoff', () => {
    const state = fixture(), before = structuredClone(state)
    const [arena, nonArena] = state.players[owner].hand
    expect(assessLv5Deployment(state, owner, arena)).toEqual({ penalty: 0, reason: 'public-readying-payoff' })
    expect(assessLv5Deployment(state, owner, nonArena).reason).toBe('single-cookie-discipline')
    expect(state).toEqual(before)
  })

  it('does not invent a payoff when the source is already active or outside the printed passive', () => {
    const state = fixture(), card = state.players[owner].hand[0]
    state.players[owner].battleArea[0].rested = false
    expect(hasPublicReadyPhasePayoff(state, owner, card)).toBe(false)
    const ordinary = fixture('ST1-005')
    expect(hasPublicReadyPhasePayoff(ordinary, owner, ordinary.players[owner].hand[0])).toBe(false)
  })

  it('requires a legal deployment in main phase and a real card in hand', () => {
    const state = fixture(), card = state.players[owner].hand[0]
    state.phase = 'support'
    expect(hasPublicReadyPhasePayoff(state, owner, card)).toBe(false)
    state.phase = 'main'; state.players[owner].hand = []
    expect(hasPublicReadyPhasePayoff(state, owner, card)).toBe(false)
  })

  it('declines an unresolved Refresh rather than assuming the deployment completes', () => {
    const state = fixture()
    state.players[owner].deck = []
    expect(hasPublicReadyPhasePayoff(state, owner, state.players[owner].hand[0])).toBe(false)
  })

  it('unknown HP, deck and opponent hand faces do not alter the payoff or actual AI choice', () => {
    const state = fixture(), hidden = structuredClone(state)
    for (const player of Object.values(hidden.players)) {
      player.deck = player.deck.map(card => ({ ...printed('BS12-014'), instanceId: card.instanceId }))
      for (const cookie of player.battleArea) {
        cookie.hpCards = cookie.hpCards.map(card => ({ ...printed('BS12-014'), instanceId: card.instanceId }))
      }
    }
    hidden.players['player-two'].hand = hidden.players['player-two'].hand.map(card => ({ ...printed('BS12-014'), instanceId: card.instanceId }))
    for (const input of [state, hidden]) {
      expect(hasPublicReadyPhasePayoff(input, owner, input.players[owner].hand[0])).toBe(true)
      const decision = takeAiStep(input, owner, { level: 5, seed: 2026114387, searchNow: () => 0 })
      expect(decision.state.players[owner].battleArea.map(cookie => cookie.card.id)).toEqual(['BS12-015', 'BS12-002'])
    }
  })
})
