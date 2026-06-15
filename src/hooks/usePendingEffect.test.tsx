/// @vitest-environment jsdom

import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it } from 'vitest'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
import { createItemUsageDemoState } from '../game/demo'
import { usePendingEffect } from './usePendingEffect'
import type { GameCard, GameState } from '../game'

describe('usePendingEffect support-to-trash toggleEffectTarget', () => {
  it('selects and deselects a support-to-trash candidate via toggleEffectTarget', async () => {
    const baseGame = createItemUsageDemoState(true)
    const supportArea = baseGame.players['player-one'].supportArea
    const supportId = supportArea[0].card.instanceId

    const itemCard: GameCard = {
      id: 'test-support-trash-item',
      instanceId: 'test-support-trash-item-1',
      name: '測試支援丟棄物品',
      type: 'item',
      item: {
        cost: { green: 2 },
        text: '測試',
        effects: [{ kind: 'support-to-trash', amount: 1 }],
      },
    }

    const state: GameState = {
      ...baseGame,
      players: {
        ...baseGame.players,
        'player-one': {
          ...baseGame.players['player-one'],
          hand: [itemCard, ...baseGame.players['player-one'].hand],
        },
      },
    }

    let captured: ReturnType<typeof usePendingEffect> | null = null

    function TestHarness() {
      const pending = usePendingEffect({
        game: state,
        setGame: () => {},
        viewerPlayerId: 'player-one',
        setMessage: () => {},
        clearAttacker: () => {},
        setInspectedHpPile: () => {},
        hasFaint: false,
        faintTargetIds: new Set(),
        selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 0 },
        setSelectedFaintTargetIds: () => {},
      })
      captured = pending
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))

    expect(captured).not.toBeNull()
    expect(captured!.pendingEffect).toBeNull()

    await act(() => {
      captured!.beginCardAbility(
        itemCard,
        {
          cost: { green: 2 },
          text: '測試',
          effects: [{ kind: 'support-to-trash', amount: 1 }],
        },
        'item',
        '使用物品',
      )
    })

    expect(captured!.pendingEffect).not.toBeNull()
    expect(captured!.currentEffect?.kind).toBe('support-to-trash')
    expect(captured!.supportEffectTargetIds.has(supportId)).toBe(true)
    expect(captured!.pendingEffect?.selectedTargetIds).toHaveLength(0)

    await act(() => {
      captured!.toggleEffectTarget(supportId)
    })

    expect(captured!.pendingEffect?.selectedTargetIds).toContain(supportId)

    await act(() => {
      captured!.toggleEffectTarget(supportId)
    })

    expect(captured!.pendingEffect?.selectedTargetIds).not.toContain(supportId)

    root.unmount()
  })
})
