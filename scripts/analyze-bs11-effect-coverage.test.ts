import { describe, expect, it } from 'vitest'
import type { OfficialCardRecord } from '../src/cards/types'
import {
  analyzeBs11EffectCoverage,
  createBs11EffectCoverageMarkdown,
} from './analyze-bs11-effect-coverage'

const card = (overrides: Partial<OfficialCardRecord>): OfficialCardRecord =>
  ({
    cardNumber: 'BS11-001',
    baseCardNumber: 'BS11-001',
    sourceId: 1,
    name: 'Raspberry Mousse Cookie',
    locale: 'en',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/example.webp',
    type: 'cookie',
    variant: null,
    rarity: 'C',
    grade: 'COMMON',
    level: 1,
    hp: 2,
    energyType: 'RED MIX',
    color: 'RED',
    skill: { name: null, text: null },
    attackText: '<{N}> Fair Duel {da} 1',
    flipText: null,
    keywords: [],
    product: { id: 258, title: 'BOOSTER PACK [The Dark Enchantress War]', category: null },
    flags: { enabled: true, hidden: false, extra: false },
    restrictions: { banned: false, limited: false },
    officialUpdatedAt: null,
    ...overrides,
  }) as OfficialCardRecord

describe('BS11 effect coverage analyzer', () => {
  it('counts base cards once while retaining variant-aware source records separately', () => {
    const report = analyzeBs11EffectCoverage([
      card({ cardNumber: 'BS11-001' }),
      card({
        cardNumber: 'BS11-001@1',
        variant: '@1',
        sourceId: 2,
        imageUrl: 'https://cookierunbraverse.com/data/en_storage/variant.webp',
      }),
      card({
        cardNumber: 'BS11-003',
        baseCardNumber: 'BS11-003',
        sourceId: 3,
        name: 'Rose Cookie',
        type: 'flip',
        level: 2,
        hp: 3,
        energyType: 'RED',
        skill: { name: null, text: null },
        attackText: '<{R}{R}{R}> Passionate Step {da} 3',
        flipText: 'Draw up to 1 card from your deck.',
      }),
    ])

    expect(report.baseCardCount).toBe(2)
    expect(report.entries.map((entry) => entry.cardNumber)).toEqual([
      'BS11-001',
      'BS11-003',
    ])
    expect(report.entries.find((entry) => entry.cardNumber === 'BS11-003'))
      .toMatchObject({
        primaryConversion: 'supported',
        abilityConversion: 'converted',
      })
  })

  it('renders the exact coverage counts after the BS11-002 adapter', () => {
    const report = analyzeBs11EffectCoverage([
      card({
        cardNumber: 'BS11-002',
        baseCardNumber: 'BS11-002',
        sourceId: 4,
        name: 'Macaron Cookie',
        skill: {
          name: 'Macaron Parade',
          text: '【Activate】 <{R}> <Discard 1 {R} Item card from your hand.> Draw 1 card from your deck and select 1 of your opponent\'s Cookies. That Cookie receives 1 damage.',
        },
        attackText: '<{R}{R}{N}> Drum Performance {da} 2',
      }),
    ])
    const markdown = createBs11EffectCoverageMarkdown(report, [])
    const officialMarkdown = createBs11EffectCoverageMarkdown(
      report,
      [],
      'data/cards/official-dark-enchantress-war-bs11.en.json',
    )

    expect(report.primaryConversion.supported).toBe(1)
    expect(report.abilityConversion.converted).toBe(1)
    expect(markdown).toContain('| BS11-002 | supported | converted | not-applicable |')
    expect(officialMarkdown).toContain('BS11 轉接覆蓋盤點（正式卡池）')
    expect(officialMarkdown).not.toContain('候選維持 `inventory`')
  })

  it('counts an image-backed Cookie skill override even when the API text is null', () => {
    const report = analyzeBs11EffectCoverage([
      card({
        cardNumber: 'BS11-077',
        baseCardNumber: 'BS11-077',
        sourceId: 77,
        name: 'Dark Spirit Helmet',
        color: 'PURPLE',
        energyType: 'PURPLE',
        skill: { name: "{sk} Some Warrior's Soul", text: null },
        attackText: "<{P}{P}> Helmet's Curse {da} 2",
      }),
    ])

    expect(report.entries[0]).toMatchObject({
      primaryConversion: 'supported',
      abilityConversion: 'converted',
    })
  })
})
