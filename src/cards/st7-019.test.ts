import {describe,expect,it} from 'vitest'
import document from '../../data/candidates/st6-st10/official-st7.en.json'
import {getCardPoolEntry} from '../game/card-pool'
import {createCard} from '../game/starter-deck'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'
import type {OfficialCardRecord} from './types'
import type {GameCard} from '../game/types'
const raw=(getCardPoolEntry('ST7-019')??document.cards.find(c=>c.cardNumber==='ST7-019')) as OfficialCardRecord
const original=()=>createCard(raw,'player-one',1)
const trap=(c:GameCard)=>{if(!c.trap)throw Error('Original Trap');return c.trap}
const payment=(c:GameCard)=>{const p=trap(c).cost.handToBreakArea;if(!p)throw Error('Original mandatory Cookie cost');return p}
const damage=(c:GameCard)=>{const e=trap(c).effects[0];if(e?.kind!=='damage')throw Error('Original effect damage');return e}
const mutants:Record<string,(c:GameCard)=>void>={
 free:c=>{trap(c).cost.energy={}},wrongColor:c=>{trap(c).cost.energy={red:1}},twoEnergy:c=>{trap(c).cost.energy={yellow:2}},discardInstead:c=>{delete trap(c).cost.handToBreakArea;trap(c).cost.discardHand=1},noCookieCost:c=>{delete trap(c).cost.handToBreakArea},twoCookies:c=>{payment(c).count=2},yellowOnly:c=>{payment(c).energyColor='yellow'},arenaOnly:c=>{payment(c).keyword='arena'},levelOnly:c=>{payment(c).maxLevel=1},extraDiscard:c=>{trap(c).cost.discardHand=1},condition:c=>{trap(c).condition={kind:'break-level-at-least',level:4}},
 mandatoryTarget:c=>{damage(c).target.min=1},ownTarget:c=>{damage(c).target.side='self'},twoTargets:c=>{damage(c).target.max=2},attackTargetOnly:c=>{damage(c).target.attackTargetOnly=true},targetLevel:c=>{damage(c).target.maxLevel=2},targetColor:c=>{damage(c).target.energyColor='yellow'},doubleDamage:c=>{damage(c).amount=2},extraEffect:c=>{trap(c).effects.push({kind:'draw',amount:1})},wrongIdentity:c=>{c.name='Vined Cavern'},
}
describe('ST7-019 original printed binding',()=>{
 it('requires Y and exactly one unrestricted hand Cookie to own Break before optional opponent effect damage1',()=>{
  const c=original();expect([c.type,c.name,c.energyColor,c.cardColor??c.energyColor]).toEqual(['trap',"Millennial Jade Deer's Wrath",'yellow','yellow'])
  expect(c.flip).toBeUndefined();expect(c.keywords??[]).toEqual([])
  expect(trap(c).cost).toEqual({energy:{yellow:1},discardHand:0,handToBreakArea:{count:1}})
  expect(trap(c).condition).toBeUndefined();expect(trap(c).effects).toEqual([{kind:'damage',amount:1,target:{side:'opponent',min:0,max:1}}])
 })
 it('verifies original runtime',()=>expect(analyze(raw,original()).contract.status).toBe('verified'))
 it.each(Object.keys(mutants))('rejects %s without changing original source',name=>{const c=original(),before=structuredClone(raw);mutants[name](c);expect(analyze(raw,c).contract.status).not.toBe('verified');expect(raw).toEqual(before)})
})
