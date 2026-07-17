import type {
  GameCard,
  GameState,
  PlayerId,
  PendingBattleStage,
} from '../../game'
import { getAttackEnergyCost, getEnergyCostTotal } from '../../game'
import { phaseLabels } from '../gameUiLabels'
import { buildActionProgress } from './actionProgress'
import type {
  AttackSelectionPreview,
  PublicCardReference,
  PublicIntent,
  PublicIntentProgressStep,
  PublicResponseType,
  PublicTargetScope,
} from '../../net/onlineProtocol'

export type ActionStatusMode =
  | 'opponent-thinking'
  | 'awaiting-local-decision'
  | 'awaiting-opponent-decision'
  | 'resolving'
  | 'syncing'
  | 'reconnecting'

export interface ActionStatus {
  mode: ActionStatusMode
  actorId: PlayerId | null
  actorLabel: string
  phaseLabel: string
  headline: string
  detail?: string
  sourceCard?: PublicCardReference
  highlightedTargetInstanceIds?: string[]
  attackTargetInstanceIds?: string[]
  progress?: PublicIntentProgressStep[]
  expiresAt?: string
}

export interface ActionStatusLocalState {
  aiThinking?: boolean
  pendingEffect?: {
    sourceCard?: GameCard
    context?: { sourcePlayerId: PlayerId; sourceInstanceId: string }
  } | null
  pendingSourceCard?: GameCard | null
  selectedAttackerId?: string | null
  attackPaymentValid?: boolean
  connectionMode?: 'syncing' | 'reconnecting'
  connectionNotice?: string | null
}

export interface ActionStatusOptions {
  game: GameState
  viewerPlayerId: PlayerId
  publicIntent?: PublicIntent | null
  opponentAttackSelection?: AttackSelectionPreview | null
  local?: ActionStatusLocalState
}

const opponentOf = (playerId: PlayerId): PlayerId =>
  playerId === 'player-one' ? 'player-two' : 'player-one'

const cardReference = (
  card: GameCard | undefined,
  ownerId: PlayerId,
): PublicCardReference | undefined =>
  card
    ? {
        instanceId: card.instanceId,
        id: card.id,
        name: card.name,
        type: card.type,
        ownerId,
      }
    : undefined

const phaseLabelFor = (game: GameState): string => phaseLabels[game.phase]

const playerLabel = (game: GameState, playerId: PlayerId | null): string =>
  playerId ? game.players[playerId].name : '對戰'

const targetScopeLabel = (scope: PublicTargetScope): string => {
  switch (scope) {
    case 'opponent-battle-cookie':
      return '對手戰鬥區餅乾'
    case 'own-battle-cookie':
      return '我方戰鬥區餅乾'
    case 'support':
      return '支援區'
    case 'break':
      return 'Break 區'
    case 'discard':
      return '休息區'
    case 'hand':
      return '手牌'
    case 'deck':
      return '牌庫'
    case 'stage':
      return '場景區'
    case 'public-card':
      return '公開卡牌'
  }
}

const responseTypeLabel = (responseType: PublicResponseType): string => {
  switch (responseType) {
    case 'trap':
      return '陷阱／阻擋'
    case 'flip':
      return 'FLIP'
    case 'effect':
      return '攻擊效果'
  }
}

const cardInGame = (game: GameState, instanceId: string): GameCard | undefined => {
  for (const player of Object.values(game.players)) {
    const found = [
      ...player.hand,
      ...player.deck,
      ...player.breakArea,
      ...player.discardPile,
      ...player.battleArea.flatMap((entry) => [entry.card, ...entry.hpCards]),
      ...player.supportArea.map((entry) => entry.card),
      ...(player.stage ? [player.stage.card] : []),
    ].find((card) => card.instanceId === instanceId)
    if (found) return found
  }
  return undefined
}

const progressFor = (
  active: 'payment' | 'cost' | 'target' | 'response' | 'resolve',
  options?: { hasPayment?: boolean; hasCost?: boolean; hasTarget?: boolean },
): PublicIntentProgressStep[] =>
  buildActionProgress({
    active,
    hasPayment: options?.hasPayment,
    hasCost: options?.hasCost,
    hasTarget: options?.hasTarget,
  })

const pendingBattleActor = (
  game: GameState,
): { playerId: PlayerId; stage: PendingBattleStage } | null => {
  const battle = game.pendingBattle
  if (!battle) return null

  switch (battle.stage) {
    case 'trap':
      return { playerId: battle.defenderPlayerId, stage: battle.stage }
    case 'flip':
      return {
        playerId: battle.damagePlayerId ?? battle.defenderPlayerId,
        stage: battle.stage,
      }
    case 'attack-effect':
      return { playerId: battle.attackerPlayerId, stage: battle.stage }
    case 'damage':
      return { playerId: battle.defenderPlayerId, stage: battle.stage }
  }
}

const pendingActor = (game: GameState): PlayerId | null => {
  if (game.pendingAbilityEffect) return game.pendingAbilityEffect.playerId
  if (game.pendingOnPlay) return game.pendingOnPlay.playerId
  if (game.pendingOpponentHandDiscard) return game.pendingOpponentHandDiscard.playerId
  if (game.pendingInspectDeck) return game.pendingInspectDeck.playerId
  if (game.pendingOptionalCostAttack) return game.pendingOptionalCostAttack.playerId
  if (game.pendingDrawUpTo) return game.pendingDrawUpTo.playerId
  if (game.pendingEffectOrder && !game.pendingEffectOrder.resolvedOrder) {
    return game.pendingEffectOrder.playerId
  }
  if (game.pendingStageTrigger) return game.pendingStageTrigger.playerId
  if (game.pendingRefresh) return game.pendingRefresh.playerId
  if (game.pendingReplacement) return game.pendingReplacement.tasks[0]?.playerId ?? null
  if (game.pendingBattle) return pendingBattleActor(game)?.playerId ?? null
  if (game.pendingFaintEffects?.length) return game.pendingFaintEffects[0].context.sourcePlayerId
  if (game.pendingAfterDamageEffects?.length) {
    return game.pendingAfterDamageEffects[0].context.sourcePlayerId
  }
  return null
}

const pendingHeadline = (game: GameState, actorId: PlayerId): string => {
  const battleActor = pendingBattleActor(game)
  if (battleActor) {
    switch (battleActor.stage) {
      case 'trap':
        return '正在處理陷阱回應'
      case 'flip':
        return '正在處理 FLIP 回應'
      case 'attack-effect':
        return '正在選擇攻擊效果'
      case 'damage':
        return '正在處理傷害'
    }
  }
  if (game.pendingOnPlay) return '正在處理 OnPlay 登場效果'
  if (game.pendingAbilityEffect) return '正在處理技能效果'
  if (game.pendingOpponentHandDiscard) return '正在選擇要丟棄的手牌'
  if (game.pendingInspectDeck) return '正在查看牌庫'
  if (game.pendingOptionalCostAttack) return '正在選擇攻擊代價'
  if (game.pendingDrawUpTo) return '正在選擇抽牌數量'
  if (game.pendingEffectOrder) return '正在排列效果順序'
  if (game.pendingStageTrigger) return '正在決定場景效果'
  if (game.pendingRefresh) return '正在處理牌庫 Refresh'
  if (game.pendingReplacement) return '正在選擇替代餅乾'
  if (game.pendingFaintEffects?.length) return '正在處理餅乾退場效果'
  if (game.pendingAfterDamageEffects?.length) return '正在處理傷害後效果'
  return `${playerLabel(game, actorId)} 正在操作`
}

const statusForIntent = (
  game: GameState,
  viewerPlayerId: PlayerId,
  intent: PublicIntent,
): ActionStatus => {
  const actorIsViewer = intent.actorId === viewerPlayerId
  const actorLabel = playerLabel(game, intent.actorId)
  const phaseLabel = phaseLabelFor(game)
  const mode: ActionStatusMode =
    intent.type === 'resolving'
      ? 'resolving'
      : actorIsViewer
        ? 'awaiting-local-decision'
        : 'opponent-thinking'

  switch (intent.type) {
    case 'selecting-payment':
      return {
        mode,
        actorId: intent.actorId,
        actorLabel,
        phaseLabel,
        headline: actorIsViewer ? '請選擇支付能量' : `${actorLabel} 正在選擇支付能量`,
        detail: `已選 ${intent.selectedCount}/${intent.requiredCount}`,
        sourceCard: intent.source,
        highlightedTargetInstanceIds: intent.highlightedTargetInstanceIds,
        progress:
          intent.progress ??
          progressFor('payment', {
            hasCost: false,
            hasTarget: true,
          }),
        expiresAt: intent.expiresAt,
      }
    case 'selecting-hidden-cost':
      return {
        mode,
        actorId: intent.actorId,
        actorLabel,
        phaseLabel,
        headline: actorIsViewer
          ? intent.publicDescription
          : `${actorLabel} 正在選擇代價`,
        detail: `已選 ${intent.selectedCount}/${intent.requiredCount}`,
        sourceCard: intent.source,
        highlightedTargetInstanceIds: intent.highlightedTargetInstanceIds,
        progress:
          intent.progress ??
          progressFor('cost', {
            hasPayment: false,
            hasTarget: true,
          }),
        expiresAt: intent.expiresAt,
      }
    case 'selecting-target':
      return {
        mode,
        actorId: intent.actorId,
        actorLabel,
        phaseLabel,
        headline: actorIsViewer
          ? `請選擇${targetScopeLabel(intent.targetScope)}目標`
          : `${actorLabel} 正在選擇${targetScopeLabel(intent.targetScope)}目標`,
        detail: `已選 ${intent.selectedCount}/${intent.requiredCount}`,
        sourceCard: intent.source,
        highlightedTargetInstanceIds: intent.highlightedTargetInstanceIds,
        attackTargetInstanceIds: intent.highlightedTargetInstanceIds,
        progress:
          intent.progress ??
          progressFor('target', {
            hasPayment: false,
            hasCost: false,
          }),
        expiresAt: intent.expiresAt,
      }
    case 'awaiting-response':
      return {
        mode:
          intent.responderId === viewerPlayerId
            ? 'awaiting-local-decision'
            : 'awaiting-opponent-decision',
        actorId: intent.actorId,
        actorLabel,
        phaseLabel,
        headline:
          intent.responderId === viewerPlayerId
            ? '請選擇是否回應'
            : `${playerLabel(game, intent.responderId)} 正在決定是否回應`,
        detail: `可回應：${responseTypeLabel(intent.responseType)}`,
        sourceCard: intent.source,
        highlightedTargetInstanceIds: intent.highlightedTargetInstanceIds,
        attackTargetInstanceIds: intent.highlightedTargetInstanceIds,
        progress:
          intent.progress ??
          progressFor('response', {
            hasPayment: false,
            hasCost: false,
            hasTarget: true,
          }),
        expiresAt: intent.expiresAt,
      }
    case 'resolving':
      return {
        mode: 'resolving',
        actorId: intent.actorId,
        actorLabel,
        phaseLabel,
        headline: intent.resolutionLabel ?? `${actorLabel} 正在結算效果`,
        sourceCard: intent.source,
        highlightedTargetInstanceIds: intent.highlightedTargetInstanceIds,
        attackTargetInstanceIds: intent.highlightedTargetInstanceIds,
        progress:
          intent.progress ??
          progressFor('resolve', {
            hasPayment: false,
            hasCost: false,
            hasTarget: false,
          }),
        expiresAt: intent.expiresAt,
      }
  }
}

export const deriveActionStatus = ({
  game,
  viewerPlayerId,
  publicIntent,
  opponentAttackSelection,
  local,
}: ActionStatusOptions): ActionStatus => {
  const phaseLabel = phaseLabelFor(game)
  const actorId = game.activePlayerId
  const actorLabel = playerLabel(game, actorId)

  if (local?.connectionMode) {
    return {
      mode: local.connectionMode,
      actorId: null,
      actorLabel: '線上對戰',
      phaseLabel,
      headline:
        local.connectionMode === 'reconnecting'
          ? '正在重新連線'
          : '正在同步對戰狀態',
      detail: local.connectionNotice ?? undefined,
    }
  }

  if (publicIntent) return statusForIntent(game, viewerPlayerId, publicIntent)

  if (opponentAttackSelection?.attackerInstanceId) {
    const opponentId = opponentOf(viewerPlayerId)
    const attacker = game.players[opponentId].battleArea.find(
      (cookie) => cookie.card.instanceId === opponentAttackSelection.attackerInstanceId,
    )
    const requiredPayment = attacker
      ? getEnergyCostTotal(getAttackEnergyCost(attacker.card))
      : opponentAttackSelection.supportPaymentIds.length
    const selectedPayment = opponentAttackSelection.supportPaymentIds.length
    const paymentComplete = selectedPayment >= requiredPayment

    return {
      mode: 'opponent-thinking',
      actorId: opponentId,
      actorLabel: playerLabel(game, opponentId),
      phaseLabel,
      headline: paymentComplete
        ? '對手正在選擇攻擊目標'
        : '對手正在選擇支援卡支付攻擊費用',
      detail: `已選 ${selectedPayment}/${requiredPayment}`,
      sourceCard: attacker
        ? cardReference(attacker.card, opponentId)
        : undefined,
      highlightedTargetInstanceIds: opponentAttackSelection.supportPaymentIds,
      attackTargetInstanceIds: [],
      progress: buildActionProgress({
        active: paymentComplete ? 'target' : 'payment',
        hasCost: false,
      }),
    }
  }

  const localPendingActor = local?.pendingEffect?.context?.sourcePlayerId
  const statePendingActor = pendingActor(game)
  const pendingOwner = localPendingActor ?? statePendingActor
  if (pendingOwner) {
    const ownerIsViewer = pendingOwner === viewerPlayerId
    return {
      mode: ownerIsViewer
        ? 'awaiting-local-decision'
        : 'opponent-thinking',
      actorId: pendingOwner,
      actorLabel: playerLabel(game, pendingOwner),
      phaseLabel,
      headline: pendingHeadline(game, pendingOwner),
      sourceCard: (() => {
        const battleSource = game.pendingBattle
          ? cardInGame(game, game.pendingBattle.attackerInstanceId)
          : undefined
        const source =
          battleSource ??
          local?.pendingEffect?.sourceCard ??
          local?.pendingSourceCard ??
          (game.pendingOnPlay
            ? cardInGame(game, game.pendingOnPlay.sourceInstanceId)
            : undefined)
        const ownerId = game.pendingBattle?.attackerPlayerId ??
          local?.pendingEffect?.context?.sourcePlayerId ??
          pendingOwner
        return source ? cardReference(source, ownerId) : undefined
      })(),
      highlightedTargetInstanceIds: game.pendingBattle?.targetInstanceId
        ? [game.pendingBattle.targetInstanceId]
        : undefined,
      attackTargetInstanceIds: game.pendingBattle?.targetInstanceId
        ? [game.pendingBattle.targetInstanceId]
        : [],
      progress: game.pendingBattle
        ? buildActionProgress({
            active:
              game.pendingBattle.stage === 'trap' || game.pendingBattle.stage === 'flip'
                ? 'response'
                : game.pendingBattle.stage === 'attack-effect'
                  ? 'target'
                  : 'resolve',
            hasPayment: false,
            hasCost: false,
            hasTarget: Boolean(game.pendingBattle.targetInstanceId),
          })
        : undefined,
    }
  }

  if (local?.aiThinking) {
    const aiId = opponentOf(viewerPlayerId)
    return {
      mode: 'opponent-thinking',
      actorId: aiId,
      actorLabel: playerLabel(game, aiId),
      phaseLabel,
      headline: `${playerLabel(game, aiId)} 正在思考`,
    }
  }

  if (local?.selectedAttackerId) {
    return {
      mode: 'awaiting-local-decision',
      actorId: viewerPlayerId,
      actorLabel: playerLabel(game, viewerPlayerId),
      phaseLabel,
      headline: local.attackPaymentValid
        ? '請選擇攻擊目標'
        : '請選擇支付攻擊能量',
      detail: '選好後即可進入下一步',
      progress: buildActionProgress({
        active: local.attackPaymentValid ? 'target' : 'payment',
        hasCost: false,
      }),
    }
  }

  if (game.activePlayerId !== viewerPlayerId) {
    return {
      mode: 'opponent-thinking',
      actorId,
      actorLabel,
      phaseLabel,
      headline: `對手 ${actorLabel} 正在進行${phaseLabel}`,
    }
  }

  return {
    mode: 'awaiting-local-decision',
    actorId: viewerPlayerId,
    actorLabel: playerLabel(game, viewerPlayerId),
    phaseLabel,
    headline: '輪到你操作',
  }
}
