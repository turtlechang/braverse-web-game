import type { DeckChoice, TurnPhase } from '../game'

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
  custom: '自訂',
}
