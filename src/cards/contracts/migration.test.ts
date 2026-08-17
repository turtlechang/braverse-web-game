import { describe, expect, it } from 'vitest'
import { compileCardBehaviorContract } from './compiler'
import {
  checkContractMigrationBatch,
  isContractMigrationBatchReady,
  selectVerifiedMigrationBatch,
} from './migration'
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
describe('contract migration batches', () => {
  it('selects verified card ids deterministically without card-name strategy keys', () => {
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
  })

  it('keeps a batch blocked when a compiled card is not executable', () => {
    const batch = selectVerifiedMigrationBatch([audit('A-001', 'verified')])
    const checks = checkContractMigrationBatch(batch, [])
    expect(checks[0]).toMatchObject({ cardId: 'A-001', executable: false })
    expect(isContractMigrationBatchReady(checks)).toBe(false)
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
