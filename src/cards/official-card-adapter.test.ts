import { describe, expect, it } from 'vitest'
import officialGreenSample from '../../data/cards/official-starter-deck-green.en.json'
import officialBS3Inventory from '../../data/cards/official-age-of-heroes-and-kingdoms-bs3.en.json'
import officialBS5Inventory from '../../data/cards/official-age-of-heroes-and-kingdoms-bs5.en.json'
import officialBS6Inventory from '../../data/cards/official-age-of-heroes-and-kingdoms-bs6.en.json'
import officialBS7Candidates from '../../data/cards/official-arena-of-glory-bs7.en.json'
import officialSample from '../../data/cards/official-sample.en.json'
import officialYellowSample from '../../data/cards/official-starter-deck-yellow.en.json'
import {
  convertOfficialCardToGameCard,
  convertOfficialCards,
  parseOfficialCardText,
  type OfficialCardRecord,
} from '.'
import { normalizeOfficialCardRecord } from './official-card-adapter'

const createOfficialCard = (
  overrides: Partial<OfficialCardRecord> = {},
): OfficialCardRecord => ({
  sourceId: 46297,
  locale: 'en',
  cardNumber: 'BS9-001@1',
  baseCardNumber: 'BS9-001',
  variant: '1',
  name: 'Icicle Yeti Cookie',
  type: 'flip',
  officialType: 'FLIP',
  rarity: 'C',
  grade: 'COMMON',
  level: 2,
  hp: 3,
  energyType: 'RED',
  color: 'RED',
  skill: {
    name: null,
    text: null,
  },
  attackText: '<{R}{R}> Pointy Icicle {da} 2',
  flipText:
    'Select up to 1 of your Cookies. During this turn, that Cookie receives -2 effect damage.',
  keywords: [],
  product: {
    id: 241,
    title: 'BOOSTER PACK [A Game of Truth and Deceit]',
    category: null,
  },
  restrictions: {
    banned: false,
    limited: false,
  },
  flags: {
    enabled: true,
    hidden: false,
    extra: false,
  },
  imageUrl:
    'https://cookierunbraverse.com/data/en_storage/example.webp',
  officialUpdatedAt: '2026-06-05T01:22:38.000Z',
  sourceUrl:
    'https://cookierunbraverse.com/data/json/cardList_en.json',
  ...overrides,
})

describe('official text parser', () => {
  it.each([null, 'null'])('recovers missing card color %s from structured energyType, including MIX attacks', (color) => {
    for (const energyType of ['YELLOW', 'YELLOW MIX']) {
      const converted = convertOfficialCardToGameCard(createOfficialCard({ color, energyType }))
      expect(converted).toMatchObject({ status: 'converted', gameCard: { cardColor: 'yellow', energyColor: 'yellow' } })
    }
    const explicit = convertOfficialCardToGameCard(createOfficialCard({ color: 'RED', energyType: 'YELLOW' }))
    expect(explicit).toMatchObject({ status: 'converted', gameCard: { cardColor: 'red', energyColor: 'red' } })
  })
  it('parses colored and neutral costs plus attack damage', () => {
    const parsed = parseOfficialCardText(
      '<{R}{R}{N}{K}> Perfect Deduction {da} 3',
    )

    expect(parsed).toMatchObject({
      cost: {
        red: 2,
        neutral: 1,
        black: 1,
      },
      totalCost: 4,
      damage: 3,
    })
    expect(parsed?.displayText).toContain('[Cost: R R N K]')
    expect(parsed?.displayText).toContain('Damage 3')
  })

  it('preserves unsupported markers without treating them as costs', () => {
    const parsed = parseOfficialCardText(
      '{mob} {t1} <{G}> Move this Cookie. {custom}',
    )

    expect(parsed?.totalCost).toBe(1)
    expect(parsed?.markers).toEqual(['mob', 't1'])
    expect(parsed?.unknownTokens).toEqual(['custom'])
    expect(parsed?.displayText).toContain('[Activate]')
    expect(parsed?.displayText).toContain('[custom]')
  })

  it('maps official skill markers to their timing labels', () => {
    expect(parseOfficialCardText('{mob} Skill')?.displayText).toContain(
      '[Activate]',
    )
    expect(parseOfficialCardText('{ap} Skill')?.displayText).toContain(
      '[OnPlay]',
    )
  })
})

describe('official card adapter', () => {
  it('normalizes BS8-083@2 merged skill and attack fields without changing the source record', () => {
    const source = createOfficialCard({
      cardNumber: 'BS8-083@2',
      baseCardNumber: 'BS8-083',
      variant: '2',
      name: 'Frost Queen Cookie',
      type: 'cookie',
      officialType: 'COOKIE',
      energyType: 'BLUE',
      color: 'BLUE',
      level: 3,
      hp: 4,
      skill: { name: null, text: null },
      attackText:
        '{sk} Freezing Aura\n\n【On Play】 【Once Per Turn】 <{B}> Select up to 1 of your opponent\'s Cookies. That Cookie is not set as active during your opponent\'s next Active Phase.\n\n<{B}{B}{B}> I will freeze your very breath! {da} 3\nThen, you can draw cards from your deck until there are 3 cards in your hand.',
    })

    const normalized = normalizeOfficialCardRecord(source)
    expect(source.skill.text).toBeNull()
    expect(normalized.skill.text).toBe(
      '{ap} {t1} <{B}> Select up to 1 of your opponent\'s Cookies. That Cookie is not set as active during your opponent\'s next Active Phase.',
    )
    expect(normalized.attackText).toContain('<{B}{B}{B}>')

    const converted = convertOfficialCardToGameCard(source)
    expect(converted).toMatchObject({
      status: 'converted',
      gameCard: {
        skill: {
          trigger: 'on-play',
          oncePerTurn: true,
          cost: { energy: { blue: 1 } },
          effects: [{
            kind: 'prevent-cookie-active-next-phase',
            target: { side: 'opponent', min: 0, max: 1 },
          }],
        },
      },
    })
  })

  it('normalizes BS8-032@2 merged skill and attack fields without changing the source record', () => {
    const source = createOfficialCard({
      cardNumber: 'BS8-032@2',
      baseCardNumber: 'BS8-032',
      variant: '2',
      name: 'Burnt Cheese Cookie',
      type: 'cookie',
      officialType: 'COOKIE',
      energyType: 'YELLOW',
      color: 'YELLOW',
      level: 1,
      hp: 2,
      skill: { name: null, text: null },
      attackText:
        '{sk} Constant Vigilance\n\n【Activate】 【Once Per Turn】 If there is a Cookie in your break area, <place this Cookie and a Cookie that is LV.2 or above from your hand into your break area.> Draw up to 2 cards from your deck. Then, play up to 1 [Golden Cheese Cookie] from your break area.\n\n<{Y}{Y}> Wrath of the Golden Earth {da} 2',
    })

    const normalized = normalizeOfficialCardRecord(source)
    expect(source.skill.text).toBeNull()
    expect(normalized.skill).toEqual({
      name: '{sk} Constant Vigilance',
      text: '{mob} {t1} If there is a Cookie in your break area, <place this Cookie and a Cookie that is LV.2 or above from your hand into your break area.> Draw up to 2 cards from your deck. Then, play up to 1 [Golden Cheese Cookie] from your break area.',
    })
    expect(normalized.attackText).toBe('<{Y}{Y}> Wrath of the Golden Earth {da} 2')

    const converted = convertOfficialCardToGameCard(source)
    expect(converted).toMatchObject({
      status: 'converted',
      gameCard: {
        skill: {
          trigger: 'activate',
          oncePerTurn: true,
        },
      },
    })
    expect(converted.status === 'converted' && converted.gameCard.type === 'cookie'
      ? converted.gameCard.skill?.effects
      : undefined).toContainEqual({
      kind: 'break-to-battle',
      amount: 1,
      cardName: 'Golden Cheese Cookie',
    })
  })

  it('normalizes the valid BS7 attack-damage syntax without accepting malformed source data', () => {
    const cards = officialBS7Candidates.cards as OfficialCardRecord[]
    const nutmegTiger = cards.find((card) => card.cardNumber === 'BS7-001')
    const malformed = cards.find((card) => card.cardNumber === 'BS7-017')

    expect(nutmegTiger).toBeDefined()
    expect(malformed).toBeDefined()
    expect(normalizeOfficialCardRecord(nutmegTiger!).attackText).toBe(
      '<{R}{N}> Claws out! {da} 1',
    )
    expect(convertOfficialCardToGameCard(nutmegTiger!)).toMatchObject({
      status: 'converted',
      gameCard: {
        attack: 1,
        attackCost: 2,
        attackEnergyCost: { red: 1, neutral: 1 },
      },
    })

    const remainingWithoutDamage = cards
      .filter((card) => card.type === 'cookie' || card.type === 'flip')
      .filter((card) => !String(card.attackText ?? '').includes('{da}'))
      .filter((card) => !String(normalizeOfficialCardRecord(card).attackText).includes('{da}'))
      .map((card) => card.cardNumber)
    expect(remainingWithoutDamage).toEqual([])
    expect(normalizeOfficialCardRecord(malformed!).attackText).toBe(
      '<{R}{N}> Dragon Hunter {da} 1',
    )
    expect(convertOfficialCardToGameCard(malformed!)).toMatchObject({
      status: 'converted',
      gameCard: {
        attack: 1,
        attackCost: 2,
        attackEnergyCost: { red: 1, neutral: 1 },
      },
    })
  })

  it('preserves BS3 PURE, Ancient, Soul Jam, and special-victory runtime data', () => {
    const bs3Cards = officialBS3Inventory.cards as OfficialCardRecord[]
    const findBs3Card = (cardNumber: string) => {
      const card = bs3Cards.find(
        (candidate) => candidate.cardNumber === cardNumber,
      )

      if (!card) throw new Error(`Missing BS3 inventory card ${cardNumber}`)
      return card
    }

    const ancient = convertOfficialCardToGameCard(findBs3Card('BS3-017'))
    const soulJam = convertOfficialCardToGameCard(findBs3Card('BS3-019'))
    const stage = convertOfficialCardToGameCard(findBs3Card('BS3-121'))
    const promoStage = convertOfficialCardToGameCard(findBs3Card('BS3-121@5'))

    expect(ancient).toMatchObject({
      status: 'converted',
      gameCard: { keywords: ['ancient'] },
    })
    expect(soulJam).toMatchObject({
      status: 'converted',
      gameCard: { keywords: ['soul-jam'] },
    })
    expect(stage).toMatchObject({
      status: 'converted',
      gameCard: {
        cardColor: 'pure',
        stageAbility: {
          placementCost: { red: 1, yellow: 1, green: 1, blue: 1, purple: 1 },
          cost: { red: 1, yellow: 1, green: 1, blue: 1, purple: 1 },
          restSource: true,
          specialVictory: {
            kind: 'distinct-named-keywords',
            requirements: [
              { keyword: 'ancient', cardType: 'cookie', count: 5 },
              { keyword: 'soul-jam', count: 5 },
            ],
          },
        },
      },
    })
    if (stage.status === 'converted') {
      expect(stage.gameCard.energyColor).toBe('pure')
    }
    expect(promoStage).toMatchObject({
      status: 'converted',
      gameCard: {
        stageAbility: {
          cost: { red: 1, yellow: 1, green: 1, blue: 1, purple: 1 },
          restSource: false,
          specialVictory: { kind: 'distinct-named-keywords' },
        },
      },
    })
  })

  it('converts all 22 records from the Starter Deck RED sample', () => {
    const records = officialSample.cards as OfficialCardRecord[]
    const results = convertOfficialCards(records)

    expect(records).toHaveLength(22)
    expect(results).toHaveLength(22)
    expect(results.every((result) => result.status === 'converted')).toBe(
      true,
    )
  })

  it('converts all 20 records from the Starter Deck YELLOW sample', () => {
    const records = officialYellowSample.cards as OfficialCardRecord[]
    const results = convertOfficialCards(records)

    expect(officialYellowSample.source.filter.categoryTitle).toBe(
      'Starter Deck YELLOW',
    )
    expect(records).toHaveLength(20)
    expect(records.every((record) => record.product.title === 'Starter Deck YELLOW')).toBe(
      true,
    )
    expect(results).toHaveLength(20)
    expect(results.every((result) => result.status === 'converted')).toBe(
      true,
    )
  })

  it('converts all 22 records from the Starter Deck GREEN sample', () => {
    const records = officialGreenSample.cards as OfficialCardRecord[]
    const results = convertOfficialCards(records)

    expect(officialGreenSample.source.filter.categoryTitle).toBe(
      'Starter Deck GREEN',
    )
    expect(records).toHaveLength(22)
    expect(
      records.every((record) => record.product.title === 'Starter Deck GREEN'),
    ).toBe(true)
    expect(results).toHaveLength(22)
    expect(results.every((result) => result.status === 'converted')).toBe(
      true,
    )
  })

  it('converts COOKIE and FLIP records into runtime CookieCard values', () => {
    const result = convertOfficialCardToGameCard(
      createOfficialCard(),
      'copy-1',
    )

    expect(result.status).toBe('converted')

    if (result.status === 'converted') {
      expect(result.gameCard).toEqual({
        id: 'BS9-001',
        instanceId: 'BS9-001@1:copy-1',
        name: 'Icicle Yeti Cookie',
        imageUrl:
          'https://cookierunbraverse.com/data/en_storage/example.webp',
        cardColor: 'red',
        energyColor: 'red',
        officialType: 'flip',
        type: 'cookie',
        level: 2,
        hp: 3,
        attack: 2,
        attackCost: 2,
        attackEnergyCost: { red: 2 },
        attackText: '<{R}{R}> Pointy Icicle {da} 2',
      })
      expect(result.source.imageUrl).toMatch(/^https:/)
      expect(result.parsedText.flip?.raw).toContain('effect damage')
    }
  })

  it('attaches supported effects and source text to converted cards', () => {
    const result = convertOfficialCardToGameCard(
      createOfficialCard({
        cardNumber: 'ST1-019',
        baseCardNumber: 'ST1-019',
        type: 'item',
        officialType: 'ITEM',
        level: null,
        hp: null,
        skill: { name: null, text: null },
        attackText:
          "《{R}》 Select up to 1 of your Cookies. During this turn, that Cookie gains +1 attack damage.",
      }),
      'effect-copy',
    )

    expect(result).toMatchObject({
      status: 'converted',
      gameCard: {
        effectText: expect.stringContaining('gains +1 attack damage'),
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            target: { side: 'self', min: 0, max: 1 },
          },
        ],
      },
    })
  })

  it('normalizes the official BS4-004@1 field swap at the adapter boundary', () => {
    const result = convertOfficialCardToGameCard(
      createOfficialCard({
        cardNumber: 'BS4-004@1',
        baseCardNumber: 'BS4-004',
        variant: '1',
        name: 'Mala Sauce Cookie',
        type: 'cookie',
        officialType: 'COOKIE',
        level: 1,
        hp: 3,
        energyType: 'RED',
        color: 'RED',
        skill: { name: '{sk} Flaming Mala', text: '{sk} Flaming Mala' },
        attackText:
          "【On Play】 Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage.",
        flipText:
          "<{R}> Too Spicy For Ya?! {da} 1 Then, if this Cookie's remaining HP is 1, select up to 1 of your opponent's LV.2 or lower Cookies. That Cookie receives 1 damage.",
      }),
    )

    expect(result).toMatchObject({
      status: 'converted',
      gameCard: {
        attack: 1,
        skill: {
          trigger: 'on-play',
          effects: [{ kind: 'damage', amount: 1 }],
        },
        attackEffects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1, maxLevel: 2 },
            condition: { kind: 'source-hp-less-than', amount: 2 },
          },
        ],
      },
    })
  })

  it('normalizes the BS4-032@1 FLIP field from the official card image', () => {
    const result = convertOfficialCardToGameCard(
      createOfficialCard({
        cardNumber: 'BS4-032@1',
        baseCardNumber: 'BS4-032',
        variant: '1',
        name: 'Cream Ferret Cookie',
        type: 'flip',
        officialType: 'FLIP',
        level: 2,
        hp: 3,
        energyType: 'YELLOW',
        color: 'YELLOW',
        attackText: '<{Y}{Y}> Creamcraft Magic! {da} 1',
        flipText: '<{Y}{Y}> Creamcraft Magic!',
      }),
    )

    expect(result).toMatchObject({
      status: 'converted',
      gameCard: {
        attack: 2,
        hp: 2,
        flip: {
          text: 'Draw up to 1 card from your deck.',
          effects: [{ kind: 'draw-up-to', max: 1 }],
        },
      },
    })
  })

  it('normalizes BS5 FLIP text stored in skill.text and converts both effect forms', () => {
    const records = officialBS5Inventory.cards as OfficialCardRecord[]
    const findBs5Card = (cardNumber: string) => {
      const card = records.find(
        (candidate) => candidate.cardNumber === cardNumber,
      )

      if (!card) throw new Error(`Missing BS5 card ${cardNumber}`)
      return card
    }

    const cherry = convertOfficialCardToGameCard(findBs5Card('BS5-038'))
    const goblin = convertOfficialCardToGameCard(findBs5Card('BS5-046'))

    expect(cherry).toMatchObject({
      status: 'converted',
      gameCard: {
        flip: {
          text: 'Draw up to 1 card from your deck.',
          effects: [{ kind: 'draw-up-to', max: 1 }],
        },
        effectText: 'Draw up to 1 card from your deck.',
      },
    })
    expect(goblin).toMatchObject({
      status: 'converted',
      gameCard: {
        flip: {
          text: '<Discard 1 card.> The Cookie with this card attached for HP gains +1 HP.',
          cost: { discardHand: 1 },
          effects: [],
          attachedHpBonus: 1,
        },
        effectText:
          '<Discard 1 card.> The Cookie with this card attached for HP gains +1 HP.',
        effects: [],
      },
    })
  })

  it('removes the malformed BS6-021 stage damage prefix from displayed text', () => {
    const source = (officialBS6Inventory.cards as OfficialCardRecord[]).find(
      (card) => card.cardNumber === 'BS6-021',
    )

    expect(source).toBeDefined()
    if (!source) return

    const result = convertOfficialCardToGameCard(source)

    expect(result).toMatchObject({
      status: 'converted',
      gameCard: {
        id: 'BS6-021',
        type: 'stage',
        stageAbility: {
          placementCost: { red: 1 },
          cost: { red: 1 },
        },
      },
    })
    if (result.status !== 'converted') return

    expect(result.gameCard.effectText).not.toMatch(/^\{da\}/i)
    expect(result.gameCard.effectText).toContain('Place in your stage area.')
  })

  it('does not treat P-059 duplicated attack text as a FLIP ability', () => {
    const result = convertOfficialCardToGameCard(
      createOfficialCard({
        cardNumber: 'P-059',
        baseCardNumber: 'P-059',
        name: 'Chamomile Cookie',
        type: 'cookie',
        officialType: 'COOKIE',
        level: 1,
        hp: 2,
        energyType: 'GREEN',
        color: 'GREEN',
        skill: {
          name: '{sk} Tea Time',
          text:
            'When your turn ends, if there are 2 active cards or more in your support area, draw up to 1 card from your deck.',
        },
        attackText: '<{G}{G}> Floating Flower {da} 2',
        flipText: '<{G}{G}> Floating Flower',
      }),
    )

    expect(result).toMatchObject({
      status: 'converted',
      gameCard: { attack: 2 },
    })
    if (result.status !== 'converted') return
    expect(result.gameCard.flip).toBeUndefined()
  })

  it('converts BS5-073 as a Cookie with a FLIP ability', () => {
    const source = (officialBS5Inventory.cards as OfficialCardRecord[]).find(
      (card) => card.cardNumber === 'BS5-073',
    )

    expect(source).toBeDefined()
    if (!source) return

    const result = convertOfficialCardToGameCard(source)

    expect(result).toMatchObject({
      status: 'converted',
      gameCard: {
        id: 'BS5-073',
        type: 'cookie',
        flip: {
          text: 'Draw up to 1 card from your deck.',
          effects: [{ kind: 'draw-up-to', max: 1 }],
        },
      },
    })
  })

  it('normalizes the missing P-078 attack damage marker for every art variant', () => {
    const source = createOfficialCard({
      cardNumber: 'P-078@1',
      baseCardNumber: 'P-078',
      variant: '1',
      name: 'Blueberry Cookie',
      type: 'cookie',
      officialType: 'COOKIE',
      level: 3,
      hp: 4,
      color: 'BLUE',
      energyType: 'BLUE',
      attackText: '<{B}{B}> Sovereign of the Abyss 1',
      skill: { name: null, text: null },
      flipText: null,
    })

    const result = convertOfficialCardToGameCard(source)

    expect(result).toMatchObject({
      status: 'converted',
      gameCard: {
        id: 'P-078',
        attack: 1,
        attackCost: 2,
      },
    })
  })

  it('falls back to the FLIP ability text when the generic converter cannot parse a FLIP-only card (BS2-056 regression)', () => {
    // BS2-056 Raspberry Mousse Cookie 的 FLIP 文字（discard cost + gain-hp）不會被
    // convertOfficialCardEffects 的一般轉換器解析出來，先前只有 card.flip 有正確值，
    // 頂層 card.effectText/card.effects 是 undefined；CardDetailModal 靠這兩個欄位
    // 才會顯示「FLIP」段落，導致玩家點開卡牌詳情看不到 FLIP 說明。
    const result = convertOfficialCardToGameCard(
      createOfficialCard({
        cardNumber: 'BS2-056',
        baseCardNumber: 'BS2-056',
        skill: { name: null, text: null },
        attackText: '《{P}》 Deals 1 damage.',
        flipText:
          '《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP.',
      }),
      'flip-copy',
    )

    expect(result.status).toBe('converted')
    if (result.status !== 'converted') return

    expect(result.gameCard.flip).toMatchObject({
      cost: { discardHand: 1 },
      effects: [],
      attachedHpBonus: 1,
    })
    // 修復前這兩個欄位是 undefined，CardDetailModal 的 FLIP 段落因此不會渲染。
    expect(result.gameCard.effectText).toContain('gains +1 HP')
    // attachedHpBonus保留既有資料欄位；翻開並支付後由resolveFlip補1張HP，
    // 未翻開時不提供持續加成。
    expect(result.gameCard.effects).toEqual([])
  })

  it('uses base card number as runtime id while preserving art variant metadata', () => {
    const result = convertOfficialCardToGameCard(createOfficialCard())

    expect(result.status).toBe('converted')

    if (result.status === 'converted') {
      expect(result.gameCard.id).toBe('BS9-001')
      expect(result.source.cardNumber).toBe('BS9-001@1')
      expect(result.source.variant).toBe('1')
    }
  })

  it('converts ITEM, TRAP, and STAGE into non-cookie runtime cards', () => {
    for (const type of ['item', 'trap', 'stage'] as const) {
      const result = convertOfficialCardToGameCard(
        createOfficialCard({
          type,
          officialType: type.toUpperCase(),
          level: null,
          hp: null,
          attackText: '<{R}> Effect text',
        }),
      )

      expect(result.status).toBe('converted')

      if (result.status === 'converted') {
        expect(result.gameCard.type).toBe(type)
      }
    }
  })

  it('returns unsupported for EXTRA and incomplete cookie records', () => {
    expect(
      convertOfficialCardToGameCard(
        createOfficialCard({ type: 'extra', officialType: 'EXTRA' }),
      ),
    ).toMatchObject({
      status: 'unsupported',
      reason: 'unsupported-card-type',
    })

    expect(
      convertOfficialCardToGameCard(createOfficialCard({ hp: null })),
    ).toMatchObject({
      status: 'unsupported',
      reason: 'missing-cookie-stats',
    })
  })
})
