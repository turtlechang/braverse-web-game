import { describe, expect, it } from 'vitest'
import {
  createBs12CandidateDocument,
  runBs12CandidateImport,
} from './import-bs12-candidates.mjs'

const raw = {
  card_idx: 1,
  card_no: 'BS12-005',
  card_name: 'Cherry Cola Cookie',
  card_type: 'FLIP',
  card_level: '1',
  card_hp: '1',
  card_color: 'RED',
  card_energy_type: 'RED',
  card_image: 'https://cookierunbraverse.com/data/en_storage/example.webp',
  card_attack_text: '<{R}{R}> Fizzy Sword Dance {da} 2',
  card_flip:
    '<Discard 1 card.> The Cookie with this card attached for HP gains +1 HP.',
}

describe('BS12 candidate import isolation', () => {
  it('keeps variants and original effect text while excluding other series', () => {
    const result = createBs12CandidateDocument({
      rawCards: [
        raw,
        { ...raw, card_idx: 2, card_no: 'BS12-005@1' },
        { ...raw, card_no: 'BS10-001' },
      ],
      importedAt: '2026-09-22T00:00:00.000Z',
    })

    expect(result.source).toMatchObject({
      candidateStatus: 'inventory',
      matchedAvailable: 2,
      importedCount: 2,
      fetchedAt: '2026-09-22T00:00:00.000Z',
    })
    expect(result.cards.map((card) => card.cardNumber)).toEqual([
      'BS12-005',
      'BS12-005@1',
    ])
    expect(result.cards[0].flipText).toBe(raw.card_flip)
    expect(result.cards[1].baseCardNumber).toBe('BS12-005')
    expect(result.cards[1].imageUrl).toBe(raw.card_image)
  })

  it('rejects missing, empty, and duplicate source records', () => {
    expect(() => createBs12CandidateDocument({ rawCards: null })).toThrow(
      'cardList',
    )
    expect(() => createBs12CandidateDocument({ rawCards: [] })).toThrow(
      'BS12-',
    )
    expect(() => createBs12CandidateDocument({ rawCards: [raw, raw] })).toThrow(
      '重複',
    )
  })

  it('fails before writing on an HTTP error', async () => {
    await expect(
      runBs12CandidateImport({
        fetchImpl: async () => ({ ok: false, status: 503 }),
      }),
    ).rejects.toThrow('HTTP 503')
  })
})
