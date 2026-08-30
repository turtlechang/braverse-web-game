import officialBs8Candidates from '../../data/candidates/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json'
import { convertOfficialCardToExtraDeckCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import {
  createDeckFromCustomDeck,
  validateCustomDeck,
  type CustomDeck,
  type CustomDeckEntry,
} from './custom-deck'
import { GameRuleError } from './errors'
import { validateExtraDeck } from './extra-deck'
import { normalizeCardNumber } from './card-pool'
import type { ExtraDeckCard, PlayerId, PlayerSetup } from './types'

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

const candidateCards = officialBs8Candidates.cards as OfficialCardRecord[]

const candidateExtraRecords = new Map(
  candidateCards
    .filter((card) => card.type === 'extra' && card.variant === null)
    .map((card) => [card.baseCardNumber, card]),
)

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

    for (let copy = 1; copy <= entry.count; copy += 1) {
      const converted = convertOfficialCardToExtraDeckCard(record, `${playerId}:${cardNumber}:${copy}`)
      if (converted.status !== 'converted') {
        errors.push(`${entry.cardNumber} 尚未具備候選 EXTRA runtime 契約。`)
        break
      }
      cards.push({
        ...converted.extraDeckCard,
        instanceId: `candidate-bs8:${playerId}:${cardNumber}:${copy}`,
      })
    }
  }

  return { cards, errors }
}

/**
 * Validates a candidate-only staging deck.  Its main deck still uses the
 * formal pool and its EXTRA cards only come from the candidate JSON through
 * the EXTRA adapter.  No data/cards or generated registry is involved.
 */
export const validateBs8CandidateStagingDeck = (
  deck: Bs8CandidateStagingDeck,
): Bs8CandidateStagingDeckValidation => {
  const main = validateCustomDeck(deck.entries, { format: deck.format })
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
      mainDeckCards: main.stats.totalCards,
      extraDeckCards: deck.candidateStaging.extraDeckEntries.reduce(
        (total, entry) => total + entry.count,
        0,
      ),
    },
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

  return {
    id: playerId,
    name: deck.name,
    deck: createDeckFromCustomDeck(deck, playerId),
    extraDeck,
  }
}
