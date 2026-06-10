import { describe, expect, it } from 'vitest'
import officialGreenSample from '../../data/cards/official-starter-deck-green.en.json'
import officialSample from '../../data/cards/official-sample.en.json'
import officialYellowSample from '../../data/cards/official-starter-deck-yellow.en.json'
import {
  convertOfficialCardToGameCard,
  convertOfficialCards,
  parseOfficialCardText,
  type OfficialCardRecord,
} from '.'

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
