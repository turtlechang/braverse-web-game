import {fixture as foundation,zones} from './st7-014-demo'
import {getCardPoolEntry} from './card-pool'
import {createCard} from './starter-deck'
import type {GameState} from './types'
export const fixture=(scenario='battle'):GameState=>{
 if(scenario==='ai-attack'||scenario==='ai-inactive'){
  const original=fixture(scenario==='ai-attack'?'attack':'wrong-name')
  return JSON.parse(JSON.stringify(original).replaceAll('player-one','player-swap').replaceAll('player-two','player-one').replaceAll('player-swap','player-two')) as GameState
 }

 const state=foundation(scenario),own=state.players['player-one']
 const raw=getCardPoolEntry('ST7-015')
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
