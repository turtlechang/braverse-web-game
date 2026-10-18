import {describe,it,expect} from 'vitest'
import {createCardCheckDemoState,createCardNegativeDemoState,parseTestStateConfig} from './demo'
import {createDeckAdditionDemoState} from './bs12-deck-addition-demo'
import {createSt8011PreviewState,st8011Scenarios} from './st8-011-demo'
import {createSt8011AiPreviewState} from './st8-011-ai-demo'
import {applyGameCommand} from './commands'
import {commandFromLogEntry} from './replay'
import {takeAiStep} from './ai'

describe('ST8-011 original Blocker public routes and AI',()=>{
 it.each(['ST8-011','st8-011'])('normalizes public card %s',number=>{
  expect(parseTestStateConfig(`?test-state=card:${number}`,'localhost')).toEqual({kind:'card-check',cardNumber:'ST8-011'})
 })
 it('uses a real attack response or an isolated G payment blocker',()=>{
  expect(createCardCheckDemoState('ST8-011')).toEqual(createSt8011PreviewState('positive'))
  expect(createCardNegativeDemoState('ST8-011')).toEqual(createSt8011PreviewState('wrong-color'))
  expect(createCardCheckDemoState('ST8-011',{normalAttack:'payable'})).toEqual(createSt8011PreviewState('attack-green'))
  expect(createCardNegativeDemoState('ST8-011',{normalAttack:'blocked'})).toEqual(createSt8011PreviewState('attack-wrong-color'))
 })
 it.each(st8011Scenarios)('dispatches original %s scenario',scenario=>{
  expect(parseTestStateConfig(`?test-state=deck-addition:ST8-011:${scenario}`,'localhost'))
   .toEqual({kind:'deck-addition',cardNumber:'ST8-011',scenario})
  expect(createDeckAdditionDemoState('ST8-011',scenario)).toEqual(createSt8011PreviewState(scenario))
 })
 it.each([3,4,5] as const)('Lv%s redirects lethal ordinary2 to original HP3 Kiwi with real G',level=>{
  const initial=createSt8011AiPreviewState('positive'),before=structuredClone(initial)
  expect(createDeckAdditionDemoState('ST8-011','ai-positive')).toEqual(initial)
  const defender=initial.players['player-two'],kiwi=defender.battleArea.find(c=>c.card.id==='ST8-011')
  if(!kiwi)throw Error('Original Kiwi required')
  const originalTarget=defender.battleArea.find(c=>c.card.instanceId===initial.pendingBattle?.targetInstanceId)
  expect(originalTarget?.hpCards).toHaveLength(2)
  expect(initial.pendingBattle?.declaredDamage).toBe(2)
  const result=takeAiStep(initial,'player-two',{level,seed:1})
  expect(result.error).toBeUndefined();expect(initial).toEqual(before)
  const command=result.state.commandLog?.at(-1)?.payload
  expect(command).toMatchObject({kind:'play-blocker',playerId:'player-two',sourceInstanceId:kiwi.card.instanceId,paymentIds:[expect.any(String)]})
  expect(result.state.pendingBattle?.targetInstanceId).toBe(kiwi.card.instanceId)
  expect(result.state.players['player-two'].supportArea.filter(s=>s.rested)).toHaveLength(1)
  const settled=applyGameCommand(result.state,{kind:'resolve-battle',playerId:'player-one'})
  expect(settled.players['player-two'].battleArea.find(c=>c.card.instanceId===kiwi.card.instanceId)?.hpCards).toHaveLength(1)
  expect(settled.players['player-two'].battleArea.find(c=>c.card.instanceId===originalTarget?.card.instanceId)?.hpCards).toHaveLength(2)
  let replay=createSt8011AiPreviewState('positive',true)
  for(const entry of settled.commandLog??[])replay=applyGameCommand(replay,commandFromLogEntry(entry))
  expect(replay).toEqual(settled)
 })
 it.each([3,4,5] as const)('Lv%s cannot pay G using only red supports',level=>{
  const initial=createSt8011AiPreviewState('negative'),before=structuredClone(initial)
  expect(createDeckAdditionDemoState('ST8-011','ai-negative')).toEqual(initial)
  const result=takeAiStep(initial,'player-two',{level,seed:1})
  expect(result.error).toBeUndefined();expect(initial).toEqual(before)
  expect(result.state.commandLog?.at(-1)?.payload).toMatchObject({kind:'skip-trap',playerId:'player-two'})
  expect(result.state.players['player-two'].supportArea).toEqual(initial.players['player-two'].supportArea)
  expect(result.state.pendingBattle?.targetInstanceId).toBe(initial.pendingBattle?.targetInstanceId)
  let replay=createSt8011AiPreviewState('negative',true)
  for(const entry of result.state.commandLog??[])replay=applyGameCommand(replay,commandFromLogEntry(entry))
  expect(replay).toEqual(result.state)
 })
})
