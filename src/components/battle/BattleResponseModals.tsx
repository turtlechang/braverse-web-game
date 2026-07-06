import type { GameCommand } from '../../game'
import {
  AttackResponseModal,
  TrapResponseModal,
  BlockerResponseModal,
  FlipResponseModal,
} from '../modals/GameModals'
import { parseTestStateConfig } from '../../game/demo'
import type { BattleUiMatchLike } from '../../hooks/battleUiContracts'

const testStateConfig = parseTestStateConfig(
  window.location.search,
  window.location.hostname,
)

export interface BattleResponseModalsProps {
  match: BattleUiMatchLike
}

export function BattleResponseModals({ match }: BattleResponseModalsProps) {
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
            onSelectTrap={(id) => {
              match.setPendingResponseMode('trap')
              match.setSelectedTrapId(id)
              match.setSelectedTrapDiscardIds([])
              match.setSelectedTrapTrashBattleCookieIds([])
              match.setTrapSelectNoTarget(false)
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
            discardHandCards={match.selectedTrapDiscardCandidates}
            discardHandCost={match.selectedTrapDiscardCost}
            selectedDiscardHandIds={match.selectedTrapDiscardIds}
            battleCookieCostCards={match.selectedTrapTrashBattleCookieCandidates.map(
              (cookie) => cookie.card,
            )}
            battleCookieCost={match.selectedTrapTrashBattleCookieCost}
            selectedBattleCookieIds={match.selectedTrapTrashBattleCookieIds}
            onSelectTrap={(id) => {
              match.setSelectedTrapId(id)
              match.setSelectedTrapDiscardIds([])
              match.setSelectedTrapTrashBattleCookieIds([])
              match.setTrapSelectNoTarget(false)
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
                    match.setSelectedTrapTrashBattleCookieIds([])
                    match.setTrapSelectNoTarget(false)
                    match.setPendingResponseMode(null)
                  }
                : undefined
            }
            onSkip={() => {
              match.setSelectedTrapId(null)
              match.setSelectedTrapDiscardIds([])
              match.setSelectedTrapTrashBattleCookieIds([])
              match.setPendingResponseMode(null)
              match.dispatch(
                { kind: 'skip-trap', playerId: match.viewerPlayerId },
                '未發動陷阱，進入傷害結算。',
              )
            }}
            onConfirm={() => {
              if (!match.selectedTrap) return
              const trap = match.selectedTrap
              match.setSelectedTrapId(null)
              match.setSelectedTrapDiscardIds([])
              match.setSelectedTrapTrashBattleCookieIds([])
              match.setTrapSelectNoTarget(false)
              match.setPendingResponseMode(null)
              const playTrapCommand: GameCommand = {
                kind: 'play-trap',
                playerId: match.viewerPlayerId,
                trapInstanceId: trap.instanceId,
                paymentIds: match.selectedTrapPaymentIds,
                targetIds: match.selectedTrapTargets.map(
                  (target) => target.card.instanceId,
                ),
                supportTrashIds: match.selectedTrapSupportTrashIds,
                discardHandIds: match.selectedTrapDiscardIds,
                trashBattleCookieIds: match.selectedTrapTrashBattleCookieIds,
              }
              match.dispatch(
                testStateConfig
                  ? [
                      playTrapCommand,
                      { kind: 'resolve-battle', playerId: match.viewerPlayerId },
                    ]
                  : playTrapCommand,
                `已發動${trap.name}。`,
              )
            }}
            allowEmptyTarget={match.trapAllowEmptyTarget}
            emptyTargetActive={match.trapSelectNoTarget}
            onToggleEmptyTarget={() =>
              match.setTrapSelectNoTarget((v) => !v)
            }
          />
        )}

      {match.game.pendingBattle?.stage === 'trap' &&
        match.game.pendingBattle.defenderPlayerId === match.viewerPlayerId &&
        match.playerTrapCandidates.length === 0 &&
        match.playerBlockerCandidates.length > 0 && (
          <BlockerResponseModal
            blockerCards={match.playerBlockerCandidates}
            selectedBlockerId={match.selectedBlockerId}
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
            onActivate={() => {
              match.setSelectedFlipDiscardIds([])
              match.dispatch(
                {
                  kind: 'resolve-flip',
                  playerId: match.viewerPlayerId,
                  activate: true,
                  discardHandIds: match.selectedFlipDiscardIds,
                },
                `已發動${match.game.pendingBattle?.revealedHpCard?.name ?? 'FLIP'}。`,
              )
            }}
          />
        )}
    </>
  )
}
