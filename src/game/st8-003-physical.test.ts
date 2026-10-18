import {describe,it,expect} from 'vitest'
import {fixture,zones} from './st8-003-demo'
import {applyGameCommand as apply} from './commands'
import {takeAiStep} from './ai'
const owner='player-one',foe='player-two'
const attack=(s:ReturnType<typeof fixture>,paymentIds=s.players[owner].supportArea.map(c=>c.card.instanceId))=>apply(s,{kind:'declare-attack',playerId:owner,attackerInstanceId:s.players[owner].battleArea[0].card.instanceId,targetInstanceId:s.players[foe].battleArea[0].card.instanceId,supportPaymentIds:paymentIds})
describe('ST8-003 original neutral-three attack',()=>{
 it.each(['positive','play','rested-source','rested-energy','no-energy','wrong-phase','first-turn',...['red','yellow','green','blue','purple','black'].map(c=>'color-'+c)])('retains sixty original unique cards: %s',scenario=>{
  const s=fixture(scenario);for(const id of [owner,foe] as const){const cards=zones(s,id);expect(cards).toHaveLength(60);expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60);for(const c of cards){expect(cards.filter(x=>x.id===c.id).length).toBeLessThanOrEqual(4);expect(c.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)}}
 })
 it.each(['positive',...['red','yellow','green','blue','purple','black'].map(c=>'color-'+c)])('pays three arbitrary colors, rests source, deals exactly ordinary three: %s',scenario=>{
  const s=fixture(scenario),before=structuredClone(s);let n=attack(s);n=apply(n,{kind:'skip-trap',playerId:foe});for(let i=0;i<3;i++)n=apply(n,{kind:'resolve-next-damage',playerId:foe})
  expect(n.players[foe].battleArea[0].hpCards).toHaveLength(1);expect(n.players[foe].battleArea[1]).toEqual(before.players[foe].battleArea[1])
  expect(n.players[owner].supportArea.every(c=>c.rested)).toBe(true);expect(n.players[owner].battleArea[0].rested).toBe(true);expect(n.players[owner].battleArea[0].hpCards).toHaveLength(4)
  expect(n.pendingAbilityEffect??null).toBeNull();expect(s).toEqual(before)
 })
 it.each(['rested-source','rested-energy','no-energy','wrong-phase','first-turn'])('blocks %s without mutation',scenario=>{const s=fixture(scenario),before=structuredClone(s);expect(()=>attack(s)).toThrow();expect(s).toEqual(before)})
 it('rejects incomplete and duplicate payments',()=>{const s=fixture(),ids=s.players[owner].supportArea.map(c=>c.card.instanceId);expect(()=>attack(s,ids.slice(0,2))).toThrow();expect(()=>attack(s,[ids[0],ids[0],ids[2]])).toThrow()})
 it('deploys original four HP alongside a surviving Cookie',()=>{const s=fixture('play'),n=apply(s,{kind:'deploy-cookie',playerId:owner,instanceId:s.players[owner].hand[0].instanceId});expect(n.players[owner].battleArea).toHaveLength(2);expect(n.players[owner].battleArea.find(c=>c.card.id==='ST8-003')?.hpCards).toHaveLength(4)})
 it.each([3,4,5] as const)('Lv%s performs a legal three-damage attack',level=>{const s=fixture(),before=structuredClone(s),d=takeAiStep(s,owner,{level,searchNow:()=>0});expect(d.action).toBe('attack');expect(d.state.players[owner].battleArea[0].rested).toBe(true);expect(s).toEqual(before)})
})
