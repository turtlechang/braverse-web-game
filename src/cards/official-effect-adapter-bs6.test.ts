import { describe, expect, it } from 'vitest'
import officialBs6Formal from '../../data/cards/official-age-of-heroes-and-kingdoms-bs6.en.json'
import {
  convertOfficialAttackEffects,
  convertOfficialCardToGameCard,
  convertOfficialCardEffects,
  convertOfficialCookieSkill,
  convertOfficialFlipAbility,
  convertOfficialItemAbility,
  convertOfficialStageAbility,
  convertOfficialTrapAbility,
  type OfficialCardRecord,
} from '.'

const bs6Cards = officialBs6Formal.cards as OfficialCardRecord[]

const findBs6Card = (cardNumber: string): OfficialCardRecord => {
  const card = bs6Cards.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`missing BS6 formal fixture: ${cardNumber}`)
  return card
}

const attachedHpBonusFlips = [
  'BS6-006',
  'BS6-037',
  'BS6-046',
  'BS6-069',
  'BS6-103',
]

const drawOneFlips = [
  'BS6-009',
  'BS6-027',
  'BS6-056',
  'BS6-067',
  'BS6-104',
]

describe('BS6 attack definition normalization', () => {
  it('converts the six official records whose API omitted the attack damage marker', () => {
    const expectedAttacks = {
      'BS6-018': 1,
      'BS6-040': 3,
      'BS6-061': 2,
      'BS6-061@1': 2,
      'BS6-083': 2,
      'BS6-104': 2,
    }

    for (const [cardNumber, attack] of Object.entries(expectedAttacks)) {
      const result = convertOfficialCardToGameCard(findBs6Card(cardNumber))

      expect(result, cardNumber).toMatchObject({
        status: 'converted',
        gameCard: { attack },
      })
    }
  })
})

describe('BS6 basic FLIP effect adapter', () => {
  it.each(attachedHpBonusFlips)(
    '%s converts the discard cost and attached +1 HP bonus',
    (cardNumber) => {
      expect(convertOfficialCardEffects(findBs6Card(cardNumber))).toMatchObject({
        status: 'supported',
        effects: [],
      })
      expect(convertOfficialFlipAbility(findBs6Card(cardNumber))).toMatchObject({
        cost: { energy: {}, discardHand: 1 },
        effects: [],
        attachedHpBonus: 1,
      })
    },
  )

  it.each(drawOneFlips)('%s converts draw up to 1', (cardNumber) => {
    expect(convertOfficialCardEffects(findBs6Card(cardNumber))).toMatchObject({
      status: 'supported',
      effects: [{ kind: 'draw-up-to', max: 1 }],
    })
    expect(convertOfficialFlipAbility(findBs6Card(cardNumber))).toMatchObject({
      cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'draw-up-to', max: 1 }],
    })
  })
})

describe('BS6 RED effect adapter', () => {
  it('BS6-001, BS6-004, and BS6-014 select a legal HP payment source before resolving', () => {
    expect(convertOfficialCookieSkill(findBs6Card('BS6-001'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: {
        energy: {},
        discardHand: 0,
        hpToTrash: { amount: 2, energyColor: 'red' },
      },
      effects: [
        {
          kind: 'modify-attack',
          amount: 1,
          duration: 'this-turn',
          target: { side: 'self', min: 0, max: 1 },
        },
      ],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-004'))).toMatchObject({
      trigger: 'on-play',
      cost: {
        energy: {},
        discardHand: 0,
        hpToTrash: { amount: 1, energyColor: 'red' },
      },
      effects: [{ kind: 'draw-up-to', max: 2 }],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-014'))).toMatchObject({
      trigger: 'on-play',
      cost: { energy: {}, discardHand: 0, hpToTrash: { amount: 2 } },
      effects: [
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        },
      ],
    })
  })

  it('BS6-002 activates once per turn only at 2 HP or less', () => {
    expect(convertOfficialCookieSkill(findBs6Card('BS6-002'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: { red: 1 }, discardHand: 0 },
      effects: [
        {
          kind: 'modify-attack',
          amount: 1,
          duration: 'this-turn',
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          condition: { kind: 'source-hp-less-than', amount: 3 },
        },
      ],
    })
  })

  it('BS6-008 disables the defender\'s Trap window only when it attacks at 4 HP or less', () => {
    expect(convertOfficialCookieSkill(findBs6Card('BS6-008'))).toMatchObject({
      trigger: 'passive',
      effects: [
        {
          kind: 'disable-traps',
          duration: 'current-battle',
          condition: { kind: 'source-hp-at-most', amount: 4 },
        },
      ],
    })
  })

  it('BS6-021 only draws when its selected LV.2+ Cookie has exactly 1 remaining HP', () => {
    expect(convertOfficialStageAbility(findBs6Card('BS6-021'))).toMatchObject({
      placementCost: { red: 1 },
      cost: { red: 1 },
      restSource: true,
      effects: [
        {
          kind: 'modify-attack',
          amount: 1,
          duration: 'this-turn',
          target: {
            side: 'self',
            min: 0,
            max: 1,
            minLevel: 2,
            maxRemainingHp: 3,
          },
          thenDrawUpToIfTargetRemainingHp: { remainingHp: 1, max: 1 },
        },
      ],
    })
  })

  it('BS6-011 and BS6-012 return a selected own Cookie HP card to hand', () => {
    expect(convertOfficialCookieSkill(findBs6Card('BS6-011'))).toMatchObject({
      faint: true,
      effects: [
        {
          kind: 'hp-to-hand',
          amount: 1,
          target: { side: 'self', min: 0, max: 1 },
        },
      ],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-012'))).toMatchObject({
      endPhase: true,
      effects: [
        {
          kind: 'hp-to-hand',
          amount: 1,
          target: { side: 'self', min: 0, max: 1 },
          condition: { kind: 'hand-count-at-most', count: 5 },
        },
      ],
    })
  })

  it('BS6-017 disables FLIP on up to one opposing Cookie for the turn', () => {
    expect(convertOfficialCookieSkill(findBs6Card('BS6-017'))).toMatchObject({
      trigger: 'on-play',
      cost: { energy: { red: 1 }, discardHand: 0 },
      effects: [
        {
          kind: 'disable-flip',
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
      ],
    })
  })

  it('BS6-019 and BS6-020 preserve their two-step item and trap resolution', () => {
    expect(convertOfficialItemAbility(findBs6Card('BS6-019'))).toMatchObject({
      cost: { red: 1 },
      effects: [
        {
          kind: 'hp-to-hand',
          amount: 1,
          target: { side: 'self', min: 1, max: 1 },
        },
        {
          kind: 'rest-support',
          side: 'opponent',
          amount: 2,
          activeOnly: true,
          optional: true,
        },
      ],
    })
    expect(convertOfficialTrapAbility(findBs6Card('BS6-020'))).toMatchObject({
      cost: { energy: { red: 2 }, discardHand: 0 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -2,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'hp-to-hand',
          amount: 1,
          target: { side: 'self', min: 0, max: 1 },
        },
      ],
    })
  })

  it('converts the first BS6 RED attack Then effects with their conditions', () => {
    expect(convertOfficialAttackEffects(findBs6Card('BS6-003'))).toMatchObject([
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, energyColor: 'red' },
      },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ])
    expect(convertOfficialAttackEffects(findBs6Card('BS6-007'))).toMatchObject([
      {
        kind: 'rest-support',
        side: 'opponent',
        amount: 2,
        condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
      },
    ])
    expect(convertOfficialAttackEffects(findBs6Card('BS6-013'))).toMatchObject([
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'battle-area-has-named-cookie',
          side: 'self',
          name: 'Chess Choco Cookie',
          excludeSource: true,
        },
      },
    ])
    expect(convertOfficialAttackEffects(findBs6Card('BS6-016'))).toMatchObject([
      {
        kind: 'damage',
        amount: 1,
        condition: { kind: 'source-hp-less-than', amount: 2 },
      },
    ])
    expect(convertOfficialAttackEffects(findBs6Card('BS6-018'))).toMatchObject([
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        condition: { kind: 'source-hp-less-than', amount: 2 },
      },
    ])
  })

  it('converts BS6 YELLOW and GREEN attack Then effects with their exact conditions', () => {
    expect(convertOfficialAttackEffects(findBs6Card('BS6-022'))).toMatchObject([
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'return-to-hand',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
            condition: { kind: 'break-level-at-least', level: 3 },
          },
        ],
      },
    ])
    expect(convertOfficialAttackEffects(findBs6Card('BS6-024'))).toMatchObject([
      {
        kind: 'damage-by-break-count',
        perCount: 1,
        exactBreakLevel: 3,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ])
    expect(convertOfficialAttackEffects(findBs6Card('BS6-031'))).toMatchObject([
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            condition: { kind: 'break-level-at-least', level: 4 },
          },
        ],
      },
    ])
    expect(convertOfficialAttackEffects(findBs6Card('BS6-053'))).toMatchObject([
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: {
          kind: 'all-of',
          conditions: [
            { kind: 'support-count-at-least', count: 5 },
            { kind: 'support-count-at-most', count: 5 },
          ],
        },
      },
    ])
    expect(convertOfficialAttackEffects(findBs6Card('BS6-059'))).toMatchObject([
      {
        kind: 'return-to-hand',
        target: { side: 'self', min: 0, max: 1, sourceOnly: true },
        condition: {
          kind: 'all-of',
          conditions: [
            { kind: 'support-count-at-least', count: 5 },
            { kind: 'support-count-at-most', count: 5 },
          ],
        },
      },
    ])
    expect(convertOfficialAttackEffects(findBs6Card('BS6-044'))).toMatchObject([
      { kind: 'support-to-hand', amount: 1, cardType: 'cookie' },
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ])
    expect(convertOfficialAttackEffects(findBs6Card('BS6-061'))).toMatchObject([
      { kind: 'support-to-hand', amount: 1, cardType: 'cookie' },
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, maxRemainingHp: 5 },
      },
    ])
    expect(convertOfficialAttackEffects(findBs6Card('BS6-036'))).toMatchObject([
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'gain-hp',
            amount: 1,
            perBreakCard: { exactLevel: 3 },
          },
        ],
      },
    ])
    expect(convertOfficialAttackEffects(findBs6Card('BS6-051'))).toMatchObject([
      {
        kind: 'optional-cost-attack',
        cost: { energy: { green: 1 } },
        effects: [
          {
            kind: 'hand-to-support',
            amount: 2,
            rested: false,
            optional: true,
            energyColor: 'green',
            condition: {
              kind: 'opponent-support-count-at-least',
              count: 3,
            },
          },
        ],
      },
    ])
    expect(convertOfficialAttackEffects(findBs6Card('BS6-096'))).toMatchObject([
      {
        kind: 'optional-cost-attack',
        cost: { energy: { purple: 1 }, selfToTrash: true },
        effects: [
          {
            kind: 'trash-to-battle',
            amount: 1,
            exactLevel: 1,
            energyColor: 'purple',
            condition: {
              kind: 'battle-area-has-cookie-with-level',
              side: 'self',
              level: 3,
            },
          },
        ],
      },
    ])
  })
})

describe('BS6 YELLOW effect adapter', () => {
  it('normalizes official NPC placeholders and preserves their on-play draw limits', () => {
    expect(convertOfficialCookieSkill(findBs6Card('BS6-028'))).toMatchObject({
      trigger: 'on-play',
      effects: [
        {
          kind: 'draw-up-to',
          max: 1,
          condition: {
            kind: 'break-area-card-count-at-least',
            side: 'self',
            count: 3,
          },
        },
      ],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-030'))).toMatchObject({
      trigger: 'on-play',
      effects: [
        {
          kind: 'draw-up-to-break-cookie-count',
          minLevel: 2,
          amountPerCookie: 1,
        },
      ],
    })
  })

  it('BS6-023 and BS6-032 put the selected hand Cookie into break before their follow-up', () => {
    expect(convertOfficialCookieSkill(findBs6Card('BS6-023'))).toMatchObject({
      trigger: 'on-play',
      cost: { energy: {}, discardHand: 0 },
      effects: [
        { kind: 'hand-to-break', amount: 1 },
        { kind: 'damage-all', amount: 1, side: 'opponent' },
      ],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-032'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: {}, discardHand: 0 },
      effects: [
        { kind: 'hand-to-break', amount: 1 },
        { kind: 'draw-up-to', max: 2 },
      ],
    })
  })

  it('BS6-025, BS6-033, and BS6-035 retain their break and hand conditions', () => {
    expect(convertOfficialCookieSkill(findBs6Card('BS6-025'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: { yellow: 1 }, discardHand: 0 },
      effects: [
        {
          kind: 'draw-up-to',
          max: 1,
          condition: {
            kind: 'all-of',
            conditions: [
              { kind: 'break-level-at-most', level: 2 },
              { kind: 'hand-count-at-most', count: 6 },
            ],
          },
        },
      ],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-033'))).toMatchObject({
      trigger: 'on-play',
      effects: [
        {
          kind: 'draw-up-to-then-discard',
          max: 2,
          discardCount: 2,
          condition: { kind: 'break-level-at-least', level: 4 },
        },
      ],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-035'))).toMatchObject({
      endPhase: true,
      effects: [
        {
          kind: 'set-active',
          supportCount: 1,
          selectable: true,
          optional: true,
          condition: {
            kind: 'break-area-card-count-at-least',
            side: 'self',
            count: 2,
          },
        },
      ],
    })
  })

  it('BS6-041 and BS6-043 keep every end-to-end effect step in card order', () => {
    expect(convertOfficialItemAbility(findBs6Card('BS6-041'))).toMatchObject({
      cost: { yellow: 3 },
      effects: [
        {
          kind: 'damage',
          amount: 2,
          condition: {
            kind: 'break-area-card-count-at-least',
            side: 'self',
            count: 3,
          },
        },
        {
          kind: 'draw-up-to',
          max: 1,
          condition: {
            kind: 'break-area-card-count-at-least',
            side: 'self',
            count: 3,
          },
        },
      ],
    })
    expect(convertOfficialStageAbility(findBs6Card('BS6-043'))).toMatchObject({
      placementCost: { yellow: 1 },
      cost: { energy: {}, discardHand: 0 },
      endPhase: true,
      effects: [
        { kind: 'hand-to-break', amount: 1, energyColor: 'yellow' },
        { kind: 'set-active', supportCount: 2, selectable: true, optional: true },
        { kind: 'draw-up-to', max: 1 },
      ],
    })
  })

  it('BS6-038 damages after its attack only with a LV.2+ yellow Cookie in break', () => {
    expect(convertOfficialAttackEffects(findBs6Card('BS6-038'))).toMatchObject([
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'break-area-has-card',
          side: 'self',
          color: 'yellow',
          minLevel: 2,
        },
      },
    ])
  })
})

describe('BS6 GREEN effect adapter', () => {
  it('BS6-063 lets the controller explicitly skip its conditional deck-to-support Then effect', () => {
    expect(convertOfficialTrapAbility(findBs6Card('BS6-063'))).toMatchObject({
      cost: { energy: { green: 2 }, discardHand: 0 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'choose-one',
          condition: {
            kind: 'all-of',
            conditions: [
              { kind: 'support-count-at-least', count: 5 },
              { kind: 'support-count-at-most', count: 5 },
            ],
          },
          modes: [
            {
              effects: [{ kind: 'deck-to-support', amount: 1, rested: true }],
            },
            { effects: [] },
          ],
        },
      ],
    })
  })

  it('BS6-045, BS6-048, and BS6-058 retain their support-count-difference conditions', () => {
    expect(convertOfficialCookieSkill(findBs6Card('BS6-045'))).toMatchObject({
      trigger: 'activate',
      cost: {
        energy: { green: 1 },
        discardHand: 0,
        trashBattleCookie: { count: 1, sourceOnly: true },
      },
      effects: [
        {
          kind: 'draw',
          amount: 1,
          condition: { kind: 'support-count-less-than-opponent', difference: 4 },
        },
        {
          kind: 'damage',
          amount: 1,
          condition: { kind: 'support-count-less-than-opponent', difference: 4 },
        },
      ],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-048'))).toMatchObject({
      faint: true,
      effects: [
        {
          kind: 'draw',
          amount: 1,
          condition: { kind: 'support-count-less-than-opponent', difference: 1 },
        },
        {
          kind: 'opponent-discard-hand',
          count: 1,
          condition: { kind: 'support-count-less-than-opponent', difference: 1 },
        },
      ],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-058'))).toMatchObject({
      trigger: 'on-play',
      effects: [
        {
          kind: 'damage-all',
          amount: 2,
          side: 'opponent',
          condition: { kind: 'support-count-less-than-opponent', difference: 2 },
        },
      ],
    })
  })

  it('BS6-010, BS6-039, BS6-052, BS6-055, BS6-060, and BS6-064 use their existing support and target flows', () => {
    expect(convertOfficialCookieSkill(findBs6Card('BS6-010'))).toMatchObject({
      trigger: 'passive',
      effects: [{ kind: 'prevent-opponent-battle-movement' }],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-034'))).toMatchObject({
      trigger: 'on-play',
      effects: [
        { kind: 'reorder-hp', target: { side: 'self', min: 0, max: 1 } },
      ],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-039'))).toMatchObject({
      trigger: 'on-play',
      cost: { energy: { yellow: 1 } },
      effects: [
        {
          kind: 'opponent-break-to-trash-then-battle-to-break',
          condition: { kind: 'opponent-break-level-at-most', level: 6 },
        },
      ],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-050'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      effects: [
        {
          kind: 'support-to-hand',
          amount: 0,
          anyNumber: true,
          optional: true,
          energyColor: 'green',
        },
      ],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-051'))).toMatchObject({
      trigger: 'passive',
      endPhase: true,
      effects: [
        {
          kind: 'support-to-hand',
          amount: 0,
          keepCount: 5,
          condition: { kind: 'support-count-at-least', count: 6 },
        },
      ],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-052'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: { green: 2 }, discardHand: 0, supportToHand: 2 },
      effects: [
        {
          kind: 'make-faint',
          target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
        },
      ],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-055'))).toMatchObject({
      trigger: 'passive',
      yourTurn: true,
      effects: [
        {
          kind: 'modify-damage-received',
          amount: 0,
          duration: 'persistent',
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          minimumDamage: 0,
          setDamageTo: 0,
          condition: {
            kind: 'support-count-less-than-opponent',
            difference: 1,
          },
        },
      ],
    })
    expect(convertOfficialAttackEffects(findBs6Card('BS6-060'))).toMatchObject([
      { kind: 'support-to-hand', amount: 1 },
    ])
    expect(convertOfficialStageAbility(findBs6Card('BS6-064'))).toMatchObject({
      placementCost: { green: 1 },
      cost: { green: 1 },
      restSource: true,
      effects: [
        {
          kind: 'hand-to-support',
          amount: 1,
          rested: false,
          condition: { kind: 'support-count-less-than-opponent', difference: 1 },
        },
      ],
    })
  })

  it('BS6-057 pays its self-trash cost before returning a support Cookie and drawing', () => {
    expect(convertOfficialCookieSkill(findBs6Card('BS6-057'))).toMatchObject({
      trigger: 'activate',
      cost: {
        energy: { green: 1 },
        discardHand: 0,
        trashBattleCookie: { count: 1, sourceOnly: true },
      },
      effects: [
        { kind: 'support-to-hand', amount: 1, cardType: 'cookie' },
        { kind: 'draw-up-to', max: 1 },
      ],
    })
  })
})

describe('BS6 BLUE effect adapter', () => {
  it('converts faint, On Play, and conditional hand-size effects in card order', () => {
    expect(convertOfficialCookieSkill(findBs6Card('BS6-071'))).toMatchObject({
      faint: true,
      effects: [{ kind: 'draw-up-to', max: 2 }],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-072'))).toMatchObject({
      trigger: 'on-play',
      effects: [{ kind: 'draw-up-to', max: 3 }],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-066'))).toMatchObject({
      trigger: 'on-play',
      effects: [
        {
          kind: 'return-to-hand',
          target: {
            side: 'self',
            min: 1,
            max: 1,
            maxLevel: 1,
            energyColor: 'blue',
          },
        },
        { kind: 'draw-up-to', max: 1 },
      ],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-079'))).toMatchObject({
      trigger: 'on-play',
      effects: [
        {
          kind: 'field-to-deck-bottom',
          target: {
            side: 'self',
            min: 1,
            max: 1,
            maxLevel: 2,
            energyColor: 'blue',
          },
        },
        { kind: 'draw-up-to', max: 2 },
      ],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-080'))).toMatchObject({
      trigger: 'on-play',
      effects: [
        {
          kind: 'return-to-hand',
          condition: { kind: 'hand-count-at-most', count: 5 },
        },
      ],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-082'))).toMatchObject({
      trigger: 'on-play',
      cost: { energy: {}, discardHand: 1, discardHandAtLeast: true },
      effects: [
        {
          kind: 'draw-up-to',
          max: 2,
          condition: { kind: 'hand-count-at-most', count: 5 },
        },
      ],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-083'))).toMatchObject({
      faint: true,
      effects: [{ kind: 'draw-up-to-then-discard', max: 2, discardCount: 1 }],
    })
  })

  it('preserves item, trap, and stage costs before their follow-up effects', () => {
    expect(convertOfficialItemAbility(findBs6Card('BS6-084'))).toMatchObject({
      cost: { energy: { blue: 1 }, discardHand: 1, discardHandAtLeast: true },
      effects: [
        {
          kind: 'damage',
          amount: 1,
          condition: { kind: 'hand-count-at-most', count: 5 },
        },
      ],
    })
    expect(convertOfficialTrapAbility(findBs6Card('BS6-085'))).toMatchObject({
      cost: { energy: { blue: 1 }, discardHand: 2 },
      effects: [
        { kind: 'modify-attack', amount: -2 },
        {
          kind: 'draw-up-to',
          max: 2,
          condition: { kind: 'hand-count-at-most', count: 4 },
        },
      ],
    })
    expect(convertOfficialStageAbility(findBs6Card('BS6-086'))).toMatchObject({
      placementCost: { blue: 1 },
      cost: { energy: {}, discardHand: 2 },
      restSource: true,
      effects: [
        {
          kind: 'modify-attack',
          amount: 1,
          target: { side: 'self', min: 0, max: 1, energyColor: 'blue' },
        },
        {
          kind: 'draw-up-to',
          max: 1,
          condition: { kind: 'hand-count-at-most', count: 3 },
        },
      ],
    })
    expect(convertOfficialStageAbility(findBs6Card('BS6-107'))).toMatchObject({
      placementCost: { purple: 1 },
      cost: { purple: 1 },
      restSource: true,
      effects: [
        {
          kind: 'damage-all',
          amount: 1,
          side: 'opponent',
          condition: { kind: 'cookie-played-from-trash-this-turn' },
        },
      ],
    })
  })

  it('BS6-081 keeps the either-stage target and its post-resolution hand condition', () => {
    expect(convertOfficialCookieSkill(findBs6Card('BS6-081'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: { blue: 1 }, discardHand: 0 },
      effects: [
        {
          kind: 'field-to-deck-bottom',
          target: { side: 'either', min: 0, max: 1, maxLevel: 1 },
          allowStage: true,
          battleSide: 'opponent',
        },
        {
          kind: 'discard-hand',
          count: 1,
          condition: { kind: 'hand-count-at-least', count: 5 },
        },
      ],
    })
  })

  it('keeps attack Then discard and draw ordering', () => {
    expect(convertOfficialAttackEffects(findBs6Card('BS6-065'))).toMatchObject([
      {
        kind: 'discard-hand',
        count: 1,
        condition: { kind: 'hand-count-at-least', count: 6 },
      },
    ])
    expect(convertOfficialAttackEffects(findBs6Card('BS6-072'))).toMatchObject([
      { kind: 'discard-hand', count: 2 },
      { kind: 'draw-up-to', max: 2 },
    ])
    expect(convertOfficialAttackEffects(findBs6Card('BS6-074'))).toMatchObject([
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'hand-count-at-most', count: 5 },
      },
    ])
    expect(convertOfficialAttackEffects(findBs6Card('BS6-076'))).toMatchObject([
      { kind: 'discard-hand', count: 1 },
      { kind: 'draw-up-to', max: 1 },
    ])
    expect(convertOfficialAttackEffects(findBs6Card('BS6-068'))).toMatchObject([
      {
        kind: 'field-to-deck-bottom',
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
        condition: { kind: 'hand-count-at-most', count: 5 },
      },
    ])
    expect(convertOfficialAttackEffects(findBs6Card('BS6-077'))).toMatchObject([
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'hand-count-at-most', count: 5 },
      },
    ])
    expect(convertOfficialAttackEffects(findBs6Card('BS6-079'))).toMatchObject([
      { kind: 'discard-hand', count: 1 },
      { kind: 'rest-support', side: 'opponent', amount: 3, activeOnly: true, optional: true },
    ])
  })
})

describe('BS6 PURPLE effect adapter', () => {
  it('converts On Play, end-phase, and item costs without changing their destination', () => {
    expect(convertOfficialCookieSkill(findBs6Card('BS6-089'))).toMatchObject({
      trigger: 'on-play',
      effects: [{ kind: 'trash-to-hand', max: 1 }],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-090'))).toMatchObject({
      endPhase: true,
      effects: [{ kind: 'deck-to-trash', amount: 2, side: 'self' }],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-093'))).toMatchObject({
      trigger: 'on-play',
      effects: [
        {
          kind: 'field-to-trash',
          target: { side: 'self', min: 0, max: 1, maxLevel: 1 },
        },
      ],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-094'))).toMatchObject({
      trigger: 'on-play',
      effects: [
        {
          kind: 'field-to-trash',
          target: { side: 'self', min: 0, max: 1, maxLevel: 1 },
        },
      ],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-087'))).toMatchObject({
      trigger: 'on-play',
      fromTrashArea: true,
      effects: [{ kind: 'trash-to-hand', max: 1, energyColor: 'purple' }],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-098'))).toMatchObject({
      trigger: 'on-play',
      fromTrashArea: true,
      effects: [{ kind: 'deck-to-trash', amount: 5, side: 'opponent' }],
    })
    expect(convertOfficialCookieSkill(findBs6Card('BS6-099'))).toMatchObject({
      trigger: 'on-play',
      fromTrashArea: true,
      effects: [
        {
          kind: 'hp-to-trash',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1, minRemainingHp: 2 },
        },
      ],
    })
    expect(convertOfficialItemAbility(findBs6Card('BS6-105'))).toMatchObject({
      cost: {
        energy: { purple: 1 },
        discardHand: 0,
        trashBattleCookie: { count: 1, level: 1, energyColor: 'purple' },
      },
      effects: [{ kind: 'draw-up-to-then-discard', max: 2, discardCount: 1 }],
    })
  })

  it('uses optional, base-HP-filtered trash play in the trap and attack Then flows', () => {
    const expectedPlay = {
      kind: 'trash-to-battle',
      amount: 1,
      optional: true,
      energyColor: 'purple',
      maxHp: 2,
    }
    expect(convertOfficialTrapAbility(findBs6Card('BS6-106'))).toMatchObject({
      cost: { energy: { purple: 2 }, discardHand: 0 },
      effects: [{ kind: 'modify-attack', amount: -1 }, expectedPlay],
    })
    expect(convertOfficialAttackEffects(findBs6Card('BS6-095'))).toMatchObject([
      expectedPlay,
    ])
    expect(convertOfficialAttackEffects(findBs6Card('BS6-093'))).toMatchObject([
      expectedPlay,
    ])
    expect(convertOfficialCookieSkill(findBs6Card('BS6-101'))).toMatchObject({
      faint: true,
      effects: [
        {
          kind: 'trash-to-battle',
          amount: 1,
          optional: true,
          energyColor: 'purple',
        },
      ],
    })
    expect(convertOfficialAttackEffects(findBs6Card('BS6-102'))).toMatchObject([
      { kind: 'deck-to-trash', amount: 3, side: 'self' },
      { kind: 'deck-to-trash', amount: 3, side: 'opponent' },
    ])
  })

  it('BS6-042 keeps the break-area-card-count trap gate', () => {
    expect(convertOfficialTrapAbility(findBs6Card('BS6-042'))).toMatchObject({
      condition: { kind: 'break-area-card-count-at-least', count: 3 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -2,
          target: { side: 'opponent', min: 0, max: 1, minLevel: 2 },
        },
        { kind: 'draw-up-to', max: 1 },
      ],
    })
  })
})
