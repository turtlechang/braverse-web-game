/** @vitest-environment jsdom */
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {describe,it,expect,vi} from 'vitest'
import {OnlineBattleView} from './OnlineBattleView'
import {fixture} from '../../game/st7-018-demo'
import {maskGameStateForViewer} from '../../game/masked-state'
import {applyGameCommand} from '../../game/commands'
;(globalThis as Record<string,unknown>).IS_REACT_ACT_ENVIRONMENT=true
describe('ST7-018 real masked online UI command construction',()=>{
 it.each(['positive','one-cookie','back','cancel'])('shows fixed recipients and submits or cancels exact YY payment: %s',async scenario=>{
  const game=fixture(scenario==='one-cookie'?'one-cookie':'positive'),sendCommand=vi.fn(),container=document.createElement('div'),root=createRoot(container)
  document.body.append(container)
  const button=(name:string)=>[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===name)!
  try{
   await act(()=>root.render(<OnlineBattleView game={maskGameStateForViewer(game,'player-one')} viewerPlayerId="player-one" roomCode="TEST" sendCommand={sendCommand} sendAttackSelection={vi.fn()} opponentAttackSelection={{attackerInstanceId:null,supportPaymentIds:[]}} openingSnapshot={null} commandRejectedReason={null} sendOpeningAction={vi.fn()} onLeave={vi.fn()}/>))
   const modal=container.querySelector('.trap-response-modal')!
   await act(()=>modal.querySelector<HTMLButtonElement>('.modal-card-options > button')!.click())
   const payments=[...modal.querySelectorAll<HTMLButtonElement>('.trap-guided-section .trap-discard-options > button')]
   expect(payments).toHaveLength(2);expect(button('下一步').disabled).toBe(true)
   await act(()=>payments[0].click());expect(button('下一步').disabled).toBe(true)
   await act(()=>payments[1].click());await act(()=>button('下一步').click())
   const count=game.players['player-one'].battleArea.length
   expect(modal.textContent).toContain(`固定對象（全部 ${count} 張）`)
   expect([...modal.querySelectorAll<HTMLButtonElement>('.trap-target-options > button')].every(b=>b.disabled&&b.classList.contains('is-selected'))).toBe(true)
   expect(modal.querySelectorAll('.trap-target-skip')).toHaveLength(0)
   if(scenario==='back'){await act(()=>button('上一步').click());await act(()=>button('下一步').click());expect(modal.querySelectorAll('.trap-target-options > button.is-selected')).toHaveLength(count)}
   await act(()=>button(scenario==='cancel'?'不發動':'確認發動').click())
   expect(sendCommand).toHaveBeenCalledTimes(1)
   if(scenario==='cancel')expect(sendCommand).toHaveBeenCalledWith({kind:'skip-trap',playerId:'player-one'})
   else{
    const payload=sendCommand.mock.calls[0][0]
    expect(payload).toMatchObject({kind:'play-trap',playerId:'player-one',paymentIds:game.players['player-one'].supportArea.slice(2,4).map(s=>s.card.instanceId),effectTargets:[game.players['player-one'].battleArea.map(c=>c.card.instanceId)]})
    const next=applyGameCommand(game,payload)
    expect(next.players['player-one'].battleArea.map(c=>c.hpCards.length)).toEqual(game.players['player-one'].battleArea.map(c=>c.hpCards.length+1))
   }
  }finally{await act(()=>root.unmount());container.remove()}
 })
})
