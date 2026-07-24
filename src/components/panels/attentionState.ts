import type { ActionStatusMode } from './actionStatus'

export type AttentionState =
  | 'player-turn'
  | 'opponent-turn'
  | 'player-response-required'
  | 'network-waiting'

export interface DeriveAttentionStateOptions {
  mode: ActionStatusMode
  isPlayerTurn: boolean
}

/**
 * 把既有的 actionStatus.mode（本機/線上共用）換算成畫面該強調的「誰需要被注意」
 * 狀態,而不是單純的「現在輪到誰」——例如我方宣告攻擊後等對手決定是否發陷阱,
 * 這在遊戲規則上仍是我方回合,但畫面上該提示的是「對手正在行動」。AI 思考中
 * 沿用跟一般對手回合相同的顏色,不再另外區分。
 */
export function deriveAttentionState({
  mode,
  isPlayerTurn,
}: DeriveAttentionStateOptions): AttentionState {
  switch (mode) {
    case 'syncing':
      return 'network-waiting'
    case 'awaiting-local-decision':
      // 這個 mode 同時涵蓋「輪到你的一般主要階段」與「對手回合中你要回應
      // 陷阱/Blocker/FLIP」——只有後者才是需要琥珀色特別提醒的情境。
      return isPlayerTurn ? 'player-turn' : 'player-response-required'
    case 'awaiting-opponent-decision':
    case 'opponent-thinking':
      return 'opponent-turn'
    case 'resolving':
    default:
      return isPlayerTurn ? 'player-turn' : 'opponent-turn'
  }
}
