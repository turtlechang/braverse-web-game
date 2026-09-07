import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  backfillVariantStats,
  getDatasetUrl,
  normalizeOfficialCard,
} from './import-official-cards.mjs'

export const BS8_SERIES_PREFIX = 'BS8-'
export const DEFAULT_LOCALE = 'en'
export const DEFAULT_OUTPUT =
  'data/candidates/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json'
export const DEFAULT_INVENTORY_OUTPUT = 'docs/bs8-card-inventory.md'
const OFFICIAL_SITE_URL = 'https://cookierunbraverse.com'

const toOptionalString = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const compareText = (left, right) => String(left).localeCompare(String(right), 'en')

export const selectBs8RawCards = (rawCards) => {
  if (!Array.isArray(rawCards)) {
    throw new Error('官方資料缺少 cardList 陣列。')
  }

  return rawCards.filter((card) => {
    const cardNumber = toOptionalString(card?.card_no)
    return cardNumber?.toUpperCase().startsWith(BS8_SERIES_PREFIX) ?? false
  })
}

export const createBs8CandidateDocument = ({
  rawCards,
  locale = DEFAULT_LOCALE,
  sourceUrl = getDatasetUrl(locale),
  importedAt = new Date().toISOString(),
}) => {
  const matchingRawCards = selectBs8RawCards(rawCards)
  if (matchingRawCards.length === 0) {
    throw new Error(
      `官方卡表沒有 ${BS8_SERIES_PREFIX} 開頭的卡片，未建立空的候選資料。`,
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

export const getBs8VariantStats = (cards) => {
  const baseCardNumbers = getDistinctBaseCardNumbers(cards)
  const baseRecords = cards.filter(
    (card) => card.cardNumber === card.baseCardNumber,
  )
  const variants = cards.filter((card) => card.cardNumber !== card.baseCardNumber)
  const baseRecordNumbers = new Set(
    baseRecords.map((card) => card.baseCardNumber),
  )

  return {
    baseCardNumbers,
    baseRecords,
    variants,
    variantOnlyBaseCardNumbers: baseCardNumbers.filter(
      (baseCardNumber) => !baseRecordNumbers.has(baseCardNumber),
    ),
  }
}

const listOrNone = (cards) => getDistinctBaseCardNumbers(cards).join(', ') || '無'

const textOf = (card) =>
  [card.skill?.name, card.skill?.text, card.attackText, card.flipText]
    .filter(Boolean)
    .join(' ')

export const createBs8InventoryMarkdown = (document) => {
  const { cards, source } = document
  const {
    baseCardNumbers,
    baseRecords,
    variants,
    variantOnlyBaseCardNumbers,
  } = getBs8VariantStats(cards)
  const extraCards = cards.filter(
    (card) => card.type === 'extra' || card.flags.extra,
  )
  const arena = cards.filter(
    (card) =>
      card.keywords.some((keyword) => keyword.toLowerCase() === 'arena') ||
      /\barena\b/i.test(textOf(card)),
  )
  const ancient = cards.filter((card) =>
    card.keywords.some((keyword) => keyword.toLowerCase() === 'ancient'),
  )
  const pure = cards.filter((card) => card.color?.toLowerCase() === 'pure')

  return `# BS8 Land of Fire & Ruin, Realm of Apathy 卡牌資料盤點（候選資料）

> 本文件由 \`npm run cards:import:bs8-candidate\` 產生。BS8 只隔離於候選資料區，不會進入 runtime 或正式卡池。

## 來源與候選狀態

- 官方卡表：[CookieRun: Braverse Card List](${source.pageUrl})
- 官方 JSON：\`${source.datasetUrl}\`
- 抓取時間：\`${source.fetchedAt}\`
- 篩選規則：完整卡號以 \`${BS8_SERIES_PREFIX}\` 開頭，保留異圖／促銷變體。
- 候選狀態：\`${source.candidateStatus}\`
- 圖片下載：${source.imagesDownloaded ? '是' : '否'}

## 數量摘要

| 項目 | 數量 |
| --- | ---: |
| 官方資料總數 | ${source.totalAvailable} |
| BS8 匹配記錄 | ${source.matchedAvailable} |
| 匯入候選記錄 | ${cards.length} |
| 不同基礎卡號 | ${baseCardNumbers.length} |
| 基礎記錄（無 \`@\` 變體尾碼） | ${baseRecords.length} |
| 變體記錄（含 \`@\` 變體尾碼） | ${variants.length} |
| 僅有變體的基礎卡號 | ${variantOnlyBaseCardNumbers.length}（${variantOnlyBaseCardNumbers.join(', ') || '無'}） |
| EXTRA 記錄 | ${extraCards.length} |

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

## BS8 稽核錨點

| 錨點 | 記錄數 | 基礎卡號 |
| --- | ---: | --- |
| \`EXTRA\` 類型／旗標 | ${extraCards.length} | ${listOrNone(extraCards)} |
| \`Arena\` 關鍵字或文字 | ${arena.length} | ${listOrNone(arena)} |
| \`PURE\` 顏色 | ${pure.length} | ${listOrNone(pure)} |
| \`Ancient\` 關鍵字 | ${ancient.length} | ${listOrNone(ancient)} |

## BS8 候選資料門檻

1. 執行 \`npm run validate:candidate\`，確認 schema、卡號唯一性與官方欄位結構。
2. 執行 \`npm run cards:analyze:bs8-candidate\`，列出既有 runtime 對各類型的轉接缺口，並獨立標示 EXTRA 卡。
3. EXTRA Deck、覆蓋與進入戰鬥區的規則仍屬核心模型擴充；在官方規則與逐卡 Browser A/B 驗證完成前，EXTRA 卡必須維持候選／不可 promote。
4. 不執行 \`npm run promote:candidate\`，也不修改 60 張 Main Deck 計數或正式卡池 registry。
`
}

export const runBs8CandidateImport = async ({
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
      'user-agent': 'braverse-web-game-bs8-candidate-importer/0.1',
    },
  })
  if (!response.ok) {
    throw new Error(`官方卡表請求失敗：HTTP ${response.status}`)
  }

  const payload = await response.json()
  const document = createBs8CandidateDocument({
    rawCards: payload.cardList,
    locale,
    sourceUrl,
    importedAt,
  })
  const inventory = createBs8InventoryMarkdown(document)
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
    const { document, outputPath, inventoryPath } = await runBs8CandidateImport(
      parseArguments(process.argv.slice(2)),
    )
    console.log(`已匯入 ${document.source.importedCount} 張 BS8 候選卡：${outputPath}`)
    console.log(`卡牌盤點：${inventoryPath}`)
    console.log('候選狀態為 inventory；EXTRA 卡尚未接入 runtime，未執行 promote。')
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
