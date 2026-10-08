import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-035', 'BS12-035@1'])('%s preserves On Play and R002 independently selectable opponent Then', number => {
  const record = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
  const snapshot = structuredClone(record)
  const converted = convertOfficialCardToGameCard(record)
  expect(converted).toMatchObject({ status: 'converted', gameCard: {
    name: 'Kouign-Amann Cookie', type: 'cookie', level: 1, hp: 2, energyColor: 'yellow', keywords: ['arena'],
    attack: 1, attackCost: 1, attackEnergyCost: { yellow: 1 },
    skill: { trigger: 'on-play', yourTurn: true, oncePerTurn: false, restSource: false,
      cost: { energy: { yellow: 1 }, handToBreakArea: { count: 1, keyword: 'arena' } },
      effects: [{ kind: 'damage', amount: 2, target: { side: 'opponent', min: 0, max: 1 } }],
    },
  } })
  if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie') throw new Error('035 conversion missing')
  expect(converted.gameCard.attackText).toMatch(/Shy Ending/)
  expect(converted.gameCard.attackText).toMatch(/deals 1 damage/)
  expect(converted.gameCard.attackText).not.toMatch(/Genius Idol/)
  expect(converted.gameCard.attackEffects).toEqual([{ kind: 'damage', amount: 1,
    target: { side: 'opponent', min: 0, max: 1 },
    condition: { kind: 'break-area-card-count-at-least', side: 'self', count: 4, keyword: 'arena' } }])
  const audit = analyzeOfficialCardBehavior(record)
  expect(audit.contract.status).toBe('verified')
  expect(audit.contract.blockers).toEqual([])
  expect(record).toEqual(snapshot)
})
