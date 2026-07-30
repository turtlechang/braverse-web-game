import type { GameState, PlayerId } from '../game'

/**
 * 模式專屬的鎖定旗標:本機戰場傳入 AI 相關欄位,線上戰場傳入
 * viewerControlsState;兩邊都不會全部填,未填的視為不影響鎖定判斷。
 */
export interface InteractionLockExtras {
  pendingAiDecision?: boolean
  aiThinking?: boolean
  aiControlsCurrentState?: boolean
  viewerControlsState?: boolean
}

/**
 * 本機與線上戰場共用的互動鎖定判斷:任何會讓目前檢視者進入「必須先回應
 * 待處理決策」狀態的 GameState 欄位(依對應的 playerId 視角判斷),都會鎖定
 * 戰場其他卡牌互動,避免玩家在提示框開啟時誤觸其他操作。
 */
export function deriveInteractionLocked(
  game: GameState,
  viewerPlayerId: PlayerId,
  pendingEffectActive: boolean,
  faintActive: boolean,
  extras: InteractionLockExtras = {},
): boolean {
  return (
    Boolean(extras.pendingAiDecision) ||
    pendingEffectActive ||
    Boolean(game.pendingOnPlay) ||
    Boolean(game.pendingBattle) ||
    Boolean(game.pendingOpponentHandDiscard) ||
    Boolean(
      game.pendingInspectDeck &&
        game.pendingInspectDeck.playerId === viewerPlayerId,
    ) ||
    Boolean(
      game.pendingRevealTopDeck &&
        game.pendingRevealTopDeck.playerId === viewerPlayerId,
    ) ||
    Boolean(
      game.pendingOptionalCostAttack &&
        game.pendingOptionalCostAttack.playerId === viewerPlayerId,
    ) ||
    Boolean(
      game.pendingDrawUpTo && game.pendingDrawUpTo.playerId === viewerPlayerId,
    ) ||
    Boolean(
      game.pendingEffectOrder &&
        !game.pendingEffectOrder.resolvedOrder &&
        game.pendingEffectOrder.playerId === viewerPlayerId,
    ) ||
    Boolean(
      game.pendingStageTrigger &&
        game.pendingStageTrigger.playerId === viewerPlayerId,
    ) ||
    faintActive ||
    Boolean(extras.aiThinking) ||
    Boolean(extras.aiControlsCurrentState) ||
    extras.viewerControlsState === false
  )
}
