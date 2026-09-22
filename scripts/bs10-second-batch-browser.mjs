import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, 'test-results/bs10-second-batch-browser-007')
mkdirSync(output, { recursive: true })
const baseUrl = process.env.BRAVERSE_BS10_BASE_URL ?? 'http://127.0.0.1:4190'
const executablePath = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find(existsSync)
const viewports = [
  { width: 1907, height: 863 },
  { width: 1164, height: 777 },
]
const selectedViewports = process.env.BRAVERSE_BS10_VIEWPORTS
  ? viewports.filter((viewport) => process.env.BRAVERSE_BS10_VIEWPORTS.split(',').includes(String(viewport.width)))
  : viewports
assert.ok(selectedViewports.length > 0, 'at least one viewport must be selected')
const only = process.env.BRAVERSE_BS10_ONLY ?? 'all'
const candidateRecords = JSON.parse(readFileSync(resolve(root, 'data/cards/official-paradise-of-passion-and-sloth-catacombs-of-silence-bs10.en.json'), 'utf8')).cards
const jungleberry = candidateRecords.find((record) => record.cardNumber === 'BS10-007')
assert.ok(jungleberry?.imageUrl, 'BS10-007 candidate image record is required')
const expectedImagePath = new URL(jungleberry.imageUrl).pathname

const sourceCard = (page) => page.locator('.bottom-field .combat-card-wrap').filter({
  has: page.locator('.card-face[title="Jungleberry Cookie"]'),
}).first()
const panel = (page) => page.locator('.effect-panel:visible').first()
const publicState = async (page) => page.evaluate(() => {
  const readField = (side) => {
    const root = document.querySelector(`.${side}-field`)
    if (!root) return null
    const text = (selector) => root.querySelector(selector)?.textContent?.trim() ?? null
    return {
      hand: text('.row-stat-hand .row-stat-value'),
      deck: text('.deck-zone .resource-summary > strong'),
      trash: text('button.discard-zone.resource-summary > strong'),
      support: [...root.querySelectorAll('.support-card-wrap .card-face')].map((card) => ({
        title: card.getAttribute('title'),
        rested: card.classList.contains('is-rested'),
      })),
      battle: [...root.querySelectorAll('.combat-card-wrap')].map((entry) => ({
        id: entry.getAttribute('data-card-instance-id'),
        name: entry.querySelector('.card-face')?.getAttribute('title'),
        hp: entry.querySelector('.badge-hp')?.textContent?.trim() ?? null,
        rested: entry.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
      })),
    }
  }
  return {
    bottom: readField('bottom'),
    top: readField('top'),
    phase: document.querySelector('.turn-indicator strong')?.textContent?.trim() ?? null,
  }
})
const trace = async (page) => page.evaluate(() => Array.isArray(window.__braverseContractTrace) ? window.__braverseContractTrace : [])
const assertTraceSequence = (entries, kinds) => {
  let cursor = -1
  for (const kind of kinds) {
    const index = entries.findIndex((entry, position) => position > cursor && entry.commandKind === kind)
    assert.notEqual(index, -1, `trace must contain ${kinds.join(' -> ')}`)
    cursor = index
  }
}
const waitForVisualSettled = async (page) => page.waitForFunction(() => {
  const visible = (selector) => [...document.querySelectorAll(selector)].some((element) => {
    const style = window.getComputedStyle(element)
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0
  })
  return document.querySelector('.match-animation-layer')?.getAttribute('data-playing') !== 'true' &&
    !visible('.effect-panel, .draw-up-to-modal, .decision-modal, .battle-response-modal')
})
const waitForImage = async (page) => {
  const image = page.locator(`img[src*="${expectedImagePath.split('/').pop()}"]`).first()
  await image.waitFor({ state: 'visible' })
  let loadError = null
  try {
    await page.waitForFunction((path) => [...document.images].some((candidate) => {
      return new URL(candidate.src, window.location.href).pathname === path && candidate.complete && candidate.naturalWidth > 0
    }), expectedImagePath, { timeout: 5000 })
  } catch (error) {
    loadError = error.message
  }
  const details = await image.evaluate((node) => ({
    src: node.getAttribute('src'),
    complete: node.complete,
    naturalWidth: node.naturalWidth,
  }))
  assert.equal(details.src && new URL(details.src, 'http://127.0.0.1').pathname, expectedImagePath)
  return { ...details, loadError }
}

const runPositive = async (page, evidence, drawCount) => {
  const source = sourceCard(page)
  await source.waitFor()
  assert.equal(await source.locator('.skill-action').isEnabled(), true)
  const before = evidence.before
  await source.locator('.skill-action').click()
  const effect = panel(page)
  await effect.waitFor()
  assert.match(await effect.innerText(), /Jungleberry Cookie/)
  evidence.effectScreenshot = resolve(output, `${evidence.label}-${evidence.viewport.width}-effect.png`)
  await page.screenshot({ path: evidence.effectScreenshot, fullPage: true })
  await effect.locator('.effect-panel-primary-action').click()
  const draw = page.locator('.draw-up-to-modal')
  await draw.waitFor()
  assert.match(await draw.innerText(), /Jungleberry Cookie/)
  const option = draw.locator('.draw-up-to-option').nth(drawCount)
  await option.click()
  assert.equal(await option.evaluate((node) => (
    node.classList.contains('is-selected') ||
    node.getAttribute('aria-pressed') === 'true' ||
    node.getAttribute('aria-checked') === 'true'
  )), true, `draw ${drawCount} option must remain selected before confirm`)
  evidence.drawSelectionScreenshot = resolve(output, `${evidence.label}-${evidence.viewport.width}-draw${drawCount}-selected.png`)
  await page.screenshot({ path: evidence.drawSelectionScreenshot, fullPage: true })
  await draw.locator('.draw-up-to-actions button').click()
  await waitForVisualSettled(page)
  await page.waitForFunction(() => !(document.querySelector('.draw-up-to-modal')?.getClientRects().length))
  const after = await publicState(page)
  evidence.afterSettlement = after
  assert.equal(Number(after.bottom.hand.split('/')[0]) - Number(before.bottom.hand.split('/')[0]), drawCount)
  assert.equal(Number(before.bottom.deck.split('/')[0]) - Number(after.bottom.deck.split('/')[0]), drawCount)
  assert.equal(Number(after.bottom.trash.split('/')[0]), Number(before.bottom.trash.split('/')[0]))
  assert.deepEqual(after.bottom.support, before.bottom.support)
  assert.deepEqual(after.bottom.battle, before.bottom.battle)
  assert.deepEqual(after.top.battle, before.top.battle)
  evidence.afterSettlementScreenshot = resolve(output, `${evidence.label}-${evidence.viewport.width}-after-settlement.png`)
  evidence.imageAfterSettlement = await waitForImage(page)
  await page.screenshot({ path: evidence.afterSettlementScreenshot, fullPage: true })
  assert.equal(await source.locator('.skill-action').isEnabled(), false, 'once per turn')
  const entries = await trace(page)
  assertTraceSequence(entries, ['begin-activate-skill', 'resolve-ability-effect', 'resolve-draw-up-to'])
  evidence.drawCount = drawCount
  evidence.traceKinds = entries.map((entry) => entry.commandKind)
  await page.locator('.next-phase-button').click()
  await page.waitForFunction((previous) => document.querySelector('.turn-indicator strong')?.textContent?.trim() !== previous, before.phase)
  evidence.continuation = { afterPhase: (await publicState(page)).phase }
}

const runNegative = async (page, evidence) => {
  const source = sourceCard(page)
  await source.waitFor()
  assert.equal(await source.locator('.skill-action').isEnabled(), false)
  const negativeReason = await source.locator('.skill-unavailable-reason').innerText()
  evidence.negativeReason = negativeReason
  assert.equal(negativeReason, '本回合對手餅乾昏厥數尚未達到 1 張。')
  assert.equal(evidence.before.bottom.battle.find((entry) => entry.name === 'Jungleberry Cookie')?.rested, false)
  assert.ok(evidence.before.bottom.support.filter((support) => !support.rested).length >= 3)
  assert.equal((await trace(page)).some((entry) => entry.commandKind === 'begin-activate-skill'), false)
  assert.deepEqual(await publicState(page), evidence.before)
  evidence.traceKinds = (await trace(page)).map((entry) => entry.commandKind)
  await page.locator('.next-phase-button').click()
  await page.waitForFunction((previous) => document.querySelector('.turn-indicator strong')?.textContent?.trim() !== previous, evidence.before.phase)
  evidence.continuation = { afterPhase: (await publicState(page)).phase }
}

const runCase = async (browser, viewport, label, route, action) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(15000)
  const evidence = { card: 'BS10-007', label, route, viewport, status: 'FAIL', errors: [], knownWarnings: [], requests: [] }
  page.on('pageerror', (error) => evidence.errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const location = message.location().url
    if (message.text().includes('Failed to load resource') && location.includes('favicon.ico')) {
      evidence.knownWarnings.push({ kind: 'console', text: message.text(), url: location })
      return
    }
    evidence.errors.push(`console: ${message.text()} @ ${location}`)
  })
  page.on('response', (response) => {
    if (response.status() < 400) return
    const item = { status: response.status(), url: response.url(), type: response.request().resourceType() }
    if (response.url().includes('favicon.ico')) evidence.knownWarnings.push(item)
    else evidence.errors.push(`${response.status()} response: ${response.url()}`)
  })
  page.on('requestfailed', (request) => {
    const item = { url: request.url(), type: request.resourceType(), reason: request.failure()?.errorText ?? 'unknown' }
    if (request.url().includes('favicon.ico')) evidence.knownWarnings.push(item)
    else evidence.errors.push(`request: ${item.url} ${item.reason}`)
  })
  try {
    await page.goto(`${baseUrl}/?test-state=${route}&contract-card=BS10-007,BS6-017,BS6-047`, { waitUntil: 'domcontentloaded' })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    evidence.image = await waitForImage(page)
    evidence.before = await publicState(page)
    evidence.beforeScreenshot = resolve(output, `${label}-${viewport.width}-before.png`)
    await page.screenshot({ path: evidence.beforeScreenshot, fullPage: true })
    await action(page, evidence)
    evidence.after = await publicState(page)
    evidence.trace = await trace(page)
    assert.deepEqual(evidence.errors, [])
    assert.equal(evidence.image.complete, true, `official image request did not complete: ${evidence.image.src}`)
    assert.ok(evidence.image.naturalWidth > 0, `official image did not decode: ${evidence.image.src}`)
    evidence.status = 'PASS'
  } catch (error) {
    evidence.error = error.stack ?? String(error)
    evidence.body = await page.locator('body').innerText().catch(() => '')
    evidence.after = await publicState(page).catch(() => null)
    evidence.trace = await trace(page).catch(() => [])
  } finally {
    evidence.screenshot = resolve(output, `${label}-${viewport.width}-${evidence.status}.png`)
    await page.screenshot({ path: evidence.screenshot, fullPage: true }).catch(() => {})
    await page.close()
  }
  console.log(`BS10-007 ${label} ${viewport.width}x${viewport.height}: ${evidence.status}${evidence.error ? ` ${evidence.error.split('\n')[0]}` : ''}`)
  return evidence
}

const main = async () => {
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
  const results = []
  let failed = false
  try {
    outer: for (const viewport of selectedViewports) {
      const cases = []
      if (only === 'all' || only === 'draw0') cases.push(['007-positive-draw0', 'card:BS10-007', (page, evidence) => runPositive(page, evidence, 0)])
      if (only === 'all' || only === 'draw1') cases.push(['007-positive-draw1', 'card:BS10-007', (page, evidence) => runPositive(page, evidence, 1)])
      if (only === 'all' || only === 'negative') cases.push(['007-negative-conditionfalse', 'card-negative:BS10-007', runNegative])
      for (const [label, route, action] of cases) {
        const result = await runCase(browser, viewport, label, route, action)
        results.push(result)
        if (result.status !== 'PASS') {
          failed = true
          break outer
        }
      }
    }
  } finally {
    await browser.close()
  }
  const report = { generatedAt: new Date().toISOString(), baseUrl, viewports: selectedViewports, results }
  writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2))
  const expectedPerViewport = only === 'draw0' || only === 'draw1' || only === 'negative' ? 1 : 3
  if (failed || results.length !== selectedViewports.length * expectedPerViewport || results.some((result) => result.status !== 'PASS')) process.exitCode = 1
}

await main()
