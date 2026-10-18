import {describe,expect,it} from 'vitest'
import {fixture as foundation} from '../st7-010-demo'
import {getCardPoolEntry} from '../card-pool'
import {createCard} from '../starter-deck'
import {applyGameCommand as apply} from '../commands'
import {createPlayerView} from '../player-view'
import {takeAiStep} from '../ai'
import {nextActivePressureTargetValue} from './next-active-pressure'
import {evaluatePlayerView} from './strategy/state-evaluation'
import {extractCardCapabilities} from './strategy/capability-extractor'
import {createKnowledgeState} from './strategy/knowledge-state'
import {createPendingSelectionStrategy} from './strategy/pending-selection'
import type {PlayerId,GameState} from '../types'
const original=(id:string,owner:PlayerId,copy=1)=>{
 const raw=getCardPoolEntry(id);if(!raw)throw Error('Original '+id)
 return createCard(raw,owner,copy)
}
const fixture=()=>{
 const state=foundation('skill-once',true),foe=state.players['player-two']
 const previous=foe.battleArea.shift();if(!previous)throw Error('Original Cookie')
 foe.deck.push(previous.card,...previous.hpCards)
 const card=original('BS3-101','player-two');if(card.type!=='cookie')throw Error('Original Cookie')
 foe.battleArea[0]={card,hpCards:foe.battleArea[0].hpCards,rested:true,battleEntryId:card.instanceId+':entry'}
 foe.supportArea=[1,2].map(copy=>({card:original('BS12-085','player-two',copy),rested:true}));foe.deck.shift()
 return state
}
const lock=(state:GameState,owner:PlayerId,id:string):GameState=>({...state,preventCookieActiveNextPhase:{[owner]:[id]}})
const conditionalLock=(state:GameState,owner:PlayerId,id:string,cost=2):GameState=>({...state,
 conditionalCookieActivePreventions:{[owner]:[{cookieInstanceId:id,discardHandToSetActive:cost,
  sourcePlayerId:owner==='player-one'?'player-two':'player-one',sourceInstanceId:'bs8-076-source',
  sourceCardName:'Icicle Yeti Cookie',effectText:'Discard 2 cards to set this Cookie as active.'}]},
})
const addThreatScene=(state:GameState)=>{
 const foe=state.players['player-two']
 const strong=original('BS8-081','player-two',1),weak=original('BS8-059','player-two',1)
 if(strong.type!=='cookie'||weak.type!=='cookie')throw Error('Original Cookies')
 foe.battleArea=[
  {card:strong,hpCards:[1,2,3].map(copy=>original('BS8-078','player-two',copy)),rested:true},
  {card:weak,hpCards:[
   original('BS8-078','player-two',4),original('BS8-079','player-two',1),
   original('BS8-079','player-two',2),original('BS8-079','player-two',3),
   original('BS8-080','player-two',1),original('BS8-082','player-two',1),
  ],rested:true},
 ]
 foe.supportArea=[
  ...[2,3,4].map(copy=>({card:original('BS8-081','player-two',copy),rested:true})),
  ...[2,3].map(copy=>({card:original('BS8-059','player-two',copy),rested:true})),
 ]
 foe.hand=[original('BS8-082','player-two',2),original('BS8-082','player-two',3)]
 return {strong,weak}
}
describe('public next Active pressure, with real printed attacks and known support colors',()=>{
 it('projects the public unconditional restriction on its exact live Cookie',()=>{
  const state=fixture(),target=state.players['player-two'].battleArea[0]
  const view=createPlayerView(lock(state,'player-two',target.card.instanceId),'player-one')
  expect(view.opponent.battleArea[0].nextActivePhasePrevented).toBe(true)
  expect(createPlayerView(state,'player-one').opponent.battleArea[0].nextActivePhasePrevented).toBeUndefined()
 })
 it('values the actually prevented ordinary attack when known purple support will ready',()=>{
  const state=fixture(),target=state.players['player-two'].battleArea[0],marked=lock(state,'player-two',target.card.instanceId)
  expect(evaluatePlayerView(createPlayerView(marked,'player-one'))-evaluatePlayerView(createPlayerView(state,'player-one'))).toBeGreaterThan(26)
 })
 it.each(['active','wrong-color','too-few','non-attacker','departed'] as const)('does not invent prevented attack value for %s',scenario=>{
  const state=fixture(),foe=state.players['player-two'],target=foe.battleArea[0]
  if(scenario==='active')target.rested=false
  if(scenario==='wrong-color')foe.supportArea=foe.supportArea.map((s,i)=>({...s,card:original('ST1-020','player-two',i+1)}))
  if(scenario==='too-few')foe.supportArea.pop()
  if(scenario==='non-attacker')target.card={...target.card,nonAttackable:true}
  const id=target.card.instanceId;if(scenario==='departed')foe.battleArea.pop()
  const marked=lock(state,'player-two',id)
  expect(evaluatePlayerView(createPlayerView(marked,'player-one'))).toBe(evaluatePlayerView(createPlayerView(state,'player-one')))
 })
 it('counts shared support only once across two locked attackers',()=>{
  const state=fixture(),foe=state.players['player-two'],second=original('BS3-101','player-two',2)
  if(second.type!=='cookie')throw Error('Original Cookie')
  foe.battleArea=[foe.battleArea[0],{card:second,hpCards:foe.battleArea[0].hpCards,rested:true}]
  const marked={...state,preventCookieActiveNextPhase:{'player-two':foe.battleArea.map(c=>c.card.instanceId)}}
  const difference=evaluatePlayerView(createPlayerView(marked,'player-one'))-evaluatePlayerView(createPlayerView(state,'player-one'))
  expect(difference).toBe(30)
 })
 it('does not assume support prevented from readying becomes available',()=>{
  const state=fixture(),foe=state.players['player-two'],target=foe.battleArea[0]
  state.preventSupportActiveNextPhase={'player-two':[foe.supportArea[0].card.instanceId]}
  const marked=lock(state,'player-two',target.card.instanceId)
  expect(createPlayerView(marked,'player-one').opponent.nextActivePhasePreventedSupportIds).toEqual([foe.supportArea[0].card.instanceId])
  expect(evaluatePlayerView(createPlayerView(marked,'player-one'))).toBe(evaluatePlayerView(createPlayerView(state,'player-one')))
 })
 it('treats own locked attackers symmetrically and does not read hidden faces',()=>{
  const state=fixture(),target=state.players['player-two'].battleArea[0],marked=lock(state,'player-two',target.card.instanceId)
  expect(evaluatePlayerView(createPlayerView(marked,'player-two'))-evaluatePlayerView(createPlayerView(state,'player-two'))).toBe(-30)
  const before=evaluatePlayerView(createPlayerView(marked,'player-one'))
  marked.players['player-two'].hand.reverse();marked.players['player-two'].deck.reverse();target.hpCards.reverse()
  expect(evaluatePlayerView(createPlayerView(marked,'player-one'))).toBe(before)
 })
 it('projects the conditional choice and prices only its public hand-count opportunity cost',()=>{
  const state=fixture(),foe=state.players['player-two'],target=foe.battleArea[0]
  foe.hand=[original('BS8-079','player-two',1),original('BS8-077','player-two',1)]
  const marked=conditionalLock(state,'player-two',target.card.instanceId)
  const markedView=createPlayerView(marked,'player-one')
  expect(markedView.opponent.battleArea[0]).toMatchObject({nextActivePhaseDiscardToActivate:2})
  expect(evaluatePlayerView(markedView)-evaluatePlayerView(createPlayerView(state,'player-one'))).toBe(6)
  const before=evaluatePlayerView(markedView)
  marked.players['player-two'].hand.reverse()
  marked.players['player-two'].deck.reverse()
  expect(evaluatePlayerView(createPlayerView(marked,'player-one'))).toBe(before)

  const shortHand=structuredClone(state)
  shortHand.players['player-two'].hand=shortHand.players['player-two'].hand.slice(0,1)
  const forced=conditionalLock(shortHand,'player-two',target.card.instanceId)
  expect(evaluatePlayerView(createPlayerView(forced,'player-one'))-
   evaluatePlayerView(createPlayerView(shortHand,'player-one'))).toBe(30)
 })
 it('respects the shared public hand-count budget across multiple conditional targets',()=>{
  const state=fixture(),foe=state.players['player-two']
  const second=original('BS3-101','player-two',2)
  if(second.type!=='cookie')throw Error('Original Cookie')
  foe.battleArea.push({card:second,hpCards:[
   original('BS8-079','player-two',1),original('BS8-079','player-two',2),
  ],rested:true})
  foe.hand=[original('BS8-082','player-two',1),original('BS8-082','player-two',2)]
  const marked={...state,conditionalCookieActivePreventions:{'player-two':foe.battleArea.map(cookie=>({
   cookieInstanceId:cookie.card.instanceId,discardHandToSetActive:2,sourcePlayerId:'player-one' as const,
   sourceInstanceId:'bs8-076-source',sourceCardName:'Icicle Yeti Cookie',effectText:'Discard 2 cards to set this Cookie as active.',
  }))}}
  expect(evaluatePlayerView(createPlayerView(marked,'player-one'))-
   evaluatePlayerView(createPlayerView(state,'player-one'))).toBe(6)
 })
 it('chooses the target with the greatest payable ordinary attack pressure',()=>{
  const state=fixture(),{strong,weak}=addThreatScene(state)
  const view=createPlayerView(state,'player-one')
  const selection=createPendingSelectionStrategy(view,createKnowledgeState('player-one'),5)
  const selected=selection.selectEffectTargetIds({
   kind:'prevent-cookie-active-next-phase',target:{side:'opponent',min:0,max:1},discardHandToSetActive:2,
  },[weak.instanceId,strong.instanceId],1)
  expect(selected).toEqual([strong.instanceId])
 })
 it('does not count a passive-blocked but already-active Cookie as newly prevented pressure',()=>{
  const state=fixture(),foe=state.players['player-two']
  const parfait=original('BS12-015','player-two',1),moonRabbit=original('BS3-101','player-two',1)
  if(parfait.type!=='cookie'||moonRabbit.type!=='cookie')throw Error('Original Cookies')
  foe.battleArea=[
   {card:parfait,hpCards:[
    ...[1,2,3].map(copy=>original('BS8-078','player-two',copy)),
    original('BS8-080','player-two',1),
    original('BS8-079','player-two',3),
   ],rested:false},
   {card:moonRabbit,hpCards:[1,2].map(copy=>original('BS8-079','player-two',copy)),rested:true},
  ]
  foe.supportArea=[
   ...[1,2].map(copy=>({card:original('ST1-020','player-two',copy),rested:true})),
   ...[1,2].map(copy=>({card:original('BS12-085','player-two',copy),rested:true})),
  ]
  const view=createPlayerView(state,'player-one')
  expect(view.opponent.battleArea[0]).toMatchObject({rested:false,activePhasePreventedBySkill:true})
  expect(nextActivePressureTargetValue(view.opponent,moonRabbit.instanceId,undefined).value).toBe(0)
 })
 it('keeps an opponent Cookie with a payable REST damage skill as an optional prevention target',()=>{
  const state=fixture(),foe=state.players['player-two']
  const target=original('BS8-004','player-two',1)
  if(target.type!=='cookie')throw Error('Original BS8-004')
  foe.battleArea=[{card:target,hpCards:[original('ST1-020','player-two',1)],rested:true}]
  foe.supportArea=[{card:original('ST1-020','player-two',2),rested:true}]
  const view=createPlayerView(state,'player-one')
  expect(view.opponent.battleArea[0]).toMatchObject({rested:true,hpCount:1})
  expect(view.opponent.battleArea[0].card.skill).toMatchObject({restSource:true})
  const selection=createPendingSelectionStrategy(view,createKnowledgeState('player-one'),5)
  const selected=selection.selectEffectTargetIds({
   kind:'prevent-cookie-active-next-phase',target:{side:'opponent',min:0,max:1},
  },[target.instanceId],1)
  expect(selected).toEqual([target.instanceId])
 })
 it('Lv.5 pays the real BS8-076 Then and selects the highest-pressure legal Cookie',()=>{
  let state=foundation('skill-once',true)
  const own=state.players['player-one'],{strong,weak}=addThreatScene(state)
  const source=original('BS8-076','player-one',1)
  if(source.type!=='cookie')throw Error('Original Icicle Yeti')
  own.battleArea=[{
   card:source,
   hpCards:[1,2,3].map(copy=>original('BS8-079','player-one',copy)),
   rested:false,
   battleEntryId:source.instanceId+':entry',
  }]
  own.supportArea=[2,3].map(copy=>({card:original('BS8-081','player-one',copy),rested:false}))
  own.hand=[original('BS8-082','player-one',1),original('BS8-082','player-one',2)]
  state=apply(state,{
   kind:'declare-attack',playerId:'player-one',attackerInstanceId:source.instanceId,
   targetInstanceId:weak.instanceId,supportPaymentIds:own.supportArea.map(support=>support.card.instanceId),
  })
  state=apply(state,{kind:'skip-trap',playerId:'player-two'})
  for(let i=0;i<12&&state.pendingBattle?.stage==='damage';i++){
   state=apply(state,{kind:'resolve-next-damage',playerId:'player-two'})
  }
  state=apply(state,{kind:'resolve-attack-effect',playerId:'player-one',targetIds:[]})
  const decision=takeAiStep(state,'player-one',{level:5,seed:20261017076,searchNow:()=>0})
  expect(decision.state.commandLog?.at(-1)?.payload).toMatchObject({
   kind:'resolve-optional-cost-attack',action:'pay',targetIds:[strong.instanceId],
  })
  expect(decision.state.conditionalCookieActivePreventions?.['player-two']).toEqual([
   expect.objectContaining({cookieInstanceId:strong.instanceId,discardHandToSetActive:2}),
  ])
  expect(decision.state.players['player-one'].battleArea).toHaveLength(0)
 })
 it('recognizes both unconditional and discard-optional active prevention as supported',()=>{
  const unconditional=getCardPoolEntry('BS8-079'),conditional=getCardPoolEntry('BS8-076')
  if(!unconditional||!conditional)throw Error('Original BS8 cards')
  const ready=extractCardCapabilities(createCard(unconditional,'player-one',1),0)
  expect(ready.unsupportedEffectKinds).not.toContain('prevent-cookie-active-next-phase')
  const escape=extractCardCapabilities(createCard(conditional,'player-one',1),0)
  expect(escape.unsupportedEffectKinds).not.toContain('prevent-cookie-active-next-phase')
  expect(escape.capabilities).toEqual(expect.arrayContaining([
   expect.objectContaining({kind:'rest',strategyTags:expect.arrayContaining(['active-rest'])}),
  ]))
 })
})
