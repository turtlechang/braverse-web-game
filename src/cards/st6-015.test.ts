import {describe,expect,it} from 'vitest'
import document from '../../data/cards/official-st6-015.en.json'
import type {OfficialCardRecord} from './types'
import {analyzeOfficialCardBehavior} from './contracts'
import {createCard} from '../game/starter-deck'
const raw=document.cards.find(card => card.cardNumber === 'ST6-015') as OfficialCardRecord
// Original print: RR plus one own Cookie top HP; optional any own Cookie +2 this turn.
describe('ST6-015 printed unrestricted attack item',()=>{
 it('preserves printed identity, exact cost and optional target without Then',()=>{
  const card=createCard(raw,'player-one',1)
  expect([card.name,card.type,card.energyColor]).toEqual(["Fire Spirit Cookie's Staff",'item','red'])
  expect(card.item?.cost).toEqual({energy:{red:2},discardHand:0,hpToTrash:{amount:1}})
  expect(card.item?.effects).toEqual([{kind:'modify-attack',amount:2,duration:'this-turn',target:{side:'self',min:0,max:1}}])
  expect(card.skill).toBeUndefined();expect(card.flip).toBeUndefined()
 })
 it('has verified strict evidence for the executed item',()=>expect(analyzeOfficialCardBehavior(raw).contract.status).toBe('verified'))
 it.each(['missing-hp','two-hp','source-only-hp','red-hp-only','blue-cost','free','opponent','mandatory','two-targets','one-buff','three-buff','persistent','named-only','color-filter','level-filter','hp-filter','exclude-source','extra-damage'] as const)(
  'rejects executed mutation %s despite unchanged display effects',name=>{
   const card=createCard(raw,'player-one',1),ability=card.item
   if(!ability?.cost.hpToTrash)throw new Error('Missing printed HP cost')
   const cost=ability.cost,hp=cost.hpToTrash!,buff=ability.effects[0]
   if(buff?.kind!=='modify-attack'||!buff.target)throw new Error('Missing printed buff')
   const target=buff.target
   if(name==='missing-hp')delete cost.hpToTrash
   if(name==='two-hp')hp.amount=2
   if(name==='source-only-hp')hp.sourceOnly=true
   if(name==='red-hp-only')hp.energyColor='red'
   if(name==='blue-cost')cost.energy={blue:2}
   if(name==='free')cost.energy={}
   if(name==='opponent')target.side='opponent'
   if(name==='mandatory')target.min=1
   if(name==='two-targets')target.max=2
   if(name==='one-buff')buff.amount=1
   if(name==='three-buff')buff.amount=3
   if(name==='persistent')buff.duration='persistent'
   if(name==='named-only')target.cardName='Fire Spirit Cookie'
   if(name==='color-filter')target.energyColor='red'
   if(name==='level-filter')target.maxLevel=1
   if(name==='hp-filter')target.maxRemainingHp=2
   if(name==='exclude-source')target.excludeSource=true
   if(name==='extra-damage')ability.effects.push({kind:'damage-all',amount:1,side:'opponent'})
   expect(analyzeOfficialCardBehavior(raw,card).contract.status).not.toBe('verified')
  })
})
