import {describe,expect,it} from 'vitest'
import {fixture} from '../st7-010-demo'
import {createCard} from '../starter-deck'
import {getCardPoolEntry} from '../card-pool'
import {applyGameCommand as apply} from '../commands'
import {takeAiStep} from '../ai'
import type {AiLevel} from './types'
const pending=(safe=false,twoCards=false)=>{
 let state=fixture('attack-draw2');const own=state.players['player-one']
 const raw=getCardPoolEntry('ST7-003');if(!raw)throw Error('Original LV3 required')
 for(let copy=1;copy<=3;copy++){own.deck.shift();const card=createCard(raw,'player-one',copy);if(card.type!=='cookie')throw Error('Original Cookie required');own.breakArea.push(card)}
 if(safe)own.hand.push(...own.breakArea.splice(0,1))
 own.hand.push(...own.deck.splice(twoCards?2:1))
 state=apply(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:own.battleArea[0].card.instanceId,targetInstanceId:'player-two-ST6-006-1',supportPaymentIds:own.supportArea.map(s=>s.card.instanceId)})
 state=apply(state,{kind:'skip-trap',playerId:'player-two'})
 for(let i=0;i<12&&state.pendingBattle?.stage==='damage';i++)state=apply(state,{kind:'resolve-next-damage',playerId:'player-two'})
 return apply(state,{kind:'resolve-attack-effect',playerId:'player-one',targetIds:[]})
}
describe('AI avoids paying for a pure optional draw it must decline',()=>{
 it.each([3,4,5] as AiLevel[])('Lv%s preserves original FLIP Cookie when all visible Refresh costs lose',level=>{
  const state=pending(),before=structuredClone(state),decision=takeAiStep(state,'player-one',{level,searchNow:()=>0})
  expect(decision.state.commandLog?.at(-1)?.payload).toMatchObject({kind:'resolve-optional-cost-attack',action:'skip'})
  expect(decision.state.players['player-one'].hand).toEqual(state.players['player-one'].hand)
  expect(decision.state.pendingDrawUpTo??null).toBeNull();expect(state).toEqual(before)
 })
 it.each([3,4,5] as AiLevel[])('Lv%s still pays and draws when actual Refresh is safe',level=>{
  const state=pending(true),decision=takeAiStep(state,'player-one',{level,searchNow:()=>0})
  expect(decision.state.commandLog?.at(-1)?.payload).toMatchObject({kind:'resolve-optional-cost-attack',action:'pay'})
  const next=takeAiStep(decision.state,'player-one',{level,searchNow:()=>0})
  expect(next.state.commandLog?.at(-1)?.payload).toMatchObject({kind:'resolve-draw-up-to',drawCount:1})
  expect(next.state.pendingRefresh?.playerId).toBe('player-one')
 })
 it.each([3,4,5] as AiLevel[])('Lv%s pays when one safe card can be drawn while preserving the last',level=>{
  const state=pending(false,true),decision=takeAiStep(state,'player-one',{level,searchNow:()=>0})
  expect(decision.state.commandLog?.at(-1)?.payload).toMatchObject({kind:'resolve-optional-cost-attack',action:'pay'})
  const next=takeAiStep(decision.state,'player-one',{level,searchNow:()=>0})
  expect(next.state.commandLog?.at(-1)?.payload).toMatchObject({kind:'resolve-draw-up-to',drawCount:1})
  expect(next.state.pendingRefresh??null).toBeNull()
 })
 it('keeps the Lv2 baseline and its existing safe zero-draw choice',()=>{
  const state=pending(),decision=takeAiStep(state,'player-one',{level:2,searchNow:()=>0})
  expect(decision.state.commandLog?.at(-1)?.payload).toMatchObject({kind:'resolve-optional-cost-attack',action:'pay'})
 })
 it('does not change the decision after reordering unrevealed HP and opponent deck',()=>{
  const state=pending(),hidden=structuredClone(state)
  hidden.players['player-one'].battleArea.forEach(c=>c.hpCards.reverse());hidden.players['player-two'].deck.reverse()
  const before=structuredClone(hidden)
  expect(takeAiStep(hidden,'player-one',{level:5,searchNow:()=>0}).state.commandLog?.at(-1)?.payload).toEqual(takeAiStep(state,'player-one',{level:5,searchNow:()=>0}).state.commandLog?.at(-1)?.payload)
  expect(hidden).toEqual(before)
 })
})
