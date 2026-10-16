import { describe, expect, it } from 'vitest'
import candidateDocument from '../../data/candidates/st6-st10/official-st10.en.json'
import { analyzeOfficialCardBehavior } from './contracts/ledger'
import type { OfficialCardRecord } from './types'
import { getCardPoolEntry } from '../game/card-pool'
import { createCard } from '../game/starter-deck'
import type { CookieCard } from '../game/types'
import type { St10001To003CardNumber } from '../game/st10-001-003-demo'

const candidateCards = candidateDocument.cards as OfficialCardRecord[]
const raw = (cardNumber: St10001To003CardNumber): OfficialCardRecord => {
  const record = getCardPoolEntry(cardNumber) ?? candidateCards.find(card => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Original ${cardNumber} printing is required`)
  return record
}

const original = (cardNumber: St10001To003CardNumber): CookieCard => {
  const card = createCard(raw(cardNumber), 'player-one', 1)
  if (card.type !== 'cookie') throw new Error('Original Cookie required')
  return card
}

describe('ST10-001 and ST10-003 original purple FLIP printings', () => {
  it.each([
    ['ST10-001', 'Dreamweaver Cookie', 4, 'Return this Cookie to your hand.', { kind: 'flip-to-hand' }],
    ['ST10-003', 'Poison Mushroom Cookie', 3, 'Draw up to 1 card from your deck.', { kind: 'draw-up-to', max: 1 }],
  ] as const)('%s keeps its printed body and exact FLIP effect', (cardNumber, name, hp, flipText, flipEffect) => {
    const printed = raw(cardNumber)
    const card = original(cardNumber)
    expect([card.name, card.cardColor ?? card.energyColor, card.energyColor, card.level, card.hp,
      card.attack, card.attackCost, card.attackEnergyCost]).toEqual([
      name, 'purple', 'purple', 2, hp, 3, 3, { purple: 3 },
    ])
    expect(card.skill).toBeUndefined()
    expect(card.attackEffects ?? []).toEqual([])
    expect(card.effects).toEqual([flipEffect])
    expect(card.flip).toMatchObject({
      text: flipText,
      cost: { energy: {}, discardHand: 0 },
      effects: [flipEffect],
    })
    expect(card.imageUrl).toBe(printed.imageUrl)
    expect(printed.flipText).toBe(flipText)
    expect(analyzeOfficialCardBehavior(printed, card).contract.status).toBe('verified')
  })
})
