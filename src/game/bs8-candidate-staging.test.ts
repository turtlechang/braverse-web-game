import { describe, expect, it } from 'vitest'
import { OFFICIAL_RED_STARTER_DECK } from './starter-deck'
import { createDemoSetupGame } from './demo'
import {
  BS8_CANDIDATE_STAGING_KIND,
  createBs8CandidateStagingPlayerSetup,
  isBs8CandidateStagingDeck,
  validateBs8CandidateStagingDeck,
  type Bs8CandidateStagingDeck,
} from './bs8-candidate-staging'

const candidateDeck = (
  extraDeckEntries: Bs8CandidateStagingDeck['candidateStaging']['extraDeckEntries'],
): Bs8CandidateStagingDeck => ({
  id: 'bs8-candidate-staging',
  name: 'BS8 候選驗收',
  entries: OFFICIAL_RED_STARTER_DECK,
  createdAt: '2026-08-30T00:00:00.000Z',
  updatedAt: '2026-08-30T00:00:00.000Z',
  candidateStaging: {
    kind: BS8_CANDIDATE_STAGING_KIND,
    extraDeckEntries,
  },
})

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
})
