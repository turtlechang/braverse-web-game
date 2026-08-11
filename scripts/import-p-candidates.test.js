import { describe, expect, it } from 'vitest'
import {
  createP0xxCandidateDocument,
  getDistinctBaseCardNumbers,
  selectP0xxRawCards,
} from './import-p-candidates.mjs'

const makeRawCard = (cardNo, overrides = {}) => ({
  card_idx: cardNo,
  site_lang: 'en',
  card_no: cardNo,
  card_image: `https://cookierunbraverse.com/data/en_storage/${cardNo}.webp`,
  card_name: `Card ${cardNo}`,
  card_type: 'COOKIE',
  card_rare: 'P',
  card_level: '1',
  card_hp: '3',
  card_energy_type: 'RED',
  card_grade: 'PROMOTION',
  card_skill_name: '',
  card_skill_text: '',
  card_attack_text: '<{R}> Deals 1 damage.',
  card_flip: '',
  card_product_title: 'PROMOTION CARD',
  card_product_category: '',
  category_product_idx: 1,
  card_enable: 1,
  card_is_ban: 0,
  card_is_hidden: 0,
  card_is_extra: 0,
  card_is_limit: 0,
  card_keyword: '',
  card_color: 'RED',
  update_dt: '2026-08-10T00:00:00.000Z',
  ...overrides,
})

describe('P-0XX candidate importer', () => {
  it('selects only P-0XX records and excludes existing card numbers', () => {
    const selected = selectP0xxRawCards(
      [
        makeRawCard('P-036'),
        makeRawCard('P-036@1'),
        makeRawCard('BS5-001'),
        makeRawCard('P-001'),
      ],
      ['P-001'],
    )

    expect(selected.map((card) => card.card_no)).toEqual(['P-036', 'P-036@1'])
  })

  it('preserves art variants and records the remaining source scope', () => {
    const document = createP0xxCandidateDocument({
      rawCards: [makeRawCard('P-036'), makeRawCard('P-036@1')],
      existingCardNumbers: ['P-001'],
      sourceUrl: 'https://example.test/cards.json',
      importedAt: '2026-08-10T00:00:00.000Z',
    })

    expect(document.cards.map((card) => card.cardNumber)).toEqual([
      'P-036',
      'P-036@1',
    ])
    expect(getDistinctBaseCardNumbers(document.cards)).toEqual(['P-036'])
    expect(document.source.matchedAvailable).toBe(2)
    expect(document.source.importedCount).toBe(2)
    expect(document.source.existingCardCount).toBe(1)
    expect(document.source.candidateStatus).toBe('inventory')
  })
})
