import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const entry = require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })
const module = await import(pathToFileURL(entry).href)
const chromium = module.chromium ?? module.default?.chromium
const imageUrl = JSON.parse(readFileSync(resolve(root, 'data/cards/official-dark-enchantress-war-bs11.en.json'), 'utf8'))
  .cards.find((card) => card.cardNumber === 'BS11-071@2').imageUrl
const imagePath = resolve(root, 'test-results/bs11-official-art/BS11-071-at-2.webp')
const outputDir = resolve(root, 'test-results/bs11-071-hp-no-flip-browser')
mkdirSync(outputDir, { recursive: true })
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) {
    const page = await browser.newPage({ viewport })
    const evidence = { viewport, status: 'FAIL', errors: [] }
    page.on('pageerror', (error) => evidence.errors.push(error.message))
    if (existsSync(imagePath)) await page.route(imageUrl, (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) }))
    try {
      const url = new URL('/', process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')
      url.searchParams.set('test-state', 'bs11-071-hp-no-flip')
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      evidence.state = await page.evaluate((expectedUrl) => {
        const bearer = document.querySelector('.combat-card-wrap[data-card-instance-id="bs11-bs11-071-2-bearer"]')
        const image = [...document.querySelectorAll('img')].find((node) => node.getAttribute('src') === expectedUrl)
        return {
          bearerHp: Number(bearer?.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
          discardCount: Number(document.querySelector('.bottom-field .discard-zone.resource-summary > strong')?.textContent?.match(/\d+/)?.[0] ?? NaN),
          imageLoaded: Boolean(image?.complete && image.naturalWidth > 0),
          effectPanels: document.querySelectorAll('.effect-panel[role="alertdialog"]:not([hidden])').length,
          flipButtons: [...document.querySelectorAll('button')].filter((node) => /FLIP|翻開/.test(node.textContent ?? '')).length,
        }
      }, imageUrl)
      assert.equal(evidence.state.bearerHp, 1)
      assert.equal(evidence.state.discardCount, 1)
      if (existsSync(imagePath)) assert.equal(evidence.state.imageLoaded, true)
      assert.equal(evidence.state.effectPanels, 0)
      assert.equal(evidence.state.flipButtons, 0)
      assert.deepEqual(evidence.errors, [])
      evidence.status = 'PASS'
    } catch (error) {
      evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
    } finally {
      console.log(`${evidence.status} BS11-071@2 HP reveal ${viewport.width}x${viewport.height}${evidence.error ? `: ${evidence.error.split('\n')[0]}` : ''}`)
      results.push(evidence)
      await page.close()
    }
  }
} finally { await browser.close() }
const artifactPath = resolve(outputDir, `bs11-071-hp-no-flip-browser-${Date.now()}.json`)
const summary = { total: results.length, passed: results.filter((entry) => entry.status === 'PASS').length }
writeFileSync(artifactPath, JSON.stringify({ summary, results }, null, 2))
console.log(JSON.stringify({ artifactPath, summary }))
if (summary.passed !== summary.total) process.exitCode = 1
