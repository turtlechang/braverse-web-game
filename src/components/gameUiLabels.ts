import type { DeckChoice, LogCategory, TurnPhase } from '../game'
import type { OnlineMatchStatus } from '../hooks/useOnlineMatch'

export const phaseLabels: Record<TurnPhase, string> = {
  active: '活躍階段',
  draw: '抽牌階段',
  support: '支援階段',
  main: '主要階段',
  end: '結束階段',
}

export const logCategoryLabels: Record<LogCategory, string> = {
  draw: '抽牌',
  deploy: '部署',
  attack: '攻擊',
  activate: '陷阱／道具／技能',
  damage: '傷害',
  flip: 'FLIP',
  phase: '階段',
  system: '系統',
}

export const phaseAdvanceLabels: Record<TurnPhase, string> = {
  active: '自動活躍中',
  draw: '自動抽牌中',
  support: '略過支援階段',
  main: '結束主要階段',
  end: '結束回合',
}

/** 能量顏色的中文顯示名，供代價／費用說明文字共用。 */
export const energyColorLabel: Record<string, string> = {
  red: '紅色',
  yellow: '黃色',
  green: '綠色',
  blue: '藍色',
  purple: '紫色',
  black: '黑色',
  pure: '純色',
  wild: '萬用',
  neutral: '無色',
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
  'bs3-green-lily': '第三彈綠色・聖百合餅乾',
  'bs3-blue-sorbet': '第三彈藍色・PR 雪酪',
  'bs3-red-pitaya': '第三彈紅色・火龍果龍族餅乾',
  'bs3-purple-dark-cacao': '第三彈紫色・黑可可餅乾',
  'bs3-purple-dark-cacao-fighting': '第三彈紫色・黑可可餅乾（打架流）',
  'bs3-yellow-counter': '第三彈黃色・反擊流',
  'bs4-red-fire-spirit': 'BS4 紅色・火焰壓制',
  'bs4-yellow-millennial': 'BS4 黃色・千年復生',
  'bs4-green-wind-archer': 'BS4 綠色・風弓支援',
  'bs4-blue-abyss': 'BS4 藍色・深海控制',
  'bs4-purple-moonlight': 'BS4 紫色・月光 Trash',
  'bs5-red-standard': 'BS5 紅色｜標準',
  'bs5-yellow-standard': 'BS5 黃色｜標準',
  'bs5-green-standard': 'BS5 綠色｜標準',
  'bs5-blue-standard': 'BS5 藍色｜標準',
  'bs5-purple-standard': 'BS5 紫色｜標準',
  'bs5-red-open': 'BS5 紅色｜開放',
  'bs5-yellow-open': 'BS5 黃色｜開放',
  'bs5-green-open': 'BS5 綠色｜開放',
  'bs5-blue-open': 'BS5 藍色｜開放',
  'bs5-purple-open': 'BS5 紫色｜開放',
  'bs6-red-standard': 'BS6 紅色｜標準',
  'bs6-yellow-standard': 'BS6 黃色｜標準',
  'bs6-green-standard': 'BS6 綠色｜標準',
  'bs6-blue-standard': 'BS6 藍色｜標準',
  'bs6-purple-standard': 'BS6 紫色｜標準',
  'bs6-red-competitive': 'BS6 紅色｜競技環境',
  'bs6-yellow-competitive': 'BS6 黃色｜競技環境',
  'bs6-green-competitive': 'BS6 綠色｜競技環境',
  'bs6-blue-competitive': 'BS6 藍色｜競技環境',
  'bs6-purple-competitive': 'BS6 紫色｜競技環境',
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
