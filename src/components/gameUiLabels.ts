import type { DeckChoice, TurnPhase } from '../game'
import type { OnlineMatchStatus } from '../hooks/useOnlineMatch'

export const phaseLabels: Record<TurnPhase, string> = {
  active: '活躍階段',
  draw: '抽牌階段',
  support: '支援階段',
  main: '主要階段',
  end: '結束階段',
}

export const phaseAdvanceLabels: Record<TurnPhase, string> = {
  active: '自動活躍中',
  draw: '自動抽牌中',
  support: '略過支援階段',
  main: '結束主要階段',
  end: '結束回合',
}

export const deckChoiceLabel: Record<DeckChoice, string> = {
  red: '紅色',
  yellow: '黃色',
  green: '綠色',
  blue: '藍色',
  purple: '紫色',
  'bs2-red': '第二彈紅色',
  'bs2-yellow': '第二彈黃色',
  'bs2-bean': '第二彈豆子',
  'bs2-blue': '第二彈藍色',
  'bs2-purple': '第二彈紫色',
  custom: '自訂',
}

export const onlineMatchStatusLabels: Record<OnlineMatchStatus, string> = {
  idle: '待機中',
  connecting: '連線中',
  'waiting-for-opponent': '等待對手',
  opening: '開局準備',
  'in-progress': '對戰中',
  ended: '已結束',
  error: '錯誤',
}

export const matchEndedReasonLabels: Record<string, string> = {
  victory: '勝利',
  defeat: '敗北',
  'opponent-disconnected': '對手已離線',
}
