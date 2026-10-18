import {describe,it,expect} from 'vitest'
import {createSt7006PreviewState as fixture} from './st7-006-demo'
import {applyGameCommand as apply} from './commands'
import {getLegalTurnCommands} from './legal-actions'
import {getRefreshCandidates,refreshDeck} from './refresh'
const activate=(scenario='positive')=>apply(fixture(scenario),{kind:'resolve-flip',playerId:'player-one',activate:true})
describe('ST7-006 original Cream Puff Cookie physical rules',()=>{
 it.each(['positive','low','last-deck','last-deck-low','attack','attack-negative','wrong-color','wrong-phase'])('%s has sixty unique originals and printed source attributes',scenario=>{
  const state=fixture(scenario)
  for(const player of Object.values(state.players)){
   const cards=[...player.deck,...player.hand,...player.discardPile,...player.breakArea,...player.supportArea.map(s=>s.card),...player.battleArea.flatMap(c=>[c.card,...c.hpCards])]
   const revealed=(state.pendingBattle?.damagePlayerId??state.pendingBattle?.defenderPlayerId)===player.id?state.pendingBattle?.revealedHpCard:null
   if(revealed&&!cards.some(c=>c.instanceId===revealed.instanceId))cards.push(revealed)
   expect(cards).toHaveLength(60);expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60)
   const counts=new Map<string,number>();for(const card of cards){counts.set(card.id,(counts.get(card.id)??0)+1);expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)}
   expect([...counts.values()].every(n=>n<=4)).toBe(true);expect(player.battleArea.length).toBeLessThanOrEqual(2)
  }
  const source=state.pendingBattle?.revealedHpCard??state.players['player-one'].battleArea[0].card
  expect(source).toMatchObject({id:'ST7-006',name:'Cream Puff Cookie',energyColor:'yellow',level:2,hp:3,attack:3,attackEnergyCost:{yellow:3}})
 })
 it.each(['positive','low'])('actual NNN3 parent reveals the FLIP at %s',scenario=>{
  const state=fixture(scenario)
  expect(state.pendingBattle).toMatchObject({stage:'flip',declaredDamage:3,revealedHpCard:{id:'ST7-006'}})
  expect(state.players['player-two'].supportArea.every(s=>s.rested)).toBe(true)
  expect(state.players['player-one'].hand).toHaveLength(0)
  expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(scenario==='low'?0:2)
 })
 it.each(['positive','low'])('free activation opens optional draw0-1 with no hand or energy (%s)',scenario=>{
  const state=fixture(scenario),before=structuredClone(state),next=apply(state,{kind:'resolve-flip',playerId:'player-one',activate:true})
  expect(state).toEqual(before);expect(next.pendingDrawUpTo).toMatchObject({playerId:'player-one',max:1})
  expect(next.players['player-one'].supportArea).toEqual(state.players['player-one'].supportArea);expect(next.players['player-one'].hand).toHaveLength(0)
 })
 it.each(['positive','low'])('draw zero preserves deck and then continues faint handling (%s)',scenario=>{
  const pending=activate(scenario),deck=pending.players['player-one'].deck
  const next=apply(pending,{kind:'resolve-draw-up-to',playerId:'player-one',drawCount:0})
  expect(next.players['player-one'].deck).toEqual(deck);expect(next.players['player-one'].hand).toHaveLength(0)
  expect(next.players['player-one'].battleArea.map(c=>c.card.id)).toEqual(scenario==='low'?['ST1-011']:['ST1-005','ST1-011'])
 })
 it.each(['positive','low'])('draw exactly one uses the actual top deck card (%s)',scenario=>{
  const pending=activate(scenario),top=pending.players['player-one'].deck[0],before=structuredClone(pending)
  const next=apply(pending,{kind:'resolve-draw-up-to',playerId:'player-one',drawCount:1})
  expect(pending).toEqual(before);expect(next.players['player-one'].hand.map(c=>c.instanceId)).toEqual([top.instanceId]);expect(next.players['player-one'].deck.length).toBe(pending.players['player-one'].deck.length-1)
  expect(next.players['player-one'].discardPile.some(c=>c.id==='ST7-006')).toBe(true)
 })
 it.each(['positive','low'])('skipping FLIP does not draw and places original HP card in discard (%s)',scenario=>{
  const state=fixture(scenario),next=apply(state,{kind:'resolve-flip',playerId:'player-one',activate:false})
  expect(next.pendingDrawUpTo).toBeUndefined();expect(next.players['player-one'].hand).toHaveLength(0);expect(next.players['player-one'].discardPile.some(c=>c.id==='ST7-006')).toBe(true)
 })
 it.each([-1,2])('rejects unprinted draw count %s without changing input',drawCount=>{
  const state=activate(),before=structuredClone(state)
  expect(()=>apply(state,{kind:'resolve-draw-up-to',playerId:'player-one',drawCount})).toThrow();expect(state).toEqual(before)
 })
 it('rejects the wrong draw actor without changing input',()=>{
  const state=activate(),before=structuredClone(state)
  expect(()=>apply(state,{kind:'resolve-draw-up-to',playerId:'player-two',drawCount:1})).toThrow();expect(state).toEqual(before)
 })
 it.each(['last-deck','last-deck-low'])('last physical deck card causes actual Refresh before continuation (%s)',scenario=>{
  const pending=activate(scenario),top=pending.players['player-one'].deck[0]
  let next=apply(pending,{kind:'resolve-draw-up-to',playerId:'player-one',drawCount:1})
  expect(next.pendingRefresh?.playerId).toBe('player-one');expect(next.players['player-one'].hand.map(c=>c.instanceId)).toContain(top.instanceId)
  const selected=getRefreshCandidates(next,'player-one').sort((a,b)=>a.level-b.level)[0];expect(selected).toBeDefined()
  next=refreshDeck(next,'player-one',selected.instanceId,cards=>cards)
  expect(next.pendingRefresh).toBeNull();expect(next.players['player-one'].breakArea.some(c=>c.instanceId===selected.instanceId)).toBe(true)
  expect(next.players['player-one'].deck.length).toBeGreaterThan(0)
 })
 it('pays actual YYY then deals ordinary3 with no attack Then',()=>{
  const state=fixture('attack'),self=state.players['player-one'];let next=apply(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:self.battleArea[0].card.instanceId,targetInstanceId:state.players['player-two'].battleArea[0].card.instanceId,supportPaymentIds:self.supportArea.map(s=>s.card.instanceId)})
  next=apply(next,{kind:'skip-trap',playerId:'player-two'});next=apply(next,{kind:'resolve-battle',playerId:'player-one'})
  expect(next.players['player-one'].supportArea.every(s=>s.rested)).toBe(true);expect(next.players['player-two'].breakArea.some(c=>c.id==='ST1-005')).toBe(true);expect(self.battleArea[0].card.attackEffects??[]).toEqual([])
 })
 it.each(['attack-negative','wrong-color','wrong-phase'])('blocks %s through legal actions and direct command',scenario=>{
  const state=fixture(scenario),self=state.players['player-one'],before=structuredClone(state)
  expect(getLegalTurnCommands(state,'player-one').some(c=>c.kind==='attack'&&c.attackerInstanceId===self.battleArea[0].card.instanceId)).toBe(false)
  expect(()=>apply(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:self.battleArea[0].card.instanceId,targetInstanceId:state.players['player-two'].battleArea[0].card.instanceId,supportPaymentIds:self.supportArea.map(s=>s.card.instanceId)})).toThrow();expect(state).toEqual(before)
 })
})
