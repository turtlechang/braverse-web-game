import { ChevronRight } from 'lucide-react'
import type { TurnPhase } from '../../game'
import { phaseLabels } from '../gameUiLabels'
import './PhaseRail.css'

const phases: TurnPhase[] = ['active', 'draw', 'support', 'main', 'end']

const nextPhaseLabels: Record<TurnPhase, string> = {
  active: '完成活躍',
  draw: '前往支援',
  support: '前往主要',
  main: '結束主要',
  end: '結束回合',
}

export interface PhaseRailProps {
  phase: TurnPhase
  turnNumber: number
  disabled: boolean
  onAdvance: () => void
}

export function PhaseRail({
  phase,
  turnNumber,
  disabled,
  onAdvance,
}: PhaseRailProps) {
  return (
    <aside className="phase-rail" aria-label="回合階段">
      <div className="brand-mark">
        <span>COOKIE RUN</span>
        <strong>BRAVERSE</strong>
      </div>
      <ol>
        {phases.map((p, index) => (
          <li className={phase === p ? 'is-current' : ''} key={p}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{phaseLabels[p]}</strong>
          </li>
        ))}
      </ol>
      <button
        className="next-phase-button"
        type="button"
        onClick={onAdvance}
        disabled={disabled}
      >
        <span>{nextPhaseLabels[phase]}</span>
        <ChevronRight aria-hidden="true" />
      </button>
      <span className="turn-counter">TURN {turnNumber}</span>
    </aside>
  )
}
