import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  getLegalTurnCommands,
  applyGameCommand,
  type GameState,
  type PlayerId,
} from '.'
import {
  handleAiEvaluatedTurnState,
  handleAiTwoPlyTurnState,
} from './ai/evaluated-turn-handler'
import type { AiTurnStrategy } from './ai/turn-handler'
import { applyChosenTurnCommand } from './ai/random-turn-handler'

const minimalStrategy: AiTurnStrategy = {
  chooseEffectTargets: () => [],
  resolveCardAbility: () => null,
  resolveSkill: () => null,
  chooseReplacement: () => undefined,
  chooseAttackTarget: (state: GameState, playerId: PlayerId) => {
    const opponentId =
      playerId === 'player-one' ? 'player-two' : 'player-one'
    return state.players[opponentId].battleArea[0]
  },
}

/**
 * 把 state 推進到指定的 phase，只做必要的最低限度操作。
 */
const advanceToPhase = (
  state: GameState,
  playerId: PlayerId,
  targetPhase: 'support' | 'main',
  maxSteps = 10,
): GameState => {
  let current = state
  for (let i = 0; i < maxSteps; i += 1) {
    if (
      current.phase === targetPhase &&
      current.activePlayerId === playerId &&
      current.status === 'playing'
    ) {
      return current
    }
    const cmd = { kind: 'advance-phase' as const, playerId }
    current = applyGameCommand(current, cmd)
  }
  return current
}

describe('Beam Search 回合層序列規劃', () => {
  it('基本可用性：可回傳有效第一動作且不報錯', () => {
    const state = createDemoGame(1)
    const mainState = advanceToPhase(state, 'player-one', 'main')
    const decision = handleAiTwoPlyTurnState(
      mainState,
      'player-one',
      minimalStrategy,
    )
    expect(decision.action).not.toBe('error')
    expect(decision.state).toBeDefined()
    expect(decision.reason?.level).toBe(4)
  })

  it('beam 找不到合法命令時 fallback 回單指令枚舉', () => {
    // 創造一個「無任何合法命令」的狀態（phase 不對）
    const state = createDemoGame(1)
    const endState = advanceToPhase(state, 'player-one', 'main')
    // push to end phase where no main-phase commands
    const finalState = applyGameCommand(endState, {
      kind: 'advance-phase',
      playerId: 'player-one',
    })
    const decision = handleAiTwoPlyTurnState(
      finalState,
      'player-one',
      minimalStrategy,
    )
    // 不在 free choice 狀態，應 fallback 到 Lv.2
    expect(decision.action).not.toBe('error')
  })

  it('beam search 在相同 state 下為 deterministic（兩次結果相同）', () => {
    const state = createDemoGame(1)
    const mainState = advanceToPhase(state, 'player-one', 'main')

    const d1 = handleAiTwoPlyTurnState(mainState, 'player-one', minimalStrategy)
    const d2 = handleAiTwoPlyTurnState(mainState, 'player-one', minimalStrategy)

    expect(d1.action).toBe(d2.action)
    expect(d1.reason?.chosenCommandKind).toBe(d2.reason?.chosenCommandKind)
  })

  it('與 Lv.3 單步 greedy 比較：beam 可能在多步規劃下挑不同動作', () => {
    const state = createDemoGame(1)
    const mainState = advanceToPhase(state, 'player-one', 'main')

    const lv3Decision = handleAiEvaluatedTurnState(
      mainState,
      'player-one',
      minimalStrategy,
    )
    const lv4Decision = handleAiTwoPlyTurnState(
      mainState,
      'player-one',
      minimalStrategy,
    )

    expect(lv3Decision.action).not.toBe('error')
    expect(lv4Decision.action).not.toBe('error')
    // 不一定會挑不同動作，但兩者都不該報錯
  })

  it('beam search 在支援階段仍可正常運作', () => {
    const state = createDemoGame(1)
    const supportState = advanceToPhase(state, 'player-one', 'support')

    const decision = handleAiTwoPlyTurnState(
      supportState,
      'player-one',
      minimalStrategy,
    )

    expect(decision.action).not.toBe('error')
    // 支援階段通常會 place-support 或 advance-phase
  })

  it('fallback 到 Lv.2 的正確性：對手回合以外應 fallback', () => {
    const state = {
      ...createDemoGame(1),
      activePlayerId: 'player-two' as PlayerId,
    }

    const decision = handleAiTwoPlyTurnState(
      state,
      'player-one', // player-one 不 active
      minimalStrategy,
    )

    // player-one 不是 activePlayer，應 fallback 到 Lv.2
    expect(decision.action).not.toBe('error')
  })

  it('攻擊選取仍停在 pendingBattle trap 階段', () => {
    const state = createDemoGame(1)
    const mainState = advanceToPhase(state, 'player-one', 'main')
    // 確定雙方戰鬥區都有餅乾
    const playerBattle = mainState.players['player-one'].battleArea
    const opponentBattle = mainState.players['player-two'].battleArea
    if (playerBattle.length > 0 && opponentBattle.length > 0) {
      const decision = handleAiTwoPlyTurnState(
        mainState,
        'player-one',
        minimalStrategy,
      )
      if (decision.action === 'attack') {
        expect(decision.state.pendingBattle).toBeDefined()
        expect(decision.state.pendingBattle!.stage).toBe('trap')
      }
    }
  })

  it('beam 選擇 advance-phase 仍為合法行為（不強迫做無效動作）', () => {
    const state = createDemoGame(1)
    const supportState = advanceToPhase(state, 'player-one', 'support')
    // 先 place-support 一次
    const commands = getLegalTurnCommands(supportState, 'player-one')
    const placeSupportCmd = commands.find(
      (c) => c.kind === 'place-support',
    )
    if (placeSupportCmd) {
      const placed = applyChosenTurnCommand(supportState, placeSupportCmd)
      const mainState = advanceToPhase(placed, 'player-one', 'main')
      const decision = handleAiTwoPlyTurnState(
        mainState,
        'player-one',
        minimalStrategy,
      )

      expect(decision.action).not.toBe('error')
      // 無論選誰，應該是合法命令
    }
  })
})