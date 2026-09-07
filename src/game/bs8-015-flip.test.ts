import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState } from './demo'
import { applyGameCommand } from './commands'
import { getCookieEffectiveHp } from './helpers'
import { maskGameStateForViewer } from './masked-state'

describe('BS8-015 FLIP activation and hidden HP boundaries', () => {
  it('does not apply an unrevealed FLIP or reveal its presence through public HP', () => {
    const state = createCardCheckDemoState('BS8-015')
    const flip = state.pendingBattle!.revealedHpCard!
    const target = state.players['player-one'].battleArea[0]
    target.hpCards = [target.hpCards[0], flip]
    state.pendingBattle = null
    expect(getCookieEffectiveHp(target)).toBe(2)
    for (const viewer of ['player-one', 'player-two'] as const) {
      const masked = maskGameStateForViewer(state, viewer).players['player-one'].battleArea[0]
      expect(getCookieEffectiveHp(masked)).toBe(2)
      expect(masked.hpCards).toHaveLength(2)
      expect(masked.hpCards.every(card => card.id === 'hidden')).toBe(true)
    }
  })

  it('discards exactly one card before gaining one real HP card from the deck', () => {
    const state = createCardCheckDemoState('BS8-015')
    const before = structuredClone(state)
    const player = state.players['player-one']
    const next = applyGameCommand(state, {kind:'resolve-flip',playerId:'player-one',activate:true,
      discardHandIds:[player.hand[0].instanceId]})
    expect(next.players['player-one'].battleArea[0].hpCards).toEqual([...player.battleArea[0].hpCards,player.deck[0]])
    expect(next.players['player-one'].hand).toEqual(player.hand.slice(1))
    expect(next.players['player-one'].deck).toEqual(player.deck.slice(1))
    expect(next.players['player-one'].discardPile).toEqual([...player.discardPile,player.hand[0],state.pendingBattle!.revealedHpCard])
    expect(state).toEqual(before)
  })

  it.each([true,false])('declining pays nothing and gains no HP (hand available=%s)', (hasHand) => {
    const state = createCardCheckDemoState('BS8-015')
    if (!hasHand) state.players['player-one'].hand = []
    const next = applyGameCommand(state,{kind:'resolve-flip',playerId:'player-one',activate:false})
    expect(next.players['player-one'].hand).toEqual(state.players['player-one'].hand)
    expect(next.players['player-one'].deck).toEqual(state.players['player-one'].deck)
    expect(next.players['player-one'].battleArea[0].hpCards).toEqual(state.players['player-one'].battleArea[0].hpCards)
  })

  it('rejects unpaid activation without changing HP or resources', () => {
    const state = createCardCheckDemoState('BS8-015')
    state.players['player-one'].hand = []
    const before = structuredClone(state)
    expect(() => applyGameCommand(state,{kind:'resolve-flip',playerId:'player-one',activate:true,discardHandIds:[]})).toThrow()
    expect(state).toEqual(before)
  })
})
