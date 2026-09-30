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
  'BS11-088': {
    name: 'Moonlight Cookie',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/NTFxAoSFLjvIT5AV8oYwuw.webp',
  },
  'BS11-088@1': {
    name: 'Moonlight Cookie',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/K8-TwOgrDwB1GT4Qn3-yag.webp',
  },
  'BS11-105': {
    name: 'Red Velvet Dragon',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/p2LwQds_Sl6mHis0p2k0Jw.webp',
  },
}

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const readTrace = (page) => page.evaluate(() => window.__braverseContractTrace ?? [])
const sourceId = (cardNumber) => `bs11-${cardNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-attack-source`

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
  if (art.src) {
    assert.equal(art.alt, expected.name)
    assert.equal(art.src, expected.imageUrl)
    return
  }
  assert.equal(art.fallback, true, `${expected.name} must render an image or named fallback`)
  assert.match(art.fallbackText, new RegExp(expected.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

const readTargetHp = async (page) => page.locator('.top-field .combat-card-wrap').first()
  .locator('.badge-hp').innerText()

const openRoute = async (page, cardNumber, positive) => {
  const route = `bs11-088-105-attack-then:${cardNumber}:${positive ? 'positive' : 'negative'}`
  const contractCard = cardNumber.split('@')[0]
  await page.goto(
    `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${encodeURIComponent(contractCard)}`,
    { waitUntil: 'domcontentloaded' },
  )
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await wait(260)
  return route
}

const settleAttackThen = async (page, cardNumber, positive, expected) => {
  const source = page.locator(`.combat-card-wrap[data-card-instance-id="${sourceId(cardNumber)}"]`).first()
  await source.waitFor({ state: 'visible' })
  const art = await readCardArt(source.locator('.card-face').first())
  assertArt(art, expected)

  const initialHp = await readTargetHp(page)
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
  if (positive) {
    await panel.waitFor({ state: 'visible' })
    const body = await panel.innerText()
    assert.match(body, /攻擊後續效果|傷害|目標/, `${cardNumber} must expose the attack Then decision surface`)
    const target = panel.locator('.effect-candidates-target button:not(.is-selected):not(:disabled)').first()
    await target.waitFor({ state: 'visible' })
    await target.click({ force: true })
    await wait(120)
    const confirm = panel.locator('.effect-panel-primary-action:not(:disabled)').first()
    await confirm.waitFor({ state: 'visible' })
    await confirm.click({ force: true })
    await page.waitForFunction(
      () => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === 'resolve-attack-effect'),
      undefined,
      { timeout: 10_000 },
    )
    const finalHp = await readTargetHp(page)
    assert.notEqual(finalHp, initialHp, `${cardNumber} positive Then must change the selected target HP`)
    const trace = await readTrace(page)
    assert.ok(trace.some((entry) => entry.commandKind === 'resolve-attack-effect'))
    return {
      art,
      initialHp,
      finalHp,
      traceKinds: trace.map((entry) => entry.commandKind),
      evidence: 'attack-then-target-damage',
    }
  }

  if (await panel.count() && await panel.isVisible().catch(() => false)) {
    const skip = panel.getByRole('button', { name: '略過', exact: true }).first()
    if (await skip.count() && await skip.isVisible().catch(() => false)) {
      await skip.click({ force: true })
    } else {
      const confirm = panel.getByRole('button', { name: /確認|下一步/, exact: false }).last()
      await confirm.waitFor({ state: 'visible' })
      await confirm.click({ force: true })
    }
  }
  await page.waitForTimeout(350)
  const finalHp = await readTargetHp(page)
  assert.equal(finalHp, initialHp, `${cardNumber} negative Then must leave target HP unchanged`)
  const trace = await readTrace(page)
  assert.ok(
    trace.some((entry) => entry.commandKind === 'resolve-attack-effect'),
    `${cardNumber} negative Then must emit an explicit attack-effect resolution`,
  )
  const steps = trace
    .filter((entry) => entry.commandKind === 'resolve-attack-effect')
    .flatMap((entry) => entry.steps ?? [])
    .map(String)
  const bodyAfter = await page.locator('body').innerText()
  assert.ok(
    steps.some((step) => /未發動|不發動|略過|條件不成立|未執行/.test(step)) ||
      /未發動|不發動|略過|條件不成立|未執行/.test(bodyAfter),
    `${cardNumber} negative Then must leave no-op evidence`,
  )
  return {
    art,
    initialHp,
    finalHp,
    traceKinds: trace.map((entry) => entry.commandKind),
    evidence: 'attack-then-condition-no-op',
  }
}

const browser = await chromium.launch({
  headless: true,
  ...(browserExecutable ? { executablePath: browserExecutable } : {}),
})
const output = []
try {
  for (const viewport of viewports) {
    for (const cardNumber of Object.keys(cards)) {
      for (const positive of [true, false]) {
        const page = await browser.newPage({ viewport })
        await routeBs11OfficialArt(page)
        page.setDefaultTimeout(10_000)
        const errors = recordBrowserErrors(page)
        const result = { viewport, cardNumber, positive, status: 'FAIL' }
        try {
          result.route = await openRoute(page, cardNumber, positive)
          result.evidence = await settleAttackThen(page, cardNumber, positive, cards[cardNumber])
          assert.deepEqual(errors, [], `Browser errors: ${errors.join('; ')}`)
          result.status = 'PASS'
        } catch (error) {
          result.error = error instanceof Error ? error.message : String(error)
          result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 7000)
          result.traceKinds = (await readTrace(page).catch(() => [])).map((entry) => entry.commandKind)
        }
        output.push(result)
        console.log(result.status, cardNumber, positive ? 'positive' : 'negative', `${viewport.width}x${viewport.height}`, result.error ?? '')
        await page.close()
      }
    }
  }
  const outputDir = resolve(root, 'test-results/bs11-088-105-attack-then-browser')
  await mkdir(outputDir, { recursive: true })
  const outputPath = resolve(outputDir, `bs11-088-105-attack-then-browser-${Date.now()}.json`)
  await writeFile(outputPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseUrl,
    scope: 'BS11-088／088@1／105 attack Then continuation fixture across 1280x720 and 1164x777; exact variant image/trace/target HP A/B evidence; not payment, formal battle, or online acceptance',
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
