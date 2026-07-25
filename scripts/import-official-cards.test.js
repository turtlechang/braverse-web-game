import { describe, expect, it } from 'vitest'
import {
  backfillVariantStats,
  createImportDocument,
  getDatasetUrl,
  normalizeOfficialCard,
} from './import-official-cards.mjs'

const rawCard = {
  card_idx: 46297,
  site_lang: 'en',
  card_no: 'BS9-001@1',
  card_image:
    'https://cookierunbraverse.com/data/en_storage/example.webp',
  card_name: 'Icicle Yeti Cookie',
  card_type: 'FLIP',
  card_rare: 'C',
  card_level: '2',
  card_hp: '3',
  card_energy_type: 'RED',
  card_grade: 'COMMON',
  card_skill_name: '',
  card_skill_text: '',
  card_attack_text: '<{R}{R}> Pointy Icicle {da} 2',
  card_flip: 'Select up to 1 of your Cookies.',
  card_product_title: 'BOOSTER PACK [A Game of Truth and Deceit]',
  card_product_category: '',
  category_product_idx: 241,
  card_enable: 1,
  card_is_ban: 0,
  card_is_hidden: 0,
  card_is_extra: 0,
  card_is_limit: 0,
  card_keyword: 'BEAST, Arena',
  card_color: 'RED',
  update_dt: '2026-06-05T01:22:38.000Z',
}

describe('official card importer', () => {
  it('normalizes official fields and preserves art variants', () => {
    const card = normalizeOfficialCard(rawCard, getDatasetUrl('en'))

    expect(card.cardNumber).toBe('BS9-001@1')
    expect(card.baseCardNumber).toBe('BS9-001')
    expect(card.variant).toBe('1')
    expect(card.type).toBe('flip')
    expect(card.officialType).toBe('FLIP')
    expect(card.attackText).toBe(rawCard.card_attack_text)
    expect(card.flipText).toBe(rawCard.card_flip)
    expect(card.level).toBe(2)
    expect(card.hp).toBe(3)
    expect(card.keywords).toEqual(['BEAST', 'Arena'])
    expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
  })

  it('limits output and records that images were not downloaded', () => {
    const document = createImportDocument({
      rawCards: [rawCard, { ...rawCard, card_idx: 2, card_no: 'BS9-001' }],
      locale: 'en',
      limit: 1,
      categoryTitle: null,
      sourceUrl: getDatasetUrl('en'),
      importedAt: '2026-06-06T00:00:00.000Z',
    })

    expect(document.cards).toHaveLength(1)
    expect(document.source.totalAvailable).toBe(2)
    expect(document.source.matchedAvailable).toBe(2)
    expect(document.source.importedCount).toBe(1)
    expect(document.source.imagesDownloaded).toBe(false)
  })

  it('filters by official product title before applying the limit', () => {
    const document = createImportDocument({
      rawCards: [
        rawCard,
        {
          ...rawCard,
          card_idx: 2,
          card_no: 'ST1-001',
          card_product_title: 'Starter Deck RED',
        },
        {
          ...rawCard,
          card_idx: 3,
          card_no: 'ST1-002',
          card_product_title: 'Starter Deck RED',
        },
      ],
      locale: 'en',
      limit: 1,
      categoryTitle: 'Starter Deck RED',
      sourceUrl: getDatasetUrl('en'),
      importedAt: '2026-06-06T00:00:00.000Z',
    })

    expect(document.source.totalAvailable).toBe(3)
    expect(document.source.matchedAvailable).toBe(2)
    expect(document.source.filter.categoryTitle).toBe('Starter Deck RED')
    expect(document.cards.map((card) => card.cardNumber)).toEqual([
      'ST1-001',
    ])
  })

  it('backfills only missing gameplay fields for art variants', () => {
    const [base, variant] = backfillVariantStats([
      normalizeOfficialCard(
        { ...rawCard, card_no: 'BS9-001' },
        getDatasetUrl('en'),
      ),
      normalizeOfficialCard(
        {
          ...rawCard,
          card_idx: 3,
          card_no: 'BS9-001@2',
          card_level: '',
          card_hp: '',
          card_energy_type: '',
          card_color: '',
        },
        getDatasetUrl('en'),
      ),
    ])

    expect(variant.level).toBe(base.level)
    expect(variant.hp).toBe(base.hp)
    expect(variant.energyType).toBe(base.energyType)
    expect(variant.color).toBe(base.color)
  })

  it('rejects unsupported locales', () => {
    expect(() => getDatasetUrl('zh-TW')).toThrow('不支援的語系')
  })
})
