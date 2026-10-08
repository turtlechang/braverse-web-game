import {assertIdentity} from './bs12-tail-physical-test-helpers'
import {expect,it} from 'vitest'
import {createBs12TailPhysicalDemoState as createFuturePhysical,BS12_TAIL_PHYSICAL_SCENARIOS as SCENARIOS,createCardCheckDemoState,createCardNegativeDemoState,parseTestStateConfig} from './demo'
import {applyGameCommand} from './commands'
import type {GameState} from './types'
for(const number of ['BS12-106','BS12-107','BS12-107@1','BS12-108','BS12-108@1'] as const){
 const scenes=SCENARIOS[number.split('@')[0] as keyof typeof SCENARIOS]
 for(const scenario of scenes)it(number+' '+scenario+' uses only original printed cards in every zone',()=>{
  const s=createFuturePhysical(number,scenario);assertIdentity(s)
  for(const p of Object.values(s.players)){expect(p.battleArea.length).toBeLessThanOrEqual(2);for(const c of p.battleArea)expect(c.hpCards).toHaveLength(c.card.hp)}
  if(number==='BS12-106')expect(s.commandLog?.map(e=>e.commandKind)).toEqual(['declare-attack'])
 })
}
const openThen=(number:'BS12-106'|'BS12-107'|'BS12-107@1',scenario='positive')=>{
 let s=createFuturePhysical(number,scenario)
 if(number==='BS12-106'){
  s=applyGameCommand(s,{kind:'play-trap',playerId:'player-one',trapInstanceId:'future-trap',paymentIds:['future-payment-0','future-payment-1'],targetIds:['future-attacker'],effectTargets:[['future-attacker'],[]]})
  return applyGameCommand(s,{kind:'resolve-ability-effect',playerId:'player-one',targetIds:[]})
 }
 s=applyGameCommand(s,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:'future-source',targetInstanceId:'future-enemy',supportPaymentIds:['future-payment-0','future-payment-1']})
 s=applyGameCommand(s,{kind:'skip-trap',playerId:'player-two'})
 while(s.pendingBattle?.stage==='damage')s=applyGameCommand(s,{kind:'resolve-next-damage',playerId:'player-two'})
 return applyGameCommand(s,{kind:'resolve-attack-effect',playerId:'player-one',targetIds:[]})
}
const payThen=(s:GameState)=>applyGameCommand(s,{kind:'resolve-optional-cost-attack',playerId:'player-one',action:'pay',paymentIds:[],discardCardIds:['future-hand-cost'],targetIds:[]})
for(const number of ['BS12-106','BS12-107','BS12-107@1'] as const){
 it(number+' keeps primary settlement separate from optional anyHand cost',()=>{
  const s=openThen(number);assertIdentity(s)
  expect(s.players['player-one'].hand.map(c=>c.instanceId)).toEqual(['future-hand-cost'])
  expect(s.players['player-one'].supportArea.map(c=>c.rested)).toEqual([true,true])
  if(number==='BS12-106'){expect(s.attackModifiers?.at(-1)).toMatchObject({targetInstanceId:'future-attacker',amount:-2});expect(s.players['player-one'].discardPile.map(c=>c.instanceId)).toEqual(['future-recovery','future-trap']);expect(s.players['player-one'].battleArea[0].hpCards).toHaveLength(2)}
  else expect(s.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
  const paid=payThen(s);assertIdentity(paid)
  expect(paid.players['player-one'].hand).toHaveLength(0)
  expect(paid.players['player-one'].discardPile.at(-1)?.instanceId).toBe('future-hand-cost')
  if(number==='BS12-106'){
   const recovered=applyGameCommand(paid,{kind:'resolve-ability-effect',playerId:'player-one',targetIds:['future-recovery']});assertIdentity(recovered)
   expect(recovered.players['player-one'].hand.map(c=>c.instanceId)).toEqual(['future-recovery'])
   expect(recovered.pendingBattle?.remainingDamage).toBe(2)
  }
 })
}
for(const number of ['BS12-107','BS12-107@1'] as const)it(number+' paid attack Then returns the chosen real Arena Cookie',()=>{
 const before=openThen(number)
 const after=applyGameCommand(before,{kind:'resolve-optional-cost-attack',playerId:'player-one',action:'pay',paymentIds:[],discardCardIds:['future-hand-cost'],targetIds:['future-recovery']})
 assertIdentity(after);expect(after.players['player-one'].hand.map(c=>c.instanceId)).toEqual(['future-recovery'])
})
for(const number of ['BS12-107','BS12-107@1','BS12-108','BS12-108@1'] as const)it(number+' ordinary deployment supplies full printed two HP and preserves unspent support',()=>{
 const before=createFuturePhysical(number,'deploy'),s=applyGameCommand(before,{kind:'deploy-cookie',playerId:'player-one',instanceId:'future-source'})
 assertIdentity(s);expect(s.players['player-one'].battleArea.find(c=>c.card.instanceId==='future-source')?.hpCards).toHaveLength(2)
 expect(s.players['player-one'].supportArea).toEqual(before.players['player-one'].supportArea)
})
for(const number of ['BS12-108','BS12-108@1'] as const){
 it(number+' deals printed K1 ordinary one damage using a real black support',()=>{
  let s=createFuturePhysical(number,'attack')
  s=applyGameCommand(s,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:'future-source',targetInstanceId:'future-enemy',supportPaymentIds:['future-payment-0']})
  s=applyGameCommand(s,{kind:'skip-trap',playerId:'player-two'})
  while(s.pendingBattle?.stage==='damage')s=applyGameCommand(s,{kind:'resolve-next-damage',playerId:'player-two'})
  assertIdentity(s);expect(s.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
 })
 it(number+' rejects a real blue support for printed K1',()=>{
  const s=createFuturePhysical(number,'attack-wrong-energy'),before=structuredClone(s)
  expect(()=>applyGameCommand(s,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:'future-source',targetInstanceId:'future-enemy',supportPaymentIds:['future-payment-0']})).toThrow();expect(s).toEqual(before)
 })
}
for(const number of ['BS12-106','BS12-107','BS12-107@1'] as const){
 for(const scenario of ['positive','cookie-cost','stage-cost','trap-cost','new-cost-target'])it(number+' '+scenario+' pays one real hand card before recovering one legal real Cookie',()=>{
  const before=openThen(number,scenario),id=scenario==='new-cost-target'?'future-hand-cost':'future-recovery'
  const pay={kind:'resolve-optional-cost-attack' as const,playerId:'player-one' as const,action:'pay' as const,paymentIds:[],discardCardIds:['future-hand-cost'],targetIds:number==='BS12-106'?[]:[id]}
  let s=applyGameCommand(before,pay)
  if(number==='BS12-106')s=applyGameCommand(s,{kind:'resolve-ability-effect',playerId:'player-one',targetIds:[id]})
  assertIdentity(s);expect(s.players['player-one'].hand.map(c=>c.instanceId)).toEqual([id])
  expect(s.players['player-one'].discardPile.some(c=>c.instanceId==='future-hand-cost')).toBe(scenario!=='new-cost-target')
 })
 for(const scenario of ['arena-item','non-arena-special',...(number==='BS12-106'?['no-special']:[])])it(number+' '+scenario+' rejects an actual printed card that fails recovery restrictions',()=>{
  const before=openThen(number,scenario),unchanged=structuredClone(before)
  if(number==='BS12-106'){
   const paid=payThen(before),snapshot=structuredClone(paid)
   expect(()=>applyGameCommand(paid,{kind:'resolve-ability-effect',playerId:'player-one',targetIds:['future-recovery']})).toThrow();expect(paid).toEqual(snapshot)
  }else{
   expect(()=>applyGameCommand(before,{kind:'resolve-optional-cost-attack',playerId:'player-one',action:'pay',paymentIds:[],discardCardIds:['future-hand-cost'],targetIds:['future-recovery']})).toThrow();expect(before).toEqual(unchanged)
  }
 })
 it(number+' skips optional Then without paying a hand card or recovering',()=>{
  const before=openThen(number),s=applyGameCommand(before,{kind:'resolve-optional-cost-attack',playerId:'player-one',action:'skip'})
  assertIdentity(s);expect(s.players).toEqual(before.players)
 })
 it(number+' rejects two selections of the same real hand card as an exact-one cost',()=>{
  const before=openThen(number),unchanged=structuredClone(before)
  expect(()=>applyGameCommand(before,{kind:'resolve-optional-cost-attack',playerId:'player-one',action:'pay',paymentIds:[],discardCardIds:['future-hand-cost','future-hand-cost'],targetIds:[]})).toThrow();expect(before).toEqual(unchanged)
 })
}
for(const number of ['BS12-108','BS12-108@1'] as const)for(const scenario of ['positive','hand-five','hand-six','single','black-non-arena','blue-arena','hand-only','support-only','trash-only','break-only','opponent-only','rested-other','rested-source','opponent-turn']){
 it(number+' '+scenario+' resolves the actual free Activate without synthetic condition flags',()=>{
  const before=createFuturePhysical(number,scenario)
  const begin={kind:'begin-activate-skill' as const,playerId:'player-one' as const,sourceInstanceId:'future-source',trigger:'activate' as const,paymentIds:[],discardHandIds:[],targetIds:[]}
  const met=['positive','hand-five','rested-other','rested-source'].includes(scenario)
  if(!met){const unchanged=structuredClone(before);expect(()=>applyGameCommand(before,begin)).toThrow();expect(before).toEqual(unchanged);return}
  const s=applyGameCommand(before,begin);assertIdentity(s)
  if(met){
   const after=applyGameCommand(s,{kind:'resolve-draw-up-to',playerId:'player-one',drawCount:1});assertIdentity(after)
   expect(after.players['player-one'].hand.length).toBe(before.players['player-one'].hand.length+1)
   expect(after.players['player-one'].battleArea.map(c=>c.rested)).toEqual(before.players['player-one'].battleArea.map(c=>c.rested))
   expect(()=>applyGameCommand(after,begin)).toThrow()
  }
 })
}

for(const number of ['BS12-106','BS12-107','BS12-107@1','BS12-108','BS12-108@1'] as const)for(const negative of [false,true])it(number+' generic '+(negative?'negative':'positive')+' mounts only real effect-specific printed cards',()=>{
 const scene=negative?number.startsWith('BS12-108')?'hand-six':number==='BS12-106'?'no-energy':'wrong-energy':'positive'
 expect(parseTestStateConfig('?test-state='+(negative?'card-negative:':'card:')+number,'localhost')).toEqual({kind:'bs12-tail',cardNumber:number,scenario:scene})
 const state=negative?createCardNegativeDemoState(number):createCardCheckDemoState(number);assertIdentity(state)
 expect(state.players).toEqual(createFuturePhysical(number,scene).players)
})
