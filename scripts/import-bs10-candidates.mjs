import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { backfillVariantStats, getDatasetUrl, normalizeOfficialCard } from './import-official-cards.mjs'

export const DEFAULT_OUTPUT = 'data/candidates/official-paradise-of-passion-and-sloth-catacombs-of-silence-bs10.en.json'
export const createBs10CandidateDocument = ({ rawCards, importedAt = new Date().toISOString() }) => {
  if (!Array.isArray(rawCards)) throw new Error('官方資料缺少 cardList 陣列。')
  const selected = rawCards.filter((card) => /^BS10-/i.test(card?.card_no ?? ''))
  if (!selected.length) throw new Error('官方卡表沒有 BS10- 卡片，未建立空候選。')
  const datasetUrl = getDatasetUrl('en')
  const cards = backfillVariantStats(selected.map((card) => normalizeOfficialCard(card, datasetUrl)))
  if (new Set(cards.map((card) => card.cardNumber)).size !== cards.length) {
    throw new Error('BS10 官方卡號重複，停止匯入。')
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

export const runBs10CandidateImport = async ({ fetchImpl = fetch, output = DEFAULT_OUTPUT } = {}) => {
  const response = await fetchImpl(getDatasetUrl('en'))
  if (!response.ok) throw new Error(`官方卡表請求失敗：HTTP ${response.status}`)
  const payload = await response.json()
  const document = createBs10CandidateDocument({ rawCards: payload.cardList })
  await mkdir(dirname(resolve(output)), { recursive: true })
  await writeFile(resolve(output), `${JSON.stringify(document, null, 2)}\n`, 'utf8')
  return document
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const document = await runBs10CandidateImport()
    console.log(`BS10 inventory：${document.cards.length} 筆；未 promote。`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
