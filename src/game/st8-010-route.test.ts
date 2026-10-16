import {describe,it,expect} from 'vitest'
import {createCardCheckDemoState,createCardNegativeDemoState,parseTestStateConfig} from './demo'
import {createDeckAdditionDemoState} from './bs12-deck-addition-demo'
import {createSt8010PreviewState,st8010Scenarios} from './st8-010-demo'
import {createSt8010AiPreviewState} from './st8-010-ai-demo'
import {applyGameCommand} from './commands'
import {commandFromLogEntry} from './replay'
import {takeAiStep} from './ai'
import {hasPendingFaintModeCost} from './battle'
import {compilePendingDecisionDescriptor} from './decision-descriptor-compiler'

describe('ST8-010 real faint cost and public route integration',()=>{
 it.each(['ST8-010','st8-010'])('normalizes public card %s',number=>{
  expect(parseTestStateConfig(`?test-state=card:${number}`,'localhost')).toEqual({kind:'card-check',cardNumber:'ST8-010'})
 })
 it('opens actual original faint or real no-Item payment blocker',()=>{
  expect(createCardCheckDemoState('ST8-010')).toEqual(createSt8010PreviewState('positive'))
  expect(createCardNegativeDemoState('ST8-010')).toEqual(createSt8010PreviewState('no-item'))
 })
 it.each(st8010Scenarios)('dispatches original %s state',scenario=>{
  expect(parseTestStateConfig(`?test-state=deck-addition:ST8-010:${scenario}`,'localhost'))
   .toEqual({kind:'deck-addition',cardNumber:'ST8-010',scenario})
  expect(createDeckAdditionDemoState('ST8-010',scenario)).toEqual(createSt8010PreviewState(scenario))
 })
 it('keeps ordinary attack and its real payment negative separate from faint timing',()=>{
  expect(createCardCheckDemoState('ST8-010',{normalAttack:'payable'})).toEqual(createSt8010PreviewState('attack'))
  expect(createCardNegativeDemoState('ST8-010',{normalAttack:'blocked'})).toEqual(createSt8010PreviewState('attack-negative'))
 })
 it('authority describes exact Item cost before modes and removes only the paid cost',()=>{
  const original=createSt8010PreviewState('positive'),before=structuredClone(original)
  const items=original.players['player-one'].supportArea.filter(s=>s.card.type==='item').map(s=>s.card.instanceId)
  expect(hasPendingFaintModeCost(original)).toBe(true)
  const cost=compilePendingDecisionDescriptor(original)
  expect(cost?.status).toBe('ready');expect(cost?.actionKinds).toEqual(['resolve-faint-effect'])
  expect(cost?.steps).toEqual([expect.objectContaining({kind:'cost',min:1,max:1,candidateIds:items,
   candidateSource:'public-support',commandKinds:['resolve-faint-effect']})])
  expect(()=>applyGameCommand(original,{kind:'resolve-choose-one',playerId:'player-one',modeIndex:0})).toThrow()
  expect(()=>applyGameCommand(original,{kind:'resolve-faint-effect',playerId:'player-one',targetIds:[],paymentIds:items})).toThrow()
  expect(original).toEqual(before)
  const paid=applyGameCommand(original,{kind:'resolve-faint-effect',playerId:'player-one',targetIds:[],supportToHandIds:[items[0]]})
  expect(hasPendingFaintModeCost(paid)).toBe(false)
  expect(paid.pendingFaintEffects?.[0].effect).toEqual(original.pendingFaintEffects?.[0].effect)
  expect(paid.pendingFaintEffects?.[0].cost).toBeUndefined()
  const modes=compilePendingDecisionDescriptor(paid)
  expect(modes?.status).toBe('ready');expect(modes?.actionKinds).toEqual(['resolve-choose-one'])
  expect(modes?.steps[0]).toMatchObject({id:'faint-mode',candidateIds:['0','1']})
 })
 it.each([3,4,5] as const)('Lv%s pays the real public Item, chooses one support and replays all parents',level=>{
  const original=createSt8010AiPreviewState('positive')
  let replay=createSt8010AiPreviewState('positive',true)
  for(const entry of original.commandLog??[])replay=applyGameCommand(replay,commandFromLogEntry(entry))
  expect(replay).toEqual(original)
  expect(createDeckAdditionDemoState('ST8-010','ai-positive')).toEqual(original)
  const paid=takeAiStep(original,'player-two',{level,seed:1})
  expect(paid.error).toBeUndefined()
  expect(paid.state.commandLog?.at(-1)?.payload).toMatchObject({kind:'resolve-faint-effect',supportToHandIds:[expect.any(String)]})
  expect(paid.state.players['player-two'].hand).toHaveLength(original.players['player-two'].hand.length+1)
  const mode=takeAiStep(paid.state,'player-two',{level,seed:1})
  expect(mode.error).toBeUndefined();expect(mode.state.commandLog?.at(-1)?.payload).toMatchObject({kind:'resolve-choose-one',modeIndex:0})
  const settled=takeAiStep(mode.state,'player-two',{level,seed:1})
  expect(settled.error).toBeUndefined()
  expect(settled.state.players['player-two'].supportArea.at(-1)).toEqual({card:original.players['player-two'].deck[0],rested:true})
  expect(settled.state.players['player-two'].deck).toEqual(original.players['player-two'].deck.slice(1))
  replay=createSt8010AiPreviewState('positive',true)
  for(const entry of settled.state.commandLog??[])replay=applyGameCommand(replay,commandFromLogEntry(entry))
  expect(replay).toEqual(settled.state)
 })
 it.each([3,4,5] as const)('Lv%s with no Item skips before modes without moving cards',level=>{
  const original=createSt8010AiPreviewState('negative')
  expect(createDeckAdditionDemoState('ST8-010','ai-negative')).toEqual(original)
  const skipped=takeAiStep(original,'player-two',{level,seed:1})
  expect(skipped.error).toBeUndefined()
  expect(skipped.state.pendingFaintEffects?.length??0).toBe(0)
  for(const zone of ['hand','deck','supportArea'] as const)
   expect(skipped.state.players['player-two'][zone]).toEqual(original.players['player-two'][zone])
  expect(skipped.state.commandLog?.at(-1)?.payload).toMatchObject({kind:'resolve-faint-effect',targetIds:[]})
 })
})
