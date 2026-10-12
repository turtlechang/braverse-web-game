import { describe, expect, it } from 'vitest'
import { getAllCardPoolEntries } from '../src/game/card-pool'
import { createAiCapabilityAudit } from './audit-ai-capabilities'

describe('AI capability promotion audit', () => {
  it('BS7 正式卡池報告可重現且所有卡都能明確分類', () => {
    const entries = getAllCardPoolEntries()
    const first = createAiCapabilityAudit(entries, {
      series: 'BS7',
      generatedAt: '2026-08-22T00:00:00.000Z',
    })
    const second = createAiCapabilityAudit(entries, {
      series: 'bs7',
      generatedAt: '2026-08-22T00:00:00.000Z',
    })

    expect(first).toEqual(second)
    expect(first.cardCount).toBeGreaterThan(0)
    expect(first.inventoryEntryCount).toBeGreaterThanOrEqual(first.cardCount)
    expect(first.capabilityCount).toBeGreaterThan(0)
    expect(first.comboCandidateCount).toBeGreaterThan(0)
    expect(first.status).toBe('ready')
    expect(first.unsupportedEffectKinds).toEqual({})
    expect(first.conversionFailures).toEqual([])
  })

  it('全正式卡池不會漏掉無法轉接的卡', () => {
    const report = createAiCapabilityAudit(getAllCardPoolEntries(), {
      generatedAt: '2026-08-22T00:00:00.000Z',
    })
    expect(report.cardCount).toBeGreaterThan(500)
    // Formal ST7-018 adds one enabled, non-variant playable printing.
    expect(report.inventoryEntryCount).toBe(2_070)
    expect(report.cardCount).toBe(1_587)
    expect(report.comboCandidateCount).toBeGreaterThan(0)
    expect(report.conversionFailures).toEqual([])
    expect(report.unsupportedCardIds).toEqual([
      'BS11-031',
      'BS11-047',
      'BS11-054',
      'BS11-064',
      'BS11-071',
      'BS11-083',
      'BS11-090',
      'BS11-092',
      'BS12-014',
      'BS12-015',
      'BS12-082',
      'BS8-042',
      'BS8-076',
      'BS8-084',
      'BS9-043',
      'BS9-079',
      'BS9-096',
      'BS9-106',
      'BS9-107',
      'BS9-108',
      'BS9-111',
    ])
    expect(report.status).toBe('conservative')
  })

  it.each([{id:'BS8-079',printings:1},{id:'BS8-083',printings:2}])('classifies every original unconditional next-Active printing of $id',({id,printings})=>{
    const entries=getAllCardPoolEntries().filter(entry=>entry.poolId===id)
    expect(entries).toHaveLength(printings)
    const report=createAiCapabilityAudit(entries)
    expect(report.inventoryEntryCount).toBe(printings)
    expect(report.cardCount).toBe(1)
    expect(report.conversionFailures).toEqual([])
    expect(report.unsupportedCardIds).toEqual([])
    expect(report.status).toBe('ready')
  })

  it.each(['ST6-002', 'ST6-003', 'ST6-004', 'ST6-005', 'ST6-006', 'ST7-011', 'ST7-013', 'ST7-008', 'ST7-010', 'ST7-014', 'ST7-015', 'ST7-016', 'ST7-017'])('includes promoted %s without conversion or capability gaps', cardNumber => {
    const entries = getAllCardPoolEntries().filter(entry => entry.poolId === cardNumber)
    expect(entries).toHaveLength(1)
    const report = createAiCapabilityAudit(entries, {
      generatedAt: '2026-10-10T00:00:00.000Z',
    })
    expect(report.inventoryEntryCount).toBe(1)
    expect(report.cardCount).toBe(1)
    expect(report.conversionFailures).toEqual([])
    expect(report.unsupportedCardIds).toEqual([])
    expect(report.status).toBe('ready')
  })
})
