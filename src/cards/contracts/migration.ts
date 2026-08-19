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
 * 批次。offset 是全部唯一 card ID 的 cursor；未 verified 的卡仍會進入目前
 * 批次，再由 migration check 明確擋下，避免先過濾後跳過 serial gate。
 *
 * 函式名稱為相容現有呼叫端而保留；verified 是通過 check 的條件，
 * 不是 cursor 的前置篩選條件。
 */
export const selectVerifiedMigrationBatch = (
  audits: readonly CardBehaviorAudit[],
  options: ContractMigrationBatchOptions = {},
): ContractMigrationBatch => {
  const offset = Math.max(0, Math.floor(options.offset ?? 0))
  const limit = Math.max(1, Math.floor(options.limit ?? 25))
  const deterministicCardIds = [...new Set(audits.map((audit) => audit.contract.cardId))].sort()
  const cardIds = deterministicCardIds.slice(offset, offset + limit)

  return {
    schemaVersion: 1,
    offset,
    limit,
    cardIds,
    sourceCount: deterministicCardIds.length,
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
    if (!card) {
      return {
        cardId,
        executable: false,
        blockers: ['missing compiled card'],
      }
    }
    const blockers = [
      ...(card.status === 'verified' ? [] : [`contract status is ${card.status}`]),
      ...card.blockers,
    ]
    if (!card.executable && blockers.length === 0) blockers.push('compiled card is not executable')
    return {
      cardId,
      executable: card.status === 'verified' && card.executable,
      blockers: [...new Set(blockers)],
    }
  })

export const isContractMigrationBatchReady = (
  checks: readonly ContractMigrationCheck[],
): boolean => checks.length > 0 && checks.every((check) => check.executable && check.blockers.length === 0)
