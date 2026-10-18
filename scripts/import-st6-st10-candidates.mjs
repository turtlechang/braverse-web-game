import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { getDatasetUrl, normalizeOfficialCard } from './import-official-cards.mjs'
import { selectStarterSeriesCards } from './starter-series-candidates.mjs'

// Import only. Each printing remains isolated until its physical-card gates pass.
const datasetUrl = getDatasetUrl('en')
const response = await fetch(datasetUrl)
if (!response.ok) throw new Error(`Official source HTTP ${response.status}`)
const raw = await response.json()
if (!Array.isArray(raw.cardList)) throw new Error('Missing official cardList')
const formal = new Set()
for (const name of await readdir('data/cards')) {
  if (!name.endsWith('.json')) continue
  const doc = JSON.parse(await readFile(`data/cards/${name}`, 'utf8'))
  for (const card of doc.cards ?? []) formal.add(card.cardNumber)
}
await mkdir('data/candidates/st6-st10', { recursive: true })
const inventory = []
for (let series = 6; series <= 10; series++) {
  const cards = selectStarterSeriesCards(raw.cardList, series)
    .map(card => normalizeOfficialCard(card, datasetUrl))
  if (!cards.length) throw new Error(`No official ST${series} cards`)
  const pending = cards.filter(card => !formal.has(card.cardNumber))
  inventory.push({ series: `ST${series}`, sourceCount: cards.length,
    formal: cards.filter(card => formal.has(card.cardNumber)).map(card => card.cardNumber),
    pending: pending.map(card => ({cardNumber: card.cardNumber, imageUrl: card.imageUrl,
      product: card.product.title, status: 'awaiting-physical-verification'})) })
  await writeFile(`data/candidates/st6-st10/official-st${series}.en.json`, JSON.stringify({
    schemaVersion: 1, source: { provider: 'CookieRun: Braverse official website',
      pageUrl: 'https://cookierunbraverse.com/en/cardList', datasetUrl, locale: 'en',
      fetchedAt: new Date().toISOString(), totalAvailable: raw.cardList.length,
      matchedAvailable: cards.length, importedCount: pending.length, imagesDownloaded: false,
      candidateStatus: 'inventory',
      filter: { categoryTitle: `ST${series} unpromoted printings` } }, cards: pending,
  }, null, 2)+'\n', { flag: 'wx' })
}
await mkdir('output/st6-st10', { recursive: true })
await writeFile('output/st6-st10/inventory.json', JSON.stringify(inventory, null, 2)+'\n', { flag: 'wx' })
console.log(inventory.map(row => ({series: row.series, source: row.sourceCount,
  formal: row.formal.length, candidate: row.pending.length})))
