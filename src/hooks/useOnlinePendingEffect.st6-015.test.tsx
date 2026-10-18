/// @vitest-environment jsdom
import {createRoot} from 'react-dom/client'
import {act} from 'react'
import {describe,expect,it,vi} from 'vitest'
import {useOnlinePendingEffect} from './useOnlinePendingEffect'
import type {DispatchGameCommand} from './useBattleActions'
import {applyGameCommand} from '../game/commands'
import {createSt6015PreviewState as fixture} from '../game/st6-015-demo'
;(globalThis as Record<string,unknown>).IS_REACT_ACT_ENVIRONMENT=true

describe('online ST6-015 pays HP before authoritative public recipient selection',()=>{
 it.each(['last-hp','cancel'] as const)('%s',async scenario=>{
  let game=fixture('low')
  const before=structuredClone(game)
  const own=game.players['player-one'],item=own.hand[0],last=own.battleArea[1]
  const dispatch=vi.fn<DispatchGameCommand>()
  let current:ReturnType<typeof useOnlinePendingEffect>|undefined
  function Harness(){current=useOnlinePendingEffect({game,viewerPlayerId:'player-one',dispatch,hasFaint:false,hasAfterDamage:false});return null}
  const root=createRoot(document.createElement('div'))
  try{
   await act(()=>root.render(<Harness/>))
   await act(()=>current!.beginPlayItem(item))
   expect(current!.draftRequiresPaymentBeforeTargets).toBe(true)
   for(const support of own.supportArea.slice(0,2))await act(()=>current!.toggleDraftPayment(support.card.instanceId))
   await act(()=>current!.toggleDraftHpToTrash(last.card.instanceId))
   expect(dispatch).not.toHaveBeenCalled();expect(game).toEqual(before)
   if(scenario==='cancel'){
    await act(()=>current!.cancelAbilityCostDraft())
    expect(current!.isEffectPending).toBe(false);expect(dispatch).not.toHaveBeenCalled();expect(game).toEqual(before)
   }else{
    await act(()=>current!.confirmEffect())
    expect(dispatch).toHaveBeenCalledOnce()
    const command=dispatch.mock.calls[0][0]
    if(Array.isArray(command)||command.kind!=='begin-play-item')throw new Error('Expected actual item declaration')
    expect(command.hpToTrashTargetIds).toEqual([last.card.instanceId])
    expect(command.targetIds).toBeUndefined()
    game=applyGameCommand(game,command)
    await act(()=>root.render(<Harness/>))
    expect(current!.candidateCards.map(c=>c.instanceId)).toEqual([own.battleArea[0].card.instanceId])
    await act(()=>current!.toggleTarget(last.card.instanceId))
    expect(current!.selectedTargetIds).toEqual([])
    expect(before.players['player-one'].battleArea[1].hpCards).toHaveLength(1)
   }
  }finally{await act(()=>root.unmount())}
 })
})
