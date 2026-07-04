import { applyGameCommand, getRefreshCandidates } from '../../game'
import {
  DecisionModal,
  OptionalCostAttackModal,
  InspectDeckModal,
  DrawUpToResponseModal,
  HandDiscardResponseModal,
  EffectOrderModal,
} from '../modals/GameModals'
import type { useMatchController } from '../../hooks/useMatchController'
import type { usePendingEffect } from '../../hooks/usePendingEffect'

export interface PendingDecisionModalsProps {
  match: ReturnType<typeof useMatchController>
  pending: ReturnType<typeof usePendingEffect>
}

export function PendingDecisionModals({ match, pending }: PendingDecisionModalsProps) {
  const pendingInspect =
    match.game.pendingInspectDeck &&
    match.game.pendingInspectDeck.playerId === match.viewerPlayerId &&
    !match.game.pendingRefresh &&
    !(
      match.game.pendingEffectOrder &&
      !match.game.pendingEffectOrder.resolvedOrder
    )
      ? match.game.pendingInspectDeck
      : null

  const pendingOptionalCost =
    match.game.pendingOptionalCostAttack &&
    match.game.pendingOptionalCostAttack.playerId === match.viewerPlayerId &&
    !(
      match.game.pendingEffectOrder &&
      !match.game.pendingEffectOrder.resolvedOrder
    )
      ? match.game.pendingOptionalCostAttack
      : null

  const pendingEffectOrder =
    match.game.pendingEffectOrder &&
    !match.game.pendingEffectOrder.resolvedOrder &&
    match.game.pendingEffectOrder.playerId === match.viewerPlayerId &&
    !match.game.pendingReplacement &&
    !match.game.pendingRefresh &&
    !match.game.pendingOnPlay
      ? match.game.pendingEffectOrder
      : null

  const opponentBattleCards = match.game.players[
    match.opponentId
  ].battleArea.map((cookie) => ({
    card: cookie.card,
    instanceId: cookie.card.instanceId,
  }))

  return (
    <>
      {match.game.pendingOpponentHandDiscard &&
        match.game.pendingOpponentHandDiscard.playerId ===
          match.viewerPlayerId &&
        !pending.pendingEffect && (() => {
          const handDiscard = match.game.pendingOpponentHandDiscard
          const sourceCard = Object.values(match.game.players)
            .flatMap((player) => [
              ...player.battleArea.map((entry) => entry.card),
              ...player.hand,
              ...player.discardPile,
              ...player.supportArea.map((entry) => entry.card),
              ...(player.stage ? [player.stage.card] : []),
            ])
            .find((card) => card.instanceId === handDiscard.sourceInstanceId)
          const effectText =
            sourceCard?.effectText ??
            sourceCard?.skill?.text ??
            sourceCard?.trap?.text ??
            sourceCard?.item?.text ??
            (handDiscard.effectText !== 'discard-hand' &&
            handDiscard.effectText !== 'opponent-discard-hand'
              ? handDiscard.effectText
              : undefined)

          return (
            <HandDiscardResponseModal
              sourceCardName={handDiscard.sourceCardName}
              sourceCard={sourceCard}
              effectText={effectText}
              hand={match.game.players[match.viewerPlayerId].hand}
              requiredCount={handDiscard.count}
              selectedIds={match.selectedOpponentDiscardIds}
              onToggleCard={(instanceId) =>
                match.setSelectedOpponentDiscardIds((current) =>
                  current.includes(instanceId)
                    ? current.filter((id) => id !== instanceId)
                    : current.length < handDiscard.count
                      ? [...current, instanceId]
                      : current,
                )
              }
              onConfirm={() => {
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
            />
          )
        })()}

      {match.game.pendingDrawUpTo &&
        match.game.pendingDrawUpTo.playerId ===
          match.viewerPlayerId &&
        !pendingEffectOrder &&
        !pending.pendingEffect && (() => {
          const drawUpTo = match.game.pendingDrawUpTo
          const sourceCard = Object.values(match.game.players)
            .flatMap((p) => p.battleArea)
            .find((c) => c.card.instanceId === drawUpTo.sourceInstanceId)
          const sourceInHand = match.game.players[match.viewerPlayerId].hand
            .find((c) => c.instanceId === drawUpTo.sourceInstanceId)
          const sourceInDiscard = match.game.players[match.viewerPlayerId].discardPile
            .find((c) => c.instanceId === drawUpTo.sourceInstanceId)
          const sourceInSupport = match.game.players[match.viewerPlayerId].supportArea
            .find((c) => c.card.instanceId === drawUpTo.sourceInstanceId)
          const sourceDisplayCard =
            sourceCard?.card ??
            sourceInHand ??
            sourceInDiscard ??
            sourceInSupport?.card
          const effectText = drawUpTo.effectText
            ?? sourceCard?.card.effectText
            ?? sourceInHand?.effectText
            ?? sourceInDiscard?.effectText
            ?? sourceInSupport?.card.effectText
            ?? (sourceInHand && 'item' in sourceInHand && sourceInHand.item
              ? sourceInHand.item.text
              : undefined)
            ?? (sourceInDiscard && 'item' in sourceInDiscard && sourceInDiscard.item
              ? sourceInDiscard.item.text
              : undefined)
          return (
            <DrawUpToResponseModal
              sourceCardName={drawUpTo.sourceCardName}
              sourceCard={sourceDisplayCard}
              effectText={effectText}
              max={drawUpTo.max}
              deckSize={match.game.players[match.viewerPlayerId].deck.length}
              onConfirm={(drawCount) => {
                match.runAction(
                  (current) =>
                    applyGameCommand(current, {
                      kind: 'resolve-draw-up-to',
                      playerId: match.viewerPlayerId,
                      drawCount,
                    }),
                  drawCount === 0
                    ? '已選擇不抽牌。'
                    : `已從牌庫抽取 ${drawCount} 張牌。`,
                )
              }}
            />
          )
        })()}

      {match.game.pendingStageTrigger &&
        match.game.pendingStageTrigger.playerId ===
          match.viewerPlayerId &&
        !pendingEffectOrder &&
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
              <h2>{match.game.pendingStageTrigger.sourceCardName} 效果</h2>
              <p className="faint-effect-text">
                {match.game.pendingStageTrigger.effectText}
              </p>
              <p className="faint-target-hint">
                是否發動效果抽 1 張牌？
              </p>
              <div className="faint-modal-actions">
                <button
                  type="button"
                  className="modal-button"
                  onClick={() => {
                    match.runAction(
                      (current) =>
                        applyGameCommand(current, {
                          kind: 'resolve-stage-trigger',
                          playerId: match.viewerPlayerId,
                          action: 'skip',
                        }),
                      '已略過場景效果。',
                    )
                  }}
                >
                  略過
                </button>
                <button
                  type="button"
                  className="modal-button primary"
                  disabled={
                    match.game.players[match.viewerPlayerId].deck.length === 0 &&
                    getRefreshCandidates(
                      match.game,
                      match.viewerPlayerId,
                    ).length === 0
                  }
                  onClick={() => {
                    match.runAction(
                      (current) =>
                        applyGameCommand(current, {
                          kind: 'resolve-stage-trigger',
                          playerId: match.viewerPlayerId,
                          action: 'activate',
                        }),
                      '已發動場景效果抽 1 張牌。',
                    )
                  }}
                >
                  發動
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
                        applyGameCommand(current, {
                          kind: 'skip-replacement',
                          playerId: match.pendingPlayer!.id,
                        }),
                      '已選擇不補餅乾。',
                    )
            }
            onSelect={(instanceId) => {
              if (match.game.pendingRefresh) {
                match.runAction(
                  (current) =>
                    applyGameCommand(current, {
                      kind: 'refresh-deck',
                      playerId: match.pendingPlayer!.id,
                      cookieInstanceId: instanceId,
                    }),
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
                    applyGameCommand(current, {
                      kind: 'replace-cookie',
                      playerId: match.pendingPlayer!.id,
                      instanceId,
                    }),
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

      {pendingEffectOrder && !pending.pendingEffect && (
        <EffectOrderModal
          items={pendingEffectOrder.items}
          onConfirm={(orderedIds) => {
            match.runAction(
              (current) =>
                applyGameCommand(current, {
                  kind: 'resolve-effect-order',
                  playerId: match.viewerPlayerId,
                  orderedIds,
                }),
              '已決定同時觸發效果的處理順序。',
            )
          }}
        />
      )}

      {pendingOptionalCost && (
        <OptionalCostAttackModal
          key={pendingOptionalCost.sourceInstanceId}
          sourceCardName={pendingOptionalCost.sourceCardName}
          effectText={pendingOptionalCost.effectText}
          discardHandCost={pendingOptionalCost.cost.discardHand ?? 0}
          playerHand={match.game.players[match.viewerPlayerId].hand}
          opponentBattleCards={opponentBattleCards}
          onSkip={() => {
            match.runAction(
              (current) =>
                applyGameCommand(current, {
                  kind: 'resolve-optional-cost-attack',
                  playerId: match.viewerPlayerId,
                  action: 'skip',
                }),
              '已略過可選代價攻擊效果。',
            )
          }}
          onPay={(discardIds, targetId) => {
            match.runAction(
              (current) =>
                applyGameCommand(current, {
                  kind: 'resolve-optional-cost-attack',
                  playerId: match.viewerPlayerId,
                  action: 'pay',
                  discardCardIds: discardIds,
                  targetIds: [targetId],
                }),
              '已支付可選代價攻擊效果。',
            )
          }}
        />
      )}

      {pendingInspect && (
        <InspectDeckModal
          key={pendingInspect.sourceInstanceId}
          sourceCardName={pendingInspect.sourceCardName}
          revealedCards={pendingInspect.revealedCards}
          pickCount={pendingInspect.pickCount}
          filterColor={pendingInspect.filterColor}
          onConfirm={(pickedId, restOrder) => {
            match.runAction(
              (current) =>
                applyGameCommand(current, {
                  kind: 'resolve-inspect-deck',
                  playerId: match.viewerPlayerId,
                  pickedCardId: pickedId,
                  restOrder,
                }),
              pickedId !== null
                ? `已選擇卡牌加入手牌，其餘放回牌庫底。`
                : `沒有符合顏色的卡牌，全部放回牌庫底。`,
            )
          }}
        />
      )}
    </>
  )
}
