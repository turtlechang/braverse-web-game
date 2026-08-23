import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { convertOfficialCardToGameCard } from '../src/cards/official-card-adapter'
import {
  getAllCardPoolEntries,
  type CardPoolEntry,
} from '../src/game/card-pool'
import { createStrategyShadowReport } from '../src/game/ai/strategy/deck-profile'
import { buildSynergyGraph } from '../src/game/ai/strategy/synergy-graph'
import { buildComboPlans } from '../src/game/ai/strategy/combo-plan'

export type AiCapabilityAuditStatus = 'ready' | 'conservative' | 'blocked'

export interface AiCapabilityAuditReport {
  schemaVersion: 1
  generatedAt: string
  source: string
  series: string | null
  /** 正式 inventory 全部印刷記錄，包含同機制異圖／變體。 */
  inventoryEntryCount: number
  /** 去除同 poolId 異圖後，實際需要學習的唯一 runtime 機制數。 */
  cardCount: number
  capabilityCount: number
  /** 全卡池能力圖可形成的候選 Combo 邊；實戰仍需公開條件確認。 */
  comboCandidateCount: number
  unsupportedEffectKinds: Record<string, number>
  unsupportedCardIds: string[]
  conversionFailures: { cardNumber: string; reason: string }[]
  status: AiCapabilityAuditStatus
}

const basePlayableEntries = (
  entries: readonly CardPoolEntry[],
  series?: string,
): CardPoolEntry[] => {
  const normalizedSeries = series?.trim().toUpperCase()
  const byPoolId = new Map<string, CardPoolEntry>()
  for (const entry of entries) {
    if (!entry.flags.enabled || entry.flags.hidden) continue
    if (entry.type === 'extra' || entry.type === 'unknown') continue
    if (normalizedSeries && !entry.poolId.toUpperCase().startsWith(`${normalizedSeries}-`)) {
      continue
    }
    const existing = byPoolId.get(entry.poolId)
    if (!existing || entry.cardNumber === entry.poolId) {
      byPoolId.set(entry.poolId, entry)
    }
  }
  return [...byPoolId.values()].sort((left, right) =>
    left.poolId.localeCompare(right.poolId),
  )
}

const playableInventoryEntries = (
  entries: readonly CardPoolEntry[],
  series?: string,
): CardPoolEntry[] => {
  const normalizedSeries = series?.trim().toUpperCase()
  return entries.filter((entry) =>
    entry.flags.enabled &&
    !entry.flags.hidden &&
    entry.type !== 'extra' &&
    entry.type !== 'unknown' &&
    (!normalizedSeries || entry.poolId.toUpperCase().startsWith(`${normalizedSeries}-`)),
  )
}

export const createAiCapabilityAudit = (
  entries: readonly CardPoolEntry[],
  options: { series?: string; generatedAt?: string } = {},
): AiCapabilityAuditReport => {
  const selected = basePlayableEntries(entries, options.series)
  const inventoryEntryCount = playableInventoryEntries(entries, options.series).length
  const conversionFailures: AiCapabilityAuditReport['conversionFailures'] = []
  const cards = selected.flatMap((entry) => {
    const conversion = convertOfficialCardToGameCard(entry)
    if (conversion.status === 'unsupported') {
      conversionFailures.push({
        cardNumber: entry.cardNumber,
        reason: conversion.reason,
      })
      return []
    }
    return [conversion.gameCard]
  })
  const shadow = createStrategyShadowReport(cards)
  const comboCandidateCount = buildComboPlans(buildSynergyGraph(shadow.cards)).length
  const unsupportedCardIds = [...shadow.telemetry.unsupportedCardIds].sort()
  const status: AiCapabilityAuditStatus = conversionFailures.length > 0
    ? 'blocked'
    : unsupportedCardIds.length > 0
      ? 'conservative'
      : 'ready'

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    source: options.series
      ? `formal-runtime-card-pool:${options.series.toUpperCase()}`
      : 'formal-runtime-card-pool',
    series: options.series?.toUpperCase() ?? null,
    inventoryEntryCount,
    cardCount: cards.length,
    capabilityCount: shadow.cards.reduce(
      (total, card) => total + card.capabilities.length,
      0,
    ),
    comboCandidateCount,
    unsupportedEffectKinds: shadow.telemetry.unsupportedEffectKinds,
    unsupportedCardIds,
    conversionFailures,
    status,
  }
}

const argumentValue = (name: string): string | undefined => {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  const strict = process.argv.includes('--strict')
  const output = argumentValue('output')
  const report = createAiCapabilityAudit(getAllCardPoolEntries(), {
    series: argumentValue('series'),
  })
  const serialized = `${JSON.stringify(report, null, 2)}\n`
  if (output) {
    await writeFile(resolve(output), serialized, 'utf8')
  }
  process.stdout.write(serialized)
  if (strict && report.status !== 'ready') process.exitCode = 1
}
