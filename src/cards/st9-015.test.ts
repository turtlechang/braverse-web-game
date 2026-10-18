import { describe, expect, it } from 'vitest'
import candidateDocument from '../../data/cards/official-st9-015.en.json'
import { getCardPoolEntry } from '../game/card-pool'
import type { CardEffect, NonCookieCard } from '../game/types'
import { analyzeOfficialCardBehavior } from './contracts/ledger'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import type { OfficialCardRecord } from './types'

const candidateCards = candidateDocument.cards as OfficialCardRecord[]
const printedCard = getCardPoolEntry('ST9-015') ?? candidateCards.find(card => card.cardNumber === 'ST9-015')
if (!printedCard) throw new Error('Original ST9-015 Essence of the Ocean printing is required')

const expectedEffects = (): CardEffect[] => [
  {
    kind: 'draw-up-to',
    max: 1,
    condition: { kind: 'hand-count-at-most', count: 5 },
  },
  {
    kind: 'gain-hp',
    amount: 1,
    target: {
      side: 'self',
      min: 0,
      max: 1,
      cardName: 'Sea Fairy Cookie',
      maxRemainingHp: 5,
    },
  },
]

const runtime = (): NonCookieCard => {
  const converted = convertOfficialCardToGameCard(printedCard, 'ST9-015-contract-test')
  if (converted.status !== 'converted' || converted.gameCard.type !== 'item') {
    throw new Error('ST9-015 must convert to an Item card')
  }
  return converted.gameCard
}

describe('ST9-015 original Essence of the Ocean contract', () => {
  it('retains its blue payment and independent conditional draw then named-cookie heal', () => {
    expect(printedCard).toMatchObject({
      cardNumber: 'ST9-015',
      name: 'Essence of the Ocean',
      type: 'item',
      color: 'BLUE',
      energyType: 'BLUE',
      skill: {
        text: '<{B}> If there are 5 cards or less in your hand, draw up to 1 card from your deck. Then, select up to 1 of your [Sea Fairy Cookie] with 5 or less HP remaining. That Cookie gains +1 HP.',
      },
      imageUrl: expect.stringMatching(/^https:\/\/cookierunbraverse\.com\//),
    })

    const card = runtime()
    expect(card).toMatchObject({
      id: 'ST9-015',
      name: 'Essence of the Ocean',
      cardColor: 'blue',
      energyColor: 'blue',
      item: {
        cost: { energy: { blue: 1 }, discardHand: 0 },
        effects: expectedEffects(),
      },
      effects: expectedEffects(),
    })
    expect(card.item?.text).toBe(printedCard.skill.text)
    expect(card.skill).toBeUndefined()
    expect(card.trap).toBeUndefined()
    expect(card.stageAbility).toBeUndefined()
  })

  it('strictly covers printed payment, target, and ordered Then clauses', () => {
    const audit = analyzeOfficialCardBehavior(printedCard, runtime())
    expect(audit.contract.status).toBe('verified')
    expect(audit.contract.payments).toContainEqual({
      kind: 'energy',
      energy: { blue: 1 },
      clauseIds: ['skill-1'],
    })
    expect(audit.checks.paymentCovered).toBe(true)
    expect(audit.checks.targetCovered).toBe(true)
    expect(audit.checks.resolutionOrderCovered).toBe(true)
  })

  it('rejects missing Then, wrong hand threshold, or broadened Cookie target', () => {
    const wrongThreshold = structuredClone(runtime())
    if (wrongThreshold.type !== 'item' || !wrongThreshold.item) throw new Error('Item runtime expected')
    const thresholdEffect = wrongThreshold.item.effects[0]
    if (thresholdEffect.kind !== 'draw-up-to') throw new Error('Draw-up-to effect expected')
    thresholdEffect.condition = { kind: 'hand-count-at-most', count: 6 }

    const missingThen = structuredClone(runtime())
    if (missingThen.type !== 'item' || !missingThen.item) throw new Error('Item runtime expected')
    missingThen.item.effects = [missingThen.item.effects[0]]
    missingThen.effects = [missingThen.effects?.[0]].filter((effect): effect is CardEffect => effect !== undefined)

    const broadTarget = structuredClone(runtime())
    if (broadTarget.type !== 'item' || !broadTarget.item) throw new Error('Item runtime expected')
    const heal = broadTarget.item.effects[1]
    if (heal.kind !== 'gain-hp') throw new Error('HP-gain effect expected')
    heal.target = { side: 'self', min: 0, max: 1, maxRemainingHp: 5 }

    for (const card of [wrongThreshold, missingThen, broadTarget]) {
      expect(analyzeOfficialCardBehavior(printedCard, card).contract.status).not.toBe('verified')
    }
  })
})
