import {describe,expect,it} from 'vitest'
import {fixture as foundation} from '../st7-010-demo'
import {getCardPoolEntry} from '../card-pool'
import {createCard} from '../starter-deck'
import {createPlayerView} from '../player-view'
import {evaluatePlayerView} from './strategy/state-evaluation'
import {extractCardCapabilities} from './strategy/capability-extractor'
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
 it('recognizes unconditional prevention while retaining conditional discard escape as unsupported',()=>{
  const unconditional=getCardPoolEntry('BS8-079'),conditional=getCardPoolEntry('BS8-076')
  if(!unconditional||!conditional)throw Error('Original BS8 cards')
  const ready=extractCardCapabilities(createCard(unconditional,'player-one',1),0)
  expect(ready.unsupportedEffectKinds).not.toContain('prevent-cookie-active-next-phase')
  const escape=extractCardCapabilities(createCard(conditional,'player-one',1),0)
  expect(escape.unsupportedEffectKinds).toContain('prevent-cookie-active-next-phase')
 })
})
