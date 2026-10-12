import { mkdir, writeFile } from 'node:fs/promises'
import { getDatasetUrl, normalizeOfficialCard } from './import-official-cards.mjs'

const datasetUrl = getDatasetUrl('en')
const raw = await (await fetch(datasetUrl)).json()
const numbers = ['P-163', 'ST7-005']
const cards = raw.cardList.filter(card => numbers.includes(card.card_no))
  .map(card => normalizeOfficialCard(card, datasetUrl))
if (cards.length !== numbers.length) throw new Error('Incomplete official source')
await mkdir('data/candidates/cookierift', {recursive:true})
await writeFile('data/candidates/cookierift/official-cookierift-additions.en.json', JSON.stringify({
  schemaVersion:1, source:{provider:'CookieRun: Braverse official website',
    pageUrl:'https://cookierunbraverse.com/en/cardList', datasetUrl,locale:'en',
    fetchedAt:new Date().toISOString(), totalAvailable:raw.cardList.length,
    matchedAvailable:cards.length, importedCount:cards.length, imagesDownloaded:false,
    filter:{categoryTitle:'Cookierift deck additions'}}, cards,
}, null, 2)+'\n', {flag:'wx'})
