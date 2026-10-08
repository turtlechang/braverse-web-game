import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('020 requires four Arena Cookies in own break, discards one hand card and can heal any zero to two own Cookies', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-020') as OfficialCardRecord
  const conversion = convertOfficialCardToGameCard(source)
  expect(conversion).toMatchObject({ status: 'converted', gameCard: { id: 'BS12-020', name: 'Strawberry Stick Cookie', energyColor: 'yellow',
    level: 3, hp: 3, attack: 3, attackCost: 3, attackEnergyCost: { yellow: 3 }, keywords: ['arena'],
    attackText: '<{Y}{Y}{Y}> School of Rock! {da} 3', flip: { cost: { energy: {}, discardHand: 1 }, effects: [
      { kind: 'gain-hp', amount: 1, target: { side: 'self', min: 0, max: 2 }, condition: { kind: 'break-area-card-count-at-least', side: 'self', count: 4, keyword: 'arena' } },
    ] } } })
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
})
