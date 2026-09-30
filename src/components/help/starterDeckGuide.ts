import type { StarterDeckChoice } from '../../game/starter-deck'

/** Learning suggestions, not a rating of deck strength. */
export const starterDeckGuide: Record<StarterDeckChoice, string> = {
  red: '入門推薦｜先練習每回合放支援、出牌與攻擊，再閱讀額外傷害效果。',
  yellow: '基礎練習｜注意技能條件與發動時機，先確認代價再選目標。',
  green: '基礎練習｜留意支援配置與餅乾之間的效果配合。',
  blue: '進階練習｜逐段閱讀卡牌移動與後續效果，確認每次選擇的區域。',
  purple: '進階練習｜注意資源代價與卡牌互動，可搭配對戰紀錄逐步理解。',
}
