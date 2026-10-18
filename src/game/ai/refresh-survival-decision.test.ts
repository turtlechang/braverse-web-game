import { describe, expect, it } from 'vitest'
import bs1 from '../../../data/cards/official-brave-beginning-bs1.en.json'
import bs3 from '../../../data/cards/official-age-of-heroes-and-kingdoms-bs3.en.json'
import bs9 from '../../../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json'
import { takeAiStep } from '../ai'
import { applyGameCommand } from '../commands'
import { createDeckFromCustomDeck } from '../custom-deck'
import { GameRuleError } from '../errors'
import { createPlayerView } from '../player-view'
import { getRefreshCandidates } from '../refresh'
import { commandFromLogEntry } from '../replay'
import { createCustomDeckMatch, type SwissRosterDeck } from '../tournament'
import { getBreakAreaLevel } from '../victory'
import type { AiDecision, AiLevel } from './types'
import type { CookieCard, GameState, PlayerId, PlayerState } from '../types'

const seed = 31018
const levels = [3, 4, 5] satisfies AiLevel[]
const cases = (['player-one', 'player-two'] as const).flatMap(actor =>
  levels.map(level => ({ actor, level })),
)
const fillerIds = [
  'BS1-010', 'BS1-019', 'BS1-020', 'BS1-021', 'BS1-027', 'BS1-043',
  'BS1-045', 'BS1-046', 'BS1-047', 'BS1-059', 'BS1-060', 'BS1-061', 'BS1-072',
]
const recipe: SwissRosterDeck = {
  id: 'prepared-public-refresh-survival-regression',
  name: 'Original inventory for public Refresh survival policy',
  color: 'purple', format: 'standard',
  entries: [...fillerIds, 'BS3-097', 'BS9-081'].map(cardNumber => ({ cardNumber, count: 4 })),
  extraDeckEntries: [], createdAt: '2026-10-18', updatedAt: '2026-10-18',
}
const printed = new Map([...bs1.cards, ...bs3.cards, ...bs9.cards]
  .map(card => [card.cardNumber, card] as const))

const takeCookies = (remaining: CookieCard[], id: string, count: number): CookieCard[] =>
  Array.from({ length: count }, () => {
    const index = remaining.findIndex(card => card.id === id)
    if (index < 0) throw new Error(`Missing original copy ${id}`)
    const card = remaining.splice(index, 1)[0]
    if (!card) throw new Error(`Missing original copy ${id}`)
    return card
  })

const expectOriginalInventory = (player: PlayerState) => {
  const cards = [
    ...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea,
    ...player.supportArea.map(support => support.card),
    ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
  ]
  expect(cards).toHaveLength(60)
  expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
  for (const entry of recipe.entries) {
    expect(cards.filter(card => card.id === entry.cardNumber)).toHaveLength(4)
  }
  for (const card of cards) {
    const original = printed.get(card.id)
    if (!original || card.type !== 'cookie') throw new Error(`Missing original Cookie ${card.id}`)
    expect(card).toMatchObject({
      name: original.name, level: original.level, hp: original.hp,
      attackText: original.attackText, imageUrl: original.imageUrl,
    })
    if (fillerIds.includes(card.id)) {
      expect(original.skill.text).toBeNull()
      expect(original.flipText).toBeNull()
      expect(card.skill).toBeUndefined()
      expect(card.flip).toBeUndefined()
      expect(card.attackEffects ?? []).toEqual([])
      expect(card.effects ?? []).toEqual([])
    }
  }
}

// Ported from the frozen b81 probe's six formal RED decisions. This rearranges
// real inventories at a public pending boundary; it is not a natural parent
// chain, a replay of the separate green UI loss, or full-match evidence.
const fixture = (actor: PlayerId, breakLevel: 7 | 8 | 9 = 8) => {
  const state = createCustomDeckMatch(seed, recipe, recipe, actor)
  const remaining = createDeckFromCustomDeck(recipe, actor).map(card => {
    if (card.type !== 'cookie') throw new Error('The original fixture contains only Cookies')
    return card
  })
  const breakArea = takeCookies(remaining, 'BS1-010', breakLevel === 7 ? 3 : 4)
  if (breakLevel !== 8) breakArea.push(...takeCookies(remaining, 'BS3-097', 1))
  const battleCard = takeCookies(remaining, 'BS1-019', 1)[0]!
  const hpCards = takeCookies(remaining, 'BS1-020', 4)
  const safe = remaining.find(card => card.id === 'BS3-097')
  const risky = remaining.find(card => card.id === 'BS9-081')
  if (!safe || !risky) throw new Error('Both original Refresh choices are required')
  state.players[actor] = {
    ...state.players[actor], deck: [], hand: [], supportArea: [], breakArea,
    discardPile: remaining, stage: null,
    battleArea: [{ card: battleCard, hpCards, rested: false,
      battleEntryId: `${actor}:prepared-refresh:1`, enteredFrom: 'hand', enteredTurn: 19 }],
  }
  state.status = 'playing'
  state.result = null
  state.phase = 'main'
  state.turnNumber = 20
  state.firstPlayerId = actor
  state.activePlayerId = actor
  state.commandLog = []
  state.skillUsesThisTurn = []
  state.pendingReplacement = null
  state.pendingOnPlay = null
  state.pendingBattle = null
  state.pendingRefresh = { playerId: actor, remainingDraws: 0 }
  expectOriginalInventory(state.players[actor])
  expect(battleCard).toMatchObject({ id: 'BS1-019', name: 'Walnut Cookie', level: 3, hp: 4, attack: 4 })
  expect(hpCards).toHaveLength(battleCard.hp)
  for (const player of Object.values(state.players)) {
    for (const cookie of player.battleArea) expect(cookie.hpCards).toHaveLength(cookie.card.hp)
  }
  expect(safe).toMatchObject({
    id: 'BS3-097', name: 'Licorice Cookie', level: 1, hp: 3, attack: 2, energyColor: 'purple',
  })
  expect(risky).toMatchObject({
    id: 'BS9-081', name: 'Grapefruit Cookie', level: 2, hp: 1, attack: 1, energyColor: 'blue',
  })
  expect(getBreakAreaLevel(state, actor)).toBe(breakLevel)
  expect(getRefreshCandidates(state, actor)).toEqual(state.players[actor].discardPile)
  return { state, safe, risky }
}

const commandFor = (decision: AiDecision, actor: PlayerId) => {
  expect(decision.action).toBe('refresh')
  expect(decision.error).toBeUndefined()
  expect(decision.state.commandLog).toHaveLength(1)
  const entry = decision.state.commandLog?.[0]
  if (!entry) throw new Error('Expected a formal command log entry')
  const command = commandFromLogEntry(entry)
  if (command.kind !== 'refresh-deck') throw new Error('Expected the formal refresh-deck command')
  expect(command.playerId).toBe(actor)
  return command
}

const choose = (state: GameState, actor: PlayerId, level: AiLevel) =>
  takeAiStep(state, actor, { level, seed, searchNow: () => 0, experienceProfile: null })

describe('AI Refresh preserves a publicly available way to survive', () => {
  it.each(cases)('$actor Lv$level survives Break8 instead of sacrificing the lower-retention LV2', ({ actor, level }) => {
    const { state, safe } = fixture(actor)
    const before = structuredClone(state)
    const safeCommand = {
      kind: 'refresh-deck', playerId: actor, cookieInstanceId: safe.instanceId, shuffleSeed: seed,
    } as const
    const safeControl = applyGameCommand(state, safeCommand)
    expect(safeControl.status).toBe('playing')
    expect(safeControl.result).toBeNull()
    expect(getBreakAreaLevel(safeControl, actor)).toBe(9)
    expect(safeControl.pendingRefresh).toBeNull()
    expect(safeControl.commandLog?.[0].payload).toEqual(safeCommand)
    expect(state).toEqual(before)

    const decision = choose(state, actor, level)
    const command = commandFor(decision, actor)
    const selected = getRefreshCandidates(before, actor)
      .find(card => card.instanceId === command.cookieInstanceId)
    expect(selected).toMatchObject({ id: 'BS3-097', level: 1 })
    expect(decision.state.status).toBe('playing')
    expect(decision.state.result).toBeNull()
    expect(getBreakAreaLevel(decision.state, actor)).toBe(9)
    expect(decision.state.pendingRefresh).toBeNull()
    expect(applyGameCommand(before, command)).toEqual(decision.state)
    expectOriginalInventory(decision.state.players[actor])
    expectOriginalInventory(safeControl.players[actor])
    expect(state).toEqual(before)
  })

  it.each(levels)('Lv%s still resolves Refresh when Break9 makes every legal choice fatal', level => {
    const actor = 'player-one'
    const { state } = fixture(actor, 9)
    const before = structuredClone(state)
    const candidates = getRefreshCandidates(state, actor)
    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates.every(card => getBreakAreaLevel(state, actor) + card.level >= 10)).toBe(true)

    const decision = choose(state, actor, level)
    const command = commandFor(decision, actor)
    expect(candidates.some(card => card.instanceId === command.cookieInstanceId)).toBe(true)
    expect(decision.state.status).toBe('finished')
    expect(decision.state.result).toEqual({
      loserId: actor, winnerId: 'player-two', reason: 'break-level-limit',
    })
    expect(decision.state.pendingRefresh).toBeNull()
    expect(applyGameCommand(before, command)).toEqual(decision.state)
    expect(state).toEqual(before)
  })

  it.each(levels)('Lv%s retains the ordinary retention preference among surviving choices', level => {
    const actor = 'player-one'
    const { state, safe, risky } = fixture(actor, 7)
    const before = structuredClone(state)
    // Both printed Cookies survive here. A survival guard must not replace
    // the existing policy with a blanket minimum-LV selector.
    for (const card of [safe, risky]) {
      const control = applyGameCommand(state, {
        kind: 'refresh-deck', playerId: actor, cookieInstanceId: card.instanceId, shuffleSeed: seed,
      })
      expect(control.status).toBe('playing')
      expect(control.result).toBeNull()
    }

    const decision = choose(state, actor, level)
    const command = commandFor(decision, actor)
    expect(getRefreshCandidates(state, actor).find(card => card.instanceId === command.cookieInstanceId))
      .toMatchObject({ id: 'BS9-081', level: 2 })
    expect(decision.state.status).toBe('playing')
    expect(getBreakAreaLevel(decision.state, actor)).toBe(9)
    expect(applyGameCommand(before, command)).toEqual(decision.state)
    expect(state).toEqual(before)
  })

  it('keeps candidate legality in the rules: hand, support and battle Cookies are not Refresh choices', () => {
    const actor = 'player-one'
    const { state } = fixture(actor)
    const player = state.players[actor]
    const handCard = player.discardPile.shift()
    const supportCard = player.discardPile.shift()
    if (!handCard || !supportCard) throw new Error('Original cards required for the zone boundary')
    player.hand.push(handCard)
    player.supportArea.push({ card: supportCard, rested: false })
    const before = structuredClone(state)
    expectOriginalInventory(player)
    expect(getRefreshCandidates(state, actor)).toEqual(player.discardPile)
    for (const card of [handCard, supportCard, player.battleArea[0].card]) {
      expect(getRefreshCandidates(state, actor).some(candidate => candidate.instanceId === card.instanceId)).toBe(false)
      expect(() => applyGameCommand(state, {
        kind: 'refresh-deck', playerId: actor, cookieInstanceId: card.instanceId, shuffleSeed: seed,
      })).toThrow(GameRuleError)
    }
    expect(state).toEqual(before)
  })

  it.each(levels)('Lv%s makes the same formal choice after hidden deck / HP permutations', level => {
    const actor = 'player-one'
    const { state } = fixture(actor)
    const permuted = structuredClone(state)
    // Blindly permute existing hidden arrays, without inspecting their faces.
    permuted.players['player-two'].deck.reverse()
    for (const player of Object.values(permuted.players)) {
      for (const cookie of player.battleArea) cookie.hpCards.reverse()
    }
    expect(permuted.players['player-two'].deck).not.toEqual(state.players['player-two'].deck)
    expect(permuted.players[actor].battleArea[0].hpCards).not.toEqual(state.players[actor].battleArea[0].hpCards)
    expect(createPlayerView(permuted, actor)).toEqual(createPlayerView(state, actor))
    const before = structuredClone(state)
    const permutedBefore = structuredClone(permuted)

    const originalDecision = choose(state, actor, level)
    const permutedDecision = choose(permuted, actor, level)
    expect(commandFor(permutedDecision, actor)).toEqual(commandFor(originalDecision, actor))
    expect(createPlayerView(permutedDecision.state, actor)).toEqual(createPlayerView(originalDecision.state, actor))
    expect(state).toEqual(before)
    expect(permuted).toEqual(permutedBefore)
  })
})
