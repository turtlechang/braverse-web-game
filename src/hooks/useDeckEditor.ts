import { useCallback, useMemo, useState } from 'react'
import type { CustomDeck, CustomDeckEntry } from '../game/custom-deck'
import {
  MAX_COPIES_PER_CARD,
  validateCustomDeck,
} from '../game/custom-deck'
import type { CardPoolEntry } from '../game/card-pool'
import { getAllCardPoolEntries } from '../game/card-pool'

export interface DeckEditorState {
  deckEntries: CustomDeckEntry[]
  deckName: string
  searchText: string
  filterColor: string | null
  filterType: string | null
  filterRarity: string | null
  filterSeries: string | null
}

export interface DeckEditorActions {
  addCard: (cardNumber: string) => void
  removeCard: (cardNumber: string) => void
  setCardCount: (cardNumber: string, count: number) => void
  setDeckName: (name: string) => void
  setSearchText: (text: string) => void
  setFilterColor: (color: string | null) => void
  setFilterType: (type: string | null) => void
  setFilterRarity: (rarity: string | null) => void
  setFilterSeries: (series: string | null) => void
  clearDeck: () => void
  loadDeck: (deck: CustomDeck) => void
}

export interface DeckEditorDerived {
  getFilteredPool: () => CardPoolEntry[]
  getDeckTotalCount: () => number
  getDeckTotalCards: () => number
  deckValidation: { valid: boolean; errors: string[] }
}

export function useDeckEditor(): DeckEditorState &
  DeckEditorActions &
  DeckEditorDerived {
  const [deckEntries, setDeckEntries] = useState<CustomDeckEntry[]>([])
  const [deckName, setDeckName] = useState('我的牌組')
  const [searchText, setSearchText] = useState('')
  const [filterColor, setFilterColor] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string | null>(null)
  const [filterRarity, setFilterRarity] = useState<string | null>(null)
  const [filterSeries, setFilterSeries] = useState<string | null>(null)

  const addCard = useCallback((cardNumber: string) => {
    setDeckEntries((prev) => {
      const existing = prev.find((e) => e.cardNumber === cardNumber)
      if (existing) {
        if (existing.count >= MAX_COPIES_PER_CARD) return prev
        return prev.map((e) =>
          e.cardNumber === cardNumber ? { ...e, count: e.count + 1 } : e,
        )
      }
      return [...prev, { cardNumber, count: 1 }]
    })
  }, [])

  const removeCard = useCallback((cardNumber: string) => {
    setDeckEntries((prev) => {
      const existing = prev.find((e) => e.cardNumber === cardNumber)
      if (!existing) return prev
      if (existing.count <= 1) {
        return prev.filter((e) => e.cardNumber !== cardNumber)
      }
      return prev.map((e) =>
        e.cardNumber === cardNumber ? { ...e, count: e.count - 1 } : e,
      )
    })
  }, [])

  const setCardCount = useCallback((cardNumber: string, count: number) => {
    if (count < 0) return
    setDeckEntries((prev) => {
      if (count === 0) {
        return prev.filter((e) => e.cardNumber !== cardNumber)
      }
      const clamped = Math.min(count, MAX_COPIES_PER_CARD)
      const existing = prev.find((e) => e.cardNumber === cardNumber)
      if (existing) {
        return prev.map((e) =>
          e.cardNumber === cardNumber ? { ...e, count: clamped } : e,
        )
      }
      return [...prev, { cardNumber, count: clamped }]
    })
  }, [])

  const clearDeck = useCallback(() => {
    setDeckEntries([])
  }, [])

  const loadDeck = useCallback((deck: CustomDeck) => {
    setDeckEntries(deck.entries)
    setDeckName(deck.name)
  }, [])

  const getFilteredPool = useCallback((): CardPoolEntry[] => {
    const all = getAllCardPoolEntries()
    const entryMap = new Map(deckEntries.map((e) => [e.cardNumber, e.count]))

    return all.filter((entry) => {
      if (filterColor && entry.color?.toLowerCase() !== filterColor.toLowerCase()) {
        return false
      }
      if (filterType && entry.type !== filterType) {
        return false
      }
      if (filterRarity && entry.rarity !== filterRarity) {
        return false
      }
      if (
        filterSeries &&
        entry.product?.title?.toLowerCase() !== filterSeries.toLowerCase()
      ) {
        return false
      }
      if (searchText) {
        const lower = searchText.toLowerCase()
        if (
          !entry.name.toLowerCase().includes(lower) &&
          !entry.cardNumber.toLowerCase().includes(lower)
        ) {
          return false
        }
      }
      const currentCount = entryMap.get(entry.cardNumber) ?? 0
      if (currentCount >= MAX_COPIES_PER_CARD) {
        return false
      }
      return true
    })
  }, [deckEntries, searchText, filterColor, filterType, filterRarity, filterSeries])

  const getDeckTotalCount = useCallback((): number => {
    return deckEntries.reduce((sum, e) => sum + e.count, 0)
  }, [deckEntries])

  const getDeckTotalCards = useCallback((): number => {
    return deckEntries.length
  }, [deckEntries])

  const deckValidation = useMemo(
    () => validateCustomDeck(deckEntries),
    [deckEntries],
  )

  return {
    deckEntries,
    deckName,
    searchText,
    filterColor,
    filterType,
    filterRarity,
    filterSeries,
    addCard,
    removeCard,
    setCardCount,
    setDeckName,
    setSearchText,
    setFilterColor,
    setFilterType,
    setFilterRarity,
    setFilterSeries,
    clearDeck,
    loadDeck,
    getFilteredPool,
    getDeckTotalCount,
    getDeckTotalCards,
    deckValidation,
  }
}
