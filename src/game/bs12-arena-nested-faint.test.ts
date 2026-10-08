import { describe,expect,it } from 'vitest'
import { createBs12ChouxDemoState,createBs12EspressoDemoState } from './demo'
import { applyGameCommand } from './commands'
import { assertBs12PhysicalFixture,printedFixtureCard } from './bs12-physical-fixtures.test-helpers'

describe.each(['BS12-032','BS12-032@1','BS12-033','BS12-033@1'] as const)('%s real004 Arena FLIP faint continuation',number=>{
  it.each([{scenario:'arena-faint',hasSpareHp:false},{scenario:'arena-faint-nested',hasSpareHp:false},{scenario:'arena-faint-nested',hasSpareHp:true}] as const)('$scenario spareHP=$hasSpareHp settles original faint without removing survivors',({scenario,hasSpareHp})=>{
    let state=number==='BS12-032'||number==='BS12-032@1'?createBs12ChouxDemoState(scenario,number):createBs12EspressoDemoState(scenario,number)
    if(hasSpareHp) state={...state,players:{...state.players,'player-two':{...state.players['player-two'],battleArea:state.players['player-two'].battleArea.map((entry,index)=>index===0?{...entry,hpCards:[printedFixtureCard('BS12-009','original-defender-spare-hp'),...entry.hpCards]}:entry)}}}
    assertBs12PhysicalFixture(state)
    state=applyGameCommand(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:'bs12-032-source',targetInstanceId:'bs12-032-opponent',supportPaymentIds:['bs12-032-payment-0','bs12-032-payment-1']})
    state=applyGameCommand(state,{kind:'skip-trap',playerId:'player-two'})
    state=applyGameCommand(state,{kind:'resolve-next-damage',playerId:'player-two'})
    state=applyGameCommand(state,{kind:'resolve-flip',playerId:'player-two',activate:true,targetIds:['bs12-032-source']})
    for(let i=0;state.pendingBattle?.effectDamageSequence&&i<12;i++) state=state.pendingBattle.stage==='flip'
      ?applyGameCommand(state,{kind:'resolve-flip',playerId:'player-one',activate:false})
      :applyGameCommand(state,{kind:'resolve-next-damage',playerId:'player-one'})
    expect(state.players['player-one'].battleArea.map(entry=>entry.card.instanceId)).toEqual(['bs12-032-mover'])
    expect(state.players['player-two'].battleArea.map(entry=>entry.card.instanceId)).toEqual(hasSpareHp?['bs12-032-opponent','bs12-032-opponent-other']:['bs12-032-opponent-other'])
    if(hasSpareHp) expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
    expect(state.players['player-two'].breakArea.map(card=>card.instanceId)).toEqual(hasSpareHp?[]:['bs12-032-opponent'])
    expect(state.cookiesFaintedThisTurn?.['player-one']).toBe(1)
    expect(state.cookiesFaintedThisTurn?.['player-two']??0).toBe(hasSpareHp?0:1)
    expect(state.pendingAfterDamageEffects).toHaveLength(1)
    expect(state.pendingBattle).toBeNull()
    assertBs12PhysicalFixture(state)
  })
})
