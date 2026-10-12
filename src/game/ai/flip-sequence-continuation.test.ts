import {beforeAll,describe,expect,it} from 'vitest'
import {createAiFlipSequencePreview} from '../ai-flip-sequence-demo'
import {takeAiStep} from '../ai'
import {applyGameCommand} from '../commands'
import {getActingPlayerId} from '../controller'
import {hasDamageSequenceFlipInterruption} from '../pending'
import type {GameState} from '../types'

describe('AI resolves a real FLIP interrupt before finishing nested effect damage',()=>{
 let state:GameState
 beforeAll(()=>{state=createAiFlipSequencePreview()})
 it('reproduces original Yoga FLIP from an actual sourced-deck opening',()=>{
  expect(state.turnNumber).toBe(6)
  expect(state.pendingAbilityEffect?.sourceCardName).toBe('Yoga Cookie')
  expect(state.pendingAbilityEffect?.battleContinuation).toBe('flip-damage')
  expect(state.pendingBattle?.effectDamageSequence?.afterCurrentDamageResolved).toBe(true)
  expect(state.commandLog?.some(entry=>entry.payload.kind==='declare-attack')).toBe(true)
 })
 it('the authoritative resolver accepts the pending FLIP and resumes the battle',()=>{
  const before=structuredClone(state)
  const next=applyGameCommand(state,{kind:'resolve-ability-effect',playerId:'player-two',targetIds:[state.players['player-two'].battleArea[0].card.instanceId]})
  expect(next.pendingAbilityEffect).toBeUndefined()
  expect(next.players['player-two'].battleArea[0].rested).toBe(false)
  expect(state).toEqual(before)
 })
 it('waits until the current damage point has resolved',()=>{
  const control=structuredClone(state)
  if(!control.pendingBattle?.effectDamageSequence)throw Error('Real sequence')
  control.pendingBattle.effectDamageSequence.afterCurrentDamageResolved=false
  expect(hasDamageSequenceFlipInterruption(control)).toBe(false)
 })
 it('does not unblock the outer ability that owns its damage sequence',()=>{
  const control=structuredClone(state)
  if(!control.pendingAbilityEffect)throw Error('Real FLIP')
  control.pendingAbilityEffect.sourceKind='skill'
  expect(hasDamageSequenceFlipInterruption(control)).toBe(false)
 })
 it('does not require the whole sequence to be empty before its FLIP interruption',()=>{
  const control=structuredClone(state)
  if(!control.pendingBattle?.effectDamageSequence)throw Error('Real sequence')
  control.pendingBattle.effectDamageSequence.remainingTargetInstanceIds=[control.players['player-two'].battleArea[1].card.instanceId]
  expect(hasDamageSequenceFlipInterruption(control)).toBe(true)
 })
 it('keeps the FLIP that owns the outer damage sequence blocked',()=>{
  const control=structuredClone(state)
  if(!control.pendingBattle?.effectDamageSequence||!control.pendingAbilityEffect)throw Error('Real sequence and FLIP')
  control.pendingBattle.effectDamageSequence.continuation='ability-effect'
  control.pendingBattle.effectDamageSequence.continuationSourceInstanceId=control.pendingAbilityEffect.sourceInstanceId
  expect(hasDamageSequenceFlipInterruption(control)).toBe(false)
 })
 it('allows a different revealed FLIP to interrupt an outer ability damage sequence',()=>{
  const control=structuredClone(state)
  if(!control.pendingBattle?.effectDamageSequence)throw Error('Real sequence')
  control.pendingBattle.effectDamageSequence.continuation='ability-effect'
  control.pendingBattle.effectDamageSequence.continuationSourceInstanceId=control.players['player-one'].battleArea[0].card.instanceId
  expect(hasDamageSequenceFlipInterruption(control)).toBe(true)
 })
 it.each([3,4,5] as const)('Lv%s processes the FLIP instead of resending zero-damage resolution',level=>{
  const before=structuredClone(state),playerId=getActingPlayerId(state)
  expect(playerId).toBe('player-two')
  const decision=takeAiStep(state,playerId,{level,searchNow:()=>0,seed:2026194017})
  expect(decision.state.commandLog?.at(-1)?.payload.kind).toBe('resolve-ability-effect')
  expect(decision.state.pendingAbilityEffect).toBeUndefined()
  expect(decision.state.players['player-two'].battleArea[0].rested).toBe(false)
  expect(state).toEqual(before)
 })
})
