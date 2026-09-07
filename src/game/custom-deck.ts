import type { OfficialCardRecord } from '../cards/types'
import {
  getCardPoolEntry,
  hasFlipAbility,
  normalizeCardNumber,
} from './card-pool'
import { createCard } from './starter-deck'
import {
  DEFAULT_DECK_FORMAT,
  validateFormatRestrictions,
  type DeckFormat,
} from './deck-rules'
import { EXTRA_DECK_MAX_CARDS, EXTRA_DECK_MAX_COPIES_PER_CARD } from './extra-deck'
import type { GameCard, PlayerId, PlayerSetup } from './types'
import { isDeckEntryList, materializeFormalExtraDeck } from './custom-extra-deck'
import { GameRuleError } from './errors'

const canonicalizeEntry = (entry: CustomDeckEntry): CustomDeckEntry => {
  const base = normalizeCardNumber(entry.cardNumber)
  if (base === entry.cardNumber) return entry
  return { ...entry, cardNumber: base }
}

export interface CustomDeckEntry {
  cardNumber: string
  count: number
}

/**
 * Opt-in metadata for decks that may be used only by the BS8 candidate
 * acceptance environment.  Standard deck creation, export, and rooms do not
 * infer this state from card numbers.
 */
export interface CandidateStagingDeckConfig {
  kind: 'bs8-candidate-staging'
  extraDeckEntries: CustomDeckEntry[]
}

export interface CustomDeck {
  id: string
  name: string
  entries: CustomDeckEntry[]
  format?: DeckFormat
  extraDeckEntries?: CustomDeckEntry[]
  candidateStaging?: CandidateStagingDeckConfig
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
    itemCards: number
    trapCards: number
    stageCards: number
  }
}

export const getCustomDeckStorageKey = (): string => 'braverse-custom-decks'

export const CUSTOM_DECK_STORAGE_VERSION = 1

interface CustomDeckStorage {
  version: number
  decks: CustomDeck[]
}

const isCustomDeckShape = (value: unknown): value is CustomDeck => {
  if (typeof value !== 'object' || value === null) return false
  const deck = value as Partial<CustomDeck>
  const candidateStaging = deck.candidateStaging
  const hasValidCandidateStaging =
    candidateStaging === undefined ||
    (typeof candidateStaging === 'object' &&
      candidateStaging !== null &&
      candidateStaging.kind === 'bs8-candidate-staging' &&
      Array.isArray(candidateStaging.extraDeckEntries))
  return (
    typeof deck.id === 'string' &&
    typeof deck.name === 'string' &&
    isDeckEntryList(deck.entries) &&
    (deck.extraDeckEntries === undefined || isDeckEntryList(deck.extraDeckEntries)) &&
    !(deck.extraDeckEntries !== undefined && candidateStaging !== undefined) &&
    hasValidCandidateStaging
  )
}

export const parseCustomDeckStorage = (raw: string): CustomDeck[] => {
  const parsed: unknown = JSON.parse(raw)

  if (Array.isArray(parsed)) {
    return parsed.filter(isCustomDeckShape)
  }

  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    (parsed as CustomDeckStorage).version === CUSTOM_DECK_STORAGE_VERSION &&
    Array.isArray((parsed as CustomDeckStorage).decks)
  ) {
    return (parsed as CustomDeckStorage).decks.filter(isCustomDeckShape)
  }

  return []
}

export const loadCustomDecks = (): CustomDeck[] => {
  try {
    const raw = localStorage.getItem(getCustomDeckStorageKey())
    if (!raw) return []
    return parseCustomDeckStorage(raw)
  } catch {
    return []
  }
}

export const saveCustomDecks = (decks: CustomDeck[]): void => {
  const storage: CustomDeckStorage = {
    version: CUSTOM_DECK_STORAGE_VERSION,
    decks,
  }
  localStorage.setItem(getCustomDeckStorageKey(), JSON.stringify(storage))
}

export const createCustomDeckId = (): string =>
  `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const deleteCustomDeck = (deckId: string): CustomDeck[] => {
  const decks = loadCustomDecks().filter((deck) => deck.id !== deckId)
  saveCustomDecks(decks)
  return decks
}

export const duplicateCustomDeck = (
  deckId: string,
): { decks: CustomDeck[]; newDeck: CustomDeck | null } => {
  const decks = loadCustomDecks()
  const source = decks.find((deck) => deck.id === deckId)
  if (!source) {
    return { decks, newDeck: null }
  }

  const now = new Date().toISOString()
  const newDeck: CustomDeck = {
    id: createCustomDeckId(),
    name: `${source.name}（複製）`,
    entries: source.entries.map((entry) => ({ ...entry })),
    ...(source.extraDeckEntries !== undefined
      ? { extraDeckEntries: source.extraDeckEntries.map((entry) => ({ ...entry })) }
      : {}),
    format: source.format ?? DEFAULT_DECK_FORMAT,
    ...(source.candidateStaging
      ? {
          candidateStaging: {
            kind: source.candidateStaging.kind,
            extraDeckEntries: source.candidateStaging.extraDeckEntries.map(
              (entry) => ({ ...entry }),
            ),
          },
        }
      : {}),
    createdAt: now,
    updatedAt: now,
  }
  const updated = [...decks, newDeck]
  saveCustomDecks(updated)
  return { decks: updated, newDeck }
}

export const validateCustomDeck = (
  entries: CustomDeckEntry[],
  options: { format?: DeckFormat } = {},
): DeckValidationResult => {
  const format = options.format ?? DEFAULT_DECK_FORMAT
  const errors: string[] = []
  const countsByCardNumber = new Map<string, number>()
  let totalCount = 0
  let flipCards = 0
  let cookieCards = 0
  let itemCards = 0
  let trapCards = 0
  let stageCards = 0

  for (const rawEntry of entries) {
    if (!isDeckEntryList([rawEntry])) {
      errors.push('主牌組卡號或數量格式錯誤。')
      continue
    }
    const entry = canonicalizeEntry(rawEntry)
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
    if (poolEntry.type === 'extra') {
      errors.push(`${entry.cardNumber} 是 EXTRA 卡，不能放入主牌組`)
      totalCount += entry.count
      continue
    }
    if (hasFlipAbility(poolEntry)) {
      flipCards += entry.count
    }
    if (poolEntry.type === 'cookie' || poolEntry.type === 'flip') {
      cookieCards += entry.count
    } else if (poolEntry.type === 'item') {
      itemCards += entry.count
    } else if (poolEntry.type === 'trap') {
      trapCards += entry.count
    } else if (poolEntry.type === 'stage') {
      stageCards += entry.count
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

  errors.push(...validateFormatRestrictions(entries.filter((entry) => isDeckEntryList([entry])), format))

  const isValid = errors.length === 0

  return {
    isValid,
    valid: isValid,
    errors,
    stats: {
      totalCards: totalCount,
      flipCards,
      cookieCards,
      itemCards,
      trapCards,
      stageCards,
    },
  }
}

export const createDeckFromCustomDeck = (
  deck: CustomDeck,
  playerId: PlayerId,
): GameCard[] => {
  const cards: GameCard[] = []
  const copiesByCardNumber = new Map<string, number>()

  for (const rawEntry of deck.entries) {
    if (!isDeckEntryList([rawEntry]) || rawEntry.count > MAX_COPIES_PER_CARD) {
      throw new GameRuleError('主牌組卡號或數量格式錯誤。')
    }
    const entry = canonicalizeEntry(rawEntry)
    const poolEntry = getCardPoolEntry(entry.cardNumber)
    if (!poolEntry) {
      throw new Error(`卡池中找不到 ${entry.cardNumber}`)
    }
    // 直接建立對局的呼叫端也不可將 EXTRA 交給一般卡片建構器，否則會變成 item。
    if (poolEntry.type === 'extra') {
      throw new Error(`${entry.cardNumber} 是 EXTRA 卡，不能放入主牌組`)
    }

    for (let i = 0; i < entry.count; i++) {
      const copy = (copiesByCardNumber.get(entry.cardNumber) ?? 0) + 1
      copiesByCardNumber.set(entry.cardNumber, copy)
      cards.push(createCard(poolEntry as OfficialCardRecord, playerId, copy))
    }
  }

  return cards
}

export interface ExportableDeck {
  name: string
  entries: { cardNumber: string; count: number }[]
  format?: DeckFormat
  extraDeckEntries?: CustomDeckEntry[]
  /**
   * Candidate-only metadata.  It is deliberately nested and opt-in so a
   * normal JSON deck can never acquire BS8 EXTRA cards by card number alone.
   */
  candidateStaging?: CandidateStagingDeckConfig
}

export interface ImportDeckOptions {
  /** The editor's selected format takes precedence over the JSON metadata. */
  format?: DeckFormat
  /**
   * Only the separately labelled BS8 candidate staging editor may import the
   * candidate-only EXTRA payload.  Standard import must reject it instead of
   * silently dropping the cards.
   */
  allowCandidateStaging?: boolean
}

const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key)

/**
 * Shared JSON shape guard for the candidate-only importer.  This deliberately
 * validates only the isolated EXTRA construction boundary; candidate main
 * deck lookup and strict-contract admission live in bs8-candidate-staging.
 */
export const parseCandidateStagingDeckConfig = (
  raw: unknown,
): { config: CandidateStagingDeckConfig | undefined; error: string | null } => {
  if (raw === undefined) return { config: undefined, error: null }

  if (
    typeof raw !== 'object' ||
    raw === null ||
    (raw as Partial<CandidateStagingDeckConfig>).kind !== 'bs8-candidate-staging' ||
    !Array.isArray((raw as Partial<CandidateStagingDeckConfig>).extraDeckEntries)
  ) {
    return { config: undefined, error: '候選驗收 EXTRA Deck 資料格式錯誤' }
  }

  const entries: CustomDeckEntry[] = []
  const countsByCardNumber = new Map<string, number>()
  let totalCards = 0
  for (const rawEntry of (raw as CandidateStagingDeckConfig).extraDeckEntries) {
    if (
      typeof rawEntry !== 'object' ||
      rawEntry === null ||
      typeof rawEntry.cardNumber !== 'string' ||
      rawEntry.cardNumber.length === 0 ||
      typeof rawEntry.count !== 'number' ||
      !Number.isInteger(rawEntry.count) ||
      rawEntry.count < 1
    ) {
      return { config: undefined, error: '候選驗收 EXTRA Deck 卡號或數量格式錯誤' }
    }

    totalCards += rawEntry.count
    const canonicalNumber = normalizeCardNumber(rawEntry.cardNumber)
    const nextCount = (countsByCardNumber.get(canonicalNumber) ?? 0) + rawEntry.count
    countsByCardNumber.set(canonicalNumber, nextCount)
    if (nextCount > EXTRA_DECK_MAX_COPIES_PER_CARD) {
      return {
        config: undefined,
        error: `EXTRA Deck 中 ${canonicalNumber} 合計 ${nextCount} 張，超過每卡最多 ${EXTRA_DECK_MAX_COPIES_PER_CARD} 張限制。`,
      }
    }
    entries.push({ cardNumber: rawEntry.cardNumber, count: rawEntry.count })
  }

  if (totalCards > EXTRA_DECK_MAX_CARDS) {
    return {
      config: undefined,
      error: `EXTRA Deck 最多只能放入 ${EXTRA_DECK_MAX_CARDS} 張，目前為 ${totalCards} 張。`,
    }
  }

  return {
    config: {
      kind: 'bs8-candidate-staging',
      extraDeckEntries: entries,
    },
    error: null,
  }
}

export const exportDeck = (deck: CustomDeck): string => {
  const data: ExportableDeck = {
    name: deck.name,
    entries: deck.entries.map((e) => ({
      cardNumber: e.cardNumber,
      count: e.count,
    })),
    format: deck.format ?? DEFAULT_DECK_FORMAT,
    ...(deck.extraDeckEntries !== undefined
      ? { extraDeckEntries: deck.extraDeckEntries.map((entry) => ({ ...entry })) }
      : {}),
    ...(deck.candidateStaging
      ? {
          candidateStaging: {
            kind: deck.candidateStaging.kind,
            extraDeckEntries: deck.candidateStaging.extraDeckEntries.map(
              (entry) => ({ ...entry }),
            ),
          },
        }
      : {}),
  }
  return JSON.stringify(data, null, 2)
}

export const importDeck = (
  json: string,
  options: ImportDeckOptions = {},
): { deck: CustomDeck | null; error: string | null } => {
  try {
    const parsed: unknown = JSON.parse(json)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { deck: null, error: '無法解析牌組資料' }
    }
    const data = parsed as ExportableDeck

    // Runtime card instances are not a supported JSON recipe.
    if (hasOwn(parsed, 'extraDeck')) {
      return {
        deck: null,
        error: '正式牌組 JSON 請使用 extraDeckEntries 卡號與數量，不支援 extraDeck 實體。',
      }
    }
    if (hasOwn(parsed, 'extraDeckEntries') && !isDeckEntryList(data.extraDeckEntries)) {
      return { deck: null, error: 'EXTRA Deck 卡號或數量格式錯誤。' }
    }
    if (hasOwn(parsed, 'extraDeckEntries') && hasOwn(parsed, 'candidateStaging')) {
      return { deck: null, error: '正式 EXTRA 與候選驗收 EXTRA 不可同時指定。' }
    }

    const candidateStagingResult = parseCandidateStagingDeckConfig(
      data.candidateStaging,
    )
    if (candidateStagingResult.error) {
      return { deck: null, error: candidateStagingResult.error }
    }
    if (candidateStagingResult.config && !options.allowCandidateStaging) {
      return {
        deck: null,
        error: 'BS8 候選驗收 EXTRA Deck 只能在候選驗收牌組編輯器匯入。',
      }
    }

    if (!data.name || typeof data.name !== 'string') {
      return { deck: null, error: '缺少牌組名稱' }
    }

    if (!Array.isArray(data.entries)) {
      return { deck: null, error: '缺少牌組內容' }
    }

    const entries: CustomDeckEntry[] = []
    for (const entry of data.entries) {
      if (!entry || typeof entry !== 'object' || !entry.cardNumber || typeof entry.cardNumber !== 'string') {
        return { deck: null, error: '卡號格式錯誤' }
      }
      if (typeof entry.count !== 'number' || !Number.isSafeInteger(entry.count) || entry.count < 1) {
        return { deck: null, error: `${entry.cardNumber} 數量格式錯誤` }
      }
      const cardNumber = entry.cardNumber
      if (!getCardPoolEntry(cardNumber)) {
        return { deck: null, error: `卡池中找不到 ${entry.cardNumber}` }
      }
      entries.push({ cardNumber, count: entry.count })
    }

    const rawFormat = data.format
    if (rawFormat !== undefined && rawFormat !== 'open' && rawFormat !== 'standard') {
      return { deck: null, error: '牌組賽制只能是 open 或 standard。' }
    }
    const format = options.format ?? rawFormat ?? DEFAULT_DECK_FORMAT
    const validation = validateCustomDeckDefinition({ entries, format, extraDeckEntries: data.extraDeckEntries })
    if (!validation.valid) {
      return { deck: null, error: validation.errors.join('；') }
    }

    const now = new Date().toISOString()
    const deck: CustomDeck = {
      id: `imported-${Date.now()}`,
      name: data.name,
      entries,
      format,
      ...(data.extraDeckEntries !== undefined
        ? { extraDeckEntries: data.extraDeckEntries.map((entry) => ({ ...entry })) }
        : {}),
      ...(candidateStagingResult.config
        ? { candidateStaging: candidateStagingResult.config }
        : {}),
      createdAt: now,
      updatedAt: now,
    }

    return { deck, error: null }
  } catch {
    return { deck: null, error: '無法解析牌組資料' }
  }
}

export const validateCustomDeckDefinition = (
  deck: Pick<CustomDeck, 'entries' | 'format' | 'extraDeckEntries' | 'candidateStaging'>,
): DeckValidationResult & { stats: DeckValidationResult['stats'] & { mainDeckCards: number; extraDeckCards: number } } => {
  const main = validateCustomDeck(deck.entries, { format: deck.format })
  const extra = materializeFormalExtraDeck(deck.extraDeckEntries === undefined ? [] : deck.extraDeckEntries, 'player-one', deck.format ?? DEFAULT_DECK_FORMAT)
  const errors = [...main.errors, ...extra.errors]
  if (deck.candidateStaging !== undefined) errors.push('候選驗收牌組必須使用獨立的候選驗證與開局流程。')
  if (deck.format !== undefined && deck.format !== 'open' && deck.format !== 'standard') errors.push('牌組賽制只能是 open 或 standard。')
  return {
    ...main, isValid: errors.length === 0, valid: errors.length === 0, errors,
    stats: { ...main.stats, mainDeckCards: main.stats.totalCards, extraDeckCards: extra.totalCards },
  }
}

export const createCustomDeckPlayerSetup = (deck: CustomDeck, playerId: PlayerId): PlayerSetup => {
  const validation = validateCustomDeckDefinition(deck)
  if (!validation.isValid) throw new GameRuleError(validation.errors[0] ?? '正式牌組不合法。')
  return {
    id: playerId, name: deck.name, deck: createDeckFromCustomDeck(deck, playerId),
    extraDeck: materializeFormalExtraDeck(deck.extraDeckEntries ?? [], playerId, deck.format ?? DEFAULT_DECK_FORMAT).cards,
  }
}
