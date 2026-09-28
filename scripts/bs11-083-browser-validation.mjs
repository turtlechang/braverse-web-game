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
const outputDir = resolve(root, 'test-results/bs11-083-browser')
mkdirSync(outputDir, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-dark-enchantress-war-bs11.en.json'), 'utf8'))
const imageUrl = candidate.cards.find((record) => record.cardNumber === 'BS11-083')?.imageUrl
const imagePath = resolve(root, 'test-results/bs11-official-art/BS11-083.webp')
const cases = ['stage', 'replacement'].flatMap((kind) =>
  ['positive', 'negative'].map((scenario) => ({ kind, scenario })))
const requested = process.env.BS11_BROWSER_CASES?.split(',').map((value) => value.trim()).filter(Boolean)
const selectedCases = requested?.length ? cases.filter((entry) => requested.includes(`${entry.kind}-${entry.scenario}`)) : cases
const widths = process.env.BS11_BROWSER_WIDTHS?.split(',').map(Number).filter(Number.isFinite)
const viewports = [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]
const selectedViewports = widths?.length ? viewports.filter((entry) => widths.includes(entry.width)) : viewports
if (!selectedCases.length || !selectedViewports.length) throw new Error('No BS11-083 case selected')

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
const waitForCommand = (page, kind) => page.waitForFunction(
  (commandKind) => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === commandKind), kind,
)
const state = (page) => page.evaluate(() => {
  const side = (name) => {
    const field = document.querySelector(`.${name}-field`)
    const count = (selector) => Number(field?.querySelector(selector)?.textContent?.match(/\d+/)?.[0] ?? NaN)
    return {
      hand: field?.querySelectorAll('.hand-card-wrap').length ?? 0,
      deck: count('.deck-zone .resource-summary > strong'),
      trash: count('.discard-zone.resource-summary > strong'),
      stage: field?.querySelector('.stage-zone .resource-summary')?.getAttribute('title') ?? null,
      supports: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map((node) => ({
        rested: Boolean(node.querySelector('.card-face.is-rested')),
      })),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map((node) => ({
        name: node.querySelector('.card-face')?.getAttribute('title'),
      })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const art = (locator) => locator.evaluate((node) => {
  const image = node.querySelector('img')
  return { url: image?.getAttribute('src'), loaded: Boolean(image?.complete && image.naturalWidth > 0) }
})
const advancePanel = async (panel) => {
  for (let step = 0; step < 8; step += 1) {
    const primary = panel.locator('.effect-panel-primary-action:visible').last()
    if (!await visible(primary)) return
    const label = await primary.innerText()
    await clickReady(primary, `effect panel ${label}`)
    if (!label.includes('下一步')) return
  }
  throw new Error('Effect panel did not complete')
}
const skipAnimations = async (page) => {
  for (let step = 0; step < 16; step += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click({ timeout: 1000 }).catch(() => {})
    await page.waitForTimeout(100)
  }
}

const runStage = async (page, testCase, evidence) => {
  evidence.before = await state(page)
  const card = page.locator('.bottom-field .hand-card-wrap').filter({
    has: page.locator('.card-face[title="Catacombs of Lost Solidarity"]'),
  }).first()
  await card.waitFor({ state: 'visible' })
  evidence.art = await art(card.locator('.card-face').first())
  await clickReady(card.locator('.card-face').first(), 'select Catacombs')
  await clickReady(card.locator('.hand-card-action').filter({ hasText: '放置' }).first(), 'place Catacombs')
  const placement = page.locator('.stage-placement-modal:visible').first()
  await placement.waitFor({ state: 'visible' })
  await clickReady(placement.locator('.faint-payment-candidates button:not(.is-selected)').first(), 'place with 1P')
  await clickReady(placement.getByRole('button', { name: '支付並放置', exact: true }), 'confirm Catacombs placement')
  await waitForCommand(page, 'play-stage')
  evidence.placed = await state(page)
  assert.ok(evidence.placed.bottom.stage?.includes('Catacombs of Lost Solidarity'))
  await clickReady(page.locator('.bottom-field .stage-quick-action'), 'activate Catacombs')
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
  await panel.waitFor({ state: 'visible' })
  evidence.panelText = await panel.innerText()
  const payment = panel.locator('.effect-candidates-payment:visible button:not(.is-selected)').first()
  await clickReady(payment, 'Catacombs Activate 1P')
  await advancePanel(panel)
  await waitForCommand(page, 'begin-activate-stage')
  if (testCase.scenario === 'positive') {
    const next = page.locator('.effect-panel[role="alertdialog"]:visible').last()
    if (await visible(next)) await advancePanel(next)
    await waitForCommand(page, 'resolve-ability-effect')
  }
  await skipAnimations(page)
  evidence.after = await state(page)
  evidence.trace = await trace(page)
  assert.equal(evidence.after.bottom.stage, '場景區空')
  assert.equal(evidence.after.bottom.trash, evidence.before.bottom.trash + 1)
  assert.equal(evidence.after.bottom.supports.filter((entry) => entry.rested).length, 2)
  assert.equal(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect'),
    testCase.scenario === 'positive')
}

const runReplacement = async (page, testCase, evidence) => {
  evidence.before = await state(page)
  evidence.fixtureTrace = await trace(page)
  const card = page.locator('.bottom-field .hand-card-wrap').filter({
    has: page.locator('.card-face[title="Catacombs On Play Witness"]'),
  }).first()
  await card.waitFor({ state: 'visible' })
  await clickReady(card.locator('.card-face').first(), 'select On Play witness')
  await clickReady(card.locator('.hand-card-action').filter({ hasText: '登場' }).first(), 'deploy On Play witness')
  await page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator('.card-face[title="Catacombs On Play Witness"]'),
  }).waitFor({ state: 'visible' })
  await skipAnimations(page)
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
  if (testCase.scenario === 'negative') {
    assert.equal(await visible(panel), false)
    evidence.after = await state(page)
    evidence.trace = await trace(page)
    assert.equal(evidence.trace.some((entry) => entry.commandKind === 'begin-activate-skill'), false)
    assert.equal(evidence.after.bottom.trash, evidence.before.bottom.trash)
    return
  }
  await panel.waitFor({ state: 'visible' })
  evidence.panelText = await panel.innerText()
  assert.match(evidence.panelText, /替代|1.*能量|\{N\}/)
  await clickReady(panel.locator('.effect-candidates-payment:visible button:not(.is-selected)').first(),
    'pay replacement 1N')
  await advancePanel(panel)
  await waitForCommand(page, 'begin-activate-skill')
  const discard = page.locator('.opponent-hand-discard-modal:visible, .hand-discard-modal:visible').last()
  if (await visible(discard)) evidence.discardText = await discard.innerText()
  const confirm = page.getByRole('button', { name: '確認並繼續', exact: true }).first()
  await clickReady(confirm, 'confirm opponent hand discard')
  await waitForCommand(page, 'resolve-opponent-hand-discard')
  await skipAnimations(page)
  evidence.after = await state(page)
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-opponent-hand-discard'))
  assert.equal(evidence.after.top.trash, evidence.before.top.trash + 1)
}

const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
const results = []
try {
  for (const viewport of selectedViewports) {
    for (const testCase of selectedCases) {
      const page = await browser.newPage({ viewport })
      page.setDefaultTimeout(15000)
      const evidence = { id: `${testCase.kind}-${testCase.scenario}`, viewport, status: 'FAIL', errors: [] }
      page.on('pageerror', (error) => evidence.errors.push(error.message))
      if (imageUrl && existsSync(imagePath)) {
        await page.route(imageUrl, (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) }))
        evidence.officialArtDelivery = 'official CDN bytes served from local test artifact'
      }
      try {
        const url = new URL('/', baseUrl)
        url.searchParams.set('test-state', `bs11-083-${testCase.kind}:${testCase.scenario}`)
        url.searchParams.set('contract-card', testCase.kind === 'replacement'
          ? 'BS11-083,bs11-083-on-play-witness' : 'BS11-083')
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
        await page.locator('.game-shell').waitFor({ state: 'visible' })
        if (testCase.kind === 'stage') await runStage(page, testCase, evidence)
        else await runReplacement(page, testCase, evidence)
        if (evidence.art) {
          assert.equal(evidence.art.url, imageUrl)
          if (existsSync(imagePath)) assert.equal(evidence.art.loaded, true)
        }
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
const artifactPath = resolve(outputDir, `bs11-083-browser-${Date.now()}.json`)
const summary = { total: results.length, passed: results.filter((entry) => entry.status === 'PASS').length }
writeFileSync(artifactPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2) + '\n')
console.log(JSON.stringify({ artifactPath, summary }))
if (summary.passed !== summary.total) process.exitCode = 1
