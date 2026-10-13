import {describe,it,expect} from 'vitest'
import {fixture,command,zones} from './st7-020-demo'
import {applyGameCommand as apply} from './commands'
import {commandFromLogEntry} from './replay'
import type {GameState} from './types'
const owner='player-one',foe='player-two'
const scenarios=['positive','place','after-placement','no-gain','zero-gain','opponent-only','prior-turn','rested-target','rested-stage','rested-energy','wrong-energy','wrong-phase','activation-phase','placement-rested','placement-wrong-energy','short-deck','last-deck','fatal-refresh','ai-positive','ai-no-gain','ai-prior-turn','ai-opponent-only','ai-rested-energy','ai-wrong-energy']
const inventory=(s:GameState)=>{for(const id of [owner,foe] as const){const cards=zones(s,id);expect(cards).toHaveLength(60);expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60);for(const card of cards){expect(cards.filter(c=>c.id===card.id).length).toBeLessThanOrEqual(4);expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)}}}
const activate=(s:GameState)=>{
 const paid=apply(s,command(s))
 expect(paid.players[owner].stage?.rested).toBe(true)
 expect(paid.players[owner].supportArea[2].rested).toBe(true)
 expect(paid.players[owner].deck).toEqual(s.players[owner].deck)
 return paid.pendingAbilityEffect?apply(paid,{kind:'resolve-ability-effect',playerId:owner,targetIds:[]}):paid
}
describe('ST7-020 original physical stage commands',()=>{
 it.each(scenarios)('prepares sixty original cards and replays all real parent commands: %s',scenario=>{
  const initial=fixture(scenario,true);inventory(initial)
  for(const player of Object.values(initial.players))for(const cookie of player.battleArea)expect(cookie.hpCards).toHaveLength(cookie.card.hp)
  const expected=fixture(scenario);let actual=initial
  for(const entry of expected.commandLog??[]){const next=commandFromLogEntry(entry);if(!next)throw Error('Actual parent command required');actual=apply(actual,next)}
  expect(actual).toEqual(expected);inventory(expected)
 })
 it.each(['positive','after-placement','rested-target','short-deck'].flatMap(scenario=>[0,1].map(drawCount=>({scenario,drawCount}))))('pays Y and REST after actual HP gain, then optional draw: $scenario/$drawCount',({scenario,drawCount})=>{
  const s=fixture(scenario),before=structuredClone(s)
  expect(s.cookiesGainedHpThisTurn?.[owner]).toBe(true)
  const gained=scenario==='rested-target'?1:0
  expect(s.players[owner].battleArea[gained].hpCards).toHaveLength(s.players[owner].battleArea[gained].card.hp+1)
  const pending=activate(s);expect(pending.pendingDrawUpTo?.max).toBe(1);expect(pending.pendingDrawUpTo?.sourceCardId).toBe('ST7-020')
  const n=apply(pending,{kind:'resolve-draw-up-to',playerId:owner,drawCount})
  expect(n.players[owner].deck).toEqual(before.players[owner].deck.slice(drawCount));expect(n.players[owner].hand).toEqual([...before.players[owner].hand,...before.players[owner].deck.slice(0,drawCount)])
  expect(n.players[owner].battleArea).toEqual(before.players[owner].battleArea);expect(n.players[foe]).toEqual(before.players[foe]);expect(n.pendingDrawUpTo).toBeNull();expect(s).toEqual(before);inventory(n)
 })
 it.each(['no-gain','zero-gain','opponent-only','prior-turn'])('pays costs but never draws when own current-turn gain is absent: %s',scenario=>{
  const s=fixture(scenario),before=structuredClone(s)
  expect(Boolean(s.cookiesGainedHpThisTurn?.[owner])).toBe(false)
  if(scenario==='opponent-only')expect(s.cookiesGainedHpThisTurn?.[foe]).toBe(true)
  if(scenario==='prior-turn'){expect(s.turnNumber).toBe(5);expect(s.players[owner].battleArea[0].hpCards).toHaveLength(s.players[owner].battleArea[0].card.hp+1)}
  const n=activate(s);expect(n.pendingDrawUpTo??null).toBeNull();expect(n.pendingAbilityEffect??null).toBeNull();expect(n.players[owner].deck).toEqual(before.players[owner].deck);expect(n.players[owner].hand).toEqual(before.players[owner].hand);expect(n.players[foe]).toEqual(before.players[foe]);expect(s).toEqual(before);inventory(n)
 })
 it.each(['rested-stage','rested-energy','wrong-energy','activation-phase'])('rejects activation without changing any zone: %s',scenario=>{
  const s=fixture(scenario),before=structuredClone(s);expect(()=>apply(s,command(s))).toThrow();expect(s).toEqual(before)
 })
 it.each(['wrong-phase','placement-rested','placement-wrong-energy'])('rejects illegal placement: %s',scenario=>{
  const s=fixture(scenario),before=structuredClone(s);expect(()=>apply(s,{kind:'play-stage',playerId:owner,instanceId:s.players[owner].hand.find(c=>c.id==='ST7-020')!.instanceId,paymentIds:[s.players[owner].supportArea[1].card.instanceId]})).toThrow();expect(s).toEqual(before)
 })
 it.each([-1,2])('rejects invalid draw count %s after payment',drawCount=>{
  const s=activate(fixture()),before=structuredClone(s);expect(()=>apply(s,{kind:'resolve-draw-up-to',playerId:owner,drawCount})).toThrow();expect(s).toEqual(before)
 })
 it('rejects missing activation energy and wrong owner',()=>{
  const s=fixture(),before=structuredClone(s);expect(()=>apply(s,{...command(s),paymentIds:[]})).toThrow();expect(()=>apply(s,{...command(s),playerId:foe})).toThrow();expect(s).toEqual(before)
 })
 it.each(['last-deck','fatal-refresh'])('draws the last real card and completes mandatory Refresh or ends immediately: %s',scenario=>{
  const s=fixture(scenario);expect(s.players[owner].deck).toHaveLength(1)
  let n=apply(activate(s),{kind:'resolve-draw-up-to',playerId:owner,drawCount:1});expect(n.pendingRefresh).toBeTruthy();expect(n.players[owner].stage?.rested).toBe(true)
  const cookie=n.players[owner].discardPile.find(c=>c.type==='cookie'&&c.level===1);if(!cookie)throw Error('Original LV1 Refresh Cookie required')
  n=apply(n,{kind:'refresh-deck',playerId:owner,cookieInstanceId:cookie.instanceId,shuffleSeed:2026101320})
  if(scenario==='fatal-refresh'){expect(n.status).toBe('finished');expect(n.result?.winnerId).toBe(foe)}else{expect(n.status).toBe('playing');expect(n.pendingRefresh).toBeNull();expect(n.pendingDrawUpTo).toBeNull();expect(n.players[owner].deck.length).toBeGreaterThan(0)}
  inventory(n)
 })
})
