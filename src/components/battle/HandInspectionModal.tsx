import { useState } from 'react'
import type { GameState, PlayerId } from '../../game'
import { useModalFocus } from '../../hooks/useModalFocus'
import { CardFace } from '../cards/CardVisuals'

type HandInspectionResult = NonNullable<
  NonNullable<GameState['handInspectionResults']>[PlayerId]
>

interface HandInspectionModalProps {
  result: HandInspectionResult
}

const getResultIdentity = (result: HandInspectionResult): string =>
  [
    result.sequence,
    result.sourceInstanceId,
    result.targetPlayerId,
    result.cards.map((card) => card.instanceId).join(','),
  ].join(':')

export function HandInspectionModal({ result }: HandInspectionModalProps) {
  const [dismissedResultIdentity, setDismissedResultIdentity] =
    useState<string | null>(null)
  const resultIdentity = getResultIdentity(result)
  const isDismissed = resultIdentity === dismissedResultIdentity

  if (isDismissed) return null

  return (
    <HandInspectionDialog
      result={result}
      onDismiss={() => setDismissedResultIdentity(resultIdentity)}
    />
  )
}

function HandInspectionDialog({
  result,
  onDismiss,
}: {
  result: HandInspectionResult
  onDismiss: () => void
}) {
  const modalRef = useModalFocus(onDismiss)

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        ref={modalRef}
        className="pause-modal hand-inspection-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hand-inspection-heading"
        tabIndex={-1}
      >
        <div className="pause-heading">
          <div>
            <span>效果結果</span>
            <h2 id="hand-inspection-heading">對手手牌檢視</h2>
          </div>
        </div>
        {result.cards.length === 0 ? (
          <p role="status">對手目前沒有手牌。</p>
        ) : (
          <div
            className="hand-inspection-card-list"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 12,
              margin: '20px 0',
            }}
          >
            {result.cards.map((card) => (
              <div
                className="hand-inspection-card"
                key={card.instanceId}
                style={{ flex: '0 1 120px', minWidth: 0 }}
              >
                <CardFace card={card} />
              </div>
            ))}
          </div>
        )}
        <button
          className="pause-resume"
          type="button"
          data-modal-initial-focus
          onClick={onDismiss}
        >
          關閉檢視結果
        </button>
      </section>
    </div>
  )
}
