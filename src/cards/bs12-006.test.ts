import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'

it('BS12-006 preserves both printed costs before the optional damage effect', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-006') as OfficialCardRecord
  expect(convertOfficialCardToGameCard(source)).toMatchObject({ status: 'converted', gameCard: {
    level: 2, hp: 3, attack: 2, attackEnergyCost: { red: 1, neutral: 1 }, keywords: ['arena'],
    attackText: '<{R}{N}> Quality Stitching {da} 2',
    skill: { trigger: 'activate', oncePerTurn: true, restSource: false,
      cost: { energy: { red: 1 }, discardHand: 0, battleCookiePosition: { count: 1, position: 'active', keyword: 'arena' } },
      effects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }],
    },
  } })
})
