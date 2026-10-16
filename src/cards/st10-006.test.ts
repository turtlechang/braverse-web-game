import { describe, expect, it } from 'vitest'
import candidateDocument from '../../data/candidates/st6-st10/official-st10.en.json'
import { getCardPoolEntry } from '../game/card-pool'
import type { CookieCard } from '../game/types'
import { analyzeOfficialCardBehavior } from './contracts/ledger'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'

const raw = (getCardPoolEntry('ST10-006') ??
  (candidateDocument.cards as OfficialCardRecord[]).find(card => card.cardNumber === 'ST10-006'))
if (!raw) throw new Error('Missing original ST10-006 printing')

const converted = (): CookieCard => {
  const result = convertOfficialCardToGameCard(raw, 'st10-006-contract')
  if (result.status !== 'converted' || result.gameCard?.type !== 'cookie') {
    throw new Error('Blueberry Pie Cookie must convert to Cookie')
  }
  return result.gameCard
}

describe('ST10-006 original Blueberry Pie Cookie printing', () => {
  it('preserves its printed body and your-turn direct battle-to-trash damage trigger', () => {
    const card = converted()
    expect([
      card.id,
      card.name,
      card.type,
      card.cardColor ?? card.energyColor,
      card.energyColor,
      card.level,
      card.hp,
      card.attack,
      card.attackCost,
      card.attackEnergyCost,
    ]).toEqual([
      'ST10-006', 'Blueberry Pie Cookie', 'cookie', 'purple', 'purple', 1, 2, 2, 2, { purple: 2 },
    ])
    expect(raw.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
    expect(raw.skill.text).toBe(
      '【Your Turn】 When this Cookie is placed from your battle area into your trash, select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.',
    )
    expect(card.skill).toMatchObject({
      trigger: 'departure',
      yourTurn: true,
      effects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }],
    })
    expect(card.effects).toEqual(card.skill?.effects)
    expect(card.flip).toBeUndefined()
    expect(card.attackEffects ?? []).toEqual([])
    expect(analyzeOfficialCardBehavior(raw, card).contract.status).toBe('verified')
  })
})
