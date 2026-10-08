import { describe, expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

describe.each(['BS12-021', 'BS12-021@1'])('%s independent Mango card face', number => {
  it('preserves printed name, stats, YY attack and own-turn source-only On Play history condition', () => {
    const source = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
    const snapshot = structuredClone(source)
    const result = convertOfficialCardToGameCard(source)
    expect(result).toMatchObject({ status: 'converted', gameCard: { id: 'BS12-021', name: 'Mango Cookie', energyColor: 'yellow',
      level: 2, hp: 2, keywords: ['arena'], attack: 3, attackCost: 2, attackEnergyCost: { yellow: 2 },
      attackText: '<{Y}{Y}> Getting in the Groove {da} 3', imageUrl: source.imageUrl,
      skill: { trigger: 'on-play', yourTurn: true, restSource: false, cost: { energy: {} }, effects: [
        { kind: 'gain-hp', amount: 1, target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          condition: { kind: 'arena-cookie-placed-in-break-this-turn' } },
      ] } } })
    if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Mango Cookie')
    expect(result.gameCard.flip).toBeUndefined()
    expect(result.gameCard.attackEffects ?? []).toEqual([])
    expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
    expect(source).toEqual(snapshot)
  })
})
