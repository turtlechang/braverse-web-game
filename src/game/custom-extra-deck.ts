import { convertOfficialCardToExtraDeckCard } from '../cards/official-card-adapter'
import { getCardPoolEntry, normalizeCardNumber } from './card-pool'
import type { CustomDeckEntry } from './custom-deck'
import { validateFormatRestrictions, type DeckFormat } from './deck-rules'
import { EXTRA_DECK_MAX_CARDS, validateExtraDeck } from './extra-deck'
import type { ExtraDeckCard, PlayerId } from './types'

/** Validate untrusted JSON before iterating counts or constructing card instances. */
export const isDeckEntryList = (value: unknown): value is CustomDeckEntry[] =>
  Array.isArray(value) && value.every((entry: unknown) =>
    typeof entry === 'object' && entry !== null &&
    'cardNumber' in entry && typeof entry.cardNumber === 'string' && entry.cardNumber.trim().length > 0 &&
    'count' in entry && typeof entry.count === 'number' && Number.isSafeInteger(entry.count) && entry.count > 0,
  )

export const materializeFormalExtraDeck = (
  entries: unknown,
  playerId: PlayerId,
  format: DeckFormat,
): { cards: ExtraDeckCard[]; errors: string[]; totalCards: number } => {
  if (!isDeckEntryList(entries)) {
    return { cards: [], errors: ['EXTRA Deck 卡號或數量格式錯誤。'], totalCards: 0 }
  }
  const totalCards = entries.reduce((total, entry) => total + entry.count, 0)
  // Bound allocation even when a direct caller supplies a huge valid integer.
  if (totalCards > EXTRA_DECK_MAX_CARDS) {
    return { cards: [], errors: [`EXTRA Deck 最多只能放入 ${EXTRA_DECK_MAX_CARDS} 張，目前為 ${totalCards} 張。`], totalCards }
  }
  const cards: ExtraDeckCard[] = []
  const errors: string[] = []
  const copies = new Map<string, number>()
  for (const entry of entries) {
    const record = getCardPoolEntry(entry.cardNumber)
    if (!record || record.type !== 'extra') {
      errors.push(`${entry.cardNumber} 不是正式卡池中的 EXTRA 卡。`)
      continue
    }
    const base = normalizeCardNumber(entry.cardNumber)
    for (let index = 0; index < entry.count; index += 1) {
      const copy = (copies.get(base) ?? 0) + 1
      copies.set(base, copy)
      const instanceId = `formal-extra:${playerId}:${base}:${copy}`
      const converted = convertOfficialCardToExtraDeckCard(record, instanceId)
      if (converted.status !== 'converted') {
        errors.push(`${entry.cardNumber} 尚未具備正式 EXTRA runtime 契約。`)
        break
      }
      cards.push({ ...converted.extraDeckCard, instanceId })
    }
  }
  errors.push(...validateExtraDeck(cards).errors, ...validateFormatRestrictions(entries, format))
  return { cards, errors, totalCards }
}
