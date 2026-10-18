import { describe, expect, it } from 'vitest'
import { canActivateStage } from './card-abilities'
import { applyGameCommand } from './commands'
import { createSt9020PreviewState, rawSt9020 } from './st9-020-demo'
import type { GameCard, GameState, PlayerId } from './types'

const owner = 'player-one' as const
const opponent = 'player-two' as const

const allCards = (state: GameState, playerId: PlayerId): GameCard[] => {
  const player = state.players[playerId]
  return [
    ...player.deck,
    ...player.hand,
    ...player.breakArea,
    ...player.discardPile,
    ...player.supportArea.map(support => support.card),
    ...(player.stage ? [player.stage.card] : []),
    ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
  ]
}

const placeStage = (state: GameState): GameState => {
  const player = state.players[owner]
  const stage = player.hand.find(card => card.id === 'ST9-020')
  const payment = player.supportArea.find(support => !support.rested && support.card.energyColor === 'blue')
  if (!stage || !payment) throw Error('Original Tearcrown and active blue Support are required')
  return applyGameCommand(state, {
    kind: 'play-stage', playerId: owner, instanceId: stage.instanceId,
    paymentIds: [payment.card.instanceId],
  })
}

const beginActivation = (state: GameState): GameState => applyGameCommand(state, {
  kind: 'begin-activate-stage', playerId: owner, paymentIds: [], targetIds: [],
})

describe('ST9-020 physical Tearcrown Stage flow', () => {
  it('uses original 60-card decks, exact printed identity, legal copy counts, and HP stacks', () => {
    const state = createSt9020PreviewState('positive')
    const seenIds = new Set<string>()
    for (const playerId of [owner, opponent]) {
      const cards = allCards(state, playerId)
      expect(cards).toHaveLength(60)
      const copies = new Map<string, number>()
      for (const card of cards) {
        expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
        copies.set(card.id, (copies.get(card.id) ?? 0) + 1)
        expect(seenIds.has(card.instanceId)).toBe(false)
        seenIds.add(card.instanceId)
      }
      expect([...copies.values()].every(count => count <= 4)).toBe(true)
      for (const cookie of state.players[playerId].battleArea) {
        expect(cookie.hpCards).toHaveLength(cookie.card.hp)
      }
    }
    expect(seenIds).toHaveLength(120)
    expect(state.players[owner].hand[0]).toMatchObject({
      id: 'ST9-020', name: 'Tearcrown', type: 'stage', imageUrl: rawSt9020.imageUrl,
    })
    expect(state.players[owner].supportArea.filter(support => !support.rested && support.card.energyColor === 'blue'))
      .toHaveLength(1)
  })

  it('pays the printed B placement, then rests the Stage and draws zero or one without energy', () => {
    for (const drawCount of [0, 1]) {
      const initial = createSt9020PreviewState(drawCount === 0 ? 'zero-draw' : 'positive')
      const before = structuredClone(initial)
      const placed = placeStage(initial)
      expect(placed.players[owner].stage?.card.id).toBe('ST9-020')
      expect(placed.players[owner].hand).toHaveLength(2)
      expect(placed.players[owner].supportArea.filter(support => support.rested)).toHaveLength(3)
      expect(placed.commandLog?.at(-1)?.commandKind).toBe('play-stage')
      expect(canActivateStage(placed, owner)).toBe(true)

      const deckBefore = placed.players[owner].deck.length
      const activated = beginActivation(placed)
      expect(activated.players[owner].stage?.rested).toBe(true)
      expect(activated.pendingDrawUpTo?.max).toBe(1)
      expect(activated.pendingDrawUpTo?.playerId).toBe(owner)
      const resolved = applyGameCommand(activated, {
        kind: 'resolve-draw-up-to', playerId: owner, drawCount,
      })
      expect(resolved.pendingDrawUpTo ?? null).toBeNull()
      expect(resolved.players[owner].deck).toHaveLength(deckBefore - drawCount)
      expect(resolved.players[owner].hand).toHaveLength(2 + drawCount)
      expect(resolved.players[owner].stage?.rested).toBe(true)
      expect(initial).toEqual(before)
    }
  })

  it('still pays the REST cost above three cards, skips the draw, and cannot activate the rested Stage again', () => {
    const initial = createSt9020PreviewState('high-hand')
    const placed = placeStage(initial)
    expect(placed.players[owner].hand).toHaveLength(4)
    expect(canActivateStage(placed, owner)).toBe(true)

    const activated = beginActivation(placed)
    expect(activated.players[owner].stage?.rested).toBe(true)
    expect(activated.players[owner].hand).toHaveLength(4)
    expect(activated.pendingDrawUpTo).toBeUndefined()
    expect(activated.pendingAbilityEffect).toBeUndefined()
    expect(activated.commandLog?.at(-1)?.steps?.some(step => step.text.includes('場景效果結果：條件不成立')))
      .toBe(true)
    expect(canActivateStage(activated, owner)).toBe(false)
    expect(() => beginActivation(activated)).toThrow('目前無法啟動場景卡。')
  })

  it('refuses a non-blue placement payment without moving the Stage or resting the Support', () => {
    const initial = createSt9020PreviewState('no-blue-payment')
    const stage = initial.players[owner].hand[0]
    const wrongColor = initial.players[owner].supportArea[0]!.card.instanceId
    expect(initial.players[owner].supportArea.every(support => support.card.energyColor !== 'blue')).toBe(true)
    const before = structuredClone(initial)
    expect(() => applyGameCommand(initial, {
      kind: 'play-stage', playerId: owner, instanceId: stage.instanceId,
      paymentIds: [wrongColor],
    })).toThrow()
    expect(initial).toEqual(before)
  })

  it('rejects a draw choice above the printed maximum and preserves the pending choice', () => {
    const activated = beginActivation(placeStage(createSt9020PreviewState('positive')))
    const before = structuredClone(activated)
    expect(() => applyGameCommand(activated, {
      kind: 'resolve-draw-up-to', playerId: owner, drawCount: 2,
    })).toThrow()
    expect(activated).toEqual(before)
  })
})
