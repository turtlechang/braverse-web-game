import { describe, expect, it } from 'vitest'
import {
  createBs8CandidateDocument,
  createBs8InventoryMarkdown,
  getBs8VariantStats,
  selectBs8RawCards,
} from './import-bs8-candidates.mjs'

const rawCard = {
  card_idx: 80001,
  site_lang: 'en',
  card_no: 'BS8-001',
  card_image: 'https://cookierunbraverse.com/data/en_storage/example.webp',
  card_name: 'BS8 Test Extra',
  card_type: 'EXTRA',
  card_rare: 'R',
  card_level: '3',
  card_hp: '5',
  card_energy_type: 'RED',
  card_grade: 'RARE',
  card_skill_name: 'Test Skill',
  card_skill_text: '{ap} <Deals 1 damage.>',
  card_attack_text: '<{R}> Test Attack {da} 1',
  card_flip: '',
  card_product_title: 'BOOSTER PACK [BS8]',
  card_product_category: '',
  category_product_idx: 280,
  card_enable: 1,
  card_is_ban: 0,
  card_is_hidden: 0,
  card_is_extra: 1,
  card_is_limit: 0,
  card_keyword: 'Arena',
  card_color: 'RED',
  update_dt: '2026-08-28T00:00:00.000Z',
}

describe('BS8 candidate importer', () => {
  it('selects BS8 records by card-number prefix and keeps variants', () => {
    expect(
      selectBs8RawCards([
        rawCard,
        { ...rawCard, card_no: 'BS8-001@1' },
        { ...rawCard, card_no: 'BS7-108' },
      ]).map((card) => card.card_no),
    ).toEqual(['BS8-001', 'BS8-001@1'])
  })

  it('creates an inventory candidate with EXTRA cards still isolated', () => {
    const document = createBs8CandidateDocument({
      rawCards: [rawCard, { ...rawCard, card_idx: 2, card_no: 'BS8-001@1' }],
      importedAt: '2026-08-28T00:00:00.000Z',
    })

    expect(document.source).toMatchObject({
      totalAvailable: 2,
      matchedAvailable: 2,
      importedCount: 2,
      candidateStatus: 'inventory',
    })
    expect(document.cards.map((card) => card.type)).toEqual(['extra', 'extra'])
    expect(document.cards.every((card) => card.flags.extra)).toBe(true)
  })

  it('renders EXTRA and promotion boundaries in the inventory', () => {
    const document = createBs8CandidateDocument({ rawCards: [rawCard] })
    const markdown = createBs8InventoryMarkdown(document)

    expect(markdown).toContain('# BS8 Land of Fire & Ruin, Realm of Apathy 卡牌資料盤點（候選資料）')
    expect(markdown).toContain('| `EXTRA` 類型／旗標 | 1 | BS8-001 |')
    expect(markdown).toContain('EXTRA Deck、覆蓋與進入戰鬥區的規則')
    expect(markdown).toContain('不執行 `npm run promote:candidate`')
  })

  it('counts base records and variants independently when a base card only has variants', () => {
    const document = createBs8CandidateDocument({
      rawCards: [
        rawCard,
        { ...rawCard, card_idx: 2, card_no: 'BS8-001@1' },
        { ...rawCard, card_idx: 3, card_no: 'BS8-103@2' },
        { ...rawCard, card_idx: 4, card_no: 'BS8-103@3' },
      ],
    })
    const stats = getBs8VariantStats(document.cards)

    expect(stats.baseCardNumbers).toEqual(['BS8-001', 'BS8-103'])
    expect(stats.baseRecords).toHaveLength(1)
    expect(stats.variants).toHaveLength(3)
    expect(stats.variantOnlyBaseCardNumbers).toEqual(['BS8-103'])
  })

  it('rejects a source payload without BS8 records', () => {
    expect(() =>
      createBs8CandidateDocument({
        rawCards: [{ ...rawCard, card_no: 'BS7-108' }],
      }),
    ).toThrow(/沒有 BS8-/)
  })
})
