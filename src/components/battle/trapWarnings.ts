import type { EffectContext, GameCard, GameState, PlayerId } from '../../game'
import { getBreakCount, isEffectConditionMet } from '../../game'

/**
 * 選中的陷阱若帶有一個以上的子效果各自掛 `condition`（不管是
 * support-count-at-least、hand-count-at-most 還是任何其他種類），目前條件
 * 不成立的話，發動後那個子效果會被靜默略過（跟 playTrap 對條件不成立的
 * 子效果直接 continue 的行為一致）。陷阱一次付款、一次確認就會結算全部
 * 子效果，不像技能／物品有 EffectPanel 那種「目前條件不成立，確認後會略過
 * 此效果」的逐步提示，玩家完全看不到任何說明，只會覺得「發動了但什麼事
 * 都沒發生」。這裡補上跟 EffectPanel 一致的通用提醒，涵蓋任何條件種類，
 * 不只是 damage-by-break-count／modify-attack-by-break-count（那兩種另外
 * 用更精確的文字說明「不會造成傷害／不會改變攻擊力」，優先顯示）。
 */
export const getUnmetTrapConditionWarning = (match: {
  playerTrapCandidates: GameCard[]
  selectedTrapId: string | null
  game: GameState
  viewerPlayerId: PlayerId
}): string | null => {
  const selectedTrap = match.playerTrapCandidates.find(
    (card) => card.instanceId === match.selectedTrapId,
  )
  if (!selectedTrap?.trap) return null

  const context: EffectContext = {
    sourcePlayerId: match.viewerPlayerId,
    sourceInstanceId: selectedTrap.instanceId,
    sourceCardName: selectedTrap.name,
  }

  let genericWarning: string | null = null

  for (const effect of selectedTrap.trap.effects) {
    if (effect.kind === 'damage-by-break-count' || effect.kind === 'modify-attack-by-break-count') {
      if (getBreakCount(match.game, match.viewerPlayerId, effect) <= 0) {
        return effect.kind === 'damage-by-break-count'
          ? '目前休息區沒有符合條件的餅乾，這個效果將不會造成任何傷害。'
          : '目前休息區沒有符合條件的餅乾，這個效果不會改變攻擊力。'
      }
      continue
    }

    if (
      'condition' in effect &&
      effect.condition &&
      !genericWarning &&
      !isEffectConditionMet(match.game, context, effect)
    ) {
      genericWarning = '目前條件不成立，確認後會略過此效果。'
    }
  }

  return genericWarning
}
