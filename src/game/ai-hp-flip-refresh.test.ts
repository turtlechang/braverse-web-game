import {describe,it,expect} from 'vitest'
import {createHpFlipRefreshFixture} from './ai-hp-flip-refresh-test-fixture'
import {shouldSkipHpFlipForFatalRefresh} from './ai/hp-flip-refresh-safety'
import {createSt7003PreviewState} from './st7-003-demo'
import {takeAiStep} from './ai'
import {applyGameCommand} from './commands'
import {createPlayerView} from './player-view'
import {refreshDeck,getRefreshCandidates} from './refresh'
const levels=[3,4,5] as const
const options=(level:typeof levels[number])=>({level,seed:2026101173,searchNow:()=>0})
describe('Public HP-FLIP Refresh defeat safety',()=>{
 it.each(levels)('Lv%s avoids a fatal optional HP refill while its bearer survives',level=>{
  const state=createHpFlipRefreshFixture(),before=structuredClone(state)
  const next=takeAiStep(state,'player-one',options(level)).state
  expect(state).toEqual(before);expect(next.pendingRefresh).toBeNull();expect(next.status).toBe('playing')
  expect(next.players['player-one'].battleArea[0].hpCards).toHaveLength(2);expect(next.players['player-one'].hand).toHaveLength(2)
 })
 it.each(levels)('Lv%s preserves an actual ordinary-attack win instead of refreshing into defeat',level=>{
  const state=createHpFlipRefreshFixture(9,1,true),before=structuredClone(state)
  let next=takeAiStep(state,'player-one',options(level)).state
  expect(next.pendingRefresh).toBeNull()
  for(let step=0;next.status==='playing'&&next.pendingBattle;step++){
   expect(step).toBeLessThan(10);next=applyGameCommand(next,{kind:'resolve-battle',playerId:'player-one'})
  }
  expect(state).toEqual(before);expect(next.result).toMatchObject({winnerId:'player-one',reason:'break-level-limit'})
 })
 it.each(levels)('Lv%s keeps the beneficial refill with enough deck cards',level=>{
  const next=takeAiStep(createHpFlipRefreshFixture(9,2),'player-one',options(level)).state
  expect(next.pendingRefresh).toBeNull();expect(next.players['player-one'].deck).toHaveLength(1);expect(next.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
 })
 it.each(levels)('Lv%s still accepts a safe Refresh below the Break threshold',level=>{
  let next=takeAiStep(createHpFlipRefreshFixture(8,1),'player-one',options(level)).state
  expect(next.pendingRefresh?.playerId).toBe('player-one')
  const choice=getRefreshCandidates(next,'player-one').sort((a,b)=>a.level-b.level)[0]
  next=refreshDeck(next,'player-one',choice.instanceId,cards=>cards)
  expect(next.status).toBe('playing');expect(next.players['player-one'].breakArea.reduce((sum,c)=>sum+c.level,0)).toBe(9)
 })
 it.each(levels)('Lv%s retains last-HP rescue with an ample deck',level=>{
  const next=takeAiStep(createSt7003PreviewState('low'),'player-one',options(level)).state
  expect(next.players['player-one'].battleArea[0].hpCards).toHaveLength(1);expect(next.players['player-one'].hand).toHaveLength(1)
 })
 it('does not depend on either hidden deck order or unrevealed HP faces',()=>{
  const state=createHpFlipRefreshFixture(),changed=structuredClone(state),self=changed.players['player-one'],foe=changed.players['player-two']
  ;[self.deck[0],self.battleArea[0].hpCards[0]]=[self.battleArea[0].hpCards[0],self.deck[0]]
  ;[foe.deck[0],foe.battleArea[0].hpCards[0]]=[foe.battleArea[0].hpCards[0],foe.deck[0]]
  expect(createPlayerView(changed,'player-one')).toEqual(createPlayerView(state,'player-one'))
  for(const candidate of [state,changed]){
   if(!candidate.pendingBattle)throw Error('Actual FLIP required')
   expect(shouldSkipHpFlipForFatalRefresh(createPlayerView(candidate,'player-one'),candidate.pendingBattle,[candidate.players['player-one'].hand[0].instanceId])).toBe(true)
  }
 })
 it('does not project HP refill when a public HP-gain prevention is active',()=>{
  const state=createHpFlipRefreshFixture();if(!state.pendingBattle)throw Error('Actual FLIP required')
  expect(shouldSkipHpFlipForFatalRefresh(createPlayerView(state,'player-one'),state.pendingBattle,[state.players['player-one'].hand[0].instanceId],true)).toBe(false)
 })
})
