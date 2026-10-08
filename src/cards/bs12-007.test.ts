import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('BS12-007 preserves 1R, mandatory named Equip and its equipped attack FLIP lock', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-007') as OfficialCardRecord
  expect(convertOfficialCardToGameCard(source)).toMatchObject({ status: 'converted', gameCard: {
    level: 1, hp: 3, attack: 1, attackEnergyCost: { red: 1, neutral: 1 }, keywords: ['arena'],
    attackText: '<{R}{N}> Video Casting {da} 1',
    skill: { trigger: 'activate', oncePerTurn: true, restSource: false,
      cost: { energy: { red: 1 }, discardHand: 0 }, equippedAttackDisablesFlip: true,
      effects: [{ kind: 'equip-source', sourceZone: 'battle', battleSourceDisposition: { hp: 'trash', replacement: 'none' }, target: { side: 'self', min: 1, max: 1, cardName: 'Shining Glitter Cookie' } }],
    },
  } })
})

it('attests the supplied HP/no-replacement ruling, and detects a lost equipped attack lock', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-007') as OfficialCardRecord
  const converted = convertOfficialCardToGameCard(source)
  if (converted.status !== 'converted' || !converted.gameCard.skill) throw new Error('BS12-007 skill missing')
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  const incomplete = { ...converted.gameCard, skill: { ...converted.gameCard.skill, equippedAttackDisablesFlip: undefined } }
  expect(analyzeOfficialCardBehavior(source, incomplete).contract.blockers).toContain('equipped battle FLIP prevention has no runtime evidence')
  const missingDisposition = { ...converted.gameCard, skill: { ...converted.gameCard.skill,
    effects: converted.gameCard.skill.effects.map(effect => effect.kind === 'equip-source' ? { ...effect, battleSourceDisposition: undefined } : effect),
  } }
  expect(analyzeOfficialCardBehavior(source, missingDisposition).contract.blockers).toContain('Cookie Equip HP and replacement ruling is unconfirmed')
})
