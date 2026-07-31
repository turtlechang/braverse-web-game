import { Fragment } from 'react'
import './GuidedPhaseSteps.css'

export type GuidedPhaseId =
  | 'energy'
  | 'cost'
  | 'choice'
  | 'target'
  | 'selfTarget'

export interface GuidedPhase {
  id: GuidedPhaseId
  label: string
  complete: boolean
}

export function GuidedPhaseSteps({
  phases,
  activePhase,
}: {
  phases: GuidedPhase[]
  activePhase: GuidedPhaseId | null
}) {
  if (phases.length === 0) return null

  return (
    <nav className="phase-progress" aria-label="效果處理步驟">
      {phases.map((phase, index) => (
        <Fragment key={phase.id}>
          {index > 0 && <span className="phase-divider" aria-hidden="true" />}
          <span
            className={`phase-step${activePhase === phase.id ? ' is-active' : ''}${phase.complete ? ' is-done' : ''}`}
            aria-current={activePhase === phase.id ? 'step' : undefined}
          >
            <span className="phase-step-number">{index + 1}</span>
            {phase.label}
          </span>
        </Fragment>
      ))}
    </nav>
  )
}
