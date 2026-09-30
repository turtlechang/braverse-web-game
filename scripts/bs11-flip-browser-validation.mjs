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
const cards = [
  'BS11-003', 'BS11-005', 'BS11-019', 'BS11-020', 'BS11-039', 'BS11-040',
  'BS11-057', 'BS11-059', 'BS11-075', 'BS11-076',
  'BS11-093', 'BS11-095', 'BS11-096', 'BS11-100', 'BS11-101',
]
const discardCards = new Set([
  'BS11-005', 'BS11-019', 'BS11-039', 'BS11-059', 'BS11-076',
  'BS11-093', 'BS11-096', 'BS11-101',
])
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
const countOf = (value) => Number(value?.match(/-?\d+/)?.[0])

const publicState = async (page) => page.evaluate(() => {
  const readField = (side) => {
    const root = document.querySelector(`.${side}-field`)
    if (!root) return null
    const text = (selector) => root.querySelector(selector)?.textContent?.trim() ?? null
    return {
      hand: text('.row-stat-hand .row-stat-value'),
      deck: text('.deck-zone .resource-summary > strong'),
      trash: text('button.discard-zone.resource-summary > strong'),
      battle: [...root.querySelectorAll('.combat-card-wrap')].map((entry) => ({
        name: entry.querySelector('.card-face')?.getAttribute('title') ?? null,
        hp: entry.querySelector('.badge-hp')?.textContent?.trim() ?? null,
      })),
    }
  }
  return { bottom: readField('bottom'), top: readField('top') }
})

const waitForTrace = async (page, commandKind) => {
  await page.waitForFunction(
    (kind) => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === kind),
    commandKind,
    { timeout: 10_000 },
  )
}

const waitForFlipToClose = async (page) => {
  await page.waitForFunction(() => {
    const modal = document.querySelector('.flip-response-modal')
    return !modal || getComputedStyle(modal).display === 'none' || modal.getClientRects().length === 0
  })
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

const openRoute = async (page, cardNumber, positive) => {
  const route = `bs11-flip:${cardNumber}:${positive ? 'positive' : 'negative'}`
  await page.goto(
    `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${encodeURIComponent(cardNumber)}`,
    { waitUntil: 'domcontentloaded' },
  )
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await page.locator('.flip-response-modal').waitFor({ state: 'visible' })
  await wait(200)
  return route
}

const resolveCase = async (page, cardNumber, positive, evidence) => {
  const expected = candidateCards.get(cardNumber)
  if (!expected) throw new Error(`Missing candidate metadata for ${cardNumber}`)
  const modal = page.locator('.flip-response-modal').last()
  const art = await readCardArt(modal.locator('.flip-reveal-card').first())
  assertArt(art, expected)
  const modalText = await modal.innerText()
  assert.match(modalText, new RegExp(expected.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  if (discardCards.has(cardNumber)) {
    assert.match(modalText, /Discard 1 card|棄置 1 張手牌/)
  } else {
    assert.match(modalText, /Draw up to 1 card|最多抽 1 張牌/)
  }
  evidence.before = await publicState(page)
  const beforeHand = countOf(evidence.before.bottom.hand)
  const beforeDeck = countOf(evidence.before.bottom.deck)

  if (positive) {
    if (discardCards.has(cardNumber)) {
      const payment = modal.locator('.flip-card-page button')
      assert.equal(await payment.count(), 1, `${cardNumber} must expose one hand payment card`)
      await payment.first().click({ force: true })
      assert.equal(await modal.getByRole('button', { name: '發動 FLIP', exact: true }).isEnabled(), true)
      await modal.getByRole('button', { name: '發動 FLIP', exact: true }).click({ force: true })
    } else {
      await modal.getByRole('button', { name: '發動 FLIP', exact: true }).click({ force: true })
      const drawModal = page.locator('.draw-up-to-modal').last()
      await drawModal.waitFor({ state: 'visible' })
      await drawModal.locator('.draw-up-to-option').filter({ hasText: '抽 1 張' }).click({ force: true })
      await drawModal.getByRole('button', { name: '抽取 1 張牌', exact: true }).click({ force: true })
      await waitForTrace(page, 'resolve-draw-up-to')
    }
  } else {
    if (discardCards.has(cardNumber)) {
      assert.equal(await modal.locator('.flip-card-page button').count(), 0, `${cardNumber} negative route must have no discard payment`)
      assert.equal(await modal.getByRole('button', { name: '發動 FLIP', exact: true }).isEnabled(), false)
    }
    await modal.getByRole('button', { name: '不發動', exact: true }).click({ force: true })
  }

  await waitForTrace(page, 'resolve-flip')
  await waitForFlipToClose(page)
  const after = await publicState(page)
  evidence.after = after
  const afterHand = countOf(after.bottom.hand)
  const afterDeck = countOf(after.bottom.deck)
  if (positive && discardCards.has(cardNumber)) {
    assert.equal(afterHand, beforeHand - 1)
    assert.equal(afterDeck, beforeDeck - 1)
  } else if (positive) {
    assert.equal(afterHand, beforeHand + 1)
    assert.equal(afterDeck, beforeDeck - 1)
  } else {
    assert.equal(afterHand, beforeHand)
    assert.equal(afterDeck, beforeDeck)
  }
  const trace = await readTrace(page)
  assert.ok(trace.some((entry) => entry.commandKind === 'resolve-next-damage'))
  const flipTrace = trace.find((entry) => entry.commandKind === 'resolve-flip')
  assert.ok(flipTrace)
  const flipTraceText = `${flipTrace.summary ?? ''} ${flipTrace.steps?.join(' ') ?? ''}`
  if (positive) {
    assert.match(flipTraceText, /發動了|已發動/)
    assert.doesNotMatch(flipTraceText, /不發動|未執行/)
  } else {
    assert.match(flipTraceText, /不發動|未執行/)
  }
  evidence.art = art
  evidence.traceKinds = trace.map((entry) => entry.commandKind)
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
          await resolveCase(page, cardNumber, positive, result)
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
  const outputDir = resolve(root, 'test-results/bs11-flip-browser')
  await mkdir(outputDir, { recursive: true })
  const outputPath = resolve(outputDir, `bs11-flip-browser-${Date.now()}.json`)
  const artifact = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    scope: 'BS11-003／005／019／020／039／040／057／059／075／076／093／095／096／100／101 candidate simple FLIP Browser A/B: real attack reveal, discard or draw-up-to, exact art/fallback; not formal or online acceptance',
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
