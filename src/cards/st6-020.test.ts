import {describe,it,expect} from 'vitest'
import document from '../../data/cards/official-st6-020.en.json'
import type {OfficialCardRecord} from './types'
const raw=document.cards.find(c=>c.cardNumber==='ST6-020') as OfficialCardRecord
import {createCard} from '../game/starter-deck'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'
describe('ST6-020 original Stage placement/Activate binding',()=>{
 it('preserves RR placement, REST plus unrestricted own HP, optional draw',()=>{
  const c=createCard(raw,'player-one',1)
  expect([c.name,c.type,c.energyColor]).toEqual(['Into the Depths','stage','red'])
  expect(c.stageAbility?.placementCost).toEqual({red:2})
  expect(c.stageAbility?.cost).toEqual({energy:{},discardHand:0,hpToTrash:{amount:1}})
  expect(c.stageAbility?.restSource).toBe(true)
  expect(c.stageAbility?.oncePerTurn).toBeUndefined()
  expect(c.stageAbility?.effects).toEqual([{kind:'draw-up-to',max:1}])
  expect(analyze(raw).contract.status).toBe('verified')
 })
 it.each(['free-place','one-red','wrong-place','activate-energy','discard','no-hp','two-hp','red-only','level','named','source-only','exclude-source','no-rest','once','triggered','end-phase','opponent-stage','missing-draw','mandatory-draw','draw-two','draw-condition','extra-effect'] as const)('rejects executed %s mutation',name=>{
  const c=createCard(raw,'player-one',1),a=c.stageAbility,d=a?.effects[0]
  if(!a||d?.kind!=='draw-up-to'||!a.cost.hpToTrash)throw Error('Missing original Stage ability')
  if(name==='free-place')a.placementCost={}
  if(name==='one-red')a.placementCost={red:1}
  if(name==='wrong-place')a.placementCost={blue:2}
  if(name==='activate-energy')a.cost.energy={red:1}
  if(name==='discard')a.cost.discardHand=1
  if(name==='two-hp')a.cost.hpToTrash.amount=2
  if(name==='red-only')a.cost.hpToTrash.energyColor='red'
  if(name==='level')a.cost.hpToTrash.minLevel=2
  if(name==='named')Object.assign(a.cost.hpToTrash,{cardName:'Fire Spirit Cookie'})
  if(name==='source-only')a.cost.hpToTrash.sourceOnly=true
  if(name==='exclude-source')a.cost.hpToTrash.excludeSource=true
  if(name==='no-hp')a.cost.hpToTrash=undefined
  if(name==='no-rest')a.restSource=false
  if(name==='once')a.oncePerTurn=true
  if(name==='triggered')a.triggered=true
  if(name==='end-phase')a.endPhase=true
  if(name==='opponent-stage')a.ownerIndependent=true
  if(name==='missing-draw')a.effects=[]
  if(name==='mandatory-draw')a.effects=[{kind:'draw',amount:1}]
  if(name==='draw-two')d.max=2
  if(name==='draw-condition')d.condition={kind:'hand-count-at-most',count:5}
  if(name==='extra-effect')a.effects.push({kind:'damage-all',side:'opponent',amount:1})
  expect(analyze(raw,c).contract.status).not.toBe('verified')
 })
})
