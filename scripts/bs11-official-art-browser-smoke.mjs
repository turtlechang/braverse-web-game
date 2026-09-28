import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { routeBs11OfficialArt } from './bs11-official-art-route.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-dark-enchantress-war-bs11.en.json'), 'utf8'))
const cards = candidate.cards.map(({ cardNumber, imageUrl }) => ({ cardNumber, imageUrl }))
const browserExecutable = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)

const browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) })
const results = []
try {
  const page = await browser.newPage()
  await routeBs11OfficialArt(page)
  for (let index = 0; index < cards.length; index += 20) {
    const batch = cards.slice(index, index + 20)
    results.push(...await page.evaluate(async (entries) => Promise.all(entries.map(({ cardNumber, imageUrl }) => new Promise((resolveImage) => {
      const image = new Image()
      image.onload = () => resolveImage({ cardNumber, imageUrl, loaded: true, width: image.naturalWidth, height: image.naturalHeight })
      image.onerror = () => resolveImage({ cardNumber, imageUrl, loaded: false, width: 0, height: 0 })
      image.src = imageUrl
    }))), batch))
  }
} finally {
  await browser.close()
}

const outputDir = resolve(root, 'test-results/bs11-official-art')
mkdirSync(outputDir, { recursive: true })
const artifactPath = resolve(outputDir, `bs11-official-art-browser-smoke-${Date.now()}.json`)
const artifact = {
  scope: 'Browser decode of candidate source URLs using locally saved official WebP bytes; not app UI or CDN acceptance',
  total: results.length,
  loaded: results.filter((result) => result.loaded && result.width > 0 && result.height > 0).length,
  results,
}
writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ artifactPath, total: artifact.total, loaded: artifact.loaded }))
assert.equal(artifact.total, cards.length)
assert.equal(artifact.loaded, cards.length, 'Every BS11 candidate source image must decode in Browser')
