import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Dedicated BS8-005 acceptance.  This intentionally uses the localhost-only
// EXTRA fixture rather than the Standard card pool, so it cannot make an
// unpromoted candidate legal in a normal deck or online match.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightRoot = process.env.PLAYWRIGHT_NODE_MODULES
const playwrightEntry = require.resolve('playwright', {
  paths: playwrightRoot ? [playwrightRoot] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4181)
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

const hpCount = async (page, zone, instanceIdPrefix) => {
  const pile = page.locator(
    `${zone} [data-card-instance-id^="${instanceIdPrefix}"] .hp-card-stack`,
  )
  await pile.waitFor({ state: 'visible' })
  const label = await pile.getAttribute('aria-label')
  const match = label?.match(/HP 卡 (\d+) 張/)
  assert.ok(match, `HP stack label was missing its count: ${label ?? 'null'}`)
  return Number(match[1])
}

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

const confirmUntargetedEffects = async (page, operation, count = 1) => {
  const panel = page.locator('.effect-panel[role="alertdialog"]').first()
  await panel.waitFor({ state: 'visible' })
  for (let index = 0; index < count; index += 1) {
    const confirm = panel.locator('.effect-panel-primary-action').first()
    assert.ok(
      await enabled(confirm),
      `${operation} effect ${index + 1}/${count} must expose an enabled confirm action`,
    )
    await confirm.click({ force: true })
    if (index + 1 < count) {
      await panel.waitFor({ state: 'visible' })
      await wait(120)
    }
  }
  await panel.waitFor({ state: 'hidden' })
}

const selectAttackPayment = async (page, operations) => {
  for (let index = 0; index < 3; index += 1) {
    const payment = page
      .locator(
        '.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)',
      )
      .last()
    assert.ok(await enabled(payment), 'Avatar must expose an active Red support payment')
    await payment.focus()
    await payment.press('Enter')
    operations.push('select:attack-payment')
    await wait(100)
  }
  const panel = page.getByTestId('attack-payment-panel')
  await panel.waitFor({ state: 'visible' })
  assert.match(
    await panel.innerText(),
    /已選 3／3 張支援卡[\s\S]*付款合法/,
    'Avatar requires exactly three legal Red attack payments',
  )
}

const runPositivePath = async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  page.setDefaultTimeout(7000)
  const errors = recordBrowserErrors(page)
  const operations = []

  try {
    await page.goto(`${baseUrl}?test-state=bs8-extra-deck:met`, {
      // Card artwork is intentionally fetched from official storage and may
      // be blocked in the Browser sandbox, so networkidle is not a reliable
      // readiness signal for this localhost fixture.
      waitUntil: 'domcontentloaded',
    })
    await page.locator('.game-shell').waitFor({ state: 'visible' })

    assert.equal(await hpCount(page, '.bottom-field', 'player-one-ST1-009'), 3)
    assert.equal(await hpCount(page, '.top-field', 'player-two-ST1-014'), 6)
    assert.equal(
      await page.locator('.bottom-field .support-card-wrap').count(),
      3,
      'fixture must provide three active Red supports for Avatar attack payment',
    )

    const extraDeck = page.getByLabel('玩家 EXTRA Deck 1 張')
    await extraDeck.click({ force: true })
    const extraDialog = page.getByRole('dialog', { name: '玩家 EXTRA Deck' })
    await extraDialog.waitFor({ state: 'visible' })
    const playAvatar = extraDialog.getByRole('button', { name: '從 EXTRA 登場' })
    assert.ok(await enabled(playAvatar), 'met route must permit Avatar EXTRA entry')
    await playAvatar.click({ force: true })
    operations.push('play:extra-avatar')

    const avatar = page.locator(
      '.bottom-field [data-card-instance-id="bs8-005-demo-avatar"] > .card-face',
    )
    await avatar.waitFor({ state: 'visible' })
    await confirmUntargetedEffects(page, 'Avatar On Play')
    operations.push('confirm:on-play-damage-all')

    assert.equal(
      await page.getByLabel('玩家 EXTRA Deck 0 張').count(),
      1,
      'Avatar must leave EXTRA Deck and enter the battle area directly',
    )
    assert.equal(await hpCount(page, '.bottom-field', 'bs8-005-demo-avatar'), 5)
    assert.equal(
      await hpCount(page, '.bottom-field', 'player-one-ST1-009'),
      3,
      'On Play damage must not damage the controller\'s existing Cookie',
    )
    assert.equal(
      await hpCount(page, '.top-field', 'player-two-ST1-014'),
      5,
      'On Play must deal 1 damage to every opponent Cookie',
    )

    assert.ok(await enabled(avatar), 'Avatar must be attackable after entering from EXTRA')
    await avatar.click({ force: true })
    operations.push('select:avatar-attacker')
    await selectAttackPayment(page, operations)

    const target = page.locator(
      '.top-field [data-card-instance-id^="player-two-ST1-014"] > .card-face',
    )
    assert.ok(await enabled(target), 'Avatar must expose the opponent Cookie as attack target')
    await target.click({ force: true })
    operations.push('declare:avatar-attack')

    // "all other Cookies" is represented as opponent damage plus a
    // self-side damage-all that excludes Avatar; both UI effect steps must
    // be confirmed through the real post-attack pending flow.
    await confirmUntargetedEffects(page, 'Avatar attack Then', 2)
    operations.push('confirm:attack-then-damage-all-other')
    await wait(240)

    assert.equal(
      await hpCount(page, '.bottom-field', 'bs8-005-demo-avatar'),
      5,
      'Then must exclude the attacking Avatar itself',
    )
    assert.equal(
      await hpCount(page, '.bottom-field', 'player-one-ST1-009'),
      2,
      'Then must deal 1 damage to the controller\'s other Cookie',
    )
    assert.equal(
      await hpCount(page, '.top-field', 'player-two-ST1-014'),
      1,
      'Then must also deal 1 damage to every other opponent Cookie after battle damage',
    )
    assert.match(
      (await avatar.getAttribute('class')) ?? '',
      /is-rested/,
      'Avatar must be rested after declaring its attack',
    )
    assert.deepEqual(errors, [], `browser errors: ${errors.join('; ')}`)

    return {
      operations,
      enteredBattle: true,
      onPlayOpponentHp: 5,
      then: { avatarHp: 5, ownOtherHp: 2, opponentHp: 1 },
    }
  } finally {
    await page.close()
  }
}

const runBlockedPath = async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  page.setDefaultTimeout(7000)
  const errors = recordBrowserErrors(page)

  try {
    await page.goto(`${baseUrl}?test-state=bs8-extra-deck:unmet`, {
      waitUntil: 'domcontentloaded',
    })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    const extraDeck = page.getByLabel('玩家 EXTRA Deck 1 張')
    await extraDeck.click({ force: true })
    const extraDialog = page.getByRole('dialog', { name: '玩家 EXTRA Deck' })
    await extraDialog.waitFor({ state: 'visible' })
    assert.equal(
      await extraDialog.getByRole('button', { name: '從 EXTRA 登場' }).count(),
      0,
      'unmet route must not expose an EXTRA entry action',
    )
    await extraDialog.getByText('目前無法登場').waitFor({ state: 'visible' })
    assert.equal(
      await page.locator('[data-card-instance-id="bs8-005-demo-avatar"]').count(),
      0,
      'unmet route must keep Avatar outside the battle area',
    )
    assert.deepEqual(errors, [], `browser errors: ${errors.join('; ')}`)
    return { extraDeckCount: 1, entryBlocked: true }
  } finally {
    await page.close()
  }
}

const runCardRouteReadinessHint = async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  page.setDefaultTimeout(7000)
  const errors = recordBrowserErrors(page)

  const inspect = async (route, ready) => {
    await page.goto(`${baseUrl}?test-state=${route}`, {
      waitUntil: 'domcontentloaded',
    })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    const extraDeck = page.getByLabel('玩家 EXTRA Deck 1 張')
    await extraDeck.waitFor({ state: 'visible' })
    const className = (await extraDeck.getAttribute('class')) ?? ''
    const hint = await extraDeck.textContent()

    assert.equal(
      await extraDeck.getAttribute('data-extra-deck-ready'),
      String(ready),
      `${route} must expose its rule-derived EXTRA readiness state`,
    )
    assert.equal(
      className.includes('is-extra-deck-ready'),
      ready,
      `${route} must ${ready ? '' : 'not '}highlight Avatar readiness`,
    )
    assert.equal(
      hint?.includes('EXTRA 可登場') ?? false,
      ready,
      `${route} must ${ready ? '' : 'not '}show the EXTRA entry reminder`,
    )
    const breakZone = page.locator('.bottom-field .break-zone')
    const breakHeading = await breakZone.locator('.zone-heading').textContent()
    const faintedCookieCount = await breakZone.locator('.break-card-wrap').count()
    const expectedFaintedCookieCount = ready ? 2 : 1
    assert.match(
      breakHeading,
      new RegExp(`${expectedFaintedCookieCount} 張`),
      `${route} must expose ${expectedFaintedCookieCount} real fainted Cookies in Break`,
    )
    assert.equal(
      faintedCookieCount,
      expectedFaintedCookieCount,
      `${route} must derive readiness from real skill-damage departures`,
    )
    return {
      route,
      ready,
      className,
      hint: hint?.replace(/\s+/g, ' ').trim(),
      faintedCookieCount,
    }
  }

  try {
    const met = await inspect('card:BS8-005', true)
    const unmet = await inspect('card-negative:BS8-005', false)
    assert.deepEqual(errors, [], `browser errors: ${errors.join('; ')}`)
    return { met, unmet }
  } finally {
    await page.close()
  }
}

let browser
try {
  await waitForPreview()
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })
  const positive = await runPositivePath(browser)
  const blocked = await runBlockedPath(browser)
  const readinessHint = await runCardRouteReadinessHint(browser)
  console.log(JSON.stringify({
    card: 'BS8-005',
    browser: 'playwright',
    positive,
    blocked,
    readinessHint,
  }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  server.kill()
}
