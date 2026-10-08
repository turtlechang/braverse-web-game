import {describe,expect,it} from 'vitest'
import {createBs12KouignDemoState,createBs12CreamSodaDemoState, parseTestStateConfig, type Bs12CreamSodaScenario, type Bs12KouignScenario} from './demo'
import {applyGameCommand} from './commands'
import {assertBs12PhysicalFixture} from './bs12-physical-fixtures.test-helpers'
import type {GameState} from './types'
const owner='player-one' as const,foe='player-two' as const
const damage=(s:GameState,attacker:string,target:string,paymentIds:string[],count:number)=>{
 let n=applyGameCommand(s,{kind:'declare-attack',playerId:owner,attackerInstanceId:attacker,targetInstanceId:target,supportPaymentIds:paymentIds})
 n=applyGameCommand(n,{kind:'skip-trap',playerId:foe})
 for(let i=0;i<count;i++)n=applyGameCommand(n,{kind:'resolve-next-damage',playerId:foe})
 return n
}
describe.each(['BS12-035','BS12-035@1'] as const)('%s R002 selectable opponent Then',number=>{
 it('after ordinary one, can choose the other opponent for one effect damage',()=>{
  const before=createBs12KouignDemoState('then-four',number)
  assertBs12PhysicalFixture(before)
  const attacked=damage(before,'bs12-035-source','bs12-035-opponent',['bs12-035-payment'],1)
  expect(attacked.pendingBattle?.stage).toBe('attack-effect')
  const after=applyGameCommand(attacked,{kind:'resolve-attack-effect',playerId:owner,targetIds:['bs12-035-opponent-other']})
  expect(after.players[foe].battleArea.map(c=>c.hpCards.length)).toEqual([5,2])
 })
 it.each(['then-three','then-non-arena','then-opponent','then-level'] as const)('counts own Arena cards, not LV or opponent Break: %s',scenario=>{
  const before=createBs12KouignDemoState(scenario,number)
  assertBs12PhysicalFixture(before)
  const attacked=damage(before,'bs12-035-source','bs12-035-opponent',['bs12-035-payment'],1)
  const after=applyGameCommand(attacked,{kind:'resolve-attack-effect',playerId:owner,targetIds:[]})
  expect(after.players[foe].battleArea.map(c=>c.hpCards.length)).toEqual([5,3])
  expect(after.commandLog?.at(-1)?.steps?.map(step=>step.text).join(' ')).toMatch(/條件不成立/)
 })
 it.each([[],['bs12-035-opponent'],['bs12-035-opponent-other']].map(ids=>({ids})))('allows zero or either opponent: $ids',({ids})=>{
  const before=createBs12KouignDemoState('then-four',number)
  const attacked=damage(before,'bs12-035-source','bs12-035-opponent',['bs12-035-payment'],1)
  const after=applyGameCommand(attacked,{kind:'resolve-attack-effect',playerId:owner,targetIds:ids})
  expect(after.players[foe].battleArea.map(c=>c.hpCards.length)).toEqual([ids[0]==='bs12-035-opponent'?4:5,ids[0]==='bs12-035-opponent-other'?2:3])
 })
 it('still selects another opponent after the ordinary target faints',()=>{
  const before=createBs12KouignDemoState('then-faints',number)
  assertBs12PhysicalFixture(before)
  let attacked=damage(before,'bs12-035-source','bs12-035-opponent',['bs12-035-payment'],1)
  expect(attacked.players[foe].battleArea).toHaveLength(1)
  expect(attacked.players[foe].breakArea).toHaveLength(1)
  if(attacked.pendingReplacement) attacked=applyGameCommand(attacked,{kind:'skip-replacement',playerId:foe})
  const after=applyGameCommand(attacked,{kind:'resolve-attack-effect',playerId:owner,targetIds:['bs12-035-opponent-other']})
  expect(after.players[foe].battleArea.map(c=>c.hpCards.length)).toEqual([2])
  expect(after.players[foe].breakArea.map(c=>c.id)).toContain('BS12-025')
 })
 it('rejects own target, two opponents, missing ID and wrong actor without mutation',()=>{
  const attacked=damage(createBs12KouignDemoState('then-four',number),'bs12-035-source','bs12-035-opponent',['bs12-035-payment'],1)
  const snapshot=structuredClone(attacked)
  for(const ids of [['bs12-035-source'],['bs12-035-opponent','bs12-035-opponent-other'],['missing']])expect(()=>applyGameCommand(attacked,{kind:'resolve-attack-effect',playerId:owner,targetIds:ids})).toThrow()
  expect(()=>applyGameCommand(attacked,{kind:'resolve-attack-effect',playerId:foe,targetIds:[]})).toThrow()
  expect(attacked).toEqual(snapshot)
 })
 it.each(['then-four','then-three','then-non-arena','then-opponent','then-level','then-faints'] as Bs12KouignScenario[])('parses dedicated physical route %s',scenario=>{
  expect(parseTestStateConfig('?test-state='+number.toLowerCase()+':'+scenario,'localhost')).toEqual({kind:'bs12-035',cardNumber:number,scenario})
 })
})
describe.each(['BS12-072','BS12-072@1'] as const)('%s R004 fixed original opponent Then',number=>{
 it('opens the complete discard/reveal/original-defender continuation',()=>{
  const before=createBs12CreamSodaDemoState('then-positive',number)
  const bottom=before.players[owner].deck.at(-1)!
  assertBs12PhysicalFixture(before)
  const attacked=damage(before,'bs12-072-source',before.players[foe].battleArea[0].card.instanceId,['r004-pay-0','r004-pay-1'],2)
  expect(attacked.pendingBattle?.stage).toBe('attack-effect')
  const opened=applyGameCommand(attacked,{kind:'resolve-attack-effect',playerId:owner,targetIds:[]})
  expect(opened.pendingOptionalCostAttack?.cost.discardHand).toBe(1)
  const paid=applyGameCommand(opened,{kind:'resolve-optional-cost-attack',playerId:owner,action:'pay',discardCardIds:['r004-cost'],targetIds:[]})
  expect(paid.pendingRevealTopDeck?.revealedCard.instanceId).toBe(bottom.instanceId)
  const returned=applyGameCommand(paid,{kind:'resolve-reveal-top-deck',playerId:owner})
  expect(returned.players[owner].hand.map(c=>c.instanceId)).toContain(bottom.instanceId)
  const after=applyGameCommand(returned,{kind:'resolve-ability-effect',playerId:owner,targetIds:[before.players[foe].battleArea[0].card.instanceId]})
  expect(after.players[foe].battleArea[0].hpCards).toHaveLength(before.players[foe].battleArea[0].hpCards.length-3)
  expect(after.players[foe].battleArea[1]).toEqual(before.players[foe].battleArea[1])
 })
 it.each(['then-red','then-yellow','then-green','then-purple','then-black','then-cost-cookie','then-cost-stage','then-cost-trap'] as const)('accepts any-color matching bottom and any-type hand cost: %s',scenario=>{
  const before=createBs12CreamSodaDemoState(scenario,number)
  assertBs12PhysicalFixture(before)
  const target=before.players[foe].battleArea[0].card.instanceId
  const attacked=damage(before,'bs12-072-source',target,['r004-pay-0','r004-pay-1'],2)
  const opened=applyGameCommand(attacked,{kind:'resolve-attack-effect',playerId:owner,targetIds:[]})
  const paid=applyGameCommand(opened,{kind:'resolve-optional-cost-attack',playerId:owner,action:'pay',discardCardIds:['r004-cost'],targetIds:[]})
  const returned=applyGameCommand(paid,{kind:'resolve-reveal-top-deck',playerId:owner})
  const after=applyGameCommand(returned,{kind:'resolve-ability-effect',playerId:owner,targetIds:[target]})
  expect(after.players[owner].hand.map(c=>c.instanceId)).toEqual(['r004-bottom'])
  expect(after.players[owner].discardPile.map(c=>c.instanceId)).toContain('r004-cost')
  expect(after.players[foe].battleArea.map(c=>c.hpCards.length)).toEqual([3,4])
 })
 it.each(['then-level-one','then-level-three','then-non-arena','then-item'] as const)('pays and reveals, but mismatch neither returns nor deals damage: %s',scenario=>{
  const before=createBs12CreamSodaDemoState(scenario,number)
  assertBs12PhysicalFixture(before)
  const attacked=damage(before,'bs12-072-source',before.players[foe].battleArea[0].card.instanceId,['r004-pay-0','r004-pay-1'],2)
  const opened=applyGameCommand(attacked,{kind:'resolve-attack-effect',playerId:owner,targetIds:[]})
  const paid=applyGameCommand(opened,{kind:'resolve-optional-cost-attack',playerId:owner,action:'pay',discardCardIds:['r004-cost'],targetIds:[]})
  expect(paid.pendingRevealTopDeck?.matched).toBe(false)
  const after=applyGameCommand(paid,{kind:'resolve-reveal-top-deck',playerId:owner})
  expect(after.players[owner].deck).toEqual(before.players[owner].deck)
  expect(after.players[owner].hand).toEqual([])
  expect(after.players[foe].battleArea.map(c=>c.hpCards.length)).toEqual([4,4])
  expect(after.pendingAbilityEffect).toBeFalsy()
 })
 it('returns matching bottom but never transfers damage when original defender fainted',()=>{
  const before=createBs12CreamSodaDemoState('then-faints',number)
  assertBs12PhysicalFixture(before)
  let attacked=damage(before,'bs12-072-source',before.players[foe].battleArea[0].card.instanceId,['r004-pay-0','r004-pay-1'],2)
  expect(attacked.players[foe].battleArea).toHaveLength(1)
  expect(attacked.players[foe].breakArea).toHaveLength(1)
  if(attacked.pendingReplacement) attacked=applyGameCommand(attacked,{kind:'skip-replacement',playerId:foe})
  const opened=applyGameCommand(attacked,{kind:'resolve-attack-effect',playerId:owner,targetIds:[]})
  const paid=applyGameCommand(opened,{kind:'resolve-optional-cost-attack',playerId:owner,action:'pay',discardCardIds:['r004-cost'],targetIds:[]})
  const after=applyGameCommand(paid,{kind:'resolve-reveal-top-deck',playerId:owner})
  expect(after.players[owner].hand.map(c=>c.instanceId)).toEqual(['r004-bottom'])
  expect(after.players[foe].battleArea).toEqual(before.players[foe].battleArea.slice(1))
  expect(after.pendingAbilityEffect).toBeFalsy()
 })
 it('allows skipping complete Then without hand payment or reveal',()=>{
  const attacked=damage(createBs12CreamSodaDemoState('then-no-hand',number),'bs12-072-source','bs12-064-opponent',['r004-pay-0','r004-pay-1'],2)
  const opened=applyGameCommand(attacked,{kind:'resolve-attack-effect',playerId:owner,targetIds:[]})
  const after=applyGameCommand(opened,{kind:'resolve-optional-cost-attack',playerId:owner,action:'skip',targetIds:[]})
  expect(after.players).toEqual(opened.players)
  expect(after.pendingRevealTopDeck).toBeFalsy()
 })
 it('rejects missing, duplicate, wrong-zone, extra hand cost immutably',()=>{
  const attacked=damage(createBs12CreamSodaDemoState('then-positive',number),'bs12-072-source','bs12-064-opponent',['r004-pay-0','r004-pay-1'],2)
  const opened=applyGameCommand(attacked,{kind:'resolve-attack-effect',playerId:owner,targetIds:[]})
  const snapshot=structuredClone(opened)
  for(const ids of [[],['missing'],['r004-pay-0'],['r004-cost','r004-cost']])expect(()=>applyGameCommand(opened,{kind:'resolve-optional-cost-attack',playerId:owner,action:'pay',discardCardIds:ids,targetIds:[]})).toThrow()
  expect(opened).toEqual(snapshot)
 })
 it.each(['then-wrong-energy','then-one-energy'] as const)('rejects illegal BB payment %s',scenario=>{
  const before=createBs12CreamSodaDemoState(scenario,number)
  assertBs12PhysicalFixture(before)
  const snapshot=structuredClone(before)
  expect(()=>applyGameCommand(before,{kind:'declare-attack',playerId:owner,attackerInstanceId:'bs12-072-source',targetInstanceId:'bs12-064-opponent',supportPaymentIds:before.players[owner].supportArea.map(s=>s.card.instanceId)})).toThrow()
  expect(before).toEqual(snapshot)
 })
 it.each(['then-positive','then-faints','then-non-arena','then-no-hand'] as Bs12CreamSodaScenario[])('parses dedicated physical route %s',scenario=>{
  expect(parseTestStateConfig('?test-state='+number.toLowerCase()+':'+scenario,'localhost')).toEqual({kind:'bs12-072',cardNumber:number,scenario})
 })
})
