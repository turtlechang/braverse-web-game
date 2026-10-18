import { describe, expect, it } from 'vitest'
import candidateDocument from '../../data/cards/official-st9-013.en.json'
import { analyzeOfficialCardBehavior } from './contracts/ledger'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import type { OfficialCardRecord } from './types'
import { getCardPoolEntry } from '../game/card-pool'

const candidateCards = candidateDocument.cards as OfficialCardRecord[]
const printedCard = getCardPoolEntry('ST9-013') ?? candidateCards.find(card => card.cardNumber === 'ST9-013')
if (!printedCard) throw new Error('Original ST9-013 Shimmering Moonlit Coral printing is required')

describe('ST9-013 original printing and item behavior contract', () => {
  it('keeps the printed blue energy cost, blue hand discard cost, and optional draw-two effect', () => {
    expect(printedCard).toMatchObject({
      cardNumber: 'ST9-013',
      name: 'Shimmering Moonlit Coral',
      type: 'item',
      color: 'BLUE',
      energyType: 'BLUE',
      skill: {
        text: '<{B}> <Discard 1 {B} card from your hand.> Draw up to 2 cards from your deck.',
      },
      imageUrl: expect.stringMatching(/^https:\/\/cookierunbraverse\.com\//),
    })

    const converted = convertOfficialCardToGameCard(printedCard, 'ST9-013-test')
    expect(converted.status).toBe('converted')
    if (converted.status !== 'converted' || converted.gameCard.type !== 'item') {
      throw new Error('ST9-013 must convert to an Item card')
    }

    expect(converted.gameCard).toMatchObject({
      id: 'ST9-013',
      name: 'Shimmering Moonlit Coral',
      cardColor: 'blue',
      energyColor: 'blue',
      item: {
        cost: { energy: { blue: 1 }, discardHand: 1, discardHandColor: 'blue' },
        effects: [{ kind: 'draw-up-to', max: 2 }],
      },
    })
    expect(converted.gameCard.item?.text).toBe(printedCard.skill.text)
    expect(converted.gameCard.skill).toBeUndefined()
    expect(converted.gameCard.trap).toBeUndefined()
    expect(converted.gameCard.stageAbility).toBeUndefined()
  })

  it('matches the strict source-contract ledger against the runtime ability', () => {
    const converted = convertOfficialCardToGameCard(printedCard, 'ST9-013-contract-test')
    if (converted.status !== 'converted' || converted.gameCard.type !== 'item') {
      throw new Error('ST9-013 must convert before its source contract can be audited')
    }

    const audit = analyzeOfficialCardBehavior(printedCard, converted.gameCard)
    expect(audit.contract.status).toBe('verified')
    expect(audit.contract.payments).toContainEqual({
      kind: 'energy',
      energy: { blue: 1 },
      clauseIds: ['skill-1'],
    })
    expect(audit.contract.costs).toContainEqual({
      kind: 'discard-hand',
      amount: 1,
      clauseIds: ['skill-2'],
    })
  })

  it('rejects runtime mutations to either printed cost or the draw amount', () => {
    const converted = convertOfficialCardToGameCard(printedCard, 'ST9-013-mutant-test')
    if (converted.status !== 'converted' || converted.gameCard.type !== 'item' || !converted.gameCard.item) {
      throw new Error('ST9-013 must convert before its source contract can be mutated')
    }

    const wrongEnergy = structuredClone(converted.gameCard)
    if (wrongEnergy.type !== 'item' || !wrongEnergy.item) throw new Error('Item runtime expected')
    wrongEnergy.item.cost.energy = { ...wrongEnergy.item.cost.energy, blue: 2 }

    const wrongHandColor = structuredClone(converted.gameCard)
    if (wrongHandColor.type !== 'item' || !wrongHandColor.item) throw new Error('Item runtime expected')
    delete wrongHandColor.item.cost.discardHandColor

    const wrongDraw = structuredClone(converted.gameCard)
    if (wrongDraw.type !== 'item' || !wrongDraw.item) throw new Error('Item runtime expected')
    const draw = wrongDraw.item.effects[0]
    if (draw.kind !== 'draw-up-to') throw new Error('Draw-up-to runtime expected')
    draw.max = 1

    for (const runtimeCard of [wrongEnergy, wrongHandColor, wrongDraw]) {
      expect(analyzeOfficialCardBehavior(printedCard, runtimeCard).contract.status).not.toBe('verified')
    }
  })
})
