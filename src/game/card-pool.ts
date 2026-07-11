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

const poolByNumber = new Map<string, CardPoolEntry>()

for (const card of allRawCards) {
  if (!poolByNumber.has(card.cardNumber)) {
    poolByNumber.set(card.cardNumber, {
      ...card,
      poolId: card.cardNumber,
    })
  }
}

export const getAllCardPoolEntries = (): CardPoolEntry[] =>
  Array.from(poolByNumber.values())

export const getCardPoolEntry = (
  cardNumber: string,
): CardPoolEntry | undefined => poolByNumber.get(cardNumber)

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
