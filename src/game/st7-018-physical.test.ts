import {describe,it,expect} from 'vitest'
import {fixture,command} from './st7-018-demo'
import {zones} from './st7-014-demo'
import {applyGameCommand as apply} from './commands'
import {getTrapCandidates} from './battle'
import {takeAiStep} from './ai'
import {commandFromLogEntry} from './replay'
import type {GameState} from './types'
const inventory=(state:GameState)=>{for(const owner of ['player-one','player-two'] as const){const cards=zones(state,owner);expect(cards).toHaveLength(60);expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60);for(const c of cards)expect(cards.filter(x=>x.id===c.id).length).toBeLessThanOrEqual(4)}}
describe('ST7-018 original YY all-own HP gain through actual attack parent',()=>{
 it.each(['positive','one-cookie','rested','lethal'])('gains1 HP for every own Cookie including full/rested: %s',scenario=>{
  const state=fixture(scenario),before=structuredClone(state),own=state.players['player-one']
  inventory(state);expect(getTrapCandidates(state,'player-one').map(c=>c.id)).toContain('ST7-018')
  if(scenario==='rested')expect(own.battleArea[0].rested).toBe(true)
  const next=apply(state,command(state))
  expect(next.players['player-one'].battleArea.map(c=>c.hpCards.length)).toEqual(own.battleArea.map(c=>c.hpCards.length+1))
  expect(next.players['player-one'].battleArea.map(c=>c.rested)).toEqual(own.battleArea.map(c=>c.rested))
  expect(next.players['player-two'].battleArea).toEqual(state.players['player-two'].battleArea)
  expect(next.players['player-one'].supportArea.slice(2,4).every(c=>c.rested)).toBe(true)
  expect(next.players['player-one'].discardPile.some(c=>c.id==='ST7-018')).toBe(true)
  expect(next.players['player-one'].deck).toHaveLength(own.deck.length-own.battleArea.length)
  expect(next.cookiesGainedHpThisTurn?.['player-one']).toBe(true)
  expect(state).toEqual(before);inventory(next)
 })
 it.each(['positive','rested','prevented'])('replays every real parent command from preparation: %s',scenario=>{
  const state=fixture(scenario);let replay=fixture(scenario,true)
  for(const entry of state.commandLog??[])replay=apply(replay,commandFromLogEntry(entry))
  expect(replay).toEqual(state)
 })
 it('actual Truthless Recluse prevents HP gain but does not refund YY or the trap',()=>{
  const state=fixture('prevented'),before=structuredClone(state),next=apply(state,command(state))
  expect(state.commandLog?.[0]?.payload.kind).toBe('activate-skill')
  expect(next.players['player-one'].battleArea).toEqual(state.players['player-one'].battleArea)
  expect(next.players['player-one'].deck).toEqual(state.players['player-one'].deck)
  expect(next.players['player-one'].supportArea.slice(2,4).every(s=>s.rested)).toBe(true)
  expect(next.players['player-one'].discardPile.some(c=>c.id==='ST7-018')).toBe(true)
  expect(state).toEqual(before);inventory(next)
 })
 it.each(['rested-energy','wrong-energy','one-yellow','main','wrong-phase'])('rejects unavailable payment/timing without mutation: %s',scenario=>{
  const state=fixture(scenario),before=structuredClone(state)
  expect(getTrapCandidates(state,'player-one').map(c=>c.id)).not.toContain('ST7-018')
  expect(()=>apply(state,command(state))).toThrow();expect(state).toEqual(before)
 })
 it.each(['zero','partial','opponent','duplicate','unknown'])('cannot select a subset or illegal recipient: %s',scenario=>{
  const state=fixture(),before=structuredClone(state),own=state.players['player-one'].battleArea.map(c=>c.card.instanceId)
  const ids=scenario==='zero'?[]:scenario==='partial'?[own[0]]:scenario==='opponent'?[state.players['player-two'].battleArea[0].card.instanceId]:scenario==='duplicate'?[own[0],own[0]]:['unknown']
  expect(()=>apply(state,command(state,ids))).toThrow();expect(state).toEqual(before)
 })
 it.each(['short-deck','empty-deck'])('completes each own HP gain across actual mandatory Refresh: %s',scenario=>{
  const state=fixture(scenario),before=structuredClone(state),pending=apply(state,command(state))
  expect(pending.pendingRefresh?.playerId).toBe('player-one')
  expect(pending.players['player-one'].battleArea.map(c=>c.hpCards.length)).toEqual(scenario==='short-deck'?[3,6]:[2,6])
  const penalty=pending.players['player-one'].discardPile.find(c=>c.type==='cookie'&&c.level>=1)
  if(!penalty)throw Error('Actual Refresh Cookie')
  const next=apply(pending,{kind:'refresh-deck',playerId:'player-one',cookieInstanceId:penalty.instanceId,shuffleSeed:7018})
  expect(next.pendingRefresh).toBeNull();expect(next.players['player-one'].battleArea.map(c=>c.hpCards.length)).toEqual([3,7])
  expect(next.players['player-one'].breakArea.some(c=>c.instanceId===penalty.instanceId)).toBe(true)
  expect(state).toEqual(before);inventory(next)
 })
 it('stops queued second HP gain when actual Refresh reaches Break10',()=>{
  const state=fixture('fatal-refresh'),pending=apply(state,command(state))
  expect(pending.players['player-one'].breakArea.reduce((sum,c)=>sum+c.level,0)).toBe(9)
  const penalty=pending.players['player-one'].discardPile.find(c=>c.type==='cookie'&&c.level>=1)
  if(!penalty)throw Error('Actual Refresh Cookie')
  const next=apply(pending,{kind:'refresh-deck',playerId:'player-one',cookieInstanceId:penalty.instanceId,shuffleSeed:7018})
  expect(next.status).not.toBe('playing');expect(next.players['player-one'].battleArea.map(c=>c.hpCards.length)).toEqual([3,6]);inventory(next)
 })
 it.each([3,4,5].flatMap(level=>['positive','one-cookie','rested','lethal'].map(scenario=>({level:level as 3|4|5,scenario}))))('Lv$level submits every mandatory recipient: $scenario',({level,scenario})=>{
  const state=fixture(scenario),before=structuredClone(state),decision=takeAiStep(state,'player-one',{level,searchNow:()=>0})
  expect(decision.action).not.toBe('error')
  expect(decision.state.players['player-one'].battleArea.map(c=>c.hpCards.length)).toEqual(state.players['player-one'].battleArea.map(c=>c.hpCards.length+1))
  const payload=decision.state.commandLog?.at(-1)?.payload
  expect(payload?.kind).toBe('play-trap')
  if(payload?.kind!=='play-trap')throw Error('Actual trap command')
  expect(payload.effectTargets).toEqual([state.players['player-one'].battleArea.map(c=>c.card.instanceId)])
  expect(state).toEqual(before);inventory(decision.state)
 })
})
