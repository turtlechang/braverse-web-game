import { normalizeCardNumber } from './card-pool'
import asiaBanlist from '../../data/rules/asia-banlist-2026-02-13.json'

/**
 * 牌組賽制：兩種賽制都遵守基本牌組規則，差異只在禁限卡表。
 *
 * - open：開放賽制，正式卡池內所有卡號均可使用。
 * - standard：標準賽制，套用 ASIA 亞洲版目前採用的版本化禁卡／限卡名單。
 */
export type DeckFormat = 'open' | 'standard'

export const DEFAULT_DECK_FORMAT: DeckFormat = 'standard'

export interface BanlistPolicy {
  readonly id: string
  readonly region: string
  readonly updatedAt: string
  readonly effectiveAt: string
  readonly sourceUrl: string
  readonly officialSourceUrl: string
}

/**
 * 目前標準賽制使用的 ASIA 亞洲版快照（2026-02-13）。
 *
 * 資料以 JSON 版本化保存，避免將社群頁面的即時內容直接耦合進 runtime；
 * 官方公告仍是裁決來源，社群頁面只作為可讀的中文交叉索引。
 */
export const ACTIVE_BANLIST_POLICY: BanlistPolicy = {
  id: asiaBanlist.id,
  region: asiaBanlist.region,
  updatedAt: asiaBanlist.updatedAt,
  effectiveAt: asiaBanlist.effectiveAt,
  sourceUrl: asiaBanlist.sourceUrl,
  officialSourceUrl: asiaBanlist.officialSourceUrl,
}

export const ASIA_BANNED_CARD_NUMBERS = asiaBanlist.banned
export const ASIA_LIMITED_CARD_NUMBERS = asiaBanlist.limited

/** 舊 API 名稱保留作為相容別名；內容已跟隨目前 ASIA 快照。 */
export const TAIWAN_BANNED_CARD_NUMBERS = ASIA_BANNED_CARD_NUMBERS
export const TAIWAN_LIMITED_CARD_NUMBERS = ASIA_LIMITED_CARD_NUMBERS

const BANNED_CARD_NUMBERS = new Set<string>(ASIA_BANNED_CARD_NUMBERS)
const LIMITED_CARD_NUMBERS = new Set<string>(ASIA_LIMITED_CARD_NUMBERS)

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
