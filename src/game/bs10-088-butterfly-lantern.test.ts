import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'

describe('BS10-088 Butterfly Lantern', () => {
  it('reveals the official top card before asking where to return it', () => {
    let state = createCardCheckDemoState('BS10-088')
    const player = state.players['player-one']
    const source = player.hand.find((card) => card.id === 'BS10-088')
    const payment = player.supportArea.find((support) => !support.rested)?.card
    const topCard = player.deck[0]

    expect(source?.type).toBe('item')
    expect(source?.name).toBe('Butterfly Lantern')
    expect(payment).toBeDefined()
    expect(topCard).toBeDefined()
    expect(topCard?.id).toBe('BS10-001')
    expect(topCard?.name).toBe('Princess Cookie')
    expect(topCard?.imageUrl).toBeTruthy()

    state = applyGameCommand(state, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: source!.instanceId,
      paymentIds: [payment!.instanceId],
    })

    expect(state.pendingAbilityEffect?.effects[0]?.kind).toBe('inspect-deck')
    expect(state.pendingAbilityEffect?.effects).toHaveLength(2)

    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })

    expect(state.pendingInspectDeck?.revealedCards.map((card) => card.instanceId)).toEqual([
      topCard!.instanceId,
    ])
    expect(state.pendingInspectDeck?.restDestination).toBe('top-or-bottom')
    expect(state.pendingAbilityEffect?.effectIndex).toBe(1)

    expect(() =>
      applyGameCommand(state, {
        kind: 'resolve-inspect-deck',
        playerId: 'player-one',
        pickedCardIds: [],
        restOrder: [topCard!.instanceId],
      }),
    ).toThrow('檢視的牌必須選擇放回牌庫頂或牌庫底。')

    state = applyGameCommand(state, {
      kind: 'resolve-inspect-deck',
      playerId: 'player-one',
      pickedCardIds: [],
      restOrder: [topCard!.instanceId],
      restDestination: 'bottom',
    })

    expect(state.pendingInspectDeck).toBeNull()
    expect(state.players['player-one'].deck.at(-1)?.instanceId).toBe(topCard!.instanceId)
    expect(state.pendingAbilityEffect?.effectIndex).toBe(1)

    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(state.pendingDrawUpTo?.max).toBe(1)

    state = applyGameCommand(state, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount: 1,
    })
    expect(state.pendingAbilityEffect).toBeUndefined()
  })
})
