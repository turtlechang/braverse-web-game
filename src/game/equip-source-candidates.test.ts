import { describe, expect, it } from 'vitest'
import { takeAiStep } from './ai'
import { applyGameCommand } from './commands'
import { COMMUNITY_DECK_PRESETS } from './community-deck-recipes'
import { executeCardEffect, getEffectSelectionCandidates, getEffectTargetCandidatesForEffect } from './effects'
import { createCustomDeckMatch, type SwissRosterDeck } from './tournament'
import type { AiLevel } from './ai/types'
import type { CardEffect, GameCard, PlayerState } from './types'

const owner = 'player-one' as const
const opponent = 'player-two' as const
const seed = 209161600
const preset = COMMUNITY_DECK_PRESETS['cookierift-973']
const recipe: SwissRosterDeck = {
  ...preset, id: 'equip-refresh-regression', color: 'green', format: 'standard',
  createdAt: '2026-10-18', updatedAt: '2026-10-18',
}

const resetZones = (player: PlayerState) => {
  player.deck = [
    ...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea,
    ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
    ...player.supportArea.map(support => support.card),
  ]
  player.hand = []
  player.discardPile = []
  player.breakArea = []
  player.battleArea = []
  player.supportArea = []
}

const take = (player: PlayerState, id?: string): GameCard => {
  const index = id ? player.deck.findIndex(card => card.id === id) : 0
  if (index < 0 || !player.deck[index]) throw new Error(`Missing original card ${id}`)
  return player.deck.splice(index, 1)[0]!
}

const putHost = (player: PlayerState) => {
  const card = take(player, 'BS8-059')
  if (card.type !== 'cookie') throw new Error('Expected original Mystic Flour Cookie')
  const host = { card, rested: false, hpCards: Array.from({ length: card.hp }, () => take(player)) }
  player.battleArea.push(host)
  return host
}

// A 60-card community inventory is rearranged to isolate the observed command
// boundary. Card definitions and printed HP are retained; this is a regression
// fixture, not evidence of a naturally played full match.
const fixture = () => {
  const state = createCustomDeckMatch(seed, recipe, recipe, owner)
  for (const player of Object.values(state.players)) resetZones(player)
  const self = state.players[owner]
  const foe = state.players[opponent]
  const source = take(self, 'BS8-072')
  self.hand = [source]
  const host = putHost(self)
  putHost(foe)
  self.supportArea = [0, 1].map(() => ({ card: take(self, 'BS8-060'), rested: false }))
  foe.supportArea = [0, 1, 2].map(() => ({ card: take(foe), rested: false }))
  self.discardPile = self.deck.splice(1)
  state.phase = 'main'
  state.turnNumber = 24
  return { state, source, host }
}

const contextFor = (source: GameCard) => ({
  sourcePlayerId: owner, sourceInstanceId: source.instanceId, sourceCardName: source.name,
})

const equipEffect: CardEffect = {
  kind: 'equip-source', target: { side: 'self', min: 0, max: 1 }, requiredCookieId: 'BS8-059',
}

const afterRefresh = () => {
  const { state, source, host } = fixture()
  let next = applyGameCommand(state, {
    kind: 'begin-play-item', playerId: owner, instanceId: source.instanceId,
    paymentIds: state.players[owner].supportArea.map(support => support.card.instanceId),
    chooseOneModes: [2],
  })
  next = applyGameCommand(next, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [] })
  expect(next.pendingInspectDeck?.revealedCards).toHaveLength(1)
  expect(next.pendingRefresh?.playerId).toBe(owner)
  expect(next.players[owner].discardPile).toContainEqual(source)
  const refreshCookie = next.players[owner].discardPile.find(card => card.type === 'cookie')!
  next = applyGameCommand(next, {
    kind: 'refresh-deck', playerId: owner, cookieInstanceId: refreshCookie.instanceId, shuffleSeed: seed,
  })
  expect(next.players[owner].discardPile).not.toContainEqual(source)
  const revealed = next.pendingInspectDeck!.revealedCards
  next = applyGameCommand(next, {
    kind: 'resolve-inspect-deck', playerId: owner, pickedCardIds: [],
    restOrder: revealed.map(card => card.instanceId),
  })
  return { state: next, source, host }
}

describe('Equip candidates match the required public source zone', () => {
  it('does not offer hosts after BS8-072 inspection triggers Refresh', () => {
    const { state, source, host } = afterRefresh()
    expect(state.pendingAbilityEffect?.effects[state.pendingAbilityEffect.effectIndex].kind).toBe('equip-source')
    expect(state.players[owner].battleArea).toContainEqual(host)
    expect(getEffectTargetCandidatesForEffect(state, contextFor(source), equipEffect)).toEqual([])
    expect(getEffectSelectionCandidates(state, contextFor(source), equipEffect)).toEqual([])
    const before = structuredClone(state)
    const result = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [] })
    expect(result.pendingAbilityEffect).toBeUndefined()
    expect(result.players).toEqual(state.players)
    expect(state).toEqual(before)
    expect(() => executeCardEffect(state, contextFor(source), equipEffect, [host.card.instanceId]))
      .toThrow('Invalid Equip source or self target.')
  })

  it.each([1, 2, 3, 4, 5] satisfies AiLevel[])('Lv.%s resolves the exact post-Refresh pending without an illegal Equip', level => {
    const { state } = afterRefresh()
    const before = structuredClone(state)
    const decision = takeAiStep(state, owner, { level, seed, searchNow: () => 0 })
    expect(decision.action).not.toBe('error')
    expect(decision.state.pendingAbilityEffect).toBeUndefined()
    expect(decision.state.players[owner].battleArea.every(cookie => !cookie.equippedCards?.length)).toBe(true)
    expect(state).toEqual(before)
  })

  it('retains valid trash equipment and rejects a source in another player or zone', () => {
    const { state, source, host } = fixture()
    state.players[owner].hand = []
    state.players[owner].discardPile.push(source)
    const context = contextFor(source)
    expect(getEffectTargetCandidatesForEffect(state, context, equipEffect)).toEqual([host])
    const equipped = executeCardEffect(state, context, equipEffect, [host.card.instanceId])
    expect(equipped.players[owner].battleArea[0].equippedCards).toEqual([source])
    state.players[owner].discardPile = state.players[owner].discardPile.filter(card => card !== source)
    state.players[opponent].discardPile.push(source)
    expect(getEffectTargetCandidatesForEffect(state, context, equipEffect)).toEqual([])
    expect(getEffectTargetCandidatesForEffect(state, { ...context, sourcePlayerId: opponent }, equipEffect))
      .toEqual(state.players[opponent].battleArea)
    expect(getEffectTargetCandidatesForEffect(state, context, { ...equipEffect, sourceZone: 'battle' })).toEqual([])
  })

  it('offers only other own hosts for a battle source and never borrows a trash source', () => {
    const { state, host } = fixture()
    const other = putHostFromTrash(state.players[owner])
    const context = contextFor(host.card)
    const battleEquip: CardEffect = {
      ...equipEffect, sourceZone: 'battle',
      battleSourceDisposition: { hp: 'trash', replacement: 'none' },
    }
    expect(getEffectTargetCandidatesForEffect(state, context, battleEquip)).toEqual([other])
    expect(getEffectTargetCandidatesForEffect(state, context, { ...battleEquip, target: { side: 'either', min: 0, max: 1 } }))
      .toEqual([other])
    expect(getEffectTargetCandidatesForEffect(state, context, equipEffect)).toEqual([])
    state.players[owner].battleArea = [other]
    state.players[owner].discardPile.push(host.card)
    expect(getEffectTargetCandidatesForEffect(state, context, battleEquip)).toEqual([])
    expect(() => executeCardEffect(state, context, battleEquip, [other.card.instanceId]))
      .toThrow('Invalid Equip source or self target.')
  })
})

const putHostFromTrash = (player: PlayerState) => {
  const index = player.discardPile.findIndex(card => card.id === 'BS8-059')
  const card = player.discardPile.splice(index, 1)[0]
  if (!card || card.type !== 'cookie') throw new Error('Missing original second host')
  const host = { card, hpCards: player.discardPile.splice(0, card.hp), rested: false }
  player.battleArea.push(host)
  return host
}
