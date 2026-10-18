import {beforeAll,describe,it,expect} from 'vitest'
import {createAiStageChildSequencePreview} from '../ai-stage-child-sequence-demo'
import {applyGameCommand} from '../commands'
import {takeAiStep} from '../ai'
import {getActingPlayerId} from '../controller'
import type {GameState} from '../types'

describe('suspended stage parent does not block its child damage completion',()=>{
 let state:GameState
 beforeAll(()=>{state=createAiStageChildSequencePreview()})
 it('reconstructs the actual green mirror sequence from an opening and physical commands',()=>{
  expect(state.turnNumber).toBe(13)
  expect(state.pendingBattle?.effectDamageSequence?.continuation).toBe('ability-effect')
  expect(state.pendingAbilityEffect?.sourceCardName).toBe('Choco Drizzle Cookie')
  expect(state.suspendedAbilityEffects?.[0].sourceCardName).toBe('Cookie Games Stadium')
 })
 it('finishes already resolved child damage and restores the stage parent without damage repetition',()=>{
  const before=structuredClone(state),playerId=state.pendingBattle?.damagePlayerId??state.pendingBattle!.defenderPlayerId
  const next=applyGameCommand(state,{kind:'resolve-next-damage',playerId})
  expect(next.pendingBattle??null).toBeNull()
  expect(next.pendingAbilityEffect?.sourceCardName).toBe('Cookie Games Stadium')
  expect(next.pendingAbilityEffect?.effectIndex).toBe(1)
  expect(next.suspendedAbilityEffects??[]).toEqual([])
  expect(next.players).toEqual(before.players);expect(state).toEqual(before)
 })
 it('finishes child damage and then starts a queued departure skill',()=>{
  const control=structuredClone(state)
  const parent=control.pendingAbilityEffect
  if(!parent)throw Error('Child ability continuation required')
  control.pendingDepartureSkillTriggers=[{
   playerId:'player-one',sourceInstanceId:'departed-cookie',sourceCardName:'Departure Skill Cookie',effects:parent.effects,
  }]
  const decision=takeAiStep(control,getActingPlayerId(control),{level:3,seed:202680841,searchNow:()=>0})
  expect(decision.action).toBe('resolve-damage')
  expect(decision.state.pendingBattle??null).toBeNull()
  expect(decision.state.pendingAbilityEffect).toMatchObject({trigger:'departure',sourceCardName:'Departure Skill Cookie'})
  expect(decision.state.pendingDepartureSkillTriggers).toBeUndefined()
  expect(decision.state.suspendedAbilityEffects?.map(effect=>effect.sourceCardName)).toContain('Cookie Games Stadium')
 })
 it.each([3,4,5] as const)('Lv%s resumes the suspended stage rather than endlessly resolving damage',level=>{
  const before=structuredClone(state),d=takeAiStep(state,getActingPlayerId(state),{level,seed:202680841,searchNow:()=>0})
  expect(d.action).not.toBe('error');expect(d.state.pendingBattle??null).toBeNull()
  expect(d.state.pendingAbilityEffect?.sourceCardName).toBe('Cookie Games Stadium')
  expect(d.state.players).toEqual(before.players);expect(state).toEqual(before)
 })
 it('resumes the parent draw exactly once without paying its stage cost again',()=>{
  const playerId=state.pendingBattle?.damagePlayerId??state.pendingBattle!.defenderPlayerId
  let next=applyGameCommand(state,{kind:'resolve-next-damage',playerId})
  const owner='player-two',before=structuredClone(next.players[owner])
  next=applyGameCommand(next,{kind:'resolve-ability-effect',playerId:owner,targetIds:[]})
  expect(next.pendingDrawUpTo?.max).toBe(1)
  next=applyGameCommand(next,{kind:'resolve-draw-up-to',playerId:owner,drawCount:1})
  expect(next.players[owner].hand).toHaveLength(before.hand.length+1)
  expect(next.players[owner].deck).toHaveLength(before.deck.length-1)
  expect(next.players[owner].supportArea).toEqual(before.supportArea)
  expect(next.pendingAbilityEffect??null).toBeNull();expect(next.suspendedAbilityEffects??[]).toEqual([])
 })
})
