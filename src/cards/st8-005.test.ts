import { describe, expect, it } from 'vitest'
import { raw } from '../game/st8-005-demo'
import { createCard } from '../game/starter-deck'
import { analyzeOfficialCardBehavior as analyze } from './contracts'
import type { CardEffect } from '../game/types'

const expectedDraw = { kind: 'draw', amount: 1, condition: { kind: 'all-of', conditions: [
  { kind: 'hand-count-at-most', count: 5 }, { kind: 'item-activated-this-turn' },
] } } satisfies CardEffect
const expectedThen = { kind: 'rest-support-and-damage', supportSide: 'self', supportAmount: 2,
  activeOnly: true, target: { side: 'opponent', min: 0, max: 1 } } satisfies CardEffect
const original = () => {
  const card = createCard(raw, 'player-one', 1)
  if (card.type !== 'cookie') throw Error('Original Cookie required')
  return card
}
describe('ST8-005 original printing and exact strict contract', () => {
  it('keeps an unmodeled bracketed support cost blocked outside this exact card contract', () => {
    const unknown = { ...raw, cardNumber: 'ST8-999', baseCardNumber: 'ST8-999' }
    const invalid = { ...original(), id: 'ST8-999', attackEffects: [{ ...expectedThen, supportAmount: 3 }] }
    expect(analyze(unknown, invalid).contract.status).not.toBe('verified')
  })
  it('preserves original attributes, free Once draw and optional support/damage Then', () => {
    const card = original()
    expect([card.name, card.level, card.hp, card.energyColor, card.attack, card.attackEnergyCost])
      .toEqual(['Wind Archer Cookie', 3, 6, 'green', 3, { green: 3 }])
    expect(card.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/_B5YgwFHSoJ-goh9x3BfbA.webp')
    expect(card.skill).toMatchObject({ trigger: 'activate', oncePerTurn: true, restSource: false,
      cost: { energy: {}, discardHand: 0 }, effects: [expectedDraw] })
    expect(card.attackEffects).toEqual([expectedThen])
    expect(card.flip).toBeUndefined()
    expect(analyze(raw).contract.status).toBe('verified')
  })
  it.each([
    { hp: 5 }, { level: 2 }, { attack: 4 }, { energyColor: 'blue' as const },
    { attackEnergyCost: { green: 2 } }, { attackEnergyCost: { green: 3, neutral: 1 } },
    { skill: undefined }, { attackEffects: undefined },
    { attackEffects: [{ ...expectedThen, supportAmount: 1 }] },
    { attackEffects: [{ ...expectedThen, supportAmount: 3 }] },
    { attackEffects: [{ ...expectedThen, supportSide: 'opponent' as const }] },
    { attackEffects: [{ ...expectedThen, activeOnly: false }] },
    { attackEffects: [{ ...expectedThen, supportEnergyColor: 'green' as const }] },
    { attackEffects: [{ ...expectedThen, target: { side: 'opponent' as const, min: 1, max: 1 } }] },
    { attackEffects: [{ ...expectedThen, target: { side: 'opponent' as const, min: 0, max: 2 } }] },
    { attackEffects: [{ ...expectedThen, target: { side: 'self' as const, min: 0, max: 1 } }] },
    { attackEffects: [{ ...expectedThen, target: { ...expectedThen.target, maxLevel: 2 } }] },
    { attackEffects: [{ ...expectedThen, target: { ...expectedThen.target, previousEffectTargetOnly: true } }] },
    { attackEffects: [expectedThen, { kind: 'draw' as const, amount: 1 }] },
  ])('rejects altered printing or Then: %j', patch => {
    expect(analyze(raw, { ...original(), ...patch }).contract.status).not.toBe('verified')
  })
  it.each([
    { trigger: 'on-play' as const }, { oncePerTurn: false }, { restSource: true },
    { cost: { energy: { green: 1 } } }, { cost: { energy: {}, discardHand: 1 } },
    { effects: [{ ...expectedDraw, amount: 0 }] },
    { effects: [{ kind: 'draw-up-to' as const, max: 1, condition: expectedDraw.condition }] },
    { effects: [{ kind: 'draw' as const, amount: 1 }] },
    { effects: [{ ...expectedDraw, condition: { kind: 'hand-count-at-most' as const, count: 6 } }] },
    { effects: [{ ...expectedDraw, condition: { kind: 'item-activated-this-turn' as const } }] },
    { effects: [{ ...expectedDraw, condition: { kind: 'hand-count-at-most' as const, count: 5 } }] },
    { effects: [{ ...expectedDraw, condition: { ...expectedDraw.condition, kind: 'any-of' as const } }] },
    { effects: [expectedDraw, { kind: 'draw' as const, amount: 1 }] },
  ])('rejects lost conditions, wrong timing or additional skill costs: %j', patch => {
    const card = original()
    if (!card.skill) throw Error('Original skill required')
    expect(analyze(raw, { ...card, skill: { ...card.skill, ...patch } }).contract.status).not.toBe('verified')
  })
})
