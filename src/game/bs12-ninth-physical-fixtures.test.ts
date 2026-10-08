import { describe, expect, it } from 'vitest'
import {
 createBs12ClottedDemoState,createBs12FinancierDemoState,createBs12GreenbellDemoState,createBs12MelonDemoState,
 createCardCheckDemoState,createCardNegativeDemoState,parseTestStateConfig,
 type Bs12ClottedScenario,type Bs12FinancierScenario,type Bs12GreenbellScenario,type Bs12MuscleScenario,
} from './demo'
import { assertBs12PhysicalFixture } from './bs12-physical-fixtures.test-helpers'

const clotted:Bs12ClottedScenario[]=['positive','first-player','three-arena','wrong-color','non-arena','high-level','opponent-break','full-battle','opponent-turn','outside-main','attack','wrong-energy','few-energy','rested-energy','rested-source']
const financier:Bs12FinancierScenario[]=['four','zero','three','five','seven','eight','mixed-colors','non-arena','high-level','opponent-break','trash-arena','support-arena','wrong-energy','no-energy','rested-energy','opponent-turn','outside-main','used','source-rested','attack','attack-three-energy','attack-wrong','attack-rested','target-faints','deploy']
const greenbell:Bs12GreenbellScenario[]=['positive','equal-before','equal-after','more-after','foe-zero','zero-after','source-rested','opponent-rested','hand','full-battle','short-deck','last-deck','attack','attack-wrong','attack-few','attack-rested-energy','attack-rested-source','isolated-opponent-turn']
const melon:Array<Bs12MuscleScenario|'deploy'>=['positive','blue-energy','few-energy','rested-energy','source-rested','opponent-turn','target-faints','deploy']

describe.each(['BS12-036','BS12-036@1']as const)('%s physical identity',number=>it.each(clotted)('%s matches exact printed cards in every zone',scenario=>assertBs12PhysicalFixture(createBs12ClottedDemoState(scenario,number))))
describe.each(['BS12-037','BS12-037@1']as const)('%s physical identity',number=>it.each(financier)('%s matches exact printed cards in every zone',scenario=>assertBs12PhysicalFixture(createBs12FinancierDemoState(scenario,number))))
describe.each(['BS12-038','BS12-038@1']as const)('%s physical identity',number=>it.each(greenbell)('%s matches exact printed cards in every zone',scenario=>assertBs12PhysicalFixture(createBs12GreenbellDemoState(scenario,number))))
it.each(melon)('039 %s matches exact printed cards in every zone',scenario=>assertBs12PhysicalFixture(createBs12MelonDemoState(scenario)))

it.each(['BS12-036','BS12-036@1','BS12-037','BS12-037@1','BS12-038','BS12-038@1','BS12-039']as const)('%s generic routes load physical mechanism and negative resources',number=>{
 const positive=createCardCheckDemoState(number),negative=createCardNegativeDemoState(number)
 assertBs12PhysicalFixture(positive);assertBs12PhysicalFixture(negative)
 const base=number.split('@')[0]
 const scenario=base==='BS12-037'?'four':'positive'
 const negativeScenario=base==='BS12-036'?'three-arena':base==='BS12-037'?'wrong-energy':base==='BS12-038'?'equal-after':'few-energy'
 for(const[prefix,expected]of [['card',scenario],['card-negative',negativeScenario]]){
  expect(parseTestStateConfig(`?test-state=${prefix}:${number}`,'localhost')).toEqual({kind:base.toLowerCase(),...(base==='BS12-039'?{}:{cardNumber:number}),scenario:expected})
  expect(parseTestStateConfig(`?test-state=${prefix}:${number}`,'example.com')).toBeNull()
 }
 if(number.startsWith('BS12-036')){
  expect(positive.players['player-one'].extraDeck?.[0]?.id).toBe('BS12-036')
  expect(positive.players['player-one'].breakArea.filter(card=>card.type==='cookie'&&card.cardColor==='yellow'&&card.keywords?.includes('arena'))).toHaveLength(4)
  expect(negative.players['player-one'].breakArea.filter(card=>card.type==='cookie'&&card.cardColor==='yellow'&&card.keywords?.includes('arena'))).toHaveLength(3)
 }else if(number.startsWith('BS12-037')){
  expect(positive.players['player-one'].breakArea.filter(card=>card.type==='cookie'&&card.keywords?.includes('arena'))).toHaveLength(4)
 }else if(number.startsWith('BS12-038')){
  expect(positive.players['player-one'].supportArea.some(entry=>entry.card.id==='BS12-038')).toBe(true)
  expect(positive.players['player-one'].battleArea[0].card.id).toBe('BS7-055')
 }else{
  expect(positive.players['player-one'].battleArea[0].card).toMatchObject({id:'BS12-039',level:3,hp:4,attack:4,attackCost:3})
  expect(negative.players['player-one'].supportArea).toHaveLength(2)
 }
})
