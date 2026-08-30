import { describe, expect, it } from 'vitest'
import { getCardPoolEntry } from './card-pool'
import { exportDeck, validateCustomDeck } from './custom-deck'
import { OFFICIAL_RED_STARTER_DECK } from './starter-deck'
import { createDemoSetupGame } from './demo'
import {
  BS8_CANDIDATE_STAGING_KIND,
  createBs8CandidateStagingPlayerSetup,
  getBs8CandidateMainDeckCardBlocker,
  getBs8CandidateMainDeckCardDefinition,
  getBs8CandidateMainDeckCardDefinitions,
  importBs8CandidateStagingDeck,
  isBs8CandidateStagingDeck,
  validateBs8CandidateStagingDeck,
  type Bs8CandidateStagingDeck,
} from './bs8-candidate-staging'

const candidateDeck = (
  extraDeckEntries: Bs8CandidateStagingDeck['candidateStaging']['extraDeckEntries'],
  entries = OFFICIAL_RED_STARTER_DECK,
): Bs8CandidateStagingDeck => ({
  id: 'bs8-candidate-staging',
  name: 'BS8 候選驗收',
  entries,
  createdAt: '2026-08-30T00:00:00.000Z',
  updatedAt: '2026-08-30T00:00:00.000Z',
  candidateStaging: {
    kind: BS8_CANDIDATE_STAGING_KIND,
    extraDeckEntries,
  },
})

const withCandidateMainCard = (cardNumber: string) =>
  OFFICIAL_RED_STARTER_DECK.map((entry, index) =>
    index === 0 ? { cardNumber, count: entry.count } : entry,
  )

describe('BS8 candidate staging deck', () => {
  it('only recognizes an explicitly tagged candidate staging deck', () => {
    expect(isBs8CandidateStagingDeck({
      id: 'standard',
      name: '正式牌組',
      entries: OFFICIAL_RED_STARTER_DECK,
      createdAt: '2026-08-30T00:00:00.000Z',
      updatedAt: '2026-08-30T00:00:00.000Z',
    })).toBe(false)

    expect(isBs8CandidateStagingDeck(candidateDeck([]))).toBe(true)
  })

  it('accepts an independently limited six-card candidate EXTRA deck and materializes it only for setup', () => {
    const deck = candidateDeck([
      { cardNumber: 'BS8-005', count: 4 },
      { cardNumber: 'BS8-027', count: 2 },
    ])

    expect(validateBs8CandidateStagingDeck(deck)).toMatchObject({
      isValid: true,
      stats: { extraDeckCards: 6 },
    })

    const setup = createBs8CandidateStagingPlayerSetup(deck, 'player-one')
    const extraDeck = setup.extraDeck ?? []
    expect(setup.deck).toHaveLength(60)
    expect(extraDeck).toHaveLength(6)
    expect(extraDeck.map((card) => card.id)).toEqual([
      'BS8-005', 'BS8-005', 'BS8-005', 'BS8-005', 'BS8-027', 'BS8-027',
    ])
    expect(extraDeck.every((card) => card.instanceId.startsWith('candidate-bs8:player-one:'))).toBe(true)
  })

  it('exposes only inventory, strict-verified BS8 main cards through the isolated staging pool', () => {
    const definitions = getBs8CandidateMainDeckCardDefinitions()

    expect(definitions).toContainEqual(expect.objectContaining({ cardNumber: 'BS8-002' }))
    expect(definitions).toContainEqual(expect.objectContaining({ cardNumber: 'BS8-043' }))
    expect(definitions).not.toContainEqual(expect.objectContaining({ cardNumber: 'BS8-005' }))
    expect(getBs8CandidateMainDeckCardDefinition('BS8-002')).toMatchObject({
      cardNumber: 'BS8-002',
      poolId: 'BS8-002',
    })
    expect(getBs8CandidateMainDeckCardBlocker('BS8-043')).toBeUndefined()
  })

  it('allows strict-verified BS8 main cards only on the explicit candidate setup path', () => {
    const entries = withCandidateMainCard('BS8-002')
    const deck = candidateDeck([], entries)

    expect(validateCustomDeck(entries).errors).toContain('BS8-002 不在可用卡池中')
    expect(getCardPoolEntry('BS8-002')).toBeUndefined()
    expect(validateBs8CandidateStagingDeck(deck)).toMatchObject({
      isValid: true,
      stats: { mainDeckCards: 60, cookieCards: expect.any(Number) },
    })

    const setup = createBs8CandidateStagingPlayerSetup(deck, 'player-one')
    expect(setup.deck).toHaveLength(60)
    expect(setup.deck.find((card) => card.id === 'BS8-002')).toMatchObject({
      id: 'BS8-002',
      instanceId: expect.stringContaining('BS8-002:player-one:candidate:'),
    })
  })

  it('accepts BS8-043 because the source occupies one of the two battle slots and leaves one unique LV.3 target slot', () => {
    const deck = candidateDeck([], withCandidateMainCard('BS8-043'))

    expect(validateBs8CandidateStagingDeck(deck)).toMatchObject({
      isValid: true,
      stats: { mainDeckCards: 60, cookieCards: expect.any(Number) },
    })
  })

  it('rejects candidate EXTRA entries that exceed six cards or are not converted candidate EXTRA cards', () => {
    expect(validateBs8CandidateStagingDeck(candidateDeck([
      { cardNumber: 'BS8-005', count: 4 },
      { cardNumber: 'BS8-027', count: 3 },
    ]))).toMatchObject({
      isValid: false,
      errors: [expect.stringContaining('最多只能放入 6 張')],
    })

    expect(validateBs8CandidateStagingDeck(candidateDeck([
      { cardNumber: 'BS8-002', count: 1 },
    ]))).toMatchObject({
      isValid: false,
      errors: [expect.stringContaining('不是可用的 BS8 候選 EXTRA')],
    })
  })

  it('keeps a tagged candidate deck on the explicit local staging setup path instead of silently dropping its EXTRA cards', () => {
    const state = createDemoSetupGame(
      'player-one',
      { player: 'custom', ai: 'red' },
      7,
      candidateDeck([{ cardNumber: 'BS8-005', count: 1 }]),
    )

    expect(state.players['player-one'].extraDeck).toMatchObject([
      { id: 'BS8-005', instanceId: 'candidate-bs8:player-one:BS8-005:1' },
    ])
    expect(state.players['player-two'].extraDeck).toEqual([])
  })

  it('round-trips BS8 main and ordered six-card EXTRA payloads only through the candidate importer', () => {
    const deck = candidateDeck([
      { cardNumber: 'BS8-005', count: 2 },
      { cardNumber: 'BS8-027', count: 1 },
      { cardNumber: 'BS8-005', count: 2 },
      { cardNumber: 'BS8-069', count: 1 },
    ], withCandidateMainCard('BS8-002'))

    const result = importBs8CandidateStagingDeck(exportDeck(deck))

    expect(result.error).toBeNull()
    expect(result.deck?.entries).toEqual(
      deck.entries.map(({ cardNumber, count }) => ({ cardNumber, count })),
    )
    expect(result.deck?.candidateStaging.extraDeckEntries).toEqual(
      deck.candidateStaging.extraDeckEntries,
    )
    expect(result.deck?.candidateStaging.extraDeckEntries.reduce(
      (sum, entry) => sum + entry.count,
      0,
    )).toBe(6)
  })
})
