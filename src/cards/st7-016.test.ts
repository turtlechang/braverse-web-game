import {describe,expect,it} from 'vitest'
import document from '../../data/candidates/st6-st10/official-st7.en.json'
import {getCardPoolEntry} from '../game/card-pool'
import {createCard} from '../game/starter-deck'
import type {GameCard} from '../game/types'
import type {OfficialCardRecord} from './types'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'
const record=getCardPoolEntry('ST7-016')??(document.cards as OfficialCardRecord[]).find(card=>card.cardNumber==='ST7-016')
if(!record)throw Error('Original ST7-016 required')
const raw=record as OfficialCardRecord
const original=()=>createCard(raw,'player-one',1)
const item=(c:GameCard)=>{if(!c.item)throw Error('Original item');return c.item}
const effect=(c:GameCard)=>{const e=item(c).effects[0];if(e?.kind!=='prevent-cookie-active-next-phase')throw Error('Printed next Active');return e}
const target=(c:GameCard)=>effect(c).target
const mutants:Record<string,(c:GameCard)=>void>={
 missingHpCap:c=>{delete target(c).maxRemainingHp},wrongHpCap:c=>{target(c).maxRemainingHp=3},printedHpInstead:c=>{delete target(c).maxRemainingHp;Object.assign(target(c),{maxOriginalHp:2})},
 ownTarget:c=>{target(c).side='self'},mandatory:c=>{target(c).min=1},two:c=>{target(c).max=2},addColor:c=>{target(c).energyColor='yellow'},addLevel:c=>{target(c).maxLevel=1},
 addCondition:c=>{effect(c).condition={kind:'break-level-at-least',level:3}},addEscape:c=>{effect(c).discardHandToSetActive=2},
 immediateRest:c=>{item(c).effects=[{kind:'rest-cookie',target:{side:'opponent',min:0,max:1,maxRemainingHp:2}}]},
 free:c=>{item(c).cost={}},underpay:c=>{item(c).cost.yellow=1},addCost:c=>{item(c).cost.neutral=1},wrongColor:c=>{c.energyColor='red'},wrongName:c=>{c.name='Budding Future'},extraEffect:c=>{item(c).effects.push({kind:'draw',amount:1})},
}
describe('ST7-016 original printed next Active Phase restriction',()=>{
 it('preserves YY, optional one opponent HP<=2 and only next Active restriction',()=>{
  const card=original()
  expect([card.type,card.name,card.energyColor,card.cardColor??card.energyColor]).toEqual(['item','Tightly Tied Vine','yellow','yellow'])
  expect(card.flip).toBeUndefined();expect(card.skill).toBeUndefined();expect(card.keywords??[]).toEqual([])
  expect(item(card).cost).toEqual({yellow:2})
  expect(item(card).effects).toEqual([{kind:'prevent-cookie-active-next-phase',target:{side:'opponent',min:0,max:1,maxRemainingHp:2}}])
 })
 it('accepts exact original runtime',()=>expect(analyze(raw,original()).contract.status).toBe('verified'))
 it.each(Object.keys(mutants))('rejects %s without source mutation',name=>{
  const card=original(),before=structuredClone(raw);mutants[name](card)
  expect(analyze(raw,card).contract.status).not.toBe('verified');expect(raw).toEqual(before)
 })
})
