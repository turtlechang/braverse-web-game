import {describe,it,expect} from 'vitest'
import document from '../../data/cards/official-st6-017.en.json'
import type {OfficialCardRecord} from './types'
const raw=document.cards.find(card=>card.cardNumber==='ST6-017') as OfficialCardRecord
import {createCard} from '../game/starter-deck'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'
describe('ST6-017 strict executed trap original binding',()=>{
 it('verifies the complete original base and Then',()=>expect(analyze(raw).contract.status).toBe('verified'))
 it.each(['free','one-red','wrong-color','discard','extra-hp','activation-gate','self','mandatory','two-targets','name-filter','level-filter','base-one','long-base','missing-then','extra-then','unconditional-then','opponent-witness','two-hp','two-witnesses','other-target','then-two','long-then','extra-root'] as const)('rejects runtime mutation %s',name=>{
  const c=createCard(raw,'player-one',1),trap=c.trap
  if(!trap)throw Error('Missing trap')
  const e=trap.effects[0]
  if(e?.kind!=='modify-attack')throw Error('Missing base')
  const follow=e.thenEffects?.[0]
  if(e?.kind!=='modify-attack'||follow?.kind!=='modify-attack'||follow.condition?.kind!=='battle-area-remaining-hp-count-at-least')throw Error('Missing base/Then')
  const condition=follow.condition
  if(name==='free')trap.cost.energy={}
  if(name==='one-red')trap.cost.energy={red:1}
  if(name==='wrong-color')trap.cost.energy={blue:2}
  if(name==='discard')trap.cost.discardHand=1
  if(name==='extra-hp')trap.cost.hpToTrash={amount:1}
  if(name==='activation-gate')trap.condition={kind:'break-level-at-least',level:1}
  if(name==='self')e.target.side='self'
  if(name==='mandatory')e.target.min=1
  if(name==='two-targets')e.target.max=2
  if(name==='name-filter')e.target.cardName='Fire Spirit Cookie'
  if(name==='level-filter')e.target.maxLevel=1
  if(name==='base-one')e.amount=-1
  if(name==='long-base')e.duration='opponent-next-turn'
  if(name==='missing-then')e.thenEffects=[]
  if(name==='extra-then')e.thenEffects?.push(structuredClone(follow))
  if(name==='unconditional-then')follow.condition=undefined
  if(name==='opponent-witness')condition.side='opponent'
  if(name==='two-hp')condition.remainingHp=2
  if(name==='two-witnesses')condition.count=2
  if(name==='other-target')follow.target.previousEffectTargetOnly=undefined
  if(name==='then-two')follow.amount=-2
  if(name==='long-then')follow.duration='opponent-next-turn'
  if(name==='extra-root')trap.effects.push({kind:'damage-all',side:'opponent',amount:1})
  expect(analyze(raw,c).contract.status).not.toBe('verified')
 })
})
