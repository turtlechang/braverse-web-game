import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
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
    cardNumber: 'BS11-097',
    name: 'Cream Jelly Worm',
    instanceId: 'bs11-097-demo-source',
    targetInstanceId: 'bs11-097-demo-target',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/tFj8kC-_VrSDaJUxigHiRw.webp',
  },
  {
    cardNumber: 'BS11-098',
    name: 'Cream Skelecake Archer',
    instanceId: 'bs11-098-demo-source',
    targetInstanceId: 'bs11-098-demo-target',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/8oK2QhvTrZ_koInJHf5xnQ.webp',
  },
  {
    cardNumber: 'BS11-099',
    name: 'Cream Roll Hog Rider',
    instanceId: 'bs11-099-demo-source',
    targetInstanceId: 'bs11-099-demo-target',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/Qm4brmJHL23YnQL5iY0kIQ.webp',
  },
]

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

const advanceIfPresent = async (panel) => {
  const next = panel.getByRole('button', { name: '下一步', exact: true })
  if (await visible(next)) await next.click({ force: true })
}

const runPositive = async (browser, viewport, expected) => {
  const page = await browser.newPage({ viewport })
  await routeBs11OfficialArt(page)
  page.setDefaultTimeout(10000)
  const errors = recordBrowserErrors(page)
  const route = `bs11-097-099-special-play:${expected.cardNumber}:positive`
  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${expected.cardNumber}`,
      { waitUntil: 'domcontentloaded' },
    )
    await page.locator('.game-shell').waitFor({ state: 'visible' })

    const source = page.locator(
      `.bottom-field .combat-card-wrap[data-card-instance-id="${expected.instanceId}"]`,
    )
    await source.waitFor({ state: 'visible' })
    const sourceArt = await readCardArt(source.locator('.card-face').first())
    assertArt(sourceArt, expected.name, expected.imageUrl)

    const skill = source.locator('.skill-action')
    assert.equal(await skill.count(), 1, `${expected.cardNumber} positive route must expose Activate`)
    assert.ok(await enabled(skill), `${expected.cardNumber} positive route must enable Activate`)
    await skill.click({ force: true })
    await skipAnimations(page)
    let panel = await waitForEffectPanel(page)

    if (expected.cardNumber === 'BS11-097' || expected.cardNumber === 'BS11-098') {
      const payment = panel.locator('.effect-candidates-payment button').first()
      assert.ok(await enabled(payment), `${expected.cardNumber} must expose a black energy payment`)
      await payment.click({ force: true })
      await advanceIfPresent(panel)
      panel = await waitForEffectPanel(page)
    }

    if (expected.cardNumber === 'BS11-097') {
      const discard = panel.locator('.effect-candidates-discard-hand button').first()
      assert.ok(await enabled(discard), 'BS11-097 must expose its hand discard cost')
      await discard.click({ force: true })
      await advanceIfPresent(panel)
      panel = await waitForEffectPanel(page)
    }

    if (expected.cardNumber === 'BS11-099') {
      assert.equal(
        await panel.locator('.effect-candidates-target button').count(),
        0,
        'BS11-099 source-only target must be fixed by the rules layer',
      )
      assert.ok(
        (await panel.innerText()).includes('將這張餅乾放入棄牌區。'),
        'BS11-099 panel must describe its fixed source movement',
      )
    } else {
      const target = panel.locator('.effect-candidates-target button').first()
      assert.ok(await enabled(target), `${expected.cardNumber} must expose its legal target`)
      await target.click({ force: true })
    }
    await panel.getByRole('button', { name: '確認發動', exact: true }).click({ force: true })
    await settleEffectPanel(page, panel)

    if (expected.cardNumber === 'BS11-097') {
      await page.locator(
        `.top-field .combat-card-wrap[data-card-instance-id="${expected.targetInstanceId}"]`,
      ).waitFor({ state: 'detached' })
    } else if (expected.cardNumber === 'BS11-098') {
      await page.locator(
        `.top-field .hp-card-stack[aria-label="${expected.targetInstanceId} HP 卡 1 張"]`,
      ).waitFor({ state: 'visible' })
    } else {
      await page.locator(
        `.bottom-field .combat-card-wrap[data-card-instance-id="${expected.instanceId}"]`,
      ).waitFor({ state: 'detached' })
    }

    const trace = await readTrace(page)
    for (const commandKind of ['begin-activate-skill', 'resolve-ability-effect']) {
      assert.ok(
        trace.some((entry) => entry.commandKind === commandKind),
        `${expected.cardNumber} positive route must leave a ${commandKind} trace`,
      )
    }
    assert.deepEqual(errors, [], `${expected.cardNumber} positive browser errors: ${errors.join('; ')}`)
    return {
      route,
      ready: true,
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
  const route = `bs11-097-099-special-play:${expected.cardNumber}:negative`
  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${expected.cardNumber}`,
      { waitUntil: 'domcontentloaded' },
    )
    await page.locator('.game-shell').waitFor({ state: 'visible' })

    const source = page.locator(
      `.bottom-field .combat-card-wrap[data-card-instance-id="${expected.instanceId}"]`,
    )
    await source.waitFor({ state: 'visible' })
    const sourceArt = await readCardArt(source.locator('.card-face').first())
    assertArt(sourceArt, expected.name, expected.imageUrl)

    const skill = source.locator('.skill-action')
    if (await skill.count()) {
      assert.equal(await skill.isEnabled(), false, `${expected.cardNumber} negative route must disable Activate`)
    }
    assert.equal(
      await page.locator('.effect-panel[role="alertdialog"]:visible').count(),
      0,
      `${expected.cardNumber} negative route must not open the activation panel`,
    )
    assert.equal(
      await page.locator(
        `.bottom-field .combat-card-wrap[data-card-instance-id="${expected.instanceId}"]`,
      ).count(),
      1,
      `${expected.cardNumber} negative route must keep the source in battle`,
    )
    const trace = await readTrace(page)
    assert.equal(
      trace.some((entry) => entry.commandKind === 'begin-activate-skill'),
      false,
      `${expected.cardNumber} negative route must not begin Activate`,
    )
    assert.deepEqual(errors, [], `${expected.cardNumber} negative browser errors: ${errors.join('; ')}`)
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
  for (const viewport of viewports) {
    for (const expected of cards) {
      results.push({
        viewport,
        cardNumber: expected.cardNumber,
        positive: await runPositive(browser, viewport, expected),
        negative: await runNegative(browser, viewport, expected),
      })
    }
  }
  console.log(JSON.stringify({
    browser: 'local playwright',
    baseUrl,
    scope: 'BS11-097～099 shared Special Play Cookie gate, payment/cost/target/settlement, official-art/fallback surface, and negative gating',
    results,
  }, null, 2))
} finally {
  await browser.close()
}
