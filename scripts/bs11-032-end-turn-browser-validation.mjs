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
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
const records = JSON.parse(readFileSync(resolve(root, 'data/cards/official-dark-enchantress-war-bs11.en.json'), 'utf8')).cards
const outputDir = resolve(root, 'test-results/bs11-032-end-turn-browser')
mkdirSync(outputDir, { recursive: true })
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) {
    for (const cardNumber of ['BS11-032', 'BS11-032@1']) for (const scenario of ['positive', 'negative']) {
      const page = await browser.newPage({ viewport })
      page.setDefaultTimeout(12000)
      const evidence = { cardNumber, scenario, viewport, status: 'FAIL', errors: [] }
      page.on('pageerror', (error) => evidence.errors.push(error.message))
      const imageUrl = records.find((entry) => entry.cardNumber === cardNumber)?.imageUrl
      const imagePath = resolve(root, 'test-results/bs11-official-art', `${cardNumber.replace('@', '-at-')}.webp`)
      if (imageUrl && existsSync(imagePath)) await page.route(imageUrl, (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) }))
      try {
        const url = new URL('/', process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')
        url.searchParams.set('test-state', `bs11-032-end-turn:${cardNumber}:${scenario}`)
        url.searchParams.set('contract-card', 'BS11-032')
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
        await page.locator('.game-shell').waitFor({ state: 'visible' })
        const source = page.locator('.bottom-field .combat-card-wrap').filter({ has: page.locator('.card-face[title="Burnt Cheese Cookie"]') }).first()
        await source.waitFor({ state: 'visible' })
        evidence.art = await source.locator('.card-face').first().evaluate((node) => {
          const image = node.querySelector('img')
          return { url: image?.getAttribute('src'), loaded: Boolean(image?.complete && image.naturalWidth > 0) }
        })
        await page.getByRole('button', { name: '結束主要階段', exact: true }).click()
        await page.getByRole('button', { name: '結束回合', exact: true }).click()
        const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
        evidence.panel = await panel.count() ? await panel.innerText() : null
        if (scenario === 'positive') {
          await panel.waitFor({ state: 'visible' })
          assert.match(evidence.panel, /回合結束效果/)
          await panel.getByRole('button', { name: '確認發動', exact: true }).click()
        } else {
          assert.equal(await panel.count(), 0)
        }
        evidence.after = await page.evaluate(() => ({
          sourceInBattle: Boolean(document.querySelector('.bottom-field .combat-card-wrap .card-face[title="Burnt Cheese Cookie"]')),
          trashCount: Number(document.querySelector('.bottom-field .discard-zone.resource-summary > strong')?.textContent?.match(/\d+/)?.[0] ?? NaN),
        }))
        evidence.trace = await page.evaluate(() => (window.__braverseContractTrace ?? []).map((entry) => ({ commandKind: entry.commandKind, steps: entry.steps })))
        assert.equal(evidence.art.url, imageUrl)
        if (existsSync(imagePath)) assert.equal(evidence.art.loaded, true)
        assert.equal(evidence.after.sourceInBattle, scenario !== 'positive')
        assert.equal(evidence.after.trashCount, scenario === 'positive' ? 3 : 0)
        assert.equal(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect'), scenario === 'positive')
        assert.deepEqual(evidence.errors, [])
        evidence.status = 'PASS'
      } catch (error) {
        evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
        evidence.debug = await page.locator('[role="alertdialog"]').allTextContents().catch(() => [])
      } finally {
        results.push(evidence)
        console.log(`${evidence.status} ${cardNumber}-${scenario} ${viewport.width}x${viewport.height}${evidence.error ? `: ${evidence.error.split('\n')[0]}` : ''}`)
        await page.close()
      }
    }
  }
} finally { await browser.close() }
const artifactPath = resolve(outputDir, `bs11-032-end-turn-browser-${Date.now()}.json`)
const summary = { total: results.length, passed: results.filter((entry) => entry.status === 'PASS').length }
writeFileSync(artifactPath, JSON.stringify({ summary, results }, null, 2))
console.log(JSON.stringify({ artifactPath, summary }))
if (summary.passed !== summary.total) process.exitCode = 1
