import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * Browser A/B staging for every BS10 candidate EXTRA record.  The routes are
 * localhost-only fixtures; they exercise the real EXTRA readiness selector,
 * printed entry costs, and the public `play-extra-deck-cookie` command while
 * keeping the candidate inventory out of the formal card pool.
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

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4186)
const viewport = {
  width: Number(process.env.BRAVERSE_TEST_WIDTH ?? 1440),
  height: Number(process.env.BRAVERSE_TEST_HEIGHT ?? 960),
}
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
const cardFilter = process.argv.find((arg) => arg.startsWith('--card='))?.slice(7)
const expectedCards = [
  { cardNumber: 'BS10-024', name: 'Hollyberry Cookie', imageUrl: 'https://cookierunbraverse.com/data/en_storage/4jbOOsyl18jcb3pEqwgTGg.webp', extraCost: 1, instanceId: 'bs10-bs10-024-demo-extra' },
  { cardNumber: 'BS10-024@1', name: 'Hollyberry Cookie', imageUrl: 'https://cookierunbraverse.com/data/en_storage/KjCGRFoCjSMo-x0hZvYnbg.webp', extraCost: 1, instanceId: 'bs10-bs10-024-1-demo-extra' },
  { cardNumber: 'BS10-024@2', name: 'Hollyberry Cookie', imageUrl: 'https://cookierunbraverse.com/data/en_storage/PMzietDRGkGgEIAhMXTElA.webp', extraCost: 1, instanceId: 'bs10-bs10-024-2-demo-extra' },
  { cardNumber: 'BS10-048', name: 'Warden of the Heart', imageUrl: 'https://cookierunbraverse.com/data/en_storage/hJZcyr8AEGlJHzcWuOskSA.webp', extraCost: 0, instanceId: 'bs10-bs10-048-demo-extra' },
  { cardNumber: 'BS10-048@1', name: 'Warden of the Heart', imageUrl: 'https://cookierunbraverse.com/data/en_storage/ZsVxLIdjro8oOLytHov-6Q.webp', extraCost: 0, instanceId: 'bs10-bs10-048-1-demo-extra' },
  { cardNumber: 'BS10-073', name: 'White Lily Cookie', imageUrl: 'https://cookierunbraverse.com/data/en_storage/yVJ4j7b5ZO0A1uhHSYmQzw.webp', extraCost: 0, instanceId: 'bs10-bs10-073-demo-extra' },
  { cardNumber: 'BS10-073@1', name: 'White Lily Cookie', imageUrl: 'https://cookierunbraverse.com/data/en_storage/lyLQmQzztvHAoTiYmeHMxg.webp', extraCost: 0, instanceId: 'bs10-bs10-073-1-demo-extra' },
  { cardNumber: 'BS10-073@2', name: 'White Lily Cookie', imageUrl: 'https://cookierunbraverse.com/data/en_storage/olOZiU0Y2v2FxOl6yWDUrQ.webp', extraCost: 0, instanceId: 'bs10-bs10-073-2-demo-extra' },
  { cardNumber: 'BS10-098', name: 'Jagae Cookie', imageUrl: 'https://cookierunbraverse.com/data/en_storage/xLa7P5r7O25mR7JXpLy8CQ.webp', extraCost: 2, instanceId: 'bs10-bs10-098-demo-extra' },
  { cardNumber: 'BS10-098@1', name: 'Jagae Cookie', imageUrl: 'https://cookierunbraverse.com/data/en_storage/ZOY1qtckiPwRVziyUKIXPw.webp', extraCost: 2, instanceId: 'bs10-bs10-098-1-demo-extra' },
  { cardNumber: 'BS10-123', name: 'Spectral Warmaster', imageUrl: 'https://cookierunbraverse.com/data/en_storage/bjTKbAb0ih33aoCRM_83gA.webp', extraCost: 2, instanceId: 'bs10-bs10-123-demo-extra' },
  { cardNumber: 'BS10-123@1', name: 'Spectral Warmaster', imageUrl: 'https://cookierunbraverse.com/data/en_storage/T4sYqCSHkvHZcEKuMNQnBg.webp', extraCost: 2, instanceId: 'bs10-bs10-123-1-demo-extra' },
].filter((card) => !cardFilter || card.cardNumber === cardFilter)
assert.ok(expectedCards.length, 'Unknown BS10 EXTRA card filter')

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
    ) return
    errors.push(`console: ${text} (${location.url || 'unknown URL'})`)
  })
  return errors
}

const visible = async (locator) =>
  (await locator.count()) > 0 && (await locator.first().isVisible().catch(() => false))
const enabled = async (locator) =>
  (await visible(locator)) && (await locator.first().isEnabled().catch(() => false))
const readTrace = (page) => page.evaluate(() => window.__braverseContractTrace ?? [])

const skipAnimations = async (page) => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) {
      await skip.click({ force: true })
      await wait(120)
      continue
    }
    await wait(120)
  }
}

const waitForEffectPanel = async (page) => {
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').first()
  await panel.waitFor({ state: 'visible' })
  return panel
}

const settleEffectPanel = async (page, panel) => {
  await skipAnimations(page)
  await panel.waitFor({ state: 'hidden', timeout: 12000 }).catch(() => {})
  await skipAnimations(page)
}

const runExtraSkillWitness = async (page, expected) => {
  const source = page.locator(
    `.bottom-field .combat-card-wrap[data-card-instance-id="${expected.instanceId}"] .skill-action`,
  ).first()
  await source.waitFor({ state: 'visible' })
  assert.ok(await enabled(source), `${expected.cardNumber} Activate skill must be enabled after entry`)
  await source.click({ force: true })
  let panel = await waitForEffectPanel(page)

  if (expected.cardNumber.startsWith('BS10-048')) {
    const payment = panel.locator('.effect-candidates-payment button').first()
    await payment.click()
    const next = panel.getByRole('button', { name: '下一步', exact: true })
    if (await visible(next)) await next.click()
    panel = await waitForEffectPanel(page)
    const targets = panel.locator('.effect-candidates-target button')
    const targetCount = await targets.count()
    assert.ok(targetCount > 0, `${expected.cardNumber} must expose sequential damage targets`)
    for (let index = 0; index < targetCount; index += 1) {
      await targets.nth(index).click()
    }
    await panel.getByRole('button', { name: '確認發動', exact: true }).click()
    await settleEffectPanel(page, panel)
    const trace = await readTrace(page)
    assert.ok(trace.some((entry) => entry.commandKind === 'begin-activate-skill'), `${expected.cardNumber} must leave a begin-activate-skill trace`)
    assert.ok(trace.some((entry) => entry.commandKind === 'resolve-ability-effect'), `${expected.cardNumber} must resolve its sequential damage effect`)
    return 'activate-sequential-damage-all'
  }

  if (expected.cardNumber.startsWith('BS10-098')) {
    const discard = panel.locator('button').filter({ hasText: /bs10-098-hand-1/ }).first()
    await discard.click()
    await panel.getByRole('button', { name: '下一步', exact: true }).click()
    panel = await waitForEffectPanel(page)
    const target = panel.locator('.effect-candidates-target button').first()
    assert.ok(await visible(target), `${expected.cardNumber} Activate must expose a Cookie target`)
    await target.click()
    await panel.getByRole('button', { name: '確認發動', exact: true }).click()
    await settleEffectPanel(page, panel)
    const trace = await readTrace(page)
    assert.ok(trace.some((entry) => entry.commandKind === 'begin-activate-skill'), `${expected.cardNumber} must leave a begin-activate-skill trace`)
    assert.ok(trace.some((entry) => entry.commandKind === 'resolve-ability-effect'), `${expected.cardNumber} must resolve its Activate target effect`)
    return 'activate-discard-and-target'
  }

  throw new Error(`No BS10 EXTRA skill witness is defined for ${expected.cardNumber}`)
}

const runExtraAttackWitness = async (page, expected) => {
  const source = page.locator(
    `.bottom-field .combat-card-wrap[data-card-instance-id="${expected.instanceId}"] .card-face.is-attackable`,
  ).first()
  assert.ok(await enabled(source), `${expected.cardNumber} attack source must be attackable after entry`)
  await source.click({ force: true })
  for (let index = 0; index < 3; index += 1) {
    const payment = page.locator(
      '.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)',
    ).last()
    assert.ok(await visible(payment), `${expected.cardNumber} attack must expose purple payment ${index + 1}`)
    await payment.focus()
    await payment.press('Enter')
  }
  const target = page.locator('.top-field .combat-card-wrap .card-face.is-targetable').first()
  assert.ok(await enabled(target), `${expected.cardNumber} attack must expose an opponent target`)
  await target.click({ force: true })
  await skipAnimations(page)
  const panel = await waitForEffectPanel(page)
  await panel.getByRole('button', { name: '確認發動', exact: true }).click()
  await settleEffectPanel(page, panel)
  const trace = await readTrace(page)
  assert.ok(trace.some((entry) => entry.commandKind === 'resolve-attack-effect'), `${expected.cardNumber} must resolve its attack Then effect`)
  assert.equal(
    await page.locator(`[data-card-instance-id="${expected.instanceId}"]`).count(),
    0,
    `${expected.cardNumber} attack Then must move the source Cookie to trash`,
  )
  return 'attack-then-source-to-trash'
}

const assertExtraCardPreview = async (entry, expected) => {
  const preview = entry.locator('.extra-deck-card-image')
  await preview.waitFor({ state: 'visible' })
  await preview.locator('img, .card-fallback').first().waitFor({ state: 'attached' })
  // Image-load failures can replace the <img> with the visual fallback while
  // the page is still settling.  Read both branches from one DOM snapshot so
  // a React replacement cannot make the following assertions race.
  const previewState = await preview.evaluate((node) => {
    const image = node.querySelector('img')
    const fallback = node.querySelector('.card-fallback')
    return {
      image: image
        ? { alt: image.getAttribute('alt'), src: image.getAttribute('src') }
        : null,
      hasFallback: Boolean(fallback),
    }
  })
  const imageCount = previewState.image ? 1 : 0
  const fallbackCount = previewState.hasFallback ? 1 : 0
  assert.ok(
    imageCount === 1 || fallbackCount === 1,
    `${expected.cardNumber} must render official art or its visual fallback`,
  )
  if (imageCount === 1) {
    assert.match(previewState.image.alt ?? '', new RegExp(expected.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.equal(
      previewState.image.src,
      expected.imageUrl,
      `${expected.cardNumber} must use the reviewed official image URL`,
    )
    return 'official-image'
  }
  return 'visual-fallback'
}

const openEntry = async (page, expected, conditionMet) => {
  const dock = page.getByLabel('玩家 EXTRA Deck 1 張')
  await dock.waitFor({ state: 'visible' })
  assert.equal(
    await dock.getAttribute('data-extra-deck-ready'),
    String(conditionMet),
    `${expected.cardNumber} must expose rule-derived readiness=${conditionMet}`,
  )
  if (conditionMet) assert.match((await dock.getAttribute('class')) ?? '', /is-extra-deck-ready/)
  else assert.doesNotMatch((await dock.getAttribute('class')) ?? '', /is-extra-deck-ready/)
  await dock.click()
  const dialog = page.getByRole('dialog', { name: '玩家 EXTRA Deck' })
  await dialog.waitFor({ state: 'visible' })
  const entry = dialog
    .locator('.extra-deck-card-entry')
    .filter({ hasText: expected.cardNumber.split('@')[0] })
  await entry.waitFor({ state: 'visible' })
  assert.match(await entry.innerText(), new RegExp(expected.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  const imageEvidence = await assertExtraCardPreview(entry, expected)
  return { dock, dialog, entry, imageEvidence }
}

const payExtraEntryCost = async (page, expected) => {
  if (!expected.extraCost) return false
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').first()
  await panel.getByRole('button', { name: '支付代價', exact: true }).click()
  const cost = panel.locator('.optional-cost-col').filter({ hasText: /選擇 .*張手牌棄置/ }).first()
  assert.equal(await cost.locator('button').count(), expected.extraCost)
  for (let index = 0; index < expected.extraCost; index += 1) {
    await cost.locator('button').nth(index).click()
  }
  await panel.getByRole('button', { name: '確認', exact: true }).click()
  return true
}

const resolveHollyberryOnPlay = async (page) => {
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').first()
  await panel.getByRole('button', { name: '確認發動', exact: true }).click()
  await panel.waitFor({ state: 'hidden' })
}

const runPositive = async (browser, expected) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(8000)
  const errors = recordBrowserErrors(page)
  const route = `bs10-extra-deck:${expected.cardNumber}:met`
  try {
    await page.goto(`${baseUrl}?test-state=${encodeURIComponent(route)}&contract-card=${encodeURIComponent(expected.cardNumber.split('@')[0])}`, { waitUntil: 'domcontentloaded' })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    const { entry, imageEvidence } = await openEntry(page, expected, true)
    const play = entry.getByRole('button', { name: '從 EXTRA 登場', exact: true })
    assert.ok(await enabled(play), `${expected.cardNumber} positive route must permit EXTRA entry`)
    await play.click()
    const paid = await payExtraEntryCost(page, expected)
    if (expected.cardNumber.startsWith('BS10-024')) {
      await page.locator('.effect-panel[role="alertdialog"]:visible').first().getByText('OnPlay 登場', { exact: true }).waitFor({ state: 'visible' })
      await resolveHollyberryOnPlay(page)
    }
    const materialized = page.locator(`.bottom-field [data-card-instance-id="${expected.instanceId}"] > .card-face`)
    await materialized.waitFor({ state: 'visible' })
    await page.waitForFunction(() => document.querySelector('[aria-label="玩家 EXTRA Deck 0 張"]'))
    const witness = expected.cardNumber.startsWith('BS10-048') || expected.cardNumber.startsWith('BS10-098')
      ? await runExtraSkillWitness(page, expected)
      : expected.cardNumber.startsWith('BS10-123')
        ? await runExtraAttackWitness(page, expected)
        : null
    const trace = await readTrace(page)
    assert.ok(trace.some((entry) => entry.commandKind === 'play-extra-deck-cookie'), `${expected.cardNumber} must leave a play-extra-deck-cookie trace`)
    if (paid) assert.ok(trace.some((entry) => entry.commandKind === 'resolve-optional-cost-attack'), `${expected.cardNumber} must leave its entry-cost payment trace`)
    if (expected.cardNumber.startsWith('BS10-024')) assert.ok(trace.some((entry) => entry.commandKind === 'resolve-ability-effect'), 'BS10-024 On Play must resolve through the effect command')
    assert.deepEqual(errors, [], `browser errors for ${expected.cardNumber}: ${errors.join('; ')}`)
    return { cardNumber: expected.cardNumber, route, ready: true, enteredBattle: true, imageEvidence, paidEntryCost: paid, witness, trace }
  } finally {
    await page.close()
  }
}

const runNegative = async (browser, expected) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(8000)
  const errors = recordBrowserErrors(page)
  const route = `bs10-extra-deck:${expected.cardNumber}:unmet`
  try {
    await page.goto(`${baseUrl}?test-state=${encodeURIComponent(route)}&contract-card=${encodeURIComponent(expected.cardNumber.split('@')[0])}`, { waitUntil: 'domcontentloaded' })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    const { entry, imageEvidence } = await openEntry(page, expected, false)
    assert.equal(await entry.getByRole('button', { name: '從 EXTRA 登場', exact: true }).count(), 0, `${expected.cardNumber} negative route must not expose an entry button`)
    await entry.getByText('目前無法登場').waitFor({ state: 'visible' })
    assert.equal(await page.locator(`[data-card-instance-id="${expected.instanceId}"]`).count(), 0, `${expected.cardNumber} must remain in EXTRA when blocked`)
    assert.deepEqual(errors, [], `browser errors for ${expected.cardNumber}: ${errors.join('; ')}`)
    return { cardNumber: expected.cardNumber, route, ready: false, entryBlocked: true, imageEvidence }
  } finally {
    await page.close()
  }
}

const server = spawn(process.execPath, [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)], { cwd: root, stdio: 'ignore' })
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
  browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) })
  const results = []
  for (const expected of expectedCards) {
    results.push({ positive: await runPositive(browser, expected), negative: await runNegative(browser, expected) })
  }
  const report = {
    browser: 'playwright',
    viewport,
    scope: 'BS10 candidate EXTRA Deck entry-condition A/B, reviewed card art, entry-cost command trace, and high-risk Activate/attack Then witnesses',
    cards: results,
  }
  if (process.env.BRAVERSE_AUDIT_REPORT) await writeFile(process.env.BRAVERSE_AUDIT_REPORT, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser?.close().catch(() => {})
  server.kill()
}
