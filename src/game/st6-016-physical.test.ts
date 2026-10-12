import {getReplacementCandidates} from './replacement'
import {getCardPoolEntry} from './card-pool'
import {describe,it,expect} from 'vitest'
import {createSt6016PreviewState as fixture,raw} from './st6-016-demo'
import {createCard} from './starter-deck'
import {applyGameCommand as apply} from './commands'
import type {GameState} from './types'
import type {GameCommand} from './commands'
const inventory=(state:GameState)=>{for(const p of Object.values(state.players)){
 const cards=[...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(s=>s.card),...p.battleArea.flatMap(c=>[c.card,...c.hpCards])]
 expect(cards).toHaveLength(60);expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60)
 for(const c of cards){expect(c.imageUrl).toBeTruthy();expect(cards.filter(other=>other.id===c.id).length).toBeLessThanOrEqual(4)}
}}
const pay=(state:GameState)=>apply(state,{kind:'begin-play-item',playerId:'player-one',instanceId:state.players['player-one'].hand[0].instanceId,paymentIds:state.players['player-one'].supportArea.slice(0,3).map(s=>s.card.instanceId),discardHandIds:[state.players['player-one'].hand[1].instanceId]})
const settle=(state:GameState,ids:string[])=>apply(pay(state),{kind:'resolve-ability-effect',playerId:'player-one',targetIds:ids})
describe('ST6-016 original 2/1 split damage physical commands',()=>{
 it('matches independently transcribed printed card and exact RRR/discard cost',()=>{
  const c=createCard(raw,'player-one',1)
  expect([c.name,c.type,c.energyColor]).toEqual(["Dragon's Breath",'item','red'])
  expect(c.item?.cost).toEqual({energy:{red:3},discardHand:1})
  expect(c.item?.effects).toEqual([{kind:'split-damage',primaryAmount:2,secondaryAmount:1,target:{side:'opponent',min:0,max:2}}])
 })
 it.each([[],[0],[1],[0,1],[1,0]].map(indices=>({indices})))('pays before ordered selection $indices',({indices})=>{
  const state=fixture(),before=structuredClone(state),own=state.players['player-one'],foe=state.players['player-two']
  inventory(state)
  const paid=pay(state)
  expect(paid.players['player-one'].supportArea.filter(s=>s.rested)).toHaveLength(3)
  expect(paid.players['player-one'].discardPile.map(c=>c.instanceId)).toEqual(expect.arrayContaining(own.hand.map(c=>c.instanceId)))
  expect(paid.players['player-two']).toEqual(foe)
  const ids=indices.map(i=>foe.battleArea[i].card.instanceId)
  const next=apply(paid,{kind:'resolve-ability-effect',playerId:'player-one',targetIds:ids})
  for(const [index,c] of foe.battleArea.entries()){
   const order=indices.indexOf(index),damage=order===0?2:order===1?1:0
   expect(next.players['player-two'].battleArea[index].hpCards).toEqual(c.hpCards.slice(0,c.hpCards.length-damage))
  }
  expect(next.pendingAbilityEffect).toBeUndefined();expect(state).toEqual(before);inventory(next)
 })
 it.each(['no-discard','negative','wrong-color','wrong-phase','two-red','wrong-discard','item-as-discard'])(
  'rejects unpaid/illegal %s without mutating input',scenario=>{
  const state=fixture(scenario),before=structuredClone(state),own=state.players['player-one']
  const c:GameCommand={kind:'begin-play-item',playerId:'player-one',instanceId:own.hand[0].instanceId,paymentIds:own.supportArea.slice(0,3).map(s=>s.card.instanceId),discardHandIds:own.hand[1]?[own.hand[1].instanceId]:[]}
  if(scenario==='two-red')c.paymentIds=c.paymentIds!.slice(0,2)
  if(scenario==='wrong-discard')c.discardHandIds=[state.players['player-two'].battleArea[0].card.instanceId]
  if(scenario==='item-as-discard')c.discardHandIds=[own.hand[0].instanceId]
  expect(()=>apply(state,c)).toThrow();expect(state).toEqual(before);inventory(state)
 })
 it.each(['own','duplicate','three','unknown'])('rejects illegal selected targets %s',scenario=>{
  const state=pay(fixture()),before=structuredClone(state),foe=state.players['player-two'].battleArea
  const ids=scenario==='own'?[state.players['player-one'].battleArea[0].card.instanceId]:scenario==='duplicate'?[foe[0].card.instanceId,foe[0].card.instanceId]:scenario==='three'?[...foe.map(c=>c.card.instanceId),state.players['player-one'].battleArea[0].card.instanceId]:['unknown']
  expect(()=>apply(state,{kind:'resolve-ability-effect',playerId:'player-one',targetIds:ids})).toThrow();expect(state).toEqual(before)
 })
 it('faints the originally 4HP Sour Belt after actual 2 damage, then this primary 2',()=>{
  const state=fixture('faint'),foe=state.players['player-two'],sour=foe.battleArea[1]
  expect(sour.card.hp).toBe(4);expect(sour.hpCards).toHaveLength(2)
  const next=settle(state,[sour.card.instanceId,foe.battleArea[0].card.instanceId])
  expect(next.players['player-two'].battleArea.some(c=>c.card.instanceId===sour.card.instanceId)).toBe(false)
  expect(next.players['player-two'].breakArea.map(c=>c.instanceId)).toContain(sour.card.instanceId)
  expect(next.players['player-two'].battleArea[0].hpCards).toHaveLength(5);inventory(next)
 })
})

describe('ST6-016 split damage original FLIP and empty-board continuation',()=>{
 it.each([true,false].flatMap(activate=>[false,true].map(reverse=>({activate,reverse}))))('preserves primary/secondary through Cherry FLIP: $activate/$reverse',({activate,reverse})=>{
  const state=fixture(),foe=state.players['player-two'],record=getCardPoolEntry('ST6-006')
  if(!record?.flipText)throw Error('Missing original Cherry FLIP')
  const cherry=createCard(record,'player-two',1),sour=foe.battleArea[1]
  sour.hpCards[sour.hpCards.length-1]=cherry
  inventory(state);const before=structuredClone(state)
  const ids=(reverse?[1,0]:[0,1]).map(i=>foe.battleArea[i].card.instanceId)
  let next=settle(state,ids),sawFlip=false
  for(let i=0;i<12;i++){
   if(next.pendingBattle?.stage==='damage')next=apply(next,{kind:'resolve-next-damage',playerId:'player-two'})
   else if(next.pendingBattle?.stage==='flip'){
    expect(next.pendingBattle.revealedHpCard?.id).toBe('ST6-006');sawFlip=true
    next=apply(next,{kind:'resolve-flip',playerId:'player-two',activate})
   }else break
  }
  expect(sawFlip).toBe(true);expect(next.pendingBattle).toBeNull();expect(next.pendingAbilityEffect).toBeUndefined()
  expect(next.players['player-two'].battleArea.map(c=>c.hpCards.length)).toEqual(reverse?[5,2]:[4,3])
  expect(next.players['player-two'].hand.some(c=>c.instanceId===cherry.instanceId)).toBe(activate)
  expect(next.players['player-two'].discardPile.some(c=>c.instanceId===cherry.instanceId)).toBe(!activate)
  expect(state).toEqual(before);inventory(next)
 })
 it('faints both original targets then obeys mandatory actual hand replacement',()=>{
  const state=fixture('both-faint'),before=structuredClone(state),foe=state.players['player-two']
  expect(foe.battleArea.map(c=>[c.card.id,c.hpCards.length])).toEqual([['ST6-005',1],['BS12-059',2]])
  let next=settle(state,[foe.battleArea[1].card.instanceId,foe.battleArea[0].card.instanceId])
  expect(next.players['player-two'].battleArea).toHaveLength(0)
  expect(next.players['player-two'].breakArea.map(c=>c.id).sort()).toEqual(['BS12-059','ST6-005'])
  expect(next.pendingAbilityEffect).toBeUndefined()
  expect(()=>apply(next,{kind:'skip-replacement',playerId:'player-two'})).toThrow('必須先補位')
  const replacement=getReplacementCandidates(next,'player-two')[0]
  expect(replacement).toBeDefined()
  next=apply(next,{kind:'replace-cookie',playerId:'player-two',instanceId:replacement.instanceId})
  expect(next.players['player-two'].battleArea[0].card.instanceId).toBe(replacement.instanceId)
  expect(next.players['player-two'].battleArea[0].hpCards).toHaveLength(replacement.hp)
  expect(state).toEqual(before);inventory(next)
 })
})
