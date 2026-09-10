import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { backfillVariantStats, getDatasetUrl, normalizeOfficialCard } from './import-official-cards.mjs'

export const DEFAULT_OUTPUT = 'data/candidates/official-a-game-of-truth-and-deceit-bs9.en.json'
export const createBs9CandidateDocument = ({ rawCards, importedAt = new Date().toISOString() }) => {
  if (!Array.isArray(rawCards)) throw new Error('官方資料缺少 cardList 陣列。')
  const selected = rawCards.filter((card) => /^BS9-/i.test(card?.card_no ?? ''))
  if (!selected.length) throw new Error('官方卡表沒有 BS9- 卡片，未建立空候選。')
  const datasetUrl = getDatasetUrl('en')
  const cards = backfillVariantStats(selected.map((card) => normalizeOfficialCard(card, datasetUrl)))
  if (new Set(cards.map((card) => card.cardNumber)).size !== cards.length) {
    throw new Error('BS9 官方卡號重複，停止匯入。')
  }
  return {
    schemaVersion: 1,
    source: {
      provider: 'CookieRun: Braverse official website',
      pageUrl: 'https://cookierunbraverse.com/en/cardList',
      datasetUrl, locale: 'en', fetchedAt: importedAt,
      totalAvailable: rawCards.length, matchedAvailable: cards.length, importedCount: cards.length,
      filter: { categoryTitle: null }, candidateStatus: 'inventory', imagesDownloaded: false,
    },
    cards,
  }
}

export const runBs9CandidateImport = async ({ fetchImpl = fetch, output = DEFAULT_OUTPUT } = {}) => {
  const response = await fetchImpl(getDatasetUrl('en'))
  if (!response.ok) throw new Error(`官方卡表請求失敗：HTTP ${response.status}`)
  const payload = await response.json()
  const document = createBs9CandidateDocument({ rawCards: payload.cardList })
  await mkdir(dirname(resolve(output)), { recursive: true })
  await writeFile(resolve(output), `${JSON.stringify(document, null, 2)}\n`, 'utf8')
  return document
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const document = await runBs9CandidateImport()
    console.log(`BS9 inventory：${document.cards.length} 筆；未 promote。`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
