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
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-dark-enchantress-war-bs11.en.json'), 'utf8'))
const cards = Object.fromEntries(candidate.cards.map((card) => [card.cardNumber, card]))
const outputDir = resolve(root, 'test-results/bs11-conditional-activate-browser')
mkdirSync(outputDir, { recursive: true })
const cases = ['BS11-021', 'BS11-038'].flatMap((cardNumber) =>
  ['positive', 'negative'].map((scenario) => ({ cardNumber, scenario })))
const widths = process.env.BS11_BROWSER_WIDTHS?.split(',').map(Number).filter(Number.isFinite)
const viewports = [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]
  .filter((viewport) => !widths?.length || widths.includes(viewport.width))
const selected = process.env.BS11_BROWSER_CASES?.split(',').map((value) => value.trim())
const selectedCases = cases.filter(({ cardNumber, scenario }) => !selected?.length || selected.includes(`${cardNumber}-${scenario}`))
if (!viewports.length || !selectedCases.length) throw new Error('No conditional Activate cases selected')
const visible = async (locator) => await locator.count() > 0 && await locator.first().isVisible().catch(() => false)
const clickReady = async (locator) => {
  await locator.waitFor({ state: 'visible' })
  assert.equal(await locator.isEnabled(), true)
  await locator.click()
}
const state = (page) => page.evaluate(() => {
  const field = document.querySelector('.bottom-field')
  return {
    hand: [...(field?.querySelectorAll('.hand-card-wrap') ?? [])].map((node) => node.getAttribute('data-card-instance-id')),
    trashCount: Number(field?.querySelector('.discard-zone.resource-summary > strong')?.textContent?.match(/\d+/)?.[0] ?? NaN),
    support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map((node) => ({
      id: node.getAttribute('data-card-instance-id'), rested: Boolean(node.querySelector('.card-face.is-rested')),
    })),
  }
})
const trace = (page) => page.evaluate(() => (window.__braverseContractTrace ?? []).map((entry) => ({
  commandKind: entry.commandKind, steps: entry.steps?.map((step) => String(step)) ?? [],
})))
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
const results = []
try {
  for (const viewport of viewports) for (const testCase of selectedCases) {
    const page = await browser.newPage({ viewport })
    page.setDefaultTimeout(15000)
    const evidence = { ...testCase, viewport, status: 'FAIL', errors: [] }
    page.on('pageerror', (error) => evidence.errors.push(error.message))
    const card = cards[testCase.cardNumber]
    const imagePath = resolve(root, 'test-results/bs11-official-art', `${testCase.cardNumber}.webp`)
    if (existsSync(imagePath)) await page.route(card.imageUrl, (route) =>
      route.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) }))
    try {
      const url = new URL('/', process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')
      url.searchParams.set('test-state', `bs11-conditional-activate:${testCase.cardNumber}:${testCase.scenario}`)
      url.searchParams.set('contract-card', testCase.cardNumber)
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      const source = page.locator('.bottom-field .combat-card-wrap').filter({
        has: page.locator(`.card-face[title="${card.name}"]`),
      }).first()
      await source.waitFor({ state: 'visible' })
      evidence.art = await source.locator('.card-face').first().evaluate((node) => ({
        url: node.querySelector('img')?.getAttribute('src'),
        loaded: Boolean(node.querySelector('img')?.complete && node.querySelector('img')?.naturalWidth > 0),
      }))
      evidence.before = await state(page)
      const skill = source.locator('.skill-action').filter({ hasText: '啟動技能' }).first()
      if (testCase.scenario === 'positive') {
        await clickReady(skill)
        const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
        await panel.waitFor({ state: 'visible' })
        evidence.panel = await panel.innerText()
        const target = panel.locator('.effect-candidates-target button:not(.is-selected)').first()
        await clickReady(target)
        await clickReady(panel.getByRole('button', { name: '確認發動', exact: true }).last())
        await page.waitForFunction(() => (window.__braverseContractTrace ?? [])
          .some((entry) => entry.commandKind === 'resolve-ability-effect'))
        evidence.after = await state(page)
        evidence.trace = await trace(page)
        if (testCase.cardNumber === 'BS11-021') {
          assert.equal(evidence.after.hand.includes('bs11-021-flip-trash'), true)
          assert.equal(evidence.after.trashCount, evidence.before.trashCount - 1)
        } else {
          assert.equal(evidence.before.support.find((entry) => entry.id === 'bs11-038-rested-support')?.rested, true)
          assert.equal(evidence.after.support.find((entry) => entry.id === 'bs11-038-rested-support')?.rested, false)
        }
        assert.ok(evidence.trace.some((entry) => entry.commandKind === 'begin-activate-skill'))
        assert.ok(!await visible(skill) || !await skill.isEnabled(), 'once-per-turn skill must close')
      } else {
        assert.ok(!await visible(skill) || !await skill.isEnabled(), 'condition must block skill')
        evidence.after = await state(page)
        evidence.trace = await trace(page)
        assert.deepEqual(evidence.after, evidence.before)
        assert.equal(evidence.trace.some((entry) => entry.commandKind === 'begin-activate-skill'), false)
      }
      assert.equal(evidence.art.url, card.imageUrl)
      if (existsSync(imagePath)) {
        await page.waitForFunction((imageUrl) => [...document.images]
          .some((img) => img.getAttribute('src') === imageUrl && img.complete && img.naturalWidth > 0), card.imageUrl)
        evidence.art.loaded = true
      }
      assert.deepEqual(evidence.errors, [])
      evidence.status = 'PASS'
    } catch (error) {
      evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
      evidence.trace ??= await trace(page).catch(() => [])
      evidence.debug = await page.evaluate(() => ({
        dialogs: [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')]
          .filter((node) => node.getBoundingClientRect().width > 0).map((node) => node.textContent?.trim().slice(0, 500)),
      })).catch(() => null)
    } finally {
      await page.close()
    }
    results.push(evidence)
    console.log(`${evidence.status} ${testCase.cardNumber}-${testCase.scenario} ${viewport.width}x${viewport.height}${evidence.error ? ': ' + evidence.error.split('\n')[0] : ''}`)
  }
} finally {
  await browser.close()
}
const artifactPath = resolve(outputDir, `bs11-conditional-activate-browser-${Date.now()}.json`)
const summary = { total: results.length, passed: results.filter((entry) => entry.status === 'PASS').length }
writeFileSync(artifactPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2) + '\n')
console.log(JSON.stringify({ artifactPath, summary }))
if (summary.total !== summary.passed) process.exitCode = 1
