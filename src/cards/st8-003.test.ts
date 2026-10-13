import {describe,it,expect} from 'vitest'
import {raw} from '../game/st8-003-demo'
import {createCard} from '../game/starter-deck'
import {analyzeOfficialCardBehavior} from './contracts'
describe('ST8-003 original Leek Cookie printing',()=>{
 it('is green LV2 HP4 with NNN ordinary three and no other abilities',()=>{
  const c=createCard(raw,'player-one',1);if(c.type!=='cookie')throw Error('Cookie required')
  expect([c.name,c.energyColor,c.level,c.hp,c.attack,c.attackEnergyCost]).toEqual(['Leek Cookie','green',2,4,3,{neutral:3}])
  expect(c.skill).toBeUndefined();expect(c.flip).toBeUndefined();expect(c.attackEffects??[]).toEqual([]);expect(c.effects??[]).toEqual([])
  expect(c.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/wSVfDj970WU8E8qFbU-eTQ.webp')
 })
 it('has a verified contract',()=>{const a=analyzeOfficialCardBehavior(raw);expect(a.errors).toEqual([]);expect(a.contract.status).toBe('verified')})
})
