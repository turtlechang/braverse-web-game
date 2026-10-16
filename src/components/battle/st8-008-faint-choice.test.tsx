/// @vitest-environment jsdom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {describe,expect,it,vi} from 'vitest'
import candidates from '../../../data/candidates/st6-st10/official-st8.en.json'
import {createCard,getCardPoolEntry,type CardEffect,type GameState} from '../../game'
import type {OfficialCardRecord} from '../../cards/types'
import {createSt8007PreviewState} from '../../game/st8-007-demo'
import type {BattleUiMatchLike,BattleUiPendingEffectLike} from '../../hooks/battleUiContracts'
import {DamageEffectModals} from './DamageEffectModals'

;(globalThis as Record<string,unknown>).IS_REACT_ACT_ENVIRONMENT=true
type Choice=Extract<CardEffect,{kind:'choose-one'}>
const need=<T,>(value:T|undefined|null,label:string):T=>{
 if(value===undefined||value===null)throw Error(`Missing ${label}`)
 return value
}
const modes:Choice['modes']=[
 {label:'Runtime option A: draw one',effects:[{kind:'draw',amount:1}]},
 {label:'Runtime option B: draw two',effects:[{kind:'draw',amount:2}]},
]
const setup=(effect:CardEffect)=>{
 const game=createSt8007PreviewState('attack',true)
 const raw=need(getCardPoolEntry('ST8-008')??(candidates.cards as OfficialCardRecord[]).find(c=>c.cardNumber==='ST8-008'),'original ST8-008')
 const source=createCard(raw,'player-one',1)
 if(source.type!=='cookie')throw Error('Expected original Cookie')
 game.players['player-one'].deck.shift();game.players['player-one'].breakArea.push(source)
 // Prepared UI mechanism: real printed source, explicitly synthetic mode labels.
 game.pendingFaintEffects=[{sourcePlayerId:'player-one',sourceInstanceId:source.instanceId,
  effect,context:{sourcePlayerId:'player-one',sourceInstanceId:source.instanceId}}]
 const dispatch=vi.fn(),clear=vi.fn()
 const match={game,viewerPlayerId:'player-one',faintSourceCard:source,faintMin:0,faintMax:0,
  selectedFaintTargetIds:[],selectedFaintPaymentIds:[],selectedFaintCostHandIds:[],selectedFaintCostSupportIds:[],selectedFaintCostSupportToHandIds:[],
  faintCandidates:[],faintCardCandidates:[],faintEnergyCost:{},faintEnergyCostTotal:0,faintPaymentCandidates:[],faintPaymentValid:true,
  faintCostHandAmount:0,faintCostSupportAmount:0,faintCostSupportToHandAmount:0,
  faintCostHandCandidates:[],faintCostSupportCandidates:[],faintCostSupportToHandCandidates:[],
  setSelectedFaintTargetIds:clear,setSelectedFaintPaymentIds:clear,setSelectedFaintCostHandIds:clear,
  setSelectedFaintCostSupportIds:clear,setSelectedFaintCostSupportToHandIds:clear,dispatch,
 } as unknown as BattleUiMatchLike
 const pending={faintActive:true,afterDamageActive:false} as BattleUiPendingEffectLike
 return {game,match,pending,dispatch,clear}
}
const mount=async(state:ReturnType<typeof setup>)=>{
 const container=document.createElement('div'),root=createRoot(container)
 document.body.append(container)
 await act(()=>root.render(<DamageEffectModals match={state.match} pending={state.pending}/>))
 return {container,root,close:async()=>{await act(()=>root.unmount());container.remove()}}
}
const button=(container:HTMLElement,text:string)=>need([...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.includes(text)),text)
describe('faint choose-one UI (prepared mechanism, original ST8-008 source)',()=>{
 for(const index of [0,1])it(`renders runtime labels and sends explicit mode ${index} without confirming faint`,async()=>{
  const state=setup({kind:'choose-one',modes}),ui=await mount(state)
  try{
   expect(ui.container.textContent).toContain(modes[0].label)
   expect(ui.container.textContent).toContain(modes[1].label)
   expect(ui.container.querySelector('.modal-actions button')).toBeNull()
   expect(state.dispatch).not.toHaveBeenCalled()
   await act(()=>button(ui.container,modes[index].label).click())
   expect(state.dispatch).toHaveBeenCalledTimes(1)
   expect(state.dispatch).toHaveBeenCalledWith({kind:'resolve-choose-one',playerId:'player-one',modeIndex:index},expect.any(String))
   expect(state.clear).toHaveBeenCalledTimes(5)
   expect(state.clear.mock.calls.every(args=>Array.isArray(args[0])&&args[0].length===0)).toBe(true)
  }finally{await ui.close()}
 })
 it('uses authoritative mode playability; an empty hand cannot satisfy mandatory discard one',async()=>{
  const unavailable:Choice['modes']=[modes[0],{label:'Runtime unavailable mandatory discard one',effects:[{kind:'discard-hand',count:1}]}]
  const state=setup({kind:'choose-one',modes:unavailable}),ui=await mount(state)
  try{
   expect(state.game.players['player-one'].hand).toHaveLength(0)
   expect(button(ui.container,unavailable[0].label).disabled).toBe(false)
   expect(button(ui.container,unavailable[1].label).disabled).toBe(true)
   await act(()=>button(ui.container,unavailable[1].label).click())
   expect(state.dispatch).not.toHaveBeenCalled()
  }finally{await ui.close()}
 })
 it('after a server/core-expanded mode, the existing faint confirmation sends resolve-faint-effect',async()=>{
  const state=setup({kind:'choose-one',modes}),ui=await mount(state)
  try{
   await act(()=>button(ui.container,modes[1].label).click())
   // Prepared authoritative response, not a UI implementation of mode expansion.
   const expanded:GameState={...state.game,pendingFaintEffects:state.game.pendingFaintEffects?.map(entry=>({...entry,effect:modes[1].effects[0]}))}
   await act(()=>ui.root.render(<DamageEffectModals match={{...state.match,game:expanded}} pending={state.pending}/>))
   expect(ui.container.textContent).not.toContain(modes[1].label)
   const confirm=need(ui.container.querySelector<HTMLButtonElement>('.modal-actions button'),'normal faint confirm')
   expect(confirm.disabled).toBe(false)
   await act(()=>confirm.click())
   expect(state.dispatch.mock.calls.at(-1)?.[0]).toMatchObject({kind:'resolve-faint-effect',playerId:'player-one',targetIds:[]})
  }finally{await ui.close()}
 })
 it('ordinary faint effects retain their existing confirmation',async()=>{
  const state=setup({kind:'draw',amount:1}),ui=await mount(state)
  try{
   expect(ui.container.textContent).not.toContain('Runtime option')
   const confirm=need(ui.container.querySelector<HTMLButtonElement>('.modal-actions button'),'normal confirm')
   await act(()=>confirm.click())
   expect(state.dispatch.mock.calls[0]?.[0]).toMatchObject({kind:'resolve-faint-effect',playerId:'player-one',targetIds:[]})
  }finally{await ui.close()}
 })
})
