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
  activePlayerName: string
  isPlayerTurn: boolean
  disabled: boolean
  onAdvance: () => void
  aiThinking: boolean
  aiActionCount: number
  onRunSimulation: () => void
}

export function PhaseRail({
  phase,
  turnNumber,
  activePlayerName,
  isPlayerTurn,
  disabled,
  onAdvance,
  aiThinking,
  aiActionCount,
  onRunSimulation,
}: PhaseRailProps) {
  return (
    <aside className="phase-rail" aria-label="回合階段">
      <div className="brand-mark">
        <span>COOKIE RUN</span>
        <strong>BRAVERSE</strong>
      </div>
      <div className={`turn-indicator ${isPlayerTurn ? 'is-player' : 'is-opponent'}`}>
        <span>當前回合</span>
        <strong>{activePlayerName}</strong>
      </div>
      <ol>
        {phases.map((p, index) => (
          <li className={phase === p ? 'is-current' : ''} key={p}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{phaseLabels[p]}</strong>
          </li>
        ))}
      </ol>
      <section className="rail-ai-status" aria-live="polite">
        <span>簡易 AI 對手</span>
        <strong>{aiThinking ? '正在決策' : '等待下一步'}</strong>
        <small>已執行 {aiActionCount} 個動作</small>
        <button type="button" onClick={onRunSimulation}>
          執行 20 場 AI 驗證
        </button>
      </section>
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
