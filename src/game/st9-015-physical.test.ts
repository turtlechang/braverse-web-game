import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { commandFromLogEntry } from './replay'
import { selectEnergyPayment } from './energy'
import { createSt9015PreviewState, st9015Zones, type St9015Scenario } from './st9-015-demo'
import type { GameState } from './types'

const owner = 'player-one' as const

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`)
  return value
}

const begin = (scenario: St9015Scenario) => {
  const initial = createSt9015PreviewState(scenario)
  const item = required(initial.players[owner].hand.find(card => card.id === 'ST9-015'), 'original Item')
  const support = required(
    initial.players[owner].supportArea.find(entry => !entry.rested && entry.card.energyColor === 'blue'),
    'active blue Support',
  )
  const paymentIds = selectEnergyPayment({ blue: 1 }, initial.players[owner].supportArea)
  if (!paymentIds) throw new Error('One real active blue Support is required')
  const opened = applyGameCommand(initial, {
    kind: 'begin-play-item', playerId: owner, instanceId: item.instanceId,
    paymentIds, discardHandIds: [],
  })
  return { initial, opened, itemId: item.instanceId, supportId: support.card.instanceId }
}

const replay = (scenario: St9015Scenario, state: GameState) => {
  let independent = createSt9015PreviewState(scenario)
  for (const entry of state.commandLog ?? []) {
    independent = applyGameCommand(independent, commandFromLogEntry(entry))
  }
  expect(JSON.parse(JSON.stringify(independent))).toEqual(JSON.parse(JSON.stringify(state)))
}

describe('ST9-015 original Essence of the Ocean physical item flow', () => {
  it.each<St9015Scenario>(['low-hand', 'high-hand', 'no-blue-support'])(
    '%s uses two original sixty-card decks, printed HP, and legal copy counts', scenario => {
      const state = createSt9015PreviewState(scenario)
      const allInstanceIds: string[] = []
      for (const playerId of ['player-one', 'player-two'] as const) {
        const cards = st9015Zones(state, playerId)
        expect(cards).toHaveLength(60)
        expect(cards.every(card => card.imageUrl?.startsWith('https://cookierunbraverse.com/') === true)).toBe(true)
        allInstanceIds.push(...cards.map(card => card.instanceId))

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
      expect(new Set(allInstanceIds).size).toBe(120)
      expect(state.players[owner].battleArea.map(entry => [entry.card.id, entry.hpCards.length])).toEqual([
        ['BS2-029', 5], ['ST9-006', 6], ['ST9-007', 5],
      ])
      expect(state.players['player-two'].battleArea.map(entry => [entry.card.id, entry.hpCards.length])).toEqual([
        ['ST6-003', 4], ['BS2-029', 5],
      ])
    },
  )

  it.each([0, 1])('pays B and resolves the independent Sea Fairy Then after drawing %i', drawCount => {
    const { initial, opened, itemId, supportId } = begin('low-hand')
    const before = structuredClone(initial)
    const deckCount = initial.players[owner].deck.length
    const eligible = required(initial.players[owner].battleArea.find(entry => entry.card.id === 'BS2-029'), 'five-HP Sea Fairy')
    const ineligible = required(initial.players[owner].battleArea.find(entry => entry.card.id === 'ST9-006'), 'six-HP Sea Fairy')
    expect(initial.players[owner].hand).toHaveLength(6)
    expect(opened.players[owner].hand).toHaveLength(5)
    expect(opened.players[owner].discardPile.map(card => card.instanceId)).toEqual([itemId])
    expect(opened.players[owner].supportArea.find(entry => entry.card.instanceId === supportId)?.rested).toBe(true)
    expect(opened.pendingAbilityEffect).toMatchObject({ sourceKind: 'item', sourceInstanceId: itemId })

    const drawPending = applyGameCommand(opened, {
      kind: 'resolve-ability-effect', playerId: owner, targetIds: [],
    })
    expect(drawPending.pendingDrawUpTo).toMatchObject({ playerId: owner, max: 1, sourceCardId: 'ST9-015' })
    const drawn = applyGameCommand(drawPending, { kind: 'resolve-draw-up-to', playerId: owner, drawCount })
    expect(drawn.players[owner].hand).toHaveLength(5 + drawCount)
    expect(drawn.players[owner].deck).toHaveLength(deckCount - drawCount)
    expect(drawn.pendingAbilityEffect).toBeTruthy()
    const healed = applyGameCommand(drawn, {
      kind: 'resolve-ability-effect', playerId: owner, targetIds: [eligible.card.instanceId],
    })

    expect(healed.players[owner].battleArea.find(entry => entry.card.instanceId === eligible.card.instanceId)?.hpCards)
      .toHaveLength(6)
    expect(healed.players[owner].battleArea.find(entry => entry.card.instanceId === ineligible.card.instanceId)?.hpCards)
      .toHaveLength(6)
    expect(healed.pendingAbilityEffect ?? null).toBeNull()
    expect(healed.commandLog?.map(entry => entry.commandKind)).toEqual([
      'begin-play-item', 'resolve-ability-effect', 'resolve-draw-up-to', 'resolve-ability-effect',
    ])
    expect(initial).toEqual(before)
    replay('low-hand', healed)
  })

  it('skips only the draw above five cards and still resolves Then on a five-HP Sea Fairy', () => {
    const { initial, opened, itemId, supportId } = begin('high-hand')
    const deckCount = initial.players[owner].deck.length
    const target = required(initial.players[owner].battleArea.find(entry => entry.card.id === 'BS2-029'), 'five-HP Sea Fairy')
    expect(initial.players[owner].hand).toHaveLength(7)
    expect(opened.players[owner].hand).toHaveLength(6)
    expect(opened.players[owner].supportArea.find(entry => entry.card.instanceId === supportId)?.rested).toBe(true)
    expect(opened.pendingAbilityEffect?.sourceInstanceId).toBe(itemId)

    const healed = applyGameCommand(opened, {
      kind: 'resolve-ability-effect', playerId: owner, targetIds: [target.card.instanceId],
    })
    expect(healed.players[owner].hand).toHaveLength(6)
    expect(healed.players[owner].deck).toHaveLength(deckCount - 1)
    expect(healed.players[owner].battleArea.find(entry => entry.card.instanceId === target.card.instanceId)?.hpCards)
      .toHaveLength(6)
    expect(healed.pendingAbilityEffect ?? null).toBeNull()
    expect(healed.commandLog?.map(entry => entry.commandKind)).toEqual(['begin-play-item', 'resolve-ability-effect'])
    replay('high-hand', healed)
  })

  it('can choose zero heal targets, and rejects a six-HP Sea Fairy without mutation', () => {
    const { opened } = begin('low-hand')
    const drawPending = applyGameCommand(opened, {
      kind: 'resolve-ability-effect', playerId: owner, targetIds: [],
    })
    const drawn = applyGameCommand(drawPending, { kind: 'resolve-draw-up-to', playerId: owner, drawCount: 0 })
    const before = structuredClone(drawn)
    const ineligible = required(drawn.players[owner].battleArea.find(entry => entry.card.id === 'ST9-006'), 'six-HP Sea Fairy')

    expect(() => applyGameCommand(drawn, {
      kind: 'resolve-ability-effect', playerId: owner, targetIds: [ineligible.card.instanceId],
    })).toThrow()
    expect(drawn).toEqual(before)

    const skipped = applyGameCommand(drawn, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [] })
    expect(skipped.players[owner].battleArea.find(entry => entry.card.id === 'BS2-029')?.hpCards).toHaveLength(5)
    expect(skipped.players[owner].battleArea.find(entry => entry.card.id === 'ST9-006')?.hpCards).toHaveLength(6)
    expect(skipped.pendingAbilityEffect ?? null).toBeNull()
    replay('low-hand', skipped)
  })

  it.each([
    ['an own non-Sea Fairy Cookie', owner, 'ST9-007'],
    ['an opposing Sea Fairy Cookie', 'player-two' as const, 'BS2-029'],
  ])('rejects %s as a Then target without mutating the pending state', (_label, targetOwner, cardNumber) => {
    const { opened } = begin('low-hand')
    const drawPending = applyGameCommand(opened, {
      kind: 'resolve-ability-effect', playerId: owner, targetIds: [],
    })
    const drawn = applyGameCommand(drawPending, { kind: 'resolve-draw-up-to', playerId: owner, drawCount: 0 })
    const wrongTarget = required(
      drawn.players[targetOwner].battleArea.find(entry => entry.card.id === cardNumber),
      `physical ${cardNumber} wrong target`,
    )
    const before = structuredClone(drawn)

    expect(() => applyGameCommand(drawn, {
      kind: 'resolve-ability-effect', playerId: owner, targetIds: [wrongTarget.card.instanceId],
    })).toThrow()
    expect(drawn).toEqual(before)
  })

  it('enforces the draw maximum and leaves the pending choice unchanged when exceeded', () => {
    const { opened } = begin('low-hand')
    const pending = applyGameCommand(opened, {
      kind: 'resolve-ability-effect', playerId: owner, targetIds: [],
    })
    const before = structuredClone(pending)
    expect(pending.pendingDrawUpTo?.max).toBe(1)
    expect(() => applyGameCommand(pending, {
      kind: 'resolve-draw-up-to', playerId: owner, drawCount: 2,
    })).toThrow()
    expect(pending).toEqual(before)
  })

  it('rejects wrong-color or rested energy, with no blue Support state left unchanged', () => {
    const noBlue = createSt9015PreviewState('no-blue-support')
    const item = required(noBlue.players[owner].hand.find(card => card.id === 'ST9-015'), 'Item')
    const redSupport = required(noBlue.players[owner].supportArea[0], 'red Support')
    const before = structuredClone(noBlue)
    expect(() => applyGameCommand(noBlue, {
      kind: 'begin-play-item', playerId: owner, instanceId: item.instanceId,
      paymentIds: [redSupport.card.instanceId], discardHandIds: [],
    })).toThrow()
    expect(noBlue).toEqual(before)

    const payable = createSt9015PreviewState('low-hand')
    const payableItem = required(payable.players[owner].hand.find(card => card.id === 'ST9-015'), 'Item')
    const blue = required(payable.players[owner].supportArea[0], 'blue Support')
    blue.rested = true
    const restedBefore = structuredClone(payable)
    expect(() => applyGameCommand(payable, {
      kind: 'begin-play-item', playerId: owner, instanceId: payableItem.instanceId,
      paymentIds: [blue.card.instanceId], discardHandIds: [],
    })).toThrow()
    expect(payable).toEqual(restedBefore)
  })
})
