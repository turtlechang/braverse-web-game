import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  backfillVariantStats,
  getDatasetUrl,
  normalizeOfficialCard,
} from './import-official-cards.mjs'

export const BS12_SERIES_PREFIX = 'BS12-'
export const DEFAULT_OUTPUT =
  'data/candidates/official-festival-arena-bs12.en.json'

export const selectBs12RawCards = (rawCards) => {
  if (!Array.isArray(rawCards)) {
    throw new Error('官方資料缺少 cardList 陣列。')
  }

  return rawCards.filter((card) =>
    String(card?.card_no ?? '').toUpperCase().startsWith(BS12_SERIES_PREFIX),
  )
}

export const createBs12CandidateDocument = ({
  rawCards,
  locale = 'en',
  sourceUrl = getDatasetUrl(locale),
  importedAt = new Date().toISOString(),
}) => {
  const matchingRawCards = selectBs12RawCards(rawCards)
  if (matchingRawCards.length === 0) {
    throw new Error(
      `官方卡表沒有 ${BS12_SERIES_PREFIX} 開頭的卡片，未建立空的候選資料。`,
    )
  }

  const cards = backfillVariantStats(
    matchingRawCards.map((card) => normalizeOfficialCard(card, sourceUrl)),
  )
  const cardNumbers = cards.map((card) => card.cardNumber)
  if (new Set(cardNumbers).size !== cardNumbers.length) {
    throw new Error('BS12 官方卡號重複，停止匯入。')
  }

  return {
    schemaVersion: 1,
    source: {
      provider: 'CookieRun: Braverse official website',
      pageUrl: `https://cookierunbraverse.com/${locale}/cardList`,
      datasetUrl: sourceUrl,
      locale,
      fetchedAt: importedAt,
      totalAvailable: rawCards.length,
      matchedAvailable: matchingRawCards.length,
      importedCount: cards.length,
      filter: { categoryTitle: null },
      candidateStatus: 'inventory',
      imagesDownloaded: false,
    },
    cards,
  }
}

export const runBs12CandidateImport = async ({
  locale = 'en',
  output = DEFAULT_OUTPUT,
  fetchImpl = fetch,
  importedAt,
} = {}) => {
  const sourceUrl = getDatasetUrl(locale)
  const response = await fetchImpl(sourceUrl, {
    headers: {
      accept: 'application/json',
      'user-agent': 'braverse-web-game-bs12-candidate-importer/0.1',
    },
  })
  if (!response.ok) {
    throw new Error(`官方卡表請求失敗：HTTP ${response.status}`)
  }

  const payload = await response.json()
  const document = createBs12CandidateDocument({
    rawCards: payload.cardList,
    locale,
    sourceUrl,
    importedAt,
  })
  const outputPath = resolve(output)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
  return { document, outputPath }
}

const isDirectExecution =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isDirectExecution) {
  try {
    const { document, outputPath } = await runBs12CandidateImport()
    console.log(
      `BS12 inventory：${document.cards.length} 筆；已寫入 ${outputPath}；未 promote。`,
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
