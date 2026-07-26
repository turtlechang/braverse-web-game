import { describe, expect, it } from 'vitest'
import { executeCardEffect, type CardEffect, type EffectContext } from '..'
import { createBattleState, cookie, item } from '../test-helpers/battle-helpers'

/**
 * 回歸測試：BS3-082 的 prevent-effect-damage 保護加入後（709b16d），
 * split-damage 用篩過的 protectedTargets 重新從 0 編號，若玩家選的第一個
 * 目標被保護、第二個沒有，倖存的第二目標會錯拿 primaryAmount 而不是它
 * 原本該拿的 secondaryAmount——傷害量必須固定綁在原始選擇順序上，
 * 保護只決定「這個目標要不要跳過」，不能連帶偷換另一個目標的傷害量。
 */
describe('split-damage respects per-target prevent-effect-damage protection', () => {
  const splitDamage: CardEffect = {
    kind: 'split-damage',
    primaryAmount: 2,
    secondaryAmount: 1,
    target: { side: 'opponent', min: 1, max: 2 },
  }

  const context: EffectContext = {
    sourcePlayerId: 'player-two',
    sourceInstanceId: 'source',
    sourceCardName: 'source',
  }

  it('keeps secondaryAmount on the second target when only the first is protected', () => {
    const state = createBattleState()
    state.players['player-one'].battleArea = [
      {
        card: cookie('opp-a', 1, 5),
        hpCards: [item('opp-a-hp-1'), item('opp-a-hp-2'), item('opp-a-hp-3'), item('opp-a-hp-4'), item('opp-a-hp-5')],
        rested: false,
        battleEntryId: 'opp-a:battle:1',
      },
      {
        card: cookie('opp-b', 1, 5),
        hpCards: [item('opp-b-hp-1'), item('opp-b-hp-2'), item('opp-b-hp-3'), item('opp-b-hp-4'), item('opp-b-hp-5')],
        rested: false,
        battleEntryId: 'opp-b:battle:2',
      },
    ]
    state.effectDamagePreventedUntilTurn = { 'opp-a': state.turnNumber }

    const result = executeCardEffect(state, context, splitDamage, ['opp-a', 'opp-b'])

    const oppA = result.players['player-one'].battleArea.find((c) => c.card.instanceId === 'opp-a')
    const oppB = result.players['player-one'].battleArea.find((c) => c.card.instanceId === 'opp-b')

    expect(oppA?.hpCards).toHaveLength(5)
    expect(oppB?.hpCards).toHaveLength(4)
  })

  it('still applies primary/secondary normally when neither target is protected', () => {
    const state = createBattleState()
    state.players['player-one'].battleArea = [
      {
        card: cookie('opp-a', 1, 5),
        hpCards: [item('opp-a-hp-1'), item('opp-a-hp-2'), item('opp-a-hp-3'), item('opp-a-hp-4'), item('opp-a-hp-5')],
        rested: false,
        battleEntryId: 'opp-a:battle:1',
      },
      {
        card: cookie('opp-b', 1, 5),
        hpCards: [item('opp-b-hp-1'), item('opp-b-hp-2'), item('opp-b-hp-3'), item('opp-b-hp-4'), item('opp-b-hp-5')],
        rested: false,
        battleEntryId: 'opp-b:battle:2',
      },
    ]

    const result = executeCardEffect(state, context, splitDamage, ['opp-a', 'opp-b'])

    const oppA = result.players['player-one'].battleArea.find((c) => c.card.instanceId === 'opp-a')
    const oppB = result.players['player-one'].battleArea.find((c) => c.card.instanceId === 'opp-b')

    expect(oppA?.hpCards).toHaveLength(3)
    expect(oppB?.hpCards).toHaveLength(4)
  })
})
