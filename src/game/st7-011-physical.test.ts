import {describe,it,expect} from 'vitest'
import {createSt7011PreviewState as fixture} from './st7-011-demo'
import {applyGameCommand as apply} from './commands'
import type {GameState,BattleAreaHasNamedCookieCondition} from './types'
import {isEffectConditionMet} from './effects'
import {createSpecialPlayAttackFixture,lowerLicorice} from './ai-special-play-attack-test-fixture'
import {getCardPoolEntry} from './card-pool'
import {createCard} from './starter-deck'
const scenarios=['positive','rested-witness','wrong-name','opponent-witness','no-witness','break-witness','support-witness','rested-source','wrong-energy','rested-energy','few-energy','wrong-phase','short-deck']
const attack=(state:GameState)=>apply(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:'player-one-ST7-011-1',targetInstanceId:state.players['player-two'].battleArea[0].card.instanceId,supportPaymentIds:state.players['player-one'].supportArea.slice(0,2).map(s=>s.card.instanceId)})

describe('named witness current level after real Licorice Activate',()=>{
 const cases:{name:string;condition:BattleAreaHasNamedCookieCondition;before:boolean;after:boolean}[]=[
  {name:'named printed LV2',condition:{kind:'battle-area-has-named-cookie',side:'self',name:'Licorice Cookie',minLevel:2,maxLevel:2},before:true,after:false},
  {name:'named current LV1',condition:{kind:'battle-area-has-named-cookie',side:'self',name:'Licorice Cookie',minLevel:1,maxLevel:1},before:false,after:true},
  {name:'legacy name-only compatible',condition:{kind:'battle-area-has-named-cookie',side:'self',name:'Licorice Cookie'},before:true,after:true},
  {name:'separate LV3 Tree cannot satisfy Licorice LV3',condition:{kind:'battle-area-has-named-cookie',side:'self',name:'Licorice Cookie',minLevel:3,maxLevel:3},before:false,after:false},
  {name:'original LV3 Tree',condition:{kind:'battle-area-has-named-cookie',side:'self',name:'Millennial Tree Cookie',minLevel:3,maxLevel:3},before:true,after:true},
  {name:'Tree is not LV4',condition:{kind:'battle-area-has-named-cookie',side:'self',name:'Millennial Tree Cookie',minLevel:4,maxLevel:4},before:false,after:false},
  {name:'negation includes level',condition:{kind:'battle-area-has-named-cookie',side:'self',name:'Licorice Cookie',minLevel:2,maxLevel:2,negate:true},before:false,after:true},
  {name:'exclude source still applies',condition:{kind:'battle-area-has-named-cookie',side:'self',name:'Licorice Cookie',minLevel:1,maxLevel:1,excludeSource:true},before:false,after:false},
  {name:'opponent side still applies',condition:{kind:'battle-area-has-named-cookie',side:'opponent',name:'Licorice Cookie',minLevel:1,maxLevel:1},before:false,after:false},
 ]
 it.each(cases)('$name',test=>{
  const state=createSpecialPlayAttackFixture({target:'ST1-011',supports:2,fodder:false})
  const raw=getCardPoolEntry('BS4-038');if(!raw)throw Error('Original Tree required')
  const tree=createCard(raw,'player-one',1);if(tree.type!=='cookie')throw Error('Original Cookie required')
  expect([tree.name,tree.level,tree.hp]).toEqual(['Millennial Tree Cookie',3,5])
  const own=state.players['player-one'],witness=own.battleArea[1]
  witness.card=tree;witness.battleEntryId=tree.instanceId+':entry'
  witness.hpCards.push(...own.deck.splice(0,tree.hp-witness.hpCards.length))
  const before=structuredClone(state),after=lowerLicorice(state)
  expect(state).toEqual(before);expect(own.battleArea[0].card.level).toBe(2)
  expect(after.players['player-one'].battleArea[0].levelOverride).toBe(1)
  const context={sourcePlayerId:'player-one' as const,sourceInstanceId:own.battleArea[0].card.instanceId}
  expect(isEffectConditionMet(state,context,{kind:'draw',amount:1,condition:test.condition})).toBe(test.before)
  expect(isEffectConditionMet(after,context,{kind:'draw',amount:1,condition:test.condition})).toBe(test.after)
 })
})
describe('ST7-011 original printed identity and actual attack',()=>{
 it.each(scenarios)('preserves sixty unique original cards and printed HP: %s',scenario=>{
  for(const player of Object.values(fixture(scenario).players)){
   const cards=[...player.deck,...player.hand,...player.discardPile,...player.breakArea,...player.supportArea.map(s=>s.card),...player.battleArea.flatMap(c=>[c.card,...c.hpCards])]
   expect(cards).toHaveLength(60);expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60)
   const counts=new Map<string,number>();for(const card of cards){counts.set(card.id,(counts.get(card.id)??0)+1);expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)}
   expect([...counts.values()].every(count=>count<=4)).toBe(true)
   for(const cookie of player.battleArea)expect(cookie.hpCards).toHaveLength(cookie.card.hp)
  }
 })
 it.each(['positive','rested-witness','wrong-name','opponent-witness','no-witness','break-witness','support-witness'])('pays YY, deals ordinary2 and checks own named battle witness: %s',scenario=>{
  const state=fixture(scenario),before=structuredClone(state),foeHp=state.players['player-two'].battleArea[0].hpCards.length
  const declared=attack(state),paid=apply(declared,{kind:'skip-trap',playerId:'player-two'}),result=apply(paid,{kind:'resolve-battle',playerId:'player-one'})
  expect(state).toEqual(before);expect(result.players['player-one'].supportArea.slice(0,3).map(s=>s.rested)).toEqual([true,true,false])
  expect(result.players['player-two'].battleArea[0].hpCards).toHaveLength(foeHp-2)
  expect(result.players['player-one'].battleArea[0].hpCards).toHaveLength(['positive','rested-witness'].includes(scenario)?3:2)
  expect(result.pendingBattle).toBeNull();expect(result.pendingAbilityEffect??null).toBeNull()
 })
 it.each(['rested-source','wrong-energy','rested-energy','few-energy','wrong-phase'])('rejects illegal ordinary attack without payment or mutation: %s',scenario=>{
  const state=fixture(scenario),before=structuredClone(state)
  expect(()=>attack(state)).toThrow();expect(state).toEqual(before)
 })
 it.each(['injured-one-hp','three-hp'])('checks remaining HP after actual parent commands: %s',scenario=>{
  const state=fixture(scenario),before=structuredClone(state)
  expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(scenario==='injured-one-hp'?1:3)
  const result=apply(apply(attack(state),{kind:'skip-trap',playerId:'player-two'}),{kind:'resolve-battle',playerId:'player-one'})
  expect(result.players['player-one'].battleArea[0].hpCards).toHaveLength(scenario==='injured-one-hp'?2:3)
  expect(result.players['player-one'].battleArea[1].hpCards).toHaveLength(5);expect(state).toEqual(before)
 })
 it('consumes the last deck card for actual Then and resolves mandatory Refresh without another gain',()=>{
  const state=fixture('short-deck'),topId=state.players['player-one'].deck[0].instanceId
  let result=apply(apply(attack(state),{kind:'skip-trap',playerId:'player-two'}),{kind:'resolve-battle',playerId:'player-one'})
  expect(result.pendingRefresh?.playerId).toBe('player-one');expect(result.players['player-one'].deck).toHaveLength(0)
  expect(result.players['player-one'].battleArea[0].hpCards.at(-1)?.instanceId).toBe(topId)
  const cookie=result.players['player-one'].discardPile.find(card=>card.type==='cookie'&&card.level===1)
  if(!cookie)throw Error('Original LV1 Refresh cost required')
  result=apply(result,{kind:'refresh-deck',playerId:'player-one',cookieInstanceId:cookie.instanceId,shuffleSeed:70112026})
  expect(result.pendingRefresh).toBeNull();expect(result.pendingAbilityEffect??null).toBeNull();expect(result.status).toBe('playing')
  expect(result.players['player-one'].battleArea.map(c=>c.hpCards.length)).toEqual([3,5])
 })
 it('does not heal another Cookie or draw HP after actual Kumiho FLIP faints the attacking source',()=>{
  const state=fixture('departed-flip'),deckCount=state.players['player-one'].deck.length
  let result=apply(attack(state),{kind:'skip-trap',playerId:'player-two'})
  result=apply(result,{kind:'resolve-next-damage',playerId:'player-two'})
  expect(result.pendingBattle?.stage).toBe('flip');expect(result.pendingBattle?.revealedHpCard?.id).toBe('BS1-002')
  result=apply(result,{kind:'resolve-flip',playerId:'player-two',activate:true,discardHandIds:[result.players['player-two'].hand[0].instanceId],targetIds:['player-one-ST7-011-1']})
  for(let i=0;i<15;i++){
   if(result.pendingReplacement)result=apply(result,{kind:'skip-replacement',playerId:result.pendingReplacement.tasks[0].playerId})
   else if(result.pendingBattle?.stage==='damage')result=apply(result,{kind:'resolve-next-damage',playerId:'player-two'})
   else break
  }
  expect(result.players['player-one'].breakArea.some(c=>c.id==='ST7-011')).toBe(true)
  expect(result.players['player-one'].battleArea.map(c=>[c.card.id,c.hpCards.length])).toEqual([['BS4-038',5]])
  expect(result.players['player-one'].deck).toHaveLength(deckCount);expect(result.pendingBattle).toBeNull();expect(result.pendingAbilityEffect??null).toBeNull()
 })
})
