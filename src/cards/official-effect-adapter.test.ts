import { describe, expect, it } from 'vitest'
import officialSample from '../../data/cards/official-sample.en.json'
import officialYellowSample from '../../data/cards/official-starter-deck-yellow.en.json'
import officialGreenSample from '../../data/cards/official-starter-deck-green.en.json'
import officialBlueSample from '../../data/cards/official-starter-deck-blue.en.json'
import officialPurpleSample from '../../data/cards/official-starter-deck-purple.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCardEffectSet,
  convertOfficialCookieSkill,
  convertOfficialFlipAbility,
  convertOfficialItemAbility,
  convertOfficialStageAbility,
  convertOfficialTrapAbility,
  type OfficialCardRecord,
} from '.'

const cards = officialSample.cards as OfficialCardRecord[]
const yellowCards = officialYellowSample.cards as OfficialCardRecord[]
const greenCards = officialGreenSample.cards as OfficialCardRecord[]
const blueCards = officialBlueSample.cards as OfficialCardRecord[]
const purpleCards = officialPurpleSample.cards as OfficialCardRecord[]

const findCard = (cardNumber: string) => {
  const card = cards.find((candidate) => candidate.cardNumber === cardNumber)

  if (!card) {
    throw new Error(`Missing official sample card ${cardNumber}`)
  }

  return card
}

const findYellowCard = (cardNumber: string) => {
  const card = yellowCards.find(
    (candidate) => candidate.cardNumber === cardNumber,
  )

  if (!card) {
    throw new Error(`Missing yellow sample card ${cardNumber}`)
  }

  return card
}

const findGreenCard = (cardNumber: string) => {
  const card = greenCards.find(
    (candidate) => candidate.cardNumber === cardNumber,
  )

  if (!card) {
    throw new Error(`Missing green sample card ${cardNumber}`)
  }

  return card
}

const findBlueCard = (cardNumber: string) => {
  const card = blueCards.find(
    (candidate) => candidate.cardNumber === cardNumber,
  )

  if (!card) {
    throw new Error(`Missing blue sample card ${cardNumber}`)
  }

  return card
}

const findPurpleCard = (cardNumber: string) => {
  const card = purpleCards.find(
    (candidate) => candidate.cardNumber === cardNumber,
  )

  if (!card) {
    throw new Error(`Missing purple sample card ${cardNumber}`)
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
      trigger: 'on-play',
      oncePerTurn: false,
      yourTurn: false,
      cost: { energy: { red: 1 }, discardHand: 0 },
    })
    expect(convertOfficialCookieSkill(findCard('ST1-003'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: { red: 2, neutral: 2 }, discardHand: 0 },
    })
    expect(convertOfficialCookieSkill(findCard('ST1-008'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      restSource: true,
      cost: { energy: { red: 2 }, discardHand: 0 },
    })
    expect(convertOfficialCookieSkill(findCard('ST1-009'))).toMatchObject({
      trigger: 'passive',
      yourTurn: true,
      cost: { energy: {}, discardHand: 0 },
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

    expect(supported).toHaveLength(12)
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
      ]),
    )
    expect(princess).toMatchObject({
      status: 'unsupported',
      reason: 'unsupported-effect-text',
    })
  })

  describe('Starter Deck YELLOW effect regression', () => {
    it('imports all 20 distinct YELLOW cards', () => {
      expect(yellowCards).toHaveLength(20)
      expect(new Set(yellowCards.map((c) => c.cardNumber)).size).toBe(20)
      expect(
        yellowCards.every((c) => c.product.title === 'Starter Deck YELLOW'),
      ).toBe(true)
    })

    it('supports YELLOW cookie, item, and trap effects', () => {
      const conversions = convertOfficialCardEffectSet(yellowCards)
      const supported = conversions.filter(
        (c) => c.status === 'supported',
      )

      expect(supported).toHaveLength(9)
      expect(supported.map((c) => c.cardNumber).sort()).toEqual(
        [
          'ST2-001',
          'ST2-004',
          'ST2-008',
          'ST2-010',
          'ST2-011',
          'ST2-016',
          'ST2-018',
          'ST2-019',
          'ST2-020',
        ].sort(),
      )
    })

    it('ST2-004 Macaron Cookie gain-hp on other cookie is supported', () => {
      expect(
        convertOfficialCardEffects(findYellowCard('ST2-004')),
      ).toMatchObject({
        status: 'supported',
        cardNumber: 'ST2-004',
        effects: [
          {
            kind: 'gain-hp',
            amount: 1,
            target: { side: 'self', min: 0, max: 1, excludeSource: true },
          },
        ],
      })
    })

    it('ST2-011 Cherry Cookie faint damage is supported', () => {
      expect(
        convertOfficialCardEffects(findYellowCard('ST2-011')),
      ).toMatchObject({
        status: 'supported',
        cardNumber: 'ST2-011',
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      })
    })

    it('ST2-001 Roguefort Cookie opponent-discard-hand is supported', () => {
      const conversion = convertOfficialCardEffects(findYellowCard('ST2-001'))
      expect(conversion).toMatchObject({
        status: 'supported',
        cardNumber: 'ST2-001',
        effects: [{ kind: 'opponent-discard-hand', count: 1 }],
      })

      const skill = convertOfficialCookieSkill(findYellowCard('ST2-001'))
      expect(skill).toMatchObject({
        trigger: 'on-play',
        oncePerTurn: false,
        cost: { energy: { yellow: 1 }, discardHand: 0 },
        effects: [{ kind: 'opponent-discard-hand', count: 1 }],
      })
    })

    it('ST2-016 Flimsy Screwdriver item has disable-flip effect', () => {
      expect(
        convertOfficialCardEffects(findYellowCard('ST2-016')),
      ).toMatchObject({
        status: 'supported',
        cardNumber: 'ST2-016',
        effects: [
          {
            kind: 'disable-flip',
            duration: 'this-turn',
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      })
    })

    it('ST2-021 Pretzel Snare trap ability parses cost, condition, and damage', () => {
      const conversion = convertOfficialTrapAbility(findYellowCard('ST2-021'))
      expect(conversion).toMatchObject({
        cost: { energy: { yellow: 2 }, discardHand: 0 },
        condition: { kind: 'attacker-attack-more-than', amount: 4 },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      })
    })

    it('ST2-011 faint damage targets opponent with min 0 max 1', () => {
      const conversion =
        convertOfficialCardEffects(findYellowCard('ST2-011'))

      expect(conversion.status).toBe('supported')
      expect(conversion).toMatchObject({
        effects: [
          {
            kind: 'damage',
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      })
    })

    it('ST2-008 Eclair Cookie break-to-trash OnPlay effect is supported', () => {
      const conversion =
        convertOfficialCardEffects(findYellowCard('ST2-008'))

      expect(conversion).toMatchObject({
        status: 'supported',
        cardNumber: 'ST2-008',
        effects: [
          {
            kind: 'break-to-trash',
            max: 1,
            exactLevel: 1,
          },
        ],
      })
      if (conversion.status === 'supported') {
        expect(conversion.effects[0]).not.toHaveProperty('condition')
      }
    })

    it('ST2-010 Purple Yam Cookie break-to-trash with condition is supported', () => {
      const conversion =
        convertOfficialCardEffects(findYellowCard('ST2-010'))

      expect(conversion).toMatchObject({
        status: 'supported',
        cardNumber: 'ST2-010',
        effects: [
          {
            kind: 'break-to-trash',
            max: 1,
            exactLevel: 1,
            condition: {
              kind: 'break-level-at-least',
              level: 6,
            },
          },
        ],
      })
    })

    it('ST2-008 Eclair Cookie skill parsing returns correct trigger and cost', () => {
      const skill = convertOfficialCookieSkill(findYellowCard('ST2-008'))

      expect(skill).toMatchObject({
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { yellow: 2 }, discardHand: 0 },
        effects: [{ kind: 'break-to-trash', max: 1, exactLevel: 1 }],
      })
    })

    it('ST2-010 Purple Yam Cookie skill parsing returns correct trigger and cost', () => {
      const skill = convertOfficialCookieSkill(findYellowCard('ST2-010'))

      expect(skill).toMatchObject({
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { yellow: 1 }, discardHand: 0 },
        effects: [
          {
            kind: 'break-to-trash',
            max: 1,
            exactLevel: 1,
            condition: { kind: 'break-level-at-least', level: 6 },
          },
        ],
      })
    })

    it('rejects break-to-trash text with Then (compound effect)', () => {
      const card = {
        ...findYellowCard('ST2-008'),
        skill: {
          name: null,
          text: '{ap} Select up to 1 LV.1 card from your break area and place it in the trash. Then, draw 1 card.',
        },
      }

      expect(convertOfficialCardEffects(card)).toMatchObject({
        status: 'unsupported',
        reason: 'unsupported-effect-text',
      })
    })

    it('ST2-015 has no skill text (no-effect-text)', () => {
      expect(
        convertOfficialCardEffects(findYellowCard('ST2-015')),
      ).toMatchObject({
        status: 'unsupported',
        reason: 'no-effect-text',
      })
    })
  })

  describe('Starter Deck GREEN effect regression', () => {
    it('imports all 22 distinct GREEN cards', () => {
      expect(greenCards).toHaveLength(22)
      expect(new Set(greenCards.map((c) => c.cardNumber)).size).toBe(22)
      expect(
        greenCards.every((c) => c.product.title === 'Starter Deck GREEN'),
      ).toBe(true)
    })

    it('supports GREEN cookie and item effects', () => {
      const conversions = convertOfficialCardEffectSet(greenCards)
      const supported = conversions.filter(
        (c) => c.status === 'supported',
      )

      expect(supported).toHaveLength(10)
      expect(supported.map((c) => c.cardNumber)).toEqual([
        'ST3-001',
        'ST3-002',
        'ST3-004',
        'ST3-005',
        'ST3-009',
        'ST3-010',
        'ST3-015',
        'ST3-016',
        'ST3-017',
        'ST3-018',
      ])
    })

    it('ST3-001 Muscle Cookie gain-hp is supported', () => {
      expect(
        convertOfficialCardEffects(findGreenCard('ST3-001')),
      ).toMatchObject({
        status: 'supported',
        cardNumber: 'ST3-001',
        effects: [
          {
            kind: 'gain-hp',
            amount: 1,
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      })
    })

    it('ST3-002 Strawberry Crepe Cookie is supported', () => {
      expect(
        convertOfficialCardEffects(findGreenCard('ST3-002')),
      ).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      })
    })

    it.each([
      ['ST3-002', 'damage'],
      ['ST3-005', 'damage'],
      ['ST3-015', 'modify-attack'],
    ] as const)(
      '%s parses the support-to-trash skill cost',
      (cardNumber, effectKind) => {
        expect(
          convertOfficialCookieSkill(findGreenCard(cardNumber)),
        ).toMatchObject({
          trigger: 'activate',
          oncePerTurn: true,
          cost: {
            energy: {},
            discardHand: 0,
            supportToTrash: 1,
          },
          effects: [{ kind: effectKind }],
        })
      },
    )

    it('supports ST3-004 Vampire Cookie OnPlay damage and gain-hp', () => {
      expect(
        convertOfficialCardEffects(findGreenCard('ST3-004')),
      ).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1 },
          },
          {
            kind: 'gain-hp',
            amount: 1,
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      })
    })

    it('ST3-004 Vampire Cookie skill parses as OnPlay with GGGN cost', () => {
      const skill = convertOfficialCookieSkill(findGreenCard('ST3-004'))

      expect(skill).toMatchObject({
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { green: 3, neutral: 1 }, discardHand: 0 },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1 },
          },
          {
            kind: 'gain-hp',
            amount: 1,
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      })
    })

    it('ST3-005 Blackberry Cookie is supported', () => {
      expect(
        convertOfficialCardEffects(findGreenCard('ST3-005')),
      ).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      })
    })

    it('ST3-015 Chili Pepper Cookie is supported', () => {
      expect(
        convertOfficialCardEffects(findGreenCard('ST3-015')),
      ).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      })
    })

    it('supports ST3-017 compound damage and support discard', () => {
      expect(
        convertOfficialCardEffects(findGreenCard('ST3-017')),
      ).toMatchObject({
        status: 'supported',
        effects: [
          { kind: 'damage', amount: 1 },
          { kind: 'support-to-trash', amount: 1 },
        ],
      })
    })

    it('rejects ST3-019 (compound effect with Then)', () => {
      expect(
        convertOfficialCardEffects(findGreenCard('ST3-019')),
      ).toMatchObject({
        status: 'unsupported',
        reason: 'unsupported-effect-text',
      })
    })

    it('ST3-010 Aloe Cookie deck-to-support is supported', () => {
      const conversion = convertOfficialCardEffects(findGreenCard('ST3-010'))

      expect(conversion).toMatchObject({
        status: 'supported',
        cardNumber: 'ST3-010',
        effects: [{ kind: 'deck-to-support', amount: 1 }],
      })
    })

    it('ST3-010 Aloe Cookie skill parsing', () => {
      const skill = convertOfficialCookieSkill(findGreenCard('ST3-010'))

      expect(skill).toMatchObject({
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { green: 2 }, discardHand: 0 },
        text: '{ap} 《{G}{G}》 Take 1 card from the top your deck and place it in your support area as active.',
        effects: [{ kind: 'deck-to-support', amount: 1 }],
      })
    })

    it('ST3-016 Ancient Healer\'s Gaze item has battle-to-support effect', () => {
      expect(
        convertOfficialCardEffects(findGreenCard('ST3-016')),
      ).toMatchObject({
        status: 'supported',
        cardNumber: 'ST3-016',
        effects: [
          {
            kind: 'battle-to-support',
            target: { side: 'self', min: 1, max: 1, maxLevel: 2 },
          },
        ],
      })
    })

    it('ST3-018 Parsley Tea of Invigoration item has trash-to-battle effect', () => {
      expect(
        convertOfficialCardEffects(findGreenCard('ST3-018')),
      ).toMatchObject({
        status: 'supported',
        cardNumber: 'ST3-018',
        effects: [{ kind: 'trash-to-battle', amount: 1 }],
      })
    })
  })

  describe('stage ability adapter', () => {
    it('ST3-022 Guardian Tree\'s Blessing stage ability has support-to-hand and draw', () => {
      const ability = convertOfficialStageAbility(findGreenCard('ST3-022'))

      expect(ability).toMatchObject({
        placementCost: { green: 1 },
        effects: [
          { kind: 'support-to-hand', amount: 1 },
          { kind: 'draw', amount: 1 },
        ],
        restSource: true,
      })
    })
  })

  describe('draw effect adapter', () => {
    const makeCard = (
      overrides: Partial<OfficialCardRecord>,
    ): OfficialCardRecord =>
      ({
        sourceId: 0,
        locale: 'en',
        cardNumber: 'TEST-001',
        baseCardNumber: 'TEST-001',
        variant: null,
        name: 'Test Card',
        type: 'item',
        officialType: 'Item',
        rarity: null,
        grade: null,
        level: null,
        hp: null,
        energyType: null,
        color: null,
        skill: { name: null, text: null },
        attackText: null,
        flipText: null,
        keywords: [],
        product: { id: null, title: null, category: null },
        restrictions: { banned: false, limited: false },
        flags: { enabled: true, hidden: false, extra: false },
        imageUrl: '',
        officialUpdatedAt: null,
        sourceUrl: '',
        ...overrides,
      }) as OfficialCardRecord

    it('parses Draw 1 card from item attack text', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'item',
            attackText: '{Y} Draw 1 card from your deck.',
          }),
        ),
      ).toMatchObject({
        status: 'supported',
        effects: [{ kind: 'draw', amount: 1 }],
      })
    })

    it('parses Draw up to 1 card from stage attack text', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'stage',
            attackText:
              'Draw up to 1 card from your deck.',
          }),
        ),
      ).toMatchObject({
        status: 'supported',
        effects: [{ kind: 'draw', amount: 1 }],
      })
    })

    it('parses draw from cookie skill text (OnPlay/Activate)', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'cookie',
            skill: {
              name: null,
              text: '{mob}{t1} {R} Draw 1 card from your deck.',
            },
            attackText: '{R} Deals 1 damage.',
          }),
        ),
      ).toMatchObject({
        status: 'supported',
        effects: [{ kind: 'draw', amount: 1 }],
      })
    })

    it('exposes cookie discard-hand costs so payment can be handled by game logic', () => {
      const card = makeCard({
        type: 'cookie',
        skill: {
          name: null,
          text: '{mob} 《Discard 1 card.》 Draw 1 card from your deck.',
        },
        attackText: '{R} Deals 1 damage.',
      })

      expect(convertOfficialCardEffects(card)).toMatchObject({
        status: 'supported',
      })
      expect(convertOfficialCookieSkill(card)).toMatchObject({
        trigger: 'activate',
        cost: { discardHand: 1 },
        effects: [{ kind: 'draw', amount: 1 }],
      })
    })

    it('does not drop unsupported special costs from item abilities', () => {
      const card = makeCard({
        type: 'item',
        attackText:
          '《Discard 1 card.》 Draw 1 card from your deck.',
      })

      expect(convertOfficialCardEffects(card)).toMatchObject({
        status: 'supported',
      })
      expect(convertOfficialItemAbility(card)).toBeUndefined()
    })

    it('rejects draw text from flip card type', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'flip',
            attackText: '{R} Deals 1 damage.',
            flipText:
              'Draw up to 1 card from your deck.',
          }),
        ),
      ).toMatchObject({
        status: 'unsupported',
        reason: 'unsupported-effect-text',
      })
    })

    it('draw amount parses correctly for multiple cards', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'item',
            attackText: 'Draw 3 cards from your deck.',
          }),
        ),
      ).toMatchObject({
        status: 'supported',
        effects: [{ kind: 'draw', amount: 3 }],
      })
    })

    it('supports ST2-018 draw followed by optional HP viewing', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'item',
            cardNumber: 'ST2-018',
            attackText:
              '《{Y}》 Draw 1 card from your deck. Then, select up to 1 of your Cookies and view all its HP cards. (You cannot switch the order of HP cards.)',
          }),
        ),
      ).toMatchObject({
        status: 'supported',
        effects: [
          { kind: 'draw', amount: 1 },
          { kind: 'view-hp', optional: true },
        ],
      })
    })

    it('rejects ST3-022 conditional draw with If you did and support area (unsupported)', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'stage',
            cardNumber: 'ST3-022',
            attackText:
              '《{G}》 Place in your stage area.\r\n\r\n{mob} 《Rest this card.》 Take 1 card from your support area to your hand. If you did, you can draw 1 card from your deck.',
          }),
        ),
      ).toMatchObject({
        status: 'unsupported',
        reason: 'unsupported-effect-text',
      })
    })

    it('rejects draw + Then compound effect (unsupported)', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'item',
            attackText: 'Draw 1 card from your deck. Then, deal 1 damage.',
          }),
        ),
      ).toMatchObject({
        status: 'unsupported',
        reason: 'unsupported-effect-text',
      })
    })

    it('rejects draw + If you did compound effect (unsupported)', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'item',
            attackText: 'Draw 1 card from your deck. If you did, deal 1 damage.',
          }),
        ),
      ).toMatchObject({
        status: 'unsupported',
        reason: 'unsupported-effect-text',
      })
    })
  })

  describe('deck-to-support effect adapter', () => {
    const makeCard = (
      overrides: Partial<OfficialCardRecord>,
    ): OfficialCardRecord =>
      ({
        sourceId: 0,
        locale: 'en',
        cardNumber: 'TEST-001',
        baseCardNumber: 'TEST-001',
        variant: null,
        name: 'Test Card',
        type: 'cookie',
        officialType: 'COOKIE',
        rarity: null,
        grade: null,
        level: 1,
        hp: 1,
        energyType: null,
        color: null,
        skill: { name: null, text: null },
        attackText: null,
        flipText: null,
        keywords: [],
        product: { id: null, title: null, category: null },
        restrictions: { banned: false, limited: false },
        flags: { enabled: true, hidden: false, extra: false },
        imageUrl: '',
        officialUpdatedAt: null,
        sourceUrl: '',
        ...overrides,
      }) as OfficialCardRecord

    it('parses Take 1 card from top deck to support area', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            cardNumber: 'ST3-010',
            skill: {
              name: null,
              text: '{ap} 《{G}{G}》 Take 1 card from the top your deck and place it in your support area as active.',
            },
            attackText: '《{G}》 Deals 1 damage.',
          }),
        ),
      ).toMatchObject({
        status: 'supported',
        cardNumber: 'ST3-010',
        effects: [{ kind: 'deck-to-support', amount: 1 }],
      })
    })

    it('rejects deck-to-support with Then compound (unsupported)', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'cookie',
            skill: {
              name: null,
              text: '{ap} Take 1 card from the top your deck and place it in your support area as active. Then, draw 1 card.',
            },
            attackText: 'Deals 1 damage.',
          }),
        ),
      ).toMatchObject({
        status: 'unsupported',
        reason: 'unsupported-effect-text',
      })
    })

    it('rejects deck-to-support with If you did compound (unsupported)', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'cookie',
            skill: {
              name: null,
              text: '{ap} Take 1 card from the top your deck and place it in your support area as active. If you did, gain +1 HP.',
            },
            attackText: 'Deals 1 damage.',
          }),
        ),
      ).toMatchObject({
        status: 'unsupported',
        reason: 'unsupported-effect-text',
      })
    })

    it('rejects deck-to-support from flip card type (unsupported)', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'flip',
            attackText: 'Deals 1 damage.',
            flipText: 'Take 1 card from the top your deck and place it in your support area as active.',
          }),
        ),
      ).toMatchObject({
        status: 'unsupported',
        reason: 'unsupported-effect-text',
      })
    })

    it('rejects draw text that partially resembles deck-to-support (unsupported)', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'item',
            attackText: 'Take 1 card from the top your deck.',
          }),
        ),
      ).toMatchObject({
        status: 'unsupported',
        reason: 'unsupported-effect-text',
      })
    })
  })

  describe('Starter Deck BLUE trap costs', () => {
    it('parses ST4-020 energy and discard-hand costs', () => {
      expect(convertOfficialTrapAbility(findBlueCard('ST4-020'))).toMatchObject({
        cost: { energy: { blue: 1 }, discardHand: 2 },
        effects: [
          {
            kind: 'modify-attack',
            amount: -3,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
    })
  })

  describe('Starter Deck PURPLE official effect adapter', () => {
    it('imports all 22 distinct starter deck cards', () => {
      expect(purpleCards).toHaveLength(22)
      expect(new Set(purpleCards.map((card) => card.cardNumber)).size).toBe(22)
      expect(
        purpleCards.every(
          (card) => card.product.title === 'Starter Deck PURPLE',
        ),
      ).toBe(true)
    })

    it('ST5-001 Madeleine Cookie converts to field-to-trash with allowStage', () => {
      expect(convertOfficialCookieSkill(findPurpleCard('ST5-001'))).toMatchObject({
        trigger: 'on-play',
        effects: [
          {
            kind: 'field-to-trash',
            target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 },
            allowStage: true,
          },
        ],
      })
    })

    it('ST5-003 Fig Cookie converts to flip draw up to 1', () => {
      expect(convertOfficialFlipAbility(findPurpleCard('ST5-003'))).toMatchObject({
        effects: [{ kind: 'draw-up-to', max: 1 }],
      })
    })

    it('ST5-004 Skater Cookie converts to faint opponent-discard-hand', () => {
      expect(convertOfficialCookieSkill(findPurpleCard('ST5-004'))).toMatchObject({
        faint: true,
        effects: [{ kind: 'opponent-discard-hand', count: 1 }],
      })
    })

    it('ST5-006 String Gummy Cookie converts to field-to-trash with allowStage', () => {
      expect(convertOfficialCookieSkill(findPurpleCard('ST5-006'))).toMatchObject({
        trigger: 'on-play',
        effects: [
          {
            kind: 'field-to-trash',
            target: { side: 'opponent', min: 1, max: 1, maxLevel: 2 },
            allowStage: true,
          },
        ],
      })
    })

    it('ST5-007 Yoga Cookie converts to activate field-to-trash', () => {
      const result = convertOfficialCookieSkill(findPurpleCard('ST5-007'))
      expect(result).toMatchObject({
        trigger: 'activate',
        effects: [
          {
            kind: 'field-to-trash',
            target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 },
            allowStage: true,
          },
        ],
      })
      expect(result?.cost.discardHand).toBe(1)
    })

    it('ST5-008 Fairy Cookie converts to flip gain-hp', () => {
      expect(convertOfficialFlipAbility(findPurpleCard('ST5-008'))).toMatchObject({
        effects: [{ kind: 'gain-hp', amount: 1 }],
      })
    })

    it('ST5-010 Carol Cookie converts to field-to-trash with remainingHp', () => {
      expect(convertOfficialCookieSkill(findPurpleCard('ST5-010'))).toMatchObject({
        trigger: 'on-play',
        effects: [
          {
            kind: 'field-to-trash',
            target: { side: 'opponent', min: 1, max: 1, remainingHp: 2 },
          },
        ],
      })
    })

    it('ST5-013 Pilot Cookie converts to modify-attack with trashBattleCookie cost', () => {
      const result = convertOfficialCookieSkill(findPurpleCard('ST5-013'))
      expect(result).toMatchObject({
        trigger: 'activate',
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      })
      expect(result?.cost.trashBattleCookie).toEqual({
        count: 1,
        level: 1,
        energyColor: 'purple',
      })
    })

    it('ST5-015 Rye Cookie converts to field-to-trash without conditions', () => {
      expect(convertOfficialCookieSkill(findPurpleCard('ST5-015'))).toMatchObject({
        trigger: 'on-play',
        effects: [
          {
            kind: 'field-to-trash',
            target: { side: 'opponent', min: 1, max: 1 },
          },
        ],
      })
    })

    it('ST5-016 BONUS Coin converts to conditional draw-up-to', () => {
      expect(convertOfficialItemAbility(findPurpleCard('ST5-016'))).toMatchObject({
        effects: [
          {
            kind: 'draw-up-to',
            max: 2,
            condition: { kind: 'opponent-trash-count-at-least', count: 30 },
          },
        ],
      })
    })

    it('ST5-017 Violet Dragonspout converts to opponent-random-discard', () => {
      expect(convertOfficialItemAbility(findPurpleCard('ST5-017'))).toMatchObject({
        effects: [{ kind: 'opponent-random-discard', count: 1 }],
      })
    })

    it('ST5-018 Dragonfly Candy Brooch converts to field-to-trash with remainingHp', () => {
      expect(convertOfficialItemAbility(findPurpleCard('ST5-018'))).toMatchObject({
        effects: [
          {
            kind: 'field-to-trash',
            target: { side: 'opponent', min: 1, max: 1, remainingHp: 4 },
          },
        ],
      })
    })

    it('ST5-019 Pastry Boomerang converts to damage + draw', () => {
      expect(convertOfficialItemAbility(findPurpleCard('ST5-019'))).toMatchObject({
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
            condition: { kind: 'opponent-trash-count-at-least', count: 20 },
          },
          {
            kind: 'draw-up-to',
            max: 1,
            condition: { kind: 'opponent-trash-count-at-least', count: 20 },
          },
        ],
      })
    })

    it('ST5-020 Forbidden Grimoire converts to trap with modify-attack', () => {
      const result = convertOfficialTrapAbility(findPurpleCard('ST5-020'))
      expect(result).toBeDefined()
      expect(result?.effects).toContainEqual(
        expect.objectContaining({
          kind: 'modify-attack',
          amount: -3,
        }),
      )
      expect(result?.cost.trashBattleCookie).toEqual({
        count: 1,
        level: 1,
        energyColor: 'purple',
      })
    })

    it('ST5-021 Hidden Warpgate converts to trap with field-to-trash', () => {
      const result = convertOfficialTrapAbility(findPurpleCard('ST5-021'))
      expect(result).toBeDefined()
      expect(result?.effects).toContainEqual(
        expect.objectContaining({
          kind: 'field-to-trash',
          target: expect.objectContaining({
            side: 'opponent',
            min: 1,
            max: 1,
            remainingHp: 2,
          }),
        }),
      )
    })

    it('ST5-022 Windswept Valley converts to stage with draw', () => {
      expect(convertOfficialStageAbility(findPurpleCard('ST5-022'))).toMatchObject({
        effects: [{ kind: 'draw', amount: 1 }],
        restSource: true,
        triggered: true,
      })
    })
  })
})
})
