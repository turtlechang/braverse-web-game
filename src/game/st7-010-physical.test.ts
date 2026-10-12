import {describe,expect,it} from 'vitest'
import {fixture} from './st7-010-demo'
import {applyGameCommand as apply} from './commands'
import {getEffectTargetCandidatesForEffect} from './effects'
const scenarios=['skill-positive','skill-zero','skill-rested-source','skill-rested-energy','skill-source4','skill-once','skill-wrong-phase','skill-refresh','skill-no-target','attack-draw0','attack-draw1','attack-draw2','attack-skip','attack-no-flip','attack-noncookie','attack-rested-source','attack-rested-support','attack-wrong-energy','attack-wrong-phase','attack-refresh1','attack-refresh2']
describe('ST7-010 independent original-card fixture and real parent commands',()=>{
 it('keeps the printed attack Then text in the draw decision instead of Activate text',()=>{
  let state=fixture('attack-draw2');const own=state.players['player-one']
  state=apply(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:own.battleArea[0].card.instanceId,targetInstanceId:'player-two-ST6-006-1',supportPaymentIds:own.supportArea.map(s=>s.card.instanceId)})
  state=apply(state,{kind:'skip-trap',playerId:'player-two'})
  for(let i=0;i<12&&state.pendingBattle?.stage==='damage';i++)state=apply(state,{kind:'resolve-next-damage',playerId:'player-two'})
  state=apply(state,{kind:'resolve-attack-effect',playerId:'player-one',targetIds:[]})
  state=apply(state,{kind:'resolve-optional-cost-attack',playerId:'player-one',action:'pay',discardCardIds:[own.hand[0].instanceId],paymentIds:[],targetIds:[]})
  expect(state.pendingDrawUpTo?.effectText).toBe('Then, <discard 1 Cookie that has FLIP from your hand.> Draw up to 2 cards from your deck.')
 })
 it.each(scenarios)('preserves 60 unique originals and four-copy limit: %s',scenario=>{
  const state=fixture(scenario)
  for(const p of Object.values(state.players)){
   const cards=[...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(s=>s.card),...p.battleArea.flatMap(c=>[c.card,...c.hpCards])]
   expect(cards).toHaveLength(60);expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60)
   const counts=new Map<string,number>();for(const c of cards){counts.set(c.id,(counts.get(c.id)??0)+1);expect(c.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)}
   expect([...counts.values()].every(n=>n<=4)).toBe(true)
  }
 })
 it('uses real GingerBrave attack1 and advances back to own main for source HP4',()=>{
  const before=fixture('skill-source4',true),state=fixture('skill-source4')
  expect(before.players['player-one'].battleArea[0].hpCards).toHaveLength(5)
  expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(4)
  expect([state.activePlayerId,state.phase]).toEqual(['player-one','main'])
  expect(state.commandLog?.some(c=>c.payload.kind==='declare-attack')).toBe(true)
 })
 it.each(['skill-positive','skill-source4','skill-no-target'])('offers the complete printed HP≤4 target set: %s',scenario=>{
  const state=fixture(scenario),source=state.players['player-one'].battleArea[0]
  const effect=source.card.skill?.effects[0];if(!effect)throw Error('Original skill required')
  expect(getEffectTargetCandidatesForEffect(state,{sourcePlayerId:'player-one',sourceInstanceId:source.card.instanceId},effect).map(c=>c.card.instanceId)).toEqual(scenario==='skill-source4'?['player-one-ST7-010-1','player-one-ST6-006-1']:scenario==='skill-no-target'?[]:['player-one-ST6-006-1'])
 })
 it.each(['skill-positive','skill-zero','skill-rested-source','skill-rested-energy'])('free skill pays exactly one arbitrary item card and permits zero: %s',scenario=>{
  const state=fixture(scenario),before=structuredClone(state),own=state.players['player-one'],target=own.battleArea[1]
  const result=apply(state,{kind:'activate-skill',trigger:'activate',playerId:'player-one',sourceInstanceId:own.battleArea[0].card.instanceId,paymentIds:[],discardHandIds:[own.hand[1].instanceId],effectTargets:[scenario==='skill-zero'?[]:[target.card.instanceId]]})
  expect(result.players['player-one'].battleArea.map(c=>c.hpCards.length)).toEqual([5,scenario==='skill-zero'?4:5])
  expect(result.players['player-one'].hand).toHaveLength(1)
  expect(result.players['player-one'].supportArea).toEqual(own.supportArea)
  expect(state).toEqual(before)
 })
 it('rejects a second Once use while a legal target and hand cost remain',()=>{
  const state=fixture('skill-once'),own=state.players['player-one'],before=structuredClone(state)
  expect(own.battleArea[1].hpCards).toHaveLength(3);expect(own.hand).toHaveLength(1)
  expect(()=>apply(state,{kind:'activate-skill',trigger:'activate',playerId:'player-one',sourceInstanceId:own.battleArea[0].card.instanceId,paymentIds:[],discardHandIds:[own.hand[0].instanceId],effectTargets:[[own.battleArea[1].card.instanceId]]})).toThrow()
  expect(state).toEqual(before)
 })
})
