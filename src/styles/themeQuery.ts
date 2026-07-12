/**
 * 從 URL 讀取 theme query 參數（mockup gallery 用）
 */

import type { DesignTheme } from './tokens'

export function readThemeFromQuery(): DesignTheme | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const theme = params.get('theme')
  if (
    theme === 'tactical' ||
    theme === 'tactical-clean' ||
    theme === 'tactical-mono' ||
    theme === 'low-glare' ||
    theme === 'broadcast'
  ) {
    return theme
  }
  return null
}
