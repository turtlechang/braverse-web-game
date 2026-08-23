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
    expect(report.inventoryEntryCount).toBe(1_244)
    expect(report.cardCount).toBe(967)
    expect(report.comboCandidateCount).toBeGreaterThan(0)
    expect(report.conversionFailures).toEqual([])
    expect(report.status).toBe('ready')
  })
})
