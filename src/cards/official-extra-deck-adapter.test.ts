import { describe, expect, it } from 'vitest'
import { convertOfficialCardToExtraDeckCard } from './official-card-adapter'
import type { OfficialCardRecord } from './types'

const extraRecord = (
  overrides: Partial<OfficialCardRecord>,
): OfficialCardRecord => ({
  sourceId: 8005,
  locale: 'en',
  cardNumber: 'BS8-005',
  baseCardNumber: 'BS8-005',
  variant: null,
  name: 'Avatar of Ruin Cookie',
  type: 'extra',
  officialType: 'EXTRA',
  rarity: 'UR',
  grade: 'ULTRA RARE',
  level: 3,
  hp: 5,
  energyType: 'RED',
  color: 'RED',
  skill: {
    name: '{sk} Avatar of Ruin',
    text: 'Can be played if 2 or more of your Cookies fainted this turn. [On Play] Deals 1 damage to all of your opponent\'s Cookies.',
  },
  attackText: '<{R}{R}{R}> Ruinous Flame {da} 3',
  flipText: null,
  keywords: [],
  product: { id: 241, title: 'Land of Fire & Ruin, Realm of Apathy', category: null },
  restrictions: { banned: false, limited: false },
  flags: { enabled: true, hidden: false, extra: true },
  imageUrl: 'https://example.test/bs8-005.webp',
  officialUpdatedAt: '2026-08-01T00:00:00.000Z',
  sourceUrl: 'https://cookierunbraverse.com/data/json/cardList_en.json',
  ...overrides,
})

describe('BS8 official EXTRA card adapter', () => {
  it('converts Avatar of Ruin into a direct-play EXTRA card with its condition and On Play effect', () => {
    const result = convertOfficialCardToExtraDeckCard(extraRecord({}))

    expect(result.status).toBe('converted')
    if (result.status !== 'converted') throw new Error('expected converted extra card')
    expect(result.extraDeckCard).toMatchObject({
      id: 'BS8-005',
      type: 'extra',
      extraDeckPlayMode: 'enter-battle',
      playRequirement: {
        kind: 'cookies-fainted-this-turn-at-least',
        side: 'self',
        count: 2,
      },
      skill: {
        trigger: 'on-play',
        effects: [{ kind: 'damage-all', amount: 1, side: 'opponent', sequential: true,
          target: { side: 'opponent', min: 0, max: 2 } }],
      },
      attack: 3,
      attackEnergyCost: { red: 3 },
    })
  })

  it('converts Dark Cacao into an HP+2 Awakened contract with its On Play cost', () => {
    const result = convertOfficialCardToExtraDeckCard(extraRecord({
      cardNumber: 'BS8-104',
      baseCardNumber: 'BS8-104',
      name: 'Dark Cacao Cookie',
      hp: null,
      color: 'PURPLE',
      energyType: 'PURPLE',
      skill: {
        name: '{sk} Dark Cacao Cookie',
        text: 'During this turn, if [Dark Cacao Cookie] was played from the trash, you can Awaken that Cookie. [On Play] <Discard 1 card.> Return up to 1 {P} card from your trash to your hand.',
      },
      attackText: '<{P}{P}{P}{P}> Sword of Destruction {da} 4',
    }))

    expect(result.status).toBe('converted')
    if (result.status !== 'converted') throw new Error('expected converted extra card')
    expect(result.extraDeckCard).toMatchObject({
      id: 'BS8-104',
      type: 'extra',
      extraDeckPlayMode: 'awaken',
      awakenHpBonus: 2,
      awakenRequirement: {
        targetName: 'Dark Cacao Cookie',
        playedFrom: 'trash',
      },
      hp: 2,
      attack: 4,
      attackEnergyCost: { purple: 4 },
      skill: {
        trigger: 'on-play',
        cost: { energy: {}, discardHand: 1 },
        effects: [{ kind: 'trash-to-hand', max: 1, energyColor: 'purple' }],
      },
    })
  })

  it("converts Golden Cheese's named break-origin Awaken and break-area skill", () => {
    const result = convertOfficialCardToExtraDeckCard(extraRecord({
      cardNumber: 'BS8-027',
      baseCardNumber: 'BS8-027',
      name: 'Golden Cheese Cookie',
      hp: null,
      color: 'YELLOW',
      energyType: 'YELLOW',
      skill: {
        name: '{sk} Radiance of the Immortal',
        text: 'During this turn, if [Golden Cheese Cookie] was played from your break area, you can Awaken that Cookie. If this Cookie is in your break area, <select 1 [Golden Cheese Cookie] in your trash.> Place this Cookie in the trash. Then, place that Cookie in the break area.',
      },
      attackText: '<{Y}{Y}{Y}> Wings of Immortality {da} 3 Then, all of your opponent\'s Cookies receive 1 damage.',
    }))

    expect(result).toMatchObject({
      status: 'converted',
      extraDeckCard: {
        extraDeckPlayMode: 'awaken',
        awakenHpBonus: 2,
        awakenRequirement: {
          targetName: 'Golden Cheese Cookie',
          playedFrom: 'break',
        },
        skill: {
          trigger: 'activate',
          fromBreakArea: true,
          effects: [
            { kind: 'trash-to-break', amount: 1, cardName: 'Golden Cheese Cookie', sourceToTrashFirst: true },
          ],
        },
        attackEffects: [{ kind: 'damage-all', amount: 1, side: 'opponent' }],
      },
    })
  })

  it('converts Peak of Apathy and Will of Nature to their exact direct-play conditions and On Play effects', () => {
    const peak = convertOfficialCardToExtraDeckCard(extraRecord({
      cardNumber: 'BS8-069',
      baseCardNumber: 'BS8-069',
      name: 'Peak of Apathy Cookie',
      hp: 4,
      color: 'GREEN',
      energyType: 'GREEN',
      skill: {
        name: '{sk} Peak of Apathy',
        text: 'Can be played if you have 2 or more fewer cards in your support area than your opponent. [On Play] Place up to 1 Green Cookie from your trash in your support area.',
      },
      attackText: '<{G}{G}{G}> Peak of Apathy {da} 3',
    }))
    const will = convertOfficialCardToExtraDeckCard(extraRecord({
      cardNumber: 'BS8-090',
      baseCardNumber: 'BS8-090',
      name: 'Will of Nature Cookie',
      hp: 5,
      color: 'BLUE',
      energyType: 'BLUE',
      skill: {
        name: '{sk} Will of Nature',
        text: 'Can be played if you have 2 or fewer cards in your hand. [On Play] Return up to 1 of your Blue Level 2 or lower Cookies to your hand.',
      },
      attackText: '<{B}{B}{B}> Will of Nature {da} 3',
    }))

    expect(peak).toMatchObject({
      status: 'converted',
      extraDeckCard: {
        extraDeckPlayMode: 'enter-battle',
        playRequirement: {
          kind: 'support-count-less-than-opponent',
          difference: 2,
        },
        skill: {
          effects: [
            {
              kind: 'trash-to-support',
              amount: 1,
              cookieOnly: false,
              optional: true,
              energyColor: 'green',
              rested: false,
            },
          ],
        },
      },
    })
    expect(will).toMatchObject({
      status: 'converted',
      extraDeckCard: {
        extraDeckPlayMode: 'enter-battle',
        playRequirement: { kind: 'hand-count-at-most', count: 2 },
        skill: {
          effects: [
            {
              kind: 'return-to-hand',
              target: {
                side: 'self',
                min: 0,
                max: 1,
                energyColor: 'blue',
                maxLevel: 2,
              },
            },
          ],
        },
      },
    })
  })

  it('converts the printed attack Then effects for direct and Awakened BS8 EXTRA cards', () => {
    const avatar = convertOfficialCardToExtraDeckCard(extraRecord({
      attackText: '<{R}{R}{R}> Power of the Destroyer {da} 3 Then, all other Cookies receive 1 damage.',
    }))
    const will = convertOfficialCardToExtraDeckCard(extraRecord({
      cardNumber: 'BS8-090',
      baseCardNumber: 'BS8-090',
      name: 'Will of Nature',
      hp: 5,
      color: 'BLUE',
      energyType: 'BLUE',
      skill: {
        name: '{sk} Ring of Life',
        text: 'Can be played if there are 2 cards or less in your hand. [On Play] Return up to 1 Blue Cookie that is LV.2 or lower from your battle area to your hand.',
      },
      attackText: '<{B}{B}{B}> Echoes of Nature {da} 3 Then, draw up to 2 cards from your deck.',
    }))
    const darkCacao = convertOfficialCardToExtraDeckCard(extraRecord({
      cardNumber: 'BS8-104',
      baseCardNumber: 'BS8-104',
      name: 'Dark Cacao Cookie',
      hp: null,
      color: 'PURPLE',
      energyType: 'PURPLE',
      attackText: '<{P}{P}{P}{P}> Judgment {da} 4 Then, select up to 1 of your opponent\'s Cookies. Place 1 card from the top of that Cookie\'s HP into the trash.',
    }))

    expect(avatar).toMatchObject({
      status: 'converted',
      extraDeckCard: {
        attackEffects: [
          { kind: 'damage-all', amount: 1, side: 'either', sequential: true,
            target: { side: 'either', min: 0, max: 4 }, excludeSource: true },
        ],
      },
    })
    expect(will).toMatchObject({
      status: 'converted',
      extraDeckCard: {
        attackEffects: [{ kind: 'draw-up-to', max: 2 }],
      },
    })
    expect(darkCacao).toMatchObject({
      status: 'converted',
      extraDeckCard: {
        attackEffects: [
          {
            kind: 'hp-to-trash',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      },
    })
  })

  it('does not reinterpret normal main-deck cards as EXTRA cards', () => {
    const result = convertOfficialCardToExtraDeckCard(extraRecord({
      type: 'cookie',
      officialType: 'COOKIE',
    }))

    expect(result).toMatchObject({
      status: 'unsupported',
      reason: 'not-extra-card',
    })
  })
})
