import { FaintEffectResponseModal } from '../modals/GameModals'
import type { useMatchController } from '../../hooks/useMatchController'
import type { usePendingEffect } from '../../hooks/usePendingEffect'

export interface DamageEffectModalsProps {
  match: ReturnType<typeof useMatchController>
  pending: ReturnType<typeof usePendingEffect>
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
            )?.card.name
          }
          onConfirm={() => {
            const targets = match.selectedFaintTargetIds
            const targetName = match.faintCandidates.find(
              (candidate) => candidate.card.instanceId === targets[0],
            )?.card.name
            match.setSelectedFaintTargetIds([])
            match.dispatch(
              {
                kind: 'resolve-faint-effect',
                playerId: match.viewerPlayerId,
                targetIds: targets,
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
