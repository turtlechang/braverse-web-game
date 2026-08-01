import type { GameCard, GameState, PlayerId } from '../../game'
import { getBreakCount } from '../../game'

/**
 * 選中的陷阱若帶有 damage-by-break-count／modify-attack-by-break-count
 * 這類依休息區張數縮放的效果，但目前休息區沒有符合條件的餅乾，算出來就是
 * 0 效果（例如 BS3-045：官方文字沒有「休息區要有 LV.3 才能發動」這種前置
 * 條件，只是傷害量按休息區 LV.3 張數縮放）。不擋發動——玩家仍可能為了
 * 消耗手牌或觸發聯動而選擇發動，只是先讓玩家知道不會有實質效果。
 */
export const getZeroBreakCountWarning = (match: {
  playerTrapCandidates: GameCard[]
  selectedTrapId: string | null
  game: GameState
  viewerPlayerId: PlayerId
}): string | null => {
  const selectedTrap = match.playerTrapCandidates.find(
    (card) => card.instanceId === match.selectedTrapId,
  )
  if (!selectedTrap?.trap) return null

  for (const effect of selectedTrap.trap.effects) {
    if (
      effect.kind !== 'damage-by-break-count' &&
      effect.kind !== 'modify-attack-by-break-count'
    ) {
      continue
    }
    if (getBreakCount(match.game, match.viewerPlayerId, effect) <= 0) {
      return effect.kind === 'damage-by-break-count'
        ? '目前休息區沒有符合條件的餅乾，這個效果將不會造成任何傷害。'
        : '目前休息區沒有符合條件的餅乾，這個效果不會改變攻擊力。'
    }
  }
  return null
}
