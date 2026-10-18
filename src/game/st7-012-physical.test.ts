import {describe,it,expect} from 'vitest'
import {createSt7012PreviewState as fixture} from './st7-012-demo'
import {applyGameCommand as apply} from './commands'
import {getBlockerCandidates} from './battle'

const blockers=['positive','rested-source','wrong-color','rested-energy','no-energy','already-target','wrong-zone']
const attacks=['attack-yellow','attack-red','attack-green','attack-blue','attack-purple','attack-black','attack-insufficient','attack-wrong-color','attack-rested-source','attack-rested-energy','attack-wrong-phase','attack-faint']
const block=(scenario='positive')=>{
 const state=fixture(scenario)
 return apply(state,{kind:'play-blocker',playerId:'player-one',sourceInstanceId:'player-one-ST7-012-1',paymentIds:[state.players['player-one'].supportArea[0].card.instanceId]})
}
describe('ST7-012 original Churro physical rules',()=>{
 it.each([...blockers,...attacks,'second-attack'])('%s preserves sixty unique originals and original HP',scenario=>{
  const state=fixture(scenario,true)
  for(const player of Object.values(state.players)){
   const cards=[...player.deck,...player.hand,...player.discardPile,...player.breakArea,...player.supportArea.map(s=>s.card),...player.battleArea.flatMap(c=>[c.card,...c.hpCards])]
   expect(cards).toHaveLength(60);expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60)
   const counts=new Map<string,number>();for(const card of cards){counts.set(card.id,(counts.get(card.id)??0)+1);expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)}
   expect([...counts.values()].every(count=>count<=4)).toBe(true);expect(player.battleArea.length).toBeLessThanOrEqual(2)
   for(const source of player.battleArea)expect(source.hpCards).toHaveLength(source.card.hp)
  }
 })
 it.each(['positive','rested-source'])('pays only Y and redirects actual damage to original Churro (%s)',scenario=>{
  const initial=fixture(scenario),before=structuredClone(initial),redirected=block(scenario)
  expect(initial).toEqual(before);expect(redirected.pendingBattle?.targetInstanceId).toBe('player-one-ST7-012-1')
  expect(redirected.players['player-one'].supportArea.map(s=>s.rested)).toEqual([true,false,false])
  expect(redirected.players['player-one'].battleArea[0].rested).toBe(scenario==='rested-source')
  const settled=apply(redirected,{kind:'resolve-battle',playerId:'player-two'})
  expect(settled.players['player-one'].battleArea.map(c=>c.hpCards.length)).toEqual([2,2])
 })
 it.each(['wrong-color','rested-energy','no-energy','already-target','wrong-zone'])('rejects invalid Blocker without changing resources (%s)',scenario=>{
  const state=fixture(scenario),before=structuredClone(state)
  expect(getBlockerCandidates(state,'player-one').some(c=>c.card.id==='ST7-012')).toBe(false)
  expect(()=>apply(state,{kind:'play-blocker',playerId:'player-one',sourceInstanceId:'player-one-ST7-012-1',paymentIds:state.players['player-one'].supportArea.slice(0,1).map(s=>s.card.instanceId)})).toThrow()
  expect(state).toEqual(before)
 })
 it.each(['wrong-player','duplicate-payment','over-payment','wrong-source'])('rejects malformed Blocker (%s)',variant=>{
  const state=fixture(),before=structuredClone(state),ids=state.players['player-one'].supportArea.map(s=>s.card.instanceId)
  expect(()=>apply(state,{kind:'play-blocker',playerId:variant==='wrong-player'?'player-two':'player-one',sourceInstanceId:variant==='wrong-source'?state.players['player-one'].battleArea[1].card.instanceId:'player-one-ST7-012-1',paymentIds:variant==='duplicate-payment'?[ids[0],ids[0]]:variant==='over-payment'?ids.slice(0,2):ids.slice(0,1)})).toThrow()
  expect(state).toEqual(before)
 })
 it('can pay Y to block another actual attack in the same turn, without Once or REST cost',()=>{
  let state=block('second-attack')
  state=apply(state,{kind:'resolve-battle',playerId:'player-two'})
  state=apply(state,{kind:'declare-attack',playerId:'player-two',attackerInstanceId:state.players['player-two'].battleArea[1].card.instanceId,targetInstanceId:'player-one-ST1-011-1',supportPaymentIds:[state.players['player-two'].supportArea[1].card.instanceId]})
  state=apply(state,{kind:'play-blocker',playerId:'player-one',sourceInstanceId:'player-one-ST7-012-1',paymentIds:[state.players['player-one'].supportArea[1].card.instanceId]})
  state=apply(state,{kind:'resolve-battle',playerId:'player-two'})
  expect(state.players['player-one'].battleArea.map(c=>c.hpCards.length)).toEqual([1,2]);expect(state.players['player-one'].supportArea.map(s=>s.rested)).toEqual([true,true,false])
 })
 it('skipping the real response keeps Churro and energy unchanged while the original defender takes damage',()=>{
  const state=fixture(),before=structuredClone(state)
  const skipped=apply(state,{kind:'skip-trap',playerId:'player-one'})
  const settled=apply(skipped,{kind:'resolve-battle',playerId:'player-two'})
  expect(settled.players['player-one'].battleArea.map(c=>c.hpCards.length)).toEqual([3,1])
  expect(settled.players['player-one'].supportArea.map(s=>s.rested)).toEqual([false,false,false])
  expect(state).toEqual(before)
 })
 it.each(attacks)('uses original YN ordinary1 with legal payment / blocked negatives (%s)',scenario=>{
  const state=fixture(scenario),before=structuredClone(state),valid=!['attack-insufficient','attack-wrong-color','attack-rested-source','attack-rested-energy','attack-wrong-phase'].includes(scenario)
  const command={kind:'declare-attack' as const,playerId:'player-one' as const,attackerInstanceId:'player-one-ST7-012-1',targetInstanceId:state.players['player-two'].battleArea[0].card.instanceId,supportPaymentIds:state.players['player-one'].supportArea.slice(0,scenario==='attack-insufficient'?1:2).map(s=>s.card.instanceId)}
  if(!valid)expect(()=>apply(state,command)).toThrow()
  else{
   const attacked=apply(state,command),paid=apply(attacked,{kind:'skip-trap',playerId:'player-two'}),settled=apply(paid,{kind:'resolve-battle',playerId:'player-one'})
   expect(settled.players['player-one'].supportArea.map(s=>s.rested)).toEqual([true,true,false]);expect(settled.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
   expect(settled.players['player-two'].battleArea.map(c=>c.hpCards.length)).toEqual(scenario==='attack-faint'?[]:[3]);expect(settled.pendingBattle).toBeNull()
   expect(settled.players['player-two'].breakArea.map(c=>c.id)).toEqual(scenario==='attack-faint'?['BS6-017']:[])
  }
  expect(state).toEqual(before)
 })
})
