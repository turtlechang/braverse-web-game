import { ChevronRight } from 'lucide-react'
import type { TurnPhase } from '../../game'
import { phaseLabels } from '../gameUiLabels'
import './PhaseRail.css'

const nextPhaseLabels: Record<TurnPhase, string> = {
  active: '自動活躍中',
  draw: '自動抽牌中',
  support: '略過支援階段',
  main: '結束主要階段',
  end: '結束回合',
}

export interface PhaseRailProps {
  phase: TurnPhase
  turnNumber: number
  activePlayerName: string
  isPlayerTurn: boolean
  disabled: boolean
  onAdvance: () => void
}

export function PhaseRail({
  phase,
  turnNumber,
  activePlayerName,
  isPlayerTurn,
  disabled,
  onAdvance,
}: PhaseRailProps) {
  return (
    <aside className="phase-rail" aria-label="回合階段">
      <div className={`turn-indicator ${isPlayerTurn ? 'is-player' : 'is-opponent'}`}>
        <span>{activePlayerName}</span>
        <strong>{phaseLabels[phase]}</strong>
      </div>
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
