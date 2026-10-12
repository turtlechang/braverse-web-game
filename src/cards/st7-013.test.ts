import {getCardPoolEntry} from '../game/card-pool'
import {describe,expect,it} from 'vitest'
import {createCard} from '../game/starter-deck'
import type {GameCard} from '../game/types'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'
export const raw=getCardPoolEntry('ST7-013')
if(!raw)throw Error('Original ST7-013 required')
const original=()=>createCard(raw,'player-one',1)
const item=(card:GameCard)=>{if(!card.item)throw Error('Printed item ability required');return card.item}
const payment=(card:GameCard)=>{const cost=item(card).cost.trashCookieToBreakArea;if(!cost)throw Error('Printed trash cost required');return cost}
const damage=(card:GameCard)=>{const effect=item(card).effects[0];if(effect?.kind!=='damage')throw Error('Printed damage required');return effect}
const target=(card:GameCard)=>{const value=damage(card).target;if(!value)throw Error('Printed target required');return value}
const mutants:Record<string,(card:GameCard)=>void>={
 'wrong-name':c=>{c.name='Wrong Item'},'wrong-color':c=>{c.cardColor='red'},'wrong-energy-color':c=>{c.energyColor='red'},
 'free':c=>{item(c).cost.energy={}},'neutral-cost':c=>{item(c).cost.energy={neutral:2}},'one-energy':c=>{item(c).cost.energy={yellow:1}},
 'missing-trash-cost':c=>{delete item(c).cost.trashCookieToBreakArea},'wrong-count':c=>{payment(c).count=2},'any-color-cost':c=>{delete payment(c).energyColor},'red-cost':c=>{payment(c).energyColor='red'},
 'extra-level-cost':c=>{payment(c).minLevel=2},'extra-hp-cost':c=>{payment(c).hp=2},'extra-no-flip':c=>{payment(c).excludeFlip=true},'extra-hand-cost':c=>{item(c).cost.discardHand=1},
 'missing-effect':c=>{item(c).effects=[]},'extra-effect':c=>{item(c).effects.push({kind:'draw',amount:1})},'damage-one':c=>{damage(c).amount=1},'own-target':c=>{target(c).side='self'},
 'required-target':c=>{target(c).min=1},'two-targets':c=>{target(c).max=2},'extra-target-filter':c=>{target(c).energyColor='yellow'},'extra-condition':c=>{damage(c).condition={kind:'source-hp-at-most',amount:2}},
 'extra-keyword':c=>{c.keywords=['arena']},
}
describe('ST7-013 independent physical expectation and strict cost contract',()=>{
 it('retains the complete printed yellow item and unrestricted optional opponent damage',()=>{
  const c=original();expect([c.type,c.name,c.energyColor,c.cardColor??c.energyColor]).toEqual(['item','Miraculous Nutrient Ampoule','yellow','yellow'])
  expect(c.flip).toBeUndefined();expect(c.skill).toBeUndefined();expect(c.keywords??[]).toEqual([])
  expect(item(c).cost).toEqual({energy:{yellow:2},discardHand:0,trashCookieToBreakArea:{count:1,energyColor:'yellow'}})
  expect(item(c).effects).toEqual([{kind:'damage',amount:2,target:{side:'opponent',min:0,max:1}}])
 })
 it('verifies actual converted evidence against the original record',()=>{
  expect(analyze(raw).contract.status).toBe('verified');expect(analyze(raw,original()).contract.status).toBe('verified')
 })
 it.each(Object.keys(mutants))('rejects %s without changing the original source',name=>{
  const before=structuredClone(raw),card=original();mutants[name](card)
  expect(analyze(raw,card).contract.status).not.toBe('verified');expect(raw).toEqual(before)
 })
})
