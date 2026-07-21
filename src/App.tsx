import { lazy, Suspense, useState } from 'react'
import './styles/base.css'
import './App.css'
import {
  canActivateStage,
  canPlayItem,
  canPlayStage,
  selectEnergyPayment,
  type BuiltInDeckChoice,
  type DeckChoice,
  type GameCard,
} from './game'
import { BattleTable } from './components/battle/BattleTable'
import type { BattleRowProps } from './components/battle/BattleRow'
import { MatchToolbar } from './components/layout/MatchToolbar'
import { PhaseRail } from './components/layout/PhaseRail'
import { SimulationReport } from './components/panels/GameStatusPanels'
import { deckChoiceLabel } from './components/gameUiLabels'
import { EffectPanel } from './components/effects/EffectPanel'
import { getOptionalCostAttackPrompt } from './components/modals/optionalCostAttackPrompt'
import { StatusToast } from './components/panels/InteractionOverlays'
import { BattleLogSidebar } from './components/panels/BattleLogSidebar'
import { deriveActionStatus } from './components/panels/actionStatus'
import { MenuScreen } from './components/battle/MenuScreen'
import { findCardInGame } from './components/battle/publicCardLookup'
import type { OpeningSetupStep } from './components/modals/GameModals'
import { parseTestStateConfig } from './game/demo'
import { useMatchDialogs } from './hooks/useMatchDialogs'
import { usePendingEffect } from './hooks/usePendingEffect'
import { useAiTurn } from './hooks/useAiTurn'
import { useMatchController } from './hooks/useMatchController'
import { useHandSelectionDismissal } from './hooks/useHandSelectionDismissal'
import { deriveInteractionLocked } from './hooks/deriveInteractionLocked'
import type { AiLevel } from './game'

const InformationModals = lazy(async () => {
  const module = await import('./components/battle/InformationModals')
  return { default: module.InformationModals }
})

const BattleResponseModals = lazy(async () => {
  const module = await import('./components/battle/BattleResponseModals')
  return { default: module.BattleResponseModals }
})

const DamageEffectModals = lazy(async () => {
  const module = await import('./components/battle/DamageEffectModals')
  return { default: module.DamageEffectModals }
})

const PendingDecisionModals = lazy(async () => {
  const module = await import('./components/battle/PendingDecisionModals')
  return { default: module.PendingDecisionModals }
})

const ResultModal = lazy(async () => {
  const module = await import('./components/modals/GameModals')
  return { default: module.ResultModal }
})

const OpeningSetupModal = lazy(async () => {
  const module = await import('./components/modals/GameModals')
  return { default: module.OpeningSetupModal }
})

function ModalLoadingFallback() {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-loading-fallback" role="status" aria-live="polite">
        載入畫面中…
      </div>
    </div>
  )
}

const aiSimulationSeeds = Array.from({ length: 20 }, (_, index) => index + 1)

const testStateConfig = parseTestStateConfig(
  window.location.search,
  window.location.hostname,
)

function App() {
  const [screen, setScreen] = useState<'menu' | 'battle'>(() =>
    testStateConfig ? 'battle' : 'menu',
  )
  const [aiLevel, setAiLevel] = useState<AiLevel>(2)
  const [hoveredCard, setHoveredCard] = useState<GameCard | null>(null)
  const [hoveredOpponentCard, setHoveredOpponentCard] = useState<GameCard | null>(null)
  const dialogs = useMatchDialogs()
  const { closeResourcePopover } = dialogs
  const match = useMatchController({ testStateConfig })
  const pending = usePendingEffect({
    game: match.game,
    setGame: match.setGame,
    dispatch: match.dispatch,
    viewerPlayerId: match.viewerPlayerId,
    setMessage: match.setMessage,
    clearAttacker: match.clearAttacker,
    setInspectedHpPile: dialogs.openHpPile,
    hasFaint: match.hasFaint,
    faintTargetIds: match.faintTargetIds,
    selectedFaintTargetIds: match.selectedFaintTargetIds,
    faintMinMax: { min: match.faintMin, max: match.faintMax },
    setSelectedFaintTargetIds: match.setSelectedFaintTargetIds,
    hasAfterDamage: match.hasAfterDamage,
    afterDamageTargetIds: match.afterDamageTargetIds,
    selectedAfterDamageTargetIds: match.selectedAfterDamageTargetIds,
    afterDamageMinMax: { min: match.afterDamageMin, max: match.afterDamageMax },
    setSelectedAfterDamageTargetIds: match.setSelectedAfterDamageTargetIds,
  })
  const ai = useAiTurn({
    game: match.game,
    setGame: match.setGame,
    setMessage: match.setMessage,
    showPause: dialogs.showPause,
    aiControlsCurrentState: match.aiControlsCurrentState,
    pendingEffect: pending.pendingEffect,
    faintActive: pending.faintActive,
    afterDamageActive: pending.afterDamageActive,
    deckConfig: match.deckConfig,
    aiLevel,
  })

  const actionStatus = deriveActionStatus({
    game: match.game,
    viewerPlayerId: match.viewerPlayerId,
    local: {
      aiThinking: ai.aiThinking,
      pendingEffect: pending.pendingEffect,
      selectedAttackerId: match.selectedAttackerId,
      attackPaymentValid: match.attackPaymentValidation.valid,
    },
  })

  const faintActive = pending.faintActive

  const resetGame = (
    nextConfig: { player: DeckChoice; ai: BuiltInDeckChoice },
    nextMessage: string,
  ) => {
    setSelectedHandCardId(null)
    dialogs.closeResourcePopover()
    match.resetMatchState(nextConfig)
    pending.resetEffectContext()
    ai.resetAiCounts()
    match.setMessage(nextMessage)
    if (!testStateConfig) {
      setScreen('menu')
    }
  }

  const interactionLocked = deriveInteractionLocked(
    match.game,
    match.viewerPlayerId,
    Boolean(pending.pendingEffect),
    faintActive,
    {
      pendingAiDecision: Boolean(ai.pendingAiDecision),
      aiThinking: ai.aiThinking,
      aiControlsCurrentState: match.aiControlsCurrentState,
    },
  )

  const selectedAttackPaymentIdSet = new Set(match.selectedAttackPaymentIds)
  const trapPaymentIdSet = new Set(match.selectedTrapPaymentIds)

  const phaseDisabled =
    match.game.status === 'finished' ||
    Boolean(match.game.pendingReplacement) ||
    Boolean(match.game.pendingOnPlay) ||
    Boolean(match.game.pendingRefresh) ||
    Boolean(
      match.game.pendingFaintEffects &&
        match.game.pendingFaintEffects.length > 0,
    ) ||
    Boolean(pending.pendingEffect)

  const currentJsxEffect = pending.currentEffect
  const playerHand = match.game.players[match.viewerPlayerId].hand
  const optionalCostAttackPrompt =
    match.game.pendingEffectOrder &&
    !match.game.pendingEffectOrder.resolvedOrder
      ? null
      : getOptionalCostAttackPrompt(match.game, match.viewerPlayerId)

  const pe = pending.pendingEffect
  const showCancelSkill =
    pe !== null &&
    !pe.skillActivated &&
    ((pe.sourceKind === 'cookie' && pe.trigger === 'on-play') ||
      (pe.trigger === 'activate' &&
        (pe.sourceKind === 'cookie' ||
          pe.sourceKind === 'item' ||
          pe.sourceKind === 'stage')))

  const { activeSelectedHandCardId, setSelectedHandCardId } =
    useHandSelectionDismissal(playerHand, closeResourcePopover)
  const opponentSourcePreviewCard =
    actionStatus.mode === 'opponent-thinking'
      ? findCardInGame(match.game, actionStatus.sourceCard?.instanceId) ?? null
      : null
  const opponentPreviewCard = hoveredOpponentCard ?? opponentSourcePreviewCard
  const centerPreviewCard =
    actionStatus.mode === 'opponent-thinking' ||
    actionStatus.mode === 'resolving' ||
    actionStatus.mode === 'awaiting-opponent-decision'
      ? findCardInGame(match.game, actionStatus.sourceCard?.instanceId) ?? null
      : null

  if (screen === 'menu') {
    return (
      <MenuScreen
        aiLevel={aiLevel}
        onSelectAiLevel={setAiLevel}
        dialogs={dialogs}
        pending={pending}
        ai={ai}
        match={match}
        setSelectedHandCardId={setSelectedHandCardId}
        onEnterBattle={() => setScreen('battle')}
      />
    )
  }

  const topBattleRowProps: BattleRowProps = {
    game: match.game,
    playerId: match.opponentId,
    position: 'top',
    selectedAttackerId: match.selectedAttackerId,
    attackTargetingActive: Boolean(match.selectedAttackerId),
    effectTargetIds: pending.effectTargetIds,
    breakEffectTargetIds: pending.breakEffectTargetIds,
    selectedEffectTargetIds: pending.selectedEffectTargetIds,
    selectedSkillPaymentIds: pending.selectedSkillPaymentIds,
    selectedAttackPaymentIds: selectedAttackPaymentIdSet,
    attackPaymentValid: match.attackPaymentValidation.valid,
    interactionLocked,
    openResourceKind:
      dialogs.resourcePopover?.playerId === match.opponentId
        ? dialogs.resourcePopover.kind
        : null,
    attackShakeId: match.attackShakeId,
    damageFlashId: match.damageFlashId,
    faintAnimIds: match.faintAnimIds,
    drawAnimIds: match.drawAnimIds,
    onAttackTarget: match.handleAttackTarget,
    onEffectTarget: pending.toggleEffectTarget,
    onInspectCard: dialogs.openCardDetail,
    onInspectDiscard: dialogs.openDiscardPile,
    onHoverCard: setHoveredOpponentCard,
    onFocusCard: setHoveredOpponentCard,
    onToggleResource: (kind) =>
      dialogs.toggleResourcePopover(match.opponentId, kind),
  }

  const bottomBattleRowProps: BattleRowProps = {
    game: match.game,
    playerId: match.viewerPlayerId,
    position: 'bottom',
    selectedAttackerId: match.selectedAttackerId,
    effectTargetIds: pending.effectTargetIds,
    breakEffectTargetIds: pending.breakEffectTargetIds,
    selectedEffectTargetIds: pending.selectedEffectTargetIds,
    selectedSkillPaymentIds: pending.selectedSkillPaymentIds,
    skillPaymentTargetIds: pending.skillPaymentTargetIds,
    skillCostSupportTargetIds: pending.skillCostSupportTargetIds,
    selectedSkillCostSupportIds: pending.selectedSkillCostSupportToTrashIds,
    selectedSkillTrashBattleCookieIds: pending.selectedSkillTrashBattleCookieIds,
    skillTrashBattleCookieTargetIds: pending.skillTrashBattleCookieTargetIds,
    selectedAttackPaymentIds: selectedAttackPaymentIdSet,
    attackPaymentTargetIds: match.attackPaymentTargetIds,
    selectedTrapPaymentIds: trapPaymentIdSet,
    trapPaymentTargetIds: match.trapPaymentTargetIds,
    onTrapPayment: match.toggleTrapPayment,
    attackPaymentValid: match.attackPaymentValidation.valid,
    interactionLocked,
    selectedHandCardId: activeSelectedHandCardId,
    openResourceKind:
      dialogs.resourcePopover?.playerId === match.viewerPlayerId
        ? dialogs.resourcePopover.kind
        : null,
    attackShakeId: match.attackShakeId,
    damageFlashId: match.damageFlashId,
    faintAnimIds: match.faintAnimIds,
    drawAnimIds: match.drawAnimIds,
    onSelectAttacker: (instanceId) => {
      match.setSelectedAttackerId(instanceId)
      match.setSelectedAttackPaymentIds([])
      match.setMessage('選擇支援卡支付攻擊費用。')
    },
    onEffectTarget: pending.toggleEffectTarget,
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
    onSkillPayment: pending.toggleSkillPayment,
    onSkillCostSupport: pending.toggleSkillCostSupport,
    onSkillTrashBattleCookie: pending.toggleSkillTrashBattleCookie,
    onAttackPayment: match.toggleAttackPayment,
    onActivateSkill: (instanceId) => {
      const card = match.activePlayer.battleArea.find(
        (cookie) => cookie.card.instanceId === instanceId,
      )?.card
      pending.beginCookieSkill(
        match.game,
        card,
        match.activePlayer.id,
        'activate',
        'Activate 主動發動',
      )
    },
    onDeployCookie: (instanceId) =>
      match.dispatch(
        {
          kind: 'deploy-cookie',
          playerId: match.activePlayer.id,
          instanceId,
        },
        '新餅乾已登場並配置 HP。',
        (nextGame) => {
          if (nextGame.pendingRefresh) return
          pending.beginCookieSkill(
            nextGame,
            nextGame.players[match.activePlayer.id].battleArea.find(
              (cookie) => cookie.card.instanceId === instanceId,
            )?.card,
            match.activePlayer.id,
            'on-play',
            'OnPlay 登場觸發',
            true,
          )
        },
      ),
    onPlayItem: (instanceId) => {
      if (!canPlayItem(match.game, match.activePlayer.id, instanceId)) {
        match.setMessage('目前無法使用物品卡。')
        return
      }
      const card = match.activePlayer.hand.find(
        (candidate) => candidate.instanceId === instanceId,
      )
      if (card?.item) {
        pending.beginCardAbility(card, card.item, 'item', '使用物品')
      }
    },
    onPlayStage: (instanceId) => {
      if (!canPlayStage(match.game, match.activePlayer.id, instanceId)) {
        match.setMessage('目前無法放置場景卡。')
        return
      }
      const card = match.activePlayer.hand.find(
        (candidate) => candidate.instanceId === instanceId,
      )
      const ability = card?.stageAbility
      if (!card || !ability) return
      const paymentIds = selectEnergyPayment(
        ability.placementCost,
        match.activePlayer.supportArea,
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
    onActivateStage: () => {
      const stage = match.activePlayer.stage
      if (
        stage?.card.stageAbility &&
        canActivateStage(match.game, match.activePlayer.id)
      ) {
        pending.beginCardAbility(
          stage.card,
          stage.card.stageAbility,
          'stage',
          '啟動場景',
        )
      }
    },
    onSelectHandCard: setSelectedHandCardId,
    onToggleResource: (kind) =>
      dialogs.toggleResourcePopover(match.viewerPlayerId, kind),
    onInspectCard: dialogs.openCardDetail,
    onInspectDiscard: dialogs.openDiscardPile,
    onHoverCard: setHoveredCard,
    onFocusCard: setHoveredCard,
  }

  return (
    <main className="game-shell">
      <div className="board-texture" />

      <MatchToolbar
        onReset={() => {
          resetGame(
            match.deckConfig,
            `我方 ${deckChoiceLabel[match.deckConfig.player]} vs AI ${deckChoiceLabel[match.deckConfig.ai]} 新對局。`,
          )
        }}
        onViewDeck={() => dialogs.openDeckList('player')}
        onPause={dialogs.openPause}
      />

      <StatusToast message={match.message} />

      <BattleLogSidebar
        entries={match.game.commandLog ?? []}
        playerNames={{
          'player-one': match.game.players['player-one'].name,
          'player-two': match.game.players['player-two'].name,
        }}
      />

      <BattleTable
        ariaLabel="Braverse 對戰桌"
        topBattleRow={topBattleRowProps}
        bottomBattleRow={bottomBattleRowProps}
        attackPreviewArrow={{
          sourceInstanceId:
            match.selectedAttackerId ??
            match.game.pendingBattle?.attackerInstanceId ??
            (actionStatus.mode === 'opponent-thinking'
              ? actionStatus.sourceCard?.instanceId ?? null
              : null),
          targetInstanceIds: actionStatus.attackTargetInstanceIds ?? [],
          label:
            match.selectedAttackerId ||
            match.game.pendingBattle ||
            actionStatus.headline.includes('攻擊')
              ? '攻擊宣告'
              : '目標選擇',
        }}
        previewCard={hoveredCard ?? opponentPreviewCard}
        previewContextLabel={
          hoveredCard || hoveredOpponentCard || !opponentSourcePreviewCard
            ? undefined
            : '對手目前操作'
        }
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
        phase={match.game.phase}
        turnNumber={match.game.turnNumber}
        isPlayerTurn={match.game.activePlayerId === match.viewerPlayerId}
        disabled={
          phaseDisabled ||
          match.game.activePlayerId !== match.viewerPlayerId ||
          match.game.phase === 'active' ||
          match.game.phase === 'draw'
        }
        onAdvance={() => {
          if (pending.pendingEffect || faintActive) return
          match.handleAdvancePhase()
        }}
      />

      {ai.simulationResults && (
        <SimulationReport
          simulationResults={ai.simulationResults}
          seeds={aiSimulationSeeds}
          onClose={ai.dismissSimulation}
        />
      )}

      <EffectPanel
        pendingEffect={pending.pendingEffect}
        currentEffect={currentJsxEffect}
        effectHistory={pending.effectHistory}
        onConfirm={pending.confirmEffect}
        onSkip={() => {
          if (pending.pendingEffect?.sourceKind === 'attack') {
            pending.skipAttackEffect()
          } else {
            pending.skipOptionalSkill()
          }
        }}
        onCancel={pending.cancelPendingSkill}
        candidateCards={[
          ...pending.effectTargetCandidates.map((c) => c.card),
          ...pending.nonBattleEffectCandidateCards,
          ...pending.breakToTrashCandidates,
          ...pending.breakToBattleCandidates,
          ...pending.breakToHandBySumCandidates,
          ...pending.trashToHandCandidates,
          ...pending.trashToDeckCandidates,
        ]}
        onToggleCandidate={pending.toggleEffectTarget}
        costSupportCandidates={
          pending.pendingEffect && !pending.pendingEffect.skillActivated
            ? pending.skillCostSupportCandidates.map((s) => s.card)
            : []
        }
        selectedCostSupportIds={pending.selectedSkillCostSupportToTrashIds}
        onToggleCostSupport={pending.toggleSkillCostSupport}
        discardHandCandidates={
          pending.pendingEffect && !pending.pendingEffect.skillActivated
            ? pending.skillCostDiscardHandCandidates
            : []
        }
        selectedDiscardHandIds={pending.selectedSkillDiscardHandIds}
        onToggleDiscardHand={pending.toggleSkillDiscardHand}
        discardHandCost={pending.discardHandCost}
        showCancelSkill={showCancelSkill}
        energyPaymentValid={pending.skillEnergyPaymentValid}
        paymentCandidates={
          pending.pendingEffect && !pending.pendingEffect.skillActivated
            ? match.game.players[pending.pendingEffect.context.sourcePlayerId].supportArea
                .filter((support) =>
                  pending.skillPaymentTargetIds.has(support.card.instanceId),
                )
                .map((support) => support.card)
            : []
        }
        selectedPaymentIds={pending.selectedSkillPaymentIds}
        onTogglePayment={pending.toggleSkillPayment}
        trashBattleCookieCandidates={pending.skillTrashBattleCookieCandidates}
        selectedTrashBattleCookieIds={pending.selectedSkillTrashBattleCookieIds}
        onToggleTrashBattleCookie={pending.toggleSkillTrashBattleCookie}
        trashBattleCookieCost={
          pending.pendingEffect?.skill.cost.trashBattleCookie?.count ?? 0
        }
        optionalCostAttack={
          optionalCostAttackPrompt
            ? {
                ...optionalCostAttackPrompt,
                onSkip: () => {
                  match.dispatch(
                    {
                      kind: 'resolve-optional-cost-attack',
                      playerId: match.viewerPlayerId,
                      action: 'skip',
                    },
                    '已略過攻擊後續效果。',
                  )
                },
                onPay: (discardIds, targetId, paymentIds) => {
                  match.dispatch(
                    {
                      kind: 'resolve-optional-cost-attack',
                      playerId: match.viewerPlayerId,
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

      {match.setupStep && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <OpeningSetupModal
            step={match.setupStep as OpeningSetupStep}
            message={match.setupMessage}
            hand={match.game.players[match.viewerPlayerId].hand}
            deckConfig={match.deckConfig}
            onSelectDeck={match.handleDeckSelection}
            onRps={match.handleRps}
            onChooseFirstPlayer={(playerFirst) =>
              match.beginOrderedSetup(
                playerFirst ? 'player-one' : 'player-two',
              )
            }
            onMulligan={match.handlePlayerMulligan}
            onSelectStartingCookie={match.handleStartingCookie}
          />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <BattleResponseModals match={match} />

        <DamageEffectModals match={match} pending={pending} />

        <PendingDecisionModals match={match} pending={pending} />

        <InformationModals match={match} ai={ai} dialogs={dialogs} />
      </Suspense>

      {match.game.result && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <ResultModal
            winnerName={
              match.game.players[match.game.result.winnerId].name
            }
            loserId={match.game.result.loserId}
            viewerPlayerId={match.viewerPlayerId}
            reason={match.game.result.reason}
            onRestart={() => {
              resetGame(
                match.deckConfig,
                `我方 ${deckChoiceLabel[match.deckConfig.player]} vs AI ${deckChoiceLabel[match.deckConfig.ai]} 新對局。`,
              )
            }}
          />
        </Suspense>
      )}
    </main>
  )
}

export default App
