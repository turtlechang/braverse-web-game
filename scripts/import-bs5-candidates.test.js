import { describe, expect, it } from 'vitest'
import {
  createBs5CandidateDocument,
  createBs5InventoryMarkdown,
  selectBs5RawCards,
} from './import-bs5-candidates.mjs'

const rawCard = {
  card_idx: 50001,
  site_lang: 'en',
  card_no: 'BS5-001',
  card_image: 'https://cookierunbraverse.com/data/en_storage/example.webp',
  card_name: 'BS5 Test Cookie',
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
  card_product_title: 'BOOSTER PACK [BS5]',
  card_product_category: '',
  category_product_idx: 250,
  card_enable: 1,
  card_is_ban: 0,
  card_is_hidden: 0,
  card_is_extra: 0,
  card_is_limit: 0,
  card_keyword: '',
  card_color: 'RED',
  update_dt: '2026-08-04T00:00:00.000Z',
}

describe('BS5 candidate importer', () => {
  it('selects BS5 records by card-number prefix and keeps variants', () => {
    expect(
      selectBs5RawCards([
        rawCard,
        { ...rawCard, card_no: 'BS5-001@1' },
        { ...rawCard, card_no: 'BS4-073' },
      ]).map((card) => card.card_no),
    ).toEqual(['BS5-001', 'BS5-001@1'])
  })

  it('creates an inventory candidate that is not promotion-ready', () => {
    const document = createBs5CandidateDocument({
      rawCards: [rawCard, { ...rawCard, card_idx: 2, card_no: 'BS5-001@1' }],
      importedAt: '2026-08-04T00:00:00.000Z',
    })

    expect(document.source).toMatchObject({
      totalAvailable: 2,
      matchedAvailable: 2,
      importedCount: 2,
      candidateStatus: 'inventory',
    })
    expect(document.cards.map((card) => card.baseCardNumber)).toEqual([
      'BS5-001',
      'BS5-001',
    ])
  })

  it('marks runtime and promote as follow-up gates in the inventory', () => {
    const document = createBs5CandidateDocument({
      rawCards: [rawCard],
      importedAt: '2026-08-04T00:00:00.000Z',
    })

    const markdown = createBs5InventoryMarkdown(document)
    expect(markdown).toContain('# BS5 卡牌資料盤點（資料準備期）')
    expect(markdown).toContain('候選狀態：`inventory`')
    expect(markdown).toContain('不執行 `npm run promote:candidate`')
  })

  it('rejects a source payload without BS5 records', () => {
    expect(() =>
      createBs5CandidateDocument({
        rawCards: [{ ...rawCard, card_no: 'BS4-073' }],
      }),
    ).toThrow(/沒有 BS5-/)
  })
})
