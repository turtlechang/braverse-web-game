import {describe,it,expect} from 'vitest'
import {raw} from '../game/st7-007-demo'
import {createCard} from '../game/starter-deck'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'
import type {CookieCard} from '../game/types'
const original=()=>{const card=createCard(raw,'player-one',1);if(card.type!=='cookie')throw Error('Original Cookie');return card}
const mutants:Record<string,(card:CookieCard)=>void>={
 'wrong-card-color':c=>{c.cardColor='red'},'wrong-energy-color':c=>{c.energyColor='blue'},'wrong-level':c=>{c.level=3},'wrong-hp':c=>{c.hp=5},'wrong-attack':c=>{c.attack=4},
 'free-attack':c=>{c.attackCost=0;c.attackEnergyCost={}},'neutral-attack':c=>{c.attackEnergyCost={neutral:3}},
 'extra-attack-effect':c=>{c.attackEffects=[{kind:'draw',amount:1}]},'extra-skill':c=>{c.skill={text:'Invalid skill',trigger:'activate',oncePerTurn:false,yourTurn:false,restSource:false,cost:{energy:{}},effects:[{kind:'draw',amount:1}]}},'extra-keyword':c=>{c.keywords=['arena']},
 'missing-flip':c=>{c.flip=undefined},'mandatory-draw':c=>{c.flip!.effects=[{kind:'draw',amount:1}]},'draw-too-many':c=>{c.flip!.effects=[{kind:'draw-up-to',max:2}]},'extra-main-effect':c=>{c.effects=[...(c.effects??[]),{kind:'draw',amount:1}]},
 'discard-cost':c=>{c.flip!.cost.discardHand=1},'energy-cost':c=>{c.flip!.cost.energy={yellow:1}},'extra-hp':c=>{c.flip!.attachedHpBonus=1},'extra-flip-effect':c=>{c.flip!.effects.push({kind:'draw',amount:1})},
}
describe('ST7-007 independent original printing contract',()=>{
 it('retains yellow LV2 HP4 YYY ordinary3 and free revealed-card return FLIP',()=>{
  const c=original();expect([c.name,c.cardColor??c.energyColor,c.energyColor,c.level,c.hp,c.attack,c.attackCost]).toEqual(['Fairy Cookie','yellow','yellow',2,4,3,3]);expect(c.attackEnergyCost).toEqual({yellow:3})
  expect(c.skill).toBeUndefined();expect(c.attackEffects??[]).toEqual([]);expect(c.keywords??[]).toEqual([]);expect(c.effects).toEqual([{kind:'flip-to-hand'}]);expect(c.flip?.effects).toEqual([{kind:'flip-to-hand'}]);expect(c.flip?.cost.energy).toEqual({});expect(c.flip?.cost.discardHand??0).toBe(0)
 })
 it('verifies original conversion and actual runtime',()=>{expect(analyze(raw).contract.status).toBe('verified');expect(analyze(raw,original()).contract.status).toBe('verified')})
 it.each(Object.keys(mutants))('rejects %s without changing original source',name=>{const before=structuredClone(raw),card=original();mutants[name](card);expect(analyze(raw,card).contract.status).not.toBe('verified');expect(raw).toEqual(before)})
})
