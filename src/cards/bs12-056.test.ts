import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToExtraDeckCard, convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

// Both complete printed images: Serenade for Everyone, EXTRA (not Awaken), NN / 2.
it.each(['BS12-056', 'BS12-056@1'])('%s keeps the same-Cookie name AND Arena requirement OR seven green supports, and second-player paid ready', number => {
  const record = candidate.cards.find(c => c.cardNumber === number) as OfficialCardRecord
  const conversion = convertOfficialCardToExtraDeckCard(record)
  expect(convertOfficialCardToGameCard(record).status).toBe('unsupported')
  expect(conversion).toMatchObject({ status: 'converted', extraDeckCard: {
    type: 'extra', name: 'Apple Faerie Cookie', energyColor: 'green', keywords: ['arena'], level: 2, hp: 3, attack: 2,
    attackEnergyCost: { neutral: 2 }, imageUrl: record.imageUrl, extraDeckPlayMode: 'enter-battle',
    playRequirement: { kind: 'any-of', conditions: [
      { kind: 'battle-area-has-named-cookie', side: 'self', name: 'Candy Apple Cookie', keyword: 'arena' },
      { kind: 'support-color-count-at-least', color: 'green', count: 7 },
    ] },
    attackEffects: [{ kind: 'optional-cost-attack', cost: { energy: {}, discardHand: 1 },
      effects: [{ kind: 'set-active', supportCount: 1, selectable: true, optional: true, restedOnly: false, condition: { kind: 'player-started-second' } }],
    }],
  } })
  if (conversion.status !== 'converted') throw new Error('Missing EXTRA conversion')
  const card = conversion.extraDeckCard
  expect(card.awakenRequirement).toBeUndefined()
  expect(card.awakenHpBonus).toBeUndefined()
  expect(card.extraDeckPlayCost).toBeUndefined()
  expect(card.skill).toBeUndefined()
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
})
