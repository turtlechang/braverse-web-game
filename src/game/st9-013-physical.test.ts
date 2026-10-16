import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { commandFromLogEntry } from './replay'
import { selectEnergyPayment } from './energy'
import { createSt9013PreviewState, st9013Zones, type St9013Scenario } from './st9-013-demo'
import type { GameState } from './types'

const owner = 'player-one' as const

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`)
  return value
}

const begin = (scenario: St9013Scenario = 'draw') => {
  const state = createSt9013PreviewState(scenario)
  const item = required(state.players[owner].hand.find(card => card.id === 'ST9-013'), 'original Item')
  const blueCard = state.players[owner].hand.find(card => card.id === 'ST9-002')
  const blueSupport = state.players[owner].supportArea.find(support =>
    !support.rested && support.card.energyColor === 'blue',
  )
  if (!blueSupport) throw new Error('Original active blue Support required')
  const paymentIds = selectEnergyPayment({ blue: 1 }, state.players[owner].supportArea)
  if (!paymentIds) throw new Error('Original blue Support must pay B')
  const opened = applyGameCommand(state, {
    kind: 'begin-play-item', playerId: owner, instanceId: item.instanceId,
    paymentIds,
    discardHandIds: blueCard ? [blueCard.instanceId] : [],
  })
  return { initial: state, opened, itemId: item.instanceId, blueCardId: blueCard?.instanceId, supportId: blueSupport.card.instanceId }
}

const replay = (state: GameState) => {
  let independent = createSt9013PreviewState('draw')
  for (const entry of state.commandLog ?? []) {
    independent = applyGameCommand(independent, commandFromLogEntry(entry))
  }
  expect(JSON.parse(JSON.stringify(independent))).toEqual(JSON.parse(JSON.stringify(state)))
}

describe('ST9-013 original Shimmering Moonlit Coral physical item flow', () => {
  it.each<St9013Scenario>(['draw', 'no-blue-hand-card', 'no-blue-support'])(
    '%s uses two original sixty-card decks, real artwork, unique IDs, and printed HP', scenario => {
      const state = createSt9013PreviewState(scenario)
      const allIds: string[] = []
      for (const playerId of ['player-one', 'player-two'] as const) {
        const cards = st9013Zones(state, playerId)
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

  it.each([0, 1, 2])('pays B and one blue hand card before drawing %i cards', drawCount => {
    const { initial, opened, itemId, blueCardId, supportId } = begin()
    const before = structuredClone(initial)
    const own = opened.players[owner]
    const deckCount = own.deck.length
    expect(blueCardId).toBeDefined()
    expect(own.hand.map(card => card.id)).toEqual(['ST6-001'])
    expect(own.supportArea.find(support => support.card.instanceId === supportId)?.rested).toBe(true)
    expect(own.discardPile.map(card => card.instanceId)).toEqual([blueCardId, itemId])
    expect(opened.pendingAbilityEffect).toMatchObject({ sourceKind: 'item', sourceInstanceId: itemId })

    const resolving = applyGameCommand(opened, {
      kind: 'resolve-ability-effect', playerId: owner, targetIds: [],
    })
    expect(resolving.pendingDrawUpTo).toMatchObject({ playerId: owner, max: 2, sourceCardId: 'ST9-013' })
    const state = applyGameCommand(resolving, { kind: 'resolve-draw-up-to', playerId: owner, drawCount })
    expect(state.players[owner].hand).toHaveLength(1 + drawCount)
    expect(state.players[owner].deck).toHaveLength(deckCount - drawCount)
    expect(state.players[owner].discardPile.map(card => card.instanceId)).toEqual([blueCardId, itemId])
    expect(state.pendingDrawUpTo ?? null).toBeNull()
    expect(state.commandLog?.map(entry => entry.commandKind)).toEqual([
      'begin-play-item', 'resolve-ability-effect', 'resolve-draw-up-to',
    ])
    expect(initial).toEqual(before)
    replay(state)
  })

  it('rejects drawing above the printed maximum of two without changing the pending choice', () => {
    const { opened } = begin()
    const pending = applyGameCommand(opened, {
      kind: 'resolve-ability-effect', playerId: owner, targetIds: [],
    })
    const before = structuredClone(pending)
    expect(pending.pendingDrawUpTo?.max).toBe(2)
    expect(() => applyGameCommand(pending, {
      kind: 'resolve-draw-up-to', playerId: owner, drawCount: 3,
    })).toThrow()
    expect(pending).toEqual(before)
  })

  it('rejects a missing or non-blue hand card as the printed discard cost without mutation', () => {
    const state = createSt9013PreviewState('draw')
    const item = required(state.players[owner].hand.find(card => card.id === 'ST9-013'), 'Item')
    const redCard = required(state.players[owner].hand.find(card => card.id === 'ST6-001'), 'red hand card')
    const paymentIds = required(selectEnergyPayment({ blue: 1 }, state.players[owner].supportArea), 'blue payment')
    const before = structuredClone(state)

    for (const discardHandIds of [[], [redCard.instanceId]]) {
      expect(() => applyGameCommand(state, {
        kind: 'begin-play-item', playerId: owner, instanceId: item.instanceId,
        paymentIds, discardHandIds,
      })).toThrow()
      expect(state).toEqual(before)
    }
  })

  it('rejects a red support as B and a blue discard when no blue support exists', () => {
    const state = createSt9013PreviewState('no-blue-support')
    const item = required(state.players[owner].hand.find(card => card.id === 'ST9-013'), 'Item')
    const blueCard = required(state.players[owner].hand.find(card => card.id === 'ST9-002'), 'blue hand card')
    const redSupport = required(state.players[owner].supportArea[0], 'red support')
    const before = structuredClone(state)

    expect(() => applyGameCommand(state, {
      kind: 'begin-play-item', playerId: owner, instanceId: item.instanceId,
      paymentIds: [redSupport.card.instanceId], discardHandIds: [blueCard.instanceId],
    })).toThrow()
    expect(state).toEqual(before)
  })

  it('rejects the source Item as payment, a rested blue Support, and extra discard cards atomically', () => {
    const state = createSt9013PreviewState('draw')
    const item = required(state.players[owner].hand.find(card => card.id === 'ST9-013'), 'Item')
    const blueCard = required(state.players[owner].hand.find(card => card.id === 'ST9-002'), 'blue hand card')
    const redCard = required(state.players[owner].hand.find(card => card.id === 'ST6-001'), 'red hand card')
    const support = required(state.players[owner].supportArea.find(entry => entry.card.energyColor === 'blue'), 'blue Support')
    const before = structuredClone(state)
    const validPaymentIds = [support.card.instanceId]

    for (const command of [
      { paymentIds: [item.instanceId], discardHandIds: [blueCard.instanceId] },
      { paymentIds: validPaymentIds, discardHandIds: [item.instanceId] },
      { paymentIds: validPaymentIds, discardHandIds: [blueCard.instanceId, redCard.instanceId] },
    ]) {
      expect(() => applyGameCommand(state, {
        kind: 'begin-play-item', playerId: owner, instanceId: item.instanceId, ...command,
      })).toThrow()
      expect(state).toEqual(before)
    }

    support.rested = true
    const restedBefore = structuredClone(state)
    expect(() => applyGameCommand(state, {
      kind: 'begin-play-item', playerId: owner, instanceId: item.instanceId,
      paymentIds: validPaymentIds, discardHandIds: [blueCard.instanceId],
    })).toThrow()
    expect(state).toEqual(restedBefore)
  })

  it('rejects paying B when only a blue support is available but the hand has only red cards', () => {
    const state = createSt9013PreviewState('no-blue-hand-card')
    const item = required(state.players[owner].hand.find(card => card.id === 'ST9-013'), 'Item')
    const redCard = required(state.players[owner].hand.find(card => card.id === 'ST6-001'), 'red hand card')
    const paymentIds = required(selectEnergyPayment({ blue: 1 }, state.players[owner].supportArea), 'blue support')
    const before = structuredClone(state)

    expect(() => applyGameCommand(state, {
      kind: 'begin-play-item', playerId: owner, instanceId: item.instanceId,
      paymentIds, discardHandIds: [redCard.instanceId],
    })).toThrow()
    expect(state).toEqual(before)
  })
})
