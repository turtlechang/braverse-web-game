/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { OnlineBattleView } from './OnlineBattleView'
import { createBs12RecipeDemoState } from '../../game/demo'
import { applyGameCommand } from '../../game/commands'
import { maskGameStateForViewer } from '../../game/masked-state'
import type { GameState } from '../../game/types'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const playerId = 'player-one' as const
const open = (state = createBs12RecipeDemoState()) => applyGameCommand(applyGameCommand(state, { kind: 'begin-play-item', playerId, instanceId: 'bs12-104-item', paymentIds: ['bs12-104-payment-0'] }), { kind: 'resolve-ability-effect', playerId, targetIds: [] })
const mount = async (game: GameState, viewerPlayerId: 'player-one' | 'player-two' = playerId) => {
  const sendCommand = vi.fn(), container = document.createElement('div'), root = createRoot(container)
  document.body.append(container)
  await act(() => root.render(<OnlineBattleView game={maskGameStateForViewer(game, viewerPlayerId)} viewerPlayerId={viewerPlayerId} roomCode="TEST"
    sendCommand={sendCommand} sendAttackSelection={vi.fn()} opponentAttackSelection={{ attackerInstanceId: null, supportPaymentIds: [] }}
    openingSnapshot={null} commandRejectedReason={null} sendOpeningAction={vi.fn()} onLeave={vi.fn()} />))
  return { sendCommand, container, button: (label: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === label)!,
    unmount: async () => { await act(() => root.unmount()); container.remove() } }
}
it.each(['zero', 'one', 'minimize', 'opponent'] as const)('104 actual online optional draw selection: %s', async scenario => {
  const game = open(), snapshot = structuredClone(game), ui = await mount(game, scenario === 'opponent' ? 'player-two' : playerId)
  try {
    if (scenario === 'opponent') {
      expect(ui.container.querySelector('.draw-up-to-modal')).toBeNull()
      expect(ui.sendCommand).not.toHaveBeenCalled()
    } else {
      const modal = ui.container.querySelector('.draw-up-to-modal')!
      expect(modal.textContent).toContain('Recipe For Acting Success')
      expect(modal.textContent).toContain('Special Play')
      const options = [...modal.querySelectorAll<HTMLButtonElement>('.draw-up-to-option')]
      expect(options).toHaveLength(2)
      const one = scenario !== 'zero'
      if (one) await act(() => options[1].click())
      if (scenario === 'minimize') {
        await act(() => ui.button('縮小').click())
        expect(ui.container.querySelector('.draw-up-to-modal')).toBeNull()
        await act(() => ui.container.querySelector<HTMLButtonElement>('.decision-reveal-dock')!.click())
        expect(ui.container.querySelector('.draw-up-to-option.is-selected')?.textContent).toContain('抽 1 張')
      }
      expect(ui.sendCommand).not.toHaveBeenCalled()
      await act(() => ui.button(one ? '抽取 1 張牌' : '略過抽牌').click())
      expect(ui.sendCommand).toHaveBeenCalledExactlyOnceWith({ kind: 'resolve-draw-up-to', playerId, drawCount: one ? 1 : 0 })
    }
    expect(game).toEqual(snapshot)
  } finally { await ui.unmount() }
})
it.each(['positive', 'non-arena', 'two-targets', 'arena-only', 'minimize', 'refresh'] as const)('104 actual online Special Play target selection: %s', async scenario => {
  const drawn = applyGameCommand(open(createBs12RecipeDemoState(scenario === 'minimize' ? 'positive' : scenario === 'refresh' ? 'one-card' : scenario)), { kind: 'resolve-draw-up-to', playerId, drawCount: scenario === 'refresh' ? 1 : 0 })
  const game = scenario === 'refresh' ? applyGameCommand(drawn, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-104-refresh' }, { shuffle: cards => [...cards] }) : drawn
  const snapshot = structuredClone(game), ui = await mount(game)
  try {
    const panel = ui.container.querySelector('.effect-panel:not(.is-complete)')!
    expect(panel.textContent).toContain('Recipe For Acting Success')
    expect(panel.textContent).toContain('戰鬥區具有 Special Play 的餅乾')
    expect([...panel.querySelectorAll('img')].map(node => node.src)).toContain('https://cookierunbraverse.com/data/en_storage/pdBfvOQpbT87nFqFVK3fsQ.webp')
    const targets = [...panel.querySelectorAll<HTMLButtonElement>('button')].filter(node => /玩家・戰鬥區第/.test(node.textContent ?? ''))
    expect(targets).toHaveLength(scenario === 'arena-only' ? 0 : scenario === 'two-targets' ? 2 : 1)
    if (targets.length) await act(() => targets[0].click())
    if (scenario === 'minimize') {
      await act(() => ui.button('縮小').click())
      await act(() => ui.container.querySelector<HTMLButtonElement>('.effect-panel-dock')!.click())
      expect(ui.container.querySelector('.effect-panel')?.textContent).toContain('已選 1／1')
    }
    expect(ui.sendCommand).not.toHaveBeenCalled()
    await act(() => ui.button('確認發動').click())
    expect(ui.sendCommand).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ kind: 'resolve-ability-effect', playerId, targetIds: scenario === 'arena-only' ? [] : ['bs12-104-target'] }))
    expect(game).toEqual(snapshot)
  } finally { await ui.unmount() }
})
it('104 actual opponent public log shows only draw count and never the drawn hand card or its image', async () => {
  const fullGame = applyGameCommand(open(), { kind: 'resolve-draw-up-to', playerId, drawCount: 1 }), ui = await mount(fullGame, 'player-two')
  try {
    await act(() => ui.container.querySelector<HTMLButtonElement>('.online-activity-toggle')!.click())
    const history = ui.container.querySelector<HTMLButtonElement>('.online-activity-history-entry')!
    expect(history).toBeDefined()
    await act(() => history.click())
    const panel = ui.container.querySelector('.online-activity-panel')!
    expect(panel.textContent).toContain('抽牌結果：抽了 1 張牌')
    expect(panel.textContent).not.toContain('Sweet Jams Guitar')
    expect([...panel.querySelectorAll('img')].map(node => node.src)).not.toContain(fullGame.players[playerId].hand[0].imageUrl)
    expect(ui.sendCommand).not.toHaveBeenCalled()
  } finally { await ui.unmount() }
})
