import { describe, expect, it } from 'vitest'
import { createSt8008PreviewState as fixture } from './st8-008-demo'
import { applyGameCommand } from './commands'
import { commandFromLogEntry } from './replay'
import { selectEnergyPayment } from './energy'

const owner = 'player-one' as const
const attack = (state: ReturnType<typeof fixture>) => {
  let next = applyGameCommand(state, { kind: 'declare-attack', playerId: owner,
    attackerInstanceId: state.players[owner].battleArea[0].card.instanceId,
    targetInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
    supportPaymentIds: state.players[owner].supportArea.slice(0, 3).map(support => support.card.instanceId) })
  next = applyGameCommand(next, { kind: 'skip-trap', playerId: 'player-two' })
  return applyGameCommand(next, { kind: 'resolve-battle', playerId: owner })
}
const resolveFaint = (state: ReturnType<typeof fixture>, modeIndex: number) => applyGameCommand(
  applyGameCommand(state, { kind: 'resolve-choose-one', playerId: owner, modeIndex }),
  { kind: 'resolve-faint-effect', playerId: owner, targetIds: [] },
)
const expectFullReplay = (scenario: string, final: ReturnType<typeof fixture>) => {
  let replayed = fixture(scenario, true)
  for (const entry of final.commandLog ?? []) replayed = applyGameCommand(replayed, commandFromLogEntry(entry))
  expect(JSON.parse(JSON.stringify(replayed))).toEqual(JSON.parse(JSON.stringify(final)))
}

describe('ST8-008 original physical parent flows', () => {
  it.each(['positive', 'negative', 'faint-equal', 'faint-less', 'faint-more', 'faint-rested', 'faint-last-deck',
    'faint-source-rested', 'faint-top-item', 'faint-top-stage', 'faint-top-blue', 'attack', 'attack-paid-wind', 'attack-rested-wind',
    'attack-no-wind', 'attack-wind-battle', 'attack-wind-hand', 'attack-wind-deck', 'attack-wind-opponent',
    'attack-no-hand', 'attack-last-deck', 'attack-negative', 'wrong-color', 'wrong-phase', 'attack-few',
    'first-turn', 'source-rested', 'source-faint', 'play'])('%s preserves real 60-card resources and printed HP', scenario => {
    const state = fixture(scenario, true)
    for (const player of Object.values(state.players)) {
      const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea,
        ...player.supportArea.map(support => support.card), ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards])]
      expect(cards).toHaveLength(60)
      expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
      const counts = new Map<string, number>()
      for (const card of cards) {
        expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)
        counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
      }
      expect([...counts.values()].every(count => count <= 4)).toBe(true)
      for (const cookie of player.battleArea) expect(cookie.hpCards).toHaveLength(cookie.card.hp)
    }
  })

  it.each(['positive', 'faint-equal', 'faint-less', 'faint-rested', 'faint-source-rested'])('real ordinary4 faints printed HP4 and offers the support choice: %s', scenario => {
    const state = fixture(scenario)
    expect(state.players[owner].breakArea.some(card => card.id === 'ST8-008')).toBe(true)
    expect(state.commandLog?.map(entry => entry.commandKind)).toEqual(['declare-attack', 'skip-trap', 'resolve-battle'])
    expect(state.players['player-two'].supportArea.every(support => support.rested)).toBe(true)
    expect(state.pendingFaintEffects?.[0].effect).toMatchObject({ kind: 'choose-one',
      condition: { kind: 'support-count-less-than-opponent', difference: 0 } })
  })

  it.each(['negative', 'faint-more'])('does not offer faint support placement with more own supports: %s', scenario => {
    const start = fixture(scenario, true), state = fixture(scenario)
    expect(state.players[owner].breakArea.some(card => card.id === 'ST8-008')).toBe(true)
    expect(state.players[owner].supportArea).toEqual(start.players[owner].supportArea)
    expect(state.players[owner].deck).toEqual(start.players[owner].deck)
    expect(state.pendingFaintEffects).toBeUndefined()
  })

  it.each(['positive', 'faint-top-item', 'faint-top-stage', 'faint-top-blue'])('chooses one real deck top card as rested support after faint: %s', scenario => {
    const state = fixture(scenario), before = structuredClone(state), self = state.players[owner]
    const next = resolveFaint(state, 0)
    expect(next.players[owner].supportArea).toEqual([...self.supportArea, { card: self.deck[0], rested: true }])
    expect(next.players[owner].deck).toEqual(self.deck.slice(1))
    expect(next.players[owner].hand).toEqual(self.hand)
    expect(next.pendingFaintEffects).toBeUndefined()
    expect(next.players[owner].battleArea).toEqual(self.battleArea)
    expect(next.players['player-two']).toEqual(state.players['player-two'])
    expect(state).toEqual(before)
    expectFullReplay(scenario, next)
  })

  it.each(['positive', 'faint-top-item', 'faint-top-stage', 'faint-top-blue', 'faint-last-deck'])('chooses zero without moving any real cards or triggering Refresh: %s', scenario => {
    const state = fixture(scenario), next = resolveFaint(state, 1)
    expect(next.players).toEqual(state.players)
    expect(next.pendingFaintEffects).toBeUndefined()
    expect(next.pendingRefresh).toBeNull()
    expectFullReplay(scenario, next)
  })

  it('uses the true top card for each printed unrestricted destination branch', () => {
    expect(fixture('positive').players[owner].deck[0].type).toBe('cookie')
    expect(fixture('faint-top-item').players[owner].deck[0].type).toBe('item')
    expect(fixture('faint-top-stage').players[owner].deck[0].type).toBe('stage')
    expect(fixture('faint-top-blue').players[owner].deck[0].energyColor).toBe('blue')
  })

  it('places the final deck card before mandatory Refresh and preserves the support result', () => {
    const state = fixture('faint-last-deck'), self = state.players[owner]
    let next = resolveFaint(state, 0)
    expect(next.players[owner].supportArea.at(-1)).toEqual({ card: self.deck[0], rested: true })
    expect(next.players[owner].deck).toEqual([])
    expect(next.pendingRefresh).toMatchObject({ playerId: owner, remainingDraws: 0 })
    const refreshCookie = next.players[owner].discardPile.find(card => card.type === 'cookie')
    if (!refreshCookie) throw new Error('Actual faint HP discard must supply a Refresh Cookie')
    next = applyGameCommand(next, { kind: 'refresh-deck', playerId: owner, cookieInstanceId: refreshCookie.instanceId, shuffleSeed: 1 })
    expect(next.pendingRefresh).toBeNull()
    expect(next.players[owner].supportArea).toEqual([...self.supportArea, { card: self.deck[0], rested: true }])
    expect(next.players[owner].breakArea.some(card => card.instanceId === refreshCookie.instanceId)).toBe(true)
    expect(next.players[owner].hand).toEqual(self.hand)
    expectFullReplay('faint-last-deck', next)
  })

  it.each([-1, 2])('rejects nonexistent faint choice mode %s without mutating the parent state', modeIndex => {
    const state = fixture('positive'), before = structuredClone(state)
    expect(() => applyGameCommand(state, { kind: 'resolve-choose-one', playerId: owner, modeIndex })).toThrow()
    expect(state).toEqual(before)
  })

  it('requires the correct faint owner to select the printed mode', () => {
    const state = fixture('positive'), before = structuredClone(state)
    expect(() => applyGameCommand(state, { kind: 'resolve-choose-one', playerId: 'player-two', modeIndex: 0 })).toThrow()
    expect(state).toEqual(before)
  })

  it.each(['attack', 'attack-paid-wind', 'attack-rested-wind'])('pays actual GGG ordinary3 before mandatory draw then discard: %s', scenario => {
    const start = fixture(scenario), before = structuredClone(start)
    const state = attack(start)
    expect(state.players['player-two'].breakArea.some(card => card.id === 'ST1-005')).toBe(true)
    expect(state.players[owner].supportArea.slice(0, 3).every(support => support.rested)).toBe(true)
    expect(state.players[owner].battleArea[0].card).toMatchObject({ id: 'ST8-008', hp: 4, level: 2, attack: 3, attackEnergyCost: { green: 3 } })
    expect(state.players[owner].hand).toEqual([...start.players[owner].hand, start.players[owner].deck[0]])
    expect(state.pendingOpponentHandDiscard).toMatchObject({ playerId: owner, count: 1 })
    expect(state.pendingOpponentHandDiscard?.optional).not.toBe(true)
    expect(state.pendingOpponentHandDiscard?.effectText).toBe(start.players[owner].battleArea[0].card.attackText)
    expect(start).toEqual(before)
  })

  it.each(['attack-no-wind', 'attack-wind-battle', 'attack-wind-hand', 'attack-wind-deck', 'attack-wind-opponent'])('rejects the wrong witness zone or name: %s', scenario => {
    const start = fixture(scenario), state = attack(start)
    expect(state.players[owner].hand).toEqual(start.players[owner].hand)
    expect(state.players[owner].deck).toEqual(start.players[owner].deck)
    expect(state.pendingOpponentHandDiscard).toBeUndefined()
  })

  it('allows the newly drawn card as the exact mandatory discard', () => {
    const start = fixture('attack'), drawn = start.players[owner].deck[0]
    const next = applyGameCommand(attack(start), { kind: 'resolve-opponent-hand-discard', playerId: owner, cardIds: [drawn.instanceId] })
    expect(next.players[owner].hand).toEqual(start.players[owner].hand)
    expect(next.players[owner].discardPile.some(card => card.instanceId === drawn.instanceId)).toBe(true)
    expect(next.players[owner].deck).toEqual(start.players[owner].deck.slice(1))
    expect(next.pendingOpponentHandDiscard).toBeNull()
    expectFullReplay('attack', next)
  })

  it('can discard the newly drawn card when the starting hand was empty', () => {
    const start = fixture('attack-no-hand'), drawn = start.players[owner].deck[0]
    const waiting = attack(start)
    expect(waiting.players[owner].hand).toEqual([drawn])
    const next = applyGameCommand(waiting, { kind: 'resolve-opponent-hand-discard', playerId: owner, cardIds: [drawn.instanceId] })
    expect(next.players[owner].hand).toEqual([])
    expect(next.players[owner].discardPile.some(card => card.instanceId === drawn.instanceId)).toBe(true)
    expectFullReplay('attack-no-hand', next)
  })

  it('retains the printed attack Then after real damage and a real Kumiho FLIP faints its source', () => {
    const start = fixture('source-faint'), self = start.players[owner], foe = start.players['player-two']
    expect(self.battleArea[0].card.hp).toBe(4)
    expect(self.battleArea[0].hpCards).toHaveLength(1)
    expect(start.commandLog?.filter(entry => entry.commandKind === 'resolve-battle')).toHaveLength(1)
    let state = applyGameCommand(start, { kind: 'declare-attack', playerId: owner,
      attackerInstanceId: self.battleArea[0].card.instanceId, targetInstanceId: foe.battleArea[0].card.instanceId,
      supportPaymentIds: self.supportArea.slice(0, 3).map(support => support.card.instanceId) })
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
    state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(state.pendingBattle?.revealedHpCard?.id).toBe('BS1-002')
    state = applyGameCommand(state, { kind: 'resolve-flip', playerId: 'player-two', activate: true,
      discardHandIds: [foe.hand[0].instanceId], targetIds: [self.battleArea[0].card.instanceId] })
    expect(state.players[owner].breakArea.some(card => card.instanceId === self.battleArea[0].card.instanceId)).toBe(true)
    state = applyGameCommand(state, { kind: 'resolve-battle', playerId: owner })
    expect(state.players[owner].hand).toEqual([...self.hand, self.deck[0]])
    expect(state.pendingOpponentHandDiscard).toMatchObject({ playerId: owner, count: 1 })
    const next = applyGameCommand(state, { kind: 'resolve-opponent-hand-discard', playerId: owner, cardIds: [self.deck[0].instanceId] })
    expect(state.pendingOpponentHandDiscard?.sourceCardName).toBe('Sugar Swan Cookie')
    expect(state.pendingOpponentHandDiscard?.effectText).toBe(self.battleArea[0].card.attackText)
    expect(next.players[owner].hand).toEqual(self.hand)
    expect(next.players[owner].battleArea.find(cookie => cookie.card.id === 'ST1-011')).toEqual(self.battleArea[1])
    expectFullReplay('source-faint', next)
  })

  it('requires actual Refresh after drawing the final card before the mandatory discard resumes', () => {
    const start = fixture('attack-last-deck'), drawn = start.players[owner].deck[0]
    let state = attack(start)
    expect(state.pendingRefresh?.playerId).toBe(owner)
    expect(state.players[owner].hand).toContainEqual(drawn)
    const refreshCookie = state.players[owner].discardPile.find(card => card.type === 'cookie')
    if (!refreshCookie) throw new Error('Actual short-deck resources must include a Refresh Cookie')
    state = applyGameCommand(state, { kind: 'refresh-deck', playerId: owner, cookieInstanceId: refreshCookie.instanceId, shuffleSeed: 1 })
    expect(state.pendingRefresh).toBeNull()
    expect(state.pendingBattle).toMatchObject({ stage: 'attack-effect', attackEffectIndex: 1 })
    state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: owner, targetIds: [] })
    expect(state.pendingOpponentHandDiscard).toMatchObject({ playerId: owner, count: 1 })
    const next = applyGameCommand(state, { kind: 'resolve-opponent-hand-discard', playerId: owner, cardIds: [drawn.instanceId] })
    expect(next.players[owner].hand).toEqual(start.players[owner].hand)
    expect(next.players[owner].discardPile.some(card => card.instanceId === drawn.instanceId)).toBe(true)
    expectFullReplay('attack-last-deck', next)
  })

  it.each(['empty', 'absent', 'two-real'])('rejects invalid exact discard selection %s', selection => {
    const state = attack(fixture('attack')), before = structuredClone(state)
    const ids = selection === 'empty' ? [] : selection === 'absent' ? ['absent'] : state.players[owner].hand.slice(0, 2).map(card => card.instanceId)
    expect(() => applyGameCommand(state, { kind: 'resolve-opponent-hand-discard', playerId: owner, cardIds: ids })).toThrow()
    expect(state).toEqual(before)
  })

  it.each([0, 1])('discards any original hand type or color at index %s', index => {
    const start = fixture('attack'), cost = start.players[owner].hand[index]
    const state = applyGameCommand(attack(start), { kind: 'resolve-opponent-hand-discard', playerId: owner, cardIds: [cost.instanceId] })
    expect(state.players[owner].discardPile.some(card => card.instanceId === cost.instanceId)).toBe(true)
    expect(state.players[owner].hand).toEqual([...start.players[owner].hand.filter(card => card.instanceId !== cost.instanceId), start.players[owner].deck[0]])
    expectFullReplay('attack', state)
  })

  it.each(['attack-negative', 'wrong-color', 'wrong-phase', 'attack-few', 'first-turn', 'source-rested'])('blocks actual attack for %s', scenario => {
    const state = fixture(scenario), before = structuredClone(state)
    if (['attack-negative','wrong-color','attack-few'].includes(scenario)) {
      expect(selectEnergyPayment({green:3},state.players[owner].supportArea)).toBeNull()
    }
    expect(() => attack(state)).toThrow()
    expect(state).toEqual(before)
  })

  it('deploys Sugar Swan from hand with four original HP cards', () => {
    const start = fixture('play'), source = start.players[owner].hand[0]
    expect(source.id).toBe('ST8-008')
    const state = applyGameCommand(start, { kind: 'deploy-cookie', playerId: owner, instanceId: source.instanceId })
    expect(state.players[owner].battleArea.find(cookie => cookie.card.id === 'ST8-008')?.hpCards).toHaveLength(4)
    expect(state.pendingOnPlay).toBeNull()
  })
})
