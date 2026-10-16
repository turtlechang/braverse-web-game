import {describe,it,expect} from 'vitest'
import candidate from '../../../data/candidates/st6-st10/official-st8.en.json'
import type {OfficialCardRecord} from '../types'
import {getCardPoolEntry} from '../../game/card-pool'
import {convertOfficialCardToGameCard} from '../official-card-adapter'
import {analyzeOfficialCardBehavior} from './ledger'

const raw=getCardPoolEntry('ST8-010')??(candidate.cards as OfficialCardRecord[]).find(card=>card.cardNumber==='ST8-010')
if(!raw)throw Error('Original ST8-010 required')
// Parser/cost-binding isolation: the alias deliberately bypasses the precise
// ST8-010 guard. It is not a physical-card or Browser acceptance fixture.
const alias={...raw,cardNumber:'TEST-SUPPORT-ITEM-COST',baseCardNumber:'TEST-SUPPORT-ITEM-COST'}
const runtime=()=>{
 const conversion=convertOfficialCardToGameCard(raw)
 if(conversion.status!=='converted'||conversion.gameCard.type!=='cookie'||!conversion.gameCard.skill)
  throw Error('Cookiemals faint skill required')
 return {card:conversion.gameCard,skill:conversion.gameCard.skill}
}
describe('printed support Item cost binding independent of card-specific guards',()=>{
 it('classifies exact Item count and binds the correct existing cost',()=>{
  const {card}=runtime(),audit=analyzeOfficialCardBehavior(alias,card)
  expect(audit.contract.costs.find(cost=>cost.kind==='support-to-hand')?.runtime)
   .toEqual({supportToHand:1,supportToHandType:'item'})
  expect(audit.checks.costCovered).toBe(true)
 })
 it.each(['any-support','cookie','two-items'] as const)('does not accept %s as evidence for one Item',mutant=>{
  const {card,skill}=runtime()
  if(mutant==='any-support')delete skill.cost.supportToHandType
  if(mutant==='cookie')skill.cost.supportToHandType='cookie'
  if(mutant==='two-items')skill.cost.supportToHand=2
  expect(analyzeOfficialCardBehavior(alias,card).checks.costCovered).toBe(false)
 })
})
