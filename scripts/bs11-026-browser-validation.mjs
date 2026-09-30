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
const outputDir = resolve(root, 'test-results/bs11-026-browser')
mkdirSync(outputDir, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-dark-enchantress-war-bs11.en.json'), 'utf8'))
const byNumber = new Map(candidate.cards.map((record) => [record.cardNumber, record]))
const cost = { 'BS11-026': 1 }
const cases = Object.keys(cost).flatMap((cardNumber) =>
  ['positive', 'negative'].map((scenario) => ({ cardNumber, scenario })))
const requested = process.env.BS11_BROWSER_CASES?.split(',').map((value) => value.trim()).filter(Boolean)
const selectedCases = requested?.length ? cases.filter((entry) => requested.includes(`${entry.cardNumber}-${entry.scenario}`)) : cases
const widths = process.env.BS11_BROWSER_WIDTHS?.split(',').map(Number).filter(Number.isFinite)
const viewports = [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]
const selectedViewports = widths?.length ? viewports.filter((entry) => widths.includes(entry.width)) : viewports
if (!selectedCases.length || !selectedViewports.length) throw new Error('No BS11-026 skill case selected')

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
  const skill = source.locator('.skill-action').filter({ hasText: '啟動技能' }).first()
  if (testCase.scenario === 'negative') {
    assert.ok(!await visible(skill) || !await skill.isEnabled(), 'unpaid skill must not be offered')
    evidence.after = await state(page)
    evidence.trace = await trace(page)
    assert.deepEqual(evidence.after, evidence.before)
    assert.equal(evidence.trace.some((entry) => entry.commandKind === 'begin-activate-skill'), false)
    return
  }
  await clickReady(skill, `${testCase.cardNumber} Activate`)
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
  await panel.waitFor({ state: 'visible' })
  evidence.panelText = await panel.innerText()
  evidence.paymentIds = []
  let targetChosen = false
  let discardChosen = false
  evidence.actions = []
  for (let step = 0; step < 14; step += 1) {
    if (!await visible(panel)) {
      await skipAnimations(page)
      if (!await visible(panel)) {
        evidence.actions.push(`${step}:panel-hidden`)
        break
      }
    }
    const payment = panel.locator('.effect-candidates-payment:visible button:not(.is-selected)').first()
    if (await visible(payment) && evidence.paymentIds.length < cost[testCase.cardNumber]) {
      const id = await payment.evaluate((node) => node.closest('button')?.querySelector('.card-face')?.getAttribute('title') ?? node.textContent)
      evidence.paymentIds.push(id)
      evidence.actions.push(`${step}:payment`)
      await clickReady(payment, `${testCase.cardNumber} payment ${evidence.paymentIds.length}`)
      continue
    }
    const discard = panel.locator('.effect-candidates-discard-hand:visible button:not(.is-selected)').first()
    if (!discardChosen && await visible(discard)) {
      await clickReady(discard, 'Wizard FLIP Cookie discard cost')
      discardChosen = true
      evidence.actions.push(`${step}:discard`)
      continue
    }
    const target = panel.locator('.effect-candidates-target:visible button:not(.is-selected)').first()
    if (!targetChosen && await visible(target)) {
      await clickReady(target, `${testCase.cardNumber} opponent target`)
      targetChosen = true
      evidence.actions.push(`${step}:target`)
      continue
    }
    const primary = panel.locator('.effect-panel-primary-action:visible').last()
    if (!await visible(primary)) {
      evidence.actions.push(`${step}:primary-hidden`)
      break
    }
    evidence.actions.push(`${step}:advance`)
    await clickReady(primary, `${testCase.cardNumber} advance effect`)
    await page.waitForTimeout(250)
  }
  await skipAnimations(page)
  evidence.after = await state(page)
  evidence.trace = await trace(page)
  assert.equal(evidence.paymentIds.length, cost[testCase.cardNumber])
  assert.equal(evidence.after.bottom.supports.filter((entry) => entry.rested).length, cost[testCase.cardNumber])
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'begin-activate-skill'))
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect'))
  assert.equal(evidence.before.top.battle[0].hp - evidence.after.top.battle[0].hp, 1)
  assert.equal(evidence.before.top.battle[1].hp - evidence.after.top.battle[1].hp, 0)
  assert.equal(evidence.after.bottom.hand, evidence.before.bottom.hand - 1)
  assert.equal(evidence.after.bottom.trash, evidence.before.bottom.trash + 1)
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
        url.searchParams.set('test-state', `bs11-026-skill:${testCase.scenario}`)
        url.searchParams.set('contract-card', testCase.cardNumber)
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
        await page.locator('.game-shell').waitFor({ state: 'visible' })
        await runCase(page, testCase, evidence)
        assert.equal(evidence.art.url, imageUrl)
        if (existsSync(imagePath)) {
          await page.waitForFunction((imageUrl) => [...document.images].some((img) => img.getAttribute('src') === imageUrl && img.complete && img.naturalWidth > 0), imageUrl)
          evidence.art.loaded = true
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
const artifactPath = resolve(outputDir, `bs11-026-browser-${Date.now()}.json`)
const summary = { total: results.length, passed: results.filter((entry) => entry.status === 'PASS').length }
writeFileSync(artifactPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2) + '\n')
console.log(JSON.stringify({ artifactPath, summary }))
if (summary.passed !== summary.total) process.exitCode = 1
