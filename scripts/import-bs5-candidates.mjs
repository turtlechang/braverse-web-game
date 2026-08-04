import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  backfillVariantStats,
  getDatasetUrl,
  normalizeOfficialCard,
} from './import-official-cards.mjs'

export const BS5_SERIES_PREFIX = 'BS5-'
export const DEFAULT_LOCALE = 'en'
export const DEFAULT_OUTPUT =
  'data/candidates/official-age-of-heroes-and-kingdoms-bs5.en.json'
export const DEFAULT_INVENTORY_OUTPUT = 'docs/bs5-card-inventory.md'
const OFFICIAL_SITE_URL = 'https://cookierunbraverse.com'

const toOptionalString = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const compareText = (left, right) => String(left).localeCompare(String(right), 'en')

export const selectBs5RawCards = (rawCards) => {
  if (!Array.isArray(rawCards)) {
    throw new Error('官方資料缺少 cardList 陣列。')
  }

  return rawCards.filter((card) => {
    const cardNumber = toOptionalString(card?.card_no)
    return cardNumber?.toUpperCase().startsWith(BS5_SERIES_PREFIX) ?? false
  })
}

export const createBs5CandidateDocument = ({
  rawCards,
  locale = DEFAULT_LOCALE,
  sourceUrl = getDatasetUrl(locale),
  importedAt = new Date().toISOString(),
}) => {
  const matchingRawCards = selectBs5RawCards(rawCards)
  if (matchingRawCards.length === 0) {
    throw new Error(
      `官方卡表沒有 ${BS5_SERIES_PREFIX} 開頭的卡片，未建立空的候選資料。`,
    )
  }

  const cards = backfillVariantStats(
    matchingRawCards.map((card) => normalizeOfficialCard(card, sourceUrl)),
  )

  return {
    schemaVersion: 1,
    source: {
      provider: 'CookieRun: Braverse official website',
      pageUrl: `${OFFICIAL_SITE_URL}/${locale}/cardList`,
      datasetUrl: sourceUrl,
      locale,
      fetchedAt: importedAt,
      totalAvailable: rawCards.length,
      matchedAvailable: matchingRawCards.length,
      importedCount: cards.length,
      filter: {
        categoryTitle: null,
      },
      candidateStatus: 'inventory',
      imagesDownloaded: false,
    },
    cards,
  }
}

const countBy = (values) => {
  const counts = new Map()
  for (const value of values) {
    const label = value ?? '未標示'
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()].sort(([left], [right]) => compareText(left, right))
}

const tableRows = (entries) =>
  entries.map(([label, count]) => `| ${label} | ${count} |`).join('\n')

const getDistinctBaseCardNumbers = (cards) =>
  [...new Set(cards.map((card) => card.baseCardNumber))].sort(compareText)

const textOf = (card) =>
  [card.skill?.name, card.skill?.text, card.attackText, card.flipText]
    .filter(Boolean)
    .join(' ')

const listOrNone = (cards) => getDistinctBaseCardNumbers(cards).join(', ') || '無'

export const createBs5InventoryMarkdown = (document) => {
  const { cards, source } = document
  const baseCardNumbers = getDistinctBaseCardNumbers(cards)
  const ancient = cards.filter((card) =>
    card.keywords.some((keyword) => keyword.toLowerCase() === 'ancient'),
  )
  const soulJam = cards.filter((card) => /soul jam/i.test(card.name))
  const pure = cards.filter((card) => card.color?.toLowerCase() === 'pure')
  const equip = cards.filter((card) => /\bequip\b/i.test(textOf(card)))
  const specialVictory = cards.filter((card) => /you win the game/i.test(textOf(card)))

  return `# BS5 卡牌資料盤點（資料準備期）

> 本文件由 \`npm run cards:import:bs5-candidate\` 產生。BS5 目前只隔離在候選資料區，尚未接入 runtime、尚未完成效果稽核，也不應執行 promote。

## 來源與候選狀態

- 官方卡表：[CookieRun: Braverse Card List](${source.pageUrl})
- 官方 JSON：\`${source.datasetUrl}\`
- 抓取時間：\`${source.fetchedAt}\`
- 篩選規則：完整卡號以 \`${BS5_SERIES_PREFIX}\` 開頭，保留異圖／促銷變體。
- 候選狀態：\`${source.candidateStatus}\`
- 圖片下載：${source.imagesDownloaded ? '是' : '否'}

## 數量摘要

| 項目 | 數量 |
| --- | ---: |
| 官方資料總數 | ${source.totalAvailable} |
| BS5 匹配記錄 | ${source.matchedAvailable} |
| 匯入候選記錄 | ${cards.length} |
| BS5 基礎卡號 | ${baseCardNumbers.length} |
| 變體記錄 | ${cards.length - baseCardNumbers.length} |

## 卡片類型

| 類型 | 數量 |
| --- | ---: |
${tableRows(countBy(cards.map((card) => card.type)))}

## 顏色

| 顏色 | 數量 |
| --- | ---: |
${tableRows(countBy(cards.map((card) => card.color)))}

## 產品批次

| 官方產品 | 數量 |
| --- | ---: |
${tableRows(countBy(cards.map((card) => card.product?.title)))}

## 後續稽核錨點

| 錨點 | 記錄數 | 基礎卡號 |
| --- | ---: | --- |
| \`PURE\` 顏色 | ${pure.length} | ${listOrNone(pure)} |
| \`Ancient\` 關鍵字 | ${ancient.length} | ${listOrNone(ancient)} |
| \`Soul Jam\` 名稱 | ${soulJam.length} | ${listOrNone(soulJam)} |
| \`Equip\` 文字 | ${equip.length} | ${listOrNone(equip)} |
| 特殊勝利文字 | ${specialVictory.length} | ${listOrNone(specialVictory)} |

## BS5 門檻

1. 先執行 \`npm run validate:candidate\`，確認 schema、卡號唯一性與官方欄位結構。
2. 依紅、黃、綠、藍、紫逐色盤點卡面文字，建立效果覆蓋與條件路徑清單。
3. 完成 runtime adapter、規則引擎、UI 互動、單元測試與 Chrome 實戰驗證後，才可把候選狀態改為 \`promotion-ready\`。
4. 在上述工作完成前，不執行 \`npm run promote:candidate\`，也不修改 \`data/cards/\` 或 generated card pool。
`
}

export const runBs5CandidateImport = async ({
  locale = DEFAULT_LOCALE,
  output = DEFAULT_OUTPUT,
  inventoryOutput = DEFAULT_INVENTORY_OUTPUT,
  fetchImpl = fetch,
  importedAt,
} = {}) => {
  const sourceUrl = getDatasetUrl(locale)
  const response = await fetchImpl(sourceUrl, {
    headers: {
      accept: 'application/json',
      'user-agent': 'braverse-web-game-bs5-candidate-importer/0.1',
    },
  })
  if (!response.ok) {
    throw new Error(`官方卡表請求失敗：HTTP ${response.status}`)
  }

  const payload = await response.json()
  const document = createBs5CandidateDocument({
    rawCards: payload.cardList,
    locale,
    sourceUrl,
    importedAt,
  })
  const inventory = createBs5InventoryMarkdown(document)
  const outputPath = resolve(output)
  const inventoryPath = resolve(inventoryOutput)

  await mkdir(dirname(outputPath), { recursive: true })
  await mkdir(dirname(inventoryPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
  await writeFile(inventoryPath, inventory, 'utf8')

  return { document, inventory, outputPath, inventoryPath }
}

const parseArguments = (argumentsList) => {
  const options = {
    locale: DEFAULT_LOCALE,
    output: DEFAULT_OUTPUT,
    inventoryOutput: DEFAULT_INVENTORY_OUTPUT,
  }

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]
    const nextValue = argumentsList[index + 1]

    if (argument === '--locale' && nextValue) {
      options.locale = nextValue
      index += 1
    } else if (argument === '--output' && nextValue) {
      options.output = nextValue
      index += 1
    } else if (argument === '--inventory-output' && nextValue) {
      options.inventoryOutput = nextValue
      index += 1
    } else {
      throw new Error(`不支援的參數：${argument}`)
    }
  }

  getDatasetUrl(options.locale)
  return options
}

const isDirectExecution =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isDirectExecution) {
  try {
    const { document, outputPath, inventoryPath } = await runBs5CandidateImport(
      parseArguments(process.argv.slice(2)),
    )
    console.log(`已匯入 ${document.source.importedCount} 張 BS5 候選卡：${outputPath}`)
    console.log(`卡牌盤點：${inventoryPath}`)
    console.log('候選狀態為 inventory；尚未接入 runtime，未執行 promote。')
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
