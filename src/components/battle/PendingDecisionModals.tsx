import {
  getEffectTargetCandidates,
  getEnergyCostTotal,
  getRefreshCandidates,
  isEffectTargeted,
  type EnergyColor,
  type EnergyCost,
} from '../../game'
import {
  DecisionModal,
  OptionalCostAttackModal,
  InspectDeckModal,
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

  const optionalCostAttackTargetedEffect = pendingOptionalCost?.effects.find(
    (effect) => isEffectTargeted(effect) || effect.kind === 'opponent-battle-to-trash',
  )
  const needsTarget = Boolean(optionalCostAttackTargetedEffect)
  const optionalCostAttackNeedsTarget = needsTarget
  const opponentBattleCards = (
    optionalCostAttackTargetedEffect
      ? optionalCostAttackTargetedEffect.kind === 'opponent-battle-to-trash'
        ? (() => {
            const btt = optionalCostAttackTargetedEffect as { kind: 'opponent-battle-to-trash'; maxLevel?: number; minLevel?: number; remainingHp?: number }
            return getEffectTargetCandidates(
              match.game,
              {
                sourcePlayerId: match.viewerPlayerId,
                sourceInstanceId: pendingOptionalCost!.sourceInstanceId,
              },
              {
                side: 'opponent',
                min: 1,
                max: 1,
                ...(btt.maxLevel !== undefined ? { maxLevel: btt.maxLevel } : {}),
                ...(btt.minLevel !== undefined ? { minLevel: btt.minLevel } : {}),
                ...(btt.remainingHp !== undefined ? { remainingHp: btt.remainingHp } : {}),
              },
            ).map((cookie) => cookie.card)
          })()
        : getEffectTargetCandidates(
            match.game,
            {
              sourcePlayerId: match.viewerPlayerId,
              sourceInstanceId: pendingOptionalCost!.sourceInstanceId,
            },
            (optionalCostAttackTargetedEffect as { target: import('../../game').EffectTargetSelector }).target,
          ).map((cookie) => cookie.card)
      : match.game.players[match.opponentId].battleArea.map((cookie) => cookie.card)
  ).map((card) => ({ card, instanceId: card.instanceId }))

  const optionalCostAttackEnergyTotal = pendingOptionalCost
    ? getEnergyCostTotal(pendingOptionalCost.cost.energy ?? {})
    : 0
  const optionalCostAttackEnergyCost =
    pendingOptionalCost?.cost.energy ?? ({} as EnergyCost)
  const optionalCostAttackRequiredColors = new Set(
    (Object.keys(optionalCostAttackEnergyCost) as (EnergyColor | 'neutral')[]).filter(
      (k) => (optionalCostAttackEnergyCost[k] ?? 0) > 0,
    ),
  )
  const optionalCostAttackSupportCandidates = match.game.players[
    match.viewerPlayerId
  ].supportArea
    .filter((support) => !support.rested)
    .filter((support) => {
      if (optionalCostAttackEnergyTotal <= 0) return true
      if (!support.card.energyColor) return false
      if (support.card.energyColor === 'wild') return true
      if (optionalCostAttackRequiredColors.size === 0) return false
      if (
        optionalCostAttackRequiredColors.size === 1 &&
        optionalCostAttackRequiredColors.has('neutral')
      )
        return true
      return optionalCostAttackRequiredColors.has(support.card.energyColor)
    })
    .map((support) => ({ card: support.card, instanceId: support.card.instanceId }))

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
        match.pendingPlayer.id !== 'player-two' && (
          <DecisionModal
            isRefresh={Boolean(match.game.pendingRefresh)}
            playerName={match.pendingPlayer.name}
            replacementCount={match.replacementTask?.remaining}
            options={match.pendingOptions}
            isOptionDisabled={() => false}
            onSkipReplacement={
              match.game.pendingRefresh
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

      {pendingOptionalCost && (
        <OptionalCostAttackModal
          key={pendingOptionalCost.sourceInstanceId}
          sourceCardName={pendingOptionalCost.sourceCardName}
          effectText={pendingOptionalCost.effectText}
          discardHandCost={pendingOptionalCost.cost.discardHand ?? 0}
          energyCostTotal={optionalCostAttackEnergyTotal}
          playerHand={match.game.players[match.viewerPlayerId].hand}
          supportCandidates={optionalCostAttackSupportCandidates}
          opponentBattleCards={opponentBattleCards}
          needsTarget={optionalCostAttackNeedsTarget}
          onSkip={() => {
            match.dispatch(
              {
                kind: 'resolve-optional-cost-attack',
                playerId: match.viewerPlayerId,
                action: 'skip',
              },
              '已略過可選代價攻擊效果。',
            )
          }}
          onPay={(discardIds, targetId, paymentIds) => {
            match.dispatch(
              {
                kind: 'resolve-optional-cost-attack',
                playerId: match.viewerPlayerId,
                action: 'pay',
                discardCardIds: discardIds,
                targetIds: targetId ? [targetId] : [],
                paymentIds,
              },
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
            match.dispatch(
              {
                kind: 'resolve-inspect-deck',
                playerId: match.viewerPlayerId,
                pickedCardId: pickedId,
                restOrder,
              },
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
