import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialCardToGameCard,
  convertOfficialCookieSkill,
  convertOfficialItemAbility,
  convertOfficialTrapAbility,
  type OfficialCardRecord,
} from '.'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const findCard = (cardNumber: string): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS11 candidate fixture: ${cardNumber}`)
  return card
}

const converted = (cardNumber: string) => {
  const result = convertOfficialCardToGameCard(findCard(cardNumber), `bs11-seventeenth-${cardNumber}`)
  if (result.status !== 'converted') throw new Error(`${cardNumber}: ${result.reason}`)
  return result.gameCard
}

describe('BS11-065 to BS11-068 candidate contract', () => {
  it('preserves the requested records, text, and alternate-art identity', () => {
    expect(records.filter((card) => /^BS11-06[5678](?:@1)?$/.test(card.cardNumber))).toHaveLength(6)
    expect(findCard('BS11-065')).toMatchObject({
      cardNumber: 'BS11-065',
      baseCardNumber: 'BS11-065',
      type: 'item',
      color: 'BLUE',
      energyType: 'BLUE',
      skill: { text: '<{B}{B}> <Discard 1 card.> Select up to 1 Cookie that is LV.2 or lower from either player\'s battle area. Place that Cookie on the bottom of its owner\'s deck.' },
    })
    expect(findCard('BS11-066')).toMatchObject({
      cardNumber: 'BS11-066',
      type: 'trap',
      skill: { text: '<{B}> Select up to 1 of your opponent\'s Cookies. During this turn, that Cookie deals -1 attack damage. Then, view 1 card from the top of your opponent\'s deck and place that card on the top or bottom of their deck.' },
    })
    for (const cardNumber of ['BS11-067', 'BS11-067@1', 'BS11-068', 'BS11-068@1'] as const) {
      const card = findCard(cardNumber)
      expect(card).toMatchObject({
        cardNumber,
        baseCardNumber: cardNumber.endsWith('@1') ? cardNumber.slice(0, -2) : cardNumber,
        variant: cardNumber.endsWith('@1') ? '1' : null,
        type: 'cookie',
        color: 'BLUE',
      })
    }
  })
})

describe('BS11-065 to BS11-068 exact adapters', () => {
  it('maps The Breath of the Depths to a this-turn paid On Play replacement', () => {
    expect(convertOfficialItemAbility(findCard('BS11-064'))).toMatchObject({
      cost: { energy: { blue: 1 }, discardHand: 1 },
      effects: [{
        kind: 'replace-opponent-on-play',
        duration: 'this-turn',
        cost: { energy: { neutral: 1 }, discardHand: 0 },
        effects: [{ kind: 'draw-up-to', max: 1 }],
      }],
    })
  })

  it('maps Mirror of Destiny to 2B, discard one, and whole LV2-or-lower Cookie movement', () => {
    expect(convertOfficialItemAbility(findCard('BS11-065'))).toMatchObject({
      cost: { energy: { blue: 2 }, discardHand: 1 },
      effects: [{
        kind: 'field-to-deck-bottom',
        target: { side: 'either', min: 0, max: 1, maxLevel: 2 },
      }],
    })
  })

  it('maps Milk Lake of Truth to optional -1 attack followed by opponent-deck top-or-bottom', () => {
    expect(convertOfficialTrapAbility(findCard('BS11-066'))).toMatchObject({
      cost: { energy: { blue: 1 }, discardHand: 0 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'inspect-deck',
          side: 'opponent',
          lookCount: 1,
          pickCount: 0,
          restDestination: 'top-or-bottom',
        },
      ],
    })
  })

  it.each(['BS11-067', 'BS11-067@1'] as const)('shares Black Raisin Cookie attack Then mapping for %s', (cardNumber) => {
    expect(converted(cardNumber)).toMatchObject({
      attack: 2,
      attackEnergyCost: { blue: 2 },
      attackEffects: [{
        kind: 'optional-cost-attack',
        cost: { energy: { blue: 1 }, discardHand: 0, selfToDeckBottom: true },
        effects: [
          { kind: 'draw', amount: 1 },
          { kind: 'discard-hand', count: 1, destination: 'deck-top' },
        ],
      }],
    })
  })

  it.each(['BS11-068', 'BS11-068@1'] as const)('shares Black Sapphire Cookie faint mapping for %s', (cardNumber) => {
    expect(convertOfficialCookieSkill(findCard(cardNumber))).toMatchObject({
      trigger: 'passive',
      faint: true,
      sourceEnergy: { blue: 1 },
      effects: [{
        kind: 'field-to-deck-bottom',
        target: { side: 'opponent', min: 0, max: 1 },
        hpOnly: true,
      }],
    })
  })

})
