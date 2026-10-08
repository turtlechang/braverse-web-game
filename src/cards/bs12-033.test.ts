import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-033', 'BS12-033@1'])('%s matches independently inspected Espresso print', number => {
  const record = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
  const snapshot = structuredClone(record)
  const converted = convertOfficialCardToGameCard(record)
  expect(converted).toMatchObject({ status: 'converted', gameCard: { name: 'Espresso Cookie', type: 'cookie', level: 1, hp: 2,
    energyColor: 'yellow', keywords: ['arena'], attack: 1, attackCost: 2, attackEnergyCost: { yellow: 1, neutral: 1 },
    skill: { trigger: 'break-by-arena-effect', yourTurn: true, oncePerTurn: false, restSource: false, cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'draw-up-to', max: 1 }] } } })
  expect(record).toEqual(snapshot)
  if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie') throw new Error('033 conversion missing')
  expect(converted.gameCard.attackText).toMatch(/Bean Scatter/)
  expect(converted.gameCard.attackText).not.toMatch(/Excellent Explosion|Then|Madeleine|瑪德蓮/)
  expect(converted.gameCard.attackEffects ?? []).toEqual([])
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  const skill = converted.gameCard.skill!
  const draw = skill.effects[0]
  if (draw.kind !== 'draw-up-to') throw new Error('033 draw missing')
  for (const changed of [
    { ...skill, trigger: 'passive' as const }, { ...skill, yourTurn: false }, { ...skill, oncePerTurn: true },
    { ...skill, restSource: true }, { ...skill, faint: true }, { ...skill, cost: { energy: { yellow: 1 } } },
    { ...skill, effects: [{ ...draw, max: 2 }] }, { ...skill, effects: [{ kind: 'draw' as const, amount: 1 }] },
  ]) expect(analyzeOfficialCardBehavior(record, { ...converted.gameCard, skill: changed }).contract.status).not.toBe('verified')
})
