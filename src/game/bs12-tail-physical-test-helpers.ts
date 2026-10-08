import {readdirSync,readFileSync} from 'node:fs'
import {convertOfficialCardToGameCard} from '../cards/official-card-adapter'
import type {OfficialCardRecord} from '../cards/types'
import type {GameState,GameCard} from './types'
const records:OfficialCardRecord[]=['data/cards/official-festival-arena-bs12.en.json',...readdirSync('data/cards').filter(p=>p.endsWith('.json')).map(p=>'data/cards/'+p)].flatMap(p=>JSON.parse(readFileSync(p,'utf8')).cards)
export const printed=(number:string,id:string):GameCard=>{
 const record=records.find(r=>r.cardNumber===number);if(!record)throw Error('Missing physical '+number)
 const result=convertOfficialCardToGameCard(record,id);if(result.status!=='converted')throw Error('Unconverted physical '+number)
 return {...result.gameCard,instanceId:id}
}
export const actualCards=(state:GameState)=>Object.values(state.players).flatMap(p=>[...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(s=>s.card),...p.battleArea.flatMap(s=>[s.card,...s.hpCards,...(s.equippedCards??[]),...(s.awakenedUnderlay??[])]),...(p.stage?[p.stage.card]:[])])
export const assertIdentity=(state:GameState)=>{
 const all=actualCards(state);if(new Set(all.map(c=>c.instanceId)).size!==all.length)throw Error('Duplicate physical instance')
 for(const p of Object.values(state.players)){
  const cards=actualCards({...state,players:{...state.players,'player-one':p,'player-two':{...p,deck:[],hand:[],battleArea:[],supportArea:[],discardPile:[],breakArea:[],stage:null}}})
  for(const id of new Set(cards.map(c=>c.id)))if(cards.filter(c=>c.id===id).length>4)throw Error('Printed copy limit '+p.id+' '+id)
 }
 for(const c of all){const r=records.find(r=>r.imageUrl===c.imageUrl&&r.baseCardNumber===c.id);if(!r)throw Error('No original '+c.instanceId);const expected=printed(r.cardNumber,c.instanceId);if(JSON.stringify(c)!==JSON.stringify(expected))throw Error('Printed mismatch '+c.instanceId)}
}
