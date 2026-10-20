import { describe, expect, it } from 'vitest'
import candidateDocument from '../../data/cards/official-st9.en.json'
import st9004To006Document from '../../data/cards/official-st9-004-006.en.json'
import formalDocument from '../../data/cards/official-st9-007-008.en.json'
import type { CookieCard } from '../game/types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import type { OfficialCardRecord } from './types'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const rawCards = [
  ...(candidateDocument.cards as OfficialCardRecord[]),
  ...(st9004To006Document.cards as OfficialCardRecord[]),
  ...(formalDocument.cards as OfficialCardRecord[]),
]

const raw = (cardNumber: string): OfficialCardRecord => {
  const card = rawCards.find(candidate => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Original ${cardNumber} printing is required`)
  return card
}

const converted = (cardNumber: string): { raw: OfficialCardRecord; card: CookieCard } => {
  const source = raw(cardNumber)
  const result = convertOfficialCardToGameCard(source, 'st9-007-009-contract')
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') {
    throw new Error(`Original ${cardNumber} must convert to a Cookie`)
  }
  return { raw: source, card: result.gameCard }
}

describe('ST9-007–009 original printings', () => {
  it('keeps ST9-007 Activate timing, once limit and the three-card hand gate', () => {
    const { raw: source, card } = converted('ST9-007')
    expect([card.name, card.cardColor, card.energyColor, card.level, card.hp,
      card.attack, card.attackEnergyCost]).toEqual([
      'Peppermint Cookie', 'blue', 'blue', 2, 5, 2, { blue: 3 },
    ])
    expect(card.skill).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: false,
      restSource: false,
      cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'draw-up-to', max: 1, condition: { kind: 'hand-count-at-most', count: 3 } }],
    })
    expect(card.attackEffects ?? []).toEqual([])
    expect(analyzeOfficialCardBehavior(source, card).contract.status).toBe('verified')
    expect(analyzeOfficialCardBehavior(source, {
      ...card,
      skill: { ...card.skill!, effects: [{ kind: 'draw-up-to', max: 1,
        condition: { kind: 'hand-count-at-most', count: 4 } }] },
    }).contract.status).toBe('needs-review')
  })

  it('pays ST9-008 battle-area return before its source-only HP gain', () => {
    const { raw: source, card } = converted('ST9-008')
    expect([card.name, card.cardColor, card.energyColor, card.level, card.hp,
      card.attack, card.attackEnergyCost]).toEqual([
      'Crimson Coral Cookie', 'blue', 'blue', 3, 5, 3, { blue: 3 },
    ])
    expect(card.skill).toMatchObject({
      trigger: 'on-play',
      oncePerTurn: false,
      cost: { energy: {}, discardHand: 0, battleCookieToHand: { count: 1, maxLevel: 2 } },
      effects: [{ kind: 'gain-hp', amount: 1, target: { side: 'self', min: 1, max: 1, sourceOnly: true } }],
    })
    expect(analyzeOfficialCardBehavior(source, card).contract.status).toBe('verified')
    expect(analyzeOfficialCardBehavior(source, {
      ...card,
      skill: { ...card.skill!, cost: { energy: {}, discardHand: 0,
        battleCookieToHand: { count: 1, maxLevel: 3 } } },
    }).contract.status).toBe('needs-review')
  })

  it('keeps ST9-009 draw passive and bound to Sea Fairy Cookie hand-to-trash effects', () => {
    const { raw: source, card } = converted('ST9-009')
    expect([card.name, card.cardColor, card.energyColor, card.level, card.hp,
      card.attack, card.attackEnergyCost]).toEqual([
      'Wave Drop', 'blue', 'blue', 1, 2, 1, { blue: 1 },
    ])
    expect(card.skill).toMatchObject({
      trigger: 'passive',
      oncePerTurn: false,
      effects: [],
      passiveEffects: [{ kind: 'hand-to-trash-trigger', sourceCardName: 'Sea Fairy Cookie',
        effects: [{ kind: 'draw-up-to', max: 1 }] }],
    })
    const audit = analyzeOfficialCardBehavior(source, card)
    expect(audit.contract.status).toBe('verified')
    expect(audit.contract.blockers).toEqual([])
    expect(analyzeOfficialCardBehavior(source, {
      ...card,
      skill: { ...card.skill!, passiveEffects: [{ kind: 'hand-to-trash-trigger',
        sourceCardName: 'Black Pearl Cookie', effects: [{ kind: 'draw-up-to', max: 1 }] }] },
    }).contract.blockers).toContain(
      'ST9-009 requires original blue Wave Drop LV1/2 HP/B1; its passive draws up to one only when a Sea Fairy Cookie effect moves it from hand to trash',
    )
    const seaFairy = converted('ST9-006').card
    expect(seaFairy.attackEffects?.[0]).toMatchObject({
      kind: 'optional-cost-attack',
      cost: { discardHand: 2 },
      discardedHandCardsTriggerPassives: true,
    })
  })
})
