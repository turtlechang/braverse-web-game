import officialRedSample from '../../data/cards/official-sample.en.json'
import officialGreenSample from '../../data/cards/official-starter-deck-green.en.json'
import officialYellowSample from '../../data/cards/official-starter-deck-yellow.en.json'
import officialBlueSample from '../../data/cards/official-starter-deck-blue.en.json'
import officialPurpleSample from '../../data/cards/official-starter-deck-purple.en.json'
import officialBs1 from '../../data/cards/official-brave-beginning-bs1.en.json'
import officialBs2 from '../../data/cards/official-brave-beginning-bs2.en.json'
import type { OfficialCardRecord } from '../cards/types'

export interface CardPoolEntry extends OfficialCardRecord {
  poolId: string
}

const allRawCards: OfficialCardRecord[] = [
  ...(officialRedSample.cards as OfficialCardRecord[]),
  ...(officialGreenSample.cards as OfficialCardRecord[]),
  ...(officialYellowSample.cards as OfficialCardRecord[]),
  ...(officialBlueSample.cards as OfficialCardRecord[]),
  ...(officialPurpleSample.cards as OfficialCardRecord[]),
  ...(officialBs1.cards as OfficialCardRecord[]),
  ...(officialBs2.cards as OfficialCardRecord[]),
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
