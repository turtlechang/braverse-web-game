import { describe, expect, it } from 'vitest'
import { analyzeOfficialCardBehavior } from './contracts/ledger'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { getCardPoolEntry } from '../game/card-pool'
import { createCard } from '../game/starter-deck'
import type { GameCard } from '../game/types'

const raw = getCardPoolEntry('ST8-014')

if (!raw) throw new Error('Missing original ST8-014 Cape of the Vanquisher')

type ItemCard = GameCard & { type: 'item' }

const original = (): ItemCard => {
  const card = createCard(raw, 'player-one', 1)
  if (card.type !== 'item') throw new Error('ST8-014 must remain an Item')
  return card as ItemCard
}

describe('ST8-014 Cape of the Vanquisher physical item contract', () => {
  it('keeps the printed identity, image, G payment, support threshold, target filters, and +1 HP', () => {
    const conversion = convertOfficialCardToGameCard(raw, 'st8-014-contract')

    if (conversion.status !== 'converted' || conversion.gameCard?.type !== 'item') {
      throw new Error('ST8-014 must convert to an Item card')
    }

    const card = conversion.gameCard
    expect([card.id, card.name, card.type, card.cardColor, card.energyColor]).toEqual([
      'ST8-014',
      'Cape of the Vanquisher',
      'item',
      'green',
      'green',
    ])
    expect(card.imageUrl).toBe(raw.imageUrl)
    expect(card.item?.cost).toEqual({ green: 1 })
    expect(card.item?.allowInactiveConditionalEffects).toBe(true)
    expect(card.item?.effects).toEqual([
      {
        kind: 'gain-hp',
        amount: 1,
        target: {
          side: 'self',
          min: 0,
          max: 1,
          energyColor: 'green',
          maxRemainingHp: 3,
        },
        condition: { kind: 'support-count-at-least', count: 5 },
      },
    ])
    expect(card.effects).toEqual(card.item?.effects)
    expect(card.trap).toBeUndefined()
    expect(card.flip).toBeUndefined()
    expect(card.stageAbility).toBeUndefined()
  })

  it('matches the contract ledger payment and target evidence against a real runtime card', () => {
    const audit = analyzeOfficialCardBehavior(raw, original())
    expect(audit.contract.status).toBe('verified')
    expect(audit.contract.payments).toEqual([
      { kind: 'energy', energy: { green: 1 }, clauseIds: ['skill-1'] },
    ])
    expect(audit.contract.targets).toEqual([
      {
        selector: {
          side: 'self', min: 0, max: 1, energyColor: 'green', maxRemainingHp: 3,
        },
        clauseIds: ['skill-2'],
      },
    ])
  })

  it('rejects runtime cards that omit cost-first no-op, the support threshold, or target restrictions', () => {
    const mutants: Record<string, (card: ItemCard) => void> = {
      'no cost-first activation': card => { delete card.item?.allowInactiveConditionalEffects },
      'no support threshold': card => {
        const effect = card.item?.effects[0]
        if (effect && 'condition' in effect) delete effect.condition
      },
      'wrong support threshold': card => {
        const effect = card.item?.effects[0]
        if (effect && 'condition' in effect && effect.condition?.kind === 'support-count-at-least') {
          effect.condition.count = 4
        }
      },
      'mandatory target': card => {
        const effect = card.item?.effects[0]
        if (effect && 'target' in effect && effect.target) effect.target.min = 1
      },
      'missing green target filter': card => {
        const effect = card.item?.effects[0]
        if (effect && 'target' in effect && effect.target) delete effect.target.energyColor
      },
      'wrong remaining HP filter': card => {
        const effect = card.item?.effects[0]
        if (effect && 'target' in effect && effect.target) effect.target.maxRemainingHp = 4
      },
    }

    for (const [label, mutate] of Object.entries(mutants)) {
      const card = original()
      mutate(card)
      expect(analyzeOfficialCardBehavior(raw, card).contract.status, label).not.toBe('verified')
    }
  })
})
