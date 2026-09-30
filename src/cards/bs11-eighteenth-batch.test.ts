import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialAttackEffects,
  convertOfficialCardToGameCard,
  convertOfficialCookieSkill,
  type OfficialCardRecord,
} from '.'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const findCard = (cardNumber: string): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS11 candidate fixture: ${cardNumber}`)
  return card
}

const converted = (cardNumber: string) => {
  const result = convertOfficialCardToGameCard(
    findCard(cardNumber),
    `bs11-eighteenth-${cardNumber}`,
  )
  if (result.status !== 'converted') {
    throw new Error(`${cardNumber}: ${result.reason}`)
  }
  return result.gameCard
}

describe('BS11-069 to BS11-073 candidate contract', () => {
  it('preserves the five cards and every supplied art variant', () => {
    expect(
      records.filter((card) => /^BS11-0(?:69|70|71)(?:@[12])?$/.test(card.cardNumber)),
    ).toHaveLength(7)
    expect(findCard('BS11-072')).toMatchObject({
      cardNumber: 'BS11-072',
      baseCardNumber: 'BS11-072',
      type: 'cookie',
      name: 'Dark Choco Cookie',
      level: 2,
      hp: 5,
      color: 'PURPLE',
    })
    expect(findCard('BS11-073')).toMatchObject({
      cardNumber: 'BS11-073',
      type: 'cookie',
      name: 'Marble Danish Cookie',
      attackText: '<{N}{N}{N}> Honor-seeking Strikes {da} 4',
    })
    for (const cardNumber of [
      'BS11-069',
      'BS11-069@1',
      'BS11-070',
      'BS11-070@1',
      'BS11-071',
      'BS11-071@1',
      'BS11-071@2',
    ] as const) {
      expect(findCard(cardNumber).baseCardNumber).toBe(
        cardNumber.replace(/@[12]$/, ''),
      )
    }
  })
})

describe('BS11-069 to BS11-073 exact adapters', () => {
  it.each(['BS11-069', 'BS11-069@1'] as const)(
    'maps Sea Fairy Cookie skill timing and draw-then-top effect for %s',
    (cardNumber) => {
      expect(convertOfficialCookieSkill(findCard(cardNumber))).toMatchObject({
        trigger: 'opponent-attack',
        oncePerTurn: true,
        cost: { energy: {}, discardHand: 0 },
        effects: [{
          kind: 'draw-up-to-then-discard',
          max: 2,
          discardCount: 1,
          handDestination: 'deck-top',
          condition: { kind: 'hand-count-at-most', count: 5 },
        }],
      })
    },
  )

  it.each(['BS11-070', 'BS11-070@1'] as const)(
    'maps Pure Vanilla On Play cost and corrected BNN attack cost for %s',
    (cardNumber) => {
      expect(convertOfficialCookieSkill(findCard(cardNumber))).toMatchObject({
        trigger: 'on-play',
        cost: {
          energy: {},
          discardHand: 1,
          discardHandType: 'cookie',
          discardHandKeyword: 'ancient',
        },
        effects: [{ kind: 'draw-up-to', max: 2 }],
      })
      expect(converted(cardNumber)).toMatchObject({
        attack: 3,
        attackEnergyCost: { blue: 1, neutral: 2 },
        attackEffects: [{
          kind: 'optional-cost-attack',
          cost: { energy: { neutral: 1 }, discardHand: 0 },
          effects: [{
            kind: 'choose-one',
            modes: [
              { effects: [{ kind: 'battle-to-deck-top' }] },
              { effects: [{ kind: 'field-to-deck-bottom' }] },
            ],
          }],
        }],
      })
    },
  )

  it.each(['BS11-071', 'BS11-071@1', 'BS11-071@2'] as const)(
    'maps Shadow Milk EXTRA skill choice as mandatory after payment for %s',
    (cardNumber) => {
      const effects = convertOfficialAttackEffects(findCard(cardNumber))
      expect(effects).toMatchObject([{
        kind: 'optional-cost-attack',
        cost: { energy: { neutral: 1 }, discardHand: 1 },
        effects: [{
          kind: 'choose-one',
          modes: [
            {
              effects: [{
                kind: 'activate-extra-deck-skill',
                cardName: 'Shadow Milk Cookie',
                skillTrigger: 'on-play',
                optional: false,
              }],
            },
            {
              effects: [{
                kind: 'activate-extra-deck-skill',
                cardName: 'Shadow Milk Cookie',
                skillTrigger: 'activate',
                optional: false,
              }],
            },
          ],
        }],
      }])
    },
  )

  it('maps Dark Choco and leaves Marble Danish as a vanilla attack', () => {
    expect(convertOfficialCookieSkill(findCard('BS11-072'))).toMatchObject({
      trigger: 'activate',
      cost: { energy: { purple: 1 }, discardHand: 0 },
      effects: [{
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'trash-count-at-least', count: 15 },
      }],
    })
    expect(convertOfficialCookieSkill(findCard('BS11-073'))).toBeUndefined()
    expect(converted('BS11-073')).toMatchObject({
      name: 'Marble Danish Cookie',
      attack: 4,
      attackEnergyCost: { neutral: 3 },
    })
    expect(convertOfficialAttackEffects(findCard('BS11-073'))).toBeUndefined()
  })
})
import { describe, expect, it } from 'vitest'
