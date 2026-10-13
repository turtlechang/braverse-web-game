import document from '../../data/candidates/st6-st10/official-st8.en.json'
import type {OfficialCardRecord} from '../cards/types'
import {getAllCardPoolEntries,getCardPoolEntry,hasFlipAbility} from './card-pool'
import {createCard,createOfficialRedStarterDeck} from './starter-deck'
import {createGame} from './setup'
import type {CookieInBattle,GameCard,GameState,PlayerId} from './types'
export const raw=(getCardPoolEntry('ST8-003')??(document.cards as OfficialCardRecord[]).find(c=>c.cardNumber==='ST8-003')) as OfficialCardRecord
if(!raw)throw Error('Original ST8-003 required')
export const zones=(state:GameState,id:PlayerId):GameCard[]=>{const p=state.players[id];return [...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(s=>s.card),...p.battleArea.flatMap(c=>[c.card,...c.hpCards,...(c.equippedCards??[])]) ]}
/** Physical neutral-three attack preview, without rewriting any printed attributes. */
export const fixture=(scenario='positive'):GameState=>{
 if(scenario.startsWith('ai-'))return JSON.parse(JSON.stringify(fixture(scenario.slice(3))).replaceAll('player-one','player-swap').replaceAll('player-two','player-one').replaceAll('player-swap','player-two')) as GameState
 const counts=new Map<string,number>()
 const card=(number:string,owner:PlayerId):GameCard=>{const key=owner+':'+number,copy=(counts.get(key)??0)+1;if(copy>4)throw Error('Four-copy limit');counts.set(key,copy);const record=number==='ST8-003'?raw:getCardPoolEntry(number);if(!record)throw Error('Original card required');return createCard(record,owner,copy)}
 const filler=(count:number,owner:PlayerId)=>{const cards:GameCard[]=[];if(count===0)return cards;for(const record of getAllCardPoolEntries()){if(record.variant||record.type==='extra'||hasFlipAbility(record)||(counts.get(owner+':'+record.baseCardNumber)??0)>=4)continue;cards.push(card(record.baseCardNumber,owner));if(cards.length===count)return cards}throw Error('Insufficient original cards')}
 const battle=(number:string,owner:PlayerId):CookieInBattle=>{const source=card(number,owner);if(source.type!=='cookie')throw Error('Cookie required');return {card:source,hpCards:filler(source.hp,owner),rested:false,battleEntryId:source.instanceId+':entry'}}
 const state=createGame({id:'player-one',name:'ST8-003 實體驗收',deck:createOfficialRedStarterDeck('player-one')},{id:'player-two',name:'實體對手',deck:createOfficialRedStarterDeck('player-two')},'player-one',cards=>cards)
 state.status='playing';state.phase='main';state.turnNumber=3
 for(const p of Object.values(state.players)){p.deck=[];p.hand=[];p.supportArea=[];p.breakArea=[];p.discardPile=[];p.battleArea=[];p.stage=null;p.startingCookieSelected=true}
 const own=state.players['player-one'],foe=state.players['player-two']
 own.battleArea=[battle('ST8-003','player-one')];foe.battleArea=[battle('BS12-059','player-two'),battle('ST1-005','player-two')]
 const colors:Record<string,string>={red:'ST1-020',yellow:'ST2-020',green:'ST3-020',blue:'ST9-016',purple:'ST10-019',black:'BS12-105'}
 const supportNumbers=scenario.startsWith('color-')?Array<string>(3).fill(colors[scenario.slice(6)]):['ST1-020','ST2-020','ST3-020']
 own.supportArea=supportNumbers.map((number,index)=>({card:card(number,'player-one'),rested:scenario==='rested-energy'&&index===2}))
 if(scenario==='no-energy')own.discardPile.push(...own.supportArea.splice(0).map(s=>s.card))
 if(scenario==='rested-source')own.battleArea[0].rested=true
 if(scenario==='wrong-phase')state.phase='support'
 if(scenario==='first-turn')state.turnNumber=1
 if(scenario==='play'){const source=own.battleArea.shift()!;own.hand.push(source.card);own.deck.push(...source.hpCards);own.battleArea.push(battle('ST1-011','player-one'))}
 for(const id of ['player-one','player-two'] as const)state.players[id].deck.push(...filler(60-zones(state,id).length,id))
 for(const id of ['player-one','player-two'] as const){const cards=zones(state,id);if(cards.length!==60||new Set(cards.map(c=>c.instanceId)).size!==60)throw Error('Original sixty-card identities');for(const c of cards)if(cards.filter(x=>x.id===c.id).length>4)throw Error('Four-copy limit')}
 return state
}
