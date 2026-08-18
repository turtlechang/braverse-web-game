import { describe, expect, it } from 'vitest'
import {
  getAllCardPoolEntries,
  getCardPoolEntry,
  getCardPoolVariants,
  hasFlipAbility,
  normalizeCardNumber,
} from './card-pool'

const BS2_031_BASE = 'BS2-031'
const BS2_031_VARIANT = 'BS2-031@1'
const BS6_091_BASE = 'BS6-091'
const BS6_091_VARIANT = 'BS6-091@2'
const ST1_001 = 'ST1-001'

describe('hasFlipAbility runtime consistency', () => {
  it.each([
    // 官方 type=flip 一律算 FLIP（即使 flipText 為空的 vanilla FLIP）
    ['P-099', true],
    ['BS3-012', true],
    ['BS2-042', true],
    ['P-047', true],
    // type=cookie 只有在轉接後真的有 FlipAbility 才算 FLIP
    ['BS5-073', true],
    ['BS5-074', true],
    // 官方把攻擊名重複寫進 flipText 的普通餅乾／變體：不算 FLIP
    ['P-056', false],
    ['P-057', false],
    ['P-069', false],
    ['BS4-004@1', false],
    ['BS4-045@1', false],
    ['BS4-080@1', false],
    ['BS5-039@2', false],
  ])('hasFlipAbility(%s) matches runtime FlipAbility (%s)', (cardNumber, expected) => {
    const entry = getCardPoolEntry(cardNumber)
    expect(entry, 'missing pool entry ' + cardNumber).toBeDefined()
    expect(hasFlipAbility(entry!)).toBe(expected)
  })

  it('counts a normal Cookie with a real FlipAbility toward the FLIP limit (BS5-073)', () => {
    const entry = getCardPoolEntry('BS5-073')
    expect(entry).toBeDefined()
    expect(hasFlipAbility(entry!)).toBe(true)
  })
})

describe('card-pool @ variant merging', () => {
  it('returns separate base and @1 variant entries via getCardPoolEntry', () => {
    const baseEntry = getCardPoolEntry(BS2_031_BASE)
    const variantEntry = getCardPoolEntry(BS2_031_VARIANT)

    expect(baseEntry).toBeDefined()
    expect(variantEntry).toBeDefined()
    expect(variantEntry).not.toBe(baseEntry)
    expect(baseEntry?.cardNumber).toBe(BS2_031_BASE)
    expect(variantEntry?.cardNumber).toBe(BS2_031_VARIANT)
  })

  it('returns a non-empty list of variants for a card that has @1 entries', () => {
    const variants = getCardPoolVariants(BS2_031_BASE)
    expect(variants.length).toBeGreaterThanOrEqual(2)
    expect(variants.map((card) => card.cardNumber).sort()).toEqual(
      [BS2_031_BASE, BS2_031_VARIANT].sort(),
    )
  })

  it('exposes both base and @1 variant rows from getAllCardPoolEntries', () => {
    const all = getAllCardPoolEntries()
    const variantEntries = all.filter((entry) =>
      entry.cardNumber.startsWith(`${BS2_031_BASE}@`),
    )
    expect(variantEntries.length).toBeGreaterThan(0)

    const baseRows = all.filter((entry) => entry.cardNumber === BS2_031_BASE)
    expect(baseRows.length).toBe(1)
  })

  it('normalizeCardNumber canonicalizes @ variants and unknown inputs', () => {
    expect(normalizeCardNumber(BS2_031_VARIANT)).toBe(BS2_031_BASE)
    expect(normalizeCardNumber(BS2_031_BASE)).toBe(BS2_031_BASE)
    expect(normalizeCardNumber(`  ${BS2_031_VARIANT}  `)).toBe(BS2_031_BASE)
    expect(normalizeCardNumber('UNKNOWN-999')).toBe('UNKNOWN-999')
  })

  it('resolves a base number that is represented only by variants', () => {
    const baseEntry = getCardPoolEntry(BS6_091_BASE)
    const variantEntry = getCardPoolEntry(BS6_091_VARIANT)

    expect(baseEntry?.cardNumber).toBe(BS6_091_BASE)
    expect(variantEntry?.cardNumber).toBe(BS6_091_VARIANT)
    expect(getCardPoolVariants(BS6_091_BASE).map((card) => card.cardNumber).sort()).toEqual([
      'BS6-091@2',
      'BS6-091@3',
    ])
  })

  it('still resolves plain starter-deck numbers unchanged', () => {
    const entry = getCardPoolEntry(ST1_001)
    expect(entry).toBeDefined()
    expect(entry?.cardNumber).toBe(ST1_001)
  })

  it('keeps base and variant imageUrl from their own raw records', () => {
    const baseEntry = getCardPoolEntry(BS2_031_BASE)
    const variantEntry = getCardPoolEntry(BS2_031_VARIANT)

    expect(baseEntry).toBeDefined()
    expect(variantEntry).toBeDefined()
    const baseVariants = getCardPoolVariants(BS2_031_BASE)
    const baseRecord = baseVariants.find((card) => card.cardNumber === BS2_031_BASE)
    const variantRecord = baseVariants.find(
      (card) => card.cardNumber === BS2_031_VARIANT,
    )
    expect(baseEntry?.imageUrl).toBe(baseRecord?.imageUrl)
    expect(variantEntry?.imageUrl).toBe(variantRecord?.imageUrl)
  })
})

