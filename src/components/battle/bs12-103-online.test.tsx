/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { OnlineBattleView } from './OnlineBattleView'
import { createBs12SunglassesDemoState } from '../../game/demo'
import { applyGameCommand } from '../../game/commands'
import { maskGameStateForViewer } from '../../game/masked-state'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const playerId = 'player-one' as const
it.each(['positive', 'zero', 'mixed', 'split', 'return', 'minimize', 'opponent'] as const)('103 actual online private peek and public reveal selection: %s', async scenario => {
  const before = createBs12SunglassesDemoState(scenario === 'split' || scenario === 'mixed' ? scenario : 'positive')
  const paid = applyGameCommand(before, { kind: 'begin-play-item', playerId, instanceId: 'bs12-103-item', paymentIds: ['bs12-103-payment-0'] })
  const fullGame = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: [] })
  const viewerPlayerId = scenario === 'opponent' ? 'player-two' as const : playerId
  const game = maskGameStateForViewer(fullGame, viewerPlayerId), snapshot = structuredClone(game)
  const sendCommand = vi.fn(), container = document.createElement('div'), root = createRoot(container)
  document.body.append(container)
  const button = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === label)!
  try {
    await act(() => root.render(<OnlineBattleView game={game} viewerPlayerId={viewerPlayerId} roomCode="TEST"
      sendCommand={sendCommand} sendAttackSelection={vi.fn()} opponentAttackSelection={{ attackerInstanceId: null, supportPaymentIds: [] }}
      openingSnapshot={null} commandRejectedReason={null} sendOpeningAction={vi.fn()} onLeave={vi.fn()} />))
    if (scenario === 'opponent') {
      expect(container.querySelector('.inspect-deck-modal')).toBeNull()
      expect(container.textContent).not.toContain('Butter Roll Cookie')
      expect(sendCommand).not.toHaveBeenCalled()
    } else {
      const modal = container.querySelector('.inspect-deck-modal')!
      expect(modal.textContent).toContain("Veteran Director's Sunglasses")
      expect(modal.textContent).toContain('所選卡將公開展示後加入手牌')
      expect(modal.textContent).toContain('其餘放入棄牌區')
      const choices = [...modal.querySelectorAll<HTMLButtonElement>('.inspect-deck-grid > button')]
      expect(choices).toHaveLength(4)
      expect(choices.map(node => node.disabled)).toEqual(scenario === 'split' ? [true, true, true, true] : scenario === 'mixed' ? [false, true, true, false] : [false, false, false, false])
      const zero = scenario === 'zero' || scenario === 'split' || scenario === 'return'
      if (scenario !== 'zero' && scenario !== 'split') {
        await act(() => choices[0].click())
        expect(choices[0].classList.contains('is-selected')).toBe(true)
        expect(choices[3].disabled).toBe(true)
        if (scenario === 'return') {
          await act(() => button('返回').click())
          expect(choices[0].classList.contains('is-selected')).toBe(false)
        }
        if (scenario === 'minimize') {
          await act(() => button('縮小').click())
          expect(container.querySelector('.inspect-deck-modal')).toBeNull()
          expect(container.querySelector('.decision-reveal-dock')?.textContent).toContain('已選 1 張')
          await act(() => container.querySelector<HTMLButtonElement>('.decision-reveal-dock')!.click())
          expect(container.querySelector('.inspect-deck-grid > button.is-selected')?.getAttribute('aria-label')).toBe('選擇Butter Roll Cookie')
        }
      }
      expect(sendCommand).not.toHaveBeenCalled()
      await act(() => button('確認並結算').click())
      expect(sendCommand).toHaveBeenCalledExactlyOnceWith({ kind: 'resolve-inspect-deck', playerId,
        pickedCardIds: zero ? [] : ['bs12-103-peek-0'], restOrder: zero ? ['bs12-103-peek-0', 'bs12-103-peek-1', 'bs12-103-peek-2', 'bs12-103-peek-3'] : ['bs12-103-peek-1', 'bs12-103-peek-2', 'bs12-103-peek-3'], restDestination: undefined })
    }
    expect(game).toEqual(snapshot)
  } finally { await act(() => root.unmount()); container.remove() }
})
it.each([true, false])('103 opponent sees the settled public reveal/trash log while the remaining hand stays hidden: picked=%s', async picked => {
  const initial = createBs12SunglassesDemoState()
  const paid = applyGameCommand(initial, { kind: 'begin-play-item', playerId, instanceId: 'bs12-103-item', paymentIds: ['bs12-103-payment-0'] })
  const peek = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: [] })
  const fullGame = applyGameCommand(peek, { kind: 'resolve-inspect-deck', playerId, pickedCardIds: picked ? ['bs12-103-peek-0'] : [],
    restOrder: picked ? ['bs12-103-peek-1', 'bs12-103-peek-2', 'bs12-103-peek-3'] : ['bs12-103-peek-0', 'bs12-103-peek-1', 'bs12-103-peek-2', 'bs12-103-peek-3'] })
  const game = maskGameStateForViewer(fullGame, 'player-two'), sendCommand = vi.fn(), container = document.createElement('div'), root = createRoot(container)
  document.body.append(container)
  try {
    await act(() => root.render(<OnlineBattleView game={game} viewerPlayerId="player-two" roomCode="TEST"
      sendCommand={sendCommand} sendAttackSelection={vi.fn()} opponentAttackSelection={{ attackerInstanceId: null, supportPaymentIds: [] }}
      openingSnapshot={null} commandRejectedReason={null} sendOpeningAction={vi.fn()} onLeave={vi.fn()} />))
    expect(container.querySelector('.inspect-deck-modal')).toBeNull()
    expect(game.players[playerId].hand.some(card => card.instanceId === 'bs12-103-peek-0')).toBe(false)
    await act(() => container.querySelector<HTMLButtonElement>('.online-activity-toggle')!.click())
    await act(() => container.querySelector<HTMLButtonElement>('.online-activity-history-entry')!.click())
    const sidebar = container.querySelector('.online-activity-panel')!
    expect(sidebar.textContent).toContain(picked ? '展示並加入手牌：「Butter Roll Cookie」' : '選擇 0 張，沒有牌加入手牌')
    expect(sidebar.textContent).toContain('未選卡進棄牌區')
    expect(sidebar.textContent).not.toContain('bs12-103-own-deck-0')
    expect(sendCommand).not.toHaveBeenCalled()
  } finally { await act(() => root.unmount()); container.remove() }
})
