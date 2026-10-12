import {describe,expect,it} from 'vitest'
import document from '../../data/candidates/st6-st10/official-st7.en.json'
import {getCardPoolEntry} from '../game/card-pool'
import {createCard} from '../game/starter-deck'
import type {GameCard} from '../game/types'
import type {OfficialCardRecord} from './types'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'
const record=getCardPoolEntry('ST7-014')??document.cards.find(card=>card.cardNumber==='ST7-014')
if(!record)throw Error('Original ST7-014 required')
const raw=record as OfficialCardRecord
const original=()=>createCard(raw,'player-one',1)
const item=(c:GameCard)=>{if(!c.item)throw Error('Original item');return c.item}
const effect=(c:GameCard)=>{const e=item(c).effects[0];if(e?.kind!=='gain-hp')throw Error('Printed gain HP');return e}
const target=(c:GameCard)=>{const t=effect(c).target;if(!t)throw Error('Printed target');return t}
const witness=(c:GameCard)=>{const condition=effect(c).condition;if(condition?.kind!=='any-of')throw Error('Printed OR witness');return condition}
const named=(c:GameCard,index:number)=>{const condition=witness(c).conditions[index];if(condition?.kind!=='battle-area-has-named-cookie'&&condition?.kind!=='break-area-has-card')throw Error('Printed named witness');return condition}
const mutants:Record<string,(c:GameCard)=>void>={
 missingInactivePayment:c=>delete item(c).allowInactiveConditionalEffects,
 missingCondition:c=>delete effect(c).condition,
 battleOnly:c=>{effect(c).condition=witness(c).conditions[0]},breakOnly:c=>{effect(c).condition=witness(c).conditions[1]},
 conditionAND:c=>{effect(c).condition={kind:'all-of',conditions:witness(c).conditions}},opponentWitness:c=>{named(c,0).side='opponent'},
 wrongName:c=>{named(c,0).name='Elder Faerie Cookie'},missingLvFloor:c=>{delete named(c,0).minLevel},missingLvCeiling:c=>{delete named(c,1).maxLevel},wrongLv:c=>{named(c,1).minLevel=2},
 missingBreak:c=>{witness(c).conditions.pop()},extraAlternative:c=>{witness(c).conditions.push({kind:'break-level-at-least',level:3})},
 extraHP:c=>{effect(c).amount=2},opponentHeal:c=>{target(c).side='opponent'},mandatoryTarget:c=>{target(c).min=1},twoTargets:c=>{target(c).max=2},addedHpCap:c=>{target(c).maxRemainingHp=4},addedColor:c=>{target(c).energyColor='yellow'},
 freeItem:c=>{item(c).cost={}},extraEnergy:c=>{item(c).cost.neutral=1},wrongColor:c=>{c.energyColor='red'},wrongNameItem:c=>{c.name='Budding Future'},extraEffect:c=>{item(c).effects.push({kind:'draw',amount:1})},
}

describe('ST7-014 independently transcribed original item',()=>{
 it('preserves Y, same own named LV3 battle OR Break witness and optional unrestricted gain1HP',()=>{
  const card=original()
  expect([card.type,card.name,card.energyColor,card.cardColor??card.energyColor]).toEqual(['item','Essence of Rejuvenation','yellow','yellow'])
  expect(card.flip).toBeUndefined();expect(card.skill).toBeUndefined();expect(card.keywords??[]).toEqual([])
  expect(item(card).cost).toEqual({yellow:1});expect(item(card).allowInactiveConditionalEffects).toBe(true)
  expect(item(card).effects).toEqual([{kind:'gain-hp',amount:1,target:{side:'self',min:0,max:1},condition:{kind:'any-of',conditions:[{kind:'battle-area-has-named-cookie',side:'self',name:'Millennial Tree Cookie',minLevel:3,maxLevel:3},{kind:'break-area-has-card',side:'self',name:'Millennial Tree Cookie',minLevel:3,maxLevel:3}]}}])
 })
 it('accepts exact original runtime',()=>expect(analyze(raw,original()).contract.status).toBe('verified'))
 it.each(Object.keys(mutants))('rejects %s without changing source',name=>{
  const card=original(),before=structuredClone(raw);mutants[name](card)
  expect(analyze(raw,card).contract.status).not.toBe('verified');expect(raw).toEqual(before)
 })
})
