import { describe, expect, it } from 'vitest'
import {
  createBs4CandidateDocument,
  createBs4InventoryMarkdown,
  selectBs4RawCards,
} from './import-bs4-candidates.mjs'

const rawCard = {
  card_idx: 40001,
  site_lang: 'en',
  card_no: 'BS4-073',
  card_image: 'https://cookierunbraverse.com/data/en_storage/example.webp',
  card_name: 'Sea Fairy Cookie',
  card_type: 'COOKIE',
  card_rare: 'R',
  card_level: '3',
  card_hp: '5',
  card_energy_type: 'BLUE',
  card_grade: 'RARE',
  card_skill_name: 'Soaring Compassion',
  card_skill_text:
    '{ap} <{B}> <Place 1 LV.2 or lower Cookie from your battle area on the bottom of your deck.> Deals 1 damage to all of your opponent’s Cookies.',
  card_attack_text: '<{B}{B}{B}> Tidal Wave {da} 2',
  card_flip: '',
  card_product_title: 'BOOSTER PACK [Age of Heroes and Kingdoms]',
  card_product_category: '',
  category_product_idx: 210,
  card_enable: 1,
  card_is_ban: 0,
  card_is_hidden: 0,
  card_is_extra: 0,
  card_is_limit: 0,
  card_keyword: '',
  card_color: 'BLUE',
  update_dt: '2026-07-01T00:00:00.000Z',
}

describe('BS4 candidate importer', () => {
  it('selects all BS4 records by card-number prefix, including variants', () => {
    expect(
      selectBs4RawCards([
        rawCard,
        { ...rawCard, card_no: 'BS4-073@1' },
        { ...rawCard, card_no: 'BS3-088' },
      ]).map((card) => card.card_no),
    ).toEqual(['BS4-073', 'BS4-073@1'])
  })

  it('creates a non-promotable inventory candidate document', () => {
    const document = createBs4CandidateDocument({
      rawCards: [rawCard, { ...rawCard, card_idx: 2, card_no: 'BS4-073@1' }],
      importedAt: '2026-08-03T00:00:00.000Z',
    })

    expect(document.source).toMatchObject({
      totalAvailable: 2,
      matchedAvailable: 2,
      importedCount: 2,
      candidateStatus: 'inventory',
    })
    expect(document.cards.map((card) => card.baseCardNumber)).toEqual([
      'BS4-073',
      'BS4-073',
    ])
  })

  it('records mechanic anchors in the report', () => {
    const document = createBs4CandidateDocument({
      rawCards: [rawCard],
      importedAt: '2026-08-03T00:00:00.000Z',
    })

    const markdown = createBs4InventoryMarkdown(document)
    expect(markdown).toContain('| `PURE` 顏色 | 0 | — |')
    expect(markdown).toContain('| `Soul Jam` 名稱 | 0 | — |')
    expect(markdown).toContain('尚未開始 BS4 的 runtime 轉接')
    expect(markdown).toContain('[BS3 卡表盤點](bs3-card-inventory.md)')
  })

  it('rejects a source payload without BS4 records', () => {
    expect(() =>
      createBs4CandidateDocument({
        rawCards: [{ ...rawCard, card_no: 'BS3-088' }],
      }),
    ).toThrow(/沒有 BS4-/)
  })
})
