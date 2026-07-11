import { useState } from 'react'
import { Swords } from 'lucide-react'
import type { GameState, PlayerId } from '../../game'
import { selectEnergyPayment } from '../../game'
import { useOnlineMatchController } from '../../hooks/useOnlineMatchController'
import { useOnlinePendingEffect } from '../../hooks/useOnlinePendingEffect'
import { BattleRow } from './BattleRow'
import { PhaseRail } from '../layout/PhaseRail'
import { AttackPaymentPanel } from '../panels/GameStatusPanels'
import { StatusToast, CardPreviewPanel } from '../panels/InteractionOverlays'
import { EffectPanel } from '../effects/EffectPanel'
import { BattleResponseModals } from './BattleResponseModals'
import { DamageEffectModals } from './DamageEffectModals'
import { PendingDecisionModals } from './PendingDecisionModals'
import { ResultModal } from '../modals/GameModals'
import { phaseLabels } from '../gameUiLabels'
import type { GameCard } from '../../game'

export interface OnlineBattleViewProps {
  game: GameState
  viewerPlayerId: PlayerId
  roomCode: string | null
  sendCommand: (command: import('../../game').GameCommand) => void
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
  onLeave,
}: OnlineBattleViewProps) {
  const [hoveredCard, setHoveredCard] = useState<GameCard | null>(null)
  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(
    null,
  )

  const match = useOnlineMatchController({ game, viewerPlayerId, sendCommand })
  const pending = useOnlinePendingEffect({
    game,
    viewerPlayerId,
    dispatch: match.dispatch,
    hasFaint: match.hasFaint,
    hasAfterDamage: match.hasAfterDamage,
  })

  const opponentId = match.opponentId
  const viewerPlayer = game.players[viewerPlayerId]

  if (game.status === 'setup') {
    const needsMulliganDecision = !viewerPlayer.freeMulliganDecided
    const needsStartingCookie =
      !needsMulliganDecision && !viewerPlayer.startingCookieSelected

    return (
      <main className="game-shell">
        <div className="board-texture" />
        <section className="online-setup">
          <h2>開局準備</h2>
          <p>房號：{roomCode}</p>
          {needsMulliganDecision && (
            <>
              <p>是否要重新抽取整副起始手牌？</p>
              <div className="online-setup-actions">
                <button
                  className="online-setup-btn"
                  type="button"
                  onClick={() =>
                    match.dispatch(
                      { kind: 'keep-opening-hand', playerId: viewerPlayerId },
                      '保留起始手牌。',
                    )
                  }
                >
                  保留手牌
                </button>
                <button
                  className="online-setup-btn"
                  type="button"
                  onClick={() =>
                    match.dispatch(
                      {
                        kind: 'mulligan-opening-hand',
                        playerId: viewerPlayerId,
                      },
                      '已重新抽取起始手牌。',
                    )
                  }
                >
                  全部調度
                </button>
              </div>
            </>
          )}
          {needsStartingCookie && (
            <>
              <p>請選擇一張起始餅乾：</p>
              <div className="online-setup-actions">
                {viewerPlayer.hand
                  .filter((card) => card.type === 'cookie')
                  .map((card) => (
                    <button
                      key={card.instanceId}
                      className="online-setup-btn"
                      type="button"
                      onClick={() =>
                        match.dispatch(
                          {
                            kind: 'select-starting-cookie',
                            playerId: viewerPlayerId,
                            instanceId: card.instanceId,
                          },
                          `已選擇${card.name}作為起始餅乾。`,
                        )
                      }
                    >
                      {card.name}
                    </button>
                  ))}
              </div>
            </>
          )}
          {!needsMulliganDecision && !needsStartingCookie && (
            <p>等待對手完成開局準備…</p>
          )}
          <button
            className="online-setup-leave"
            type="button"
            onClick={onLeave}
          >
            離開對局
          </button>
        </section>
      </main>
    )
  }

  const selectedAttackPaymentIdSet = new Set(match.selectedAttackPaymentIds)
  const trapPaymentIdSetOnline = new Set(match.selectedTrapPaymentIds)
  const effectTargetIds = new Set(
    pending.candidateCards.map((card) => card.instanceId),
  )
  const selectedEffectTargetIds = new Set(pending.selectedTargetIds)

  const interactionLocked =
    Boolean(pending.pendingEffect) ||
    Boolean(game.pendingBattle) ||
    Boolean(game.pendingOnPlay) ||
    !match.viewerControlsState

  const phaseDisabled =
    game.status === 'finished' ||
    Boolean(game.pendingReplacement) ||
    Boolean(game.pendingOnPlay) ||
    Boolean(game.pendingRefresh) ||
    Boolean(game.pendingFaintEffects && game.pendingFaintEffects.length > 0) ||
    Boolean(pending.pendingEffect)

  return (
    <main className="game-shell">
      <div className="board-texture" />

      <StatusToast message={match.message} />

      <PhaseRail
        phase={game.phase}
        turnNumber={game.turnNumber}
        activePlayerName={match.activePlayer.name}
        isPlayerTurn={game.activePlayerId === viewerPlayerId}
        disabled={
          phaseDisabled ||
          game.activePlayerId !== viewerPlayerId ||
          game.phase === 'active' ||
          game.phase === 'draw'
        }
        onAdvance={() => {
          if (pending.pendingEffect) return
          match.handleAdvancePhase()
        }}
      />

      <section className="table-area" aria-label="Braverse 線上對戰桌">
        <BattleRow
          game={game}
          playerId={opponentId}
          position="top"
          selectedAttackerId={match.selectedAttackerId}
          effectTargetIds={effectTargetIds}
          breakEffectTargetIds={new Set()}
          selectedEffectTargetIds={selectedEffectTargetIds}
          selectedSkillPaymentIds={new Set()}
          selectedAttackPaymentIds={selectedAttackPaymentIdSet}
          attackPaymentValid={match.attackPaymentValidation.valid}
          interactionLocked={interactionLocked}
          attackShakeId={match.attackShakeId}
          damageFlashId={match.damageFlashId}
          faintAnimIds={match.faintAnimIds}
          drawAnimIds={match.drawAnimIds}
          onAttackTarget={match.handleAttackTarget}
          onEffectTarget={pending.toggleTarget}
          onInspectCard={setHoveredCard}
          onInspectDiscard={() => {}}
          onHoverCard={setHoveredCard}
          onFocusCard={setHoveredCard}
        />

        <div className="table-divider">
          <span />
          <div role="status" aria-live="polite">
            <strong>
              {pending.pendingEffect ? (
                <>選擇效果目標</>
              ) : match.selectedAttackerId ? (
                <>
                  <Swords aria-hidden="true" />{' '}
                  {match.attackPaymentValidation.valid
                    ? '付款完成，選擇攻擊目標'
                    : '選擇支援卡支付攻擊費用'}
                </>
              ) : (
                `${match.activePlayer.name} · ${phaseLabels[game.phase]}`
              )}
            </strong>
          </div>
          <span />
        </div>

        <BattleRow
          game={game}
          playerId={viewerPlayerId}
          position="bottom"
          selectedAttackerId={match.selectedAttackerId}
          effectTargetIds={effectTargetIds}
          breakEffectTargetIds={new Set()}
          selectedEffectTargetIds={selectedEffectTargetIds}
          selectedSkillPaymentIds={new Set()}
          selectedAttackPaymentIds={selectedAttackPaymentIdSet}
          selectedTrapPaymentIds={trapPaymentIdSetOnline}
          trapPaymentTargetIds={match.trapPaymentTargetIds}
          onTrapPayment={match.toggleTrapPayment}
          attackPaymentValid={match.attackPaymentValidation.valid}
          interactionLocked={interactionLocked}
          selectedHandCardId={selectedHandCardId}
          onSelectHandCard={setSelectedHandCardId}
          attackShakeId={match.attackShakeId}
          damageFlashId={match.damageFlashId}
          faintAnimIds={match.faintAnimIds}
          drawAnimIds={match.drawAnimIds}
          onSelectAttacker={(instanceId) => {
            match.setSelectedAttackerId(instanceId)
            match.setSelectedAttackPaymentIds([])
            match.setMessage('選擇支援卡支付攻擊費用。')
          }}
          onEffectTarget={pending.toggleTarget}
          onPlaceSupport={(instanceId) =>
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
            )
          }
          onAttackPayment={match.toggleAttackPayment}
          onActivateSkill={(instanceId) => {
            const card = viewerPlayer.battleArea.find(
              (cookie) => cookie.card.instanceId === instanceId,
            )?.card
            if (card) pending.beginCookieSkill(card, 'activate')
          }}
          onDeployCookie={(instanceId) =>
            match.dispatch(
              {
                kind: 'deploy-cookie',
                playerId: match.activePlayer.id,
                instanceId,
              },
              '新餅乾已登場並配置 HP。',
            )
          }
          onPlayItem={(instanceId) => {
            const card = viewerPlayer.hand.find(
              (candidate) => candidate.instanceId === instanceId,
            )
            if (card) pending.beginPlayItem(card)
          }}
          onPlayStage={(instanceId) => {
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
          }}
          onActivateStage={() => pending.beginActivateStage()}
          onInspectCard={setHoveredCard}
          onInspectDiscard={() => {}}
          onHoverCard={setHoveredCard}
          onFocusCard={setHoveredCard}
        />
      </section>

      <CardPreviewPanel card={hoveredCard} position="bottom" />

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

      <EffectPanel
        pendingEffect={pending.pendingEffect}
        currentEffect={pending.currentEffect}
        effectHistory={pending.effectHistory}
        onConfirm={pending.confirmEffect}
        onSkip={() => {}}
        candidateCards={pending.candidateCards}
        onToggleCandidate={pending.toggleTarget}
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
    </main>
  )
}
