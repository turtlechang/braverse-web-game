/// @vitest-environment jsdom
import {createRoot} from 'react-dom/client'
import {act} from 'react'
import {describe,expect,it} from 'vitest'
import {usePendingEffect} from './usePendingEffect'
import {createSt6015PreviewState as fixture} from '../game/st6-015-demo'
;(globalThis as Record<string,unknown>).IS_REACT_ACT_ENVIRONMENT=true

describe('printed ST6-015 public target projection after uncommitted HP cost',()=>{
 it.each(['last-hp','change-cost','cancel','zero-survivors'] as const)('%s',async scenario=>{
  const state=fixture(scenario==='zero-survivors'?'no-battle':'low'),before=structuredClone(state)
  const own=state.players['player-one'],item=own.hand[0]
  if(!item.item)throw new Error('Missing printed item')
  let captured:ReturnType<typeof usePendingEffect>|undefined
  function Harness(){
   captured=usePendingEffect({game:state,setGame:()=>{},dispatch:()=>{},viewerPlayerId:'player-one',
    setMessage:()=>{},clearAttacker:()=>{},setInspectedHpPile:()=>{},
    hasFaint:false,faintTargetIds:new Set(),selectedFaintTargetIds:[],faintMinMax:{min:0,max:0},setSelectedFaintTargetIds:()=>{},
    hasAfterDamage:false,afterDamageTargetIds:new Set(),selectedAfterDamageTargetIds:[],afterDamageMinMax:{min:0,max:0},setSelectedAfterDamageTargetIds:()=>{},
   })
   return null
  }
  const root=createRoot(document.createElement('div'))
  try{
   await act(()=>root.render(<Harness/>))
   await act(()=>captured!.beginCardAbility(item,item.item!,'item','ST6-015'))
   for(const support of own.supportArea.slice(0,2))await act(()=>captured!.toggleSkillPayment(support.card.instanceId))
   const cost=own.battleArea.at(-1)!
   expect(cost.hpCards).toHaveLength(1)
   await act(()=>captured!.toggleSkillHpToTrash(cost.card.instanceId))
   expect(captured!.effectTargetCandidates.map(c=>c.card.instanceId)).toEqual(own.battleArea.slice(0,-1).map(c=>c.card.instanceId))
   expect(state).toEqual(before)
   if(scenario==='change-cost'){
    await act(()=>captured!.toggleSkillHpToTrash(cost.card.instanceId))
    await act(()=>captured!.toggleSkillHpToTrash(own.battleArea[0].card.instanceId))
    expect(captured!.effectTargetCandidates.map(c=>c.card.instanceId)).toEqual(own.battleArea.map(c=>c.card.instanceId))
   }
   if(scenario==='cancel'){
    await act(()=>captured!.cancelPendingSkill())
    expect(captured!.pendingEffect).toBeNull()
   }
   expect(state).toEqual(before)
  }finally{await act(()=>root.unmount())}
 })
})
