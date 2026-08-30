import officialBs8Candidates from '../../data/candidates/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json'
import {
  convertOfficialCardToExtraDeckCard,
  convertOfficialCardToGameCard,
} from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import {
  parseCandidateStagingDeckConfig,
  type CustomDeck,
  type CustomDeckEntry,
  type ExportableDeck,
} from './custom-deck'
import { getCardPoolEntry, normalizeCardNumber, type CardPoolEntry } from './card-pool'
import { DEFAULT_DECK_FORMAT, validateFormatRestrictions, type DeckFormat } from './deck-rules'
import { GameRuleError } from './errors'
import { validateExtraDeck } from './extra-deck'
import { createCard } from './starter-deck'
import type { ExtraDeckCard, GameCard, PlayerId, PlayerSetup } from './types'

/**
 * A deliberately opt-in room/deck marker.  It is never inferred from a card
 * number, so normal custom decks and Standard rooms cannot accidentally gain
 * access to candidate cards.
 */
export const BS8_CANDIDATE_STAGING_KIND = 'bs8-candidate-staging' as const

export interface Bs8CandidateStagingDeck extends CustomDeck {
  candidateStaging: {
    kind: typeof BS8_CANDIDATE_STAGING_KIND
    extraDeckEntries: CustomDeckEntry[]
  }
}

export interface Bs8CandidateStagingDeckValidation {
  isValid: boolean
  valid: boolean
  errors: string[]
  stats: {
    totalCards: number
    flipCards: number
    cookieCards: number
    itemCards: number
    trapCards: number
    stageCards: number
    mainDeckCards: number
    extraDeckCards: number
  }
}

export interface Bs8CandidateExtraDeckCardDefinition {
  cardNumber: string
  name: string
  imageUrl: string | null
}

/**
 * Candidate-only main-deck records have the same surface as the formal pool
 * so the staging editor can reuse card filtering/rendering without adding
 * BS8 to generated-card-pool or Standard lookup.
 */
export type Bs8CandidateMainDeckCardDefinition = CardPoolEntry

export interface Bs8CandidateStagingDeckImportOptions {
  /** The candidate editor's selected format overrides JSON metadata. */
  format?: DeckFormat
}

export interface Bs8CandidateStagingDeckImportResult {
  deck: Bs8CandidateStagingDeck | null
  error: string | null
}

const candidateCards = officialBs8Candidates.cards as OfficialCardRecord[]
const candidateInventoryStatus = (
  officialBs8Candidates as { source?: { candidateStatus?: unknown } }
).source?.candidateStatus
const isCandidateInventory = candidateInventoryStatus === 'inventory'

const candidateExtraRecords = new Map(
  candidateCards
    .filter((card) => card.type === 'extra' && card.variant === null)
    .map((card) => [card.baseCardNumber, card]),
)

type CandidateMainRecord = {
  record: OfficialCardRecord
  definition: Bs8CandidateMainDeckCardDefinition
}

const candidateMainRecords = new Map<string, CandidateMainRecord>()
const candidateMainBlockedReasons = new Map<string, string>()

for (const record of candidateCards) {
  if (record.type === 'extra') continue

  const conversion = convertOfficialCardToGameCard(record)
  if (conversion.status !== 'converted') {
    candidateMainBlockedReasons.set(
      record.cardNumber,
      `候選 runtime 轉接失敗：${conversion.reason}`,
    )
    continue
  }

  candidateMainRecords.set(record.cardNumber, {
    record,
    definition: {
      ...record,
      poolId: record.baseCardNumber,
    },
  })
}

const resolveCandidateMainRecord = (
  cardNumber: string,
): CandidateMainRecord | undefined => {
  const trimmed = cardNumber.trim()
  const direct = candidateMainRecords.get(trimmed)
  if (direct) return direct
  return candidateMainRecords.get(normalizeCardNumber(trimmed))
}

const getCandidateMainBlocker = (cardNumber: string): string | undefined => {
  const trimmed = cardNumber.trim()
  return (
    candidateMainBlockedReasons.get(trimmed) ??
    candidateMainBlockedReasons.get(normalizeCardNumber(trimmed))
  )
}

export const getBs8CandidateMainDeckCardDefinitions = (): readonly Bs8CandidateMainDeckCardDefinition[] =>
  [...candidateMainRecords.values()]
    .map(({ definition }) => definition)
    .sort((left, right) => left.cardNumber.localeCompare(right.cardNumber))

export const getBs8CandidateMainDeckCardDefinition = (
  cardNumber: string,
): Bs8CandidateMainDeckCardDefinition | undefined =>
  resolveCandidateMainRecord(cardNumber)?.definition

/** Exposes conversion blockers without letting candidate cards leak into Standard. */
export const getBs8CandidateMainDeckCardBlocker = (
  cardNumber: string,
): string | undefined => getCandidateMainBlocker(cardNumber)

export const getBs8CandidateExtraDeckCardDefinitions = (): readonly Bs8CandidateExtraDeckCardDefinition[] =>
  [...candidateExtraRecords.entries()]
    .map(([cardNumber, card]) => ({
      cardNumber,
      name: card.name,
      imageUrl: card.imageUrl,
    }))
    .sort((left, right) => left.cardNumber.localeCompare(right.cardNumber))

export const isBs8CandidateStagingDeck = (
  deck: CustomDeck | Bs8CandidateStagingDeck,
): deck is Bs8CandidateStagingDeck => {
  const candidateStaging = (deck as Partial<Bs8CandidateStagingDeck>).candidateStaging
  return (
    candidateStaging?.kind === BS8_CANDIDATE_STAGING_KIND &&
    Array.isArray(candidateStaging.extraDeckEntries)
  )
}

const materializeCandidateExtraDeck = (
  entries: readonly CustomDeckEntry[],
  playerId: PlayerId,
): { cards: ExtraDeckCard[]; errors: string[] } => {
  const cards: ExtraDeckCard[] = []
  const errors: string[] = []
  const copiesByCardNumber = new Map<string, number>()

  for (const entry of entries) {
    const cardNumber = normalizeCardNumber(entry.cardNumber)
    const record = candidateExtraRecords.get(cardNumber)
    if (!record) {
      errors.push(`${entry.cardNumber} 不是可用的 BS8 候選 EXTRA 卡。`)
      continue
    }
    if (!Number.isInteger(entry.count) || entry.count < 1) {
      errors.push(`${entry.cardNumber} 的數量必須是至少 1 的整數。`)
      continue
    }

    const alreadyMaterialized = copiesByCardNumber.get(cardNumber) ?? 0
    for (let copy = 1; copy <= entry.count; copy += 1) {
      const instanceCopy = alreadyMaterialized + copy
      const converted = convertOfficialCardToExtraDeckCard(record, `${playerId}:${cardNumber}:${instanceCopy}`)
      if (converted.status !== 'converted') {
        errors.push(`${entry.cardNumber} 尚未具備候選 EXTRA runtime 契約。`)
        break
      }
      cards.push({
        ...converted.extraDeckCard,
        instanceId: `candidate-bs8:${playerId}:${cardNumber}:${instanceCopy}`,
      })
    }
    copiesByCardNumber.set(cardNumber, alreadyMaterialized + entry.count)
  }

  return { cards, errors }
}

const getCandidateMainDeckBaseNumber = (
  cardNumber: string,
): string =>
  resolveCandidateMainRecord(cardNumber)?.record.baseCardNumber ??
  normalizeCardNumber(cardNumber)

const materializeCandidateMainDeck = (
  entries: readonly CustomDeckEntry[],
  playerId: PlayerId,
): { cards: GameCard[]; errors: string[] } => {
  const cards: GameCard[] = []
  const errors: string[] = []
  const copiesByRawCardNumber = new Map<string, number>()

  for (const entry of entries) {
    if (!Number.isInteger(entry.count) || entry.count < 1) {
      errors.push(`${entry.cardNumber} 的數量必須是至少 1 的整數。`)
      continue
    }

    const candidate = resolveCandidateMainRecord(entry.cardNumber)
    if (candidate) {
      const alreadyMaterialized = copiesByRawCardNumber.get(
        candidate.record.cardNumber,
      ) ?? 0
      for (let copy = 1; copy <= entry.count; copy += 1) {
        const conversion = convertOfficialCardToGameCard(
          candidate.record,
          `${playerId}:candidate:${alreadyMaterialized + copy}`,
        )
        if (conversion.status !== 'converted') {
          errors.push(`${entry.cardNumber} 尚未具備候選 main-deck runtime 契約。`)
          break
        }
        cards.push(conversion.gameCard)
      }
      copiesByRawCardNumber.set(
        candidate.record.cardNumber,
        alreadyMaterialized + entry.count,
      )
      continue
    }

    const blocker = getCandidateMainBlocker(entry.cardNumber)
    if (blocker) {
      errors.push(`${entry.cardNumber} 尚未通過候選 strict contract：${blocker}`)
      continue
    }

    const formalCard = getCardPoolEntry(entry.cardNumber)
    if (!formalCard) {
      errors.push(`${entry.cardNumber} 不在正式卡池或可用的 BS8 候選卡池中。`)
      continue
    }
    for (let copy = 1; copy <= entry.count; copy += 1) {
      cards.push(createCard(formalCard, playerId, copy))
    }
  }

  return { cards, errors }
}

const validateCandidateMainDeck = (
  entries: readonly CustomDeckEntry[],
  format: DeckFormat | undefined,
): {
  errors: string[]
  stats: Bs8CandidateStagingDeckValidation['stats']
} => {
  const errors: string[] = []
  const countsByCardNumber = new Map<string, number>()
  let totalCards = 0
  let flipCards = 0
  let cookieCards = 0
  let itemCards = 0
  let trapCards = 0
  let stageCards = 0

  if (!isCandidateInventory) {
    errors.push('BS8 候選資料目前不是 inventory 狀態，不能用於候選驗收牌組。')
  }

  const { cards, errors: materializeErrors } = materializeCandidateMainDeck(
    entries,
    'player-one',
  )
  errors.push(...materializeErrors)

  for (const entry of entries) {
    totalCards += entry.count
    if (entry.count > 4) {
      errors.push(`${entry.cardNumber} 超過每卡最多 4 張限制`)
    }
    const cardNumber = getCandidateMainDeckBaseNumber(entry.cardNumber)
    countsByCardNumber.set(
      cardNumber,
      (countsByCardNumber.get(cardNumber) ?? 0) + entry.count,
    )
  }

  for (const [cardNumber, count] of countsByCardNumber) {
    if (count > 4) {
      errors.push(`${cardNumber} 合計 ${count} 張，超過每卡最多 4 張限制`)
    }
  }

  for (const card of cards) {
    if (card.flip) flipCards += 1
    if (card.type === 'cookie') cookieCards += 1
    else if (card.type === 'item') itemCards += 1
    else if (card.type === 'trap') trapCards += 1
    else if (card.type === 'stage') stageCards += 1
  }

  if (totalCards !== 60) {
    errors.push(`牌組必須剛好 60 張，目前為 ${totalCards} 張`)
  }
  if (cookieCards < 1) {
    errors.push('牌組至少需要 1 張餅乾卡')
  }
  if (flipCards > 16) {
    errors.push(`FLIP 卡不得超過 16 張，目前為 ${flipCards} 張`)
  }

  errors.push(...validateFormatRestrictions(entries, format ?? DEFAULT_DECK_FORMAT))

  return {
    errors,
    stats: {
      totalCards,
      flipCards,
      cookieCards,
      itemCards,
      trapCards,
      stageCards,
      mainDeckCards: totalCards,
      extraDeckCards: 0,
    },
  }
}

/**
 * Validates a candidate-only staging deck. Its main deck may combine the
 * formal pool with BS8 records that are both candidate-inventory and
 * strict-verified; EXTRA cards remain isolated behind their own adapter.
 * No data/cards or generated registry is involved.
 */
export const validateBs8CandidateStagingDeck = (
  deck: Bs8CandidateStagingDeck,
): Bs8CandidateStagingDeckValidation => {
  const main = validateCandidateMainDeck(deck.entries, deck.format)
  const { cards, errors: materializeErrors } = materializeCandidateExtraDeck(
    deck.candidateStaging.extraDeckEntries,
    'player-one',
  )
  const extra = validateExtraDeck(cards)
  const errors = [...main.errors, ...materializeErrors, ...extra.errors]
  const isValid = errors.length === 0

  return {
    isValid,
    valid: isValid,
    errors,
    stats: {
      ...main.stats,
      extraDeckCards: deck.candidateStaging.extraDeckEntries.reduce(
        (total, entry) => total + entry.count,
        0,
      ),
    },
  }
}

/**
 * Imports a candidate-only JSON payload. Unlike importDeck(), this path can
 * admit BS8 main-deck records only after their strict contract has verified.
 * It requires the explicit marker, so Standard JSON import cannot inherit
 * candidate cards or EXTRA cards accidentally.
 */
export const importBs8CandidateStagingDeck = (
  json: string,
  options: Bs8CandidateStagingDeckImportOptions = {},
): Bs8CandidateStagingDeckImportResult => {
  try {
    const parsed: unknown = JSON.parse(json)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { deck: null, error: '無法解析牌組資料' }
    }
    const data = parsed as ExportableDeck

    if (!data.name || typeof data.name !== 'string') {
      return { deck: null, error: '缺少牌組名稱' }
    }
    if (!Array.isArray(data.entries)) {
      return { deck: null, error: '缺少牌組內容' }
    }
    if (Object.prototype.hasOwnProperty.call(parsed, 'extraDeck') ||
        Object.prototype.hasOwnProperty.call(parsed, 'extraDeckEntries')) {
      return {
        deck: null,
        error: '候選驗收牌組必須使用 candidateStaging.extraDeckEntries 格式。',
      }
    }

    const staging = parseCandidateStagingDeckConfig(data.candidateStaging)
    if (staging.error) return { deck: null, error: staging.error }
    if (!staging.config) {
      return { deck: null, error: '缺少 BS8 候選驗收牌組標記' }
    }

    const entries: CustomDeckEntry[] = []
    for (const entry of data.entries) {
      if (!entry || typeof entry.cardNumber !== 'string' || entry.cardNumber.length === 0) {
        return { deck: null, error: '卡號格式錯誤' }
      }
      if (typeof entry.count !== 'number' || entry.count < 1) {
        return { deck: null, error: `${entry.cardNumber} 數量格式錯誤` }
      }
      entries.push({ cardNumber: entry.cardNumber, count: Math.floor(entry.count) })
    }

    const rawFormat = data.format
    if (rawFormat !== undefined && rawFormat !== 'open' && rawFormat !== 'standard') {
      return { deck: null, error: '牌組賽制只能是 open 或 standard。' }
    }
    const format = options.format ?? rawFormat ?? DEFAULT_DECK_FORMAT
    const now = new Date().toISOString()
    const deck: Bs8CandidateStagingDeck = {
      id: `candidate-imported-${Date.now()}`,
      name: data.name,
      entries,
      format,
      candidateStaging: staging.config,
      createdAt: now,
      updatedAt: now,
    }
    const validation = validateBs8CandidateStagingDeck(deck)
    if (!validation.valid) {
      return { deck: null, error: validation.errors.join('；') }
    }
    return { deck, error: null }
  } catch {
    return { deck: null, error: '無法解析牌組資料' }
  }
}

/**
 * The only bridge from a tagged candidate deck into a game state.  Callers
 * must use this explicitly; standard setup continues to use CustomDeck.
 */
export const createBs8CandidateStagingPlayerSetup = (
  deck: Bs8CandidateStagingDeck,
  playerId: PlayerId,
): PlayerSetup => {
  const validation = validateBs8CandidateStagingDeck(deck)
  if (!validation.isValid) {
    throw new GameRuleError(validation.errors[0] ?? 'BS8 候選驗收牌組不合法。')
  }

  const { cards: extraDeck } = materializeCandidateExtraDeck(
    deck.candidateStaging.extraDeckEntries,
    playerId,
  )
  const { cards: mainDeck } = materializeCandidateMainDeck(deck.entries, playerId)

  return {
    id: playerId,
    name: deck.name,
    deck: mainDeck,
    extraDeck,
  }
}
