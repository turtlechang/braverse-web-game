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
const candidates = JSON.parse(readFileSync(resolve(root, 'data/cards/official-dark-enchantress-war-bs11.en.json'), 'utf8')).cards
const card = candidates.find((item) => item.cardNumber === 'BS11-024')
const replacement = candidates.find((item) => item.cardNumber === 'BS11-034')
const outputDir = resolve(root, 'test-results/bs11-024-browser')
mkdirSync(outputDir, { recursive: true })
const widths = process.env.BS11_BROWSER_WIDTHS?.split(',').map(Number).filter(Number.isFinite)
const viewports = [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]
  .filter((viewport) => !widths?.length || widths.includes(viewport.width))
const selected = process.env.BS11_BROWSER_CASES?.split(',').map((value) => value.trim())
const cases = ['positive', 'negative'].filter((scenario) => !selected?.length || selected.includes(`BS11-024-${scenario}`))
if (!viewports.length || !cases.length) throw new Error('No BS11-024 cases selected')
const visible = async (locator) => await locator.count() > 0 && await locator.first().isVisible().catch(() => false)
const clickReady = async (locator) => {
  await locator.waitFor({ state: 'visible' })
  assert.equal(await locator.isEnabled(), true)
  await locator.click()
}
const trace = (page) => page.evaluate(() => (window.__braverseContractTrace ?? []).map((entry) => ({
  commandKind: entry.commandKind, steps: entry.steps?.map(String) ?? [],
})))
const state = (page) => page.evaluate(() => {
  const field = document.querySelector('.bottom-field')
  const count = (selector) => Number(field?.querySelector(selector)?.textContent?.match(/\d+/)?.[0] ?? NaN)
  return {
    hand: [...(field?.querySelectorAll('.hand-card-wrap') ?? [])].map((node) => node.getAttribute('data-card-instance-id')),
    deck: count('.deck-zone .resource-summary > strong'),
    breakCount: count('.break-zone.resource-summary > strong'),
    battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map((node) => ({
      id: node.getAttribute('data-card-instance-id'),
      hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
    })),
  }
})
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
const results = []
try {
  for (const viewport of viewports) for (const scenario of cases) {
    const page = await browser.newPage({ viewport })
    page.setDefaultTimeout(15000)
    const evidence = { scenario, viewport, status: 'FAIL', errors: [] }
    page.on('pageerror', (error) => evidence.errors.push(error.message))
    const imagePath = resolve(root, 'test-results/bs11-official-art/BS11-024.webp')
    if (existsSync(imagePath)) await page.route(card.imageUrl, (route) =>
      route.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) }))
    try {
      const url = new URL('/', process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')
      url.searchParams.set('test-state', `bs11-024-faint:${scenario}`)
      url.searchParams.set('contract-card', 'BS11-024')
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      const modal = page.locator('.faint-response-modal:visible').first()
      await modal.waitFor({ state: 'visible' })
      evidence.before = await state(page)
      evidence.modalText = await modal.innerText()
      evidence.art = await modal.locator('.faint-effect-card-detail .card-face').first().evaluate((node) => ({
        url: node.querySelector('img')?.getAttribute('src'),
        loaded: Boolean(node.querySelector('img')?.complete && node.querySelector('img')?.naturalWidth > 0),
      }))
      if (scenario === 'positive') {
        assert.equal(await modal.locator('.faint-card-candidates button').count(), 1)
        await clickReady(modal.locator('.faint-card-candidates button').first())
        await clickReady(modal.locator('.modal-actions button').last())
      } else {
        assert.equal(await modal.locator('.faint-card-candidates button').count(), 0)
        await clickReady(modal.locator('.modal-actions button').first())
      }
      await page.waitForFunction(() => (window.__braverseContractTrace ?? [])
        .some((item) => item.commandKind === 'resolve-faint-effect'))
      evidence.after = await state(page)
      evidence.trace = await trace(page)
      assert.equal(evidence.after.battle.some((item) => item.id === 'bs11-024-replacement'), scenario === 'positive')
      if (scenario === 'positive') {
        assert.equal(evidence.before.hand.includes('bs11-024-replacement'), true)
        assert.equal(evidence.after.hand.includes('bs11-024-replacement'), false)
        assert.equal(evidence.after.battle.find((item) => item.id === 'bs11-024-replacement')?.hp, replacement.hp + 1)
      } else {
        assert.deepEqual(evidence.after.hand, evidence.before.hand)
      }
      assert.equal(evidence.art.url, card.imageUrl)
      if (existsSync(imagePath)) {
        await page.waitForFunction((imageUrl) => [...document.images].some((img) => img.getAttribute('src') === imageUrl && img.complete && img.naturalWidth > 0), card.imageUrl)
        evidence.art.loaded = true
      }
      assert.deepEqual(evidence.errors, [])
      evidence.status = 'PASS'
    } catch (error) {
      evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
      evidence.trace ??= await trace(page).catch(() => [])
      evidence.debug = await page.evaluate(() => ({
        modals: [...document.querySelectorAll('.faint-response-modal, .effect-panel')]
          .filter((node) => node.getBoundingClientRect().width > 0).map((node) => node.textContent?.trim().slice(0, 700)),
      })).catch(() => null)
    } finally {
      await page.close()
    }
    results.push(evidence)
    console.log(`${evidence.status} BS11-024-${scenario} ${viewport.width}x${viewport.height}${evidence.error ? ': ' + evidence.error.split('\n')[0] : ''}`)
  }
} finally {
  await browser.close()
}
const artifactPath = resolve(outputDir, `bs11-024-browser-${Date.now()}.json`)
const summary = { total: results.length, passed: results.filter((entry) => entry.status === 'PASS').length }
writeFileSync(artifactPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2) + '\n')
console.log(JSON.stringify({ artifactPath, summary }))
if (summary.total !== summary.passed) process.exitCode = 1
