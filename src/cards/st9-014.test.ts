import { describe, expect, it } from 'vitest'
import candidateDocument from '../../data/cards/official-st9-014.en.json'
import { analyzeOfficialCardBehavior } from './contracts/ledger'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import type { OfficialCardRecord } from './types'
import type { GameCard } from '../game/types'
import { getCardPoolEntry } from '../game/card-pool'

const candidateCards = candidateDocument.cards as OfficialCardRecord[]
const printedCard = getCardPoolEntry('ST9-014') ?? candidateCards.find(card => card.cardNumber === 'ST9-014')
if (!printedCard) throw new Error('Original ST9-014 Glittering Pearl Shell printing is required')

type ItemCard = GameCard & { type: 'item'; item: NonNullable<GameCard['item']> }

const runtimeItem = (): ItemCard => {
  const converted = convertOfficialCardToGameCard(printedCard, 'ST9-014-contract-test')
  if (converted.status !== 'converted' || converted.gameCard?.type !== 'item' || !converted.gameCard.item) {
    throw new Error('ST9-014 must convert to an Item card')
  }
  return converted.gameCard as ItemCard
}

describe('ST9-014 original printing and item behavior contract', () => {
  it('keeps the printed blue identity, 2B payment, three-card discard, and optional +2 HP effect', () => {
    expect(printedCard).toMatchObject({
      cardNumber: 'ST9-014',
      name: 'Glittering Pearl Shell',
      type: 'item',
      color: 'BLUE',
      energyType: 'BLUE',
      skill: {
        text: '<{B}{B}> <Discard 3 cards.> Select up to 1 of your Cookies. That Cookie gains +2 HP.',
      },
      imageUrl: expect.stringMatching(/^https:\/\/cookierunbraverse\.com\//),
    })

    const item = runtimeItem()
    expect([item.id, item.name, item.cardColor, item.energyColor, item.imageUrl]).toEqual([
      'ST9-014', 'Glittering Pearl Shell', 'blue', 'blue', printedCard.imageUrl,
    ])
    expect(item.item.cost).toEqual({ energy: { blue: 2 }, discardHand: 3 })
    expect(item.item.effects).toEqual([{
      kind: 'gain-hp', amount: 2, target: { side: 'self', min: 0, max: 1 },
    }])
    expect(item.effects).toEqual(item.item.effects)
    expect(item.skill).toBeUndefined()
    expect(item.flip).toBeUndefined()
    expect(item.trap).toBeUndefined()
    expect(item.stageAbility).toBeUndefined()
  })

  it('matches the contract ledger payment, cost, and optional target evidence against the runtime ability', () => {
    const item = runtimeItem()
    const audit = analyzeOfficialCardBehavior(printedCard, item)
    expect(audit.contract.status).toBe('verified')
    expect(audit.contract.payments).toContainEqual({
      kind: 'energy', energy: { blue: 2 }, clauseIds: ['skill-1'],
    })
    expect(audit.contract.costs).toContainEqual({
      kind: 'discard-hand', amount: 3, clauseIds: ['skill-2'],
    })
    expect(audit.contract.targets).toContainEqual({
      selector: { side: 'self', min: 0, max: 1 }, clauseIds: ['skill-3'],
    })
  })

  it('rejects runtime mutations to the printed energy, discard amount, HP, or optional target', () => {
    const mutants: Record<string, (item: ReturnType<typeof runtimeItem>) => void> = {
      'wrong energy': item => { item.item.cost.energy = { blue: 1 } },
      'wrong discard amount': item => { item.item.cost.discardHand = 2 },
      'unprinted colored discard': item => { item.item.cost.discardHandColor = 'blue' },
      'wrong HP amount': item => {
        const effect = item.item.effects[0]
        if (effect.kind !== 'gain-hp') throw new Error('HP runtime expected')
        effect.amount = 1
      },
      'mandatory Cookie target': item => {
        const effect = item.item.effects[0]
        if (effect.kind !== 'gain-hp' || !effect.target) throw new Error('HP target expected')
        effect.target.min = 1
      },
      'too many targets': item => {
        const effect = item.item.effects[0]
        if (effect.kind !== 'gain-hp' || !effect.target) throw new Error('HP target expected')
        effect.target.max = 2
      },
      'opponent target': item => {
        const effect = item.item.effects[0]
        if (effect.kind !== 'gain-hp' || !effect.target) throw new Error('HP target expected')
        effect.target.side = 'opponent'
      },
    }

    for (const [label, mutate] of Object.entries(mutants)) {
      const item = runtimeItem()
      mutate(item)
      expect(analyzeOfficialCardBehavior(printedCard, item).contract.status, label).not.toBe('verified')
    }
  })
})
