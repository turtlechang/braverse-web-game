import {describe,it,expect} from 'vitest'
import {createSt6020PreviewState as fixture,placeSt6020 as place,raw} from './st6-020-demo'
import {applyGameCommand as apply,type GameCommand} from './commands'
import {getCardPoolEntry} from './card-pool'
import {createCard} from './starter-deck'
import type {GameState} from './types'
const owner='player-one',foe='player-two'
const inventory=(s:GameState)=>{for(const p of Object.values(s.players)){
 const cards=[...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(x=>x.card),...p.battleArea.flatMap(c=>[c.card,...c.hpCards]),...(p.stage?[p.stage.card]:[])]
 expect(cards).toHaveLength(60);expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60)
 for(const c of cards){expect(c.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//);expect(cards.filter(x=>x.id===c.id).length).toBeLessThanOrEqual(4)}
}}
const activate=(s:GameState,index=0)=>{
 const paid=apply(s,{kind:'begin-activate-stage',playerId:owner,paymentIds:[],hpToTrashTargetIds:[s.players[owner].battleArea[index].card.instanceId]})
 expect(paid.players[owner].stage?.rested).toBe(true)
 expect(paid.players[owner].deck).toEqual(s.players[owner].deck)
 expect(paid.pendingAbilityEffect?.effects).toEqual([{kind:'draw-up-to',max:1}])
 return apply(paid,{kind:'resolve-ability-effect',playerId:owner,targetIds:[]})
}
describe('ST6-020 actual original-card Stage commands',()=>{
 it.each(['positive','green-arena','low','rested-source','no-battle','draw-refresh'])('actually places Stage with RR without activating: %s',scenario=>{
  const s=fixture(scenario),before=structuredClone(s),n=place(scenario)
  expect(n.players[owner].stage?.card.id).toBe(raw.cardNumber);expect(n.players[owner].stage?.rested).toBe(false)
  expect(n.players[owner].supportArea.filter(c=>c.rested)).toHaveLength(before.players[owner].supportArea.filter(c=>c.rested).length+2)
  expect(n.players[owner].battleArea).toEqual(before.players[owner].battleArea)
  expect(n.players[owner].deck).toEqual(before.players[owner].deck);expect(n.pendingDrawUpTo).toBeFalsy();inventory(n)
 })
 it.each(['positive','green-arena','low','rested-source'].flatMap(scenario=>[0,1].flatMap(index=>[0,1].map(drawCount=>({scenario,index,drawCount})))))('pays REST and exact top HP before draw: $scenario/$index/$drawCount',({scenario,index,drawCount})=>{
  const s=place(scenario),before=structuredClone(s),own=s.players[owner],cost=own.battleArea[index],top=cost.hpCards.at(-1)
  let n=activate(s,index)
  expect(n.players[owner].stage?.rested).toBe(true);expect(n.players[owner].supportArea).toEqual(own.supportArea)
  expect(n.players[owner].discardPile.map(c=>c.instanceId)).toContain(top?.instanceId)
  const survivor=n.players[owner].battleArea.find(c=>c.card.instanceId===cost.card.instanceId)
  if(cost.hpCards.length===1){expect(survivor).toBeUndefined();expect(n.players[owner].breakArea.map(c=>c.instanceId)).toContain(cost.card.instanceId)}
  else expect(survivor?.hpCards).toEqual(cost.hpCards.slice(0,-1))
  expect(n.pendingDrawUpTo?.max).toBe(1);expect(n.pendingDrawUpTo?.sourceCardId).toBe('ST6-020');expect(n.pendingDrawUpTo?.effectText).toBe(own.stage?.card.stageAbility?.text);expect(n.players[owner].deck).toEqual(own.deck)
  n=apply(n,{kind:'resolve-draw-up-to',playerId:owner,drawCount})
  expect(n.players[owner].deck).toHaveLength(own.deck.length-drawCount);expect(n.players[owner].hand).toHaveLength(own.hand.length+drawCount)
  expect(n.players[foe]).toEqual(before.players[foe]);expect(n.pendingDrawUpTo).toBeNull();expect(s).toEqual(before);inventory(n)
 })
 it.each(['negative','wrong-color','wrong-phase','one-red'])('rejects unavailable placement atomically: %s',scenario=>{
  const s=fixture(scenario),before=structuredClone(s),own=s.players[owner]
  expect(()=>apply(s,{kind:'play-stage',playerId:owner,instanceId:own.hand[0].instanceId,paymentIds:own.supportArea.slice(0,2).map(c=>c.card.instanceId)})).toThrow();expect(s).toEqual(before)
 })
 it.each(['no-choice','two-cookies','opponent','support','no-battle','rested-stage','wrong-phase','wrong-owner'])('rejects unavailable HP/Activate atomically: %s',name=>{
  let s=place(name==='no-battle'?'no-battle':'positive')
  if(name==='rested-stage'){s=activate(s);s=apply(s,{kind:'resolve-draw-up-to',playerId:owner,drawCount:0})}
  if(name==='wrong-phase')s.phase='support'
  const before=structuredClone(s),own=s.players[owner]
  const command:GameCommand={kind:'begin-activate-stage',playerId:name==='wrong-owner'?foe:owner,paymentIds:[],hpToTrashTargetIds:own.battleArea[0]?[own.battleArea[0].card.instanceId]:[]}
  if(name==='no-choice')command.hpToTrashTargetIds=[]
  if(name==='two-cookies')command.hpToTrashTargetIds=own.battleArea.map(c=>c.card.instanceId)
  if(name==='opponent')command.hpToTrashTargetIds=[s.players[foe].battleArea[0].card.instanceId]
  if(name==='support')command.hpToTrashTargetIds=[own.supportArea[0].card.instanceId]
  expect(()=>apply(s,command)).toThrow();expect(s).toEqual(before);inventory(s)
 })
 it('trashes the actual top FLIP HP without a FLIP window',()=>{
  const s=place(),own=s.players[owner],record=getCardPoolEntry('ST6-006');if(!record?.flipText)throw Error('Missing original Cherry')
  const old=own.battleArea[1].hpCards.pop();if(!old)throw Error('Missing HP')
  own.deck.shift();own.deck.push(old);const flip=createCard(record,owner,4);own.battleArea[1].hpCards.push(flip)
  inventory(s);const n=activate(s,1)
  expect(n.players[owner].discardPile.map(c=>c.instanceId)).toContain(flip.instanceId)
  expect(n.pendingBattle).toBeNull();expect(n.pendingDrawUpTo?.max).toBe(1);inventory(n)
 })
 it('finishes actual deck Refresh after draw, retaining paid Stage and HP costs',()=>{
  const s=place('draw-refresh'),paid=activate(s),n=apply(paid,{kind:'resolve-draw-up-to',playerId:owner,drawCount:1})
  expect(n.pendingRefresh).toBeTruthy();expect(n.players[owner].hand).toHaveLength(1)
  const cookie=n.players[owner].discardPile.find(c=>c.type==='cookie');if(!cookie)throw Error('Missing Refresh Cookie')
  const next=apply(n,{kind:'refresh-deck',playerId:owner,cookieInstanceId:cookie.instanceId,shuffleSeed:2026101120})
  expect(next.pendingRefresh).toBeNull();expect(next.players[owner].stage?.rested).toBe(true)
  expect(next.players[owner].battleArea[0].hpCards).toHaveLength(s.players[owner].battleArea[0].hpCards.length-1)
  expect(next.players[owner].deck.length).toBeGreaterThan(0);expect(next.pendingDrawUpTo).toBeNull();inventory(next)
 })
 it.each([-1,2])('rejects invalid draw count %s after preserving paid costs',drawCount=>{
  const s=activate(place()),before=structuredClone(s);expect(()=>apply(s,{kind:'resolve-draw-up-to',playerId:owner,drawCount})).toThrow();expect(s).toEqual(before)
 })
})
