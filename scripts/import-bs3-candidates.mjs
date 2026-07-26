import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  backfillVariantStats,
  getDatasetUrl,
  normalizeOfficialCard,
} from './import-official-cards.mjs'

export const BS3_SERIES_PREFIX = 'BS3-'
export const DEFAULT_LOCALE = 'en'
export const DEFAULT_OUTPUT =
  'data/candidates/official-age-of-heroes-and-kingdoms-bs3.en.json'
export const DEFAULT_INVENTORY_OUTPUT = 'docs/bs3-card-inventory.md'
const OFFICIAL_SITE_URL = 'https://cookierunbraverse.com'

const toOptionalString = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const compareText = (left, right) => left.localeCompare(right, 'en')

export const selectBs3RawCards = (rawCards) => {
  if (!Array.isArray(rawCards)) {
    throw new Error('官方資料缺少 cardList 陣列。')
  }

  return rawCards.filter((card) => {
    const cardNumber = toOptionalString(card?.card_no)
    return cardNumber?.toUpperCase().startsWith(BS3_SERIES_PREFIX) ?? false
  })
}

export const createBs3CandidateDocument = ({
  rawCards,
  locale = DEFAULT_LOCALE,
  sourceUrl = getDatasetUrl(locale),
  importedAt = new Date().toISOString(),
}) => {
  const matchingRawCards = selectBs3RawCards(rawCards)
  if (matchingRawCards.length === 0) {
    throw new Error(
      `匯入失敗：官方卡表沒有 ${BS3_SERIES_PREFIX} 開頭的卡片。`,
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
    const label = value ?? '未標記'
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()].sort(([left], [right]) => compareText(left, right))
}

const tableRows = (entries) =>
  entries.map(([label, count]) => `| ${label} | ${count} |`).join('\n')

const getDistinctBaseCardNumbers = (cards) =>
  [...new Set(cards.map((card) => card.baseCardNumber))].sort(compareText)

const textOf = (card) =>
  [card.skill.name, card.skill.text, card.attackText, card.flipText]
    .filter(Boolean)
    .join(' ')

export const createBs3InventoryMarkdown = (document) => {
  const { cards, source } = document
  const baseCardNumbers = getDistinctBaseCardNumbers(cards)
  const ancient = cards.filter((card) =>
    card.keywords.some((keyword) => keyword.toLowerCase() === 'ancient'),
  )
  const soulJam = cards.filter((card) => /soul jam/i.test(card.name))
  const pure = cards.filter((card) => card.color?.toLowerCase() === 'pure')
  const equip = cards.filter((card) => /\bequip\b/i.test(textOf(card)))
  const specialVictory = cards.filter((card) => /you win the game/i.test(textOf(card)))

  return `# BS3 卡表盤點（候選資料）

> 本文件由 \`npm run cards:import:bs3-candidate\` 依官方英文卡表產生；其內容是來源資料快照與實作盤點，不代表卡牌已進入正式卡池。

## 來源與範圍

- 官方卡表：[CookieRun: Braverse Card List](${source.pageUrl})
- 官方 JSON：\`${source.datasetUrl}\`
- 擷取時間：\`${source.fetchedAt}\`
- 選取規則：完整卡號以 \`${BS3_SERIES_PREFIX}\` 開頭；保留異圖／促銷變體。
- 候選狀態：\`inventory\`。只通過來源與結構驗證，\`promote:candidate\` 會拒絕此狀態，直到各卡牌已完成 runtime 轉接與嚴格驗證。

## 數量

| 項目 | 數量 |
| --- | ---: |
| 官方資料總筆數 | ${source.totalAvailable} |
| BS3 記錄數（含變體） | ${cards.length} |
| BS3 基礎卡號數 | ${baseCardNumbers.length} |
| 異圖／促銷變體數 | ${cards.length - baseCardNumbers.length} |

## 類型分布

| 類型 | 記錄數 |
| --- | ---: |
${tableRows(countBy(cards.map((card) => card.type)))}

## 顏色分布

| 顏色 | 記錄數 |
| --- | ---: |
${tableRows(countBy(cards.map((card) => card.color)))}

## 產品標題分布

| 官方產品標題 | 記錄數 |
| --- | ---: |
${tableRows(countBy(cards.map((card) => card.product.title)))}

## BS3 基礎機制錨點

| 項目 | 記錄數 | 基礎卡號 |
| --- | ---: | --- |
| \`PURE\` 顏色 | ${pure.length} | ${getDistinctBaseCardNumbers(pure).join(', ') || '—'} |
| \`Ancient\` 關鍵字 | ${ancient.length} | ${getDistinctBaseCardNumbers(ancient).join(', ') || '—'} |
| \`Soul Jam\` 名稱 | ${soulJam.length} | ${getDistinctBaseCardNumbers(soulJam).join(', ') || '—'} |
| \`Equip\` 文字標記 | ${equip.length} | ${getDistinctBaseCardNumbers(equip).join(', ') || '—'} |
| 特殊勝利文字 | ${specialVictory.length} | ${getDistinctBaseCardNumbers(specialVictory).join(', ') || '—'} |

目前官方 BS3 英文來源沒有含獨立 \`Equip\` 文字標記的記錄；\`Equip\` 仍屬目前官方卡表可篩選的機制，但不應在 BS3 候選資料盤點中誤報為已出現或已實作。

## Runtime 基礎進度

- 已將 \`PURE\` 保存為通用卡牌分類與特殊能量；PURE 支援卡可支付 \`pure\` 或 Mix Cost（runtime 的 \`neutral\`），但不能支付紅、黃、綠、藍、紫等指定色費用。
- 已將 \`Ancient\`／\`Soul Jam\` 保存為可判定的 runtime 關鍵字。
- 已實作 \`BS3-121\` 的 Activate 特殊勝利：戰鬥區與支援區各合計 5 種不同名稱的 Ancient Cookie 與 Soul Jam 卡，只有主動發動能力後才結束對局。
- 已支援攻擊後「can be used as」的來源能量付款；來源餅乾先提供印刷的指定能量，只有剩餘費用才由支援區支付。
- 效果轉接覆蓋與尚未支援的來源文字，另見 [BS3 效果轉接覆蓋盤點](bs3-effect-coverage.md)。

## 後續轉接門檻

1. 依效果覆蓋盤點逐卡完成效果與其他專屬機制轉接，並補齊回歸測試。
2. 將候選檔改為 \`promotion-ready\` 前，確認每筆資料均可轉換為 runtime 卡片，且沒有未裁決的規則文字。
3. 執行嚴格 \`validate:candidate\` 與 \`promote:candidate\`，再重新生成正式 card pool。
`
}

export const runBs3CandidateImport = async ({
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
      'user-agent': 'braverse-web-game-bs3-candidate-importer/0.1',
    },
  })
  if (!response.ok) {
    throw new Error(`官方卡表請求失敗：HTTP ${response.status}`)
  }

  const payload = await response.json()
  const document = createBs3CandidateDocument({
    rawCards: payload.cardList,
    locale,
    sourceUrl,
    importedAt,
  })
  const inventory = createBs3InventoryMarkdown(document)
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
    const { document, outputPath, inventoryPath } = await runBs3CandidateImport(
      parseArguments(process.argv.slice(2)),
    )
    console.log(
      `已匯入 ${document.source.importedCount} 張 BS3 候選卡到 ${outputPath}`,
    )
    console.log(`盤點報告：${inventoryPath}`)
    console.log('候選狀態為 inventory；必須完成 runtime 轉接後才能 promote。')
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
