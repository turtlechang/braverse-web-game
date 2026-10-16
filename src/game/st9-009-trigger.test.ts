import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createSt9007To009PreviewState, rawSt9007To009 } from './st9-007-009-demo'
import { createCard } from './starter-deck'
import type { GameState, PlayerId } from './types'

const owner = 'player-one' as const
const opponent = 'player-two' as const

const attackWith = (state: GameState, playerId: PlayerId): GameState => {
  const attacker = state.players[playerId].battleArea[0]
  const targetPlayerId = playerId === owner ? opponent : owner
  const target = state.players[targetPlayerId].battleArea[0]
  if (!attacker || !target) throw new Error('Original attack participants are required')
  return applyGameCommand(state, {
    kind: 'declare-attack',
    playerId,
    attackerInstanceId: attacker.card.instanceId,
    targetInstanceId: target.card.instanceId,
    supportPaymentIds: state.players[playerId].supportArea.slice(0, 3)
      .map(support => support.card.instanceId),
  })
}

const settleBaseAttack = (state: GameState, defenderId: PlayerId): GameState => {
  let current = state.pendingBattle?.stage === 'trap'
    ? applyGameCommand(state, { kind: 'skip-trap', playerId: defenderId })
    : state
  for (let guard = 0; guard < 12 && current.pendingBattle?.stage === 'damage'; guard += 1) {
    current = applyGameCommand(current, { kind: 'resolve-next-damage', playerId: defenderId })
  }
  return current
}

const withTwoWaveDrops = (state: GameState): GameState => {
  const player = state.players[owner]
  const [, ...deck] = player.deck
  if (player.deck.length === 0) throw new Error('A real deck card is required for the Wave Drop swap')
  const secondWaveDrop = createCard(rawSt9007To009('ST9-009'), owner, 2)
  return {
    ...state,
    players: {
      ...state.players,
      [owner]: { ...player, deck, hand: [...player.hand, secondWaveDrop] },
    },
  }
}

describe('ST9-009 Wave Drop hand-to-trash trigger', () => {
  it('does not treat ST9-006 bracketed discard cost as a Sea Fairy effect', () => {
    let state = createSt9007To009PreviewState('ST9-009', 'sea-fairy-trigger')
    const attacker = state.players[owner].battleArea[0]
    expect(attacker?.card.id).toBe('ST9-006')
    expect(attacker?.card.attackText).toContain('Then, <discard 2 cards.>')
    const waveDrop = state.players[owner].hand.find(card => card.id === 'ST9-009')!

    state = attackWith(state, owner)
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: opponent })
    state = settleBaseAttack(state, opponent)
    state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: owner, targetIds: [] })
    expect(state.pendingOptionalCostAttack?.cost.discardHand).toBe(2)
    const discardIds = [waveDrop.instanceId, state.players[owner].hand[1]!.instanceId]
    state = applyGameCommand(state, {
      kind: 'resolve-optional-cost-attack',
      playerId: owner,
      action: 'pay',
      discardCardIds: discardIds,
      targetIds: state.players[opponent].battleArea.map(cookie => cookie.card.instanceId),
    })

    expect(state.players[owner].discardPile.map(card => card.instanceId)).toContain(waveDrop.instanceId)
    expect(state.pendingHandToTrashTriggers ?? []).toEqual([])
  })

  it('does not trigger when a Sea Fairy effect moves Wave Drop to the deck top', () => {
    let state = createSt9007To009PreviewState('ST9-009', 'sea-fairy-trigger')
    const waveDrop = state.players[owner].hand.find(card => card.id === 'ST9-009')!
    const source = state.players[owner].battleArea.find(cookie => cookie.card.name === 'Sea Fairy Cookie')!
    state = {
      ...state,
      pendingOpponentHandDiscard: {
        playerId: owner,
        count: 1,
        destination: 'deck-top',
        handDiscardOrigin: 'effect',
        sourcePlayerId: owner,
        sourceInstanceId: source.card.instanceId,
        sourceCardName: source.card.name,
        effectText: 'Sea Fairy effect puts a card on top of the deck',
      },
    }

    state = applyGameCommand(state, {
      kind: 'resolve-opponent-hand-discard',
      playerId: owner,
      cardIds: [waveDrop.instanceId],
    })

    expect(state.players[owner].deck[0]?.instanceId).toBe(waveDrop.instanceId)
    expect(state.pendingHandToTrashTriggers ?? []).toEqual([])
    expect(state.pendingAbilityEffect?.sourceInstanceId).not.toBe(waveDrop.instanceId)
  })

  it('resolves each queued passive after the previous Wave Drop draw completes', () => {
    let state = withTwoWaveDrops(createSt9007To009PreviewState('ST9-009', 'sea-fairy-trigger'))
    const waveDrops = state.players[owner].hand.filter(card => card.id === 'ST9-009')
    expect(waveDrops).toHaveLength(2)
    const initialHandSize = state.players[owner].hand.length
    const source = state.players[owner].battleArea.find(cookie => cookie.card.name === 'Sea Fairy Cookie')!
    state = {
      ...state,
      pendingOpponentHandDiscard: {
        playerId: owner,
        count: 2,
        handDiscardOrigin: 'effect',
        sourcePlayerId: owner,
        sourceInstanceId: source.card.instanceId,
        sourceCardName: source.card.name,
        effectText: 'Sea Fairy effect discards two cards',
      },
    }
    state = applyGameCommand(state, {
      kind: 'resolve-opponent-hand-discard',
      playerId: owner,
      cardIds: waveDrops.map(card => card.instanceId),
    })
    expect(state.pendingAbilityEffect?.sourceInstanceId).toBe(waveDrops[0]!.instanceId)

    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [] })
    expect(state.pendingDrawUpTo?.max).toBe(1)
    state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: owner, drawCount: 0 })
    expect(state.pendingAbilityEffect?.sourceInstanceId).toBe(waveDrops[1]!.instanceId)

    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [] })
    state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: owner, drawCount: 1 })
    expect(state.players[owner].hand).toHaveLength(initialHandSize - 2 + 1)
    expect(state.players[owner].discardPile.map(card => card.instanceId)).toEqual(
      expect.arrayContaining(waveDrops.map(card => card.instanceId)),
    )
    expect(state.pendingAbilityEffect ?? null).toBeNull()
    expect(state.pendingDrawUpTo ?? null).toBeNull()
    expect(state.pendingHandToTrashTriggers ?? []).toEqual([])
  })

  it('drops a second trigger when Refresh moves its source into the private deck', () => {
    let state = withTwoWaveDrops(createSt9007To009PreviewState('ST9-009', 'sea-fairy-trigger'))
    const waveDrops = state.players[owner].hand.filter(card => card.id === 'ST9-009')
    const player = state.players[owner]
    const [lastDeckCard, ...cardsToTrash] = player.deck
    if (!lastDeckCard || waveDrops.length !== 2) throw new Error('Refresh fixture needs two Wave Drops and one deck card')
    const seaFairy = player.battleArea.find(cookie => cookie.card.name === 'Sea Fairy Cookie')!
    state = {
      ...state,
      players: {
        ...state.players,
        [owner]: { ...player, deck: [lastDeckCard], discardPile: [...player.discardPile, ...cardsToTrash] },
      },
      pendingOpponentHandDiscard: {
        playerId: owner,
        count: 2,
        handDiscardOrigin: 'effect',
        sourcePlayerId: owner,
        sourceInstanceId: seaFairy.card.instanceId,
        sourceCardName: 'Sea Fairy Cookie',
        effectText: 'Sea Fairy effect discards two cards',
      },
    }

    state = applyGameCommand(state, {
      kind: 'resolve-opponent-hand-discard', playerId: owner,
      cardIds: waveDrops.map(card => card.instanceId),
    })
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [] })
    state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: owner, drawCount: 1 })
    expect(state.pendingRefresh?.playerId).toBe(owner)
    expect(state.pendingHandToTrashTriggers).toHaveLength(1)

    const refreshCookie = state.players[owner].discardPile.find(card =>
      card.type === 'cookie' && !waveDrops.some(waveDrop => waveDrop.instanceId === card.instanceId))
    if (!refreshCookie) throw new Error('Refresh needs a non-trigger Cookie to place in Break')
    state = applyGameCommand(state, {
      kind: 'refresh-deck', playerId: owner, cookieInstanceId: refreshCookie.instanceId, shuffleSeed: 9,
    })
    expect(state.players[owner].deck).toEqual(expect.arrayContaining(waveDrops.map(card =>
      expect.objectContaining({ instanceId: card.instanceId }))))
    expect(state.pendingHandToTrashTriggers ?? []).toEqual([])
    expect(state.pendingAbilityEffect ?? null).toBeNull()

    state = applyGameCommand(state, {
      kind: 'begin-activate-skill', playerId: owner, sourceInstanceId: seaFairy.card.instanceId,
      trigger: 'activate', paymentIds: [], discardHandIds: [],
    })
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [] })
    state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: owner, drawCount: 1 })
    expect(state.pendingAbilityEffect?.sourceInstanceId).not.toBe(waveDrops[1]!.instanceId)
    expect(state.pendingHandToTrashTriggers ?? []).toEqual([])
  })

  it('does not trigger when a real non-Sea Fairy Cookie effect discards Wave Drop', () => {
    let state = createSt9007To009PreviewState('ST9-009', 'other-source-trigger')
    const waveDrop = state.players[owner].hand.find(card => card.id === 'ST9-009')!
    state = attackWith(state, owner)
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: opponent })
    state = settleBaseAttack(state, opponent)
    expect(state.pendingBattle?.stage).toBe('attack-effect')
    for (let guard = 0; guard < 4 && !state.pendingOpponentHandDiscard; guard += 1) {
      if (state.pendingDrawUpTo) {
        state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: owner, drawCount: 1 })
      } else if (state.pendingBattle?.stage === 'attack-effect') {
        state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: owner, targetIds: [] })
      } else {
        break
      }
    }
    expect(state.pendingOpponentHandDiscard?.sourceCardName).toBe(state.players[owner].battleArea[0]?.card.name)
    expect(state.pendingOpponentHandDiscard?.sourceCardName).not.toBe('Sea Fairy Cookie')
    state = applyGameCommand(state, {
      kind: 'resolve-opponent-hand-discard',
      playerId: owner,
      cardIds: [waveDrop.instanceId],
    })
    expect(state.players[owner].discardPile.map(card => card.instanceId)).toContain(waveDrop.instanceId)
    expect(state.pendingAbilityEffect).toBeUndefined()
    expect(state.pendingDrawUpTo).toBeUndefined()
  })
})
