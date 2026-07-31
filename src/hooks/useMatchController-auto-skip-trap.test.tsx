/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { createDemoGame, type GameState } from '../game'
import { useMatchController } from './useMatchController'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

/**
 * 重現 BS3-093《Convocation of Elders》真實對局回報的當機：陷阱已經打出去
 * （trapUsed: true），戰鬥刻意停在 'trap' 階段等玩家確認 reveal-top-deck 的
 * 巢狀效果。此時 getTrapCandidates 因為 trapUsed 一律回傳空陣列，若
 * auto-skip-trap 的 effect 沒有另外排除 trapUsed，就會把這個「陷阱已發動」
 * 誤判成「沒有陷阱可用該自動略過」，對著一個待處理決策再送一次 skip-trap，
 * 被規則層的 assertNoPendingDecision 擋下拋錯，把整個 App 炸掉（error boundary
 * 接手，玩家的對局直接卡死）。
 */
const buildTrapUsedAwaitingRevealState = (): GameState => {
  const base = createDemoGame()
  const defender = base.players['player-one'].battleArea[0]
  const attacker = base.players['player-two'].battleArea[0]

  return {
    ...base,
    pendingBattle: {
      attackerPlayerId: 'player-two',
      defenderPlayerId: 'player-one',
      attackerInstanceId: attacker.card.instanceId,
      targetInstanceId: defender.card.instanceId,
      declaredDamage: 1,
      remainingDamage: 1,
      stage: 'trap',
      trapUsed: true,
      revealedHpCard: null,
      preventKnockoutTargetIds: [],
      faintedColors: [],
      attackEffects: [],
      attackEffectIndex: 0,
    },
    pendingRevealTopDeck: {
      playerId: 'player-one',
      sourceInstanceId: 'trap-instance',
      sourceCardName: 'Convocation of Elders',
      revealedCard: base.players['player-one'].deck[0],
      matched: false,
      nestedEffects: [],
      battleContinuation: 'after-trap',
    },
  }
}

describe('useMatchController auto-skip-trap effect', () => {
  it('does not dispatch skip-trap while a trap already played is awaiting reveal-top-deck confirmation', async () => {
    vi.useFakeTimers()
    let captured: ReturnType<typeof useMatchController> | null = null

    function TestHarness() {
      captured = useMatchController({ testStateConfig: null })
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))

    const crafted = buildTrapUsedAwaitingRevealState()
    await act(() => {
      captured!.setGame(crafted)
    })

    // 舊行為：這裡會拋出「必須先處理待處理的決策。」並被 error boundary 接走。
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(50)
      })
    }).not.toThrow()

    expect(captured!.game.pendingRevealTopDeck).toEqual(
      crafted.pendingRevealTopDeck,
    )
    expect(captured!.game.pendingBattle?.stage).toBe('trap')
    expect(captured!.game.pendingBattle?.trapUsed).toBe(true)

    await act(() => root.unmount())
    vi.useRealTimers()
  })
})
