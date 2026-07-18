import { useEffect, useState } from 'react'
import type { GameCard } from '../game'

/**
 * 手牌選取狀態與解除選取行為,本機與線上戰場共用:點擊 `.hand-card-wrap` 以外
 * 或按 Escape 會清除選取並收合資源 popover;若選取的卡已不在手牌中(如已被
 * 打出),`activeSelectedHandCardId` 會自動視為未選取。
 */
export function useHandSelectionDismissal(
  hand: GameCard[],
  closeResourcePopover: () => void,
) {
  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(
    null,
  )

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.closest('.hand-card-wrap')) {
        setSelectedHandCardId(null)
      }
      if (!target.closest('.resource-dock')) {
        closeResourcePopover()
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setSelectedHandCardId(null)
      closeResourcePopover()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeResourcePopover])

  const activeSelectedHandCardId =
    selectedHandCardId &&
    hand.some((card) => card.instanceId === selectedHandCardId)
      ? selectedHandCardId
      : null

  return {
    selectedHandCardId,
    setSelectedHandCardId,
    activeSelectedHandCardId,
  } as const
}
