import { GameRuleError } from './errors'
import {
  advanceBattleAfterTrap,
  beginAttack,
  finishBattle,
  getAfterDamageEffectMinMax,
  getFaintEffectMinMax,
  playBlocker,
  playTrap,
  resolveAttackEffect,
  resolveBattleAutomatically,
  resolveFaintEffect,
  resolveFlip,
  resolveNextAfterDamageEffect,
  resolveNextDamage,
  resolveOptionalCostAttack,
  skipTrap,
} from './battle'
import {
  executeCardEffect,
  getEffectTargetCandidatesForEffect,
  hasRequiredEffectTargets,
  isEffectConditionMet,
  requiresEffectCardSelection,
  requiresTargetSelection,
  resolveDrawUpTo,
  resolveInspectDeck,
  resolveOpponentHandDiscard,
} from './effects'
import {
  attackCookie,
  deployCookie,
  placeSupportCard,
  replaceDefeatedCookie,
  skipDefeatedCookieReplacement,
} from './actions'
import {
  asChooseOneEffect,
  expandChooseOne,
  expandChooseOneSequence,
} from './effects/choose-one'
import { advancePhase } from './turn'
import {
  activateCookieSkill,
  findSkillSource,
  getSkillUseKey,
  skipCookieOnPlay,
} from './skills'
import { activateStage, playItem, playStage } from './card-abilities'
import { refreshDeck } from './refresh'
import { finalizePendingReplacements, getCurrentReplacementTask } from './replacement'
import { hasBlockingPending } from './pending'
import { createSeededShuffle } from './helpers'
import { describeCommand, describeCommandSteps, resolveLogCategory } from './command-log'
import { getBreakAreaLevel } from './victory'
import {
  drawMulliganCompensation,
  forceMulliganOpeningHand,
  keepOpeningHand,
  mulliganOpeningHand,
  selectStartingCookie,
} from './setup'
import type {
  AbilityCost,
  BattleContinuation,
  CardEffect,
  CommandLogEntry,
  EffectContext,
  EnergyCost,
  EnergyColor,
  GameCard,
  GameState,
  InspectDeckRestDestination,
  PendingEffectOrderItem,
  PlayerId,
  Shuffle,
} from './types'

export interface FaintEffectDecision {
  kind: 'faint-effect'
  playerId: PlayerId
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  min: number
  max: number
}

export interface OpponentHandDiscardDecision {
  kind: 'opponent-hand-discard'
  playerId: PlayerId
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  sourceCardName: string
  effectText: string
  count: number
}

export interface InspectDeckDecision {
  kind: 'inspect-deck'
  playerId: PlayerId
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  sourceCardName: string
  lookCount: number
  pickCount: number
  revealedCardIds: string[]
  restDestination?: InspectDeckRestDestination
  pickDestination?: 'hand' | 'battle'
  filterColor?: EnergyColor
  filterType?: GameCard['type']
  optionalPick?: boolean
}

export interface RevealTopDeckDecision {
  kind: 'reveal-top-deck'
  playerId: PlayerId
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  sourceCardName: string
  revealedCardId: string
  matched: boolean
}

export interface OptionalCostAttackDecision {
  kind: 'optional-cost-attack'
  playerId: PlayerId
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  sourceCardName: string
  cost: AbilityCost
  effects: CardEffect[]
  effectText: string
  sourceEnergy?: EnergyCost
}

export interface DrawUpToDecision {
  kind: 'draw-up-to'
  playerId: PlayerId
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  sourceCardName: string
  max: number
}

export interface StageTriggerDecision {
  kind: 'stage-trigger'
  playerId: PlayerId
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  sourceCardName: string
  effectText: string
}

export interface AfterDamageEffectDecision {
  kind: 'after-damage-effect'
  playerId: PlayerId
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  min: number
  max: number
}

export interface EffectOrderDecision {
  kind: 'effect-order'
  playerId: PlayerId
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  items: PendingEffectOrderItem[]
}

export type PendingDecision =
  | FaintEffectDecision
  | OpponentHandDiscardDecision
  | InspectDeckDecision
  | RevealTopDeckDecision
  | OptionalCostAttackDecision
  | DrawUpToDecision
  | StageTriggerDecision
  | AfterDamageEffectDecision
  | EffectOrderDecision

export interface ResolveFaintEffectCommand {
  kind: 'resolve-faint-effect'
  playerId: PlayerId
  targetIds: string[]
  paymentIds?: string[]
}

export interface ResolveOpponentHandDiscardCommand {
  kind: 'resolve-opponent-hand-discard'
  playerId: PlayerId
  cardIds: string[]
}

export interface ResolveInspectDeckCommand {
  kind: 'resolve-inspect-deck'
  playerId: PlayerId
  pickedCardIds: string[]
  restOrder: string[]
}

export interface ResolveRevealTopDeckCommand {
  kind: 'resolve-reveal-top-deck'
  playerId: PlayerId
  targetIds?: string[]
}

export interface ResolveOptionalCostAttackCommand {
  kind: 'resolve-optional-cost-attack'
  playerId: PlayerId
  action: 'skip' | 'pay'
  discardCardIds?: string[]
  targetIds?: string[]
  paymentIds?: string[]
}

export interface ResolveDrawUpToCommand {
  kind: 'resolve-draw-up-to'
  playerId: PlayerId
  drawCount: number
}

export interface ResolveStageTriggerCommand {
  kind: 'resolve-stage-trigger'
  playerId: PlayerId
  action: 'activate' | 'skip'
}

export interface ResolveAfterDamageEffectCommand {
  kind: 'resolve-after-damage-effect'
  playerId: PlayerId
  targetIds: string[]
}

export interface ResolveEffectOrderCommand {
  kind: 'resolve-effect-order'
  playerId: PlayerId
  orderedIds: string[]
}

export type PendingDecisionCommand =
  | ResolveFaintEffectCommand
  | ResolveOpponentHandDiscardCommand
  | ResolveInspectDeckCommand
  | ResolveRevealTopDeckCommand
  | ResolveOptionalCostAttackCommand
  | ResolveDrawUpToCommand
  | ResolveStageTriggerCommand
  | ResolveAfterDamageEffectCommand
  | ResolveEffectOrderCommand

export interface KeepOpeningHandCommand {
  kind: 'keep-opening-hand'
  playerId: PlayerId
}

export interface MulliganOpeningHandCommand {
  kind: 'mulligan-opening-hand'
  playerId: PlayerId
}

export interface ForceMulliganOpeningHandCommand {
  kind: 'force-mulligan-opening-hand'
  playerId: PlayerId
}

export interface DrawMulliganCompensationCommand {
  kind: 'draw-mulligan-compensation'
  playerId: PlayerId
}

export interface SelectStartingCookieCommand {
  kind: 'select-starting-cookie'
  playerId: PlayerId
  instanceId: string
}

export interface AdvancePhaseCommand {
  kind: 'advance-phase'
  playerId: PlayerId
}

export interface PlaceSupportCommand {
  kind: 'place-support'
  playerId: PlayerId
  instanceId: string
}

export interface DeployCookieCommand {
  kind: 'deploy-cookie'
  playerId: PlayerId
  instanceId: string
}

export interface AttackCommand {
  kind: 'attack'
  playerId: PlayerId
  attackerInstanceId: string
  targetInstanceId: string
  supportPaymentIds: string[]
}

/**
 * 只執行 beginAttack（開戰不自動結算），供真人互動流程使用。
 * `attack` 指令會自動 resolveBattleAutomatically，只適合 AI。
 */
export interface DeclareAttackCommand {
  kind: 'declare-attack'
  playerId: PlayerId
  attackerInstanceId: string
  targetInstanceId: string
  supportPaymentIds: string[]
}

export interface ActivateSkillCommand {
  kind: 'activate-skill'
  playerId: PlayerId
  sourceInstanceId: string
  trigger: 'activate' | 'on-play'
  paymentIds: string[]
  costSupportToTrashIds?: string[]
  discardHandIds?: string[]
  trashBattleCookieIds?: string[]
  /** 從棄牌區放到牌庫底的代價卡，順序即為放入牌庫底的順序（BS3-112）。 */
  trashToDeckBottomIds?: string[]
  /** 從棄牌區選卡洗回牌庫的代價卡（BS3-098）。 */
  trashToDeckIds?: string[]
  effectTargets?: string[][]
  /** 依序對應每個「選擇一項」所選的模式索引。 */
  chooseOneModes?: number[]
}

/**
 * 只支付代價、不執行效果，改為設定 pendingAbilityEffect 逐步等待目標選擇。
 * 供真人互動流程使用（支援中途暫停恢復）；`activate-skill` 維持批次版本供 AI 使用。
 */
export interface BeginActivateSkillCommand {
  kind: 'begin-activate-skill'
  playerId: PlayerId
  sourceInstanceId: string
  trigger: 'activate' | 'on-play'
  paymentIds: string[]
  costSupportToTrashIds?: string[]
  discardHandIds?: string[]
  trashBattleCookieIds?: string[]
  /** 從棄牌區放到牌庫底的代價卡，順序即為放入牌庫底的順序（BS3-112）。 */
  trashToDeckBottomIds?: string[]
  /** 從棄牌區選卡洗回牌庫的代價卡（BS3-098）。 */
  trashToDeckIds?: string[]
  /** 提供時會在支付完成後一併解析第一個效果，供導引式 UI 最後確認使用。 */
  targetIds?: string[]
  /** 依序對應每個「選擇一項」所選的模式索引。 */
  chooseOneModes?: number[]
}

export interface SkipOnPlayCommand {
  kind: 'skip-on-play'
  playerId: PlayerId
  sourceInstanceId: string
}

export interface PlayItemCommand {
  kind: 'play-item'
  playerId: PlayerId
  instanceId: string
  paymentIds: string[]
  supportToTrashIds?: string[]
  supportToHandIds?: string[]
  discardHandIds?: string[]
  hpToTrashTargetIds?: string[]
  trashBattleCookieIds?: string[]
  effectTargets?: string[][]
  /** 依序對應每個「選擇一項」所選的模式索引。 */
  chooseOneModes?: number[]
}

export interface BeginPlayItemCommand {
  kind: 'begin-play-item'
  playerId: PlayerId
  instanceId: string
  paymentIds: string[]
  supportToTrashIds?: string[]
  supportToHandIds?: string[]
  discardHandIds?: string[]
  hpToTrashTargetIds?: string[]
  trashBattleCookieIds?: string[]
  targetIds?: string[]
  /** 依序對應每個「選擇一項」所選的模式索引。 */
  chooseOneModes?: number[]
}

export interface PlayStageCommand {
  kind: 'play-stage'
  playerId: PlayerId
  instanceId: string
  paymentIds: string[]
}

export interface ActivateStageCommand {
  kind: 'activate-stage'
  playerId: PlayerId
  paymentIds: string[]
  supportToTrashIds?: string[]
  supportToHandIds?: string[]
  discardHandIds?: string[]
  hpToTrashTargetIds?: string[]
  trashBattleCookieIds?: string[]
  effectTargets?: string[][]
  /** 依序對應每個「選擇一項」所選的模式索引。 */
  chooseOneModes?: number[]
}

export interface BeginActivateStageCommand {
  kind: 'begin-activate-stage'
  playerId: PlayerId
  paymentIds: string[]
  supportToTrashIds?: string[]
  supportToHandIds?: string[]
  discardHandIds?: string[]
  hpToTrashTargetIds?: string[]
  trashBattleCookieIds?: string[]
  targetIds?: string[]
  /** 依序對應每個「選擇一項」所選的模式索引。 */
  chooseOneModes?: number[]
}

/**
 * 逐一解析 pendingAbilityEffect 目前的效果目標；中途若出現其他待處理決策
 * （pendingRefresh/pendingOnPlay 等）會保留 pendingAbilityEffect 供之後恢復。
 */
export interface ResolveAbilityEffectCommand {
  kind: 'resolve-ability-effect'
  playerId: PlayerId
  targetIds: string[]
}

/**
 * 「選擇一項」只改寫待處理效果佇列：把 `choose-one` 換成選定模式的效果，
 * `effectIndex` 不動，接著仍由 `resolve-ability-effect` 逐一結算。
 */
export interface ResolveChooseOneCommand {
  kind: 'resolve-choose-one'
  playerId: PlayerId
  modeIndex: number
}

export interface ReplaceCookieCommand {
  kind: 'replace-cookie'
  playerId: PlayerId
  instanceId: string
}

export interface SkipReplacementCommand {
  kind: 'skip-replacement'
  playerId: PlayerId
}

export interface RefreshDeckCommand {
  kind: 'refresh-deck'
  playerId: PlayerId
  cookieInstanceId: string
  /** AI 可將種子寫入指令，讓 commandLog 不依賴外部 Math.random 重播。 */
  shuffleSeed?: number
}

export interface PlayTrapCommand {
  kind: 'play-trap'
  playerId: PlayerId
  trapInstanceId: string
  paymentIds: string[]
  targetIds: string[]
  supportTrashIds?: string[]
  supportToHandIds?: string[]
  handToSupportIds?: string[]
  discardHandIds?: string[]
  /** 放進自己休息區的手牌餅乾代價（BS3-046）。 */
  handToBreakIds?: string[]
  trashBattleCookieIds?: string[]
  trashToDeckIds?: string[]
  selfTargetIds?: string[]
}

export interface SkipTrapCommand {
  kind: 'skip-trap'
  playerId: PlayerId
}

export interface PlayBlockerCommand {
  kind: 'play-blocker'
  playerId: PlayerId
  sourceInstanceId: string
  paymentIds: string[]
}

export interface ResolveFlipCommand {
  kind: 'resolve-flip'
  playerId: PlayerId
  activate: boolean
  discardHandIds?: string[]
}

export interface ResolveAttackEffectCommand {
  kind: 'resolve-attack-effect'
  playerId: PlayerId
  targetIds: string[]
}

export interface ResolveNextDamageCommand {
  kind: 'resolve-next-damage'
  playerId: PlayerId
}

export interface ResolveBattleCommand {
  kind: 'resolve-battle'
  playerId: PlayerId
}

export type PlayerActionCommand =
  | KeepOpeningHandCommand
  | MulliganOpeningHandCommand
  | ForceMulliganOpeningHandCommand
  | DrawMulliganCompensationCommand
  | SelectStartingCookieCommand
  | AdvancePhaseCommand
  | PlaceSupportCommand
  | DeployCookieCommand
  | AttackCommand
  | DeclareAttackCommand
  | ActivateSkillCommand
  | BeginActivateSkillCommand
  | SkipOnPlayCommand
  | PlayItemCommand
  | BeginPlayItemCommand
  | PlayStageCommand
  | ActivateStageCommand
  | BeginActivateStageCommand
  | ResolveAbilityEffectCommand
  | ResolveChooseOneCommand
  | ReplaceCookieCommand
  | SkipReplacementCommand
  | RefreshDeckCommand
  | PlayTrapCommand
  | SkipTrapCommand
  | PlayBlockerCommand
  | ResolveFlipCommand
  | ResolveAttackEffectCommand
  | ResolveNextDamageCommand
  | ResolveBattleCommand

export type GameCommand = PendingDecisionCommand | PlayerActionCommand

export interface ApplyGameCommandOptions {
  /**
   * 洗牌來源。重播時必須傳入與原對局相同種子的
   * createSeededShuffle，否則調度／Refresh 的牌序不會一致。
   */
  shuffle?: Shuffle
}

const isEffectOrderItemActive = (
  state: GameState,
  item: PendingEffectOrderItem,
): boolean => {
  if (item.kind === 'faint-effect') {
    return Boolean(
      state.pendingFaintEffects?.some(
        (pending) => pending.sourceInstanceId === item.sourceInstanceId,
      ) ||
        state.pendingInspectDeck?.sourceInstanceId === item.sourceInstanceId ||
        state.pendingDrawUpTo?.sourceInstanceId === item.sourceInstanceId ||
        state.pendingStageTrigger?.sourceInstanceId === item.sourceInstanceId ||
        state.pendingOpponentHandDiscard?.sourceInstanceId === item.sourceInstanceId,
    )
  }
  if (item.kind === 'after-damage-effect') {
    return Boolean(
      state.pendingAfterDamageEffects?.some(
        (pending) => pending.sourceInstanceId === item.sourceInstanceId,
      ) ||
        state.pendingInspectDeck?.sourceInstanceId === item.sourceInstanceId ||
        state.pendingDrawUpTo?.sourceInstanceId === item.sourceInstanceId ||
        state.pendingStageTrigger?.sourceInstanceId === item.sourceInstanceId,
    )
  }
  if (item.kind === 'draw-up-to') {
    return (
      state.pendingDrawUpTo?.sourceInstanceId === item.sourceInstanceId ||
      state.pendingOpponentHandDiscard?.sourceInstanceId === item.sourceInstanceId
    )
  }
  if (item.kind === 'inspect-deck') {
    return state.pendingInspectDeck?.sourceInstanceId === item.sourceInstanceId
  }
  if (item.kind === 'stage-trigger') {
    return state.pendingStageTrigger?.sourceInstanceId === item.sourceInstanceId
  }
  return false
}

const getOrderedEffectItem = (
  state: GameState,
): PendingEffectOrderItem | null => {
  const order = state.pendingEffectOrder
  if (!order?.resolvedOrder) return null

  for (const id of order.resolvedOrder) {
    const item = order.items.find((candidate) => candidate.id === id)
    if (item && isEffectOrderItemActive(state, item)) {
      return item
    }
  }

  return null
}

const isAllowedByEffectOrder = (
  orderedItem: PendingEffectOrderItem | null,
  kind: PendingEffectOrderItem['kind'],
  sourceInstanceId: string,
): boolean =>
  !orderedItem ||
  orderedItem.kind === kind ||
  (
    (orderedItem.kind === 'after-damage-effect' ||
      orderedItem.kind === 'faint-effect') &&
    orderedItem.sourceInstanceId === sourceInstanceId
  )

export const getPendingDecision = (
  state: GameState,
): PendingDecision | null => {
  if (state.status !== 'playing') {
    return null
  }

  if (state.pendingEffectOrder && !state.pendingEffectOrder.resolvedOrder) {
    return {
      kind: 'effect-order',
      playerId: state.pendingEffectOrder.playerId,
      sourcePlayerId: state.pendingEffectOrder.playerId,
      sourceInstanceId: state.pendingEffectOrder.items[0]?.sourceInstanceId ?? '',
      items: state.pendingEffectOrder.items,
    }
  }

  const orderedItem = getOrderedEffectItem(state)

  if (
    state.pendingFaintEffects &&
    state.pendingFaintEffects.length > 0 &&
    isAllowedByEffectOrder(
      orderedItem,
      'faint-effect',
      state.pendingFaintEffects[0].sourceInstanceId,
    )
  ) {
    const faint = state.pendingFaintEffects[0]
    const { min, max } = getFaintEffectMinMax(faint.effect)
    return {
      kind: 'faint-effect',
      playerId: faint.sourcePlayerId,
      sourcePlayerId: faint.sourcePlayerId,
      sourceInstanceId: faint.sourceInstanceId,
      min,
      max,
    }
  }

  if (
    state.pendingAfterDamageEffects &&
    state.pendingAfterDamageEffects.length > 0 &&
    isAllowedByEffectOrder(
      orderedItem,
      'after-damage-effect',
      state.pendingAfterDamageEffects[0].sourceInstanceId,
    )
  ) {
    const pending = state.pendingAfterDamageEffects[0]
    const { min, max } = getAfterDamageEffectMinMax(pending.effect)
    return {
      kind: 'after-damage-effect',
      playerId: pending.sourcePlayerId,
      sourcePlayerId: pending.sourcePlayerId,
      sourceInstanceId: pending.sourceInstanceId,
      min,
      max,
    }
  }

  if (state.pendingOpponentHandDiscard) {
    const pending = state.pendingOpponentHandDiscard
    return {
      kind: 'opponent-hand-discard',
      playerId: pending.playerId,
      sourcePlayerId: pending.sourcePlayerId,
      sourceInstanceId: pending.sourceInstanceId,
      sourceCardName: pending.sourceCardName,
      effectText: pending.effectText,
      count: pending.count,
    }
  }

  if (
    state.pendingInspectDeck &&
    !state.pendingRefresh &&
    isAllowedByEffectOrder(
      orderedItem,
      'inspect-deck',
      state.pendingInspectDeck.sourceInstanceId,
    )
  ) {
    const pending = state.pendingInspectDeck
    return {
      kind: 'inspect-deck',
      playerId: pending.playerId,
      sourcePlayerId: pending.playerId,
      sourceInstanceId: pending.sourceInstanceId,
      sourceCardName: pending.sourceCardName,
      lookCount: pending.lookCount,
      pickCount: pending.pickCount,
      revealedCardIds: pending.revealedCards.map((c) => c.instanceId),
      restDestination: pending.restDestination,
      pickDestination: pending.pickDestination,
      filterColor: pending.filterColor,
      filterType: pending.filterType,
      optionalPick: pending.optionalPick,
    }
  }

  if (state.pendingRevealTopDeck) {
    const pending = state.pendingRevealTopDeck
    return {
      kind: 'reveal-top-deck',
      playerId: pending.playerId,
      sourcePlayerId: pending.playerId,
      sourceInstanceId: pending.sourceInstanceId,
      sourceCardName: pending.sourceCardName,
      revealedCardId: pending.revealedCard.instanceId,
      matched: pending.matched,
    }
  }

  if (state.pendingOptionalCostAttack) {
    const pending = state.pendingOptionalCostAttack
    return {
      kind: 'optional-cost-attack',
      playerId: pending.playerId,
      sourcePlayerId: pending.playerId,
      sourceInstanceId: pending.sourceInstanceId,
      sourceCardName: pending.sourceCardName,
      cost: pending.cost,
      effects: pending.effects,
      effectText: pending.effectText,
      sourceEnergy: pending.sourceEnergy,
    }
  }

  if (
    state.pendingDrawUpTo &&
    !state.pendingRefresh &&
    isAllowedByEffectOrder(
      orderedItem,
      'draw-up-to',
      state.pendingDrawUpTo.sourceInstanceId,
    )
  ) {
    const pending = state.pendingDrawUpTo
    return {
      kind: 'draw-up-to',
      playerId: pending.playerId,
      sourcePlayerId: pending.sourcePlayerId,
      sourceInstanceId: pending.sourceInstanceId,
      sourceCardName: pending.sourceCardName,
      max: pending.max,
    }
  }

  if (
    state.pendingStageTrigger &&
    isAllowedByEffectOrder(
      orderedItem,
      'stage-trigger',
      state.pendingStageTrigger.sourceInstanceId,
    )
  ) {
    const pending = state.pendingStageTrigger
    return {
      kind: 'stage-trigger',
      playerId: pending.playerId,
      sourcePlayerId: pending.playerId,
      sourceInstanceId: pending.sourceInstanceId,
      sourceCardName: pending.sourceCardName,
      effectText: pending.effectText,
    }
  }

  return null
}

const cmdToDecisionKind: Record<string, string> = {
  'resolve-faint-effect': 'faint-effect',
  'resolve-opponent-hand-discard': 'opponent-hand-discard',
  'resolve-inspect-deck': 'inspect-deck',
  'resolve-reveal-top-deck': 'reveal-top-deck',
  'resolve-optional-cost-attack': 'optional-cost-attack',
  'resolve-draw-up-to': 'draw-up-to',
  'resolve-stage-trigger': 'stage-trigger',
  'resolve-after-damage-effect': 'after-damage-effect',
  'resolve-effect-order': 'effect-order',
}

const isPendingDecisionCommand = (
  command: GameCommand,
): command is PendingDecisionCommand => command.kind in cmdToDecisionKind

/**
 * 待處理決策結算完之後，把欠戰鬥流程的那一步補上。
 *
 * 「還有 pendingBattle 就代表戰鬥在等我收尾」這個假設是錯的：陷阱裡的
 * reveal-top-deck（BS3-093）結算時戰鬥根本還沒打到傷害，收尾會讓整次攻擊的
 * 傷害消失。要做什麼一律由建立決策的地方標記在 `battleContinuation` 上。
 */
const continueBattleAfterPending = (
  state: GameState,
  continuation: BattleContinuation | undefined,
): GameState => {
  if (!continuation || !state.pendingBattle) return state
  return continuation === 'finish'
    ? finishBattle(state)
    : advanceBattleAfterTrap(state)
}

export const appendCommandLogEntry = (
  previous: GameState,
  next: GameState,
  command: GameCommand,
): GameState => {
  const log = next.commandLog ?? []
  const previousEntry = log[log.length - 1]
  const id = log.length + 1
  // 同一個因果鏈（陷阱回應、技能/道具/場景效果的逐步驟解析……）在引擎眼中就是
  // 「上一個指令結束時還卡著待決定事項」；用跟 applyGameCommand 本身一樣的
  // hasBlockingPending 判斷，而不是自己再猜一套「相鄰、同一來源卡」的heuristic。
  const groupId =
    previousEntry && hasBlockingPending(previous) ? previousEntry.groupId : id
  const entry: CommandLogEntry = {
    id,
    turnNumber: previous.turnNumber,
    phase: previous.phase,
    playerId: command.playerId,
    commandKind: command.kind,
    payload: { ...command },
    summary: describeCommand(previous, next, command),
    groupId,
    category: resolveLogCategory(previous, next, command),
    steps: describeCommandSteps(previous, next, command),
    breakLevel: {
      'player-one': getBreakAreaLevel(next, 'player-one'),
      'player-two': getBreakAreaLevel(next, 'player-two'),
    },
  }
  return { ...next, commandLog: [...log, entry] }
}

export const applyGameCommand = (
  state: GameState,
  command: GameCommand,
  options: ApplyGameCommandOptions = {},
): GameState => {
  const next = isPendingDecisionCommand(command)
    ? applyPendingDecisionCommand(state, command, options)
    : applyPlayerActionCommand(state, command, options)
  // Keep replacement scheduling inside the command boundary so replaying the
  // same command log produces the same pending decisions as the live match.
  // A multi-step effect must finish before replacement or break-level victory
  // can be finalized.
  const finalized = next.status === 'playing' && !hasBlockingPending(next)
    ? finalizePendingReplacements(next)
    : next
  return appendCommandLogEntry(state, finalized, command)
}

const applyPendingDecisionCommand = (
  state: GameState,
  command: PendingDecisionCommand,
  options: ApplyGameCommandOptions = {},
): GameState => {
  const decision = getPendingDecision(state)

  if (!decision) {
    throw new GameRuleError('目前沒有待處理的決策。')
  }

  if (decision.kind !== cmdToDecisionKind[command.kind]) {
    throw new GameRuleError('指令種類與目前待處理的決策不相符。')
  }

  if (decision.playerId !== command.playerId) {
    throw new GameRuleError('不是目前需要執行決策的玩家。')
  }

  switch (command.kind) {
    case 'resolve-effect-order': {
      const pending = state.pendingEffectOrder
      if (!pending || pending.playerId !== command.playerId) {
        throw new GameRuleError('Invalid effect order decision.')
      }

      const expectedIds = pending.items.map((item) => item.id).sort()
      const orderedIds = [...command.orderedIds]
      const uniqueIds = [...new Set(orderedIds)]
      if (
        uniqueIds.length !== orderedIds.length ||
        orderedIds.length !== expectedIds.length ||
        uniqueIds.sort().join('|') !== expectedIds.join('|')
      ) {
        throw new GameRuleError('Invalid effect order decision.')
      }

      return {
        ...state,
        pendingEffectOrder: {
          ...pending,
          resolvedOrder: orderedIds,
        },
      }
    }
    case 'resolve-faint-effect':
      return resolveFaintEffect(state, command.targetIds, command.paymentIds ?? [])
    case 'resolve-opponent-hand-discard':
      return resolveOpponentHandDiscard(state, command.playerId, command.cardIds)
    case 'resolve-inspect-deck':
      return resolveInspectDeck(state, command.playerId, command.pickedCardIds, command.restOrder)
    case 'resolve-reveal-top-deck': {
      const pending = state.pendingRevealTopDeck
      if (!pending || pending.playerId !== command.playerId) {
        throw new GameRuleError('目前沒有待處理的翻牌展示效果。')
      }
      const context: EffectContext = {
        sourcePlayerId: pending.playerId,
        sourceInstanceId: pending.sourceInstanceId,
        sourceCardName: pending.sourceCardName,
      }
      const nextState: GameState = { ...state, pendingRevealTopDeck: null }
      const continueBattle = (candidate: GameState): GameState =>
        continueBattleAfterPending(candidate, pending.battleContinuation)
      if (!pending.matched || pending.nestedEffects.length === 0) {
        return continueBattle(nextState)
      }
      // 巢狀效果可能在傷害結算後就失去合法目標——BS3-076 的追加傷害鎖定
      // attackTargetOnly，攻擊對象若已被普通攻擊打到昏厥離場就一個候選都沒有。
      // 這種效果必須直接略過，否則 UI 會開出一個「已選 0／1、確認鍵永遠灰掉」
      // 的死結，玩家既不能確認也不能取消。判斷條件與 battle.ts 的
      // resolveAttackEffect 一致。
      const applicableEffects = pending.nestedEffects.filter(
        (effect) =>
          isEffectConditionMet(nextState, context, effect) &&
          hasRequiredEffectTargets(nextState, context, effect),
      )
      if (applicableEffects.length === 0) {
        return continueBattle(nextState)
      }
      // 若嵌套效果需要目標選擇，暫存在 pendingAbilityEffect 讓 UI/AI 逐步處理。
      // pendingBattle 保留，讓 attackTargetOnly 能找到攻擊目標；欠著的戰鬥動作由
      // battleContinuation 一起傳下去，結算完才由 resolvePendingAbilityEffect
      // 接手。
      const needsTargeting = applicableEffects.some(requiresEffectCardSelection)
      if (needsTargeting) {
        return {
          ...nextState,
          pendingAbilityEffect: {
            playerId: pending.playerId,
            sourcePlayerId: pending.playerId,
            sourceInstanceId: pending.sourceInstanceId,
            sourceCardName: pending.sourceCardName,
            sourceKind: 'item',
            effects: applicableEffects,
            effectIndex: 0,
            battleContinuation: pending.battleContinuation,
          },
        }
      }
      // 不需目標選擇的效果直接執行。
      let resolved = nextState
      for (const nestedEffect of applicableEffects) {
        if (resolved.status !== 'playing') break
        resolved = executeCardEffect(
          resolved,
          context,
          nestedEffect,
          command.targetIds ?? [],
          options.shuffle,
        )
      }
      return continueBattle(resolved)
    }
    case 'resolve-optional-cost-attack':
      return resolveOptionalCostAttack(
        state, command.playerId, command.action,
        command.discardCardIds ?? [], command.targetIds ?? [],
        command.paymentIds ?? [],
      )
    case 'resolve-draw-up-to':
      return resolveDrawUpTo(state, command.playerId, command.drawCount)
    case 'resolve-stage-trigger': {
      const pending = state.pendingStageTrigger
      if (!pending) throw new GameRuleError('沒有待處理的場景觸發。')
      if (pending.playerId !== command.playerId) {
        throw new GameRuleError('不是目前需要執行場景觸發的玩家。')
      }
      if (command.action === 'skip') {
        return { ...state, pendingStageTrigger: null }
      }

      if (pending.sourceKind === 'cookie-skill') {
        const playerId = pending.playerId
        const player = state.players[playerId]
        const source = player.battleArea.find(
          (cookie) => cookie.card.instanceId === pending.sourceInstanceId,
        )
        const skill = source?.card.skill
        if (
          !source ||
          !skill ||
          skill.trigger !== 'passive' ||
          (skill.yourTurn && state.activePlayerId !== playerId) ||
          (skill.restSource && source.rested) ||
          (skill.oncePerTurn &&
            state.skillUsesThisTurn.includes(getSkillUseKey(source)))
        ) {
          throw new GameRuleError('被動餅乾技能已不再符合發動條件。')
        }

        const context: EffectContext = {
          sourcePlayerId: playerId,
          sourceInstanceId: source.card.instanceId,
          sourceCardName: source.card.name,
        }
        const effects = (pending.effects ?? skill.effects).filter((effect) =>
          isEffectConditionMet(state, context, effect),
        )
        if (effects.length === 0) {
          return { ...state, pendingStageTrigger: null }
        }

        const activatedState: GameState = {
          ...state,
          pendingStageTrigger: null,
          skillUsesThisTurn: skill.oncePerTurn
            ? [...state.skillUsesThisTurn, getSkillUseKey(source)]
            : state.skillUsesThisTurn,
        }
        if (effects.some(requiresEffectCardSelection)) {
          return {
            ...activatedState,
            pendingAbilityEffect: {
              playerId,
              sourcePlayerId: playerId,
              sourceInstanceId: source.card.instanceId,
              sourceCardName: source.card.name,
              sourceKind: 'skill',
              effects,
              effectIndex: 0,
            },
          }
        }

        return effects.reduce(
          (nextState, effect) =>
            nextState.status === 'playing'
              ? executeCardEffect(nextState, context, effect, [])
              : nextState,
          activatedState,
        )
      }

      const playerId = pending.playerId
      const player = state.players[playerId]
      const stage = player.stage
      const ability = stage?.card.stageAbility
      if (
        !stage ||
        stage.card.instanceId !== pending.sourceInstanceId ||
        !ability?.triggered
      ) {
        throw new GameRuleError('觸發來源場景已不存在或不相符。')
      }

      let nextState: GameState = {
        ...state,
        pendingStageTrigger: null,
        players: {
          ...state.players,
          [playerId]: {
            ...player,
            stage: {
              ...stage,
              rested: ability.restSource ? true : stage.rested,
            },
          },
        },
      }
      const context = {
        sourcePlayerId: playerId,
        sourceInstanceId: stage.card.instanceId,
      }
      for (const effect of ability.effects) {
        nextState = executeCardEffect(nextState, context, effect, [])
      }
      return nextState
    }
    case 'resolve-after-damage-effect':
      return resolveNextAfterDamageEffect(state, command.targetIds)
  }
}

const requireActivePlayer = (state: GameState, playerId: PlayerId) => {
  if (state.activePlayerId !== playerId) {
    throw new GameRuleError('不是目前的回合玩家。')
  }
}

const assertNoPendingDecision = (
  state: GameState,
  command: PlayerActionCommand,
) => {
  const pending = getPendingDecision(state)
  if (!pending) return

  // 補位／略過補位優先於昏厥效果與效果順序（與 getActingPlayerId 一致）。
  // 規則：餅乾昏厥後先補位，再處理昏厥效果（見 replacement.ts continuePendingReplacements）。
  // 若此處把待處理的昏厥效果視為阻塞，UI 會顯示補位視窗但引擎拒絕補位指令，
  // 造成「無法補位」的死結（尤其在對方回合我方餅乾被打死時）。
  if (
    (command.kind === 'replace-cookie' ||
      command.kind === 'skip-replacement') &&
    (pending.kind === 'faint-effect' || pending.kind === 'effect-order') &&
    getCurrentReplacementTask(state)?.playerId === command.playerId
  ) {
    return
  }

  // 牌庫 Renew（refresh-deck）優先於昏厥效果與效果順序：
  // 補位餅乾登場可能使牌庫用盡而觸發 pendingRefresh；若此時不允許執行
  // refresh-deck，AI 會因為 pendingRefresh 擋住昏厥效果處理、而昏厥效果
  // 又擋住 refresh-deck 指令，形成無法推進的死結。
  if (
    command.kind === 'refresh-deck' &&
    (pending.kind === 'faint-effect' || pending.kind === 'effect-order') &&
    state.pendingRefresh?.playerId === command.playerId
  ) {
    return
  }

  // 補位帶出的新餅乾登場效果（OnPlay）同樣優先於昏厥效果與效果順序：
  // 補位卡的 OnPlay 必須在原本昏厥效果解決前就能發動或略過，否則會與
  // 上方補位放行邏輯銜接不上，造成「補完位但無法處理 OnPlay」的死結。
  if (
    command.kind === 'skip-on-play' &&
    (pending.kind === 'faint-effect' || pending.kind === 'effect-order') &&
    state.pendingOnPlay?.playerId === command.playerId &&
    state.pendingOnPlay.sourceInstanceId === command.sourceInstanceId
  ) {
    return
  }
  if (
    (command.kind === 'activate-skill' ||
      command.kind === 'begin-activate-skill') &&
    command.trigger === 'on-play' &&
    (pending.kind === 'faint-effect' || pending.kind === 'effect-order') &&
    state.pendingOnPlay?.playerId === command.playerId &&
    state.pendingOnPlay.sourceInstanceId === command.sourceInstanceId
  ) {
    return
  }

  throw new GameRuleError('必須先處理待處理的決策。')
}

/**
 * 官方 Q&A（BS3-019）：靈魂果醬「Select…That Cookie receives damage. Then,
 * you can {mou} this card to your [Cookie]」這種寫法，裝載跟在選目標效果
 * 後面、依附於它——若選目標效果當場沒有任何合法候選，裝載也不執行（費用已付、
 * 卡已進棄牌區不回溯）。
 *
 * 這個中止**只**在下一個效果是 `equip-source` 時才成立，不能廣泛套用到「任一
 * 效果沒有合法目標就中止整條鏈」——多數卡牌的後續效果彼此獨立（例如
 * BS3-081「對手 0～1 傷害，然後把來源自己送回牌庫頂」），對手戰鬥區剛好淨空
 * 只代表傷害沒有目標可選，不代表後面自身效果也不該執行；BS3-089／097 也是
 * 同樣的形狀。曾經廣泛套用過一次並造成這三張的回歸，靠 bs3-then-effects.test.ts
 * 的新增案例抓到。
 */
const hasNoLegalSelectableTargets = (
  state: GameState,
  context: EffectContext,
  effects: readonly CardEffect[],
  effectIndex: number,
): boolean => {
  if (effects[effectIndex + 1]?.kind !== 'equip-source') return false
  const effect = effects[effectIndex]
  return (
    requiresTargetSelection(effect) &&
    getEffectTargetCandidatesForEffect(state, context, effect).length === 0
  )
}

/**
 * 當下一個效果是 equip-source，但 requiredCookieId 不在戰鬥區時，
 * 該裝載效果沒有合法目標，應自動跳過（不需要顯示 UI 讓玩家取消）。
 */
const hasNoEquipTarget = (
  state: GameState,
  context: EffectContext,
  effects: readonly CardEffect[],
  effectIndex: number,
): boolean => {
  const next = effects[effectIndex + 1]
  if (!next || next.kind !== 'equip-source') return false
  const player = state.players[context.sourcePlayerId]
  return !player.battleArea.some((c) => c.card.id === next.requiredCookieId)
}

const executeAbilityEffects = (
  state: GameState,
  context: EffectContext,
  effects: readonly CardEffect[],
  effectTargets: string[][] | undefined,
  shuffle?: Shuffle,
  chooseOneModes?: number[],
): GameState => {
  let nextState = state
  // 迴圈骨架必須與 ai/ability-effects.ts 的 simulateAbilityEffects 一致，
  // 包含「選擇一項」的就地展開，否則 effectTargets 的索引會對不上。
  let queue: CardEffect[] = [...effects]
  let modeCursor = 0
  for (let index = 0; index < queue.length; index += 1) {
    if (nextState.status !== 'playing') break
    const effect = queue[index]
    if (asChooseOneEffect(effect)) {
      queue = expandChooseOne(queue, index, chooseOneModes?.[modeCursor] ?? 0)
      modeCursor += 1
      index -= 1
      continue
    }
    if (!isEffectConditionMet(nextState, context, effect)) continue
    if (hasNoLegalSelectableTargets(nextState, context, queue, index)) break
    nextState = executeCardEffect(
      nextState,
      context,
      effect,
      effectTargets?.[index] ?? [],
      shuffle,
    )
    if (nextState.pendingRefresh || nextState.pendingOnPlay) break
    if (hasNoEquipTarget(nextState, context, queue, index)) {
      index += 1
    }
  }
  return nextState
}

/**
 * 與互動精靈（usePendingEffect.ts 的 beginCookieSkill/beginCardAbility）語意一致：
 * 條件只在啟動當下過濾一次，之後逐步解析不再重新檢查（效果順序中若前一步改變盤面，
 * 後續步驟仍照原本判定結果執行，不會臨時跳過或補上）。
 */
const filterActiveEffects = (
  state: GameState,
  context: EffectContext,
  effects: readonly CardEffect[],
): CardEffect[] =>
  effects.filter((effect) => isEffectConditionMet(state, context, effect))

const resolvePendingAbilityEffect = (
  state: GameState,
  playerId: PlayerId,
  targetIds: string[],
  options: ApplyGameCommandOptions,
): GameState => {
  const pending = state.pendingAbilityEffect
  if (!pending) {
    throw new GameRuleError('目前沒有待處理的效果。')
  }
  if (pending.playerId !== playerId) {
    throw new GameRuleError('不是目前需要選擇效果目標的玩家。')
  }
  if (
    state.pendingRefresh ||
    state.pendingOnPlay ||
    state.pendingReplacement
  ) {
    throw new GameRuleError('必須先處理其他待處理的決策。')
  }
  const context: EffectContext = {
    sourcePlayerId: pending.sourcePlayerId,
    sourceInstanceId: pending.sourceInstanceId,
    sourceCardName: pending.sourceCardName,
  }
  const continueBattle = (candidate: GameState): GameState =>
    continueBattleAfterPending(candidate, pending.battleContinuation)
  const effect = pending.effects[pending.effectIndex]
  if (!isEffectConditionMet(state, context, effect)) {
    const nextIndex = pending.effectIndex + 1
    return nextIndex >= pending.effects.length
      ? continueBattle({ ...state, pendingAbilityEffect: undefined })
      : {
          ...state,
          pendingAbilityEffect: { ...pending, effectIndex: nextIndex },
        }
  }
  // 官方 Q&A（BS3-019）：無合法目標時，緊接在後的裝載一併中止（見上方函式註解）。
  if (hasNoLegalSelectableTargets(state, context, pending.effects, pending.effectIndex)) {
    return continueBattle({ ...state, pendingAbilityEffect: undefined })
  }
  const resolved = executeCardEffect(
    state,
    context,
    effect,
    targetIds,
    options.shuffle,
  )
  const nextIndex = pending.effectIndex + 1
  if (resolved.status !== 'playing' || nextIndex >= pending.effects.length) {
    return continueBattle({ ...resolved, pendingAbilityEffect: undefined })
  }
  if (hasNoEquipTarget(resolved, context, pending.effects, pending.effectIndex)) {
    return continueBattle({ ...resolved, pendingAbilityEffect: undefined })
  }
  return {
    ...resolved,
    pendingAbilityEffect: { ...pending, effectIndex: nextIndex },
  }
}

const hasBlockingAbilityDecision = (state: GameState) =>
  Boolean(
    state.pendingRefresh ||
      state.pendingOnPlay ||
      state.pendingReplacement ||
      state.pendingBattle,
  )

const applyPlayerActionCommand = (
  state: GameState,
  command: PlayerActionCommand,
  options: ApplyGameCommandOptions,
): GameState => {
  assertNoPendingDecision(state, command)

  switch (command.kind) {
    case 'keep-opening-hand':
      return keepOpeningHand(state, command.playerId)
    case 'mulligan-opening-hand':
      return mulliganOpeningHand(state, command.playerId, options.shuffle)
    case 'force-mulligan-opening-hand':
      return forceMulliganOpeningHand(state, command.playerId, options.shuffle)
    case 'draw-mulligan-compensation':
      return drawMulliganCompensation(state, command.playerId)
    case 'select-starting-cookie':
      return selectStartingCookie(state, command.playerId, command.instanceId)
    case 'advance-phase':
      requireActivePlayer(state, command.playerId)
      return advancePhase(state)
    case 'place-support':
      requireActivePlayer(state, command.playerId)
      return placeSupportCard(state, command.instanceId)
    case 'deploy-cookie':
      requireActivePlayer(state, command.playerId)
      return deployCookie(state, command.instanceId)
    case 'attack':
      requireActivePlayer(state, command.playerId)
      return attackCookie(
        state,
        command.attackerInstanceId,
        command.targetInstanceId,
        command.supportPaymentIds,
      )
    case 'declare-attack':
      requireActivePlayer(state, command.playerId)
      return beginAttack(
        state,
        command.attackerInstanceId,
        command.targetInstanceId,
        command.supportPaymentIds,
      )
    case 'activate-skill': {
      const source = findSkillSource(
        state.players[command.playerId],
        command.sourceInstanceId,
      )
      const skill = source?.card.skill
      const activated = activateCookieSkill(
        state,
        command.playerId,
        command.sourceInstanceId,
        command.trigger,
        command.paymentIds,
        command.costSupportToTrashIds ?? [],
        command.discardHandIds ?? [],
        command.trashBattleCookieIds ?? [],
        command.trashToDeckBottomIds ?? [],
        command.trashToDeckIds ?? [],
        options.shuffle,
      )
      const context: EffectContext = {
        sourcePlayerId: command.playerId,
        sourceInstanceId: command.sourceInstanceId,
        sourceCardName: source?.card.name,
      }
      return executeAbilityEffects(
        activated,
        context,
        skill?.effects ?? [],
        command.effectTargets,
        options.shuffle,
        command.chooseOneModes,
      )
    }
    case 'begin-activate-skill': {
      const source = findSkillSource(
        state.players[command.playerId],
        command.sourceInstanceId,
      )
      const skill = source?.card.skill
      const activated = activateCookieSkill(
        state,
        command.playerId,
        command.sourceInstanceId,
        command.trigger,
        command.paymentIds,
        command.costSupportToTrashIds ?? [],
        command.discardHandIds ?? [],
        command.trashBattleCookieIds ?? [],
        command.trashToDeckBottomIds ?? [],
        command.trashToDeckIds ?? [],
        options.shuffle,
      )
      const context: EffectContext = {
        sourcePlayerId: command.playerId,
        sourceInstanceId: command.sourceInstanceId,
        sourceCardName: source?.card.name,
      }
      const effects = expandChooseOneSequence(
        filterActiveEffects(activated, context, skill?.effects ?? []),
        command.chooseOneModes,
      )
      if (activated.status !== 'playing' || effects.length === 0) {
        return activated
      }
      const pendingState: GameState = {
        ...activated,
        pendingAbilityEffect: {
          playerId: command.playerId,
          sourcePlayerId: command.playerId,
          sourceInstanceId: command.sourceInstanceId,
          sourceCardName: source?.card.name,
          sourceKind: 'skill',
          trigger: command.trigger,
          effects,
          effectIndex: 0,
        },
      }
      return command.targetIds === undefined || hasBlockingAbilityDecision(pendingState)
        ? pendingState
        : resolvePendingAbilityEffect(
            pendingState,
            command.playerId,
            command.targetIds,
            options,
          )
    }
    case 'skip-on-play':
      return skipCookieOnPlay(state, command.playerId, command.sourceInstanceId)
    case 'play-item': {
      const card = state.players[command.playerId].hand.find(
        (handCard) => handCard.instanceId === command.instanceId,
      )
      const played = playItem(
        state,
        command.playerId,
        command.instanceId,
        command.paymentIds,
        command.supportToTrashIds ?? [],
        command.supportToHandIds ?? [],
        command.discardHandIds ?? [],
        command.hpToTrashTargetIds ?? [],
        command.trashBattleCookieIds ?? [],
      )
      const context: EffectContext = {
        sourcePlayerId: command.playerId,
        sourceInstanceId: command.instanceId,
        sourceCardName: card?.name,
      }
      return executeAbilityEffects(
        played,
        context,
        card?.item?.effects ?? [],
        command.effectTargets,
        options.shuffle,
        command.chooseOneModes,
      )
    }
    case 'begin-play-item': {
      const card = state.players[command.playerId].hand.find(
        (handCard) => handCard.instanceId === command.instanceId,
      )
      const played = playItem(
        state,
        command.playerId,
        command.instanceId,
        command.paymentIds,
        command.supportToTrashIds ?? [],
        command.supportToHandIds ?? [],
        command.discardHandIds ?? [],
        command.hpToTrashTargetIds ?? [],
        command.trashBattleCookieIds ?? [],
      )
      const context: EffectContext = {
        sourcePlayerId: command.playerId,
        sourceInstanceId: command.instanceId,
        sourceCardName: card?.name,
      }
      const effects = expandChooseOneSequence(
        filterActiveEffects(played, context, card?.item?.effects ?? []),
        command.chooseOneModes,
      )
      if (played.status !== 'playing' || effects.length === 0) {
        return played
      }
      const pendingState: GameState = {
        ...played,
        pendingAbilityEffect: {
          playerId: command.playerId,
          sourcePlayerId: command.playerId,
          sourceInstanceId: command.instanceId,
          sourceCardName: card?.name,
          sourceKind: 'item',
          effects,
          effectIndex: 0,
        },
      }
      return command.targetIds === undefined || hasBlockingAbilityDecision(pendingState)
        ? pendingState
        : resolvePendingAbilityEffect(
            pendingState,
            command.playerId,
            command.targetIds,
            options,
          )
    }
    case 'play-stage':
      return playStage(
        state,
        command.playerId,
        command.instanceId,
        command.paymentIds,
      )
    case 'activate-stage': {
      const stage = state.players[command.playerId].stage
      const activated = activateStage(
        state,
        command.playerId,
        command.paymentIds,
        command.supportToTrashIds ?? [],
        command.supportToHandIds ?? [],
        command.discardHandIds ?? [],
        command.hpToTrashTargetIds ?? [],
        command.trashBattleCookieIds ?? [],
      )
      const context: EffectContext = {
        sourcePlayerId: command.playerId,
        sourceInstanceId: stage?.card.instanceId ?? '',
        sourceCardName: stage?.card.name,
      }
      return executeAbilityEffects(
        activated,
        context,
        stage?.card.stageAbility?.effects ?? [],
        command.effectTargets,
        options.shuffle,
        command.chooseOneModes,
      )
    }
    case 'begin-activate-stage': {
      const stage = state.players[command.playerId].stage
      const activated = activateStage(
        state,
        command.playerId,
        command.paymentIds,
        command.supportToTrashIds ?? [],
        command.supportToHandIds ?? [],
        command.discardHandIds ?? [],
        command.hpToTrashTargetIds ?? [],
        command.trashBattleCookieIds ?? [],
      )
      const context: EffectContext = {
        sourcePlayerId: command.playerId,
        sourceInstanceId: stage?.card.instanceId ?? '',
        sourceCardName: stage?.card.name,
      }
      const effects = expandChooseOneSequence(
        filterActiveEffects(
          activated,
          context,
          stage?.card.stageAbility?.effects ?? [],
        ),
        command.chooseOneModes,
      )
      if (activated.status !== 'playing' || effects.length === 0) {
        return activated
      }
      const pendingState: GameState = {
        ...activated,
        pendingAbilityEffect: {
          playerId: command.playerId,
          sourcePlayerId: command.playerId,
          sourceInstanceId: stage?.card.instanceId ?? '',
          sourceCardName: stage?.card.name,
          sourceKind: 'stage',
          effects,
          effectIndex: 0,
        },
      }
      return command.targetIds === undefined || hasBlockingAbilityDecision(pendingState)
        ? pendingState
        : resolvePendingAbilityEffect(
            pendingState,
            command.playerId,
            command.targetIds,
            options,
          )
    }
    case 'resolve-ability-effect': {
      return resolvePendingAbilityEffect(
        state,
        command.playerId,
        command.targetIds,
        options,
      )
    }
    case 'resolve-choose-one': {
      const pending = state.pendingAbilityEffect
      if (!pending) {
        throw new GameRuleError('目前沒有待處理的效果。')
      }
      if (pending.playerId !== command.playerId) {
        throw new GameRuleError('不是目前需要選擇項目的玩家。')
      }
      return {
        ...state,
        pendingAbilityEffect: {
          ...pending,
          effects: expandChooseOne(
            pending.effects,
            pending.effectIndex,
            command.modeIndex,
          ),
        },
      }
    }
    case 'replace-cookie': {
      const task = getCurrentReplacementTask(state)
      if (!task || task.playerId !== command.playerId) {
        throw new GameRuleError('不是目前需要補位的玩家。')
      }
      return replaceDefeatedCookie(state, command.instanceId)
    }
    case 'skip-replacement': {
      const task = getCurrentReplacementTask(state)
      if (!task || task.playerId !== command.playerId) {
        throw new GameRuleError('不是目前需要補位的玩家。')
      }
      return skipDefeatedCookieReplacement(state)
    }
    case 'refresh-deck': {
      const refreshShuffle =
        command.shuffleSeed === undefined
          ? options.shuffle
          : createSeededShuffle(command.shuffleSeed)
      return refreshDeck(
        state,
        command.playerId,
        command.cookieInstanceId,
        refreshShuffle,
      )
    }
    case 'play-trap':
      return playTrap(state, command.playerId, {
        trapInstanceId: command.trapInstanceId,
        paymentIds: command.paymentIds,
        targetIds: command.targetIds,
        supportTrashIds: command.supportTrashIds,
        supportToHandIds: command.supportToHandIds,
        handToSupportIds: command.handToSupportIds,
        discardHandIds: command.discardHandIds,
        handToBreakIds: command.handToBreakIds,
        trashBattleCookieIds: command.trashBattleCookieIds,
        trashToDeckIds: command.trashToDeckIds,
        selfTargetIds: command.selfTargetIds,
      })
    case 'skip-trap':
      return skipTrap(state, command.playerId)
    case 'play-blocker':
      return playBlocker(state, command.playerId, {
        sourceInstanceId: command.sourceInstanceId,
        paymentIds: command.paymentIds,
      })
    case 'resolve-flip':
      return resolveFlip(state, command.playerId, {
        activate: command.activate,
        discardHandIds: command.discardHandIds,
      })
    case 'resolve-attack-effect':
      return resolveAttackEffect(state, command.playerId, command.targetIds)
    case 'resolve-next-damage': {
      const battle = state.pendingBattle
      if (
        !battle ||
        (battle.damagePlayerId ?? battle.defenderPlayerId) !== command.playerId
      ) {
        throw new GameRuleError('不是目前需要結算傷害的玩家。')
      }
      return resolveNextDamage(state)
    }
    case 'resolve-battle': {
      const battle = state.pendingBattle
      if (
        !battle ||
        (battle.attackerPlayerId !== command.playerId &&
          battle.defenderPlayerId !== command.playerId)
      ) {
        throw new GameRuleError('目前沒有可自動結算的戰鬥。')
      }
      return resolveBattleAutomatically(state)
    }
  }
}
