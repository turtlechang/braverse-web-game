/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { applyGameCommand } from '../game/commands'
import { createBs12BlackLemonadeDemoState } from '../game/demo'
import { getOptionalCostAttackPrompt } from '../components/modals/optionalCostAttackPrompt'
import { OptionalCostAttackModal } from '../components/modals/PendingDecisionModals'
import { useMatchController } from './useMatchController'
import { useOnlineMatchController } from './useOnlineMatchController'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it.each(['BS12-092', 'BS12-092@1'] as const)('%s keeps the outside-main entry counterexample in its original phase', async number => {
  vi.useFakeTimers()
  let match: ReturnType<typeof useMatchController> | undefined
  function Harness() {
    match = useMatchController({ testStateConfig: { kind: 'bs12-092', cardNumber: number, scenario: 'outside-main' } })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    expect(match!.game.phase).toBe('support')
    const before = structuredClone(match!.game.players)
    await act(() => vi.advanceTimersByTime(2500))
    expect(match!.game.phase).toBe('support')
    expect(match!.game.players).toEqual(before)
  } finally { await act(() => root.unmount()); vi.useRealTimers() }
})

it.each(['BS12-092', 'BS12-092@1'] as const)('%s shows a mandatory battle cost and keeps zero/deselect/back invalid', async number => {
  const pending = applyGameCommand(createBs12BlackLemonadeDemoState(number, 'extra-full'), { kind: 'play-extra-deck-cookie', playerId: 'player-one', instanceId: 'bs12-092-source' })
  const prompt = getOptionalCostAttackPrompt(pending, 'player-one')!
  const onPay = vi.fn()
  const container = document.createElement('div')
  const root = createRoot(container)
  const button = (name: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === name)!
  try {
    await act(() => root.render(<OptionalCostAttackModal {...prompt} onSkip={vi.fn()} onPay={onPay} />))
    expect(container.textContent).toContain('EXTRA 登場代價（必須支付）')
    expect(button('略過')).toBeUndefined()
    await act(() => button('支付代價').click())
    expect(container.textContent).toContain('戰鬥區代價')
    expect(button('確認').disabled).toBe(true)
    const cost = container.querySelector<HTMLButtonElement>('.modal-card-options > button')!
    expect(cost.textContent).toContain('Gnome Band')
    await act(() => cost.click())
    expect(button('確認').disabled).toBe(false)
    await act(() => cost.click())
    expect(button('確認').disabled).toBe(true)
    await act(() => { cost.click(); button('返回').click() })
    await act(() => button('支付代價').click())
    expect(button('確認').disabled).toBe(true)
    await act(() => container.querySelector<HTMLButtonElement>('.modal-card-options > button')!.click())
    await act(() => button('確認').click())
    expect(onPay.mock.calls[0][0]).toEqual([])
    expect(onPay.mock.calls[0][1]).toEqual(['bs12-092-cost'])
  } finally { await act(() => root.unmount()) }
})

it.each(['BS12-092', 'BS12-092@1'] as const)('%s keeps a living faint listener in local/online controllers and switches only local opponent discard ownership', async number => {
  vi.useFakeTimers()
  const before = createBs12BlackLemonadeDemoState(number, 'friendly-faint')
  const fainted = applyGameCommand(applyGameCommand(before, { kind: 'skip-trap', playerId: 'player-one' }), { kind: 'resolve-next-damage', playerId: 'player-one' })
  const discarding = applyGameCommand(fainted, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [] })
  let local: ReturnType<typeof useMatchController> | undefined
  let online: ReturnType<typeof useOnlineMatchController> | undefined
  let current = fainted
  function Harness() {
    local = useMatchController({ testStateConfig: { kind: 'bs12-092', cardNumber: number, scenario: 'friendly-faint' } })
    online = useOnlineMatchController({ game: current, viewerPlayerId: 'player-one', sendCommand: vi.fn() })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    await act(() => local!.setGame(fainted))
    for (const controller of [local!, online!]) {
      expect(controller.hasFaint).toBe(true)
      expect(controller.faintSourceCard?.instanceId).toBe('bs12-092-source')
      expect(controller.faintCardCandidates).toEqual([])
      expect(controller.faintCostHandAmount).toBe(0)
    }
    current = discarding
    await act(() => { local!.setGame(discarding); root.render(<Harness />) })
    expect(local!.viewerPlayerId).toBe('player-two')
    expect(online!.viewerPlayerId).toBe('player-one')
    expect(local!.game.players['player-two'].hand).toHaveLength(3)
    await act(() => vi.advanceTimersByTime(2000))
    expect(local!.game.pendingOpponentHandDiscard?.playerId).toBe('player-two')
    expect(local!.game.players['player-two'].hand).toHaveLength(3)
  } finally { await act(() => root.unmount()); vi.useRealTimers() }
})
