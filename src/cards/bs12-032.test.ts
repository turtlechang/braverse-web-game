import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-032', 'BS12-032@1'])('%s matches independently inspected Caramel Choux print', number => {
  const record = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
  const snapshot = structuredClone(record)
  const converted = convertOfficialCardToGameCard(record)
  expect(converted).toMatchObject({ status: 'converted', gameCard: { name: 'Caramel Choux Cookie', type: 'cookie', level: 1, hp: 2,
    energyColor: 'yellow', keywords: ['arena'], attack: 1, attackCost: 2, attackEnergyCost: { yellow: 1, neutral: 1 },
    skill: { trigger: 'break-by-arena-effect', yourTurn: true, oncePerTurn: false, restSource: false, cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'gain-hp', amount: 1, target: { side: 'self', min: 0, max: 1 } }] } } })
  expect(record).toEqual(snapshot)
  if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie') throw new Error('032 conversion missing')
  expect(converted.gameCard.attackText).toMatch(/Full of Energy/)
  expect(converted.gameCard.attackText).not.toMatch(/Espresso|Bean Scatter|濃縮咖啡/)
  expect(converted.gameCard.flip).toBeUndefined()
  expect(converted.gameCard.attackEffects ?? []).toEqual([])
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  const skill = converted.gameCard.skill!
  const hp = skill.effects[0]
  if (hp.kind !== 'gain-hp' || !hp.target) throw new Error('032 HP effect missing')
  const changes = [
    { ...skill, trigger: 'passive' as const }, { ...skill, trigger: 'departure' as const },
    { ...skill, yourTurn: false }, { ...skill, oncePerTurn: true }, { ...skill, restSource: true },
    { ...skill, faint: true }, { ...skill, afterDamage: true }, { ...skill, cost: { energy: { yellow: 1 } } },
    { ...skill, effects: [{ ...hp, amount: 2 }] }, { ...skill, effects: [] },
    ...[{ ...hp.target, min: 1 }, { ...hp.target, max: 2 }, { ...hp.target, side: 'opponent' as const },
      { ...hp.target, keyword: 'arena' as const }, { ...hp.target, sourceOnly: true }].map(target => ({ ...skill, effects: [{ ...hp, target }] })),
  ]
  for (const changed of changes) expect(analyzeOfficialCardBehavior(record, { ...converted.gameCard, skill: changed }).contract.status).not.toBe('verified')
})
