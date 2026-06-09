import { List, Pause, RotateCcw } from 'lucide-react'
import type { DeckChoice, TurnPhase } from '../../game'
import { phaseLabels } from '../gameUiLabels'
import './MatchToolbar.css'

export interface MatchToolbarProps {
  deckConfig: { player: DeckChoice; ai: DeckChoice }
  activePlayerName: string
  phase: TurnPhase
  message: string
  onPlayerDeckChange: (deck: DeckChoice) => void
  onAiDeckChange: (deck: DeckChoice) => void
  onReset: () => void
  onViewDeck: () => void
  onPause: () => void
}

export function MatchToolbar({
  deckConfig,
  activePlayerName,
  phase,
  message,
  onPlayerDeckChange,
  onAiDeckChange,
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
        <div className="deck-select-group">
          <label className="deck-select-label">
            玩家牌組
            <select
              className="deck-select"
              aria-label="玩家牌組"
              data-testid="player-deck-select"
              value={deckConfig.player}
              onChange={(e) =>
                onPlayerDeckChange(e.target.value as DeckChoice)
              }
            >
              <option value="red">紅色牌組</option>
              <option value="yellow">黃色牌組</option>
              <option value="green">綠色牌組</option>
            </select>
          </label>
          <span className="deck-select-vs">vs</span>
          <label className="deck-select-label">
            AI 牌組
            <select
              className="deck-select"
              aria-label="AI 牌組"
              data-testid="ai-deck-select"
              value={deckConfig.ai}
              onChange={(e) =>
                onAiDeckChange(e.target.value as DeckChoice)
              }
            >
              <option value="red">紅色牌組</option>
              <option value="yellow">黃色牌組</option>
              <option value="green">綠色牌組</option>
            </select>
          </label>
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
