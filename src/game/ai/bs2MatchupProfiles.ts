import type { CookieCard, CookieInBattle, GameCard, GameState, PlayerId } from '../types'

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

// 藍色餅乾替補評分（對手：紅色/黃色/綠色/紫色）
const BLUE_REPLACEMENT_SCORES: Record<string, ReplacementScore> = {
  'Sea Fairy Cookie': { baseScore: 95, reason: 'HP 高，攻擊力強，後期核心' },
  'Black Raisin Cookie': { baseScore: 90, reason: 'HP 高，AOE 傷害' },
  'Sherbet Cookie': { baseScore: 85, reason: 'HP 高，回手效果' },
  'Tiramisu Cookie': { baseScore: 80, reason: '有效果，對 Lv1 餅乾額外傷害' },
  'Salt Cookie': { baseScore: 75, reason: 'HP 高，穩定' },
  'Chocolate Bonbon Cookie': { baseScore: 70, reason: '高等級但 Flip 需手牌' },
  'Sour Belt Cookie': { baseScore: 65, reason: '抽牌效果但 HP 較低' },
  'Aloe Cookie': { baseScore: 60, reason: '滅亡效果但 HP 低' },
  'Milk Cookie': { baseScore: 10, reason: 'HP 1 太容易被換掉' },
  'Skating Queen Cookie': { baseScore: 10, reason: 'HP 1 太容易被換掉' },
  'Peppermint Cookie': { baseScore: 10, reason: 'HP 1 太容易被換掉' },
}

// 紫色餅乾替補評分（對手：紅色/黃色/綠色/藍色）
const PURPLE_REPLACEMENT_SCORES: Record<string, ReplacementScore> = {
  'Wind Archer Cookie': { baseScore: 95, reason: 'HP 高，攻擊力強，後期核心' },
  'Poison Mushroom Cookie': { baseScore: 90, reason: 'HP 高，登場清場' },
  'Cream Unicorn Cookie': { baseScore: 85, reason: 'HP 高，破壞區回收' },
  'Clotted Cream Cookie': { baseScore: 80, reason: '有效果，送對手 Lv1 進破壞區' },
  'White Choco Cookie': { baseScore: 75, reason: '有效果，對 Lv1 餅乾額外傷害' },
  'Hydrangea Cookie': { baseScore: 70, reason: '破壞區回收效果' },
  'Yoga Cookie': { baseScore: 65, reason: '有效果但 HP 較低' },
  'Starfruit Cookie': { baseScore: 60, reason: '犧牲效果需謹慎使用' },
  'Raspberry Mousse Cookie': { baseScore: 10, reason: 'HP 1 太容易被換掉' },
  'Fig Cookie': { baseScore: 10, reason: 'HP 1 太容易被換掉' },
  'Fairy Cookie': { baseScore: 10, reason: 'HP 1 太容易被換掉' },
  'Pastry Cookie': { baseScore: 55, reason: 'Flip 需手牌，HP 較低' },
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

// 藍色對手（紅色/黃色/綠色/紫色）的威脅值
const BLUE_OPPONENT_THREAT_VALUES: Record<string, AttackThreatScore> = {
  'Rebel Cookie': { threatValue: 95, reason: 'HP 高，攻擊力強' },
  'Dark Choco Cookie': { threatValue: 95, reason: 'HP 高，攻擊力強' },
  'Wind Archer Cookie': { threatValue: 90, reason: 'HP 高，直接移除 Lv3' },
  'Poison Mushroom Cookie': { threatValue: 85, reason: 'HP 高，登場清場' },
  'Banana Cookie': { threatValue: 85, reason: 'HP 高' },
  'Vampire Cookie': { threatValue: 85, reason: 'HP 高，有回復' },
  'Princess Cookie': { threatValue: 80, reason: 'HP 高，穩定' },
  'Cream Unicorn Cookie': { threatValue: 80, reason: 'HP 高，破壞區回收' },
  'Red Bean Cookie': { threatValue: 75, reason: 'HP 高，攻擊力強' },
  'Clotted Cream Cookie': { threatValue: 75, reason: '有效果' },
  'Onion Cookie': { threatValue: 70, reason: '穩定' },
  'Eclair Cookie': { threatValue: 70, reason: 'Lv3 但要小心' },
  'Timekeeper Cookie': { threatValue: 70, reason: 'Lv3 但要小心' },
  'Rockstar Cookie': { threatValue: 65, reason: '攻擊力高' },
  'White Choco Cookie': { threatValue: 65, reason: '有效果' },
  'Mala Sauce Cookie': { threatValue: 60, reason: '有效果' },
  'Cherry Cookie': { threatValue: 55, reason: '有效果' },
  'Popcorn Cookie': { threatValue: 10, reason: '價值低' },
  'Carrot Cookie': { threatValue: 10, reason: '價值低' },
  'Adventurer Cookie': { threatValue: 10, reason: '價值低' },
  'Chestnut Cookie': { threatValue: 10, reason: '價值低' },
  'Mustard Cookie': { threatValue: 10, reason: '價值低' },
  'Cyborg Cookie': { threatValue: 10, reason: '價值低' },
  'Angel Cookie': { threatValue: 10, reason: '價值低' },
  'Spinach Cookie': { threatValue: 10, reason: '價值低' },
}

// 紫色對手（紅色/黃色/綠色/藍色）的威脅值
const PURPLE_OPPONENT_THREAT_VALUES: Record<string, AttackThreatScore> = {
  'Rebel Cookie': { threatValue: 95, reason: 'HP 高，攻擊力強' },
  'Dark Choco Cookie': { threatValue: 95, reason: 'HP 高，攻擊力強' },
  'Sea Fairy Cookie': { threatValue: 90, reason: 'HP 高，回手效果' },
  'Black Raisin Cookie': { threatValue: 85, reason: 'HP 高，AOE 傷害' },
  'Banana Cookie': { threatValue: 85, reason: 'HP 高' },
  'Vampire Cookie': { threatValue: 85, reason: 'HP 高，有回復' },
  'Princess Cookie': { threatValue: 80, reason: 'HP 高，穩定' },
  'Red Bean Cookie': { threatValue: 80, reason: 'HP 高，攻擊力強' },
  'Sherbet Cookie': { threatValue: 75, reason: 'HP 高，回手效果' },
  'Onion Cookie': { threatValue: 75, reason: '穩定' },
  'Tiramisu Cookie': { threatValue: 70, reason: '有效果' },
  'Eclair Cookie': { threatValue: 70, reason: 'Lv3 但要小心' },
  'Timekeeper Cookie': { threatValue: 70, reason: 'Lv3 但要小心' },
  'Rockstar Cookie': { threatValue: 65, reason: '攻擊力高' },
  'Mala Sauce Cookie': { threatValue: 60, reason: '有效果' },
  'Cherry Cookie': { threatValue: 55, reason: '有效果' },
  'Popcorn Cookie': { threatValue: 10, reason: '價值低' },
  'Carrot Cookie': { threatValue: 10, reason: '價值低' },
  'Adventurer Cookie': { threatValue: 10, reason: '價值低' },
  'Chestnut Cookie': { threatValue: 10, reason: '價值低' },
  'Mustard Cookie': { threatValue: 10, reason: '價值低' },
  'Cyborg Cookie': { threatValue: 10, reason: '價值低' },
  'Milk Cookie': { threatValue: 10, reason: '價值低' },
  'Skating Queen Cookie': { threatValue: 10, reason: '價值低' },
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
  color: 'red' | 'yellow' | 'green' | 'blue' | 'purple'
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
  blue: {
    color: 'blue',
    replacementScores: BLUE_REPLACEMENT_SCORES,
    attackThreatValues: BLUE_OPPONENT_THREAT_VALUES,
    lowValueCookies: [
      'Milk Cookie',
      'Skating Queen Cookie',
      'Peppermint Cookie',
    ],
    breakPressureThresholds: BREAK_PRESSURE_THRESHOLDS,
  },
  purple: {
    color: 'purple',
    replacementScores: PURPLE_REPLACEMENT_SCORES,
    attackThreatValues: PURPLE_OPPONENT_THREAT_VALUES,
    lowValueCookies: [
      'Raspberry Mousse Cookie',
      'Fig Cookie',
      'Fairy Cookie',
    ],
    breakPressureThresholds: BREAK_PRESSURE_THRESHOLDS,
  },
}

// ============================================================================
// 輔助函式
// ============================================================================

/**
 * 根據玩家手牌與戰鬥區餅乾推斷牌組顏色
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
    const id = card.id
    if (id.startsWith('ST4-') || id.startsWith('BS2-0') && parseInt(id.slice(5, 7)) >= 20 && parseInt(id.slice(5, 7)) < 50) {
      colorCounts.blue++
    } else if (id.startsWith('ST5-') || (id.startsWith('BS2-0') && parseInt(id.slice(5, 7)) >= 50 && parseInt(id.slice(5, 7)) < 80)) {
      colorCounts.purple++
    } else if (id.startsWith('ST3-') || id.includes('Bean') || id.includes('Spinach') || id.includes('Angel') || id.includes('Avocado')) {
      colorCounts.green++
    } else if (id.startsWith('ST2-') || id.includes('Rebel') || id.includes('Dark Choco') || id.includes('Princess') || id.includes('Muscle')) {
      colorCounts.red++
    } else if (id.includes('Banana') || id.includes('Vampire') || id.includes('Marshmallow') || id.includes('Eclair')) {
      colorCounts.yellow++
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
  const isLowValue = profile.lowValueCookies.includes(card.name)
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
  const cookieName = cookie.card.name
  const threatEntry = profile.attackThreatValues[cookieName]
  const threatValue = threatEntry?.threatValue ?? 50

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
 * R6b: 替補進階效果評分 — 效果價值表
 *
 * 依卡牌公開效果給分，分為進攻型、防守型、輔助型三類。
 */
const EFFECT_VALUE_BONUS: Record<string, number> = {
  // 進攻型：可主動造成傷害
  'Rebel Cookie': 8,
  'Dark Choco Cookie': 8,
  'Red Bean Cookie': 7,
  'Sea Fairy Cookie': 7,
  'Wind Archer Cookie': 7,
  'Black Raisin Cookie': 6,
  'Poison Mushroom Cookie': 6,
  'Rockstar Cookie': 5,
  'Cherry Cookie': 4,
  'Mala Sauce Cookie': 4,
  'Tiramisu Cookie': 4,
  'White Choco Cookie': 4,
  // 防守型：可回血或保護
  'Banana Cookie': 6,
  'Vampire Cookie': 6,
  'Cream Unicorn Cookie': 5,
  'Marshmallow Cookie': 4,
  'Hydrangea Cookie': 4,
  // 輔助型：可抽牌、提供資源
  'Sherbet Cookie': 5,
  'Sour Belt Cookie': 4,
  'Clotted Cream Cookie': 4,
  'Eclair Cookie': 3,
  'Earl Grey Cookie': 3,
  // 低效果價值
  'Popcorn Cookie': 0,
  'Adventurer Cookie': 0,
  'Carrot Cookie': 0,
  'Melon Bun Cookie': 0,
  'Chestnut Cookie': 0,
  'Mustard Cookie': 0,
  'Cyborg Cookie': 0,
  'Angel Cookie': 0,
  'Spinach Cookie': 0,
  'Bellflower Cookie': 0,
  'Cookiemals': 0,
  'Candlelight Cookie': 0,
  'Salt Cookie': 0,
  'Milk Cookie': 0,
  'Skating Queen Cookie': 0,
  'Peppermint Cookie': 0,
  'Raspberry Mousse Cookie': 0,
  'Fig Cookie': 0,
  'Fairy Cookie': 0,
}

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

  // R6b: effectValueBonus
  const effectBonus = EFFECT_VALUE_BONUS[card.name] ?? 2

  // R6b: boardNeedBonus
  let boardNeedBonus = 0
  const myBreak = options.myBreakLevel
  const oppBreak = options.oppBreakLevel

  // 我方破壞區偏高 → 防守或回血單位加分
  if (myBreak >= 8) {
    const isDefensive = EFFECT_VALUE_BONUS[card.name] !== undefined &&
      (card.name.includes('Banana') || card.name.includes('Vampire') ||
        card.name.includes('Cream Unicorn') || card.name.includes('Marshmallow') ||
        card.name.includes('Hydrangea'))
    if (isDefensive) boardNeedBonus += 6
  }

  // 對手破壞區偏高 → 進攻單位加分
  if (oppBreak >= 8) {
    const isOffensive = (card.attack ?? 0) >= 2 || EFFECT_VALUE_BONUS[card.name] >= 5
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
