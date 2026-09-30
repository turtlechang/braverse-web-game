import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { routeBs11OfficialArt } from './bs11-official-art-route.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const entry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const playwright = await import(pathToFileURL(entry).href)
const chromium = playwright.chromium ?? playwright.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const records = JSON.parse(readFileSync(resolve(root, 'data/cards/official-dark-enchantress-war-bs11.en.json'), 'utf8')).cards
const byNumber = new Map(records.map((record) => [record.cardNumber, record]))
const baseUrl = process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'
const outputDir = resolve(root, 'test-results/bs11-088-on-play-browser')
mkdirSync(outputDir, { recursive: true })
const executablePath = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
const viewports = [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]
const cases = ['BS11-088', 'BS11-088@1'].flatMap((cardNumber) =>
  [true, false].map((positive) => ({ cardNumber, positive })))
const chosen = process.env.BS11_BROWSER_CASES?.split(',')
const selectedCases = cases.filter(({ cardNumber, positive }) =>
  !chosen?.length || chosen.includes(`${cardNumber}-${positive ? 'positive' : 'negative'}`))
const selectedViewports = viewports.filter(({ width }) =>
  !process.env.BS11_BROWSER_WIDTHS || process.env.BS11_BROWSER_WIDTHS.split(',').map(Number).includes(width))
if (!selectedCases.length || !selectedViewports.length) throw new Error('No BS11-088 On Play case selected')

const trace = (page) => page.evaluate(() => window.__braverseContractTrace ?? [])
const readState = (page) => page.locator('.bottom-field').evaluate((field) => ({
  hand: [...field.querySelectorAll('.hand-card-wrap')].map((node) => node.getAttribute('data-card-instance-id')),
  battle: [...field.querySelectorAll('.combat-card-wrap')].map((node) => node.getAttribute('data-card-instance-id')),
  trashCount: Number(field.querySelector('.discard-zone.resource-summary > strong')?.textContent?.match(/\d+/)?.[0] ?? NaN),
}))

const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
const results = []
try {
  for (const viewport of selectedViewports) for (const testCase of selectedCases) {
    const page = await browser.newPage({ viewport })
    page.setDefaultTimeout(15000)
    await routeBs11OfficialArt(page)
    const evidence = { ...testCase, viewport, status: 'FAIL', errors: [] }
    page.on('pageerror', (error) => evidence.errors.push(`pageerror: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() !== 'error') return
      const location = message.location().url ?? ''
      if (location.includes('cookierunbraverse.com/data/en_storage/') || location.endsWith('/favicon.ico')) return
      evidence.errors.push(`console: ${message.text()}`)
    })
    page.on('requestfailed', (request) => {
      const url = request.url()
      if (url.includes('cookierunbraverse.com/data/en_storage/') || url.endsWith('/favicon.ico')) return
      evidence.errors.push(`request failed: ${url} ${request.failure()?.errorText ?? 'unknown'}`)
    })
    page.on('response', (response) => {
      const url = response.url()
      if (response.status() < 400 || url.includes('cookierunbraverse.com/data/en_storage/') || url.endsWith('/favicon.ico')) return
      evidence.errors.push(`${response.status()} response: ${url}`)
    })
    try {
      const route = `bs11-088-on-play:${testCase.cardNumber}:${testCase.positive ? 'positive' : 'negative'}`
      const url = new URL('/', baseUrl)
      url.searchParams.set('test-state', route)
      url.searchParams.set('contract-card', 'BS11-088')
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      evidence.before = await readState(page)
      const handEntry = page.locator('.bottom-field .hand-card-wrap').filter({
        has: page.locator('.card-face[title="Moonlight Cookie"]'),
      }).first()
      await handEntry.waitFor({ state: 'visible' })
      evidence.art = await handEntry.locator('.card-face').evaluate((face) => {
        const img = face.querySelector('img')
        return { src: img?.getAttribute('src'), alt: img?.getAttribute('alt'), loaded: Boolean(img?.complete && img.naturalWidth > 0) }
      })
      assert.equal(evidence.art.src, byNumber.get(testCase.cardNumber).imageUrl)
      assert.equal(evidence.art.alt, 'Moonlight Cookie')
      assert.equal(evidence.art.loaded, true)
      await handEntry.locator('.card-face').click()
      const deploy = handEntry.locator('.hand-card-action').filter({ hasText: '登場' }).first()
      assert.equal(await deploy.isEnabled(), true)
      await deploy.click()
      const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
      if (testCase.positive) {
        await panel.waitFor({ state: 'visible' })
        evidence.costPanel = await panel.innerText()
        const cost = panel.locator('.effect-candidates-trash-battle button')
        assert.equal(await cost.count(), 1)
        assert.match(await cost.first().innerText(), /Crunchy Chip Cookie/)
        await cost.first().click()
        await panel.getByRole('button', { name: '下一步', exact: true }).click()
        evidence.targetPanel = await panel.innerText()
        const targets = panel.locator('.effect-candidates-target button')
        assert.equal(await targets.count(), 1, 'only purple LV.2+ Cookie may be recovered')
        assert.match(await targets.first().innerText(), /Dark Cacao Cookie/)
        assert.doesNotMatch(evidence.targetPanel, /Salt Cellar Cookie\s*點擊選取/)
        await targets.first().click()
        await panel.getByRole('button', { name: '確認發動', exact: true }).click()
        await page.waitForFunction(() => (window.__braverseContractTrace ?? [])
          .some((entry) => entry.commandKind === 'begin-activate-skill'))
      } else {
        await page.waitForTimeout(300)
        assert.equal(await panel.count(), 0, 'missing purple LV.1 battle cost must not open On Play decision')
      }
      evidence.after = await readState(page)
      evidence.trace = await trace(page)
      assert.equal(evidence.before.hand.length - 1 + (testCase.positive ? 1 : 0), evidence.after.hand.length)
      assert.equal(evidence.after.battle.length, 1, 'On Play must leave only Moonlight Cookie in battle')
      assert.ok(evidence.after.battle.includes(`player-one-${testCase.cardNumber}-1`))
      assert.equal(evidence.after.battle.includes('bs11-088-on-play-payment'), false)
      assert.equal(evidence.after.hand.includes('bs11-088-on-play-recovered'), testCase.positive)
      assert.equal(
        evidence.after.trashCount,
        evidence.before.trashCount + (testCase.positive ? 2 : 0),
        'positive route trashes the cost Cookie and its two HP cards, then recovers one Cookie',
      )
      assert.ok(evidence.trace.some((item) => item.commandKind === 'deploy-cookie'))
      assert.equal(evidence.trace.some((item) => item.commandKind === 'begin-activate-skill'), testCase.positive)
      assert.equal(evidence.trace.some((item) => item.commandKind === 'resolve-ability-effect'), testCase.positive)
      evidence.status = 'PASS'
      assert.deepEqual(evidence.errors, [])
    } catch (error) {
      evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
      evidence.debug = await page.locator('body').innerText().catch(() => '')
    } finally {
      await page.close()
    }
    results.push(evidence)
    console.log(`${evidence.status} ${testCase.cardNumber} ${testCase.positive ? 'positive' : 'negative'} ${viewport.width}x${viewport.height}`)
  }
} finally {
  await browser.close()
}
const artifactPath = resolve(outputDir, `bs11-088-on-play-browser-${Date.now()}.json`)
writeFileSync(artifactPath, `${JSON.stringify({ results }, null, 2)}\n`)
console.log(artifactPath)
assert.equal(results.filter((result) => result.status === 'PASS').length, results.length)
