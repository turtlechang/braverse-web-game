import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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
const records = JSON.parse(readFileSync(resolve(root, 'data/cards/official-dark-enchantress-war-bs11.en.json'), 'utf8')).cards
const byNumber = new Map(records.map((record) => [record.cardNumber, record]))
const imagePath = (cardNumber) => resolve(root, 'test-results/bs11-official-art', `${cardNumber.replace('@', '-at-')}.webp`)
const routeArt = async (page, cardNumber) => {
  const path = imagePath(cardNumber)
  if (existsSync(path)) await page.route(byNumber.get(cardNumber).imageUrl,
    (request) => request.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(path) }))
}
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

const sourceInstanceId = 'bs11-090-demo-source'
const extraInstanceId = 'bs11-090-demo-extra'
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

const runPositive = async (browser, viewport, sourceCardNumber, extraCardNumber) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(10000)
  const errors = recordBrowserErrors(page)
  const route = `bs11-090-extra-deck:${sourceCardNumber}:${extraCardNumber}:positive`
  try {
    await routeArt(page, sourceCardNumber)
    await routeArt(page, extraCardNumber)
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=BS11-090,BS11-091`,
      { waitUntil: 'domcontentloaded' },
    )
    await page.locator('.game-shell').waitFor({ state: 'visible' })

    const source = page.locator(
      `.bottom-field .combat-card-wrap[data-card-instance-id="${sourceInstanceId}"]`,
    )
    await source.waitFor({ state: 'visible' })
    const sourceArt = await readCardArt(source.locator('.card-face').first())
    assertArt(
      sourceArt,
      'White Lily Cookie',
      byNumber.get(sourceCardNumber).imageUrl,
    )

    const skill = source.locator('.skill-action')
    assert.equal(await skill.count(), 1, 'positive route must expose White Lily Activate')
    assert.ok(await skill.isEnabled(), 'positive route must enable White Lily Activate')
    await skill.click({ force: true })
    await skipAnimations(page)

    const effectPanel = page.locator('.effect-panel[role="alertdialog"]:visible').first()
    await effectPanel.waitFor({ state: 'visible' })
    await effectPanel.getByRole('button', { name: '確認發動', exact: true }).click()
    await skipAnimations(page)

    const extraModal = page.locator('.extra-deck-attack-modal[role="alertdialog"]:visible').first()
    await extraModal.waitFor({ state: 'visible' })
    const candidate = extraModal.getByTestId(`extra-deck-attack-candidate-${extraInstanceId}`)
    await candidate.waitFor({ state: 'visible' })
    const extraArt = await readCardArt(candidate.locator('.card-face').first())
    assertArt(
      extraArt,
      'Avatar of Destiny',
      byNumber.get(extraCardNumber).imageUrl,
    )
    await candidate.click({ force: true })

    const materialized = page.locator(
      `.bottom-field .combat-card-wrap[data-card-instance-id="${extraInstanceId}"]`,
    )
    await materialized.waitFor({ state: 'visible' })
    await page.locator('[aria-label="玩家 EXTRA Deck 0 張"]').waitFor({ state: 'visible' })
    await page.locator('[aria-label="Avatar of Destiny HP 卡 8 張"]').waitFor({ state: 'visible' })
    assert.equal(
      await page.locator(`.bottom-field .combat-card-wrap[data-card-instance-id="${sourceInstanceId}"]`).count(),
      0,
      'White Lily must leave the battle area as the self-faint cost',
    )

    const trace = await readTrace(page)
    // The modal choice is recorded as `resolve-extra-deck-attack`; the direct
    // materialization it invokes is intentionally not duplicated as a second
    // public command-log entry.
    for (const commandKind of ['begin-activate-skill', 'resolve-ability-effect', 'resolve-extra-deck-attack']) {
      assert.ok(
        trace.some((entry) => entry.commandKind === commandKind),
        `positive route must leave a ${commandKind} trace`,
      )
    }
    assert.deepEqual(errors, [], `positive browser errors: ${errors.join('; ')}`)
    return {
      route,
      ready: true,
      selfFainted: true,
      enteredBattle: true,
      sourceArt,
      extraArt,
      traceKinds: trace.map((entry) => entry.commandKind),
    }
  } finally {
    await page.close()
  }
}

const runNegative = async (browser, viewport, sourceCardNumber, extraCardNumber) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(10000)
  const errors = recordBrowserErrors(page)
  const route = `bs11-090-extra-deck:${sourceCardNumber}:${extraCardNumber}:negative`
  try {
    await routeArt(page, sourceCardNumber)
    await routeArt(page, extraCardNumber)
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=BS11-090,BS11-091`,
      { waitUntil: 'domcontentloaded' },
    )
    await page.locator('.game-shell').waitFor({ state: 'visible' })

    const source = page.locator(
      `.bottom-field .combat-card-wrap[data-card-instance-id="${sourceInstanceId}"]`,
    )
    await source.waitFor({ state: 'visible' })
    const sourceArt = await readCardArt(source.locator('.card-face').first())
    assertArt(
      sourceArt,
      'White Lily Cookie',
      byNumber.get(sourceCardNumber).imageUrl,
    )

    const skill = source.locator('.skill-action')
    if (await skill.count()) {
      assert.equal(await skill.isEnabled(), false, 'negative route must disable White Lily Activate')
    }
    assert.equal(
      await page.locator('.effect-panel[role="alertdialog"]:visible').count(),
      0,
      'negative route must not open the activation panel',
    )
    assert.equal(
      await page.locator(`.bottom-field .combat-card-wrap[data-card-instance-id="${extraInstanceId}"]`).count(),
      0,
      'negative route must keep Avatar in EXTRA',
    )
    assert.equal(
      await page.locator('[aria-label="玩家 EXTRA Deck 1 張"]').count(),
      1,
      'negative route must keep one EXTRA card available',
    )
    const trace = await readTrace(page)
    assert.equal(
      trace.some((entry) => entry.commandKind === 'begin-activate-skill'),
      false,
      'negative route must not begin White Lily Activate',
    )
    assert.deepEqual(errors, [], `negative browser errors: ${errors.join('; ')}`)
    return {
      route,
      ready: false,
      entryBlocked: true,
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
try {
  const results = []
  for (const viewport of viewports) for (const [sourceCardNumber, extraCardNumber] of [
    ['BS11-090', 'BS11-091'], ['BS11-090@1', 'BS11-091@1'], ['BS11-090@2', 'BS11-091@1'],
  ]) {
    results.push({
      sourceCardNumber,
      extraCardNumber,
      viewport,
      positive: await runPositive(browser, viewport, sourceCardNumber, extraCardNumber),
      negative: await runNegative(browser, viewport, sourceCardNumber, extraCardNumber),
    })
  }
  console.log(JSON.stringify({
    browser: 'local playwright',
    baseUrl,
    scope: 'BS11-090 White Lily self-faint Activate, direct BS11-091 EXTRA entry, official-art/fallback surface, and non-main-phase blocking',
    results,
  }, null, 2))
} finally {
  await browser.close()
}
