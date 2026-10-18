import type {GameCard,GameState,PlayerId} from './types'
import {createSt7012PreviewState} from './st7-012-demo'
import {getCardPoolEntry} from './card-pool'
import {createCard} from './starter-deck'

export const raw=getCardPoolEntry('ST7-013')
if(!raw)throw Error('Formal original ST7-013 required')
export const zones=(state:GameState,owner:PlayerId):GameCard[]=>{
 const p=state.players[owner]
 return [...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(s=>s.card),...p.battleArea.flatMap(c=>[c.card,...c.hpCards,...(c.equippedCards??[])])]
}
// Prepare the original full-pool filler once; each case owns a deep clone.
const originals=new Map<string,GameState>()
export const fixture=(scenario='attack-yellow')=>{
 let original=originals.get(scenario);if(!original){original=createSt7012PreviewState(scenario,true);originals.set(scenario,original)}
 const state=structuredClone(original)
 const add=(number:string,zone:'hand'|'discardPile'|'breakArea',owner:PlayerId='player-one')=>{
  const original=number==='ST7-013'?raw:getCardPoolEntry(number)
  if(!original)throw Error('Missing original '+number)
  const used=new Set(zones(state,owner).map(card=>card.instanceId))
  let card:GameCard|undefined
  for(let copy=1;copy<=4;copy++){const candidate=createCard(original,owner,copy);if(!used.has(candidate.instanceId)){card=candidate;break}}
  if(!card)throw Error('Original copy limit '+number)
  if(!state.players[owner].deck.shift())throw Error('Original deck replacement required')
  if(zone==='breakArea'){
   if(card.type!=='cookie')throw Error('Only original Cookies enter Break')
   state.players[owner].breakArea.push(card)
  }else state.players[owner][zone].push(card)
  return card
 }
 const item=add('ST7-013','hand')
 const low=add('ST7-004','discardPile'),middle=add('ST7-007','discardPile'),high=add('ST7-001','discardPile')
 const red=add('ST6-006','discardPile'),trap=add('ST2-020','discardPile'),hand=add('ST7-004','hand')
 const paymentIds=state.players['player-one'].supportArea.slice(0,2).map(s=>s.card.instanceId)
 const target=state.players['player-two'].battleArea[0].card.instanceId
 const command={kind:'play-item' as const,playerId:'player-one' as const,instanceId:item.instanceId,paymentIds,trashCookieToBreakAreaIds:[low.instanceId],effectTargets:[[target]]}
 return {state,add,item,low,middle,high,red,trap,hand,command,target}
}

export const createSt7013PreviewState=(scenario='positive'):GameState=>{
 const setup=fixture(scenario==='wrong-energy'?'attack-wrong-color':scenario==='lethal'?'attack-faint':'attack-yellow')
 const state=setup.state,own=state.players['player-one']
 own.name='ST7-013 逐卡驗收'
 if(scenario==='negative'){
  const selected=new Set([setup.low.instanceId,setup.middle.instanceId,setup.high.instanceId])
  own.deck.push(...own.discardPile.filter(card=>selected.has(card.instanceId)))
  own.discardPile=own.discardPile.filter(card=>!selected.has(card.instanceId))
 }
 if(scenario==='rested-energy')own.supportArea.forEach(support=>{support.rested=true})
 if(scenario==='few-energy')own.supportArea.forEach((support,index)=>{support.rested=index>0})
 if(scenario==='wrong-phase')state.phase='support'
 if(scenario==='rested-target')state.players['player-two'].battleArea[0].rested=true
 if(scenario==='lethal'){for(let copy=0;copy<3;copy++)setup.add('ST7-003','breakArea','player-two');for(let copy=0;copy<2;copy++)setup.add('ST7-003','breakArea');setup.add('ST7-004','breakArea')}
 if(scenario==='break-loss')for(let copy=0;copy<3;copy++)setup.add('ST7-003','breakArea')
 for(const owner of ['player-one','player-two'] as const){
  const cards=zones(state,owner)
  if(cards.length!==60||new Set(cards.map(card=>card.instanceId)).size!==60)throw Error('Original sixty-card identity invariant')
 }
 return state
}
