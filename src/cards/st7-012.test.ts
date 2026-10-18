import {describe,it,expect} from 'vitest'
import {raw} from '../game/st7-012-demo'
import type {CookieCard} from '../game/types'
import {createCard} from '../game/starter-deck'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'
const original=()=>{const card=createCard(raw,'player-one',1);if(card.type!=='cookie')throw Error('Original Cookie');return card}
const skill=(card:CookieCard)=>{if(!card.skill)throw Error('Printed Blocker');return card.skill}
const target=(card:CookieCard)=>{const effect=skill(card).effects[0];if(effect.kind!=='redirect-attack'||!effect.target)throw Error('Original redirect target');return effect.target}
const mutants:Record<string,(card:CookieCard)=>void>={
 'wrong-name':c=>{c.name='Wrong Cookie'},'wrong-color':c=>{c.cardColor='red'},'wrong-energy-color':c=>{c.energyColor='red'},'wrong-level':c=>{c.level=2},'wrong-hp':c=>{c.hp=4},'wrong-damage':c=>{c.attack=2},'free-ordinary':c=>{c.attackCost=0;c.attackEnergyCost={}},'missing-yellow-ordinary':c=>{c.attackEnergyCost={neutral:2}},'extra-ordinary-cost':c=>{c.attackEnergyCost={yellow:1,neutral:1,red:1}},
 'free-block':c=>{skill(c).cost.energy={}},'wrong-block-color':c=>{skill(c).cost.energy={red:1}},'extra-block-energy':c=>{skill(c).cost.energy={yellow:1,neutral:1}},'extra-hand-cost':c=>{skill(c).cost.discardHand=1},'filtered-zero-hand-cost':c=>{skill(c).cost.discardHandColor='yellow'},'wrong-trigger':c=>{skill(c).trigger='activate'},'extra-once':c=>{skill(c).oncePerTurn=true},'extra-rest':c=>{skill(c).restSource=true},'extra-your-turn':c=>{skill(c).yourTurn=true},'extra-once-game':c=>{skill(c).oncePerGame=true},
 'missing-source-only':c=>{target(c).sourceOnly=false},'wrong-side':c=>{target(c).side='opponent'},'optional-target':c=>{target(c).min=0},'extra-target':c=>{target(c).max=2},'extra-target-filter':c=>{target(c).energyColor='yellow'},'extra-active-filter':c=>{target(c).activeOnly=true},'missing-effect':c=>{skill(c).effects=[]},'extra-effect':c=>{skill(c).effects.push({kind:'draw',amount:1})},'missing-metadata-effect':c=>{c.effects=[]},'extra-then':c=>{c.attackEffects=[{kind:'draw',amount:1}]},'extra-flip':c=>{c.flip={text:'Unprinted FLIP',cost:{energy:{}},effects:[{kind:'draw',amount:1}]}},'extra-keyword':c=>{c.keywords=['arena']},
}
describe('ST7-012 independent original printing',()=>{
 it('retains yellow LV1 HP3 YN ordinary1 and Y Blocker without REST/Once/Then/FLIP',()=>{
  const card=original(),s=skill(card)
  expect([card.name,card.cardColor??card.energyColor,card.energyColor,card.level,card.hp,card.attack,card.attackCost]).toEqual(['Churro Cookie','yellow','yellow',1,3,1,2])
  expect(card.attackEnergyCost).toEqual({yellow:1,neutral:1});expect(card.attackEffects??[]).toEqual([]);expect(card.flip).toBeUndefined();expect(card.keywords??[]).toEqual([])
  expect([s.trigger,s.oncePerTurn,s.yourTurn,s.restSource,s.oncePerGame]).toEqual(['block',false,false,false,false]);expect(s.cost).toEqual({energy:{yellow:1},discardHand:0})
  expect(s.effects).toEqual([{kind:'redirect-attack',target:{side:'self',min:1,max:1,sourceOnly:true}}]);expect(card.effects).toEqual(s.effects)
 })
 it('verifies actual conversion and runtime against the exact guard',()=>{
  expect(analyze(raw).contract.status).toBe('verified');expect(analyze(raw,original()).contract.status).toBe('verified')
 })
 it.each(Object.keys(mutants))('rejects %s without changing original data',name=>{
  const before=structuredClone(raw),card=original();mutants[name](card)
  expect(analyze(raw,card).contract.status).not.toBe('verified');expect(raw).toEqual(before)
 })
})
