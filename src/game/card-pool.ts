import type { OfficialCardRecord } from '../cards/types'
import { normalizeKnownOfficialCardRecord } from '../cards/official-card-normalization'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { officialCardDatasets } from './generated-card-pool'

export interface CardPoolEntry extends OfficialCardRecord {
  poolId: string
}

// 一張卡是否為「具有 FLIP 的卡」應與 runtime 一致：官方 `type: flip` 的卡片一律視為
// FLIP（即使 flipText 為空的 vanilla FLIP，例如 BS2-042／P-047）；`type: cookie`
// 的卡片只有在轉接後真的有 `FlipAbility`（效果或附著加成）才算 FLIP。
//
// 修正前這裡只看 `cookie && flipText 非空`，會把官方將攻擊名重複寫進 flipText 的
// 普通餅乾／變體（P-056～P-069、BS4-004@1、BS5-039@2 等，P-059 同型）誤計為 FLIP，
// 造成 Deck editor 的「FLIP 篩選」與「FLIP N/16」上限（custom-deck.ts）偏差。
export const hasFlipAbility = (entry: CardPoolEntry): boolean =>
  entry.type === 'flip' || (entry.type === 'cookie' && cookieHasRuntimeFlip(entry))

let cookieRuntimeFlipByNumber: Record<string, boolean> | null = null

const cookieHasRuntimeFlip = (entry: CardPoolEntry): boolean => {
  if (!cookieRuntimeFlipByNumber) {
    cookieRuntimeFlipByNumber = {}
    for (const raw of allRawCards) {
      if (raw.type !== 'cookie') continue
      const conversion = convertOfficialCardToGameCard(raw)
      cookieRuntimeFlipByNumber[raw.cardNumber] =
        conversion.status === 'converted' && Boolean(conversion.gameCard.flip)
    }
  }
  return cookieRuntimeFlipByNumber[entry.cardNumber] ?? false
}

const allRawCards: OfficialCardRecord[] = [
  ...officialCardDatasets.flatMap(
    (dataset) => dataset.cards as OfficialCardRecord[],
  ),
].map(normalizeKnownOfficialCardRecord)

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
