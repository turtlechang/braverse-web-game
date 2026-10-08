/** @vitest-environment jsdom */
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {expect, it, vi} from 'vitest'
import {OnlineBattleView} from './OnlineBattleView'
import {createBs12ChessChocoDemoState} from '../../game/demo'
import {applyGameCommand} from '../../game/commands'
import type {GameState} from '../../game/types'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const playerId = 'player-one' as const
const damage = (input: GameState) => {
  let state = input
  for (let i = 0; state.pendingBattle?.stage === 'damage' && !state.pendingReplacement && i < 12; i++) state = applyGameCommand(state, {kind: 'resolve-next-damage', playerId: state.pendingBattle.damagePlayerId ?? state.pendingBattle.defenderPlayerId})
  return state
}
const open = (scenario: 'mixed-hand' | 'source-faints' | 'split') => {
  let game = damage(applyGameCommand(applyGameCommand(createBs12ChessChocoDemoState(scenario), {kind: 'declare-attack', playerId,
    attackerInstanceId: 'bs12-101-source', targetInstanceId: 'bs12-101-opponent', supportPaymentIds: ['bs12-101-payment']}), {kind: 'skip-trap', playerId: 'player-two'}))
  if (scenario === 'source-faints') game = damage(applyGameCommand(game, {kind: 'resolve-flip', playerId: 'player-two', activate: true, targetIds: ['bs12-101-source']}))
  if (game.pendingReplacement) game = applyGameCommand(game, {kind: 'skip-replacement', playerId})
  return applyGameCommand(damage(game), {kind: 'resolve-attack-effect', playerId, targetIds: []})
}

it.each(['mixed-hand', 'source-faints', 'split'] as const)('101 actual online view renders the correct source and sends only legal hand cost: %s', async scenario => {
  const game = open(scenario), snapshot = structuredClone(game), sendCommand = vi.fn()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const button = (element: Element, label: string) => [...element.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === label)!
  try {
    await act(() => root.render(<OnlineBattleView game={game} viewerPlayerId={playerId} roomCode="TEST"
      sendCommand={sendCommand} sendAttackSelection={vi.fn()} opponentAttackSelection={{attackerInstanceId: null, supportPaymentIds: []}}
      openingSnapshot={null} commandRejectedReason={null} sendOpeningAction={vi.fn()} onLeave={vi.fn()} />))
    const panel = container.querySelector('.optional-cost-attack-inline')!
    expect(panel).not.toBeNull()
    expect(container.querySelector('.effect-source-card img')?.getAttribute('src')).toBe('https://cookierunbraverse.com/data/en_storage/IkY8l2B-wbOFc3gdIXuH_A.webp')
    expect(container.querySelector('.effect-panel')?.textContent).toContain('Chess Choco Cookie')
    expect(panel.textContent).toContain('棄置 1 張【Arena】餅乾手牌')
    expect(container.querySelector('.effect-panel')?.textContent).not.toContain('Unknown')
    expect(sendCommand).not.toHaveBeenCalled()
    const payButton = button(panel, '支付')
    if (scenario === 'split') {
      expect(payButton.disabled).toBe(true)
      await act(() => button(panel, '略過').click())
      expect(sendCommand).toHaveBeenCalledExactlyOnceWith({kind: 'resolve-optional-cost-attack', playerId, action: 'skip'})
    } else {
      await act(() => payButton.click())
      const choices = [...panel.querySelectorAll<HTMLButtonElement>('.modal-card-options > button')]
      expect(choices).toHaveLength(1)
      expect(choices[0].textContent).toContain('Blueberry Cake Hound')
      expect(button(panel, '確認').disabled).toBe(true)
      await act(() => choices[0].click())
      expect(button(panel, '確認').disabled).toBe(false)
      expect(sendCommand).not.toHaveBeenCalled()
      await act(() => button(panel, '確認').click())
      expect(sendCommand).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({kind: 'resolve-optional-cost-attack', playerId,
        action: 'pay', discardCardIds: ['bs12-101-cost'], paymentIds: [], targetIds: []}))
    }
    expect(game).toEqual(snapshot)
  } finally {
    await act(() => root.unmount())
    container.remove()
  }
})

it('101 actual online draw preserves one-card selection while minimized and submits it only on confirmation', async () => {
  const game = applyGameCommand(open('mixed-hand'), {kind: 'resolve-optional-cost-attack', playerId, action: 'pay', discardCardIds: ['bs12-101-cost']})
  expect(game.pendingDrawUpTo).not.toBeNull()
  const snapshot = structuredClone(game), sendCommand = vi.fn(), container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const button = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === label)!
  try {
    await act(() => root.render(<OnlineBattleView game={game} viewerPlayerId={playerId} roomCode="TEST"
      sendCommand={sendCommand} sendAttackSelection={vi.fn()} opponentAttackSelection={{attackerInstanceId: null, supportPaymentIds: []}}
      openingSnapshot={null} commandRejectedReason={null} sendOpeningAction={vi.fn()} onLeave={vi.fn()} />))
    await act(() => container.querySelectorAll<HTMLButtonElement>('.draw-up-to-option')[1].click())
    await act(() => button('縮小').click())
    expect(sendCommand).not.toHaveBeenCalled()
    await act(() => container.querySelector<HTMLButtonElement>('.decision-reveal-dock')!.click())
    expect(container.querySelectorAll('.draw-up-to-option')[1].classList.contains('is-selected')).toBe(true)
    expect(sendCommand).not.toHaveBeenCalled()
    await act(() => button('抽取 1 張牌').click())
    expect(sendCommand).toHaveBeenCalledExactlyOnceWith({kind: 'resolve-draw-up-to', playerId, drawCount: 1})
    expect(game).toEqual(snapshot)
  } finally {
    await act(() => root.unmount())
    container.remove()
  }
})
