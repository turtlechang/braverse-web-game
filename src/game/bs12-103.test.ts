import { expect, it } from 'vitest'
import { BS12_SUNGLASSES_SCENARIOS, createBs12SunglassesDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand, getPendingDecision } from './commands'
import { describeCommandSteps, resolveLogCard } from './command-log'
import { maskGameStateForViewer } from './masked-state'
import { takeAiStep } from './ai'
import type { GameCard, GameState } from './types'

const playerId = 'player-one' as const, source = 'bs12-103-item'
const payment = { kind: 'begin-play-item' as const, playerId, instanceId: source, paymentIds: ['bs12-103-payment-0'] }
const begin = (state: GameState) => applyGameCommand(state, payment)
const inspect = (state: GameState) => applyGameCommand(begin(state), { kind: 'resolve-ability-effect', playerId, targetIds: [] })
const pick = (state: GameState, ids: string[] = ['bs12-103-peek-0']) => {
  const command = { kind: 'resolve-inspect-deck' as const, playerId, pickedCardIds: ids,
    restOrder: state.pendingInspectDeck!.revealedCards.filter(card => !ids.includes(card.instanceId)).map(card => card.instanceId) }
  return applyGameCommand(state, command)
}
const refresh = (state: GameState) => applyGameCommand(state, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-103-refresh' }, { shuffle: (cards: GameCard[]) => [...cards] })

it('103 pays K1 once and trashes the Item before inspecting the four real top cards', () => {
  const before = createBs12SunglassesDemoState('spare-energy'), snapshot = structuredClone(before), paid = begin(before)
  expect(paid.players[playerId].hand).toEqual([])
  expect(paid.players[playerId].supportArea.map(entry => entry.rested)).toEqual([true, false])
  expect(paid.players[playerId].discardPile.map(card => card.instanceId)).toEqual([source])
  expect(paid.players[playerId].deck).toEqual(before.players[playerId].deck)
  expect(paid.pendingInspectDeck).toBeFalsy()
  const peek = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: [] })
  expect(peek.pendingInspectDeck).toMatchObject({ lookCount: 4, pickCount: 1, filterColor: 'black', filterKeyword: 'arena', optionalPick: true, revealPicked: true, restDestination: 'trash' })
  expect(peek.pendingInspectDeck!.revealedCards).toEqual(before.players[playerId].deck.slice(0, 4))
  expect(peek.players[playerId].deck).toEqual(before.players[playerId].deck.slice(4))
  expect(getPendingDecision(peek)).toMatchObject({ kind: 'inspect-deck', revealPicked: true })
  expect(peek.players['player-two']).toEqual(before.players['player-two'])
  expect(peek.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
  expect(before).toEqual(snapshot)
})
it.each([['cookie', 0], ['stage', 1], ['item', 2], ['trap', 3]] as const)('103 chooses the real black Arena %s without adding a type/name/LV restriction', (type, index) => {
  const before = createBs12SunglassesDemoState(type), peek = inspect(before), chosen = peek.pendingInspectDeck!.revealedCards[index], after = pick(peek, [chosen.instanceId])
  expect(chosen.type).toBe(type)
  expect(chosen.energyColor).toBe('black')
  expect(chosen.keywords).toContain('arena')
  expect(after.players[playerId].hand).toEqual([chosen])
  expect(after.players[playerId].discardPile).toEqual([before.players[playerId].hand[0], ...peek.pendingInspectDeck!.revealedCards.filter(card => card !== chosen)])
  expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(4))
  expect(after.pendingInspectDeck).toBeNull()
  expect(after.pendingAbilityEffect).toBeFalsy()
  expect(after.pendingRefresh).toBeFalsy()
})
it.each(['positive', 'mixed', 'two-valid', 'no-target', 'wrong-color', 'wrong-keyword', 'split', 'hand-only', 'trash-only', 'support-only', 'break-only', 'opponent-only'] as const)('103 optional zero still spends K1 and sends all four to trash: %s', scenario => {
  const before = createBs12SunglassesDemoState(scenario), peek = inspect(before), after = pick(peek, [])
  expect(after.players[playerId].hand).toEqual(before.players[playerId].hand.slice(1))
  expect(after.players[playerId].discardPile).toEqual([...before.players[playerId].discardPile, before.players[playerId].hand[0], ...before.players[playerId].deck.slice(0, 4)])
  expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(4))
  expect(after.players[playerId].supportArea[0].rested).toBe(true)
  expect(after.players['player-two']).toEqual(before.players['player-two'])
})
it.each([1, 2])('103 rejects independently wrong-color / non-Arena peek index %s without moving cards', index => {
  const state = inspect(createBs12SunglassesDemoState('mixed')), snapshot = structuredClone(state)
  expect(() => pick(state, [`bs12-103-peek-${index}`])).toThrow()
  expect(state).toEqual(snapshot)
})
it.each(['no-target', 'wrong-color', 'wrong-keyword', 'split'] as const)('103 requires black AND Arena on the same viewed card: %s', scenario => {
  const state = inspect(createBs12SunglassesDemoState(scenario))
  for (const card of state.pendingInspectDeck!.revealedCards) expect(() => pick(state, [card.instanceId])).toThrow()
})
it.each(['hand-only', 'trash-only', 'support-only', 'break-only', 'opponent-only'] as const)('103 cannot take otherwise eligible cards outside the viewed own top four: %s', scenario => {
  const state = inspect(createBs12SunglassesDemoState(scenario)), where = scenario.split('-')[0]
  expect(() => pick(state, [`bs12-103-${where}-target`])).toThrow('不在檢視清單')
})
it.each(['no-energy', 'wrong-energy', 'rested-energy', 'opponent-turn', 'outside-main', 'empty-deck'] as const)('103 cannot pay illegally or bypass pending Refresh: %s', scenario => {
  const state = createBs12SunglassesDemoState(scenario), snapshot = structuredClone(state)
  expect(() => begin(state)).toThrow()
  expect(state).toEqual(snapshot)
})
it.each([[], ['bs12-103-payment-0', 'bs12-103-payment-1'], ['bs12-103-payment-0', 'bs12-103-payment-0'], ['bs12-103-ally']].map(ids => [ids]))('103 rejects illegal payment IDs %j before peeking', paymentIds => {
  const state = createBs12SunglassesDemoState('spare-energy'), snapshot = structuredClone(state)
  expect(() => applyGameCommand(state, { ...payment, paymentIds })).toThrow()
  expect(state).toEqual(snapshot)
})
it.each([['bs12-103-peek-0', 'bs12-103-peek-1'], ['bs12-103-peek-0', 'bs12-103-peek-0'], ['bs12-103-own-deck-0']].map(ids => [ids]))('103 rejects too many, duplicate or non-viewed picks %j', ids => {
  const state = inspect(createBs12SunglassesDemoState()), snapshot = structuredClone(state)
  expect(() => pick(state, ids)).toThrow()
  expect(state).toEqual(snapshot)
})
it.each([[], ['bs12-103-peek-1', 'bs12-103-peek-1', 'bs12-103-peek-3'], ['bs12-103-peek-1', 'bs12-103-peek-2', 'bs12-103-own-deck-0']].map(ids => [ids]))('103 rejects incomplete, duplicate or substituted trash rest order %j', restOrder => {
  const state = inspect(createBs12SunglassesDemoState())
  expect(() => applyGameCommand(state, { kind: 'resolve-inspect-deck', playerId, pickedCardIds: ['bs12-103-peek-0'], restOrder })).toThrow('剩餘牌順序')
})
it('103 wrong decision owner, alternate destination and duplicate settlement are blocked', () => {
  const state = inspect(createBs12SunglassesDemoState()), restOrder = state.pendingInspectDeck!.revealedCards.map(card => card.instanceId)
  expect(() => applyGameCommand(state, { kind: 'resolve-inspect-deck', playerId: 'player-two', pickedCardIds: [], restOrder })).toThrow()
  expect(() => applyGameCommand(state, { kind: 'resolve-inspect-deck', playerId, pickedCardIds: [], restOrder, restDestination: 'bottom' })).toThrow('不接受額外')
  expect(() => pick(pick(state), [])).toThrow()
  expect(() => begin(begin(createBs12SunglassesDemoState()))).toThrow()
})
it.each(['one-card', 'short-deck', 'three-cards'] as const)('103 suspends before full peek, refreshes without moving reserved cards and fills four: %s', scenario => {
  const before = createBs12SunglassesDemoState(scenario), peek = inspect(before)
  expect(peek.pendingRefresh).toBeDefined()
  expect(peek.pendingInspectDeck!.revealedCards).toEqual(before.players[playerId].deck)
  expect(getPendingDecision(peek)?.kind).not.toBe('inspect-deck')
  expect(() => pick(peek)).toThrow()
  const resumed = refresh(peek)
  expect(resumed.pendingRefresh).toBeNull()
  expect(resumed.pendingInspectDeck!.revealedCards).toHaveLength(4)
  expect(resumed.pendingInspectDeck!.revealedCards.slice(0, before.players[playerId].deck.length)).toEqual(before.players[playerId].deck)
  expect(resumed.pendingInspectDeck!.revealPicked).toBe(true)
  expect(resumed.players[playerId].breakArea.at(-1)?.instanceId).toBe('bs12-103-refresh')
  const after = pick(resumed)
  expect(after.players[playerId].hand[0].instanceId).toBe('bs12-103-peek-0')
  expect(after.players[playerId].discardPile).toHaveLength(3)
  expect(after.players[playerId].deck).toHaveLength(7 - (4 - before.players[playerId].deck.length))
})
it('103 exact four settles peek before Refresh, and never shuffles the chosen hand card', () => {
  const peek = inspect(createBs12SunglassesDemoState('exact-four'))
  expect(peek.pendingRefresh).toBeFalsy()
  const chosen = pick(peek)
  expect(chosen.pendingInspectDeck).toBeNull()
  expect(chosen.pendingRefresh).toBeDefined()
  const after = refresh(chosen)
  expect(after.players[playerId].hand[0].instanceId).toBe('bs12-103-peek-0')
  expect(after.players[playerId].deck.some(card => card.instanceId === 'bs12-103-peek-0')).toBe(false)
  expect(after.players[playerId].deck).toHaveLength(10)
})
it('103 already empty deck refreshes before Item payment, then allows a legal peek', () => {
  const before = createBs12SunglassesDemoState('empty-deck'), resumed = refresh(before)
  expect(resumed.players[playerId].hand[0].instanceId).toBe(source)
  expect(resumed.players[playerId].supportArea[0].rested).toBe(false)
  expect(inspect(resumed).pendingInspectDeck!.revealedCards).toHaveLength(4)
})
it('103 unavailable Refresh and break LV10 terminate cleanly without selecting a partial peek', () => {
  const unavailable = inspect(createBs12SunglassesDemoState('no-refresh'))
  expect(unavailable.status).toBe('finished')
  expect(unavailable.result).toMatchObject({ loserId: playerId, reason: 'refresh-unavailable' })
  const defeat = refresh(inspect(createBs12SunglassesDemoState('break-nine')))
  expect(defeat.status).toBe('finished')
  expect(defeat.result).toMatchObject({ loserId: playerId, reason: 'break-level-limit' })
  expect(defeat.pendingInspectDeck).toBeNull()
  expect(defeat.pendingRefresh).toBeNull()
})
it('103 AI uses the same pending command and leaves no unresolved peek', () => {
  const state = inspect(createBs12SunglassesDemoState()), after = takeAiStep(state, playerId).state
  expect(after.pendingInspectDeck).toBeNull()
  expect(after.players[playerId].hand).toHaveLength(1)
  expect(after.players[playerId].discardPile).toHaveLength(4)
})
it('103 keeps viewed cards private until selection, then logs only revealed hand and public trash cards', () => {
  const peek = inspect(createBs12SunglassesDemoState()), pending = peek.pendingInspectDeck!, masked = maskGameStateForViewer(peek, 'player-two')
  for (const card of pending.revealedCards) expect(JSON.stringify(masked)).not.toContain(card.instanceId)
  const command = { kind: 'resolve-inspect-deck' as const, playerId, pickedCardIds: ['bs12-103-peek-0'], restOrder: ['bs12-103-peek-1', 'bs12-103-peek-2', 'bs12-103-peek-3'] }
  const after = applyGameCommand(peek, command), steps = describeCommandSteps(peek, after, command)!
  expect(steps[0]).toMatchObject({ text: expect.stringMatching(/展示並加入手牌.*Butter Roll/), cards: [pending.revealedCards[0]] })
  expect(steps[1]).toMatchObject({ text: expect.stringMatching(/未選卡進棄牌區/), cards: pending.revealedCards.slice(1) })
  expect(resolveLogCard(peek, after, command)?.id).toBe('BS12-103')
  const log = maskGameStateForViewer(after, 'player-two').commandLog!.at(-1)!
  expect(log.steps).toEqual(steps)
  expect(log.payload).toEqual({ kind: 'resolve-inspect-deck', playerId })
  expect(JSON.stringify(steps)).not.toContain('bs12-103-own-deck-0')
})
it('103 logs optional zero explicitly while exposing all four cards already moved to public trash', () => {
  const state = inspect(createBs12SunglassesDemoState()), after = pick(state, []), entry = after.commandLog!.at(-1)!
  expect(entry.steps?.[0]).toEqual({ text: '選擇 0 張，沒有牌加入手牌。' })
  expect(entry.steps?.[1].cards).toEqual(state.pendingInspectDeck!.revealedCards)
})
it('103 retains the public source association when Refresh puts the paid Item inside its own private peek', () => {
  const partial = inspect(createBs12SunglassesDemoState('one-card'))
  const peek = applyGameCommand(partial, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-103-refresh' }, {
    shuffle: cards => [...cards.filter(card => card.instanceId === source), ...cards.filter(card => card.instanceId !== source)],
  })
  expect(peek.pendingInspectDeck!.revealedCards.some(card => card.instanceId === source)).toBe(true)
  const after = pick(peek), entry = after.commandLog!.at(-1)!
  expect(entry.commandKind).toBe('resolve-inspect-deck')
  expect(entry.card?.id).toBe('BS12-103')
  expect(entry.steps?.[0].text).toMatch(/展示並加入手牌.*Butter Roll/)
  expect(entry.steps?.[1].cards?.some(card => card.instanceId === source)).toBe(true)
  expect(maskGameStateForViewer(peek, 'player-two').pendingInspectDeck!.revealedCards.some(card => card.instanceId === source)).toBe(false)
})
it.each(['top', 'bottom'] as const)('shared inspect logs do not expose unrevealed selection or cards returned to private deck %s', restDestination => {
  const base = inspect(createBs12SunglassesDemoState()), state: GameState = { ...base, pendingInspectDeck: { ...base.pendingInspectDeck!, revealPicked: false, restDestination } }
  const after = pick(state), entry = after.commandLog!.at(-1)!, publicSteps = JSON.stringify(entry.steps)
  expect(entry.steps?.[0]).toEqual({ text: '檢視結果：1 張牌加入手牌。' })
  for (const card of state.pendingInspectDeck!.revealedCards) {
    expect(publicSteps).not.toContain(card.instanceId)
    expect(publicSteps).not.toContain(card.name)
  }
})
it.each(BS12_SUNGLASSES_SCENARIOS)('103 finite local fixture %s uses real definitions and stays within card capacities', scenario => {
  expect(parseTestStateConfig(`?test-state=bs12-103:${scenario}`, 'localhost')).toEqual({ kind: 'bs12-103', scenario })
  expect(parseTestStateConfig(`?test-state=bs12-103:${scenario}`, 'example.com')).toBeNull()
  const state = createBs12SunglassesDemoState(scenario)
  for (const player of Object.values(state.players)) {
    expect(player.battleArea.length).toBeLessThanOrEqual(2)
    expect(player.breakArea.reduce((sum, card) => sum + card.level, 0)).toBeLessThan(10)
    const cards = [...player.hand, ...player.deck, ...player.discardPile, ...player.breakArea, ...player.supportArea.map(entry => entry.card),
      ...player.battleArea.flatMap(entry => [entry.card, ...entry.hpCards])]
    expect(new Set(cards.map(card => card.instanceId)).size).toBe(cards.length)
    for (const id of new Set(cards.map(card => card.id))) expect(cards.filter(card => card.id === id).length).toBeLessThanOrEqual(4)
  }
})
