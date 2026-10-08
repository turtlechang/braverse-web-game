import { describe, expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'

describe('BS12-005 independently transcribed card image', () => {
  it('preserves the effect activation history condition and optional friendly target', () => {
    const source = candidate.cards.find(card => card.cardNumber === 'BS12-005') as OfficialCardRecord
    const before = structuredClone(source)
    expect(convertOfficialCardToGameCard(source)).toMatchObject({
      status: 'converted',
      gameCard: {
        level: 2, hp: 4, attack: 3, attackEnergyCost: { red: 2, neutral: 1 }, keywords: ['arena'],
        attackText: '<{R}{R}{N}> Cheerleaders, go! {da} 3',
        skill: { trigger: 'activate', oncePerTurn: true, restSource: false,
          cost: { energy: {}, discardHand: 0 },
          effects: [{ kind: 'gain-hp', amount: 1, target: { side: 'self', min: 0, max: 1 },
            condition: { kind: 'source-set-active-by-effect-this-turn' } }],
        },
      },
    })
    expect(source).toEqual(before)
  })
})
