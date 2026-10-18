/** @vitest-environment jsdom */
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {describe,it,expect,vi} from 'vitest'
import {fixture,command} from '../game/st7-018-demo'
import {applyGameCommand} from '../game/commands'
import {maskGameStateForViewer} from '../game/masked-state'
import {useMatchController} from './useMatchController'
import {useOnlineMatchController} from './useOnlineMatchController'
import {buildTrapEffectTargetSubmission} from '../components/battle/battleResponseSelectors'
;(globalThis as Record<string,unknown>).IS_REACT_ACT_ENVIRONMENT=true
describe('ST7-018 fixed all-own recipients in shared local/online trap selection',()=>{
 it.each(['local','online'])('%s preselects every recipient and prevents toggling or skipping',async mode=>{
  const game=fixture(),ids=game.players['player-one'].battleArea.map(c=>c.card.instanceId)
  let local:ReturnType<typeof useMatchController>|undefined,online:ReturnType<typeof useOnlineMatchController>|undefined
  function Local(){local=useMatchController({testStateConfig:null});return null}
  function Online(){online=useOnlineMatchController({game:maskGameStateForViewer(game,'player-one'),viewerPlayerId:'player-one',sendCommand:vi.fn()});return null}
  const container=document.createElement('div'),root=createRoot(container)
  try{
   await act(()=>root.render(mode==='local'?<Local/>:<Online/>))
   if(local)await act(()=>local!.setGame(game))
   const current=()=>mode==='local'?local!:online!
   await act(()=>current().setSelectedTrapId(game.players['player-one'].hand[0].instanceId))
   expect(current().trapEffectTargetSteps).toHaveLength(1)
   expect(current().trapEffectTargetSteps[0]).toMatchObject({fixed:true,ordered:false,min:2,max:2,allowEmpty:false,selectedTargetIds:ids})
   await act(()=>current().selectTrapEffectTarget(0,ids[0]))
   await act(()=>current().skipTrapEffectTarget(0))
   expect(current().trapEffectTargetSteps[0].selectedTargetIds).toEqual(ids)
   const targets=buildTrapEffectTargetSubmission(current().trapEffectTargetSteps,[[]])
   expect(targets).toEqual([ids])
   const payload={...command(game),effectTargets:targets}
   expect(applyGameCommand(game,payload).players['player-one'].battleArea.map(c=>c.hpCards.length)).toEqual([3,7])
  }finally{await act(()=>root.unmount())}
 })
})
