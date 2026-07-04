/// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import {
  CUSTOM_DECK_STORAGE_VERSION,
  deleteCustomDeck,
  duplicateCustomDeck,
  getCustomDeckStorageKey,
  loadCustomDecks,
  parseCustomDeckStorage,
  saveCustomDecks,
  type CustomDeck,
} from './custom-deck'

const createDeck = (id: string, name: string): CustomDeck => ({
  id,
  name,
  entries: [{ cardNumber: 'ST1-001', count: 4 }],
  createdAt: '2026-07-04T00:00:00.000Z',
  updatedAt: '2026-07-04T00:00:00.000Z',
})

describe('custom deck storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips decks through the versioned storage format', () => {
    const decks = [createDeck('deck-a', '紅色速攻'), createDeck('deck-b', '藍色控制')]
    saveCustomDecks(decks)

    const raw = localStorage.getItem(getCustomDeckStorageKey())
    expect(raw).not.toBeNull()
    const stored = JSON.parse(raw!) as { version: number; decks: CustomDeck[] }
    expect(stored.version).toBe(CUSTOM_DECK_STORAGE_VERSION)
    expect(stored.decks).toHaveLength(2)

    expect(loadCustomDecks()).toEqual(decks)
  })

  it('migrates the legacy bare-array format', () => {
    const legacy = [createDeck('legacy-1', '舊牌組')]
    localStorage.setItem(getCustomDeckStorageKey(), JSON.stringify(legacy))

    expect(loadCustomDecks()).toEqual(legacy)
  })

  it('returns an empty list for corrupt JSON without throwing', () => {
    localStorage.setItem(getCustomDeckStorageKey(), '{not-json')

    expect(loadCustomDecks()).toEqual([])
  })

  it('returns an empty list for an unknown storage version', () => {
    localStorage.setItem(
      getCustomDeckStorageKey(),
      JSON.stringify({ version: 999, decks: [createDeck('future', '未來格式')] }),
    )

    expect(loadCustomDecks()).toEqual([])
  })

  it('filters malformed deck records out of stored data', () => {
    const valid = createDeck('ok', '正常牌組')
    const storage = {
      version: CUSTOM_DECK_STORAGE_VERSION,
      decks: [valid, { id: 42 }, null, { name: '沒有 id' }],
    }
    localStorage.setItem(getCustomDeckStorageKey(), JSON.stringify(storage))

    expect(loadCustomDecks()).toEqual([valid])
  })

  it('parseCustomDeckStorage handles both formats directly', () => {
    const deck = createDeck('direct', '直接解析')
    expect(parseCustomDeckStorage(JSON.stringify([deck]))).toEqual([deck])
    expect(
      parseCustomDeckStorage(
        JSON.stringify({ version: CUSTOM_DECK_STORAGE_VERSION, decks: [deck] }),
      ),
    ).toEqual([deck])
    expect(parseCustomDeckStorage(JSON.stringify({ foo: 'bar' }))).toEqual([])
  })

  it('deleteCustomDeck removes the deck and persists the result', () => {
    saveCustomDecks([createDeck('keep', '保留'), createDeck('drop', '刪除')])

    const remaining = deleteCustomDeck('drop')

    expect(remaining.map((deck) => deck.id)).toEqual(['keep'])
    expect(loadCustomDecks().map((deck) => deck.id)).toEqual(['keep'])
  })

  it('duplicateCustomDeck appends a renamed copy with a fresh id', () => {
    const source = createDeck('source', '原始牌組')
    saveCustomDecks([source])

    const { decks, newDeck } = duplicateCustomDeck('source')

    expect(newDeck).not.toBeNull()
    expect(newDeck!.id).not.toBe(source.id)
    expect(newDeck!.name).toBe('原始牌組（複製）')
    expect(newDeck!.entries).toEqual(source.entries)
    expect(newDeck!.entries).not.toBe(source.entries)
    expect(decks).toHaveLength(2)
    expect(loadCustomDecks()).toHaveLength(2)
  })

  it('duplicateCustomDeck returns null for an unknown deck id', () => {
    saveCustomDecks([createDeck('only', '唯一牌組')])

    const { decks, newDeck } = duplicateCustomDeck('missing')

    expect(newDeck).toBeNull()
    expect(decks).toHaveLength(1)
  })
})
