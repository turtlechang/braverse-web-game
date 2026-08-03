import type { CardEffect, CardSkill, GameCard } from '../types'
import { getEnergyCostTotal } from '../energy'

/**
 * R6b 的 EFFECT_VALUE_BONUS／DEFENSIVE_COOKIE_IDS／attackThreatValues 都是手刻
 * 的「卡號 → 分數」查表，只涵蓋 58 張 BS1／BS2／ST 系列卡——BS3（或任何未來
 * 新彈）的卡片一律查無資料，只能退回一個跟卡片實際效果毫無關係的中性預設值。
 *
 * 這裡延續 R6a 把「replacement baseScore」從查表換成
 * `level*3 + hp*2` 公式的做法：與其手動幫每張新卡補一筆評分，不如直接讀
 * `card.skill.effects`（引擎執行卡片效果時本來就在用的同一份結構化資料），
 * 自動推導出一個粗略但方向正確的效果分數。手刻表格對「已知」卡片仍然優先
 * ——這裡只當作查無資料時的 fallback，不取代既有調校過的數字。
 */

/** 各效果 kind 的粗略價值分類；未列出的視為低價值雜項效果。 */
const OFFENSIVE_EFFECT_KINDS = new Set<CardEffect['kind']>([
  'damage',
  'split-damage',
  'damage-all',
  'damage-by-break-count',
  'opponent-battle-to-trash',
  'opponent-discard-hand',
  'opponent-random-discard',
  'opponent-trash-to-break',
  'field-to-trash-all',
  'disable-attack',
  'disable-flip',
  'disable-block',
  'modify-attack-by-break-count',
  'multiply-attack-damage',
])

const DEFENSIVE_EFFECT_KINDS = new Set<CardEffect['kind']>([
  'gain-hp',
  'prevent-knockout',
  'prevent-effect-damage',
  'redirect-attack',
  'modify-damage-received',
  'transfer-hp',
  'support-to-hp',
])

const SUPPORT_EFFECT_KINDS = new Set<CardEffect['kind']>([
  'draw',
  'draw-up-to',
  'draw-up-to-then-discard',
  'draw-up-to-opponent-fainted-this-turn',
  'draw-up-to-battle-cookie-count',
  'hand-to-deck-and-draw',
  'inspect-deck',
  'reveal-top-deck',
  'reveal-bottom-deck',
  'deck-to-support',
  'place-source-to-support',
  'support-to-hand',
  'hand-to-support',
  'trash-to-hand',
  'trash-to-support',
  'trash-to-battle',
  'trash-to-break',
  'trash-to-deck',
  'trash-to-deck-all',
  'return-to-hand',
  'return-to-deck-bottom',
  'hp-to-hand',
  'hand-to-hp',
  'break-to-hand',
  'break-to-hand-by-level-sum',
  'break-source-to-battle',
  'break-to-battle',
  'support-to-battle',
  'set-active',
  'set-cookie-active',
  'rest-support',
  'equip-source',
  'battle-to-support',
  'battle-to-deck-top',
  'flip-to-support',
  'hand-to-battle',
])

/** 效果帶數值欄位時，用來抓大小（傷害量、抽牌數……），沒有就當作 1 份。 */
const readMagnitude = (effect: CardEffect): number => {
  const withAmount = effect as { amount?: number; max?: number; count?: number }
  const raw = withAmount.amount ?? withAmount.max ?? withAmount.count ?? 1
  return Math.min(Math.abs(raw), 4)
}

/**
 * choose-one 展開成「分數最高的那個模式」的效果——玩家會挑對自己最有利的
 *選項，用最佳情境近似其價值比只看第一個模式或全部模式加總更準。
 */
const expandEffects = (effects: readonly CardEffect[]): CardEffect[] => {
  const expanded: CardEffect[] = []
  for (const effect of effects) {
    if (effect.kind === 'choose-one') {
      let bestMode: CardEffect[] = []
      let bestScore = -Infinity
      for (const mode of effect.modes) {
        const modeEffects = expandEffects(mode.effects)
        const score = modeEffects.reduce(
          (sum, e) => sum + scoreSingleEffect(e),
          0,
        )
        if (score > bestScore) {
          bestScore = score
          bestMode = modeEffects
        }
      }
      expanded.push(...bestMode)
    } else {
      expanded.push(effect)
    }
  }
  return expanded
}

const scoreSingleEffect = (effect: CardEffect): number => {
  const magnitude = readMagnitude(effect)
  if (OFFENSIVE_EFFECT_KINDS.has(effect.kind)) return 2 + magnitude
  if (DEFENSIVE_EFFECT_KINDS.has(effect.kind)) return 2 + magnitude
  if (SUPPORT_EFFECT_KINDS.has(effect.kind)) return 1 + magnitude * 0.5
  return 0.5
}

/**
 * R6b effectBonus 的通用 fallback：讀 card.skill.effects 粗略估出 0–8 分，
 * 跟手刻表格用的量尺一致。無技能／非餅乾一律 0，不用中性預設值假裝「還
 * 算有點用」——R6a 的 level/HP 公式已經在別處給了合理的基礎分。
 */
export const estimateSkillEffectValue = (card: GameCard): number => {
  const skill = card.skill
  if (!skill) return 0

  const effects = expandEffects(skill.effects)
  if (effects.length === 0) return 0

  const rawScore = effects.reduce((sum, effect) => sum + scoreSingleEffect(effect), 0)

  return Math.round(clampScore(applyCostDampening(rawScore, skill)))
}

/**
 * 有代價的 activate 技能要付出資源才能用，同樣的效果強度不該跟被動／登場
 * 觸發（幾乎沒有代價）拿一樣的分數；oncePerTurn 也代表用一次就沒了。
 */
const applyCostDampening = (rawScore: number, skill: CardSkill): number => {
  if (skill.trigger === 'passive' || skill.trigger === 'on-play') {
    return rawScore
  }
  const energyCost = getEnergyCostTotal(skill.cost.energy ?? skill.cost)
  const otherCost =
    (skill.cost.discardHand ?? 0) +
    (skill.cost.supportToTrash ?? 0) +
    (skill.cost.hpToTrash?.amount ?? 0)
  const totalCost = energyCost + otherCost
  const costFactor = clamp(1 - totalCost * 0.08, 0.5, 1)
  const repeatFactor = skill.oncePerTurn ? 0.9 : 1
  return rawScore * costFactor * repeatFactor
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

const clampScore = (value: number): number => clamp(value, 0, 8)

/**
 * DEFENSIVE_COOKIE_IDS 的通用 fallback：技能裡有沒有回血／擋刀／減傷這類
 * 明確防守效果（含 Blocker 觸發本身）。
 */
export const hasDerivedDefensiveSkill = (card: GameCard): boolean => {
  const skill = card.skill
  if (!skill) return false
  if (skill.trigger === 'block') return true
  return expandEffects(skill.effects).some((effect) =>
    DEFENSIVE_EFFECT_KINDS.has(effect.kind),
  )
}

/**
 * attackThreatValues 的通用 fallback：留在場上的威脅程度，用原始數值
 * （攻擊力、等級）打底，技能裡有主動傷害/移除效果再加成。跟手刻表格一樣
 * 落在 10–95 區間，好跟既有數字混在一起排序不會格格不入。
 */
export const estimateAttackThreatValue = (card: GameCard): number => {
  if (card.type !== 'cookie') return 30
  const base = 20 + (card.attack ?? 0) * 9 + card.level * 8
  const skill = card.skill
  const hasOffensiveSkill =
    Boolean(skill) &&
    expandEffects(skill!.effects).some((effect) =>
      OFFENSIVE_EFFECT_KINDS.has(effect.kind),
    )
  return Math.round(clamp(base + (hasOffensiveSkill ? 15 : 0), 10, 95))
}
