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

export const DECK_SIZE_MIN = 40
export const DECK_SIZE_MAX = 60
export const MAX_COPIES_PER_CARD = 4

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
): { valid: boolean; errors: string[] } => {
  const errors: string[] = []
  let totalCount = 0

  for (const entry of entries) {
    if (entry.count < 1) {
      errors.push(`${entry.cardNumber} 的數量不能小於 1`)
    }
    if (entry.count > MAX_COPIES_PER_CARD) {
      errors.push(
        `${entry.cardNumber} 超過每卡最多 ${MAX_COPIES_PER_CARD} 張限制`,
      )
    }
    const poolEntry = getCardPoolEntry(entry.cardNumber)
    if (!poolEntry) {
      errors.push(`${entry.cardNumber} 不在可用卡池中`)
    }
    totalCount += entry.count
  }

  if (totalCount < DECK_SIZE_MIN) {
    errors.push(`牌組總數 ${totalCount} 張，未達最低 ${DECK_SIZE_MIN} 張`)
  }
  if (totalCount > DECK_SIZE_MAX) {
    errors.push(`牌組總數 ${totalCount} 張，超出最高 ${DECK_SIZE_MAX} 張`)
  }

  return { valid: errors.length === 0, errors }
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
