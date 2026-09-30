import { describe, expect, it } from 'vitest'
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

describe('BS11-111～113 candidate contract', () => {
  it('keeps the six official base and alternate-art records', () => {
    expect(records.filter((card) => /^BS11-(111|112|113)(@1)?$/.test(card.cardNumber)))
      .toHaveLength(6)

    expect(findCard('BS11-111')).toMatchObject({
      type: 'cookie',
      name: 'Mold Dough Cookie',
      level: 2,
      hp: 4,
      energyType: 'BLACK',
      skill: { text: expect.stringContaining('Special Play') },
    })
    expect(findCard('BS11-112')).toMatchObject({
      type: 'cookie',
      name: 'Pom-pom Dough Cookie',
      level: 2,
      hp: 4,
      energyType: 'BLACK',
      skill: { text: expect.stringContaining('return up to 1') },
    })
    expect(findCard('BS11-113')).toMatchObject({
      type: 'cookie',
      name: 'Venom Dough Cookie',
      level: 2,
      hp: 4,
      energyType: 'BLACK',
      skill: { text: expect.stringContaining('draw up to 2') },
    })
  })
})

describe('BS11-111～113 exact adapters', () => {
  it('maps Mold Dough Cookie On Play damage and the shared Special Play cost', () => {
    expect(convertOfficialCookieSkill(findCard('BS11-111'))).toMatchObject({
      trigger: 'on-play',
      cost: { energy: {}, discardHand: 1 },
      specialPlayCost: {
        energy: {},
        discardHand: 0,
        trashBattleCookie: { count: 1, energyColor: 'black', level: 1 },
      },
      effects: [{
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      }],
    })
  })

  it('maps Pom-pom Dough Cookie hand recovery and level-restricted attack Then', () => {
    expect(convertOfficialCookieSkill(findCard('BS11-112'))).toMatchObject({
      trigger: 'on-play',
      specialPlayCost: {
        trashBattleCookie: { count: 1, energyColor: 'black', level: 1 },
      },
      effects: [{
        kind: 'trash-to-hand',
        max: 1,
        energyColor: 'black',
        cookieOnly: true,
        condition: { kind: 'hand-count-at-most', count: 5 },
      }],
    })
    expect(convertOfficialAttackEffects(findCard('BS11-112'))).toEqual([{
      kind: 'optional-cost-attack',
      cost: { energy: {}, discardHand: 1 },
      effects: [{
        kind: 'prevent-opponent-on-play',
        duration: 'this-turn',
        minLevel: 2,
      }],
      effectText: expect.any(String),
    }])
  })

  it('maps Venom Dough Cookie draw and attack HP Then', () => {
    expect(convertOfficialCookieSkill(findCard('BS11-113'))).toMatchObject({
      trigger: 'on-play',
      specialPlayCost: {
        trashBattleCookie: { count: 1, energyColor: 'black', level: 1 },
      },
      effects: [{
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'hand-count-at-most', count: 5 },
      }],
    })
    expect(convertOfficialAttackEffects(findCard('BS11-113'))).toEqual([{
      kind: 'optional-cost-attack',
      cost: { energy: {}, discardHand: 1 },
      effects: [{
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      }],
      effectText: expect.any(String),
    }])
  })

  it.each([
    'BS11-111',
    'BS11-111@1',
    'BS11-112',
    'BS11-112@1',
    'BS11-113',
    'BS11-113@1',
  ])('converts %s through the Cookie adapter', (cardNumber) => {
    const result = convertOfficialCardToGameCard(
      findCard(cardNumber),
      `bs11-twenty-fifth-${cardNumber}`,
    )
    expect(result.status).toBe('converted')
    if (result.status !== 'converted') return
    expect(result.gameCard).toMatchObject({
      id: cardNumber.split('@')[0],
      type: 'cookie',
      skill: { trigger: 'on-play' },
    })
  })
})
