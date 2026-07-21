import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameCard, PendingBattle, PlayerId } from '../game'

export const FLIP_CARD_PREVIEW_DURATION = 3000

interface ActiveFlipPreview {
  eventKey: string
  card: GameCard
}

const flipPreviewEventKey = (battle: PendingBattle, card: GameCard) =>
  [
    battle.attackerInstanceId,
    battle.targetInstanceId,
    battle.damageTargetInstanceId ?? '',
    card.instanceId,
  ].join(':')

/**
 * 在我方攻擊翻出對手 HP 卡的 FLIP 效果時，暫時固定左側卡牌預覽。
 * 預覽不依賴結算停留時間，讓翻牌流程快速結束時仍能完整看清卡面。
 */
export function useFlipCardPreview(
  pendingBattle: PendingBattle | null | undefined,
  viewerPlayerId: PlayerId,
  duration = FLIP_CARD_PREVIEW_DURATION,
) {
  const [preview, setPreview] = useState<ActiveFlipPreview | null>(null)
  const lastEventKeyRef = useRef<string | null>(null)
  const timerRef = useRef<number | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return
    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  useEffect(() => clearTimer, [clearTimer])

  const revealedCard =
    pendingBattle?.stage === 'flip' &&
    pendingBattle.attackerPlayerId === viewerPlayerId
      ? pendingBattle.revealedHpCard
      : null
  const eventKey =
    pendingBattle && revealedCard
      ? flipPreviewEventKey(pendingBattle, revealedCard)
      : null

  useEffect(() => {
    if (!eventKey || !revealedCard) {
      lastEventKeyRef.current = null
      return
    }
    if (lastEventKeyRef.current === eventKey) return

    lastEventKeyRef.current = eventKey
    clearTimer()
    setPreview({ eventKey, card: revealedCard })
    timerRef.current = window.setTimeout(() => {
      setPreview((current) =>
        current?.eventKey === eventKey ? null : current,
      )
      timerRef.current = null
    }, duration)
  }, [clearTimer, duration, eventKey, revealedCard])

  const dismiss = useCallback(() => {
    clearTimer()
    setPreview(null)
  }, [clearTimer])

  return {
    card: preview?.card ?? null,
    dismiss,
  } as const
}
