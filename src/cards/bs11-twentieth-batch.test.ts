import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCardToGameCard,
  convertOfficialCookieSkill,
  convertOfficialItemAbility,
  convertOfficialStageAbility,
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
  const result = convertOfficialCardToGameCard(findCard(cardNumber), `bs11-twentieth-${cardNumber}`)
  if (result.status !== 'converted') throw new Error(`${cardNumber}: ${result.reason}`)
  return result.gameCard
}

describe('BS11-079 to BS11-083 candidate contract', () => {
  it('preserves the five source cards and the BS11-082 alternate-art record', () => {
    expect(records.filter((card) => /^BS11-0(?:79|80|81|82|83)(?:@1)?$/.test(card.cardNumber)))
      .toHaveLength(6)
    expect(findCard('BS11-079')).toMatchObject({
      cardNumber: 'BS11-079',
      type: 'cookie',
      name: 'Espresso Cookie',
      level: 1,
      hp: 2,
      color: 'PURPLE',
      skill: { text: '【On Play】 <Discard 2 cards.> Play up to 1 {P} Cookie from your trash.' },
    })
    expect(findCard('BS11-080')).toMatchObject({
      type: 'item',
      name: 'Banner of the Solitary Oath',
      skill: { text: '<{P}{P}> If you refreshed 2 or more times during this game, draw 1 card from your deck and select up to 1 of your opponent’s Cookies. That Cookie receives 2 damage.' },
    })
    expect(findCard('BS11-081')).toMatchObject({
      type: 'item',
      name: "Dream Traveler's Hourglass",
      skill: { text: "<{P}{P}> Return all cards from both players' trash to their decks and shuffle them." },
    })
    expect(findCard('BS11-082')).toMatchObject({
      type: 'trap',
      name: "Moonlight's Protection",
      skill: { text: expect.stringContaining('During this turn, that Cookie deals -1 attack damage.') },
    })
    expect(findCard('BS11-082@1')).toMatchObject({
      cardNumber: 'BS11-082@1',
      baseCardNumber: 'BS11-082',
      variant: '1',
      imageUrl: 'https://cookierunbraverse.com/data/en_storage/-oLM-iLRz2j7tcZ23dYcMw.webp',
      name: "Moonlight's Protection",
    })
    expect(findCard('BS11-083')).toMatchObject({
      type: 'stage',
      name: 'Catacombs of Lost Solidarity',
      skill: { text: expect.stringContaining('your opponent\'s Cookies\' 【On Play】 become') },
    })
  })
})

describe('BS11-079 to BS11-083 exact adapters', () => {
  it('maps BS11-079 Espresso Cookie On Play cost and purple trash Cookie deployment', () => {
    expect(convertOfficialCookieSkill(findCard('BS11-079'))).toMatchObject({
      trigger: 'on-play',
      cost: { energy: {}, discardHand: 2 },
      effects: [{ kind: 'trash-to-battle', amount: 1, optional: true, energyColor: 'purple' }],
    })
    expect(converted('BS11-079')).toMatchObject({
      name: 'Espresso Cookie',
      attack: 1,
      attackEnergyCost: { purple: 2 },
    })
  })

  it('maps BS11-080 to a two-Refresh draw and damage pair', () => {
    expect(convertOfficialItemAbility(findCard('BS11-080'))).toMatchObject({
      cost: { purple: 2 },
      effects: [
        { kind: 'draw', amount: 1, condition: { kind: 'refresh-count-during-game-at-least', count: 2 } },
        {
          kind: 'damage',
          amount: 2,
          target: { side: 'opponent', min: 0, max: 1 },
          condition: { kind: 'refresh-count-during-game-at-least', count: 2 },
        },
      ],
    })
  })

  it('maps BS11-081 to moving both discard piles back to their own decks', () => {
    expect(convertOfficialItemAbility(findCard('BS11-081'))).toMatchObject({
      cost: { purple: 2 },
      effects: [{ kind: 'trash-to-deck-all', side: 'both' }],
    })
  })

  it.each(['BS11-082', 'BS11-082@1'] as const)('shares BS11-082 trap mapping for %s', (cardNumber) => {
    expect(convertOfficialTrapAbility(findCard(cardNumber))).toMatchObject({
      cost: { energy: { purple: 1 }, discardHand: 0 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'opponent-discard-hand',
          count: 1,
          destination: 'trash',
          condition: {
            kind: 'any-of',
            conditions: [
              { kind: 'battle-area-has-named-cookie', side: 'self', name: 'Moonlight Cookie' },
              { kind: 'battle-area-has-keyword', side: 'self', keyword: 'ancient' },
            ],
          },
        },
      ],
    })
  })

  it('maps BS11-083 placement, activation cost, and conditional On Play replacement', () => {
    expect(convertOfficialStageAbility(findCard('BS11-083'))).toMatchObject({
      placementCost: { purple: 1 },
      cost: { energy: { purple: 1 }, discardHand: 0, stageSourceToTrash: true },
      effects: [{
        kind: 'replace-opponent-on-play',
        duration: 'this-turn',
        condition: { kind: 'refreshed-during-game' },
        cost: { energy: { neutral: 1 }, discardHand: 0 },
        effects: [{ kind: 'opponent-discard-hand', count: 1, destination: 'trash' }],
      }],
    })
    expect(convertOfficialCardEffects(findCard('BS11-083'))).toMatchObject({
      status: 'unsupported',
    })
    expect(converted('BS11-083')).toMatchObject({
      name: 'Catacombs of Lost Solidarity',
      stageAbility: expect.objectContaining({
        placementCost: { purple: 1 },
        cost: { energy: { purple: 1 }, discardHand: 0, stageSourceToTrash: true },
      }),
    })
  })
})
