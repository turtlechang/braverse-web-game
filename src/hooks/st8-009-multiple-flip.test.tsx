/// @vitest-environment jsdom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {expect,it,vi} from 'vitest'
import {useMatchController} from './useMatchController'
import {parseTestStateConfig} from '../game/demo'
import {createSt8009PreviewState} from '../game/st8-009-demo'
import {applyGameCommand} from '../game/commands'
import {commandFromLogEntry} from '../game/replay'

;(globalThis as Record<string,unknown>).IS_REACT_ACT_ENVIRONMENT=true
const required=<T,>(value:T|null|undefined):T=>{
 if(value===null||value===undefined)throw Error('Missing actual preview value')
 return value
}
it.each(['deck-addition:ST8-009:multiple-flip','card:ST8-009'])('%s preserves the second real HP FLIP after the first optional draw',async route=>{
 vi.useFakeTimers()
 let captured:ReturnType<typeof useMatchController>|undefined
 const config=required(parseTestStateConfig(`?test-state=${route}`,'localhost'))
 function Harness(){captured=useMatchController({testStateConfig:config});return null}
 const root=createRoot(document.createElement('div'))
 try{
  await act(()=>root.render(<Harness/>))
  const original=createSt8009PreviewState('multiple-flip')
  let state=applyGameCommand(original,{kind:'resolve-flip',playerId:'player-one',activate:true})
  state=applyGameCommand(state,{kind:'resolve-draw-up-to',playerId:'player-one',drawCount:1})
  await act(()=>required(captured).setGame(state))
  await act(async()=>{await vi.advanceTimersByTimeAsync(50)})
  const second=required(captured).game
  expect(second.pendingBattle?.stage).toBe('flip')
  expect(second.pendingBattle?.revealedHpCard?.instanceId).toBe('player-one-ST8-009-2')
  expect(second.commandLog?.filter(entry=>entry.commandKind==='resolve-flip')).toHaveLength(1)
  expect(second.commandLog?.filter(entry=>entry.commandKind==='resolve-draw-up-to')).toHaveLength(1)
  await act(async()=>{await vi.advanceTimersByTimeAsync(500)})
  expect(required(captured).game.pendingBattle?.revealedHpCard?.instanceId).toBe('player-one-ST8-009-2')
  // This hook harness has no animation renderer. Apply the real selection
  // commands directly so this regression isolates automatic damage progression.
  await act(()=>required(captured).setGame(current=>applyGameCommand(current,{kind:'resolve-flip',playerId:'player-one',activate:true})))
  await act(()=>required(captured).setGame(current=>applyGameCommand(current,{kind:'resolve-draw-up-to',playerId:'player-one',drawCount:1})))
  for(let step=0;step<6&&required(captured).game.pendingBattle?.stage==='damage';step++){
   await act(async()=>{await vi.advanceTimersByTimeAsync(20)})
  }
  const final=required(captured).game
  expect(final.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
  expect(final.players['player-one'].hand).toEqual([...original.players['player-one'].hand,...original.players['player-one'].deck.slice(0,2)])
  expect(final.commandLog?.filter(entry=>entry.commandKind==='resolve-flip')).toHaveLength(2)
  expect(final.commandLog?.some(entry=>entry.commandKind==='resolve-battle')).toBe(false)
  let replay=createSt8009PreviewState('multiple-flip',true)
  for(const entry of final.commandLog??[])replay=applyGameCommand(replay,commandFromLogEntry(entry))
  expect(JSON.parse(JSON.stringify(replay))).toEqual(JSON.parse(JSON.stringify(final)))
 }finally{await act(()=>root.unmount());vi.useRealTimers()}
})
