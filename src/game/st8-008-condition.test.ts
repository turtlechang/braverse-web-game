import {describe,expect,it} from 'vitest'
import {
 applyGameCommand,createCard,createPlayerView,getCardPoolEntry,isEffectConditionMet,
 type CardEffect,type EffectCondition,type GameCard,type GameState,type PlayerId,
} from './index'
import {createSt8007PreviewState} from './st8-007-demo'
import {assessPublicCondition} from './ai/strategy/public-condition'

const self:PlayerId='player-one',opponent:PlayerId='player-two'
const required=<T,>(value:T|undefined|null,label:string):T=>{
 if(value===undefined||value===null)throw Error(`Missing ${label}`)
 return value
}
const allCards=(state:GameState,owner:PlayerId):GameCard[]=>{
 const p=state.players[owner]
 return [...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(s=>s.card),
  ...p.battleArea.flatMap(c=>[c.card,...c.hpCards]),...(p.stage?[p.stage.card]:[])]
}
const assertResources=(state:GameState)=>{
 const all:GameCard[]=[]
 for(const owner of [self,opponent]){
  const cards=allCards(state,owner),counts=new Map<string,number>()
  expect(cards).toHaveLength(60);expect(state.players[owner].extraDeck).toHaveLength(0)
  for(const card of cards)counts.set(card.id,(counts.get(card.id)??0)+1)
  expect([...counts.values()].every(n=>n<=4)).toBe(true)
  all.push(...cards)
 }
 expect(new Set(all.map(c=>c.instanceId)).size).toBe(120)
}
const base=()=>createSt8007PreviewState('attack',true)
type Zone='support'|'battle'|'hand'|'deck'
const addWindArcher=(state:GameState,owner:PlayerId,zone:Zone,rested=false)=>{
 const p=state.players[owner],raw=required(getCardPoolEntry('ST8-005'),'original Wind Archer')
 const copy=allCards(state,owner).filter(c=>c.id==='ST8-005').length+1
 const card=createCard(raw,owner,copy)
 expect(card.name).toBe('Wind Archer Cookie')
 if(card.type!=='cookie')throw Error('Expected original Cookie')
 expect(card.hp).toBe(6);expect(card.level).toBe(3)
 required(p.deck.shift(),'replace one original filler')
 if(zone==='support')p.supportArea.push({card,rested})
 if(zone==='hand')p.hand.push(card)
 if(zone==='deck')p.deck.push(card)
 if(zone==='battle')p.battleArea.push({card,hpCards:p.deck.splice(0,card.hp),rested:false,battleEntryId:card.instanceId+':entry'})
 assertResources(state)
 return card
}
const named=(side:'self'|'opponent'='self'):EffectCondition=>({kind:'support-area-has-named-cookie',side,name:'Wind Archer Cookie'})
const check=(state:GameState,condition:EffectCondition,expected:boolean,sourcePlayerId:PlayerId=self)=>{
 const before=structuredClone(state)
 const effect:CardEffect={kind:'draw',amount:1,condition}
 const authoritative=isEffectConditionMet(state,{sourcePlayerId,sourceInstanceId:required(state.players[sourcePlayerId].battleArea[0],'source').card.instanceId},effect)
 const publicResult=assessPublicCondition(createPlayerView(state,sourcePlayerId),condition)
 expect({authoritative,public:publicResult.state}).toEqual({authoritative:expected,public:expected?'met':'unmet'})
 expect(typeof authoritative).toBe('boolean')
 expect(state).toEqual(before)
 assertResources(state)
}
describe('ST8-008 public named-support predicate',()=>{
 for(const rested of [false,true])it(`recognizes original Wind Archer support, rested=${rested}`,()=>{
  const state=base();addWindArcher(state,self,'support',rested);check(state,named(),true)
 })
 it('retains the witness after actual GG attack payment rests that support',()=>{
  let state=base();const witness=addWindArcher(state,self,'support')
  const source=required(state.players[self].battleArea[0],'attacker'),target=required(state.players[opponent].battleArea[0],'target')
  const other=required(state.players[self].supportArea.find(s=>s.card.instanceId!==witness.instanceId),'other green payment')
  state=applyGameCommand(state,{kind:'declare-attack',playerId:self,attackerInstanceId:source.card.instanceId,targetInstanceId:target.card.instanceId,supportPaymentIds:[witness.instanceId,other.card.instanceId]})
  expect(state.players[self].supportArea.find(s=>s.card.instanceId===witness.instanceId)?.rested).toBe(true)
  check(state,named(),true)
 })
 it('wrong names in real green supports do not satisfy the named witness',()=>{
  const state=base();expect(state.players[self].supportArea.every(s=>s.card.name!=='Wind Archer Cookie')).toBe(true)
  check(state,named(),false)
 })
 for(const zone of ['battle','hand','deck'] as const)it(`same original Cookie only in ${zone} is not a support witness`,()=>{
  const state=base();addWindArcher(state,self,zone);check(state,named(),false)
 })
 it('opponent support does not count as self; explicit opponent side does count',()=>{
  const state=base();addWindArcher(state,opponent,'support',true)
  check(state,named(),false);check(state,named('opponent'),true)
 })
 it('side is relative to the source player and public-view observer',()=>{
  const state=base();addWindArcher(state,self,'support')
  check(state,named(),true,self);check(state,named('opponent'),false,self)
  check(state,named('opponent'),true,opponent);check(state,named(),false,opponent)
 })
 it('two same-name original copies still form one boolean condition',()=>{
  const state=base(),first=addWindArcher(state,self,'support'),second=addWindArcher(state,self,'support',true)
  expect(first.instanceId).not.toBe(second.instanceId);check(state,named(),true)
 })
 it('opponent hidden hand/deck identity swap preserves public view and the decision',()=>{
  const state=base(),witness=addWindArcher(state,opponent,'hand'),changed=structuredClone(state)
  const p=changed.players[opponent],index=p.hand.findIndex(c=>c.instanceId===witness.instanceId)
  const top=required(p.deck[0],'hidden deck top'),hidden=required(p.hand[index],'hidden hand')
  p.hand[index]=top;p.deck[0]=hidden
  expect(createPlayerView(changed,self)).toEqual(createPlayerView(state,self))
  check(state,named('opponent'),false);check(changed,named('opponent'),false)
 })
})
const setSupportCount=(state:GameState,owner:PlayerId,count:number)=>{
 const p=state.players[owner]
 while(p.supportArea.length>count)p.deck.push(required(p.supportArea.pop(),'returned support').card)
 while(p.supportArea.length<count)p.supportArea.push({card:required(p.deck.shift(),'real support resource'),rested:p.supportArea.length%2===0})
 assertResources(state)
}
describe('ST8-008 support difference inclusive boundary agrees in rules and AI',()=>{
 for(const [own,foe,difference,expected] of [
  [3,3,0,true],[2,3,1,true],[3,3,1,false],
  [0,0,0,true],[0,1,1,true],[0,0,1,false],
  [3,2,0,false],[2,4,2,true],[2,3,2,false],[1,4,2,true],
 ] as const)it(`${own}:${foe}, required difference ${difference} -> ${expected}`,()=>{
  const state=base();setSupportCount(state,self,own);setSupportCount(state,opponent,foe)
  check(state,{kind:'support-count-less-than-opponent',difference},expected)
 })
})
