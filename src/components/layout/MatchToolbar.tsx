import { useEffect, useRef, useState } from 'react'
import { Pause, RotateCcw, Settings } from 'lucide-react'
import './MatchToolbar.css'

export interface MatchToolbarProps {
  onReset: () => void
  onPause: () => void
}

export function MatchToolbar({
  onReset,
  onPause,
}: MatchToolbarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const toolbar = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!isOpen) return
    toolbar.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !toolbar.current?.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [isOpen])

  const runAction = (action: () => void) => {
    setIsOpen(false)
    action()
  }

  return (
    <header ref={toolbar} className="match-toolbar" aria-label="對局工具" onKeyDown={event => {
      if (!isOpen) return
      if (event.key === 'Escape') {event.preventDefault();event.stopPropagation();setIsOpen(false);toolbar.current?.querySelector<HTMLButtonElement>('.match-toolbar-trigger')?.focus()}
      if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
        event.preventDefault()
        const items = [...(toolbar.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
        const index = items.findIndex(item => item === document.activeElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
        items[next]?.focus()
      }
    }}>
      <button
        type="button"
        className="match-toolbar-trigger"
        title="對局工具"
        aria-label="對局工具"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls="match-toolbar-menu"
        onClick={() => setIsOpen((value) => !value)}
      >
        <Settings aria-hidden="true" />
      </button>

      {isOpen && (
        <div id="match-toolbar-menu" className="match-toolbar-menu" role="menu" aria-label="對局工具">
          <div className="match-toolbar-label" role="presentation">對局工具</div>
          <button type="button" role="menuitem" aria-label="暫停資訊" onClick={() => runAction(onPause)}>
            <Pause aria-hidden="true" />
            <span><strong>暫停資訊</strong><small>暫停對戰，查看目前進度</small></span>
          </button>
          <button className="match-toolbar-reset" type="button" role="menuitem" aria-label="重新開始" onClick={() => runAction(onReset)}>
            <RotateCcw aria-hidden="true" />
            <span><strong>重新開始</strong><small>重新設定這場對局</small></span>
          </button>
        </div>
      )}
    </header>
  )
}
