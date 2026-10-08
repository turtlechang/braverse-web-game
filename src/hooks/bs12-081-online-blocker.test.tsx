// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { BattleResponseModals } from '../components/battle/BattleResponseModals'
import { applyGameCommand, type GameCommand } from '../game'
import { createBs12PuddingDemoState } from '../game/demo'
import { useOnlineMatchController } from './useOnlineMatchController'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it('online Blocker UI sends selected hand cost and clears drafts before a second attack in the same turn', async () => {
  vi.useFakeTimers()
  let game = createBs12PuddingDemoState('twice')
  const sendCommand = vi.fn<(command: GameCommand) => void>()
  let current: ReturnType<typeof useOnlineMatchController> | undefined
  function Harness() {
    current = useOnlineMatchController({ game, viewerPlayerId: 'player-one', sendCommand })
    return <BattleResponseModals match={current} />
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const button = (label: string) => {
    const found = [...container.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === label)
    if (!found) throw new Error(`Missing button ${label}`)
    return found
  }
  const chooseBlocker = async () => act(() => button('Pudding Cookie').click())
  const chooseCost = async (index: number) => act(() => {
    const cost = container.querySelectorAll<HTMLButtonElement>('.blocker-hand-candidates > button')[index]
    if (!cost) throw new Error('Missing legal Blocker cost')
    cost.click()
  })
  try {
    await act(() => root.render(<Harness />))
    await chooseBlocker()
    expect(button('使用 Blocker').disabled).toBe(true)
    await chooseCost(0)
    expect(current!.selectedBlockerDiscardIds).toEqual(['bs12-081-cost'])
    await act(() => button('返回').click())
    expect(sendCommand).not.toHaveBeenCalled()
    expect(current!.selectedBlockerDiscardIds).toEqual([])
    expect(game.players['player-one'].hand).toHaveLength(2)
    await chooseBlocker()
    expect(button('使用 Blocker').disabled).toBe(true)
    await chooseCost(0)
    await act(() => button('使用 Blocker').click())
    const first: GameCommand = { kind: 'play-blocker', playerId: 'player-one', sourceInstanceId: 'bs12-081-source', paymentIds: [], discardHandIds: ['bs12-081-cost'] }
    expect(sendCommand).toHaveBeenCalledExactlyOnceWith(first)
    expect(current!.selectedBlockerId).toBeNull()
    expect(current!.selectedBlockerDiscardIds).toEqual([])
    // Apply the serialized command as the authoritative peer would; only public
    // commands prepare the following attack. Preserve the mounted UI instance.
    game = applyGameCommand(game, JSON.parse(JSON.stringify(first)))
    while (game.pendingBattle?.stage === 'damage') game = applyGameCommand(game, { kind: 'resolve-next-damage', playerId: 'player-one' })
    game = applyGameCommand(game, { kind: 'declare-attack', playerId: 'player-two', attackerInstanceId: 'bs12-081-attacker-two', targetInstanceId: 'bs12-081-ally', supportPaymentIds: ['bs12-081-attacker-payment-1'] })
    await act(() => root.render(<Harness />))
    await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
    expect(current!.animations.isPlaying).toBe(false)
    await chooseBlocker()
    expect(button('使用 Blocker').disabled).toBe(true)
    expect(current!.selectedBlockerDiscardIds).toEqual([])
    expect(container.querySelectorAll('.blocker-hand-candidates > button')).toHaveLength(1)
    await chooseCost(0)
    await act(() => button('使用 Blocker').click())
    const second: GameCommand = { kind: 'play-blocker', playerId: 'player-one', sourceInstanceId: 'bs12-081-source', paymentIds: [], discardHandIds: ['bs12-081-cost-two'] }
    expect(sendCommand.mock.calls.map(([command]) => command)).toEqual([first, second])
    game = applyGameCommand(game, JSON.parse(JSON.stringify(second)))
    expect(game.players['player-one'].hand).toEqual([])
    expect(game.pendingBattle?.targetInstanceId).toBe('bs12-081-source')
    expect(game.players['player-one'].battleArea[0].rested).toBe(false)
  } finally {
    await act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  }
})
