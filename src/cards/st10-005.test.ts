import { describe, expect, it } from 'vitest'
import candidateDocument from '../../data/candidates/st6-st10/official-st10.en.json'
import { getCardPoolEntry } from '../game/card-pool'
import { createCard } from '../game/starter-deck'
import type { CookieCard } from '../game/types'
import { analyzeOfficialCardBehavior } from './contracts/ledger'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'

const raw = (getCardPoolEntry('ST10-005') ??
  (candidateDocument.cards as OfficialCardRecord[]).find(card => card.cardNumber === 'ST10-005'))
if (!raw) throw new Error('Missing original ST10-005 printing')

const converted = (): CookieCard => {
  const result = convertOfficialCardToGameCard(raw, 'st10-005-contract')
  if (result.status !== 'converted' || result.gameCard?.type !== 'cookie') {
    throw new Error('Dreamcatcher must convert to Cookie')
  }
  return result.gameCard
}

describe('ST10-005 original Dreamcatcher printing', () => {
  it('keeps its printed body, discard cost, and Moonlight-gated damage', () => {
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
      'ST10-005', 'Dreamcatcher', 'cookie', 'purple', 'purple', 1, 2, 1, 1, { purple: 1 },
    ])
    expect(card.skill).toMatchObject({
      trigger: 'on-play',
      effectConditionsAtResolution: true,
      cost: { energy: {}, discardHand: 1 },
      effects: [{
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'battle-area-has-named-cookie', side: 'self', name: 'Moonlight Cookie' },
      }],
    })
    expect(card.effects).toEqual(card.skill?.effects)
    expect(card.flip).toBeUndefined()
    expect(card.attackEffects ?? []).toEqual([])
    expect(analyzeOfficialCardBehavior(raw, card).contract.status).toBe('verified')
  })

  it('starts from the authentic printed cost and conditional source text', () => {
    const card = createCard(raw, 'player-one', 1)
    if (card.type !== 'cookie') throw new Error('Dreamcatcher must be Cookie')
    expect(raw.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/-6XS4T05CS6KTQUOulbf_A.webp')
    expect(raw.skill.text).toContain('<Discard 1 card.> If [Moonlight Cookie] is in your battle area')
    expect(card.skill?.cost).toEqual({ energy: {}, discardHand: 1 })
  })
})
