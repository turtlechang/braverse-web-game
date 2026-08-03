import { useCallback, useMemo, useState } from 'react'
import type { CustomDeck, CustomDeckEntry } from '../game/custom-deck'
import {
  MAX_COPIES_PER_CARD,
  validateCustomDeck,
} from '../game/custom-deck'
import type { CardPoolEntry } from '../game/card-pool'
import { getAllCardPoolEntries, normalizeCardNumber } from '../game/card-pool'

const CARD_NUMBER_SERIES_PREFIXES: Record<string, string> = {
  BS3: 'BS3-',
  BS4: 'BS4-',
}

export interface DeckEditorState {
  deckEntries: CustomDeckEntry[]
  deckName: string
  searchText: string
  filterColor: string | null
  filterType: string | null
  filterRarity: string | null
  filterSeries: string | null
  filterLevel: number | null
  filterHp: number | null
  filterEffect: string | null
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
  setFilterLevel: (level: number | null) => void
  setFilterHp: (hp: number | null) => void
  setFilterEffect: (effect: string | null) => void
  clearDeck: () => void
  loadDeck: (deck: CustomDeck) => void
}

export interface DeckEditorDerived {
  getFilteredPool: () => CardPoolEntry[]
  getDeckTotalCount: () => number
  getDeckTotalCards: () => number
  deckValidation: ReturnType<typeof validateCustomDeck>
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
  const [filterLevel, setFilterLevel] = useState<number | null>(null)
  const [filterHp, setFilterHp] = useState<number | null>(null)
  const [filterEffect, setFilterEffect] = useState<string | null>(null)

  const addCard = useCallback((cardNumber: string) => {
    const raw = cardNumber
    setDeckEntries((prev) => {
      const base = normalizeCardNumber(raw)
      const totalForBase = prev
        .filter((e) => normalizeCardNumber(e.cardNumber) === base)
        .reduce((sum, e) => sum + e.count, 0)
      if (totalForBase >= MAX_COPIES_PER_CARD) return prev
      const existing = prev.find((e) => e.cardNumber === raw)
      if (existing) {
        return prev.map((e) =>
          e.cardNumber === raw ? { ...e, count: e.count + 1 } : e,
        )
      }
      return [...prev, { cardNumber: raw, count: 1 }]
    })
  }, [])

  const removeCard = useCallback((cardNumber: string) => {
    const raw = cardNumber
    setDeckEntries((prev) => {
      const existing = prev.find((e) => e.cardNumber === raw)
      if (!existing) return prev
      if (existing.count <= 1) {
        return prev.filter((e) => e.cardNumber !== raw)
      }
      return prev.map((e) =>
        e.cardNumber === raw ? { ...e, count: e.count - 1 } : e,
      )
    })
  }, [])

  const setCardCount = useCallback((cardNumber: string, count: number) => {
    const raw = cardNumber
    if (count < 0) return
    setDeckEntries((prev) => {
      const base = normalizeCardNumber(raw)
      const totalForBase = prev
        .filter((e) => normalizeCardNumber(e.cardNumber) === base)
        .reduce((sum, e) => sum + e.count, 0)
      const remainingForBase = Math.max(0, MAX_COPIES_PER_CARD - totalForBase)
      if (count === 0) {
        return prev.filter((e) => e.cardNumber !== raw)
      }
      const clamped = Math.min(count, remainingForBase)
      const existing = prev.find((e) => e.cardNumber === raw)
      if (existing) {
        return prev.map((e) =>
          e.cardNumber === raw ? { ...e, count: clamped } : e,
        )
      }
      return [...prev, { cardNumber: raw, count: clamped }]
    })
  }, [])

  const clearDeck = useCallback(() => {
    setDeckEntries([])
  }, [])

  const loadDeck = useCallback((deck: CustomDeck) => {
    setDeckEntries(deck.entries.map((entry) => ({ ...entry })))
    setDeckName(deck.name)
  }, [])

  const getFilteredPool = useCallback((): CardPoolEntry[] => {
    const all = getAllCardPoolEntries()

    return all.filter((entry) => {
      if (filterColor) {
        const entryColor = entry.color?.toLowerCase()
        const isWild = !entryColor || entryColor === 'wild'
        if (filterColor.toLowerCase() === 'wild') {
          if (!isWild) {
            return false
          }
        } else {
          if (!isWild && entryColor !== filterColor.toLowerCase()) {
            return false
          }
        }
      }
      if (filterType && entry.type !== filterType) {
        return false
      }
      if (filterRarity && entry.rarity !== filterRarity) {
        return false
      }
      if (
        filterSeries &&
        (CARD_NUMBER_SERIES_PREFIXES[filterSeries]
          ? !entry.cardNumber
              .toUpperCase()
              .startsWith(CARD_NUMBER_SERIES_PREFIXES[filterSeries])
          : entry.product?.title?.toLowerCase() !== filterSeries.toLowerCase())
      ) {
        return false
      }
      if (filterLevel !== null && entry.level !== filterLevel) {
        return false
      }
      if (filterHp !== null && entry.hp !== filterHp) {
        return false
      }
      if (filterEffect) {
        const text = entry.skill?.text ?? ''
        const attack = entry.attackText ?? ''
        const matched =
          (filterEffect === 'activate' && text.includes('{mob}')) ||
          (filterEffect === 'blocker' && text.includes('{bl}')) ||
          (filterEffect === 'on-play' && text.includes('{ap}')) ||
          (filterEffect === 'your-turn' && (text.includes('{mt}') || attack.includes('{mt}'))) ||
          (filterEffect === 'once-per-turn' && text.includes('{t1}'))
        if (!matched) return false
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
      return true
    })
  }, [searchText, filterColor, filterType, filterRarity, filterSeries, filterLevel, filterHp, filterEffect])

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
    filterLevel,
    filterHp,
    filterEffect,
    addCard,
    removeCard,
    setCardCount,
    setDeckName,
    setSearchText,
    setFilterColor,
    setFilterType,
    setFilterRarity,
    setFilterSeries,
    setFilterLevel,
    setFilterHp,
    setFilterEffect,
    clearDeck,
    loadDeck,
    getFilteredPool,
    getDeckTotalCount,
    getDeckTotalCards,
    deckValidation,
  }
}
