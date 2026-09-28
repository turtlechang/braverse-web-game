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
const baseUrl = process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'
const outputDir = resolve(root, 'test-results/bs11-069-browser')
mkdirSync(outputDir, { recursive: true })
const cards = {
  'BS11-069': '1iHpo7ox7ETzaBOpEbXyGg.webp',
  'BS11-069@1': 'ts3xyQU5a5HjW-NqBF3y5Q.webp',
}
const executablePath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
const cases = Object.keys(cards).flatMap((cardNumber) => ['positive', 'negative'].map((scenario) => ({
  id: `${cardNumber}-${scenario}`, cardNumber, scenario,
})))
const requested = process.env.BS11_BROWSER_CASES?.split(',').map((part) => part.trim()).filter(Boolean)
const selectedCases = requested?.length ? cases.filter((testCase) => requested.includes(testCase.id)) : cases
if (!selectedCases.length || requested?.some((id) => !cases.some((testCase) => testCase.id === id))) {
  throw new Error('Unknown or empty BS11_BROWSER_CASES selection')
}
const widths = process.env.BS11_BROWSER_WIDTHS?.split(',').map(Number).filter(Number.isFinite)
const viewports = [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]
const selectedViewports = widths?.length ? viewports.filter((viewport) => widths.includes(viewport.width)) : viewports
if (!selectedViewports.length) throw new Error('Unknown BS11_BROWSER_WIDTHS selection')
const wait = (ms) => new Promise((done) => setTimeout(done, ms))
const visible = async (locator) => await locator.count() > 0 && await locator.first().isVisible().catch(() => false)
const trace = (page) => page.evaluate(() => (window.__braverseContractTrace ?? []).map((entry) => ({
  commandKind: entry.commandKind,
  steps: Array.isArray(entry.steps) ? entry.steps.map(String) : [],
})))
const waitForCommand = (page, kind) => page.waitForFunction(
  (commandKind) => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === commandKind), kind,
)
const readState = (page) => page.evaluate(() => {
  const side = (name) => {
    const field = document.querySelector(`.${name}-field`)
    const count = (selector) => Number(field?.querySelector(selector)?.textContent?.match(/\d+/)?.[0] ?? NaN)
    return {
      handCount: field?.querySelectorAll('.hand-card-wrap').length ?? 0,
      deckCount: count('.deck-zone .resource-summary > strong'),
      discardCount: count('.discard-zone.resource-summary > strong'),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map((node) => ({
        id: node.getAttribute('data-card-instance-id'),
        name: node.querySelector('.card-face')?.getAttribute('title'),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
      })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const clickReady = async (locator, label) => {
  await locator.waitFor({ state: 'visible' })
  assert.equal(await locator.isEnabled(), true, `${label} must be enabled`)
  await locator.click()
}
const skipAnimations = async (page) => {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click()
    await wait(100)
  }
}
const art = (locator) => locator.evaluate((node) => {
  const image = node.querySelector('img')
  return { url: image?.getAttribute('src') ?? null, loaded: Boolean(image?.complete && image.naturalWidth > 0) }
})

const runCase = async (page, testCase, evidence) => {
  evidence.before = await readState(page)
  const source = page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator('.card-face[title="Sea Fairy Cookie"]'),
  }).first()
  await source.waitFor({ state: 'visible' })
  evidence.art = await art(source.locator('.card-face').first())
  const chooser = page.locator('.attack-response-modal:visible').first()
  const option = chooser.locator('.attack-response-skill-option[data-card-id="BS11-069"]')
  if (testCase.scenario === 'negative' && !await visible(option)) {
    evidence.response = 'hand count above five blocked response option'
    evidence.trace = await trace(page)
    assert.equal(evidence.trace.some((entry) => entry.commandKind === 'play-attack-response'), false)
    return
  }
  await chooser.waitFor({ state: 'visible' })
  await clickReady(option, 'Sea Fairy response')
  const skill = page.locator('.attack-response-skill-modal:visible').first()
  await skill.waitFor({ state: 'visible' })
  evidence.skillText = await skill.innerText()
  const confirm = skill.getByRole('button', { name: '支付代價並發動', exact: true })
  if (testCase.scenario === 'negative' && !await confirm.isEnabled()) {
    evidence.response = 'six-card hand blocked response confirmation'
    evidence.trace = await trace(page)
    assert.equal(evidence.trace.some((entry) => entry.commandKind === 'play-attack-response'), false)
    return
  }
  await clickReady(confirm, 'confirm Sea Fairy response')
  await waitForCommand(page, 'play-attack-response')
  await skipAnimations(page)
  const effect = page.locator('.effect-panel[role="alertdialog"]:visible').last()
  if (await visible(effect)) {
    await clickReady(effect.locator('.effect-panel-primary-action').last(), 'resolve Sea Fairy response effect')
    await waitForCommand(page, 'resolve-ability-effect')
  }
  const draw = page.locator('.draw-up-to-modal:visible').first()
  await draw.waitFor({ state: 'visible' })
  await clickReady(draw.locator('.draw-up-to-option').nth(2), 'draw two Sea Fairy cards')
  await clickReady(draw.locator('.draw-up-to-actions button').last(), 'confirm Sea Fairy draw')
  await waitForCommand(page, 'resolve-draw-up-to')
  const placement = page.locator('.hand-discard-modal:visible').first()
  await placement.waitFor({ state: 'visible' })
  assert.match(await placement.innerText(), /放置手牌到牌庫頂/)
  const chosen = placement.locator('.hand-discard-options button').first()
  const privateName = await chosen.evaluate((node) =>
    node.querySelector('.card-face')?.getAttribute('title') ??
    node.querySelector('.card-fallback strong')?.textContent?.trim() ??
    node.querySelector(':scope > span')?.textContent?.trim() ?? null)
  assert.ok(privateName)
  await clickReady(chosen, 'place one Sea Fairy hand card on deck top')
  await clickReady(placement.locator('.hand-discard-actions button').last(), 'confirm Sea Fairy deck top')
  await waitForCommand(page, 'resolve-opponent-hand-discard')
  await skipAnimations(page)
  evidence.after = await readState(page)
  evidence.trace = await trace(page)
  assert.equal(JSON.stringify(evidence.trace).includes(privateName), false, 'face-down hand placement must not reveal identity in public trace')
  evidence.privateTraceScan = 'passed'
  assert.equal(evidence.after.bottom.handCount, evidence.before.bottom.handCount + 1)
  assert.equal(evidence.after.bottom.deckCount, evidence.before.bottom.deckCount - 1)
}

const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
const results = []
try {
  for (const viewport of selectedViewports) {
    for (const testCase of selectedCases) {
      const page = await browser.newPage({ viewport })
      page.setDefaultTimeout(15000)
      const evidence = { id: testCase.id, viewport, status: 'FAIL', errors: [] }
      page.on('pageerror', (error) => evidence.errors.push(error.message))
      const imageUrl = `https://cookierunbraverse.com/data/en_storage/${cards[testCase.cardNumber]}`
      const imagePath = resolve(root, 'test-results/bs11-official-art', `${testCase.cardNumber.replace('@', '-at-')}.webp`)
      const localArt = existsSync(imagePath)
      if (localArt) {
        await page.route(imageUrl, (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) }))
        evidence.officialArtDelivery = 'official CDN bytes served from local test artifact'
      }
      try {
        const url = new URL('/', baseUrl)
        url.searchParams.set('test-state', `bs11-069-response:${testCase.cardNumber}:${testCase.scenario}`)
        url.searchParams.set('contract-card', 'BS11-069')
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
        await page.locator('.game-shell').waitFor({ state: 'visible' })
        await runCase(page, testCase, evidence)
        assert.equal(evidence.art.url, imageUrl)
        if (localArt) assert.equal(evidence.art.loaded, true)
        else evidence.officialArtDelivery = evidence.art.loaded ? 'live CDN image loaded' : 'official URL only; image load unverified'
        assert.deepEqual(evidence.errors, [])
        evidence.status = 'PASS'
      } catch (error) {
        evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
        if (testCase.scenario === 'negative') evidence.trace ??= await trace(page).catch(() => [])
        evidence.debug = await page.evaluate(() => ({
          modals: [...document.querySelectorAll('.attack-response-modal, .attack-response-skill-modal, .draw-up-to-modal, .hand-discard-modal, .effect-panel')]
            .filter((node) => node.getBoundingClientRect().width > 0).map((node) => node.className),
          buttons: [...document.querySelectorAll('button')]
            .filter((node) => node.getBoundingClientRect().width > 0 && !node.disabled)
            .map((node) => node.textContent?.trim()).filter(Boolean).slice(0, 25),
        })).catch(() => null)
      } finally {
        await page.close()
      }
      results.push(evidence)
      console.log(`${evidence.status} ${testCase.id} ${viewport.width}x${viewport.height}${evidence.error ? ': ' + evidence.error.split('\n')[0] : ''}`)
    }
  }
} finally {
  await browser.close()
}
const artifactPath = resolve(outputDir, `bs11-069-browser-${Date.now()}.json`)
const summary = { total: results.length, passed: results.filter((entry) => entry.status === 'PASS').length }
writeFileSync(artifactPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2) + '\n')
console.log(JSON.stringify({ artifactPath, summary }))
if (summary.passed !== summary.total) process.exitCode = 1
