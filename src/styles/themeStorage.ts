/**
 * 主題持久化工具
 *
 * 預設為 `tactical-clean`（戰術深空 Clean），與 docs/phase1-theme-variants.md 一致。
 * 設定值存於 localStorage，key 為 `braverse-theme`。
 */

import { type DesignTheme } from './tokens'

const STORAGE_KEY = 'braverse-theme'
const DEFAULT_THEME: DesignTheme = 'tactical-clean'

const VALID_THEMES: DesignTheme[] = [
  'tactical',
  'tactical-clean',
  'tactical-mono',
  'low-glare',
  'broadcast',
]

export function getStoredTheme(): DesignTheme {
  if (typeof window === 'undefined') return DEFAULT_THEME
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored && (VALID_THEMES as string[]).includes(stored)) {
    return stored as DesignTheme
  }
  return DEFAULT_THEME
}

export function setStoredTheme(theme: DesignTheme): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, theme)
  document.documentElement.dataset.theme = theme
}

export function clearStoredTheme(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
  document.documentElement.removeAttribute('data-theme')
}

export { DEFAULT_THEME, VALID_THEMES, STORAGE_KEY }
