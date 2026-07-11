import { GameRuleError } from './errors'
import {
  beginAttack,
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
  isEffectConditionMet,
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
import { advancePhase } from './turn'
import { activateCookieSkill, skipCookieOnPlay } from './skills'
import { activateStage, playItem, playStage } from './card-abilities'
import { refreshDeck } from './refresh'
import { finalizePendingReplacements, getCurrentReplacementTask } from './replacement'
import { hasBlockingPending } from './pending'
import { createSeededShuffle } from './helpers'
import { describeCommand } from './command-log'
import {
  drawMulliganCompensation,
  forceMulliganOpeningHand,
  keepOpeningHand,
  mulliganOpeningHand,
  selectStartingCookie,
} from './setup'
import type {
  AbilityCost,
  CardEffect,
  CommandLogEntry,
  EffectContext,
  EnergyColor,
  GameState,
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
  filterColor?: EnergyColor
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
  sourceAsEnergy?: boolean
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
  | OptionalCostAttackDecision
  | DrawUpToDecision
  | StageTriggerDecision
  | AfterDamageEffectDecision
  | EffectOrderDecision

export interface ResolveFaintEffectCommand {
  kind: 'resolve-faint-effect'
  playerId: PlayerId
  targetIds: string[]
}

export interface ResolveOpponentHandDiscardCommand {
  kind: 'resolve-opponent-hand-discard'
  playerId: PlayerId
  cardIds: string[]
}

export interface ResolveInspectDeckCommand {
  kind: 'resolve-inspect-deck'
  playerId: PlayerId
  pickedCardId: string | null
  restOrder: string[]
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
  effectTargets?: string[][]
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
  effectTargets?: string[][]
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
  effectTargets?: string[][]
}

export interface BeginActivateStageCommand {
  kind: 'begin-activate-stage'
  playerId: PlayerId
  paymentIds: string[]
  supportToTrashIds?: string[]
  supportToHandIds?: string[]
  discardHandIds?: string[]
  hpToTrashTargetIds?: string[]
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
  trashBattleCookieIds?: string[]
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
      filterColor: pending.filterColor,
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
      sourceAsEnergy: pending.sourceAsEnergy,
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
  'resolve-optional-cost-attack': 'optional-cost-attack',
  'resolve-draw-up-to': 'draw-up-to',
  'resolve-stage-trigger': 'stage-trigger',
  'resolve-after-damage-effect': 'after-damage-effect',
  'resolve-effect-order': 'effect-order',
}

const isPendingDecisionCommand = (
  command: GameCommand,
): command is PendingDecisionCommand => command.kind in cmdToDecisionKind

export const appendCommandLogEntry = (
  previous: GameState,
  next: GameState,
  command: GameCommand,
): GameState => {
  const log = next.commandLog ?? []
  const entry: CommandLogEntry = {
    id: log.length + 1,
    turnNumber: previous.turnNumber,
    phase: previous.phase,
    playerId: command.playerId,
    commandKind: command.kind,
    payload: { ...command },
    summary: describeCommand(previous, command),
  }
  return { ...next, commandLog: [...log, entry] }
}

export const applyGameCommand = (
  state: GameState,
  command: GameCommand,
  options: ApplyGameCommandOptions = {},
): GameState => {
  const next = isPendingDecisionCommand(command)
    ? applyPendingDecisionCommand(state, command)
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
      return resolveFaintEffect(state, command.targetIds)
    case 'resolve-opponent-hand-discard':
      return resolveOpponentHandDiscard(state, command.playerId, command.cardIds)
    case 'resolve-inspect-deck':
      return resolveInspectDeck(state, command.playerId, command.pickedCardId, command.restOrder)
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

const executeAbilityEffects = (
  state: GameState,
  context: EffectContext,
  effects: readonly CardEffect[],
  effectTargets: string[][] | undefined,
  shuffle?: Shuffle,
): GameState => {
  let nextState = state
  for (let index = 0; index < effects.length; index += 1) {
    if (nextState.status !== 'playing') break
    const effect = effects[index]
    if (!isEffectConditionMet(nextState, context, effect)) continue
    nextState = executeCardEffect(
      nextState,
      context,
      effect,
      effectTargets?.[index] ?? [],
      shuffle,
    )
    if (nextState.pendingRefresh || nextState.pendingOnPlay) break
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
      const source = state.players[command.playerId].battleArea.find(
        (cookie) => cookie.card.instanceId === command.sourceInstanceId,
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
      )
    }
    case 'begin-activate-skill': {
      const source = state.players[command.playerId].battleArea.find(
        (cookie) => cookie.card.instanceId === command.sourceInstanceId,
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
      )
      const context: EffectContext = {
        sourcePlayerId: command.playerId,
        sourceInstanceId: command.sourceInstanceId,
        sourceCardName: source?.card.name,
      }
      const effects = filterActiveEffects(activated, context, skill?.effects ?? [])
      if (activated.status !== 'playing' || effects.length === 0) {
        return activated
      }
      return {
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
      )
      const context: EffectContext = {
        sourcePlayerId: command.playerId,
        sourceInstanceId: command.instanceId,
        sourceCardName: card?.name,
      }
      const effects = filterActiveEffects(played, context, card?.item?.effects ?? [])
      if (played.status !== 'playing' || effects.length === 0) {
        return played
      }
      return {
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
      )
      const context: EffectContext = {
        sourcePlayerId: command.playerId,
        sourceInstanceId: stage?.card.instanceId ?? '',
        sourceCardName: stage?.card.name,
      }
      const effects = filterActiveEffects(
        activated,
        context,
        stage?.card.stageAbility?.effects ?? [],
      )
      if (activated.status !== 'playing' || effects.length === 0) {
        return activated
      }
      return {
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
    }
    case 'resolve-ability-effect': {
      const pending = state.pendingAbilityEffect
      if (!pending) {
        throw new GameRuleError('目前沒有待處理的效果。')
      }
      if (pending.playerId !== command.playerId) {
        throw new GameRuleError('不是目前需要選擇效果目標的玩家。')
      }
      if (
        state.pendingRefresh ||
        state.pendingOnPlay ||
        state.pendingReplacement ||
        state.pendingBattle
      ) {
        throw new GameRuleError('必須先處理其他待處理的決策。')
      }
      const context: EffectContext = {
        sourcePlayerId: pending.sourcePlayerId,
        sourceInstanceId: pending.sourceInstanceId,
        sourceCardName: pending.sourceCardName,
      }
      const effect = pending.effects[pending.effectIndex]
      const resolved = executeCardEffect(
        state,
        context,
        effect,
        command.targetIds,
        options.shuffle,
      )
      const nextIndex = pending.effectIndex + 1
      if (resolved.status !== 'playing' || nextIndex >= pending.effects.length) {
        return { ...resolved, pendingAbilityEffect: undefined }
      }
      return {
        ...resolved,
        pendingAbilityEffect: { ...pending, effectIndex: nextIndex },
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
        trashBattleCookieIds: command.trashBattleCookieIds,
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
