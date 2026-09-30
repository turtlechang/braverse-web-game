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
    cardNumber: 'BS11-089',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/4RDEQ4phYrJ6QlIvbGl38g.webp',
  },
  {
    cardNumber: 'BS11-089@1',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/Gn3oDHuTxm37QLph-4L0wg.webp',
  },
  {
    cardNumber: 'BS11-089@2',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/jV9gCgWFRwRoJGlX7xH0Uw.webp',
  },
].map((card) => ({
  ...card,
  baseCardNumber: 'BS11-089',
  name: 'Silent Salt Cookie',
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
  assert.ok(art.image !== null || art.fallback, `${expected.cardNumber} must render official art or fallback`)
  if (art.image) {
    assert.equal(art.image.alt, expected.name)
    assert.equal(art.image.src, expected.imageUrl)
  }
}

const openAndDeploy = async (page, expected) => {
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

const resolveOnPlay = async (page, expected, conditionMet) => {
  const effectPanel = page.locator('.effect-panel[role=alertdialog]:visible').first()
  await effectPanel.waitFor({ state: 'visible' })
  const activate = effectPanel.getByRole('button', { name: '確認發動', exact: true })
  assert.ok(await enabled(activate), `${expected.cardNumber} On Play effect must be confirmable`)
  await activate.click({ force: true })

  const draw = page.locator('.draw-up-to-modal:visible').first()
  await draw.waitFor({ state: 'visible' })
  const drawTwo = draw.locator('.draw-up-to-option').filter({ hasText: '抽 2 張' }).first()
  assert.ok(await enabled(drawTwo), `${expected.cardNumber} must offer drawing two cards`)
  await drawTwo.click({ force: true })
  const drawConfirm = draw.getByRole('button', { name: '抽取 2 張牌', exact: true })
  assert.ok(await enabled(drawConfirm), `${expected.cardNumber} draw-two choice must be confirmable`)
  await drawConfirm.click({ force: true })

  const discard = page.locator('.hand-discard-modal:visible').first()
  await discard.waitFor({ state: 'visible' })
  assert.match(await discard.innerText(), /步驟 2\/2|棄置手牌/)
  const handCard = discard.locator('.hand-discard-card-option button').first()
  assert.ok(await enabled(handCard), `${expected.cardNumber} must expose a hand discard candidate`)
  await handCard.click({ force: true })
  const discardConfirm = discard.getByRole('button', { name: /確認棄置 \(1\)/ }).first()
  assert.ok(await enabled(discardConfirm), `${expected.cardNumber} discard choice must be confirmable`)
  await discardConfirm.click({ force: true })
  await discard.waitFor({ state: 'hidden', timeout: 12000 }).catch(() => {})
  await skipAnimations(page)

  const finalEffectPanel = page.locator('.effect-panel[role=alertdialog]:visible').first()
  if (conditionMet) {
    await finalEffectPanel.waitFor({ state: 'visible' })
    const finalConfirm = finalEffectPanel.getByRole('button', { name: '確認發動', exact: true })
    assert.ok(await enabled(finalConfirm), `${expected.cardNumber} final HP branch must be confirmable`)
    await finalConfirm.click({ force: true })
    await skipAnimations(page)
  } else {
    await wait(500)
    assert.equal(
      await page.locator('.effect-panel[role=alertdialog]:visible').count(),
      0,
      `${expected.cardNumber} negative Refresh branch must no-op without a second panel`,
    )
  }

  const expectedHp = conditionMet ? 5 : 4
  await page.locator(
    `.bottom-field .hp-card-stack[aria-label="${expected.name} HP 卡 ${expectedHp} 張"]`,
  ).waitFor({ state: 'visible' })
}

const run = async (browser, viewport, expected, conditionMet) => {
  const page = await browser.newPage({ viewport })
  await routeBs11OfficialArt(page)
  page.setDefaultTimeout(10000)
  const errors = recordBrowserErrors(page)
  const route = `bs11-089-on-play:${expected.cardNumber}:${conditionMet ? 'positive' : 'negative'}`
  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${expected.baseCardNumber}`,
      { waitUntil: 'domcontentloaded' },
    )
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    const art = await openAndDeploy(page, expected)
    await resolveOnPlay(page, expected, conditionMet)
    const trace = await readTrace(page)
    for (const commandKind of [
      'deploy-cookie',
      'begin-activate-skill',
      'resolve-ability-effect',
      'resolve-draw-up-to',
      'resolve-opponent-hand-discard',
    ]) {
      assert.ok(
        trace.some((entry) => entry.commandKind === commandKind),
        `${expected.cardNumber} ${conditionMet ? 'positive' : 'negative'} route must leave a ${commandKind} trace`,
      )
    }
    assert.deepEqual(errors, [], `${expected.cardNumber} browser errors: ${errors.join('; ')}`)
    return {
      status: 'PASS',
      route,
      art,
      hpAfter: conditionMet ? 5 : 4,
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
      for (const conditionMet of [true, false]) {
        try {
          const result = await run(browser, viewport, expected, conditionMet)
          output.push({ viewport, cardNumber: expected.cardNumber, conditionMet, ...result })
          console.log(`PASS ${expected.cardNumber} ${conditionMet ? 'positive' : 'negative'} ${viewport.width}x${viewport.height}`)
        } catch (error) {
          output.push({
            viewport,
            cardNumber: expected.cardNumber,
            conditionMet,
            status: 'FAIL',
            error: String(error),
          })
          console.error(`FAIL ${expected.cardNumber} ${conditionMet ? 'positive' : 'negative'} ${viewport.width}x${viewport.height}:`, error)
        }
      }
    }
  }
} finally {
  await browser.close()
}

const artifactDir = resolve(root, 'test-results', 'bs11-089-on-play-browser')
await mkdir(artifactDir, { recursive: true })
const artifactPath = resolve(artifactDir, `bs11-089-on-play-browser-${Date.now()}.json`)
const passed = output.filter((entry) => entry.status === 'PASS').length
const failed = output.filter((entry) => entry.status === 'FAIL').length
const artifact = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  scope: 'BS11-089 base/@1/@2 promoted-pool test-state On Play mill-three, draw-up-to-two, discard-one, Refresh-gated +1 HP, official-art/fallback surface, and negative no-Refresh branch; not formal deck or online acceptance',
  summary: { total: output.length, passed, failed },
  results: output,
}
await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ ...artifact, artifactPath }, null, 2))
if (failed > 0) process.exitCode = 1
