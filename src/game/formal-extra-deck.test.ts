/// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { getAllCardPoolEntries, getCardPoolEntry } from './card-pool'
import {
  createCustomDeckPlayerSetup, duplicateCustomDeck, exportDeck, importDeck,
  loadCustomDecks, parseCustomDeckStorage, saveCustomDecks, validateCustomDeckDefinition,
  type CustomDeck, type CustomDeckEntry,
} from './custom-deck'
import { materializeFormalExtraDeck } from './custom-extra-deck'
import { createDemoSetupGame } from './demo'
import { OFFICIAL_RED_STARTER_DECK } from './starter-deck'
import { validateBs8CandidateStagingDeck } from './bs8-candidate-staging'

const recipe = (extraDeckEntries?: CustomDeckEntry[]): CustomDeck => ({
  id: 'formal-extra', name: '正式 EXTRA', entries: OFFICIAL_RED_STARTER_DECK.map(entry => ({ ...entry })),
  format: 'standard', createdAt: '2026-09-07T00:00:00.000Z', updatedAt: '2026-09-07T00:00:00.000Z',
  ...(extraDeckEntries !== undefined ? { extraDeckEntries } : {}),
})

describe('formal EXTRA recipes', () => {
  beforeEach(() => localStorage.clear())

  it('preserves old JSON and empty EXTRA without changing the 60-card main deck', () => {
    for (const deck of [recipe(), recipe([])]) {
      const imported = importDeck(exportDeck(deck))
      expect(imported.error).toBeNull()
      expect(imported.deck?.extraDeckEntries).toEqual(deck.extraDeckEntries)
      expect(validateCustomDeckDefinition(deck)).toMatchObject({ valid: true, stats: { totalCards: 60, mainDeckCards: 60, extraDeckCards: 0 } })
      expect(createCustomDeckPlayerSetup(deck, 'player-one')).toMatchObject({ deck: expect.any(Array), extraDeck: [] })
    }
  })

  it.each(getAllCardPoolEntries().filter(card => card.type === 'extra').map(card => card.cardNumber))(
    'accepts and preserves the exact formal EXTRA artwork %s', (cardNumber) => {
      const deck = recipe([{ cardNumber, count: 1 }])
      const imported = importDeck(exportDeck(deck))
      expect(imported.error).toBeNull()
      expect(imported.deck?.extraDeckEntries).toEqual(deck.extraDeckEntries)
      const setup = createCustomDeckPlayerSetup(deck, 'player-one')
      expect(setup.deck).toHaveLength(60)
      expect(setup.extraDeck).toHaveLength(1)
      expect(setup.extraDeck?.[0].imageUrl).toBe(getCardPoolEntry(cardNumber)?.imageUrl)
      expect(setup.deck.some(card => card.instanceId === setup.extraDeck?.[0].instanceId)).toBe(false)
    },
  )

  it('keeps six EXTRA cards through storage, duplication, export and normal setup with unique IDs', () => {
    const deck = recipe([
      { cardNumber: 'BS8-005', count: 2 }, { cardNumber: 'BS8-005@1', count: 1 },
      { cardNumber: 'BS8-005', count: 1 }, { cardNumber: 'BS8-027@2', count: 1 },
      { cardNumber: 'BS8-069', count: 1 },
    ])
    saveCustomDecks([deck])
    expect(loadCustomDecks()).toEqual([deck])
    const duplicate = duplicateCustomDeck(deck.id).newDeck!
    expect(duplicate.extraDeckEntries).toEqual(deck.extraDeckEntries)
    expect(duplicate.extraDeckEntries).not.toBe(deck.extraDeckEntries)
    const setup = createCustomDeckPlayerSetup(importDeck(exportDeck(duplicate)).deck!, 'player-one')
    expect(setup.extraDeck).toHaveLength(6)
    expect(new Set([...setup.deck, ...setup.extraDeck!].map(card => card.instanceId)).size).toBe(66)
    const game = createDemoSetupGame('player-one', 'custom', 1, duplicate)
    expect(game.players['player-one'].extraDeck).toEqual(setup.extraDeck)
    expect(game.players['player-two'].extraDeck).toEqual([])
    expect(game.players['player-one'].hand.some(card => card.instanceId.startsWith('formal-extra:'))).toBe(false)
  })

  it.each([
    [{ cardNumber: 'BS8-005', count: 4 }, { cardNumber: 'BS8-027', count: 3 }],
    [{ cardNumber: 'BS8-005', count: 4 }, { cardNumber: 'BS8-005@1', count: 1 }],
    [{ cardNumber: 'BS8-069', count: 1 }, { cardNumber: 'BS8-069@1', count: 1 }],
    [{ cardNumber: 'BS8-001', count: 1 }], [{ cardNumber: 'BS8-999', count: 1 }],
  ])('rejects illegal EXTRA at import, validation and construction: %j', (...entries) => {
    const deck = recipe(entries)
    expect(validateCustomDeckDefinition(deck).valid).toBe(false)
    expect(importDeck(exportDeck(deck)).deck).toBeNull()
    expect(() => createCustomDeckPlayerSetup(deck, 'player-one')).toThrow()
  })

  it.each([null, {}, 'BS8-005', [null], [{ cardNumber: '', count: 1 }],
    [{ cardNumber: 'BS8-005', count: 0 }], [{ cardNumber: 'BS8-005', count: -1 }],
    [{ cardNumber: 'BS8-005', count: 1.5 }], [{ cardNumber: 'BS8-005', count: 1e12 }],
  ].map(value => [value]))('rejects malformed EXTRA without allocating arbitrary counts: %j', (extraDeckEntries) => {
    expect(materializeFormalExtraDeck(extraDeckEntries, 'player-one', 'standard').errors.length).toBeGreaterThan(0)
    expect(importDeck(JSON.stringify({ ...recipe(), extraDeckEntries })).deck).toBeNull()
  })

  it('applies existing Standard restrictions and preserves Open format rules', () => {
    const deck = recipe([{ cardNumber: 'BS8-069', count: 2 }])
    expect(validateCustomDeckDefinition(deck).errors).toContain('標準賽制 BS8-069 最多只能放入 1 張，目前為 2 張。')
    expect(importDeck(exportDeck(deck), { format: 'open' }).error).toBeNull()
    expect(createCustomDeckPlayerSetup({ ...deck, format: 'open' }, 'player-one').extraDeck).toHaveLength(2)
  })

  it('rejects mixed formal and candidate metadata in every entry point', () => {
    const deck = {
      ...recipe([]), candidateStaging: { kind: 'bs8-candidate-staging' as const, extraDeckEntries: [{ cardNumber: 'BS8-005', count: 1 }] },
    }
    expect(validateCustomDeckDefinition(deck).valid).toBe(false)
    expect(validateBs8CandidateStagingDeck(deck).valid).toBe(false)
    expect(importDeck(exportDeck(deck), { allowCandidateStaging: true }).deck).toBeNull()
    expect(parseCustomDeckStorage(JSON.stringify([deck]))).toEqual([])
    expect(() => createCustomDeckPlayerSetup(deck, 'player-one')).toThrow()
  })

  it('gives split main entries and EXTRA cards separate unique identities', () => {
    const deck = recipe([{ cardNumber: 'BS8-005', count: 1 }])
    const first = deck.entries[0]
    deck.entries = [{ ...first, count: 1 }, { ...first, count: first.count - 1 }, ...deck.entries.slice(1)]
    const setup = createCustomDeckPlayerSetup(deck, 'player-one')
    expect(new Set([...setup.deck, ...setup.extraDeck!].map(card => card.instanceId)).size).toBe(61)
  })
})
