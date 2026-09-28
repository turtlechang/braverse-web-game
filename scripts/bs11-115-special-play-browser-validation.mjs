import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { routeBs11OfficialArt } from './bs11-official-art-route.mjs'

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
    cardNumber: 'BS11-115',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/FvwPP1iFqeFNjNfz3SOJjw.webp',
  },
  {
    cardNumber: 'BS11-115@1',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/SzpsCf5eVzgvjiTYqhYOXg.webp',
  },
  {
    cardNumber: 'BS11-115@2',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/2VjqbtXhSxmEjqgoS5frrQ.webp',
  },
  {
    cardNumber: 'BS11-115@3',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/IPhjMrsmavWvl_lf7SAYbg.webp',
  },
].map((card) => ({
  ...card,
  baseCardNumber: 'BS11-115',
  prefix: `bs11-${card.cardNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
}))

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const visible = async (locator) =>
  (await locator.count()) > 0 && (await locator.first().isVisible().catch(() => false))
const enabled = async (locator) =>
  (await visible(locator)) && (await locator.first().isEnabled().catch(() => false))
const readTrace = (page) => page.evaluate(() => window.__braverseContractTrace ?? [])

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

const assertArt = (art, expectedUrl) => {
  assert.ok(art.image !== null || art.fallback, 'BS11-115 must render official art or its visual fallback')
  if (art.image) assert.equal(art.image.src, expectedUrl, 'BS11-115 must use the reviewed official image URL')
}

const openSpecialPlayAndResolveOnPlay = async (page, expected) => {
  const source = page.locator(
    `.bottom-field .hand-card-wrap[data-card-instance-id="${expected.prefix}-demo-source"]`,
  )
  await source.waitFor({ state: 'visible' })
  const sourceArt = await readCardArt(source.locator('.card-face').first())
  assertArt(sourceArt, expected.imageUrl)
  await source.locator('.card-face').click({ force: true })
  const specialPlay = source.getByRole('button', { name: '特殊登場', exact: true })
  assert.ok(await enabled(specialPlay), `${expected.cardNumber} must expose Special Play`)
  await specialPlay.click({ force: true })

  const modal = page.getByRole('dialog', { name: '' }).filter({ hasText: '特殊登場' }).first()
  await modal.waitFor({ state: 'visible' })
  const candidates = modal.locator('.special-play-candidate')
  assert.equal(await candidates.count(), 2, `${expected.cardNumber} must expose exactly two eligible cost Cookies`)
  assert.ok(await enabled(candidates.nth(0)), `${expected.cardNumber} first cost Cookie must be selectable`)
  assert.ok(await enabled(candidates.nth(1)), `${expected.cardNumber} second cost Cookie must be selectable`)

  const confirm = modal.getByRole('button', { name: '確認特殊登場', exact: true })
  assert.equal(await confirm.isEnabled(), false, `${expected.cardNumber} must require both cost Cookies`)
  await candidates.nth(0).click({ force: true })
  assert.equal(await confirm.isEnabled(), false, `${expected.cardNumber} must not confirm after one cost Cookie`)
  await candidates.nth(1).click({ force: true })
  assert.ok(await confirm.isEnabled(), `${expected.cardNumber} must confirm after two cost Cookies`)
  await confirm.click({ force: true })
  await skipAnimations(page)

  await page.locator(
    `.bottom-field .combat-card-wrap[data-card-instance-id="${expected.prefix}-demo-source"]`,
  ).waitFor({ state: 'visible' })
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').first()
  await panel.waitFor({ state: 'visible' })
  const target = panel.locator('.effect-candidates-target button').first()
  assert.ok(await enabled(target), `${expected.cardNumber} On Play must expose its opponent Cookie target`)
  await target.click({ force: true })
  const activate = panel.getByRole('button', { name: '確認發動', exact: true })
  assert.ok(await enabled(activate), `${expected.cardNumber} On Play effect must be confirmable`)
  await activate.click({ force: true })
  await skipAnimations(page)
  await panel.waitFor({ state: 'hidden', timeout: 12000 }).catch(() => {})
  await page.locator(
    `.top-field .hp-card-stack[aria-label="${expected.prefix}-demo-opponent-target HP 卡 2 張"]`,
  ).waitFor({ state: 'visible' })
  return sourceArt
}

const runPositive = async (browser, viewport, expected) => {
  const page = await browser.newPage({ viewport })
  await routeBs11OfficialArt(page)
  page.setDefaultTimeout(10000)
  const errors = browserErrors(page)
  const route = `bs11-115-special-play:${expected.cardNumber}:positive`
  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${expected.baseCardNumber}`,
      { waitUntil: 'domcontentloaded' },
    )
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    const sourceArt = await openSpecialPlayAndResolveOnPlay(page, expected)
    const trace = await readTrace(page)
    for (const commandKind of ['deploy-cookie', 'begin-activate-skill', 'resolve-ability-effect']) {
      assert.ok(
        trace.some((entry) => entry.commandKind === commandKind),
        `${expected.cardNumber} positive route must leave a ${commandKind} trace`,
      )
    }
    assert.deepEqual(errors, [], `${expected.cardNumber} positive browser errors: ${errors.join('; ')}`)
    return { status: 'PASS', route, sourceArt, traceKinds: trace.map((entry) => entry.commandKind) }
  } finally {
    await page.close()
  }
}

const runNegative = async (browser, viewport, expected) => {
  const page = await browser.newPage({ viewport })
  await routeBs11OfficialArt(page)
  page.setDefaultTimeout(10000)
  const errors = browserErrors(page)
  const route = `bs11-115-special-play:${expected.cardNumber}:negative`
  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${expected.baseCardNumber}`,
      { waitUntil: 'domcontentloaded' },
    )
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    const source = page.locator(
      `.bottom-field .hand-card-wrap[data-card-instance-id="${expected.prefix}-demo-source"]`,
    )
    await source.waitFor({ state: 'visible' })
    const sourceArt = await readCardArt(source.locator('.card-face').first())
    assertArt(sourceArt, expected.imageUrl)
    await source.locator('.card-face').click({ force: true })
    assert.equal(
      await source.getByRole('button', { name: '特殊登場', exact: true }).count(),
      0,
      `${expected.cardNumber} negative route must not expose Special Play`,
    )
    assert.equal(
      await page.locator('.special-play-modal:visible').count(),
      0,
      `${expected.cardNumber} negative route must not open Special Play modal`,
    )
    assert.equal(
      await page.locator(
        `.bottom-field .hand-card-wrap[data-card-instance-id="${expected.prefix}-demo-source"]`,
      ).count(),
      1,
      `${expected.cardNumber} negative route must keep the source in hand`,
    )
    const trace = await readTrace(page)
    assert.equal(
      trace.some((entry) => entry.commandKind === 'deploy-cookie'),
      false,
      `${expected.cardNumber} negative route must not deploy the Cookie`,
    )
    assert.deepEqual(errors, [], `${expected.cardNumber} negative browser errors: ${errors.join('; ')}`)
    return { status: 'PASS', route, sourceArt, traceKinds: trace.map((entry) => entry.commandKind) }
  } finally {
    await page.close()
  }
}

const runOnPlayConditionUnmet = async (browser, viewport, expected) => {
  const page = await browser.newPage({ viewport })
  await routeBs11OfficialArt(page)
  page.setDefaultTimeout(10000)
  const errors = browserErrors(page)
  const route = `bs11-115-special-play:${expected.cardNumber}:condition-unmet`
  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${expected.baseCardNumber}`,
      { waitUntil: 'domcontentloaded' },
    )
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    const source = page.locator(
      `.bottom-field .hand-card-wrap[data-card-instance-id="${expected.prefix}-demo-source"]`,
    )
    await source.waitFor({ state: 'visible' })
    const sourceArt = await readCardArt(source.locator('.card-face').first())
    assertArt(sourceArt, expected.imageUrl)
    await source.locator('.card-face').click({ force: true })
    const specialPlay = source.getByRole('button', { name: '特殊登場', exact: true })
    assert.ok(await enabled(specialPlay), `${expected.cardNumber} Special Play must stay legal when its On Play condition is unmet`)
    await specialPlay.click({ force: true })

    const modal = page.getByRole('dialog', { name: '' }).filter({ hasText: '特殊登場' }).first()
    await modal.waitFor({ state: 'visible' })
    const candidates = modal.locator('.special-play-candidate')
    assert.equal(await candidates.count(), 2)
    const confirm = modal.getByRole('button', { name: '確認特殊登場', exact: true })
    await candidates.nth(0).click({ force: true })
    await candidates.nth(1).click({ force: true })
    assert.ok(await enabled(confirm), 'both printed Special Play costs must be payable')
    await confirm.click({ force: true })
    await skipAnimations(page)

    await page.locator(
      `.bottom-field .combat-card-wrap[data-card-instance-id="${expected.prefix}-demo-source"]`,
    ).waitFor({ state: 'visible' })
    assert.equal(
      await page.locator('.effect-panel[role="alertdialog"]:visible').count(),
      0,
      `${expected.cardNumber} must not prompt for an On Play effect below the 4-support threshold`,
    )
    await page.locator(
      `.top-field .hp-card-stack[aria-label="${expected.prefix}-demo-opponent-target HP 卡 3 張"]`,
    ).waitFor({ state: 'visible' })
    const trace = await readTrace(page)
    assert.ok(trace.some((entry) => entry.commandKind === 'deploy-cookie'), 'legal Special Play must still be recorded')
    assert.equal(
      trace.some((entry) => entry.commandKind === 'resolve-ability-effect'),
      false,
      'unmet On Play condition must not resolve damage',
    )
    assert.deepEqual(errors, [], `${expected.cardNumber} condition-unmet browser errors: ${errors.join('; ')}`)
    return { status: 'PASS', route, sourceArt, traceKinds: trace.map((entry) => entry.commandKind) }
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
      try {
        output.push({ viewport, cardNumber: expected.cardNumber, positive: await runPositive(browser, viewport, expected) })
        console.log(`PASS ${expected.cardNumber} positive ${viewport.width}x${viewport.height}`)
      } catch (error) {
        output.push({ viewport, cardNumber: expected.cardNumber, positive: { status: 'FAIL', error: String(error) } })
        console.error(`FAIL ${expected.cardNumber} positive ${viewport.width}x${viewport.height}:`, error)
      }
      try {
        output.push({ viewport, cardNumber: expected.cardNumber, negative: await runNegative(browser, viewport, expected) })
        console.log(`PASS ${expected.cardNumber} negative ${viewport.width}x${viewport.height}`)
      } catch (error) {
        output.push({ viewport, cardNumber: expected.cardNumber, negative: { status: 'FAIL', error: String(error) } })
        console.error(`FAIL ${expected.cardNumber} negative ${viewport.width}x${viewport.height}:`, error)
      }
      try {
        output.push({ viewport, cardNumber: expected.cardNumber, conditionUnmet: await runOnPlayConditionUnmet(browser, viewport, expected) })
        console.log(`PASS ${expected.cardNumber} condition-unmet ${viewport.width}x${viewport.height}`)
      } catch (error) {
        output.push({ viewport, cardNumber: expected.cardNumber, conditionUnmet: { status: 'FAIL', error: String(error) } })
        console.error(`FAIL ${expected.cardNumber} condition-unmet ${viewport.width}x${viewport.height}:`, error)
      }
    }
  }
} finally {
  await browser.close()
}

const artifactDir = resolve(root, 'test-results', 'bs11-115-special-play-browser')
await mkdir(artifactDir, { recursive: true })
const artifactPath = resolve(artifactDir, `bs11-115-special-play-browser-${Date.now()}.json`)
const passed = output.filter((entry) => Object.values(entry).some((value) => value?.status === 'PASS')).length
const failed = output.filter((entry) => Object.values(entry).some((value) => value?.status === 'FAIL')).length
const artifact = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  scope: 'BS11-115 base/@1/@2/@3 promoted-pool test-state two-cookie Special Play payment, On Play support threshold positive/no-op paths, official-art/fallback surface, and invalid-cost negative gating; not formal deck or online acceptance',
  summary: { total: output.length, passed, failed },
  results: output,
}
await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ ...artifact, artifactPath }, null, 2))
if (failed > 0) process.exitCode = 1
