import { List, Pause, RotateCcw } from 'lucide-react'
import './MatchToolbar.css'

export interface MatchToolbarProps {
  onReset: () => void
  onViewDeck: () => void
  onPause: () => void
}

export function MatchToolbar({
  onReset,
  onViewDeck,
  onPause,
}: MatchToolbarProps) {
  return (
    <header className="match-toolbar" aria-label="對局工具">
      <button type="button" title="重新開始" onClick={onReset}>
        <RotateCcw aria-hidden="true" />
      </button>
      <button type="button" title="查看官方範例牌組" onClick={onViewDeck}>
        <List aria-hidden="true" />
      </button>
      <button type="button" title="暫停資訊" onClick={onPause}>
        <Pause aria-hidden="true" />
      </button>
    </header>
  )
}
