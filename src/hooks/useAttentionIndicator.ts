import { useEffect } from 'react'

const BASE_TITLE = document.title

const PLAYER_TURN_COLOR = '#35c8ff'
const OPPONENT_TURN_COLOR = '#b65c69'

const buildFaviconHref = (color: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="${color}" stroke="rgba(255,255,255,0.65)" stroke-width="2"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/**
 * 對戰中把「現在輪到誰」同步到分頁標題與 favicon,讓玩家切走分頁/視窗時
 * 仍能靠工作列察覺輪到自己。本機（App.tsx）與線上（OnlineBattleView.tsx）
 * 對戰畫面共用;`isActive` 只在實際進入對戰畫面時才置換標題與 favicon。
 */
export function useAttentionIndicator(isPlayerTurn: boolean, isActive: boolean) {
  useEffect(() => {
    if (!isActive) return

    document.title = isPlayerTurn
      ? `你的回合｜${BASE_TITLE}`
      : `對手回合｜${BASE_TITLE}`

    const faviconLink = document.createElement('link')
    faviconLink.rel = 'icon'
    faviconLink.href = buildFaviconHref(
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
