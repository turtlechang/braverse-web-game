import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const playwrightPaths = process.env.PLAYWRIGHT_NODE_MODULES
  ? [process.env.PLAYWRIGHT_NODE_MODULES]
  : [root]
const playwrightEntry = require.resolve('playwright', { paths: playwrightPaths })
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const baseUrl = process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-dark-enchantress-war-bs11.en.json'), 'utf8'))
const viewports = [
  { width: 1280, height: 720 },
  { width: 1164, height: 777 },
]
const browserExecutable =
  process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find((candidate) => existsSync(candidate))

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const visible = async (locator) =>
  (await locator.count()) > 0 && (await locator.first().isVisible().catch(() => false))
const readTrace = (page) => page.evaluate(() => window.__braverseContractTrace ?? [])
const skipAnimations = async (page) => {
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) {
      await skip.click({ force: true })
      await wait(120)
      continue
    }
    await wait(120)
  }
}

const browserErrors = (page) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const location = message.location()
    const text = message.text()
    if (location.url?.endsWith('/favicon.ico') && text.includes('404')) return
    if (
      location.url?.includes('cookierunbraverse.com/data/en_storage/') &&
      /ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(text)
    ) return
    errors.push(`console: ${text}`)
  })
  return errors
}

const openExtraEntry = async (page, expectedReady) => {
  const dock = page.locator('[aria-label="玩家 EXTRA Deck 1 張"]').first()
  await dock.waitFor({ state: 'visible' })
  assert.equal(
    await dock.getAttribute('data-extra-deck-ready'),
    String(expectedReady),
    `EXTRA readiness must be ${expectedReady}`,
  )
  const dockClass = (await dock.getAttribute('class')) ?? ''
  if (expectedReady) assert.match(dockClass, /is-extra-deck-ready/)
  else assert.doesNotMatch(dockClass, /is-extra-deck-ready/)

  await dock.click()
  const dialog = page.getByRole('dialog', { name: '玩家 EXTRA Deck' })
  await dialog.waitFor({ state: 'visible' })
  const entry = dialog.locator('.extra-deck-card-entry').filter({ hasText: 'BS11-116' }).first()
  await entry.waitFor({ state: 'visible' })
  const art = await entry.locator('.extra-deck-card-image').evaluate((node) => ({
    image: node.querySelector('img')?.getAttribute('src') ?? null,
    fallback: Boolean(node.querySelector('.card-fallback')),
  }))
  return { dock, dialog, entry, art }
}

const runPositive = async (browser, viewport, cardNumber) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(10000)
  const errors = browserErrors(page)
  const route = `bs11-116-extra-deck:${cardNumber}:positive`
  const card = candidate.cards.find((entry) => entry.cardNumber === cardNumber)
  const imagePath = resolve(root, 'test-results/bs11-official-art', `${cardNumber.replace('@', '-at-')}.webp`)
  try {
    if (existsSync(imagePath)) await page.route(card.imageUrl,
      (request) => request.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) }))
    await page.goto(`${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=BS11-116`, {
      waitUntil: 'domcontentloaded',
    })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    const { entry, art } = await openExtraEntry(page, true)
    assert.equal(art.image, card.imageUrl)
    const play = entry.getByRole('button', { name: '從 EXTRA 登場', exact: true })
    assert.ok(await play.isEnabled(), 'positive route must expose an enabled Awaken button')
    await play.click()
    const materialized = page.locator(
      '.bottom-field [data-card-instance-id="bs11-116-demo-extra"]',
    )
    await materialized.waitFor({ state: 'visible' })
    await page.locator('[aria-label="玩家 EXTRA Deck 0 張"]').waitFor({ state: 'visible' })
    await wait(250)
    const trace = await readTrace(page)
    assert.ok(
      trace.some((entry) => entry.commandKind === 'play-extra-deck-cookie'),
      'positive route must leave a play-extra-deck-cookie trace',
    )
    assert.deepEqual(errors, [], `positive browser errors: ${errors.join('; ')}`)
    return {
      route,
      ready: true,
      enteredBattle: true,
      art,
      traceKinds: trace.map((entry) => entry.commandKind),
    }
  } finally {
    await page.close()
  }
}

const runNegative = async (browser, viewport, cardNumber, missingRequirement) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(10000)
  const errors = browserErrors(page)
  const route = `bs11-116-extra-deck:${cardNumber}:${missingRequirement}-missing`
  const card = candidate.cards.find((entry) => entry.cardNumber === cardNumber)
  const imagePath = resolve(root, 'test-results/bs11-official-art', `${cardNumber.replace('@', '-at-')}.webp`)
  try {
    if (existsSync(imagePath)) await page.route(card.imageUrl,
      (request) => request.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) }))
    await page.goto(`${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=BS11-116`, {
      waitUntil: 'domcontentloaded',
    })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    const { entry, art } = await openExtraEntry(page, false)
    assert.equal(art.image, card.imageUrl)
    assert.equal(
      await entry.getByRole('button', { name: '從 EXTRA 登場', exact: true }).count(),
      0,
      `${missingRequirement}-missing route must not expose an Awaken button`,
    )
    await entry.getByText('目前無法登場').waitFor({ state: 'visible' })
    assert.equal(
      await page.locator('[data-card-instance-id="bs11-116-demo-extra"]').count(),
      0,
      `${missingRequirement}-missing route must keep the EXTRA card in the deck`,
    )
    assert.deepEqual(errors, [], `negative browser errors: ${errors.join('; ')}`)
    return { route, ready: false, entryBlocked: true, art }
  } finally {
    await page.close()
  }
}

const runMovementProtection = async (browser, viewport) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(10000)
  const errors = browserErrors(page)
  const route = 'bs11-116-movement-protection'
  const card = candidate.cards.find((entry) => entry.cardNumber === 'BS11-116')
  const imagePath = resolve(root, 'test-results/bs11-official-art', 'BS11-116.webp')
  try {
    if (existsSync(imagePath)) {
      await page.route(card.imageUrl,
        (request) => request.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) }))
    }
    await page.goto(`${baseUrl}/?test-state=${route}&contract-card=ST5-015`, {
      waitUntil: 'domcontentloaded',
    })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    const protectedTarget = page.locator(
      '.top-field .combat-card-wrap[data-card-instance-id="bs11-116-demo-extra"]',
    )
    await protectedTarget.waitFor({ state: 'visible' })
    const image = protectedTarget.locator('.card-face img').first()
    assert.equal(await image.getAttribute('src'), card.imageUrl)

    const source = page.locator(
      '.bottom-field .combat-card-wrap[data-card-instance-id="ST5-015:bs11-116-movement-source"]',
    )
    await source.waitFor({ state: 'visible' })
    const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
    await panel.waitFor({ state: 'visible' })
    const targets = panel.locator('.effect-candidates-target button')
    assert.equal(await targets.count(), 1, 'only the unprotected opponent Cookie may be selected')
    const availableTargetText = await targets.first().innerText()
    assert.match(availableTargetText, /bs11-116-movement-unprotected-target/)
    assert.doesNotMatch(availableTargetText, /Dark Enchantress/)
    await targets.first().click({ force: true })
    await panel.getByRole('button', { name: '確認發動', exact: true }).click({ force: true })
    await skipAnimations(page)

    await protectedTarget.waitFor({ state: 'visible' })
    assert.equal(
      await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs11-116-movement-unprotected-target"]').count(),
      0,
      'the legal control target must move out of battle',
    )
    const trace = await readTrace(page)
    assert.ok(
      trace.some((entry) => entry.commandKind === 'resolve-ability-effect'),
      'the legal control target must leave a resolved effect trace',
    )
    assert.deepEqual(errors, [], `movement-protection browser errors: ${errors.join('; ')}`)
    return {
      route,
      protectedTargetStayed: true,
      unprotectedControlMoved: true,
      availableTargetText,
      traceKinds: trace.map((entry) => entry.commandKind),
    }
  } finally {
    await page.close()
  }
}

const browser = await chromium.launch({
  headless: true,
  ...(browserExecutable ? { executablePath: browserExecutable } : {}),
})
try {
  const results = []
  for (const viewport of viewports) {
    const movementProtection = await runMovementProtection(browser, viewport)
    results.push({ viewport, movementProtection })
  }
  for (const viewport of viewports) for (const cardNumber of ['BS11-116', 'BS11-116@1']) {
    const cardResults = {
      cardNumber,
      viewport,
      positive: await runPositive(browser, viewport, cardNumber),
    }
    for (const missingRequirement of ['castle', 'break', 'special-play']) {
      cardResults[`${missingRequirement}Missing`] = await runNegative(
        browser,
        viewport,
        cardNumber,
        missingRequirement,
      )
    }
    results.push(cardResults)
  }
  console.log(JSON.stringify({
    browser: 'local playwright',
    baseUrl,
    scope: 'BS11-116 promoted-pool test-state Awaken EXTRA readiness, positive entry, official-art/fallback surface, independent castle / break LV.7 / Special Play target blockers, and ST5-015 UI proof that Awakened BS11-116 is not a legal move target',
    results,
  }, null, 2))
} finally {
  await browser.close()
}
