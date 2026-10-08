import {expect,it} from 'vitest'
import {readFileSync,readdirSync} from 'node:fs'
import {createBs12FinalPhysicalDemoState,BS12_FINAL_PHYSICAL_SCENARIOS,createCardCheckDemoState,createCardNegativeDemoState,parseTestStateConfig,createBs12TailPhysicalDemoState} from './demo'
import {convertOfficialCardToGameCard,convertOfficialCardToExtraDeckCard} from '../cards/official-card-adapter'
import {materializeExtraDeckCookie} from './extra-deck'
import {applyGameCommand} from './commands'
import {getEffectiveAttack,getEffectiveAttackBreakdown} from './effects/combat'
import {getOptionalCostAttackPrompt} from '../components/modals/optionalCostAttackPrompt'
import {getEffectSelectionCandidates} from './effects'
import {printed,entry,extraScene as extraHelperScene,attest as helperAttest} from './bs12-final-physical-test-helpers'
import type {OfficialCardRecord} from '../cards/types'
import type {GameState,GameCard,ExtraDeckCard} from './types'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
const records:OfficialCardRecord[]=['data/cards/official-festival-arena-bs12.en.json',...readdirSync('data/cards').filter(p=>p.endsWith('.json')).map(p=>'data/cards/'+p)].flatMap(p=>JSON.parse(readFileSync(p,'utf8')).cards)
const attest=(s:GameState)=>{
 const globalIds:string[]=[]
 for(const p of Object.values(s.players)){
  const cards:(GameCard|ExtraDeckCard)[]=[...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(c=>c.card),...p.battleArea.flatMap(c=>[c.card,...c.hpCards,...(c.equippedCards??[]),...(c.awakenedUnderlay??[])]),...(p.extraDeck??[]),...(p.stage?[p.stage.card]:[])]
  for(const id of new Set(cards.map(c=>c.id)))expect(cards.filter(c=>c.id===id).length).toBeLessThanOrEqual(4)
  for(const c of cards){
   const r=records.find(r=>r.baseCardNumber===c.id&&r.imageUrl===c.imageUrl);expect(r,'original printed record '+c.instanceId).toBeDefined();if(!r)throw Error(c.id)
   if(r.type==='extra'){const x=convertOfficialCardToExtraDeckCard(r,'identity');if(x.status!=='converted')throw Error('original EXTRA');const exact={...x.extraDeckCard,instanceId:c.instanceId};expect(c).toEqual(c.type==='extra'?exact:materializeExtraDeckCookie(exact))}
   else{const x=convertOfficialCardToGameCard(r,'identity');if(x.status!=='converted')throw Error('original main');expect(c).toEqual({...x.gameCard,instanceId:c.instanceId})}
   globalIds.push(c.instanceId)
  }
  expect(p.battleArea.length).toBeLessThanOrEqual(2)
  for(const c of p.battleArea)expect(c.hpCards).toHaveLength(c.card.hp)
 }
 expect(new Set(globalIds).size).toBe(globalIds.length)
}
for(const number of ['BS12-109','BS12-109@1','BS12-109@2','BS12-110','BS12-110@1','BS12-111','BS12-111@1','BS12-111@2','BS12-111@3','BS12-112','BS12-112@1'] as const){
 const base=number.split('@')[0] as keyof typeof BS12_FINAL_PHYSICAL_SCENARIOS
 for(const scenario of BS12_FINAL_PHYSICAL_SCENARIOS[base])it(number+' '+scenario+' every zone uses unmodified original print, unique instance and full startingHP',()=>{attest(createBs12FinalPhysicalDemoState(number,scenario))})
 for(const negative of [false,true])it(number+' generic effect-specific '+(negative?'negative':'positive')+' uses actual printed scene',()=>{
  const scenario=negative?base==='BS12-109'?'attack-wrong-energy':base==='BS12-110'?'two-black':base==='BS12-111'?'three-support':'special-no-skill':'positive'
  expect(parseTestStateConfig('?test-state='+(negative?'card-negative:':'card:')+number,'localhost')).toEqual({kind:'bs12-final',cardNumber:number,scenario})
  const actual=negative?createCardNegativeDemoState(number):createCardCheckDemoState(number);attest(actual);expect(actual).toEqual(createBs12FinalPhysicalDemoState(number,scenario))
 })
}
{
const records:OfficialCardRecord[]=[...candidate.cards as OfficialCardRecord[],...readdirSync('data/cards').filter(p=>p.endsWith('.json')).flatMap(p=>JSON.parse(readFileSync('data/cards/'+p,'utf8')).cards)]
const printed=(n:string,id:string):GameCard=>{const r=records.find(r=>r.cardNumber===n)!;const c=convertOfficialCardToGameCard(r,id);if(c.status!=='converted')throw Error(n);return {...c.gameCard,instanceId:id}}
const entry=(n:string,id:string)=>{const card=printed(n,id);if(card.type!=='cookie')throw Error(n);return {card,hpCards:Array.from({length:card.hp},(_,i)=>printed(['BS12-009','BS12-027','BS12-011','BS12-031','BS12-046'][i],id+'-hp-'+i)),rested:false,battleEntryId:id+':entry'}}
const scene=(number:string,scenario='positive'):GameState=>{
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
const attest=(s:GameState)=>{
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
for(const number of ['BS12-111','BS12-111@1','BS12-111@2','BS12-111@3']){
 for(const scenario of ['positive','non-arena'])it(number+' '+scenario+' actual EXTRA entry and selective aura',()=>{
  const before=scene(number,scenario);attest(before);const extra=before.players['player-one'].extraDeck![0],s=applyGameCommand(before,{kind:'play-extra-deck-cookie',playerId:'player-one',instanceId:extra.instanceId});attest(s)
  const source=s.players['player-one'].battleArea.find(c=>c.card.instanceId===extra.instanceId)!,witness=s.players['player-one'].battleArea.find(c=>c.card.instanceId==='physical-witness')!
  expect(source.hpCards).toHaveLength(5);expect(s.players['player-one'].extraDeck).toHaveLength(0);expect(s.players['player-one'].deck).toHaveLength(before.players['player-one'].deck.length-5)
  expect(getEffectiveAttack(s,source.card.instanceId)).toBe(2)
  const expected=witness.card.attack+(scenario==='positive'?1:0);expect(getEffectiveAttack(s,witness.card.instanceId)).toBe(expected);expect(getEffectiveAttackBreakdown(s,witness.card.instanceId).effective).toBe(expected)
  expect(s.players['player-two'].supportArea).toEqual(before.players['player-two'].supportArea);expect(s.commandLog?.at(-1)?.commandKind).toBe('play-extra-deck-cookie')
 })
 for(const scenario of ['three-support','no-special','hand-only','trash-only','break-only','opponent-only'])it(number+' '+scenario+' rejects actual unmet EXTRA requirement without mutation',()=>{
  const s=scene(number,scenario),before=structuredClone(s);attest(s);expect(()=>applyGameCommand(s,{kind:'play-extra-deck-cookie',playerId:'player-one',instanceId:s.players['player-one'].extraDeck![0].instanceId})).toThrow();expect(s).toEqual(before)
 })
}
for(const number of ['BS12-111','BS12-111@1','BS12-111@2','BS12-111@3'])for(const second of [true,false])it(number+' actual KK attack gains source HP only when starting second '+second,()=>{
 const before=scene(number);before.firstPlayerId=second?'player-two':'player-one';const id=before.players['player-one'].extraDeck![0].instanceId
 let s=applyGameCommand(before,{kind:'play-extra-deck-cookie',playerId:'player-one',instanceId:id})
 s=applyGameCommand(s,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:id,targetInstanceId:'future-enemy',supportPaymentIds:['physical-payment-0','physical-payment-1']})
 s=applyGameCommand(s,{kind:'skip-trap',playerId:'player-two'})
 while(s.pendingBattle?.stage==='damage')s=applyGameCommand(s,{kind:'resolve-next-damage',playerId:'player-two'})
 s=applyGameCommand(s,{kind:'resolve-attack-effect',playerId:'player-one',targetIds:[id]});attest(s)
 expect(s.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
 expect(s.players['player-one'].battleArea.find(c=>c.card.instanceId===id)?.hpCards).toHaveLength(second?6:5)
 expect(s.players['player-one'].supportArea.map(c=>c.rested)).toEqual([true,true])
})
}
{
const scene=(number:string,scenario='positive'):GameState=>{
 const s=extraHelperScene('BS12-111'),one=s.players['player-one'];one.extraDeck=[];one.battleArea=[entry(number,'physical-source'),entry('BS12-097','physical-companion')];one.hand=[];one.discardPile=[];one.breakArea=[]
 if(number.startsWith('BS12-110')){
  one.supportArea=['BS12-103','BS12-105',scenario==='mixed'?'ST4-001':'BS12-097'].slice(0,scenario==='two'?2:3).map((n,i)=>({card:printed(n,'physical-black-support-'+i),rested:true}));one.battleArea[0].rested=scenario==='rested'
 }else{
  one.supportArea=[0,1,2].map(i=>({card:printed('BS12-097','physical-black-support-'+i),rested:false}))
  one.battleArea[0].hpCards=['BS12-095','BS12-003','BS12-103','BS12-108'].map((n,i)=>printed(n,'physical-source-hp-'+i))
  one.discardPile=['BS12-019','BS12-103','BS11-111'].map((n,i)=>printed(n,'physical-old-trash-'+i))
  if(scenario.startsWith('special')){one.battleArea=[entry(scenario==='special-no-skill'?'BS12-097':scenario==='special-wrong-level'?'BS11-111':'BS12-095','physical-special-cost')];one.hand=[printed(number,'physical-source')]}
 }
 return s
}
const begin=(s:GameState)=>applyGameCommand(s,{kind:'begin-activate-skill',playerId:'player-one',sourceInstanceId:'physical-source',trigger:'activate',paymentIds:[],discardHandIds:[],targetIds:[]})
const then=(number:string)=>{
 let s=scene(number);helperAttest(s)
 s=applyGameCommand(s,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:'physical-source',targetInstanceId:'future-enemy',supportPaymentIds:s.players['player-one'].supportArea.map(c=>c.card.instanceId)})
 s=applyGameCommand(s,{kind:'skip-trap',playerId:'player-two'})
 while(s.pendingBattle?.stage==='damage')s=applyGameCommand(s,{kind:'resolve-next-damage',playerId:'player-two'})
 return applyGameCommand(s,{kind:'resolve-attack-effect',playerId:'player-one',targetIds:[]})
}
for(const number of ['BS12-110','BS12-110@1']){
 for(const rested of [false,true])for(const drawCount of [0,1])it(number+' actual three rested black CARD supports selfTrash then draw '+drawCount+' sourceRested '+rested,()=>{
  const before=scene(number,rested?'rested':'positive');helperAttest(before);const departed=before.players['player-one'].battleArea[0],paid=begin(before)
  expect(paid.players['player-one'].battleArea.map(c=>c.card.instanceId)).toEqual(['physical-companion'])
  expect(paid.players['player-one'].discardPile).toEqual([departed.card,...departed.hpCards]);expect(paid.players['player-one'].breakArea).toEqual([])
  const done=applyGameCommand(paid,{kind:'resolve-draw-up-to',playerId:'player-one',drawCount});helperAttest(done)
  expect(done.players['player-one'].hand).toEqual(before.players['player-one'].deck.slice(0,drawCount));expect(done.players['player-one'].deck).toEqual(before.players['player-one'].deck.slice(drawCount));expect(done.players['player-one'].supportArea).toEqual(before.players['player-one'].supportArea)
 })
 for(const scenario of ['two','mixed'])it(number+' rejects unmet actual black support count '+scenario,()=>{const s=scene(number,scenario),before=structuredClone(s);helperAttest(s);expect(()=>begin(s)).toThrow();expect(s).toEqual(before)})
}
for(const number of ['BS12-112','BS12-112@1']){
 it(number+' Special Play trashes actual blackLV1Special Cookie with full HP and enters with printed4HP',()=>{
  const s=scene(number,'special'),before=structuredClone(s),cost=s.players['player-one'].battleArea[0]
  const after=applyGameCommand(s,{kind:'deploy-cookie',playerId:'player-one',instanceId:'physical-source',specialPlayCookieInstanceIds:['physical-special-cost']});helperAttest(after)
  expect(after.players['player-one'].battleArea).toHaveLength(1);expect(after.players['player-one'].battleArea[0].hpCards).toHaveLength(4);expect(after.players['player-one'].discardPile).toEqual([...before.players['player-one'].discardPile,cost.card,...cost.hpCards]);expect(after.players['player-one'].breakArea).toEqual([]);expect(after.players['player-one'].deck).toEqual(before.players['player-one'].deck.slice(4));expect(after.players['player-one'].hand).toEqual([])
 })
 for(const scenario of ['special-no-skill','special-wrong-level'])it(number+' rejects actual illegal Special cost '+scenario,()=>{const s=scene(number,scenario),before=structuredClone(s);helperAttest(s);expect(()=>applyGameCommand(s,{kind:'deploy-cookie',playerId:'player-one',instanceId:'physical-source',specialPlayCookieInstanceIds:['physical-special-cost']})).toThrow();expect(s).toEqual(before)})
 for(const ids of [[],['physical-source-hp-0'],['physical-source-hp-0','physical-source-hp-1']])it(number+' actual source+HP cost makes printedLV1Arena HP cards recoverable '+ids.length,()=>{
  const before=then(number),source=before.players['player-one'].battleArea.find(c=>c.card.instanceId==='physical-source')!
  const paid=applyGameCommand(before,{kind:'resolve-optional-cost-attack',playerId:'player-one',action:'pay',paymentIds:[],discardCardIds:[],targetIds:[]})
  const done=applyGameCommand(paid,{kind:'resolve-ability-effect',playerId:'player-one',targetIds:ids});helperAttest(done)
  expect(done.players['player-one'].hand.map(c=>c.instanceId)).toEqual(ids);expect(done.players['player-one'].battleArea.map(c=>c.card.instanceId)).toEqual(['physical-companion']);expect(done.players['player-one'].breakArea).toEqual([])
  expect(done.players['player-one'].discardPile).toEqual([...before.players['player-one'].discardPile,source.card,...source.hpCards].filter(c=>!ids.includes(c.instanceId)))
  expect(done.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
 })
 it(number+' UI lists actual LV1Arena cards from sourceHP AFTER selfTrash payment',()=>{
  const s=then(number),before=structuredClone(s),prompt=getOptionalCostAttackPrompt(s,'player-one')
  expect(prompt?.targetCandidates).toEqual([]);expect(prompt?.needsTarget).toBe(false);expect(s).toEqual(before)
  const paid=applyGameCommand(s,{kind:'resolve-optional-cost-attack',playerId:'player-one',action:'pay',targetIds:[],discardCardIds:[],paymentIds:[]})
  const pending=paid.pendingAbilityEffect!
  expect(getEffectSelectionCandidates(paid,{sourcePlayerId:'player-one',sourceInstanceId:pending.sourceInstanceId},pending.effects[pending.effectIndex]).map(c=>c.instanceId)).toEqual(['physical-source-hp-0','physical-source-hp-1','physical-source-hp-3'])
 })
 for(const ids of [['physical-old-trash-0'],['physical-old-trash-1'],['physical-old-trash-2'],['physical-source'],['physical-source-hp-0','physical-source-hp-0'],['physical-source-hp-0','physical-source-hp-1','physical-source-hp-3']])it(number+' rejects actual nonLV1Arena or duplicate/excess recovery '+ids.join(','),()=>{
  const s=applyGameCommand(then(number),{kind:'resolve-optional-cost-attack',playerId:'player-one',action:'pay',targetIds:[],paymentIds:[],discardCardIds:[]}),before=structuredClone(s);expect(()=>applyGameCommand(s,{kind:'resolve-ability-effect',playerId:'player-one',targetIds:ids})).toThrow();expect(s).toEqual(before)
 })
 it(number+' skips Then without any source departure or recovery',()=>{const before=then(number),s=applyGameCommand(before,{kind:'resolve-optional-cost-attack',playerId:'player-one',action:'skip'});helperAttest(s);expect(s.players).toEqual(before.players)})
}
}
