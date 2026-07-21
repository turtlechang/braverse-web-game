import { useState } from 'react'
import { List, Pause, RotateCcw, Settings } from 'lucide-react'
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
  const [isOpen, setIsOpen] = useState(false)

  const runAction = (action: () => void) => {
    setIsOpen(false)
    action()
  }

  return (
    <header className="match-toolbar" aria-label="對局工具">
      <button
        type="button"
        className="match-toolbar-trigger"
        title="對局工具"
        aria-label="對局工具"
        aria-expanded={isOpen}
        aria-controls="match-toolbar-menu"
        onClick={() => setIsOpen((value) => !value)}
      >
        <Settings aria-hidden="true" />
      </button>

      {isOpen && (
        <div id="match-toolbar-menu" className="match-toolbar-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => runAction(onReset)}>
            <RotateCcw aria-hidden="true" />
            重新開始
          </button>
          <button type="button" role="menuitem" onClick={() => runAction(onViewDeck)}>
            <List aria-hidden="true" />
            查看官方範例牌組
          </button>
          <button type="button" role="menuitem" onClick={() => runAction(onPause)}>
            <Pause aria-hidden="true" />
            暫停資訊
          </button>
        </div>
      )}
    </header>
  )
}
