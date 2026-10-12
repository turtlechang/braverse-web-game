import {describe,it,expect} from 'vitest'
import {raw} from '../game/st7-003-demo'
import {createCard} from '../game/starter-deck'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'
import type {CookieCard} from '../game/types'
const original=()=>{const c=createCard(raw,'player-one',1);if(c.type!=='cookie')throw Error('Original Cookie');return c}
const flip=(c:CookieCard)=>{if(!c.flip)throw Error('Original FLIP');return c.flip}
const mutants:Record<string,(c:CookieCard)=>void>={
 'wrong-card-color':c=>{c.cardColor='red'},'wrong-color':c=>{c.energyColor='red'},'wrong-lv':c=>{c.level=1},'wrong-hp':c=>{c.hp=3},'wrong-attack-damage':c=>{c.attack=3},'wrong-attack-energy':c=>{c.attackEnergyCost={red:4}},'wrong-total-attack-cost':c=>{c.attackCost=3},
 'missing-flip':c=>{c.flip=undefined},'free-flip':c=>{flip(c).cost.discardHand=0},'two-hand-cost':c=>{flip(c).cost.discardHand=2},'extra-energy':c=>{flip(c).cost.energy={yellow:1}},'cookie-only-hand':c=>{flip(c).cost.discardHandType='cookie'},'yellow-only-hand':c=>{flip(c).cost.discardHandColor='yellow'},'discard-at-least':c=>{flip(c).cost.discardHandAtLeast=true},'missing-hp-bonus':c=>{flip(c).attachedHpBonus=0},'wrong-hp-bonus':c=>{flip(c).attachedHpBonus=2},'extra-flip-effect':c=>{flip(c).effects.push({kind:'draw',amount:1})},'extra-main-effect':c=>{c.effects=[{kind:'draw',amount:1}]},'extra-attack-effect':c=>{c.attackEffects=[{kind:'draw',amount:1}]},'wrong-hand-destination':c=>{flip(c).handCostDestination='deck-bottom'},'alternate-bearer':c=>{flip(c).attachedHpAlternateTarget={side:'self',min:0,max:1}},
}
describe('ST7-003 independently transcribed original printing',()=>{
 it('retains yellow LV3 HP4 YYYY ordinary 4 without a Cookie skill',()=>{
  const c=original();expect([c.name,c.cardColor??c.energyColor,c.energyColor,c.level,c.hp,c.attack,c.attackCost]).toEqual(['Rainbow Sherbet Cookie','yellow','yellow',3,4,4,4])
  expect(c.attackEnergyCost).toEqual({yellow:4});expect(c.skill).toBeUndefined();expect(c.effects??[]).toEqual([]);expect(c.attackEffects??[]).toEqual([])
 })
 it('requires exactly one arbitrary hand card for original HP bearer +1',()=>{
  const f=flip(original());expect(f.cost).toEqual({energy:{},discardHand:1});expect(f.attachedHpBonus).toBe(1);expect(f.attachedHpAlternateTarget).toBeUndefined();expect(f.handCostDestination).toBeUndefined();expect(f.effects).toEqual([])
 })
 it('verifies the unmodified original runtime',()=>expect(analyze(raw).contract.status).toBe('verified'))
 it('verifies the actual createCard runtime with optional metadata omitted',()=>expect(analyze(raw,original()).contract.status).toBe('verified'))
 it.each(Object.keys(mutants))('rejects %s without mutating raw source',name=>{
  const before=structuredClone(raw),c=original();mutants[name](c)
  expect(analyze(raw,c).contract.status).not.toBe('verified');expect(raw).toEqual(before)
 })
})
