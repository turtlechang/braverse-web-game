import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, 'test-results/bs10-ordinary-attack-browser')
mkdirSync(output, { recursive: true })
const baseUrl = process.env.BRAVERSE_BS10_BASE_URL ?? 'http://127.0.0.1:4190'
const executablePath = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find(existsSync)
const viewports = [{ width: 1907, height: 863 }, { width: 1164, height: 777 }]
const selectedViewports = process.env.BRAVERSE_BS10_VIEWPORTS
  ? viewports.filter((viewport) => process.env.BRAVERSE_BS10_VIEWPORTS.split(',').includes(String(viewport.width)))
  : viewports
assert.ok(selectedViewports.length > 0)
const only = process.env.BRAVERSE_BS10_ONLY ?? 'all'
const cards = {
  'BS10-006': { name: 'Blueberry Cookie', cost: 2, target: 'Adventurer Cookie', survivor: 'Croissant Cookie', targetHp: 2, survivorHpAfter: 4, damage: 2 },
  'BS10-007': { name: 'Jungleberry Cookie', cost: 3, target: 'Adventurer Cookie', survivor: 'Croissant Cookie', targetHp: 3, survivorHpAfter: 5, damage: 3 },
  'BS10-010': { name: 'Tarte Tatin Cookie', cost: 2, target: 'Croissant Cookie', survivor: 'Croissant Cookie', targetHp: 5, survivorHpAfter: 2, damage: 3 },
}
const contractCards = 'BS10-006,BS10-007,BS10-010,BS6-002,BS6-004,BS6-047,BS6-079,BS6-080'

const trace = (page) => page.evaluate(() => Array.isArray(window.__braverseContractTrace) ? window.__braverseContractTrace : [])
const waitTrace = (page, kind) => page.waitForFunction((wanted) => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === wanted), kind)
const numberFrom = (value) => Number(value?.match(/-?\d+/)?.[0])
const publicState = (page) => page.evaluate(() => {
  const field = (side) => {
    const root = document.querySelector(`.${side}-field`)
    if (!root) return null
    const text = (selector) => root.querySelector(selector)?.textContent?.trim() ?? null
    return {
      hand: text('.row-stat-hand .row-stat-value'),
      deck: text('.deck-zone .resource-summary > strong'),
      trash: text('button.discard-zone.resource-summary > strong'),
      break: text('.break-zone .zone-heading b'),
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
  return { bottom: field('bottom'), top: field('top'), phase: document.querySelector('.turn-indicator strong')?.textContent?.trim() ?? null }
})
const waitSettled = (page) => page.waitForFunction(() => {
  const visible = (selector) => [...document.querySelectorAll(selector)].some((element) => {
    const style = getComputedStyle(element)
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0
  })
  return document.querySelector('.match-animation-layer')?.getAttribute('data-playing') !== 'true' &&
    !visible('.effect-panel, .draw-up-to-modal, .decision-modal, .battle-response-modal, [data-testid="attack-payment-panel"]')
})
const screenshot = async (page, evidence, stage) => {
  const path = resolve(output, `${evidence.label}-${evidence.viewport.width}-${stage}.png`)
  await page.screenshot({ path, fullPage: true })
  evidence.screenshots[stage] = path
}

const runPositive = async (page, evidence, cardId) => {
  const card = cards[cardId]
  const before = evidence.before
  const source = page.locator('.bottom-field .combat-card-wrap').filter({ has: page.locator(`.card-face[title="${card.name}"]`) }).first()
  await source.waitFor()
  assert.equal(await source.locator('.card-face.is-attackable').count(), 1, `${cardId} source must be attackable`)
  await source.locator('.card-face.is-attackable').click()
  const payment = page.locator('[data-testid="attack-payment-panel"]:visible').first()
  await payment.waitFor()
  const selectedPayments = []
  for (let index = 0; index < card.cost; index += 1) {
    const support = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').first()
    await support.waitFor()
    selectedPayments.push(await support.getAttribute('title'))
    await support.click()
  }
  assert.match(await payment.innerText(), /付款合法/)
  evidence.payments = selectedPayments
  if (cardId === 'BS10-010') {
    assert.ok(selectedPayments.includes('Dark Choco Cookie'), 'BS10-010 must use a real red support')
    assert.ok(selectedPayments.includes('Lemon Cookie'), 'BS10-010 must use a real green support')
  }
  await screenshot(page, evidence, 'payment')
  const targetCards = page.locator('.top-field .combat-card-wrap .card-face[aria-label^="選擇攻擊目標："]')
  assert.ok(await targetCards.count() > 0)
  const targetByName = targetCards.filter({ has: page.locator(`.card-face[title="${card.target}"]`) }).first()
  const selectedTarget = await targetByName.count() ? targetByName : targetCards.first()
  const targetId = await selectedTarget.evaluate((node) => node.closest('.combat-card-wrap')?.getAttribute('data-card-instance-id'))
  assert.equal((before.top.battle.find((entry) => entry.id === targetId)?.name), card.target)
  await selectedTarget.click()
  await page.waitForFunction(() => {
    const traceEntries = window.__braverseContractTrace ?? []
    return traceEntries.some((entry) => entry.commandKind === 'resolve-battle' || entry.commandKind === 'resolve-attack-effect') ||
      [...document.querySelectorAll('.effect-panel')].some((element) => getComputedStyle(element).display !== 'none' && element.getClientRects().length > 0)
  })
  const attackEffect = page.locator('.effect-panel:visible').first()
  if (cardId === 'BS10-006') {
    await attackEffect.waitFor({ state: 'visible' })
    assert.match(await attackEffect.innerText(), /造成 1 傷害|受到 1 傷害/)
    const effectTarget = attackEffect.locator('.effect-candidates-target button').filter({ hasText: 'Croissant Cookie' }).first()
    assert.equal(await effectTarget.count(), 1)
    await effectTarget.click()
    await attackEffect.locator('.effect-panel-primary-action').click()
    await waitTrace(page, 'resolve-attack-effect')
  } else {
    assert.equal(await attackEffect.count(), 0, `${cardId} should not open an extra attack effect panel`)
    await waitTrace(page, 'resolve-battle')
  }
  await waitSettled(page)
  evidence.after = await publicState(page)
  const afterTarget = evidence.after.top.battle.find((entry) => entry.id === targetId)
  if (card.target === 'Adventurer Cookie') {
    assert.equal(afterTarget, undefined, `${cardId} target should faint`)
    assert.equal(numberFrom(evidence.after.top.break), 1, `${cardId} should add one Break card`)
    const survivor = evidence.after.top.battle.find((entry) => entry.name === card.survivor)
    assert.equal(numberFrom(survivor?.hp), card.survivorHpAfter)
  } else {
    assert.equal(numberFrom(afterTarget?.hp), card.survivorHpAfter)
  }
  assert.equal(evidence.after.bottom.support.filter((support) => support.rested).length, card.cost)
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'declare-attack'))
  await screenshot(page, evidence, 'settled')
}

const runNegative = async (page, evidence, cardId) => {
  const card = cards[cardId]
  const before = evidence.before
  const source = page.locator('.bottom-field .combat-card-wrap').filter({ has: page.locator(`.card-face[title="${card.name}"]`) }).first()
  await source.waitFor()
  const attackable = source.locator('.card-face.is-attackable')
  if (await attackable.count() === 0) {
    evidence.blockedPayment = await source.innerText()
    assert.match(evidence.blockedPayment, /能量不足|需要/)
    assert.equal((await trace(page)).some((entry) => entry.commandKind === 'declare-attack'), false)
    assert.deepEqual(await publicState(page), before)
    evidence.trace = await trace(page)
    return
  }
  await attackable.click()
  const payment = page.locator('[data-testid="attack-payment-panel"]:visible').first()
  if (await payment.count()) {
    const available = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)')
    assert.equal(await available.count(), card.cost - 1, `${cardId} negative fixture must expose exactly cost-1 active supports`)
    assert.match(await payment.innerText(), /不足|需要|不合法/)
    evidence.blockedPayment = await payment.innerText()
    await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
    await payment.waitFor({ state: 'hidden' })
  } else {
    evidence.blockedPayment = await source.innerText()
    assert.match(evidence.blockedPayment, /能量不足|需要/)
  }
  assert.equal((await trace(page)).some((entry) => entry.commandKind === 'declare-attack'), false)
  assert.deepEqual(await publicState(page), before)
  evidence.trace = await trace(page)
}

const runCase = async (browser, viewport, cardId, negative) => {
  const card = cards[cardId]
  const label = `${cardId}-${negative ? 'attack-negative' : 'attack'}`
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(15000)
  const evidence = { card: cardId, label, viewport, negative, status: 'FAIL', errors: [], knownWarnings: [], screenshots: {} }
  page.on('pageerror', (error) => evidence.errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const url = message.location().url
    if (message.text().includes('Failed to load resource') && url.includes('favicon.ico')) evidence.knownWarnings.push({ text: message.text(), url })
    else evidence.errors.push(`console: ${message.text()} @ ${url}`)
  })
  page.on('response', (response) => {
    if (response.status() < 400) return
    if (response.url().includes('favicon.ico')) evidence.knownWarnings.push({ status: response.status(), url: response.url() })
    else evidence.errors.push(`${response.status()} response: ${response.url()}`)
  })
  page.on('requestfailed', (request) => {
    if (request.url().includes('favicon.ico')) evidence.knownWarnings.push({ url: request.url(), reason: request.failure()?.errorText })
    else evidence.errors.push(`request failed: ${request.url()} ${request.failure()?.errorText ?? 'unknown'}`)
  })
  try {
    const route = negative ? `card-attack-negative:${cardId}` : `card-attack:${cardId}`
    await page.goto(`${baseUrl}/?test-state=${route}&contract-card=${encodeURIComponent(contractCards)}`, { waitUntil: 'domcontentloaded' })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    evidence.before = await publicState(page)
    await screenshot(page, evidence, 'before')
    if (negative) await runNegative(page, evidence, cardId)
    else await runPositive(page, evidence, cardId)
    assert.deepEqual(evidence.errors, [])
    evidence.status = 'PASS'
  } catch (error) {
    evidence.error = error.stack ?? String(error)
    evidence.body = await page.locator('body').innerText().catch(() => '')
    evidence.after = await publicState(page).catch(() => null)
    evidence.trace = await trace(page).catch(() => [])
  } finally {
    await page.screenshot({ path: resolve(output, `${label}-${viewport.width}-${evidence.status}.png`), fullPage: true }).catch(() => {})
    await page.close()
  }
  console.log(`BS10 ordinary ${label} ${viewport.width}x${viewport.height}: ${evidence.status}${evidence.error ? ` ${evidence.error.split('\n')[0]}` : ''}`)
  return evidence
}

const main = async () => {
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
  const results = []
  let failed = false
  const selectedCards = Object.keys(cards).filter((cardId) => only === 'all' || only === cardId)
  assert.ok(selectedCards.length > 0, `BRAVERSE_BS10_ONLY=${only} selected no cards`)
  try {
    outer: for (const viewport of selectedViewports) {
      for (const cardId of selectedCards) {
        for (const negative of [false, true]) {
          const result = await runCase(browser, viewport, cardId, negative)
          results.push(result)
          writeFileSync(resolve(output, 'report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, viewports: selectedViewports, results }, null, 2))
          if (result.status !== 'PASS') { failed = true; break outer }
        }
      }
    }
  } finally {
    await browser.close()
  }
  writeFileSync(resolve(output, 'report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, viewports: selectedViewports, total: results.length, passed: results.filter((result) => result.status === 'PASS').length, results }, null, 2))
  if (failed || results.length !== selectedViewports.length * selectedCards.length * 2) process.exitCode = 1
}

await main()
