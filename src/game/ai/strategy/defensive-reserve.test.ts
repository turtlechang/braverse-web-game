import { describe, expect, it } from 'vitest'
import { takeAiStep } from '../../index'
import { createPlayerView } from '../../player-view'
import type { GameCard } from '../../types'
import type { PlayerActionCommand } from '../../commands'
import { createBattleState, item } from '../../test-helpers/battle-helpers'
import { assessLv5DefensiveReserve } from './defensive-reserve'

const trap = (): GameCard => ({
  id: 'fixture-trap',
  instanceId: 'fixture-trap',
  name: 'fixture trap',
  type: 'trap',
  trap: {
    text: 'Trap',
    cost: { energy: { red: 1 } },
    effects: [],
  },
})

const attackCommand: PlayerActionCommand = {
  kind: 'attack',
  playerId: 'player-two',
  attackerInstanceId: 'attacker',
  targetInstanceId: 'defender',
  supportPaymentIds: ['p2-support'],
}

describe('Lv.5 防守資源保留評估', () => {
  it('攻擊後耗盡活躍支援時，會為手牌陷阱保留資源而扣分', () => {
    const view = createPlayerView(createBattleState(), 'player-two')
    const before = {
      ...view,
      hand: [...view.hand, trap()],
    }
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

    const result = assessLv5DefensiveReserve(before, after, attackCommand, createBattleState())

    expect(result.reason).toBe('trap-in-hand')
    expect(result.activeSupportBefore).toBe(1)
    expect(result.activeSupportAfter).toBe(0)
    expect(result.shortage).toBe(1)
    expect(result.adjustment).toBeLessThan(0)
  })

  it('有公開防守需求時，結束階段保留活躍支援可獲得加分', () => {
    const view = createPlayerView(createBattleState(), 'player-two')
    const before = {
      ...view,
      hand: [...view.hand, trap()],
    }

    const result = assessLv5DefensiveReserve(before, before, {
      kind: 'advance-phase',
      playerId: 'player-two',
    }, createBattleState())

    expect(result.reason).toBe('trap-in-hand')
    expect(result.reserveRequired).toBe(1)
    expect(result.adjustment).toBeGreaterThan(0)
  })

  it('沒有公開防守或下一步能量需求時不增加保留分數', () => {
    const view = createPlayerView(createBattleState(), 'player-two')
    const result = assessLv5DefensiveReserve(view, view, attackCommand, createBattleState())

    expect(result.reason).toBe('none')
    expect(result.reserveRequired).toBe(0)
    expect(result.adjustment).toBe(0)
  })

  it('直接能量欄位的 Trap 在沒有支援時不會被誤判為可支付', () => {
    const view = createPlayerView(createBattleState(), 'player-two')
    const directCostTrap = {
      ...trap(),
      trap: {
        ...trap().trap!,
        cost: { red: 1 },
      },
    }
    const noSupport = {
      ...view,
      hand: [...view.hand, directCostTrap],
      self: {
        ...view.self,
        supportArea: [],
      },
    }

    const result = assessLv5DefensiveReserve(noSupport, noSupport, attackCommand, createBattleState())

    expect(result.reason).toBe('none')
    expect(result.adjustment).toBe(0)
  })

  it('戰鬥區有可支付 Blocker 時，會建立一張支援的防守預留', () => {
    const view = createPlayerView(createBattleState(), 'player-two')
    const blocker = {
      card: {
        id: 'fixture-blocker',
        instanceId: 'fixture-blocker',
        name: 'fixture blocker',
        type: 'cookie' as const,
        level: 2,
        hp: 3,
        attack: 2,
        attackCost: 1,
        skill: {
          trigger: 'block' as const,
          oncePerTurn: false,
          yourTurn: false,
          restSource: false,
          cost: { energy: { red: 1 } },
          effects: [],
          text: 'Block',
        },
      },
      hpCount: 3,
      rested: false,
    }
    const before = {
      ...view,
      self: {
        ...view.self,
        battleArea: [...view.self.battleArea, blocker],
      },
    }
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

    const result = assessLv5DefensiveReserve(before, after, attackCommand, createBattleState())

    expect(result.reason).toBe('blocker-ready')
    expect(result.shortage).toBe(1)
    expect(result.adjustment).toBeLessThan(0)
  })

  it('手牌有可支付 OnPlay 餅乾時，會保留登場能量', () => {
    const view = createPlayerView(createBattleState(), 'player-two')
    const onPlayCookie: GameCard = {
      id: 'fixture-on-play',
      instanceId: 'fixture-on-play',
      name: 'fixture on-play',
      type: 'cookie',
      level: 2,
      hp: 3,
      attack: 2,
      attackCost: 1,
      skill: {
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { red: 1 } },
        effects: [],
        text: 'On Play',
      },
    }
    const before = {
      ...view,
      hand: [...view.hand, onPlayCookie],
    }
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

    const result = assessLv5DefensiveReserve(before, after, attackCommand, createBattleState())

    expect(result.reason).toBe('on-play-energy')
    expect(result.reserveRequired).toBe(1)
    expect(result.shortage).toBe(1)
    expect(result.adjustment).toBeLessThan(0)
  })

  it('低收益攻擊會因公開防守需求而選擇保留支援並結束主要階段', () => {
    const state = createBattleState()
    state.players['player-two'].hand.push(trap())
    state.players['player-two'].battleArea[0].card = {
      ...state.players['player-two'].battleArea[0].card,
      attack: 1,
    }
    state.players['player-one'].battleArea[0].card = {
      ...state.players['player-one'].battleArea[0].card,
      hp: 5,
    }
    state.players['player-one'].battleArea[0].hpCards = Array.from(
      { length: 5 },
      (_, index) => item(`defender-extra-hp-${index}`),
    )

    const decision = takeAiStep(state, 'player-two', { level: 5 })

    expect(decision.action).toBe('advance-phase')
    expect(decision.reason?.actionScore?.contributions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'defensive-reserve', amount: 42 }),
      ]),
    )
  })
  it('支援階段結束不會獲得保留加分，避免跳過放支援', () => {
    const view = createPlayerView(createBattleState(), 'player-two')
    const before = {
      ...view,
      hand: [...view.hand, trap()],
    }
    const supportPhaseState = {
      ...createBattleState(),
      phase: 'support' as const,
    }

    const result = assessLv5DefensiveReserve(before, before, {
      kind: 'advance-phase',
      playerId: 'player-two',
    }, supportPhaseState)

    expect(result.reason).toBe('trap-in-hand')
    expect(result.adjustment).toBe(0)
  })

  it('OnPlay 能量需求不會在結束主要階段時獲得加分', () => {
    const view = createPlayerView(createBattleState(), 'player-two')
    const onPlayCookie: GameCard = {
      id: 'fixture-on-play',
      instanceId: 'fixture-on-play',
      name: 'fixture on-play',
      type: 'cookie',
      level: 2,
      hp: 3,
      attack: 2,
      attackCost: 1,
      skill: {
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { red: 1 } },
        effects: [],
        text: 'On Play',
      },
    }
    const before = {
      ...view,
      hand: [...view.hand, onPlayCookie],
    }

    const result = assessLv5DefensiveReserve(before, before, {
      kind: 'advance-phase',
      playerId: 'player-two',
    }, createBattleState())

    expect(result.reason).toBe('on-play-energy')
    expect(result.adjustment).toBe(0)
  })

  it('攻擊短缺懲罰為每張短缺 -24，不再壓過一般攻擊價值', () => {
    const view = createPlayerView(createBattleState(), 'player-two')
    const before = {
      ...view,
      hand: [...view.hand, trap()],
    }
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

    const result = assessLv5DefensiveReserve(before, after, attackCommand, createBattleState())

    expect(result.reason).toBe('trap-in-hand')
    expect(result.shortage).toBe(1)
    expect(result.adjustment).toBe(-24)
  })

  it('對手有可攻擊餅乾時，不會把手牌唯一陷阱放入支援區', () => {
    const state = createBattleState()
    const onlyTrap = trap()
    state.players['player-two'].hand.push(onlyTrap)
    const view = createPlayerView(state, 'player-two')

    const result = assessLv5DefensiveReserve(view, view, {
      kind: 'place-support',
      playerId: 'player-two',
      instanceId: onlyTrap.instanceId,
    }, state)

    expect(result.reason).toBe('trap-retention')
    expect(result.reserveRequired).toBe(1)
    expect(result.adjustment).toBe(-72)
    expect(result.detail).toContain('唯一防守陷阱')
  })
})
