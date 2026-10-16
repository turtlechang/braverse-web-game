import {describe,expect,it} from 'vitest'
import {parseTestStateConfig} from './demo'
import {createDeckAdditionDemoState} from './bs12-deck-addition-demo'
import {applyGameCommand} from './commands'
import {createSt8007HpBlockedPreviewState} from './st8-007-hp-blocked-demo'
import {commandFromLogEntry} from './replay'

describe('real blocked HP FLIP Browser route',()=>{
 it.each(['hp-blocked','ai-hp-blocked'] as const)('routes %s through the real skill and ordinary damage parent',scenario=>{
  expect(parseTestStateConfig(`?test-state=deck-addition:ST8-007:${scenario}`,'localhost'))
   .toEqual({kind:'deck-addition',cardNumber:'ST8-007',scenario})
  const ai=scenario==='ai-hp-blocked',state=createDeckAdditionDemoState('ST8-007',scenario)
  let parent=createSt8007HpBlockedPreviewState(true,ai)
  for(const entry of state.commandLog??[])parent=applyGameCommand(parent,commandFromLogEntry(entry))
  expect(parent).toEqual(state)
  expect(state.preventHpGainThisTurn).toEqual({[ai?'player-two':'player-one']:true})
  expect(state.pendingBattle?.revealedHpCard?.id).toBe('ST8-007')
  expect(state.commandLog?.map(entry=>entry.commandKind)).toEqual([
   'begin-activate-skill','resolve-ability-effect','declare-attack','skip-trap','resolve-next-damage',
  ])
 })
})
