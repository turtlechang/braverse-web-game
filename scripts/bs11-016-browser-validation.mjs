import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
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

const candidateDocument = JSON.parse(await readFile(
  resolve(root, 'data/cards/official-dark-enchantress-war-bs11.en.json'),
  'utf8',
))
const candidateCards = new Map(candidateDocument.cards.map((card) => [card.cardNumber, card]))
const cards = ['BS11-016', 'BS11-016@1']
const viewports = [
  { width: 1280, height: 720 },
  { width: 1164, height: 777 },
]
const baseUrl = process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'
const browserExecutable =
  process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find((candidate) => existsSync(candidate))

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
      fallback: false,
    }
  }
  return {
    alt: null,
    src: null,
    loaded: false,
    fallback: true,
    fallbackText: await cardFace.locator('.card-fallback').innerText().catch(() => ''),
  }
}

const assertArt = (art, expected) => {
  assert.equal(art.loaded, true, `${expected.name} official image must load`)
  assert.equal(art.alt, expected.name)
  assert.equal(art.src, expected.imageUrl)
}

const waitForTrace = async (page, commandKind) => {
  await page.waitForFunction(
    (kind) => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === kind),
    commandKind,
    { timeout: 10_000 },
  )
}

const openRoute = async (page, cardNumber, positive) => {
  const route = `bs11-016-hp-total:${cardNumber}:${positive ? 'positive' : 'negative'}`
  await page.goto(
    `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=BS11-016`,
    { waitUntil: 'domcontentloaded' },
  )
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await wait(250)
  return route
}

const settle = async (page, cardNumber, positive) => {
  const expected = candidateCards.get(cardNumber)
  if (!expected) throw new Error(`Missing candidate metadata for ${cardNumber}`)
  const source = page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator(`.card-face img[alt="${expected.name}"]`),
  }).first()
  await source.waitFor({ state: 'visible' })
  const art = await readCardArt(source.locator('.card-face').first())
  assertArt(art, expected)
  const skill = source.locator('.skill-action').first()

  if (!positive) {
    assert.equal(await skill.isDisabled(), true, `${cardNumber} negative route must block the total HP cost`)
    assert.match(await page.locator('body').innerText(), /能量不足|HP|不足|沒有足夠/)
    const trace = await readTrace(page)
    assert.equal(trace.some((entry) => entry.commandKind === 'begin-activate-skill'), false)
    return { art, traceKinds: trace.map((entry) => entry.commandKind), evidence: 'one-red-hp-insufficient' }
  }

  await skill.click({ force: true })
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
  await panel.waitFor({ state: 'visible' })
  const hpCandidates = panel.locator('.effect-candidates-hp-cost button:not(:disabled)')
  assert.equal(await hpCandidates.count(), 2, `${cardNumber} must expose two red Cookie HP candidates`)
  await hpCandidates.nth(0).click({ force: true })
  await hpCandidates.nth(1).click({ force: true })
  assert.match(await panel.innerText(), /合計 2 張 HP 費用/)
  await panel.locator('.effect-panel-primary-action').click({ force: true })
  await waitForTrace(page, 'resolve-ability-effect')

  const sourceStack = page.locator('.bottom-field .hp-card-stack[aria-label*="Fire Spirit Cookie HP 卡 1 張"]')
  await sourceStack.waitFor({ state: 'visible' })
  assert.equal(
    await page.locator('.bottom-field .combat-card-wrap').filter({ hasText: 'self-extra-1' }).count(),
    0,
    `${cardNumber} companion must faint after paying its one HP`,
  )
  await page.locator('.top-field .hp-card-stack[aria-label*="opp-lv1 HP 卡 5 張"]').waitFor({ state: 'visible' })
  await page.locator('.top-field .hp-card-stack[aria-label*="opp-lv3 HP 卡 4 張"]').waitFor({ state: 'visible' })
  const trace = await readTrace(page)
  assert.ok(trace.some((entry) => entry.commandKind === 'begin-activate-skill'))
  return {
    art,
    traceKinds: trace.map((entry) => entry.commandKind),
    evidence: 'two-cookie-total-hp-payment-and-opponent-damage-all',
  }
}

const browser = await chromium.launch({
  headless: true,
  ...(browserExecutable ? { executablePath: browserExecutable } : {}),
})
const output = []
try {
  for (const viewport of viewports) {
    for (const cardNumber of cards) {
      for (const positive of [true, false]) {
        const page = await browser.newPage({ viewport })
        await routeBs11OfficialArt(page)
        page.setDefaultTimeout(10_000)
        const errors = recordBrowserErrors(page)
        const result = { viewport, cardNumber, positive, status: 'FAIL' }
        try {
          result.route = await openRoute(page, cardNumber, positive)
          result.evidence = await settle(page, cardNumber, positive)
          assert.deepEqual(errors, [], `Browser errors: ${errors.join('; ')}`)
          result.status = 'PASS'
        } catch (error) {
          result.error = error instanceof Error ? error.message : String(error)
          result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 8000)
          result.traceKinds = (await readTrace(page).catch(() => [])).map((entry) => entry.commandKind)
        }
        output.push(result)
        console.log(
          result.status,
          cardNumber,
          positive ? 'positive' : 'negative',
          `${viewport.width}x${viewport.height}`,
          result.error ?? '',
        )
        await page.close()
      }
    }
  }
  const outputDir = resolve(root, 'test-results/bs11-016-hp-total-browser')
  await mkdir(outputDir, { recursive: true })
  const outputPath = resolve(outputDir, `bs11-016-hp-total-browser-${Date.now()}.json`)
  const artifact = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    scope: 'BS11-016／016@1 promoted-pool test-state Browser A/B: total red Cookie HP payment, multi-Cookie faint handling, damage-all, exact art/fallback; not formal deck or online acceptance',
    summary: {
      total: output.length,
      passed: output.filter((entry) => entry.status === 'PASS').length,
      failed: output.filter((entry) => entry.status === 'FAIL').length,
    },
    results: output,
  }
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ ...artifact, artifactPath: outputPath }, null, 2))
  process.exitCode = artifact.summary.failed > 0 ? 1 : 0
} finally {
  await browser.close()
}
