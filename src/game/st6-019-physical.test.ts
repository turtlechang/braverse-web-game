import {describe,it,expect} from 'vitest'
import {createSt6019PreviewState as fixture,raw} from './st6-019-demo'
import {applyGameCommand as apply} from './commands'
import {getTrapCandidates} from './battle'
import {getEffectiveAttack} from './effects'
import type {GameState} from './types'
const inventory=(s:GameState)=>{for(const p of Object.values(s.players)){
 const cards=[...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(x=>x.card),...p.battleArea.flatMap(c=>[c.card,...c.hpCards])]
 expect(cards).toHaveLength(60);expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60)
 for(const c of cards){expect(c.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//);expect(cards.filter(x=>x.id===c.id).length).toBeLessThanOrEqual(4)}
}}
const play=(s:GameState,ids=[s.players['player-two'].battleArea[1].card.instanceId])=>apply(s,{kind:'play-trap',playerId:'player-one',trapInstanceId:s.players['player-one'].hand[0].instanceId,paymentIds:[s.players['player-one'].supportArea[0].card.instanceId],effectTargets:[ids],targetIds:[]})
describe('ST6-019 independent own 1HP Then draw',()=>{
 it.each(['positive','rested-witness','defender-one','false','hand-witness','trash-witness','break-witness','support-witness','opponent-witness'])('uses only own battle exact-one-HP witnesses: %s',scenario=>{
  const s=fixture(scenario),before=structuredClone(s),own=s.players['player-one'],expected=['positive','rested-witness','defender-one'].includes(scenario)
  expect(own.hand[0].id).toBe(raw.cardNumber);inventory(s)
  expect(getTrapCandidates(s,'player-one').map(c=>c.instanceId)).toContain(own.hand[0].instanceId)
  let n=play(s)
  expect(n.attackModifiers.map(m=>m.amount)).toEqual([-1]);expect(n.pendingBattle?.remainingDamage).toBe(3)
  expect(Boolean(n.pendingDrawUpTo)).toBe(expected)
  expect(n.players['player-one'].hand).toHaveLength(own.hand.length-1)
  expect(n.players['player-one'].deck).toHaveLength(own.deck.length)
  expect(n.players['player-one'].supportArea.filter(x=>x.rested)).toHaveLength(1)
  if(expected){expect(n.pendingDrawUpTo?.max).toBe(1);n=apply(n,{kind:'resolve-draw-up-to',playerId:'player-one',drawCount:1});expect(n.players['player-one'].deck).toHaveLength(own.deck.length-1);expect(n.players['player-one'].hand).toHaveLength(own.hand.length)}
  expect(s).toEqual(before);inventory(n)
 })
 it.each([0,1])('allows zero reduction targets and independent Then draw %s',drawCount=>{
  const s=fixture('target-zero'),before=structuredClone(s)
  let n=play(s,[]);expect(n.attackModifiers).toEqual([]);expect(n.pendingBattle?.remainingDamage).toBe(4);expect(n.pendingDrawUpTo?.max).toBe(1)
  n=apply(n,{kind:'resolve-draw-up-to',playerId:'player-one',drawCount});expect(n.players['player-one'].hand).toHaveLength(drawCount);expect(n.players['player-one'].deck).toHaveLength(s.players['player-one'].deck.length-drawCount)
  expect(n.pendingDrawUpTo).toBeNull();expect(s).toEqual(before);inventory(n)
 })
 it('keeps reduction when the optional Then draw is zero',()=>{
  const s=fixture('draw-zero');let n=play(s);n=apply(n,{kind:'resolve-draw-up-to',playerId:'player-one',drawCount:0})
  expect(n.attackModifiers.map(m=>m.amount)).toEqual([-1]);expect(n.players['player-one'].hand).toHaveLength(0)
  n=apply(n,{kind:'resolve-battle',playerId:'player-two'});expect(n.players['player-one'].battleArea[1].hpCards).toHaveLength(3);inventory(n)
 })
 it.each(['positive','false','other','target-zero'])('settles original 4 ordinary damage after Then: %s',scenario=>{
  const s=fixture(scenario),before=structuredClone(s),ids=scenario==='target-zero'?[]:[s.players['player-two'].battleArea[scenario==='other'?0:1].card.instanceId]
  let n=play(s,ids);if(n.pendingDrawUpTo)n=apply(n,{kind:'resolve-draw-up-to',playerId:'player-one',drawCount:1})
  n=apply(n,{kind:'resolve-battle',playerId:'player-two'});expect(n.players['player-one'].battleArea[1].hpCards).toHaveLength(['other','target-zero'].includes(scenario)?2:3)
  expect(s).toEqual(before);inventory(n)
 })
 it.each(['negative','wrong-color','main','wrong-phase'])('rejects unavailable response with other resources intact: %s',scenario=>{
  const s=fixture(scenario),before=structuredClone(s);expect(getTrapCandidates(s,'player-one')).toEqual([]);expect(()=>play(s)).toThrow();expect(s).toEqual(before);inventory(s)
 })
 it.each(['own','two','unknown'])('rejects selected target %s',scenario=>{
  const s=fixture(),before=structuredClone(s),ids=scenario==='own'?[s.players['player-one'].battleArea[0].card.instanceId]:scenario==='two'?s.players['player-two'].battleArea.map(c=>c.card.instanceId):['unknown']
  expect(()=>play(s,ids)).toThrow();expect(s).toEqual(before)
 })
 it.each([-1,2])('rejects illegal optional draw count %s',drawCount=>{
  const s=play(fixture()),before=structuredClone(s);expect(()=>apply(s,{kind:'resolve-draw-up-to',playerId:'player-one',drawCount})).toThrow();expect(s).toEqual(before)
 })
 it('expires reduction through actual phase commands after optional draw',()=>{
  const s=fixture('expiry');let n=play(s);n=apply(n,{kind:'resolve-draw-up-to',playerId:'player-one',drawCount:0});n=apply(n,{kind:'resolve-battle',playerId:'player-two'})
  expect(n.attackModifiers).toHaveLength(1);for(let i=0;i<8&&n.turnNumber===s.turnNumber;i++)n=apply(n,{kind:'advance-phase',playerId:n.activePlayerId})
  expect(n.turnNumber).toBeGreaterThan(s.turnNumber);expect(n.attackModifiers).toEqual([]);expect(getEffectiveAttack(n,n.players['player-two'].battleArea[1].card.instanceId)).toBe(4);inventory(n)
 })
 it('can pay using the sole active red support',()=>{
  const s=fixture('one-red'),n=play(s);expect(n.pendingDrawUpTo?.max).toBe(1);expect(n.players['player-one'].supportArea.filter(x=>x.card.energyColor==='red').every(x=>x.rested)).toBe(true);inventory(n)
 })
 it('draws the last actual deck card and enters Refresh only after choosing one',()=>{
  const s=fixture('draw-refresh'),before=structuredClone(s),n=play(s)
  expect(n.pendingRefresh).toBeNull();expect(n.players['player-one'].deck).toHaveLength(1)
  const next=apply(n,{kind:'resolve-draw-up-to',playerId:'player-one',drawCount:1})
  expect(next.pendingRefresh).not.toBeNull();expect(next.players['player-one'].hand).toHaveLength(1);expect(s).toEqual(before);inventory(next)
  const cookie=next.players['player-one'].discardPile.find(c=>c.type==='cookie');if(!cookie)throw Error('Missing actual Refresh Cookie')
  let refreshed=apply(next,{kind:'refresh-deck',playerId:'player-one',cookieInstanceId:cookie.instanceId,shuffleSeed:2026101119})
  expect(refreshed.pendingRefresh).toBeNull();expect(refreshed.players['player-one'].hand).toHaveLength(1);expect(refreshed.players['player-one'].deck.length).toBeGreaterThan(0)
  refreshed=apply(refreshed,{kind:'resolve-battle',playerId:'player-two'})
  expect(refreshed.players['player-one'].battleArea[1].hpCards).toHaveLength(3);expect(refreshed.pendingBattle).toBeNull();inventory(refreshed)
 })
})
