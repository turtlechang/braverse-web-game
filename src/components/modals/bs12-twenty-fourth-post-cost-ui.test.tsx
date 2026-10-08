// @vitest-environment jsdom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {expect,it,vi} from 'vitest'
import {createBs12TailPhysicalDemoState as createFuturePhysical} from '../../game/demo'
import {printed,assertIdentity} from '../../game/bs12-tail-physical-test-helpers'
import {applyGameCommand} from '../../game/commands'
import {getOptionalCostAttackPrompt} from './optionalCostAttackPrompt'
import {OptionalCostAttackModal} from './PendingDecisionModals'
;(globalThis as Record<string,unknown>).IS_REACT_ACT_ENVIRONMENT=true
for(const number of ['BS12-107','BS12-107@1'] as const)for(const choice of ['recover','zero','change-cost'])it(number+' '+choice+' selects only actual post-payment recovery targets',async()=>{
 let state=createFuturePhysical(number,'new-cost-target')
 state={...state,players:{...state.players,'player-one':{...state.players['player-one'],hand:[...state.players['player-one'].hand,printed('BS12-012','future-other-cost')]}}}
 assertIdentity(state)
 state=applyGameCommand(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:'future-source',targetInstanceId:'future-enemy',supportPaymentIds:['future-payment-0','future-payment-1']})
 state=applyGameCommand(state,{kind:'skip-trap',playerId:'player-two'})
 while(state.pendingBattle?.stage==='damage')state=applyGameCommand(state,{kind:'resolve-next-damage',playerId:'player-two'})
 state=applyGameCommand(state,{kind:'resolve-attack-effect',playerId:'player-one',targetIds:[]})
 const before=structuredClone(state),prompt=getOptionalCostAttackPrompt(state,'player-one')!
 expect(state).toEqual(before)
 expect(prompt.targetCandidates).toEqual([{card:state.players['player-one'].hand[0],instanceId:'future-hand-cost',requiresDiscardId:'future-hand-cost'}])
 expect(prompt.targetLabel).toBe('己方棄牌區餅乾')
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),onPay=vi.fn(),onSkip=vi.fn()
 const button=(text:string)=>{const b=[...host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===text);expect(b,text+' button').toBeDefined();return b!}
 const cardButton=(name:string)=>{const b=[...host.querySelectorAll<HTMLButtonElement>('.modal-card-options > button')].find(b=>b.textContent?.includes(name));expect(b,name+' printed option').toBeDefined();return b!}
 try{
  await act(()=>root.render(<OptionalCostAttackModal {...prompt} onPay={onPay} onSkip={onSkip}/>))
  await act(()=>button('支付').click());expect(button('下一步').disabled).toBe(true)
  await act(()=>cardButton('Blueberry Cake Hound').click());expect(button('下一步').disabled).toBe(false)
  await act(()=>button('下一步').click());expect(host.textContent).toContain('己方棄牌區餅乾')
  expect(host.querySelectorAll('.modal-card-options > button')).toHaveLength(1)
  if(choice!=='zero')await act(()=>cardButton('Blueberry Cake Hound').click())
  if(choice==='change-cost'){
   await act(()=>button('上一步').click());await act(()=>cardButton('Blueberry Cake Hound').click());await act(()=>cardButton('Sweet Jams Guitar').click())
   await act(()=>button('下一步').click());expect(host.querySelectorAll('.modal-card-options > button')).toHaveLength(0)
   expect(host.textContent).toContain('已選 0')
  }
  expect(button('確認').disabled).toBe(false);await act(()=>button('確認').click())
  expect(onPay).toHaveBeenCalledOnce();expect(onSkip).not.toHaveBeenCalled()
  const [discardIds,targetIds,paymentIds]=onPay.mock.calls[0]
  expect(discardIds).toEqual([choice==='change-cost'?'future-other-cost':'future-hand-cost'])
  expect(targetIds).toEqual(choice==='recover'?['future-hand-cost']:[]);expect(paymentIds).toEqual([])
  const after=applyGameCommand(state,{kind:'resolve-optional-cost-attack',playerId:'player-one',action:'pay',discardCardIds:discardIds,targetIds,paymentIds})
  assertIdentity(after);expect(state).toEqual(before)
  expect(after.players['player-one'].hand.map(c=>c.instanceId)).toEqual(choice==='recover'?['future-other-cost','future-hand-cost']:choice==='zero'?['future-other-cost']:['future-hand-cost'])
 }finally{await act(()=>root.unmount());host.remove()}
})
