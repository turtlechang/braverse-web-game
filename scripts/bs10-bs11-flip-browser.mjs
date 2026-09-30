import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { compareFlipState, recordHash, sha256, viewports } from './lib/bs10-bs11-verification.mjs'

const root = process.cwd()
const output = resolve(process.env.BRAVERSE_VERIFICATION_OUTPUT ?? 'test-results/bs10-bs11-verification')
await mkdir(output, { recursive: true })
const reviewed = JSON.parse(readFileSync('scripts/bs10-bs11-reviewed-expectations.json', 'utf8'))
const records = new Map(['official-dark-enchantress-war-bs11.en.json', 'official-paradise-of-passion-and-sloth-catacombs-of-silence-bs10.en.json']
  .flatMap((file) => JSON.parse(readFileSync(resolve('data/cards', file), 'utf8')).cards).map((card) => [card.cardNumber, card]))
const require = createRequire(import.meta.url)
const entry = require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })
const playwright = await import(pathToFileURL(entry).href)
const chromium = playwright.chromium ?? playwright.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')
const executablePath = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
const baseUrl = process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:4186'
const results = []
const publicState = (page) => page.evaluate(() => {
  const field = (side) => {
    const root = document.querySelector(`.${side}-field`)
    const count = (selector) => {
      const text = root.querySelector(selector)?.textContent?.trim()
      if (!text || !/^\d+(?:\/\d+)?$/.test(text)) throw new Error(`Non-numeric public counter: ${selector} ${text}`)
      return Number(text.split('/')[0])
    }
    return {
      hand: count('.row-stat-hand .row-stat-value'), deck: count('.deck-zone .resource-summary > strong'),
      trash: count('.discard-zone.resource-summary > strong'),
      support: [...root.querySelectorAll('.support-card-wrap .card-face')].map((node) => ({ name: node.getAttribute('title'), rested: node.classList.contains('is-rested') })),
      battle: [...root.querySelectorAll('.combat-card-wrap')].map((node) => ({
        id: node.getAttribute('data-card-instance-id'), name: node.querySelector('.card-face')?.getAttribute('title'),
        hp: Number(node.querySelector('.badge-hp')?.textContent?.split('/')[0]), rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
      })),
    }
  }
  return { bottom: field('bottom'), top: field('top') }
})
// Check the actual visible hit target, then use Playwright's normal actionability click.
const normalClick = async (locator, evidence) => {
  await locator.scrollIntoViewIfNeeded()
  assert.equal(await locator.isEnabled(), true)
  const hit = await locator.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    return Boolean(target && (target === node || node.contains(target)))
  })
  assert.equal(hit, true, 'control center must receive a real pointer click')
  evidence.clicks.push((await locator.innerText()).slice(0, 120))
  await locator.click()
}
try {
  cases: for (const expectation of reviewed) for (const viewport of viewports) for (const branch of expectation.branches) {
    const record = records.get(expectation.cardNumber)
    assert.equal(record.flipText, expectation.text, 'printed expectation must be re-reviewed after source changes')
    const image = readFileSync(expectation.artPath)
    assert.equal(sha256(image), expectation.artHash, 'reviewed image hash changed')
    const lethal = branch.startsWith('lethal-')
    const mode = branch.replace('lethal-', '')
    const evidence = { cardNumber: expectation.cardNumber, effect: 'flip', branch, viewport, scope: 'local-test-state', status: 'FAIL',
      recordHash: recordHash(record), artHash: expectation.artHash, expectationHash: sha256(JSON.stringify(expectation)),
      fingerprint: process.env.BRAVERSE_VERIFICATION_FINGERPRINT, clicks: [], errors: [], imageFailures: [], warnings: [] }
    const page = await browser.newPage({ viewport })
    page.setDefaultTimeout(15000)
    // Serve the reviewed, original source image; do not claim live CDN acceptance.
    await page.route(record.imageUrl, (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: image }))
    page.on('pageerror', (error) => evidence.errors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error') evidence.warnings.push(message.text()) })
    page.on('requestfailed', (request) => {
      if (request.resourceType() === 'image') evidence.imageFailures.push({ url: request.url(), reason: request.failure()?.errorText })
      else if (!request.url().endsWith('favicon.ico')) evidence.errors.push(`${request.url()}: ${request.failure()?.errorText}`)
    })
    try {
      const route = expectation.cardNumber.startsWith('BS10')
        ? `${lethal ? 'card-negative' : 'card'}:${expectation.cardNumber}`
        : `bs11-flip:${expectation.cardNumber}:positive`
      evidence.route = route
      const url = new URL('/', baseUrl)
      url.searchParams.set('test-state', route)
      url.searchParams.set('contract-card', `${expectation.cardNumber},BS6-079`)
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      const modal = page.locator('.flip-response-modal').last()
      await modal.waitFor({ state: 'visible' })
      await page.waitForFunction(() => document.querySelector('.match-animation-layer')?.getAttribute('data-playing') !== 'true')
      const art = modal.locator(`img[alt="${expectation.name}"]`).first()
      await art.waitFor({ state: 'visible' })
      await art.evaluate((img) => img.decode())
      assert.equal(await art.getAttribute('src'), record.imageUrl)
      evidence.imageLoaded = await art.evaluate((img) => img.complete && img.naturalWidth > 0)
      assert.equal(evidence.imageLoaded, true)
      assert.match(await modal.innerText(), /Draw up to 1 card|最多抽 1 張/)
      evidence.before = await publicState(page)
      await page.screenshot({ path: resolve(output, `${expectation.cardNumber}-${branch}-${viewport.width}-before.png`) })
      if (mode === 'decline') await normalClick(modal.getByRole('button', { name: '不發動', exact: true }), evidence)
      else {
        await normalClick(modal.getByRole('button', { name: '發動 FLIP', exact: true }), evidence)
        const draw = page.locator('.draw-up-to-modal').last()
        await draw.waitFor({ state: 'visible' })
        assert.equal(await draw.locator('.draw-up-to-option').count(), 2, 'only zero or one may be selected')
        await normalClick(draw.locator('.draw-up-to-option').nth(mode === 'draw-one' ? 1 : 0), evidence)
        const selected = draw.locator('.draw-up-to-option.is-selected')
        await selected.filter({ hasText: mode === 'draw-one' ? '抽 1 張' : '不抽' }).waitFor({ state: 'visible' })
        assert.equal(await selected.count(), 1, 'exactly the clicked quantity must appear selected')
        assert.equal(await draw.locator('.draw-up-to-actions button').innerText(), mode === 'draw-one' ? '抽取 1 張牌' : '略過抽牌')
        await page.screenshot({ path: resolve(output, `${expectation.cardNumber}-${branch}-${viewport.width}-selection.png`) })
        await normalClick(draw.locator('.draw-up-to-actions button'), evidence)
      }
      if (lethal) {
        const replacement = page.locator('.decision-modal .decision-card-options button').filter({ hasText: 'Croissant Cookie' }).first()
        await replacement.waitFor({ state: 'visible' })
        await normalClick(replacement, evidence)
      }
      await page.waitForFunction(() => {
        const visible = (selector) => [...document.querySelectorAll(selector)].some((node) => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden')
        return document.querySelector('.match-animation-layer')?.getAttribute('data-playing') !== 'true' &&
          !visible('.flip-response-modal, .draw-up-to-modal, .decision-modal, .effect-panel, .battle-response-modal')
      })
      evidence.after = await publicState(page)
      evidence.differences = compareFlipState(evidence.before, evidence.after, mode, lethal)
      assert.deepEqual(evidence.differences, [])
      evidence.exactState = true
      const kinds = await page.evaluate(() => (window.__braverseContractTrace ?? []).map((entry) => entry.commandKind))
      const expected = ['resolve-next-damage', 'resolve-flip', ...(mode === 'decline' ? [] : ['resolve-draw-up-to']), ...(lethal ? ['replace-cookie', 'skip-on-play'] : [])]
      let cursor = -1
      for (const kind of expected) { cursor = kinds.indexOf(kind, cursor + 1); assert.ok(cursor >= 0, `missing or out-of-order ${kind}`) }
      assert.equal(kinds.includes('resolve-draw-up-to'), mode !== 'decline')
      evidence.traceKinds = kinds
      assert.deepEqual(evidence.errors, [])
      evidence.normalClicks = true
      evidence.status = 'PASS'
    } catch (error) {
      evidence.error = error.stack ?? String(error)
    } finally {
      await page.screenshot({ path: resolve(output, `${expectation.cardNumber}-${branch}-${viewport.width}-${evidence.status}.png`) }).catch((error) => evidence.errors.push(`screenshot: ${error.message}`))
      await page.close()
      results.push(evidence)
      await writeFile(resolve(output, 'browser.json'), JSON.stringify({ results }, null, 2))
      console.log(`${evidence.status} ${expectation.cardNumber} ${branch} ${viewport.width}x${viewport.height}${evidence.error ? ` ${evidence.error.split('\n')[0]}` : ''}`)
    }
    // Stop this batch at its first failed card; all remaining branches stay missing.
    if (evidence.status !== 'PASS') { process.exitCode = 1; break cases }
  }
} finally { await browser.close() }
