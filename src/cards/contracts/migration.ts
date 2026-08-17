import type { CardBehaviorAudit } from './types'
import type { CompiledCardBehavior } from './compiler'

export interface ContractMigrationBatchOptions {
  offset?: number
  limit?: number
}

export interface ContractMigrationBatch {
  schemaVersion: 1
  offset: number
  limit: number
  cardIds: string[]
  sourceCount: number
}

/**
 * 將官方來源記錄綁回 shadow batch；必須使用 cardNumber，因為異圖變體
 * 可能是 `BS1-044@1`，不能用 baseCardNumber 把它錯誤合併成另一張卡。
 */
export const selectRecordsForMigrationBatch = <T extends { cardNumber: string }>(
  records: readonly T[],
  batch: ContractMigrationBatch,
): T[] => records.filter((record) => batch.cardIds.includes(record.cardNumber))

/**
 * 以 card.id（而非卡名、彈數或牌組）建立 deterministic 的 shadow migration
 * 批次。只有 audit 已標成 verified 的卡牌才會進入批次，未驗證資料留在
 * inventory／needs-review，不會被這個 helper 靜默升格。
 */
export const selectVerifiedMigrationBatch = (
  audits: readonly CardBehaviorAudit[],
  options: ContractMigrationBatchOptions = {},
): ContractMigrationBatch => {
  const offset = Math.max(0, Math.floor(options.offset ?? 0))
  const limit = Math.max(1, Math.floor(options.limit ?? 25))
  const cardIds = audits
    .filter((audit) => audit.contract.status === 'verified')
    .map((audit) => audit.contract.cardId)
    .filter((cardId, index, values) => values.indexOf(cardId) === index)
    .sort()
    .slice(offset, offset + limit)

  return {
    schemaVersion: 1,
    offset,
    limit,
    cardIds,
    sourceCount: audits.length,
  }
}

export interface ContractMigrationCheck {
  cardId: string
  executable: boolean
  blockers: string[]
}

export const checkContractMigrationBatch = (
  batch: ContractMigrationBatch,
  compiled: readonly CompiledCardBehavior[],
): ContractMigrationCheck[] =>
  batch.cardIds.map((cardId) => {
    const card = compiled.find((candidate) => candidate.cardId === cardId)
    return {
      cardId,
      executable: Boolean(card?.executable),
      blockers: card?.blockers ?? ['missing compiled card'],
    }
  })

export const isContractMigrationBatchReady = (
  checks: readonly ContractMigrationCheck[],
): boolean => checks.every((check) => check.executable && check.blockers.length === 0)
