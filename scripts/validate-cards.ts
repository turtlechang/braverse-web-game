/**
 * 卡牌資料驗證工具（npm run validate:cards）
 *
 * 檢查項目：
 * 1. data/cards/*.json 可解析、含 cards 陣列、必填欄位齊全
 * 2. 同一檔案內不得有重複 cardNumber（跨檔重複屬正常，卡池會去重）
 * 3. 卡池每張可玩卡牌（排除 extra/unknown）必須能轉換為 GameCard
 * 4. 有技能／FLIP／效果文字的卡牌，轉換結果必須帶非空的對應 ability
 * 5. imageUrl 不得為空
 * 6. 高風險文字與卡牌必須符合已人工覆核的 runtime 語意契約
 *
 * 發現錯誤時以非零碼結束，供 CI 使用。
 *
 * 必要執行前提：本工具透過 tsx 執行（npm run validate:cards），
 * 因為它直接匯入 TypeScript 原始碼（src/cards、src/game）。
 * 請勿用 node 直接執行，否則會因無法解析 .ts 匯入而失敗。
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { convertOfficialCardToGameCard } from '../src/cards'
import type { OfficialCardRecord } from '../src/cards/types'
import { getAllCardPoolEntries } from '../src/game/card-pool'
import { validateCardEffectSemantics } from './lib/card-effect-validation'

const cardsDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'data', 'cards')

const REQUIRED_FIELDS = [
  'cardNumber',
  'baseCardNumber',
  'name',
  'type',
  'locale',
  'imageUrl',
] as const satisfies readonly (keyof OfficialCardRecord)[]

const NON_PLAYABLE_TYPES = new Set(['extra', 'unknown'])

const errors: string[] = []
const warnings: string[] = []

// --- 1 + 2 + 5: 逐檔檢查 ---
const files = readdirSync(cardsDir).filter((file) => file.endsWith('.json'))

for (const file of files) {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(join(cardsDir, file), 'utf8'))
  } catch (error) {
    errors.push(`${file}: JSON 解析失敗 — ${(error as Error).message}`)
    continue
  }

  const cards = (parsed as { cards?: unknown }).cards
  if (!Array.isArray(cards)) {
    errors.push(`${file}: 缺少 cards 陣列`)
    continue
  }

  const seen = new Map<string, number>()
  cards.forEach((raw, index) => {
    const card = raw as Partial<OfficialCardRecord>
    const label = `${file}[${index}] ${card.cardNumber ?? '(無卡號)'}`

    for (const field of REQUIRED_FIELDS) {
      const value = card[field]
      if (value === undefined || value === null || value === '') {
        errors.push(`${label}: 缺少必填欄位 ${field}`)
      }
    }

    if (card.cardNumber) {
      const firstIndex = seen.get(card.cardNumber)
      if (firstIndex !== undefined) {
        errors.push(
          `${file}: cardNumber ${card.cardNumber} 重複（index ${firstIndex} 與 ${index}）`,
        )
      } else {
        seen.set(card.cardNumber, index)
      }
    }
  })
}

// --- 3 + 4: 卡池轉換檢查 ---
const poolEntries = getAllCardPoolEntries()
let convertedCount = 0

for (const entry of poolEntries) {
  if (NON_PLAYABLE_TYPES.has(entry.type)) continue
  if (!entry.flags.enabled || entry.flags.hidden) continue

  const conversion = convertOfficialCardToGameCard(entry)
  if (conversion.status === 'unsupported') {
    errors.push(
      `${entry.cardNumber} ${entry.name}: 無法轉換為 GameCard（${conversion.reason}）`,
    )
    continue
  }
  convertedCount += 1

  const { gameCard } = conversion
  const hasAnyEffectPayload = Boolean(
    gameCard.effects?.length ||
      gameCard.skill ||
      gameCard.flip ||
      gameCard.attackEffects?.length ||
      // 場景卡的特殊勝利條件（如 BS3-121）本身就是效果，effects 刻意留空。
      gameCard.stageAbility?.specialVictory,
  )

  if (entry.type === 'flip' && entry.flipText && !gameCard.flip) {
    errors.push(`${entry.cardNumber} ${entry.name}: 有 FLIP 文字但未轉出 flip 效果`)
  }

  if (entry.type === 'cookie' && entry.skill.text && !gameCard.skill && !gameCard.effects?.length) {
    errors.push(`${entry.cardNumber} ${entry.name}: 有技能文字但未轉出 skill/effects`)
  }

  if (
    (entry.type === 'trap' || entry.type === 'item' || entry.type === 'stage') &&
    (entry.skill.text || entry.attackText) &&
    !hasAnyEffectPayload
  ) {
    errors.push(`${entry.cardNumber} ${entry.name}: 有效果文字但未轉出任何效果`)
  }

  errors.push(...validateCardEffectSemantics(entry, gameCard))
}

// --- 輸出 ---
console.log(
  `卡牌資料驗證：${files.length} 個檔案、卡池 ${poolEntries.length} 種卡號、成功轉換 ${convertedCount} 張`,
)
for (const warning of warnings) console.warn(`⚠ ${warning}`)

if (errors.length > 0) {
  console.error(`\n發現 ${errors.length} 個錯誤：`)
  for (const message of errors) console.error(`✗ ${message}`)
  process.exit(1)
}

console.log('✓ 全部通過')
