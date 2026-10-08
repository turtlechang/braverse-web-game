import { describe, expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const record = candidate.cards.find(card => card.cardNumber === 'BS12-063') as OfficialCardRecord
const convert = () => {
  const result = convertOfficialCardToGameCard(record)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing CAKE POPs')
  return result.gameCard
}
describe('BS12-063 physical Group Practice contract', () => {
  it('preserves BB ordinary three and source-only conditional reduction of every damage type', () => {
    const before = structuredClone(record)
    const card = convert()
    expect(card).toMatchObject({ id: 'BS12-063', name: 'CAKE POPs', level: 2, hp: 2, energyColor: 'blue', cardColor: 'blue',
      attack: 3, attackCost: 2, attackEnergyCost: { blue: 2 }, keywords: ['arena'],
      imageUrl: 'https://cookierunbraverse.com/data/en_storage/lEO8CQpjWN2b68YGeobgoQ.webp',
      skill: { trigger: 'passive', oncePerTurn: false, yourTurn: false, restSource: false, effects: [{
        kind: 'modify-damage-received', amount: 0, duration: 'persistent', damageType: 'all', minimumDamage: 2, setDamageTo: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'battle-area-has-named-cookie', side: 'self', name: 'Popping Candy Cookie' },
      }] } })
    expect(card.skill?.effects).toHaveLength(1)
    expect(card.flip).toBeUndefined()
    expect(card.attackEffects ?? []).toEqual([])
    expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
    expect(record).toEqual(before)
  })
  it.each(['missing', 'attack-only', 'wrong-threshold', 'wrong-result', 'wrong-name', 'opponent', 'global', 'your-turn', 'once', 'rest', 'energy'] as const)(
    'rejects incomplete runtime evidence: %s', mutation => {
      const card = structuredClone(convert())
      if (!card.skill) throw new Error('Missing printed passive')
      const effect = card.skill.effects[0]
      if (effect.kind !== 'modify-damage-received') throw new Error('Missing printed reduction')
      if (mutation === 'missing') card.skill.effects = []
      if (mutation === 'attack-only') effect.damageType = 'attack'
      if (mutation === 'wrong-threshold') effect.minimumDamage = 3
      if (mutation === 'wrong-result') effect.setDamageTo = 0
      if (mutation === 'wrong-name') effect.condition = { kind: 'battle-area-has-named-cookie', side: 'self', name: 'Angel Cookie' }
      if (mutation === 'opponent') effect.condition = { kind: 'battle-area-has-named-cookie', side: 'opponent', name: 'Popping Candy Cookie' }
      if (mutation === 'global') effect.target = { side: 'self', min: 0, max: 2 }
      if (mutation === 'your-turn') card.skill.yourTurn = true
      if (mutation === 'once') card.skill.oncePerTurn = true
      if (mutation === 'rest') card.skill.restSource = true
      if (mutation === 'energy') card.skill.cost = { energy: { blue: 1 } }
      expect(analyzeOfficialCardBehavior(record, card).contract.status).not.toBe('verified')
    })
})
