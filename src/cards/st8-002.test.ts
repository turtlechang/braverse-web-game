import {describe,it,expect} from 'vitest'
import {raw} from '../game/st8-002-demo'
import {createCard} from '../game/starter-deck'
import {analyzeOfficialCardBehavior} from './contracts'

describe('ST8-002 original Muscle Cookie printing',()=>{
 it('preserves green LV2 HP4 GGG normal three and original artwork',()=>{
  const c=createCard(raw,'player-one',1);if(c.type!=='cookie')throw Error('Cookie required')
  expect([c.name,c.energyColor,c.level,c.hp,c.attack,c.attackEnergyCost]).toEqual(['Muscle Cookie','green',2,4,3,{green:3}])
  expect(c.skill).toBeUndefined();expect(c.attackEffects??[]).toEqual([])
  expect(c.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/m2llFHQ66GHWulJg0H6iaA.webp')
  expect(c.flip?.cost).toEqual({energy:{},discardHand:0})
  expect(c.flip?.effects).toEqual([{kind:'flip-to-hand'}])
  expect(c.flip?.attachedHpBonus).toBeUndefined()
 })
 it('verifies all printed fragments',()=>{const a=analyzeOfficialCardBehavior(raw);expect(a.errors).toEqual([]);expect(a.contract.status).toBe('verified')})
})
