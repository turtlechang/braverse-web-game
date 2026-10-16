import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import type { OfficialCardRecord } from '../src/cards/types'
import { getAllCardPoolEntries } from '../src/game/card-pool'
import { createAiCapabilityAudit } from './audit-ai-capabilities'
import { convertOfficialCardToGameCard } from '../src/cards/official-card-adapter'
import { extractCardCapabilities } from '../src/game/ai/strategy/capability-extractor'

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
    // Compare the generated runtime audit with independently read formal source
    // records, so a new promotion cannot hide a missing registry entry behind
    // a manually maintained count. This audit covers runtime card types; an
    // EXTRA flag on a Cookie is not a main-deck eligibility assertion.
    const directory = new URL('../data/cards/', import.meta.url)
    const sourceEntries = readdirSync(directory)
      .filter(name => name.endsWith('.json'))
      .flatMap(name => {
        const document: { cards: OfficialCardRecord[] } = JSON.parse(
          readFileSync(new URL(name, directory), 'utf8'),
        )
        return document.cards
      })
    const playable = sourceEntries.filter(entry => entry.flags.enabled &&
      !entry.flags.hidden && entry.type !== 'extra' && entry.type !== 'unknown')
    expect(new Set(sourceEntries.map(entry => entry.cardNumber)).size).toBe(sourceEntries.length)
    expect(report.inventoryEntryCount).toBe(playable.length)
    expect(report.cardCount).toBe(new Set(playable.map(entry =>
      entry.baseCardNumber || entry.cardNumber.split('@')[0],
    )).size)
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

  it.each(['ST6-002', 'ST6-003', 'ST6-004', 'ST6-005', 'ST6-006', 'ST7-011', 'ST7-013', 'ST7-008', 'ST7-010', 'ST7-014', 'ST7-015', 'ST7-016', 'ST7-017', 'ST7-020', 'ST8-001', 'ST8-002', 'ST8-003', 'ST8-004', 'ST8-005', 'ST8-006', 'ST8-007', 'ST8-008', 'ST8-009'])('includes promoted %s without conversion or capability gaps', cardNumber => {
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

  it('retains ST8-008 faint support and independently conditioned attack draw capabilities', () => {
    const entry = getAllCardPoolEntries().find(card => card.cardNumber === 'ST8-008')
    if (!entry) throw Error('Promoted ST8-008 required')
    const conversion = convertOfficialCardToGameCard(entry)
    if (conversion.status !== 'converted') throw Error('ST8-008 runtime conversion required')
    const model = extractCardCapabilities(conversion.gameCard)
    expect(model.unsupportedEffectKinds).toEqual([])
    expect(model.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'skill', timing: 'faint', effectKind: 'choose-one',
        conditionKinds: ['support-count-less-than-opponent'] }),
      expect.objectContaining({ source: 'skill', timing: 'faint', effectKind: 'deck-to-support',
        sourceZone: 'deck', destinationZone: 'support' }),
      expect.objectContaining({ source: 'attack', timing: 'attack', kind: 'draw', effectKind: 'draw',
        conditionKinds: ['support-area-has-named-cookie'] }),
    ]))
  })

  it('retains ST8-009 free optional draw as one FLIP capability without an Activate or HP rescue', () => {
    const entry = getAllCardPoolEntries().find(card => card.cardNumber === 'ST8-009')
    if (!entry) throw Error('Promoted ST8-009 required')
    const conversion = convertOfficialCardToGameCard(entry)
    if (conversion.status !== 'converted') throw Error('ST8-009 runtime conversion required')
    const model = extractCardCapabilities(conversion.gameCard)
    expect(model.unsupportedEffectKinds).toEqual([])
    expect(model.capabilities.filter(capability => capability.kind === 'draw')).toEqual([
      expect.objectContaining({ source: 'flip', timing: 'flip', effectKind: 'draw-up-to',
        cost: { energy: {}, discardHand: 0 }, conditionKinds: [] }),
    ])
    expect(model.capabilities.some(capability => capability.timing === 'activate' ||
      capability.effectKind === 'gain-hp')).toBe(false)
  })

  it('retains ST8-005 conditional Activate draw and independent attack support damage without duplicate display effects', () => {
    const entry = getAllCardPoolEntries().find(entry => entry.cardNumber === 'ST8-005')
    if (!entry) throw Error('Promoted ST8-005 required')
    const conversion = convertOfficialCardToGameCard(entry)
    if (conversion.status !== 'converted') throw Error('ST8-005 runtime conversion required')
    const model = extractCardCapabilities(conversion.gameCard)
    expect(model.unsupportedEffectKinds).toEqual([])
    expect(model.capabilities.filter(capability => capability.kind === 'draw' && capability.source === 'skill'))
      .toEqual([expect.objectContaining({ timing: 'activate', effectKind: 'draw' })])
    expect(model.capabilities.filter(capability => capability.kind === 'damage' && capability.source === 'attack'))
      .toEqual([expect.objectContaining({ timing: 'attack', effectKind: 'rest-support-and-damage' })])
  })
})
