import { describe, expect, it } from 'vitest'
import bs1 from '../../../data/cards/official-brave-beginning-bs1.en.json'
import bs10 from '../../../data/cards/official-paradise-of-passion-and-sloth-catacombs-of-silence-bs10.en.json'
import st2 from '../../../data/cards/official-starter-deck-yellow.en.json'
import yellowSnapshot from '../../../data/decks/cookierift-community-20261016.json'
import redSnapshot from '../../../data/decks/cookierift-community-20261017.json'
import { takeAiStep, type AiStrategyMemory } from '../ai'
import { applyGameCommand } from '../commands'
import { getActingPlayerId } from '../controller'
import { createPlayerView } from '../player-view'
import { commandFromLogEntry } from '../replay'
import { createCustomDeckMatch, type SwissRosterDeck } from '../tournament'
import type { AiDecision, AiLevel } from './types'
import type { CookieCard, GameState, PlayerId, PlayerState } from '../types'

const seed = 20261018047
const levels = [1, 2, 3, 4, 5] satisfies AiLevel[]
const actors = ['player-one', 'player-two'] as const
const negativeCases = actors.flatMap(actor => levels.map(level => ({ actor, level })))
const fillerIds = [
  'BS1-010', 'BS1-019', 'BS1-020', 'BS1-021', 'BS1-027', 'BS1-043',
  'BS1-045', 'BS1-046', 'BS1-047', 'BS1-059', 'BS1-060', 'BS1-061',
]
const recipe: SwissRosterDeck = {
  id: 'prepared-original-pavlova-hp-cost-target-regression',
  name: 'Original inventory for optional HP cost target policy',
  color: 'yellow', format: 'standard',
  entries: [...fillerIds, 'BS10-047', 'ST2-006', 'ST2-009']
    .map(cardNumber => ({ cardNumber, count: 4 })),
  extraDeckEntries: [], createdAt: '2026-10-18', updatedAt: '2026-10-18',
}
const printed = new Map([...bs1.cards, ...bs10.cards, ...st2.cards]
  .map(card => [card.cardNumber, card] as const))
const opponentOf = (actor: PlayerId): PlayerId => actor === 'player-one' ? 'player-two' : 'player-one'
type Scenario = 'last-hp' | 'two-hp' | 'two-last-hp'

const allCards = (player: PlayerState) => [
  ...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea,
  ...player.supportArea.map(support => support.card),
  ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
]
const expectOriginalInventory = (player: PlayerState) => {
  const cards = allCards(player)
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
      energyColor: original.color?.toLowerCase(),
    })
  }
}
const resetZones = (player: PlayerState) => {
  player.deck = allCards(player)
  player.hand = []
  player.battleArea = []
  player.supportArea = []
  player.breakArea = []
  player.discardPile = []
  player.stage = null
}
const takeCookie = (player: PlayerState, id: string): CookieCard => {
  const index = player.deck.findIndex(card => card.id === id)
  if (index < 0) throw new Error(`Missing original copy ${player.id} ${id}`)
  const card = player.deck.splice(index, 1)[0]
  if (!card || card.type !== 'cookie') throw new Error(`Expected original Cookie ${id}`)
  return card
}
const battleCookie = (player: PlayerState, id: string, hpId: string, sequence: number) => {
  const card = takeCookie(player, id)
  return {
    card,
    hpCards: Array.from({ length: card.hp }, () => takeCookie(player, hpId)),
    rested: false, battleEntryId: `${card.instanceId}:battle:${sequence}`,
    enteredFrom: 'hand' as const, enteredTurn: 1,
  }
}

const resolveOrdinaryDamage = (state: GameState, defender: PlayerId): GameState => {
  let next = applyGameCommand(state, { kind: 'skip-trap', playerId: defender })
  for (let count = 0; count < 10 && next.pendingBattle?.stage === 'damage'; count++) {
    next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: defender })
  }
  expect(next.pendingBattle?.stage).not.toBe('damage')
  expect(next.pendingBattle?.stage).not.toBe('flip')
  return next
}

// These are prepared original-card inventories, not a physical Browser/full-match
// claim. All HP starts at the printed value; actual ordinary attacks create the
// one-HP situations, then Pavlova's normal attack opens the real optional Then.
const fixture = (actor: PlayerId, scenario: Scenario) => {
  const foe = opponentOf(actor)
  let state = createCustomDeckMatch(seed, recipe, recipe, actor)
  for (const player of Object.values(state.players)) resetZones(player)
  const self = state.players[actor]
  const opponent = state.players[foe]
  const source = battleCookie(self, 'BS10-047', 'BS1-020', 1)
  const ally = scenario === 'two-last-hp' ? battleCookie(self, 'ST2-009', 'BS1-059', 2) : undefined
  self.battleArea = [source, ...(ally ? [ally] : [])]
  self.supportArea = Array.from({ length: 2 }, () => ({ card: takeCookie(self, 'BS1-043'), rested: false }))
  const gingerBright = battleCookie(opponent, 'ST2-006', 'BS1-020', 3)
  const gingerBrave = ally ? battleCookie(opponent, 'ST2-009', 'BS1-059', 4) : undefined
  opponent.battleArea = [gingerBright, ...(gingerBrave ? [gingerBrave] : [])]
  opponent.supportArea = Array.from({ length: ally ? 3 : 2 }, () => ({ card: takeCookie(opponent, 'BS1-043'), rested: false }))
  state.status = 'playing'
  state.result = null
  state.phase = 'main'
  state.turnNumber = 3
  state.firstPlayerId = actor
  state.activePlayerId = foe
  state.supportPlacedThisTurn = true
  state.skillUsesThisTurn = []
  state.nextBattleEntrySequence = 5
  state.commandLog = []
  state.pendingReplacement = null
  state.pendingOnPlay = null
  state.pendingBattle = null
  state.pendingAbilityEffect = undefined
  state.pendingOptionalCostAttack = null
  for (const player of Object.values(state.players)) {
    expectOriginalInventory(player)
    for (const cookie of player.battleArea) expect(cookie.hpCards).toHaveLength(cookie.card.hp)
  }
  expect(source.card).toMatchObject({
    id: 'BS10-047', name: 'Pavlova Cookie', level: 1, hp: 2,
    attack: 2, attackEnergyCost: { yellow: 2 }, energyColor: 'yellow',
  })
  expect(source.card.attackEffects).toEqual([{
    kind: 'optional-cost-attack', cost: { energy: {}, discardHand: 0, hpToTrash: { amount: 1 } },
    effects: [{ kind: 'gain-hp', amount: 1, target: { side: 'self', min: 0, max: 1 } }],
    effectText: expect.any(String),
  }])
  expect(gingerBright.card).toMatchObject({ id: 'ST2-006', name: 'GingerBright', hp: 4, attack: 1 })
  if (scenario !== 'two-hp') {
    state = applyGameCommand(state, {
      kind: 'declare-attack', playerId: foe, attackerInstanceId: gingerBright.card.instanceId,
      targetInstanceId: source.card.instanceId,
      supportPaymentIds: opponent.supportArea.slice(0, 2).map(support => support.card.instanceId),
    })
    state = resolveOrdinaryDamage(state, actor)
    expect(state.pendingBattle).toBeNull()
    expect(state.players[actor].battleArea.find(cookie => cookie.card.instanceId === source.card.instanceId)?.hpCards)
      .toHaveLength(1)
    if (ally && gingerBrave) {
      state = applyGameCommand(state, {
        kind: 'declare-attack', playerId: foe, attackerInstanceId: gingerBrave.card.instanceId,
        targetInstanceId: ally.card.instanceId,
        supportPaymentIds: [opponent.supportArea[2]!.card.instanceId],
      })
      state = resolveOrdinaryDamage(state, actor)
      expect(state.pendingBattle).toBeNull()
      expect(state.players[actor].battleArea.every(cookie => cookie.hpCards.length === 1)).toBe(true)
    }
  }
  // End the opponent turn and execute the actual Active/Draw/Support phases.
  for (const playerId of [foe, foe, actor, actor, actor]) {
    state = applyGameCommand(state, { kind: 'advance-phase', playerId })
  }
  expect(state.activePlayerId).toBe(actor)
  expect(state.phase).toBe('main')
  expect(state.turnNumber).toBe(4)
  state = applyGameCommand(state, {
    kind: 'declare-attack', playerId: actor, attackerInstanceId: source.card.instanceId,
    targetInstanceId: gingerBright.card.instanceId,
    supportPaymentIds: self.supportArea.map(support => support.card.instanceId),
  })
  state = resolveOrdinaryDamage(state, foe)
  expect(state.pendingBattle?.stage).toBe('attack-effect')
  expect(state.players[foe].battleArea.find(cookie => cookie.card.instanceId === gingerBright.card.instanceId)?.hpCards)
    .toHaveLength(2)
  state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: actor, targetIds: [] })
  expect(state.pendingOptionalCostAttack).toMatchObject({
    playerId: actor, sourceInstanceId: source.card.instanceId, sourceCardName: 'Pavlova Cookie',
    cost: { hpToTrash: { amount: 1 } },
    effects: [{ kind: 'gain-hp', amount: 1, target: { side: 'self', min: 0, max: 1 } }],
  })
  for (const player of Object.values(state.players)) expectOriginalInventory(player)
  return { state, sourceId: source.card.instanceId, allyId: ally?.card.instanceId }
}

const choose = (state: GameState, actor: PlayerId, level: AiLevel, decisionSeed = seed, memory?: AiStrategyMemory) =>
  takeAiStep(state, actor, { level, seed: decisionSeed, memory, searchNow: () => 0 })

const newPayloads = (before: GameState, decision: AiDecision) =>
  decision.state.commandLog?.slice(before.commandLog?.length ?? 0).map(entry => entry.payload)

const expectSafeSkip = (state: GameState, actor: PlayerId, sourceId: string, level: AiLevel,
  decisionSeed = seed, memory?: AiStrategyMemory) => {
  const before = structuredClone(state)
  const skip = { kind: 'resolve-optional-cost-attack', playerId: actor, action: 'skip' } as const
  const control = applyGameCommand(state, skip)
  expect(control.pendingOptionalCostAttack).toBeNull()
  expect(control.players[actor].battleArea.find(cookie => cookie.card.instanceId === sourceId)?.hpCards).toHaveLength(1)
  const decision = choose(state, actor, level, decisionSeed, memory)
  // Exact legal policy behavior, rather than merely accepting any non-throwing step.
  expect(newPayloads(before, decision)).toEqual([skip])
  expect(decision.action).toBe('resolve-optional-cost-attack')
  expect(decision.error).toBeUndefined()
  expect(decision.state).toEqual(control)
  expect(decision.state.players[actor].breakArea).toEqual(before.players[actor].breakArea)
  expect(decision.state.players[actor].discardPile).toEqual(before.players[actor].discardPile)
  expect(state).toEqual(before)
  return decision
}

const expectUsefulPayment = (state: GameState, actor: PlayerId, level: AiLevel, scenario: Scenario) => {
  const before = structuredClone(state)
  const decision = choose(state, actor, level)
  expect(decision.error).toBeUndefined()
  expect(decision.action).toBe('resolve-optional-cost-attack')
  const entry = decision.state.commandLog?.at(-1)
  if (!entry) throw new Error('Expected the formal HP payment command')
  const command = commandFromLogEntry(entry)
  expect(command.kind).toBe('resolve-optional-cost-attack')
  if (command.kind !== 'resolve-optional-cost-attack') throw new Error('Expected optional attack cost command')
  expect(command.action).toBe('pay')
  expect(command.hpToTrashIds).toHaveLength(1)
  expect(command.targetIds).toHaveLength(1)
  expect(decision.state.pendingOptionalCostAttack).toBeNull()
  expect(decision.state.pendingBattle).toBeNull()
  // Replaying the actual selected command through the rules must accept its
  // post-payment recipient and exactly reproduce both payment and HP gain.
  expect(applyGameCommand(before, command)).toEqual(decision.state)
  const targetId = command.targetIds?.[0]
  const recipient = decision.state.players[actor].battleArea.find(cookie => cookie.card.instanceId === targetId)
  expect(recipient?.hpCards).toHaveLength(2)
  expect(decision.state.players[actor].deck).toHaveLength(before.players[actor].deck.length - 1)
  expect(decision.state.players[actor].discardPile).toHaveLength(before.players[actor].discardPile.length + 1)
  if (scenario === 'two-last-hp') {
    // Both legal payers initially have 1 HP: a useful heal can still pay a last
    // HP, provided the selected recipient is the other surviving Cookie.
    expect(before.players[actor].battleArea.every(cookie => cookie.hpCards.length === 1)).toBe(true)
    expect(targetId).not.toBe(command.hpToTrashIds?.[0])
    expect(decision.state.players[actor].battleArea).toHaveLength(1)
    expect(decision.state.players[actor].breakArea).toHaveLength(before.players[actor].breakArea.length + 1)
    expect(decision.state.players[actor].breakArea.at(-1)?.instanceId).toBe(command.hpToTrashIds?.[0])
  } else {
    expect(targetId).toBe(command.hpToTrashIds?.[0])
    expect(decision.state.players[actor].breakArea).toEqual(before.players[actor].breakArea)
  }
  expectOriginalInventory(decision.state.players[actor])
  expect(state).toEqual(before)
  return decision
}

const permuteConcealedResources = (state: GameState, actor: PlayerId): GameState => {
  const changed = structuredClone(state)
  const self = changed.players[actor]
  const hp = self.battleArea[0]?.hpCards
  const topDeck = self.deck[0]
  if (!hp?.[0] || !topDeck) throw new Error('Fixture requires an unknown HP and deck card')
  const hpCard = hp[0]
  hp[0] = topDeck
  self.deck[0] = hpCard
  for (const player of Object.values(changed.players)) {
    player.deck.reverse()
    for (const cookie of player.battleArea) cookie.hpCards.reverse()
  }
  expect(createPlayerView(changed, actor)).toEqual(createPlayerView(state, actor))
  for (const player of Object.values(changed.players)) expectOriginalInventory(player)
  return changed
}

describe('AI optional HP cost chooses a recipient that exists after payment', () => {
  it.each(negativeCases)('$actor Lv$level skips the original Pavlova Then when its only recipient would faint', ({ actor, level }) => {
    const { state, sourceId } = fixture(actor, 'last-hp')
    expect(state.players[actor].battleArea).toHaveLength(1)
    expectSafeSkip(state, actor, sourceId, level)
  })

  it.each(levels)('Lv%s can pay and heal the original Pavlova when its 2 HP lets it survive payment', level => {
    const { state } = fixture('player-one', 'two-hp')
    expectUsefulPayment(state, 'player-one', level, 'two-hp')
  })

  it.each(levels)('Lv%s can pay a last HP when another original Cookie survives to receive the heal', level => {
    const { state } = fixture('player-one', 'two-last-hp')
    expectUsefulPayment(state, 'player-one', level, 'two-last-hp')
  })

  it.each(['last-hp', 'two-hp', 'two-last-hp'] as const)('keeps the %s command unchanged under the same PlayerView with different hidden HP/deck order', scenario => {
    const actor = 'player-one'
    const { state, sourceId } = fixture(actor, scenario)
    const changed = permuteConcealedResources(state, actor)
    const first = scenario === 'last-hp'
      ? expectSafeSkip(state, actor, sourceId, 5)
      : expectUsefulPayment(state, actor, 5, scenario)
    const second = scenario === 'last-hp'
      ? expectSafeSkip(changed, actor, sourceId, 5)
      : expectUsefulPayment(changed, actor, 5, scenario)
    expect(newPayloads(state, first)).toEqual(newPayloads(changed, second))
    expect(first.action).toBe(second.action)
  })

  it('preserves Pavlova at the exact original 1239-vs-1295 seed 211203400 failure boundary', () => {
    const originalSeed = 211203400
    const yellow = yellowSnapshot.decks.find(deck => deck.sourceId === 1239)
    const red = redSnapshot.decks.find(deck => deck.sourceId === 1295)
    if (!yellow || !red) throw new Error('Expected the original measured recipe snapshots')
    const parseEntries = (text: string) => text.trim().split(/\s+/).filter(Boolean).map(part => {
      const match = /^([^:]+):(\d+)$/.exec(part)
      if (!match) throw new Error(`Invalid original recipe entry ${part}`)
      return { cardNumber: match[1]!, count: Number(match[2]) }
    })
    const originalRecipe = (source: { sourceId: number; name: string; main: string; extra?: string },
      color: 'yellow' | 'red', snapshotDate: string): SwissRosterDeck => ({
      id: `cookierift-${source.sourceId}`, name: source.name,
      color, format: 'standard', entries: parseEntries(source.main),
      extraDeckEntries: parseEntries(source.extra ?? ''),
      createdAt: snapshotDate, updatedAt: snapshotDate,
    })
    let state = createCustomDeckMatch(originalSeed,
      originalRecipe(yellow, 'yellow', yellowSnapshot.retrievedAt),
      originalRecipe(red, 'red', redSnapshot.retrievedAt), 'player-two')
    const memories: Partial<Record<PlayerId, AiStrategyMemory>> = {}
    for (let index = 0; index < 27; index++) {
      const actor = getActingPlayerId(state)
      const decision = choose(state, actor, 5, originalSeed, memories[actor])
      expect(decision.error, `Original seed action ${index + 1}: ${decision.description}`).toBeUndefined()
      expect(decision.state).not.toBe(state)
      if (decision.reason?.strategyMemory) memories[actor] = decision.reason.strategyMemory
      state = decision.state
    }
    const actor = getActingPlayerId(state)
    expect(actor).toBe('player-one')
    expect(state.turnNumber).toBe(4)
    expect(state.phase).toBe('main')
    expect(state.commandLog).toHaveLength(27)
    expect(state.pendingOptionalCostAttack?.sourceInstanceId).toBe('player-one-BS10-047-3')
    expect(state.players[actor].battleArea).toHaveLength(1)
    expect(state.players[actor].battleArea[0]?.card).toMatchObject({
      id: 'BS10-047', name: 'Pavlova Cookie', level: 1, hp: 2, attack: 2,
    })
    expect(state.players[actor].battleArea[0]?.hpCards).toHaveLength(1)
    expectSafeSkip(state, actor, 'player-one-BS10-047-3', 5, originalSeed, memories[actor])
  }, 30000)
})
