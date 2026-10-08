import { describe, expect, it } from 'vitest'
import { createPlayerView } from '../../player-view'
import { createBattleState, item } from '../../test-helpers/battle-helpers'
import { assessPublicCondition } from './public-condition'

describe('Lv.5 公開 Combo 前置判定', () => {
  it('後攻條件以開局玩家而非當前回合判斷', () => {
    const state = createBattleState()
    state.firstPlayerId = 'player-two'
    state.activePlayerId = 'player-one'
    state.turnNumber = 20
    expect(assessPublicCondition(createPlayerView(state, 'player-one'), { kind: 'player-started-second' }).state).toBe('met')
    expect(assessPublicCondition(createPlayerView(state, 'player-two'), { kind: 'player-started-second' }).state).toBe('unmet')
  })
  it('保留支援區的實際數值門檻，而非只判斷是否存在支援卡', () => {
    const state = createBattleState()
    const view = createPlayerView(state, 'player-two')

    expect(assessPublicCondition(view, {
      kind: 'support-count-at-least',
      count: 2,
    }).state).toBe('unmet')

    state.players['player-two'].supportArea.push({
      card: item('p2-support-second'),
      rested: false,
    })
    expect(assessPublicCondition(createPlayerView(state, 'player-two'), {
      kind: 'support-count-at-least',
      count: 2,
    }).state).toBe('met')
  })

  it('複合條件只用公開資訊合併，且來源／歷程條件保守回傳 unknown', () => {
    const state = createBattleState()
    state.players['player-two'].hand = [item('hand-a'), item('hand-b'), item('hand-c')]
    const view = createPlayerView(state, 'player-two')

    expect(assessPublicCondition(view, {
      kind: 'all-of',
      conditions: [
        { kind: 'support-count-at-least', count: 1 },
        { kind: 'hand-count-at-least', count: 3 },
      ],
    }).state).toBe('met')
    expect(assessPublicCondition(view, {
      kind: 'source-hp-reduced-this-turn',
    }).state).toBe('unknown')
  })
})
