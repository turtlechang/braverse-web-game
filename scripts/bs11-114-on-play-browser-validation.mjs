import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { routeBs11OfficialArt } from './bs11-official-art-route.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
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

const cards = [
  {
    cardNumber: 'BS11-114',
    name: 'Pomegranate Cookie',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/X8AYyhR5i8X_TWLWM87gPw.webp',
  },
  {
    cardNumber: 'BS11-114@1',
    name: 'Pomegranate Cookie',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/5DJaQKAwdFShW-0x2DSzsg.webp',
  },
].map((card) => ({
  ...card,
  baseCardNumber: card.cardNumber.split('@')[0],
  prefix: `bs11-${card.cardNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
}))

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const visible = async (locator) =>
  (await locator.count()) > 0 && (await locator.first().isVisible().catch(() => false))
const enabled = async (locator) =>
  (await visible(locator)) && (await locator.first().isEnabled().catch(() => false))
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

const readCardArt = async (cardFace) => cardFace.evaluate((node) => {
  const image = node.querySelector('img')
  return {
    image: image
      ? { alt: image.getAttribute('alt'), src: image.getAttribute('src') }
      : null,
    fallback: Boolean(node.querySelector('.card-fallback')),
  }
})

const assertArt = (art, expected) => {
  assert.ok(art.image !== null || art.fallback, `${expected.cardNumber} must render art or fallback`)
  if (art.image) {
    assert.match(art.image.alt ?? '', /Pomegranate Cookie/)
    assert.equal(art.image.src, expected.imageUrl)
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

const confirmCurrentPanel = async (panel) => {
  const confirm = panel.getByRole('button', { name: '確認發動', exact: true })
  if (await enabled(confirm)) {
    await confirm.click({ force: true })
    return true
  }
  const primary = panel.locator('.effect-panel-primary-action').first()
  if (await enabled(primary)) {
    await primary.click({ force: true })
    return true
  }
  return false
}

const openOnPlay = async (page, expected) => {
  const source = page.locator(
    `.bottom-field .hand-card-wrap[data-card-instance-id="${expected.prefix}-demo-source"]`,
  )
  await source.waitFor({ state: 'visible' })
  const art = await readCardArt(source.locator('.card-face').first())
  assertArt(art, expected)
  await source.locator('.card-face').click({ force: true })
  const deploy = source.locator('.hand-card-action').filter({ hasText: '登場' }).first()
  assert.ok(await enabled(deploy), `${expected.cardNumber} must expose normal deploy`)
  await deploy.click({ force: true })
  await skipAnimations(page)
  await page.locator(
    `.bottom-field .combat-card-wrap[data-card-instance-id="${expected.prefix}-demo-source"]`,
  ).waitFor({ state: 'visible' })
  return art
}

const resolveOnPlay = async (page, expected, positive) => {
  if (!positive) {
    // When the hand threshold is already impossible after deployment, the
    // real pending On Play flow may skip before opening the cost panel.  If a
    // UI build opens the panel first, still pay the legal black discard and
    // verify that the conditional draw remains a no-op.
    await wait(500)
    const candidatePanel = page.locator('.effect-panel[role="alertdialog"]:visible').first()
    if (await visible(candidatePanel)) {
      let negativePanel = candidatePanel
      const discard = negativePanel.locator('.effect-candidates-discard-hand button:not(:disabled)').first()
      if (await enabled(discard)) {
        await discard.click({ force: true })
        const next = negativePanel.getByRole('button', { name: '下一步', exact: true }).first()
        if (await enabled(next)) {
          await next.click({ force: true })
          negativePanel = await waitForEffectPanel(page)
        }
        if (await confirmCurrentPanel(negativePanel)) {
          await settleEffectPanel(page, negativePanel)
        }
      }
    }
    await wait(500)
    assert.equal(
      await page.locator('.draw-up-to-modal:visible').count(),
      0,
      `${expected.cardNumber} negative route must not open draw choice`,
    )
    return
  }

  let panel = await waitForEffectPanel(page)
  const discard = panel.locator('.effect-candidates-discard-hand button:not(:disabled)').first()
  assert.ok(await enabled(discard), `${expected.cardNumber} must expose a black discard candidate`)
  await discard.click({ force: true })

  const next = panel.getByRole('button', { name: '下一步', exact: true }).first()
  if (await enabled(next)) {
    await next.click({ force: true })
    panel = await waitForEffectPanel(page)
  }

  const confirmed = await confirmCurrentPanel(panel)
  if (confirmed) await settleEffectPanel(page, panel)

  const draw = page.locator('.draw-up-to-modal:visible').first()
  await draw.waitFor({ state: 'visible' })
  const option = draw.locator('.draw-up-to-option').filter({ hasText: '抽 2 張' }).first()
  assert.ok(await enabled(option), `${expected.cardNumber} must offer drawing two cards`)
  await option.click({ force: true })
  const drawConfirm = draw.getByRole('button', { name: '抽取 2 張牌', exact: true })
  assert.ok(await enabled(drawConfirm), `${expected.cardNumber} must confirm draw two cards`)
  await drawConfirm.click({ force: true })
  await wait(400)
  const drawnCards = page.locator(
    `.bottom-field .hand-card-wrap[data-card-instance-id^="${expected.prefix}-demo-deck-"]`,
  )
  await drawnCards.first().waitFor({ state: 'visible' })
  assert.equal(await drawnCards.count(), 2, `${expected.cardNumber} must draw exactly two cards`)
}

const run = async (browser, viewport, expected, positive) => {
  const page = await browser.newPage({ viewport })
  await routeBs11OfficialArt(page)
  page.setDefaultTimeout(10000)
  const errors = recordBrowserErrors(page)
  const route = `bs11-114-on-play:${expected.cardNumber}:${positive ? 'positive' : 'negative'}`
  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${expected.baseCardNumber}`,
      { waitUntil: 'domcontentloaded' },
    )
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    const art = await openOnPlay(page, expected)
    await resolveOnPlay(page, expected, positive)
    const trace = await readTrace(page)
    assert.ok(trace.some((entry) => entry.commandKind === 'deploy-cookie'))
    if (positive) {
      assert.ok(trace.some((entry) => entry.commandKind === 'begin-activate-skill'))
      assert.ok(trace.some((entry) => entry.commandKind === 'resolve-draw-up-to'))
    } else {
      assert.equal(trace.some((entry) => entry.commandKind === 'begin-activate-skill'), false)
      assert.equal(trace.some((entry) => entry.commandKind === 'resolve-draw-up-to'), false)
      assert.ok(trace.some((entry) => entry.commandKind === 'skip-on-play'))
    }
    assert.deepEqual(errors, [], `${expected.cardNumber} browser errors: ${errors.join('; ')}`)
    return { status: 'PASS', route, art, traceKinds: trace.map((entry) => entry.commandKind) }
  } finally {
    await page.close()
  }
}

const browser = await chromium.launch({
  headless: true,
  ...(browserExecutable ? { executablePath: browserExecutable } : {}),
})
const output = []
try {
  for (const viewport of viewports) {
    for (const expected of cards) {
      for (const positive of [true, false]) {
        try {
          const result = await run(browser, viewport, expected, positive)
          output.push({ viewport, cardNumber: expected.cardNumber, positive, ...result })
          console.log(`PASS ${expected.cardNumber} ${positive ? 'positive' : 'negative'} ${viewport.width}x${viewport.height}`)
        } catch (error) {
          output.push({
            viewport,
            cardNumber: expected.cardNumber,
            positive,
            status: 'FAIL',
            error: String(error),
          })
          console.error(`FAIL ${expected.cardNumber} ${positive ? 'positive' : 'negative'} ${viewport.width}x${viewport.height}:`, error)
        }
      }
    }
  }
} finally {
  await browser.close()
}

const artifactDir = resolve(root, 'test-results', 'bs11-114-on-play-browser')
await mkdir(artifactDir, { recursive: true })
const artifactPath = resolve(artifactDir, `bs11-114-on-play-browser-${Date.now()}.json`)
const passed = output.filter((entry) => entry.status === 'PASS').length
const failed = output.filter((entry) => entry.status === 'FAIL').length
const artifact = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  scope: 'BS11-114／114@1 promoted-pool test-state On Play black discard payment, hand threshold, draw-up-to-2, official-art/fallback surface, and negative no-op; not formal deck or online acceptance',
  summary: { total: output.length, passed, failed },
  results: output,
}
await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ ...artifact, artifactPath }, null, 2))
if (failed > 0) process.exitCode = 1
