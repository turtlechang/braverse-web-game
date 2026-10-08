/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createBs12TrapDemoState } from '../game/demo'
import cards from '../../data/cards/official-festival-arena-bs12.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { useMatchController } from './useMatchController'
import { useOnlineMatchController } from './useOnlineMatchController'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const printedFixtureCard = (number: string, instanceId: string) => {
  const result = convertOfficialCardToGameCard(cards.cards.find(c => c.cardNumber === number) as OfficialCardRecord)
  if (result.status !== 'converted') throw new Error(`Missing ${number}`)
  return { ...result.gameCard, instanceId }
}

it.each(['local', 'online'] as const)('%s clears position costs when returning to the trap list or switching traps', async mode => {
  vi.useFakeTimers()
  const base = createBs12TrapDemoState()
  const game = { ...base, players: { ...base.players, 'player-one': { ...base.players['player-one'], hand: [
    ...base.players['player-one'].hand,
    printedFixtureCard('BS12-010', 'other-trap'),
    printedFixtureCard('BS12-009', 'second-position-trap'),
  ] } } }
  let current: ReturnType<typeof useOnlineMatchController> | ReturnType<typeof useMatchController> | undefined
  function LocalHarness() { current = useMatchController({ testStateConfig: { kind: 'bs12-009', scenario: 'positive' } }); return null }
  function OnlineHarness() { current = useOnlineMatchController({ game, viewerPlayerId: 'player-one', sendCommand: vi.fn() }); return null }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(mode === 'local' ? <LocalHarness /> : <OnlineHarness />))
    if (current && 'setGame' in current) await act(() => { if (current && 'setGame' in current) current.setGame(game) })
    for (const nextTrapId of [null, 'other-trap', 'second-position-trap']) {
      await act(() => current!.setSelectedTrapId('bs12-009-trap'))
      await act(() => current!.setSelectedTrapPositionCostIds(['bs12-009-defender', 'bs12-009-ally']))
      expect(current!.selectedTrapPositionCostIds).toHaveLength(2)
      await act(() => current!.setSelectedTrapId(nextTrapId))
      expect(current!.selectedTrapPositionCostIds).toEqual([])
    }
  } finally { await act(() => root.unmount()); vi.useRealTimers() }
})
