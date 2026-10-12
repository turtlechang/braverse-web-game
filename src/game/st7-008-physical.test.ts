import {describe,expect,it} from 'vitest'
import {getAllCardPoolEntries,getCardPoolEntry,hasFlipAbility} from './card-pool'
import {createCard,createOfficialRedStarterDeck} from './starter-deck'
import {createGame} from './setup'
import {applyGameCommand as apply} from './commands'
import {takeAiStep} from './ai'
import type {GameCard,PlayerId,CookieInBattle,GameState} from './types'
const raw=getCardPoolEntry('ST7-008')
if(!raw)throw Error('Formal original required')
const fixture=(witness='break',lethal=false,boundary='')=>{
 const counts=new Map<string,number>()
 const card=(number:string,owner:PlayerId):GameCard=>{
  const record=number==='ST7-008'?raw:getCardPoolEntry(number);if(!record)throw Error('Original '+number)
  const key=owner+':'+number,copy=(counts.get(key)??0)+1;if(copy>4)throw Error('Four-copy limit')
  counts.set(key,copy);return createCard(record,owner,copy)
 }
 const filler=(amount:number,owner:PlayerId)=>{
  const result:GameCard[]=[]
  for(const record of getAllCardPoolEntries()){
   if(record.variant||record.type==='extra'||hasFlipAbility(record))continue
   while((counts.get(owner+':'+record.baseCardNumber)??0)<4&&result.length<amount)result.push(card(record.baseCardNumber,owner))
   if(result.length===amount)return result
  }
  throw Error('Original filler insufficient')
 }
 const battle=(number:string,owner:PlayerId):CookieInBattle=>{
  const cookie=card(number,owner);if(cookie.type!=='cookie')throw Error('Original Cookie')
  return {card:cookie,hpCards:filler(cookie.hp,owner),rested:false,battleEntryId:cookie.instanceId+':entry'}
 }
 const state=createGame({id:'player-one',name:'Original Elder',deck:createOfficialRedStarterDeck('player-one')},{id:'player-two',name:'Original opponent',deck:createOfficialRedStarterDeck('player-two')},'player-one',cards=>cards)
 state.status='playing';state.phase='main';state.turnNumber=3
 for(const p of Object.values(state.players)){p.deck=[];p.hand=[];p.discardPile=[];p.breakArea=[];p.supportArea=[];p.battleArea=[];p.extraDeck=[];p.stage=null;p.startingCookieSelected=true}
 const own=state.players['player-one'],foe=state.players['player-two']
 own.hand=[card('ST7-008','player-one')];own.battleArea=[battle('ST1-011','player-one')]
 own.supportArea=['ST2-018','ST2-019','ST2-020'].map(number=>({card:card(number,'player-one'),rested:false}))
 const low=card('ST7-004','player-one');if(low.type!=='cookie')throw Error('Original yellow LV1')
 own.breakArea=[low]
 if(witness==='break'){const tree=card('BS4-038','player-one');if(tree.type!=='cookie')throw Error('Tree');own.breakArea.push(tree)}
 if(witness==='battle')own.battleArea=[battle('BS4-038','player-one')]
 if(witness==='wrong-name'){const other=card('ST7-003','player-one');if(other.type!=='cookie')throw Error('Other');own.breakArea.push(other)}
 if(witness==='opponent')foe.battleArea.push(battle('BS4-038','player-two'))
 if(witness==='hand')own.hand.push(card('BS4-038','player-one'))
 if(witness==='trash')own.discardPile.push(card('BS4-038','player-one'))
 if(witness==='support')own.supportArea.push({card:card('BS4-038','player-one'),rested:false})
 foe.battleArea.unshift(battle(boundary==='faint'?'BS6-017':'ST6-006','player-two'))
 if(!lethal&&witness!=='opponent')foe.battleArea.push(battle('ST1-011','player-two'))
 if(boundary==='departed-flip'){
  foe.supportArea=['ST1-018','ST1-019','ST1-020'].map(number=>({card:card(number,'player-two'),rested:false}))
  const old=foe.battleArea[0].hpCards.pop();if(!old)throw Error('Original HP');foe.discardPile.push(old)
  foe.battleArea[0].hpCards.push(card('BS1-002','player-two'));foe.hand.push(card('ST1-020','player-two'))
 }
 if(lethal)for(let i=0;i<3;i++){const cookie=card('ST7-003','player-two');if(cookie.type!=='cookie')throw Error('LV3');foe.breakArea.push(cookie)}
 for(const owner of ['player-one','player-two'] as const){const p=state.players[owner],used=p.hand.length+p.discardPile.length+p.breakArea.length+p.supportArea.length+p.battleArea.reduce((sum,c)=>sum+1+c.hpCards.length,0);p.deck=filler(60-used,owner)}
 if(boundary==='refresh')own.discardPile.push(...own.deck.splice(3))
 return {state,source:own.hand[0].instanceId,low:low.instanceId,target:foe.battleArea[0].card.instanceId}
}
const deploy=(f:ReturnType<typeof fixture>)=>apply(f.state,{kind:'deploy-cookie',playerId:'player-one',instanceId:f.source})
const recovery=(state:GameState,source:string,targets:string[])=>apply(apply(state,{kind:'begin-activate-skill',playerId:'player-one',sourceInstanceId:source,trigger:'on-play',paymentIds:[]}),{kind:'resolve-ability-effect',playerId:'player-one',targetIds:targets})
const attack=(state:GameState,source:string,target:string)=>{
 let next=apply(apply(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:source,targetInstanceId:target,supportPaymentIds:state.players['player-one'].supportArea.map(s=>s.card.instanceId)}),{kind:'skip-trap',playerId:'player-two'})
 for(let i=0;i<20&&next.status==='playing'&&next.pendingBattle;i++){
  const battle=next.pendingBattle
  if(battle.stage==='attack-effect')next=apply(next,{kind:'resolve-attack-effect',playerId:'player-one',targetIds:[target]})
  else if(battle.stage==='damage')next=apply(next,{kind:'resolve-next-damage',playerId:'player-two'})
  else throw Error('Unexpected actual battle pending '+battle.stage)
 }
 return next
}
describe('ST7-008 actual original deploy, recovery and attack parents',()=>{
 it.each(['break','battle','wrong-name','opponent','none','hand','trash','support'])('preserves sixty unique original cards with printed HP: %s',witness=>{
  const f=fixture(witness)
  for(const p of Object.values(f.state.players)){
   const cards=[...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(s=>s.card),...p.battleArea.flatMap(c=>[c.card,...c.hpCards])]
   expect(cards).toHaveLength(60);expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60)
   const counts=new Map<string,number>();for(const c of cards){counts.set(c.id,(counts.get(c.id)??0)+1);expect(c.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)}
   expect([...counts.values()].every(count=>count<=4)).toBe(true)
   for(const c of p.battleArea)expect(c.hpCards).toHaveLength(c.card.hp)
  }
 })
 it.each(['break','battle'])('real deployment offers free optional recovery with own %s Tree',witness=>{
  const f=fixture(witness),before=structuredClone(f.state),played=deploy(f)
  expect(played.pendingOnPlay?.sourceInstanceId).toBe(f.source)
  const next=recovery(played,f.source,[f.low])
  expect(next.players['player-one'].breakArea.some(c=>c.instanceId===f.low)).toBe(false)
  expect(next.players['player-one'].discardPile.some(c=>c.instanceId===f.low)).toBe(true)
  expect(next.players['player-one'].battleArea.at(-1)?.hpCards).toHaveLength(4)
  expect(next.players['player-one'].supportArea.every(s=>!s.rested)).toBe(true);expect(f.state).toEqual(before)
 })
 it.each([true,false])('recovery=%s independently determines original defender extra damage at Break4',recover=>{
  const f=fixture('break'),played=deploy(f)
  const ready=recovery(played,f.source,recover?[f.low]:[])
  const next=attack(ready,f.source,f.target)
  if(recover)expect(next.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
  else expect(next.players['player-two'].breakArea.some(c=>c.instanceId===f.target)).toBe(true)
  expect(next.pendingBattle).toBeNull()
 })
 it('retaining Break4 wins through real commands while recovering loses the immediate lethal',()=>{
  const f=fixture('break',true),played=deploy(f)
  const keep=attack(recovery(played,f.source,[]),f.source,f.target)
  const recover=attack(recovery(played,f.source,[f.low]),f.source,f.target)
  expect(keep.status).toBe('finished');expect(keep.result?.winnerId).toBe('player-one')
  expect(recover.status).toBe('playing');expect(recover.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
 })
 it('does not retarget Then after the original defender faints from ordinary damage',()=>{
  const f=fixture('break',false,'faint'),ready=recovery(deploy(f),f.source,[])
  const next=attack(ready,f.source,f.target)
  expect(next.players['player-two'].breakArea.some(c=>c.instanceId===f.target)).toBe(true)
  expect(next.players['player-two'].battleArea.map(c=>[c.card.id,c.hpCards.length])).toEqual([['ST1-011',2]])
  expect(next.pendingBattle).toBeNull()
  const automated=apply(ready,{kind:'attack',playerId:'player-one',attackerInstanceId:f.source,targetInstanceId:f.target,supportPaymentIds:ready.players['player-one'].supportArea.map(s=>s.card.instanceId)})
  expect(automated.players).toEqual(next.players)
 })
 it('resumes actual deployment HP after mandatory Refresh before offering free recovery',()=>{
  const f=fixture('break',false,'refresh'),played=deploy(f)
  expect(played.pendingRefresh?.playerId).toBe('player-one')
  const cookie=played.players['player-one'].discardPile.find(c=>c.type==='cookie'&&c.level===1)
  if(!cookie)throw Error('Original Refresh cost')
  const refreshed=apply(played,{kind:'refresh-deck',playerId:'player-one',cookieInstanceId:cookie.instanceId,shuffleSeed:70082026})
  expect(refreshed.pendingRefresh).toBeNull()
  expect(refreshed.players['player-one'].battleArea.find(c=>c.card.instanceId===f.source)?.hpCards).toHaveLength(4)
  const next=recovery(refreshed,f.source,[f.low])
  expect(next.players['player-one'].discardPile.some(c=>c.instanceId===f.low)).toBe(true)
  expect(next.pendingAbilityEffect??null).toBeNull()
 })
 it('keeps original defender Then after actual Kumiho FLIP faints the attacking source',()=>{
  const f=fixture('break',false,'departed-flip')
  let next=recovery(deploy(f),f.source,[])
  for(let i=0;!(next.activePlayerId==='player-two'&&next.phase==='main')&&i<12;i++)next=apply(next,{kind:'advance-phase',playerId:next.activePlayerId})
  next=apply(next,{kind:'declare-attack',playerId:'player-two',attackerInstanceId:f.target,targetInstanceId:f.source,supportPaymentIds:next.players['player-two'].supportArea.map(s=>s.card.instanceId)})
  next=apply(apply(next,{kind:'skip-trap',playerId:'player-one'}),{kind:'resolve-battle',playerId:'player-two'})
  expect(next.players['player-one'].battleArea.find(c=>c.card.instanceId===f.source)?.hpCards).toHaveLength(1)
  for(let i=0;!(next.activePlayerId==='player-one'&&next.phase==='main')&&i<12;i++)next=apply(next,{kind:'advance-phase',playerId:next.activePlayerId})
  next=apply(next,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:f.source,targetInstanceId:f.target,supportPaymentIds:next.players['player-one'].supportArea.map(s=>s.card.instanceId)})
  next=apply(apply(next,{kind:'skip-trap',playerId:'player-two'}),{kind:'resolve-next-damage',playerId:'player-two'})
  expect(next.pendingBattle?.revealedHpCard?.id).toBe('BS1-002')
  next=apply(next,{kind:'resolve-flip',playerId:'player-two',activate:true,discardHandIds:[next.players['player-two'].hand.find(c=>c.id==='ST1-020')!.instanceId],targetIds:[f.source]})
  for(let i=0;i<20;i++){
   if(next.pendingReplacement)next=apply(next,{kind:'skip-replacement',playerId:next.pendingReplacement.tasks[0].playerId})
   else if(next.pendingBattle?.stage==='damage')next=apply(next,{kind:'resolve-next-damage',playerId:'player-two'})
   else if(next.pendingBattle?.stage==='attack-effect')next=apply(next,{kind:'resolve-attack-effect',playerId:'player-one',targetIds:[f.target]})
   else break
  }
  expect(next.players['player-one'].breakArea.some(c=>c.instanceId===f.source)).toBe(true)
  expect(next.players['player-two'].battleArea.map(c=>[c.card.id,c.hpCards.length])).toEqual([['ST6-006',2],['ST1-011',2]])
  expect(next.pendingBattle).toBeNull()
 })
 it('automatic AI attack command binds mandatory extra damage to the original defender',()=>{
  const f=fixture('break',true),ready=recovery(deploy(f),f.source,[]),before=structuredClone(ready)
  const next=apply(ready,{kind:'attack',playerId:'player-one',attackerInstanceId:f.source,targetInstanceId:f.target,supportPaymentIds:ready.players['player-one'].supportArea.map(s=>s.card.instanceId)})
  expect(next.status).toBe('finished');expect(next.result?.winnerId).toBe('player-one');expect(ready).toEqual(before)
 })
 it('records current Lv5 decision at the real On Play lethal tradeoff without changing input',()=>{
  const f=fixture('break',true),played=deploy(f),before=structuredClone(played)
  const result=takeAiStep(played,'player-one',{level:5,seed:7008,searchNow:()=>0})
  expect(result.action).not.toBe('error')
  expect(played).toEqual(before)
 })
 it.each([3,4,5] as const)('Lv%s preserves the public immediate winning attack instead of optional Break recovery',level=>{
  const f=fixture('break',true),played=deploy(f),before=structuredClone(played)
  const result=takeAiStep(played,'player-one',{level,seed:7008,searchNow:()=>0})
  expect(result.state.players['player-one'].breakArea.map(c=>c.instanceId)).toContain(f.low)
  expect(attack(result.state,f.source,f.target).result?.winnerId).toBe('player-one')
  expect(played).toEqual(before)
 })
 it.each(['wrong-name','opponent','none','hand','trash','support'])('actual deployment does not recover using %s witness',witness=>{
  const f=fixture(witness),played=deploy(f)
  const result=takeAiStep(played,'player-one',{level:5,seed:7008,searchNow:()=>0})
  expect(result.state.players['player-one'].breakArea.map(c=>c.instanceId)).toContain(f.low)
  expect(result.state.players['player-one'].discardPile.map(c=>c.instanceId)).not.toContain(f.low)
 })
 it('rejects an original LV3 Tree as recovery target while preserving input',()=>{
  const f=fixture('break'),played=deploy(f),begun=apply(played,{kind:'begin-activate-skill',playerId:'player-one',sourceInstanceId:f.source,trigger:'on-play',paymentIds:[]}),before=structuredClone(begun)
  const tree=begun.players['player-one'].breakArea.find(c=>c.id==='BS4-038');if(!tree)throw Error('Original Tree')
  expect(()=>apply(begun,{kind:'resolve-ability-effect',playerId:'player-one',targetIds:[tree.instanceId]})).toThrow();expect(begun).toEqual(before)
 })
 it.each(['not-lethal','rested-energy','surplus-break','rested-attacker'])('keeps beneficial recovery when winning attack is unavailable: %s',scenario=>{
  const f=fixture('break',scenario!=='not-lethal'),played=deploy(f)
  if(scenario==='rested-energy')played.players['player-one'].supportArea.forEach(s=>{s.rested=true})
  if(scenario==='rested-attacker'){const source=played.players['player-one'].battleArea.find(c=>c.card.instanceId===f.source);if(!source)throw Error('Source');source.rested=true}
  if(scenario==='surplus-break'){
   const index=played.players['player-one'].deck.findIndex(c=>c.type==='cookie'&&c.level===1),extra=played.players['player-one'].deck.splice(index,1)[0]
   if(extra?.type!=='cookie'||extra.level!==1)throw Error('Original LV1 required');played.players['player-one'].breakArea.push(extra)
  }
  const result=takeAiStep(played,'player-one',{level:5,seed:7008,searchNow:()=>0})
  expect(result.state.players['player-one'].breakArea.map(c=>c.instanceId)).not.toContain(f.low)
  expect(result.state.players['player-one'].discardPile.map(c=>c.instanceId)).toContain(f.low)
 })
 it('does not change the decision when actual hidden deck and HP cards are reordered',()=>{
  const f=fixture('break',true),played=deploy(f),permuted=structuredClone(played)
  permuted.players['player-two'].deck.reverse();permuted.players['player-two'].battleArea[0].hpCards.reverse()
  const options={level:5 as const,seed:7008,searchNow:()=>0}
  const a=takeAiStep(played,'player-one',options),b=takeAiStep(permuted,'player-one',options)
  expect(a.action).toBe(b.action);expect(a.effectSelections).toEqual(b.effectSelections)
  expect(a.state.players['player-one'].breakArea.map(c=>c.instanceId)).toEqual(b.state.players['player-one'].breakArea.map(c=>c.instanceId))
 })
})
