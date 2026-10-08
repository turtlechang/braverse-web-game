import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-038', 'BS12-038@1'])('%s preserves support origin, strict lower support count and rested top-deck placement', number => {
  const record = candidate.cards.find(c => c.cardNumber === number) as OfficialCardRecord
  const snapshot = structuredClone(record)
  const converted = convertOfficialCardToGameCard(record)
  expect(converted).toMatchObject({ status: 'converted', gameCard: {
    type: 'cookie', name: 'Greenbell Cookie', level: 1, hp: 2, energyColor: 'green', keywords: ['arena'], attack: 2, attackEnergyCost: { green: 1, neutral: 1 },
    skill: { trigger: 'on-play', fromSupportArea: true, oncePerTurn: false, yourTurn: false, restSource: false,
      cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'deck-to-support', amount: 1, rested: true, condition: { kind: 'support-count-less-than-opponent', difference: 1 } }],
    },
  } })
  if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie') throw new Error('038 missing')
  expect(converted.gameCard.attackText).toMatch(/Vento Marcato/)
  expect(converted.gameCard.attackText).not.toMatch(/Soda Splash/)
  expect(converted.gameCard.attackEffects).toBeUndefined()
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(snapshot)
})
