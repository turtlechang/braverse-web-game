import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { routeBs11OfficialArt } from './bs11-official-art-route.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES
    ? [process.env.PLAYWRIGHT_NODE_MODULES]
    : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const baseUrl = process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'
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

const cards = {
  'BS11-106': {
    name: 'World-reflecting Mirrors',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/_I73iazY78b2sWRyAtDmag.webp',
  },
  'BS11-107': {
    name: 'Oven of Burning Fate',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/ARwMyn3y-oHMItsNSL8UxA.webp',
  },
  'BS11-110': {
    name: 'Draining Magic Circle',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/CCl_jjFIF2i4Hoth6g7UhA.webp',
  },
}

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const readTrace = (page) => page.evaluate(() => window.__braverseContractTrace ?? [])

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
    errors.push(`console: ${text}`)
  })
  return errors
}

const readCardArt = async (cardFace) => {
  await cardFace.waitFor({ state: 'visible' })
  const image = cardFace.locator('img').first()
  if (await image.count()) {
    return {
      alt: await image.getAttribute('alt'),
      src: await image.getAttribute('src'),
      loaded: await image.evaluate((node) => node.complete && node.naturalWidth > 0),
    }
  }
  return {
    alt: null,
    src: null,
    loaded: false,
    fallback: (await cardFace.locator('.card-fallback').count()) > 0,
  }
}

const assertArt = (art, expected) => {
  assert.ok(art.src || art.fallback, `${expected.name} must render art or a named fallback`)
  if (art.src) {
    assert.equal(art.alt, expected.name)
    assert.equal(art.src, expected.imageUrl)
  }
}

const openRoute = async (page, cardNumber, positive) => {
  const route = `bs11-106-107-110-condition:${cardNumber}:${positive ? 'positive' : 'negative'}`
  await page.goto(
    `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${cardNumber}`,
    { waitUntil: 'domcontentloaded' },
  )
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await wait(220)
  return route
}

const visibleEffectPanel = (page) =>
  page.locator('.effect-panel[role="alertdialog"]:visible').first()

const settleItem = async (page, positive, expected) => {
  const hand = page.locator(`.bottom-hand .hand-card-wrap:has(.hand-card[title="${expected.name}"])`).first()
  await hand.waitFor({ state: 'visible' })
  const art = await readCardArt(hand.locator('.card-face').first())
  assertArt(art, expected)
  await hand.locator('.hand-card').click()
  const use = hand.locator('.hand-card-action').filter({ hasText: '使用' }).first()

  if (!positive) {
    assert.equal(await use.count(), 0, 'BS11-107 unmet level condition must not expose 使用')
    assert.match(await page.locator('body').innerText(), /目前不符合|條件不成立|不能使用/)
    return { art, traceKinds: (await readTrace(page)).map((entry) => entry.commandKind) }
  }

  await use.waitFor({ state: 'visible' })
  assert.equal(await use.isEnabled(), true)
  await use.click({ force: true })
  const panel = visibleEffectPanel(page)
  await panel.waitFor({ state: 'visible' })
  const payments = panel.locator('.effect-candidates-payment button:not(.is-selected):not(:disabled)')
  assert.ok((await payments.count()) >= 2, 'BS11-107 must expose two black payment candidates')
  await payments.nth(0).click({ force: true })
  await payments.nth(1).click({ force: true })
  await wait(120)
  const next = panel.getByRole('button', { name: '下一步', exact: true })
  assert.equal(await next.isEnabled(), true, 'BS11-107 payment step must advance')
  await next.click({ force: true })
  await wait(120)

  const target = panel.locator('.effect-candidates-target button:not(.is-selected):not(:disabled)').first()
  assert.equal(await target.count(), 1, 'BS11-107 must expose an opponent Cookie target')
  await target.click({ force: true })
  const confirm = panel.locator('.effect-panel-primary-action').first()
  assert.equal(await confirm.isEnabled(), true)
  await confirm.click({ force: true })
  await page.waitForFunction(
    () => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === 'resolve-ability-effect'),
    undefined,
    { timeout: 10_000 },
  )
  const trace = await readTrace(page)
  assert.ok(trace.some((entry) => entry.commandKind === 'begin-play-item'))
  assert.ok(trace.some((entry) => entry.commandKind === 'resolve-ability-effect'))
  return {
    art,
    traceKinds: trace.map((entry) => entry.commandKind),
    traceSteps: trace
      .filter((entry) => ['begin-play-item', 'resolve-ability-effect'].includes(entry.commandKind))
      .flatMap((entry) => entry.steps),
  }
}

const selectTrapTargetSteps = async (response) => {
  const steps = response.locator('.trap-effect-target-step:visible')
  const count = await steps.count()
  for (let index = 0; index < count; index += 1) {
    const target = steps.nth(index).locator('button:not(.is-selected):not(:disabled)').first()
    if (await target.count()) await target.click({ force: true })
  }
  if (count > 0) return count

  const fallback = response.locator('.trap-target-options:visible button:not(.is-selected):not(:disabled)').first()
  if (await fallback.count()) {
    await fallback.click({ force: true })
    return 1
  }
  return 0
}

const settleTrap = async (page, cardNumber, positive, expected) => {
  const response = page.locator('.trap-response-modal:visible').first()
  await response.waitFor({ state: 'visible' })
  const trapButton = response.locator('.modal-card-options > button').filter({ hasText: expected.name }).first()
  assert.equal(await trapButton.count(), 1, `${cardNumber} response must expose its real Trap card`)

  const selectionArt = await readCardArt(trapButton.locator('.card-face').first())
  assertArt(selectionArt, expected)
  await trapButton.click({ force: true })
  await wait(120)

  const energySection = response.locator('.trap-guided-section:visible').filter({ hasText: '能量支付' }).first()
  const energySections = await energySection.count()
  if (cardNumber === 'BS11-106') {
    assert.equal(energySections, positive ? 0 : 1, 'BS11-106 condition must switch between 0K and 1K')
  }
  if (energySections > 0) {
    const payment = energySection.locator('.trap-discard-options button:not(.is-selected):not(:disabled)').first()
    assert.equal(await payment.count(), 1, `${cardNumber} must expose a legal black payment`)
    await payment.click({ force: true })
    const next = response.getByRole('button', { name: '下一步', exact: true })
    assert.equal(await next.isEnabled(), true, `${cardNumber} energy step must advance`)
    await next.click({ force: true })
    await wait(100)
  }

  // The Then target is marked previousEffectTargetOnly, so the UI asks for
  // one target and the rules layer reuses that same selection for the second
  // modifier when the condition is met.
  const expectedTargetSteps = 1
  const targetSteps = await selectTrapTargetSteps(response)
  assert.equal(targetSteps, expectedTargetSteps, `${cardNumber} must expose the condition-specific target sequence`)

  const primary = response.getByRole('button', { name: /下一步|確認發動/, exact: false }).last()
  assert.equal(await primary.isEnabled(), true, `${cardNumber} Trap response must be confirmable`)
  await primary.click({ force: true })
  await page.waitForFunction(
    () => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === 'play-trap'),
    undefined,
    { timeout: 10_000 },
  )
  const trace = await readTrace(page)
  assert.ok(trace.some((entry) => entry.commandKind === 'play-trap'))
  const attackerCardText = await page
    .locator('.top-field .combat-card-wrap')
    .filter({ hasText: 'trap-attacker' })
    .first()
    .innerText()
    .catch(() => '')
  const displayedAttack = Number(attackerCardText.match(/\n(\d+)\s*$/)?.[1] ?? NaN)
  assert.equal(
    displayedAttack,
    cardNumber === 'BS11-110' ? (positive ? 4 : 5) : 5,
    `${cardNumber} must render its condition-specific attack modifier`,
  )
  return {
    art: selectionArt,
    traceKinds: trace.map((entry) => entry.commandKind),
    traceSteps: trace
      .filter((entry) => entry.commandKind === 'play-trap')
      .flatMap((entry) => entry.steps),
    targetSteps,
    energySections,
    attackerCardText,
  }
}

const browser = await chromium.launch({
  headless: true,
  ...(browserExecutable ? { executablePath: browserExecutable } : {}),
})
const output = []
try {
  for (const viewport of viewports) {
    for (const cardNumber of Object.keys(cards)) {
      for (const positive of [true, false]) {
        const page = await browser.newPage({ viewport })
        await routeBs11OfficialArt(page)
        page.setDefaultTimeout(10_000)
        const errors = recordBrowserErrors(page)
        const result = {
          viewport,
          cardNumber,
          positive,
          status: 'FAIL',
        }
        try {
          result.route = await openRoute(page, cardNumber, positive)
          result.evidence = cardNumber === 'BS11-107'
            ? await settleItem(page, positive, cards[cardNumber])
            : await settleTrap(page, cardNumber, positive, cards[cardNumber])
          assert.deepEqual(errors, [], `Browser errors: ${errors.join('; ')}`)
          result.status = 'PASS'
        } catch (error) {
          result.error = error instanceof Error ? error.message : String(error)
          result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 7000)
          result.traceKinds = (await readTrace(page).catch(() => [])).map((entry) => entry.commandKind)
        }
        output.push(result)
        console.log(result.status, cardNumber, positive ? 'positive' : 'negative', `${viewport.width}x${viewport.height}`, result.error ?? '')
        await page.close()
      }
    }
  }
  const outputDir = resolve(root, 'test-results/bs11-106-107-110-browser')
  await mkdir(outputDir, { recursive: true })
  const outputPath = resolve(outputDir, `bs11-106-107-110-browser-${Date.now()}.json`)
  await writeFile(outputPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseUrl,
    scope: 'BS11-106／107／110 localhost Browser A/B: battle-area condition, Trap payment/target, Item payment/target; not formal or online acceptance',
    summary: {
      total: output.length,
      passed: output.filter((entry) => entry.status === 'PASS').length,
      failed: output.filter((entry) => entry.status === 'FAIL').length,
    },
    results: output,
  }, null, 2))
  console.log(outputPath)
  process.exitCode = output.some((entry) => entry.status === 'FAIL') ? 1 : 0
} finally {
  await browser.close()
}
