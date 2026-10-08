/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { OnlineBattleView } from './OnlineBattleView'
import { createBs12PerfectStageDemoState, type Bs12PerfectStageScenario } from '../../game/demo'
import { applyGameCommand } from '../../game/commands'
import { maskGameStateForViewer } from '../../game/masked-state'
import type { GameState } from '../../game/types'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const playerId = 'player-one' as const
const mount = async (game: GameState, viewerPlayerId: 'player-one' | 'player-two' = playerId) => {
  const sendCommand = vi.fn(), container = document.createElement('div'), root = createRoot(container)
  document.body.append(container)
  await act(() => root.render(<OnlineBattleView game={maskGameStateForViewer(game, viewerPlayerId)} viewerPlayerId={viewerPlayerId} roomCode="TEST"
    sendCommand={sendCommand} sendAttackSelection={vi.fn()} opponentAttackSelection={{ attackerInstanceId: null, supportPaymentIds: [] }}
    openingSnapshot={null} commandRejectedReason={null} sendOpeningAction={vi.fn()} onLeave={vi.fn()} />))
  return { sendCommand, container, button: (label: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === label)!,
    unmount: async () => { await act(() => root.unmount()); container.remove() } }
}
it.each(['positive', 'zero', 'other', 'minimize', 'back', 'cancel', 'invalid-payment', 'split', 'yellow-arena', 'black-non-arena', 'opponent'] as const)('105 actual online Trap response: %s', async scenario => {
  const fixture: Bs12PerfectStageScenario = ['split','yellow-arena','black-non-arena'].includes(scenario) ? scenario as Bs12PerfectStageScenario : 'positive'
  const game = createBs12PerfectStageDemoState(fixture), snapshot = structuredClone(game), ui = await mount(game, scenario === 'opponent' ? 'player-two' : playerId)
  try {
    if (scenario === 'opponent') {
      expect(ui.container.querySelector('.trap-response-modal')).toBeNull()
      expect(ui.sendCommand).not.toHaveBeenCalled()
      return
    }
    const modal = ui.container.querySelector('.trap-response-modal')!
    expect(modal).not.toBeNull()
    const source = modal.querySelector<HTMLButtonElement>('.modal-card-options > button')!
    expect(source.textContent).toContain('Perfect Stage')
    await act(() => source.click())
    expect([...modal.querySelectorAll('img')].map(node => node.src)).toContain('https://cookierunbraverse.com/data/en_storage/-hfHyZuO58hmPQdpYkT7SA.webp')
    const payments = [...modal.querySelectorAll<HTMLButtonElement>('.trap-guided-section .trap-discard-options > button')]
    expect(payments).toHaveLength(2)
    expect(ui.button('下一步').disabled).toBe(true)
    if (scenario === 'invalid-payment') {
      await act(() => payments[0].click())
      await act(() => payments[1].click())
      expect(modal.querySelectorAll('.trap-discard-options > button.is-selected')).toHaveLength(1)
      await act(() => payments[0].click())
      expect(ui.button('下一步').disabled).toBe(true)
      expect(ui.sendCommand).not.toHaveBeenCalled()
      return
    }
    await act(() => payments[0].click())
    await act(() => ui.button('下一步').click())
    if (scenario === 'back') {
      await act(() => ui.button('上一步').click())
      expect(modal.querySelectorAll('.trap-discard-options > button.is-selected')).toHaveLength(1)
      await act(() => ui.button('下一步').click())
    }
    const falseCondition = fixture !== 'positive'
    expect(modal.textContent).toContain('同時是黑色與【Arena】')
    expect(modal.textContent).toContain('本回合攻擊傷害 -2')
    const targets = [...modal.querySelectorAll<HTMLButtonElement>('.trap-effect-target-step .trap-target-options > button')]
    expect(targets).toHaveLength(falseCondition ? 0 : 2)
    if (falseCondition) expect(modal.querySelectorAll('.trap-target-options > button')).toHaveLength(0)
    if (falseCondition) expect(modal.querySelector('.trap-zero-effect-warning')?.textContent).toContain('條件不成立')
    else if (scenario !== 'zero') await act(() => targets[scenario === 'other' ? 1 : 0].click())
    if (scenario === 'minimize') {
      await act(() => ui.button('縮小').click())
      expect(ui.container.querySelector('.trap-response-modal')).toBeNull()
      await act(() => ui.container.querySelector<HTMLButtonElement>('.decision-reveal-dock')!.click())
      expect(ui.container.querySelectorAll('.trap-target-options > button.is-selected')).toHaveLength(1)
    }
    expect(ui.sendCommand).not.toHaveBeenCalled()
    await act(() => ui.button(scenario === 'cancel' ? '不發動' : '確認發動').click())
    if (scenario === 'cancel') expect(ui.sendCommand).toHaveBeenCalledExactlyOnceWith({kind:'skip-trap',playerId})
    else {
      expect(ui.sendCommand).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({kind:'play-trap',playerId,trapInstanceId:'bs12-105-trap',paymentIds:['bs12-105-payment-0'],effectTargets:falseCondition?undefined:[scenario==='zero'?[]:[scenario==='other'?'bs12-105-other':'bs12-105-attacker']]}))
      if (falseCondition) expect(applyGameCommand(game,ui.sendCommand.mock.calls[0][0]).attackModifiers).toEqual([])
    }
    expect(game).toEqual(snapshot)
  } finally { await ui.unmount() }
})
it.each(['positive','split','zero'] as const)('105 actual opponent public feed exposes the truthful result: %s', async scenario => {
  const game = createBs12PerfectStageDemoState(scenario === 'split' ? 'split' : 'positive')
  const fullGame = applyGameCommand(game,{kind:'play-trap',playerId,trapInstanceId:'bs12-105-trap',paymentIds:['bs12-105-payment-0'],targetIds:[],effectTargets:[scenario === 'positive'?['bs12-105-attacker']:[]]}), ui = await mount(fullGame,'player-two')
  try {
    await act(() => ui.container.querySelector<HTMLButtonElement>('.online-activity-toggle')!.click())
    await act(() => ui.container.querySelector<HTMLButtonElement>('.online-activity-history-entry')!.click())
    const panel = ui.container.querySelector('.online-activity-panel')!
    expect(panel.textContent).toContain('Perfect Stage')
    expect(panel.textContent).toContain(scenario === 'positive'?'攻擊傷害 -2':scenario === 'split'?'條件不成立，未套用攻擊傷害修改':'未選擇餅乾，未套用攻擊傷害修改')
    expect(panel.textContent).not.toContain('bs12-105-defender-hp')
    expect(ui.sendCommand).not.toHaveBeenCalled()
  } finally { await ui.unmount() }
})
