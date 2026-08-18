/* 盤點所有 FLIP 卡：官方卡池 → runtime 轉接後的 FlipAbility。 */
import { getAllCardPoolEntries, hasFlipAbility } from '../src/game/card-pool'
import { convertOfficialCardToGameCard } from '../src/cards/official-card-adapter'
import { writeFileSync } from 'node:fs'

interface ConversionLike {
  status: string
  gameCard?: {
    flip?: {
      text?: string
      cost?: { energy: Record<string, number>; discardHand: number }
      effects?: { kind: string }[]
      attachedHpBonus?: number
    }
    effectText?: string
    officialType?: string
  }
}

interface FlipInventoryEntry {
  base: string
  name: string
  color: string | null
  type: string
  officialType: string | null
  level: number | null
  hp: number | null
  flipText: string
  skillText: string | null
  attackText: string
  status: string | null
  runtimeFlipText: string | null
  runtimeFlipCost: { energy: Record<string, number>; discardHand: number } | null
  runtimeFlipEffectKinds: string[]
  runtimeFlipEffectCount: number
  runtimeAttachedHpBonus: number | null
  runtimeEffectText: string | null
  runtimeOfficialType: string | null
  dataset: string
  convertError: string | null
}

const allPool = getAllCardPoolEntries()
const flipEntries: FlipInventoryEntry[] = []
const seen = new Set<string>()
for (const entry of allPool) {
  if (!hasFlipAbility(entry)) continue
  const base = entry.baseCardNumber || entry.cardNumber
  if (seen.has(base)) continue
  seen.add(base)
  let res: ConversionLike | null = null
  let err: string | null = null
  try {
    res = convertOfficialCardToGameCard(entry) as unknown as ConversionLike
  } catch (e) {
    err = (e as Error).message
  }
  const gc = res?.gameCard ?? null
  const flip = gc?.flip ?? null
  flipEntries.push({
    base,
    name: entry.name,
    color: entry.color,
    type: entry.type,
    officialType: entry.officialType,
    level: entry.level,
    hp: entry.hp,
    flipText: entry.flipText ?? '',
    skillText: entry.skill?.text ?? null,
    attackText: entry.attackText ?? '',
    status: res?.status ?? null,
    runtimeFlipText: flip?.text ?? null,
    runtimeFlipCost: flip?.cost ?? null,
    runtimeFlipEffectKinds: (flip?.effects ?? []).map((effect) => effect.kind),
    runtimeFlipEffectCount: (flip?.effects ?? []).length,
    runtimeAttachedHpBonus: flip?.attachedHpBonus ?? null,
    runtimeEffectText: gc?.effectText ?? null,
    runtimeOfficialType: gc?.officialType ?? null,
    dataset: (entry.sourceUrl ?? '').split('/').pop()?.replace('cardList_', '') ?? '',
    convertError: err,
  })
}

const out = { total: flipEntries.length, cards: flipEntries }
writeFileSync('data/flip-card-inventory.json', JSON.stringify(out, null, 2))
console.log('FLIP cards:', flipEntries.length)
for (const e of flipEntries) {
  console.log([e.base, e.name, e.color ?? '', e.type, e.status ?? '', e.runtimeFlipEffectCount + ':' + e.runtimeFlipEffectKinds.join(',') + (e.runtimeAttachedHpBonus ? ' b+' + e.runtimeAttachedHpBonus : ''), e.convertError ?? ''].join('\t'))
}