import officialRedSample from '../../data/cards/official-sample.en.json'
import officialGreenSample from '../../data/cards/official-starter-deck-green.en.json'
import officialYellowSample from '../../data/cards/official-starter-deck-yellow.en.json'
import officialBlueSample from '../../data/cards/official-starter-deck-blue.en.json'
import officialPurpleSample from '../../data/cards/official-starter-deck-purple.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialAttackEffects,
  convertOfficialCookieSkill,
  convertOfficialFlipAbility,
  convertOfficialItemAbility,
  convertOfficialStageAbility,
  convertOfficialTrapAbility,
} from '../cards/official-effect-adapter'
import { getRuntimeKeywords } from '../cards/official-card-adapter'
import { parseOfficialCardText } from '../cards/official-text-parser'
import type { OfficialCardRecord } from '../cards/types'
import type { CardEffect, GameCard, PlayerId } from './types'
import { getCardPoolEntry } from './card-pool'

export type StarterDeckChoice = 'red' | 'yellow' | 'green' | 'blue' | 'purple'

export const BS3_AI_PRESET_DECK_CHOICES = [
  'bs3-green-lily',
  'bs3-blue-sorbet',
  'bs3-red-pitaya',
  'bs3-purple-dark-cacao',
  'bs3-purple-dark-cacao-fighting',
  'bs3-yellow-counter',
] as const

export type Bs3AiPresetDeckChoice =
  (typeof BS3_AI_PRESET_DECK_CHOICES)[number]

export type AiPresetDeckChoice =
  | 'bs2-red'
  | 'bs2-yellow'
  | 'bs2-bean'
  | 'bs2-blue'
  | 'bs2-purple'
  | Bs3AiPresetDeckChoice
export type BuiltInDeckChoice = StarterDeckChoice | AiPresetDeckChoice
export type DeckChoice = BuiltInDeckChoice | 'custom'

export interface StarterDeckEntry {
  cardNumber: string
  name?: string
  count: number
}

export const OFFICIAL_RED_STARTER_DECK: StarterDeckEntry[] = [
  { cardNumber: 'ST1-001', name: 'Princess Cookie', count: 2 },
  { cardNumber: 'ST1-002', name: 'Ninja Cookie', count: 2 },
  { cardNumber: 'ST1-003', name: 'Dino-Sour Cookie', count: 2 },
  { cardNumber: 'ST1-004', name: 'Carrot Cookie', count: 4 },
  { cardNumber: 'ST1-005', name: 'Leek Cookie', count: 4 },
  { cardNumber: 'ST1-006', name: 'GingerBright', count: 4 },
  { cardNumber: 'ST1-007', name: 'Mint Choco Cookie', count: 2 },
  { cardNumber: 'ST1-008', name: 'Cherry Blossom Cookie', count: 2 },
  { cardNumber: 'ST1-009', name: 'Espresso Cookie', count: 2 },
  { cardNumber: 'ST1-010', name: 'Alchemist Cookie', count: 2 },
  { cardNumber: 'ST1-011', name: 'GingerBrave', count: 4 },
  { cardNumber: 'ST1-012', name: 'Zombie Cookie', count: 4 },
  { cardNumber: 'ST1-013', name: 'Adventurer Cookie', count: 4 },
  { cardNumber: 'ST1-014', name: 'Peperoncino Cookie', count: 2 },
  { cardNumber: 'ST1-015', name: 'Pistachio Cookie', count: 4 },
  { cardNumber: 'ST1-016', name: 'Icky Sticky Jelly', count: 2 },
  { cardNumber: 'ST1-017', name: 'Exceptional Cake Knife', count: 2 },
  { cardNumber: 'ST1-018', name: 'Sugar-Coated Snail Shell', count: 2 },
  { cardNumber: 'ST1-019', name: 'Fiery Jelly Clump', count: 2 },
  { cardNumber: 'ST1-020', name: 'Overhydrated Dough Swamp', count: 2 },
  { cardNumber: 'ST1-021', name: 'Ouch-Inducing Star Jelly', count: 2 },
  { cardNumber: 'ST1-022', name: 'Burning Jelly Volcano', count: 2 },
  { cardNumber: 'BS1-009', name: 'Affogato Cookie', count: 2 },
]

export const OFFICIAL_YELLOW_STARTER_DECK: StarterDeckEntry[] = [
  { cardNumber: 'ST2-001', name: 'Roguefort Cookie', count: 2 },
  { cardNumber: 'ST2-002', name: 'Strawberry Cookie', count: 4 },
  { cardNumber: 'ST2-003', name: 'Wizard Cookie', count: 2 },
  { cardNumber: 'ST2-004', name: 'Macaron Cookie', count: 2 },
  { cardNumber: 'ST2-005', name: 'Mustard Cookie', count: 4 },
  { cardNumber: 'ST2-006', name: 'GingerBright', count: 4 },
  { cardNumber: 'ST2-007', name: 'Chestnut Cookie', count: 4 },
  { cardNumber: 'ST2-008', name: 'Eclair Cookie', count: 2 },
  { cardNumber: 'ST2-009', name: 'GingerBrave', count: 4 },
  { cardNumber: 'ST2-010', name: 'Purple Yam Cookie', count: 4 },
  { cardNumber: 'ST2-011', name: 'Cherry Cookie', count: 4 },
  { cardNumber: 'ST2-012', name: 'Cheerleader Cookie', count: 4 },
  { cardNumber: 'ST2-013', name: 'Cheesecake Cookie', count: 4 },
  { cardNumber: 'ST2-014', name: 'Custard Cookie III', count: 4 },
  { cardNumber: 'ST2-015', name: 'Hero Cookie', count: 2 },
  { cardNumber: 'ST2-016', name: 'Flimsy Screwdriver', count: 2 },
  { cardNumber: 'ST2-018', name: 'Time Travel Ticket', count: 2 },
  { cardNumber: 'ST2-019', name: 'Multi-Vitamin Honey Bomb', count: 2 },
  { cardNumber: 'ST2-020', name: 'Winding Key Shield', count: 2 },
  { cardNumber: 'ST2-021', name: 'Pretzel Snare', count: 2 },
]

export const OFFICIAL_GREEN_STARTER_DECK: StarterDeckEntry[] = [
  { cardNumber: 'ST3-001', name: 'Muscle Cookie', count: 4 },
  { cardNumber: 'ST3-002', name: 'Strawberry Crepe Cookie', count: 2 },
  { cardNumber: 'ST3-003', name: 'GingerBright', count: 2 },
  { cardNumber: 'ST3-004', name: 'Vampire Cookie', count: 4 },
  { cardNumber: 'ST3-005', name: 'Blackberry Cookie', count: 4 },
  { cardNumber: 'ST3-006', name: 'Beet Cookie', count: 4 },
  { cardNumber: 'ST3-007', name: 'Sparkling Cookie', count: 2 },
  { cardNumber: 'ST3-008', name: 'Spinach Cookie', count: 2 },
  { cardNumber: 'ST3-009', name: 'Avocado Cookie', count: 2 },
  { cardNumber: 'ST3-010', name: 'Aloe Cookie', count: 2 },
  { cardNumber: 'ST3-011', name: 'Onion Cookie', count: 4 },
  { cardNumber: 'ST3-012', name: 'GingerBrave', count: 4 },
  { cardNumber: 'ST3-013', name: 'Knight Cookie', count: 4 },
  { cardNumber: 'ST3-014', name: 'Angel Cookie', count: 2 },
  { cardNumber: 'ST3-015', name: 'Chili Pepper Cookie', count: 4 },
  { cardNumber: 'ST3-016', name: "Ancient Healer's Gaze", count: 2 },
  { cardNumber: 'ST3-017', name: 'Viney Vines', count: 2 },
  { cardNumber: 'ST3-018', name: 'Parsley Tea of Invigoration', count: 2 },
  { cardNumber: 'ST3-019', name: 'Supreme Whipped Cream', count: 2 },
  { cardNumber: 'ST3-020', name: 'Divine Light Crystal', count: 2 },
  { cardNumber: 'ST3-021', name: 'Breath of the Flute', count: 2 },
  { cardNumber: 'ST3-022', name: "Guardian Tree's Blessing", count: 2 },
]

export const OFFICIAL_BLUE_STARTER_DECK: StarterDeckEntry[] = [
  { cardNumber: 'ST4-001', name: 'Candy Diver Cookie', count: 4 },
  { cardNumber: 'ST4-002', name: 'Snow Sugar Cookie', count: 4 },
  { cardNumber: 'ST4-003', name: 'Dr. Wasabi Cookie', count: 4 },
  { cardNumber: 'ST4-004', name: 'Lobster Cookie', count: 2 },
  { cardNumber: 'ST4-005', name: 'GingerBright', count: 4 },
  { cardNumber: 'ST4-006', name: 'Peppermint Cookie', count: 4 },
  { cardNumber: 'ST4-007', name: 'Sour Belt Cookie', count: 2 },
  { cardNumber: 'ST4-008', name: 'Soda Cookie', count: 2 },
  { cardNumber: 'ST4-009', name: 'Ice Candy Cookie', count: 4 },
  { cardNumber: 'ST4-010', name: 'Squid Ink Cookie', count: 2 },
  { cardNumber: 'ST4-011', name: 'GingerBrave', count: 4 },
  { cardNumber: 'ST4-012', name: 'Werewolf Cookie', count: 2 },
  { cardNumber: 'ST4-013', name: 'Captain Caviar Cookie', count: 2 },
  { cardNumber: 'ST4-014', name: 'Skating Queen Cookie', count: 4 },
  { cardNumber: 'ST4-015', name: 'Pirate Cookie', count: 2 },
  { cardNumber: 'ST4-016', name: 'Bear Jelly Ice Cream', count: 2 },
  { cardNumber: 'ST4-017', name: 'Emergency Lifebuoy', count: 2 },
  { cardNumber: 'ST4-018', name: 'Lucky Pearls', count: 2 },
  { cardNumber: 'ST4-019', name: 'Sugar Crystal Lamp', count: 2 },
  { cardNumber: 'ST4-020', name: 'Octo-Ink Spray', count: 2 },
  { cardNumber: 'ST4-021', name: 'Fallen Ice Statue', count: 2 },
  { cardNumber: 'ST4-022', name: 'Sugar Glass Dome', count: 2 },
]

export const OFFICIAL_PURPLE_STARTER_DECK: StarterDeckEntry[] = [
  { cardNumber: 'ST5-001', name: 'Madeleine Cookie', count: 2 },
  { cardNumber: 'ST5-002', name: 'GingerBright', count: 4 },
  { cardNumber: 'ST5-003', name: 'Fig Cookie', count: 4 },
  { cardNumber: 'ST5-004', name: 'Skater Cookie', count: 2 },
  { cardNumber: 'ST5-005', name: 'Cream Puff Cookie', count: 4 },
  { cardNumber: 'ST5-006', name: 'String Gummy Cookie', count: 2 },
  { cardNumber: 'ST5-007', name: 'Yoga Cookie', count: 2 },
  { cardNumber: 'ST5-008', name: 'Fairy Cookie', count: 4 },
  { cardNumber: 'ST5-009', name: 'GingerBrave', count: 4 },
  { cardNumber: 'ST5-010', name: 'Carol Cookie', count: 2 },
  { cardNumber: 'ST5-011', name: 'Tiger Lily Cookie', count: 4 },
  { cardNumber: 'ST5-012', name: 'Clover Cookie', count: 4 },
  { cardNumber: 'ST5-013', name: 'Pilot Cookie', count: 2 },
  { cardNumber: 'ST5-014', name: 'Pancake Cookie', count: 4 },
  { cardNumber: 'ST5-015', name: 'Rye Cookie', count: 2 },
  { cardNumber: 'ST5-016', name: 'BONUS Coin', count: 2 },
  { cardNumber: 'ST5-017', name: 'Violet Dragonspout', count: 2 },
  { cardNumber: 'ST5-018', name: 'Dragonfly Candy Brooch', count: 2 },
  { cardNumber: 'ST5-019', name: 'Pastry Boomerang', count: 2 },
  { cardNumber: 'ST5-020', name: 'Forbidden Grimoire', count: 2 },
  { cardNumber: 'ST5-021', name: 'Hidden Warpgate', count: 2 },
  { cardNumber: 'ST5-022', name: 'Windswept Valley', count: 2 },
]

export const AI_PRESET_BS2_RED_DECK: StarterDeckEntry[] = [
  { cardNumber: 'ST1-001', count: 2 },
  { cardNumber: 'ST1-004', count: 4 },
  { cardNumber: 'ST1-013', count: 4 },
  { cardNumber: 'BS2-003', count: 4 },
  { cardNumber: 'BS2-006', count: 4 },
  { cardNumber: 'BS1-022', count: 4 },
  { cardNumber: 'ST1-020', count: 4 },
  { cardNumber: 'BS1-012', count: 4 },
  { cardNumber: 'BS1-008', count: 4 },
  { cardNumber: 'BS1-006', count: 3 },
  { cardNumber: 'BS1-003', count: 4 },
  { cardNumber: 'ST1-009', count: 1 },
  { cardNumber: 'ST1-014', count: 2 },
  { cardNumber: 'BS1-021', count: 2 },
  { cardNumber: 'BS2-001', count: 1 },
  { cardNumber: 'BS1-002', count: 1 },
  { cardNumber: 'BS1-018', count: 4 },
  { cardNumber: 'BS2-004', count: 4 },
  { cardNumber: 'BS1-007', count: 4 },
]

export const AI_PRESET_BS2_YELLOW_DECK: StarterDeckEntry[] = [
  { cardNumber: 'BS1-036', count: 4 },
  { cardNumber: 'BS1-037', count: 4 },
  { cardNumber: 'BS1-049', count: 4 },
  { cardNumber: 'BS1-052', count: 3 },
  { cardNumber: 'BS1-044', count: 1 },
  { cardNumber: 'BS1-040', count: 4 },
  { cardNumber: 'BS1-032', count: 4 },
  { cardNumber: 'BS1-033', count: 2 },
  { cardNumber: 'BS1-031', count: 4 },
  { cardNumber: 'ST2-020', count: 4 },
  { cardNumber: 'ST2-007', count: 4 },
  { cardNumber: 'BS1-030', count: 4 },
  { cardNumber: 'ST2-005', count: 4 },
  { cardNumber: 'BS1-051', count: 4 },
  { cardNumber: 'ST2-008', count: 4 },
  { cardNumber: 'BS2-010', count: 3 },
  { cardNumber: 'BS2-011', count: 2 },
  { cardNumber: 'ST2-016', count: 1 },
]

export const AI_PRESET_BS2_BEAN_DECK: StarterDeckEntry[] = [
  { cardNumber: 'BS2-021', count: 2 },
  { cardNumber: 'BS1-075', count: 4 },
  { cardNumber: 'BS1-069', count: 2 },
  { cardNumber: 'BS1-057', count: 4 },
  { cardNumber: 'ST3-022', count: 4 },
  { cardNumber: 'ST3-019', count: 4 },
  { cardNumber: 'ST3-014', count: 4 },
  { cardNumber: 'ST3-011', count: 2 },
  { cardNumber: 'ST3-008', count: 2 },
  { cardNumber: 'BS1-055', count: 2 },
  { cardNumber: 'BS1-054', count: 3 },
  { cardNumber: 'BS1-007', count: 4 },
  { cardNumber: 'BS1-032', count: 4 },
  { cardNumber: 'BS2-035', count: 4 },
  { cardNumber: 'BS2-053', count: 4 },
  { cardNumber: 'ST3-016', count: 3 },
  { cardNumber: 'BS2-015', count: 4 },
  { cardNumber: 'P-012', count: 3 },
  { cardNumber: 'ST3-002', count: 1 },
]

export const AI_PRESET_BS2_BLUE_DECK: StarterDeckEntry[] = [
  { cardNumber: 'BS2-031', count: 3 },
  { cardNumber: 'BS2-029', count: 3 },
  { cardNumber: 'BS2-036', count: 4 },
  { cardNumber: 'BS2-040', count: 4 },
  { cardNumber: 'BS2-049', count: 3 },
  { cardNumber: 'ST4-021', count: 4 },
  { cardNumber: 'ST4-017', count: 4 },
  { cardNumber: 'ST4-016', count: 4 },
  { cardNumber: 'ST4-014', count: 4 },
  { cardNumber: 'ST4-007', count: 4 },
  { cardNumber: 'ST4-006', count: 4 },
  { cardNumber: 'BS2-051', count: 3 },
  { cardNumber: 'BS2-035', count: 4 },
  { cardNumber: 'ST4-020', count: 2 },
  { cardNumber: 'BS2-042', count: 4 },
  { cardNumber: 'BS2-037', count: 4 },
  { cardNumber: 'BS2-044', count: 2 },
]

export const AI_PRESET_BS2_PURPLE_DECK: StarterDeckEntry[] = [
  { cardNumber: 'BS2-055', count: 1 },
  { cardNumber: 'BS2-058', count: 4 },
  { cardNumber: 'BS2-062', count: 4 },
  { cardNumber: 'BS2-068', count: 4 },
  { cardNumber: 'BS2-069', count: 4 },
  { cardNumber: 'BS2-075', count: 2 },
  { cardNumber: 'ST5-007', count: 3 },
  { cardNumber: 'BS2-061', count: 4 },
  { cardNumber: 'ST5-003', count: 4 },
  { cardNumber: 'BS2-072', count: 4 },
  { cardNumber: 'ST5-008', count: 2 },
  { cardNumber: 'BS2-056', count: 2 },
  { cardNumber: 'ST5-020', count: 3 },
  { cardNumber: 'BS2-079', count: 4 },
  { cardNumber: 'BS2-080', count: 3 },
  { cardNumber: 'ST5-018', count: 2 },
  { cardNumber: 'ST5-016', count: 1 },
  { cardNumber: 'ST5-022', count: 4 },
  { cardNumber: 'BS2-078', count: 2 },
  { cardNumber: 'BS2-077', count: 3 },
]

/**
 * 第三彈綠色－聖百合餅乾牌組。
 *
 * 2026-08-01 依實戰對戰紀錄調整過一版：原始配置在對紅色火龍果龍族牌組時，
 * 高等級（LV.3）主力反覆陣亡，很快把自己休息區等級推向 10（本作的敗北條件）。
 * 砍掉貢獻偏低的 Silverbell／Roguefort（合計 4 張 LV.1），換成：
 * - White Lily／Elder Faerie 各加碼一份，補強終結者密度
 * - Blue Lily Cookie 作為第二條 LV.3 終結者線
 * - Divine Light Crystal 從 1 張補到 2 張（本場最常抽不到的保命陷阱）
 * - Ritual of Life 兩張新面孔，直接對應「損失餅乾＝倒數計時」這個核心弱點
 */
export const AI_PRESET_BS3_GREEN_LILY_DECK: StarterDeckEntry[] = [
  { cardNumber: 'BS1-062', count: 4 },
  { cardNumber: 'BS1-057', count: 4 },
  { cardNumber: 'BS2-015', count: 4 },
  { cardNumber: 'BS3-050@1', count: 4 },
  { cardNumber: 'BS3-055', count: 3 },
  { cardNumber: 'BS3-060@1', count: 2 },
  { cardNumber: 'BS1-054', count: 2 },
  { cardNumber: 'BS1-069', count: 4 },
  { cardNumber: 'BS2-019', count: 4 },
  { cardNumber: 'BS3-056', count: 2 },
  { cardNumber: 'BS1-055', count: 2 },
  { cardNumber: 'BS1-067', count: 2 },
  { cardNumber: 'BS1-075', count: 4 },
  { cardNumber: 'ST3-016', count: 2 },
  { cardNumber: 'P-012', count: 1 },
  { cardNumber: 'ST3-019', count: 3 },
  { cardNumber: 'ST3-020', count: 2 },
  { cardNumber: 'P-029', count: 2 },
  { cardNumber: 'BS3-070', count: 2 },
  { cardNumber: 'BS2-021', count: 2 },
  { cardNumber: 'BS3-069', count: 1 },
  { cardNumber: 'ST3-022', count: 4 },
]

/** 使用者提供的第三彈藍色－PR 雪酪牌組。 */
export const AI_PRESET_BS3_BLUE_SORBET_DECK: StarterDeckEntry[] = [
  { cardNumber: 'BS2-036', count: 4 },
  { cardNumber: 'BS2-040', count: 4 },
  { cardNumber: 'BS2-049', count: 2 },
  { cardNumber: 'ST4-021', count: 4 },
  { cardNumber: 'ST4-016', count: 4 },
  { cardNumber: 'ST4-007', count: 3 },
  { cardNumber: 'BS2-051', count: 3 },
  { cardNumber: 'ST4-020', count: 2 },
  { cardNumber: 'P-030', count: 4 },
  { cardNumber: 'BS3-076', count: 2 },
  { cardNumber: 'BS2-026', count: 2 },
  { cardNumber: 'BS3-093', count: 4 },
  { cardNumber: 'BS2-047', count: 1 },
  { cardNumber: 'ST4-019', count: 1 },
  { cardNumber: 'ST4-022', count: 4 },
  { cardNumber: 'BS3-085', count: 4 },
  { cardNumber: 'BS3-074', count: 4 },
  { cardNumber: 'ST4-014', count: 4 },
  { cardNumber: 'ST4-009', count: 4 },
]

/** 使用者提供的第三彈紅色－火龍果龍族餅乾牌組。 */
export const AI_PRESET_BS3_RED_PITAYA_DECK: StarterDeckEntry[] = [
  { cardNumber: 'BS3-010', count: 3 },
  { cardNumber: 'BS3-017', count: 4 },
  { cardNumber: 'BS3-006', count: 4 },
  { cardNumber: 'BS3-013', count: 4 },
  { cardNumber: 'BS3-019', count: 3 },
  { cardNumber: 'BS3-009', count: 3 },
  { cardNumber: 'BS1-002', count: 1 },
  { cardNumber: 'ST1-004', count: 1 },
  { cardNumber: 'BS2-001', count: 1 },
  { cardNumber: 'ST1-013', count: 4 },
  { cardNumber: 'BS1-018', count: 4 },
  { cardNumber: 'BS1-040', count: 1 },
  { cardNumber: 'BS1-003', count: 3 },
  { cardNumber: 'BS2-003', count: 4 },
  { cardNumber: 'BS2-006', count: 3 },
  { cardNumber: 'BS1-022', count: 4 },
  { cardNumber: 'BS3-022', count: 1 },
  { cardNumber: 'BS2-007', count: 2 },
  { cardNumber: 'ST1-020', count: 4 },
  { cardNumber: 'ST1-001', count: 4 },
  { cardNumber: 'BS1-012', count: 2 },
]

/**
 * 第三彈紫色－黑可可餅乾牌組（丟牌紫路線）。
 *
 * 2026-08-01 依實戰對戰紀錄調整過一版：原始配置完全沒有陷阱卡，在「損失餅乾
 * ＝倒數計時」的規則下是硬傷（對紅色火龍果龍族牌組時，主力在低 HP 掛在場上
 * 太久，被道具卡直接打死也無從反應）。砍掉貢獻偏低的 Red Velvet／Starfruit
 * （觸發條件苛刻、需要犧牲自己場上餅乾）與 1 張 Pastry Cookie，換成：
 * - Chocolate Altar of the Fallen：無條件 -3 攻擊，門檻到了還能倒貼處決
 * - Hidden Warpgate：可直接處決剩餘 HP≤2 的目標，選攻擊者本身等同取消攻擊
 * - Abandoned Cloud Nest：棄牌區 15 張以上 -3 攻擊，剛好貼合這套牌自己的節奏
 */
export const AI_PRESET_BS3_PURPLE_DARK_CACAO_DECK: StarterDeckEntry[] = [
  { cardNumber: 'BS2-061', count: 4 },
  { cardNumber: 'BS3-105', count: 4 },
  { cardNumber: 'BS3-103', count: 1 },
  { cardNumber: 'BS2-062', count: 2 },
  { cardNumber: 'BS2-071', count: 4 },
  { cardNumber: 'BS3-099', count: 2 },
  { cardNumber: 'BS2-053', count: 4 },
  { cardNumber: 'BS2-069', count: 4 },
  { cardNumber: 'BS2-068', count: 4 },
  { cardNumber: 'BS2-058', count: 2 },
  { cardNumber: 'BS3-113', count: 1 },
  { cardNumber: 'BS3-100', count: 1 },
  { cardNumber: 'BS3-107', count: 4 },
  { cardNumber: 'BS2-056', count: 4 },
  { cardNumber: 'ST5-003', count: 4 },
  { cardNumber: 'BS2-072', count: 2 },
  { cardNumber: 'BS2-077', count: 4 },
  { cardNumber: 'BS2-078', count: 1 },
  { cardNumber: 'BS2-081', count: 2 },
  { cardNumber: 'BS3-117', count: 3 },
  { cardNumber: 'ST5-021', count: 2 },
  { cardNumber: 'BS2-080', count: 1 },
]

/**
 * 第三彈紫色－黑可可餅乾牌組（打架紫路線）。
 *
 * 跟上面的丟牌紫互斥：不吃棄牌區張數，純數值本體＋固定條件移除技能推進，
 * 前中期比丟牌紫扎實（Angel Cookie 阻擋者＋Chocolate Altar 無條件 -3 攻擊，
 * 不像丟牌紫那樣要等門檻解鎖才有防守手段），代價是沒有丟牌紫後期「一次
 * 解決全場」的爆發力。60 張合法（已用 validateCustomDeck 驗證：flip 8／
 * 餅乾 39／物品 5／陷阱 8）。
 */
export const AI_PRESET_BS3_PURPLE_DARK_CACAO_FIGHTING_DECK: StarterDeckEntry[] = [
  { cardNumber: 'BS3-110', count: 4 },
  { cardNumber: 'BS2-076', count: 3 },
  { cardNumber: 'ST5-015', count: 4 },
  { cardNumber: 'BS2-055', count: 2 },
  { cardNumber: 'BS2-069', count: 4 },
  { cardNumber: 'BS2-068', count: 3 },
  { cardNumber: 'ST5-010', count: 3 },
  { cardNumber: 'BS3-108', count: 4 },
  { cardNumber: 'BS2-067', count: 4 },
  { cardNumber: 'BS2-053', count: 4 },
  { cardNumber: 'BS2-061', count: 4 },
  { cardNumber: 'BS3-107', count: 3 },
  { cardNumber: 'BS2-056', count: 3 },
  { cardNumber: 'ST5-003', count: 2 },
  { cardNumber: 'BS2-077', count: 2 },
  { cardNumber: 'ST5-018', count: 2 },
  { cardNumber: 'BS3-116', count: 1 },
  { cardNumber: 'BS3-117', count: 4 },
  { cardNumber: 'ST5-021', count: 3 },
  { cardNumber: 'ST5-020', count: 1 },
]

/** 使用者提供的第三彈黃色－反擊流牌組。 */
export const AI_PRESET_BS3_YELLOW_COUNTER_DECK: StarterDeckEntry[] = [
  { cardNumber: 'BS3-029', count: 3 },
  { cardNumber: 'BS2-012', count: 3 },
  { cardNumber: 'BS1-031', count: 4 },
  { cardNumber: 'BS1-032', count: 4 },
  { cardNumber: 'BS1-036', count: 4 },
  { cardNumber: 'BS1-037', count: 2 },
  { cardNumber: 'ST2-008', count: 2 },
  { cardNumber: 'BS2-011', count: 3 },
  { cardNumber: 'ST2-016', count: 1 },
  { cardNumber: 'BS1-049', count: 4 },
  { cardNumber: 'ST2-020', count: 4 },
  { cardNumber: 'BS3-045', count: 4 },
  { cardNumber: 'BS1-051', count: 3 },
  { cardNumber: 'BS1-052', count: 3 },
  { cardNumber: 'ST2-007', count: 4 },
  { cardNumber: 'BS1-030', count: 2 },
  { cardNumber: 'BS2-009', count: 2 },
  { cardNumber: 'ST2-005', count: 4 },
  { cardNumber: 'BS1-040', count: 4 },
]

export const OFFICIAL_STARTER_DECK_RED = OFFICIAL_RED_STARTER_DECK

export const OFFICIAL_DECK_RECIPES: Record<BuiltInDeckChoice, StarterDeckEntry[]> = {
  red: OFFICIAL_RED_STARTER_DECK,
  yellow: OFFICIAL_YELLOW_STARTER_DECK,
  green: OFFICIAL_GREEN_STARTER_DECK,
  blue: OFFICIAL_BLUE_STARTER_DECK,
  purple: OFFICIAL_PURPLE_STARTER_DECK,
  'bs2-red': AI_PRESET_BS2_RED_DECK,
  'bs2-yellow': AI_PRESET_BS2_YELLOW_DECK,
  'bs2-bean': AI_PRESET_BS2_BEAN_DECK,
  'bs2-blue': AI_PRESET_BS2_BLUE_DECK,
  'bs2-purple': AI_PRESET_BS2_PURPLE_DECK,
  'bs3-green-lily': AI_PRESET_BS3_GREEN_LILY_DECK,
  'bs3-blue-sorbet': AI_PRESET_BS3_BLUE_SORBET_DECK,
  'bs3-red-pitaya': AI_PRESET_BS3_RED_PITAYA_DECK,
  'bs3-purple-dark-cacao': AI_PRESET_BS3_PURPLE_DARK_CACAO_DECK,
  'bs3-purple-dark-cacao-fighting': AI_PRESET_BS3_PURPLE_DARK_CACAO_FIGHTING_DECK,
  'bs3-yellow-counter': AI_PRESET_BS3_YELLOW_COUNTER_DECK,
}

const getEnergyColor = (
  source: OfficialCardRecord,
): GameCard['energyColor'] => {
  const color = source.color?.toLowerCase()
  if (
    color === 'red' ||
    color === 'yellow' ||
    color === 'green' ||
    color === 'blue' ||
    color === 'purple' ||
    color === 'black'
  ) {
    return color
  }

  return source.energyType === 'MIX' ? 'wild' : undefined
}

export const createCard = (
  source: OfficialCardRecord,
  playerId: PlayerId,
  copyNumber: number,
): GameCard => {
  const effectConversion = convertOfficialCardEffects(source)
  const attackEffects = convertOfficialAttackEffects(source)
  const skill = convertOfficialCookieSkill(source)
  const flip = convertOfficialFlipAbility(source)
  const trap = convertOfficialTrapAbility(source)
  const item = convertOfficialItemAbility(source)
  const stageAbility = convertOfficialStageAbility(source)

  let effectText: string | undefined
  let effects: import('./types').CardEffect[] | undefined

  if (effectConversion.status === 'supported') {
    effectText = effectConversion.sourceText
    effects = effectConversion.effects
  } else if (trap) {
    effectText = trap.text
    effects = trap.effects
  } else if (item) {
    effectText = item.text
    effects = item.effects
  } else if (stageAbility) {
    effectText = stageAbility.text
    effects = stageAbility.effects
  } else if (flip) {
    effectText = flip.text
    effects = flip.effects
  }

  const keywords = getRuntimeKeywords(source)

  const base = {
    id: source.baseCardNumber,
    instanceId: `${playerId}-${source.cardNumber}-${copyNumber}`,
    name: source.name,
    imageUrl: source.imageUrl,
    energyColor: getEnergyColor(source),
    officialType: (source.type === 'flip'
      ? 'flip'
      : 'cookie') as GameCard['officialType'],
    ...(keywords.length > 0 ? { keywords } : {}),
    ...(effectText ? { effectText, effects } : {}),
  }

  if (
    (source.type === 'cookie' || source.type === 'flip') &&
    source.level !== null &&
    source.hp !== null
  ) {
    const parsedAttack = parseOfficialCardText(source.attackText)
    const hpOnlyFlip =
      source.type === 'flip' &&
      source.baseCardNumber === 'P-024' &&
      Boolean(flip)

    return {
      ...base,
      type: 'cookie',
      level: source.level,
      hp: source.hp,
      attack: parsedAttack?.damage ?? (hpOnlyFlip ? 0 : 1),
      attackCost: parsedAttack?.totalCost ?? 0,
      attackEnergyCost: parsedAttack?.cost ?? {},
      ...(hpOnlyFlip ? { nonAttackable: true } : {}),
      attackText: source.attackText ?? undefined,
      ...(attackEffects ? { attackEffects: attackEffects satisfies CardEffect[] } : {}),
      ...(skill ? { skill } : {}),
      ...(flip ? { flip } : {}),
    }
  }

  const runtimeType =
    source.type === 'trap' || source.type === 'stage'
      ? source.type
      : 'item'

  return {
    ...base,
    officialType: runtimeType,
    type: runtimeType,
    ...(trap ? { trap } : {}),
    ...(item ? { item } : {}),
    ...(stageAbility ? { stageAbility } : {}),
  }
}

const createOfficialStarterDeckFromRecipe = (
  playerId: PlayerId,
  recipe: StarterDeckEntry[],
  records: OfficialCardRecord[],
): GameCard[] => {
  const recordsByNumber = new Map(
    records.map((record) => [record.cardNumber, record]),
  )

  return recipe.flatMap((entry) => {
    const source =
      recordsByNumber.get(entry.cardNumber) ??
      (getCardPoolEntry(entry.cardNumber) as OfficialCardRecord | undefined)
    if (!source) {
      throw new Error(`Missing official sample card ${entry.cardNumber}`)
    }

    return Array.from({ length: entry.count }, (_, index) =>
      createCard(source, playerId, index + 1),
    )
  })
}

export const createOfficialRedStarterDeck = (
  playerId: PlayerId,
): GameCard[] =>
  createOfficialStarterDeckFromRecipe(
    playerId,
    OFFICIAL_RED_STARTER_DECK,
    officialRedSample.cards as OfficialCardRecord[],
  )

export const createOfficialYellowStarterDeck = (
  playerId: PlayerId,
): GameCard[] =>
  createOfficialStarterDeckFromRecipe(
    playerId,
    OFFICIAL_YELLOW_STARTER_DECK,
    officialYellowSample.cards as OfficialCardRecord[],
  )

export const createOfficialGreenStarterDeck = (
  playerId: PlayerId,
): GameCard[] =>
  createOfficialStarterDeckFromRecipe(
    playerId,
    OFFICIAL_GREEN_STARTER_DECK,
    officialGreenSample.cards as OfficialCardRecord[],
  )

export const createOfficialBlueStarterDeck = (
  playerId: PlayerId,
): GameCard[] =>
  createOfficialStarterDeckFromRecipe(
    playerId,
    OFFICIAL_BLUE_STARTER_DECK,
    officialBlueSample.cards as OfficialCardRecord[],
  )

export const createOfficialPurpleStarterDeck = (
  playerId: PlayerId,
): GameCard[] =>
  createOfficialStarterDeckFromRecipe(
    playerId,
    OFFICIAL_PURPLE_STARTER_DECK,
    officialPurpleSample.cards as OfficialCardRecord[],
  )

export const createAiPresetBs2RedDeck = (playerId: PlayerId): GameCard[] =>
  createOfficialStarterDeckFromRecipe(playerId, AI_PRESET_BS2_RED_DECK, [])

export const createAiPresetBs2YellowDeck = (playerId: PlayerId): GameCard[] =>
  createOfficialStarterDeckFromRecipe(playerId, AI_PRESET_BS2_YELLOW_DECK, [])

export const createAiPresetBs2BeanDeck = (playerId: PlayerId): GameCard[] =>
  createOfficialStarterDeckFromRecipe(playerId, AI_PRESET_BS2_BEAN_DECK, [])

export const createAiPresetBs2BlueDeck = (playerId: PlayerId): GameCard[] =>
  createOfficialStarterDeckFromRecipe(playerId, AI_PRESET_BS2_BLUE_DECK, [])

export const createAiPresetBs2PurpleDeck = (playerId: PlayerId): GameCard[] =>
  createOfficialStarterDeckFromRecipe(playerId, AI_PRESET_BS2_PURPLE_DECK, [])

export const createAiPresetBs3GreenLilyDeck = (playerId: PlayerId): GameCard[] =>
  createOfficialStarterDeckFromRecipe(playerId, AI_PRESET_BS3_GREEN_LILY_DECK, [])

export const createAiPresetBs3BlueSorbetDeck = (playerId: PlayerId): GameCard[] =>
  createOfficialStarterDeckFromRecipe(playerId, AI_PRESET_BS3_BLUE_SORBET_DECK, [])

export const createAiPresetBs3RedPitayaDeck = (playerId: PlayerId): GameCard[] =>
  createOfficialStarterDeckFromRecipe(playerId, AI_PRESET_BS3_RED_PITAYA_DECK, [])

export const createAiPresetBs3PurpleDarkCacaoDeck = (
  playerId: PlayerId,
): GameCard[] =>
  createOfficialStarterDeckFromRecipe(
    playerId,
    AI_PRESET_BS3_PURPLE_DARK_CACAO_DECK,
    [],
  )

export const createAiPresetBs3PurpleDarkCacaoFightingDeck = (
  playerId: PlayerId,
): GameCard[] =>
  createOfficialStarterDeckFromRecipe(
    playerId,
    AI_PRESET_BS3_PURPLE_DARK_CACAO_FIGHTING_DECK,
    [],
  )

export const createAiPresetBs3YellowCounterDeck = (
  playerId: PlayerId,
): GameCard[] =>
  createOfficialStarterDeckFromRecipe(
    playerId,
    AI_PRESET_BS3_YELLOW_COUNTER_DECK,
    [],
  )

export const createOfficialStarterDeck = createOfficialRedStarterDeck

export const DECK_CREATORS: Record<
  BuiltInDeckChoice,
  (playerId: PlayerId) => GameCard[]
> = {
  red: createOfficialRedStarterDeck,
  yellow: createOfficialYellowStarterDeck,
  green: createOfficialGreenStarterDeck,
  blue: createOfficialBlueStarterDeck,
  purple: createOfficialPurpleStarterDeck,
  'bs2-red': createAiPresetBs2RedDeck,
  'bs2-yellow': createAiPresetBs2YellowDeck,
  'bs2-bean': createAiPresetBs2BeanDeck,
  'bs2-blue': createAiPresetBs2BlueDeck,
  'bs2-purple': createAiPresetBs2PurpleDeck,
  'bs3-green-lily': createAiPresetBs3GreenLilyDeck,
  'bs3-blue-sorbet': createAiPresetBs3BlueSorbetDeck,
  'bs3-red-pitaya': createAiPresetBs3RedPitayaDeck,
  'bs3-purple-dark-cacao': createAiPresetBs3PurpleDarkCacaoDeck,
  'bs3-purple-dark-cacao-fighting': createAiPresetBs3PurpleDarkCacaoFightingDeck,
  'bs3-yellow-counter': createAiPresetBs3YellowCounterDeck,
}

export const createDeckForChoice = (
  choice: BuiltInDeckChoice,
  playerId: PlayerId,
): GameCard[] => DECK_CREATORS[choice](playerId)
