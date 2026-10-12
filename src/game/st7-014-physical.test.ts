import {describe,expect,it} from 'vitest'
import {applyGameCommand as apply} from './commands'
import type {GameCommand} from './commands'
import {canPlayItem} from './card-abilities'
import {takeAiStep} from './ai'
import document from '../../data/candidates/st6-st10/official-st7.en.json'
import type {OfficialCardRecord} from '../cards/types'
import type {GameCard,GameState,PlayerId} from './types'
import {fixture as foundation} from './st7-010-demo'
import {getCardPoolEntry} from './card-pool'
import {createCard} from './starter-deck'
export const raw=(getCardPoolEntry('ST7-014')??document.cards.find(card=>card.cardNumber==='ST7-014')) as OfficialCardRecord|undefined
if(!raw)throw Error('Original ST7-014 required')
export const zones=(state:GameState,owner:PlayerId):GameCard[]=>{
 const p=state.players[owner]
 return [...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(s=>s.card),...p.battleArea.flatMap(c=>[c.card,...c.hpCards,...(c.equippedCards??[])])]
}
export const fixture=(scenario='battle'):GameState=>{
 const state=foundation(),own=state.players['player-one'],foe=state.players['player-two']
 const original=(number:string,owner:PlayerId):GameCard=>{
  const record=number==='ST7-014'?raw:getCardPoolEntry(number)
  if(!record)throw Error('Original '+number)
  const used=new Set(zones(state,owner).map(c=>c.instanceId))
  for(let copy=1;copy<=4;copy++){const card=createCard(record,owner,copy);if(!used.has(card.instanceId))return card}
  throw Error('Four-copy limit '+number)
 }
 own.hand[1]=original('ST7-014','player-one')
 own.name='ST7-014 原卡逐卡驗收'
 if(scenario==='both'){
  const extra=original('ST7-010','player-one');own.deck.shift()
  if(extra.type!=='cookie')throw Error('Original Cookie required')
  own.breakArea.push(extra)
 }
 if(['break','hand','trash','support','opponent-only'].includes(scenario)){
  const tree=own.battleArea.shift();if(!tree)throw Error('Original witness')
  own.deck.push(...tree.hpCards)
  if(scenario==='break')own.breakArea.push(tree.card)
  if(['hand','opponent-only'].includes(scenario))own.hand.push(tree.card)
  if(scenario==='trash')own.discardPile.push(tree.card)
  if(scenario==='support')own.supportArea.push({card:tree.card,rested:false})
 }
 if(scenario==='opponent-only'){
  const tree=original('ST7-010','player-two');if(tree.type!=='cookie')throw Error('Original Tree')
  const previous=foe.battleArea[0],hpCards=[...previous.hpCards]
  while(hpCards.length<tree.hp){const hp=foe.deck.shift();if(!hp)throw Error('Original HP');hpCards.push(hp)}
  while(hpCards.length>tree.hp)foe.deck.push(hpCards.pop()!)
  foe.battleArea[0]={card:tree,hpCards,rested:false,battleEntryId:tree.instanceId+':entry'}
 }
 if(scenario==='rested-witness')own.battleArea[0].rested=true
 if(scenario==='wrong-name'||scenario==='green-witness'){
  const replacement=original(scenario==='wrong-name'?'ST7-003':'BS4-038','player-one')
  if(replacement.type!=='cookie'||replacement.level!==3)throw Error('Original LV3 witness reference')
  const old=own.battleArea[0],hpCards=[...old.hpCards]
  while(hpCards.length>replacement.hp)own.deck.push(hpCards.pop()!)
  while(hpCards.length<replacement.hp){const hp=own.deck.shift();if(!hp)throw Error('Original HP');hpCards.push(hp)}
  own.battleArea[0]={card:replacement,hpCards,rested:false,battleEntryId:replacement.instanceId+':entry'}
 }
 if(scenario==='rested-energy')own.supportArea.forEach(s=>{s.rested=true})
 if(scenario==='rested-target')own.battleArea[1].rested=true
 if(scenario==='wrong-phase')state.phase='support'
 if(scenario==='wrong-energy')for(const support of own.supportArea)support.card=original('ST1-020','player-one')
 if(scenario==='refresh')own.discardPile.push(...own.deck.splice(1))
 for(const owner of ['player-one','player-two'] as const){
  const cards=zones(state,owner),counts=new Map<string,number>()
  if(cards.length!==60||new Set(cards.map(c=>c.instanceId)).size!==60)throw Error('Original sixty-card identities')
  for(const card of cards)counts.set(card.id,(counts.get(card.id)??0)+1)
  if([...counts.values()].some(count=>count>4))throw Error('Original four-copy limit')
  for(const battle of state.players[owner].battleArea)if(battle.hpCards.length!==battle.card.hp)throw Error('Initial printed HP')
 }
 return state
}

const scenarios=['battle','break','both','hand','trash','support','opponent-only','zero','source','rested-energy','rested-target','wrong-phase','wrong-energy','refresh','wrong-name','rested-witness','green-witness']
const command=(state:GameState,targetIds:string[]):GameCommand=>({kind:'play-item',playerId:'player-one',instanceId:state.players['player-one'].hand.find(c=>c.id==='ST7-014')!.instanceId,paymentIds:[state.players['player-one'].supportArea[0].card.instanceId],effectTargets:[targetIds]})
describe('ST7-014 original60-card physical item commands',()=>{
 it.each(scenarios)('prepares original identities and printed HP: %s',scenario=>{
  const state=fixture(scenario)
  for(const owner of ['player-one','player-two'] as const){
   const cards=zones(state,owner);expect(cards).toHaveLength(60);expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60)
   for(const card of cards)expect(cards.filter(c=>c.id===card.id).length).toBeLessThanOrEqual(4)
   for(const battle of state.players[owner].battleArea)expect(battle.hpCards).toHaveLength(battle.card.hp)
  }
 })
 const cases=['battle','break','both','hand','trash','support'].flatMap(witness=>['cherry','zero','tree'].filter(choice=>choice!=='tree'||['battle','both'].includes(witness)).map(choice=>({witness,choice})))
 it.each(cases)('pays Y, condition and optional target: $witness/$choice',({witness,choice})=>{
  const state=fixture(witness),before=structuredClone(state),own=state.players['player-one']
  const target=own.battleArea.find(c=>c.card.id===(choice==='tree'?'ST7-010':'ST6-006'))!
  const selected=choice==='zero'?[]:[target.card.instanceId],next=apply(state,command(state,selected)),after=next.players['player-one']
  const expected=['battle','break','both'].includes(witness)&&choice!=='zero'?1:0
  expect(after.battleArea.find(c=>c.card.instanceId===target.card.instanceId)!.hpCards.length-target.hpCards.length).toBe(expected)
  expect(after.supportArea[0].rested).toBe(true);expect(after.supportArea.slice(1)).toEqual(own.supportArea.slice(1))
  expect(after.hand.some(c=>c.id==='ST7-014')).toBe(false);expect(after.discardPile.some(c=>c.id==='ST7-014')).toBe(true)
  for(const other of own.battleArea.filter(c=>c.card.instanceId!==target.card.instanceId))expect(after.battleArea.find(c=>c.card.instanceId===other.card.instanceId)).toEqual(other)
  expect(state).toEqual(before)
 })
 it.each(['battle','break','hand','trash','support','opponent-only','wrong-name','rested-witness','green-witness','wrong-energy','rested-energy','wrong-phase'])('normal use availability: %s',scenario=>{
  const state=fixture(scenario),item=state.players['player-one'].hand.find(c=>c.id==='ST7-014')!
  expect(canPlayItem(state,'player-one',item.instanceId)).toBe(!['wrong-energy','rested-energy','wrong-phase'].includes(scenario))
 })
 it.each(['wrong-energy','rested-energy','wrong-phase'])('rejects unavailable payment or timing without mutation: %s',scenario=>{
  const state=fixture(scenario),before=structuredClone(state)
  expect(()=>apply(state,command(state,[]))).toThrow();expect(state).toEqual(before)
 })
 it.each([{scenario:'wrong-name',gain:0},{scenario:'rested-witness',gain:1},{scenario:'green-witness',gain:1}])('same own exact name, no witness color or REST requirement: $scenario',({scenario,gain})=>{
  const state=fixture(scenario),target=state.players['player-one'].battleArea[1]
  const next=apply(state,command(state,[target.card.instanceId]))
  expect(next.players['player-one'].battleArea[1].hpCards.length-target.hpCards.length).toBe(gain)
 })
 it('rejects opponent target and overselection without spending resources',()=>{
  const state=fixture(),before=structuredClone(state),own=state.players['player-one']
  expect(()=>apply(state,command(state,[state.players['player-two'].battleArea[0].card.instanceId]))).toThrow()
  expect(()=>apply(state,command(state,own.battleArea.map(c=>c.card.instanceId)))).toThrow();expect(state).toEqual(before)
 })
 it.each([3,4,5] as const)('Lv%s preserves resources when the item has no legal witness',level=>{
  const state=fixture('wrong-name'),before=structuredClone(state)
  const item=state.players['player-one'].hand.find(card=>card.id==='ST7-014')!
  expect(canPlayItem(state,'player-one',item.instanceId)).toBe(true)
  const decision=takeAiStep(state,'player-one',{level,searchNow:()=>0})
  expect(decision.action).toBe('advance-phase')
  expect(decision.state.players['player-one'].hand).toEqual(state.players['player-one'].hand)
  expect(decision.state.players['player-one'].supportArea).toEqual(state.players['player-one'].supportArea)
  expect(state).toEqual(before)
 })
 it('adds HP using the actual last deck card and opens mandatory Refresh',()=>{
  const state=fixture('refresh'),own=state.players['player-one'],target=own.battleArea[1]
  expect(own.deck).toHaveLength(1)
  const next=apply(state,command(state,[target.card.instanceId]))
  expect(next.pendingRefresh).toBeDefined();expect(next.players['player-one'].supportArea[0].rested).toBe(true)
  expect(next.players['player-one'].discardPile.some(c=>c.id==='ST7-014')).toBe(true)
 })
})
