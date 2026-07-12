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

const recordByCardNumber = new Map<string, OfficialCardRecord>()
for (const card of allRawCards) {
  if (!recordByCardNumber.has(card.cardNumber)) {
    recordByCardNumber.set(card.cardNumber, card)
  }
}

const baseCardNumberSet = new Set<string>()
for (const card of allRawCards) {
  const base =
    card.baseCardNumber && card.baseCardNumber.length > 0
      ? card.baseCardNumber
      : card.cardNumber
  baseCardNumberSet.add(base)
}

const poolByBaseNumber = new Map<string, CardPoolEntry>()
for (const base of baseCardNumberSet) {
  const baseRecord =
    recordByCardNumber.get(base) ??
    allRawCards.find(
      (card) =>
        (card.baseCardNumber && card.baseCardNumber === base) ||
        card.cardNumber === base,
    )
  if (!baseRecord) continue
  poolByBaseNumber.set(base, {
    ...baseRecord,
    cardNumber: base,
    poolId: base,
  })
}

const poolByRawCardNumber = new Map<string, CardPoolEntry>()
for (const card of allRawCards) {
  const base =
    card.baseCardNumber && card.baseCardNumber.length > 0
      ? card.baseCardNumber
      : card.cardNumber
  poolByRawCardNumber.set(card.cardNumber, {
    ...card,
    cardNumber: card.cardNumber,
    poolId: base,
  })
}

export const normalizeCardNumber = (cardNumber: string): string => {
  const trimmed = cardNumber.trim()
  const direct = recordByCardNumber.get(trimmed)
  if (direct) {
    return direct.baseCardNumber && direct.baseCardNumber.length > 0
      ? direct.baseCardNumber
      : direct.cardNumber
  }
  return trimmed
}

export const getAllCardPoolEntries = (): CardPoolEntry[] =>
  Array.from(poolByRawCardNumber.values())

export const getCardPoolEntry = (
  cardNumber: string,
): CardPoolEntry | undefined => {
  const trimmed = cardNumber.trim()
  const raw = poolByRawCardNumber.get(trimmed)
  if (raw) return raw
  const base = normalizeCardNumber(trimmed)
  return poolByBaseNumber.get(base)
}

export const getCardPoolVariants = (
  cardNumber: string,
): OfficialCardRecord[] => {
  const base = normalizeCardNumber(cardNumber)
  return allRawCards.filter((card) => {
    const cardBase =
      card.baseCardNumber && card.baseCardNumber.length > 0
        ? card.baseCardNumber
        : card.cardNumber
    return cardBase === base
  })
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
