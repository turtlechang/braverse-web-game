import {describe,it,expect,vi} from 'vitest'
import {seedOfflineShuffleCommand} from './offline-shuffle-command'
import {createSt7012PreviewState} from '../game/st7-012-demo'
import {applyGameCommand,type RefreshDeckCommand} from '../game/commands'
import {buildBattleReplayExport,replayBattleExport} from '../game/battle-replay'

describe('offline Refresh records entropy before dispatch',()=>{
 const refresh=():RefreshDeckCommand=>({kind:'refresh-deck',playerId:'player-one',cookieInstanceId:'original-cookie'})
 it('captures one uint32 without mutating the input',()=>{
  const command=refresh(),before=structuredClone(command),nextSeed=vi.fn(()=>70112026)
  expect(seedOfflineShuffleCommand(command,nextSeed)).toEqual({...before,shuffleSeed:70112026})
  expect(nextSeed).toHaveBeenCalledTimes(1);expect(command).toEqual(before)
 })
 it.each([0,1234,0xffffffff])('preserves provided seed %i without reading entropy',shuffleSeed=>{
  const command={...refresh(),shuffleSeed},nextSeed=vi.fn(()=>42)
  expect(seedOfflineShuffleCommand(command,nextSeed)).toBe(command);expect(nextSeed).not.toHaveBeenCalled()
 })
 it('preserves ordinary commands without reading entropy',()=>{
  const command={kind:'skip-trap' as const,playerId:'player-one' as const},nextSeed=vi.fn(()=>42)
  expect(seedOfflineShuffleCommand(command,nextSeed)).toBe(command);expect(nextSeed).not.toHaveBeenCalled()
 })
 it.each([-1,0x100000000,1.5,NaN])('rejects invalid generated seed %s',seed=>{
  expect(()=>seedOfflineShuffleCommand(refresh(),()=>seed)).toThrow('uint32')
 })
 it('replays an original-card draw-phase Refresh with identical final state and deck order',()=>{
  const initialState=createSt7012PreviewState('attack-yellow',true),own=initialState.players['player-one']
  own.discardPile.push(...own.deck.splice(0))
  initialState.phase='active'
  let state=applyGameCommand(initialState,{kind:'advance-phase',playerId:'player-one'})
  expect(state.pendingRefresh?.playerId).toBe('player-one')
  const cookie=state.players['player-one'].discardPile.find(card=>card.type==='cookie'&&card.level===1)
  if(!cookie)throw Error('Original LV1 Refresh cost required')
  state=applyGameCommand(state,seedOfflineShuffleCommand({...refresh(),cookieInstanceId:cookie.instanceId},()=>70112026))
  const replay=buildBattleReplayExport({state,initialState,mode:'offline',viewerId:'player-one',source:'test-state',decks:{playerOne:'ST7-012 original-card prepared fixture',playerTwo:'Original-card opponent fixture'}})
  expect(replay.replay.exact).toBe(true)
  expect(replay.commands.at(-1)).toMatchObject({kind:'refresh-deck',shuffleSeed:70112026})
  expect(replayBattleExport(replay)).toEqual(replay.finalState)
 })
})
