/** @vitest-environment jsdom */
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {expect, it, vi} from 'vitest'
import {DrawUpToResponseModal} from './PendingDecisionModals'
import {createBs12ChessChocoDemoState} from '../../game/demo'
import {applyGameCommand} from '../../game/commands'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it.each([0, 1, 3])('draw count %s survives minimizing without submitting the decision', async count => {
  let game=createBs12ChessChocoDemoState('positive')
  game=applyGameCommand(game,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:'bs12-101-source',targetInstanceId:'bs12-101-opponent',supportPaymentIds:['bs12-101-payment']})
  game=applyGameCommand(game,{kind:'skip-trap',playerId:'player-two'})
  while(game.pendingBattle?.stage==='damage')game=applyGameCommand(game,{kind:'resolve-next-damage',playerId:'player-two'})
  game=applyGameCommand(game,{kind:'resolve-attack-effect',playerId:'player-one',targetIds:[]})
  game=applyGameCommand(game,{kind:'resolve-optional-cost-attack',playerId:'player-one',action:'pay',paymentIds:[],discardCardIds:['bs12-101-cost'],targetIds:[]})
  expect(game.pendingDrawUpTo?.max).toBe(1)
  const sourceCardName=game.pendingDrawUpTo!.sourceCardName!,max=game.pendingDrawUpTo!.max,selected=count<=max?count:0
  const onConfirm = vi.fn(), container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const button = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === label)!
  try {
    await act(() => root.render(<DrawUpToResponseModal sourceCardName={sourceCardName} max={max} deckSize={game.players['player-one'].deck.length} onConfirm={onConfirm} />))
    expect(container.querySelectorAll('.draw-up-to-option')).toHaveLength(2)
    if(count>max){expect(container.querySelectorAll('.draw-up-to-option')[count]).toBeUndefined();expect(onConfirm).not.toHaveBeenCalled()}
    await act(() => container.querySelectorAll<HTMLButtonElement>('.draw-up-to-option')[selected].click())
    await act(() => button('縮小').click())
    expect(container.querySelector('.draw-up-to-modal')).toBeNull()
    expect(onConfirm).not.toHaveBeenCalled()
    await act(() => container.querySelector<HTMLButtonElement>('.decision-reveal-dock')!.click())
    expect(container.querySelectorAll('.draw-up-to-option')[selected].classList.contains('is-selected')).toBe(true)
    expect(onConfirm).not.toHaveBeenCalled()
    await act(() => button(selected === 0 ? '略過抽牌' : `抽取 ${selected} 張牌`).click())
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(selected)
  } finally {
    await act(() => root.unmount())
    container.remove()
  }
})
