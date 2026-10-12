import {describe,it,expect} from 'vitest'
import document from '../../data/cards/official-st6-018.en.json'
import type {OfficialCardRecord} from './types'
import {createCard} from '../game/starter-deck'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'
export const raw=document.cards.find(c=>c.cardNumber==='ST6-018') as OfficialCardRecord

describe('ST6-018 independent printed trap binding',()=>{
 it('has R and optional incoming attack reduction only',()=>{
  const card=createCard(raw,'player-one',1)
  expect([card.name,card.type,card.energyColor]).toEqual(['Frozen Flame','trap','red'])
  expect(card.trap?.cost).toEqual({energy:{red:1},discardHand:0})
  expect(card.trap?.condition).toBeUndefined()
  expect(card.trap?.effects).toEqual([{kind:'modify-damage-received',amount:-1,duration:'this-turn',damageType:'attack',target:{side:'self',min:0,max:1}}])
  expect(analyze(raw).contract.status).toBe('verified')
 })
 it.each(['free','two-red','wrong-color','discard','hp-cost','condition','opponent','mandatory','two-targets','name','level','color','hp','amount','duration','effect-damage','all-damage','fixed-zero','minimum','then','extra-effect'] as const)('rejects %s executed mutation',name=>{
  const c=createCard(raw,'player-one',1),t=c.trap,e=t?.effects[0]
  if(!t||e?.kind!=='modify-damage-received')throw Error('Missing incoming trap')
  if(name==='free')t.cost.energy={}
  if(name==='two-red')t.cost.energy={red:2}
  if(name==='wrong-color')t.cost.energy={blue:1}
  if(name==='discard')t.cost.discardHand=1
  if(name==='hp-cost')t.cost.hpToTrash={amount:1}
  if(name==='condition')t.condition={kind:'break-level-at-least',level:1}
  if(name==='opponent')e.target.side='opponent'
  if(name==='mandatory')e.target.min=1
  if(name==='two-targets')e.target.max=2
  if(name==='name')e.target.cardName='Fire Spirit Cookie'
  if(name==='level')e.target.maxLevel=1
  if(name==='color')e.target.energyColor='red'
  if(name==='hp')e.target.maxRemainingHp=1
  if(name==='amount')e.amount=-2
  if(name==='duration')e.duration='opponent-next-turn'
  if(name==='effect-damage')e.damageType='effect'
  if(name==='all-damage')e.damageType='all'
  if(name==='fixed-zero')e.setDamageTo=0
  if(name==='minimum')e.minimumDamage=1
  if(name==='then')Object.assign(e,{thenEffects:[{kind:'draw',amount:1}]})
  if(name==='extra-effect')t.effects.push({kind:'damage-all',side:'opponent',amount:1})
  expect(analyze(raw,c).contract.status).not.toBe('verified')
 })
})
