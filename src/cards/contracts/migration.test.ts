import { describe, expect, it } from 'vitest'
import { compileCardBehaviorContract } from './compiler'
import {
  checkContractMigrationBatch,
  isContractMigrationBatchReady,
  selectRecordsForMigrationBatch,
  selectVerifiedMigrationBatch,
} from './migration'
import type { CompiledCardBehavior } from './compiler'
import type { CardBehaviorAudit } from './types'
import type { OfficialCardRecord } from '../types'

const audit = (cardId: string, status: CardBehaviorAudit['contract']['status']): CardBehaviorAudit => ({
  contract: {
    schemaVersion: 1,
    cardId,
    baseCardId: cardId,
    sourceHash: cardId,
    source: { cardNumber: cardId, type: 'cookie', segments: {} },
    timing: { markers: [] },
    clauses: [],
    payments: [],
    costs: [],
    targets: [],
    steps: [],
    status,
    blockers: status === 'verified' ? [] : ['fixture blocker'],
  },
  runtime: {
    effectKinds: [],
    targetSelectors: [],
    energyCosts: [],
    abilityCostKeys: [],
  },
  checks: {
    sourceHashStable: true,
    paymentCovered: true,
    costCovered: true,
    targetCovered: true,
    resolutionOrderCovered: true,
    timingCovered: true,
  },
  errors: status === 'verified' ? [] : ['fixture blocker'],
})

const compiled = (
  cardId: string,
  status: CardBehaviorAudit['contract']['status'],
): CompiledCardBehavior => {
  const cardAudit = audit(cardId, status)
  return {
    cardId,
    baseCardId: cardId,
    status,
    blockers: cardAudit.errors,
    audit: cardAudit,
    steps: [],
    decisionSteps: [],
    executable: status === 'verified',
    gameCard: null,
  }
}

describe('contract migration batches', () => {
  it('uses every deterministic card id as the offset cursor', () => {
    const batch = selectVerifiedMigrationBatch([
      audit('B-002', 'verified'),
      audit('A-001', 'verified'),
      audit('C-003', 'needs-review'),
      audit('A-001', 'verified'),
    ], { offset: 0, limit: 2 })
    expect(batch.cardIds).toEqual(['A-001', 'B-002'])
    expect(selectVerifiedMigrationBatch([
      audit('B-002', 'verified'),
      audit('A-001', 'verified'),
    ], { offset: 1, limit: 1 }).cardIds).toEqual(['B-002'])
    expect(batch.sourceCount).toBe(3)
  })

  it('does not let a verified card advance past the current needs-review card', () => {
    const batch = selectVerifiedMigrationBatch([
      audit('A-002', 'verified'),
      audit('A-001', 'needs-review'),
    ], { offset: 0, limit: 1 })
    const checks = checkContractMigrationBatch(batch, [
      compiled('A-001', 'needs-review'),
      compiled('A-002', 'verified'),
    ])

    expect(batch.cardIds).toEqual(['A-001'])
    expect(checks).toEqual([
      {
        cardId: 'A-001',
        executable: false,
        blockers: ['contract status is needs-review', 'fixture blocker'],
      },
    ])
    expect(isContractMigrationBatchReady(checks)).toBe(false)
  })

  it('keeps a batch blocked when a compiled card is not executable', () => {
    const batch = selectVerifiedMigrationBatch([audit('A-001', 'verified')])
    const checks = checkContractMigrationBatch(batch, [])
    expect(checks[0]).toMatchObject({ cardId: 'A-001', executable: false })
    expect(isContractMigrationBatchReady(checks)).toBe(false)
  })

  it('binds variant records by cardNumber instead of baseCardNumber', () => {
    const batch = selectVerifiedMigrationBatch([audit('BS1-044@1', 'verified')])
    const records = [
      { cardNumber: 'BS1-044', baseCardNumber: 'BS1-044' },
      { cardNumber: 'BS1-044@1', baseCardNumber: 'BS1-044' },
    ]
    expect(selectRecordsForMigrationBatch(records, batch)).toEqual([
      records[1],
    ])
  })

  it('does not mark an empty batch ready', () => {
    expect(isContractMigrationBatchReady([])).toBe(false)
  })

  it('marks a verified executable batch ready', () => {
    const batch = selectVerifiedMigrationBatch([audit('A-001', 'verified')])
    const checks = checkContractMigrationBatch(batch, [compiled('A-001', 'verified')])

    expect(checks).toEqual([{ cardId: 'A-001', executable: true, blockers: [] }])
    expect(isContractMigrationBatchReady(checks)).toBe(true)
  })

  it('does not change the contract compiler runtime authority', () => {
    const record = {
      sourceId: 1,
      locale: 'en',
      cardNumber: 'MIGRATION-001',
      baseCardNumber: 'MIGRATION-001',
      variant: null,
      name: 'Migration Fixture',
      type: 'cookie',
      officialType: 'COOKIE',
      rarity: 'C',
      grade: 'COMMON',
      level: 1,
      hp: 2,
      energyType: 'RED',
      color: 'RED',
      skill: { name: 'Fixture', text: '' },
      attackText: '<{R}> Attack {da} 1',
      flipText: null,
      keywords: [],
      product: { id: 1, title: 'Fixture', category: null },
      restrictions: { banned: false, limited: false },
      flags: { enabled: true, hidden: false, extra: false },
      imageUrl: 'https://example.invalid/migration.webp',
      officialUpdatedAt: null,
      sourceUrl: 'https://example.invalid/cards.json',
    } as OfficialCardRecord
    const compiled = compileCardBehaviorContract(record)
    expect(compiled.gameCard).not.toBeNull()
    expect(compiled.decisionSteps.every((step) => step.candidateIds.length === 0)).toBe(true)
  })
})
