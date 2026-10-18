import { describe, expect, it } from 'vitest'
import { createSt8010PreviewState as fixture, st8010Scenarios } from './st8-010-demo'
import { applyGameCommand } from './commands'
import { selectEnergyPayment } from './energy'
import { commandFromLogEntry } from './replay'

const owner = 'player-one' as const
// Printed cost-first sequence: return exact Item first, then select mode. No synthetic pending injection.
const pay = (state: ReturnType<typeof fixture>, ids = [state.players[owner].supportArea[0].card.instanceId]) => applyGameCommand(state,
  { kind: 'resolve-faint-effect', playerId: owner, targetIds: [], supportToHandIds: ids })
const choose = (state: ReturnType<typeof fixture>, count: number) => applyGameCommand(
  applyGameCommand(state, { kind: 'resolve-choose-one', playerId: owner, modeIndex: count === 1 ? 0 : 1 }),
  { kind: 'resolve-faint-effect', playerId: owner, targetIds: [] })
const replay = (scenario: string, final: ReturnType<typeof fixture>) => {
  let state = fixture(scenario, true)
  for (const entry of final.commandLog ?? []) state = applyGameCommand(state, commandFromLogEntry(entry))
  expect(JSON.parse(JSON.stringify(state))).toEqual(JSON.parse(JSON.stringify(final)))
}
const attack = (state: ReturnType<typeof fixture>) => applyGameCommand(state, { kind: 'declare-attack', playerId: owner,
  attackerInstanceId: state.players[owner].battleArea[0].card.instanceId, targetInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
  supportPaymentIds: selectEnergyPayment({ green: 1 }, state.players[owner].supportArea) ?? [] })

describe('ST8-010 original physical acceptance', () => {
  it.each(st8010Scenarios)('%s keeps original sixty-card decks, unique IDs and printed initial HP', scenario => {
    const state = fixture(scenario, true), ids: string[] = []
    for (const player of Object.values(state.players)) {
      const cards = [...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile, ...player.supportArea.map(s => s.card),
        ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
      expect(cards).toHaveLength(60)
      ids.push(...cards.map(c => c.instanceId))
      const counts = new Map<string, number>()
      for (const c of cards) { expect(c.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//); counts.set(c.id, (counts.get(c.id) ?? 0) + 1) }
      expect([...counts.values()].every(n => n <= 4)).toBe(true)
      for (const c of player.battleArea) expect(c.hpCards).toHaveLength(c.card.hp)
    }
    expect(new Set(ids).size).toBe(120)
  })

  it.each([0, 1])('real NNN3 faint returns Item before choosing %s top support', count => {
    const start = fixture('positive'), before = structuredClone(start), self = start.players[owner]
    expect(start.pendingFaintEffects?.[0].sourceInstanceId).toBe(fixture('positive', true).players[owner].battleArea[0].card.instanceId)
    const returned = self.supportArea[0].card, top = self.deck[0]
    const paid = pay(start)
    expect(paid.players[owner].hand).toEqual([...self.hand, returned])
    expect(paid.players[owner].supportArea).toEqual(self.supportArea.slice(1))
    expect(paid.players[owner].deck).toEqual(self.deck)
    expect(paid.pendingFaintEffects?.[0].effect.kind).toBe('choose-one')
    expect(() => applyGameCommand(start, { kind: 'resolve-choose-one', playerId: owner, modeIndex: 0 })).toThrow()
    const state = choose(paid, count)
    expect(state.players[owner].hand).toEqual([...self.hand, returned])
    expect(state.players[owner].supportArea).toEqual([...self.supportArea.slice(1), ...(count ? [{ card: top, rested: true }] : [])])
    expect(state.players[owner].deck).toEqual(self.deck.slice(count))
    expect(start).toEqual(before)
    replay('positive', paid); replay('positive', state)
  })

  it('declining payment skips whole trigger instead of granting top support', () => {
    const start = fixture('positive'), state = applyGameCommand(start, { kind: 'resolve-faint-effect', playerId: owner, targetIds: [] })
    expect(state.players[owner].hand).toEqual(start.players[owner].hand)
    expect(state.players[owner].supportArea).toEqual(start.players[owner].supportArea)
    expect(state.players[owner].deck).toEqual(start.players[owner].deck)
    expect(state.pendingFaintEffects?.length ?? 0).toBe(0)
    replay('positive', state)
  })

  it.each(['rested-item', 'blue-item', 'no-hand', 'source-rested'])('arbitrary color/rested Item and no hand are legal: %s', scenario => {
    const start = fixture(scenario), item = start.players[owner].supportArea[0].card
    expect(item.type).toBe('item')
    const state = choose(pay(start), 0)
    expect(state.players[owner].hand).toEqual([...start.players[owner].hand, item])
    expect(state.players[owner].supportArea).toHaveLength(start.players[owner].supportArea.length - 1)
    replay(scenario, state)
  })

  it.each(['cookie-cost', 'trap-cost', 'stage-cost'])('non-Item support cannot pay: %s', scenario => {
    const start = fixture(scenario), before = structuredClone(start)
    expect(() => pay(start)).toThrow()
    expect(start).toEqual(before)
  })
  it('rejects two Items, duplicate ID, opponent card, and hand Item without mutation', () => {
    const start = fixture('positive'), before = structuredClone(start), ids = start.players[owner].supportArea.map(s => s.card.instanceId)
    for (const selected of [ids, [ids[0], ids[0]], [start.players['player-two'].supportArea[0].card.instanceId], [start.players[owner].hand.find(c => c.type === 'item')!.instanceId]]) {
      expect(() => pay(start, selected)).toThrow(); expect(start).toEqual(before)
    }
    expect(() => applyGameCommand(start, { kind: 'resolve-faint-effect', playerId: 'player-two', targetIds: [], supportToHandIds: [ids[0]] })).toThrow()
  })
  it('no Item cannot produce support; normal faint still completes', () => {
    const state = fixture('no-item'), initial = fixture('no-item', true)
    expect(state.players[owner].supportArea).toEqual(initial.players[owner].supportArea)
    expect(state.players[owner].hand).toEqual(initial.players[owner].hand)
    expect(state.players[owner].breakArea.some(c => c.id === 'ST8-010')).toBe(true)
    replay('no-item', state)
  })

  it.each(['top-cookie', 'top-item', 'top-trap', 'top-stage', 'top-blue'])('uses unrestricted actual deck top: %s', scenario => {
    const start = fixture(scenario), top = start.players[owner].deck[0], state = choose(pay(start), 1)
    expect(state.players[owner].supportArea.at(-1)).toEqual({ card: top, rested: true })
    expect(state.players[owner].deck).toEqual(start.players[owner].deck.slice(1))
    replay(scenario, state)
  })

  it.each([0, 1])('last deck mode%s preserves cost and completes actual Refresh/remaining damage', count => {
    const start = fixture('last-deck'), top = start.players[owner].deck[0]
    let state = choose(pay(start), count)
    if (count) {
      expect(state.players[owner].supportArea.at(-1)).toEqual({ card: top, rested: true })
      expect(state.pendingRefresh?.playerId).toBe(owner)
      const cost = state.players[owner].discardPile.find(c => c.type === 'cookie')
      if (!cost) throw new Error('Actual last-deck discard must contain Refresh Cookie')
      state = applyGameCommand(state, { kind: 'refresh-deck', playerId: owner, cookieInstanceId: cost.instanceId, shuffleSeed: 1 })
      expect(state.pendingRefresh).toBeNull()
    } else { expect(state.pendingRefresh).toBeNull(); expect(state.players[owner].deck).toEqual([top]) }
    if (state.pendingBattle) state = applyGameCommand(state, { kind: 'resolve-battle', playerId: 'player-two' })
    expect(state.players[owner].breakArea.some(c => c.id === 'ST8-010')).toBe(true)
    expect(state.players[owner].battleArea.some(c => c.card.id === 'ST8-010')).toBe(false)
    replay('last-deck', state)
  })

  it('faint is not HP rescue and can leave a real replacement decision', () => {
    const start = fixture('only-source'), state = choose(pay(start), 0)
    expect(state.players[owner].battleArea).toHaveLength(0)
    expect(state.players[owner].breakArea.some(c => c.id === 'ST8-010')).toBe(true)
    expect(state.pendingReplacement?.tasks[0].playerId).toBe(owner)
    const cookie = state.players[owner].hand.find(c => c.type === 'cookie')
    if (!cookie || cookie.type !== 'cookie') throw new Error('Real replacement Cookie required')
    const replaced = applyGameCommand(state, { kind: 'replace-cookie', playerId: owner, instanceId: cookie.instanceId })
    expect(replaced.players[owner].battleArea[0].hpCards).toHaveLength(cookie.hp)
    replay('only-source', replaced)
  })

  it('declines the faint trigger before choosing a mode and continues real replacement skip', () => {
    const start = fixture('positive'), before = structuredClone(start)
    let state = applyGameCommand(start, { kind: 'resolve-faint-effect', playerId: owner, targetIds: [] })
    expect(state.players[owner].hand).toEqual(start.players[owner].hand)
    expect(state.players[owner].supportArea).toEqual(start.players[owner].supportArea)
    expect(state.players[owner].deck).toEqual(start.players[owner].deck)
    expect(state.pendingReplacement?.tasks[0].playerId).toBe(owner)
    state = applyGameCommand(state, { kind: 'skip-replacement', playerId: owner })
    expect(state.players[owner].battleArea).toHaveLength(1)
    expect(state.players[owner].breakArea.some(c => c.id === 'ST8-010')).toBe(true)
    expect(start).toEqual(before)
    replay('positive', state)
  })

  it('paid mode zero still returns exactly one Item before replacement skip', () => {
    const start = fixture('positive'), returned = start.players[owner].supportArea[0].card
    let state = choose(pay(start), 0)
    expect(state.players[owner].hand).toEqual([...start.players[owner].hand, returned])
    expect(state.players[owner].deck).toEqual(start.players[owner].deck)
    state = applyGameCommand(state, { kind: 'skip-replacement', playerId: owner })
    expect(state.players[owner].battleArea).toHaveLength(1)
    replay('positive', state)
  })

  it.each(['decline', 'paid-zero'])('sole source must replace when a real hand Cookie exists: %s', branch => {
    const start = fixture('only-source')
    const state = branch === 'decline'
      ? applyGameCommand(start, { kind: 'resolve-faint-effect', playerId: owner, targetIds: [] })
      : choose(pay(start), 0)
    const before = structuredClone(state)
    expect(state.players[owner].battleArea).toHaveLength(0)
    expect(state.pendingReplacement?.tasks[0].playerId).toBe(owner)
    const cookie = state.players[owner].hand.find(c => c.type === 'cookie')
    if (!cookie || cookie.type !== 'cookie') throw new Error('Actual mandatory replacement Cookie required')
    expect(() => applyGameCommand(state, { kind: 'skip-replacement', playerId: owner })).toThrow('戰鬥區沒有餅乾時必須先補位')
    expect(state).toEqual(before)
    const final = applyGameCommand(state, { kind: 'replace-cookie', playerId: owner, instanceId: cookie.instanceId })
    expect(final.players[owner].battleArea[0].card.instanceId).toBe(cookie.instanceId)
    expect(final.players[owner].battleArea[0].hpCards).toHaveLength(cookie.hp)
    replay('only-source', final)
  })
  it('paid cost cannot be paid again and illegal modes do not mutate its state', () => {
    const start = fixture('positive'), paid = pay(start), before = structuredClone(paid)
    expect(() => pay(paid, [paid.players[owner].supportArea[0].card.instanceId])).toThrow()
    for (const modeIndex of [-1, 2]) expect(() => applyGameCommand(paid, { kind: 'resolve-choose-one', playerId: owner, modeIndex })).toThrow()
    expect(() => applyGameCommand(paid, { kind: 'resolve-choose-one', playerId: 'player-two', modeIndex: 0 })).toThrow()
    expect(paid).toEqual(before)
    replay('positive', paid)
  })
  it.each(['own-attack-faint', 'effect-faint', 'repeat-faint'])('genuine additional parent %s retains canonical complete history', scenario => {
    const initial = fixture(scenario, true), start = fixture(scenario)
    const faint = start.pendingFaintEffects?.[0]
    expect(faint).toBeDefined()
    expect(start.players[owner].breakArea.some(c => c.instanceId === faint?.sourceInstanceId && c.id === 'ST8-010')).toBe(true)
    expect(initial.players[owner].battleArea[0].hpCards).toHaveLength(2)
    replay(scenario, start)
    const log = start.commandLog ?? []
    if (scenario === 'own-attack-faint') {
      expect(log.filter(e => e.commandKind === 'declare-attack')).toHaveLength(2)
      expect(log.filter(e => e.commandKind === 'advance-phase')).toHaveLength(5)
      expect(log.at(-1)?.commandKind).toBe('resolve-flip')
      expect(log.at(-1)?.payload).toMatchObject({ activate: true, targetIds: [initial.players[owner].battleArea[0].card.instanceId] })
      expect(start.players[owner].supportArea.find(s => s.card.id === 'ST3-016')?.rested).toBe(true)
    }
    if (scenario === 'effect-faint') {
      expect(log[0]?.commandKind).toBe('begin-play-item')
      expect(log[0]?.payload).toMatchObject({ paymentIds: initial.players['player-two'].supportArea.map(s => s.card.instanceId),
        trashCookieToBreakAreaIds: [initial.players['player-two'].discardPile[0].instanceId] })
      expect(log[1]?.commandKind).toBe('resolve-ability-effect')
      expect(start.players['player-two'].breakArea[0]?.id).toBe('ST2-001')
      expect(start.players['player-two'].discardPile.some(c => c.id === 'ST7-013')).toBe(true)
    }
    if (scenario === 'repeat-faint') {
      expect(log.filter(e => e.commandKind === 'declare-attack')).toHaveLength(2)
      expect(log.filter(e => e.commandKind === 'advance-phase')).toHaveLength(0)
      expect(log.filter(e => e.commandKind === 'resolve-choose-one')).toHaveLength(1)
      expect(log.filter(e => e.commandKind === 'replace-cookie')).toHaveLength(1)
      expect(faint?.sourceInstanceId).toBe(initial.players[owner].battleArea[1].card.instanceId)
      expect(start.players[owner].hand.some(c => c.instanceId === initial.players[owner].supportArea[0].card.instanceId)).toBe(true)
      expect(start.turnNumber).toBe(initial.turnNumber)
    }
  })

  for (const scenario of ['own-attack-faint', 'effect-faint', 'repeat-faint']) {
    it.each([0, 1])(`${scenario} pays exact Item then chooses %s without Once restriction`, count => {
      const start = fixture(scenario), self = start.players[owner], top = self.deck[0]
      const payment = self.supportArea.find(s => s.card.type === 'item' && (scenario !== 'own-attack-faint' || s.card.id === 'ST3-016'))
      if (!payment) throw new Error('Actual parent Item required')
      if (scenario === 'own-attack-faint') expect(payment.rested).toBe(true)
      const paid = pay(start, [payment.card.instanceId]), final = choose(paid, count)
      expect(final.players[owner].hand).toEqual([...self.hand, payment.card])
      expect(final.players[owner].supportArea).toEqual([...self.supportArea.filter(s => s.card.instanceId !== payment.card.instanceId), ...(count ? [{ card: top, rested: true }] : [])])
      expect(final.players[owner].deck).toEqual(self.deck.slice(count))
      replay(scenario, paid); replay(scenario, final)
    })
  }
  it('deploys exactly printed two HP without OnPlay effects', () => {
    const start = fixture('play'), source = start.players[owner].hand[0]
    const state = applyGameCommand(start, { kind: 'deploy-cookie', playerId: owner, instanceId: source.instanceId })
    expect(state.players[owner].battleArea.find(c => c.card.instanceId === source.instanceId)?.hpCards).toHaveLength(2)
    expect(state.pendingOnPlay).toBeNull()
    expect(state.players[owner].hand).toEqual(start.players[owner].hand.slice(1))
    replay('play', state)
  })
  it('G ordinary1 has no OnPlay/Then/faint draw and uses exact actual support', () => {
    const start = fixture('attack'), attacked = attack(start)
    const final = applyGameCommand(applyGameCommand(attacked, { kind: 'skip-trap', playerId: 'player-two' }), { kind: 'resolve-battle', playerId: owner })
    expect(final.players['player-two'].battleArea[0].hpCards).toHaveLength(start.players['player-two'].battleArea[0].hpCards.length - 1)
    expect(final.players[owner].hand).toEqual(start.players[owner].hand)
    expect(final.players[owner].supportArea[0].rested).toBe(true)
    replay('attack', final)
  })
  it.each(['attack-negative', 'wrong-color', 'wrong-phase', 'first-turn', 'attack-source-rested'])('ordinary attack rejects illegal resources/timing: %s', scenario => {
    const state = fixture(scenario), before = structuredClone(state)
    if (['attack-negative', 'wrong-color'].includes(scenario)) expect(selectEnergyPayment({ green: 1 }, state.players[owner].supportArea)).toBeNull()
    expect(() => attack(state)).toThrow(); expect(state).toEqual(before)
  })
})
