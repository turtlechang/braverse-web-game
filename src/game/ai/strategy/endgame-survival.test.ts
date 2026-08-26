import { describe, expect, it } from 'vitest'
import { createPlayerView } from '../../player-view'
import type { GameCard } from '../../types'
import { createBattleState, item } from '../../test-helpers/battle-helpers'
import {
  assessLv5EndgameSurvival,
  countLv5DefenseOptions,
} from './endgame-survival'
import { assessLv5OptionalCostDefense } from './defensive-reserve'

const trap = (instanceId: string): GameCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'trap',
  trap: {
    text: 'Trap',
    cost: { energy: { red: 1 } },
    effects: [],
  },
})

describe('Lv.5 終局生存與可選支付防守評估', () => {
  it('Break 6–9 失去唯一活躍支援陷阱時會扣分', () => {
    const state = createBattleState()
    state.players['player-two'].breakArea = [{
      ...state.players['player-two'].battleArea[0].card,
      instanceId: 'break-level-six',
      level: 6,
    }]
    state.players['player-two'].supportArea = [{
      card: trap('support-trap'),
      rested: false,
    }]
    const before = createPlayerView(state, 'player-two')
    const after = {
      ...before,
      self: {
        ...before.self,
        supportArea: before.self.supportArea.map((support) => ({
          ...support,
          rested: true,
        })),
      },
    }

    expect(countLv5DefenseOptions(before)).toBe(1)
    const result = assessLv5EndgameSurvival(before, after, 'attack')

    expect(result.breakLevel).toBe(6)
    expect(result.defenseOptionsLost).toBe(1)
    expect(result.adjustment).toBeLessThan(0)
    expect(result.detail).toContain('Break 6')
  })

  it('Break 5 不套用終局生存扣分', () => {
    const state = createBattleState()
    state.players['player-two'].breakArea = [{
      ...state.players['player-two'].battleArea[0].card,
      instanceId: 'break-level-five',
      level: 5,
    }]
    state.players['player-two'].supportArea = [{
      card: trap('support-trap'),
      rested: false,
    }]
    const before = createPlayerView(state, 'player-two')
    const after = {
      ...before,
      self: {
        ...before.self,
        supportArea: before.self.supportArea.map((support) => ({
          ...support,
          rested: true,
        })),
      },
    }

    expect(assessLv5EndgameSurvival(before, after, 'attack').adjustment).toBe(0)
  })

  it('非立即勝利的可選效果不消耗唯一支援陷阱', () => {
    const state = createBattleState()
    state.players['player-two'].supportArea = [{
      card: trap('support-trap'),
      rested: false,
    }]
    const pending = {
      playerId: 'player-two' as const,
      sourceInstanceId: 'attacker',
      sourceCardName: 'Optional attack',
      cost: { energy: { red: 1 } },
      effects: [{
        kind: 'damage' as const,
        amount: 1,
        target: { side: 'opponent' as const, min: 1, max: 1 },
      }],
      effectText: 'Deal 1 damage',
    }

    const result = assessLv5OptionalCostDefense(
      state,
      'player-two',
      pending,
      ['support-trap'],
      ['defender'],
    )

    expect(result).toMatchObject({
      preserve: true,
      onlyDefenseTrapConsumed: true,
      immediateWin: false,
      defenseTrapCountBefore: 1,
      defenseTrapCountAfter: 0,
    })
  })

  it('公開斬殺會允許支付唯一支援陷阱', () => {
    const state = createBattleState()
    state.players['player-one'].breakArea = [{
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'break-level-nine',
      level: 9,
    }]
    state.players['player-one'].battleArea[0].card = {
      ...state.players['player-one'].battleArea[0].card,
      hp: 1,
    }
    state.players['player-one'].battleArea[0].hpCards = [item('defender-one-hp')]
    state.players['player-two'].supportArea = [{
      card: trap('support-trap'),
      rested: false,
    }]
    const pending = {
      playerId: 'player-two' as const,
      sourceInstanceId: 'attacker',
      sourceCardName: 'Optional attack',
      cost: { energy: { red: 1 } },
      effects: [{
        kind: 'damage' as const,
        amount: 1,
        target: { side: 'opponent' as const, min: 1, max: 1 },
      }],
      effectText: 'Deal 1 damage',
    }

    const result = assessLv5OptionalCostDefense(
      state,
      'player-two',
      pending,
      ['support-trap'],
      ['defender'],
    )

    expect(result.immediateWin).toBe(true)
    expect(result.preserve).toBe(false)
  })
})
