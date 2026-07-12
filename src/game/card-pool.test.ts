import { describe, expect, it } from 'vitest'
import {
  getAllCardPoolEntries,
  getCardPoolEntry,
  getCardPoolVariants,
  normalizeCardNumber,
} from './card-pool'

const BS2_031_BASE = 'BS2-031'
const BS2_031_VARIANT = 'BS2-031@1'
const ST1_001 = 'ST1-001'

describe('card-pool @ variant merging', () => {
  it('treats BS2-031 and BS2-031@1 as the same card via getCardPoolEntry', () => {
    const baseEntry = getCardPoolEntry(BS2_031_BASE)
    const variantEntry = getCardPoolEntry(BS2_031_VARIANT)

    expect(baseEntry).toBeDefined()
    expect(variantEntry).toBeDefined()
    expect(variantEntry).toBe(baseEntry)
    expect(variantEntry?.cardNumber).toBe(BS2_031_BASE)
  })

  it('returns a non-empty list of variants for a card that has @1 entries', () => {
    const variants = getCardPoolVariants(BS2_031_BASE)
    expect(variants.length).toBeGreaterThanOrEqual(2)
    expect(variants.map((card) => card.cardNumber).sort()).toEqual(
      [BS2_031_BASE, BS2_031_VARIANT].sort(),
    )
  })

  it('returns only one entry per base card from getAllCardPoolEntries', () => {
    const all = getAllCardPoolEntries()
    const variantEntries = all.filter((entry) => entry.cardNumber.includes('@'))
    expect(variantEntries).toEqual([])

    const bs2031Entries = all.filter((entry) => entry.cardNumber === BS2_031_BASE)
    expect(bs2031Entries.length).toBe(1)
  })

  it('normalizeCardNumber canonicalizes @ variants and unknown inputs', () => {
    expect(normalizeCardNumber(BS2_031_VARIANT)).toBe(BS2_031_BASE)
    expect(normalizeCardNumber(BS2_031_BASE)).toBe(BS2_031_BASE)
    expect(normalizeCardNumber(`  ${BS2_031_VARIANT}  `)).toBe(BS2_031_BASE)
    expect(normalizeCardNumber('UNKNOWN-999')).toBe('UNKNOWN-999')
  })

  it('still resolves plain starter-deck numbers unchanged', () => {
    const entry = getCardPoolEntry(ST1_001)
    expect(entry).toBeDefined()
    expect(entry?.cardNumber).toBe(ST1_001)
  })
})
