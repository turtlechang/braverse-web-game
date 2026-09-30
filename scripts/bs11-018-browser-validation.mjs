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
const outputDir = resolve(root, 'test-results/bs11-018-browser')
mkdirSync(outputDir, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-dark-enchantress-war-bs11.en.json'), 'utf8'))
const byNumber = new Map(candidate.cards.map((record) => [record.cardNumber, record]))
const printed = {
  'BS11-018': { cost: 3, damage: 3 },
  'BS11-018@1': { cost: 3, damage: 3 },
}
const cases = Object.keys(printed).flatMap((cardNumber) =>
  ['positive', 'skip', 'underpay'].map((scenario) => ({ cardNumber, scenario })))
const requested = process.env.BS11_BROWSER_CASES?.split(',').map((value) => value.trim()).filter(Boolean)
const selectedCases = requested?.length ? cases.filter((entry) => requested.includes(`${entry.cardNumber}-${entry.scenario}`)) : cases
const widths = process.env.BS11_BROWSER_WIDTHS?.split(',').map(Number).filter(Number.isFinite)
const viewports = [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]
const selectedViewports = widths?.length ? viewports.filter((entry) => widths.includes(entry.width)) : viewports
if (!selectedCases.length || !selectedViewports.length) throw new Error('No BS11-018 attack case selected')

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
      deck: count('.deck-zone .resource-summary > strong'),
      trash: count('.discard-zone.resource-summary > strong'),
      supports: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map((node) => ({
        id: node.getAttribute('data-card-instance-id'),
        rested: Boolean(node.querySelector('.card-face.is-rested')),
        color: node.querySelector('.card-face')?.getAttribute('data-card-color') ?? null,
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
  const expected = printed[testCase.cardNumber]
  const payableCost = expected.cost
  evidence.before = await state(page)
  const source = page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator(`.card-face[title="${byNumber.get(testCase.cardNumber).name}"]`),
  }).first()
  await source.waitFor({ state: 'visible' })
  evidence.art = await art(source.locator('.card-face').first())
  assert.equal(evidence.before.bottom.supports.length, testCase.scenario === 'underpay' ? payableCost - 1 : payableCost)
  if (testCase.scenario === 'underpay') {
    const attack = source.locator('.card-face.is-attackable')
    assert.ok(!await visible(attack) || !await attack.first().isEnabled())
    evidence.after = await state(page)
    evidence.trace = await trace(page)
    assert.deepEqual(evidence.after, evidence.before)
    assert.equal(evidence.trace.some((entry) => entry.commandKind === 'declare-attack'), false)
    return
  }
  await clickReady(source.locator('.card-face.is-attackable'), `${testCase.cardNumber} attack`)
  await page.locator('[data-testid="attack-payment-panel"]:visible').waitFor({ state: 'visible' })
  evidence.paymentIds = []
  for (let index = 0; index < payableCost; index += 1) {
    const payment = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').first()
    const id = await payment.evaluate((node) => node.closest('.support-card-wrap')?.getAttribute('data-card-instance-id'))
    evidence.paymentIds.push(id)
    await clickReady(payment, `${testCase.cardNumber} payment ${index + 1}`)
  }
  const target = evidence.before.top.battle[0]
  await clickReady(page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${target.id}"] .card-face[aria-label^="選擇攻擊目標："]`),
    `${testCase.cardNumber} target`)
  await waitForCommand(page, 'declare-attack')
  await skipAnimations(page)
  if (testCase.scenario === 'positive') {
    const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
    await panel.waitFor({ state: 'visible' })
    await clickReady(panel.locator('.effect-candidates-target button').filter({ hasText: 'Raspberry Mousse Cookie' }).first(),
      `${testCase.cardNumber} faint ally`)
    await clickReady(panel.getByRole('button', { name: '確認發動', exact: true }).last(),
      `${testCase.cardNumber} faint confirmation`)
    await waitForCommand(page, 'resolve-attack-effect')
    await skipAnimations(page)
    const damagePanel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
    await damagePanel.waitFor({ state: 'visible' })
    await clickReady(damagePanel.locator('.effect-candidates-target button').filter({ hasText: target.id }).first(),
      `${testCase.cardNumber} damage target`)
    await clickReady(damagePanel.getByRole('button', { name: '確認發動', exact: true }).last(),
      `${testCase.cardNumber} damage confirmation`)
    await skipAnimations(page)
  } else {
    const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
    await panel.waitFor({ state: 'visible' })
    await clickReady(panel.getByRole('button', { name: '略過', exact: true }).last())
    await skipAnimations(page)
  }
  evidence.after = await state(page)
  evidence.trace = await trace(page)
  assert.equal(target.hp - evidence.after.top.battle.find((entry) => entry.id === target.id)?.hp,
    testCase.scenario === 'positive' ? 4 : expected.damage)
  assert.equal(evidence.after.bottom.supports.filter((entry) => entry.rested).length, payableCost)
  assert.deepEqual(evidence.paymentIds.sort(), evidence.after.bottom.supports.filter((entry) => entry.rested).map((entry) => entry.id).sort())
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'declare-attack'))
  assert.equal(evidence.after.bottom.battle.some((entry) => entry.id === 'bs11-018-faint-ally'), testCase.scenario !== 'positive')
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
      const imagePath = resolve(root, 'test-results/bs11-official-art', `${testCase.cardNumber.replace('@', '-at-')}.webp`)
      if (imageUrl && existsSync(imagePath)) {
        await page.route(imageUrl, (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) }))
        evidence.officialArtDelivery = 'official CDN bytes served from local test artifact'
      }
      try {
        const url = new URL('/', baseUrl)
        url.searchParams.set('test-state', `bs11-018-attack:${testCase.cardNumber}:${testCase.scenario}`)
        url.searchParams.set('contract-card', 'BS11-018')
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
        await page.locator('.game-shell').waitFor({ state: 'visible' })
        await runCase(page, testCase, evidence)
        assert.equal(evidence.art.url, imageUrl)
        if (existsSync(imagePath)) {
          await page.waitForFunction((url) => [...document.images].some((img) => img.getAttribute('src') === url && img.complete && img.naturalWidth > 0), imageUrl)
          evidence.art.loaded = true
        }
        assert.deepEqual(evidence.errors, [])
        evidence.status = 'PASS'
      } catch (error) {
        evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
        evidence.trace ??= await trace(page).catch(() => [])
        evidence.debug = await page.evaluate(() => ({
          dialogs: [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')]
            .filter((node) => node.getBoundingClientRect().width > 0).map((node) => node.textContent?.trim().slice(0, 700)),
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
const artifactPath = resolve(outputDir, `bs11-018-browser-${Date.now()}.json`)
const summary = { total: results.length, passed: results.filter((entry) => entry.status === 'PASS').length }
writeFileSync(artifactPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2) + '\n')
console.log(JSON.stringify({ artifactPath, summary }))
if (summary.passed !== summary.total) process.exitCode = 1
