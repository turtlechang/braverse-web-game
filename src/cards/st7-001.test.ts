import {describe,it,expect} from 'vitest'
import {raw} from '../game/st7-001-demo'
import {createCard} from '../game/starter-deck'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'
import type {CookieCard} from '../game/types'
const damage=(c:CookieCard)=>{const e=c.skill?.effects[0];if(e?.kind!=='damage')throw Error('Original damage');return e}
const mutants:Record<string,(c:CookieCard)=>void>={
 'wrong-color':c=>{c.energyColor='red'},'wrong-lv':c=>{c.level=1},'wrong-hp':c=>{c.hp=1},'wrong-attack-damage':c=>{c.attack=1},'wrong-attack-energy':c=>{c.attackEnergyCost={red:3}},
 'missing-skill':c=>{c.skill=undefined},'wrong-trigger':c=>{c.skill!.trigger='on-play'},'no-once':c=>{c.skill!.oncePerTurn=false},'extra-rest':c=>{c.skill!.restSource=true},'wrong-energy':c=>{c.skill!.cost.energy={red:1}},'no-energy':c=>{c.skill!.cost.energy={}},'missing-hand-cost':c=>{c.skill!.cost.handToBreakArea=undefined},'two-hand-cost':c=>{c.skill!.cost.handToBreakArea!.count=2},'yellow-only-cost':c=>{c.skill!.cost.handToBreakArea!.energyColor='yellow'},'arena-only-cost':c=>{c.skill!.cost.handToBreakArea!.keyword='arena'},'level-cost':c=>{c.skill!.cost.handToBreakArea!.minLevel=2},'extra-discard':c=>{c.skill!.cost.discardHand=1},'wrong-damage':c=>{damage(c).amount=1},'self-target':c=>{damage(c).target.side='self'},'mandatory-target':c=>{damage(c).target.min=1},'two-targets':c=>{damage(c).target.max=2},'extra-effect':c=>{c.skill!.effects.push({kind:'draw',amount:1})}}
describe('ST7-001 executed original printed contract',()=>{
 it('verifies the original converted card',()=>expect(analyze(raw).contract.status).toBe('verified'))
 it.each(Object.keys(mutants))('rejects %s without changing original source',name=>{const before=structuredClone(raw),c=createCard(raw,'player-one',1);if(c.type!=='cookie')throw Error('Cookie');mutants[name](c);expect(analyze(raw,c).contract.status).not.toBe('verified');expect(raw).toEqual(before)})
})
