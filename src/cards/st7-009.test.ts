import {describe,it,expect} from 'vitest'
import {raw} from '../game/st7-009-demo'
import {createCard} from '../game/starter-deck'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'
import type {CookieCard} from '../game/types'
const original=()=>{const card=createCard(raw,'player-one',1);if(card.type!=='cookie')throw Error('Original Cookie');return card}
const mutants:Record<string,(card:CookieCard)=>void>={
 'wrong-card-color':c=>{c.cardColor='red'},'wrong-energy-color':c=>{c.energyColor='blue'},'wrong-level':c=>{c.level=3},'wrong-hp':c=>{c.hp=3},'wrong-attack':c=>{c.attack=2},'free-attack':c=>{c.attackCost=0;c.attackEnergyCost={}},'colored-attack':c=>{c.attackEnergyCost={yellow:1}},'extra-main-effect':c=>{c.effects=[{kind:'draw',amount:1}]},'extra-attack-effect':c=>{c.attackEffects=[{kind:'draw',amount:1}]},'extra-flip':c=>{c.flip={text:'Invalid extra FLIP',cost:{energy:{}},effects:[{kind:'draw',amount:1}]}},'extra-skill':c=>{c.skill={text:'Invalid extra skill',trigger:'activate',oncePerTurn:false,yourTurn:false,restSource:false,cost:{energy:{}},effects:[{kind:'draw',amount:1}]}},'extra-keyword':c=>{c.keywords=['arena']},
}
describe('ST7-009 independent original printing',()=>{
 it('retains yellow LV2 HP4 NNN ordinary3 with no other printed effects',()=>{
  const c=original();expect([c.name,c.cardColor??c.energyColor,c.energyColor,c.level,c.hp,c.attack,c.attackCost]).toEqual(['Lilybell Cookie','yellow','yellow',2,4,3,3])
  expect(c.attackEnergyCost).toEqual({neutral:3});expect(c.skill).toBeUndefined();expect(c.flip).toBeUndefined();expect(c.effects??[]).toEqual([]);expect(c.attackEffects??[]).toEqual([]);expect(c.keywords??[]).toEqual([])
 })
 it('verifies converter and actual createCard runtime',()=>{
  expect(analyze(raw).contract.status).toBe('verified');expect(analyze(raw,original()).contract.status).toBe('verified')
 })
 it.each(Object.keys(mutants))('rejects %s without altering raw',name=>{
  const before=structuredClone(raw),c=original();mutants[name](c)
  expect(analyze(raw,c).contract.status).not.toBe('verified');expect(raw).toEqual(before)
 })
})
