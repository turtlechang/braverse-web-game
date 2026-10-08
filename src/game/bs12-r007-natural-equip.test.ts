import {describe,expect,it} from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import {createBs12AngelLightstickDemoState,createBs12SpotlightFanDemoState,createCardCheckDemoState,createCardNegativeDemoState,parseTestStateConfig,type Bs12RuledEquipScenario} from './demo'
import {applyGameCommand} from './commands'
import {canActivateCookieSkill} from './skills'
import {getEffectSelectionCandidates} from './effects'
import {getBlockerCandidates,isBlockDisabled} from './battle'
import {assertBs12PhysicalFixture} from './bs12-physical-fixtures.test-helpers'
import {convertOfficialCardToGameCard} from '../cards/official-card-adapter'
import {analyzeOfficialCardBehavior} from '../cards/contracts/ledger'
import type {OfficialCardRecord} from '../cards/types'
import type {GameState} from './types'
const owner='player-one' as const,foe='player-two' as const
const create=(n:'062'|'077',scenario:Bs12RuledEquipScenario='equip-positive')=>n==='062'?createBs12AngelLightstickDemoState(scenario):createBs12SpotlightFanDemoState(scenario)
const ids=(n:string)=>({source:`bs12-${n}-source`,host:`bs12-${n}-host`,support:`bs12-${n}-payment-0`,otherSupport:`bs12-${n}-payment-1`})
const open=(before:GameState,n:string)=>applyGameCommand(before,{kind:'begin-activate-skill',playerId:owner,sourceInstanceId:ids(n).source,trigger:'activate',paymentIds:[ids(n).support]})
const equip=(before:GameState,n:string)=>applyGameCommand(open(before,n),{kind:'resolve-ability-effect',playerId:owner,targetIds:[ids(n).host]})
const attack=(before:GameState,n:string)=>applyGameCommand(before,{kind:'declare-attack',playerId:owner,attackerInstanceId:ids(n).host,targetInstanceId:`bs12-${n}-opponent`,supportPaymentIds:[ids(n).otherSupport]})
const finish=(before:GameState)=>{
 let state=applyGameCommand(before,{kind:'skip-trap',playerId:foe})
 for(let i=0;state.pendingBattle&&i<20;i++){
  if(state.pendingBattle.stage==='damage')state=applyGameCommand(state,{kind:'resolve-next-damage',playerId:foe})
  else if(state.pendingBattle.stage==='attack-effect')state=applyGameCommand(state,{kind:'resolve-attack-effect',playerId:owner,targetIds:[]})
  else throw Error(`Unexpected battle ${state.pendingBattle.stage}`)
 }
 return state
}
describe.each(['062','077'] as const)('R007 BS12-%s actual printed Equip',n=>{
 it.each(['equip-positive','equip-rested-source','equip-rested-host'] as const)('pays once, trashes every original HP and keeps host HP: %s',scenario=>{
  const before=create(n,scenario),snapshot=structuredClone(before),i=ids(n)
  assertBs12PhysicalFixture(before)
  for(const p of Object.values(before.players))for(const c of p.battleArea)expect(c.hpCards.length,c.card.name).toBe(c.card.hp)
  expect(before.commandLog?.some(c=>c.commandKind==='deploy-cookie')).toBe(true)
  const source=before.players[owner].battleArea.find(c=>c.card.instanceId===i.source)!,host=before.players[owner].battleArea.find(c=>c.card.instanceId===i.host)!
  expect(source.hpCards).toHaveLength(3)
  expect(canActivateCookieSkill(before,owner,i.source,'activate')).toBe(true)
  const paid=open(before,n)
  expect(paid.players[owner].battleArea).toEqual(before.players[owner].battleArea)
  expect(paid.players[owner].discardPile).toEqual([])
  expect(paid.players[owner].supportArea.map(s=>s.rested)).toEqual([true,false])
  expect(getEffectSelectionCandidates(paid,{sourcePlayerId:owner,sourceInstanceId:i.source},source.card.skill!.effects[0]).map(c=>c.instanceId)).toEqual([i.host])
  const after=applyGameCommand(paid,{kind:'resolve-ability-effect',playerId:owner,targetIds:[i.host]})
  expect(after.players[owner].battleArea).toEqual([{...host,equippedCards:[source.card]}])
  expect(after.players[owner].discardPile).toEqual(source.hpCards)
  expect(after.players[owner].deck).toEqual(before.players[owner].deck)
  expect(after.players[owner].hand).toEqual(before.players[owner].hand)
  expect(after.players[owner].breakArea).toEqual([])
  expect(after.players[foe]).toEqual(before.players[foe])
  expect(after.pendingReplacement).toBeNull()
  expect(after.pendingOnPlay).toEqual(before.pendingOnPlay)
  expect(after.departedCookieCounts).toEqual(before.departedCookieCounts)
  expect(after.pendingAfterDamageEffects).toBeUndefined()
  expect(after.skillUsesThisTurn).toContain(source.battleEntryId)
  expect(canActivateCookieSkill(after,owner,i.source,'activate')).toBe(false)
  expect(after.commandLog?.at(-1)?.steps?.some(s=>s.text.includes(source.card.name)&&s.text.includes(host.card.name))).toBe(true)
  assertBs12PhysicalFixture(after)
  expect(before).toEqual(snapshot)
 })
 it.each(['equip-wrong-host','equip-no-energy','equip-wrong-energy','equip-rested-energy','equip-opponent-turn','equip-outside-main'] as const)('rejects an illegal actual Equip before payment: %s',scenario=>{
  const before=create(n,scenario),snapshot=structuredClone(before)
  assertBs12PhysicalFixture(before)
  expect(canActivateCookieSkill(before,owner,ids(n).source,'activate')).toBe(false)
  expect(()=>open(before,n)).toThrow()
  expect(before).toEqual(snapshot)
 })
 it('requires exactly one named own host, rejects wrong player, zero, self, opponent and duplicates atomically',()=>{
  const before=create(n),paid=open(before,n),snapshot=structuredClone(paid),i=ids(n)
  for(const targetIds of[[],[i.source],[`bs12-${n}-opponent`],[i.host,i.host],[i.host,i.source]])expect(()=>applyGameCommand(paid,{kind:'resolve-ability-effect',playerId:owner,targetIds})).toThrow()
  expect(()=>applyGameCommand(paid,{kind:'resolve-ability-effect',playerId:foe,targetIds:[i.host]})).toThrow()
  expect(paid).toEqual(snapshot)
 })
 it('generic positive starts before real Equip; negative has an actual wrong-name host',()=>{
  const number=`BS12-${n}`
  expect(parseTestStateConfig(`?test-state=card:${number}`,'localhost')).toEqual({kind:`bs12-${n}`,scenario:'equip-positive'})
  expect(parseTestStateConfig(`?test-state=card-negative:${number}`,'localhost')).toEqual({kind:`bs12-${n}`,scenario:'equip-wrong-host'})
  for(const state of[createCardCheckDemoState(number),createCardNegativeDemoState(number)]){
   assertBs12PhysicalFixture(state)
   expect(state.players[owner].battleArea).toHaveLength(2)
   expect(state.players[owner].battleArea.every(c=>c.hpCards.length===c.card.hp)).toBe(true)
   expect(state.players[owner].battleArea.every(c=>!c.equippedCards?.length)).toBe(true)
  }
 })
 it.each(['missing','hp-break','replacement'] as const)('strict contract refuses altered lifecycle %s',mutation=>{
  const record=candidate.cards.find(c=>c.cardNumber===`BS12-${n}`) as OfficialCardRecord,result=convertOfficialCardToGameCard(record)
  if(result.status!=='converted'||result.gameCard.type!=='cookie')throw Error('Missing print')
  expect(analyzeOfficialCardBehavior(record,result.gameCard).contract.status).toBe('verified')
  const card=structuredClone(result.gameCard),effect=card.skill!.effects[0]
  if(effect.kind!=='equip-source')throw Error('Missing Equip')
  if(mutation==='missing')delete effect.battleSourceDisposition
  // These intentionally malformed runtime values exercise the fail-closed contract.
  else Object.assign(effect.battleSourceDisposition!,mutation==='hp-break'?{hp:'break'}:{replacement:'normal'})
  expect(analyzeOfficialCardBehavior(record,card).contract.status).toBe('needs-review')
 })
})
describe('R007 actual-equipped follow-up',()=>{
 it.each([0,1,2])('062 draws %s after actual B Equip then printed host N attack',drawCount=>{
  const before=create('062'),equipped=equip(before,'062'),declared=attack(equipped,'062')
  expect(declared.pendingStageTrigger?.sourceKind).toBe('cookie-equip')
  const trigger=applyGameCommand(declared,{kind:'resolve-stage-trigger',playerId:owner,action:'activate'})
  expect(trigger.pendingDrawUpTo?.max).toBe(2)
  const drawn=applyGameCommand(trigger,{kind:'resolve-draw-up-to',playerId:owner,drawCount}),done=finish(drawn)
  expect(done.players[owner].hand).toHaveLength(1+drawCount)
  expect(done.players[owner].deck).toHaveLength(before.players[owner].deck.length-drawCount)
  expect(done.players[foe].battleArea[0].hpCards).toHaveLength(5)
  expect(done.players[owner].battleArea[0].hpCards).toHaveLength(2)
  expect(done.players[owner].supportArea.every(s=>s.rested)).toBe(true)
  assertBs12PhysicalFixture(done)
 })
 it.each([5,6])('062 counts hand threshold %s independently of Equip payment',hand=>{
  const state=equip(create('062',hand===5?'equip-hand-five':'equip-hand-six'),'062'),declared=attack(state,'062')
  expect(Boolean(declared.pendingStageTrigger)).toBe(hand===5)
  if(hand===6)expect(declared.commandLog?.at(-1)?.steps?.some(s=>s.text.includes('條件不成立，效果未執行'))).toBe(true)
 })
 it('077 actual P Equip then printed P host attack prevents only Blocker in this battle',()=>{
  const before=create('077'),equipped=equip(before,'077'),declared=attack(equipped,'077')
  expect(declared.pendingBattle?.blockerPrevention).toMatchObject({playerId:foe,sourceInstanceId:ids('077').source})
  expect(getBlockerCandidates(declared,foe)).toEqual([])
  expect(isBlockDisabled(declared,foe)).toBe(true)
  expect(declared.pendingBattle?.flipBlocker).toBeUndefined()
  expect(declared.pendingBattle?.trapsDisabled).toBeUndefined()
  expect(()=>applyGameCommand(declared,{kind:'play-blocker',playerId:foe,sourceInstanceId:'bs12-077-blocker',paymentIds:[]})).toThrow()
  const done=finish(declared)
  expect(isBlockDisabled(done,foe)).toBe(false)
  expect(done.players[foe].battleArea.map(c=>c.hpCards.length)).toEqual([3,4])
  expect(done.players[foe].battleArea[1].rested).toBe(false)
  assertBs12PhysicalFixture(done)
 })
})
