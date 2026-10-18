/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { OnlineBattleView } from './OnlineBattleView'
import { createDeckAdditionDemoState } from '../../game/bs12-deck-addition-demo'
import { applyGameCommand } from '../../game/commands'
import { maskGameStateForViewer } from '../../game/masked-state'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it('Little Star 線上付款後可選零，保留對手並完整支付戰鬥區代價',async()=>{
  const playerId='player-one' as const
  const initial=createDeckAdditionDemoState('ST10-013')
  const source=initial.players[playerId].hand[0]
  const material=initial.players[playerId].battleArea[1]
  const paid=applyGameCommand(initial,{kind:'begin-play-item',playerId,instanceId:source.instanceId,
    paymentIds:[initial.players[playerId].supportArea[0].card.instanceId],trashBattleCookieIds:[material.card.instanceId]})
  const snapshot=structuredClone(paid)
  const container=document.createElement('div'),root=createRoot(container),sendCommand=vi.fn()
  document.body.append(container)
  try{
    await act(()=>root.render(<OnlineBattleView game={maskGameStateForViewer(paid,playerId)} viewerPlayerId={playerId} roomCode="TEST"
      sendCommand={sendCommand} sendAttackSelection={vi.fn()} opponentAttackSelection={{attackerInstanceId:null,supportPaymentIds:[]}}
      openingSnapshot={null} commandRejectedReason={null} sendOpeningAction={vi.fn()} onLeave={vi.fn()}/>))
    const panel=container.querySelector('.effect-panel:not(.is-complete)')!
    expect(panel.textContent).toContain('Little Star')
    const confirm=panel.querySelector<HTMLButtonElement>('.effect-panel-primary-action')!
    expect(confirm.disabled).toBe(false)
    await act(()=>confirm.click())
    expect(sendCommand).toHaveBeenCalledExactlyOnceWith({kind:'resolve-ability-effect',playerId,targetIds:[]})
    const result=applyGameCommand(paid,sendCommand.mock.calls[0][0])
    expect(result.players['player-two'].battleArea).toEqual(initial.players['player-two'].battleArea)
    expect(result.players[playerId].discardPile.some(card=>card.instanceId===material.card.instanceId)).toBe(true)
    expect(paid).toEqual(snapshot)
  }finally{await act(()=>root.unmount());container.remove()}
})
