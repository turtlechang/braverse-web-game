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
  'BS11-103': {
    name: 'Skelecake Bomber',
    sourceId: 'bs11-103-demo-source',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/g8WOoSpg75x92uKdxn0rsg.webp',
  },
  'BS11-104': {
    name: 'Cake Witch',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/nK7RO9x9uhYgNvXUCTx6CQ.webp',
  },
  'BS11-109': {
    name: 'Emblem of Darkness',
    sourceId: 'bs11-109-demo-source',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/agXGJqtnVpn1D4NAwabzkw.webp',
  },
}

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const visible = async (locator) =>
  (await locator.count()) > 0 && (await locator.first().isVisible().catch(() => false))
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
  return { alt: null, src: null, fallback: await cardFace.locator('.card-fallback').count() > 0 }
}

const assertArt = (art, expected) => {
  assert.ok(art.src || art.fallback, `${expected.name} must render art or a named fallback`)
  if (art.src) {
    assert.equal(art.alt, expected.name)
    assert.equal(art.src, expected.imageUrl)
  }
}

const openRoute = async (page, cardNumber, result) => {
  const route = `bs11-103-104-109-inspect:${cardNumber}:${result ? 'positive' : 'negative'}`
  await page.goto(
    `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${cardNumber}`,
    { waitUntil: 'domcontentloaded' },
  )
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await wait(180)
  return route
}

const settleEffectPanel = async (page) => {
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').first()
  if (await panel.count()) {
    const primary = panel.locator('.effect-panel-primary-action').first()
    await primary.waitFor({ state: 'visible' })
    assert.equal(await primary.isEnabled(), true, `effect panel stalled: ${await panel.innerText()}`)
    await primary.click({ force: true })
    await wait(220)
  }
}

const run103 = async (page, positive) => {
  const expected = cards['BS11-103']
  const hand = page.locator(`.bottom-hand .hand-card-wrap:has(.hand-card[title="${expected.name}"])`).first()
  await hand.waitFor({ state: 'visible' })
  const art = await readCardArt(hand.locator('.card-face').first())
  assertArt(art, expected)
  await hand.locator('.hand-card').click()
  const deploy = hand.locator('.hand-card-action').filter({ hasText: '登場' }).first()
  await deploy.waitFor({ state: 'visible' })
  assert.equal(await deploy.isEnabled(), true)
  await deploy.click({ force: true })
  await wait(260)

  if (positive) {
    const panel = page.locator('.effect-panel[role="alertdialog"]:visible').first()
    await panel.waitFor({ state: 'visible' })
    const candidates = panel.locator('.effect-candidates-target button:not(:disabled)')
    assert.equal(await candidates.count(), 1, 'BS11-103 must expose exactly one Special Play Cookie')
    assert.match(await candidates.first().innerText(), /Mold Dough Cookie/)
    await candidates.first().click({ force: true })
    await settleEffectPanel(page)
    await page.locator(`.bottom-hand .hand-card[title="Mold Dough Cookie"]`).waitFor({ state: 'visible' })
  } else {
    await wait(320)
    assert.equal(
      await page.locator('.effect-panel[role="alertdialog"]:visible').count(),
      0,
      'BS11-103 unmet hand condition must auto-skip On Play',
    )
  }

  const trace = await readTrace(page)
  assert.ok(trace.some((entry) => entry.commandKind === 'deploy-cookie'))
  if (positive) {
    assert.ok(trace.some((entry) => entry.commandKind === 'begin-activate-skill'))
    assert.ok(trace.some((entry) => entry.commandKind === 'resolve-ability-effect'))
  } else {
    assert.ok(trace.some((entry) => entry.commandKind === 'skip-on-play'))
    assert.equal(trace.some((entry) => entry.commandKind === 'resolve-ability-effect'), false)
  }
  return { art, traceKinds: trace.map((entry) => entry.commandKind) }
}

const run104 = async (page, positive) => {
  const expected = cards['BS11-104']
  const faint = page.locator('.faint-response-modal:visible').first()
  await faint.waitFor({ state: 'visible' })
  const art = await readCardArt(faint.locator('.faint-effect-card-detail .card-face').first())
  assertArt(art, expected)
  const faintConfirm = faint.getByRole('button', { name: '確認結算', exact: true })
  assert.equal(await faintConfirm.isEnabled(), true)
  await faintConfirm.click({ force: true })
  const inspect = page.locator('.inspect-deck-modal:visible').first()
  await inspect.waitFor({ state: 'visible' })
  const viewed = inspect.locator('.inspect-deck-grid > button')
  assert.equal(await viewed.count(), 3)

  if (positive) {
    const black = viewed.filter({ hasText: 'Emblem of Darkness' }).first()
    assert.equal(await black.count(), 1)
    assert.equal(await black.isEnabled(), true)
    await black.click({ force: true })
    assert.equal(await black.getAttribute('class'), 'is-selected')
  } else {
    assert.equal(
      await viewed.evaluateAll((buttons) => buttons.every((button) => button.disabled)),
      true,
      'BS11-104 negative route must have no black-card candidate',
    )
    assert.match(await inspect.innerText(), /沒有符合條件的卡牌/)
  }

  const confirm = inspect.getByRole('button', { name: '確認並結算', exact: true })
  assert.equal(await confirm.isEnabled(), true)
  await confirm.click({ force: true })
  await inspect.waitFor({ state: 'hidden' })
  await wait(180)
  const trace = await readTrace(page)
  assert.ok(trace.some((entry) => entry.commandKind === 'resolve-faint-effect'))
  assert.ok(trace.some((entry) => entry.commandKind === 'resolve-inspect-deck'))
  const blackInHand = await page.locator('.bottom-hand .hand-card[title="Emblem of Darkness"]').count()
  assert.equal(blackInHand, positive ? 1 : 0)
  return { art, traceKinds: trace.map((entry) => entry.commandKind) }
}

const run109 = async (page, positive) => {
  const expected = cards['BS11-109']
  const hand = page.locator(`.bottom-hand .hand-card-wrap:has(.hand-card[title="${expected.name}"])`).first()
  await hand.waitFor({ state: 'visible' })
  const art = await readCardArt(hand.locator('.card-face').first())
  assertArt(art, expected)
  await hand.locator('.hand-card').click()
  const use = hand.locator('.hand-card-action').filter({ hasText: '使用' }).first()
  await use.waitFor({ state: 'visible' })
  assert.equal(await use.isEnabled(), true)
  await use.click({ force: true })

  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').first()
  await panel.waitFor({ state: 'visible' })
  const payments = panel.locator('.effect-candidates-payment button:not(:disabled)')
  assert.equal(await payments.count(), 1, 'BS11-109 must expose one black payment candidate')
  await payments.first().click({ force: true })
  await settleEffectPanel(page)
  const inspect = page.locator('.inspect-deck-modal:visible').first()
  await inspect.waitFor({ state: 'visible' })
  const viewed = inspect.locator('.inspect-deck-grid > button')
  assert.equal(await viewed.count(), 5)

  if (positive) {
    const special = viewed.filter({ hasText: 'Mold Dough Cookie' }).first()
    assert.equal(await special.count(), 1)
    assert.equal(await special.isEnabled(), true)
    await special.click({ force: true })
  } else {
    assert.equal(
      await viewed.evaluateAll((buttons) => buttons.every((button) => button.disabled)),
      true,
      'BS11-109 negative route must have no Special Play Cookie candidate',
    )
    assert.match(await inspect.innerText(), /沒有符合條件的卡牌/)
  }
  await inspect.getByRole('button', { name: '確認並結算', exact: true }).click({ force: true })
  await inspect.waitFor({ state: 'hidden' })
  await wait(180)
  const trace = await readTrace(page)
  for (const commandKind of ['begin-play-item', 'resolve-ability-effect', 'resolve-inspect-deck']) {
    assert.ok(trace.some((entry) => entry.commandKind === commandKind), `BS11-109 must trace ${commandKind}`)
  }
  const specialInHand = await page.locator('.bottom-hand .hand-card[title="Mold Dough Cookie"]').count()
  assert.equal(specialInHand, positive ? 1 : 0)
  return { art, traceKinds: trace.map((entry) => entry.commandKind) }
}

const browser = await chromium.launch({
  headless: true,
  ...(browserExecutable ? { executablePath: browserExecutable } : {}),
})
const output = []
try {
  for (const viewport of viewports) {
    for (const cardNumber of Object.keys(cards).filter(number => !process.env.BS11_BROWSER_CARDS || process.env.BS11_BROWSER_CARDS.split(',').includes(number))) {
      for (const positive of [true, false]) {
        const page = await browser.newPage({ viewport })
        await routeBs11OfficialArt(page)
        page.setDefaultTimeout(10000)
        const errors = recordBrowserErrors(page)
        const result = {
          viewport,
          cardNumber,
          positive,
          status: 'FAIL',
        }
        try {
          result.route = await openRoute(page, cardNumber, positive)
          result.evidence = cardNumber === 'BS11-103'
            ? await run103(page, positive)
            : cardNumber === 'BS11-104'
              ? await run104(page, positive)
              : await run109(page, positive)
          assert.deepEqual(errors, [], `Browser errors: ${errors.join('; ')}`)
          result.status = 'PASS'
        } catch (error) {
          result.error = error instanceof Error ? error.message : String(error)
          result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 6000)
          result.traceKinds = (await readTrace(page).catch(() => [])).map((entry) => entry.commandKind)
        }
        output.push(result)
        console.log(result.status, cardNumber, positive ? 'positive' : 'negative', `${viewport.width}x${viewport.height}`, result.error ?? '')
        await page.close()
      }
    }
  }
  const outputDir = resolve(root, process.env.BS11_BROWSER_OUT ?? 'test-results/bs11-103-104-109-browser')
  await mkdir(outputDir, { recursive: true })
  const outputPath = resolve(outputDir, `bs11-103-104-109-browser-${Date.now()}.json`)
  await writeFile(outputPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseUrl,
    scope: 'BS11-103／104／109 localhost Browser A/B: On Play hand gate, faint inspect, Item payment, and Special Play deck filter; not formal or online acceptance',
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
