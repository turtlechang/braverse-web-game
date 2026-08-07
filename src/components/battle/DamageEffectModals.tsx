import { FaintEffectResponseModal } from '../modals/GameModals'
import type {
  BattleUiMatchLike,
  BattleUiPendingEffectLike,
} from '../../hooks/battleUiContracts'

export interface DamageEffectModalsProps {
  match: BattleUiMatchLike
  pending: BattleUiPendingEffectLike
}

const toggleFaintTargetId = (
  current: string[],
  instanceId: string,
  maxTargets: number,
): string[] => {
  if (current.includes(instanceId)) {
    return current.filter((id) => id !== instanceId)
  }
  return current.length < maxTargets ? [...current, instanceId] : current
}

export function DamageEffectModals({ match, pending }: DamageEffectModalsProps) {
  return (
    <>
      {pending.faintActive && match.faintSourceCard && (
        <FaintEffectResponseModal
          card={match.faintSourceCard}
          minTargets={match.faintMin}
          maxTargets={match.faintMax}
          selectedTargetCount={match.selectedFaintTargetIds.length}
          selectedTargetName={
            match.faintCandidates.find(
              (candidate) =>
                candidate.card.instanceId === match.selectedFaintTargetIds[0],
            )?.card.name ??
              match.faintCardCandidates.find(
                (candidate) =>
                  candidate.instanceId === match.selectedFaintTargetIds[0],
              )?.name
          }
          selectedTargetIds={match.selectedFaintTargetIds}
          candidateCards={match.faintCardCandidates}
          candidateLabel={match.faintCandidateLabel}
          targetCandidateCards={match.faintCandidates.map(
            (candidate) => candidate.card,
          )}
          onSelectTarget={(instanceId) => {
            match.setSelectedFaintTargetIds((current) =>
              toggleFaintTargetId(current, instanceId, match.faintMax),
            )
          }}
          energyCost={match.faintEnergyCost}
          paymentCandidates={match.faintPaymentCandidates}
          selectedPaymentIds={match.selectedFaintPaymentIds}
          paymentCostTotal={match.faintEnergyCostTotal}
          paymentValid={match.faintPaymentValid}
          onSelectPayment={match.toggleFaintPayment}
          costHandAmount={match.faintCostHandAmount}
          costHandCandidates={match.faintCostHandCandidates}
          selectedCostHandIds={match.selectedFaintCostHandIds}
          onSelectCostHand={match.toggleFaintCostHand}
          costSupportAmount={match.faintCostSupportAmount}
          costSupportCandidates={match.faintCostSupportCandidates}
          selectedCostSupportIds={match.selectedFaintCostSupportIds}
          onSelectCostSupport={match.toggleFaintCostSupport}
          allowSkip={
            match.faintEnergyCostTotal > 0 ||
            match.faintCostHandAmount > 0 ||
            match.faintCostSupportAmount > 0 ||
            (match.faintMin > 0 &&
              match.faintCandidates.length < match.faintMin &&
              match.faintCardCandidates.length < match.faintMin)
          }
          onSkip={() => {
            match.setSelectedFaintTargetIds([])
            match.setSelectedFaintPaymentIds([])
            match.setSelectedFaintCostHandIds([])
            match.setSelectedFaintCostSupportIds([])
            match.dispatch(
              {
                kind: 'resolve-faint-effect',
                playerId: match.viewerPlayerId,
                targetIds: [],
              },
              `${match.faintSourceCard!.name}未支付昏厥效果費用，略過效果。`,
            )
          }}
          onConfirm={() => {
            const targets = match.selectedFaintTargetIds
            const paymentIds = match.selectedFaintPaymentIds
            const discardHandIds = match.selectedFaintCostHandIds
            const supportToTrashIds = match.selectedFaintCostSupportIds
            const targetName =
              match.faintCandidates.find(
                (candidate) => candidate.card.instanceId === targets[0],
              )?.card.name ??
              match.faintCardCandidates.find(
                (candidate) => candidate.instanceId === targets[0],
              )?.name
            match.setSelectedFaintTargetIds([])
            match.setSelectedFaintPaymentIds([])
            match.setSelectedFaintCostHandIds([])
            match.setSelectedFaintCostSupportIds([])
            match.dispatch(
              {
                kind: 'resolve-faint-effect',
                playerId: match.viewerPlayerId,
                targetIds: targets,
                paymentIds,
                discardHandIds,
                supportToTrashIds,
              },
              targets.length === 0
                ? `${match.faintSourceCard!.name}已結算昏厥效果。`
                : `${match.faintSourceCard!.name}發動對${targetName ?? '目標'}的昏厥效果。`,
            )
          }}
        />
      )}

      {pending.afterDamageActive && match.afterDamageSourceCard && (
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
            <h2>{match.afterDamageSourceCard.name} 發動受傷後效果</h2>
            <p className="faint-effect-text">
              {match.afterDamageSourceCard.effectText ??
                match.afterDamageSourceCard.skill?.text ??
                '受傷後效果'}
            </p>
            <p className="faint-target-hint">
              {match.afterDamageMin === 0
                ? `選擇最多 ${match.afterDamageMax} 個對手餅乾作為目標，或略過。`
                : `選擇 ${match.afterDamageMin} 個對手餅乾作為目標。`}
            </p>
            <div className="faint-modal-actions">
              {match.afterDamageMin === 0 && (
                <button
                  type="button"
                  className="modal-button"
                  onClick={() => {
                    match.setSelectedAfterDamageTargetIds([])
                    match.dispatch(
                      {
                        kind: 'resolve-after-damage-effect',
                        playerId: match.viewerPlayerId,
                        targetIds: [],
                      },
                      `${match.afterDamageSourceCard!.name}略過受傷後效果。`,
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
                  match.selectedAfterDamageTargetIds.length === 0 &&
                  match.afterDamageMin !== 0
                }
                onClick={() => {
                  const targets = match.selectedAfterDamageTargetIds
                  match.setSelectedAfterDamageTargetIds([])
                  match.dispatch(
                    {
                      kind: 'resolve-after-damage-effect',
                      playerId: match.viewerPlayerId,
                      targetIds: targets,
                    },
                    `${match.afterDamageSourceCard!.name}發動對${match.afterDamageCandidates.find((c) => c.card.instanceId === targets[0])?.card.name ?? '目標'}的受傷後效果。`,
                  )
                }}
              >
                {match.afterDamageMin === 0 &&
                match.selectedAfterDamageTargetIds.length === 0
                  ? '確認略過'
                  : `確認 (${match.selectedAfterDamageTargetIds.length})`}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
