import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const module = await import(pathToFileURL(playwrightEntry).href)
const chromium = module.chromium ?? module.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')
const executablePath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'
const outputDir = resolve(root, 'test-results/bs11-092-browser')
mkdirSync(outputDir, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-dark-enchantress-war-bs11.en.json'), 'utf8'))
const byNumber = new Map(candidate.cards.map((record) => [record.cardNumber, record]))
const cases = ['BS11-092'].flatMap((cardNumber) =>
  ['positive', 'negative'].map((scenario) => ({ cardNumber, scenario })))
const requested = process.env.BS11_BROWSER_CASES?.split(',').map((value) => value.trim()).filter(Boolean)
const selectedCases = requested?.length ? cases.filter((entry) => requested.includes(`${entry.cardNumber}-${entry.scenario}`)) : cases
const widths = process.env.BS11_BROWSER_WIDTHS?.split(',').map(Number).filter(Number.isFinite)
const viewports = [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]
const selectedViewports = widths?.length ? viewports.filter((entry) => widths.includes(entry.width)) : viewports
if (!selectedCases.length || !selectedViewports.length) throw new Error('No BS11-092 skill case selected')

const visible = async (locator) => await locator.count() > 0 && await locator.first().isVisible().catch(() => false)
const clickReady = async (locator, label) => {
  await locator.waitFor({ state: 'visible' })
  assert.equal(await locator.isEnabled(), true, `${label} must be enabled`)
  await locator.click()
}
const trace = (page) => page.evaluate(() => (window.__braverseContractTrace ?? []).map((entry) => ({
  commandKind: entry.commandKind,
  steps: Array.isArray(entry.steps) ? entry.steps.map(String) : [],
})))
const state = (page) => page.evaluate(() => {
  const side = (name) => {
    const field = document.querySelector(`.${name}-field`)
    const count = (selector) => Number(field?.querySelector(selector)?.textContent?.match(/\d+/)?.[0] ?? NaN)
    return {
      hand: field?.querySelectorAll('.hand-card-wrap').length ?? 0,
      deck: count('.deck-zone .resource-summary > strong'),
      trash: count('.discard-zone.resource-summary > strong'),
      supports: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map((node) => ({
        id: node.getAttribute('data-card-instance-id'),
        rested: Boolean(node.querySelector('.card-face.is-rested')),
      })),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map((node) => ({
        id: node.getAttribute('data-card-instance-id'),
        name: node.querySelector('.card-face')?.getAttribute('title'),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
      })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const art = (locator) => locator.evaluate((node) => {
  const image = node.querySelector('img')
  return { url: image?.getAttribute('src'), loaded: Boolean(image?.complete && image.naturalWidth > 0) }
})
const skipAnimations = async (page) => {
  for (let step = 0; step < 16; step += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click({ timeout: 1000 }).catch(() => {})
    await page.waitForTimeout(100)
  }
}

const runCase = async (page, testCase, evidence) => {
  evidence.before = await state(page)
  const source = page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator(`.card-face[title="${byNumber.get(testCase.cardNumber).name}"]`),
  }).first()
  await source.waitFor({ state: 'visible' })
  evidence.art = await art(source.locator('.card-face').first())
  evidence.beforeLevelText = await visible(source.locator('.badge-level'))
    ? await source.locator('.badge-level').first().textContent() : null
  evidence.beforeTrace = await trace(page)
  const skill = source.locator('.skill-action').filter({ hasText: '啟動技能' }).first()
  if (testCase.scenario === 'negative') {
    assert.ok(!await visible(skill) || !await skill.isEnabled(), 'once-per-turn skill must not be offered twice')
    evidence.after = await state(page)
    evidence.trace = await trace(page)
    assert.deepEqual(evidence.after, evidence.before)
    assert.deepEqual(evidence.trace, evidence.beforeTrace)
    assert.match(evidence.beforeLevelText ?? '', /LV\s*1/)
    return
  }
  assert.equal(evidence.beforeLevelText, null)
  await clickReady(skill, `${testCase.cardNumber} Activate`)
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
  if (await visible(panel)) {
    evidence.panelText = await panel.innerText()
    const target = panel.locator('.effect-candidates-target:visible button:not(.is-selected)').first()
    if (await visible(target)) await clickReady(target, 'Licorice self LV target')
    await clickReady(panel.locator('.effect-panel-primary-action:visible').last(), 'resolve Licorice LV change')
  }
  await skipAnimations(page)
  evidence.after = await state(page)
  evidence.trace = await trace(page)
  evidence.afterLevelText = await source.locator('.badge-level').first().textContent()
  assert.match(evidence.afterLevelText ?? '', /LV\s*1/)
  const levelBox = await source.locator('.badge-level').boundingBox()
  const hpBox = await source.locator('.badge-hp').boundingBox()
  const attackBox = await source.locator('.badge-atk').boundingBox()
  const overlap = (left, right) => Boolean(left && right && left.x < right.x + right.width &&
    left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y)
  assert.equal(overlap(levelBox, hpBox), false)
  assert.equal(overlap(levelBox, attackBox), false)
  evidence.levelBadgeBox = levelBox
  assert.ok(evidence.trace.length > evidence.beforeTrace.length)
  assert.deepEqual(evidence.after.bottom.supports, evidence.before.bottom.supports)
  assert.deepEqual(evidence.after.top.battle, evidence.before.top.battle)
}

const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
const results = []
try {
  for (const viewport of selectedViewports) {
    for (const testCase of selectedCases) {
      const page = await browser.newPage({ viewport })
      page.setDefaultTimeout(15000)
      const evidence = { id: `${testCase.cardNumber}-${testCase.scenario}`, viewport, status: 'FAIL', errors: [] }
      page.on('pageerror', (error) => evidence.errors.push(error.message))
      const imageUrl = byNumber.get(testCase.cardNumber)?.imageUrl
      const imagePath = resolve(root, 'test-results/bs11-official-art', `${testCase.cardNumber}.webp`)
      if (imageUrl && existsSync(imagePath)) {
        await page.route(imageUrl, (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) }))
        evidence.officialArtDelivery = 'official CDN bytes served from local test artifact'
      }
      try {
        const url = new URL('/', baseUrl)
        url.searchParams.set('test-state', `bs11-092-activate:${testCase.scenario}`)
        url.searchParams.set('contract-card', testCase.cardNumber)
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
        await page.locator('.game-shell').waitFor({ state: 'visible' })
        await runCase(page, testCase, evidence)
        if (testCase.scenario === 'positive') {
          evidence.screenshot = resolve(outputDir, `bs11-092-${viewport.width}x${viewport.height}.png`)
          await page.screenshot({ path: evidence.screenshot })
        }
        assert.equal(evidence.art.url, imageUrl)
        if (existsSync(imagePath)) assert.equal(evidence.art.loaded, true)
        assert.deepEqual(evidence.errors, [])
        evidence.status = 'PASS'
      } catch (error) {
        evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
        evidence.trace ??= await trace(page).catch(() => [])
        evidence.debug = await page.evaluate(() => ({
          dialogs: [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')]
            .filter((node) => node.getBoundingClientRect().width > 0).map((node) => node.textContent?.trim().slice(0, 800)),
          buttons: [...document.querySelectorAll('button')].filter((node) => node.getBoundingClientRect().width > 0)
            .map((node) => node.textContent?.trim()).filter(Boolean).slice(-25),
        })).catch(() => null)
      } finally {
        await page.close()
      }
      results.push(evidence)
      console.log(`${evidence.status} ${evidence.id} ${viewport.width}x${viewport.height}${evidence.error ? ': ' + evidence.error.split('\n')[0] : ''}`)
    }
  }
} finally {
  await browser.close()
}
const artifactPath = resolve(outputDir, `bs11-092-browser-${Date.now()}.json`)
const summary = { total: results.length, passed: results.filter((entry) => entry.status === 'PASS').length }
writeFileSync(artifactPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2) + '\n')
console.log(JSON.stringify({ artifactPath, summary }))
if (summary.passed !== summary.total) process.exitCode = 1
