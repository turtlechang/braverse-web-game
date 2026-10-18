import {describe,it,expect} from 'vitest'
import {createSt6017PreviewState as fixture,raw} from './st6-017-demo'
import {createCard} from './starter-deck'
import {applyGameCommand as apply} from './commands'
import {getTrapCandidates} from './battle'
import {getEffectiveAttack} from './effects'
import type {GameState} from './types'
import type {GameCommand} from './commands'
const inventory=(state:GameState)=>{for(const p of Object.values(state.players)){
 const cards=[...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(s=>s.card),...p.battleArea.flatMap(c=>[c.card,...c.hpCards])]
 expect(cards).toHaveLength(60);expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60)
 for(const c of cards){expect(c.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//);expect(cards.filter(x=>x.id===c.id).length).toBeLessThanOrEqual(4)}
}}
const command=(state:GameState,targetIds?:string[]):GameCommand=>({kind:'play-trap',playerId:'player-one',trapInstanceId:state.players['player-one'].hand[0].instanceId,paymentIds:state.players['player-one'].supportArea.slice(0,2).map(s=>s.card.instanceId),targetIds:[],effectTargets:[targetIds??[state.players['player-two'].battleArea[1].card.instanceId]]})
const effects=[{kind:'modify-attack',amount:-2,duration:'this-turn',target:{side:'opponent',min:0,max:1},thenEffects:[{kind:'modify-attack',amount:-1,duration:'this-turn',target:{side:'opponent',min:0,max:1,previousEffectTargetOnly:true},condition:{kind:'battle-area-remaining-hp-count-at-least',side:'self',remainingHp:1,count:1}}]}]
describe('ST6-017 independently printed conditional extra reduction',()=>{
 it('has exact RR, unconditional -2 and same-target conditional -1',()=>{
  const card=createCard(raw,'player-one',1)
  expect([card.name,card.type,card.energyColor]).toEqual(['Restored Power of Fire','trap','red'])
  expect(card.trap?.cost).toEqual({energy:{red:2},discardHand:0});expect(card.trap?.condition).toBeUndefined()
  expect(card.trap?.effects).toEqual(effects)
 })
 it.each(['positive','rested-witness','defender-one','false','hand-witness','trash-witness','break-witness','support-witness','opponent-witness'])(
  'uses battle-area exact one HP only: %s',scenario=>{
   const state=fixture(scenario),before=structuredClone(state),own=state.players['player-one']
   inventory(state);expect(getTrapCandidates(state,'player-one').map(c=>c.instanceId)).toContain(own.hand[0].instanceId)
   const next=apply(state,command(state)),bonus=['positive','rested-witness','defender-one'].includes(scenario)
   expect(next.attackModifiers.map(m=>m.amount)).toEqual(bonus?[-2,-1]:[-2])
   expect(next.attackModifiers.every(m=>m.targetInstanceId===state.players['player-two'].battleArea[1].card.instanceId&&m.expiresAfterTurn===state.turnNumber)).toBe(true)
   expect(next.players['player-one'].battleArea).toEqual(own.battleArea)
   expect(next.pendingBattle?.remainingDamage).toBe(bonus?1:2)
   expect(next.players['player-one'].supportArea.filter(s=>s.rested)).toHaveLength(2)
   expect(next.players['player-one'].discardPile.some(c=>c.instanceId===own.hand[0].instanceId)).toBe(true)
   expect(state).toEqual(before);inventory(next)
  })
 it.each(['positive','false'])('permits zero while binding Then to no target: %s',scenario=>{
  const state=fixture(scenario),before=structuredClone(state),next=apply(state,command(state,[]))
  expect(next.attackModifiers).toEqual([]);expect(next.pendingBattle?.remainingDamage).toBe(4)
  expect(state).toEqual(before);inventory(next)
 })
 it('can reduce the other opponent while the original attacker still deals 4',()=>{
  const state=fixture('other'),id=state.players['player-two'].battleArea[0].card.instanceId
  const next=apply(state,command(state,[id]));expect(next.attackModifiers.map(m=>[m.targetInstanceId,m.amount])).toEqual([[id,-2],[id,-1]])
  expect(next.pendingBattle?.remainingDamage).toBe(4);inventory(next)
 })
 it.each(['negative','wrong-color','one-red','main','wrong-phase'])('rejects unavailable response %s without mutation',scenario=>{
  const state=fixture(scenario),before=structuredClone(state)
  expect(getTrapCandidates(state,'player-one')).toEqual([]);expect(()=>apply(state,command(state))).toThrow();expect(state).toEqual(before);inventory(state)
 })
 it.each(['own','two','unknown'])('rejects selected target %s without mutation',scenario=>{
  const state=fixture(),before=structuredClone(state),foe=state.players['player-two'].battleArea
  const ids=scenario==='own'?[state.players['player-one'].battleArea[0].card.instanceId]:scenario==='two'?foe.map(c=>c.card.instanceId):['unknown']
  expect(()=>apply(state,command(state,ids))).toThrow();expect(state).toEqual(before)
 })
 it.each(['positive','false','zero','other'])('settles actual 4 attack with the printed reduction: %s',scenario=>{
  const state=fixture(scenario),before=structuredClone(state),id=scenario==='other'?state.players['player-two'].battleArea[0].card.instanceId:state.players['player-two'].battleArea[1].card.instanceId
  let next=apply(state,command(state,scenario==='zero'?[]:[id]))
  next=apply(next,{kind:'resolve-battle',playerId:'player-two'})
  expect(next.players['player-one'].battleArea[1].hpCards).toHaveLength(scenario==='positive'?5:scenario==='false'?4:2)
  expect(state).toEqual(before);inventory(next)
 })
 it.each(['positive','false'])('expires all printed reductions at the next turn: %s',scenario=>{
  const state=fixture(scenario),before=structuredClone(state)
  let next=apply(state,command(state))
  expect(next.attackModifiers).toHaveLength(scenario==='positive'?2:1)
  next=apply(next,{kind:'resolve-battle',playerId:'player-two'})
  expect(next.attackModifiers).toHaveLength(scenario==='positive'?2:1)
  for(let i=0;i<8&&next.turnNumber===state.turnNumber;i++)next=apply(next,{kind:'advance-phase',playerId:next.activePlayerId})
  expect(next.turnNumber).toBeGreaterThan(state.turnNumber);expect(next.attackModifiers).toEqual([])
  expect(getEffectiveAttack(next,next.players['player-two'].battleArea[1].card.instanceId)).toBe(4)
  expect(state).toEqual(before);inventory(next)
 })

})
