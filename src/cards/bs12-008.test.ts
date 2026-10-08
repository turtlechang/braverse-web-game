import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-008', 'BS12-008@1'])('%s preserves the independently read red Arena threshold, self-trash cost and optional ready target', number => {
  const source = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
  expect(convertOfficialCardToGameCard(source)).toMatchObject({ status: 'converted', gameCard: {
    level: 1, hp: 3, attack: 1, attackEnergyCost: { red: 1, neutral: 1 }, keywords: ['arena'],
    skill: { trigger: 'activate', oncePerTurn: false, restSource: false,
      cost: { energy: {}, discardHand: 0, selfToTrash: true },
      effects: [{ kind: 'set-cookie-active', target: { side: 'self', min: 0, max: 1 },
        condition: { kind: 'support-count-at-least', count: 4, energyColor: 'red', keyword: 'arena' } }],
    },
  } })
})

it('strict contract rejects losing either part of the combined support condition', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-008') as OfficialCardRecord
  const converted = convertOfficialCardToGameCard(source)
  if (converted.status !== 'converted' || !converted.gameCard.skill) throw new Error('008 skill missing')
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  for (const lost of ['keyword', 'energyColor', 'count'] as const) {
    const incomplete = { ...converted.gameCard, skill: { ...converted.gameCard.skill,
      effects: converted.gameCard.skill.effects.map(effect => {
        if (!('condition' in effect) || effect.condition?.kind !== 'support-count-at-least') return effect
        return { ...effect, condition: { ...effect.condition, [lost]: lost === 'count' ? 3 : undefined } }
      }),
    } }
    expect(analyzeOfficialCardBehavior(source, incomplete).contract.blockers).toContain('red Arena support threshold has no complete runtime evidence')
  }
})
