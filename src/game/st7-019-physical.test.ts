import {describe,expect,it} from 'vitest'
import {fixture,command} from './st7-019-demo'
import {zones} from './st7-014-demo'
import {applyGameCommand as apply} from './commands'
import {takeAiStep} from './ai'
import {commandFromLogEntry} from './replay'
import type {GameState} from './types'
const inventory=(state:GameState)=>{for(const owner of ['player-one','player-two'] as const){const cards=zones(state,owner);expect(cards).toHaveLength(60);expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60);const counts=new Map<string,number>();for(const c of cards)counts.set(c.id,(counts.get(c.id)??0)+1);expect([...counts.values()].every(n=>n<=4)).toBe(true)}}
describe('ST7-019 original physical payment and effect',()=>{
 it.each(['positive','winning','cost-loss','mutual-win','break7','break8','no-cookie','rested-energy','wrong-energy','main','wrong-phase','ai-mutual-win','ai-winning','ai-break8','ai-safe-alternative'])('original sixty-card identity and actual parent replay: %s',scenario=>{
  const state=fixture(scenario);inventory(state)
  let replayed=fixture(scenario,true);for(const entry of state.commandLog??[]){const c=commandFromLogEntry(entry);if(!c)throw Error('Replayable real command');replayed=apply(replayed,c)}
  expect(replayed).toEqual(state)
 })
 it.each(['ST7-004','ST7-007','BS12-076','ST1-011'])('pays any original Cookie color/level/FLIP from hand to own Break: %s',id=>{
  const state=fixture(),before=structuredClone(state),payload=command(state,[],id),own=state.players['player-one'],cost=own.hand.find(c=>c.id===id)!
  const next=apply(state,payload)
  expect(next.players['player-one'].breakArea.map(c=>c.instanceId)).toContain(cost.instanceId)
  expect(next.players['player-one'].hand.some(c=>c.instanceId===cost.instanceId)).toBe(false)
  expect(next.players['player-one'].discardPile.some(c=>c.instanceId===cost.instanceId)).toBe(false)
  expect(next.players['player-one'].supportArea[2].rested).toBe(true)
  expect(next.players['player-two'].battleArea).toEqual(state.players['player-two'].battleArea)
  expect(next.pendingBattle?.revealedHpCard).toBeNull();expect(state).toEqual(before);inventory(next)
 })
 it('hits one other opponent with one effect damage, while the original attacker remains unchanged',()=>{
  const state=fixture(),before=structuredClone(state),paid=apply(state,command(state)),next=apply(paid,{kind:'resolve-battle',playerId:'player-two'})
  expect(next.players['player-two'].battleArea.some(c=>c.card.id==='BS12-061')).toBe(false)
  expect(next.players['player-two'].breakArea.some(c=>c.id==='BS12-061')).toBe(true)
  expect(next.players['player-two'].battleArea.find(c=>c.card.id==='BS12-059')).toEqual(state.players['player-two'].battleArea[1])
  expect(state).toEqual(before);inventory(next)
 })
 it('can instead hit the original attacker without damaging the other opponent',()=>{
  const state=fixture(),paid=apply(state,command(state,[state.players['player-two'].battleArea[1].card.instanceId])),next=apply(paid,{kind:'resolve-battle',playerId:'player-two'})
  expect(next.players['player-two'].battleArea.map(c=>c.hpCards.length)).toEqual([1,3]);inventory(next)
 })
 it.each(['cost-loss','mutual-win'])('loses from own Break cost before any effect damage, even if damage would win: %s',scenario=>{
  const state=fixture(scenario),next=apply(state,command(state))
  expect(next.status).not.toBe('playing');expect(next.result?.winnerId).toBe('player-two')
  expect(next.players['player-one'].breakArea.reduce((s,c)=>s+c.level,0)).toBe(10)
  expect(next.players['player-two'].battleArea).toEqual(state.players['player-two'].battleArea);inventory(next)
 })
 it.each(['rested-energy','wrong-energy','main','wrong-phase'])('rejects invalid payment/timing without mutation: %s',scenario=>{
  const state=fixture(scenario),before=structuredClone(state);expect(()=>apply(state,command(state))).toThrow();expect(state).toEqual(before)
 })
 it.each(['missing','non-cookie','trap','opponent','duplicate','too-many'])('rejects illegal mandatory hand Cookie cost: %s',kind=>{
  const state=fixture(),before=structuredClone(state),payload=command(state);if(payload.kind!=='play-trap')throw Error('Trap')
  const own=state.players['player-one'];payload.handToBreakIds=kind==='missing'?[]:kind==='non-cookie'?[own.hand.find(c=>c.id==='ST6-016')!.instanceId]:kind==='trap'?[own.hand.find(c=>c.id==='ST7-019')!.instanceId]:kind==='opponent'?[state.players['player-two'].battleArea[0].card.instanceId]:kind==='duplicate'?[payload.handToBreakIds![0],payload.handToBreakIds![0]]:own.hand.filter(c=>c.type==='cookie').slice(0,2).map(c=>c.instanceId)
  expect(()=>apply(state,payload)).toThrow();expect(state).toEqual(before)
 })
 it.each(['own','duplicate','two','unknown'])('rejects illegal damage target: %s',kind=>{
  const state=fixture(),before=structuredClone(state),ids=state.players['player-two'].battleArea.map(c=>c.card.instanceId)
  const targets=kind==='own'?[state.players['player-one'].battleArea[0].card.instanceId]:kind==='duplicate'?[ids[0],ids[0]]:kind==='two'?ids:['unknown']
  expect(()=>apply(state,command(state,targets))).toThrow();expect(state).toEqual(before)
 })
 it.each([3,4,5] as const)('Lv%s preserves a safe battle rather than losing on payment, even with a visible winning damage target',level=>{
  const state=fixture('mutual-win'),before=structuredClone(state),next=takeAiStep(state,'player-one',{level,searchNow:()=>0})
  expect(next.action).not.toBe('error');expect(next.state.status).toBe('playing')
  expect(next.state.players['player-one'].hand.some(c=>c.id==='ST7-019')).toBe(true)
  expect(next.state.commandLog?.at(-1)?.payload?.kind).toBe('skip-trap');expect(state).toEqual(before)
 })
 it.each([3,4,5].flatMap(level=>['winning','break7','break8'].map(scenario=>({level:level as 3|4|5,scenario}))))('Lv$level still uses a safe payment for a winning damage opportunity: $scenario',({level,scenario})=>{
  const state=fixture(scenario),before=structuredClone(state),decision=takeAiStep(state,'player-one',{level,searchNow:()=>0})
  expect(decision.action).not.toBe('error');expect(decision.state.status).toBe('playing')
  const payload=decision.state.commandLog?.at(-1)?.payload;expect(payload?.kind).toBe('play-trap')
  if(payload?.kind!=='play-trap')throw Error('Original Trap command')
  expect(payload.trapInstanceId).toContain('ST7-019');expect(payload.handToBreakIds).toHaveLength(1)
  expect(decision.state.players['player-one'].breakArea.reduce((s,c)=>s+c.level,0)).toBeLessThan(10)
  expect(decision.state.pendingBattle?.damageTargetInstanceId).toBe(state.players['player-two'].battleArea[0].card.instanceId)
  expect(state).toEqual(before)
 })
 it.each([3,4,5] as const)('Lv%s can use another safe Trap instead of rejecting every Trap',level=>{
  const state=fixture('safe-alternative'),decision=takeAiStep(state,'player-one',{level,searchNow:()=>0})
  expect(decision.action).not.toBe('error');expect(decision.state.status).toBe('playing')
  const payload=decision.state.commandLog?.at(-1)?.payload;expect(payload?.kind).toBe('play-trap')
  if(payload?.kind!=='play-trap')throw Error('Actual safe alternative')
  expect(payload.trapInstanceId).toContain('ST2-020');expect(decision.state.players['player-one'].hand.some(c=>c.id==='ST7-019')).toBe(true)
 })
})
