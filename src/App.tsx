import { Sparkles, Swords } from 'lucide-react'
import { useState } from 'react'
import './App.css'
import {
  canActivateStage,
  canPlayItem,
  canPlayStage,
  advancePhase,
  applyGameCommand,
  deployCookie,
  placeSupportCard,
  playStage,
  playTrap,
  refreshDeck,
  replaceDefeatedCookie,
  resolveBattleAutomatically,
  resolveFlip,
  selectEnergyPayment,
  skipDefeatedCookieReplacement,
  skipTrap,
  type DeckChoice,
  type GameCard,
} from './game'
import { BattleRow } from './components/battle/BattleRow'
import { PhaseRail } from './components/layout/PhaseRail'
import { MatchToolbar } from './components/layout/MatchToolbar'
import { CardFace } from './components/cards/CardVisuals'
import {
  AttackPaymentPanel,
  SimulationReport,
} from './components/panels/GameStatusPanels'
import { phaseLabels, deckChoiceLabel } from './components/gameUiLabels'
import { EffectPanel } from './components/effects/EffectPanel'
import {
  DecisionModal,
  CardDetailModal,
  CardRevealModal,
  CardPileModal,
  FlipResponseModal,
  PauseModal,
  DeckListModal,
  ResultModal,
  TrapResponseModal,
  OpeningSetupModal,
  type OpeningSetupStep,
} from './components/modals/GameModals'
import { parseTestStateConfig } from './game/demo'
import { useMatchDialogs } from './hooks/useMatchDialogs'
import { usePendingEffect } from './hooks/usePendingEffect'
import { useAiTurn } from './hooks/useAiTurn'
import { useMatchController } from './hooks/useMatchController'

const aiSimulationSeeds = Array.from({ length: 20 }, (_, index) => index + 1)

const testStateConfig = parseTestStateConfig(
  window.location.search,
  window.location.hostname,
)

function App() {
  const [pendingReveal, setPendingReveal] = useState<{
    card: GameCard
    title: string
    description?: string
    confirmLabel?: string
    onConfirm: () => void
  } | null>(null)
  const dialogs = useMatchDialogs()
  const match = useMatchController({ testStateConfig })
  const pending = usePendingEffect({
    game: match.game,
    setGame: match.setGame,
    viewerPlayerId: match.viewerPlayerId,
    setMessage: match.setMessage,
    clearAttacker: match.clearAttacker,
    setInspectedHpPile: dialogs.openHpPile,
    hasFaint: match.hasFaint,
    faintTargetIds: match.faintTargetIds,
    selectedFaintTargetIds: match.selectedFaintTargetIds,
    faintMinMax: { min: match.faintMin, max: match.faintMax },
    setSelectedFaintTargetIds: match.setSelectedFaintTargetIds,
  })
  const ai = useAiTurn({
    game: match.game,
    setGame: match.setGame,
    setMessage: match.setMessage,
    showPause: dialogs.showPause,
    aiControlsCurrentState: match.aiControlsCurrentState,
    pendingEffect: pending.pendingEffect,
    faintActive: pending.faintActive,
    deckConfig: match.deckConfig,
  })

  const faintActive = pending.faintActive

  const resetGame = (
    nextConfig: { player: DeckChoice; ai: DeckChoice },
    nextMessage: string,
  ) => {
    match.resetMatchState(nextConfig)
    pending.resetEffectContext()
    ai.resetAiCounts()
    match.setMessage(nextMessage)
  }

  const interactionLocked =
    Boolean(pendingReveal) ||
    Boolean(ai.pendingAiDecision) ||
    Boolean(pending.pendingEffect) ||
    Boolean(match.game.pendingOnPlay) ||
    Boolean(match.game.pendingBattle) ||
    Boolean(match.game.pendingOpponentHandDiscard) ||
    faintActive ||
    ai.aiThinking ||
    match.aiControlsCurrentState

  const selectedAttackPaymentIdSet = new Set(match.selectedAttackPaymentIds)

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

  return (
    <main className="game-shell">
      <div className="board-texture" />

      <PhaseRail
        phase={match.game.phase}
        turnNumber={match.game.turnNumber}
        activePlayerName={match.activePlayer.name}
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
        aiThinking={ai.aiThinking}
        aiActionCount={ai.aiActionCount}
        onRunSimulation={ai.runSimulation}
      />

      <MatchToolbar
        deckConfig={match.deckConfig}
        activePlayerName={match.activePlayer.name}
        phase={match.game.phase}
        message={match.message}
        onReset={() => {
          resetGame(
            match.deckConfig,
            `我方 ${deckChoiceLabel[match.deckConfig.player]} vs AI ${deckChoiceLabel[match.deckConfig.ai]} 新對局。`,
          )
        }}
        onViewDeck={() => dialogs.openDeckList('player')}
        onPause={dialogs.openPause}
      />

      <section className="table-area" aria-label="Braverse 對戰桌">
        <BattleRow
          game={match.game}
          playerId={match.opponentId}
          position="top"
          selectedAttackerId={match.selectedAttackerId}
          effectTargetIds={pending.effectTargetIds}
          breakEffectTargetIds={pending.breakEffectTargetIds}
          selectedEffectTargetIds={pending.selectedEffectTargetIds}
          selectedSkillPaymentIds={pending.selectedSkillPaymentIds}
          selectedAttackPaymentIds={selectedAttackPaymentIdSet}
          attackPaymentValid={match.attackPaymentValidation.valid}
          interactionLocked={interactionLocked}
          attackShakeId={match.attackShakeId}
          damageFlashId={match.damageFlashId}
          faintAnimIds={match.faintAnimIds}
          drawAnimIds={match.drawAnimIds}
          onAttackTarget={match.handleAttackTarget}
          onEffectTarget={pending.toggleEffectTarget}
          onInspectCard={dialogs.openCardDetail}
          onInspectDiscard={dialogs.openDiscardPile}
        />

        <div className="table-divider">
          <span />
          <strong>
            {ai.aiThinking ? (
              <>
                <Sparkles aria-hidden="true" /> AI 思考中
              </>
            ) : pending.pendingEffect ? (
              <>
                <Sparkles aria-hidden="true" /> 選擇效果目標
              </>
            ) : faintActive ? (
              <>
                <Sparkles aria-hidden="true" /> 選擇昏厥效果目標
              </>
            ) : match.selectedAttackerId ? (
              <>
                <Swords aria-hidden="true" /> 選擇攻擊目標
              </>
            ) : (
              `${match.activePlayer.name} · ${phaseLabels[match.game.phase]}`
            )}
          </strong>
          <span />
        </div>

        <BattleRow
          game={match.game}
          playerId={match.viewerPlayerId}
          position="bottom"
          selectedAttackerId={match.selectedAttackerId}
          effectTargetIds={pending.effectTargetIds}
          breakEffectTargetIds={pending.breakEffectTargetIds}
          selectedEffectTargetIds={pending.selectedEffectTargetIds}
          selectedSkillPaymentIds={pending.selectedSkillPaymentIds}
          selectedAttackPaymentIds={selectedAttackPaymentIdSet}
          attackPaymentValid={match.attackPaymentValidation.valid}
          interactionLocked={interactionLocked}
          attackShakeId={match.attackShakeId}
          damageFlashId={match.damageFlashId}
          faintAnimIds={match.faintAnimIds}
          drawAnimIds={match.drawAnimIds}
          onSelectAttacker={(instanceId) => {
            match.setSelectedAttackerId(instanceId)
            match.setSelectedAttackPaymentIds([])
            match.setMessage('選擇支援卡支付攻擊費用。')
          }}
          onEffectTarget={pending.toggleEffectTarget}
          onPlaceSupport={(instanceId) =>
            match.runAction(
              (current) =>
                advancePhase(placeSupportCard(current, instanceId)),
              '已將卡牌配置到支援區，進入主要階段。',
            )
          }
          onSkillPayment={pending.toggleSkillPayment}
          onAttackPayment={match.toggleAttackPayment}
          onActivateSkill={(instanceId) => {
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
          }}
          onDeployCookie={(instanceId) =>
            match.runAction(
              (current) => deployCookie(current, instanceId),
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
            )
          }
          onPlayItem={(instanceId) => {
            if (
              !canPlayItem(match.game, match.activePlayer.id, instanceId)
            ) {
              match.setMessage('目前無法使用物品卡。')
              return
            }
            const card = match.activePlayer.hand.find(
              (candidate) => candidate.instanceId === instanceId,
            )
            if (card?.item) {
              setPendingReveal({
                card,
                title: '物品卡使用宣告',
                description: card.item.text,
                confirmLabel: '確認使用',
                onConfirm: () =>
                  pending.beginCardAbility(
                    card,
                    card.item!,
                    'item',
                    '使用物品',
                  ),
              })
            }
          }}
          onPlayStage={(instanceId) => {
            if (
              !canPlayStage(match.game, match.activePlayer.id, instanceId)
            ) {
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
            match.runAction(
              (current) =>
                playStage(
                  current,
                  match.activePlayer.id,
                  instanceId,
                  paymentIds,
                ),
              `${card.name}已放置到場景區。`,
            )
          }}
          onActivateStage={() => {
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
          }}
          onInspectCard={dialogs.openCardDetail}
          onInspectDiscard={dialogs.openDiscardPile}
        />
      </section>

      {match.selectedAttacker && !pending.pendingEffect && (
        <AttackPaymentPanel
          attackerName={match.selectedAttacker.card.name}
          attackCost={match.selectedAttackCost}
          selectedPaymentCount={match.selectedAttackPaymentIds.length}
          isValid={match.attackPaymentValidation.valid}
          validationReason={match.attackPaymentValidation.reason}
          onCancel={() => {
            match.setSelectedAttackerId(null)
            match.setSelectedAttackPaymentIds([])
            match.setMessage('已取消攻擊。')
          }}
        />
      )}

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
        onSkip={pending.skipOptionalSkill}
        candidateCards={pending.nonBattleEffectCandidateCards}
        onToggleCandidate={pending.toggleEffectTarget}
      />

      {match.setupStep && (
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
      )}

      {match.game.pendingBattle?.stage === 'trap' &&
        match.game.pendingBattle.defenderPlayerId === match.viewerPlayerId &&
        match.playerTrapCandidates.length > 0 && (
          <TrapResponseModal
            cards={match.playerTrapCandidates}
            selectedTrapId={match.selectedTrapId}
            paymentCards={match.game.players[
              match.viewerPlayerId
            ].supportArea
              .filter((support) =>
                match.selectedTrapPaymentIds.includes(
                  support.card.instanceId,
                ),
              )
              .map((support) => support.card)}
            targetCards={match.selectedTrapTargets.map(
              (target) => target.card,
            )}
            onSelectTrap={(id) => {
              match.setSelectedTrapId(id)
              match.setTrapSelectNoTarget(false)
            }}
            onInspectCard={(card) => dialogs.openCardDetail(card)}
            onSkip={() => {
              match.setSelectedTrapId(null)
              match.runAction(
                (current) => skipTrap(current, match.viewerPlayerId),
                '未發動陷阱，進入傷害結算。',
              )
            }}
            onConfirm={() => {
              if (!match.selectedTrap) return
              const trap = match.selectedTrap
              setPendingReveal({
                card: trap,
                title: '陷阱卡發動宣告',
                description: trap.trap?.text ?? trap.effectText,
                confirmLabel: '確認發動',
                onConfirm: () => {
                  match.setSelectedTrapId(null)
                  match.setTrapSelectNoTarget(false)
                  match.runAction(
                    (current) => {
                      const afterTrap = playTrap(
                        current,
                        match.viewerPlayerId,
                        {
                          trapInstanceId: trap.instanceId,
                          paymentIds: match.selectedTrapPaymentIds,
                          targetIds: match.selectedTrapTargets.map(
                            (target) => target.card.instanceId,
                          ),
                          supportTrashIds:
                            match.selectedTrapSupportTrashIds,
                        },
                      )
                      return testStateConfig
                        ? resolveBattleAutomatically(afterTrap)
                        : afterTrap
                    },
                    `已發動${trap.name}。`,
                  )
                },
              })
            }}
            allowEmptyTarget={match.trapAllowEmptyTarget}
            emptyTargetActive={match.trapSelectNoTarget}
            onToggleEmptyTarget={() =>
              match.setTrapSelectNoTarget((v) => !v)
            }
          />
        )}

      {match.game.pendingBattle?.stage === 'flip' &&
        (match.game.pendingBattle.damagePlayerId ??
          match.game.pendingBattle.defenderPlayerId) ===
          match.viewerPlayerId &&
        match.game.pendingBattle.revealedHpCard && (
          <FlipResponseModal
            key={match.game.pendingBattle.revealedHpCard.instanceId}
            card={match.game.pendingBattle.revealedHpCard}
            hand={match.game.players[match.viewerPlayerId].hand}
            discardCount={
              match.game.pendingBattle.revealedHpCard.flip?.cost
                .discardHand ?? 0
            }
            selectedDiscardIds={match.selectedFlipDiscardIds}
            onToggleDiscard={(instanceId) =>
              match.setSelectedFlipDiscardIds((current) =>
                current.includes(instanceId)
                  ? current.filter((id) => id !== instanceId)
                  : [...current, instanceId],
              )
            }
            onSkip={() => {
              match.setSelectedFlipDiscardIds([])
              match.runAction(
                (current) =>
                  resolveFlip(current, match.viewerPlayerId, {
                    activate: false,
                  }),
                '未發動 FLIP，繼續傷害結算。',
              )
            }}
            onActivate={() => {
              match.setSelectedFlipDiscardIds([])
              match.runAction(
                (current) =>
                  resolveFlip(current, match.viewerPlayerId, {
                    activate: true,
                    discardHandIds: match.selectedFlipDiscardIds,
                  }),
                `已發動${match.game.pendingBattle?.revealedHpCard?.name ?? 'FLIP'}。`,
              )
            }}
          />
        )}

      {faintActive && match.faintSourceCard && (
        <div
          className="modal-backdrop"
          role="presentation"
          style={{ pointerEvents: 'none' }}
        >
          <section
            className="faint-response-modal"
            role="dialog"
            style={{ pointerEvents: 'auto' }}
          >
            <h2>{match.faintSourceCard.name} 發動昏厥效果</h2>
            <p className="faint-effect-text">
              {match.faintSourceCard.effectText ??
                match.faintSourceCard.skill?.text ??
                '昏厥效果'}
            </p>
            <p className="faint-target-hint">
              {match.faintMin === 0
                ? `選擇最多 ${match.faintMax} 個對手餅乾作為目標，或略過。`
                : `選擇 ${match.faintMin} 個對手餅乾作為目標。`}
            </p>
            <div className="faint-modal-actions">
              {match.faintMin === 0 && (
                <button
                  type="button"
                  className="modal-button"
                  onClick={() => {
                    match.setSelectedFaintTargetIds([])
                    match.runAction(
                      (current) => applyGameCommand(current, {
                        kind: 'resolve-faint-effect',
                        playerId: match.viewerPlayerId,
                        targetIds: [],
                      }),
                      `${match.faintSourceCard!.name}略過昏厥效果。`,
                    )
                  }}
                >
                  略過
                </button>
              )}
              <button
                type="button"
                className="modal-button primary"
                disabled={
                  match.selectedFaintTargetIds.length === 0 &&
                  match.faintMin !== 0
                }
                onClick={() => {
                  const targets = match.selectedFaintTargetIds
                  match.setSelectedFaintTargetIds([])
                  match.runAction(
                    (current) => applyGameCommand(current, {
                      kind: 'resolve-faint-effect',
                      playerId: match.viewerPlayerId,
                      targetIds: targets,
                    }),
                    `${match.faintSourceCard!.name}發動對${match.faintCandidates.find((c) => c.card.instanceId === targets[0])?.card.name ?? '目標'}的昏厥效果。`,
                  )
                }}
              >
                {match.faintMin === 0 &&
                match.selectedFaintTargetIds.length === 0
                  ? '確認略過'
                  : `確認 (${match.selectedFaintTargetIds.length})`}
              </button>
            </div>
          </section>
        </div>
      )}

      {match.game.pendingOpponentHandDiscard &&
        match.game.pendingOpponentHandDiscard.playerId ===
          match.viewerPlayerId &&
        !pending.pendingEffect && (
          <div
            className="modal-backdrop"
            role="presentation"
            style={{ pointerEvents: 'none' }}
          >
            <section
              className="faint-response-modal"
              role="dialog"
              style={{ pointerEvents: 'auto' }}
            >
              <h2>
                {match.game.pendingOpponentHandDiscard.sourceCardName}{' '}
                要求棄置手牌
              </h2>
              <p className="faint-effect-text">
                {(() => {
                  const source = Object.values(
                    match.game.players,
                  )
                    .flatMap((p) => p.battleArea)
                    .find(
                      (c) =>
                        c.card.instanceId ===
                        match.game.pendingOpponentHandDiscard
                          ?.sourceInstanceId,
                    )
                  return (
                    source?.card.effectText ??
                    source?.card.skill?.text ??
                    '對手必須棄置手牌'
                  )
                })()}
              </p>
              <p className="faint-target-hint">
                必須選擇{' '}
                {match.game.pendingOpponentHandDiscard.count} 張手牌棄置。
              </p>
              <div className="modal-card-options">
                {match.game.players[match.viewerPlayerId].hand.map(
                  (card) => (
                    <button
                      type="button"
                      key={card.instanceId}
                      className={
                        match.selectedOpponentDiscardIds.includes(
                          card.instanceId,
                        )
                          ? 'is-selected'
                          : ''
                      }
                      onClick={() =>
                        match.setSelectedOpponentDiscardIds(
                          (current) =>
                            current.includes(card.instanceId)
                              ? current.filter(
                                  (id) => id !== card.instanceId,
                                )
                              : current.length <
                                  (match.game.pendingOpponentHandDiscard
                                    ?.count ?? 1)
                                ? [...current, card.instanceId]
                                : current,
                        )
                      }
                    >
                      <CardFace card={card} />
                      <span>{card.name}</span>
                    </button>
                  ),
                )}
              </div>
              <div className="faint-modal-actions">
                <button
                  type="button"
                  className="modal-button primary"
                  disabled={
                    match.selectedOpponentDiscardIds.length !==
                    match.game.pendingOpponentHandDiscard.count
                  }
                  onClick={() => {
                    const ids = match.selectedOpponentDiscardIds
                    match.setSelectedOpponentDiscardIds([])
                    match.runAction(
                      (current) =>
                        applyGameCommand(current, {
                          kind: 'resolve-opponent-hand-discard',
                          playerId: match.viewerPlayerId,
                          cardIds: ids,
                        }),
                      `已棄置 ${ids.length} 張手牌。`,
                    )
                  }}
                >
                  確認棄置 ({match.selectedOpponentDiscardIds.length})
                </button>
              </div>
            </section>
          </div>
        )}

      {match.pendingPlayer &&
        match.pendingPlayer.id !== 'player-two' && (
          <DecisionModal
            isRefresh={Boolean(match.game.pendingRefresh)}
            playerName={match.pendingPlayer.name}
            replacementCount={match.replacementTask?.remaining}
            options={match.pendingOptions}
            isOptionDisabled={(card) =>
              !match.game.pendingRefresh &&
              card.type === 'cookie' &&
              match.pendingPlayer!.deck.length < card.hp
            }
            onSkipReplacement={
              match.game.pendingRefresh
                ? undefined
                : () =>
                    match.runAction(
                      (current) =>
                        skipDefeatedCookieReplacement(current),
                      '已選擇不補餅乾。',
                    )
            }
            onSelect={(instanceId) => {
              if (match.game.pendingRefresh) {
                match.runAction(
                  (current) =>
                    refreshDeck(
                      current,
                      match.pendingPlayer!.id,
                      instanceId,
                    ),
                  '牌庫 Refresh 已完成。',
                  (nextGame) => {
                    const onPlay = nextGame.pendingOnPlay
                    if (!onPlay) return
                    const card = nextGame.players[
                      onPlay.playerId
                    ].battleArea.find(
                      (cookie) =>
                        cookie.card.instanceId ===
                        onPlay.sourceInstanceId,
                    )?.card
                    pending.beginCookieSkill(
                      nextGame,
                      card,
                      onPlay.playerId,
                      'on-play',
                      'OnPlay 登場觸發',
                      true,
                    )
                  },
                )
              } else {
                match.runAction(
                  (current) =>
                    replaceDefeatedCookie(current, instanceId),
                  '已補充新的戰鬥區餅乾。',
                  (nextGame) => {
                    if (nextGame.pendingRefresh) return
                    const onPlay = nextGame.pendingOnPlay
                    if (!onPlay) return
                    const card = nextGame.players[
                      onPlay.playerId
                    ].battleArea.find(
                      (cookie) =>
                        cookie.card.instanceId ===
                        onPlay.sourceInstanceId,
                    )?.card
                    pending.beginCookieSkill(
                      nextGame,
                      card,
                      onPlay.playerId,
                      'on-play',
                      'OnPlay 登場觸發',
                      true,
                    )
                  },
                )
              }
            }}
          />
        )}

      {pendingReveal && (
        <CardRevealModal
          card={pendingReveal.card}
          title={pendingReveal.title}
          description={pendingReveal.description}
          confirmLabel={pendingReveal.confirmLabel}
          onConfirm={() => {
            const confirm = pendingReveal.onConfirm
            setPendingReveal(null)
            confirm()
          }}
        />
      )}

      {ai.pendingAiDecision?.revealedCard && (
        <CardRevealModal
          card={ai.pendingAiDecision.revealedCard}
          title="AI 公開卡牌"
          description={
            ai.pendingAiDecision.revealedCard.effectText ??
            ai.pendingAiDecision.description
          }
          confirmLabel="確認並繼續 AI 行動"
          onConfirm={ai.confirmAiDecision}
        />
      )}

      {dialogs.inspectedCard && (
        <CardDetailModal
          card={dialogs.inspectedCard}
          onClose={dialogs.closeCardDetail}
        />
      )}

      {dialogs.inspectedDiscardPlayerId && (
        <CardPileModal
          title={`${match.game.players[dialogs.inspectedDiscardPlayerId].name}棄牌區`}
          cards={
            match.game.players[dialogs.inspectedDiscardPlayerId]
              .discardPile
          }
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

      {dialogs.showPause && (
        <PauseModal
          turnNumber={match.game.turnNumber}
          phaseLabel={phaseLabels[match.game.phase]}
          onResume={dialogs.closePause}
        />
      )}

      {dialogs.showDeckList && (
        <DeckListModal
          deckListOwner={dialogs.deckListOwner}
          viewedDeck={match.deckConfig[dialogs.deckListOwner]}
          onSetDeckListOwner={dialogs.openDeckList}
          onClose={dialogs.closeDeckList}
        />
      )}

      {match.game.result && (
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
      )}
    </main>
  )
}

export default App
