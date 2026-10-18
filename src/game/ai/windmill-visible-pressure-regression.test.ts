import { describe, expect, it } from 'vitest'
import { takeAiStep } from '../ai'
import { getCardPoolEntry } from '../card-pool'
import { applyGameCommand } from '../commands'
import { getAttackDamageAgainst } from '../effects'
import { getAttackEnergyCostForState, selectEnergyPayment } from '../energy'
import { commandFromLogEntry } from '../replay'
import { createGame } from '../setup'
import { createCard, createDeckForChoice, createExtraDeckForChoice } from '../starter-deck'
import type { CookieCard, GameCard, GameState, PlayerId } from '../types'

const human = 'player-one' as const
const ai = 'player-two' as const

// The public TURN 2 report uses this 60-card ST1 recipe. This is a pure-rule
// regression with rearranged physical zones, not an exact replay of all setup,
// draws, hidden HP faces or the complete naturally played UI match.
// Source: test-results/active-tactical-st1-vs-lv5-bs12-green-arena-
// 20261018-1792271707838-15796/report.json, humanDeck and publicLogText.
const humanRecipe = [
  ['ST1-002', 4], ['ST1-003', 4], ['ST1-005', 4], ['ST1-006', 4],
  ['ST1-007', 4], ['ST1-008', 4], ['ST1-009', 4], ['ST1-010', 4],
  ['ST1-011', 4], ['ST1-012', 4], ['ST1-001', 4], ['ST1-004', 4],
  ['ST1-013', 4], ['ST1-015', 4], ['ST1-016', 2], ['ST1-020', 2],
] as const

const printed = (id: string, owner: PlayerId, copy: number): GameCard => {
  const source = getCardPoolEntry(id)
  if (!source) throw new Error(`Missing original printing ${id}`)
  return createCard(source, owner, copy)
}

const takeCard = (state: GameState, owner: PlayerId, id: string): GameCard => {
  const player = state.players[owner]
  const index = player.deck.findIndex(card => card.id === id)
  if (index < 0) throw new Error(`Missing physical deck card ${owner}/${id}`)
  return player.deck.splice(index, 1)[0]!
}

const addBattleCookie = (state: GameState, owner: PlayerId, id: string): CookieCard => {
  const card = takeCard(state, owner, id)
  if (card.type !== 'cookie') throw new Error(`Expected printed Cookie ${id}`)
  const hpCards = state.players[owner].deck.splice(-card.hp, card.hp)
  if (hpCards.length !== card.hp) throw new Error(`Cannot supply printed HP for ${id}`)
  state.players[owner].battleArea.push({
    card,
    hpCards,
    rested: false,
    battleEntryId: `${card.instanceId}:windmill-regression`,
  })
  return card
}

const physicalCards = (state: GameState, owner: PlayerId): GameCard[] => {
  const player = state.players[owner]
  return [
    ...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea,
    ...player.supportArea.map(support => support.card),
    ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
    ...(player.stage ? [player.stage.card] : []),
  ]
}

const expectPhysicalDeck = (state: GameState, owner: PlayerId) => {
  const cards = physicalCards(state, owner)
  expect(cards).toHaveLength(60)
  expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
  const counts = new Map<string, number>()
  for (const card of cards) {
    counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
    const original = getCardPoolEntry(card.id)
    expect(original, card.id).toBeDefined()
    expect(card.imageUrl, card.id).toBe(original!.imageUrl)
  }
  expect([...counts.values()].every(count => count <= 4)).toBe(true)
}

const fixture = (extraRedSupports = 0, recoveryCookie = false) => {
  let state = createGame(
    { id: human, name: 'ST1 human', deck: humanRecipe.flatMap(([id, count]) =>
      Array.from({ length: count }, (_, copy) => printed(id, human, copy + 1))) },
    { id: ai, name: 'Green Arena AI', deck: createDeckForChoice('bs12-green-arena', ai),
      extraDeck: createExtraDeckForChoice('bs12-green-arena', ai) },
    ai,
    cards => [...cards],
  )
  for (const player of Object.values(state.players)) {
    player.deck = [...player.hand, ...player.deck]
    player.hand = []
    player.startingCookieSelected = true
  }
  state.status = 'playing'
  state.activePlayerId = human
  state.turnNumber = 2
  state.phase = 'support'
  const leek = addBattleCookie(state, human, 'ST1-005')
  const mint = addBattleCookie(state, human, 'ST1-007')
  const target = addBattleCookie(state, ai, 'BS7-046')
  addBattleCookie(state, ai, 'BS7-059')
  const trophy = takeCard(state, ai, 'BS7-063')
  const windmill = takeCard(state, ai, 'BS7-064')
  state.players[ai].supportArea = [{ card: trophy, rested: false }]
  state.players[ai].hand = [windmill]
  const recovered = recoveryCookie ? takeCard(state, ai, 'BS7-049') : undefined
  if (recovered) state.players[ai].discardPile.push(recovered)
  for (let index = 0; index < extraRedSupports; index++) {
    state.players[human].supportArea.push({
      card: takeCard(state, human, 'ST1-003'), rested: false,
    })
  }
  const placedSupport = takeCard(state, human, 'ST1-003')
  state.players[human].hand = [placedSupport]
  state = applyGameCommand(state, {
    kind: 'place-support', playerId: human, instanceId: placedSupport.instanceId,
  })
  state = applyGameCommand(state, { kind: 'advance-phase', playerId: human })
  state = applyGameCommand(state, {
    kind: 'declare-attack', playerId: human,
    attackerInstanceId: leek.instanceId, targetInstanceId: target.instanceId,
    supportPaymentIds: [placedSupport.instanceId],
  })
  expect(state.pendingBattle?.stage).toBe('trap')
  expectPhysicalDeck(state, human)
  expectPhysicalDeck(state, ai)
  expect(leek).toMatchObject({ level: 2, hp: 3, attack: 1, attackCost: 1 })
  expect(mint).toMatchObject({ level: 3, hp: 3, attack: 2, attackEnergyCost: { red: 2 } })
  expect(target).toMatchObject({ level: 2, hp: 4, attack: 3 })
  expect(getAttackDamageAgainst(state, leek.instanceId, target.instanceId)).toBe(1)
  return { state, leek, mint, target, trophy, windmill, recovered }
}

const decide = (state: GameState) => {
  const before = structuredClone(state)
  const decision = takeAiStep(state, ai, { level: 5, seed: 204518020, searchNow: () => 0 })
  expect(decision.action).not.toBe('error')
  expect(state).toEqual(before)
  const entry = decision.state.commandLog?.slice(state.commandLog?.length ?? 0)
    .find(candidate => candidate.commandKind === 'play-trap' || candidate.commandKind === 'skip-trap')
  expect(entry).toBeDefined()
  if (!entry) throw new Error('Expected an actual trap-response command log entry')
  const command = commandFromLogEntry(entry)
  return { decision, command }
}

const swapHiddenPhysicalCards = (state: GameState, owner: PlayerId): GameState => {
  const changed = structuredClone(state)
  const player = changed.players[owner]
  const exchangeWithDeck = (card: GameCard): GameCard => {
    const index = player.deck.findIndex(candidate => candidate.id !== card.id)
    if (index < 0) throw new Error('Expected a different physical hidden face')
    const exchanged = player.deck[index]!
    player.deck[index] = card
    return exchanged
  }
  for (const cookie of player.battleArea) {
    cookie.hpCards = cookie.hpCards.map(exchangeWithDeck)
  }
  // The AI's own hand is visible. Only the opponent's existing hidden hand is
  // exchanged; every swapped face retains its original printed instance.
  if (owner === human) player.hand = player.hand.map(exchangeWithDeck)
  player.deck.reverse()
  expectPhysicalDeck(changed, owner)
  expect(physicalCards(changed, owner).map(card => card.instanceId).sort())
    .toEqual(physicalCards(state, owner).map(card => card.instanceId).sort())
  return changed
}

describe('Cookie Windmill visible attack pressure', () => {
  it('does not spend the sole green support to reduce an unpayable Mint instead of the attacking Leek', () => {
    const { state, leek, mint, target, trophy, windmill } = fixture()
    expect(state.players[human].supportArea).toHaveLength(1)
    expect(state.players[human].supportArea[0].rested).toBe(true)
    expect(selectEnergyPayment(getAttackEnergyCostForState(state, mint.instanceId),
      state.players[human].supportArea)).toBeNull()
    expect(state.players[ai].discardPile).toEqual([])

    const { decision, command } = decide(state)
    if (command?.kind === 'skip-trap') {
      expect(decision.state.players[ai].hand).toContainEqual(windmill)
      expect(decision.state.players[ai].supportArea).toEqual([{ card: trophy, rested: false }])
    } else {
      expect(command?.kind).toBe('play-trap')
      if (command?.kind !== 'play-trap') throw new Error('Expected actual trap response')
      expect(command.trapInstanceId).toBe(windmill.instanceId)
      expect(command.effectTargets?.[0]).toEqual([leek.instanceId])
      expect(getAttackDamageAgainst(decision.state, leek.instanceId, target.instanceId)).toBe(0)
    }
  })

  it('permits reduction of the later Mint when two real red supports remain available for RR', () => {
    const { state, mint, windmill } = fixture(2)
    expect(selectEnergyPayment(getAttackEnergyCostForState(state, mint.instanceId),
      state.players[human].supportArea)).toHaveLength(2)
    const { command } = decide(state)
    expect(command?.kind).toBe('play-trap')
    if (command?.kind !== 'play-trap') throw new Error('Expected the existing payable-Mint strategy')
    expect(command.trapInstanceId).toBe(windmill.instanceId)
    // Preserve the observed pre-fix choice when its later ordinary attack is
    // publicly payable. This does not claim Mint is uniquely optimal.
    expect(command.effectTargets?.[0]).toEqual([mint.instanceId])
  })

  it.each([human, ai])('hidden physical faces in %s do not change the sole-support response', owner => {
    const { state, leek } = fixture()
    // Keep a real, face-down opponent hand in both worlds, with the same count.
    // These zones are rearranged rule fixtures, not a natural opening replay.
    state.players[human].hand = [
      takeCard(state, human, 'ST1-004'), takeCard(state, human, 'ST1-006'),
    ]
    expectPhysicalDeck(state, human)
    const changed = swapHiddenPhysicalCards(state, owner)
    expect(changed.players[owner].battleArea.map(cookie => cookie.hpCards.map(card => card.id)))
      .not.toEqual(state.players[owner].battleArea.map(cookie => cookie.hpCards.map(card => card.id)))
    if (owner === human) {
      expect(changed.players[human].hand.map(card => card.id))
        .not.toEqual(state.players[human].hand.map(card => card.id))
    }
    const baseline = decide(state).command
    const swapped = decide(changed).command
    expect(baseline?.kind).toBe('play-trap')
    expect(swapped?.kind).toBe(baseline?.kind)
    if (baseline?.kind !== 'play-trap' || swapped?.kind !== 'play-trap') {
      throw new Error('Expected a visible-current-reduction response in both worlds')
    }
    expect(baseline.effectTargets?.[0]).toEqual([leek.instanceId])
    expect(swapped.effectTargets).toEqual(baseline.effectTargets)
  })

  it('retains the independent recovery benefit when a real Cookie is available in the trash', () => {
    const { state, windmill, trophy, recovered } = fixture(0, true)
    expect(recovered?.type).toBe('cookie')
    const { decision, command } = decide(state)
    expect(command?.kind).toBe('play-trap')
    if (command?.kind !== 'play-trap') throw new Error('Expected useful reduction and recovery')
    expect(command.trapInstanceId).toBe(windmill.instanceId)
    expect(command.effectTargets?.[2]).toEqual([recovered!.instanceId])
    expect(decision.state.players[ai].discardPile).toContainEqual(trophy)
    expect(decision.state.players[ai].supportArea).toEqual([{ card: recovered, rested: true }])
  })
})
