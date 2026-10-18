import {describe,it,expect} from 'vitest'
import {createCardCheckDemoState,createCardNegativeDemoState,parseTestStateConfig} from './demo'
import {createDeckAdditionDemoState} from './bs12-deck-addition-demo'
import type {DeckAdditionScenario} from './bs12-deck-addition-demo'
import {createSt8009PreviewState,st8009Scenarios} from './st8-009-demo'
import {createSt8009AiPreviewState} from './st8-009-ai-demo'
import {applyGameCommand} from './commands'
import {commandFromLogEntry} from './replay'
import {takeAiStep} from './ai'
import {selectEnergyPayment} from './energy'

describe('ST8-009 original physical public routes',()=>{
 it.each(['ST8-009','st8-009'])('normalizes %s on the public URL',number=>{
  expect(parseTestStateConfig(`?test-state=card:${number}`,'localhost')).toEqual({kind:'card-check',cardNumber:'ST8-009'})
 })
 it('opens actual HP FLIP, with the negative outside FLIP timing rather than a fake resource restriction',()=>{
  expect(createCardCheckDemoState('ST8-009')).toEqual(createSt8009PreviewState('positive'))
  const negative=createCardNegativeDemoState('ST8-009'),before=structuredClone(negative)
  expect(negative).toEqual(createSt8009PreviewState('wrong-phase'))
  expect(selectEnergyPayment({green:3},negative.players['player-one'].supportArea)).not.toBeNull()
  expect(()=>applyGameCommand(negative,{kind:'resolve-flip',playerId:'player-one',activate:true})).toThrow()
  expect(negative).toEqual(before)
 })
 it.each(st8009Scenarios)('dispatches original %s effect-specific state',scenario=>{
  expect(parseTestStateConfig(`?test-state=deck-addition:ST8-009:${scenario}`,'localhost'))
   .toEqual({kind:'deck-addition',cardNumber:'ST8-009',scenario})
  expect(createDeckAdditionDemoState('ST8-009',scenario as DeckAdditionScenario)).toEqual(createSt8009PreviewState(scenario))
 })
 it('cannot activate printed FLIP as a free main-phase skill while all ordinary resources remain available',()=>{
  const state=createSt8009PreviewState('attack'),before=structuredClone(state)
  const source=state.players['player-one'].battleArea[0].card
  expect(state.phase).toBe('main')
  expect(selectEnergyPayment({green:3},state.players['player-one'].supportArea)).not.toBeNull()
  expect(()=>applyGameCommand(state,{kind:'begin-activate-skill',playerId:'player-one',
   sourceInstanceId:source.instanceId,trigger:'activate',paymentIds:[]})).toThrow()
  expect(()=>applyGameCommand(state,{kind:'resolve-flip',playerId:'player-one',activate:true})).toThrow()
  expect(state).toEqual(before)
 })
 it.each(['positive','low'] as const)('replays canonical actual AI %s parents and chooses the safe free draw',scenario=>{
  const original=createSt8009AiPreviewState(scenario)
  let state=createSt8009AiPreviewState(scenario,true)
  for(const entry of original.commandLog??[])state=applyGameCommand(state,commandFromLogEntry(entry))
  expect(state).toEqual(original)
  const name=scenario==='positive'?'ai-positive':'ai-low'
  expect(createDeckAdditionDemoState('ST8-009',name)).toEqual(original)
  expect(parseTestStateConfig(`?test-state=deck-addition:ST8-009:${name}`,'localhost'))
   .toEqual({kind:'deck-addition',cardNumber:'ST8-009',scenario:name})
  const activated=takeAiStep(original,'player-two',{level:5,seed:1})
  expect(activated.error).toBeUndefined()
  expect(activated.state.commandLog?.at(-1)?.payload).toMatchObject({kind:'resolve-flip',activate:true})
  const drawn=takeAiStep(activated.state,'player-two',{level:5,seed:1})
  expect(drawn.error).toBeUndefined()
  expect(drawn.state.commandLog?.at(-1)?.payload).toMatchObject({kind:'resolve-draw-up-to',drawCount:1})
 })
})
