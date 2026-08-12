import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  createBs6CandidateDocument,
  createBs6InventoryMarkdown,
  getBs6VariantStats,
  selectBs6RawCards,
} from './import-bs6-candidates.mjs'

const rawCard = {
  card_idx: 60001,
  site_lang: 'en',
  card_no: 'BS6-001',
  card_image: 'https://cookierunbraverse.com/data/en_storage/example.webp',
  card_name: 'BS6 Test Cookie',
  card_type: 'COOKIE',
  card_rare: 'R',
  card_level: '3',
  card_hp: '5',
  card_energy_type: 'RED',
  card_grade: 'RARE',
  card_skill_name: 'Test Skill',
  card_skill_text: '{ap} <Deals 1 damage.>',
  card_attack_text: '<{R}> Test Attack {da} 1',
  card_flip: '',
  card_product_title: 'BOOSTER PACK [BS6]',
  card_product_category: '',
  category_product_idx: 260,
  card_enable: 1,
  card_is_ban: 0,
  card_is_hidden: 0,
  card_is_extra: 0,
  card_is_limit: 0,
  card_keyword: '',
  card_color: 'RED',
  update_dt: '2026-08-11T00:00:00.000Z',
}

describe('BS6 candidate importer', () => {
  it('selects BS6 records by card-number prefix and keeps variants', () => {
    expect(
      selectBs6RawCards([
        rawCard,
        { ...rawCard, card_no: 'BS6-001@1' },
        { ...rawCard, card_no: 'BS5-111' },
      ]).map((card) => card.card_no),
    ).toEqual(['BS6-001', 'BS6-001@1'])
  })

  it('creates an inventory candidate that is not promotion-ready', () => {
    const document = createBs6CandidateDocument({
      rawCards: [rawCard, { ...rawCard, card_idx: 2, card_no: 'BS6-001@1' }],
      importedAt: '2026-08-11T00:00:00.000Z',
    })

    expect(document.source).toMatchObject({
      totalAvailable: 2,
      matchedAvailable: 2,
      importedCount: 2,
      candidateStatus: 'inventory',
    })
    expect(document.cards.map((card) => card.baseCardNumber)).toEqual([
      'BS6-001',
      'BS6-001',
    ])
  })

  it('renders the runtime, Chrome, and promotion gates in the inventory', () => {
    const document = createBs6CandidateDocument({ rawCards: [rawCard] })
    const markdown = createBs6InventoryMarkdown(document)

    expect(markdown).toContain('# BS6 卡牌資料盤點（資料準備期）')
    expect(markdown).toContain('候選狀態：`inventory`')
    expect(markdown).toContain('Chrome 合法／不合法路徑驗證')
    expect(markdown).toContain('不執行 `npm run promote:candidate`')
  })

  it('counts base records and variants independently when a base card only has variants', () => {
    const document = createBs6CandidateDocument({
      rawCards: [
        rawCard,
        { ...rawCard, card_idx: 2, card_no: 'BS6-001@1' },
        { ...rawCard, card_idx: 3, card_no: 'BS6-091@2' },
        { ...rawCard, card_idx: 4, card_no: 'BS6-091@3' },
      ],
    })
    const stats = getBs6VariantStats(document.cards)
    const markdown = createBs6InventoryMarkdown(document)

    expect(stats.baseCardNumbers).toEqual(['BS6-001', 'BS6-091'])
    expect(stats.baseRecords).toHaveLength(1)
    expect(stats.variants).toHaveLength(3)
    expect(stats.variantOnlyBaseCardNumbers).toEqual(['BS6-091'])
    expect(markdown).toContain('| 不同基礎卡號 | 2 |')
    expect(markdown).toContain('| 基礎記錄（無 `@` 變體尾碼） | 1 |')
    expect(markdown).toContain('| 變體記錄（含 `@` 變體尾碼） | 3 |')
    expect(markdown).toContain('| 僅有變體的基礎卡號 | 1（BS6-091） |')
  })

  it('matches the promoted BS6 snapshot statistics', () => {
    const snapshot = JSON.parse(
      readFileSync(
        new URL(
          '../data/cards/official-age-of-heroes-and-kingdoms-bs6.en.json',
          import.meta.url,
        ),
        'utf8',
      ),
    )
    const stats = getBs6VariantStats(snapshot.cards)

    expect(snapshot.cards).toHaveLength(138)
    expect(stats.baseCardNumbers).toHaveLength(107)
    expect(stats.baseRecords).toHaveLength(106)
    expect(stats.variants).toHaveLength(32)
    expect(stats.variantOnlyBaseCardNumbers).toEqual(['BS6-091'])
  })

  it('rejects a source payload without BS6 records', () => {
    expect(() =>
      createBs6CandidateDocument({
        rawCards: [{ ...rawCard, card_no: 'BS5-111' }],
      }),
    ).toThrow(/沒有 BS6-/)
  })
})
