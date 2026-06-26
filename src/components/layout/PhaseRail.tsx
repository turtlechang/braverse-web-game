import { ChevronRight } from 'lucide-react'
import type { TurnPhase } from '../../game'
import { phaseLabels } from '../gameUiLabels'
import './PhaseRail.css'

const phases: TurnPhase[] = ['active', 'draw', 'support', 'main', 'end']

const nextPhaseLabels: Record<TurnPhase, string> = {
  active: '自動活躍中',
  draw: '自動抽牌中',
  support: '略過支援階段',
  main: '結束主要階段',
  end: '結束回合',
}

const phaseHints: Record<TurnPhase, string> = {
  active: '等待活躍階段自動完成…',
  draw: '等待抽牌階段自動完成…',
  support: '從手牌拖曳或點擊配置支援卡',
  main: '登場餅乾、使用物品或發動技能',
  end: '結束本回合',
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
      <div className="phase-hint">
        <small>{phaseHints[phase]}</small>
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
