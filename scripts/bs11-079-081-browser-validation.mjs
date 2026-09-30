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
const outputDir = resolve(root, 'test-results/bs11-079-081-browser')
mkdirSync(outputDir, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-dark-enchantress-war-bs11.en.json'), 'utf8'))
const byNumber = new Map(candidate.cards.map((record) => [record.cardNumber, record]))
const cases = ['BS11-079', 'BS11-080', 'BS11-081'].flatMap((cardNumber) =>
  ['positive', 'negative'].map((scenario) => ({ cardNumber, scenario })))
const requested = process.env.BS11_BROWSER_CASES?.split(',').map((value) => value.trim()).filter(Boolean)
const selectedCases = requested?.length ? cases.filter((entry) => requested.includes(`${entry.cardNumber}-${entry.scenario}`)) : cases
if (!selectedCases.length) throw new Error('No BS11-079～081 cases selected')
const widths = process.env.BS11_BROWSER_WIDTHS?.split(',').map(Number).filter(Number.isFinite)
const viewports = [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]
const selectedViewports = widths?.length ? viewports.filter((entry) => widths.includes(entry.width)) : viewports
if (!selectedViewports.length) throw new Error('No viewport selected')

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
const skipAnimations = async (page) => {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click()
    await page.waitForTimeout(100)
  }
}
const state = (page) => page.evaluate(() => {
  const side = (name) => {
    const field = document.querySelector(`.${name}-field`)
    const count = (selector) => Number(field?.querySelector(selector)?.textContent?.match(/\d+/)?.[0] ?? NaN)
    return {
      hand: field?.querySelectorAll('.hand-card-wrap').length ?? 0,
      deck: count('.deck-zone .resource-summary > strong'),
      trash: count('.discard-zone.resource-summary > strong'),
      supports: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map((node) => ({
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
const advancePanel = async (panel) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const primary = panel.locator('.effect-panel-primary-action:visible').last()
    if (!await visible(primary)) return
    const label = await primary.innerText()
    await clickReady(primary, `advance effect: ${label}`)
    if (!label.includes('下一步')) return
  }
  throw new Error('Effect panel did not complete within eight steps')
}

const run079 = async (page, testCase, evidence) => {
  evidence.before = await state(page)
  const card = page.locator('.bottom-field .hand-card-wrap').filter({
    has: page.locator('.card-face[title="Espresso Cookie"]'),
  }).first()
  await card.waitFor({ state: 'visible' })
  evidence.art = await art(card.locator('.card-face').first())
  await clickReady(card.locator('.card-face').first(), 'select Espresso Cookie')
  await clickReady(card.locator('.hand-card-action').filter({ hasText: '登場' }).first(), 'deploy Espresso Cookie')
  await waitForCommand(page, 'deploy-cookie')
  await skipAnimations(page)
  if (testCase.scenario === 'negative') {
    await waitForCommand(page, 'skip-on-play')
    evidence.after = await state(page)
    evidence.trace = await trace(page)
    assert.equal(evidence.after.bottom.battle.some((entry) => entry.name === 'Espresso Cookie'), true)
    assert.equal(evidence.after.bottom.battle.some((entry) => entry.name === 'Chocolate Bark Cookie'), false)
    assert.equal(evidence.after.bottom.trash, evidence.before.bottom.trash)
    return
  }
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
  await panel.waitFor({ state: 'visible' })
  evidence.panelText = await panel.innerText()
  for (let index = 0; index < 2; index += 1) {
    await clickReady(panel.locator('.effect-candidates-discard-hand:visible button:not(.is-selected)').first(),
      `Espresso discard cost ${index + 1}`)
  }
  await clickReady(panel.locator('.effect-panel-primary-action:visible').last(), 'advance Espresso cost')
  const trashTarget = panel.locator('.effect-candidates-target:visible button').filter({ hasText: 'Chocolate Bark Cookie' }).first()
  await clickReady(trashTarget, 'select Chocolate Bark Cookie from trash')
  await advancePanel(panel)
  await waitForCommand(page, 'resolve-ability-effect')
  await skipAnimations(page)
  const trashChoice = page.locator('.trash-to-battle-modal:visible, .effect-panel[role="alertdialog"]:visible').last()
  if (await visible(trashChoice)) evidence.trashChoice = await trashChoice.innerText()
  evidence.after = await state(page)
  evidence.trace = await trace(page)
  assert.equal(evidence.after.bottom.battle.some((entry) => entry.name === 'Espresso Cookie'), true)
  assert.equal(evidence.after.bottom.battle.some((entry) => entry.name === 'Chocolate Bark Cookie'), true)
  assert.equal(evidence.after.bottom.hand, evidence.before.bottom.hand - 3)
  assert.equal(evidence.after.bottom.trash, evidence.before.bottom.trash + 2 - 1)
}

const runItem = async (page, testCase, evidence) => {
  evidence.before = await state(page)
  const name = testCase.cardNumber === 'BS11-080' ? 'Banner of the Solitary Oath' : "Dream Traveler's Hourglass"
  const card = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator(`.card-face[title="${name}"]`) }).first()
  await card.waitFor({ state: 'visible' })
  evidence.art = await art(card.locator('.card-face').first())
  await clickReady(card.locator('.card-face').first(), `select ${name}`)
  const use = card.locator('.hand-card-action').filter({ hasText: '使用' }).first()
  if (testCase.scenario === 'negative' &&
      (!await visible(use) || !await use.isEnabled())) {
    evidence.after = await state(page)
    evidence.trace = await trace(page)
    assert.deepEqual(evidence.after, evidence.before)
    return
  }
  await clickReady(use, `use ${name}`)
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
  await panel.waitFor({ state: 'visible' })
  evidence.panelText = await panel.innerText()
  const payments = panel.locator('.effect-candidates-payment:visible button:not(.is-selected)')
  if (testCase.cardNumber === 'BS11-081' && testCase.scenario === 'negative') {
    assert.equal(await payments.count(), 1)
    await clickReady(payments.first(), 'first Hourglass payment')
    assert.equal(await panel.locator('.effect-panel-primary-action').last().isEnabled(), false)
    evidence.after = await state(page)
    evidence.trace = await trace(page)
    assert.deepEqual(evidence.after, evidence.before)
    return
  }
  for (let index = 0; index < 2; index += 1) {
    await clickReady(panel.locator('.effect-candidates-payment:visible button:not(.is-selected)').first(),
      `${name} purple payment ${index + 1}`)
  }
  if (testCase.cardNumber === 'BS11-080' && testCase.scenario === 'positive') {
    await clickReady(panel.locator('.effect-panel-primary-action:visible').last(), 'resolve Banner draw')
    const target = panel.locator('.effect-candidates-target:visible button').filter({ hasText: 'opp-lv1' }).first()
    await clickReady(target, 'select Banner damage target')
  }
  await advancePanel(panel)
  await waitForCommand(page, 'resolve-ability-effect')
  await skipAnimations(page)
  evidence.after = await state(page)
  evidence.trace = await trace(page)
  assert.equal(evidence.after.bottom.supports.filter((entry) => entry.rested).length, 2)
  if (testCase.cardNumber === 'BS11-080') {
    assert.equal(evidence.after.bottom.hand, evidence.before.bottom.hand + (testCase.scenario === 'positive' ? 0 : -1))
    assert.equal(evidence.before.top.battle[0].hp - evidence.after.top.battle[0].hp,
      testCase.scenario === 'positive' ? 2 : 0)
  } else {
    assert.equal(evidence.after.bottom.trash, 0)
    assert.equal(evidence.after.top.trash, 0)
    assert.equal(evidence.after.bottom.deck, evidence.before.bottom.deck + 3)
    assert.equal(evidence.after.top.deck, evidence.before.top.deck + 2)
  }
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
      const localArt = imageUrl && existsSync(imagePath)
      if (localArt) {
        await page.route(imageUrl, (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) }))
        evidence.officialArtDelivery = 'official CDN bytes served from local test artifact'
      }
      try {
        const url = new URL('/', baseUrl)
        url.searchParams.set('test-state', testCase.cardNumber === 'BS11-079'
          ? `bs11-079-on-play:${testCase.scenario}`
          : testCase.cardNumber === 'BS11-080'
            ? `bs11-080-item:${testCase.scenario}`
            : `bs11-081-item:${testCase.scenario}`)
        url.searchParams.set('contract-card', testCase.cardNumber)
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
        await page.locator('.game-shell').waitFor({ state: 'visible' })
        if (testCase.cardNumber === 'BS11-079') await run079(page, testCase, evidence)
        else await runItem(page, testCase, evidence)
        assert.equal(evidence.art.url, imageUrl)
        if (localArt) assert.equal(evidence.art.loaded, true)
        assert.deepEqual(evidence.errors, [])
        evidence.status = 'PASS'
      } catch (error) {
        evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
        evidence.trace ??= await trace(page).catch(() => [])
        evidence.debug = await page.evaluate(() => ({
          modals: [...document.querySelectorAll('.effect-panel, .trash-to-battle-modal')]
            .filter((node) => node.getBoundingClientRect().width > 0).map((node) => node.textContent?.trim().slice(0, 550)),
          message: document.querySelector('.status-toast')?.textContent,
          buttons: [...document.querySelectorAll('button')].filter((node) => node.getBoundingClientRect().width > 0)
            .map((node) => node.textContent?.trim()).filter(Boolean).slice(-20),
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
const artifactPath = resolve(outputDir, `bs11-079-081-browser-${Date.now()}.json`)
const summary = { total: results.length, passed: results.filter((entry) => entry.status === 'PASS').length }
writeFileSync(artifactPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2) + '\n')
console.log(JSON.stringify({ artifactPath, summary }))
if (summary.passed !== summary.total) process.exitCode = 1
