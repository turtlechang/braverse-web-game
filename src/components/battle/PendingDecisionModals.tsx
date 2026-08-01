import { useEffect } from 'react'
import { getRefreshCandidates } from '../../game'
import {
  DecisionModal,
  InspectDeckModal,
  RevealTopDeckModal,
  DrawUpToResponseModal,
  HandDiscardResponseModal,
  EffectOrderModal,
} from '../modals/GameModals'
import type {
  BattleUiMatchLike,
  BattleUiPendingEffectLike,
} from '../../hooks/battleUiContracts'

export interface PendingDecisionModalsProps {
  match: BattleUiMatchLike
  pending: BattleUiPendingEffectLike
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

  const pendingReveal =
    match.game.pendingRevealTopDeck &&
    !(
      match.game.pendingEffectOrder &&
      !match.game.pendingEffectOrder.resolvedOrder
    )
      ? match.game.pendingRevealTopDeck
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

  const pendingDrawUpTo =
    match.game.pendingDrawUpTo &&
    match.game.pendingDrawUpTo.playerId === match.viewerPlayerId &&
    !pendingEffectOrder &&
    !pending.pendingEffect
      ? match.game.pendingDrawUpTo
      : null

  const autoResolveDrawUpTo = pendingDrawUpTo?.max === 1
  const pendingStageTrigger = match.game.pendingStageTrigger
  const isCookieSkillTrigger = pendingStageTrigger?.sourceKind === 'cookie-skill'
  const mustReplaceEmptyBattleArea =
    !match.game.pendingRefresh &&
    match.pendingPlayer?.battleArea.length === 0 &&
    match.pendingOptions.length > 0

  useEffect(() => {
    if (!autoResolveDrawUpTo || !pendingDrawUpTo) return
    const deckSize = match.game.players[match.viewerPlayerId].deck.length
    const drawCount = Math.min(1, deckSize)
    match.dispatch(
      {
        kind: 'resolve-draw-up-to',
        playerId: match.viewerPlayerId,
        drawCount,
      },
      drawCount === 0 ? '已選擇不抽牌。' : `已從牌庫抽取 ${drawCount} 張牌。`,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoResolveDrawUpTo, pendingDrawUpTo?.sourceInstanceId])

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
              continuesFromDraw={handDiscard.chainedFromDrawUpTo}
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
                match.dispatch(
                  {
                    kind: 'resolve-opponent-hand-discard',
                    playerId: match.viewerPlayerId,
                    cardIds: ids,
                  },
                  `已棄置 ${ids.length} 張手牌。`,
                )
              }}
            />
          )
        })()}

      {pendingDrawUpTo && !autoResolveDrawUpTo && (() => {
          const drawUpTo = pendingDrawUpTo
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
              followedByDiscard={Boolean(
                drawUpTo.afterEffects?.some((effect) => effect.kind === 'discard-hand'),
              )}
              onConfirm={(drawCount) => {
                match.dispatch(
                  {
                    kind: 'resolve-draw-up-to',
                    playerId: match.viewerPlayerId,
                    drawCount,
                  },
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
              <h2>
                {pendingStageTrigger?.sourceCardName}{' '}
                {isCookieSkillTrigger ? '技能' : '效果'}
              </h2>
              <p className="faint-effect-text">
                {pendingStageTrigger?.effectText}
              </p>
              <p className="faint-target-hint">
                {isCookieSkillTrigger
                  ? '是否發動此技能？'
                  : '是否發動效果抽 1 張牌？'}
              </p>
              <div className="faint-modal-actions">
                <button
                  type="button"
                  className="modal-button"
                  onClick={() => {
                    match.dispatch(
                      {
                        kind: 'resolve-stage-trigger',
                        playerId: match.viewerPlayerId,
                        action: 'skip',
                      },
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
                    match.dispatch(
                      {
                        kind: 'resolve-stage-trigger',
                        playerId: match.viewerPlayerId,
                        action: 'activate',
                      },
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
        match.pendingPlayer.id === match.viewerPlayerId && (
          <DecisionModal
            isRefresh={Boolean(match.game.pendingRefresh)}
            playerName={match.pendingPlayer.name}
            replacementCount={match.replacementTask?.remaining}
            options={match.pendingOptions}
            isOptionDisabled={() => false}
            onSkipReplacement={
              match.game.pendingRefresh || mustReplaceEmptyBattleArea
                ? undefined
                : () =>
                    match.dispatch(
                      {
                        kind: 'skip-replacement',
                        playerId: match.pendingPlayer!.id,
                      },
                      '已選擇不補餅乾。',
                    )
            }
            onSelect={(instanceId) => {
              if (match.game.pendingRefresh) {
                match.dispatch(
                  {
                    kind: 'refresh-deck',
                    playerId: match.pendingPlayer!.id,
                    cookieInstanceId: instanceId,
                  },
                  '牌庫 Refresh 已完成。',
                  (nextGame) => pending.handleOnPlayTrigger(nextGame),
                )
              } else {
                match.dispatch(
                  {
                    kind: 'replace-cookie',
                    playerId: match.pendingPlayer!.id,
                    instanceId,
                  },
                  '已補充新的戰鬥區餅乾。',
                  (nextGame) => {
                    if (nextGame.pendingRefresh) return
                    pending.handleOnPlayTrigger(nextGame)
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
            match.dispatch(
              {
                kind: 'resolve-effect-order',
                playerId: match.viewerPlayerId,
                orderedIds,
              },
              '已決定同時觸發效果的處理順序。',
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
          restDestination={pendingInspect.restDestination}
          pickDestination={pendingInspect.pickDestination}
          filterColor={pendingInspect.filterColor}
          filterType={pendingInspect.filterType}
          optionalPick={pendingInspect.optionalPick}
          onConfirm={(pickedCardIds, restOrder) => {
            const restLabel =
              pendingInspect.restDestination === 'trash'
                ? '棄牌區'
                : pendingInspect.restDestination === 'top'
                  ? '牌庫頂'
                  : '牌庫底'
            match.dispatch(
              {
                kind: 'resolve-inspect-deck',
                playerId: match.viewerPlayerId,
                pickedCardIds,
                restOrder,
              },
              pickedCardIds.length > 0
                ? `已選擇卡牌${
                    pendingInspect.pickDestination === 'battle'
                      ? '登場'
                      : '加入手牌'
                  }，其餘放入${restLabel}。`
                : `沒有選擇卡牌，全部放入${restLabel}。`,
            )
          }}
        />
      )}

      {pendingReveal && (
        <RevealTopDeckModal
          key={pendingReveal.sourceInstanceId}
          sourceCardName={pendingReveal.sourceCardName}
          revealedCard={pendingReveal.revealedCard}
          matched={pendingReveal.matched}
          canConfirm={pendingReveal.playerId === match.viewerPlayerId}
          onConfirm={() => {
            if (pendingReveal.playerId !== match.viewerPlayerId) return
            match.dispatch(
              {
                kind: 'resolve-reveal-top-deck',
                playerId: match.viewerPlayerId,
              },
              pendingReveal.matched
                ? `翻到 ${pendingReveal.revealedCard.name}，條件匹配！`
                : `翻到 ${pendingReveal.revealedCard.name}，條件未匹配。`,
            )
          }}
        />
      )}
    </>
  )
}
