import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToExtraDeckCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-036', 'BS12-036@1'])('%s converts EXTRA, second-player On Play and R003 Break revival', number => {
  const record = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
  const snapshot = structuredClone(record)
  const converted = convertOfficialCardToExtraDeckCard(record)
  expect(converted).toMatchObject({ status: 'converted', extraDeckCard: {
    type: 'extra', name: 'Clotted Cream Cookie', level: 2, hp: 4, energyColor: 'yellow', keywords: ['arena'],
    attack: 3, attackEnergyCost: { yellow: 3 }, extraDeckPlayMode: 'enter-battle',
    playRequirement: { kind: 'break-area-card-count-at-least', side: 'self', count: 4, keyword: 'arena', color: 'yellow' },
    skill: { trigger: 'on-play', oncePerTurn: false, yourTurn: false, restSource: false, cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'gain-hp', amount: 2, target: { side: 'self', min: 1, max: 1, sourceOnly: true }, condition: { kind: 'player-started-second' } }],
    },
  } })
  if (converted.status !== 'converted') throw new Error('036 EXTRA missing')
  expect(converted.extraDeckCard.attackText).toMatch(/aka\. Genius Idol/)
  expect(converted.extraDeckCard.attackText).not.toMatch(/Ending Fairy/)
  expect(converted.extraDeckCard.attackEffects).toEqual([{ kind: 'optional-cost-attack', cost: { energy: {}, cookieToBreakArea: { count: 1, zones: ['battle'], keyword: 'arena', excludeSource: true } }, payBeforeCondition: true, effectText: converted.extraDeckCard.attackText,
    effects: [{ kind: 'break-to-battle', amount: 1, optional: true, exactLevel: 1, keyword: 'arena', excludeBreakPaymentCardNumber: true }] }])
  expect(converted.extraDeckCard.extraDeckPlayCost).toBeUndefined()
  const audit = analyzeOfficialCardBehavior(record)
  expect(audit.contract.status).toBe('verified')
  expect(audit.contract.blockers).toEqual([])
  expect(record).toEqual(snapshot)
})
