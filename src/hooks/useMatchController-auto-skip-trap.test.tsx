/// @vitest-environment jsdom

import { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import {
  applyGameCommand,
  createDemoGame,
  takeAiStep,
  type GameState,
} from '../game'
import { createCardCheckDemoState } from '../game/demo'
import { useAiTurn } from './useAiTurn'
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

const buildAiAttackWithoutResponsesState = (): GameState => {
  const base = createDemoGame()
  const defender = base.players['player-one'].battleArea[0]
  const attacker = base.players['player-two'].battleArea[0]

  return {
    ...base,
    activePlayerId: 'player-two',
    phase: 'main',
    status: 'playing',
    players: {
      ...base.players,
      // No hand traps are available. The target is the only Cookie, so it
      // cannot be selected as a blocker even if its printed skill changes.
      'player-one': {
        ...base.players['player-one'],
        hand: [],
      },
    },
    pendingBattle: {
      attackerPlayerId: 'player-two',
      defenderPlayerId: 'player-one',
      attackerInstanceId: attacker.card.instanceId,
      targetInstanceId: defender.card.instanceId,
      declaredDamage: 1,
      remainingDamage: 1,
      stage: 'trap',
      trapUsed: false,
      revealedHpCard: null,
      preventKnockoutTargetIds: [],
      faintedColors: [],
      attackEffects: [],
      attackEffectIndex: 0,
    },
  }
}

const buildPitayaAttackAgainstKumiho = (): GameState => {
  const defenderFixture = createCardCheckDemoState('BS4-024')
  const attackerFixture = createCardCheckDemoState('BS3-010')
  const kumiho = defenderFixture.players['player-one'].battleArea.find(
    (entry) => entry.card.id === 'BS4-024',
  )!
  const yellowLv3 = defenderFixture.players['player-one'].battleArea.find(
    (entry) => entry.card.instanceId === 'self-extra-1',
  )!
  const pitaya = attackerFixture.players['player-one'].battleArea.find(
    (entry) => entry.card.id === 'BS3-010',
  )!

  const activeAiState: GameState = {
    ...defenderFixture,
    firstPlayerId: 'player-two',
    activePlayerId: 'player-two',
    players: {
      ...defenderFixture.players,
      'player-one': {
        ...defenderFixture.players['player-one'],
        hand: [],
        battleArea: [
          kumiho,
          { ...yellowLv3, card: { ...yellowLv3.card, level: 3 } },
        ],
        supportArea: [],
      },
      'player-two': {
        ...defenderFixture.players['player-two'],
        battleArea: [{ ...pitaya, rested: false }],
        supportArea: attackerFixture.players['player-one'].supportArea,
      },
    },
  }

  const attack = takeAiStep(activeAiState, 'player-two', { level: 4, seed: 7 })
  if (attack.action !== 'attack') {
    throw new Error(`Expected AI to declare Pitaya attack, got ${attack.action}`)
  }
  return attack.state
}

describe('useMatchController auto-skip-trap effect', () => {
  it('continues a live AI attack when the defending player has no response', async () => {
    vi.useFakeTimers()
    let captured: ReturnType<typeof useMatchController> | null = null
    let aiActionCount = 0

    function TestHarness() {
      captured = useMatchController({ testStateConfig: null })
      const ai = useAiTurn({
        game: captured.game,
        setGame: captured.setGame,
        setMessage: captured.setMessage,
        showPause: false,
        aiControlsCurrentState: captured.aiControlsCurrentState,
        pendingEffect: null,
        faintActive: false,
        afterDamageActive: false,
        deckConfig: captured.deckConfig,
      })
      aiActionCount = ai.aiActionCount
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(
      <StrictMode>
        <TestHarness />
      </StrictMode>,
    ))

    await act(() => {
      captured!.setGame(buildAiAttackWithoutResponsesState())
    })
    await act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(captured!.game.pendingBattle?.stage).toBe('damage')

    await act(() => {
      vi.advanceTimersByTime(450)
    })

    expect(aiActionCount).toBe(1)
    expect(captured!.game.pendingBattle?.stage).not.toBe('trap')

    await act(() => root.unmount())
    vi.useRealTimers()
  })

  it('finishes BS3-010 versus BS4-024 through the same controller and AI timers used in a live match', async () => {
    vi.useFakeTimers()
    let captured: ReturnType<typeof useMatchController> | null = null

    function TestHarness() {
      captured = useMatchController({ testStateConfig: null })
      useAiTurn({
        game: captured.game,
        setGame: captured.setGame,
        setMessage: captured.setMessage,
        showPause: false,
        aiControlsCurrentState: captured.aiControlsCurrentState,
        pendingEffect: null,
        faintActive: false,
        afterDamageActive: false,
        deckConfig: captured.deckConfig,
      })
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))

    await act(() => {
      captured!.setGame(buildPitayaAttackAgainstKumiho())
    })
    await act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(captured!.game.pendingBattle?.stage).toBe('damage')

    await act(() => {
      vi.advanceTimersByTime(450)
    })
    expect(captured!.game.pendingBattle?.stage).toBe('attack-effect')

    await act(() => {
      vi.advanceTimersByTime(450)
    })
    expect(captured!.game.pendingOptionalCostAttack).not.toBeNull()

    await act(() => {
      vi.advanceTimersByTime(450)
    })
    expect(captured!.game.pendingBattle).toBeNull()
    expect(captured!.game.pendingOptionalCostAttack).toBeNull()

    await act(() => root.unmount())
    vi.useRealTimers()
  })

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

  it('does not auto-finish a card-check battle before the local attacker chooses its attack effect', async () => {
    vi.useFakeTimers()
    let captured: ReturnType<typeof useMatchController> | null = null

    function TestHarness() {
      captured = useMatchController({
        testStateConfig: { kind: 'card-check', cardNumber: 'BS6-018' },
      })
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))

    const initial = createCardCheckDemoState('BS6-018')
    const source = initial.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS6-018',
    )!
    const target = initial.players['player-two'].battleArea[0]
    const declared = applyGameCommand(initial, {
      kind: 'declare-attack',
      playerId: 'player-one',
      attackerInstanceId: source.card.instanceId,
      targetInstanceId: target.card.instanceId,
      supportPaymentIds: initial.players['player-one'].supportArea
        .slice(0, 2)
        .map((support) => support.card.instanceId),
    })
    const damagePending = applyGameCommand(declared, {
      kind: 'skip-trap',
      playerId: 'player-two',
    })
    expect(damagePending.pendingBattle?.stage).toBe('damage')

    await act(() => {
      captured!.setGame(damagePending)
    })
    await act(() => {
      vi.advanceTimersByTime(50)
    })

    // test-state may accelerate the damage one formal command at a time, but
    // must stop at attack-effect instead of using resolve-battle to consume
    // the human attacker's pending target choice.
    expect(captured!.game.pendingBattle?.stage).toBe('attack-effect')
    expect(captured!.game.pendingBattle?.attackEffectIndex).toBe(0)

    await act(() => root.unmount())
    vi.useRealTimers()
  })
})
