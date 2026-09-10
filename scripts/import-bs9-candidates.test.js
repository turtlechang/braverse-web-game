import { describe, expect, it } from 'vitest'
import { createBs9CandidateDocument, runBs9CandidateImport } from './import-bs9-candidates.mjs'

const raw = {
  card_idx: 1, card_no: 'BS9-001@1', card_name: 'Icicle Yeti Cookie', card_type: 'FLIP',
  card_level: '2', card_hp: '3', card_color: 'RED', card_energy_type: 'RED',
  card_image: 'https://cookierunbraverse.com/data/en_storage/G2fck1k1zK2Vi2PeQy2GWA.webp',
  card_flip: 'Select up to 1 of your Cookies. During this turn, that Cookie receives -2 effect damage.',
}

describe('BS9 candidate import isolation', () => {
  it('keeps variants and original effect text while excluding other series', () => {
    const result = createBs9CandidateDocument({ rawCards: [raw, { ...raw, card_idx: 2, card_no: 'BS9-001@2' }, { ...raw, card_no: 'BS8-001' }] })
    expect(result.source.candidateStatus).toBe('inventory')
    expect(result.cards.map((card) => card.cardNumber)).toEqual(['BS9-001@1', 'BS9-001@2'])
    expect(result.cards[0].flipText).toBe(raw.card_flip)
    expect(result.cards[0].baseCardNumber).toBe('BS9-001')
  })
  it('rejects missing, empty, and duplicate source records', () => {
    expect(() => createBs9CandidateDocument({ rawCards: null })).toThrow('cardList')
    expect(() => createBs9CandidateDocument({ rawCards: [] })).toThrow('沒有 BS9-')
    expect(() => createBs9CandidateDocument({ rawCards: [raw, raw] })).toThrow('重複')
  })
  it('fails before writing on an HTTP error', async () => {
    await expect(runBs9CandidateImport({ fetchImpl: async () => ({ ok: false, status: 503 }) })).rejects.toThrow('HTTP 503')
  })
})
