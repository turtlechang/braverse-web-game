import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import { convertOfficialCardToExtraDeckCard, convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'
import type { OfficialCardRecord } from './types'
import type { CardEffect, ExtraDeckCard } from '../game/types'
it.each(['BS12-036', 'BS12-036@1'])('%s strictly rejects altered cost area/source/level/base-number exclusion', number => {
  const record = candidate.cards.find(c => c.cardNumber === number) as OfficialCardRecord
  const converted = convertOfficialCardToExtraDeckCard(record)
  if (converted.status !== 'converted') throw new Error('Missing printed EXTRA')
  const mutate = (change: (card: ExtraDeckCard) => void) => {
    const wrong = structuredClone(converted.extraDeckCard)
    change(wrong)
    expect(analyzeOfficialCardBehavior(record, wrong).contract.status).not.toBe('verified')
  }
  for (const field of ['excludeSource', 'keyword'] as const) mutate(c => {
    const effect = c.attackEffects![0]
    if (effect.kind === 'optional-cost-attack') delete effect.cost.cookieToBreakArea![field]
  })
  mutate(c => { const effect = c.attackEffects![0]; if (effect.kind === 'optional-cost-attack') effect.cost.cookieToBreakArea!.zones = ['hand'] })
  for (const field of ['exactLevel', 'keyword', 'excludeBreakPaymentCardNumber', 'optional'] as const) mutate(c => {
    const effect = c.attackEffects![0]
    if (effect.kind === 'optional-cost-attack' && effect.effects[0].kind === 'break-to-battle') delete effect.effects[0][field]
  })
})
it.each(['BS12-109', 'BS12-109@1', 'BS12-109@2'])('%s strictly requires face-up TOP, printed Special Play, required hand placement and any own Cookie', number => {
  const record = candidate.cards.find(c => c.cardNumber === number) as OfficialCardRecord
  const converted = convertOfficialCardToGameCard(record)
  if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie') throw new Error('Missing printed Cookie')
  const printedCookie = converted.gameCard
  const wrong = (change: (effect: Extract<CardEffect, { kind: 'hand-to-hp' }>) => void) => {
    const card = structuredClone(printedCookie), effect = card.attackEffects![0]
    if (effect.kind !== 'hand-to-hp') throw new Error('Missing placement')
    change(effect)
    expect(analyzeOfficialCardBehavior(record, card).contract.status).not.toBe('verified')
  }
  wrong(e => { e.hpPlacement = 'bottom' })
  wrong(e => { e.faceUp = false })
  wrong(e => { e.handHasSpecialPlay = false })
  wrong(e => { e.handPlacementRequired = false })
  wrong(e => { e.target.side = 'opponent' })
  wrong(e => { e.target.remainingHp = 1 })
  wrong(e => { e.target.max = 2 })
  wrong(e => { e.target.min = 1 })
  wrong(e => { e.condition = { kind: 'support-count-at-least', count: 3 } })
  wrong(e => { e.condition = { kind: 'opponent-support-count-at-least', count: 2 } })
})
