import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * Browser A/B for every formal BS8 EXTRA card.  The routes are localhost-only
 * candidate fixtures; they exercise the real BattleRow readiness selector and
 * `play-extra-deck-cookie` command without opening these cards to Standard.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightRoot = process.env.PLAYWRIGHT_NODE_MODULES
const playwrightEntry = require.resolve('playwright', {
  paths: playwrightRoot ? [playwrightRoot] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4182)
const baseUrl = `http://127.0.0.1:${port}`
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')
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
  (await locator.count()) > 0 &&
  (await locator.first().isVisible().catch(() => false))
const enabled = async (locator) =>
  (await visible(locator)) &&
  (await locator.first().isEnabled().catch(() => false))

const expectedCards = [
  { cardNumber: 'BS8-005', name: 'Avatar of Ruin', instanceId: 'bs8-005-demo-avatar' },
  { cardNumber: 'BS8-027', name: 'Golden Cheese Cookie', instanceId: 'bs8-027-demo-extra' },
  { cardNumber: 'BS8-069', name: 'Peak of Apathy', instanceId: 'bs8-069-demo-extra' },
  { cardNumber: 'BS8-090', name: 'Will of Nature', instanceId: 'bs8-090-demo-extra' },
  { cardNumber: 'BS8-104', name: 'Dark Cacao Cookie', instanceId: 'bs8-104-demo-extra' },
]

const recordBrowserErrors = (page) => {
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
    ) {
      return
    }
    errors.push(`console: ${text} (${location.url || 'unknown URL'})`)
  })
  return errors
}

const openExtraDialog = async (page) => {
  const extraDeck = page.getByLabel('玩家 EXTRA Deck 1 張')
  await extraDeck.waitFor({ state: 'visible' })
  assert.equal(
    await extraDeck.getAttribute('data-extra-deck-ready'),
    'true',
    'positive route must expose rule-derived EXTRA readiness',
  )
  assert.match(
    (await extraDeck.getAttribute('class')) ?? '',
    /is-extra-deck-ready/,
    'positive route must highlight the EXTRA resource dock',
  )
  await extraDeck.click({ force: true })
  const dialog = page.getByRole('dialog', { name: '玩家 EXTRA Deck' })
  await dialog.waitFor({ state: 'visible' })
  return dialog
}

const assertExtraCardPreview = async (entry, expected) => {
  const preview = entry.locator('.extra-deck-card-image')
  await preview.waitFor({ state: 'visible' })
  // The official image may be blocked in an offline validation environment;
  // CardFace then falls back to a readable card tile.  Either branch still
  // proves the EXTRA entry owns a dedicated visual preview rather than only
  // a name/id row.
  const imageCount = await preview.locator('img').count()
  const fallbackCount = await preview.locator('.card-fallback').count()
  assert.ok(
    imageCount === 1 || fallbackCount === 1,
    `${expected.cardNumber} EXTRA entry must render card art or its visual fallback`,
  )
  if (imageCount === 1) {
    assert.match(
      await preview.locator('img').getAttribute('alt'),
      new RegExp(expected.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `${expected.cardNumber} EXTRA art must expose the card name as alt text`,
    )
  }
}

const runPositivePath = async (browser, expected) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  page.setDefaultTimeout(7000)
  const errors = recordBrowserErrors(page)
  const route = `bs8-extra-deck:${expected.cardNumber}:met`
  try {
    await page.goto(`${baseUrl}?test-state=${route}`, { waitUntil: 'domcontentloaded' })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    const dialog = await openExtraDialog(page)
    const entry = dialog.locator('.extra-deck-card-entry').filter({ hasText: expected.cardNumber })
    await entry.waitFor({ state: 'visible' })
    assert.match(await entry.innerText(), new RegExp(expected.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    await assertExtraCardPreview(entry, expected)
    const play = entry.getByRole('button', { name: '從 EXTRA 登場' })
    assert.ok(await enabled(play), `${expected.cardNumber} positive route must permit EXTRA entry`)
    await play.click({ force: true })

    const materialized = page.locator(
      `.bottom-field [data-card-instance-id="${expected.instanceId}"] > .card-face`,
    )
    await materialized.waitFor({ state: 'visible' })
    await wait(180)
    assert.equal(
      await page.getByLabel('玩家 EXTRA Deck 0 張').count(),
      1,
      `${expected.cardNumber} must leave the EXTRA Deck after entry`,
    )
    assert.deepEqual(errors, [], `browser errors for ${expected.cardNumber}: ${errors.join('; ')}`)
    return {
      cardNumber: expected.cardNumber,
      route,
      ready: true,
      enteredBattle: true,
      pendingOnPlay: await page.locator('.effect-panel[role="alertdialog"]').count() > 0,
    }
  } finally {
    await page.close()
  }
}

const runNegativePath = async (browser, expected) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  page.setDefaultTimeout(7000)
  const errors = recordBrowserErrors(page)
  const route = `bs8-extra-deck:${expected.cardNumber}:unmet`
  try {
    await page.goto(`${baseUrl}?test-state=${route}`, { waitUntil: 'domcontentloaded' })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    const extraDeck = page.getByLabel('玩家 EXTRA Deck 1 張')
    await extraDeck.waitFor({ state: 'visible' })
    assert.equal(
      await extraDeck.getAttribute('data-extra-deck-ready'),
      'false',
      'negative route must not expose readiness',
    )
    assert.doesNotMatch(
      (await extraDeck.getAttribute('class')) ?? '',
      /is-extra-deck-ready/,
      'negative route must not highlight the EXTRA resource dock',
    )
    await extraDeck.click({ force: true })
    const dialog = page.getByRole('dialog', { name: '玩家 EXTRA Deck' })
    await dialog.waitFor({ state: 'visible' })
    const entry = dialog.locator('.extra-deck-card-entry').filter({ hasText: expected.cardNumber })
    await entry.waitFor({ state: 'visible' })
    await assertExtraCardPreview(entry, expected)
    assert.equal(
      await entry.getByRole('button', { name: '從 EXTRA 登場' }).count(),
      0,
      `${expected.cardNumber} negative route must not expose an entry button`,
    )
    await entry.getByText('目前無法登場').waitFor({ state: 'visible' })
    assert.equal(
      await page.locator(`[data-card-instance-id="${expected.instanceId}"]`).count(),
      0,
      `${expected.cardNumber} must remain outside the battle area when its condition is unmet`,
    )
    assert.deepEqual(errors, [], `browser errors for ${expected.cardNumber}: ${errors.join('; ')}`)
    return { cardNumber: expected.cardNumber, route, ready: false, entryBlocked: true }
  } finally {
    await page.close()
  }
}

const runGenericCardRoute = async (browser, expected, conditionMet) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  page.setDefaultTimeout(7000)
  const errors = recordBrowserErrors(page)
  const route = `${conditionMet ? 'card' : 'card-negative'}:${expected.cardNumber}`
  try {
    await page.goto(`${baseUrl}?test-state=${route}`, { waitUntil: 'domcontentloaded' })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    const extraDeck = page.getByLabel('玩家 EXTRA Deck 1 張')
    await extraDeck.waitFor({ state: 'visible' })
    assert.equal(
      await extraDeck.getAttribute('data-extra-deck-ready'),
      String(conditionMet),
      `${route} must expose the expected EXTRA readiness state`,
    )
    await extraDeck.click({ force: true })
    const dialog = page.getByRole('dialog', { name: '玩家 EXTRA Deck' })
    await dialog.waitFor({ state: 'visible' })
    const entry = dialog.locator('.extra-deck-card-entry').filter({ hasText: expected.cardNumber })
    await entry.waitFor({ state: 'visible' })
    await assertExtraCardPreview(entry, expected)
    assert.equal(
      await page.locator(`.bottom-hand [data-card-instance-id="${expected.instanceId}"]`).count(),
      0,
      `${route} must never render the EXTRA card in the player's hand`,
    )
    assert.deepEqual(errors, [], `browser errors for ${route}: ${errors.join('; ')}`)
    return { route, extraDeckOnly: true, handContainsCard: false }
  } finally {
    await page.close()
  }
}

const server = spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)

const waitForPreview = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(baseUrl)).ok) return
    } catch {
      // Vite preview is still starting.
    }
    await wait(100)
  }
  throw new Error(`Vite preview did not start at ${baseUrl}`)
}

let browser
try {
  await waitForPreview()
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })
  const results = []
  for (const expected of expectedCards) {
    results.push({
      positive: await runPositivePath(browser, expected),
      negative: await runNegativePath(browser, expected),
      generic: {
        positive: await runGenericCardRoute(browser, expected, true),
        negative: await runGenericCardRoute(browser, expected, false),
      },
    })
  }
  console.log(JSON.stringify({
    browser: 'playwright',
    scope: 'BS8 formal EXTRA Deck entry-condition A/B',
    cards: results,
  }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  server.kill()
}
