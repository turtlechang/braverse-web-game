import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('040 preserves Cookie-only support return cost and optional rested hand Arena of any type', () => {
  const source = candidate.cards.find(c => c.cardNumber === 'BS12-040') as OfficialCardRecord
  const before = structuredClone(source)
  const result = convertOfficialCardToGameCard(source)
  expect(result).toMatchObject({ status: 'converted', gameCard: {
    type: 'cookie', name: 'Baguette Cookie', level: 2, hp: 3, energyColor: 'green', keywords: ['arena'],
    attack: 3, attackEnergyCost: { green: 2, neutral: 1 },
    skill: { trigger: 'activate', oncePerTurn: true, yourTurn: false, restSource: false,
      cost: { energy: {}, discardHand: 0, supportToHand: 1, supportToHandType: 'cookie' },
      effects: [{ kind: 'hand-to-support', amount: 1, keyword: 'arena', rested: true, optional: true }],
    },
  } })
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('040 missing')
  expect(result.gameCard.attackText).toBe('<{G}{G}{N}> Troubleshooting {da} 3')
  expect(result.gameCard.attackEffects).toBeUndefined()
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  expect(source).toEqual(before)
})
