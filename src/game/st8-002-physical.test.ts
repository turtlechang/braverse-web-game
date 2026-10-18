import {describe,it,expect} from 'vitest'
import {fixture,zones} from './st8-002-demo'
import {applyGameCommand as apply} from './commands'
import {takeAiStep} from './ai'
import {getActingPlayerId} from './controller'

describe('ST8-002 physical attacks and revealed-card return',()=>{
 it.each(['positive','low','attack','attack-negative','wrong-color','wrong-phase','rested-source','first-turn','play'])('uses sixty original cards and at most four copies: %s',scenario=>{
  const s=fixture(scenario)
  for(const id of ['player-one','player-two'] as const){const cards=zones(s,id);expect(cards).toHaveLength(60);expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60);for(const c of cards){expect(cards.filter(x=>x.id===c.id).length).toBeLessThanOrEqual(4);expect(c.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)}}
 })
 it.each(['positive','low'])('returns the revealed card, not its bearer: %s',scenario=>{
  const s=fixture(scenario),before=structuredClone(s),revealed=s.pendingBattle!.revealedHpCard!
  expect(revealed.id).toBe('ST8-002');expect(s.players['player-one'].hand).toEqual([])
  const n=apply(s,{kind:'resolve-flip',playerId:'player-one',activate:true})
  expect(n.players['player-one'].hand.map(c=>c.instanceId)).toEqual([revealed.instanceId])
  expect(n.players['player-one'].discardPile.some(c=>c.instanceId===revealed.instanceId)).toBe(false)
  expect(n.players['player-one'].battleArea.map(c=>c.card.id)).toEqual(scenario==='low'?['ST1-011']:['ST1-005','ST1-011'])
  expect(n.players['player-one'].battleArea.at(-1)?.hpCards).toHaveLength(2)
  if(scenario==='positive')expect(n.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
  else expect(n.players['player-one'].breakArea.map(c=>c.id)).toContain('ST1-005')
  expect(s).toEqual(before)
 })
 it.each(['positive','low'])('skip discards only the revealed card: %s',scenario=>{
  const s=fixture(scenario),id=s.pendingBattle!.revealedHpCard!.instanceId,n=apply(s,{kind:'resolve-flip',playerId:'player-one',activate:false})
  expect(n.players['player-one'].hand).toEqual([]);expect(n.players['player-one'].discardPile.map(c=>c.instanceId)).toContain(id)
 })
 it('rejects the wrong player without mutation',()=>{const s=fixture(),before=structuredClone(s);expect(()=>apply(s,{kind:'resolve-flip',playerId:'player-two',activate:true})).toThrow();expect(s).toEqual(before)})
 it('pays GGG, deals exactly ordinary three, and has no Then',()=>{
  const s=fixture('attack'),before=structuredClone(s)
  let n=apply(s,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:s.players['player-one'].battleArea[0].card.instanceId,targetInstanceId:s.players['player-two'].battleArea[0].card.instanceId,supportPaymentIds:s.players['player-one'].supportArea.map(c=>c.card.instanceId)})
  n=apply(n,{kind:'skip-trap',playerId:'player-two'})
  for(let i=0;i<3;i++)n=apply(n,{kind:'resolve-next-damage',playerId:'player-two'})
  expect(n.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
  expect(n.players['player-one'].supportArea.every(c=>c.rested)).toBe(true)
  expect(n.players['player-one'].battleArea[0].rested).toBe(true)
  expect(n.players['player-one'].battleArea[0].hpCards).toHaveLength(4)
  expect(n.pendingAbilityEffect??null).toBeNull();expect(s).toEqual(before)
 })
 it.each(['attack-negative','wrong-color','wrong-phase','rested-source','first-turn'])('blocks illegal attack: %s',scenario=>{
  const s=fixture(scenario),before=structuredClone(s)
  expect(()=>apply(s,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:s.players['player-one'].battleArea[0].card.instanceId,targetInstanceId:s.players['player-two'].battleArea[0].card.instanceId,supportPaymentIds:s.players['player-one'].supportArea.map(c=>c.card.instanceId)})).toThrow();expect(s).toEqual(before)
 })
 it.each([3,4,5] as const)('Lv%s activates the free revealed-card return',level=>{
  const s=fixture(),before=structuredClone(s),id=s.pendingBattle!.revealedHpCard!.instanceId,d=takeAiStep(s,getActingPlayerId(s),{level,searchNow:()=>0})
  expect(d.action).not.toBe('error');expect(d.state.players['player-one'].hand.map(c=>c.instanceId)).toContain(id);expect(s).toEqual(before)
 })
 it('deploys with original four HP and leaves the existing Cookie in play',()=>{
  const s=fixture('play'),n=apply(s,{kind:'deploy-cookie',playerId:'player-one',instanceId:s.players['player-one'].hand[0].instanceId})
  expect(n.players['player-one'].battleArea).toHaveLength(2);expect(n.players['player-one'].battleArea.find(c=>c.card.id==='ST8-002')?.hpCards).toHaveLength(4)
 })
})
