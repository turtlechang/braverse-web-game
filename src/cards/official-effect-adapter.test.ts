import { describe, expect, it } from 'vitest'
import officialSample from '../../data/cards/official-sample.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCardEffectSet,
  convertOfficialCookieSkill,
  type OfficialCardRecord,
} from '.'

const cards = officialSample.cards as OfficialCardRecord[]
const findCard = (cardNumber: string) => {
  const card = cards.find((candidate) => candidate.cardNumber === cardNumber)

  if (!card) {
    throw new Error(`Missing official sample card ${cardNumber}`)
  }

  return card
}

describe('Starter Deck RED official effect adapter', () => {
  it('imports all 22 distinct starter deck cards', () => {
    expect(cards).toHaveLength(22)
    expect(new Set(cards.map((card) => card.cardNumber)).size).toBe(22)
    expect(
      cards.every(
        (card) => card.product.title === 'Starter Deck RED',
      ),
    ).toBe(true)
  })

  it('parses direct damage and multi-target selection', () => {
    expect(convertOfficialCardEffects(findCard('ST1-016'))).toMatchObject({
      status: 'supported',
      effects: [
        {
          kind: 'damage',
          amount: 1,
          target: {
            side: 'opponent',
            min: 0,
            max: 1,
          },
        },
      ],
    })

    expect(convertOfficialCardEffects(findCard('ST1-003'))).toMatchObject({
      status: 'supported',
      effects: [
        {
          kind: 'damage',
          amount: 2,
          target: {
            side: 'opponent',
            min: 0,
            max: 2,
          },
        },
      ],
    })
  })

  it('parses cookie skill timing, usage limits, and energy costs', () => {
    expect(convertOfficialCookieSkill(findCard('ST1-002'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: false,
      yourTurn: false,
      cost: { red: 1 },
    })
    expect(convertOfficialCookieSkill(findCard('ST1-003'))).toMatchObject({
      trigger: 'on-play',
      oncePerTurn: true,
      cost: { red: 2, neutral: 2 },
    })
    expect(convertOfficialCookieSkill(findCard('ST1-008'))).toMatchObject({
      trigger: 'on-play',
      oncePerTurn: true,
      restSource: true,
      cost: { red: 2 },
    })
    expect(convertOfficialCookieSkill(findCard('ST1-009'))).toMatchObject({
      trigger: 'passive',
      yourTurn: true,
      cost: {},
      effects: [
        {
          kind: 'modify-attack',
          target: { sourceOnly: true },
        },
      ],
    })
  })

  it('parses positive and negative attack modifiers', () => {
    expect(convertOfficialCardEffects(findCard('ST1-019'))).toMatchObject({
      status: 'supported',
      effects: [
        {
          kind: 'modify-attack',
          amount: 1,
          duration: 'this-turn',
          target: { side: 'self' },
        },
      ],
    })

    expect(convertOfficialCardEffects(findCard('ST1-020'))).toMatchObject({
      status: 'supported',
      effects: [
        {
          kind: 'modify-attack',
          amount: -2,
          duration: 'this-turn',
          target: { side: 'opponent' },
        },
      ],
    })

    expect(convertOfficialCardEffects(findCard('ST1-018'))).toMatchObject({
      status: 'supported',
      effects: [
        {
          kind: 'modify-damage-received',
          amount: -2,
          duration: 'opponent-next-turn',
          target: { side: 'self' },
        },
      ],
    })
  })

  it('preserves target filters and activation conditions', () => {
    expect(convertOfficialCardEffects(findCard('ST1-021'))).toMatchObject({
      status: 'supported',
      effects: [
        {
          target: {
            remainingHp: 1,
          },
        },
      ],
    })

    expect(convertOfficialCardEffects(findCard('ST1-002'))).toMatchObject({
      status: 'supported',
      effects: [
        {
          condition: {
            kind: 'break-level-at-least',
            level: 6,
          },
        },
      ],
    })
  })

  it('marks unsupported starter deck effects explicitly', () => {
    const conversions = convertOfficialCardEffectSet(cards)
    const supported = conversions.filter(
      (conversion) => conversion.status === 'supported',
    )
    const princess = conversions.find(
      (conversion) => conversion.cardNumber === 'ST1-001',
    )

    expect(supported).toHaveLength(13)
    expect(supported.map((conversion) => conversion.cardNumber)).toEqual(
      expect.arrayContaining([
        'ST1-002',
        'ST1-003',
        'ST1-007',
        'ST1-008',
        'ST1-009',
        'ST1-010',
        'ST1-016',
        'ST1-017',
        'ST1-018',
        'ST1-019',
        'ST1-020',
        'ST1-021',
        'ST1-022',
      ]),
    )
    expect(princess).toMatchObject({
      status: 'unsupported',
      reason: 'unsupported-effect-text',
    })
  })
})
