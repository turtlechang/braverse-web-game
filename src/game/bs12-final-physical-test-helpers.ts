import {expect} from 'vitest'
import {readdirSync,readFileSync} from 'node:fs'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import {convertOfficialCardToGameCard,convertOfficialCardToExtraDeckCard} from '../cards/official-card-adapter'
import type {OfficialCardRecord} from '../cards/types'
import type {GameState,GameCard} from './types'
import {createBs12TailPhysicalDemoState} from './demo'
import {materializeExtraDeckCookie} from './extra-deck'
const records:OfficialCardRecord[]=[...candidate.cards as OfficialCardRecord[],...readdirSync('data/cards').filter(p=>p.endsWith('.json')).flatMap(p=>JSON.parse(readFileSync('data/cards/'+p,'utf8')).cards)]
export const printed=(n:string,id:string):GameCard=>{const r=records.find(r=>r.cardNumber===n)!;const c=convertOfficialCardToGameCard(r,id);if(c.status!=='converted')throw Error(n);return {...c.gameCard,instanceId:id}}
export const entry=(n:string,id:string)=>{const card=printed(n,id);if(card.type!=='cookie')throw Error(n);return {card,hpCards:Array.from({length:card.hp},(_,i)=>printed(['BS12-009','BS12-027','BS12-011','BS12-031','BS12-046'][i],id+'-hp-'+i)),rested:false,battleEntryId:id+':entry'}}
export const extraScene=(number:string,scenario='positive'):GameState=>{
 const s=createBs12TailPhysicalDemoState('BS12-108','single'),one=s.players['player-one'],two=s.players['player-two'],r=records.find(r=>r.cardNumber===number)!,c=convertOfficialCardToExtraDeckCard(r,'physical-extra');if(c.status!=='converted')throw Error(number)
 one.extraDeck=[c.extraDeckCard];one.battleArea=[entry(scenario==='non-arena'?'BS11-111':scenario==='no-special'?'BS12-094':'BS12-095','physical-witness')];one.hand=[];one.supportArea=[0,1].map(i=>({card:printed('BS12-097','physical-payment-'+i),rested:false}));one.discardPile=[];one.breakArea=[];one.stage=null
 two.supportArea=['BS12-012','BS12-103','BS12-097','ST4-001'].slice(0,scenario==='three-support'?3:4).map((n,i)=>({card:printed(n,'physical-opponent-support-'+i),rested:i%2===0}))
 if(['hand-only','trash-only','break-only','opponent-only'].includes(scenario)){
  const witness=one.battleArea[0];one.battleArea=[]
  if(scenario==='hand-only')one.hand=[witness.card]
  if(scenario==='trash-only')one.discardPile=[witness.card]
  if(scenario==='break-only')one.breakArea=[witness.card]
  if(scenario==='opponent-only')two.battleArea=[witness]
 }
 s.commandLog=[];return s
}
export const attest=(s:GameState)=>{
 const all:GameCard[]=[]
 for(const p of Object.values(s.players)){
  const cards=[...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(c=>c.card),...p.battleArea.flatMap(c=>[c.card,...c.hpCards])]
  const identities=[...cards,...(p.extraDeck??[])];expect(new Set(identities.map(c=>c.instanceId)).size).toBe(identities.length)
  for(const id of new Set(identities.map(c=>c.id)))expect(identities.filter(c=>c.id===id).length).toBeLessThanOrEqual(4)
  for(const c of cards){if(c.id==='BS12-111'){const r=records.find(r=>r.imageUrl===c.imageUrl)!,x=convertOfficialCardToExtraDeckCard(r,'physical-extra');if(x.status!=='converted')throw Error('original EXTRA');expect(c).toEqual(materializeExtraDeckCookie(x.extraDeckCard))}else{const r=records.find(r=>r.imageUrl===c.imageUrl&&r.baseCardNumber===c.id)!;expect(r).toBeDefined();expect(c).toEqual(printed(r.cardNumber,c.instanceId))}}
  all.push(...cards)
 }
 expect(new Set(all.map(c=>c.instanceId)).size).toBe(all.length)
}
