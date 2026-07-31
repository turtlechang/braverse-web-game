import type { CookieCard, CookieInBattle, GameCard, GameState, PlayerId } from '../types'
import {
  estimateAttackThreatValue,
  estimateSkillEffectValue,
  hasDerivedDefensiveSkill,
} from './skill-value'

// ============================================================================
// Break Pressure 等級
// ============================================================================

export type BreakPressureLevel = 'safe' | 'warning' | 'danger' | 'critical'

export const BREAK_PRESSURE_THRESHOLDS = {
  safe: 4,
  warning: 6,
  danger: 8,
  critical: 10,
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
// 以官方卡號（card.id）為 key，不用卡名——同名卡在不同彈會重印成完全不同的
// 卡（例如 BS1-012／BS3-009 都叫 Wildberry Cookie），用卡名當 key 會讓新彈
// 重印卡誤套到舊彈的評分。key 旁的卡名註解僅供閱讀，不參與比對。
const RED_REPLACEMENT_SCORES: Record<string, ReplacementScore> = {
  'BS2-003': { baseScore: 95, reason: '高攻擊，能創造節奏' }, // Rebel Cookie
  'BS1-003': { baseScore: 95, reason: '高攻擊，穩定輸出' }, // Dark Choco Cookie
  'ST1-001': { baseScore: 85, reason: '穩定的二級餅乾' }, // Princess Cookie
  'BS2-001': { baseScore: 80, reason: '穩定' }, // Muscle Cookie
  'BS2-004': { baseScore: 70, reason: '有效果但 HP 較低' }, // Cherry Cookie
  'BS1-006': { baseScore: 70, reason: '有效果但 HP 較低' }, // Mala Sauce Cookie
  'BS1-021': { baseScore: 65, reason: '無技能，純數值攻擊，HP 尚可' }, // Whipped Cream Cookie
  'BS1-012': { baseScore: 60, reason: 'Lv3 但要小心使用' }, // Wildberry Cookie
  'BS1-002': { baseScore: 60, reason: 'Lv3 但要小心使用' }, // Kumiho Cookie
  'BS1-018': { baseScore: 10, reason: 'HP 1 太容易被換掉' }, // Popcorn Cookie
  'ST1-013': { baseScore: 10, reason: 'HP 1 太容易被換掉' }, // Adventurer Cookie
  'ST1-004': { baseScore: 10, reason: 'HP 1 太容易被換掉' }, // Carrot Cookie
  'BS1-007': { baseScore: 10, reason: '實際 HP 4，僅純數值無技能，非本色主力' }, // Melon Bun Cookie
}

// 黃色餅乾替補評分（對手：紅色/綠色）
const YELLOW_REPLACEMENT_SCORES: Record<string, ReplacementScore> = {
  'BS1-032': { baseScore: 95, reason: 'HP 高，能撐很久' }, // Banana Cookie
  'BS2-010': { baseScore: 95, reason: '可選代價對 LV1 目標追加傷害' }, // Vampire Cookie
  'BS1-031': { baseScore: 85, reason: 'HP 高，穩定' }, // Marshmallow Cookie
  'BS1-036': { baseScore: 75, reason: '有效果，HP 尚可（休息區重新登場）' }, // Snake Fruit Cookie
  'BS1-030': { baseScore: 75, reason: '攻擊力高但 HP 較低' }, // Rockstar Cookie
  'ST2-008': { baseScore: 70, reason: '高等級但要小心使用' }, // Eclair Cookie
  'BS1-040': { baseScore: 70, reason: '高等級但要小心使用' }, // Earl Grey Cookie
  'BS2-011': { baseScore: 65, reason: '高等級但要小心使用' }, // Blackberry Cookie
  'ST2-007': { baseScore: 10, reason: 'HP 1 太容易被換掉' }, // Chestnut Cookie
  'ST2-005': { baseScore: 10, reason: 'HP 1 太容易被換掉' }, // Mustard Cookie
  'BS1-033': { baseScore: 10, reason: '實際 HP 2，仍偏低容易被換掉' }, // Cyborg Cookie
}

// 綠色餅乾替補評分（對手：紅色/黃色）
const GREEN_REPLACEMENT_SCORES: Record<string, ReplacementScore> = {
  'BS1-055': { baseScore: 95, reason: '高攻擊，穩定' }, // Red Bean Cookie
  'ST3-011': { baseScore: 90, reason: '穩定的二級餅乾' }, // Onion Cookie
  'ST3-009': { baseScore: 85, reason: '穩定' }, // Avocado Cookie
  'BS1-054': { baseScore: 75, reason: '高等級但要小心' }, // Blue Lily Cookie
  'BS2-015': { baseScore: 70, reason: '有效果但 HP 較低' }, // Lemon Thyme Cookie
  'BS2-053': { baseScore: 60, reason: '無技能，純數值攻擊，HP 尚可' }, // Ninja Cookie
  'ST3-014': { baseScore: 10, reason: 'HP 1 太容易被換掉' }, // Angel Cookie
  'ST3-008': { baseScore: 10, reason: 'HP 1 太容易被換掉' }, // Spinach Cookie
  'BS1-057': { baseScore: 10, reason: '實際 HP 4，僅純數值無技能，非本色主力' }, // Bellflower Cookie
  'BS1-069': { baseScore: 10, reason: 'HP 1 太容易被換掉' }, // Cookiemals
  'BS1-032': { baseScore: 10, reason: '實際 HP 4，僅純數值無技能，非本色主力' }, // Banana Cookie（綠色牌組僅少量搭配）
  'BS1-007': { baseScore: 10, reason: '實際 HP 4，僅純數值無技能，非本色主力' }, // Melon Bun Cookie
  'BS2-018': { baseScore: 10, reason: '實際 HP 3 且有技能（清對手場景），非本色主力' }, // Candlelight Cookie
  'BS2-035': { baseScore: 10, reason: '實際 HP 4，僅純數值無技能，非本色主力' }, // Salt Cookie
}

// 藍色餅乾替補評分（對手：紅色/黃色/綠色/紫色）
const BLUE_REPLACEMENT_SCORES: Record<string, ReplacementScore> = {
  'BS2-029': { baseScore: 95, reason: 'HP 高，攻擊力強，後期核心' }, // Sea Fairy Cookie
  'BS2-031': { baseScore: 90, reason: 'HP 高，AOE 傷害' }, // Black Raisin Cookie
  'BS2-036': { baseScore: 85, reason: 'HP 高，回手效果' }, // Sherbet Cookie
  'BS2-044': { baseScore: 80, reason: '有效果，對 Lv1 餅乾額外傷害' }, // Tiramisu Cookie
  'BS2-035': { baseScore: 75, reason: 'HP 高，穩定' }, // Salt Cookie
  'BS2-037': { baseScore: 70, reason: '高等級但 Flip 需手牌' }, // Chocolate Bonbon Cookie
  'ST4-007': { baseScore: 65, reason: '抽牌效果但 HP 較低' }, // Sour Belt Cookie
  'BS2-040': { baseScore: 60, reason: '滅亡效果但 HP 低' }, // Aloe Cookie
  'BS2-042': { baseScore: 10, reason: 'HP 1 太容易被換掉' }, // Milk Cookie
  'ST4-014': { baseScore: 10, reason: 'HP 1 太容易被換掉' }, // Skating Queen Cookie
  'ST4-006': { baseScore: 10, reason: 'HP 1 太容易被換掉' }, // Peppermint Cookie
}

// 紫色餅乾替補評分（對手：紅色/黃色/綠色/藍色）
const PURPLE_REPLACEMENT_SCORES: Record<string, ReplacementScore> = {
  'BS2-058': { baseScore: 95, reason: 'HP 高，攻擊力強，後期核心' }, // Wind Archer Cookie
  'BS2-055': { baseScore: 90, reason: 'HP 高，登場清場' }, // Poison Mushroom Cookie
  'BS2-068': { baseScore: 85, reason: 'HP 高，棄牌區卡片回收' }, // Cream Unicorn Cookie
  'BS2-069': { baseScore: 80, reason: '有效果，送對手 Lv1 進棄牌區' }, // Clotted Cream Cookie
  'BS2-075': { baseScore: 75, reason: '有效果，對 Lv1 餅乾額外傷害' }, // White Choco Cookie
  'BS2-061': { baseScore: 70, reason: '棄牌區卡片回收效果' }, // Hydrangea Cookie
  'ST5-007': { baseScore: 65, reason: '有效果但 HP 較低' }, // Yoga Cookie
  'BS2-062': { baseScore: 60, reason: '犧牲效果需謹慎使用' }, // Starfruit Cookie
  'BS2-056': { baseScore: 10, reason: 'HP 1 太容易被換掉' }, // Raspberry Mousse Cookie
  'ST5-003': { baseScore: 10, reason: 'HP 1 太容易被換掉' }, // Fig Cookie
  'ST5-008': { baseScore: 10, reason: 'HP 1 太容易被換掉' }, // Fairy Cookie
  'BS2-072': { baseScore: 55, reason: 'Flip 需手牌，HP 較低' }, // Pastry Cookie
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
  'BS1-055': { threatValue: 95, reason: 'HP 高，攻擊力強' }, // Red Bean Cookie
  'ST3-011': { threatValue: 90, reason: 'HP 高，穩定' }, // Onion Cookie
  'BS1-054': { threatValue: 85, reason: 'Lv3，強力效果' }, // Blue Lily Cookie
  'BS2-015': { threatValue: 80, reason: '有效果' }, // Lemon Thyme Cookie
  'ST3-009': { threatValue: 75, reason: 'HP 高，穩定' }, // Avocado Cookie
  'BS1-032': { threatValue: 70, reason: 'HP 高' }, // Banana Cookie
  'BS2-010': { threatValue: 70, reason: '可選代價對 LV1 目標追加傷害' }, // Vampire Cookie
  'ST2-008': { threatValue: 65, reason: 'Lv3 但要小心' }, // Eclair Cookie
  'BS1-037': { threatValue: 65, reason: 'Lv3 但要小心' }, // Timekeeper Cookie
  'BS1-030': { threatValue: 60, reason: '攻擊力高' }, // Rockstar Cookie
  'ST3-014': { threatValue: 10, reason: '價值低' }, // Angel Cookie
  'ST3-008': { threatValue: 10, reason: '價值低' }, // Spinach Cookie
  'BS1-057': { threatValue: 10, reason: '價值低' }, // Bellflower Cookie
  'BS1-069': { threatValue: 10, reason: '價值低' }, // Cookiemals
  'BS2-018': { threatValue: 10, reason: '價值低' }, // Candlelight Cookie
  'BS2-035': { threatValue: 10, reason: '價值低' }, // Salt Cookie
  'BS1-007': { threatValue: 10, reason: '價值低' }, // Melon Bun Cookie
}

// 黃色對手（紅色）的威脅值
const YELLOW_OPPONENT_THREAT_VALUES: Record<string, AttackThreatScore> = {
  'BS2-003': { threatValue: 95, reason: 'HP 高，攻擊力強' }, // Rebel Cookie
  'BS1-003': { threatValue: 95, reason: 'HP 高，攻擊力強' }, // Dark Choco Cookie
  'ST1-001': { threatValue: 80, reason: 'HP 高，穩定' }, // Princess Cookie
  'BS1-006': { threatValue: 75, reason: '有效果' }, // Mala Sauce Cookie
  'BS2-004': { threatValue: 70, reason: '有效果' }, // Cherry Cookie
  'BS2-001': { threatValue: 65, reason: '穩定' }, // Muscle Cookie
  'BS1-018': { threatValue: 10, reason: '價值低' }, // Popcorn Cookie
  'ST1-004': { threatValue: 10, reason: '價值低' }, // Carrot Cookie
  'ST1-013': { threatValue: 10, reason: '價值低' }, // Adventurer Cookie
}

// 綠色對手（紅色/黃色）的威脅值
const GREEN_OPPONENT_THREAT_VALUES: Record<string, AttackThreatScore> = {
  'BS2-003': { threatValue: 95, reason: 'HP 高，攻擊力強' }, // Rebel Cookie
  'BS1-003': { threatValue: 95, reason: 'HP 高，攻擊力強' }, // Dark Choco Cookie
  'ST1-001': { threatValue: 80, reason: 'HP 高，穩定' }, // Princess Cookie
  'BS1-032': { threatValue: 85, reason: 'HP 高' }, // Banana Cookie
  'BS2-010': { threatValue: 85, reason: '可選代價對 LV1 目標追加傷害' }, // Vampire Cookie
  'ST2-008': { threatValue: 75, reason: 'Lv3 但要小心' }, // Eclair Cookie
  'BS1-037': { threatValue: 75, reason: 'Lv3 但要小心' }, // Timekeeper Cookie
  'BS1-030': { threatValue: 70, reason: '攻擊力高' }, // Rockstar Cookie
  'BS1-006': { threatValue: 65, reason: '有效果' }, // Mala Sauce Cookie
  'BS2-004': { threatValue: 60, reason: '有效果' }, // Cherry Cookie
  'BS1-018': { threatValue: 10, reason: '價值低' }, // Popcorn Cookie
  'ST1-004': { threatValue: 10, reason: '價值低' }, // Carrot Cookie
  'ST1-013': { threatValue: 10, reason: '價值低' }, // Adventurer Cookie
  'ST2-007': { threatValue: 10, reason: '價值低' }, // Chestnut Cookie
  'ST2-005': { threatValue: 10, reason: '價值低' }, // Mustard Cookie
  'BS1-033': { threatValue: 10, reason: '價值低' }, // Cyborg Cookie
}

// 藍色對手（紅色/黃色/綠色/紫色）的威脅值
const BLUE_OPPONENT_THREAT_VALUES: Record<string, AttackThreatScore> = {
  'BS2-003': { threatValue: 95, reason: 'HP 高，攻擊力強' }, // Rebel Cookie
  'BS1-003': { threatValue: 95, reason: 'HP 高，攻擊力強' }, // Dark Choco Cookie
  'BS2-058': { threatValue: 90, reason: 'HP 高，直接移除 Lv3' }, // Wind Archer Cookie
  'BS2-055': { threatValue: 85, reason: 'HP 高，登場清場' }, // Poison Mushroom Cookie
  'BS1-032': { threatValue: 85, reason: 'HP 高' }, // Banana Cookie
  'BS2-010': { threatValue: 85, reason: '可選代價對 LV1 目標追加傷害' }, // Vampire Cookie
  'ST1-001': { threatValue: 80, reason: 'HP 高，穩定' }, // Princess Cookie
  'BS2-068': { threatValue: 80, reason: 'HP 高，棄牌區卡片回收' }, // Cream Unicorn Cookie
  'BS1-055': { threatValue: 75, reason: 'HP 高，攻擊力強' }, // Red Bean Cookie
  'BS2-069': { threatValue: 75, reason: '有效果' }, // Clotted Cream Cookie
  'ST3-011': { threatValue: 70, reason: '穩定' }, // Onion Cookie
  'ST2-008': { threatValue: 70, reason: 'Lv3 但要小心' }, // Eclair Cookie
  'BS1-037': { threatValue: 70, reason: 'Lv3 但要小心' }, // Timekeeper Cookie
  'BS1-030': { threatValue: 65, reason: '攻擊力高' }, // Rockstar Cookie
  'BS2-075': { threatValue: 65, reason: '有效果' }, // White Choco Cookie
  'BS1-006': { threatValue: 60, reason: '有效果' }, // Mala Sauce Cookie
  'BS2-004': { threatValue: 55, reason: '有效果' }, // Cherry Cookie
  'BS1-018': { threatValue: 10, reason: '價值低' }, // Popcorn Cookie
  'ST1-004': { threatValue: 10, reason: '價值低' }, // Carrot Cookie
  'ST1-013': { threatValue: 10, reason: '價值低' }, // Adventurer Cookie
  'ST2-007': { threatValue: 10, reason: '價值低' }, // Chestnut Cookie
  'ST2-005': { threatValue: 10, reason: '價值低' }, // Mustard Cookie
  'BS1-033': { threatValue: 10, reason: '價值低' }, // Cyborg Cookie
  'ST3-014': { threatValue: 10, reason: '價值低' }, // Angel Cookie
  'ST3-008': { threatValue: 10, reason: '價值低' }, // Spinach Cookie
}

// 紫色對手（紅色/黃色/綠色/藍色）的威脅值
const PURPLE_OPPONENT_THREAT_VALUES: Record<string, AttackThreatScore> = {
  'BS2-003': { threatValue: 95, reason: 'HP 高，攻擊力強' }, // Rebel Cookie
  'BS1-003': { threatValue: 95, reason: 'HP 高，攻擊力強' }, // Dark Choco Cookie
  'BS2-029': { threatValue: 90, reason: 'HP 高，回手效果' }, // Sea Fairy Cookie
  'BS2-031': { threatValue: 85, reason: 'HP 高，AOE 傷害' }, // Black Raisin Cookie
  'BS1-032': { threatValue: 85, reason: 'HP 高' }, // Banana Cookie
  'BS2-010': { threatValue: 85, reason: '可選代價對 LV1 目標追加傷害' }, // Vampire Cookie
  'ST1-001': { threatValue: 80, reason: 'HP 高，穩定' }, // Princess Cookie
  'BS1-055': { threatValue: 80, reason: 'HP 高，攻擊力強' }, // Red Bean Cookie
  'BS2-036': { threatValue: 75, reason: 'HP 高，回手效果' }, // Sherbet Cookie
  'ST3-011': { threatValue: 75, reason: '穩定' }, // Onion Cookie
  'BS2-044': { threatValue: 70, reason: '有效果' }, // Tiramisu Cookie
  'ST2-008': { threatValue: 70, reason: 'Lv3 但要小心' }, // Eclair Cookie
  'BS1-037': { threatValue: 70, reason: 'Lv3 但要小心' }, // Timekeeper Cookie
  'BS1-030': { threatValue: 65, reason: '攻擊力高' }, // Rockstar Cookie
  'BS1-006': { threatValue: 60, reason: '有效果' }, // Mala Sauce Cookie
  'BS2-004': { threatValue: 55, reason: '有效果' }, // Cherry Cookie
  'BS1-018': { threatValue: 10, reason: '價值低' }, // Popcorn Cookie
  'ST1-004': { threatValue: 10, reason: '價值低' }, // Carrot Cookie
  'ST1-013': { threatValue: 10, reason: '價值低' }, // Adventurer Cookie
  'ST2-007': { threatValue: 10, reason: '價值低' }, // Chestnut Cookie
  'ST2-005': { threatValue: 10, reason: '價值低' }, // Mustard Cookie
  'BS1-033': { threatValue: 10, reason: '價值低' }, // Cyborg Cookie
  'BS2-042': { threatValue: 10, reason: '價值低' }, // Milk Cookie
  'ST4-014': { threatValue: 10, reason: '價值低' }, // Skating Queen Cookie
}

// ============================================================================
// 低價值餅乾（不該鋪第二隻）
// ============================================================================

/**
 * 未被任何函式消費——實際判斷走的是下面 MATCHUP_PROFILES 各色自己的
 * lowValueCookies。保留只是避免動到匯出介面，未來若要接上就地啟用即可。
 */
export const LOW_VALUE_COOKIES = [
  'BS1-018', // Popcorn Cookie
  'ST1-013', // Adventurer Cookie
  'ST1-004', // Carrot Cookie
  'BS1-007', // Melon Bun Cookie
  'ST2-007', // Chestnut Cookie
  'ST2-005', // Mustard Cookie
  'BS1-033', // Cyborg Cookie
  'ST3-014', // Angel Cookie
  'ST3-008', // Spinach Cookie
  'BS1-057', // Bellflower Cookie
  'BS1-069', // Cookiemals
  'BS2-018', // Candlelight Cookie
  'BS2-035', // Salt Cookie
]

// ============================================================================
// 對局配置介面
// ============================================================================

export interface MatchupProfile {
  color: 'red' | 'yellow' | 'green' | 'blue' | 'purple'
  replacementScores: Record<string, ReplacementScore>
  attackThreatValues: Record<string, AttackThreatScore>
  /** card.id（官方卡號），不是卡名——同名跨彈重印卡才不會互相誤套。 */
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
      'BS1-018', // Popcorn Cookie
      'ST1-013', // Adventurer Cookie
      'ST1-004', // Carrot Cookie
      'BS1-007', // Melon Bun Cookie
    ],
    breakPressureThresholds: BREAK_PRESSURE_THRESHOLDS,
  },
  yellow: {
    color: 'yellow',
    replacementScores: YELLOW_REPLACEMENT_SCORES,
    attackThreatValues: YELLOW_OPPONENT_THREAT_VALUES,
    lowValueCookies: [
      'ST2-007', // Chestnut Cookie
      'ST2-005', // Mustard Cookie
      'BS1-033', // Cyborg Cookie
    ],
    breakPressureThresholds: BREAK_PRESSURE_THRESHOLDS,
  },
  green: {
    color: 'green',
    replacementScores: GREEN_REPLACEMENT_SCORES,
    attackThreatValues: GREEN_OPPONENT_THREAT_VALUES,
    lowValueCookies: [
      'ST3-014', // Angel Cookie
      'ST3-008', // Spinach Cookie
      'BS1-057', // Bellflower Cookie
      'BS1-069', // Cookiemals
      'BS1-032', // Banana Cookie
      'BS1-007', // Melon Bun Cookie
      'BS2-018', // Candlelight Cookie
      'BS2-035', // Salt Cookie
    ],
    breakPressureThresholds: BREAK_PRESSURE_THRESHOLDS,
  },
  blue: {
    color: 'blue',
    replacementScores: BLUE_REPLACEMENT_SCORES,
    attackThreatValues: BLUE_OPPONENT_THREAT_VALUES,
    lowValueCookies: [
      'BS2-042', // Milk Cookie
      'ST4-014', // Skating Queen Cookie
      'ST4-006', // Peppermint Cookie
    ],
    breakPressureThresholds: BREAK_PRESSURE_THRESHOLDS,
  },
  purple: {
    color: 'purple',
    replacementScores: PURPLE_REPLACEMENT_SCORES,
    attackThreatValues: PURPLE_OPPONENT_THREAT_VALUES,
    lowValueCookies: [
      'BS2-056', // Raspberry Mousse Cookie
      'ST5-003', // Fig Cookie
      'ST5-008', // Fairy Cookie
    ],
    breakPressureThresholds: BREAK_PRESSURE_THRESHOLDS,
  },
}

// ============================================================================
// 輔助函式
// ============================================================================

/**
 * 根據玩家手牌／破損區／棄牌區的能量顏色分布推斷牌組顏色。
 *
 * 舊版靠 card.id 前綴／卡名子字串猜色（只認得 ST2-5、BS2 特定號碼區間），
 * 完全沒處理 BS1／BS3 前綴；純 BS3 或純 BS1 牌組會導致每種顏色都算 0，
 * 迴圈 tie-break 又預設落回 'red'，等於整套配置表選錯——不是覆蓋率不足，
 * 是會誤判。card.energyColor 是引擎本來就有、每張卡都會填、且不受彈數
 * 影響的欄位，改用它以後任何現在或未來的牌組都能正確分類。
 */
const detectDeckColor = (state: GameState, playerId: PlayerId): 'red' | 'yellow' | 'green' | 'blue' | 'purple' => {
  const player = state.players[playerId]
  const cards = [
    ...player.hand,
    ...player.breakArea,
    ...player.discardPile.map((c) => ('card' in c ? (c as { card: GameCard }).card : c)),
  ]

  const colorCounts: Record<string, number> = { red: 0, yellow: 0, green: 0, blue: 0, purple: 0 }

  for (const card of cards) {
    const color = card.energyColor
    if (color === 'red' || color === 'yellow' || color === 'green' || color === 'blue' || color === 'purple') {
      colorCounts[color]++
    }
  }

  let maxColor: 'red' | 'yellow' | 'green' | 'blue' | 'purple' = 'red'
  let maxCount = 0
  for (const [color, count] of Object.entries(colorCounts)) {
    if (count > maxCount) {
      maxCount = count
      maxColor = color as typeof maxColor
    }
  }
  return maxColor
}

/**
 * 根據玩家 ID 獲取對應的對局配置
 */
export const getMatchupProfile = (
  state: GameState,
  playerId: PlayerId,
): MatchupProfile => {
  const color = detectDeckColor(state, playerId)
  return MATCHUP_PROFILES[color]
}

/**
 * R6a: 替補基礎品質篩選公式
 *
 * 使用 (Level × 3) + (HP × 2) 計算基礎分數。
 * - Lv.1 HP-1: 3 + 2 = 5
 * - Lv.2 HP-2: 6 + 4 = 10
 * - Lv.2 HP-3: 6 + 6 = 12
 * - Lv.3 HP-3: 9 + 6 = 15
 *
 * 此公式取代舊有的硬編碼查表，確保高等級、高 HP 餅乾
 * 始終獲得更高分數，避免 AI 部署最低 HP 餅乾的問題。
 */
export const calculateReplacementBaseScore = (card: GameCard): number => {
  if (card.type !== 'cookie') return 0
  return card.level * 3 + card.hp * 2
}

/**
 * 計算替補評分（R6a: 基礎品質篩選）
 *
 * 分數組成：
 * 1. 基礎分：(Level × 3) + (HP × 2)
 * 2. Break pressure 調整：危急/危險時額外重視 HP
 * 3. 低價值餅乾懲罰：避免部署已知低價值餅乾
 */
export const scoreReplacement = (
  card: GameCard,
  profile: MatchupProfile,
  breakPressure: BreakPressureLevel,
): number => {
  // R6a: 使用公式計算基礎分數
  const baseScore = calculateReplacementBaseScore(card)

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
  const isLowValue = profile.lowValueCookies.includes(card.id)
  const lowValuePenalty = isLowValue ? -40 : 0

  return baseScore + adjustment + lowValuePenalty
}

/**
 * 計算我方所有非休息餅乾的總攻擊力（使用 card.attack 原始值）
 */
const totalMyDamage = (
  battleArea: CookieInBattle[],
  excludeInstanceId?: string,
): number =>
  battleArea
    .filter((c) => !c.rested && c.card.instanceId !== excludeInstanceId)
    .reduce((sum, c) => sum + (c.card.attack ?? 0), 0)

/**
 * 計算我方破壞區等級總和
 */
const myBreakLevel = (breakArea: CookieCard[]): number =>
  breakArea.reduce((sum, c) => sum + c.level, 0)

/**
 * 計算對手破壞區等級總和
 */
const oppBreakLevel = (breakArea: CookieCard[]): number =>
  breakArea.reduce((sum, c) => sum + c.level, 0)

/**
 * 計算攻擊目標評分（越高越應該攻擊）
 *
 * R1 Break Level 意識 + R2 集中火力：
 * 1. 多攻擊者 lethal 偵測（所有非休息餅乾總傷害）
 * 2. Break level race 意識（對手破壞區越高，越重視能擊倒的目標）
 * 3. 擊倒高 Level 目標在 break 高壓時更有價值
 * 4. 受傷目標加成（已受傷的目標優先擊倒，不分散傷害）
 * 5. 低 HP 目標大幅加成（接近擊倒的目標最高優先）
 */
export const scoreAttackTarget = (
  cookie: CookieInBattle,
  profile: MatchupProfile,
  state: GameState,
  attackerPlayerId: PlayerId,
): number => {
  const threatEntry = profile.attackThreatValues[cookie.card.id]
  const threatValue = threatEntry?.threatValue ?? estimateAttackThreatValue(cookie.card)

  const attackerCookies = state.players[attackerPlayerId].battleArea
  const opponentId =
    attackerPlayerId === 'player-one' ? 'player-two' : 'player-one'
  const opponentBreakArea = state.players[opponentId].breakArea
  const myBreakArea = state.players[attackerPlayerId].breakArea

  // --- 多攻擊者 lethal 偵測 ---
  const totalDamage = totalMyDamage(attackerCookies)
  const remainingHp = cookie.hpCards.length
  const canKillInOneTurn = remainingHp <= totalDamage
  const lethalBonus = canKillInOneTurn ? 150 : 0

  // --- 單次擊殺加成（任何單一餅乾能一擊必殺） ---
  const maxSingleDamage = attackerCookies.reduce(
    (max, c) => Math.max(max, c.card.attack ?? 0),
    0,
  )
  const canOneShot = remainingHp <= maxSingleDamage
  const oneShotBonus = canOneShot ? 80 : 0

  // --- R1: Break level race 意識 ---
  const opponentBreak = oppBreakLevel(opponentBreakArea)
  const myBreak = myBreakLevel(myBreakArea)
  let raceBonus = 0

  if (canKillInOneTurn) {
    // R1: 擊倒能直接致勝（break ≥10）— 最高優先
    const projectedBreak = opponentBreak + cookie.card.level
    if (projectedBreak >= 10) {
      raceBonus += 300
    } else if (projectedBreak >= 8) {
      raceBonus += 80
    } else if (opponentBreak >= 6) {
      raceBonus += 30
    }
  } else {
    // R1: 非擊倒攻擊也要有 break awareness（對手破壞區越高，越值得削 HP）
    if (opponentBreak >= 10) {
      raceBonus += 20
    } else if (opponentBreak >= 8) {
      raceBonus += 10
    }
  }

  // R1: 我方接近10時的壓力減益
  if (myBreak >= 10) {
    raceBonus -= 60
  } else if (myBreak >= 8) {
    raceBonus -= 20
  }

  // --- R1: 高 Level 目標在 break 高壓時更有價值 ---
  // 擊倒 Lv.3 目標對 break area 的貢獻比 Lv.1 大3倍
  const levelBreakValue = cookie.card.level * 15
  const breakPressureBonus = opponentBreak >= 8
    ? levelBreakValue
    : opponentBreak >= 6
      ? Math.floor(levelBreakValue * 0.5)
      : 0

  // --- R2: 受傷目標加成 ---
  const maxHp = cookie.card.hp
  const missingHp = maxHp - remainingHp
  const damagedTargetBonus = missingHp > 0 ? missingHp * 25 : 0

  // --- R2: 低 HP 目標大幅加成 ---
  const finishBonus =
    remainingHp === 1 ? 100 :
      remainingHp === 2 ? 60 :
        remainingHp === 3 ? 30 : 0

  return (
    threatValue +
    lethalBonus +
    oneShotBonus +
    raceBonus +
    breakPressureBonus +
    damagedTargetBonus +
    finishBonus
  )
}

/**
 * 評估手牌品質（決定是否部署）
 */
export const evaluateHandQuality = (
  hand: GameCard[],
  profile: MatchupProfile,
): number => {
  if (hand.length === 0) return 0

  // 這裡的分數會拿去跟 turn-handler.ts 的絕對門檻（>= 30）比較，不是相對
  // 排序——不能像 chooseBestCookieToDeploy 那樣改用 R6a 公式當 fallback。
  // R6a 公式（level*3+hp*2）是為了「候選互相比大小」校準的，換算下來
  // Lv.1～2 的一般起始卡多半落在 5～12 分，全部低於 30；查無資料就整批
  // 卡當成沒有部署價值，AI 會直接拒絕鋪牌。維持舊行為的中性預設 50，讓
  // 「查無資料」跟「這張卡普通」同義，而不是「這張卡很差」。
  let totalScore = 0
  for (const card of hand) {
    if (card.type === 'cookie') {
      const scoreEntry = profile.replacementScores[card.id]
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
    const leftScore =
      profile.replacementScores[left.id]?.baseScore ?? calculateReplacementBaseScore(left)
    const rightScore =
      profile.replacementScores[right.id]?.baseScore ?? calculateReplacementBaseScore(right)
    return rightScore - leftScore
  })[0]
}

/**
 * R6b: 替補進階效果評分 — 效果價值表
 *
 * 依卡牌公開效果給分，分為進攻型、防守型、輔助型三類。key 為 card.id。
 */
const EFFECT_VALUE_BONUS: Record<string, number> = {
  // 進攻型：可主動造成傷害
  'BS2-003': 8, // Rebel Cookie
  'BS1-003': 8, // Dark Choco Cookie
  'BS1-055': 7, // Red Bean Cookie
  'BS2-029': 7, // Sea Fairy Cookie
  'BS2-058': 7, // Wind Archer Cookie
  'BS2-031': 6, // Black Raisin Cookie
  'BS2-055': 6, // Poison Mushroom Cookie
  'BS1-030': 5, // Rockstar Cookie
  'BS2-004': 4, // Cherry Cookie
  'BS1-006': 4, // Mala Sauce Cookie
  'BS2-044': 4, // Tiramisu Cookie
  'BS2-075': 4, // White Choco Cookie
  'BS2-010': 6, // Vampire Cookie（實際是可選代價對 LV1 目標追加傷害，不是回復——原本誤放在防守型）
  // 防守型：可回血或保護
  'BS1-032': 6, // Banana Cookie
  'BS2-068': 5, // Cream Unicorn Cookie
  'BS1-031': 4, // Marshmallow Cookie
  'BS2-061': 4, // Hydrangea Cookie
  // 輔助型：可抽牌、提供資源
  'BS2-036': 5, // Sherbet Cookie
  'ST4-007': 4, // Sour Belt Cookie
  'BS2-069': 4, // Clotted Cream Cookie
  'ST2-008': 3, // Eclair Cookie
  'BS1-040': 3, // Earl Grey Cookie
  // 低效果價值
  'BS1-018': 0, // Popcorn Cookie
  'ST1-013': 0, // Adventurer Cookie
  'ST1-004': 0, // Carrot Cookie
  'BS1-007': 0, // Melon Bun Cookie
  'ST2-007': 0, // Chestnut Cookie
  'ST2-005': 0, // Mustard Cookie
  'BS1-033': 0, // Cyborg Cookie
  'ST3-014': 0, // Angel Cookie
  'ST3-008': 0, // Spinach Cookie
  'BS1-057': 0, // Bellflower Cookie
  'BS1-069': 0, // Cookiemals
  'BS2-018': 0, // Candlelight Cookie
  'BS2-035': 0, // Salt Cookie
  'BS2-042': 0, // Milk Cookie
  'ST4-014': 0, // Skating Queen Cookie
  'ST4-006': 0, // Peppermint Cookie
  'BS2-056': 0, // Raspberry Mousse Cookie
  'ST5-003': 0, // Fig Cookie
  'ST5-008': 0, // Fairy Cookie
}

/** R6b「防守型」判定用——與 EFFECT_VALUE_BONUS 裡對應的 4 個 id 一致。 */
const DEFENSIVE_COOKIE_IDS = new Set([
  'BS1-032', // Banana Cookie
  'BS2-068', // Cream Unicorn Cookie
  'BS1-031', // Marshmallow Cookie
  'BS2-061', // Hydrangea Cookie
])

/**
 * 「這張卡效果強不強」的統一入口：手刻表格查得到就用調校過的數字，查不到
 * 才用 estimateSkillEffectValue 從技能結構推算。battle-handler.ts 的 R7
 * 陷阱評分（判斷保護目標值不值得）也共用這個，避免同一個判斷各自維護一份
 * ——那邊原本是另一份寫死的卡名清單，一樣只涵蓋 BS1／BS2，也一樣用卡名
 * 子字串比對而不是卡號，見該檔案的說明。
 */
export const getCardEffectValue = (card: GameCard): number =>
  card.id in EFFECT_VALUE_BONUS ? EFFECT_VALUE_BONUS[card.id] : estimateSkillEffectValue(card)

/**
 * R6b: 計算替補進階分數
 *
 * 分數組成：
 * 1. baseScore（R6a）：(Level × 3) + (HP × 2) + break pressure 調整 + 低價值懲罰
 * 2. effectValueBonus：依卡牌效果給分（0–8）
 * 3. boardNeedBonus：依場面需求給分（-5–+10）
 * 4. survivalBonus：依生存能力給分（-5–+5）
 */
export const scoreReplacementAdvanced = (
  card: GameCard,
  profile: MatchupProfile,
  breakPressure: BreakPressureLevel,
  options: {
    myBreakLevel: number
    oppBreakLevel: number
    myBattleAreaCount: number
    myTotalBattleHp: number
    oppTotalBattleHp: number
  },
): number => {
  if (card.type !== 'cookie') return 0

  // R6a base
  const baseScore = scoreReplacement(card, profile, breakPressure)

  // R6b: effectValueBonus——查無資料（未收錄的新彈卡）改用
  // estimateSkillEffectValue 從 card.skill.effects 直接推算，不再假裝一律
  // 中等（2）。
  const isKnownCard = card.id in EFFECT_VALUE_BONUS
  const effectBonus = getCardEffectValue(card)

  // R6b: boardNeedBonus
  let boardNeedBonus = 0
  const myBreak = options.myBreakLevel
  const oppBreak = options.oppBreakLevel

  // 我方破壞區偏高 → 防守或回血單位加分
  if (myBreak >= 8) {
    const isDefensive =
      DEFENSIVE_COOKIE_IDS.has(card.id) ||
      (!isKnownCard && hasDerivedDefensiveSkill(card))
    if (isDefensive) boardNeedBonus += 6
  }

  // 對手破壞區偏高 → 進攻單位加分
  if (oppBreak >= 8) {
    const isOffensive = (card.attack ?? 0) >= 2 || effectBonus >= 5
    if (isOffensive) boardNeedBonus += 5
  }

  // 我方戰鬥區缺 HP → 高 HP 替補加分
  if (options.myBattleAreaCount <= 1 && card.hp >= 3) {
    boardNeedBonus += 5
  }

  // 場面缺攻擊點 → 高攻擊或主動傷害技能加分
  if (options.myTotalBattleHp < options.oppTotalBattleHp && (card.attack ?? 0) >= 2) {
    boardNeedBonus += 3
  }

  // R6b: survivalBonus
  let survivalBonus = 0
  if (card.hp <= 1) {
    survivalBonus = -5
  } else if (card.hp >= 3) {
    survivalBonus = 3
  } else if (card.hp === 2) {
    survivalBonus = 1
  }

  return baseScore + effectBonus + boardNeedBonus + survivalBonus
}

/**
 * 計算破壞區等級總和
 */
export const sumBreakLevel = (breakArea: CookieCard[]): number =>
  breakArea.reduce((sum, card) => sum + card.level, 0)
