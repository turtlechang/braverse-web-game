import { describe, expect, it } from 'vitest'
import { getActingPlayerId } from '..'
import { takeAiStep } from '../ai'
import { applyGameCommand } from '../commands'
import { getLegalTurnCommands } from '../legal-actions'
import { hasBlockingPending } from '../pending'
import { createPlayerView } from '../player-view'
import { createCustomDeckMatch, type SwissRosterDeck } from '../tournament'
import type { AiLevel } from './types'
import type { CookieCard, GameCard, GameState, PlayerState } from '../types'

const owner = 'player-one' as const
const opponent = 'player-two' as const
const seed = 2026101801
const recipe: SwissRosterDeck = {
  id: 'healer-reentry-regression',
  name: 'Original green cards for a public reentry sequence',
  color: 'green',
  format: 'standard',
  createdAt: '2026-10-18',
  updatedAt: '2026-10-18',
  entries: [
    'BS7-044', 'BS7-046', 'BS7-049', 'BS7-051', 'BS7-052',
    'BS7-053', 'BS7-054', 'BS7-055', 'BS7-056', 'BS7-057',
    'BS7-058', 'BS7-063', 'BS7-064', 'BS7-065', 'ST3-016',
  ].map(cardNumber => ({ cardNumber, count: 4 })),
  extraDeckEntries: [],
}

const resetZones = (player: PlayerState) => {
  player.deck = [
    ...player.deck,
    ...player.hand,
    ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
    ...player.supportArea.map(support => support.card),
    ...player.breakArea,
    ...player.discardPile,
  ]
  player.hand = []
  player.battleArea = []
  player.supportArea = []
  player.breakArea = []
  player.discardPile = []
  player.stage = null
}

const take = (player: PlayerState, id: string): GameCard => {
  const index = player.deck.findIndex(card => card.id === id)
  if (index < 0) throw new Error(`Missing original copy ${player.id} ${id}`)
  return player.deck.splice(index, 1)[0]!
}

const takeCookie = (player: PlayerState, id: string): CookieCard => {
  const card = take(player, id)
  if (card.type !== 'cookie') throw new Error(`Expected original Cookie ${id}`)
  return card
}

const battleCookie = (card: CookieCard, hpCards: GameCard[], entry: number) => ({
  card,
  hpCards,
  rested: false,
  battleEntryId: `${card.instanceId}:battle:${entry}`,
  enteredFrom: 'hand' as const,
  enteredTurn: 1,
})

const settlePending = (initial: GameState): GameState => {
  let state = initial
  for (let action = 0; hasBlockingPending(state) && action < 40; action += 1) {
    const playerId = getActingPlayerId(state)
    const decision = takeAiStep(state, playerId, { level: 3, seed, searchNow: () => 0 })
    if (decision.action === 'error' || decision.state === state) {
      throw new Error(`Parent attack did not progress: ${decision.action}`)
    }
    state = decision.state
  }
  if (hasBlockingPending(state)) throw new Error('Parent attack did not settle')
  return state
}

// A legal 60-card original inventory is rearranged to isolate this public policy
// counterexample. The two parent attacks use real commands; this is not a replay
// of the video or full-match acceptance evidence.
const fixture = (withStage = false) => {
  let state = createCustomDeckMatch(seed, recipe, recipe, owner)
  for (const player of Object.values(state.players)) resetZones(player)
  const self = state.players[owner]
  const foe = state.players[opponent]
  const mousse = takeCookie(self, 'BS7-046')
  const glitter = takeCookie(self, 'BS7-055')
  const healer = take(self, 'ST3-016')
  self.hand = [healer]
  self.battleArea = [
    battleCookie(mousse, Array.from({ length: 4 }, () => take(self, 'BS7-056')), 1),
    battleCookie(glitter, [
      ...Array.from({ length: 4 }, () => take(self, 'BS7-053')),
      take(self, 'BS7-051'),
    ], 2),
  ]
  self.supportArea = ['BS7-063', 'BS7-064', 'BS7-065'].flatMap(id =>
    Array.from({ length: withStage && id === 'BS7-065' ? 3 : 4 }, () => ({ card: take(self, id), rested: false })),
  )
  if (withStage) {
    self.stage = { card: take(self, 'BS7-065'), rested: false }
    self.supportArea.push(...Array.from({ length: 2 }, () => ({ card: take(self, 'ST3-016'), rested: false })))
  }
  const licorice = takeCookie(foe, 'BS7-044')
  const vampire = takeCookie(foe, 'BS7-052')
  foe.battleArea = [
    battleCookie(licorice, Array.from({ length: 3 }, () => take(foe, 'ST3-016')), 3),
    battleCookie(vampire, [
      ...Array.from({ length: 4 }, () => take(foe, 'BS7-049')),
      ...Array.from({ length: 2 }, () => take(foe, 'BS7-054')),
    ], 4),
  ]
  foe.breakArea = [takeCookie(foe, 'BS7-052'), takeCookie(foe, 'BS7-046')]
  state = {
    ...state,
    activePlayerId: owner,
    phase: 'main',
    turnNumber: 3,
    supportPlacedThisTurn: true,
    skillUsesThisTurn: [],
    departedCookieCounts: { [owner]: 0, [opponent]: 0 },
    nextBattleEntrySequence: 5,
    commandLog: [],
  }
  for (const [source, target] of [[glitter, licorice], [mousse, vampire]]) {
    const attack = getLegalTurnCommands(state, owner).find(command =>
      command.kind === 'attack' && command.attackerInstanceId === source.instanceId &&
      command.targetInstanceId === target.instanceId,
    )
    if (!attack) throw new Error('Original parent attack is not legal')
    state = settlePending(applyGameCommand(state, attack))
  }
  return { state, mousse, glitter, healer, vampire }
}

const spendGlitterOnce = (state: GameState, glitter: CookieCard): GameState =>
  applyGameCommand(state, {
    kind: 'activate-skill', playerId: owner, sourceInstanceId: glitter.instanceId,
    trigger: 'activate', paymentIds: [], effectTargets: [[]],
  }, { shuffleSeed: seed })

const assertOriginalInventory = (state: GameState) => {
  for (const player of Object.values(state.players)) {
    const cards = [
      ...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile,
      ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
      ...player.supportArea.map(support => support.card), ...(player.stage ? [player.stage.card] : []),
    ]
    expect(cards).toHaveLength(60)
    expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
    for (const entry of recipe.entries) expect(cards.filter(card => card.id === entry.cardNumber)).toHaveLength(4)
  }
}

const playToFinish = (initial: GameState) => {
  let state = initial
  const commands: string[] = []
  for (let step = 0; state.status === 'playing' && step < 24; step += 1) {
    const actor = getActingPlayerId(state)
    const decision = takeAiStep(state, actor, { level: actor === owner ? 5 : 3, seed, searchNow: () => 0 })
    expect(decision.error).toBeUndefined()
    if (decision.state === state) throw new Error('Reentry did not progress')
    commands.push(decision.state.commandLog?.at(-1)?.commandKind ?? decision.action)
    state = decision.state
  }
  return { state, commands }
}

describe('AI public Healer and support reentry sequence', () => {
  it.each([3, 4, 5] as AiLevel[])('Lv%s uses Healer to reopen the Green Tea Mousse attack through Shining Glitter', level => {
    const { state, mousse, healer, vampire } = fixture()
    const before = structuredClone(state)
    expect(state.players[owner].battleArea.every(cookie => cookie.rested)).toBe(true)
    expect(state.players[owner].supportArea.filter(support => !support.rested)).toHaveLength(6)
    expect(state.players[opponent].breakArea.reduce((sum, card) => sum + card.level, 0)).toBe(7)
    expect(state.players[opponent].battleArea[0].card.instanceId).toBe(vampire.instanceId)
    expect(state.players[opponent].battleArea[0].hpCards).toHaveLength(3)

    assertOriginalInventory(state)
    const decision = takeAiStep(state, owner, { level, seed, searchNow: () => 0 })
    expect(decision.action).toBe('play-item')
    expect(decision.state.players[owner].supportArea.find(support =>
      support.card.instanceId === mousse.instanceId,
    )?.rested).toBe(false)
    expect(decision.state.players[owner].discardPile.map(card => card.instanceId))
      .toContain(healer.instanceId)
    expect(state).toEqual(before)
  })

  it('executes the real replacement, reentry, On Play skip and final attack to victory', () => {
    const { state, mousse } = fixture()
    const result = playToFinish(state)
    expect(result.commands.slice(0, 5)).toEqual([
      'play-item', 'skip-replacement', 'activate-skill', 'skip-on-play', 'declare-attack',
    ])
    expect(result.state.status).toBe('finished')
    expect(result.state.result?.winnerId).toBe(owner)
    expect(result.state.players[owner].battleArea.find(cookie => cookie.card.instanceId === mousse.instanceId)?.rested).toBe(true)
    expect(result.state.players[opponent].breakArea.reduce((sum, card) => sum + card.level, 0)).toBe(10)
    assertOriginalInventory(result.state)
  })

  it('does not forecast reentry after the enabler has actually spent Once', () => {
    const { state, glitter } = fixture()
    const used = spendGlitterOnce(state, glitter)
    const decision = takeAiStep(used, owner, { level: 5, seed, searchNow: () => 0 })
    expect(decision.action).toBe('advance-phase')
    expect(decision.reason?.actionScore?.contributions.some(part => part.id === 'support-reentry-followup')).toBe(false)
  })

  it('does not credit an attack that is unaffordable after paying Healer', () => {
    const { state } = fixture()
    const active = state.players[owner].supportArea.find(support => !support.rested)!
    active.rested = true
    expect(state.players[owner].supportArea.filter(support => !support.rested)).toHaveLength(5)
    const decision = takeAiStep(state, owner, { level: 5, seed, searchNow: () => 0 })
    expect(decision.action).toBe('advance-phase')
    expect(decision.reason?.actionScore?.contributions.some(part => part.id === 'support-reentry-followup')).toBe(false)
  })

  it('takes the already available public finishing attack before resetting its source', () => {
    const { state, mousse, vampire } = fixture()
    state.players[owner].battleArea.find(cookie => cookie.card.instanceId === mousse.instanceId)!.rested = false
    const decision = takeAiStep(state, owner, { level: 5, seed, searchNow: () => 0 })
    expect(decision.action).toBe('attack')
    expect(decision.state.commandLog?.at(-1)?.payload).toMatchObject({
      attackerInstanceId: mousse.instanceId, targetInstanceId: vampire.instanceId,
    })
  })

  it('keeps the same decision and estimate when unknown HP and deck cards change', () => {
    const { state, mousse } = fixture()
    const changed = structuredClone(state)
    const source = changed.players[owner].battleArea.find(cookie => cookie.card.instanceId === mousse.instanceId)!
    const index = changed.players[owner].deck.findIndex(card => card.id === 'BS7-044')
    const unknown = source.hpCards[0]
    source.hpCards[0] = changed.players[owner].deck[index]
    changed.players[owner].deck[index] = unknown
    changed.players[owner].deck.reverse()
    changed.players[opponent].deck.reverse()
    expect(createPlayerView(changed, owner)).toEqual(createPlayerView(state, owner))
    assertOriginalInventory(changed)
    const options = { level: 5 as const, seed, searchNow: () => 0 }
    const originalDecision = takeAiStep(state, owner, options)
    const changedDecision = takeAiStep(changed, owner, options)
    expect(changedDecision.state.commandLog?.at(-1)?.payload).toEqual(originalDecision.state.commandLog?.at(-1)?.payload)
    expect(changedDecision.reason?.actionScore).toEqual(originalDecision.reason?.actionScore)
    expect(changedDecision.action).toBe('play-item')
  })

  it('uses the original Stadium when Shining Glitter Once is spent', () => {
    const { state, glitter } = fixture(true)
    const used = spendGlitterOnce(state, glitter)
    assertOriginalInventory(used)
    const decision = takeAiStep(used, owner, { level: 5, seed, searchNow: () => 0 })
    expect(decision.action).toBe('play-item')
    expect(decision.reason?.actionScore?.contributions.some(part => part.id === 'support-reentry-followup' && part.amount > 0)).toBe(true)
    const result = playToFinish(used)
    expect(result.commands.slice(0, 3)).toEqual(['play-item', 'skip-replacement', 'activate-stage'])
    expect(result.state.players[owner].stage?.rested).toBe(true)
    expect(result.state.status).toBe('finished')
    expect(result.state.result?.winnerId).toBe(owner)
    assertOriginalInventory(result.state)
  })

  it('does not credit a prepared rested Stadium', () => {
    const { state, glitter } = fixture(true)
    const used = spendGlitterOnce(state, glitter)
    // Prepared policy counterexample: the stage is already REST before Healer.
    // The positive case above separately exercises its real activation.
    used.players[owner].stage!.rested = true
    expect(used.players[owner].stage?.rested).toBe(true)
    const decision = takeAiStep(used, owner, { level: 5, seed, searchNow: () => 0 })
    expect(decision.action).toBe('advance-phase')
    expect(decision.reason?.actionScore?.contributions.some(part => part.id === 'support-reentry-followup')).toBe(false)
  })

  it('does not move its last battle Cookie into a replacement window that ends the game', () => {
    const { state, glitter } = fixture()
    const self = state.players[owner]
    const source = self.battleArea.find(cookie => cookie.card.instanceId === glitter.instanceId)!
    self.battleArea = self.battleArea.filter(cookie => cookie !== source)
    self.deck.push(source.card, ...source.hpCards)
    assertOriginalInventory(state)
    const decision = takeAiStep(state, owner, { level: 5, seed, searchNow: () => 0 })
    expect(decision.action).toBe('advance-phase')
    expect(decision.reason?.actionScore?.contributions.some(part => part.id === 'support-reentry-followup')).toBe(false)
  })
})
