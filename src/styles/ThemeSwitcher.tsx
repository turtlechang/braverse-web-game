/**
 * 主題切換器 — 嵌入主選單或設定面板
 *
 * 透過 `setStoredTheme` 寫入 localStorage，下次啟動沿用。
 * 預設值為 tactical-clean（戰術深空 Clean），見 docs/phase1-theme-variants.md。
 */

import { useCallback, useState } from 'react'
import { designThemes, type DesignTheme } from './tokens'
import { getStoredTheme, setStoredTheme } from './themeStorage'

const SWITCHER_STYLE = `
.theme-switcher { display: grid; gap: 8px; }
.theme-switcher h3 { margin: 0; font-size: var(--font-size-base); color: var(--color-text-primary); }
.theme-switcher-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.theme-switcher-option { display: grid; gap: 4px; padding: 8px 10px; border-radius: var(--radius-md);
  background: var(--color-bg-panel); color: var(--color-text-primary);
  border: 1px solid var(--color-border-default); cursor: pointer; text-align: left;
  font: inherit; transition: border-color var(--duration-fast) var(--easing-standard),
    box-shadow var(--duration-fast) var(--easing-standard); }
.theme-switcher-option:hover { border-color: var(--color-border-strong); }
.theme-switcher-option[data-active="true"] {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-glow-primary);
}
.theme-switcher-option strong { font-size: var(--font-size-sm); }
.theme-switcher-option small { font-size: var(--font-size-xs); color: var(--color-text-muted); }
`

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<DesignTheme>(() => getStoredTheme())

  const handleSelect = useCallback((next: DesignTheme) => {
    setTheme(next)
    setStoredTheme(next)
  }, [])

  return (
    <>
      <style>{SWITCHER_STYLE}</style>
      <div className="theme-switcher" role="group" aria-label="主題切換">
        <h3>視覺主題</h3>
        <div className="theme-switcher-options">
          {designThemes.map((option) => (
            <button
              key={option.id}
              type="button"
              className="theme-switcher-option"
              data-active={theme === option.id}
              aria-pressed={theme === option.id}
              onClick={() => handleSelect(option.id)}
            >
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

export default ThemeSwitcher
