import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { selectEnergyPayment } from './energy'
import { commandFromLogEntry } from './replay'
import { createSt8015PreviewState, st8015Scenarios } from './st8-015-demo'
import type { GameState } from './types'

const owner = 'player-one' as const
const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === undefined || value === null) throw Error(`Missing ${label}`)
  return value
}

const cardCount = (state: GameState, playerId: 'player-one' | 'player-two') => {
  const player = state.players[playerId]
  return [
    ...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile,
    ...player.supportArea.map(support => support.card),
    ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
  ]
}

const begin = (state: GameState, mode?: number) => {
  const player = state.players[owner]
  const item = required(player.hand.find(card => card.id === 'ST8-015'), 'Essence of the Tempest')
  const paymentIds = selectEnergyPayment({ green: 2 }, player.supportArea)
  if (!paymentIds) throw Error('Two active green support cards are required')
  return applyGameCommand(state, {
    kind: 'begin-play-item', playerId: owner, instanceId: item.instanceId, paymentIds,
    ...(mode === undefined ? {} : { chooseOneModes: [mode] }),
  })
}

const resolve = (state: GameState, targetIds: string[] = []) =>
  applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: owner, targetIds })

const replay = (scenario: (typeof st8015Scenarios)[number], final: GameState) => {
  let state = createSt8015PreviewState(scenario)
  for (const entry of final.commandLog ?? []) state = applyGameCommand(state, commandFromLogEntry(entry))
  expect(JSON.parse(JSON.stringify(state))).toEqual(JSON.parse(JSON.stringify(final)))
}

describe('ST8-015 physical Essence of the Tempest flow', () => {
  it.each(st8015Scenarios)('%s uses 60 original cards, unique IDs, four-copy limits and printed HP', scenario => {
    const state = createSt8015PreviewState(scenario), ids: string[] = []
    for (const playerId of ['player-one', 'player-two'] as const) {
      const cards = cardCount(state, playerId)
      expect(cards).toHaveLength(60)
      ids.push(...cards.map(card => card.instanceId))
      const counts = new Map<string, number>()
      for (const card of cards) {
        expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
        counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
      }
      expect([...counts.values()].every(count => count <= 4)).toBe(true)
      for (const cookie of playerId === owner ? state.players[owner].battleArea : state.players[playerId].battleArea) {
        expect(cookie.hpCards).toHaveLength(cookie.card.hp)
      }
    }
    expect(new Set(ids).size).toBe(120)
  })

  it('pays GG, places the real deck-top card rested, then may return that newly placed card', () => {
    const initial = createSt8015PreviewState('positive')
    const before = structuredClone(initial)
    const own = initial.players[owner], top = required(own.deck[0], 'original top card')
    const item = required(own.hand.find(card => card.id === 'ST8-015'), 'original Item')
    const paymentIds = required(selectEnergyPayment({ green: 2 }, own.supportArea), 'two active G supports')
    const paid = begin(initial, 0)
    expect(paid.players[owner].supportArea.filter(support => paymentIds.includes(support.card.instanceId) && support.rested))
      .toHaveLength(2)
    expect(paid.pendingAbilityEffect?.sourceInstanceId).toBe(item.instanceId)
    expect(paid.pendingAbilityEffect?.effectIndex).toBe(0)
    const placed = resolve(paid)
    expect(placed.players[owner].deck).toEqual(own.deck.slice(1))
    expect(placed.players[owner].supportArea.at(-1)).toEqual({ card: top, rested: true })
    expect(placed.pendingAbilityEffect?.effectIndex).toBe(1)
    const final = resolve(placed, [top.instanceId])
    expect(final.players[owner].hand).toContainEqual(top)
    expect(final.players[owner].supportArea.some(support => support.card.instanceId === top.instanceId)).toBe(false)
    expect(final.players[owner].discardPile).toContainEqual(item)
    expect(final.pendingAbilityEffect).toBeUndefined()
    expect(initial).toEqual(before)
    replay('positive', final)
  })

  it('chooses zero placement and still resolves the optional Then against an existing support card', () => {
    const initial = createSt8015PreviewState('zero-placement')
    const own = initial.players[owner], top = own.deck[0]
    const returned = required(own.supportArea.find(support => support.card.id === 'ST1-016'), 'existing support')
    const paid = begin(initial, 1)
    const afterZero = resolve(paid)
    expect(afterZero.players[owner].deck[0]).toEqual(top)
    expect(afterZero.players[owner].supportArea).toContainEqual(returned)
    expect(afterZero.pendingAbilityEffect?.effectIndex).toBe(1)
    const final = resolve(afterZero, [returned.card.instanceId])
    expect(final.players[owner].hand).toContainEqual(returned.card)
    expect(final.players[owner].supportArea.some(support => support.card.instanceId === returned.card.instanceId)).toBe(false)
    expect(final.players[owner].deck[0]).toEqual(top)
    replay('zero-placement', final)
  })

  it('accepts Wind Archer in the support area as the condition witness and keeps the new top card rested', () => {
    const initial = createSt8015PreviewState('wind-support')
    const own = initial.players[owner]
    const wind = required(own.supportArea.find(support => support.card.id === 'ST8-005'), 'support-area Wind Archer')
    const top = own.deck[0]
    const afterPlacement = resolve(begin(initial, 0))
    expect(afterPlacement.players[owner].supportArea.at(-1)).toEqual({ card: top, rested: true })
    const final = resolve(afterPlacement, [wind.card.instanceId])
    expect(final.players[owner].hand).toContainEqual(wind.card)
    expect(final.players[owner].supportArea.some(support => support.card.instanceId === top.instanceId && support.rested)).toBe(true)
    replay('wind-support', final)
  })

  it('still pays GG without either Wind Archer witness; the conditional placement is skipped but Then remains optional', () => {
    const initial = createSt8015PreviewState('no-wind')
    const own = initial.players[owner], top = own.deck[0]
    const returned = required(own.supportArea.find(support => support.card.id === 'ST1-016'), 'existing support')
    expect(own.battleArea.some(cookie => cookie.card.id === 'ST8-005')).toBe(false)
    expect(own.supportArea.some(support => support.card.id === 'ST8-005')).toBe(false)
    const paid = begin(initial)
    const paymentIds = required(selectEnergyPayment({ green: 2 }, own.supportArea), 'two active G supports')
    expect(paid.players[owner].supportArea.filter(support => paymentIds.includes(support.card.instanceId) && support.rested))
      .toHaveLength(2)
    expect(paid.players[owner].deck[0]).toEqual(top)
    expect(paid.pendingAbilityEffect?.effectIndex).toBe(0)
    const final = resolve(paid, [returned.card.instanceId])
    expect(final.players[owner].deck[0]).toEqual(top)
    expect(final.players[owner].hand).toContainEqual(returned.card)
    expect(final.players[owner].supportArea.some(support => support.card.instanceId === returned.card.instanceId)).toBe(false)
    replay('no-wind', final)
  })

  it('allows declining the Then after placing the top card', () => {
    const initial = createSt8015PreviewState('positive'), top = initial.players[owner].deck[0]
    const afterPlacement = resolve(begin(initial, 0))
    const final = resolve(afterPlacement)
    expect(final.players[owner].supportArea.at(-1)).toEqual({ card: top, rested: true })
    expect(final.players[owner].hand).toEqual(initial.players[owner].hand.slice(1))
    replay('positive', final)
  })

  it('rejects a target outside own support and preserves the pending Then', () => {
    const initial = createSt8015PreviewState('positive')
    const pendingThen = resolve(begin(initial, 0))
    const placed = resolve(pendingThen)
    const opponentSupport = placed.players['player-two'].supportArea[0]?.card
    if (opponentSupport) {
      const before = structuredClone(placed)
      expect(() => resolve(placed, [opponentSupport.instanceId])).toThrow()
      expect(placed).toEqual(before)
    }
  })

  it('cannot pay GG with fewer than two active green support cards', () => {
    const initial = createSt8015PreviewState('no-green-payment')
    const before = structuredClone(initial)
    const item = required(initial.players[owner].hand.find(card => card.id === 'ST8-015'), 'Item')
    expect(selectEnergyPayment({ green: 2 }, initial.players[owner].supportArea)).toBeNull()
    expect(() => applyGameCommand(initial, {
      kind: 'begin-play-item', playerId: owner, instanceId: item.instanceId, paymentIds: [], chooseOneModes: [0],
    })).toThrow()
    expect(initial).toEqual(before)
  })
})
