/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createBs12BlueberryDemoState } from '../../game/demo'
import { OnlineBattleView } from './OnlineBattleView'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it.each(['special-two-candidates', 'special-wrong-color'] as const)('095 online view uses the same legal Special Play candidates and sends only confirmed cost ids: %s', async scenario => {
  const game = createBs12BlueberryDemoState(scenario), snapshot = structuredClone(game)
  const sendCommand = vi.fn(), container = document.createElement('div'), root = createRoot(container)
  document.body.appendChild(container)
  const button = (text: string, parent: Element = container) => [...parent.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.trim() === text)!
  try {
    await act(() => root.render(<OnlineBattleView game={game} viewerPlayerId="player-one" roomCode="TEST"
      sendCommand={sendCommand} sendAttackSelection={vi.fn()} opponentAttackSelection={{ attackerInstanceId: null, supportPaymentIds: [] }}
      openingSnapshot={null} commandRejectedReason={null} sendOpeningAction={vi.fn()} onLeave={vi.fn()} />))
    const hand = container.querySelector<HTMLButtonElement>('.battle-row[data-animation-player="player-one"] .hand-card-wrap button.card-face')!
    await act(() => hand.click())
    if (scenario === 'special-wrong-color') {
      expect(button('特殊登場')).toBeUndefined()
      expect(button('登場')).toBeDefined()
    } else {
      await act(() => button('特殊登場').click())
      const modal = container.querySelector('.special-play-modal')!
      expect(modal.querySelector('.special-play-source > div > p')?.textContent).toBe('【Special Play】 Place 1 {K} LV.1 Cookie from your battle area into your trash.')
      const candidates = [...modal.querySelectorAll<HTMLButtonElement>('.special-play-candidate')]
      expect(candidates).toHaveLength(2)
      expect(button('確認特殊登場', modal).disabled).toBe(true)
      await act(() => candidates[0].click())
      await act(() => candidates[1].click())
      expect(candidates.map(c => c.getAttribute('aria-pressed'))).toEqual(['true', 'false'])
      await act(() => button('取消', modal).click())
      expect(sendCommand).not.toHaveBeenCalled()
      await act(() => hand.click())
      await act(() => button('特殊登場').click())
      const reopened = container.querySelector('.special-play-modal')!
      expect(button('確認特殊登場', reopened).disabled).toBe(true)
      await act(() => reopened.querySelectorAll<HTMLButtonElement>('.special-play-candidate')[1].click())
      await act(() => button('確認特殊登場', reopened).click())
      expect(sendCommand).toHaveBeenCalledExactlyOnceWith({ kind: 'deploy-cookie', playerId: 'player-one', instanceId: 'bs12-095-source', specialPlayCookieInstanceIds: ['bs12-095-other-cost'] })
      expect(container.textContent).toContain('特殊登場已支付，接續登場結算。')
      expect(container.querySelector('.special-play-modal')).toBeNull()
    }
    expect(game).toEqual(snapshot)
  } finally { await act(() => root.unmount()); container.remove() }
})
