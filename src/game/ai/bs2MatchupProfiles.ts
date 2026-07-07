import type { CookieCard, CookieInBattle, GameCard, GameState, PlayerId } from '../types'

// ============================================================================
// Break Pressure 等級
// ============================================================================

export type BreakPressureLevel = 'safe' | 'warning' | 'danger' | 'critical'

export const BREAK_PRESSURE_THRESHOLDS = {
  safe: 6,
  warning: 8,
  danger: 10,
  critical: 12,
} as const

export const evaluateBreakPressure = (
  breakArea: CookieCard[],
): BreakPressureLevel => {
  const breakLevel = breakArea.reduce((sum, card) => sum + card.level, 0)

  if (breakLevel < BREAK_PRESSURE_THRESHOLDS.safe) return 'safe'
  if (breakLevel < BREAK_PRESSURE_THRESHOLDS.warning) return 'warning'
  if (breakLevel < BREAK_PRESSURE_THRESHOLDS.danger) return 'danger'
  return 'critical'
}

// ============================================================================
// 替補評分表（每張餅乾的分數）
// ============================================================================

export interface ReplacementScore {
  baseScore: number
  reason: string
}

// 紅色餅乾替補評分（對手：綠色/黃色）
const RED_REPLACEMENT_SCORES: Record<string, ReplacementScore> = {
  'Rebel Cookie': { baseScore: 95, reason: '高攻擊，能創造節奏' },
  'Dark Choco Cookie': { baseScore: 95, reason: '高攻擊，穩定輸出' },
  'Princess Cookie': { baseScore: 85, reason: '穩定的二級餅乾' },
  'Muscle Cookie': { baseScore: 80, reason: '穩定' },
  'Cherry Cookie': { baseScore: 70, reason: '有效果但 HP 較低' },
  'Mala Sauce Cookie': { baseScore: 70, reason: '有效果但 HP 較低' },
  'Whipped Cream Cookie': { baseScore: 65, reason: '有效果但 HP 較低' },
  'Wildberry Cookie': { baseScore: 60, reason: 'Lv3 但要小心使用' },
  'Kumiho Cookie': { baseScore: 60, reason: 'Lv3 但要小心使用' },
  'Popcorn Cookie': { baseScore: 10, reason: 'HP 1 太容易被換掉' },
  'Adventurer Cookie': { baseScore: 10, reason: 'HP 1 太容易被換掉' },
  'Carrot Cookie': { baseScore: 10, reason: 'HP 1 太容易被換掉' },
  'Melon Bun Cookie': { baseScore: 10, reason: 'HP 1 太容易被換掉' },
}

// 黃色餅乾替補評分（對手：紅色/綠色）
const YELLOW_REPLACEMENT_SCORES: Record<string, ReplacementScore> = {
  'Banana Cookie': { baseScore: 95, reason: 'HP 高，能撐很久' },
  'Vampire Cookie': { baseScore: 95, reason: 'HP 高，有回復能力' },
  'Marshmallow Cookie': { baseScore: 85, reason: 'HP 高，穩定' },
  'Snake Fruit Cookie': { baseScore: 75, reason: '有效果但 HP 較低' },
  'Rockstar Cookie': { baseScore: 75, reason: '攻擊力高但 HP 較低' },
  'Eclair Cookie': { baseScore: 70, reason: '高等級但要小心使用' },
  'Earl Grey Cookie': { baseScore: 70, reason: '高等級但要小心使用' },
  'Blackberry Cookie': { baseScore: 65, reason: '高等級但要小心使用' },
  'Chestnut Cookie': { baseScore: 10, reason: 'HP 1 太容易被換掉' },
  'Mustard Cookie': { baseScore: 10, reason: 'HP 1 太容易被換掉' },
  'Cyborg Cookie': { baseScore: 10, reason: 'HP 1 太容易被換掉' },
}

// 綠色餅乾替補評分（對手：紅色/黃色）
const GREEN_REPLACEMENT_SCORES: Record<string, ReplacementScore> = {
  'Red Bean Cookie': { baseScore: 95, reason: '高攻擊，穩定' },
  'Onion Cookie': { baseScore: 90, reason: '穩定的二級餅乾' },
  'Avocado Cookie': { baseScore: 85, reason: '穩定' },
  'Blue Lily Cookie': { baseScore: 75, reason: '高等級但要小心' },
  'Lemon Thyme Cookie': { baseScore: 70, reason: '有效果但 HP 較低' },
  'Ninja Cookie': { baseScore: 60, reason: '有效果但 HP 較低' },
  'Angel Cookie': { baseScore: 10, reason: 'HP 1 太容易被換掉' },
  'Spinach Cookie': { baseScore: 10, reason: 'HP 1 太容易被換掉' },
  'Bellflower Cookie': { baseScore: 10, reason: 'HP 1 太容易被換掉' },
  'Cookiemals': { baseScore: 10, reason: 'HP 1 太容易被換掉' },
  'Banana Cookie': { baseScore: 10, reason: 'HP 1 太容易被換掉' },
  'Melon Bun Cookie': { baseScore: 10, reason: 'HP 1 太容易被換掉' },
  'Candlelight Cookie': { baseScore: 10, reason: 'HP 1 太容易被換掉' },
  'Salt Cookie': { baseScore: 10, reason: 'HP 1 太容易被換掉' },
}

// ============================================================================
// 攻擊威脅值表
// ============================================================================

export interface AttackThreatScore {
  threatValue: number
  reason: string
}

// 紅色對手（綠色/黃色）的威脅值
const RED_OPPONENT_THREAT_VALUES: Record<string, AttackThreatScore> = {
  'Red Bean Cookie': { threatValue: 95, reason: 'HP 高，攻擊力強' },
  'Onion Cookie': { threatValue: 90, reason: 'HP 高，穩定' },
  'Blue Lily Cookie': { threatValue: 85, reason: 'Lv3，強力效果' },
  'Lemon Thyme Cookie': { threatValue: 80, reason: '有效果' },
  'Avocado Cookie': { threatValue: 75, reason: 'HP 高，穩定' },
  'Banana Cookie': { threatValue: 70, reason: 'HP 高' },
  'Vampire Cookie': { threatValue: 70, reason: 'HP 高，有回復' },
  'Eclair Cookie': { threatValue: 65, reason: 'Lv3 但要小心' },
  'Timekeeper Cookie': { threatValue: 65, reason: 'Lv3 但要小心' },
  'Rockstar Cookie': { threatValue: 60, reason: '攻擊力高' },
  'Angel Cookie': { threatValue: 10, reason: '價值低' },
  'Spinach Cookie': { threatValue: 10, reason: '價值低' },
  'Bellflower Cookie': { threatValue: 10, reason: '價值低' },
  'Cookiemals': { threatValue: 10, reason: '價值低' },
  'Candlelight Cookie': { threatValue: 10, reason: '價值低' },
  'Salt Cookie': { threatValue: 10, reason: '價值低' },
  'Melon Bun Cookie': { threatValue: 10, reason: '價值低' },
}

// 黃色對手（紅色）的威脅值
const YELLOW_OPPONENT_THREAT_VALUES: Record<string, AttackThreatScore> = {
  'Rebel Cookie': { threatValue: 95, reason: 'HP 高，攻擊力強' },
  'Dark Choco Cookie': { threatValue: 95, reason: 'HP 高，攻擊力強' },
  'Princess Cookie': { threatValue: 80, reason: 'HP 高，穩定' },
  'Mala Sauce Cookie': { threatValue: 75, reason: '有效果' },
  'Cherry Cookie': { threatValue: 70, reason: '有效果' },
  'Muscle Cookie': { threatValue: 65, reason: '穩定' },
  'Popcorn Cookie': { threatValue: 10, reason: '價值低' },
  'Carrot Cookie': { threatValue: 10, reason: '價值低' },
  'Adventurer Cookie': { threatValue: 10, reason: '價值低' },
}

// 綠色對手（紅色/黃色）的威脅值
const GREEN_OPPONENT_THREAT_VALUES: Record<string, AttackThreatScore> = {
  'Rebel Cookie': { threatValue: 95, reason: 'HP 高，攻擊力強' },
  'Dark Choco Cookie': { threatValue: 95, reason: 'HP 高，攻擊力強' },
  'Princess Cookie': { threatValue: 80, reason: 'HP 高，穩定' },
  'Banana Cookie': { threatValue: 85, reason: 'HP 高' },
  'Vampire Cookie': { threatValue: 85, reason: 'HP 高，有回復' },
  'Eclair Cookie': { threatValue: 75, reason: 'Lv3 但要小心' },
  'Timekeeper Cookie': { threatValue: 75, reason: 'Lv3 但要小心' },
  'Rockstar Cookie': { threatValue: 70, reason: '攻擊力高' },
  'Mala Sauce Cookie': { threatValue: 65, reason: '有效果' },
  'Cherry Cookie': { threatValue: 60, reason: '有效果' },
  'Popcorn Cookie': { threatValue: 10, reason: '價值低' },
  'Carrot Cookie': { threatValue: 10, reason: '價值低' },
  'Adventurer Cookie': { threatValue: 10, reason: '價值低' },
  'Chestnut Cookie': { threatValue: 10, reason: '價值低' },
  'Mustard Cookie': { threatValue: 10, reason: '價值低' },
  'Cyborg Cookie': { threatValue: 10, reason: '價值低' },
}

// ============================================================================
// 低價值餅乾（不該鋪第二隻）
// ============================================================================

export const LOW_VALUE_COOKIES = [
  'Popcorn Cookie',
  'Adventurer Cookie',
  'Carrot Cookie',
  'Melon Bun Cookie',
  'Chestnut Cookie',
  'Mustard Cookie',
  'Cyborg Cookie',
  'Angel Cookie',
  'Spinach Cookie',
  'Bellflower Cookie',
  'Cookiemals',
  'Candlelight Cookie',
  'Salt Cookie',
]

// ============================================================================
// 對局配置介面
// ============================================================================

export interface MatchupProfile {
  color: 'red' | 'yellow' | 'green'
  replacementScores: Record<string, ReplacementScore>
  attackThreatValues: Record<string, AttackThreatScore>
  lowValueCookies: string[]
  breakPressureThresholds: typeof BREAK_PRESSURE_THRESHOLDS
}

// ============================================================================
// 對局配置實例
// ============================================================================

export const MATCHUP_PROFILES: Record<string, MatchupProfile> = {
  red: {
    color: 'red',
    replacementScores: RED_REPLACEMENT_SCORES,
    attackThreatValues: RED_OPPONENT_THREAT_VALUES,
    lowValueCookies: [
      'Popcorn Cookie',
      'Adventurer Cookie',
      'Carrot Cookie',
      'Melon Bun Cookie',
    ],
    breakPressureThresholds: BREAK_PRESSURE_THRESHOLDS,
  },
  yellow: {
    color: 'yellow',
    replacementScores: YELLOW_REPLACEMENT_SCORES,
    attackThreatValues: YELLOW_OPPONENT_THREAT_VALUES,
    lowValueCookies: [
      'Chestnut Cookie',
      'Mustard Cookie',
      'Cyborg Cookie',
    ],
    breakPressureThresholds: BREAK_PRESSURE_THRESHOLDS,
  },
  green: {
    color: 'green',
    replacementScores: GREEN_REPLACEMENT_SCORES,
    attackThreatValues: GREEN_OPPONENT_THREAT_VALUES,
    lowValueCookies: [
      'Angel Cookie',
      'Spinach Cookie',
      'Bellflower Cookie',
      'Cookiemals',
      'Banana Cookie',
      'Melon Bun Cookie',
      'Candlelight Cookie',
      'Salt Cookie',
    ],
    breakPressureThresholds: BREAK_PRESSURE_THRESHOLDS,
  },
}

// ============================================================================
// 輔助函式
// ============================================================================

/**
 * 根據玩家 ID 獲取對應的對局配置
 */
export const getMatchupProfile = (
  _state: GameState,
  _playerId: PlayerId,
): MatchupProfile => {
  // 預設使用紅色配置
  // 未來可以根據手牌或戰鬥區的餅乾顏色來判斷
  return MATCHUP_PROFILES.red
}

/**
 * 計算替補評分
 */
export const scoreReplacement = (
  card: GameCard,
  profile: MatchupProfile,
  breakPressure: BreakPressureLevel,
): number => {
  const scoreEntry = profile.replacementScores[card.name]
  const baseScore = scoreEntry?.baseScore ?? 50

  // Break pressure 調整
  let adjustment = 0
  if (card.type === 'cookie') {
    if (breakPressure === 'critical') {
      // 危急時更重視 HP
      adjustment = card.hp * 5
    } else if (breakPressure === 'danger') {
      // 危險時稍微重視 HP
      adjustment = card.hp * 2
    }
  }

  // 低價值餅乾懲罰
  const isLowValue = profile.lowValueCookies.includes(card.name)
  const lowValuePenalty = isLowValue ? -40 : 0

  return baseScore + adjustment + lowValuePenalty
}

/**
 * 計算攻擊目標評分（越高越應該攻擊）
 */
export const scoreAttackTarget = (
  cookie: CookieInBattle,
  profile: MatchupProfile,
  state: GameState,
  attackerPlayerId: PlayerId,
): number => {
  const cookieName = cookie.card.name
  const threatEntry = profile.attackThreatValues[cookieName]
  const threatValue = threatEntry?.threatValue ?? 50

  // 可擊殺加成
  const attackerId = attackerPlayerId
  const attackerCookies = state.players[attackerId].battleArea
  const maxDamage = attackerCookies.reduce(
    (max, c) => Math.max(max, c.card.attack ?? 0),
    0,
  )
  const canLethal = cookie.hpCards.length <= maxDamage
  const lethalBonus = canLethal ? 100 : 0

  // Break area 好處（擊倒高級餅乾對手破壞區幫助更大）
  const breakAreaBenefit = cookie.card.level * 20

  return threatValue + lethalBonus + breakAreaBenefit
}

/**
 * 評估手牌品質（決定是否部署）
 */
export const evaluateHandQuality = (
  hand: GameCard[],
  profile: MatchupProfile,
): number => {
  if (hand.length === 0) return 0

  let totalScore = 0
  for (const card of hand) {
    if (card.type === 'cookie') {
      const scoreEntry = profile.replacementScores[card.name]
      totalScore += scoreEntry?.baseScore ?? 50
    }
  }

  return totalScore / hand.length
}

/**
 * 選擇最佳部署餅乾
 */
export const chooseBestCookieToDeploy = (
  hand: GameCard[],
  profile: MatchupProfile,
): GameCard | undefined => {
  const cookieCards = hand.filter((card) => card.type === 'cookie')
  if (cookieCards.length === 0) return undefined

  // 按替補評分排序
  return cookieCards.sort((left, right) => {
    const leftScore = profile.replacementScores[left.name]?.baseScore ?? 50
    const rightScore = profile.replacementScores[right.name]?.baseScore ?? 50
    return rightScore - leftScore
  })[0]
}

/**
 * 計算破壞區等級總和
 */
export const sumBreakLevel = (breakArea: CookieCard[]): number =>
  breakArea.reduce((sum, card) => sum + card.level, 0)
