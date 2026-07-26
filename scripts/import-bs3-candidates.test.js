import { describe, expect, it } from 'vitest'
import {
  createBs3CandidateDocument,
  createBs3InventoryMarkdown,
  selectBs3RawCards,
} from './import-bs3-candidates.mjs'

const rawCard = {
  card_idx: 30001,
  site_lang: 'en',
  card_no: 'BS3-121',
  card_image: 'https://cookierunbraverse.com/data/en_storage/example.webp',
  card_name: 'Age of Heroes and Kingdoms',
  card_type: 'STAGE',
  card_rare: 'SR',
  card_level: '',
  card_hp: '',
  card_energy_type: 'RED YELLOW GREEN BLUE PURPLE',
  card_grade: 'SUPER RARE',
  card_skill_name: '',
  card_skill_text: '<{R}{Y}{G}{B}{P}> Place in your stage area.',
  card_attack_text:
    '{mob} <{R}{Y}{G}{B}{P}> <Rest this card.> If your battle area and support area contain 5 different [Ancient] Cookies and 5 different [Soul Jam] cards, you win the game.',
  card_flip: '',
  card_product_title: 'BOOSTER PACK [Age of Heroes and Kingdoms]',
  card_product_category: '',
  category_product_idx: 209,
  card_enable: 1,
  card_is_ban: 0,
  card_is_hidden: 0,
  card_is_extra: 0,
  card_is_limit: 0,
  card_keyword: '',
  card_color: 'PURE',
  update_dt: '2026-07-01T00:00:00.000Z',
}

describe('BS3 candidate importer', () => {
  it('selects all BS3 records by card-number prefix, including variants', () => {
    expect(
      selectBs3RawCards([
        rawCard,
        { ...rawCard, card_no: 'BS3-121@1' },
        { ...rawCard, card_no: 'BS4-001' },
      ]).map((card) => card.card_no),
    ).toEqual(['BS3-121', 'BS3-121@1'])
  })

  it('creates a non-promotable inventory candidate document', () => {
    const document = createBs3CandidateDocument({
      rawCards: [rawCard, { ...rawCard, card_idx: 2, card_no: 'BS3-121@1' }],
      importedAt: '2026-07-25T00:00:00.000Z',
    })

    expect(document.source).toMatchObject({
      totalAvailable: 2,
      matchedAvailable: 2,
      importedCount: 2,
      candidateStatus: 'inventory',
    })
    expect(document.cards.map((card) => card.baseCardNumber)).toEqual([
      'BS3-121',
      'BS3-121',
    ])
  })

  it('records PURE, Soul Jam, and special-victory anchors in the report', () => {
    const document = createBs3CandidateDocument({
      rawCards: [rawCard],
      importedAt: '2026-07-25T00:00:00.000Z',
    })

    const markdown = createBs3InventoryMarkdown(document)
    expect(markdown).toContain('| `PURE` 顏色 | 1 | BS3-121 |')
    expect(markdown).toContain('| `Soul Jam` 名稱 | 0 | — |')
    expect(markdown).toContain('| 特殊勝利文字 | 1 | BS3-121 |')
    expect(markdown).toContain('攻擊後「can be used as」的來源能量付款')
    expect(markdown).toContain('[BS3 效果轉接覆蓋盤點](bs3-effect-coverage.md)')
  })

  it('rejects a source payload without BS3 records', () => {
    expect(() =>
      createBs3CandidateDocument({
        rawCards: [{ ...rawCard, card_no: 'BS4-001' }],
      }),
    ).toThrow(/沒有 BS3-/)
  })
})
