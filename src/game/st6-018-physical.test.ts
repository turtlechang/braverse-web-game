import {describe,it,expect} from 'vitest'
import {createSt6018PreviewState as fixture} from './st6-018-demo'
import {applyGameCommand as apply} from './commands'
import {getTrapCandidates} from './battle'
import {executeCardEffect,getEffectiveAttack} from './effects'
import type {GameState} from './types'
const inventory=(s:GameState)=>{for(const p of Object.values(s.players)){
 const cards=[...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(x=>x.card),...p.battleArea.flatMap(c=>[c.card,...c.hpCards])]
 expect(cards).toHaveLength(60);expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60)
 for(const c of cards){expect(c.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//);expect(cards.filter(x=>x.id===c.id).length).toBeLessThanOrEqual(4)}
}}
const play=(s:GameState,ids:string[])=>apply(s,{kind:'play-trap',playerId:'player-one',trapInstanceId:s.players['player-one'].hand[0].instanceId,paymentIds:[s.players['player-one'].supportArea[0].card.instanceId],effectTargets:[ids],selfTargetIds:ids,targetIds:[]})
describe('ST6-018 actual declared ordinary attack',()=>{
 it.each(['positive','other','zero','rested-target'])('pays R and resolves 4 damage correctly: %s',scenario=>{
  const s=fixture(scenario),before=structuredClone(s),own=s.players['player-one'],target=own.battleArea[scenario==='other'||scenario==='rested-target'?0:1]
  inventory(s);expect(getTrapCandidates(s,'player-one').map(c=>c.instanceId)).toContain(own.hand[0].instanceId)
  const ids=scenario==='zero'?[]:[target.card.instanceId]
  let n=play(s,ids)
  expect(n.attackModifiers).toEqual([])
  expect(getEffectiveAttack(n,n.players['player-two'].battleArea[1].card.instanceId)).toBe(4)
  expect(n.damageReceivedModifiers.map(m=>[m.targetInstanceId,m.amount,m.damageType,m.expiresAfterTurn])).toEqual(ids.map(id=>[id,-1,'attack',s.turnNumber]))
  expect(n.players['player-one'].supportArea.filter(x=>x.rested)).toHaveLength(1)
  expect(n.players['player-one'].discardPile.some(c=>c.instanceId===own.hand[0].instanceId)).toBe(true)
  n=apply(n,{kind:'resolve-battle',playerId:'player-two'})
  expect(n.players['player-one'].battleArea[1].hpCards).toHaveLength(scenario==='positive'?3:2)
  expect(n.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
  expect(s).toEqual(before);inventory(n)
 })
 it.each(['negative','wrong-color','main','wrong-phase'])('rejects unavailable trap: %s',scenario=>{
  const s=fixture(scenario),before=structuredClone(s)
  expect(getTrapCandidates(s,'player-one')).toEqual([])
  expect(()=>play(s,[s.players['player-one'].battleArea[1].card.instanceId])).toThrow()
  expect(s).toEqual(before);inventory(s)
 })
 it.each(['opponent','two','unknown'])('rejects illegal selected targets: %s',scenario=>{
  const s=fixture(),before=structuredClone(s),ids=scenario==='opponent'?[s.players['player-two'].battleArea[0].card.instanceId]:scenario==='two'?s.players['player-one'].battleArea.map(c=>c.card.instanceId):['unknown']
  expect(()=>play(s,ids)).toThrow();expect(s).toEqual(before)
 })
 it('also supports the legacy self-target command',()=>{
  const s=fixture(),id=s.players['player-one'].battleArea[1].card.instanceId
  const n=apply(s,{kind:'play-trap',playerId:'player-one',trapInstanceId:s.players['player-one'].hand[0].instanceId,paymentIds:[s.players['player-one'].supportArea[0].card.instanceId],selfTargetIds:[id],targetIds:[]})
  expect(n.damageReceivedModifiers.map(m=>m.targetInstanceId)).toEqual([id]);inventory(n)
 })
 it('does not reduce a separate effect-damage settlement',()=>{
  const s=fixture(),id=s.players['player-one'].battleArea[1].card.instanceId
  let n=play(s,[id]);n=apply(n,{kind:'resolve-battle',playerId:'player-two'})
  expect(n.players['player-one'].battleArea[1].hpCards).toHaveLength(3)
  const next=executeCardEffect(n,{sourcePlayerId:'player-two',sourceInstanceId:n.players['player-two'].battleArea[0].card.instanceId},{kind:'damage',amount:1,target:{side:'opponent',min:0,max:1}},[id])
  expect(next.players['player-one'].battleArea[1].hpCards).toHaveLength(2)
  expect(next.damageReceivedModifiers).toHaveLength(1);inventory(next)
 })
 it('expires the incoming modifier through actual phase commands',()=>{
  const s=fixture();let n=play(s,[s.players['player-one'].battleArea[1].card.instanceId])
  n=apply(n,{kind:'resolve-battle',playerId:'player-two'})
  expect(n.damageReceivedModifiers).toHaveLength(1)
  for(let i=0;i<8&&n.turnNumber===s.turnNumber;i++)n=apply(n,{kind:'advance-phase',playerId:n.activePlayerId})
  expect(n.turnNumber).toBeGreaterThan(s.turnNumber);expect(n.damageReceivedModifiers).toEqual([]);inventory(n)
 })
})
