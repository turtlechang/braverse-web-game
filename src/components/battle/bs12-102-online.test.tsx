/** @vitest-environment jsdom */
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {expect, it, vi} from 'vitest'
import {OnlineBattleView} from './OnlineBattleView'
import {createBs12CoffeeTruckDemoState} from '../../game/demo'
import {applyGameCommand} from '../../game/commands'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const playerId = 'player-one' as const

it.each(['positive', 'split', 'cancel-energy', 'cancel-cost', 'cancel-target'] as const)('102 actual online Stage payment and intersected trash selector: %s', async scenario => {
  const game = applyGameCommand(createBs12CoffeeTruckDemoState(scenario === 'split' ? 'split' : 'positive'), {
    kind: 'play-stage', playerId, instanceId: 'bs12-102-stage', paymentIds: ['bs12-102-payment-0'],
  })
  const snapshot = structuredClone(game), sendCommand = vi.fn(), container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const button = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === label)!
  try {
    await act(() => root.render(<OnlineBattleView game={game} viewerPlayerId={playerId} roomCode="TEST"
      sendCommand={sendCommand} sendAttackSelection={vi.fn()} opponentAttackSelection={{attackerInstanceId: null, supportPaymentIds: []}}
      openingSnapshot={null} commandRejectedReason={null} sendOpeningAction={vi.fn()} onLeave={vi.fn()} />))
    await act(() => container.querySelector<HTMLButtonElement>('.stage-quick-action')!.click())
    const panel = container.querySelector('.effect-panel')!
    expect(panel.textContent).toContain("Manager Scarlet's Coffee Truck")
    expect(button('下一步').disabled).toBe(true)
    const payment = [...panel.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.includes('Subtle Jasmine Cake Hound'))!
    await act(() => payment.click())
    expect(button('下一步').disabled).toBe(false)
    if (scenario !== 'cancel-energy') {
      await act(() => button('下一步').click())
      expect(panel.textContent).toContain('將效果來源卡橫置')
      if (scenario !== 'cancel-cost') {
        await act(() => button('下一步').click())
        const targets = [...panel.querySelectorAll<HTMLButtonElement>('button')].filter(node => node.textContent?.includes('Blueberry Cake Hound'))
        expect(targets).toHaveLength(scenario === 'split' ? 0 : 1)
        expect(panel.textContent).not.toContain('Chess Choco Cookie')
        expect(panel.textContent).not.toContain('Licorice Cookie')
        if (scenario !== 'split') await act(() => targets[0].click())
      }
    }
    expect(sendCommand).not.toHaveBeenCalled()
    if (scenario.startsWith('cancel')) {
      await act(() => button('取消技能').click())
      expect(sendCommand).not.toHaveBeenCalled()
    } else {
      await act(() => button('確認發動').click())
      expect(sendCommand).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ kind: 'begin-activate-stage', playerId,
        paymentIds: ['bs12-102-payment-1'], targetIds: scenario === 'split' ? [] : ['bs12-102-target'] }))
    }
    expect(game).toEqual(snapshot)
  } finally {
    await act(() => root.unmount())
    container.remove()
  }
})
