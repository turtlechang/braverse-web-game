import {describe,expect,it} from 'vitest'
import document from '../../data/candidates/st6-st10/official-st7.en.json'
import {fixture as foundation,zones} from './st7-014-demo'
import {getCardPoolEntry} from './card-pool'
import {createCard} from './starter-deck'
import {applyGameCommand as apply} from './commands'
import type {GameCommand} from './commands'
import {canPlayItem} from './card-abilities'
import {takeAiStep} from './ai'
import type {OfficialCardRecord} from '../cards/types'
import type {GameState} from './types'

export const fixture=(scenario='battle'):GameState=>{
 const state=foundation(scenario),own=state.players['player-one']
 const raw=(getCardPoolEntry('ST7-015')??document.cards.find(card=>card.cardNumber==='ST7-015')) as OfficialCardRecord|undefined
 if(!raw)throw Error('Original ST7-015 required')
 own.hand[1]=createCard(raw,'player-one',1)
 own.name='ST7-015 原卡逐卡驗收'
 if(scenario==='attack'||scenario==='attack-inactive'){
  if(scenario==='attack-inactive'){
   const tree=own.battleArea.shift()!;own.hand.push(tree.card);own.deck.push(...tree.hpCards)
  }
  const ginger=getCardPoolEntry('ST1-011');if(!ginger)throw Error('Original GingerBrave')
  const index=own.battleArea.findIndex(c=>c.card.id==='ST6-006'),old=own.battleArea[index],card=createCard(ginger,'player-one',1)
  if(card.type!=='cookie')throw Error('Original Cookie')
  const hpCards=[...old.hpCards];while(hpCards.length>card.hp)own.deck.push(hpCards.pop()!)
  own.battleArea[index]={card,hpCards,rested:false,battleEntryId:card.instanceId+':entry'}
 }
 for(const owner of ['player-one','player-two'] as const){
  const cards=zones(state,owner)
  if(cards.length!==60||new Set(cards.map(c=>c.instanceId)).size!==60)throw Error('Original sixty identities')
  for(const card of cards)if(cards.filter(c=>c.id===card.id).length>4)throw Error('Four-copy limit')
  for(const battle of state.players[owner].battleArea)if(battle.hpCards.length!==battle.card.hp)throw Error('Printed HP')
 }
 return state
}
const command=(state:GameState):GameCommand=>({kind:'play-item',playerId:'player-one',instanceId:state.players['player-one'].hand.find(c=>c.id==='ST7-015')!.instanceId,paymentIds:state.players['player-one'].supportArea.slice(0,2).map(s=>s.card.instanceId),effectTargets:[]})
const inactive=['hand','trash','support','opponent-only','wrong-name']
const scenarios=['battle','break','both',...inactive,'rested-energy','rested-target','wrong-phase','wrong-energy','rested-witness','green-witness','attack','attack-inactive']
describe('ST7-015 original sixty-card payment and attack resolution',()=>{
 it.each(scenarios)('preserves original identities, limits and printed HP: %s',scenario=>{
  const state=fixture(scenario)
  for(const owner of ['player-one','player-two'] as const)expect(zones(state,owner)).toHaveLength(60)
 })
 it.each(scenarios.filter(s=>!['rested-energy','wrong-phase','wrong-energy'].includes(s)))('pays exactly YY and applies fixed all only with own named witness: %s',scenario=>{
  const state=fixture(scenario),before=structuredClone(state),next=apply(state,command(state)),own=next.players['player-one']
  const active=!inactive.includes(scenario)&&scenario!=='attack-inactive'
  expect(next.attackModifiers).toEqual(active?before.players['player-one'].battleArea.map(cookie=>({sourceInstanceId:command(state).kind==='play-item'?state.players['player-one'].hand[1].instanceId:'',targetInstanceId:cookie.card.instanceId,amount:1,expiresAfterTurn:state.turnNumber})):[])
  expect(own.supportArea.map(s=>s.rested)).toEqual(before.players['player-one'].supportArea.map((s,i)=>i<2?true:s.rested))
  expect(own.hand.some(c=>c.id==='ST7-015')).toBe(false);expect(own.discardPile.some(c=>c.id==='ST7-015')).toBe(true)
  expect(next.players['player-two']).toEqual(before.players['player-two']);expect(own.battleArea).toEqual(before.players['player-one'].battleArea)
  expect(state).toEqual(before)
 })
 it.each(['rested-energy','wrong-phase','wrong-energy'])('rejects illegal timing/payment without mutation: %s',scenario=>{
  const state=fixture(scenario),before=structuredClone(state),item=state.players['player-one'].hand[1]
  expect(canPlayItem(state,'player-one',item.instanceId)).toBe(false);expect(()=>apply(state,command(state))).toThrow();expect(state).toEqual(before)
 })
 it('rejects one Yellow for printed YY',()=>{
  const state=fixture(),action=command(state)
  if(action.kind!=='play-item')throw Error('Item command')
  action.paymentIds=action.paymentIds.slice(0,1);expect(()=>apply(state,action)).toThrow()
 })
 it.each([{scenario:'attack',damage:2},{scenario:'attack-inactive',damage:1}])('actual GingerBrave ordinary1 becomes $damage: $scenario',({scenario,damage})=>{
  let state=fixture(scenario);state=apply(state,command(state))
  const own=state.players['player-one'],target=state.players['player-two'].battleArea.find(c=>c.card.id==='ST1-011')!
  const initialHp=target.hpCards.length
  state=apply(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:own.battleArea.find(c=>c.card.id==='ST1-011')!.card.instanceId,targetInstanceId:target.card.instanceId,supportPaymentIds:[own.supportArea[2].card.instanceId]})
  state=apply(state,{kind:'skip-trap',playerId:'player-two'})
  state=apply(state,{kind:'resolve-battle',playerId:'player-one'})
  const current=state.players['player-two'].battleArea.find(c=>c.card.instanceId===target.card.instanceId)
  expect(initialHp-(current?.hpCards.length??0)).toBe(damage)
  expect(state.players['player-two'].breakArea.some(c=>c.instanceId===target.card.instanceId)).toBe(damage===2)
 })
 it('removes all modifiers at actual end of turn',()=>{
  let state=fixture();state=apply(state,command(state));expect(state.attackModifiers).toHaveLength(2)
  const originalTurn=state.turnNumber
  for(let step=0;step<8&&state.turnNumber===originalTurn;step++)state=apply(state,{kind:'advance-phase',playerId:state.activePlayerId})
  expect(state.turnNumber).toBe(originalTurn+1);expect(state.attackModifiers).toEqual([])
 })
 it('applies to the Cookies present at item resolution, without creating a persistent stage aura',()=>{
  let state=fixture('break')
  const record=getCardPoolEntry('ST1-011');if(!record)throw Error('Original GingerBrave')
  state.players['player-one'].hand[0]=createCard(record,'player-one',1)
  state=apply(state,command(state));expect(state.attackModifiers).toHaveLength(1)
  state=apply(state,{kind:'deploy-cookie',playerId:'player-one',instanceId:'player-one-ST1-011-1'})
  expect(state.players['player-one'].battleArea.some(c=>c.card.id==='ST1-011')).toBe(true)
  expect(state.attackModifiers.map(m=>m.targetInstanceId)).toEqual(['player-one-ST6-006-1'])
 })
 it.each([4,5] as const)('Lv%s preserves attack payment after YY and executes its useful +1 attack line',level=>{
  let state=fixture('attack')
  const first=takeAiStep(state,'player-one',{level,searchNow:()=>0})
  expect(first.action).toBe('play-item');state=first.state
  expect(state.players['player-one'].supportArea.filter(s=>!s.rested)).toHaveLength(1)
  for(let step=0;step<3&&!state.pendingBattle;step++)state=takeAiStep(state,'player-one',{level,searchNow:()=>0}).state
  expect(state.pendingBattle?.attackerInstanceId).toBe('player-one-ST1-011-1')
  state=apply(state,{kind:'skip-trap',playerId:'player-two'})
  state=apply(state,{kind:'resolve-battle',playerId:'player-one'})
  expect(state.players['player-two'].breakArea.some(c=>c.id==='ST1-011')).toBe(true)
 })
 it.each([3,4,5] as const)('Lv%s preserves YY and hand when witness is absent',level=>{
  const state=fixture('wrong-name'),before=structuredClone(state)
  const decision=takeAiStep(state,'player-one',{level,searchNow:()=>0})
  expect(decision.action).toBe('advance-phase');expect(decision.state.players['player-one'].hand).toEqual(state.players['player-one'].hand)
  expect(decision.state.players['player-one'].supportArea).toEqual(state.players['player-one'].supportArea);expect(state).toEqual(before)
 })
})
