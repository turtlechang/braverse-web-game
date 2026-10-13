import document from '../../data/candidates/st6-st10/official-st8.en.json'
import type {OfficialCardRecord} from '../cards/types'
import {getCardPoolEntry} from './card-pool'
import {createCard} from './starter-deck'
import {createSt6001State} from './st6-001-demo'
import type {GameCard,GameState,PlayerId} from './types'
export const raw=(getCardPoolEntry('ST8-001')??(document.cards as OfficialCardRecord[]).find(c=>c.cardNumber==='ST8-001')) as OfficialCardRecord
if(!raw)throw Error('Original ST8-001 required')
export const zones=(state:GameState,id:PlayerId):GameCard[]=>{
 const p=state.players[id]
 return [...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(s=>s.card),...p.battleArea.flatMap(c=>[c.card,...c.hpCards,...(c.equippedCards??[])]),...(p.stage?[p.stage.card]:[])]
}
/** Candidate-only prepared state; production routes are registered only after acceptance. */
export const fixture=(scenario='positive'):GameState=>{
 if(scenario.startsWith('ai-'))return JSON.parse(JSON.stringify(fixture(scenario.slice(3))).replaceAll('player-one','player-swap').replaceAll('player-two','player-one').replaceAll('player-swap','player-two')) as GameState
 const state=createSt6001State('attack'),own=state.players['player-one']
 const source=createCard(raw,'player-one',1)
 if(source.type!=='cookie'||source.hp!==2)throw Error('Original Greenbell Cookie HP2 required')
 own.battleArea[0]={...own.battleArea[0],card:source,battleEntryId:source.instanceId+':entry'}
 if(scenario!=='play'){const other=own.battleArea.pop()!;own.deck.push(other.card,...other.hpCards)}
 own.name='ST8-001 原卡逐卡驗收'
 const colors:Record<string,string>={red:'ST1-020',yellow:'ST2-020',green:'ST3-020',blue:'ST9-016',purple:'ST10-019',black:'BS12-105'}
 const color=scenario.startsWith('color-')?scenario.slice(6):'red'
 const record=getCardPoolEntry(colors[color]);if(!record)throw Error('Original support required')
 const used=new Set(zones(state,'player-one').map(c=>c.instanceId))
 let support:GameCard|undefined
 for(let copy=1;copy<=4;copy++){const card=createCard(record,'player-one',copy);if(!used.has(card.instanceId)){support=card;break}}
 if(!support)throw Error('Original support copy limit')
 own.supportArea[0]={card:support,rested:scenario==='rested-energy'}
 if(scenario==='no-energy')own.discardPile.push(...own.supportArea.splice(0).map(s=>s.card))
 if(scenario==='rested-source')own.battleArea[0].rested=true
 if(scenario==='wrong-phase')state.phase='support'
 if(scenario==='first-turn')state.turnNumber=1
 if(scenario==='play'){const cookie=own.battleArea.shift()!;own.hand.push(cookie.card);own.deck.push(...cookie.hpCards)}
 for(const id of ['player-one','player-two'] as const){
  const cards=zones(state,id)
  if(cards.length!==60||new Set(cards.map(c=>c.instanceId)).size!==60)throw Error('Original sixty-card identities')
  for(const card of cards)if(cards.filter(c=>c.id===card.id).length>4)throw Error('Original four-copy limit')
  for(const cookie of state.players[id].battleArea)if(cookie.hpCards.length!==cookie.card.hp)throw Error('Original printed HP')
 }
 return state
}
