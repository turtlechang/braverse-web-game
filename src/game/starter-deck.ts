import officialSample from '../../data/cards/official-sample.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCookieSkill,
} from '../cards/official-effect-adapter'
import type { OfficialCardRecord } from '../cards/types'
import type { GameCard, PlayerId } from './types'

export interface StarterDeckEntry {
  cardNumber: string
  name: string
  count: number
}

export const OFFICIAL_STARTER_DECK_RED: StarterDeckEntry[] = [
  { cardNumber: 'ST1-001', name: '公主餅乾', count: 4 },
  { cardNumber: 'ST1-002', name: '忍者餅乾', count: 2 },
  { cardNumber: 'ST1-003', name: '恐龍餅乾', count: 2 },
  { cardNumber: 'ST1-004', name: '紅蘿蔔餅乾', count: 4 },
  { cardNumber: 'ST1-005', name: '大蔥餅乾', count: 4 },
  { cardNumber: 'ST1-006', name: '活潑餅乾', count: 4 },
  { cardNumber: 'ST1-007', name: '薄荷巧克力餅乾', count: 2 },
  { cardNumber: 'ST1-008', name: '櫻花餅乾', count: 2 },
  { cardNumber: 'ST1-009', name: '濃縮咖啡餅乾', count: 2 },
  { cardNumber: 'ST1-010', name: '鍊金術師餅乾', count: 2 },
  { cardNumber: 'ST1-011', name: '勇敢餅乾', count: 4 },
  { cardNumber: 'ST1-012', name: '殭屍餅乾', count: 4 },
  { cardNumber: 'ST1-013', name: '探險家餅乾', count: 4 },
  { cardNumber: 'ST1-014', name: '乾辣椒餅乾', count: 2 },
  { cardNumber: 'ST1-015', name: '開心果餅乾', count: 4 },
  { cardNumber: 'ST1-016', name: '黏膩餅乾', count: 2 },
  { cardNumber: 'ST1-017', name: '祕藏蛋糕刀', count: 2 },
  { cardNumber: 'ST1-018', name: '蝸牛棒棒糖', count: 2 },
  { cardNumber: 'ST1-019', name: '炎熱果凍塊', count: 2 },
  { cardNumber: 'ST1-020', name: '泥濘的麵團沼澤', count: 2 },
  { cardNumber: 'ST1-021', name: '尖尖的星星糖', count: 2 },
  { cardNumber: 'ST1-022', name: '熾熱果凍火山', count: 2 },
]

const getEnergyColor = (
  source: OfficialCardRecord,
): GameCard['energyColor'] => {
  const value =
    source.energyType === 'MIX'
      ? 'wild'
      : source.color?.toLowerCase()

  return value === 'red' ||
    value === 'yellow' ||
    value === 'green' ||
    value === 'blue' ||
    value === 'purple' ||
    value === 'black' ||
    value === 'wild'
    ? value
    : undefined
}

const createCard = (
  source: OfficialCardRecord,
  playerId: PlayerId,
  copyNumber: number,
): GameCard => {
  const effectConversion = convertOfficialCardEffects(source)
  const skill = convertOfficialCookieSkill(source)
  const base = {
    id: source.baseCardNumber,
    instanceId: `${playerId}-${source.cardNumber}-${copyNumber}`,
    name: source.name,
    imageUrl: source.imageUrl,
    energyColor: getEnergyColor(source),
    ...(effectConversion.status === 'supported'
      ? {
          effectText: effectConversion.sourceText,
          effects: effectConversion.effects,
        }
      : {}),
  }

  if (
    (source.type === 'cookie' || source.type === 'flip') &&
    source.level !== null &&
    source.hp !== null
  ) {
    return {
      ...base,
      type: 'cookie',
      level: source.level,
      hp: source.hp,
      attack: Number(
        source.attackText?.match(/Deals?\s+(\d+)\s+damage/i)?.[1] ?? 1,
      ),
      attackCost: source.attackText?.match(/\{[A-Z]\}/g)?.length ?? 0,
      ...(skill ? { skill } : {}),
    }
  }

  return {
    ...base,
    type:
      source.type === 'trap' || source.type === 'stage'
        ? source.type
        : 'item',
  }
}

export const createOfficialStarterDeck = (
  playerId: PlayerId,
): GameCard[] => {
  const records = officialSample.cards as OfficialCardRecord[]
  const recordsByNumber = new Map(
    records.map((record) => [record.cardNumber, record]),
  )

  return OFFICIAL_STARTER_DECK_RED.flatMap((entry) => {
    const source = recordsByNumber.get(entry.cardNumber)
    if (!source) {
      throw new Error(`找不到官方牌組卡牌 ${entry.cardNumber}。`)
    }

    return Array.from({ length: entry.count }, (_, index) =>
      createCard(source, playerId, index + 1),
    )
  })
}
