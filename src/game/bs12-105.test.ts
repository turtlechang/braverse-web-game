import {expect,it} from 'vitest'
import {BS12_PERFECT_STAGE_SCENARIOS,createBs12PerfectStageDemoState,parseTestStateConfig,type Bs12PerfectStageScenario} from './demo'
import {applyGameCommand} from './commands'
import {getTrapCandidates,getTrapCostOptions,getTrapTargetCandidates} from './battle'
import {getAttackDamageAgainst,getEffectTargetCandidatesForEffect,isEffectConditionMet} from './effects'
import {advancePhase} from './turn'
import {describeCommand,describeCommandSteps} from './command-log'
import {takeAiStep} from './ai'
import type {GameState} from './types'

const actor='player-one' as const,enemy='player-two' as const
const command=(targets=['bs12-105-attacker'],payments=['bs12-105-payment-0'])=>({kind:'play-trap' as const,playerId:actor,trapInstanceId:'bs12-105-trap',targetIds:[],paymentIds:payments,effectTargets:[targets]})
const play=(before=createBs12PerfectStageDemoState(),targets?:string[],payments?:string[])=>applyGameCommand(before,command(targets,payments))
const finish=(before:GameState)=>{
  let state=before
  for(let i=0;state.pendingBattle&&i<24;i++) state=applyGameCommand(state,state.pendingBattle.stage==='attack-effect'
    ?{kind:'resolve-attack-effect',playerId:enemy,targetIds:[]}:{kind:'resolve-next-damage',playerId:state.pendingBattle.damagePlayerId??actor})
  return state
}

it.each(['positive','two-black','single-black','rested-witness','rested-defender','spare-energy'] satisfies Bs12PerfectStageScenario[])('105 %s pays fixed K1 and actually reduces incoming four to two',scenario=>{
  const before=createBs12PerfectStageDemoState(scenario),snapshot=structuredClone(before)
  expect(getTrapCandidates(before,actor).map(card=>card.instanceId)).toEqual(['bs12-105-trap'])
  expect(getTrapCostOptions(before.players[actor].hand[0].trap!,before,actor)).toEqual([{energy:{black:1},discardHand:0}])
  const after=play(before)
  expect(after.players[actor].hand).toEqual([])
  expect(after.players[actor].discardPile.at(-1)?.instanceId).toBe('bs12-105-trap')
  expect(after.players[actor].supportArea.map(card=>card.rested)).toEqual(before.players[actor].supportArea.map((_,i)=>i===0))
  expect(after.players[actor].battleArea).toEqual(before.players[actor].battleArea)
  expect(after.players[enemy]).toEqual(before.players[enemy])
  expect(after.attackModifiers).toMatchObject([{sourceInstanceId:'bs12-105-trap',targetInstanceId:'bs12-105-attacker',amount:-2,expiresAfterTurn:2}])
  expect(after.pendingBattle?.remainingDamage).toBe(2)
  expect(getAttackDamageAgainst(after,'bs12-105-attacker','bs12-105-defender')).toBe(2)
  expect(finish(after).players[actor].battleArea.find(c=>c.card.instanceId==='bs12-105-defender')?.hpCards).toHaveLength(2)
  expect(before).toEqual(snapshot)
  expect(applyGameCommand(before,JSON.parse(JSON.stringify(command())))).toEqual(after)
})

it.each(['yellow-arena','black-non-arena','split','hand-only','support-only','trash-only','break-only','opponent-only'] satisfies Bs12PerfectStageScenario[])('105 %s never substitutes color/keyword, region or opponent for one own black Arena battle Cookie',scenario=>{
  const before=createBs12PerfectStageDemoState(scenario),source=before.players[actor].hand[0],effect=source.trap!.effects[0]
  expect(getTrapCandidates(before,actor).map(card=>card.instanceId)).toEqual(['bs12-105-trap'])
  expect(isEffectConditionMet(before,{sourcePlayerId:actor,sourceInstanceId:source.instanceId},effect)).toBe(false)
  expect(getTrapTargetCandidates(before,actor,source.instanceId)).toEqual([])
  const after=play(before,[])
  expect(after.attackModifiers).toEqual([])
  expect(after.pendingBattle?.remainingDamage).toBe(4)
  expect(after.players[actor].supportArea[0].rested).toBe(true)
  expect(after.players[actor].discardPile.at(-1)?.instanceId).toBe('bs12-105-trap')
  expect(describeCommandSteps(before,after,command([]))?.map(step=>step.text).join('\n')).toContain('條件不成立，未套用攻擊傷害修改')
})

it.each(['positive','other-black','other-yellow','other-green','other-purple','other-red'] satisfies Bs12PerfectStageScenario[])('105 %s can select another rested opponent Cookie, including genuine non-Arena and every color',scenario=>{
  const before=createBs12PerfectStageDemoState(scenario),effect=before.players[actor].hand[0].trap!.effects[0]
  expect(getEffectTargetCandidatesForEffect(before,{sourcePlayerId:actor,sourceInstanceId:'bs12-105-trap'},effect).map(c=>c.card.instanceId)).toEqual(['bs12-105-attacker','bs12-105-other'])
  const after=play(before,['bs12-105-other'])
  expect(after.attackModifiers.map(m=>m.targetInstanceId)).toEqual(['bs12-105-other'])
  expect(after.pendingBattle?.remainingDamage).toBe(4)
  const other=before.players[enemy].battleArea[1]
  expect(other.card.energyColor).toBe(({positive:'blue','other-black':'black','other-yellow':'yellow','other-green':'green','other-purple':'purple','other-red':'red'} as Record<string,string>)[scenario])
  expect(getAttackDamageAgainst(after,other.card.instanceId,'bs12-105-defender')).toBe(Math.max(0,other.card.attack-2))
  expect(after.players[enemy].battleArea).toEqual(before.players[enemy].battleArea)
})

it('105 optional zero still spends K1 and source without reducing four damage',()=>{
  const before=createBs12PerfectStageDemoState(),after=play(before,[])
  expect(after.attackModifiers).toEqual([])
  expect(after.pendingBattle?.remainingDamage).toBe(4)
  expect(after.players[actor].discardPile.at(-1)?.id).toBe('BS12-105')
  expect(after.players[actor].supportArea[0].rested).toBe(true)
  expect(JSON.stringify(describeCommandSteps(before,after,command([])))).toContain('選擇 0 個目標，此段可選效果未執行')
})

it.each(['wrong-energy','rested-energy','no-energy','disabled','used','main','after-battle'] satisfies Bs12PerfectStageScenario[])('105 %s cannot declare or spend an illegal Trap',scenario=>{
  const before=createBs12PerfectStageDemoState(scenario),snapshot=structuredClone(before)
  expect(getTrapCandidates(before,actor)).toEqual([])
  expect(()=>play(before)).toThrow()
  expect(before).toEqual(snapshot)
})
it.each([{ids:[]},{ids:['bs12-105-payment-0','bs12-105-payment-1']},{ids:['bs12-105-payment-0','bs12-105-payment-0']},{ids:['bs12-105-attack-payment-0']},{ids:['bs12-105-witness']}])('105 rejects invalid payment $ids',({ids})=>{
  const before=createBs12PerfectStageDemoState(),snapshot=structuredClone(before)
  expect(()=>play(before,undefined,ids)).toThrow()
  expect(before).toEqual(snapshot)
})
it.each([{ids:['bs12-105-attacker','bs12-105-other']},{ids:['bs12-105-attacker','bs12-105-attacker']},{ids:['bs12-105-defender']},{ids:['bs12-105-payment-0']}])('105 rejects invalid target $ids',({ids})=>{
  const before=createBs12PerfectStageDemoState(),snapshot=structuredClone(before)
  expect(()=>play(before,ids)).toThrow()
  expect(before).toEqual(snapshot)
})
it('105 one opponent has exactly one legal candidate and attacker owner cannot use the defender Trap',()=>{
  const before=createBs12PerfectStageDemoState('one-opponent'),effect=before.players[actor].hand[0].trap!.effects[0]
  expect(getEffectTargetCandidatesForEffect(before,{sourcePlayerId:actor,sourceInstanceId:'bs12-105-trap'},effect)).toHaveLength(1)
  expect(()=>applyGameCommand(before,{...command(),playerId:enemy})).toThrow()
})
it('105 public trace retains actual K1, source, chosen Cookie and minus two without leaking hidden HP or deck',()=>{
  const before=createBs12PerfectStageDemoState(),after=play(before),text=describeCommandSteps(before,after,command())?.map(step=>typeof step==='string'?step:step.text).join('\n')??''
  expect(describeCommand(before,after,command())).toContain('Perfect Stage')
  expect(text).toContain('支付能量')
  expect(text).toContain('Subtle Jasmine Cake Hound')
  expect(text).toContain('Muscle Cookie')
  expect(text).toMatch(/-2|−2/)
  expect(text).not.toContain('bs12-105-own-deck-0')
  expect(text).not.toContain('bs12-105-defender-hp-0')
})
it('105 actual modifier expires at this turn end and next attack restores four',()=>{
  const done=finish(play()),next=advancePhase(advancePhase(done))
  expect(next.turnNumber).toBe(3)
  expect(next.attackModifiers).toEqual([])
  expect(getAttackDamageAgainst(next,'bs12-105-attacker','bs12-105-defender')).toBe(4)
})
it('105 incoming reduced two can still faint an HP2 Cookie and preserve the other black Arena Cookie',()=>{
  const done=finish(play(createBs12PerfectStageDemoState('faint')))
  expect(done.players[actor].battleArea.map(c=>c.card.instanceId)).toEqual(['bs12-105-witness'])
  expect(done.players[actor].breakArea.map(c=>c.instanceId)).toEqual(['bs12-105-defender'])
  expect(done.players[actor].discardPile).toHaveLength(3)
})
it('105 deterministic AI consumes normal Trap commands without mutating its input',()=>{
  const before=createBs12PerfectStageDemoState(),snapshot=structuredClone(before),selected=takeAiStep(before,actor)
  expect(selected.state.commandLog?.some(entry=>entry.commandKind==='play-trap')).toBe(true)
  expect(selected.state.players[actor].discardPile.some(card=>card.id==='BS12-105')).toBe(true)
  expect(before).toEqual(snapshot)
})
const untilChoice=(before:GameState)=>{
  let state=before
  for(let i=0;state.pendingBattle && state.pendingBattle.stage!=='flip' && !state.pendingRefresh && !state.pendingReplacement && i<24;i++)
    state=applyGameCommand(state,{kind:'resolve-next-damage',playerId:actor})
  return state
}
it.each([false,true])('105 damage FLIP activate=%s resumes the reduced attack with its actual cost and HP',activate=>{
  const waiting=untilChoice(play(createBs12PerfectStageDemoState('flip')))
  expect(waiting.pendingBattle?.stage).toBe('flip')
  expect(waiting.players[actor].battleArea[0].hpCards).toHaveLength(3)
  const resolved=applyGameCommand(waiting,{kind:'resolve-flip',playerId:actor,activate,
    ...(activate?{discardHandIds:['bs12-105-flip-cost'],targetIds:['bs12-105-witness']}: {})})
  const done=finish(resolved)
  expect(done.players[actor].battleArea[0].hpCards).toHaveLength(2)
  expect(done.players[actor].battleArea[1].hpCards).toHaveLength(activate?3:2)
  expect(done.players[actor].hand).toHaveLength(activate?0:1)
  expect(done.players[actor].deck).toHaveLength(activate?11:12)
  expect(done.players[actor].discardPile).toHaveLength(activate?4:3)
})
it.each([false,true])('105 faint replacement choose=%s uses a genuine LV1 hand Cookie after Break LV1',choose=>{
  const waiting=untilChoice(play(createBs12PerfectStageDemoState('replacement')))
  expect(waiting.pendingReplacement).not.toBeNull()
  expect(waiting.players[actor].hand[0]).toMatchObject({id:'BS12-097',level:1,hp:2})
  expect(waiting.players[actor].breakArea.reduce((n,c)=>n+c.level,0)).toBe(1)
  const replaced=applyGameCommand(waiting,choose?{kind:'replace-cookie',playerId:actor,instanceId:'bs12-105-replacement'}:{kind:'skip-replacement',playerId:actor})
  const done=finish(replaced)
  expect(done.players[actor].battleArea.map(c=>c.card.instanceId)).toEqual(choose?['bs12-105-witness','bs12-105-replacement']:['bs12-105-witness'])
  expect(done.players[actor].battleArea.every(c=>c.hpCards.length===2)).toBe(true)
  expect(done.players[actor].deck).toHaveLength(choose?10:12)
  expect(done.players[actor].hand).toHaveLength(choose?0:1)
})
it('105 HP refill exhausting the deck suspends damage for real Refresh and then resumes the remaining one',()=>{
  const waiting=untilChoice(play(createBs12PerfectStageDemoState('refresh')))
  expect(waiting.players[actor].battleArea[0].hpCards).toHaveLength(1)
  const healed=applyGameCommand(waiting,{kind:'resolve-flip',playerId:actor,activate:true,discardHandIds:['bs12-105-flip-cost'],targetIds:['bs12-105-defender']})
  expect(healed.pendingRefresh?.playerId).toBe(actor)
  expect(healed.players[actor].deck).toHaveLength(0)
  expect(healed.players[actor].battleArea[0].hpCards).toHaveLength(2)
  const renewed=applyGameCommand(healed,{kind:'refresh-deck',playerId:actor,cookieInstanceId:'bs12-105-refresh-cookie',shuffleSeed:3})
  const done=finish(renewed)
  expect(done.pendingRefresh).toBeNull()
  expect(done.players[actor].breakArea.map(c=>c.id)).toEqual(['BS12-003'])
  expect(done.players[actor].deck).toHaveLength(9)
  expect(done.players[actor].battleArea[0].hpCards.map(c=>c.instanceId)).toEqual(['bs12-105-defender-hp-0'])
  expect(done.players[actor].discardPile[0].instanceId).toBe('bs12-105-last-hp')
  expect(done.players[actor].discardPile).toHaveLength(1)
})
it.each(BS12_PERFECT_STAGE_SCENARIOS)('105 finite fixture %s uses genuine prints, correct HP and legal deck capacities',scenario=>{
  expect(parseTestStateConfig(`?test-state=bs12-105:${scenario}`,'localhost')).toEqual({kind:'bs12-105',scenario})
  expect(parseTestStateConfig(`?test-state=bs12-105:${scenario}`,'example.com')).toBeNull()
  const state=createBs12PerfectStageDemoState(scenario)
  for(const player of Object.values(state.players)){
    expect(player.battleArea.length).toBeLessThanOrEqual(2)
    expect(player.breakArea.reduce((sum,c)=>sum+c.level,0)).toBeLessThan(10)
    for(const cookie of player.battleArea) {
      const damaged = scenario === 'disabled' && cookie.card.id === 'BS6-008'
      expect(cookie.hpCards).toHaveLength(damaged ? 2 : cookie.card.hp)
      if(damaged) {
        expect(cookie.card).toMatchObject({id:'BS6-008',hp:6,attack:3,attackEnergyCost:{red:3}})
        expect(state.commandLog?.filter(c=>c.commandKind==='resolve-next-damage')).toHaveLength(4)
        expect(state.commandLog?.filter(c=>c.commandKind==='declare-attack')).toHaveLength(2)
        expect(state.pendingBattle).toMatchObject({trapsDisabled:true,remainingDamage:3})
      }
    }
    const cards=[...player.hand,...player.deck,...player.discardPile,...player.breakArea,...player.supportArea.map(s=>s.card),...player.battleArea.flatMap(c=>[c.card,...c.hpCards])]
    expect(new Set(cards.map(c=>c.instanceId)).size).toBe(cards.length)
    for(const id of new Set(cards.map(c=>c.id))) expect(cards.filter(c=>c.id===id).length).toBeLessThanOrEqual(4)
  }
})
