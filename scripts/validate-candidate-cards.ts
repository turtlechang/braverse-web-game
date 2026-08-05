/** Validate isolated card-data candidates before they can be promoted. */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { convertOfficialCardToGameCard } from '../src/cards'
import type { OfficialCardRecord } from '../src/cards/types'
import { getAllCardPoolEntries } from '../src/game/card-pool'

const projectRoot = join(fileURLToPath(new URL('..', import.meta.url)))
const candidatesDir = join(projectRoot, 'data', 'candidates')
const validCardTypes = new Set([
  'cookie',
  'item',
  'trap',
  'stage',
  'flip',
  'extra',
  'unknown',
])
const nonPlayableTypes = new Set(['extra', 'unknown'])
type CandidateStatus = 'inventory' | 'promotion-ready'

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNullableString = (value: unknown): boolean =>
  value === null || typeof value === 'string'

const isNullableNumber = (value: unknown): boolean =>
  value === null || (typeof value === 'number' && Number.isFinite(value))

const validateSource = (
  source: unknown,
  file: string,
  errors: string[],
): CandidateStatus => {
  if (!isRecord(source)) {
    errors.push(`${file}: source 必須為物件`)
    return 'promotion-ready'
  }

  for (const key of ['provider', 'pageUrl', 'datasetUrl', 'locale', 'fetchedAt']) {
    if (typeof source[key] !== 'string') {
      errors.push(`${file}: source.${key} 必須為 string`)
    }
  }
  for (const key of ['totalAvailable', 'matchedAvailable', 'importedCount']) {
    if (
      typeof source[key] !== 'number' ||
      !Number.isInteger(source[key]) ||
      (source[key] as number) < 0
    ) {
      errors.push(`${file}: source.${key} 必須為非負整數`)
    }
  }

  const filter = source.filter
  if (
    !isRecord(filter) ||
    !('categoryTitle' in filter) ||
    !isNullableString(filter.categoryTitle)
  ) {
    errors.push(`${file}: source.filter.categoryTitle 格式錯誤`)
  }
  if (typeof source.imagesDownloaded !== 'boolean') {
    errors.push(`${file}: source.imagesDownloaded 必須為 boolean`)
  }

  if (
    source.candidateStatus !== undefined &&
    source.candidateStatus !== 'inventory' &&
    source.candidateStatus !== 'promotion-ready'
  ) {
    errors.push(`${file}: source.candidateStatus 必須為 inventory 或 promotion-ready`)
  }

  return source.candidateStatus === 'inventory'
    ? 'inventory'
    : 'promotion-ready'
}

const validateCardStructure = (
  raw: unknown,
  label: string,
  errors: string[],
): raw is OfficialCardRecord => {
  if (!isRecord(raw)) {
    errors.push(`${label}: 卡片資料必須為物件`)
    return false
  }

  for (const key of ['cardNumber', 'baseCardNumber', 'name', 'locale', 'imageUrl']) {
    if (typeof raw[key] !== 'string' || raw[key] === '') {
      errors.push(`${label}: 缺少必填欄位 ${key}`)
    }
  }
  if (typeof raw.sourceId !== 'number') {
    errors.push(`${label}: sourceId 必須為 number`)
  }
  if (typeof raw.type !== 'string' || !validCardTypes.has(raw.type)) {
    errors.push(`${label}: type 必須為合法值`)
  }
  for (const key of [
    'variant',
    'rarity',
    'grade',
    'energyType',
    'color',
    'officialUpdatedAt',
    'attackText',
    'flipText',
  ]) {
    if (!isNullableString(raw[key])) {
      errors.push(`${label}: ${key} 必須為 string 或 null`)
    }
  }
  for (const key of ['level', 'hp']) {
    if (!isNullableNumber(raw[key])) {
      errors.push(`${label}: ${key} 必須為 number 或 null`)
    }
  }

  if (!isRecord(raw.skill) || !isNullableString(raw.skill.name) || !isNullableString(raw.skill.text)) {
    errors.push(`${label}: skill 必須包含 name/text`)
  }
  if (!Array.isArray(raw.keywords) || !raw.keywords.every((item) => typeof item === 'string')) {
    errors.push(`${label}: keywords 必須為 string 陣列`)
  }
  if (
    !isRecord(raw.product) ||
    !isNullableNumber(raw.product.id) ||
    !isNullableString(raw.product.title) ||
    !isNullableString(raw.product.category)
  ) {
    errors.push(`${label}: product 必須為物件`)
  }
  if (!isRecord(raw.flags)) {
    errors.push(`${label}: flags 必須為物件`)
  } else {
    for (const key of ['enabled', 'hidden', 'extra']) {
      if (typeof raw.flags[key] !== 'boolean') {
        errors.push(`${label}: flags.${key} 必須為 boolean`)
      }
    }
  }
  if (!isRecord(raw.restrictions)) {
    errors.push(`${label}: restrictions 必須為物件`)
  } else {
    for (const key of ['banned', 'limited']) {
      if (typeof raw.restrictions[key] !== 'boolean') {
        errors.push(`${label}: restrictions.${key} 必須為 boolean`)
      }
    }
  }

  return true
}

const validateCandidateDocument = (
  parsed: unknown,
  file: string,
  existingPoolNumbers: ReadonlySet<string>,
  errors: string[],
): { convertedCount: number; status: CandidateStatus } => {
  if (!isRecord(parsed)) {
    errors.push(`${file}: 頂層必須為物件`)
    return { convertedCount: 0, status: 'promotion-ready' }
  }
  if (typeof parsed.schemaVersion !== 'number') {
    errors.push(`${file}: schemaVersion 必須為 number`)
  } else if (parsed.schemaVersion !== 1) {
    errors.push(`${file}: schemaVersion 必須為 1`)
  }
  const status = validateSource(parsed.source, file, errors)

  if (!Array.isArray(parsed.cards)) {
    errors.push(`${file}: 缺少 cards 陣列`)
    return { convertedCount: 0, status }
  }

  const seen = new Map<string, number>()
  const cards: OfficialCardRecord[] = []
  parsed.cards.forEach((raw, index) => {
    const label = `${file}[${index}]`
    const errorsBeforeCard = errors.length
    if (!validateCardStructure(raw, label, errors)) return
    if (errors.length > errorsBeforeCard) return
    const card = raw as OfficialCardRecord
    cards.push(card)
    const firstIndex = seen.get(card.cardNumber)
    if (firstIndex !== undefined) {
      errors.push(
        `${file}: cardNumber ${card.cardNumber} 檔內重複（index ${firstIndex} 與 ${index}）`,
      )
    } else {
      seen.set(card.cardNumber, index)
    }
    if (existingPoolNumbers.has(card.cardNumber)) {
      errors.push(`${file}: cardNumber ${card.cardNumber} 與正式卡池重複`)
    }
  })

  let convertedCount = 0
  if (status === 'promotion-ready') {
    for (const card of cards) {
      if (nonPlayableTypes.has(card.type) || !card.flags.enabled || card.flags.hidden) {
        continue
      }
      const conversion = convertOfficialCardToGameCard(card)
      if (conversion.status === 'unsupported') {
        errors.push(`${card.cardNumber} ${card.name}: 無法轉換為 GameCard（${conversion.reason}）`)
        continue
      }
      convertedCount += 1
      const { gameCard } = conversion
      if (card.type === 'flip' && card.flipText && !gameCard.flip) {
        errors.push(`${card.cardNumber} ${card.name}: 有 FLIP 文字但未轉出 flip 效果`)
      }
      if (card.type === 'cookie' && card.skill.text && !gameCard.skill && !gameCard.effects?.length) {
        errors.push(`${card.cardNumber} ${card.name}: 有技能文字但未轉出 skill/effects`)
      }
      if (
        ['trap', 'item', 'stage'].includes(card.type) &&
        (card.skill.text || card.attackText) &&
        !gameCard.effects?.length &&
        !gameCard.skill &&
        !gameCard.flip &&
        // 場景卡的特殊勝利條件（如 BS3-121）本身就是效果，effects 刻意留空。
        !gameCard.stageAbility?.specialVictory
      ) {
        errors.push(`${card.cardNumber} ${card.name}: 有效果文字但未轉出效果`)
      }
    }
  }
  return { convertedCount, status }
}

export const validateCandidates = (
  directory = candidatesDir,
  existingPoolNumbers = new Set(getAllCardPoolEntries().map((entry) => entry.cardNumber)),
  requirePromotionReady = false,
): {
  files: string[]
  totalCards: number
  convertedCount: number
  inventoryFiles: string[]
  errors: string[]
} => {
  const files = readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))
  const errors: string[] = []
  let totalCards = 0
  let convertedCount = 0
  const inventoryFiles: string[] = []
  for (const file of files) {
    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(join(directory, file), 'utf8'))
    } catch (error) {
      errors.push(`${file}: JSON 解析失敗 — ${(error as Error).message}`)
      continue
    }
    if (isRecord(parsed) && Array.isArray(parsed.cards)) totalCards += parsed.cards.length
    const result = validateCandidateDocument(parsed, file, existingPoolNumbers, errors)
    convertedCount += result.convertedCount
    if (result.status === 'inventory') {
      inventoryFiles.push(file)
      if (requirePromotionReady) {
        errors.push(`${file}: 仍為 inventory 候選，尚未完成 runtime 轉接，不能 promote`)
      }
    }
  }
  return { files, totalCards, convertedCount, inventoryFiles, errors }
}

const dirArgIndex = process.argv.indexOf('--dir')
const targetCandidatesDir =
  dirArgIndex >= 0 && process.argv[dirArgIndex + 1]
    ? process.argv[dirArgIndex + 1]
    : candidatesDir

const result = validateCandidates(
  targetCandidatesDir,
  new Set(getAllCardPoolEntries().map((entry) => entry.cardNumber)),
  process.argv.includes('--require-promotion-ready'),
)
if (result.files.length === 0) {
  console.log(`${targetCandidatesDir} 中無 .json 檔案，無候選資料需驗證。`)
  process.exit(0)
}
if (result.errors.length > 0) {
  console.error(`\n發現 ${result.errors.length} 個錯誤：`)
  for (const error of result.errors) console.error(`✗ ${error}`)
  process.exit(1)
}
console.log(`候選資料驗證：${result.files.length} 個檔案、${result.totalCards} 張卡牌、成功轉換 ${result.convertedCount} 張`)
if (result.inventoryFiles.length > 0) {
  console.log(`ℹ ${result.inventoryFiles.length} 個檔案為 inventory 候選，僅完成來源與結構驗證，禁止 promote。`)
}
console.log('✓ 候選資料全部通過驗證')
