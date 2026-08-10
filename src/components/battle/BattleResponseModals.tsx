import {
  getEffectSelectionLimits,
  getEffectTargetCandidates,
  requiresTargetSelection,
} from '../../game'
import type { CardEffect, GameCommand } from '../../game'
import {
  AttackResponseModal,
  TrapResponseModal,
  BlockerResponseModal,
  FlipResponseModal,
} from '../modals/GameModals'
import type { BattleUiMatchLike } from '../../hooks/battleUiContracts'
import { getUnmetTrapConditionWarning } from './trapWarnings'

export interface BattleResponseModalsProps {
  match: BattleUiMatchLike
}

export function BattleResponseModals({ match }: BattleResponseModalsProps) {
  const findBattleCard = (instanceId: string | null | undefined) => {
    if (!instanceId) return null

    return (
      Object.values(match.game.players)
        .flatMap((player) => player.battleArea)
        .find(({ card }) => card.instanceId === instanceId)?.card ?? null
    )
  }
  const pendingBattle = match.game.pendingBattle
  const attackAttackerCard = findBattleCard(pendingBattle?.attackerInstanceId)
  const attackTargetCard = findBattleCard(pendingBattle?.targetInstanceId)
  const flipChooseOneEffect =
    pendingBattle?.revealedHpCard?.flip?.effects.find(
      (effect): effect is Extract<CardEffect, { kind: 'choose-one' }> =>
        effect.kind === 'choose-one',
    )
  const flipPlayerId = pendingBattle
    ? pendingBattle.damagePlayerId ?? pendingBattle.defenderPlayerId
    : null
  const flipTargetEffect = pendingBattle?.revealedHpCard?.flip?.effects.find(
    (effect) => requiresTargetSelection(effect),
  )
  const flipTargetSelector =
    flipTargetEffect && 'target' in flipTargetEffect
      ? flipTargetEffect.target
      : null
  const flipTargetContext =
    pendingBattle && flipPlayerId
      ? {
          sourcePlayerId: flipPlayerId,
          sourceInstanceId: pendingBattle.revealedHpCard?.instanceId ?? '',
          sourceCardName: pendingBattle.revealedHpCard?.name,
        }
      : null
  const flipTargetCandidates =
    flipTargetSelector && flipTargetContext
      ? getEffectTargetCandidates(
          match.game,
          flipTargetContext,
          flipTargetSelector,
        ).map((candidate) => candidate.card)
      : []
  const flipTargetLimits = flipTargetEffect
    ? getEffectSelectionLimits(flipTargetEffect)
    : null

  return (
    <>
      {match.game.pendingBattle?.stage === 'trap' &&
        match.game.pendingBattle.defenderPlayerId === match.viewerPlayerId &&
        match.playerTrapCandidates.length > 0 &&
        match.playerBlockerCandidates.length > 0 &&
        match.pendingResponseMode === null && (
          <AttackResponseModal
            trapCards={match.playerTrapCandidates}
            blockerCards={match.playerBlockerCandidates}
            attackerCard={attackAttackerCard}
            attackTargetCard={attackTargetCard}
            onSelectTrap={(id) => {
              match.setPendingResponseMode('trap')
              match.setSelectedTrapId(id)
              match.selectTrapCostOption(0)
              match.setSelectedTrapTrashCookieToBreakAreaIds([])
              match.setSelectedTrapDiscardIds([])
              match.setSelectedTrapHandToBreakIds([])
              match.setSelectedTrapTrashBattleCookieIds([])
              match.setSelectedTrapTargetId(null)
              match.setTrapSelectNoTarget(false)
              match.setSelectedTrapSupportTrashIds([])
              match.setSelectedTrapTrashToDeckIds([])
            }}
            onSelectBlocker={(id) => {
              match.setPendingResponseMode('blocker')
              match.setSelectedBlockerId(id)
            }}
            onSkip={() => {
              match.dispatch(
                { kind: 'skip-trap', playerId: match.viewerPlayerId },
                '未發動回應，進入傷害結算。',
              )
            }}
          />
        )}

      {match.game.pendingBattle?.stage === 'trap' &&
        match.game.pendingBattle.defenderPlayerId === match.viewerPlayerId &&
        match.playerTrapCandidates.length > 0 &&
        (match.playerBlockerCandidates.length === 0 ||
          match.pendingResponseMode === 'trap') && (
          <TrapResponseModal
            cards={match.playerTrapCandidates}
            selectedTrapId={match.selectedTrapId}
            trapCostOptionLabels={match.trapCostOptionLabels}
            selectedTrapCostOptionIndex={match.selectedTrapCostOptionIndex}
            onSelectTrapCostOption={match.selectTrapCostOption}
            alternativeCostCards={match.selectedTrapTrashCookieToBreakAreaCandidates}
            alternativeCostAmount={match.selectedTrapTrashCookieToBreakAreaAmount}
            selectedAlternativeCostIds={match.selectedTrapTrashCookieToBreakAreaIds}
            onToggleAlternativeCost={(id) =>
              match.setSelectedTrapTrashCookieToBreakAreaIds((current) =>
                current.includes(id)
                  ? current.filter((cardId) => cardId !== id)
                  : current.length < match.selectedTrapTrashCookieToBreakAreaAmount
                    ? [...current, id]
                    : current,
              )
            }
            paymentCards={match.trapPaymentCandidates.map(
              (support) => support.card,
            )}
            trapEnergyCostTotal={match.trapEnergyCostTotal}
            trapPaymentValid={match.trapPaymentValid}
            selectedPaymentIds={match.selectedTrapPaymentIds}
            onTogglePayment={match.toggleTrapPayment}
            targetCards={match.selectedTrapTargets.map(
              (target) => target.card,
            )}
            discardHandCards={match.selectedTrapDiscardCandidates}
            discardHandCost={match.selectedTrapDiscardCost}
            selectedDiscardHandIds={match.selectedTrapDiscardIds}
            handToBreakCards={match.selectedTrapHandToBreakCandidates}
            handToBreakCost={match.selectedTrapHandToBreakCost}
            selectedHandToBreakIds={match.selectedTrapHandToBreakIds}
            onToggleHandToBreak={(id) =>
              match.setSelectedTrapHandToBreakIds((current) =>
                current.includes(id)
                  ? current.filter((cardId) => cardId !== id)
                  : current.length < match.selectedTrapHandToBreakCost
                    ? [...current, id]
                    : current,
              )
            }
            battleCookieCostCards={match.selectedTrapTrashBattleCookieCandidates.map(
              (cookie) => cookie.card,
            )}
            battleCookieCost={match.selectedTrapTrashBattleCookieCost}
            selectedBattleCookieIds={match.selectedTrapTrashBattleCookieIds}
            trashToDeckCards={match.trapTrashToDeckCandidates}
            trashToDeckAmount={match.trapTrashToDeckAmount}
            selectedTrashToDeckIds={match.selectedTrapTrashToDeckIds}
            onToggleTrashToDeck={match.toggleTrapTrashToDeck}
            unmetConditionWarning={getUnmetTrapConditionWarning(match)}
            attackerCard={
              attackAttackerCard
            }
            attackTargetCard={attackTargetCard}
            trapTargetCandidates={match.trapTargetCandidates}
            selectedTrapTargetId={match.selectedTrapTargetId}
            trapSelfTargetCandidates={match.trapSelfTargetCandidates}
            selectedTrapSelfTargetId={match.selectedTrapSelfTargetId}
            onSelectTrap={(id) => {
              match.setSelectedTrapId(id)
              match.selectTrapCostOption(0)
              match.setSelectedTrapTrashCookieToBreakAreaIds([])
              match.setSelectedTrapPaymentIds([])
              match.setSelectedTrapDiscardIds([])
              match.setSelectedTrapHandToBreakIds([])
              match.setSelectedTrapTrashBattleCookieIds([])
              match.setSelectedTrapTargetId(null)
              match.setSelectedTrapSelfTargetId(null)
              match.setTrapSelectNoTarget(false)
              match.setSelectedTrapSupportTrashIds([])
              match.setSelectedTrapSupportToHandIds([])
              match.setSelectedTrapHandToSupportIds([])
              match.setSelectedTrapTrashToDeckIds([])
            }}
            onSelectTrapTarget={(id) => {
              match.setSelectedTrapTargetId(id)
              match.setTrapSelectNoTarget(false)
            }}
            onSelectTrapSelfTarget={(id) => {
              match.setSelectedTrapSelfTargetId(id)
            }}
            onToggleDiscardHand={(id) =>
              match.setSelectedTrapDiscardIds((current) =>
                current.includes(id)
                  ? current.filter((cardId) => cardId !== id)
                  : current.length < match.selectedTrapDiscardCost
                    ? [...current, id]
                    : current,
              )
            }
            onToggleBattleCookie={(id) =>
              match.setSelectedTrapTrashBattleCookieIds((current) =>
                current.includes(id)
                  ? current.filter((cardId) => cardId !== id)
                  : current.length < match.selectedTrapTrashBattleCookieCost
                    ? [...current, id]
                    : current,
              )
            }
            onBack={
              match.playerBlockerCandidates.length > 0
                ? () => {
                    match.setSelectedTrapId(null)
                    match.setSelectedTrapDiscardIds([])
              match.setSelectedTrapHandToBreakIds([])
                    match.setSelectedTrapTrashBattleCookieIds([])
                    match.setSelectedTrapTargetId(null)
                    match.setTrapSelectNoTarget(false)
                    match.setSelectedTrapSupportTrashIds([])
                    match.setPendingResponseMode(null)
                    match.setSelectedTrapTrashToDeckIds([])
                  }
                : undefined
            }
            onSkip={() => {
              match.setSelectedTrapId(null)
              match.setSelectedTrapPaymentIds([])
              match.setSelectedTrapDiscardIds([])
              match.setSelectedTrapHandToBreakIds([])
              match.setSelectedTrapTrashBattleCookieIds([])
              match.setSelectedTrapTargetId(null)
              match.setPendingResponseMode(null)
              match.setSelectedTrapSupportTrashIds([])
              match.setSelectedTrapSupportToHandIds([])
              match.setSelectedTrapHandToSupportIds([])
              match.setSelectedTrapTrashToDeckIds([])
              match.dispatch(
                { kind: 'skip-trap', playerId: match.viewerPlayerId },
                '未發動陷阱，進入傷害結算。',
              )
            }}
            onConfirm={() => {
              if (!match.selectedTrap) return
              const trap = match.selectedTrap
              match.setSelectedTrapId(null)
              match.setSelectedTrapPaymentIds([])
              match.setSelectedTrapDiscardIds([])
              match.setSelectedTrapHandToBreakIds([])
              match.setSelectedTrapTrashBattleCookieIds([])
              match.setSelectedTrapTargetId(null)
              match.setTrapSelectNoTarget(false)
              match.setPendingResponseMode(null)
              match.setSelectedTrapSupportTrashIds([])
              match.setSelectedTrapSupportToHandIds([])
              match.setSelectedTrapHandToSupportIds([])
              match.setSelectedTrapTrashToDeckIds([])
              const playTrapCommand: GameCommand = {
                kind: 'play-trap',
                playerId: match.viewerPlayerId,
                trapInstanceId: trap.instanceId,
                costOptionIndex: match.selectedTrapCostOptionIndex,
                paymentIds: match.selectedTrapPaymentIds,
                targetIds: match.selectedTrapTargets.map(
                  (target) => target.card.instanceId,
                ),
                selfTargetIds: match.selectedTrapSelfTargets.map(
                  (target) => target.card.instanceId,
                ),
                supportTrashIds: match.selectedTrapSupportTrashIds,
                supportToHandIds: match.selectedTrapSupportToHandIds,
                handToSupportIds: match.selectedTrapHandToSupportIds,
                discardHandIds: match.selectedTrapDiscardIds,
                handToBreakIds: match.selectedTrapHandToBreakIds,
                trashBattleCookieIds: match.selectedTrapTrashBattleCookieIds,
                trashCookieToBreakAreaIds:
                  match.selectedTrapTrashCookieToBreakAreaIds,
                trashToDeckIds: match.selectedTrapTrashToDeckIds,
              }
              match.dispatch(
                playTrapCommand,
                `已發動${trap.name}。`,
              )
            }}
            allowEmptyTarget={match.trapAllowEmptyTarget}
            emptyTargetActive={match.trapSelectNoTarget}
            onToggleEmptyTarget={() =>
              match.setTrapSelectNoTarget((v) => !v)
            }
            supportToHandCards={match.trapSupportToHandCandidates}
            supportToHandAmount={match.trapSupportToHandAmount}
            selectedSupportToHandIds={match.selectedTrapSupportToHandIds}
            onToggleSupportToHand={match.toggleTrapSupportToHand}
            supportTrashCards={match.trapSupportTrashCandidates}
            supportTrashAmount={match.trapSupportTrashAmount}
            selectedSupportTrashIds={match.selectedTrapSupportTrashIds}
            onToggleSupportTrash={match.toggleTrapSupportTrash}
            handToSupportCards={match.trapHandToSupportCandidates}
            handToSupportAmount={match.trapHandToSupportAmount}
            selectedHandToSupportIds={match.selectedTrapHandToSupportIds}
            onToggleHandToSupport={match.toggleTrapHandToSupport}
          />
        )}

      {match.game.pendingBattle?.stage === 'trap' &&
        match.game.pendingBattle.defenderPlayerId === match.viewerPlayerId &&
        match.playerTrapCandidates.length === 0 &&
        match.playerBlockerCandidates.length > 0 && (
          <BlockerResponseModal
            blockerCards={match.playerBlockerCandidates}
            selectedBlockerId={match.selectedBlockerId}
            attackerCard={attackAttackerCard}
            attackTargetCard={attackTargetCard}
            paymentCards={match.game.players[
              match.viewerPlayerId
            ].supportArea
              .filter((support) =>
                match.selectedBlockerPaymentIds.includes(
                  support.card.instanceId,
                ),
              )
              .map((support) => support.card)}
            onSelectBlocker={(id) => match.setSelectedBlockerId(id)}
            onConfirm={() => {
              if (!match.selectedBlockerId) return
              match.dispatch(
                {
                  kind: 'play-blocker',
                  playerId: match.viewerPlayerId,
                  sourceInstanceId: match.selectedBlockerId!,
                  paymentIds: match.selectedBlockerPaymentIds,
                },
                '已使用 Blocker 阻擋攻擊。',
              )
            }}
            onSkip={() => {
              match.setSelectedBlockerId(null)
              match.dispatch(
                { kind: 'skip-trap', playerId: match.viewerPlayerId },
                '未使用 Blocker，進入傷害結算。',
              )
            }}
          />
        )}

      {match.game.pendingBattle?.stage === 'trap' &&
        match.game.pendingBattle.defenderPlayerId === match.viewerPlayerId &&
        match.playerTrapCandidates.length > 0 &&
        match.playerBlockerCandidates.length > 0 &&
        match.pendingResponseMode === 'blocker' && (
          <BlockerResponseModal
            blockerCards={match.playerBlockerCandidates}
            selectedBlockerId={match.selectedBlockerId}
            attackerCard={attackAttackerCard}
            attackTargetCard={attackTargetCard}
            paymentCards={match.game.players[
              match.viewerPlayerId
            ].supportArea
              .filter((support) =>
                match.selectedBlockerPaymentIds.includes(
                  support.card.instanceId,
                ),
              )
              .map((support) => support.card)}
            onSelectBlocker={(id) => match.setSelectedBlockerId(id)}
            onConfirm={() => {
              if (!match.selectedBlockerId) return
              match.dispatch(
                {
                  kind: 'play-blocker',
                  playerId: match.viewerPlayerId,
                  sourceInstanceId: match.selectedBlockerId!,
                  paymentIds: match.selectedBlockerPaymentIds,
                },
                '已使用 Blocker 阻擋攻擊。',
              )
            }}
            onSkip={() => {
              match.setSelectedBlockerId(null)
              match.setPendingResponseMode(null)
              match.dispatch(
                { kind: 'skip-trap', playerId: match.viewerPlayerId },
                '未使用 Blocker，進入傷害結算。',
              )
            }}
            onBack={() => {
              match.setSelectedBlockerId(null)
              match.setPendingResponseMode(null)
            }}
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
            chooseOneModes={flipChooseOneEffect?.modes}
            targetCandidates={flipTargetCandidates}
            targetMin={flipTargetLimits?.min ?? 0}
            targetMax={flipTargetLimits?.max ?? 1}
            onToggleDiscard={(instanceId) =>
              match.setSelectedFlipDiscardIds((current) =>
                current.includes(instanceId)
                  ? current.filter((id) => id !== instanceId)
                  : [...current, instanceId],
              )
            }
            onSkip={() => {
              match.setSelectedFlipDiscardIds([])
              match.dispatch(
                {
                  kind: 'resolve-flip',
                  playerId: match.viewerPlayerId,
                  activate: false,
                },
                '未發動 FLIP，繼續傷害結算。',
              )
            }}
            onActivate={(chooseOneModeIndex, targetIds) => {
              match.setSelectedFlipDiscardIds([])
              match.dispatch(
                {
                  kind: 'resolve-flip',
                  playerId: match.viewerPlayerId,
                  activate: true,
                  discardHandIds: match.selectedFlipDiscardIds,
                  chooseOneModeIndex,
                  targetIds,
                },
                `已發動${match.game.pendingBattle?.revealedHpCard?.name ?? 'FLIP'}。`,
              )
            }}
          />
        )}
    </>
  )
}
