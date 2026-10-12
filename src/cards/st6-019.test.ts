import {describe,it,expect} from 'vitest'
import document from '../../data/cards/official-st6-019.en.json'
import type {OfficialCardRecord} from './types'
const raw=document.cards.find(c=>c.cardNumber==='ST6-019') as OfficialCardRecord
import {createCard} from '../game/starter-deck'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'
describe('ST6-019 independent original Then binding',()=>{
 it('has exact unconditional R reduction followed by own exact-one-HP optional draw',()=>{
  const c=createCard(raw,'player-one',1)
  expect([c.name,c.type,c.energyColor]).toEqual(['Power Unleashed','trap','red'])
  expect(c.trap?.cost).toEqual({energy:{red:1},discardHand:0});expect(c.trap?.condition).toBeUndefined()
  expect(c.trap?.effects).toEqual([{kind:'modify-attack',amount:-1,duration:'this-turn',target:{side:'opponent',min:0,max:1}},{kind:'draw-up-to',max:1,condition:{kind:'battle-area-remaining-hp-count-at-least',side:'self',remainingHp:1,count:1}}])
  expect(analyze(raw).contract.status).toBe('verified')
 })
 it.each(['free','two-red','wrong-color','discard','hp-cost','activation-gate','self','mandatory','two-targets','name','level','color','amount','duration','missing-draw','mandatory-draw','draw-two','no-condition','opponent-witness','two-hp','two-witnesses','until-hand','reverse-order','extra-effect'] as const)('rejects %s executed mutation',name=>{
  const c=createCard(raw,'player-one',1),t=c.trap,e=t?.effects[0],d=t?.effects[1]
  if(!t||e?.kind!=='modify-attack'||d?.kind!=='draw-up-to'||d.condition?.kind!=='battle-area-remaining-hp-count-at-least')throw Error('Missing base/Then')
  const condition=d.condition
  if(name==='free')t.cost.energy={}
  if(name==='two-red')t.cost.energy={red:2}
  if(name==='wrong-color')t.cost.energy={blue:1}
  if(name==='discard')t.cost.discardHand=1
  if(name==='hp-cost')t.cost.hpToTrash={amount:1}
  if(name==='activation-gate')t.condition={kind:'break-level-at-least',level:1}
  if(name==='self')e.target.side='self'
  if(name==='mandatory')e.target.min=1
  if(name==='two-targets')e.target.max=2
  if(name==='name')e.target.cardName='Fire Spirit Cookie'
  if(name==='level')e.target.maxLevel=1
  if(name==='color')e.target.energyColor='red'
  if(name==='amount')e.amount=-2
  if(name==='duration')e.duration='opponent-next-turn'
  if(name==='missing-draw')t.effects=[e]
  if(name==='mandatory-draw')t.effects[1]={kind:'draw',amount:1,condition}
  if(name==='draw-two')d.max=2
  if(name==='no-condition')d.condition=undefined
  if(name==='opponent-witness')condition.side='opponent'
  if(name==='two-hp')condition.remainingHp=2
  if(name==='two-witnesses')condition.count=2
  if(name==='until-hand')d.untilHandSize=5
  if(name==='reverse-order')t.effects.reverse()
  if(name==='extra-effect')t.effects.push({kind:'damage-all',side:'opponent',amount:1})
  expect(analyze(raw,c).contract.status).not.toBe('verified')
 })
})
