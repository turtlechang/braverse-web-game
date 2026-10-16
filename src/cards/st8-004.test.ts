import { describe, expect, it } from 'vitest'
import { raw } from '../game/st8-004-demo'
import { createCard } from '../game/starter-deck'
import { analyzeOfficialCardBehavior } from './contracts'

const expected = {
  kind: 'set-active' as const, supportCount: 1, selectable: true, optional: true,
  restedOnly: false, condition: { kind: 'support-count-at-least' as const, count: 5 },
}
const original = () => {
  const card = createCard(raw, 'player-one', 1)
  if (card.type !== 'cookie') throw Error('Original Cookie required')
  return card
}

describe('ST8-004 independent original printing and strict evidence', () => {
  it('retains green LV3 HP5 GGG ordinary3 and optional own support Then', () => {
    const card = original()
    expect([card.name, card.energyColor, card.level, card.hp, card.attack, card.attackEnergyCost])
      .toEqual(['Red Panna Cotta Cookie', 'green', 3, 5, 3, { green: 3 }])
    expect(card.attackEffects).toEqual([expected])
    expect(card.skill).toBeUndefined()
    expect(card.flip).toBeUndefined()
    expect(card.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/8JJ5MHz64DbY-8xIL-hqhw.webp')
    expect(analyzeOfficialCardBehavior(raw).contract.status).toBe('verified')
  })

  // Deliberately invalid runtime copies test the auditor, never physical fixtures.
  const effects = [
    { ...expected, condition: undefined },
    { ...expected, condition: { kind: 'support-count-at-least' as const, count: 4 } },
    { ...expected, condition: { kind: 'opponent-support-count-at-least' as const, count: 5 } },
    { ...expected, condition: { ...expected.condition, restedOnly: true } },
    { ...expected, condition: { ...expected.condition, energyColor: 'green' as const } },
    { ...expected, supportCount: 2 }, { ...expected, selectable: false },
    { ...expected, optional: false }, { ...expected, restedOnly: true },
    { ...expected, energyColor: 'green' as const },
  ]
  it.each(effects.map((effect, index) => ({ effect, index })))('rejects altered Then $index', ({ effect }) => {
    const card = { ...original(), attackEffects: [effect] }
    expect(analyzeOfficialCardBehavior(raw, card).contract.status).not.toBe('verified')
  })
  it.each([
    { hp: 4 }, { level: 2 }, { energyColor: 'red' as const }, { attack: 4 },
    { attackEnergyCost: { green: 2 } }, { attackEnergyCost: { neutral: 3 } },
    { attackEffects: [expected, { kind: 'draw-up-to' as const, max: 1 }] },
    { flip: { text: 'Draw 1', cost: { energy: {}, discardHand: 0 }, effects: [{ kind: 'draw-up-to' as const, max: 1 }] } },
  ])('rejects changed printed attributes or added abilities: %j', patch => {
    expect(analyzeOfficialCardBehavior(raw, { ...original(), ...patch }).contract.status).not.toBe('verified')
  })
})
