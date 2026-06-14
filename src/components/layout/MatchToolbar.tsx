import { List, Pause, RotateCcw } from 'lucide-react'
import type { DeckChoice, TurnPhase } from '../../game'
import { phaseLabels } from '../gameUiLabels'
import './MatchToolbar.css'

export interface MatchToolbarProps {
  deckConfig: { player: DeckChoice; ai: DeckChoice }
  activePlayerName: string
  phase: TurnPhase
  message: string
  onReset: () => void
  onViewDeck: () => void
  onPause: () => void
}

export function MatchToolbar({
  deckConfig,
  activePlayerName,
  phase,
  message,
  onReset,
  onViewDeck,
  onPause,
}: MatchToolbarProps) {
  return (
    <header className="match-toolbar">
      <div className="match-status">
        <span>{activePlayerName}的回合</span>
        <strong>{phaseLabels[phase]}</strong>
        <small>{message}</small>
      </div>
      <div className="toolbar-actions">
        <div className="deck-matchup" aria-label="本局牌組">
          <span>玩家 {deckConfig.player.toUpperCase()}</span>
          <b>VS</b>
          <span>AI {deckConfig.ai.toUpperCase()}</span>
        </div>
        <button type="button" title="重新開始" onClick={onReset}>
          <RotateCcw aria-hidden="true" />
        </button>
        <button type="button" title="查看官方範例牌組" onClick={onViewDeck}>
          <List aria-hidden="true" />
        </button>
        <button type="button" title="暫停資訊" onClick={onPause}>
          <Pause aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
