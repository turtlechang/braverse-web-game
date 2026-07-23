import { useEffect } from 'react'

const BASE_TITLE = document.title
const PLAYER_TURN_COLOR = '#2563eb'
const OPPONENT_TURN_COLOR = '#dc2626'

const buildTurnFaviconHref = (color: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="${color}" stroke="rgba(255,255,255,0.65)" stroke-width="2"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/**
 * 對戰中把「輪到誰」同步到分頁標題與 favicon，讓玩家切走分頁/視窗時
 * 仍能靠工作列察覺輪到自己了。本機（App.tsx）與線上（OnlineBattleView.tsx）
 * 對戰畫面共用；`isActive` 只在實際進入對戰畫面時才置換標題與 favicon。
 */
export function useTurnTabIndicator(isPlayerTurn: boolean, isActive: boolean) {
  useEffect(() => {
    if (!isActive) return

    document.title = isPlayerTurn
      ? `輪到你了 · ${BASE_TITLE}`
      : `對手行動中 · ${BASE_TITLE}`

    const faviconLink = document.createElement('link')
    faviconLink.rel = 'icon'
    faviconLink.href = buildTurnFaviconHref(
      isPlayerTurn ? PLAYER_TURN_COLOR : OPPONENT_TURN_COLOR,
    )
    document.head.appendChild(faviconLink)

    return () => {
      faviconLink.remove()
    }
  }, [isPlayerTurn, isActive])

  useEffect(() => {
    return () => {
      document.title = BASE_TITLE
    }
  }, [])
}
