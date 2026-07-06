/// @vitest-environment jsdom

import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { createDemoSetupGame, type GameState } from '../game'
import {
  formatDeckSelectionMessage,
  useMatchSetup,
} from './useMatchSetup'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('formatDeckSelectionMessage', () => {
  it('uses the blue and purple deck labels in the opening message', () => {
    expect(formatDeckSelectionMessage('blue', 'purple')).toBe(
      '我方使用藍色牌組，AI 隨機選擇紫色牌組。請猜拳決定先後攻選擇權。',
    )
  })

  it('uses the second set preset label for a chosen AI deck', () => {
    expect(formatDeckSelectionMessage('custom', 'bs2-blue', '測試牌組', true)).toBe(
      '我方使用自訂「測試牌組」牌組，AI 使用指定的第二彈藍色牌組。請猜拳決定先後攻選擇權。',
    )
  })
})

describe('useMatchSetup', () => {
  it('moves to rock-paper-scissors with the selected player and AI decks', async () => {
    const setMessage = vi.fn()
    let captured: ReturnType<typeof useMatchSetup> | null = null

    function TestHarness() {
      const [game, setGame] = useState<GameState>(() =>
        createDemoSetupGame('player-one'),
      )
      captured = useMatchSetup({
        game,
        setGame,
        setMessage,
        enabled: true,
        chooseDeck: () => 'purple',
      })
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))

    expect(captured!.setupStep).toBe('deck-selection')
    await act(() => captured!.handleDeckSelection('blue'))

    expect(captured!.deckConfig).toEqual({ player: 'blue', ai: 'purple' })
    expect(captured!.setupStep).toBe('rps')
    expect(captured!.setupMessage).toBe(
      '我方使用藍色牌組，AI 隨機選擇紫色牌組。請猜拳決定先後攻選擇權。',
    )

    await act(() => root.unmount())
  })

  it('moves to rock-paper-scissors with a selected second set AI preset deck', async () => {
    const setMessage = vi.fn()
    let captured: ReturnType<typeof useMatchSetup> | null = null

    function TestHarness() {
      const [game, setGame] = useState<GameState>(() =>
        createDemoSetupGame('player-one'),
      )
      captured = useMatchSetup({
        game,
        setGame,
        setMessage,
        enabled: true,
      })
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))

    await act(() => captured!.handleDeckSelection('blue', undefined, 'bs2-purple'))

    expect(captured!.deckConfig).toEqual({ player: 'blue', ai: 'bs2-purple' })
    expect(captured!.setupStep).toBe('rps')
    expect(captured!.setupMessage).toBe(
      '我方使用藍色牌組，AI 使用指定的第二彈紫色牌組。請猜拳決定先後攻選擇權。',
    )

    await act(() => root.unmount())
  })
})
