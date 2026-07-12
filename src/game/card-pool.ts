import type { OfficialCardRecord } from '../cards/types'
import { officialCardDatasets } from './generated-card-pool'

export interface CardPoolEntry extends OfficialCardRecord {
  poolId: string
}

const allRawCards: OfficialCardRecord[] = [
  ...officialCardDatasets.flatMap(
    (dataset) => dataset.cards as OfficialCardRecord[],
  ),
]

const aliasToBase = new Map<string, string>()
const poolByBaseNumber = new Map<string, CardPoolEntry>()

for (const card of allRawCards) {
  const base =
    card.baseCardNumber && card.baseCardNumber.length > 0
      ? card.baseCardNumber
      : card.cardNumber

  aliasToBase.set(card.cardNumber, base)
  if (card.baseCardNumber) {
    aliasToBase.set(card.baseCardNumber, base)
  }

  if (!poolByBaseNumber.has(base)) {
    poolByBaseNumber.set(base, {
      ...card,
      cardNumber: base,
      poolId: base,
    })
  }
}

export const normalizeCardNumber = (cardNumber: string): string => {
  const trimmed = cardNumber.trim()
  return aliasToBase.get(trimmed) ?? trimmed
}

export const getAllCardPoolEntries = (): CardPoolEntry[] =>
  Array.from(poolByBaseNumber.values())

export const getCardPoolEntry = (
  cardNumber: string,
): CardPoolEntry | undefined => {
  const base = normalizeCardNumber(cardNumber)
  return poolByBaseNumber.get(base)
}

export const getCardPoolVariants = (
  cardNumber: string,
): OfficialCardRecord[] => {
  const base = normalizeCardNumber(cardNumber)
  return allRawCards.filter((card) => card.baseCardNumber === base)
}

export const getCardPoolEntriesByColor = (
  color: string,
): CardPoolEntry[] =>
  getAllCardPoolEntries().filter(
    (entry) => entry.color?.toLowerCase() === color.toLowerCase(),
  )

export const getCardPoolEntriesByType = (
  type: string,
): CardPoolEntry[] =>
  getAllCardPoolEntries().filter(
    (entry) => entry.type === type,
  )
