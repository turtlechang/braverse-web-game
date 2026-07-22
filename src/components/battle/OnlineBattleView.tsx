import { useEffect, useMemo, useState } from 'react'
import type { GameState, PlayerId } from '../../game'
import { getEnergyCostTotal, selectEnergyPayment } from '../../game'
import { useOnlineMatchController } from '../../hooks/useOnlineMatchController'
import type { OnlineConnectionMode } from '../../hooks/useOnlineMatch'
import { useOnlinePendingEffect } from '../../hooks/useOnlinePendingEffect'
import { useMatchDialogs } from '../../hooks/useMatchDialogs'
import { useHandSelectionDismissal } from '../../hooks/useHandSelectionDismissal'
import { deriveInteractionLocked } from '../../hooks/deriveInteractionLocked'
import { useFlipCardPreview } from '../../hooks/useFlipCardPreview'
import { BattleTable } from './BattleTable'
import type { BattleRowProps } from './BattleRow'
import { PhaseRail } from '../layout/PhaseRail'
import { findCardInGame } from './publicCardLookup'
import { StatusToast } from '../panels/InteractionOverlays'
import { RemoteActionBanner } from '../panels/RemoteActionBanner'
import { OnlineActivityFeed } from '../panels/OnlineActivityFeed'
import { deriveActionStatus } from '../panels/actionStatus'
import { buildActionProgress } from '../panels/actionProgress'
import { EffectPanel } from '../effects/EffectPanel'
import { getOptionalCostAttackPrompt } from '../modals/optionalCostAttackPrompt'
import { BattleResponseModals } from './BattleResponseModals'
import { DamageEffectModals } from './DamageEffectModals'
import { PendingDecisionModals } from './PendingDecisionModals'
import { CardDetailModal, CardPileModal, ResultModal } from '../modals/GameModals'
import type { GameCard } from '../../game'
import type {
  AttackSelectionPreview,
  OnlineOpeningAction,
  OnlineOpeningSnapshot,
  PublicIntent,
  PublicIntentDraft,
  PublicTargetScope,
} from '../../net/onlineProtocol'
import { OnlineOpeningOverlay } from './OnlineOpeningOverlay'

const publicTargetScopeFor = (kind: string | undefined): PublicTargetScope => {
  if (kind === 'opponent-battle-to-trash' || kind === 'damage') {
    return 'opponent-battle-cookie'
  }
  if (
    kind === 'support-to-trash' ||
    kind === 'support-to-hand' ||
    kind === 'flip-to-support'
  ) {
    return 'support'
  }
  if (kind === 'break-to-trash' || kind === 'break-to-battle') return 'break'
  if (kind === 'field-to-trash') return 'public-card'
  return 'public-card'
}

export interface OnlineBattleViewProps {
  game: GameState
  viewerPlayerId: PlayerId
  roomCode: string | null
  sendCommand: (command: import('../../game').GameCommand) => void
  sendAttackSelection: (selection: AttackSelectionPreview) => void
  opponentAttackSelection: AttackSelectionPreview
  publicIntent?: PublicIntent | null
  openingSnapshot: OnlineOpeningSnapshot | null
  commandRejectedReason: string | null
  sendOpeningAction: (action: OnlineOpeningAction) => void
  sendPublicIntent?: (intent: PublicIntentDraft) => void
  clearPublicIntent?: (intentId?: string) => void
  connectionNotice?: string | null
  connectionMode?: OnlineConnectionMode
  onLeave: () => void
}

/**
 * 線上對戰的正式戰場畫面,重用 BattleRow/EffectPanel/BattleResponseModals/
 * DamageEffectModals/PendingDecisionModals 等本地既有的展示型元件,只是背後
 * 的狀態來源換成 useOnlineMatchController/useOnlinePendingEffect(伺服器
 * 遮罩版 GameState + dispatch 送指令到伺服器)。
 *
 * 範圍上刻意先不做的部分(已知縮小範圍,非 bug):
 * - MatchToolbar(重新開始/查看官方牌組/暫停資訊)、InformationModals
 *   (卡牌詳情/棄牌堆/HP堆/牌組清單)這些輔助資訊面板——不影響核心對戰
 *   流程,先不搬過來。
 * - 技能/道具/場景卡代價自動付款(見 useOnlinePendingEffect 的說明),
 *   目標選擇只支援一般 target 選擇器的效果類型。
 */
export function OnlineBattleView({
  game,
  viewerPlayerId,
  roomCode,
  sendCommand,
  sendAttackSelection,
  opponentAttackSelection,
  publicIntent = null,
  openingSnapshot,
  commandRejectedReason,
  sendOpeningAction,
  sendPublicIntent,
  clearPublicIntent,
  connectionNotice = null,
  connectionMode = null,
  onLeave,
}: OnlineBattleViewProps) {
  const [hoveredCard, setHoveredCard] = useState<GameCard | null>(null)
  const [hoveredOpponentCard, setHoveredOpponentCard] = useState<GameCard | null>(null)
  const dialogs = useMatchDialogs()
  const { closeResourcePopover } = dialogs

  const match = useOnlineMatchController({ game, viewerPlayerId, sendCommand })
  const pending = useOnlinePendingEffect({
    game,
    viewerPlayerId,
    dispatch: match.dispatch,
    hasFaint: match.hasFaint,
    hasAfterDamage: match.hasAfterDamage,
    setInspectedHpPile: dialogs.openHpPile,
  })

  const opponentId = match.opponentId
  const viewerPlayer = game.players[viewerPlayerId]
  const { activeSelectedHandCardId, setSelectedHandCardId } =
    useHandSelectionDismissal(viewerPlayer.hand, closeResourcePopover)
  const actionStatus = deriveActionStatus({
    game,
    viewerPlayerId,
    publicIntent,
    opponentAttackSelection,
    local: {
      pendingEffect: pending.pendingEffect,
      pendingSourceCard: pending.abilityCostDraft?.card,
      selectedAttackerId: match.selectedAttackerId,
      attackPaymentValid: match.attackPaymentValidation.valid,
      connectionMode: connectionMode ?? undefined,
      connectionNotice,
    },
  })

  useEffect(() => {
    sendAttackSelection({
      attackerInstanceId: match.selectedAttackerId,
      supportPaymentIds: match.selectedAttackPaymentIds,
    })
  }, [
    match.selectedAttackerId,
    match.selectedAttackPaymentIds,
    sendAttackSelection,
  ])

  const pendingBattle = game.pendingBattle
  const flipPreview = useFlipCardPreview(pendingBattle, viewerPlayerId)
  const optionalCostAttackPrompt =
    game.pendingEffectOrder && !game.pendingEffectOrder.resolvedOrder
      ? null
      : getOptionalCostAttackPrompt(game, viewerPlayerId)

  const selectedAttackPaymentIdSet = new Set(match.selectedAttackPaymentIds)
  const opponentAttackPaymentIdSet = new Set(
    opponentAttackSelection.supportPaymentIds,
  )
  const trapPaymentIdSetOnline = new Set(match.selectedTrapPaymentIds)
  const effectTargetIds = new Set(
    pending.candidateCards.map((card) => card.instanceId),
  )
  const selectedEffectTargetIds = new Set(pending.selectedTargetIds)
  const opponentIntentTargetIds = new Set(
    publicIntent?.highlightedTargetInstanceIds ?? [],
  )
  const selectedDraftPaymentKey = [...pending.selectedDraftPaymentIds]
    .sort()
    .join(',')
  const selectedDraftTargetKey = pending.selectedTargetIds.join(',')
  const selectedAttackRequiredPayment = getEnergyCostTotal(match.selectedAttackCost)

  const localPublicIntentDraft = useMemo<PublicIntentDraft | null>(() => {
    const draft = pending.abilityCostDraft
    if (draft) {
      const cost = draft.ability.cost
      const requiredPayment = pending.draftEnergyTotal
      const selectedPaymentCount = pending.selectedDraftPaymentIds.size
      const requiredCost =
        (cost.discardHand ?? 0) +
        (cost.supportToTrash ?? 0) +
        (cost.supportToHand ?? 0) +
        (cost.trashBattleCookie?.count ?? 0)
      const selectedCostCount =
        pending.selectedDraftDiscardHandIds.size +
        pending.selectedDraftCostSupportIds.size +
        pending.selectedDraftTrashBattleCookieIds.size

      if (requiredPayment > 0 && !pending.draftPaymentValid) {
        return {
          type: 'selecting-payment',
          sourceInstanceId: draft.card.instanceId,
          requiredCount: requiredPayment,
          selectedCount: selectedPaymentCount,
          highlightedTargetInstanceIds: selectedDraftPaymentKey
            ? selectedDraftPaymentKey.split(',')
            : [],
          progress: buildActionProgress({
            active: 'payment',
            hasPayment: requiredPayment > 0,
            hasCost: requiredCost > 0,
            hasTarget: pending.candidateCards.length > 0,
          }),
        }
      }

      if (requiredCost > selectedCostCount) {
        return {
          type: 'selecting-hidden-cost',
          sourceInstanceId: draft.card.instanceId,
          requiredCount: requiredCost,
          selectedCount: selectedCostCount,
          publicDescription: '正在選擇發動代價',
          progress: buildActionProgress({
            active: 'cost',
            hasPayment: requiredPayment > 0,
            hasCost: requiredCost > 0,
            hasTarget: pending.candidateCards.length > 0,
          }),
        }
      }

      if (pending.candidateCards.length > 0) {
        const effect = pending.currentEffect as { kind?: string; target?: { max?: number } } | null
        return {
          type: 'selecting-target',
          sourceInstanceId: draft.card.instanceId,
          targetScope: publicTargetScopeFor(effect?.kind),
          requiredCount: effect?.target?.max ?? 1,
          selectedCount: selectedDraftTargetKey
            ? selectedDraftTargetKey.split(',').length
            : 0,
          highlightedTargetInstanceIds: selectedDraftTargetKey
            ? selectedDraftTargetKey.split(',')
            : [],
          progress: buildActionProgress({
            active: 'target',
            hasPayment: requiredPayment > 0,
            hasCost: requiredCost > 0,
            hasTarget: pending.candidateCards.length > 0,
          }),
        }
      }

      return {
        type: 'resolving',
        sourceInstanceId: draft.card.instanceId,
        resolutionLabel: '準備結算效果',
        progress: buildActionProgress({
          active: 'resolve',
          hasPayment: requiredPayment > 0,
          hasCost: requiredCost > 0,
          hasTarget: pending.candidateCards.length > 0,
        }),
      }
    }

    if (match.selectedAttackerId) {
      const requiredPayment = selectedAttackRequiredPayment
      if (!match.attackPaymentValidation.valid) {
        return {
          type: 'selecting-payment',
          sourceInstanceId: match.selectedAttackerId,
          requiredCount: requiredPayment,
          selectedCount: match.selectedAttackPaymentIds.length,
          highlightedTargetInstanceIds: [...match.selectedAttackPaymentIds],
          progress: buildActionProgress({
            active: 'payment',
            hasPayment: requiredPayment > 0,
            hasCost: false,
            hasTarget: true,
          }),
        }
      }
      return {
        type: 'selecting-target',
        sourceInstanceId: match.selectedAttackerId,
        targetScope: 'opponent-battle-cookie',
        requiredCount: 1,
        selectedCount: 0,
        progress: buildActionProgress({
          active: 'target',
          hasPayment: requiredPayment > 0,
          hasCost: false,
          hasTarget: true,
        }),
      }
    }

    if (
      pendingBattle &&
      (pendingBattle.stage === 'trap' || pendingBattle.stage === 'flip') &&
      (pendingBattle.defenderPlayerId === viewerPlayerId ||
        (pendingBattle.damagePlayerId ?? pendingBattle.defenderPlayerId) ===
          viewerPlayerId)
    ) {
      return {
        type: 'awaiting-response',
        responderId: viewerPlayerId,
        responseType: pendingBattle.stage,
        sourceInstanceId: pendingBattle.attackerInstanceId,
        progress: buildActionProgress({
          active: 'response',
          hasPayment: false,
          hasCost: false,
          hasTarget: true,
        }),
      }
    }

    return null
  }, [
    match.selectedAttackerId,
    selectedAttackRequiredPayment,
    match.selectedAttackPaymentIds,
    match.attackPaymentValidation.valid,
    pending.abilityCostDraft,
    pending.candidateCards.length,
    pending.currentEffect,
    pending.draftEnergyTotal,
    pending.draftPaymentValid,
    pending.selectedDraftCostSupportIds.size,
    pending.selectedDraftDiscardHandIds.size,
    pending.selectedDraftPaymentIds.size,
    pending.selectedDraftTrashBattleCookieIds.size,
    pendingBattle,
    viewerPlayerId,
    selectedDraftPaymentKey,
    selectedDraftTargetKey,
  ])

  useEffect(() => {
    if (!sendPublicIntent || !clearPublicIntent) return
    if (localPublicIntentDraft) {
      sendPublicIntent(localPublicIntentDraft)
    } else {
      clearPublicIntent()
    }
  }, [
    clearPublicIntent,
    localPublicIntentDraft,
    sendPublicIntent,
  ])
  const interactionLocked = deriveInteractionLocked(
    game,
    viewerPlayerId,
    Boolean(pending.pendingEffect),
    pending.faintActive,
    { viewerControlsState: match.viewerControlsState },
  )

  const phaseDisabled =
    game.status !== 'playing' ||
    Boolean(game.pendingReplacement) ||
    Boolean(game.pendingOnPlay) ||
    Boolean(game.pendingRefresh) ||
    Boolean(game.pendingFaintEffects && game.pendingFaintEffects.length > 0) ||
    Boolean(pending.pendingEffect)

  const opponentSourcePreviewCard =
    actionStatus.mode === 'opponent-thinking' ||
    actionStatus.mode === 'awaiting-opponent-decision'
      ? findCardInGame(game, actionStatus.sourceCard?.instanceId) ?? null
      : null
  const opponentPreviewCard = hoveredOpponentCard ?? opponentSourcePreviewCard
  const centerPreviewCard =
    actionStatus.mode === 'opponent-thinking' ||
    actionStatus.mode === 'awaiting-opponent-decision' ||
    actionStatus.mode === 'resolving'
      ? findCardInGame(game, actionStatus.sourceCard?.instanceId) ?? null
      : null

  const topBattleRowProps: BattleRowProps = {
    game,
    playerId: opponentId,
    position: 'top',
    selectedAttackerId: opponentAttackSelection.attackerInstanceId,
    attackTargetingActive: Boolean(match.selectedAttackerId),
    effectTargetIds: new Set([...effectTargetIds, ...opponentIntentTargetIds]),
    breakEffectTargetIds: new Set(),
    selectedEffectTargetIds: new Set([
      ...selectedEffectTargetIds,
      ...opponentIntentTargetIds,
    ]),
    selectedSkillPaymentIds: new Set(),
    selectedAttackPaymentIds: opponentAttackPaymentIdSet,
    attackPaymentValid: match.attackPaymentValidation.valid,
    interactionLocked,
    attackShakeId: match.attackShakeId,
    damageFlashId: match.damageFlashId,
    faintAnimIds: match.faintAnimIds,
    drawAnimIds: match.drawAnimIds,
    onAttackTarget: match.handleAttackTarget,
    onEffectTarget: pending.toggleTarget,
    openResourceKind:
      dialogs.resourcePopover?.playerId === opponentId
        ? dialogs.resourcePopover.kind
        : null,
    onToggleResource: (kind) => dialogs.toggleResourcePopover(opponentId, kind),
    onInspectCard: dialogs.openCardDetail,
    onInspectDiscard: dialogs.openDiscardPile,
    onHoverCard: setHoveredOpponentCard,
    onFocusCard: setHoveredOpponentCard,
  }

  const bottomBattleRowProps: BattleRowProps = {
    game,
    playerId: viewerPlayerId,
    position: 'bottom',
    selectedAttackerId: match.selectedAttackerId,
    effectTargetIds,
    breakEffectTargetIds: new Set(),
    selectedEffectTargetIds,
    selectedSkillPaymentIds: new Set(),
    selectedAttackPaymentIds: selectedAttackPaymentIdSet,
    attackPaymentTargetIds: match.attackPaymentTargetIds,
    selectedTrapPaymentIds: trapPaymentIdSetOnline,
    trapPaymentTargetIds: match.trapPaymentTargetIds,
    onTrapPayment: match.toggleTrapPayment,
    attackPaymentValid: match.attackPaymentValidation.valid,
    interactionLocked,
    selectedHandCardId: activeSelectedHandCardId,
    onSelectHandCard: setSelectedHandCardId,
    attackShakeId: match.attackShakeId,
    damageFlashId: match.damageFlashId,
    faintAnimIds: match.faintAnimIds,
    drawAnimIds: match.drawAnimIds,
    openResourceKind:
      dialogs.resourcePopover?.playerId === viewerPlayerId
        ? dialogs.resourcePopover.kind
        : null,
    onSelectAttacker: (instanceId) => {
      match.setSelectedAttackerId(instanceId)
      match.setSelectedAttackPaymentIds([])
      match.setMessage('選擇支援卡支付攻擊費用。')
    },
    onEffectTarget: pending.toggleTarget,
    onPlaceSupport: (instanceId) =>
      match.dispatch(
        [
          {
            kind: 'place-support',
            playerId: match.activePlayer.id,
            instanceId,
          },
          { kind: 'advance-phase', playerId: match.activePlayer.id },
        ],
        '已將卡牌配置到支援區，進入主要階段。',
      ),
    onAttackPayment: match.toggleAttackPayment,
    onActivateSkill: (instanceId) => {
      const card = viewerPlayer.battleArea.find(
        (cookie) => cookie.card.instanceId === instanceId,
      )?.card
      if (card) pending.beginCookieSkill(card, 'activate')
    },
    onDeployCookie: (instanceId) =>
      match.dispatch(
        {
          kind: 'deploy-cookie',
          playerId: match.activePlayer.id,
          instanceId,
        },
        '新餅乾已登場並配置 HP。',
      ),
    onPlayItem: (instanceId) => {
      const card = viewerPlayer.hand.find(
        (candidate) => candidate.instanceId === instanceId,
      )
      if (card) pending.beginPlayItem(card)
    },
    onPlayStage: (instanceId) => {
      const card = viewerPlayer.hand.find(
        (candidate) => candidate.instanceId === instanceId,
      )
      const ability = card?.stageAbility
      if (!card || !ability) return
      const paymentIds = selectEnergyPayment(
        ability.placementCost,
        viewerPlayer.supportArea,
      )
      if (!paymentIds) {
        match.setMessage(`${card.name}目前無法支付放置費用。`)
        return
      }
      match.dispatch(
        {
          kind: 'play-stage',
          playerId: match.activePlayer.id,
          instanceId,
          paymentIds,
        },
        `${card.name}已放置到場景區。`,
      )
    },
    onActivateStage: () => pending.beginActivateStage(),
    onToggleResource: (kind) =>
      dialogs.toggleResourcePopover(viewerPlayerId, kind),
    onInspectCard: dialogs.openCardDetail,
    onInspectDiscard: dialogs.openDiscardPile,
    onHoverCard: setHoveredCard,
    onFocusCard: setHoveredCard,
  }

  return (
    <main className="game-shell">
      <div className="board-texture" />

      <StatusToast message={commandRejectedReason ?? match.message} />
      <OnlineActivityFeed game={game} viewerPlayerId={viewerPlayerId} />

      {!centerPreviewCard && actionStatus.mode !== 'awaiting-local-decision' && (
        <RemoteActionBanner
          status={actionStatus}
          connectionNotice={connectionNotice}
        />
      )}

      <BattleTable
        ariaLabel="Braverse 線上對戰桌"
        topBattleRow={topBattleRowProps}
        bottomBattleRow={bottomBattleRowProps}
        attackPreviewArrow={{
          sourceInstanceId:
            opponentAttackSelection.attackerInstanceId ??
            pendingBattle?.attackerInstanceId ??
            (actionStatus.mode === 'opponent-thinking'
              ? actionStatus.sourceCard?.instanceId ?? null
              : null),
          targetInstanceIds: actionStatus.attackTargetInstanceIds ?? [],
          label:
            opponentAttackSelection.attackerInstanceId ||
            match.selectedAttackerId ||
            pendingBattle ||
            actionStatus.headline.includes('攻擊')
              ? '攻擊宣告'
              : '目標選擇',
        }}
        previewCard={flipPreview.card ?? hoveredCard ?? opponentPreviewCard}
        previewContextLabel={
          flipPreview.card
            ? 'FLIP 效果觸發 · 點擊預覽外側關閉'
            : hoveredCard || hoveredOpponentCard || !opponentSourcePreviewCard
              ? undefined
              : '對手目前操作'
        }
        onDismissPreview={flipPreview.card ? flipPreview.dismiss : undefined}
        attackPaymentPanel={
          match.selectedAttacker && !pending.pendingEffect
            ? {
                attackerName: match.selectedAttacker.card.name,
                attackCost: match.selectedAttackCost,
                selectedPaymentCount: match.selectedAttackPaymentIds.length,
                isValid: match.attackPaymentValidation.valid,
                validationReason: match.attackPaymentValidation.reason,
                onCancel: () => {
                  match.setSelectedAttackerId(null)
                  match.setSelectedAttackPaymentIds([])
                  match.setMessage('已取消攻擊。')
                },
              }
            : null
        }
        centerPreview={
          centerPreviewCard
            ? { card: centerPreviewCard, label: actionStatus.headline }
            : null
        }
      />

      <PhaseRail
        phase={game.phase}
        turnNumber={game.turnNumber}
        isPlayerTurn={game.activePlayerId === viewerPlayerId}
        disabled={
          phaseDisabled ||
          game.activePlayerId !== viewerPlayerId ||
          game.phase === 'active' ||
          game.phase === 'draw'
        }
        onAdvance={() => {
          if (pending.pendingEffect || pending.faintActive) return
          match.handleAdvancePhase()
        }}
      />

      {openingSnapshot && (
        <OnlineOpeningOverlay
          opening={openingSnapshot}
          game={game}
          viewerPlayerId={viewerPlayerId}
          roomCode={roomCode}
          errorMessage={commandRejectedReason}
          onAction={sendOpeningAction}
          onLeave={onLeave}
        />
      )}

      <EffectPanel
        pendingEffect={pending.pendingEffect}
        currentEffect={pending.currentEffect}
        effectHistory={pending.effectHistory}
        onConfirm={pending.confirmEffect}
        onSkip={() => {
          if (pending.pendingEffect?.sourceKind !== 'attack') return
          match.dispatch(
            {
              kind: 'resolve-attack-effect',
              playerId: viewerPlayerId,
              targetIds: [],
            },
            '已略過攻擊後續效果。',
          )
        }}
        candidateCards={pending.candidateCards}
        onToggleCandidate={pending.toggleTarget}
        discardHandCandidates={pending.draftDiscardHandCandidates}
        selectedDiscardHandIds={pending.selectedDraftDiscardHandIds}
        onToggleDiscardHand={pending.toggleDraftDiscardHand}
        discardHandCost={pending.draftDiscardHandCost}
        paymentCandidates={pending.draftPaymentCandidates}
        selectedPaymentIds={pending.selectedDraftPaymentIds}
        energyPaymentValid={pending.draftPaymentValid}
        onTogglePayment={pending.toggleDraftPayment}
        costSupportCandidates={pending.draftCostSupportCandidates}
        selectedCostSupportIds={pending.selectedDraftCostSupportIds}
        onToggleCostSupport={pending.toggleDraftCostSupport}
        trashBattleCookieCandidates={pending.draftTrashBattleCookieCandidates}
        selectedTrashBattleCookieIds={pending.selectedDraftTrashBattleCookieIds}
        onToggleTrashBattleCookie={pending.toggleDraftTrashBattleCookie}
        trashBattleCookieCost={pending.draftTrashBattleCookieCost}
        showTargetSelection
        showCancelSkill={Boolean(pending.abilityCostDraft)}
        onCancel={() => {
          if (pending.abilityCostDraft?.trigger === 'on-play') {
            pending.skipOnPlay(pending.abilityCostDraft.card.instanceId)
          } else {
            pending.cancelAbilityCostDraft()
          }
        }}
        optionalCostAttack={
          optionalCostAttackPrompt
            ? {
                ...optionalCostAttackPrompt,
                onSkip: () => {
                  match.dispatch(
                    {
                      kind: 'resolve-optional-cost-attack',
                      playerId: viewerPlayerId,
                      action: 'skip',
                    },
                    '已略過攻擊後續效果。',
                  )
                },
                onPay: (discardIds, targetId, paymentIds) => {
                  match.dispatch(
                    {
                      kind: 'resolve-optional-cost-attack',
                      playerId: viewerPlayerId,
                      action: 'pay',
                      discardCardIds: discardIds,
                      targetIds: targetId ? [targetId] : [],
                      paymentIds,
                    },
                    '已支付攻擊後續效果費用。',
                  )
                },
              }
            : null
        }
      />

      <BattleResponseModals match={match} />
      <DamageEffectModals match={match} pending={pending} />
      <PendingDecisionModals match={match} pending={pending} />

      {game.result && (
        <ResultModal
          winnerName={game.players[game.result.winnerId].name}
          loserId={game.result.loserId}
          viewerPlayerId={viewerPlayerId}
          reason={game.result.reason}
          onRestart={onLeave}
        />
      )}

      {dialogs.inspectedDiscardPlayerId && (
        <CardPileModal
          title={`${game.players[dialogs.inspectedDiscardPlayerId].name}棄牌區`}
          cards={game.players[dialogs.inspectedDiscardPlayerId].discardPile}
          onInspect={(card) => {
            dialogs.closeDiscardPile()
            dialogs.openCardDetail(card)
          }}
          onClose={dialogs.closeDiscardPile}
        />
      )}

      {dialogs.inspectedHpPile && (
        <CardPileModal
          title={dialogs.inspectedHpPile.title}
          cards={dialogs.inspectedHpPile.cards}
          onInspect={dialogs.openCardDetail}
          onClose={dialogs.closeHpPile}
        />
      )}

      {dialogs.inspectedCard && (
        <CardDetailModal
          card={dialogs.inspectedCard}
          onClose={dialogs.closeCardDetail}
        />
      )}
    </main>
  )
}
