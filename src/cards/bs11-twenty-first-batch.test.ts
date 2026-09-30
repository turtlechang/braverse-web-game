import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialAttackEffects,
  convertOfficialCardToGameCard,
  convertOfficialCookieSkill,
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
  const result = convertOfficialCardToGameCard(
    findCard(cardNumber),
    `bs11-twenty-first-${cardNumber}`,
  )
  if (result.status !== 'converted') {
    throw new Error(`${cardNumber}: ${result.reason}`)
  }
  return result.gameCard
}

describe('BS11-084 to BS11-088 candidate contract', () => {
  it('preserves the five base cards and their four official variants', () => {
    expect(records.filter((card) => /^BS11-0(?:84|85|86|87|88)(?:@1)?$/.test(card.cardNumber)))
      .toHaveLength(9)
    expect(findCard('BS11-084')).toMatchObject({
      type: 'trap',
      name: 'Freedom that Broke the Silence',
      energyType: 'PURPLE',
      skill: {
        text: expect.stringContaining('if you refreshed during this game'),
      },
    })
    expect(findCard('BS11-085')).toMatchObject({
      type: 'cookie',
      name: 'Salt Cellar Cookie',
      level: 1,
      hp: 2,
      energyType: 'PURPLE',
      skill: {
        text: expect.stringContaining('Place this Cookie in your trash'),
      },
    })
    expect(findCard('BS11-086')).toMatchObject({
      type: 'cookie',
      name: 'Crunchy Chip Cookie',
      attackText: expect.stringContaining('[Dark Cacao Cookie]'),
    })
    expect(findCard('BS11-087')).toMatchObject({
      type: 'cookie',
      name: 'Dark Cacao Cookie',
      level: 2,
      hp: 4,
      keywords: ['ANCIENT'],
      skill: {
        text: expect.stringContaining('played from your trash'),
      },
    })
    expect(findCard('BS11-088')).toMatchObject({
      type: 'cookie',
      name: 'Moonlight Cookie',
      level: 2,
      hp: 5,
      skill: {
        text: expect.stringContaining('LV.2 or higher from your trash to your hand'),
      },
    })
    expect(findCard('BS11-085@1').imageUrl).not.toBe(findCard('BS11-085').imageUrl)
    expect(findCard('BS11-086@1').imageUrl).not.toBe(findCard('BS11-086').imageUrl)
    expect(findCard('BS11-087@1').imageUrl).not.toBe(findCard('BS11-087').imageUrl)
    expect(findCard('BS11-088@1').imageUrl).not.toBe(findCard('BS11-088').imageUrl)
  })
})

describe('BS11-084 to BS11-088 exact adapters', () => {
  it('maps BS11-084 Refresh-gated trap draw without gating trap activation', () => {
    expect(convertOfficialTrapAbility(findCard('BS11-084'))).toMatchObject({
      cost: { energy: { purple: 1 }, discardHand: 0 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'draw-up-to',
          max: 1,
          condition: { kind: 'refreshed-during-game' },
        },
      ],
    })
  })

  it('maps BS11-085 source-to-trash cost and purple LV.2-or-lower target', () => {
    expect(convertOfficialCookieSkill(findCard('BS11-085'))).toMatchObject({
      trigger: 'activate',
      cost: { energy: { purple: 1 }, discardHand: 0, selfToTrash: true },
      effects: [{
        kind: 'field-to-trash',
        target: { side: 'self', min: 0, max: 1, maxLevel: 2, energyColor: 'purple' },
      }],
    })
  })

  it('maps BS11-086 attack Then to the named Dark Cacao Cookie', () => {
    expect(convertOfficialAttackEffects(findCard('BS11-086'))).toEqual([{
      kind: 'trash-to-battle',
      amount: 1,
      optional: true,
      cardName: 'Dark Cacao Cookie',
    }])
    expect(converted('BS11-086')).toMatchObject({
      attack: 2,
      attackEnergyCost: { purple: 2 },
      attackEffects: [{ kind: 'trash-to-battle', cardName: 'Dark Cacao Cookie' }],
    })
  })

  it('maps BS11-087 trash-entry HP bonus and conditional random discard', () => {
    expect(convertOfficialCookieSkill(findCard('BS11-087'))).toMatchObject({
      trigger: 'on-play',
      fromTrashArea: true,
      effects: [{
        kind: 'gain-hp',
        amount: 2,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      }],
    })
    expect(convertOfficialAttackEffects(findCard('BS11-087'))).toMatchObject([{
      kind: 'opponent-random-discard',
      count: 1,
      condition: {
        kind: 'any-of',
        conditions: [
          {
            kind: 'battle-area-has-keyword',
            side: 'self',
            keyword: 'ancient',
            excludeSource: true,
          },
          { kind: 'trash-count-at-least', count: 15 },
        ],
      },
    }])
  })

  it('maps BS11-088 LV.1 battle cost and purple LV.2-or-higher recovery', () => {
    expect(convertOfficialCookieSkill(findCard('BS11-088'))).toMatchObject({
      trigger: 'on-play',
      cost: {
        energy: {},
        discardHand: 0,
        trashBattleCookie: { count: 1, level: 1, energyColor: 'purple' },
      },
      effects: [
        {
          kind: 'trash-to-hand',
          max: 1,
          minLevel: 2,
          energyColor: 'purple',
          cookieOnly: true,
        },
      ],
    })
  })
})
