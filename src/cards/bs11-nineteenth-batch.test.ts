import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialAttackEffects,
  convertOfficialCardToGameCard,
  convertOfficialCookieSkill,
  convertOfficialFlipAbility,
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
    `bs11-nineteenth-${cardNumber}`,
  )
  if (result.status !== 'converted') {
    throw new Error(`${cardNumber}: ${result.reason}`)
  }
  return result.gameCard
}

describe('BS11-074 to BS11-078 candidate contract', () => {
  it('preserves the five source records and the API text gap for BS11-077', () => {
    expect(records.filter((card) => /^BS11-0(?:74|75|76|77|78)$/.test(card.cardNumber)))
      .toHaveLength(5)
    expect(findCard('BS11-074')).toMatchObject({
      type: 'cookie',
      name: 'Chocolate Bark Cookie',
      level: 1,
      hp: 2,
      color: 'PURPLE',
      attackText: '<{N}> Bark Spear Thrust {da} 1',
    })
    expect(findCard('BS11-075')).toMatchObject({
      type: 'flip',
      name: 'Tea Knight Cookie',
      level: 2,
      hp: 3,
      flipText: 'Draw up to 1 card from your deck.',
    })
    expect(findCard('BS11-076')).toMatchObject({
      type: 'flip',
      name: 'Affogato Cookie',
      level: 1,
      hp: 1,
      flipText: '<Discard 1 card.> The Cookie with this card attached for HP gains +1 HP.',
    })
    expect(findCard('BS11-077').skill).toEqual({
      name: "{sk} Some Warrior's Soul",
      text: null,
    })
    expect(findCard('BS11-078')).toMatchObject({
      type: 'cookie',
      name: 'Caramel Arrow Cookie',
      level: 3,
      hp: 5,
      attackText: expect.stringContaining(
        "Then, if there are 15 cards or more in your trash, <{P}> select up to 1 of your opponent's Cookies.",
      ),
    })
  })
})

describe('BS11-074 to BS11-078 exact adapters', () => {
  it('keeps BS11-074 as a vanilla neutral attack', () => {
    expect(convertOfficialCookieSkill(findCard('BS11-074'))).toBeUndefined()
    expect(convertOfficialAttackEffects(findCard('BS11-074'))).toBeUndefined()
    expect(converted('BS11-074')).toMatchObject({
      name: 'Chocolate Bark Cookie',
      attack: 1,
      attackEnergyCost: { neutral: 1 },
    })
  })

  it('maps BS11-075 Tea Knight Cookie FLIP draw', () => {
    expect(convertOfficialFlipAbility(findCard('BS11-075'))).toMatchObject({
      text: 'Draw up to 1 card from your deck.',
      cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'draw-up-to', max: 1 }],
    })
    expect(converted('BS11-075')).toMatchObject({
      name: 'Tea Knight Cookie',
      flip: expect.objectContaining({ effects: [{ kind: 'draw-up-to', max: 1 }] }),
      attack: 3,
      attackEnergyCost: { purple: 3 },
    })
  })

  it('maps BS11-076 Affogato Cookie FLIP discard and attached HP bonus', () => {
    expect(convertOfficialFlipAbility(findCard('BS11-076'))).toMatchObject({
      cost: { energy: {}, discardHand: 1 },
      effects: [],
      attachedHpBonus: 1,
    })
    expect(converted('BS11-076')).toMatchObject({
      name: 'Affogato Cookie',
      flip: expect.objectContaining({ attachedHpBonus: 1 }),
      attack: 2,
      attackEnergyCost: { purple: 2 },
    })
  })

  it('restores BS11-077 Dark Spirit Helmet skill text from the verified card image', () => {
    expect(convertOfficialCookieSkill(findCard('BS11-077'))).toMatchObject({
      trigger: 'passive',
      text:
        'If there are 15 cards or more in your trash, your [Dark Choco Cookie] gains +1 attack damage.',
      effects: [],
      passiveEffects: [{
        kind: 'modify-attack',
        amount: 1,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, cardName: 'Dark Choco Cookie' },
        condition: { kind: 'trash-count-at-least', count: 15 },
      }],
    })
    expect(converted('BS11-077')).toMatchObject({
      name: 'Dark Spirit Helmet',
      skill: expect.objectContaining({ trigger: 'passive' }),
      attack: 2,
      attackEnergyCost: { purple: 2 },
    })
  })

  it('maps BS11-078 Caramel Arrow Cookie conditional optional attack Then', () => {
    const effects = convertOfficialAttackEffects(findCard('BS11-078'))
    expect(effects).toMatchObject([{
      kind: 'optional-cost-attack',
      cost: { energy: { purple: 1 }, discardHand: 0 },
      effects: [{
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'trash-count-at-least', count: 15 },
      }],
      effectText:
        "Then, if there are 15 cards or more in your trash, <{P}> select up to 1 of your opponent's Cookies. Place 1 card from the top of that Cookie's HP into your opponent's trash.",
    }])
    expect(converted('BS11-078')).toMatchObject({
      name: 'Caramel Arrow Cookie',
      attack: 3,
      attackEnergyCost: { purple: 3 },
      attackEffects: effects,
    })
  })
})
