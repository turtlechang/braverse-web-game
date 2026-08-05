import { useCallback, useEffect, useRef, useState } from 'react'
import type { CookieCard, CookieInBattle, GameCommand, GameState, PlayerId, PlayerState, ReplacementTask, ReplayIssueBundleV1, SupportCard } from '../game'
import {
  applyGameCommand,
  createDemoSetupGame,
  getCurrentReplacementTask,
  getAfterDamageEffectCandidates,
  getAfterDamageEffectMinMax,
  getFaintEffectCardCandidates,
  getBlockerCandidates,
  getFaintEffectCandidates,
  getFaintEffectMinMax,
  getPendingDecision,
  hasBlockingPending,
  getReplacementCandidates,
  getRefreshCandidates,
  explainUnavailableTraps,
  getTrapCandidates,
  getTrapTargetCandidates,
  getTrapSelfTargetCandidates,
  getTrashBattleCookieCostCandidates,
  getTrashToDeckCandidates,
  buildReplayIssueBundle,
  getEnergyCostTotal,
  isEnergyColorCompatibleWithCost,
  isPlayerControllingState,
  selectEnergyPayment,
  validateEnergyPayment,
  type BuiltInDeckChoice,
  type DeckChoice,
} from '../game'
import {
  createAttackEffectDemoState,
  createAiDiscardRevealDemoState,
  createBlockerResponseDemoState,
  createBlueActivateSkillDemoState,
  createBlueInspectDeckDemoState,
  createBlueOptionalCostAttackDemoState,
  createBreakToTrashDemoState,
  createCardCheckDemoState,
  createSoulJamEquippedDemoState,
  createSoulJam115ProtectionDemoState,
  createFaintDamageDemoState,
  createFlipResponseDemoState,
  createItemUsageDemoState,
  createPretzelSnareDemoState,
  createReplacementChoiceDemoState,
  createSt5010OnPlayDemoState,
  createOpponentDiscardHandDemoState,
  createStageUsageDemoState,
  createSupportToTrashSkillDemoState,
  createTrapAndBlockerDemoState,
  createTrapResponseDemoState,
  createBlueSt4DemoState,
  createBlueSt4TrapDemoState,
  createBs4ConditionDemoState,
  createBs3SpecialVictoryDemoState,
  parseTestStateConfig,
} from '../game/demo'
import { useMatchSetup } from './useMatchSetup'
import { useMatchAnimations } from './useMatchAnimations'
import { registerIssueBundleProvider } from './issueBundleSource'
import {
  useBattleActions,
  type DispatchGameCommand,
  type RunGameAction,
} from './useBattleActions'

type TestStateConfig = ReturnType<typeof parseTestStateConfig>

const opponentOfId = (playerId: PlayerId): PlayerId =>
  playerId === 'player-one' ? 'player-two' : 'player-one'

export const getPendingChoicePlayerId = (
  game: GameState,
  replacementTask: ReplacementTask | null,
): PlayerId | undefined => {
  if (game.pendingRefresh) return game.pendingRefresh.playerId
  if (game.pendingOnPlay) return undefined

  const pendingDecision = getPendingDecision(game)
  if (!replacementTask) return undefined

  return !pendingDecision ||
    pendingDecision.kind === 'faint-effect' ||
    pendingDecision.kind === 'effect-order'
    ? replacementTask.playerId
    : undefined
}

export function useMatchController(params: {
  testStateConfig: TestStateConfig | null
}) {
  const { testStateConfig } = params

  const [game, setGame] = useState(() => {
    if (testStateConfig?.kind === 'break-to-trash') {
      return createBreakToTrashDemoState(testStateConfig.level)
    }
    if (testStateConfig?.kind === 'trap-response') {
      return createTrapResponseDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'blocker-response') {
      return createBlockerResponseDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'trap-and-blocker-response') {
      return createTrapAndBlockerDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'flip-response') {
      return createFlipResponseDemoState()
    }
    if (testStateConfig?.kind === 'replacement-choice') {
      return createReplacementChoiceDemoState()
    }
    if (testStateConfig?.kind === 'st5-010-on-play') {
      return createSt5010OnPlayDemoState()
    }
    if (testStateConfig?.kind === 'ai-discard-reveal') {
      return createAiDiscardRevealDemoState()
    }
    if (testStateConfig?.kind === 'item-usage') {
      return createItemUsageDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'stage-usage') {
      return createStageUsageDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'faint-damage') {
      return createFaintDamageDemoState()
    }
    if (testStateConfig?.kind === 'trap-pretzel') {
      return createPretzelSnareDemoState(testStateConfig.attack)
    }
    if (testStateConfig?.kind === 'opponent-discard-hand') {
      return createOpponentDiscardHandDemoState()
    }
    if (testStateConfig?.kind === 'attack-effect') {
      return createAttackEffectDemoState()
    }
    if (testStateConfig?.kind === 'support-to-trash-skill') {
      return createSupportToTrashSkillDemoState()
    }
    if (testStateConfig?.kind === 'blue-activate-skill') {
      return createBlueActivateSkillDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'blue-optional-cost-attack') {
      return createBlueOptionalCostAttackDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'blue-inspect-deck') {
      return createBlueInspectDeckDemoState()
    }
    if (testStateConfig?.kind === 'blue-st4-016') {
      return createBlueSt4DemoState('ST4-016')
    }
    if (testStateConfig?.kind === 'blue-st4-017') {
      return createBlueSt4DemoState('ST4-017')
    }
    if (testStateConfig?.kind === 'blue-st4-018') {
      return createBlueSt4DemoState('ST4-018')
    }
    if (testStateConfig?.kind === 'blue-st4-019') {
      return createBlueSt4DemoState('ST4-019')
    }
    if (testStateConfig?.kind === 'blue-st4-020') {
      return createBlueSt4TrapDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'card-check') {
      return createCardCheckDemoState(testStateConfig.cardNumber)
    }
    if (testStateConfig?.kind === 'bs4-condition') {
      return createBs4ConditionDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs3-121-special-victory') {
      return createBs3SpecialVictoryDemoState()
    }
    if (testStateConfig?.kind === 'soul-jam-019-equipped') {
      return createSoulJamEquippedDemoState('BS3-019', 'BS3-017')
    }
    if (testStateConfig?.kind === 'soul-jam-043-equipped') {
      return createSoulJamEquippedDemoState('BS3-043', 'BS3-025')
    }
    if (testStateConfig?.kind === 'soul-jam-066-equipped') {
      return createSoulJamEquippedDemoState('BS3-066', 'BS3-055')
    }
    if (testStateConfig?.kind === 'soul-jam-091-equipped') {
      return createSoulJamEquippedDemoState('BS3-091', 'BS3-088')
    }
    if (testStateConfig?.kind === 'soul-jam-115-equipped') {
      return createSoulJamEquippedDemoState('BS3-115', 'BS3-100')
    }
    if (testStateConfig?.kind === 'soul-jam-115-protection-demo') {
      return createSoulJam115ProtectionDemoState()
    }
    return createDemoSetupGame('player-one')
  })
  const [message, setMessage] = useState(() => {
    if (testStateConfig?.kind === 'break-to-trash') {
      return testStateConfig.level === 1
        ? '測試狀態：休息區有 1 張 LV.1 餅乾。'
        : '測試狀態：休息區有 1 張 LV.2 餅乾。'
    }
    if (testStateConfig?.kind === 'replacement-choice') {
      return '測試狀態：選擇是否補餅乾。'
    }
    if (testStateConfig?.kind === 'st5-010-on-play') {
      return '測試狀態：ST5-010 補位登場後，AI 必須繼續操作。'
    }
    if (testStateConfig?.kind === 'ai-discard-reveal') {
      return '測試狀態：AI 效果棄牌公開確認。'
    }
    if (testStateConfig?.kind === 'item-usage') {
      return testStateConfig.payable
        ? '測試狀態：合法物品卡使用。'
        : '測試狀態：不合法物品卡使用（非主要階段）。'
    }
    if (testStateConfig?.kind === 'stage-usage') {
      return testStateConfig.payable
        ? '測試狀態：合法場景卡放置與啟動。'
        : '測試狀態：不合法場景卡啟動（已橫置）。'
    }
    if (testStateConfig?.kind === 'faint-damage') {
      return '測試狀態：Cherry Cookie 昏厥效果選擇目標。'
    }
    if (testStateConfig?.kind === 'trap-pretzel') {
      return testStateConfig.attack === 5
        ? '測試狀態：Pretzel Snare 可支付（攻擊 5）。'
        : '測試狀態：Pretzel Snare 不可支付（攻擊 4）。'
    }
    if (testStateConfig?.kind === 'blocker-response') {
      return testStateConfig.payable
        ? '測試狀態：Blocker 可支付（有足夠能量）。'
        : '測試狀態：Blocker 不可支付（能量不足）。'
    }
    if (testStateConfig?.kind === 'trap-and-blocker-response') {
      return testStateConfig.payable
        ? '測試狀態：陷阱與 Blocker 同時可支付，選擇回應方式。'
        : '測試狀態：陷阱與 Blocker 同時不可支付。'
    }
    if (testStateConfig?.kind === 'opponent-discard-hand') {
      return '測試狀態：Roguefort Cookie OnPlay 對手棄牌。'
    }
    if (testStateConfig?.kind === 'attack-effect') {
      return '測試狀態：Wizard Cookie 攻擊後續效果。'
    }
    if (testStateConfig?.kind === 'support-to-trash-skill') {
      return '測試狀態：ST3-002 支援卡代價技能。'
    }
    if (testStateConfig?.kind === 'blue-activate-skill') {
      return testStateConfig.payable
        ? '測試狀態：Werewolf Cookie 可發動技能（手牌充足）。'
        : '測試狀態：Werewolf Cookie 不可發動技能（手牌不足）。'
    }
    if (testStateConfig?.kind === 'blue-optional-cost-attack') {
      return testStateConfig.payable
        ? '測試狀態：Captain Caviar 可支付攻擊後續效果。'
        : '測試狀態：Captain Caviar 不可支付攻擊後續效果。'
    }
    if (testStateConfig?.kind === 'blue-inspect-deck') {
      return '測試狀態：Captain Caviar OnPlay 檢視牌庫頂 3 張。'
    }
    if (testStateConfig?.kind === 'blue-st4-016') {
      return '測試狀態：ST4-016 回收我方 1 張剩餘 HP3+ 的藍色餅乾。'
    }
    if (testStateConfig?.kind === 'blue-st4-017') {
      return '測試狀態：ST4-017 回收我方 1 張 LV.1 餅乾。'
    }
    if (testStateConfig?.kind === 'blue-st4-018') {
      return '測試狀態：ST4-018 抽最多 2 張牌。'
    }
    if (testStateConfig?.kind === 'blue-st4-019') {
      return '測試狀態：ST4-019 洗回手牌並重抽相同數量。'
    }
    if (testStateConfig?.kind === 'blue-st4-020') {
      return testStateConfig.payable
        ? '測試狀態：ST4-020 選擇並棄置 2 張手牌。'
        : '測試狀態：ST4-020 手牌不足，不能發動。'
    }
    if (testStateConfig?.kind === 'card-check') {
      return `測試狀態：卡片檢查 ${testStateConfig.cardNumber}。`
    }
    if (testStateConfig?.kind === 'bs4-condition') {
      return `BS4 ${testStateConfig.cardNumber} 專用條件情境：${
        testStateConfig.conditionMet ? '條件成立' : '條件不成立'
      }`
    }
    if (testStateConfig?.kind === 'soul-jam-019-equipped') {
      return '靈魂果醬測試：BS3-019 已裝備於 Hollyberry，攻擊力 +1。'
    }
    if (testStateConfig?.kind === 'soul-jam-043-equipped') {
      return '靈魂果醬測試：BS3-043 已裝備於 Golden Cheese，HP +2。'
    }
    if (testStateConfig?.kind === 'soul-jam-066-equipped') {
      return '靈魂果醬測試：BS3-066 已裝備，攻擊時 set-active。'
    }
    if (testStateConfig?.kind === 'soul-jam-091-equipped') {
      return '靈魂果醬測試：BS3-091 已裝備於 Pure Vanilla，攻擊時抽牌。'
    }
    if (testStateConfig?.kind === 'soul-jam-115-equipped') {
      return '靈魂果醬測試：BS3-115 已裝備於 Dark Cacao，對手效果保護。'
    }
    if (testStateConfig?.kind === 'soul-jam-115-protection-demo') {
      return '保護示範：對手 P-030（4 張藍能量），Dark Cacao（BS3-115 保護）vs Pure Vanilla（無保護）。'
    }
    return '推進階段，開始這場對戰。'
  })
  const setup = useMatchSetup({
    game,
    setGame,
    setMessage,
    enabled: testStateConfig === null,
  })
  const {
    setupStep,
    setSetupStep,
    setupMessage,
    setSetupMessage,
    deckConfig,
    setDeckConfig,
    selectedCustomDeck,
    handleDeckSelection,
    handleRps,
    beginOrderedSetup,
    handlePlayerMulligan,
    handleStartingCookie,
    resetSetup,
  } = setup
  const animations = useMatchAnimations()
  const [selectedTrapId, setSelectedTrapId] = useState<string | null>(null)
  const [selectedTrapPaymentIds, setSelectedTrapPaymentIds] = useState<string[]>([])
  const [selectedTrapHandToBreakIds, setSelectedTrapHandToBreakIds] = useState<
    string[]
  >([])
  const [selectedTrapDiscardIds, setSelectedTrapDiscardIds] = useState<
    string[]
  >([])
  const [selectedTrapTrashBattleCookieIds, setSelectedTrapTrashBattleCookieIds] =
    useState<string[]>([])
  const [trapSelectNoTarget, setTrapSelectNoTarget] = useState(false)
  const [selectedTrapTargetId, setSelectedTrapTargetId] = useState<string | null>(null)
  const [selectedTrapSelfTargetId, setSelectedTrapSelfTargetId] = useState<string | null>(null)
  const [pendingResponseMode, setPendingResponseMode] = useState<'trap' | 'blocker' | null>(null)
  const [selectedTrapSupportToHandIds, setSelectedTrapSupportToHandIds] = useState<string[]>([])
  const [selectedTrapSupportTrashIds, setSelectedTrapSupportTrashIds] = useState<string[]>([])
  const [selectedTrapHandToSupportIds, setSelectedTrapHandToSupportIds] = useState<string[]>([])
  const [selectedTrapTrashToDeckIds, setSelectedTrapTrashToDeckIds] = useState<string[]>([])
  const [selectedBlockerId, setSelectedBlockerId] = useState<string | null>(null)
  const [selectedFlipDiscardIds, setSelectedFlipDiscardIds] = useState<
    string[]
  >([])
  const [selectedFaintTargetIds, setSelectedFaintTargetIds] = useState<
    string[]
  >([])
  const [selectedFaintPaymentIds, setSelectedFaintPaymentIds] = useState<
    string[]
  >([])
  const [selectedOpponentDiscardIds, setSelectedOpponentDiscardIds] =
    useState<string[]>([])
  const [selectedOpponentRestSupportIds, setSelectedOpponentRestSupportIds] =
    useState<string[]>([])
  const [selectedPlaceHandHpId, setSelectedPlaceHandHpId] = useState<
    string | undefined
  >(undefined)

  const viewerPlayerId: PlayerId = 'player-one'
  const opponentId = opponentOfId(viewerPlayerId)
  const activePlayer = game.players[game.activePlayerId]

  // 問題包（ReplayIssueBundleV1）素材：對局起點快照 + 最後一個失敗指令。
  // 首次 render 時 game 尚未套用任何 dispatch，直接當作重播起點。
  const initialGameRef = useRef<GameState | null>(null)
  if (initialGameRef.current === null) {
    initialGameRef.current = game
  }
  const lastFailedCommandRef = useRef<{
    command: GameCommand
    message: string
  } | null>(null)

  const runAction: RunGameAction = (action, successMessage, onSuccess) => {
    try {
      const nextGame = action(game)
      const prevGame = game
      setGame(nextGame)
      setMessage(successMessage)
      animations.observeTransition(prevGame, nextGame)
      lastFailedCommandRef.current = null

      onSuccess?.(nextGame)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '動作無法執行。')
    }
  }

  /**
   * 統一分派層：本地模式下與 runAction((current) => applyGameCommand(current, command), ...)
   * 完全等價，差別只是呼叫端直接給出 command 物件而不是包一層閉包。
   * 之後線上模式（見 useOnlineMatchController）會改成把 command 送到伺服器、
   * 不在本地套用，等伺服器回傳新狀態。
   */
  const dispatch: DispatchGameCommand = (command, successMessage, onSuccess) => {
    const commands = Array.isArray(command) ? command : [command]
    runAction(
      (current) =>
        commands.reduce((state, cmd) => {
          try {
            return applyGameCommand(state, cmd)
          } catch (error) {
            // 失敗指令不會進 commandLog，記下來供問題包重現錯誤。
            lastFailedCommandRef.current = {
              command: cmd,
              message:
                error instanceof Error ? error.message : String(error),
            }
            throw error
          }
        }, current),
      successMessage,
      onSuccess,
    )
  }
  const battleActions = useBattleActions({ game, dispatch })

  // 問題包出口：暫停選單主動回報用，也註冊給 GameErrorBoundary 崩潰時取用。
  const buildIssueBundle = useCallback(
    (errorSummary?: string | null): ReplayIssueBundleV1 => {
      const failed = lastFailedCommandRef.current
      return buildReplayIssueBundle({
        state: game,
        mode: 'offline',
        viewerId: viewerPlayerId,
        decks: {
          playerOne: deckConfig.player,
          playerTwo: deckConfig.ai,
        },
        errorSummary: errorSummary ?? failed?.message ?? null,
        failedCommand: failed?.command ?? null,
        initialState: initialGameRef.current,
      })
    },
    [game, deckConfig, viewerPlayerId],
  )

  useEffect(() => {
    registerIssueBundleProvider((errorSummary) =>
      buildIssueBundle(errorSummary),
    )
  }, [buildIssueBundle])

  const handleAdvancePhase = () => {
    dispatch(
      {
        kind: 'advance-phase',
        playerId: viewerPlayerId,
      },
      '階段已推進。',
    )
    battleActions.clearAttacker()
    setSelectedFaintTargetIds([])
    setSelectedFaintPaymentIds([])
  }

  // Derived state
  const pendingFaint =
    game.pendingFaintEffects && game.pendingFaintEffects.length > 0
      ? game.pendingFaintEffects[0]
      : null
  const faintSourceCard = pendingFaint
    ? (() => {
        for (const player of Object.values(game.players) as PlayerState[]) {
          const found =
            player.breakArea.find(
              (cookie: CookieCard) => cookie.instanceId === pendingFaint.sourceInstanceId,
            ) ??
            player.battleArea.find(
              (cookie: CookieInBattle) =>
                cookie.card.instanceId === pendingFaint.sourceInstanceId,
            )?.card
          if (found) return found
        }
        return null
      })()
    : null
  const faintCandidates =
    pendingFaint && pendingFaint.sourcePlayerId === viewerPlayerId
      ? getFaintEffectCandidates(game)
      : []
  const faintCardCandidates =
    pendingFaint && pendingFaint.sourcePlayerId === viewerPlayerId
      ? getFaintEffectCardCandidates(game)
      : []
  const faintTargetIds = new Set(
    faintCandidates.map((cookie) => cookie.card.instanceId),
  )
  const hasFaint =
    Boolean(pendingFaint && pendingFaint.sourcePlayerId === viewerPlayerId)
  const faintMinMax = pendingFaint
    ? getFaintEffectMinMax(game, pendingFaint.effect)
    : { min: 0, max: 0 }
  const faintEnergyCost =
    pendingFaint?.effect.kind === 'hand-to-battle'
      ? pendingFaint.effect.energyCost ?? {}
      : {}
  const faintEnergyCostTotal = getEnergyCostTotal(faintEnergyCost)
  const faintPaymentCandidates =
    pendingFaint &&
    pendingFaint.sourcePlayerId === viewerPlayerId &&
    faintEnergyCostTotal > 0
      ? game.players[viewerPlayerId].supportArea
          .filter((support) => {
            if (support.rested) return false
            if (selectedFaintPaymentIds.includes(support.card.instanceId)) {
              return true
            }
            if (selectedFaintPaymentIds.length >= faintEnergyCostTotal) {
              return false
            }
            return isEnergyColorCompatibleWithCost(
              faintEnergyCost,
              support.card.energyColor,
            )
          })
          .map((support) => support.card)
      : []
  const faintPaymentValid =
    faintEnergyCostTotal === 0 ||
    validateEnergyPayment(
      faintEnergyCost,
      game.players[viewerPlayerId].supportArea,
      selectedFaintPaymentIds,
    ).valid
  const toggleFaintPayment = (instanceId: string) => {
    if (faintEnergyCostTotal === 0) return
    setSelectedFaintPaymentIds((current) => {
      if (current.includes(instanceId)) {
        return current.filter((id) => id !== instanceId)
      }
      if (current.length >= faintEnergyCostTotal) return current
      if (!faintPaymentCandidates.some((card) => card.instanceId === instanceId)) {
        return current
      }
      return [...current, instanceId]
    })
  }
  const currentPendingDecision = getPendingDecision(game)

  const [selectedAfterDamageTargetIds, setSelectedAfterDamageTargetIds] =
    useState<string[]>([])
  const pendingAfterDamage =
    game.pendingAfterDamageEffects && game.pendingAfterDamageEffects.length > 0
      ? game.pendingAfterDamageEffects[0]
      : null
  const afterDamageSourceCard = pendingAfterDamage
    ? (() => {
        for (const player of Object.values(game.players) as PlayerState[]) {
          const found =
            player.breakArea.find(
              (cookie: CookieCard) =>
                cookie.instanceId === pendingAfterDamage.sourceInstanceId,
            ) ??
            player.battleArea.find(
              (cookie: CookieInBattle) =>
                cookie.card.instanceId === pendingAfterDamage.sourceInstanceId,
            )?.card
          if (found) return found
        }
        return null
      })()
    : null
  const afterDamageCandidates =
    pendingAfterDamage &&
    pendingAfterDamage.sourcePlayerId === viewerPlayerId
      ? getAfterDamageEffectCandidates(game)
      : []
  const afterDamageTargetIds = new Set(
    afterDamageCandidates.map((cookie) => cookie.card.instanceId),
  )
  const hasAfterDamage =
    Boolean(
      pendingAfterDamage &&
      pendingAfterDamage.sourcePlayerId === viewerPlayerId &&
      currentPendingDecision?.kind === 'after-damage-effect',
    )
  const afterDamageMinMax = pendingAfterDamage
    ? getAfterDamageEffectMinMax(pendingAfterDamage.effect)
    : { min: 0, max: 0 }

  const playerTrapCandidates =
    game.pendingBattle?.stage === 'trap' &&
    game.pendingBattle.defenderPlayerId === viewerPlayerId
      ? getTrapCandidates(game, viewerPlayerId)
      : []
  const selectedTrap = playerTrapCandidates.find(
    (card) => card.instanceId === selectedTrapId,
  )
  const trapEnergyCost =
    selectedTrap?.trap?.cost.energy ?? selectedTrap?.trap?.cost ?? {}
  const trapEnergyCostTotal = getEnergyCostTotal(trapEnergyCost)
  const trapPaymentCandidates =
    trapEnergyCostTotal > 0
      ? game.players[viewerPlayerId].supportArea.filter((support) => {
          if (support.rested) return false
          return isEnergyColorCompatibleWithCost(
            trapEnergyCost,
            support.card.energyColor,
          )
        })
      : []
  const trapPaymentTargetIds = new Set(
    trapEnergyCostTotal > 0
      ? game.players[viewerPlayerId].supportArea
          .filter((support) => {
            if (support.rested) return false
            if (selectedTrapPaymentIds.includes(support.card.instanceId))
              return true
            if (selectedTrapPaymentIds.length >= trapEnergyCostTotal)
              return false
            return isEnergyColorCompatibleWithCost(
              trapEnergyCost,
              support.card.energyColor,
            )
          })
          .map((support) => support.card.instanceId)
      : [],
  )
  const trapPaymentValid =
    trapEnergyCostTotal > 0
      ? validateEnergyPayment(
          trapEnergyCost,
          game.players[viewerPlayerId].supportArea,
          selectedTrapPaymentIds,
        ).valid
      : true
  const toggleTrapPayment = (instanceId: string) => {
    setSelectedTrapPaymentIds((current) => {
      const isSelected = current.includes(instanceId)
      if (!isSelected) {
        if (current.length >= trapEnergyCostTotal) return current
        const supportCard = game.players[viewerPlayerId].supportArea.find(
          (s) => s.card.instanceId === instanceId,
        )
        if (!supportCard) return current
        if (
          !isEnergyColorCompatibleWithCost(
            trapEnergyCost,
            supportCard.card.energyColor,
          )
        )
          return current
      }
      return isSelected
        ? current.filter((id) => id !== instanceId)
        : [...current, instanceId]
    })
  }
  const selectedTrapDiscardCost = selectedTrap?.trap?.cost.discardHand ?? 0
  const selectedTrapTrashBattleCookieCost =
    selectedTrap?.trap?.cost.trashBattleCookie?.count ?? 0
  const selectedTrapTrashBattleCookieCandidates = selectedTrap?.trap
    ? getTrashBattleCookieCostCandidates(
        selectedTrap.trap.cost,
        game.players[viewerPlayerId].battleArea,
      )
    : []
  const selectedTrapHandToBreakCost =
    selectedTrap?.trap?.cost.handToBreakArea?.count ?? 0
  const selectedTrapHandToBreakCandidates = selectedTrap
    ? game.players[viewerPlayerId].hand.filter(
        (card) =>
          card.instanceId !== selectedTrap.instanceId &&
          card.type === 'cookie' &&
          (!selectedTrap.trap?.cost.handToBreakArea?.energyColor ||
            card.energyColor ===
              selectedTrap.trap.cost.handToBreakArea.energyColor),
      )
    : []
  const selectedTrapDiscardCandidates = selectedTrap
    ? game.players[viewerPlayerId].hand.filter(
        (card) =>
          card.instanceId !== selectedTrap.instanceId &&
          (!selectedTrap.trap?.cost.discardHandColor ||
            card.energyColor === selectedTrap.trap.cost.discardHandColor),
      )
    : []
  const trapAllowEmptyTarget =
    selectedTrap?.trap?.effects.some(
      (effect) =>
        (effect.kind === 'damage' ||
          effect.kind === 'damage-by-break-count' ||
          effect.kind === 'modify-attack' ||
          effect.kind === 'modify-attack-by-break-count' ||
          effect.kind === 'prevent-knockout') &&
        (effect.target.min ?? 0) === 0,
    ) ?? false
  // 陷阱目標：優先使用玩家手動選擇；若未選擇則自動挑選當前攻擊者。
  // 否則對手有多隻餅乾時，減攻擊／防昏厥類陷阱會套用到非攻擊者身上，
  // 導致玩家發動陷阱卻沒能減少實際攻擊傷害（看起來像「效果沒發動」）。
  const trapTargetCandidates =
    selectedTrap && !trapSelectNoTarget
      ? getTrapTargetCandidates(game, viewerPlayerId, selectedTrap.instanceId)
      : []
  const attackerInstanceId = game.pendingBattle?.attackerInstanceId ?? null
  const selectedTrapTarget = selectedTrapTargetId
    ? trapTargetCandidates.find(
        (candidate) => candidate.card.instanceId === selectedTrapTargetId,
      )
    : attackerInstanceId
      ? trapTargetCandidates.find(
          (candidate) => candidate.card.instanceId === attackerInstanceId,
        )
      : undefined
  const selectedTrapTargets = selectedTrapTarget
    ? [selectedTrapTarget]
    : trapTargetCandidates.slice(0, 1)
  const trapSelfTargetCandidates =
    selectedTrap && !trapSelectNoTarget
      ? getTrapSelfTargetCandidates(game, viewerPlayerId, selectedTrap.instanceId)
      : []
  const selectedTrapSelfTarget = selectedTrapSelfTargetId
    ? trapSelfTargetCandidates.find(
        (candidate) => candidate.card.instanceId === selectedTrapSelfTargetId,
      )
    : undefined
  const selectedTrapSelfTargets = selectedTrapSelfTarget
    ? [selectedTrapSelfTarget]
    : trapSelfTargetCandidates.slice(0, 1)
  const trapSupportTrashEffect = selectedTrap?.trap?.effects.find(
    (effect) => effect.kind === 'support-to-trash',
  )
  const trapSupportTrashAmount =
    trapSupportTrashEffect?.kind === 'support-to-trash'
      ? trapSupportTrashEffect.amount
      : 0
  const trapSupportTrashCandidates =
    trapSupportTrashAmount > 0
      ? game.players[viewerPlayerId].supportArea.map(
          (support: SupportCard) => support.card,
        )
      : []

  const trapSupportToHandEffect = selectedTrap?.trap?.effects.find(
    (effect) => effect.kind === 'support-to-hand',
  )
  const trapSupportToHandAmount =
    trapSupportToHandEffect?.kind === 'support-to-hand'
      ? trapSupportToHandEffect.amount
      : 0
  const trapSupportToHandCandidates =
    trapSupportToHandAmount > 0
      ? game.players[viewerPlayerId].supportArea.map(
          (support: SupportCard) => support.card,
        )
      : []

  const trapHandToSupportEffect = selectedTrap?.trap?.effects.find(
    (effect) => effect.kind === 'hand-to-support',
  )
  const trapHandToSupportAmount =
    trapHandToSupportEffect?.kind === 'hand-to-support'
      ? trapHandToSupportEffect.amount
      : 0
  const trapHandToSupportCandidates =
    trapHandToSupportAmount > 0
      ? game.players[viewerPlayerId].hand.filter(
          (card) => card.instanceId !== selectedTrap?.instanceId,
        )
      : []

  const trapTrashToDeckEffect = selectedTrap?.trap?.effects.find(
    (effect) => effect.kind === 'trash-to-deck',
  )
  const trapTrashToDeckAmount =
    trapTrashToDeckEffect?.kind === 'trash-to-deck'
      ? trapTrashToDeckEffect.max
      : 0
  const trapTrashToDeckCandidates =
    trapTrashToDeckEffect?.kind === 'trash-to-deck' && selectedTrap
      ? getTrashToDeckCandidates(
          game,
          { sourcePlayerId: viewerPlayerId, sourceInstanceId: selectedTrap.instanceId },
          trapTrashToDeckEffect,
        )
      : []

  const toggleTrapSupportToHand = useCallback(
    (id: string) => {
      setSelectedTrapSupportToHandIds((current) =>
        current.includes(id)
          ? current.filter((cId) => cId !== id)
          : current.length < trapSupportToHandAmount
            ? [...current, id]
            : current,
      )
    },
    [trapSupportToHandAmount],
  )

  const toggleTrapSupportTrash = useCallback(
    (id: string) => {
      if (
        !game.players[viewerPlayerId].supportArea.some(
          (support) => support.card.instanceId === id,
        )
      ) {
        return
      }
      setSelectedTrapSupportTrashIds((current) =>
        current.includes(id)
          ? current.filter((cId) => cId !== id)
          : current.length < trapSupportTrashAmount
            ? [...current, id]
            : current,
      )
    },
    [game, trapSupportTrashAmount, viewerPlayerId],
  )

  const toggleTrapHandToSupport = useCallback(
    (id: string) => {
      setSelectedTrapHandToSupportIds((current) =>
        current.includes(id)
          ? current.filter((cId) => cId !== id)
          : current.length < trapHandToSupportAmount
            ? [...current, id]
            : current,
      )
    },
    [trapHandToSupportAmount],
  )

  const toggleTrapTrashToDeck = useCallback(
    (id: string) => {
      setSelectedTrapTrashToDeckIds((current) =>
        current.includes(id)
          ? current.filter((cId) => cId !== id)
          : current.length < trapTrashToDeckAmount
            ? [...current, id]
            : current,
      )
    },
    [trapTrashToDeckAmount],
  )

  const playerBlockerCandidates =
    game.pendingBattle?.stage === 'trap' &&
    game.pendingBattle.defenderPlayerId === viewerPlayerId
      ? getBlockerCandidates(game, viewerPlayerId)
      : []
  const selectedBlocker = playerBlockerCandidates.find(
    (cookie) => cookie.card.instanceId === selectedBlockerId,
  )
  const selectedBlockerPaymentIds = selectedBlocker?.card.skill
    ? selectEnergyPayment(
        selectedBlocker.card.skill.cost.energy ?? selectedBlocker.card.skill.cost,
        game.players[viewerPlayerId].supportArea,
      ) ?? []
    : []

  const replacementTask = getCurrentReplacementTask(game)

  const aiControlsCurrentState: boolean =
    isPlayerControllingState(game, 'player-two')

  const pendingPlayerId = getPendingChoicePlayerId(game, replacementTask)
  const pendingPlayer = pendingPlayerId
    ? game.players[pendingPlayerId]
    : null
  const pendingOptions = game.pendingRefresh
    ? getRefreshCandidates(game, game.pendingRefresh.playerId)
    : pendingPlayer
      ? getReplacementCandidates(game, pendingPlayer.id)
      : []

  useEffect(() => {
    if (
      setupStep ||
      game.status !== 'playing' ||
      game.activePlayerId !== viewerPlayerId ||
      (game.phase !== 'active' && game.phase !== 'draw') ||
      hasBlockingPending(game)
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      setGame((current) => {
        if (
          current.activePlayerId !== viewerPlayerId ||
          (current.phase !== 'active' && current.phase !== 'draw')
        ) {
          return current
        }
        return applyGameCommand(current, {
          kind: 'advance-phase',
          playerId: viewerPlayerId,
        })
      })
      setMessage(
        game.phase === 'active'
          ? '活躍動作已自動完成。'
          : '抽牌已自動完成，進入支援階段。',
      )
    }, 350)

    return () => window.clearTimeout(timer)
  }, [game, setupStep, viewerPlayerId])

  // auto-skip trap
  useEffect(() => {
    const battle = game.pendingBattle
    if (
      battle?.stage !== 'trap' ||
      // 陷阱已經打出去了（例如 BS3-093），戰鬥還停在 'trap' 階段只是為了等玩家
      // 確認 reveal-top-deck 的巢狀效果——getTrapCandidates 在 trapUsed 之後
      // 一律回傳空陣列，不代表「沒有陷阱可用該自動略過」，若不排除這種情況會
      // 對著一個待處理決策再送一次 skip-trap，被規則層的 assertNoPendingDecision
      // 擋下拋錯，把整個 App 炸掉。
      battle.trapUsed ||
      battle.defenderPlayerId !== viewerPlayerId ||
      getTrapCandidates(game, viewerPlayerId).length > 0 ||
      getBlockerCandidates(game, viewerPlayerId).length > 0
    ) {
      return
    }

    // 只在「所有已知關卡都通過、卻還是進不了候選名單」時示警。手上有陷阱卡
    // 但付不出代價／條件未成立是日常狀況（被攻擊時支援卡通常還橫置著），
    // 每次都印會把主控台灌滿假警報，真的出問題時反而看不見。
    const unexplainedTraps = explainUnavailableTraps(
      game,
      viewerPlayerId,
    ).filter((entry) => entry.reason === 'unknown')
    if (unexplainedTraps.length > 0) {
      console.warn(
        '[auto-skip-trap] 陷阱卡通過所有已知可用性檢查卻仍不在候選名單，即將自動略過。診斷資訊：',
        {
          traps: unexplainedTraps,
          breakArea: game.players[viewerPlayerId].breakArea.map(
            (c) => ({ id: c.id, level: c.level }),
          ),
          supportArea: game.players[viewerPlayerId].supportArea.map(
            (s) => ({ id: s.card.id, energyColor: s.card.energyColor, rested: s.rested }),
          ),
          declaredDamage: battle.declaredDamage,
        },
      )
    }

    const timer = window.setTimeout(() => {
      setSelectedTrapId(null)
      setSelectedTrapDiscardIds([])
      setSelectedTrapTargetId(null)
      setSelectedTrapSelfTargetId(null)
      setGame((current: GameState) => {
        const currentBattle = current.pendingBattle
        if (
          currentBattle?.stage !== 'trap' ||
          currentBattle.trapUsed ||
          currentBattle.defenderPlayerId !== viewerPlayerId ||
          getTrapCandidates(current, viewerPlayerId).length > 0 ||
          getBlockerCandidates(current, viewerPlayerId).length > 0
        ) {
          return current
        }
        return applyGameCommand(current, {
          kind: 'skip-trap',
          playerId: viewerPlayerId,
        })
      })
    }, 0)

    return () => window.clearTimeout(timer)
  }, [game, viewerPlayerId])

  // resetMatchState: resets all match-owned state (used by App's resetGame)
  const resetMatchState = useCallback(
    (nextConfig: { player: DeckChoice; ai: BuiltInDeckChoice }) => {
      const nextGame = createDemoSetupGame('player-one', nextConfig)
      initialGameRef.current = nextGame
      lastFailedCommandRef.current = null
      setGame(nextGame)
      resetSetup()
      battleActions.clearAttacker()
      setSelectedFaintTargetIds([])
      setSelectedFaintPaymentIds([])
      animations.resetAnimations()
      setSelectedTrapId(null)
      setSelectedTrapDiscardIds([])
      setTrapSelectNoTarget(false)
      setPendingResponseMode(null)
      setSelectedFlipDiscardIds([])
      setSelectedOpponentDiscardIds([])
      setSelectedOpponentRestSupportIds([])
      setSelectedBlockerId(null)
    },
    [animations, battleActions, resetSetup],
  )

  // loadScenarioState: loads a player-configured test scenario, skipping opening setup
  const loadScenarioState = useCallback(
    (scenarioState: GameState, scenarioMessage: string) => {
      initialGameRef.current = scenarioState
      lastFailedCommandRef.current = null
      setGame(scenarioState)
      setSetupStep(null)
      setMessage(scenarioMessage)
      battleActions.clearAttacker()
      setSelectedFaintTargetIds([])
      setSelectedFaintPaymentIds([])
      animations.resetAnimations()
      setSelectedTrapId(null)
      setSelectedTrapDiscardIds([])
      setTrapSelectNoTarget(false)
      setPendingResponseMode(null)
      setSelectedFlipDiscardIds([])
      setSelectedOpponentDiscardIds([])
      setSelectedOpponentRestSupportIds([])
      setSelectedBlockerId(null)
    },
    [animations, battleActions, setSetupStep],
  )

  return {
    game,
    setGame,
    setupStep,
    setSetupStep,
    setupMessage,
    setSetupMessage,
    deckConfig,
    selectedCustomDeck,
    setDeckConfig,
    selectedAttackerId: battleActions.selectedAttackerId,
    setSelectedAttackerId: battleActions.setSelectedAttackerId,
    selectedAttackPaymentIds: battleActions.selectedAttackPaymentIds,
    setSelectedAttackPaymentIds: battleActions.setSelectedAttackPaymentIds,
    message,
    setMessage,
    handleDeckSelection,
    handleRps,
    beginOrderedSetup,
    handlePlayerMulligan,
    handleStartingCookie,
    dispatch,
    handleAdvancePhase,
    handleAttackTarget: battleActions.handleAttackTarget,
    toggleAttackPayment: battleActions.toggleAttackPayment,
    attackPaymentTargetIds: battleActions.attackPaymentTargetIds,
    clearAttacker: battleActions.clearAttacker,
    activePlayer,
    viewerPlayerId,
    opponentId,
    selectedAttacker: battleActions.selectedAttacker,
    selectedAttackCost: battleActions.selectedAttackCost,
    attackPaymentValidation: battleActions.attackPaymentValidation,
    // Trap
    selectedTrapId,
    setSelectedTrapId,
    selectedTrapDiscardIds,
    setSelectedTrapDiscardIds,
    selectedTrapTrashBattleCookieIds,
    setSelectedTrapTrashBattleCookieIds,
    trapSelectNoTarget,
    setTrapSelectNoTarget,
    playerTrapCandidates,
    selectedTrap,
    selectedTrapPaymentIds,
    setSelectedTrapPaymentIds,
    trapPaymentCandidates,
    trapPaymentTargetIds,
    trapPaymentValid,
    trapEnergyCostTotal,
    toggleTrapPayment,
    selectedTrapDiscardCost,
    selectedTrapDiscardCandidates,
    selectedTrapHandToBreakIds,
    setSelectedTrapHandToBreakIds,
    selectedTrapHandToBreakCost,
    selectedTrapHandToBreakCandidates,
    selectedTrapTrashBattleCookieCost,
    selectedTrapTrashBattleCookieCandidates,
    trapAllowEmptyTarget,
    trapTargetCandidates,
    attackerInstanceId,
    selectedTrapTargetId,
    setSelectedTrapTargetId,
    selectedTrapTargets,
    trapSelfTargetCandidates,
    selectedTrapSelfTargetId,
    setSelectedTrapSelfTargetId,
    selectedTrapSelfTargets,
    selectedTrapSupportTrashIds,
    setSelectedTrapSupportTrashIds,
    trapSupportTrashCandidates,
    trapSupportTrashAmount,
    toggleTrapSupportTrash,
    selectedTrapSupportToHandIds,
    setSelectedTrapSupportToHandIds,
    trapSupportToHandCandidates,
    trapSupportToHandAmount,
    toggleTrapSupportToHand,
    selectedTrapHandToSupportIds,
    setSelectedTrapHandToSupportIds,
    trapHandToSupportCandidates,
    trapHandToSupportAmount,
    toggleTrapHandToSupport,
    selectedTrapTrashToDeckIds,
    setSelectedTrapTrashToDeckIds,
    trapTrashToDeckCandidates,
    trapTrashToDeckAmount,
    toggleTrapTrashToDeck,
    // Blocker
    selectedBlockerId,
    setSelectedBlockerId,
    playerBlockerCandidates,
    selectedBlockerPaymentIds,
    pendingResponseMode,
    setPendingResponseMode,
    // Flip
    selectedFlipDiscardIds,
    setSelectedFlipDiscardIds,
    // Faint (raw hasFaint without !pendingEffect check)
    selectedFaintTargetIds,
    setSelectedFaintTargetIds,
    selectedFaintPaymentIds,
    setSelectedFaintPaymentIds,
    faintEnergyCost,
    faintEnergyCostTotal,
    faintPaymentCandidates,
    faintPaymentValid,
    toggleFaintPayment,
    pendingFaint,
    faintSourceCard,
    faintCandidates,
    faintCardCandidates,
    faintTargetIds,
    hasFaint,
    faintMin: faintMinMax.min,
    faintMax: faintMinMax.max,
    // After-damage
    selectedAfterDamageTargetIds,
    setSelectedAfterDamageTargetIds,
    pendingAfterDamage,
    afterDamageSourceCard,
    afterDamageCandidates,
    afterDamageTargetIds,
    hasAfterDamage,
    afterDamageMin: afterDamageMinMax.min,
    afterDamageMax: afterDamageMinMax.max,
    // Opponent discard
    selectedOpponentDiscardIds,
    setSelectedOpponentDiscardIds,
    // Opponent rest support (BS5-065 Petrification)
    selectedOpponentRestSupportIds,
    setSelectedOpponentRestSupportIds,
    // Place hand HP (兩階段選擇第二階段)
    selectedPlaceHandHpId,
    setSelectedPlaceHandHpId,
    // Animation
    attackShakeId: animations.attackShakeId,
    damageFlashId: animations.damageFlashId,
    faintAnimIds: animations.faintAnimIds,
    drawAnimIds: animations.drawAnimIds,
    // Derived
    pendingPlayer,
    pendingOptions,
    aiControlsCurrentState,
    replacementTask,
    // Reset
    resetMatchState,
    loadScenarioState,
    buildIssueBundle,
  } as const
}
