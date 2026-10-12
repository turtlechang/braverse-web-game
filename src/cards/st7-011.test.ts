import {describe,it,expect} from 'vitest'
import {raw} from '../game/st7-011-demo'
import type {CookieCard} from '../game/types'
import {createCard} from '../game/starter-deck'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'
const original=()=>{const card=createCard(raw,'player-one',1);if(card.type!=='cookie')throw Error('Printed Cookie required');return card}
const effect=(card:CookieCard)=>{const value=card.attackEffects?.[0];if(value?.kind!=='gain-hp')throw Error('Printed gain HP Then required');return value}
const target=(card:CookieCard)=>{const value=effect(card).target;if(!value)throw Error('Printed source-only target required');return value}
const conditions=(card:CookieCard)=>{const value=effect(card).condition;if(value?.kind!=='all-of')throw Error('Printed combined conditions required');return value.conditions}
const hp=(card:CookieCard)=>{const value=conditions(card).find(item=>item.kind==='source-hp-at-most');if(value?.kind!=='source-hp-at-most')throw Error('Printed HP threshold required');return value}
const witness=(card:CookieCard)=>{const value=conditions(card).find(item=>item.kind==='battle-area-has-named-cookie');if(value?.kind!=='battle-area-has-named-cookie')throw Error('Printed named battle witness required');return value}
const mutants:Record<string,(card:CookieCard)=>void>={
 'wrong-name':c=>{c.name='Wrong Cookie'},'wrong-color':c=>{c.cardColor='red'},'wrong-level':c=>{c.level=2},'wrong-hp':c=>{c.hp=3},'wrong-damage':c=>{c.attack=3},'free-attack':c=>{c.attackCost=0;c.attackEnergyCost={}},'wrong-energy':c=>{c.attackEnergyCost={neutral:2}},
 'missing-then':c=>{c.attackEffects=[]},'extra-then':c=>{c.attackEffects?.push({kind:'draw',amount:1})},'wrong-gain':c=>{effect(c).amount=2},'wrong-side':c=>{target(c).side='opponent'},'missing-source-only':c=>{target(c).sourceOnly=false},'optional-source':c=>{target(c).min=0},'extra-target':c=>{target(c).max=2},'extra-target-filter':c=>{target(c).energyColor='yellow'},
 'no-conditions':c=>{delete effect(c).condition},'any-condition':c=>{effect(c).condition={kind:'any-of',conditions:conditions(c)}},'missing-hp-condition':c=>{conditions(c).shift()},'wrong-hp-threshold':c=>{hp(c).amount=3},'missing-witness':c=>{conditions(c).pop()},'wrong-witness-name':c=>{witness(c).name='Lilybell Cookie'},'wrong-witness-owner':c=>{witness(c).side='opponent'},'missing-min-level':c=>{delete witness(c).minLevel},'missing-max-level':c=>{delete witness(c).maxLevel},'wrong-min-level':c=>{witness(c).minLevel=2},'wrong-max-level':c=>{witness(c).maxLevel=4},'negated-witness':c=>{witness(c).negate=true},'extra-witness-filter':c=>{witness(c).keyword='arena'},'extra-keyword':c=>{c.keywords=['arena']},'extra-metadata':c=>{c.effects=[{kind:'draw',amount:1}]},
}
describe('ST7-011 independent printed expectation and exact runtime contract',()=>{
 it('retains yellow LV1 HP2 YY ordinary2 and source-only conditional gain1',()=>{
  const card=original()
  expect([card.name,card.cardColor??card.energyColor,card.energyColor,card.level,card.hp,card.attack,card.attackCost]).toEqual(['Millennial Jade Deer','yellow','yellow',1,2,2,2])
  expect(card.attackEnergyCost).toEqual({yellow:2});expect(card.skill).toBeUndefined();expect(card.flip).toBeUndefined();expect(card.keywords??[]).toEqual([]);expect(card.effects??[]).toEqual([])
  expect(card.attackEffects).toEqual([{kind:'gain-hp',amount:1,target:{side:'self',min:1,max:1,sourceOnly:true},condition:{kind:'all-of',conditions:[{kind:'source-hp-at-most',amount:2},{kind:'battle-area-has-named-cookie',side:'self',name:'Millennial Tree Cookie',minLevel:3,maxLevel:3}]}}])
 })
 it('verifies actual conversion and provided runtime evidence',()=>{
  expect(analyze(raw).contract.status).toBe('verified');expect(analyze(raw,original()).contract.status).toBe('verified')
 })
 it.each(Object.keys(mutants))('rejects %s while preserving the original record',name=>{
  const before=structuredClone(raw),card=original();mutants[name](card)
  expect(analyze(raw,card).contract.status).not.toBe('verified');expect(raw).toEqual(before)
 })
})
