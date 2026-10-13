import {describe,expect,it} from 'vitest'
import document from '../../data/candidates/st6-st10/official-st7.en.json'
import {getCardPoolEntry} from '../game/card-pool'
import {createCard} from '../game/starter-deck'
import type {GameCard} from '../game/types'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'
import type {OfficialCardRecord} from './types'
const raw=(getCardPoolEntry('ST7-020')??(document.cards as OfficialCardRecord[]).find(c=>c.cardNumber==='ST7-020')) as OfficialCardRecord
const original=()=>createCard(raw,'player-one',1)
const stage=(c:GameCard)=>{if(!c.stageAbility)throw Error('Original Forest of Life Stage required');return c.stageAbility}
const draw=(c:GameCard)=>{const e=stage(c).effects[0];if(e?.kind!=='draw-up-to')throw Error('Original optional draw required');return e}
const mutants:Record<string,(c:GameCard)=>void>={
 freePlace:c=>{stage(c).placementCost={}},wrongPlace:c=>{stage(c).placementCost={red:1}},twoPlace:c=>{stage(c).placementCost={yellow:2}},
 freeActivate:c=>{stage(c).cost.energy={}},wrongActivate:c=>{stage(c).cost.energy={red:1}},twoActivate:c=>{stage(c).cost.energy={yellow:2}},extraDiscard:c=>{stage(c).cost.discardHand=1},
 noRest:c=>{stage(c).restSource=false},unprintedOnce:c=>{stage(c).oncePerTurn=true},noInactive:c=>{delete stage(c).allowInactiveConditionalEffects},
 noCondition:c=>{delete draw(c).condition},wrongCondition:c=>{draw(c).condition={kind:'break-level-at-least',level:4}},
 extraCondition:c=>{draw(c).condition={kind:'all-of',conditions:[{kind:'cookie-gained-hp-this-turn'},{kind:'break-level-at-least',level:4}]}},
 drawTwo:c=>{draw(c).max=2},mandatoryDraw:c=>{stage(c).effects=[{kind:'draw',amount:1,condition:{kind:'cookie-gained-hp-this-turn'}}]},
 extraEffect:c=>{stage(c).effects.push({kind:'draw',amount:1})},wrongName:c=>{c.name='Another Stage'},wrongColor:c=>{c.energyColor='red'},noAbility:c=>{delete c.stageAbility},
}
describe('ST7-020 original printed binding',()=>{
 it('requires Y placement, Activate Y plus REST, optional draw0-1 after own actual HP gain this turn',()=>{
  const c=original();expect([c.type,c.name,c.energyColor,c.cardColor??c.energyColor]).toEqual(['stage','Forest of Life','yellow','yellow'])
  expect(c.flip).toBeUndefined();expect(c.keywords??[]).toEqual([])
  expect(c.stageAbility).toEqual({placementCost:{yellow:1},cost:{energy:{yellow:1},discardHand:0},text:raw.skill.text,effects:[{kind:'draw-up-to',max:1,condition:{kind:'cookie-gained-hp-this-turn'}}],restSource:true,allowInactiveConditionalEffects:true})
 })
 it('verifies original runtime',()=>expect(analyze(raw,original()).contract.status).toBe('verified'))
 it.each(Object.keys(mutants))('rejects %s without changing original source',name=>{const c=original(),before=structuredClone(raw);mutants[name](c);expect(analyze(raw,c).contract.status).not.toBe('verified');expect(raw).toEqual(before)})
})
