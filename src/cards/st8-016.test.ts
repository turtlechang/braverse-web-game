import { describe, expect, it } from 'vitest'
import { analyzeOfficialCardBehavior } from './contracts/ledger'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { getCardPoolEntry } from '../game/card-pool'
import type { GameCard } from '../game/types'

const raw = getCardPoolEntry('ST8-016')

if (!raw) throw new Error("Missing original ST8-016 Wind's Grace Earrings")

type ItemCard = GameCard & { type: 'item' }

const original = (): ItemCard => {
  const conversion = convertOfficialCardToGameCard(raw, 'st8-016-contract')
  if (conversion.status !== 'converted' || conversion.gameCard?.type !== 'item') {
    throw new Error('ST8-016 must convert to an Item')
  }
  return conversion.gameCard as ItemCard
}

const item = (card: ItemCard) => {
  if (!card.item) throw new Error('ST8-016 must retain its Item ability')
  return card.item
}

const damage = (card: ItemCard) => {
  const effect = item(card).effects[0]
  if (effect?.kind !== 'damage-all') throw new Error('ST8-016 must damage all opponent Cookies')
  return effect
}

const condition = (card: ItemCard) => {
  const value = damage(card).condition
  if (value?.kind !== 'all-of') throw new Error('ST8-016 requires both printed conditions')
  return value
}

const wind = (card: ItemCard) => {
  const value = condition(card).conditions.find(child => child.kind === 'battle-area-has-named-cookie')
  if (value?.kind !== 'battle-area-has-named-cookie') throw new Error('Missing Wind Archer battle condition')
  return value
}

const threshold = (card: ItemCard) => {
  const value = condition(card).conditions.find(child => child.kind === 'support-count-at-least')
  if (value?.kind !== 'support-count-at-least') throw new Error('Missing support-area count condition')
  return value
}

const mutants: Record<string, (card: ItemCard) => void> = {
  'wrong name': card => { card.name = 'Windcatcher' },
  'wrong green identity': card => { card.energyColor = 'red' },
  'two green payment': card => { item(card).cost.green = 2 },
  'activation blocked while condition is false': card => { item(card).allowInactiveConditionalEffects = false },
  'condition removed': card => { delete damage(card).condition },
  'conditions changed to any-of': card => {
    const current = condition(card)
    damage(card).condition = { kind: 'any-of', conditions: current.conditions }
  },
  'Wind Archer condition removed': card => {
    condition(card).conditions = [threshold(card)]
  },
  'wrong Wind Archer zone': card => {
    const value = condition(card).conditions[0]
    if (value?.kind === 'battle-area-has-named-cookie') {
      condition(card).conditions[0] = { kind: 'support-area-has-named-cookie', side: 'self', name: value.name }
    }
  },
  'opponent Wind Archer condition': card => { wind(card).side = 'opponent' },
  'wrong Wind Archer name': card => { wind(card).name = 'Windcatcher Cookie' },
  'support threshold lowered': card => { threshold(card).count = 4 },
  'support count restricted to active cards': card => { threshold(card).restedOnly = true },
  'support count restricted to green': card => { threshold(card).energyColor = 'green' },
  'support count restricted to Arena': card => { threshold(card).keyword = 'arena' },
  'damage amount increased': card => { damage(card).amount = 2 },
  'self Cookies targeted': card => { damage(card).side = 'self' },
  'all damage made sequentially selectable': card => { damage(card).sequential = true },
  'all damage given a target selector': card => { damage(card).target = { side: 'opponent', min: 1, max: 1 } },
  'extra Item effect': card => { item(card).effects.push({ kind: 'draw', amount: 1 }) },
  'Item effects not mirrored': card => { card.effects = [] },
  'extra FLIP': card => {
    card.flip = { text: 'Unprinted', cost: { energy: {}, discardHand: 0 }, effects: [{ kind: 'draw', amount: 1 }] }
  },
  'extra keyword': card => { card.keywords = ['arena'] },
}

describe("ST8-016 original Wind's Grace Earrings precise contract", () => {
  it('retains the original green Item identity, image and exact G payment', () => {
    const card = original()
    expect([card.id, card.name, card.type, card.cardColor, card.energyColor]).toEqual([
      'ST8-016', "Wind's Grace Earrings", 'item', 'green', 'green',
    ])
    expect(card.imageUrl).toBe(raw.imageUrl)
    expect(item(card).cost).toEqual({ energy: { green: 1 }, discardHand: 0 })
    expect(item(card).allowInactiveConditionalEffects).toBe(true)
    expect(item(card).text).toBe(raw.skill.text)
  })

  it('requires both own Wind Archer in battle and at least five unrestricted support cards', () => {
    const card = original()
    expect(item(card).effects).toEqual([{
      kind: 'damage-all',
      amount: 1,
      side: 'opponent',
      condition: { kind: 'all-of', conditions: [
        { kind: 'battle-area-has-named-cookie', side: 'self', name: 'Wind Archer Cookie' },
        { kind: 'support-count-at-least', count: 5 },
      ] },
    }])
    expect(card.effects).toEqual(item(card).effects)
    expect(card.flip).toBeUndefined()
    expect(card.trap).toBeUndefined()
    expect(card.stageAbility).toBeUndefined()
  })

  it('verifies the original source record and the converted runtime evidence', () => {
    expect(analyzeOfficialCardBehavior(raw).contract.status).toBe('verified')
    expect(analyzeOfficialCardBehavior(raw, original()).contract.status).toBe('verified')
    expect(analyzeOfficialCardBehavior(raw, original()).contract.payments).toEqual([
      { kind: 'energy', energy: { green: 1 }, clauseIds: ['skill-1'] },
    ])
  })

  it('rejects semantic mutants without weakening the exact printed contract', () => {
    expect(Object.keys(mutants)).toHaveLength(22)
    for (const [label, mutate] of Object.entries(mutants)) {
      const card = original()
      mutate(card)
      expect(analyzeOfficialCardBehavior(raw, card).contract.status, label).not.toBe('verified')
    }
  })
})
