import {describe,it,expect} from 'vitest'
import {fixture,zones} from './st8-001-demo'
import {applyGameCommand as apply} from './commands'
import {takeAiStep} from './ai'
import type {AiLevel} from './ai/types'
const owner='player-one',foe='player-two'
const attack=(s:ReturnType<typeof fixture>,paymentIds=s.players[owner].supportArea.map(c=>c.card.instanceId))=>apply(s,{kind:'declare-attack',playerId:owner,attackerInstanceId:s.players[owner].battleArea[0].card.instanceId,targetInstanceId:s.players[foe].battleArea[0].card.instanceId,supportPaymentIds:paymentIds})
describe('ST8-001 original physical ordinary attack',()=>{
 it.each(['positive','play','rested-source','rested-energy','no-energy','wrong-phase','first-turn',...['red','yellow','green','blue','purple','black'].map(c=>'color-'+c)])('retains real sixty-card resources: %s',scenario=>{
  const s=fixture(scenario)
  for(const id of [owner,foe] as const){const cards=zones(s,id);expect(cards).toHaveLength(60);expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60);for(const c of cards){expect(cards.filter(x=>x.id===c.id).length).toBeLessThanOrEqual(4);expect(c.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)}}
 })
 it.each(['red','yellow','green','blue','purple','black'])('pays one %s support, rests source and deals exactly normal1',color=>{
  const s=fixture('color-'+color),before=structuredClone(s)
  let n=attack(s)
  expect(n.players[owner].supportArea[0].rested).toBe(true);expect(n.players[owner].battleArea[0].rested).toBe(true)
  n=apply(n,{kind:'skip-trap',playerId:foe});n=apply(n,{kind:'resolve-next-damage',playerId:foe})
  expect(n.players[foe].battleArea[0].hpCards).toHaveLength(3)
  expect(n.players[foe].battleArea[1]).toEqual(before.players[foe].battleArea[1])
  expect(n.players[owner].battleArea[0].hpCards).toEqual(before.players[owner].battleArea[0].hpCards)
  expect(n.pendingAbilityEffect??null).toBeNull();expect(s).toEqual(before)
 })
 it.each(['rested-source','rested-energy','no-energy','wrong-phase','first-turn'])('rejects %s without changing zones',scenario=>{
  const s=fixture(scenario),before=structuredClone(s);expect(()=>attack(s)).toThrow();expect(s).toEqual(before)
 })
 it('rejects unpaid or duplicate Support payment',()=>{
  const s=fixture();expect(()=>attack(s,[])).toThrow();const id=s.players[owner].supportArea[0].card.instanceId;expect(()=>attack(s,[id,id])).toThrow()
 })
 it('deploys the original LV1 with two real HP and no skill resolution',()=>{
  const s=fixture('play'),source=s.players[owner].hand[0]
  expect(s.players[owner].battleArea).toHaveLength(1)
  const n=apply(s,{kind:'deploy-cookie',playerId:owner,instanceId:source.instanceId})
  expect(n.players[owner].battleArea.find(c=>c.card.instanceId===source.instanceId)?.hpCards).toHaveLength(2)
  expect(n.players[owner].deck).toHaveLength(s.players[owner].deck.length-2)
  expect(n.players[owner].battleArea).toHaveLength(2)
  expect(n.pendingAbilityEffect??null).toBeNull()
 })
 it.each([3,4,5] as AiLevel[])('Lv%s makes a legal physical ordinary attack',level=>{
  const s=fixture(),before=structuredClone(s),d=takeAiStep(s,owner,{level,searchNow:()=>0})
  expect(d.action).toBe('attack');expect(d.state.players[owner].battleArea[0].rested).toBe(true);expect(s).toEqual(before)
 })
})
