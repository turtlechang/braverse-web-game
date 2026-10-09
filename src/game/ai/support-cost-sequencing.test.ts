import {describe,expect,it} from 'vitest'
import {takeAiStep} from '../ai'
import {getActingPlayerId} from '../controller'
import type {GameState} from '../types'
import fixture from './fixtures/bs12-green-support-cost-replay.json'
const restore=(value:unknown):unknown=>{
 if(Array.isArray(value))return value.map(restore)
 if(!value||typeof value!=='object')return value
 const record=value as Record<string,unknown>
 if(typeof record.cardRef==='string'){
  const definitions=fixture.cardDefinitions as Record<string,unknown>
  return {...structuredClone(definitions[record.cardRef]) as object,instanceId:record.instanceId}
 }
 return Object.fromEntries(Object.entries(record).map(([key,child])=>[key,restore(child)]))
}
const state=()=>restore(fixture.state) as GameState
const options={level:5 as const,searchNow:()=>0}
describe('Lv.5 support cost sequencing replay regression',()=>{
 it('attacks with Mystic Flour before removing the two supports needed to attack',()=>{
  const before=state();const result=takeAiStep(before,'player-two',options)
  expect(result.action).toBe('attack')
  expect(result.state.pendingBattle?.attackerInstanceId).toBe('player-two-BS8-059-1')
  expect(result.reason?.actionScore?.contributions).toContainEqual(expect.objectContaining({id:'support-cost-followup',amount:expect.any(Number)}))
  expect(before).toEqual(state())
 })
 it('really resolves responses and FLIP before paying with a separate support and returning the rested pair',()=>{
  let current=state();const before=current;const actions:string[]=[]
  for(let count=0;count<12;count++){
   const player=getActingPlayerId(current),decision=takeAiStep(current,player,options)
   expect(decision.action).not.toBe('error');expect(decision.state).not.toBe(current)
   actions.push(decision.action);current=decision.state
   if(player==='player-two'&&decision.action==='activate-skill')break
  }
  expect(actions).toEqual(['attack','play-trap','resolve-damage','resolve-flip','activate-skill'])
  const activation=current.commandLog!.at(-1)!.payload
  expect(activation.paymentIds).toEqual(['player-two-BS7-049-3'])
  expect(activation.supportToHandIds).toEqual(['player-two-BS7-056-3','player-two-BS7-056-4'])
  expect(current.players['player-two'].supportArea).toHaveLength(1)
  expect(current.players['player-two'].supportArea[0].rested).toBe(true)
  expect(before).toEqual(state())
 })
 it('does not use opponent hand, deck or unrevealed HP order to choose the continuation',()=>{
  const first=state(),hidden=state(),foe=hidden.players['player-one']
  foe.hand.reverse();foe.deck.reverse()
  for(const cookie of foe.battleArea)cookie.hpCards.reverse()
  hidden.players['player-two'].deck.reverse()
  for(const cookie of hidden.players['player-two'].battleArea)cookie.hpCards.reverse()
  const a=takeAiStep(first,'player-two',options),b=takeAiStep(hidden,'player-two',options)
  expect(b.action).toEqual(a.action)
  expect(b.state.pendingBattle?.attackerInstanceId).toEqual(a.state.pendingBattle?.attackerInstanceId)
  expect(b.state.pendingBattle?.targetInstanceId).toEqual(a.state.pendingBattle?.targetInstanceId)
  expect(b.reason?.actionScore).toEqual(a.reason?.actionScore)
 })
 it('does not reward a follow-up that lacks the remaining Activate energy',()=>{
  const before=state(),player=before.players['player-two']
  const removed=player.supportArea.pop()!;player.hand.push(removed.card)
  const result=takeAiStep(before,'player-two',options)
  expect(result.reason?.actionScore?.contributions.some(c=>c.id==='support-cost-followup')).not.toBe(true)
 })
 it('does not reward an Activate that has already been used this turn',()=>{
  const before=state();before.skillUsesThisTurn=['player-two-BS8-059-1:battle:10']
  const result=takeAiStep(before,'player-two',options)
  expect(result.reason?.actionScore?.contributions.some(c=>c.id==='support-cost-followup')).not.toBe(true)
 })
 it('keeps the Lv.4 comparison policy unchanged',()=>{
  const result=takeAiStep(state(),'player-two',{...options,level:4})
  expect(result.reason?.actionScore?.contributions.some(c=>c.id==='support-cost-followup')).not.toBe(true)
 })
})
