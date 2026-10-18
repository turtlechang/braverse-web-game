import { describe, expect, it } from 'vitest'
import { takeAiStep } from '../../ai'
import { getItemActivateDiscardRequirement } from '../../card-abilities'
import { getCardPoolEntry } from '../../card-pool'
import { createDemoGame } from '../../demo'
import { createCard } from '../../starter-deck'
import { item } from '../../test-helpers/battle-helpers'
import type { CookieCard, GameState, PlayerId } from '../../types'

const owner = 'player-one' as const
const printed = (id: string, player: PlayerId = owner, copy = 1) => {
  const raw = getCardPoolEntry(id)
  if (!raw) throw new Error(`Missing printing ${id}`)
  return createCard(raw, player, copy)
}
const printedCookie = (id: string, player: PlayerId, copy = 1): CookieCard => {
  const card = printed(id, player, copy)
  if (card.type !== 'cookie') throw new Error(`Expected Cookie ${id}`)
  return card
}

const lightOfSilenceFixture = (): GameState => {
  const state = createDemoGame(1)
  state.activePlayerId = owner
  state.phase = 'main'
  state.turnNumber = 13
  for (const player of Object.values(state.players)) {
    player.hand = []
    player.battleArea = []
    player.supportArea = []
    player.breakArea = []
    player.discardPile = []
    player.stage = null
    player.deck = Array.from({ length: 12 }, (_, i) => item(`${player.id}-deck-${i}`))
  }

  const source = printedCookie('BS2-056', owner)
  const opponent = printedCookie('BS12-059', 'player-two')
  state.players[owner].hand = [printed('BS10-119')]
  state.players[owner].battleArea = [{
    card: source,
    rested: true,
    battleEntryId: `${source.instanceId}:entry`,
    hpCards: Array.from({ length: source.hp }, (_, i) => item(`source-hp-${i}`)),
  }]
  state.players[owner].supportArea = [{ card: printed('ST10-005', owner, 2), rested: false }]
  state.players['player-two'].battleArea = [{
    card: opponent,
    rested: false,
    battleEntryId: `${opponent.instanceId}:entry`,
    hpCards: Array.from({ length: opponent.hp }, (_, i) => item(`opponent-hp-${i}`)),
  }]
  return state
}

describe('AI card-ability play decisions', () => {
  it('does not spend BS10-119 when Refresh is false and the post-item Purple Then cannot be paid', () => {
    const state = lightOfSilenceFixture()
    const before = structuredClone(state)

    const decision = takeAiStep(state, owner, { level: 5, seed: 206043600, searchNow: () => 0 })

    expect(decision.action).not.toBe('play-item')
    expect(decision.state.commandLog?.slice(state.commandLog?.length ?? 0).some(entry =>
      entry.payload?.kind === 'play-item' && entry.payload.instanceId === state.players[owner].hand[0]?.instanceId,
    )).toBe(false)
    expect(decision.state.players[owner].hand.map(card => card.id)).toContain('BS10-119')
    expect(decision.state.players[owner].supportArea[0]?.rested).toBe(false)
    expect(state).toEqual(before)
  })

  it('does not begin BS10-119 when the opposing DJ discard tax makes its unpayable Then pointless', () => {
    const state = lightOfSilenceFixture()
    const player = state.players[owner]
    const itemCard = player.hand[0]
    const dj = printedCookie('BS12-082', 'player-two')
    state.players['player-two'].battleArea.push({
      card: dj,
      rested: false,
      battleEntryId: `${dj.instanceId}:entry`,
      hpCards: Array.from({ length: dj.hp }, (_, i) => item(`dj-hp-${i}`)),
    })
    const taxCard = printedCookie('BS2-056', owner, 2)
    player.hand.push(taxCard)

    expect(getItemActivateDiscardRequirement(state, owner)?.count).toBe(1)
    expect(player.hand).toHaveLength(2)

    const before = structuredClone(state)
    const decision = takeAiStep(state, owner, { level: 5, seed: 206043600, searchNow: () => 0 })

    expect(decision.state.pendingOpponentHandDiscard).toBeUndefined()
    expect(decision.state.commandLog?.slice(state.commandLog?.length ?? 0).some(entry =>
      entry.payload?.kind === 'begin-play-item' && entry.payload.instanceId === itemCard?.instanceId,
    )).toBe(false)
    expect(decision.state.players[owner].hand.map(card => card.instanceId)).toContain(itemCard?.instanceId)
    expect(decision.state.players[owner].hand.map(card => card.instanceId)).toContain(taxCard.instanceId)
    expect(decision.state.players[owner].supportArea[0]?.rested).toBe(false)
    expect(state).toEqual(before)
  })
})
