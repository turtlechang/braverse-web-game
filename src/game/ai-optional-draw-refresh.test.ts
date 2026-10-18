import {describe,it,expect} from 'vitest'
import {createOptionalDrawRefreshFixture as fixture} from './ai-optional-draw-refresh-test-fixture'
import {selectSafeOptionalDrawCount} from './ai/optional-draw-refresh-safety'
import {takeAiStep} from './ai'
import {applyGameCommand} from './commands'
import {createPlayerView} from './player-view'
import {getRefreshCandidates,refreshDeck} from './refresh'
const levels=[3,4,5] as const
const options=(level:typeof levels[number])=>({level,seed:2026101193,searchNow:()=>0})
const activate=(breakLevel=9,deckCount=1)=>{
 const state=fixture(breakLevel,deckCount,true)
 const pending=applyGameCommand(state,{kind:'resolve-flip',playerId:'player-one',activate:true,discardHandIds:[]})
 if(!pending.pendingDrawUpTo)throw Error('Actual original Rose draw0-1 FLIP required')
 return pending
}
const finish=(initial:ReturnType<typeof activate>)=>{
 let state=initial
 for(let step=0;state.status==='playing'&&state.pendingBattle;step++){
  expect(step).toBeLessThan(10);state=applyGameCommand(state,{kind:'resolve-battle',playerId:'player-one'})
 }
 return state
}
describe('Public optional draw Refresh safety',()=>{
 it.each(levels)('Lv%s chooses zero and preserves an actual ordinary attack win',level=>{
  const state=activate(),before=structuredClone(state),decision=takeAiStep(state,'player-one',options(level))
  expect(state).toEqual(before);expect(decision.state.pendingRefresh).toBeNull();expect(decision.state.players['player-one'].deck).toHaveLength(1)
  expect(finish(decision.state).result).toMatchObject({winnerId:'player-one',reason:'break-level-limit'})
 })
 it.each(levels)('Lv%s retains safe Break8 draw1 and Refresh',level=>{
  let next=takeAiStep(activate(8,1),'player-one',options(level)).state
  expect(next.pendingRefresh?.playerId).toBe('player-one')
  const choice=getRefreshCandidates(next,'player-one').sort((a,b)=>a.level-b.level)[0]
  next=refreshDeck(next,'player-one',choice.instanceId,cards=>cards)
  expect(next.players['player-one'].breakArea.reduce((sum,c)=>sum+c.level,0)).toBe(9)
  expect(finish(next).result?.winnerId).toBe('player-one')
 })
 it.each(levels)('Lv%s draws the printed one card when deck2 cannot exhaust',level=>{
  const state=activate(9,2),next=takeAiStep(state,'player-one',options(level)).state
  expect(next.pendingRefresh).toBeNull();expect(next.players['player-one'].deck).toHaveLength(1);expect(next.players['player-one'].hand.length).toBe(state.players['player-one'].hand.length+1)
  expect(finish(next).result?.winnerId).toBe('player-one')
 })
 it('caps a larger optional maximum at deckCount minus one when Refresh is fatal',()=>{
  const state=activate(9,2),view=createPlayerView(state,'player-one')
  expect(selectSafeOptionalDrawCount(view,2,state.pendingBattle?.revealedHpCard??undefined)).toBe(1)
  expect(selectSafeOptionalDrawCount(view,5,state.pendingBattle?.revealedHpCard??undefined)).toBe(1)
  expect(selectSafeOptionalDrawCount(view,0)).toBe(0)
 })
 it('does not read hidden deck order or unrevealed HP faces',()=>{
  const state=activate(),changed=structuredClone(state),self=changed.players['player-one'],foe=changed.players['player-two']
  ;[self.deck[0],self.battleArea[0].hpCards[0]]=[self.battleArea[0].hpCards[0],self.deck[0]]
  ;[foe.deck[0],foe.battleArea[0].hpCards[0]]=[foe.battleArea[0].hpCards[0],foe.deck[0]]
  expect(createPlayerView(changed,'player-one')).toEqual(createPlayerView(state,'player-one'))
  expect(selectSafeOptionalDrawCount(createPlayerView(changed,'player-one'),1,changed.pendingBattle?.revealedHpCard??undefined)).toBe(0)
 })
 it('leaves Lv2 policy unchanged',()=>{
  expect(takeAiStep(activate(),'player-one',{level:2,seed:2026101193,searchNow:()=>0}).state.pendingRefresh?.playerId).toBe('player-one')
 })
})
