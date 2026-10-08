import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-037', 'BS12-037@1'])('%s preserves every-four Arena damage and separately paid Then target', number => {
  const record = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
  const snapshot = structuredClone(record)
  const converted = convertOfficialCardToGameCard(record)
  expect(converted).toMatchObject({ status: 'converted', gameCard: {
    type: 'cookie', name: 'Financier Cookie', level: 3, hp: 5, energyColor: 'yellow', keywords: ['arena'],
    attack: 3, attackEnergyCost: { yellow: 3 },
    skill: { trigger: 'activate', oncePerTurn: true, yourTurn: false, restSource: false,
      cost: { energy: { yellow: 1 }, discardHand: 0 },
      effects: [{ kind: 'damage-by-break-count', perCount: 1, groupSize: 4, keyword: 'arena', target: { side: 'opponent', min: 0, max: 1 } }],
    },
    attackEffects: [{ kind: 'optional-cost-attack', cost: { energy: { neutral: 1 } },
      effects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }],
    }],
  } })
  if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie') throw new Error('037 missing')
  expect(converted.gameCard.attackText).toMatch(/Ending Fairy/)
  expect(converted.gameCard.attackText).not.toMatch(/Vento Marcato/)
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(snapshot)
})
