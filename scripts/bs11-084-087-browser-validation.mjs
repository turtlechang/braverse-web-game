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
  'BS11-084': {
    name: 'Freedom that Broke the Silence',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/lTI1IS_r5QtMrPLXj9HUaQ.webp',
    kind: 'trap',
  },
  'BS11-085': {
    name: 'Salt Cellar Cookie',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/YXhTD0AF6y9zEfOdItWRiw.webp',
    kind: 'skill',
  },
  'BS11-085@1': {
    name: 'Salt Cellar Cookie',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/mhTgk7S7lPEz4ji4aTmHEQ.webp',
    kind: 'skill',
  },
  'BS11-086': {
    name: 'Crunchy Chip Cookie',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/DZ9GGzIb5zEGW0tImxt78g.webp',
    kind: 'attack-then',
  },
  'BS11-086@1': {
    name: 'Crunchy Chip Cookie',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/pdAmPoA5R06WoN293aKrnA.webp',
    kind: 'attack-then',
  },
  'BS11-087': {
    name: 'Dark Cacao Cookie',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/hWs6HTynBotwOhQudKyA8w.webp',
    kind: 'attack-then',
  },
  'BS11-087@1': {
    name: 'Dark Cacao Cookie',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/ohCAFID_2UXG7GHqCPkdJg.webp',
    kind: 'attack-then',
  },
}

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const readTrace = (page) => page.evaluate(() => window.__braverseContractTrace ?? [])
const sourceId = (cardNumber) =>
  `bs11-${cardNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-attack-source`

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
  const expected = cards[cardNumber]
  const baseCardNumber = cardNumber.split('@')[0]
  const route = expected.kind === 'trap'
    ? `bs11-084-trap:${positive ? 'positive' : 'negative'}`
    : expected.kind === 'skill'
      ? `${positive ? 'card-skill' : 'card-skill-negative'}:${cardNumber}`
      : `bs11-086-087-attack-then:${cardNumber}:${positive ? 'positive' : 'negative'}`
  await page.goto(
    `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${encodeURIComponent(baseCardNumber)}`,
    { waitUntil: 'domcontentloaded' },
  )
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await wait(220)
  return route
}

const settle084 = async (page, positive, expected) => {
  const response = page.locator('.trap-response-modal:visible').first()
  await response.waitFor({ state: 'visible' })
  const trapButton = response.locator('.modal-card-options > button').filter({ hasText: expected.name }).first()
  const art = await readCardArt(trapButton.locator('.card-face').first())
  assertArt(art, expected)
  await trapButton.click({ force: true })

  const payment = response
    .locator('.trap-guided-section:visible')
    .filter({ hasText: '能量支付' })
    .locator('.trap-discard-options button:not(.is-selected):not(:disabled)')
    .first()
  await payment.click({ force: true })
  await response.getByRole('button', { name: '下一步', exact: true }).click({ force: true })

  const target = response
    .locator('.trap-effect-target-step:visible button')
    .filter({ hasText: 'trap-attacker' })
    .first()
  await target.click({ force: true })
  if (!positive) {
    assert.match(await response.innerText(), /目前條件不成立|條件不成立/)
  }
  await response.getByRole('button', { name: '確認發動', exact: true }).click({ force: true })
  await waitForTrace(page, 'play-trap')

  if (positive) {
    const draw = page.locator('.draw-up-to-modal:visible').first()
    await draw.waitFor({ state: 'visible' })
    await draw.locator('.draw-up-to-option').filter({ hasText: '抽 1 張' }).first().click({ force: true })
    await draw.getByRole('button', { name: '抽取 1 張牌', exact: true }).click({ force: true })
    await waitForTrace(page, 'resolve-draw-up-to')
  } else {
    await wait(350)
    assert.equal(
      await page.locator('.draw-up-to-modal:visible').count(),
      0,
      'BS11-084 negative Refresh branch must not open a draw modal',
    )
  }

  const trace = await readTrace(page)
  return {
    art,
    traceKinds: trace.map((entry) => entry.commandKind),
    evidence: positive ? 'refresh-draw-up-to-one' : 'refresh-condition-no-op',
  }
}

const settle085 = async (page, positive, expected) => {
  const source = page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator(`.card-face img[alt="${expected.name}"]`),
  }).first()
  await source.waitFor({ state: 'visible' })
  const art = await readCardArt(source.locator('.card-face').first())
  assertArt(art, expected)
  const skill = source.locator('.skill-action').first()

  if (!positive) {
    assert.equal(await skill.isDisabled(), true, `${expected.cardNumber} negative route must block skill payment`)
    assert.match(await page.locator('body').innerText(), /能量不足|沒有足夠/)
    return { art, traceKinds: (await readTrace(page)).map((entry) => entry.commandKind), evidence: 'payment-blocked' }
  }

  await skill.click({ force: true })
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
  await panel.waitFor({ state: 'visible' })
  await panel.locator('.effect-candidates-payment button:not(.is-selected):not(:disabled)').first().click({ force: true })
  await panel.getByRole('button', { name: '下一步', exact: true }).click({ force: true })
  await panel.locator('.effect-candidates-target button:not(.is-selected):not(:disabled)').first().click({ force: true })
  await panel.locator('.effect-panel-primary-action').click({ force: true })
  await waitForTrace(page, 'resolve-ability-effect')
  assert.equal(
    await page.locator('.bottom-field .combat-card-wrap').filter({
      has: page.locator(`.card-face img[alt="${expected.name}"]`),
    }).count(),
    0,
    `${expected.cardNumber} source must leave the battle area as its printed cost`,
  )
  const trace = await readTrace(page)
  assert.ok(trace.some((entry) => entry.commandKind === 'begin-activate-skill'))
  return { art, traceKinds: trace.map((entry) => entry.commandKind), evidence: 'self-to-trash-and-target-trash' }
}

const settle086 = async (page, positive, expected) => {
  const source = page.locator(`.combat-card-wrap[data-card-instance-id="${sourceId(expected.cardNumber)}"]`).first()
  await source.waitFor({ state: 'visible' })
  const art = await readCardArt(source.locator('.card-face').first())
  assertArt(art, expected)
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
  await panel.waitFor({ state: 'visible' })
  const candidate = panel
    .locator('.effect-candidates-target button:not(.is-selected):not(:disabled)')
    .filter({ hasText: 'Dark Cacao Cookie' })
    .first()

  if (positive) {
    await candidate.click({ force: true })
  } else {
    assert.equal(await candidate.count(), 0, `${expected.cardNumber} negative route must remove the named trash candidate`)
  }
  await panel.locator('.effect-panel-primary-action').click({ force: true })
  await waitForTrace(page, 'resolve-attack-effect')

  if (positive) {
    const onPlay = page.locator('.effect-panel[role="alertdialog"]:visible').last()
    await onPlay.waitFor({ state: 'visible' })
    assert.match(await onPlay.innerText(), /獲得 2 HP/)
    await onPlay.locator('.effect-panel-primary-action').click({ force: true })
    await page
      .locator(`.bottom-field .hp-card-stack[aria-label="Dark Cacao Cookie HP 卡 6 張"]`)
      .waitFor({ state: 'visible' })
  } else {
    assert.equal(await page.locator('.effect-panel[role="alertdialog"]:visible').count(), 0)
    const resolution = (await readTrace(page)).find((entry) => entry.commandKind === 'resolve-attack-effect')
    assert.ok(!resolution?.steps?.some((step) => String(step).includes('攻擊後效果目標')))
  }

  const trace = await readTrace(page)
  return {
    art,
    traceKinds: trace.map((entry) => entry.commandKind),
    evidence: positive ? 'trash-to-battle-and-trash-origin-hp' : 'optional-trash-target-no-op',
  }
}

const settle087 = async (page, positive, expected) => {
  const source = page.locator(`.combat-card-wrap[data-card-instance-id="${sourceId(expected.cardNumber)}"]`).first()
  await source.waitFor({ state: 'visible' })
  const art = await readCardArt(source.locator('.card-face').first())
  assertArt(art, expected)
  if (positive) {
    const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
    await panel.waitFor({ state: 'visible' })
    await panel.locator('.effect-panel-primary-action').click({ force: true })
  }
  await waitForTrace(page, 'resolve-attack-effect')
  const trace = await readTrace(page)
  const resolution = trace.find((entry) => entry.commandKind === 'resolve-attack-effect')

  if (positive) {
    assert.ok(resolution?.steps?.some((step) => String(step).includes('opponent-random-discard')))
    assert.match(await page.locator('body').innerText(), /對手已隨機棄手牌/)
  } else {
    assert.ok(resolution?.steps?.some((step) => /條件不成立|效果未執行/.test(String(step))))
    assert.doesNotMatch(await page.locator('body').innerText(), /對手已隨機棄手牌/)
  }
  return {
    art,
    traceKinds: trace.map((entry) => entry.commandKind),
    evidence: positive ? 'ancient-conditional-random-discard' : 'ancient-condition-no-op',
  }
}

const browser = await chromium.launch({
  headless: true,
  ...(browserExecutable ? { executablePath: browserExecutable } : {}),
})
const output = []
try {
  for (const viewport of viewports) {
    for (const [cardNumber, expected] of Object.entries(cards)) {
      for (const positive of [true, false]) {
        const page = await browser.newPage({ viewport })
        await routeBs11OfficialArt(page)
        page.setDefaultTimeout(10_000)
        const errors = recordBrowserErrors(page)
        const result = { viewport, cardNumber, positive, status: 'FAIL' }
        try {
          result.route = await openRoute(page, cardNumber, positive)
          result.evidence = expected.kind === 'trap'
            ? await settle084(page, positive, { ...expected, cardNumber })
            : expected.kind === 'skill'
              ? await settle085(page, positive, { ...expected, cardNumber })
              : cardNumber.startsWith('BS11-086')
                ? await settle086(page, positive, { ...expected, cardNumber })
                : await settle087(page, positive, { ...expected, cardNumber })
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
  const outputDir = resolve(root, 'test-results/bs11-084-087-browser')
  await mkdir(outputDir, { recursive: true })
  const outputPath = resolve(outputDir, `bs11-084-087-browser-${Date.now()}.json`)
  const artifact = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    scope: 'BS11-084／085／086／087 promoted-pool test-state Browser A/B: Refresh-gated Trap, self-to-trash skill, named trash Cookie Then, Ancient conditional random discard, exact art/fallback; not formal deck or online acceptance',
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
