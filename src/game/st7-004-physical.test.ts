import {describe,it,expect} from 'vitest'
import {createSt7004PreviewState as fixture} from './st7-004-demo'
import {applyGameCommand} from './commands'
import {getLegalTurnCommands} from './legal-actions'
import {parseTestStateConfig} from './demo'
const attack=(state:ReturnType<typeof fixture>,payment?:string[])=>applyGameCommand(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:state.players['player-one'].battleArea[0].card.instanceId,targetInstanceId:state.players['player-two'].battleArea[0].card.instanceId,supportPaymentIds:payment??[state.players['player-one'].supportArea[0].card.instanceId]})
const resolve=(state:ReturnType<typeof fixture>)=>applyGameCommand(applyGameCommand(attack(state),{kind:'skip-trap',playerId:'player-two'}),{kind:'resolve-battle',playerId:'player-one'})
describe('ST7-004 original-printing rules acceptance',()=>{
 it.each(['positive','red','yellow','green','blue','purple','black','negative','wrong-phase','rested-source','used','faint'])('%s preserves 60 unique originals and printed HP',scenario=>{
  const state=fixture(scenario)
  for(const player of Object.values(state.players)){
   const cards=[...player.deck,...player.hand,...player.discardPile,...player.breakArea,...player.supportArea.map(c=>c.card),...player.battleArea.flatMap(c=>[c.card,...c.hpCards])]
   expect(cards).toHaveLength(60);expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60)
   const counts=new Map<string,number>();for(const card of cards){counts.set(card.id,(counts.get(card.id)??0)+1);expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)}
   expect([...counts.values()].every(n=>n<=4)).toBe(true)
  }
  expect(state.players['player-one'].battleArea[0].card).toMatchObject({id:'ST7-004',level:1,hp:2,attack:1,energyColor:'yellow',attackEnergyCost:{neutral:1}})
  expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
  expect(parseTestStateConfig('?test-state=deck-addition:ST7-004:'+scenario,'localhost')).toEqual({kind:'deck-addition',cardNumber:'ST7-004',scenario})
 })
 it.each(['red','yellow','green','blue','purple','black'])('pays one real %s support for N and deals exactly one without extra effects',color=>{
  const state=fixture(color),before=structuredClone(state),self=state.players['player-one'],foe=state.players['player-two']
  expect(self.supportArea[0].card.energyColor).toBe(color)
  const next=resolve(state)
  expect(state).toEqual(before);expect(next.players['player-two'].battleArea.map(c=>c.hpCards.length)).toEqual([2,2]);expect(next.players['player-two'].discardPile).toHaveLength(1)
  expect(next.players['player-one'].supportArea.map(c=>c.rested)).toEqual([true,false]);expect(next.players['player-one'].battleArea[0].rested).toBe(true)
  expect(next.players['player-one'].battleArea.map(c=>c.hpCards.length)).toEqual([2,2]);expect(next.pendingBattle).toBeNull();expect(next.pendingOptionalCostAttack).toBeFalsy();expect(next.pendingAbilityEffect).toBeFalsy()
  expect(foe.battleArea.map(c=>c.hpCards.length)).toEqual([3,2])
 })
 it.each(['negative','wrong-phase','rested-source','used'])('blocks %s via legal actions and direct command without mutation',scenario=>{
  const state=fixture(scenario),before=structuredClone(state),id=state.players['player-one'].battleArea[0].card.instanceId
  expect(getLegalTurnCommands(state,'player-one').some(c=>c.kind==='attack'&&c.attackerInstanceId===id)).toBe(false)
  expect(()=>attack(state)).toThrow();expect(state).toEqual(before)
 })
 it('rejects missing payment with all other resources available',()=>{
  const state=fixture('positive'),before=structuredClone(state);expect(()=>attack(state,[])).toThrow();expect(state).toEqual(before)
 })
 it('actual one-damage attack faints an original 1HP Cookie and adds its LV1 to Break',()=>{
  const state=fixture('faint'),before=structuredClone(state);expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
  const next=resolve(state);expect(state).toEqual(before)
  expect(next.players['player-two'].breakArea.map(c=>c.id)).toEqual(['BS6-017']);expect(next.players['player-two'].battleArea.map(c=>c.card.id)).not.toContain('BS6-017')
 })
})
