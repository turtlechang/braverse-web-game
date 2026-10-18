import {describe,it,expect} from 'vitest'
import {createSt7009PreviewState as fixture} from './st7-009-demo'
import {applyGameCommand as apply} from './commands'
import {getLegalTurnCommands} from './legal-actions'
const attack=(state:ReturnType<typeof fixture>,paymentIds=state.players['player-one'].supportArea.filter(s=>!s.rested).slice(0,3).map(s=>s.card.instanceId))=>apply(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:state.players['player-one'].battleArea[0].card.instanceId,targetInstanceId:state.players['player-two'].battleArea[0].card.instanceId,supportPaymentIds:paymentIds})
const resolve=(state:ReturnType<typeof fixture>)=>apply(apply(attack(state),{kind:'skip-trap',playerId:'player-two'}),{kind:'resolve-battle',playerId:'player-one'})
describe('ST7-009 original Lilybell Cookie physical rules',()=>{
 it.each(['positive','red','yellow','green','blue','purple','black','mixed','negative','insufficient','wrong-phase','rested-source','used','faint'])('%s preserves sixty original cards and printed4HP',scenario=>{
  const state=fixture(scenario)
  for(const p of Object.values(state.players)){
   const cards=[...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(s=>s.card),...p.battleArea.flatMap(c=>[c.card,...c.hpCards])]
   expect(cards).toHaveLength(60);expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60)
   const counts=new Map<string,number>();for(const c of cards){counts.set(c.id,(counts.get(c.id)??0)+1);expect(c.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)}
   expect([...counts.values()].every(n=>n<=4)).toBe(true)
  }
  expect(state.players['player-one'].battleArea[0].card).toMatchObject({id:'ST7-009',name:'Lilybell Cookie',level:2,hp:4,attack:3,attackEnergyCost:{neutral:3}})
  expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(4)
 })
 it.each(['red','yellow','green','blue','purple','black'])('pays three original %s supports for ordinary3 only',color=>{
  const state=fixture(color),before=structuredClone(state)
  expect(state.players['player-one'].supportArea.map(s=>s.card.energyColor)).toEqual([color,color,color])
  const next=resolve(state);expect(state).toEqual(before)
  expect(next.players['player-one'].supportArea.map(s=>s.rested)).toEqual([true,true,true]);expect(next.players['player-one'].battleArea[0].rested).toBe(true)
  expect(next.players['player-two'].battleArea.map(c=>c.hpCards.length)).toEqual([1,2]);expect(next.players['player-two'].discardPile).toHaveLength(3)
  expect(next.pendingBattle).toBeNull();expect(next.pendingOptionalCostAttack).toBeFalsy();expect(next.pendingAbilityEffect).toBeFalsy()
 })
 it('uses actual red/green/blue for NNN and leaves the second target unharmed',()=>{
  const state=fixture('mixed');expect(state.players['player-one'].supportArea.map(s=>s.card.energyColor)).toEqual(['red','green','blue'])
  expect(resolve(state).players['player-two'].battleArea.map(c=>c.hpCards.length)).toEqual([1,2])
 })
 it.each(['negative','insufficient','wrong-phase','rested-source','used'])('blocks %s in both legal actions and actual commands',scenario=>{
  const state=fixture(scenario),before=structuredClone(state),id=state.players['player-one'].battleArea[0].card.instanceId
  if(scenario==='used')expect(state.players['player-one'].supportArea.filter(s=>!s.rested)).toHaveLength(3)
  expect(getLegalTurnCommands(state,'player-one').some(c=>c.kind==='attack'&&c.attackerInstanceId===id)).toBe(false)
  expect(()=>attack(state)).toThrow();expect(state).toEqual(before)
 })
 it.each([0,2])('rejects only %s payment cards with all other resources available',count=>{
  const state=fixture('positive'),before=structuredClone(state)
  expect(()=>attack(state,state.players['player-one'].supportArea.slice(0,count).map(s=>s.card.instanceId))).toThrow();expect(state).toEqual(before)
 })
 it('actual ordinary3 faints original Pink Choco1HP without spilling onto another Cookie',()=>{
  const state=fixture('faint'),before=structuredClone(state),next=resolve(state);expect(state).toEqual(before)
  expect(next.players['player-two'].breakArea.map(c=>c.id)).toEqual(['BS6-017']);expect(next.players['player-two'].battleArea.map(c=>[c.card.id,c.hpCards.length])).toEqual([['ST1-011',2]])
 })
})
