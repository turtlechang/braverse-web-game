import { normalizeCardNumber } from './card-pool'

/**
 * 牌組賽制：兩種賽制都遵守基本牌組規則，差異只在禁限卡表。
 *
 * - open：開放賽制，正式卡池內所有卡號均可使用。
 * - standard：標準賽制，套用台灣目前公告的禁卡／限卡名單。
 */
export type DeckFormat = 'open' | 'standard'

export const DEFAULT_DECK_FORMAT: DeckFormat = 'standard'

/** 台灣官方公告（2025-06-20 更新、2025-06-30 起實施）的卡號。 */
export const TAIWAN_BANNED_CARD_NUMBERS = [
  'BS1-049',
  'BS4-040',
  'BS2-003',
  'P-030',
] as const

export const TAIWAN_LIMITED_CARD_NUMBERS = [
  'BS1-007',
  'BS1-032',
  'BS1-057',
  'BS2-035',
  'BS2-053',
  'BS4-026',
  'BS3-013',
  'BS3-111',
] as const

const BANNED_CARD_NUMBERS = new Set<string>(TAIWAN_BANNED_CARD_NUMBERS)
const LIMITED_CARD_NUMBERS = new Set<string>(TAIWAN_LIMITED_CARD_NUMBERS)

export type CardRestriction = 'none' | 'banned' | 'limited'

export const getCardRestriction = (
  cardNumber: string,
  format: DeckFormat = DEFAULT_DECK_FORMAT,
): CardRestriction => {
  if (format === 'open') return 'none'

  const baseCardNumber = normalizeCardNumber(cardNumber)
  if (BANNED_CARD_NUMBERS.has(baseCardNumber)) return 'banned'
  if (LIMITED_CARD_NUMBERS.has(baseCardNumber)) return 'limited'
  return 'none'
}

export const getDeckCopyLimit = (
  cardNumber: string,
  format: DeckFormat = DEFAULT_DECK_FORMAT,
  maxCopies = 4,
): number =>
  getCardRestriction(cardNumber, format) === 'banned'
    ? 0
    : getCardRestriction(cardNumber, format) === 'limited'
      ? 1
      : maxCopies

export const getDeckFormatLabel = (format: DeckFormat): string =>
  format === 'open' ? '開放賽制（所有卡牌都能用）' : '標準賽制（套用禁限卡）'

export interface DeckEntryLike {
  cardNumber: string
  count: number
}

export const validateFormatRestrictions = (
  entries: readonly DeckEntryLike[],
  format: DeckFormat = DEFAULT_DECK_FORMAT,
): string[] => {
  if (format === 'open') return []

  const countsByBaseCardNumber = new Map<string, number>()
  for (const entry of entries) {
    const baseCardNumber = normalizeCardNumber(entry.cardNumber)
    countsByBaseCardNumber.set(
      baseCardNumber,
      (countsByBaseCardNumber.get(baseCardNumber) ?? 0) + entry.count,
    )
  }

  const errors: string[] = []
  for (const [cardNumber, count] of countsByBaseCardNumber) {
    const restriction = getCardRestriction(cardNumber, format)
    if (restriction === 'banned' && count > 0) {
      errors.push(`標準賽制禁止使用 ${cardNumber}。`)
    }
    if (restriction === 'limited' && count > 1) {
      errors.push(`標準賽制 ${cardNumber} 最多只能放入 1 張，目前為 ${count} 張。`)
    }
  }
  return errors
}
