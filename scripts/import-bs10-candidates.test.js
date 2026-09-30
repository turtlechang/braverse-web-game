import { describe, expect, it } from 'vitest'
import { createBs10CandidateDocument, runBs10CandidateImport } from './import-bs10-candidates.mjs'

const raw = {
  card_idx: 1, card_no: 'BS10-003', card_name: 'Raspberry Mousse Cookie', card_type: 'FLIP',
  card_level: '2', card_hp: '3', card_color: 'RED', card_energy_type: 'RED',
  card_image: 'https://cookierunbraverse.com/data/en_storage/ASWGTqjO30KzfI9y4U6CWw.webp',
  card_flip: 'Draw up to 1 card from your deck.',
}

describe('BS10 candidate import isolation', () => {
  it('keeps variants and original effect text while excluding other series', () => {
    const result = createBs10CandidateDocument({ rawCards: [raw, { ...raw, card_idx: 2, card_no: 'BS10-003@1' }, { ...raw, card_no: 'BS9-001' }] })
    expect(result.source.candidateStatus).toBe('inventory')
    expect(result.cards.map((card) => card.cardNumber)).toEqual(['BS10-003', 'BS10-003@1'])
    expect(result.cards[0].flipText).toBe(raw.card_flip)
    expect(result.cards[0].baseCardNumber).toBe('BS10-003')
  })
  it('rejects missing, empty, and duplicate source records', () => {
    expect(() => createBs10CandidateDocument({ rawCards: null })).toThrow('cardList')
    expect(() => createBs10CandidateDocument({ rawCards: [] })).toThrow('沒有 BS10-')
    expect(() => createBs10CandidateDocument({ rawCards: [raw, raw] })).toThrow('重複')
  })
  it('fails before writing on an HTTP error', async () => {
    await expect(runBs10CandidateImport({ fetchImpl: async () => ({ ok: false, status: 503 }) })).rejects.toThrow('HTTP 503')
  })
})
