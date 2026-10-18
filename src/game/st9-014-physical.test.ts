import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { commandFromLogEntry } from './replay'
import { selectEnergyPayment } from './energy'
import { createSt9014PreviewState, st9014Zones, type St9014Scenario } from './st9-014-demo'
import type { GameState } from './types'

const owner = 'player-one' as const

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`)
  return value
}

const begin = (scenario: St9014Scenario = 'heal') => {
  const state = createSt9014PreviewState(scenario)
  const item = required(state.players[owner].hand.find(card => card.id === 'ST9-014'), 'original Item')
  const discardIds = state.players[owner].hand
    .filter(card => card.instanceId !== item.instanceId)
    .slice(0, 3)
    .map(card => card.instanceId)
  const paymentIds = selectEnergyPayment({ blue: 2 }, state.players[owner].supportArea)
  if (!paymentIds) throw new Error('Two original active blue Supports must pay BB')
  const opened = applyGameCommand(state, {
    kind: 'begin-play-item', playerId: owner, instanceId: item.instanceId,
    paymentIds, discardHandIds: discardIds,
  })
  return { initial: state, opened, itemId: item.instanceId, discardIds, paymentIds }
}

const replay = (state: GameState, scenario: St9014Scenario = 'heal') => {
  let independent = createSt9014PreviewState(scenario)
  for (const entry of state.commandLog ?? []) {
    independent = applyGameCommand(independent, commandFromLogEntry(entry))
  }
  expect(JSON.parse(JSON.stringify(independent))).toEqual(JSON.parse(JSON.stringify(state)))
}

describe('ST9-014 original Glittering Pearl Shell physical item flow', () => {
  it.each<St9014Scenario>(['heal', 'no-cookies', 'insufficient-hand', 'no-blue-support', 'one-blue-support'])(
    '%s uses two original sixty-card decks, real artwork, unique IDs, and printed HP', scenario => {
      const state = createSt9014PreviewState(scenario)
      const allIds: string[] = []
      for (const playerId of ['player-one', 'player-two'] as const) {
        const cards = st9014Zones(state, playerId)
        expect(cards).toHaveLength(60)
        expect(cards.every(card => card.imageUrl?.startsWith('https://cookierunbraverse.com/') === true)).toBe(true)
        allIds.push(...cards.map(card => card.instanceId))

        const copiesById = new Map<string, number>()
        const copiesByName = new Map<string, number>()
        for (const card of cards) {
          copiesById.set(card.id, (copiesById.get(card.id) ?? 0) + 1)
          copiesByName.set(card.name, (copiesByName.get(card.name) ?? 0) + 1)
        }
        expect([...copiesById.values()].every(count => count <= 4)).toBe(true)
        expect([...copiesByName.values()].every(count => count <= 4)).toBe(true)
        for (const cookie of state.players[playerId].battleArea) {
          expect(cookie.hpCards).toHaveLength(cookie.card.hp)
        }
      }
      expect(new Set(allIds).size).toBe(120)
    },
  )

  it('pays BB and three different physical card types, then adds two real HP cards to one own Cookie', () => {
    const { initial, opened, itemId, discardIds, paymentIds } = begin()
    const before = structuredClone(initial)
    const own = opened.players[owner]
    const target = required(own.battleArea.find(cookie => cookie.card.id === 'ST9-002'), 'own two-HP target')
    const untouched = required(own.battleArea.find(cookie => cookie.card.id === 'ST9-001'), 'other own target')
    const targetBefore = initial.players[owner].battleArea.find(cookie => cookie.card.id === 'ST9-002')
    if (!targetBefore) throw new Error('Original target missing')
    const targetHpIds = targetBefore.hpCards.map(card => card.instanceId)
    const deckTopIds = initial.players[owner].deck.slice(0, 2).map(card => card.instanceId)
    const deckCount = initial.players[owner].deck.length
    const expectedDiscardIds = new Set([...discardIds, itemId])

    expect(discardIds.map(id => initial.players[owner].hand.find(card => card.instanceId === id)?.type)).toEqual([
      'cookie', 'item', 'trap',
    ])
    expect(paymentIds).toHaveLength(2)
    expect(own.hand).toEqual([])
    expect(own.supportArea.filter(support => support.rested).map(support => support.card.instanceId)).toEqual(paymentIds)
    expect(new Set(own.discardPile.map(card => card.instanceId))).toEqual(expectedDiscardIds)
    expect(opened.pendingAbilityEffect).toMatchObject({ sourceKind: 'item', sourceInstanceId: itemId })
    expect(opened.commandLog?.map(entry => entry.commandKind)).toEqual(['begin-play-item'])

    const resolving = applyGameCommand(opened, {
      kind: 'resolve-ability-effect', playerId: owner, targetIds: [target.card.instanceId],
    })
    const healed = required(resolving.players[owner].battleArea.find(cookie => cookie.card.instanceId === target.card.instanceId), 'healed Cookie')
    const stillUnchanged = required(resolving.players[owner].battleArea.find(cookie => cookie.card.instanceId === untouched.card.instanceId), 'untouched Cookie')
    expect(healed.hpCards.map(card => card.instanceId)).toEqual([...targetHpIds, ...deckTopIds])
    expect(healed.hpCards).toHaveLength(target.card.hp + 2)
    expect(stillUnchanged.hpCards).toEqual(untouched.hpCards)
    expect(resolving.players[owner].deck).toHaveLength(deckCount - 2)
    expect(resolving.players[owner].discardPile.map(card => card.instanceId)).toContain(itemId)
    expect(resolving.players[owner].discardPile.map(card => card.instanceId)).toEqual(expect.arrayContaining([...expectedDiscardIds]))
    expect(resolving.pendingAbilityEffect ?? null).toBeNull()
    expect(resolving.commandLog?.map(entry => entry.commandKind)).toEqual(['begin-play-item', 'resolve-ability-effect'])
    expect(initial).toEqual(before)
    for (const playerId of ['player-one', 'player-two'] as const) expect(st9014Zones(resolving, playerId)).toHaveLength(60)
    replay(resolving)
  })

  it('still pays both costs when the player chooses zero of the optional Cookie targets', () => {
    const { initial, opened, itemId, paymentIds, discardIds } = begin()
    const deckCount = opened.players[owner].deck.length
    const resolving = applyGameCommand(opened, {
      kind: 'resolve-ability-effect', playerId: owner, targetIds: [],
    })
    expect(resolving.players[owner].deck).toHaveLength(deckCount)
    expect(resolving.players[owner].battleArea.map(cookie => cookie.hpCards)).toEqual(
      initial.players[owner].battleArea.map(cookie => cookie.hpCards),
    )
    expect(resolving.players[owner].discardPile.map(card => card.instanceId)).toEqual(expect.arrayContaining([...discardIds, itemId]))
    expect(resolving.players[owner].supportArea.filter(support => support.rested).map(support => support.card.instanceId)).toEqual(paymentIds)
    expect(resolving.pendingAbilityEffect ?? null).toBeNull()
    replay(resolving)
  })

  it('allows the optional effect to resolve with no own Battle Cookies and keeps the paid costs', () => {
    const { opened, itemId, paymentIds, discardIds } = begin('no-cookies')
    expect(opened.players[owner].battleArea).toEqual([])
    const deckCount = opened.players[owner].deck.length
    const resolving = applyGameCommand(opened, {
      kind: 'resolve-ability-effect', playerId: owner, targetIds: [],
    })
    expect(resolving.players[owner].deck).toHaveLength(deckCount)
    expect(resolving.players[owner].battleArea).toEqual([])
    expect(resolving.players[owner].discardPile.map(card => card.instanceId)).toEqual(expect.arrayContaining([...discardIds, itemId]))
    expect(resolving.players[owner].supportArea.filter(support => support.rested).map(support => support.card.instanceId)).toEqual(paymentIds)
    expect(resolving.pendingAbilityEffect ?? null).toBeNull()
    replay(resolving, 'no-cookies')
  })

  it('rejects fewer than three hand cards, a source-Item discard, extra discard, and an opponent target atomically', () => {
    const shortHand = createSt9014PreviewState('insufficient-hand')
    const shortItem = required(shortHand.players[owner].hand.find(card => card.id === 'ST9-014'), 'Item')
    const shortPayment = required(selectEnergyPayment({ blue: 2 }, shortHand.players[owner].supportArea), 'BB payment')
    const shortDiscards = shortHand.players[owner].hand.filter(card => card.instanceId !== shortItem.instanceId)
    const shortBefore = structuredClone(shortHand)
    expect(shortDiscards).toHaveLength(2)
    expect(() => applyGameCommand(shortHand, {
      kind: 'begin-play-item', playerId: owner, instanceId: shortItem.instanceId,
      paymentIds: shortPayment, discardHandIds: shortDiscards.map(card => card.instanceId),
    })).toThrow()
    expect(shortHand).toEqual(shortBefore)

    const state = createSt9014PreviewState('heal')
    const item = required(state.players[owner].hand.find(card => card.id === 'ST9-014'), 'Item')
    const ownDiscards = state.players[owner].hand.filter(card => card.instanceId !== item.instanceId)
    const paymentIds = required(selectEnergyPayment({ blue: 2 }, state.players[owner].supportArea), 'BB payment')
    const sourceBefore = structuredClone(state)
    expect(() => applyGameCommand(state, {
      kind: 'begin-play-item', playerId: owner, instanceId: item.instanceId,
      paymentIds, discardHandIds: [item.instanceId, ownDiscards[0]!.instanceId, ownDiscards[1]!.instanceId],
    })).toThrow()
    expect(state).toEqual(sourceBefore)

    const extraHandState = createSt9014PreviewState('heal')
    const extraItem = required(extraHandState.players[owner].hand.find(card => card.id === 'ST9-014'), 'Item')
    const extraPayment = required(selectEnergyPayment({ blue: 2 }, extraHandState.players[owner].supportArea), 'BB payment')
    const extraCard = required(extraHandState.players[owner].deck.pop(), 'extra physical hand card')
    extraHandState.players[owner].hand.push(extraCard)
    const extraDiscards = extraHandState.players[owner].hand.filter(card => card.instanceId !== extraItem.instanceId)
    const extraBefore = structuredClone(extraHandState)
    expect(extraDiscards).toHaveLength(4)
    expect(() => applyGameCommand(extraHandState, {
      kind: 'begin-play-item', playerId: owner, instanceId: extraItem.instanceId,
      paymentIds: extraPayment, discardHandIds: extraDiscards.map(card => card.instanceId),
    })).toThrow()
    expect(extraHandState).toEqual(extraBefore)

    const { opened } = begin()
    const pendingBefore = structuredClone(opened)
    const opponentTarget = required(opened.players['player-two'].battleArea[0], 'opponent Cookie')
    expect(() => applyGameCommand(opened, {
      kind: 'resolve-ability-effect', playerId: owner, targetIds: [opponentTarget.card.instanceId],
    })).toThrow()
    expect(opened).toEqual(pendingBefore)
  })

  it('rejects missing or wrong-color B payments without changing any zone', () => {
    for (const scenario of ['no-blue-support', 'one-blue-support'] as const) {
      const state = createSt9014PreviewState(scenario)
      const item = required(state.players[owner].hand.find(card => card.id === 'ST9-014'), 'Item')
      const redOrShortSupportIds = state.players[owner].supportArea.map(support => support.card.instanceId)
      const discardIds = state.players[owner].hand.filter(card => card.instanceId !== item.instanceId)
        .slice(0, 3).map(card => card.instanceId)
      const before = structuredClone(state)
      expect(selectEnergyPayment({ blue: 2 }, state.players[owner].supportArea)).toBeNull()
      expect(() => applyGameCommand(state, {
        kind: 'begin-play-item', playerId: owner, instanceId: item.instanceId,
        paymentIds: redOrShortSupportIds, discardHandIds: discardIds,
      })).toThrow()
      expect(state).toEqual(before)
    }
  })
})
