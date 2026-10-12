import {describe,it,expect} from 'vitest'
import document from '../../data/candidates/st6-st10/official-st7.en.json'
import {createSt6012PreviewState as foundation} from './st6-012-demo'
import {zones} from './st7-014-demo'
import {createCard} from './starter-deck'
import {getCardPoolEntry} from './card-pool'
import {applyGameCommand as apply} from './commands'
import {getTrapCandidates} from './battle'
import {getEffectiveAttack} from './effects'
import {takeAiStep} from './ai'
import type {GameState,GameCard,PlayerId} from './types'
import type {GameCommand} from './commands'
import type {OfficialCardRecord} from '../cards/types'
export const fixture=(scenario='break4',prepareOnly=false):GameState=>{
 if(scenario.startsWith('ai-')){
  const state=JSON.parse(JSON.stringify(fixture(scenario.slice(3),true)).replaceAll('player-one','player-swap').replaceAll('player-two','player-one').replaceAll('player-swap','player-two')) as GameState
  if(prepareOnly)return state
  return apply(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:state.players['player-one'].battleArea[1].card.instanceId,targetInstanceId:state.players['player-two'].battleArea[1].card.instanceId,supportPaymentIds:state.players['player-one'].supportArea.slice(0,3).map(s=>s.card.instanceId)})
 }
 const state=foundation('positive'),own=state.players['player-one'],foe=state.players['player-two']
 const original=(id:string,owner:PlayerId):GameCard=>{
  const raw=(getCardPoolEntry(id)??document.cards.find(c=>c.cardNumber===id)) as OfficialCardRecord|undefined;if(!raw)throw Error('Original '+id)
  const used=new Set(zones(state,owner).map(c=>c.instanceId))
  for(let copy=1;copy<=4;copy++){const card=createCard(raw,owner,copy);if(!used.has(card.instanceId))return card}
  throw Error('Four-copy limit '+id)
 }
 own.deck.shift();own.hand=[original('ST7-017','player-one')];own.name='ST7-017 原卡逐卡驗收'
 const addBreak=(id:string,owner:PlayerId)=>{const card=original(id,owner);if(card.type!=='cookie')throw Error('Original Cookie');state.players[owner].deck.shift();state.players[owner].breakArea.push(card)}
 if(scenario!=='break0')addBreak('ST7-010',scenario==='opponent-break4'?'player-two':'player-one')
 if(!['break0','break3'].includes(scenario))addBreak('ST1-011',scenario==='opponent-break4'?'player-two':'player-one')
 if(scenario==='break5')addBreak('ST1-011','player-one')
 if(scenario==='hand-level4'){own.hand.push(...own.breakArea);own.breakArea=[]}
 if(scenario==='trash-level4'){own.discardPile.push(...own.breakArea);own.breakArea=[]}
 if(scenario==='rested-energy')own.supportArea[3].rested=true
 if(scenario==='wrong-energy')own.supportArea[3].card=original('ST1-020','player-one')
 if(scenario==='main'||scenario==='wrong-phase'){if(scenario==='wrong-phase')state.phase='support';return state}
 state.activePlayerId='player-two'
 for(const owner of ['player-one','player-two'] as const){const cards=zones(state,owner);if(cards.length!==60||new Set(cards.map(c=>c.instanceId)).size!==60)throw Error('Original sixty');for(const card of cards)if(cards.filter(c=>c.id===card.id).length>4)throw Error('Four copies');for(const battle of state.players[owner].battleArea)if(battle.hpCards.length!==battle.card.hp)throw Error('Original printed HP')}
 if(prepareOnly)return state
 return apply(state,{kind:'declare-attack',playerId:'player-two',attackerInstanceId:foe.battleArea[1].card.instanceId,targetInstanceId:own.battleArea[1].card.instanceId,supportPaymentIds:foe.supportArea.slice(0,3).map(s=>s.card.instanceId)})
}
export const command=(state:GameState,targets?:string[]):GameCommand=>({kind:'play-trap',playerId:'player-one',trapInstanceId:state.players['player-one'].hand[0].instanceId,paymentIds:[state.players['player-one'].supportArea[3].card.instanceId],targetIds:[],effectTargets:[targets??[state.players['player-two'].battleArea[1].card.instanceId]]})
const inventory=(state:GameState)=>{for(const owner of ['player-one','player-two'] as const){const cards=zones(state,owner);expect(cards).toHaveLength(60);expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60);for(const c of cards){expect(cards.filter(x=>x.id===c.id).length).toBeLessThanOrEqual(4);expect(c.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)}}}
describe('ST7-017 actual trap and conditional same-target reduction',()=>{
 it('reduces Elder Faerie ordinary3 to1 while preserving its printed Then effect damage1',()=>{
  let state=fixture('break4',true)
  const foe=state.players['player-two'],own=state.players['player-one']
  const original=(id:string)=>{const raw=getCardPoolEntry(id);if(!raw)throw Error('Original '+id);const used=new Set(zones(state,'player-two').map(c=>c.instanceId));for(let copy=1;copy<=4;copy++){const c=createCard(raw,'player-two',copy);if(!used.has(c.instanceId))return c}throw Error('Four copies')}
  const elder=original('ST7-008');if(elder.type!=='cookie'||elder.hp!==4||elder.attack!==3)throw Error('Printed Elder')
  foe.battleArea[1].card=elder;foe.battleArea[1].battleEntryId=elder.instanceId+':entry'
  for(const [index,id] of ['ST2-018','ST2-019','ST2-020'].entries())foe.supportArea[index].card=original(id)
  for(const id of ['ST7-010','ST1-011']){const c=original(id);if(c.type!=='cookie')throw Error('Original Break Cookie');foe.deck.shift();foe.breakArea.push(c)}
  inventory(state)
  state=apply(state,{kind:'declare-attack',playerId:'player-two',attackerInstanceId:elder.instanceId,targetInstanceId:own.battleArea[1].card.instanceId,supportPaymentIds:foe.supportArea.slice(0,3).map(s=>s.card.instanceId)})
  state=apply(state,command(state));expect(state.pendingBattle?.remainingDamage).toBe(1)
  state=apply(state,{kind:'resolve-next-damage',playerId:'player-one'})
  expect(state.players['player-one'].battleArea[1].hpCards).toHaveLength(5);expect(state.pendingBattle?.stage).toBe('attack-effect')
  state=apply(state,{kind:'resolve-attack-effect',playerId:'player-two',targetIds:[own.battleArea[1].card.instanceId]})
  expect(state.players['player-one'].battleArea[1].hpCards).toHaveLength(4);inventory(state)
 })
 it.each(['ai-break0','ai-break4','ai-rested-energy','ai-wrong-energy'])('prepares actual attack parent before AI response: %s',scenario=>{
  const state=fixture(scenario),prepared=fixture(scenario,true),entry=state.commandLog?.[0]
  expect(entry?.payload.kind).toBe('declare-attack');expect(prepared.commandLog??[]).toEqual([])
  const command:GameCommand={kind:'declare-attack',playerId:'player-one',attackerInstanceId:prepared.players['player-one'].battleArea[1].card.instanceId,targetInstanceId:prepared.players['player-two'].battleArea[1].card.instanceId,supportPaymentIds:prepared.players['player-one'].supportArea.slice(0,3).map(s=>s.card.instanceId)}
  expect(apply(prepared,command)).toEqual(state);inventory(state)
  const decision=takeAiStep(state,'player-two',{level:5,searchNow:()=>0})
  expect(decision.state.players['player-two'].hand.some(c=>c.id==='ST7-017')).toBe(scenario.includes('energy'))
  expect(decision.state.attackModifiers.map(m=>m.amount)).toEqual(scenario.includes('energy')?[]:scenario==='ai-break4'?[-1,-1]:[-1])
 })
 it.each([3,4,5].flatMap(level=>['break0','break3','break4','rested-energy','wrong-energy'].map(scenario=>({level:level as 3|4|5,scenario}))))('Lv$level uses legal reduction and preserves unavailable payment: $scenario',({level,scenario})=>{
  const state=fixture(scenario),before=structuredClone(state),decision=takeAiStep(state,'player-one',{level,searchNow:()=>0}),next=decision.state
  const legal=!['rested-energy','wrong-energy'].includes(scenario)
  expect(next.attackModifiers.map(m=>[m.targetInstanceId,m.amount])).toEqual(!legal?[]:scenario==='break4'?[[state.players['player-two'].battleArea[1].card.instanceId,-1],[state.players['player-two'].battleArea[1].card.instanceId,-1]]:[[state.players['player-two'].battleArea[1].card.instanceId,-1]])
  expect(next.players['player-one'].hand.some(c=>c.id==='ST7-017')).toBe(!legal)
  if(!legal)expect(next.players['player-one'].supportArea).toEqual(state.players['player-one'].supportArea)
  expect(state).toEqual(before);inventory(next)
 })
 it.each(['break0','break3','break4','break5','hand-level4','trash-level4','opponent-break4'])('always permits base -1, own Break4 adds same-target -1: %s',scenario=>{
  const state=fixture(scenario),before=structuredClone(state),own=state.players['player-one'],id=state.players['player-two'].battleArea[1].card.instanceId
  inventory(state);expect(getTrapCandidates(state,'player-one').map(c=>c.id)).toContain('ST7-017')
  const next=apply(state,command(state)),bonus=['break4','break5'].includes(scenario)
  expect(next.attackModifiers.map(m=>[m.targetInstanceId,m.amount,m.expiresAfterTurn])).toEqual(bonus?[[id,-1,state.turnNumber],[id,-1,state.turnNumber]]:[[id,-1,state.turnNumber]])
  expect(next.pendingBattle?.remainingDamage).toBe(bonus?2:3);expect(next.players['player-one'].supportArea.filter(s=>s.rested)).toHaveLength(1)
  expect(next.players['player-one'].battleArea).toEqual(own.battleArea);expect(next.players['player-one'].discardPile.some(c=>c.id==='ST7-017')).toBe(true)
  expect(state).toEqual(before);inventory(next)
 })
 it.each(['break0','break4'])('zero costs Y without a new Then target: %s',scenario=>{const s=fixture(scenario),before=structuredClone(s),next=apply(s,command(s,[]));expect(next.attackModifiers).toEqual([]);expect(next.pendingBattle?.remainingDamage).toBe(4);expect(next.players['player-one'].supportArea[3].rested).toBe(true);expect(s).toEqual(before);inventory(next)})
 it('may reduce another opponent without reducing the current attacker',()=>{const s=fixture(),id=s.players['player-two'].battleArea[0].card.instanceId,next=apply(s,command(s,[id]));expect(next.attackModifiers.map(m=>[m.targetInstanceId,m.amount])).toEqual([[id,-1],[id,-1]]);expect(next.pendingBattle?.remainingDamage).toBe(4);inventory(next)})
 it.each(['rested-energy','wrong-energy','main','wrong-phase'])('rejects unavailable response %s',scenario=>{const s=fixture(scenario),before=structuredClone(s);expect(getTrapCandidates(s,'player-one')).toEqual([]);expect(()=>apply(s,command(s))).toThrow();expect(s).toEqual(before);inventory(s)})
 it.each(['own','two','unknown'])('rejects illegal target %s without payment',scenario=>{const s=fixture(),before=structuredClone(s),ids=scenario==='own'?[s.players['player-one'].battleArea[0].card.instanceId]:scenario==='two'?s.players['player-two'].battleArea.map(c=>c.card.instanceId):['unknown'];expect(()=>apply(s,command(s,ids))).toThrow();expect(s).toEqual(before)})
 it.each(['break0','break3','break4','break5'])('settles real ordinary4 and expires reduction: %s',scenario=>{
  const s=fixture(scenario),before=structuredClone(s),originalHp=s.players['player-one'].battleArea[1].hpCards.length,bonus=['break4','break5'].includes(scenario)
  let next=apply(s,command(s));next=apply(next,{kind:'resolve-battle',playerId:'player-two'})
  expect(next.players['player-one'].battleArea[1].hpCards).toHaveLength(originalHp-(bonus?2:3))
  for(let i=0;i<10&&next.turnNumber===s.turnNumber;i++)next=apply(next,{kind:'advance-phase',playerId:next.activePlayerId})
  expect(next.turnNumber).toBeGreaterThan(s.turnNumber);expect(next.attackModifiers).toEqual([]);expect(getEffectiveAttack(next,next.players['player-two'].battleArea[1].card.instanceId)).toBe(4);expect(s).toEqual(before);inventory(next)
 })
})
