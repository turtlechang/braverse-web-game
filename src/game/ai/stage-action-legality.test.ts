import {describe,it,expect} from 'vitest'
import {fixture} from '../st7-020-demo'
import {takeAiStep} from '../ai'
import {canAttack} from '../turn'
import type {AiLevel} from './types'
const owner='player-one'
describe('AI considers legal stages independently of the attack phase gate',()=>{
 it.each([3,4,5] as AiLevel[])('Lv%s activates a beneficial original stage during an attack-eligible turn',level=>{
  const state=fixture(),before=structuredClone(state)
  expect(canAttack(state)).toBe(true)
  const decision=takeAiStep(state,owner,{level,searchNow:()=>0})
  expect(decision.action).toBe('activate-stage')
  expect(decision.state.players[owner].stage?.rested).toBe(true)
  expect(decision.state.pendingDrawUpTo?.max).toBe(1)
  const drawn=takeAiStep(decision.state,owner,{level,searchNow:()=>0})
  expect(drawn.state.players[owner].hand.length).toBe(state.players[owner].hand.length+1)
  expect(state).toEqual(before)
 })
 it.each(([3,4,5] as AiLevel[]).flatMap(level=>['zero-gain','opponent-only','rested-energy','wrong-energy','fatal-refresh'].map(scenario=>({level,scenario}))))('Lv$level preserves resources when a stage has no safe benefit: $scenario',({level,scenario})=>{
  const state=fixture(scenario),before=structuredClone(state)
  const decision=takeAiStep(state,owner,{level,searchNow:()=>0})
  expect(decision.action).not.toBe('activate-stage')
  expect(decision.state.commandLog?.slice(state.commandLog?.length??0).some(e=>e.payload?.kind==='begin-activate-stage')).toBe(false)
  expect(state).toEqual(before)
 })
 it.each([3,4,5] as AiLevel[])('Lv%s still creates a real HP-gain condition before drawing',level=>{
  const state=fixture('no-gain'),decision=takeAiStep(state,owner,{level,searchNow:()=>0})
  expect(decision.action).toBe('play-item')
  expect(decision.state.cookiesGainedHpThisTurn?.[owner]).toBe(true)
 })
 it('does not choose from hidden deck order or face-down HP',()=>{
  const state=fixture(),hidden=structuredClone(state)
  for(const p of Object.values(hidden.players)){p.deck.reverse();for(const c of p.battleArea)c.hpCards.reverse()}
  const before=structuredClone(hidden)
  const a=takeAiStep(state,owner,{level:5,searchNow:()=>0}),b=takeAiStep(hidden,owner,{level:5,searchNow:()=>0})
  expect(b.action).toBe(a.action)
  expect(b.state.commandLog?.slice(hidden.commandLog?.length??0).map(e=>e.payload)).toEqual(a.state.commandLog?.slice(state.commandLog?.length??0).map(e=>e.payload))
  expect(hidden).toEqual(before)
 })
})
