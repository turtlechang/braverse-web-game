import { describe, expect, it } from 'vitest'
import redArena from '../../../data/decks/bs12-red-arena.json'
import community from '../../../data/decks/cookierift-community-20261010.json'
import { takeAiStep } from '../ai'
import { applyGameCommand } from '../commands'
import { getActingPlayerId } from '../controller'
import { getLegalTurnCommands } from '../legal-actions'
import { hasBlockingPending } from '../pending'
import { createPlayerView } from '../player-view'
import { createCustomDeckMatch, type SwissRosterDeck } from '../tournament'
import type { CookieCard, CookieInBattle, GameCard, GameState, PlayerState } from '../types'
import { createPublicAttackAllocationForecast } from './attack-allocation'
import type { AiLevel } from './types'

const owner = 'player-one' as const
const opponent = 'player-two' as const
const seed = 2026101802
const levels: AiLevel[] = [3, 4, 5]
const green = community.decks.find(deck => deck.sourceId === 973)
if (!green) throw new Error('Missing original Cookierift #973 recipe')
const entries = (text: string) => text.split(/\s+/).map(entry => {
  const [cardNumber, count] = entry.split(':')
  return { cardNumber, count: Number(count) }
})
const ownRecipe: SwissRosterDeck = {
  ...redArena, id: 'public-red-order-regression', color: 'red', format: 'standard',
  createdAt: '2026-10-18', updatedAt: '2026-10-18',
}
const foeRecipe: SwissRosterDeck = {
  id: 'public-green-order-regression', name: green.name, color: 'green', format: 'standard',
  entries: entries(green.main), extraDeckEntries: entries(green.extra),
  createdAt: '2026-10-18', updatedAt: '2026-10-18',
}

const resetZones = (player: PlayerState) => {
  player.deck = [...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile,
    ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
    ...player.supportArea.map(support => support.card)]
  player.hand = []
  player.breakArea = []
  player.discardPile = []
  player.battleArea = []
  player.supportArea = []
  player.stage = null
}
const take = (player: PlayerState, predicate: (card: GameCard) => boolean): GameCard => {
  const index = player.deck.findIndex(predicate)
  if (index < 0) throw new Error(`Missing original card in ${player.id}`)
  return player.deck.splice(index, 1)[0]!
}
const takeCookie = (player: PlayerState, predicate: (card: CookieCard) => boolean): CookieCard => {
  const card = take(player, card => card.type === 'cookie' && predicate(card))
  if (card.type !== 'cookie') throw new Error('Expected an original Cookie')
  return card
}
const setBreakLevel = (player: PlayerState, level: number) => {
  const possibilities = new Map<number, CookieCard[]>([[0, []]])
  for (const card of player.deck) {
    if (card.type !== 'cookie' || card.level < 1) continue
    for (const [sum, cards] of [...possibilities].sort(([a], [b]) => b - a)) {
      if (sum + card.level <= level && !possibilities.has(sum + card.level)) {
        possibilities.set(sum + card.level, [...cards, card])
      }
    }
  }
  const cards = possibilities.get(level)
  if (!cards) throw new Error(`Original inventory cannot form Break LV${level}`)
  const ids = new Set(cards.map(card => card.instanceId))
  player.breakArea = cards
  player.deck = player.deck.filter(card => !ids.has(card.instanceId))
}
const field = (player: PlayerState, card: CookieCard): CookieInBattle => {
  const cookie: CookieInBattle = {
    card, rested: false, enteredFrom: 'hand', enteredTurn: 1,
    battleEntryId: `${card.instanceId}:battle:1`,
    hpCards: Array.from({ length: card.hp }, () => take(player, card => !card.flip)),
  }
  expect(cookie.hpCards.every(card => !card.flip)).toBe(true)
  player.battleArea.push(cookie)
  return cookie
}
const assertInventory = (state: GameState) => {
  for (const [player, recipe] of [
    [state.players[owner], ownRecipe], [state.players[opponent], foeRecipe],
  ] as const) {
    const cards = [...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile,
      ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards, ...(cookie.equippedCards ?? [])]),
      ...player.supportArea.map(support => support.card)]
    expect(cards).toHaveLength(60)
    expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
    const counts = new Map<string, number>()
    for (const card of cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
    expect([...counts.values()].every(count => count <= 4)).toBe(true)
    expect([...counts].sort()).toEqual(recipe.entries.map(entry => [entry.cardNumber, entry.count]).sort())
  }
}

// Prepared original 60-card inventories isolate a public order counterexample.
// Non-FLIP HP make the formal routes deterministic; policy still sees only HP
// counts. This is neither the UI loss replay nor a guarantee against unknown FLIPs.
const fixture = () => {
  const state = createCustomDeckMatch(seed, ownRecipe, foeRecipe, owner)
  for (const player of Object.values(state.players)) resetZones(player)
  const self = state.players[owner], foe = state.players[opponent]
  const caramel = takeCookie(self, card => card.id === 'P-175')
  const osmanthus = takeCookie(self, card => card.id === 'BS7-002')
  const target = takeCookie(foe, card => card.id === 'BS8-059')
  const alternative = takeCookie(foe, card => card.level <= 2 && card.hp <= 3)
  expect([caramel.attack, osmanthus.attack, target.level, target.hp]).toEqual([3, 2, 3, 6])
  expect(alternative.id).toBe('ST3-014')
  expect(osmanthus.keywords).toContain('arena')
  setBreakLevel(self, 9)
  setBreakLevel(foe, 7)
  field(self, caramel)
  field(self, osmanthus)
  field(foe, target)
  field(foe, alternative)
  self.supportArea = Array.from({ length: 5 }, () => ({
    card: take(self, card => card.energyColor === 'red'), rested: false,
  }))
  state.phase = 'main'
  state.turnNumber = 15
  state.activePlayerId = owner
  state.pendingReplacement = null
  state.pendingOnPlay = null
  state.pendingRefresh = null
  state.pendingBattle = null
  state.commandLog = []
  expect(hasBlockingPending(state)).toBe(false)
  assertInventory(state)
  return { state, caramel, osmanthus, target, alternative }
}
const settle = (initial: GameState): GameState => {
  let state = initial
  for (let step = 0; step < 80 && state.status !== 'finished' && hasBlockingPending(state); step++) {
    const decision = takeAiStep(state, getActingPlayerId(state), { level: 3, seed, searchNow: () => 0 })
    if (decision.action === 'error' || decision.state === state) {
      throw new Error(`Formal parent attack did not progress: ${decision.action}`)
    }
    state = decision.state
  }
  expect(state.status === 'finished' || !hasBlockingPending(state)).toBe(true)
  return state
}
const forceAttack = (state: GameState, attacker: CookieCard, target: CookieCard): GameState => {
  const legal = getLegalTurnCommands(state, owner).find(command => command.kind === 'attack' &&
    command.attackerInstanceId === attacker.instanceId && command.targetInstanceId === target.instanceId)
  if (!legal || legal.kind !== 'attack') throw new Error('Proposed attack has no actual legal payment')
  return settle(applyGameCommand(state, {
    kind: 'declare-attack', playerId: owner, attackerInstanceId: attacker.instanceId,
    targetInstanceId: target.instanceId, supportPaymentIds: legal.supportPaymentIds,
  }))
}
const firstCommand = (state: GameState) =>
  state.commandLog?.find(entry => entry.commandKind === 'declare-attack')?.payload

describe('Original Arena attack order with a rested witness', () => {
  it('formally deals five forward versus six and a Break-LV victory in reverse', () => {
    const { state, caramel, osmanthus, target } = fixture()
    const before = structuredClone(state)
    const forward = forceAttack(forceAttack(state, caramel, target), osmanthus, target)
    const reverse = forceAttack(forceAttack(state, osmanthus, target), caramel, target)
    expect(forward.status).toBe('playing')
    expect(forward.players[opponent].battleArea.find(cookie => cookie.card.instanceId === target.instanceId)?.hpCards).toHaveLength(1)
    expect(reverse.status).toBe('finished')
    expect(reverse.result).toMatchObject({ winnerId: owner, reason: 'break-level-limit' })
    expect(reverse.players[opponent].breakArea).toContainEqual(target)
    expect(reverse.players[owner].supportArea.every(support => support.rested)).toBe(true)
    expect(state).toEqual(before)
    assertInventory(forward)
    assertInventory(reverse)
  })

  it.each(levels)('Lv%s starts the legal winning order on Mystic Flour instead of the other target', level => {
    const { state, osmanthus, target } = fixture()
    const before = structuredClone(state)
    const decision = takeAiStep(state, owner, { level, seed, searchNow: () => 0 })
    expect(decision.action).toBe('attack')
    expect(firstCommand(decision.state)).toMatchObject({
      attackerInstanceId: osmanthus.instanceId, targetInstanceId: target.instanceId,
    })
    expect(state).toEqual(before)
  })

  it.each(levels)('Lv%s preserves its selected command and score under hidden original-card rearrangement', level => {
    const { state } = fixture()
    const changed = structuredClone(state)
    for (const player of Object.values(changed.players)) {
      const hp = player.battleArea[0]!.hpCards
      const index = player.deck.findIndex(card => card.id !== hp[0]!.id)
      if (index < 0) throw new Error('Missing a different original hidden card')
      const original = hp[0]!
      hp[0] = player.deck[index]!
      player.deck[index] = original
      for (const cookie of player.battleArea) cookie.hpCards.reverse()
      player.deck.reverse()
    }
    expect(createPlayerView(changed, owner)).toEqual(createPlayerView(state, owner))
    assertInventory(changed)
    const before = structuredClone(state), changedBefore = structuredClone(changed)
    const options = { level, seed, searchNow: () => 0 }
    const original = takeAiStep(state, owner, options)
    const hidden = takeAiStep(changed, owner, options)
    expect(hidden.action).toBe(original.action)
    expect(firstCommand(hidden.state)).toEqual(firstCommand(original.state))
    expect(hidden.reason?.actionScore).toBeDefined()
    expect(hidden.reason?.actionScore).toEqual(original.reason?.actionScore)
    expect(state).toEqual(before)
    expect(changed).toEqual(changedBefore)
  })

  it('does not count the source itself as another rested Arena Cookie', () => {
    const { state, caramel, osmanthus, target } = fixture()
    const self = state.players[owner]
    const witness = self.battleArea.find(cookie => cookie.card.instanceId === osmanthus.instanceId)!
    self.battleArea = self.battleArea.filter(cookie => cookie !== witness)
    self.supportArea.push({ card: witness.card, rested: false })
    self.deck.push(...witness.hpCards)
    assertInventory(state)
    const command = getLegalTurnCommands(state, owner).find(command => command.kind === 'attack' &&
      command.attackerInstanceId === caramel.instanceId && command.targetInstanceId === target.instanceId)
    if (!command) throw new Error('Caramel must retain its normal legal attack')
    expect(createPublicAttackAllocationForecast()(state, owner, command)).toBeNull()
    const after = forceAttack(state, caramel, target)
    expect(after.status).toBe('playing')
    expect(after.players[opponent].battleArea.find(cookie => cookie.card.instanceId === target.instanceId)?.hpCards).toHaveLength(3)
    assertInventory(after)
  })

  it('cannot invent the second payment when only two original red supports are active', () => {
    const { state, caramel, osmanthus, target } = fixture()
    state.players[owner].supportArea.forEach((support, index) => { support.rested = index >= 2 })
    const legal = getLegalTurnCommands(state, owner)
    expect(legal.some(command => command.kind === 'attack' && command.attackerInstanceId === caramel.instanceId)).toBe(false)
    const first = legal.find(command => command.kind === 'attack' &&
      command.attackerInstanceId === osmanthus.instanceId && command.targetInstanceId === target.instanceId)
    if (!first) throw new Error('Red Osmanthus must retain its paid RR attack')
    expect(createPublicAttackAllocationForecast()(state, owner, first)).toBeNull()
    const after = forceAttack(state, osmanthus, target)
    expect(after.status).toBe('playing')
    expect(after.players[opponent].battleArea.find(cookie => cookie.card.instanceId === target.instanceId)?.hpCards).toHaveLength(4)
    expect(getLegalTurnCommands(after, owner).some(command => command.kind === 'attack')).toBe(false)
    assertInventory(after)
  })
})
