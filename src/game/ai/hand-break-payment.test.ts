import {describe,expect,it} from 'vitest'
import {fixture} from '../st7-019-demo'
import {selectSafeHandBreakPayment as select} from './hand-break-payment'
import type {AbilityCost} from '../types'
const cost:AbilityCost={energy:{yellow:1},handToBreakArea:{count:1}}
const setup=(scenario:string)=>{const state=fixture(scenario),hand=state.players['player-one'].hand;return{state,source:hand.find(c=>c.id==='ST7-019')!.instanceId,ids:['BS12-076','ST7-007','ST7-004','ST1-011'].map(id=>hand.find(c=>c.id===id)!.instanceId)}}
describe('public hand Cookie Break payment safety',()=>{
 it('keeps strategic order when all payments are safe',()=>{
  const {state,source,ids}=setup('positive');expect(select(state,'player-one',cost,source,ids)).toEqual([ids[0]])
 })
 it('skips higher-retention-priority payments that would reach Break10',()=>{
  const {state,source,ids}=setup('break8'),before=structuredClone(state)
  expect(select(state,'player-one',cost,source,ids)).toEqual([ids[2]]);expect(state).toEqual(before)
 })
 it('evaluates the combined sum rather than each individually safe Cookie',()=>{
  const {state,source,ids}=setup('break7')
  expect(select(state,'player-one',{...cost,handToBreakArea:{count:2}},source,ids)).toEqual([ids[2],ids[3]])
 })
 it.each(['cost-loss','mutual-win','all-fatal'])('returns no payment when every allowed Cookie loses immediately: %s',scenario=>{
  const {state,source,ids}=setup(scenario);expect(select(state,'player-one',cost,source,ids)).toBeNull()
 })
 it('does not force an unsafe higher-level payment when filtering legal levels',()=>{
  const {state,source,ids}=setup('break8')
  expect(select(state,'player-one',{...cost,handToBreakArea:{count:1,minLevel:2}},source,ids)).toBeNull()
 })
 it('honors legal color and keyword restrictions on the actual original cards',()=>{
  const {state,source,ids}=setup('positive')
  expect(select(state,'player-one',{...cost,handToBreakArea:{count:1,energyColor:'red'}},source,ids)).toEqual([ids[3]])
  expect(select(state,'player-one',{...cost,handToBreakArea:{count:1,keyword:'arena'}},source,ids)).toEqual([ids[0]])
  expect(select(state,'player-one',{...cost,handToBreakArea:{count:1,keyword:'ancient'}},source,ids)).toBeNull()
 })
 it('rejects missing/non-Cookie/source IDs and cannot reuse one Cookie twice',()=>{
  const {state,source,ids}=setup('positive'),nonCookie=state.players['player-one'].hand.find(c=>c.id==='ST6-016')!.instanceId
  expect(select(state,'player-one',cost,source,[source,nonCookie,'unknown'])).toBeNull()
  expect(select(state,'player-one',{...cost,handToBreakArea:{count:2}},source,[ids[2],ids[2]])).toBeNull()
 })
 it('does not inspect opponent hidden cards or deck order',()=>{
  const {state,source,ids}=setup('break8'),alternate=structuredClone(state)
  alternate.players['player-two'].deck.reverse();alternate.players['player-two'].hand.push(alternate.players['player-two'].deck.pop()!)
  expect(select(state,'player-one',cost,source,ids)).toEqual(select(alternate,'player-one',cost,source,ids))
 })
 it('leaves a cost without hand-to-Break payment unchanged',()=>{
  const {state,source,ids}=setup('cost-loss');expect(select(state,'player-one',{energy:{yellow:1}},source,ids)).toEqual([])
 })
})
