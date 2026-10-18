import {describe,it,expect} from 'vitest'
import document from '../../data/cards/official-st6-016.en.json'
import type {OfficialCardRecord} from './types'
const raw=document.cards.find(card=>card.cardNumber==='ST6-016') as OfficialCardRecord
import {createCard} from '../game/starter-deck'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'
describe('ST6-016 strict executed item binding',()=>{
 it('verifies printed original payment, cost, ordered amounts and optional opponent targets',()=>expect(analyze(raw).contract.status).toBe('verified'))
 it.each(['free','two-energy','wrong-energy','no-discard','two-discard','cookie-discard-only','extra-hp-cost','self','mandatory','one-target','three-targets','name-filter','level-filter','hp-filter','color-filter','first-one','second-two','extra-damage'] as const)('rejects unchanged-source runtime mutation %s',name=>{
  const c=createCard(raw,'player-one',1),item=c.item
  if(!item)throw Error('Missing item')
  const effect=item.effects[0]
  if(effect?.kind!=='split-damage')throw Error('Missing split damage')
  if(name==='free')item.cost.energy={}
  if(name==='two-energy')item.cost.energy={red:2}
  if(name==='wrong-energy')item.cost.energy={blue:3}
  if(name==='no-discard')item.cost.discardHand=0
  if(name==='two-discard')item.cost.discardHand=2
  if(name==='cookie-discard-only')item.cost.discardHandType='cookie'
  if(name==='extra-hp-cost')item.cost.hpToTrash={amount:1}
  if(name==='self')effect.target.side='self'
  if(name==='mandatory')effect.target.min=1
  if(name==='one-target')effect.target.max=1
  if(name==='three-targets')effect.target.max=3
  if(name==='name-filter')effect.target.cardName='Fire Spirit Cookie'
  if(name==='level-filter')effect.target.maxLevel=1
  if(name==='hp-filter')effect.target.maxRemainingHp=2
  if(name==='color-filter')effect.target.energyColor='red'
  if(name==='first-one')effect.primaryAmount=1
  if(name==='second-two')effect.secondaryAmount=2
  if(name==='extra-damage')item.effects.push({kind:'damage-all',side:'opponent',amount:1})
  expect(analyze(raw,c).contract.status).not.toBe('verified')
 })
})
