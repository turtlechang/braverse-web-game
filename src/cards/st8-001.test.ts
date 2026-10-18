import {describe,it,expect} from 'vitest'
import {raw} from '../game/st8-001-demo'
import {createCard} from '../game/starter-deck'
import {analyzeOfficialCardBehavior} from './contracts'
describe('ST8-001 original Greenbell Cookie printing',()=>{
 it('is green LV1 HP2 with N ordinary1 and no other abilities',()=>{
  const c=createCard(raw,'player-one',1)
  if(c.type!=='cookie')throw Error('Original Cookie required')
  expect([c.name,c.cardColor??c.energyColor,c.energyColor,c.level,c.hp,c.attack,c.attackCost]).toEqual(['Greenbell Cookie','green','green',1,2,1,1])
  expect(c.attackEnergyCost).toEqual({neutral:1})
  expect(c.skill).toBeUndefined();expect(c.flip).toBeUndefined()
  expect(c.effects??[]).toEqual([]);expect(c.attackEffects??[]).toEqual([]);expect(c.keywords??[]).toEqual([])
  expect(c.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/9B1HiWPlaT4EJGpu1pfaWg.webp')
 })
 it('has a complete no-effect contract without inventing abilities',()=>{
  expect(analyzeOfficialCardBehavior(raw).contract.status).toBe('verified')
 })
})
