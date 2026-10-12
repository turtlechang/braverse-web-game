import type {GameCard,GameState,PlayerId} from './types'
import {fixture as foundation} from './st7-010-demo'
import {getCardPoolEntry} from './card-pool'
import {createCard} from './starter-deck'
export const raw=getCardPoolEntry('ST7-014')
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
