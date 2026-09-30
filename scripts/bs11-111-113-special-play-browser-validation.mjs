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
    cardNumber: 'BS11-111',
    name: 'Mold Dough Cookie',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/9m2vIeftT1TRuG663hY9ug.webp',
  },
  {
    cardNumber: 'BS11-111@1',
    name: 'Mold Dough Cookie',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/uU9hagkYjvITmN-hgCZHcQ.webp',
  },
  {
    cardNumber: 'BS11-112',
    name: 'Pom-pom Dough Cookie',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/SOokvjSLL-HnlBKC4lfUIg.webp',
  },
  {
    cardNumber: 'BS11-112@1',
    name: 'Pom-pom Dough Cookie',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/5PSt7bSC89lr0aUJ0aTXVA.webp',
  },
  {
    cardNumber: 'BS11-113',
    name: 'Venom Dough Cookie',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/1t7UiXxq9l7D5QCdJt3Udw.webp',
  },
  {
    cardNumber: 'BS11-113@1',
    name: 'Venom Dough Cookie',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/xhru3QIrmNlX_Ch-SBXVGA.webp',
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

const assertArt = (art, expectedName, expectedUrl) => {
  assert.ok(
    art.image !== null || art.fallback,
    `${expectedName} must render official art or its visual fallback`,
  )
  if (art.image) {
    assert.match(art.image.alt ?? '', new RegExp(expectedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.equal(art.image.src, expectedUrl, `${expectedName} must use the reviewed official image URL`)
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

const advanceIfPresent = async (panel) => {
  const next = panel.getByRole('button', { name: '下一步', exact: true })
  if (await visible(next)) await next.click({ force: true })
}

const openSpecialPlay = async (page, expected) => {
  const source = page.locator(
    `.bottom-field .hand-card-wrap[data-card-instance-id="${expected.prefix}-demo-source"]`,
  )
  await source.waitFor({ state: 'visible' })
  const sourceArt = await readCardArt(source.locator('.card-face').first())
  assertArt(sourceArt, expected.name, expected.imageUrl)
  await source.locator('.card-face').click({ force: true })
  const specialPlay = source.getByRole('button', { name: '特殊登場', exact: true })
  assert.ok(await enabled(specialPlay), `${expected.cardNumber} must expose Special Play`)
  await specialPlay.click({ force: true })

  const modal = page.getByRole('dialog', { name: '' }).filter({ hasText: '特殊登場' }).first()
  await modal.waitFor({ state: 'visible' })
  const candidate = modal.locator('.special-play-candidate').first()
  assert.ok(await enabled(candidate), `${expected.cardNumber} must expose its LV.1 cost Cookie`)
  await candidate.click({ force: true })
  const confirm = modal.getByRole('button', { name: '確認特殊登場', exact: true })
  assert.ok(await enabled(confirm), `${expected.cardNumber} must enable Special Play confirmation`)
  await confirm.click({ force: true })
  await skipAnimations(page)
  await page.locator(
    `.bottom-field .combat-card-wrap[data-card-instance-id="${expected.prefix}-demo-source"]`,
  ).waitFor({ state: 'visible' })
  return sourceArt
}

const resolveOnPlay = async (page, expected) => {
  let panel = await waitForEffectPanel(page)

  if (expected.baseCardNumber === 'BS11-111') {
    const discard = panel.locator('.effect-candidates-discard-hand button').first()
    assert.ok(await enabled(discard), 'BS11-111 must expose its discard 1 card cost')
    await discard.click({ force: true })
    await advanceIfPresent(panel)
    panel = await waitForEffectPanel(page)
  }

  if (expected.baseCardNumber === 'BS11-111') {
    const target = panel.locator('.effect-candidates-target button').first()
    assert.ok(await enabled(target), 'BS11-111 must expose its opponent Cookie target')
    await target.click({ force: true })
    await panel.getByRole('button', { name: '確認發動', exact: true }).click({ force: true })
    await settleEffectPanel(page, panel)
    await page.locator(
      `.top-field .hp-card-stack[aria-label="${expected.prefix}-demo-target HP 卡 2 張"]`,
    ).waitFor({ state: 'visible' })
  } else if (expected.baseCardNumber === 'BS11-112') {
    const target = panel.locator('.effect-candidates-target button').filter({ hasText: 'Mold Dough Cookie' }).first()
    assert.ok(await enabled(target), 'BS11-112 must expose the black Cookie trash target')
    await target.click({ force: true })
    await panel.getByRole('button', { name: '確認發動', exact: true }).click({ force: true })
    await settleEffectPanel(page, panel)
    await page.locator(
      `.bottom-field .hand-card-wrap[data-card-instance-id="${expected.prefix}-demo-recoverable"]`,
    ).waitFor({ state: 'visible' })
  } else {
    await panel.getByRole('button', { name: '確認發動', exact: true }).click({ force: true })
    await settleEffectPanel(page, panel)
    const draw = page.locator('.draw-up-to-modal:visible').first()
    await draw.waitFor({ state: 'visible' })
    const option = draw.locator('.draw-up-to-option').filter({ hasText: '抽 2 張' }).first()
    assert.ok(await enabled(option), 'BS11-113 must offer drawing two cards')
    await option.click({ force: true })
    const drawConfirm = draw.getByRole('button', { name: '抽取 2 張牌', exact: true })
    assert.ok(await enabled(drawConfirm), 'BS11-113 must confirm the selected draw count')
    await drawConfirm.click({ force: true })
    await wait(400)
    const drawnCards = page.locator(
      `.bottom-field .hand-card-wrap[data-card-instance-id^="${expected.prefix}-demo-deck-"]`,
    )
    await drawnCards.first().waitFor({ state: 'visible' })
    assert.equal(await drawnCards.count(), 2, 'BS11-113 must draw exactly two cards from the deck')
  }
}

const runPositive = async (browser, viewport, expected) => {
  const page = await browser.newPage({ viewport })
  await routeBs11OfficialArt(page)
  page.setDefaultTimeout(10000)
  const errors = recordBrowserErrors(page)
  const route = `bs11-111-113-special-play:${expected.cardNumber}:positive`
  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${expected.baseCardNumber}`,
      { waitUntil: 'domcontentloaded' },
    )
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    const sourceArt = await openSpecialPlay(page, expected)
    await resolveOnPlay(page, expected)
    const trace = await readTrace(page)
    for (const commandKind of ['deploy-cookie', 'begin-activate-skill']) {
      assert.ok(
        trace.some((entry) => entry.commandKind === commandKind),
        `${expected.cardNumber} positive route must leave a ${commandKind} trace`,
      )
    }
    if (expected.baseCardNumber === 'BS11-113') {
      assert.ok(
        trace.some((entry) => entry.commandKind === 'resolve-draw-up-to'),
        'BS11-113 positive route must leave a resolve-draw-up-to trace',
      )
    } else {
      assert.ok(
        trace.some((entry) => entry.commandKind === 'resolve-ability-effect'),
        `${expected.cardNumber} positive route must leave a resolve-ability-effect trace`,
      )
    }
    assert.deepEqual(errors, [], `${expected.cardNumber} positive browser errors: ${errors.join('; ')}`)
    return {
      status: 'PASS',
      route,
      sourceArt,
      traceKinds: trace.map((entry) => entry.commandKind),
    }
  } finally {
    await page.close()
  }
}

const runNegative = async (browser, viewport, expected) => {
  const page = await browser.newPage({ viewport })
  await routeBs11OfficialArt(page)
  page.setDefaultTimeout(10000)
  const errors = recordBrowserErrors(page)
  const route = `bs11-111-113-special-play:${expected.cardNumber}:negative`
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
    assertArt(sourceArt, expected.name, expected.imageUrl)
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
    return {
      status: 'PASS',
      route,
      sourceArt,
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
    }
  }
} finally {
  await browser.close()
}

const artifactDir = resolve(root, 'test-results', 'bs11-111-113-special-play-browser')
await mkdir(artifactDir, { recursive: true })
const artifactPath = resolve(artifactDir, `bs11-111-113-special-play-browser-${Date.now()}.json`)
const passed = output.filter((entry) => Object.values(entry).some((value) => value?.status === 'PASS')).length
const failed = output.filter((entry) => Object.values(entry).some((value) => value?.status === 'FAIL')).length
const artifact = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  scope: 'BS11-111／112／113 promoted-pool test-state Special Play payment, On Play effect resolution, official-art/fallback surface, and negative gating; not formal deck or online acceptance',
  summary: { total: output.length, passed, failed },
  results: output,
}
await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ ...artifact, artifactPath }, null, 2))
if (failed > 0) process.exitCode = 1
