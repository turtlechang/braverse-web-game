import type { OfficialCardRecord } from '../cards/types'
import { getCardPoolEntry } from './card-pool'
import { createCard } from './starter-deck'
import type { GameCard, PlayerId } from './types'

export interface CustomDeckEntry {
  cardNumber: string
  count: number
}

export interface CustomDeck {
  id: string
  name: string
  entries: CustomDeckEntry[]
  createdAt: string
  updatedAt: string
}

export const DECK_SIZE_REQUIRED = 60
export const DECK_SIZE_MIN = DECK_SIZE_REQUIRED
export const DECK_SIZE_MAX = 60
export const MAX_COPIES_PER_CARD = 4
export const MAX_FLIP_CARDS = 16

export interface DeckValidationResult {
  isValid: boolean
  valid: boolean
  errors: string[]
  stats: {
    totalCards: number
    flipCards: number
    cookieCards: number
  }
}

export const getCustomDeckStorageKey = (): string => 'braverse-custom-decks'

export const loadCustomDecks = (): CustomDeck[] => {
  try {
    const raw = localStorage.getItem(getCustomDeckStorageKey())
    if (!raw) return []
    return JSON.parse(raw) as CustomDeck[]
  } catch {
    return []
  }
}

export const saveCustomDecks = (decks: CustomDeck[]): void => {
  localStorage.setItem(getCustomDeckStorageKey(), JSON.stringify(decks))
}

export const validateCustomDeck = (
  entries: CustomDeckEntry[],
): DeckValidationResult => {
  const errors: string[] = []
  const countsByCardNumber = new Map<string, number>()
  let totalCount = 0
  let flipCards = 0
  let cookieCards = 0

  for (const entry of entries) {
    if (entry.count < 1) {
      errors.push(`${entry.cardNumber} 的數量不能小於 1`)
    }
    if (entry.count > MAX_COPIES_PER_CARD) {
      errors.push(
        `${entry.cardNumber} 超過每卡最多 ${MAX_COPIES_PER_CARD} 張限制`,
      )
    }
    countsByCardNumber.set(
      entry.cardNumber,
      (countsByCardNumber.get(entry.cardNumber) ?? 0) + entry.count,
    )
    const poolEntry = getCardPoolEntry(entry.cardNumber)
    if (!poolEntry) {
      errors.push(`${entry.cardNumber} 不在可用卡池中`)
      totalCount += entry.count
      continue
    }
    if (poolEntry.type === 'flip') {
      flipCards += entry.count
    }
    if (poolEntry.type === 'cookie' || poolEntry.type === 'flip') {
      cookieCards += entry.count
    }
    totalCount += entry.count
  }

  for (const [cardNumber, count] of countsByCardNumber) {
    if (count > MAX_COPIES_PER_CARD) {
      errors.push(
        `${cardNumber} 合計 ${count} 張，超過每卡最多 ${MAX_COPIES_PER_CARD} 張限制`,
      )
    }
  }

  if (totalCount !== DECK_SIZE_REQUIRED) {
    errors.push(`牌組必須剛好 ${DECK_SIZE_REQUIRED} 張，目前為 ${totalCount} 張`)
  }
  if (cookieCards < 1) {
    errors.push('牌組至少需要 1 張餅乾卡')
  }
  if (flipCards > MAX_FLIP_CARDS) {
    errors.push(`FLIP 卡不得超過 ${MAX_FLIP_CARDS} 張，目前為 ${flipCards} 張`)
  }

  const isValid = errors.length === 0

  return {
    isValid,
    valid: isValid,
    errors,
    stats: {
      totalCards: totalCount,
      flipCards,
      cookieCards,
    },
  }
}

export const createDeckFromCustomDeck = (
  deck: CustomDeck,
  playerId: PlayerId,
): GameCard[] => {
  const cards: GameCard[] = []

  for (const entry of deck.entries) {
    const poolEntry = getCardPoolEntry(entry.cardNumber)
    if (!poolEntry) {
      throw new Error(`卡池中找不到 ${entry.cardNumber}`)
    }

    for (let i = 0; i < entry.count; i++) {
      cards.push(createCard(poolEntry as OfficialCardRecord, playerId, i + 1))
    }
  }

  return cards
}

export interface ExportableDeck {
  name: string
  entries: { cardNumber: string; count: number }[]
}

export const exportDeck = (deck: CustomDeck): string => {
  const data: ExportableDeck = {
    name: deck.name,
    entries: deck.entries.map((e) => ({
      cardNumber: e.cardNumber,
      count: e.count,
    })),
  }
  return JSON.stringify(data, null, 2)
}

export const importDeck = (
  json: string,
): { deck: CustomDeck | null; error: string | null } => {
  try {
    const data = JSON.parse(json) as ExportableDeck

    if (!data.name || typeof data.name !== 'string') {
      return { deck: null, error: '缺少牌組名稱' }
    }

    if (!Array.isArray(data.entries)) {
      return { deck: null, error: '缺少牌組內容' }
    }

    const entries: CustomDeckEntry[] = []
    for (const entry of data.entries) {
      if (!entry.cardNumber || typeof entry.cardNumber !== 'string') {
        return { deck: null, error: '卡號格式錯誤' }
      }
      if (typeof entry.count !== 'number' || entry.count < 1) {
        return { deck: null, error: `${entry.cardNumber} 數量格式錯誤` }
      }
      entries.push({
        cardNumber: entry.cardNumber,
        count: Math.floor(entry.count),
      })
    }

    const validation = validateCustomDeck(entries)
    if (!validation.valid) {
      return { deck: null, error: validation.errors.join('；') }
    }

    const now = new Date().toISOString()
    const deck: CustomDeck = {
      id: `imported-${Date.now()}`,
      name: data.name,
      entries,
      createdAt: now,
      updatedAt: now,
    }

    return { deck, error: null }
  } catch {
    return { deck: null, error: '無法解析牌組資料' }
  }
}
