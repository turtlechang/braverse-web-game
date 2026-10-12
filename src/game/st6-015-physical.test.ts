import {describe,expect,it} from 'vitest'
import {createSt6015PreviewState as fixture} from './st6-015-demo'
import {applyGameCommand as apply,type GameCommand} from './commands'
import {getCardPoolEntry} from './card-pool'
import {createCard} from './starter-deck'
import type {GameState} from './types'
const owner='player-one',foe='player-two'
const pay=(state:GameState,costIndex=0)=>apply(state,{
 kind:'begin-play-item',playerId:owner,instanceId:state.players[owner].hand[0].instanceId,
 paymentIds:state.players[owner].supportArea.filter(s=>!s.rested&&s.card.energyColor==='red').slice(0,2).map(s=>s.card.instanceId),
 hpToTrashTargetIds:[state.players[owner].battleArea[costIndex].card.instanceId],
})
const inventory=(state:GameState)=>{
 for(const p of Object.values(state.players)){
  const cards=[...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(s=>s.card),...p.battleArea.flatMap(c=>[c.card,...c.hpCards])]
  expect(cards).toHaveLength(60);expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60)
  const counts=new Map<string,number>()
  for(const card of cards){expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//);counts.set(card.id,(counts.get(card.id)??0)+1)}
  expect([...counts.values()].every(n=>n<=4)).toBe(true)
 }
}
const paths=(['positive','low','no-target'] as const).flatMap(scenario=>[0,1].flatMap(costIndex=>[0,1,null].map(targetIndex=>({scenario,costIndex,targetIndex}))))
describe('ST6-015 exact printed-card commands',()=>{
 it.each(['positive','negative','zero','low','wrong-color','wrong-phase','no-target','rested-source','attack','green-arena','no-battle'] as const)(
  '%s preserves sixty original cards, unique IDs and four-copy limits',scenario=>inventory(fixture(scenario)))
 it.each(paths)('exact HP cost and optional +2: $scenario/$costIndex/$targetIndex',({scenario,costIndex,targetIndex})=>{
  const state=fixture(scenario),before=structuredClone(state),own=state.players[owner]
  const cost=own.battleArea[costIndex],target=targetIndex===null?undefined:own.battleArea[targetIndex],item=own.hand[0]
  let next=pay(state,costIndex)
  expect(next.players[foe]).toEqual(before.players[foe])
  expect(next.players[owner].discardPile.map(c=>c.instanceId)).toContain(cost.hpCards.at(-1)?.instanceId)
  expect(next.players[owner].discardPile.map(c=>c.instanceId)).toContain(item.instanceId)
  const survivor=next.players[owner].battleArea.find(c=>c.card.instanceId===cost.card.instanceId)
  if(cost.hpCards.length===1){expect(survivor).toBeUndefined();expect(next.players[owner].breakArea.map(c=>c.instanceId)).toContain(cost.card.instanceId)}
  else expect(survivor?.hpCards).toEqual(cost.hpCards.slice(0,-1))
  expect(next.players[owner].supportArea.filter(s=>s.rested)).toHaveLength(2)
  const command:GameCommand={kind:'resolve-ability-effect',playerId:owner,targetIds:target?[target.card.instanceId]:[]}
  if(target===cost&&cost.hpCards.length===1){
   const paid=structuredClone(next);expect(()=>apply(next,command)).toThrow();expect(next).toEqual(paid)
  }else{
   next=apply(next,command)
   expect(next.attackModifiers).toEqual(target?[{sourceInstanceId:item.instanceId,targetInstanceId:target.card.instanceId,amount:2,expiresAfterTurn:state.turnNumber}]:[])
   expect(next.players[foe]).toEqual(before.players[foe]);expect(next.pendingAbilityEffect).toBeUndefined()
  }
  expect(state).toEqual(before);inventory(next)
 })
 it.each(['missing-hp-choice','opponent-hp','two-hp-cookies','one-red','mixed-energy','wrong-phase','rested-energy'] as const)(
  'rejects %s without spending',name=>{
   const state=fixture(name==='wrong-phase'?'wrong-phase':name==='rested-energy'?'negative':'positive'),before=structuredClone(state),own=state.players[owner]
   const command:GameCommand={kind:'begin-play-item',playerId:owner,instanceId:own.hand[0].instanceId,paymentIds:own.supportArea.slice(0,2).map(s=>s.card.instanceId),hpToTrashTargetIds:[own.battleArea[0].card.instanceId]}
   if(name==='missing-hp-choice')command.hpToTrashTargetIds=[]
   if(name==='opponent-hp')command.hpToTrashTargetIds=[state.players[foe].battleArea[0].card.instanceId]
   if(name==='two-hp-cookies')command.hpToTrashTargetIds=own.battleArea.map(c=>c.card.instanceId)
   if(name==='one-red')command.paymentIds=command.paymentIds.slice(0,1)
   if(name==='mixed-energy')command.paymentIds=[own.supportArea[0].card.instanceId,own.supportArea[3].card.instanceId]
   expect(()=>apply(state,command)).toThrow();expect(state).toEqual(before)
  })
 it.each(['opponent','two-targets'] as const)('rejects illegal buff %s',name=>{
  const state=pay(fixture('positive')),before=structuredClone(state)
  const ids=name==='opponent'?[state.players[foe].battleArea[0].card.instanceId]:state.players[owner].battleArea.map(c=>c.card.instanceId)
  expect(()=>apply(state,{kind:'resolve-ability-effect',playerId:owner,targetIds:ids})).toThrow();expect(state).toEqual(before)
 })
 it('uses original green LV3 Cookie as both HP cost and buff target',()=>{
  const state=fixture('green-arena'),before=structuredClone(state),vampire=state.players[owner].battleArea[1]
  expect([vampire.card.id,vampire.card.level,vampire.card.hp,vampire.card.energyColor]).toEqual(['ST3-004',3,3,'green'])
  const next=apply(pay(state,1),{kind:'resolve-ability-effect',playerId:owner,targetIds:[vampire.card.instanceId]})
  expect(next.players[owner].battleArea[1].hpCards).toEqual(vampire.hpCards.slice(0,-1))
  expect(next.attackModifiers[0]).toMatchObject({amount:2,targetInstanceId:vampire.card.instanceId})
  expect(state).toEqual(before);inventory(next)
 })
 it('keeps an actually REST Picky REST after +2',()=>{
  const state=fixture('rested-source'),before=structuredClone(state),picky=state.players[owner].battleArea[0]
  expect(picky.rested).toBe(true)
  const next=apply(pay(state),{kind:'resolve-ability-effect',playerId:owner,targetIds:[picky.card.instanceId]})
  expect(next.players[owner].battleArea[0].rested).toBe(true);expect(next.attackModifiers[0].amount).toBe(2)
  expect(state).toEqual(before);inventory(next)
 })
 it('trashes a real printed FLIP HP card without revealing or triggering FLIP',()=>{
  const state=fixture('positive'),own=state.players[owner],raw=getCardPoolEntry('ST6-006')
  if(!raw?.flipText)throw new Error('Missing original Cherry FLIP')
  const flip=createCard(raw,owner,1),pile=own.battleArea[0].hpCards
  pile[pile.length-1]=flip
  inventory(state)
  const before=structuredClone(state),next=pay(state)
  expect(next.players[owner].discardPile.map(c=>c.instanceId)).toContain(flip.instanceId)
  expect(next.pendingBattle).toBeNull();expect(next.pendingAbilityEffect?.effects.map(e=>e.kind)).toEqual(['modify-attack'])
  expect(state).toEqual(before);inventory(next)
 })
 it('finishes the optional effect before explicit empty-board replacement resolution',()=>{
  const state=fixture('no-battle'),before=structuredClone(state)
  let next=pay(state)
  expect(next.status).toBe('playing');expect(next.players[owner].battleArea).toHaveLength(0)
  next=apply(next,{kind:'resolve-ability-effect',playerId:owner,targetIds:[]})
  expect(next.pendingAbilityEffect).toBeUndefined();expect(next.pendingReplacement).toBeDefined()
  next=apply(next,{kind:'skip-replacement',playerId:owner})
  expect(next.status).toBe('finished');expect(next.result?.reason).toBe('no-cookie-available')
  expect(next.attackModifiers).toEqual([]);expect(state).toEqual(before);inventory(next)
 })
})
