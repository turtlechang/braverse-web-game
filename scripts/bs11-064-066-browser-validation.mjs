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
const outputDir = resolve(root, 'test-results/bs11-064-browser')
mkdirSync(outputDir, { recursive: true })
const officialImagePath = resolve(outputDir, 'bs11-064-official.webp')
const officialImageUrl = 'https://cookierunbraverse.com/data/en_storage/h4NwjQOeySuV9LKMKkgB6w.webp'
const mirrorImagePath = resolve(root, 'test-results/bs11-official-art/BS11-065.webp')
const mirrorImageUrl = 'https://cookierunbraverse.com/data/en_storage/eyqbE_VRjz5W5A2jmuFJ7g.webp'
const milkImagePath = resolve(root, 'test-results/bs11-official-art/BS11-066.webp')
const milkImageUrl = 'https://cookierunbraverse.com/data/en_storage/FbNu6LmMB4Q8fbbb-z-ZKQ.webp'
const executablePath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
const viewports = [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]
const cases = [
  { id: 'item-positive', route: 'card:BS11-064' },
  { id: 'item-blocked', route: 'card-negative:BS11-064' },
  { id: 'replacement-positive', route: 'bs11-064-replacement:positive' },
  { id: 'replacement-blocked', route: 'bs11-064-replacement:negative' },
  { id: 'mirror-positive', route: 'card:BS11-065' },
  { id: 'mirror-zero-target', route: 'card:BS11-065' },
  { id: 'mirror-blocked', route: 'card-negative:BS11-065' },
  { id: 'milk-bottom', route: 'bs11-066-trap:positive' },
  { id: 'milk-top', route: 'bs11-066-trap:positive' },
  { id: 'milk-zero-target', route: 'bs11-066-trap:positive' },
  { id: 'milk-blocked', route: 'bs11-066-trap:negative' },
]
const requested = process.env.BS11_BROWSER_CASES?.split(',').map((part) => part.trim()).filter(Boolean)
const selectedCases = requested?.length ? cases.filter((testCase) => requested.includes(testCase.id)) : cases
if (!selectedCases.length || requested?.some((id) => !cases.some((testCase) => testCase.id === id))) {
  throw new Error('Unknown or empty BS11_BROWSER_CASES selection')
}
const widths = process.env.BS11_BROWSER_WIDTHS?.split(',').map(Number).filter(Number.isFinite)
const selectedViewports = widths?.length ? viewports.filter((viewport) => widths.includes(viewport.width)) : viewports
if (!selectedViewports.length) throw new Error('Unknown BS11_BROWSER_WIDTHS selection')
const wait = (ms) => new Promise((done) => setTimeout(done, ms))
const visible = async (locator) => await locator.count() > 0 && locator.first().isVisible().catch(() => false)
const trace = (page) => page.evaluate(() => (window.__braverseContractTrace ?? []).map((entry) => ({
  commandKind: entry.commandKind,
  steps: Array.isArray(entry.steps) ? entry.steps.map(String) : [],
})))
const waitForCommand = (page, kind) => page.waitForFunction(
  (commandKind) => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === commandKind), kind,
)
const readState = (page) => page.evaluate(() => {
  const side = (name) => {
    const field = document.querySelector('.' + name + '-field')
    const count = (selector) => Number(field?.querySelector(selector)?.textContent?.match(/\d+/)?.[0] ?? NaN)
    return {
      handCount: field?.querySelectorAll('.hand-card-wrap').length ?? 0,
      deckCount: count('.deck-zone .resource-summary > strong'),
      discardCount: count('.discard-zone.resource-summary > strong'),
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
  return {
    url: image?.getAttribute('src') ?? null,
    alt: image?.getAttribute('alt') ?? null,
    loaded: Boolean(image?.complete && image.naturalWidth > 0),
    fallback: node.querySelector('.card-fallback strong')?.textContent?.trim() ?? null,
  }
})
const skipAnimations = async (page) => {
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click()
    await wait(100)
  }
}
const clickReady = async (locator, label) => {
  await locator.waitFor({ state: 'visible' })
  assert.equal(await locator.isEnabled(), true, label + ' must be enabled')
  await locator.click()
}
const advancePanel = async (panel) => {
  for (let index = 0; index < 6; index += 1) {
    const primary = panel.locator('.effect-panel-primary-action:visible').last()
    if (!await visible(primary)) return
    const label = await primary.innerText()
    await clickReady(primary, 'effect panel ' + label)
    if (!label.includes('下一步')) return
  }
  throw new Error('Effect panel did not settle after six steps')
}

const runItem = async (page, testCase, evidence) => {
  const before = await readState(page)
  evidence.before = before
  const card = page.locator('.bottom-field .hand-card-wrap').filter({
    has: page.locator('.card-face[title="The Breath of the Depths"]'),
  }).first()
  await card.waitFor({ state: 'visible' })
  evidence.art = await art(card.locator('.card-face').first())
  assert.ok(evidence.art.url?.includes('/data/en_storage/') || evidence.art.fallback === 'The Breath of the Depths')
  if (existsSync(officialImagePath)) {
    assert.equal(evidence.art.url, officialImageUrl)
    assert.equal(evidence.art.loaded, true, 'Official BS11-064 image bytes must render in Browser')
  }
  await card.locator('.card-face').click()
  const use = card.locator('.hand-card-action').filter({ hasText: '使用' }).first()
  if (testCase.id === 'item-blocked' && (!await visible(use) || !await use.isEnabled())) {
    assert.equal((await trace(page)).some((entry) => entry.commandKind === 'begin-play-item'), false)
    evidence.after = await readState(page)
    assert.deepEqual(evidence.after, before)
    evidence.result = 'No legal blue Item payment; use action blocked before declaration.'
    return
  }
  await clickReady(use, 'BS11-064 Item use')
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
  await panel.waitFor({ state: 'visible' })
  const energy = panel.locator('.effect-candidates-payment:visible button:not(.is-selected)')
  if (testCase.id === 'item-blocked') {
    assert.equal(await energy.count(), 0)
    assert.equal(await panel.locator('.effect-panel-primary-action').last().isEnabled(), false)
    evidence.after = await readState(page)
    assert.deepEqual(evidence.after, before)
    evidence.result = 'Item panel offered no legal blue payment and could not confirm.'
    return
  }
  await clickReady(energy.first(), 'BS11-064 blue energy')
  await clickReady(panel.locator('.effect-panel-primary-action').last(), 'advance to discard cost')
  const discard = panel.locator('.effect-candidates-discard-hand:visible button:not(.is-selected)')
  assert.ok(await discard.count() > 0, 'BS11-064 must offer a hand discard cost after energy payment')
  await clickReady(discard.first(), 'BS11-064 discard one')
  await advancePanel(panel)
  await waitForCommand(page, 'resolve-ability-effect')
  await skipAnimations(page)
  evidence.after = await readState(page)
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'begin-play-item'))
  assert.equal(evidence.after.bottom.supports.filter((support) => support.rested).length,
    before.bottom.supports.filter((support) => support.rested).length + 1)
  assert.equal(evidence.after.bottom.handCount, before.bottom.handCount - 2)
  evidence.result = 'Paid 1B, discarded one hand card, and registered the On Play replacement.'
}

const runReplacement = async (page, testCase, evidence) => {
  await skipAnimations(page)
  const before = await readState(page)
  evidence.before = before
  assert.ok(before.bottom.battle.some((entry) => entry.name === 'On Play Replacement Witness'))
  const fixtureTrace = await trace(page)
  assert.ok(['begin-play-item', 'resolve-ability-effect'].every(
    (kind) => fixtureTrace.some((entry) => entry.commandKind === kind),
  ))
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
  if (testCase.id === 'replacement-blocked' && !await visible(panel)) {
    evidence.uiText = (await page.locator('body').innerText()).slice(0, 1800)
    assert.match(evidence.uiText, /替代 On Play 需要支付 1N/)
    evidence.trace = await trace(page)
    evidence.after = await readState(page)
    assert.deepEqual(evidence.after, before)
    assert.equal(evidence.trace.some((entry) => entry.commandKind === 'begin-activate-skill'), false)
    assert.equal(evidence.trace.some((entry) => entry.commandKind === 'resolve-draw-up-to'), false)
    evidence.result = 'No 1N payment was available, so replacement On Play did not open an effect panel or execute.'
    return
  }
  await panel.waitFor({ state: 'visible' })
  evidence.panelText = await panel.innerText()
  assert.match(evidence.panelText, /\{N\}|任意|1.*能量/)
  const payment = panel.locator('.effect-candidates-payment:visible button:not(.is-selected)')
  if (testCase.id === 'replacement-blocked') {
    assert.equal(await payment.count(), 0, '1N replacement must not be payable with no support')
    assert.equal(await panel.locator('.effect-panel-primary-action').last().isEnabled(), false)
    evidence.after = await readState(page)
    assert.deepEqual(evidence.after, before)
    evidence.trace = await trace(page)
    evidence.result = 'Replacement On Play requires 1N; no payment candidate or effect command was available.'
    return
  }
  assert.equal(await payment.count(), 1, 'Replacement must offer one neutral payment, not original 3B')
  const paymentId = before.bottom.supports[0]?.id
  await clickReady(payment.first(), 'BS11-064 replacement 1N')
  await advancePanel(panel)
  const draw = page.locator('.draw-up-to-modal:visible').first()
  for (let attempt = 0; attempt < 8 && !await visible(draw); attempt += 1) {
    if (await visible(panel)) await advancePanel(panel)
    await wait(150)
  }
  await draw.waitFor({ state: 'visible' })
  await clickReady(draw.locator('.draw-up-to-option').nth(1), 'draw one replacement card')
  await clickReady(draw.locator('.draw-up-to-actions button').last(), 'confirm replacement draw')
  await page.waitForFunction((expected) =>
    document.querySelectorAll('.bottom-field .hand-card-wrap').length === expected,
  before.bottom.handCount + 1)
  evidence.after = await readState(page)
  evidence.trace = await trace(page)
  assert.equal(evidence.after.bottom.supports.find((support) => support.id === paymentId)?.rested, true)
  assert.equal(evidence.after.bottom.handCount, before.bottom.handCount + 1)
  assert.equal(evidence.after.bottom.deckCount, before.bottom.deckCount - 1)
  assert.equal(evidence.after.bottom.discardCount, before.bottom.discardCount, 'original discard cost must be replaced')
  evidence.result = 'Original 3B plus discard On Play was replaced with 1N and an optional draw.'
}

const runMirror = async (page, testCase, evidence) => {
  const before = await readState(page)
  evidence.before = before
  const card = page.locator('.bottom-field .hand-card-wrap').filter({
    has: page.locator('.card-face[title="Mirror of Destiny"]'),
  }).first()
  await card.waitFor({ state: 'visible' })
  evidence.art = await art(card.locator('.card-face').first())
  assert.equal(evidence.art.url, mirrorImageUrl)
  if (existsSync(mirrorImagePath)) assert.equal(evidence.art.loaded, true, 'Official BS11-065 image must render')
  await card.locator('.card-face').click()
  const use = card.locator('.hand-card-action').filter({ hasText: '使用' }).first()
  if (testCase.id === 'mirror-blocked' && (!await visible(use) || !await use.isEnabled())) {
    evidence.after = await readState(page)
    assert.deepEqual(evidence.after, before)
    assert.equal((await trace(page)).some((entry) => entry.commandKind === 'begin-play-item'), false)
    evidence.result = 'Mirror use was blocked before payment.'
    return
  }
  await clickReady(use, 'BS11-065 Mirror use')
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
  await panel.waitFor({ state: 'visible' })
  if (testCase.id === 'mirror-blocked') {
    assert.ok(await panel.locator('.effect-candidates-payment:visible button:not(.is-selected)').count() < 2)
    assert.equal(await panel.locator('.effect-panel-primary-action').last().isEnabled(), false)
    evidence.after = await readState(page)
    assert.deepEqual(evidence.after, before)
    evidence.result = 'Mirror could not pay 2B and issued no Item command.'
    return
  }
  for (let index = 0; index < 2; index += 1) {
    await clickReady(
      panel.locator('.effect-candidates-payment:visible button:not(.is-selected)').first(),
      'BS11-065 blue payment ' + (index + 1),
    )
  }
  await clickReady(panel.locator('.effect-panel-primary-action').last(), 'advance to Mirror discard cost')
  const discard = panel.locator('.effect-candidates-discard-hand:visible button:not(.is-selected)').first()
  await clickReady(discard, 'discard one for Mirror')
  await clickReady(panel.locator('.effect-panel-primary-action').last(), 'advance to Mirror target')
  const targets = panel.locator('.effect-candidates-target:visible button:not(.is-selected)')
  const targetNames = await targets.evaluateAll((buttons) => buttons.map((button) =>
    button.querySelector('.card-face')?.getAttribute('title') ??
    button.querySelector('.card-fallback strong')?.textContent?.trim() ?? null,
  ))
  evidence.legalTargetNames = targetNames
  assert.ok(targetNames.includes('opp-lv1'), 'opponent LV1 must be selectable')
  assert.ok(targetNames.includes('self-extra-1'), 'own LV1 must also be selectable')
  assert.ok(!targetNames.includes('opp-lv3'), 'opponent LV3 must be excluded')
  const targetBefore = before.top.battle.find((entry) => entry.name === 'opp-lv1')
  assert.ok(targetBefore && Number.isFinite(targetBefore.hp))
  if (testCase.id === 'mirror-positive') {
    await clickReady(targets.filter({ hasText: 'opp-lv1' }).first(), 'select opponent LV1')
  }
  await advancePanel(panel)
  await waitForCommand(page, 'resolve-ability-effect')
  await skipAnimations(page)
  evidence.after = await readState(page)
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'begin-play-item'))
  assert.equal(evidence.after.bottom.handCount, before.bottom.handCount - 2)
  assert.equal(evidence.after.bottom.discardCount, before.bottom.discardCount + 2)
  assert.equal(evidence.after.bottom.supports.filter((support) => support.rested).length,
    before.bottom.supports.filter((support) => support.rested).length + 2)
  if (testCase.id === 'mirror-positive') {
    assert.equal(evidence.after.top.battle.some((entry) => entry.id === targetBefore.id), false)
    assert.equal(evidence.after.top.deckCount, before.top.deckCount + 1)
    assert.equal(evidence.after.top.discardCount, before.top.discardCount + targetBefore.hp)
    evidence.result = 'Paid 2B and discarded one; moved opponent LV1 Cookie to its deck bottom and its HP to trash.'
  } else {
    assert.deepEqual(evidence.after.top, before.top, 'up-to-one target selection must permit zero')
    evidence.result = 'Paid 2B and discarded one; chose zero targets and moved no Cookies.'
  }
}

const openMilkTrap = async (page) => {
  const chooser = page.locator('.attack-response-modal:visible').first()
  const modal = page.locator('.trap-response-modal[role="alertdialog"]:visible').first()
  for (let attempt = 0; attempt < 100 && !await visible(modal); attempt += 1) {
    if (await visible(chooser)) {
      const option = chooser.locator('.modal-card-options button').filter({ hasText: 'Milk Lake of Truth' }).first()
      if (await visible(option)) await option.click()
    }
    await wait(100)
  }
  await modal.waitFor({ state: 'visible' })
  if ((await modal.innerText()).includes('是否發動陷阱？')) {
    await clickReady(modal.locator('.modal-card-options button').filter({ hasText: 'Milk Lake of Truth' }).first(), 'choose Milk Lake Trap')
  }
  return modal
}

const settleMilkAttack = async (page) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click()
    const response = page.locator('.attack-response-modal:visible').first()
    if (await visible(response)) {
      const decline = response.getByRole('button', { name: '不發動', exact: true }).first()
      if (await visible(decline)) await decline.click()
    }
    if (await page.locator('.next-phase-button').isEnabled().catch(() => false) &&
      !await visible(page.locator('.trap-response-modal:visible')) &&
      !await visible(page.locator('.inspect-deck-modal:visible')) &&
      !await visible(page.locator('.effect-panel:visible'))) return
    await wait(100)
  }
  throw new Error('BS11-066 attack did not settle')
}

const runMilk = async (page, testCase, evidence) => {
  const before = await readState(page)
  evidence.before = before
  const card = page.locator('.bottom-field .hand-card-wrap').filter({
    has: page.locator('.card-face[title="Milk Lake of Truth"]'),
  }).first()
  await card.waitFor({ state: 'visible' })
  evidence.art = await art(card.locator('.card-face').first())
  assert.equal(evidence.art.url, milkImageUrl)
  if (existsSync(milkImagePath)) assert.equal(evidence.art.loaded, true)
  const defender = before.bottom.battle[0]
  assert.ok(defender)
  if (testCase.id === 'milk-blocked') {
    const response = page.locator('.trap-response-modal:visible').first()
    if (await visible(response)) {
      assert.equal(await response.locator('.modal-card-options button').filter({ hasText: 'Milk Lake of Truth' }).count(), 0)
      const decline = response.getByRole('button', { name: '不發動', exact: true }).first()
      if (await visible(decline)) await decline.click()
    }
    await settleMilkAttack(page)
    evidence.after = await readState(page)
    evidence.trace = await trace(page)
    assert.equal(evidence.trace.some((entry) => entry.commandKind === 'play-trap'), false)
    evidence.damageReceived = defender.hp - (evidence.after.bottom.battle.find((entry) => entry.id === defender.id)?.hp ?? NaN)
    assert.equal(evidence.after.bottom.battle.find((entry) => entry.id === defender.id)?.hp, 2,
      'without Trap payment the 8 HP defender takes the full six damage')
    evidence.result = 'Trap could not pay 1B; attack settled without a Trap command.'
    return
  }
  const modal = await openMilkTrap(page)
  const payment = modal.locator('.trap-guided-section').filter({ hasText: '能量支付' })
    .locator('.modal-card-options button:not(.is-selected)').first()
  await clickReady(payment, 'Milk Lake blue Trap payment')
  const next = modal.getByRole('button', { name: '下一步', exact: true }).first()
  if (await visible(next)) await clickReady(next, 'Milk Lake target step')
  if (testCase.id !== 'milk-zero-target') {
    await clickReady(modal.locator('.trap-target-options button.is-attacker').first(), 'Milk Lake opponent Cookie target')
  }
  for (let step = 0; step < 5; step += 1) {
    const nextStep = modal.getByRole('button', { name: '下一步', exact: true }).first()
    if (await visible(nextStep)) {
      await clickReady(nextStep, 'Milk Lake Trap next step')
      continue
    }
    await clickReady(modal.getByRole('button', { name: '確認發動', exact: true }).last(), 'Milk Lake confirm')
    break
  }
  await waitForCommand(page, 'play-trap')
  const inspect = page.locator('.inspect-deck-modal:visible').first()
  for (let attempt = 0; attempt < 10 && !await visible(inspect); attempt += 1) {
    const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
    if (await visible(panel)) await advancePanel(panel)
    await wait(150)
  }
  await inspect.waitFor({ state: 'visible' })
  const viewedCards = inspect.locator('.inspect-deck-card')
  assert.equal(await viewedCards.count(), 1, 'Milk Lake must inspect one opponent deck card')
  const privateName = (await viewedCards.first().locator('.card-face').getAttribute('title').catch(() => null)) ??
    (await viewedCards.first().locator('.card-fallback strong').textContent().catch(() => null))?.trim()
  assert.ok(privateName, 'inspected opponent card must be visible to the Trap controller')
  const publicBefore = JSON.stringify(await trace(page))
  assert.equal(publicBefore.includes(privateName), false, 'public trace must not expose inspected deck card')
  const placement = testCase.id === 'milk-top' ? '放回牌庫頂' : '放回牌庫底'
  await clickReady(inspect.getByRole('button', { name: placement, exact: true }), 'Milk Lake deck placement')
  const confirm = inspect.locator('.modal-actions button:not(:disabled)').last()
  await clickReady(confirm, 'Milk Lake inspected deck confirmation')
  await settleMilkAttack(page)
  evidence.after = await readState(page)
  evidence.trace = await trace(page)
  assert.equal(JSON.stringify(evidence.trace).includes(privateName), false)
  evidence.privateTraceScan = 'passed'
  evidence.damageReceived = defender.hp - (evidence.after.bottom.battle.find((entry) => entry.id === defender.id)?.hp ?? NaN)
  assert.equal(evidence.damageReceived, testCase.id === 'milk-zero-target' ? 6 : 5,
    'Trap target selection must change actual attack damage by one')
  assert.equal(evidence.after.top.deckCount, before.top.deckCount, 'inspected card returns to its owner deck')
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'play-trap'))
  evidence.result = testCase.id === 'milk-zero-target'
    ? 'Paid 1B, selected zero attack targets, and chose opponent deck bottom for the inspected card.'
    : `Paid 1B, reduced the selected attacker, and chose ${placement} for the inspected opponent card.`
}

const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
const results = []
try {
  for (const viewport of selectedViewports) {
    for (const testCase of selectedCases) {
      const page = await browser.newPage({ viewport })
      page.setDefaultTimeout(15000)
      const evidence = { id: testCase.id, viewport, status: 'FAIL', errors: [], imageFailures: [] }
      page.on('pageerror', (error) => evidence.errors.push(error.message))
      page.on('requestfailed', (request) => {
        if (request.url().startsWith('https://cookierunbraverse.com/data/en_storage/')) {
          evidence.imageFailures.push({ url: request.url(), reason: request.failure()?.errorText })
        } else if (!request.url().endsWith('/favicon.ico')) {
          evidence.errors.push(request.url() + ': ' + request.failure()?.errorText)
        }
      })
      if (existsSync(officialImagePath)) {
        await page.route(officialImageUrl, (route) => route.fulfill({
          status: 200,
          contentType: 'image/webp',
          body: readFileSync(officialImagePath),
        }))
        evidence.officialArtDelivery = 'official CDN bytes served from local test artifact'
      }
      if (existsSync(mirrorImagePath)) {
        await page.route(mirrorImageUrl, (route) => route.fulfill({
          status: 200, contentType: 'image/webp', body: readFileSync(mirrorImagePath),
        }))
        evidence.mirrorArtDelivery = 'official CDN bytes served from local test artifact'
      }
      if (existsSync(milkImagePath)) {
        await page.route(milkImageUrl, (route) => route.fulfill({
          status: 200, contentType: 'image/webp', body: readFileSync(milkImagePath),
        }))
        evidence.milkArtDelivery = 'official CDN bytes served from local test artifact'
      }
      try {
        const url = new URL('/', baseUrl)
        url.searchParams.set('test-state', testCase.route)
        url.searchParams.set('contract-card', testCase.id.startsWith('mirror-') ? 'BS11-065' : testCase.id.startsWith('milk-') ? 'BS11-066' : 'BS11-064')
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
        await page.locator('.game-shell').waitFor({ state: 'visible' })
        if (testCase.id.startsWith('item-')) await runItem(page, testCase, evidence)
        else if (testCase.id.startsWith('mirror-')) await runMirror(page, testCase, evidence)
        else if (testCase.id.startsWith('milk-')) await runMilk(page, testCase, evidence)
        else await runReplacement(page, testCase, evidence)
        assert.deepEqual(evidence.errors, [])
        evidence.status = 'PASS'
      } catch (error) {
        evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
        if (!testCase.id.startsWith('milk-')) evidence.trace ??= await trace(page).catch(() => [])
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
const artifactPath = resolve(outputDir, 'bs11-064-browser-' + Date.now() + '.json')
const summary = { total: results.length, passed: results.filter((entry) => entry.status === 'PASS').length }
writeFileSync(artifactPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2) + '\n')
console.log(JSON.stringify({ artifactPath, summary }))
if (summary.passed !== summary.total) process.exitCode = 1
