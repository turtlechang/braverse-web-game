import { describe, expect, it } from 'vitest'
import { createDemoGame, createPlayerView } from '.'

describe('createPlayerView', () => {
  it('只保留對手手牌與雙方牌庫的張數', () => {
    const state = createDemoGame(1)
    const view = createPlayerView(state, 'player-one')

    expect(view.viewerId).toBe('player-one')
    expect(view.hand).toEqual(state.players['player-one'].hand)
    expect(view.self.handCount).toBe(state.players['player-one'].hand.length)
    expect(view.opponent.handCount).toBe(
      state.players['player-two'].hand.length,
    )
    expect(view.self.deckCount).toBe(state.players['player-one'].deck.length)
    expect(view.opponent.deckCount).toBe(
      state.players['player-two'].deck.length,
    )

    // 視角物件本身不得含有對手手牌或任一方牌庫的卡牌內容。
    const sides = [view.self, view.opponent] as unknown as Record<
      string,
      unknown
    >[]
    for (const side of sides) {
      expect(side).not.toHaveProperty('hand')
      expect(side).not.toHaveProperty('deck')
    }
  })

  it('雙方戰鬥區的 HP 卡都只留張數（持有者也看不到內容）', () => {
    const state = createDemoGame(1)
    const view = createPlayerView(state, 'player-one')

    for (const side of [view.self, view.opponent]) {
      for (const cookie of side.battleArea) {
        expect(typeof cookie.hpCount).toBe('number')
        expect(cookie as unknown as Record<string, unknown>).not.toHaveProperty(
          'hpCards',
        )
      }
    }

    expect(view.self.battleArea[0]?.hpCount).toBe(
      state.players['player-one'].battleArea[0]?.hpCards.length,
    )
  })

  it('公開區域完整保留：支援區、Break 區、棄牌區、場景', () => {
    const state = createDemoGame(2)
    const view = createPlayerView(state, 'player-two')

    expect(view.self.supportArea).toBe(state.players['player-two'].supportArea)
    expect(view.opponent.supportArea).toBe(
      state.players['player-one'].supportArea,
    )
    expect(view.self.breakArea).toBe(state.players['player-two'].breakArea)
    expect(view.opponent.discardPile).toBe(
      state.players['player-one'].discardPile,
    )
    expect(view.phase).toBe(state.phase)
    expect(view.activePlayerId).toBe(state.activePlayerId)
  })
})
