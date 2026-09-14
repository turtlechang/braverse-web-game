import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import bs9Candidates from '../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json' with { type: 'json' }

/**
 * BS9-033 GingerBrave 候選 Browser A/B：
 * - 正向保留 7 張手牌，先付 1 黃色能量、棄唯一的 Yoga Cookie FLIP，
 *   再以支付後 6 張手牌開啟抽 0～2 張決策。
 * - 負向保留相同手牌張數、回合與黃色能量，只把 FLIP 換成非 FLIP 卡，
 *   驗證技能入口由共用規則層封鎖。
 *
 * 桌機使用基本版、平板使用 @1 異圖；兩張官方卡圖另有獨立目視證據。
 * Browser gate 只接受來源卡的 exact official image 已實際載入，
 * 不以 fallback 或只曾發出 request 取代實體卡圖證據。
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES
    ? [process.env.PLAYWRIGHT_NODE_MODULES]
    : [root],
})
const playwright = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwright.chromium ?? playwright.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_BS9_033_TEST_PORT ?? 4201)
const baseUrl = `http://127.0.0.1:${port}`
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')
const browserExecutable =
  process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find((candidate) => existsSync(candidate))
const outputDirectory = resolve(root, 'output/playwright')
mkdirSync(outputDirectory, { recursive: true })

const preview = spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)
const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const recordBy = (cardNumber) => {
  const record = bs9Candidates.cards.find((candidate) => candidate.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS9 candidate ${cardNumber}`)
  return record
}
const visiblePanel = (page) => page.locator('.effect-panel[role="alertdialog"]:visible').first()
const visibleDraw = (page) => page.locator('.draw-up-to-modal:visible').first()
const readTrace = (page) => page.evaluate(() => window.__braverseContractTrace ?? [])

const recordBrowserErrors = (page) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const location = message.location()
    const messageText = message.text()
    if (location.url?.endsWith('/favicon.ico') && messageText.includes('404')) return
    if (
      location.url?.includes('cookierunbraverse.com/data/en_storage/') &&
      /ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(messageText)
    ) return
    errors.push(`console: ${messageText} (${location.url || 'unknown URL'})`)
  })
  return errors
}

const assertTraceKind = (trace, kind, message) => {
  assert.ok(trace.some((entry) => entry.commandKind === kind), message)
}

const assertNoTraceKind = (trace, kind, message) => {
  assert.equal(trace.some((entry) => entry.commandKind === kind), false, message)
}

const assertPhysicalCardImage = async (locator, record, imageRequested) => {
  await locator.waitFor({ state: 'visible' })
  const exactImage = locator.locator(`img[src="${record.imageUrl}"]`).first()
  await exactImage.waitFor({ state: 'visible' })
  await exactImage.evaluate((node) => {
    if (!(node instanceof HTMLImageElement)) {
      throw new Error('official card image locator did not resolve to an img')
    }
    if (node.complete && node.naturalWidth > 0) return undefined
    return new Promise((resolvePromise, rejectPromise) => {
      const timeout = window.setTimeout(() => {
        cleanup()
        rejectPromise(new Error('official image load timed out'))
      }, 10_000)
      const cleanup = () => {
        window.clearTimeout(timeout)
        node.removeEventListener('load', onLoad)
        node.removeEventListener('error', onError)
      }
      const onLoad = () => {
        cleanup()
        if (node.naturalWidth > 0) resolvePromise()
        else rejectPromise(new Error('official image loaded with zero naturalWidth'))
      }
      const onError = () => {
        cleanup()
        rejectPromise(new Error('official image failed to load'))
      }
      node.addEventListener('load', onLoad, { once: true })
      node.addEventListener('error', onError, { once: true })
    })
  })
  const alts = await locator.locator('img').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('alt')),
  )
  assert.ok(alts.includes(record.name), `${record.cardNumber} must render its named official card face`)
  const exactImageRendered = (await exactImage.count()) > 0
  const exactImageLoaded = await exactImage.evaluate(
    (node) => node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0,
  )
  const exactImageRequested =
    typeof imageRequested === 'function' ? imageRequested() : imageRequested
  assert.equal(exactImageRendered, true, `${record.cardNumber} must render its exact official image URL`)
  assert.equal(exactImageLoaded, true, `${record.cardNumber} official image must be loaded, not merely requested`)
  return { exactImageRendered, exactImageLoaded, exactImageRequested }
}

const captureFinalState = async (page, result) => {
  result.trace = await readTrace(page).catch(() => [])
  result.traceCommandKinds = [...new Set(result.trace.map((entry) => entry.commandKind).filter(Boolean))]
  result.finalPendingSurfaces = await page
    .locator('[role="alertdialog"]:visible')
    .count()
    .catch(() => null)
  return result.trace
}

const waitForGame = async (page) => {
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await page.waitForTimeout(250)
}

const sourceCard = (page) => page.locator(
  '.bottom-field [data-card-instance-id="bs9-bs9-033-source"]',
).first()

const assertVisibleGingerBrave = async (page, record, imageRequested) => {
  const source = sourceCard(page)
  await source.waitFor({ state: 'visible' })
  const face = source.locator('.card-face[title="GingerBrave"]')
  assert.equal(await face.count(), 1, 'BS9-033 should remain visible as GingerBrave')
  const imageEvidence = await assertPhysicalCardImage(face, record, imageRequested)
  return { source, imageEvidence }
}

const runPositive = async (browser, viewport, cardNumber, drawCount) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(7_000)
  const requestedImages = new Set()
  page.on('request', (request) => {
    if (request.resourceType() === 'image') requestedImages.add(request.url())
  })
  const errors = recordBrowserErrors(page)
  const route = `bs9-card:${cardNumber}`
  const result = { route, cardNumber, viewport, drawCount, status: 'FAIL', actions: [] }
  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${cardNumber.split('@')[0]}`,
      { waitUntil: 'domcontentloaded' },
    )
    await waitForGame(page)
    const record = recordBy(cardNumber)
    const { source, imageEvidence } = await assertVisibleGingerBrave(
      page,
      record,
      () => requestedImages.has(record.imageUrl),
    )
    result.imageEvidence = imageEvidence
    assert.equal(
      await page.locator('.bottom-hand .hand-card-wrap').count(),
      7,
      'positive fixture should start with seven cards',
    )
    assert.equal(
      await page.locator('.bottom-hand .hand-card[title="Yoga Cookie"]').count(),
      1,
      'positive fixture should expose exactly one real FLIP cost',
    )

    const skill = source.locator('.skill-action')
    assert.equal(await skill.count(), 1, 'GingerBrave should expose its Activate skill')
    assert.equal(await skill.isEnabled(), true, 'seven cards should be legal after the FLIP cost')
    await skill.click()
    result.actions.push('open-activate-skill')

    const panel = visiblePanel(page)
    await panel.waitFor({ state: 'visible' })
    assert.match(await panel.innerText(), /Brave Heart|GingerBrave/)
    const payment = panel.locator('.effect-candidates-payment button:not(:disabled)')
    assert.equal(await payment.count(), 2, 'fixture should expose two yellow payment cards')
    await payment.first().click()
    await panel.locator('.effect-panel-primary-action').click()
    result.actions.push('select-one-yellow-energy')

    const discard = panel.locator('.effect-candidates-discard-hand button:not(:disabled)')
    await discard.first().waitFor({ state: 'visible' })
    assert.equal(await discard.count(), 1, 'only Yoga Cookie should satisfy the FLIP discard cost')
    assert.match(await discard.first().innerText(), /Yoga Cookie/)
    await discard.first().click()
    await panel.locator('.effect-panel-primary-action').click()
    result.actions.push('discard-one-flip')

    const draw = visibleDraw(page)
    await draw.waitFor({ state: 'visible' })
    assert.match(await draw.innerText(), /GingerBrave/)
    assert.match(await draw.innerText(), /最多 2 張牌/)
    const options = draw.locator('.draw-up-to-option')
    assert.equal(await options.count(), 3, 'draw-up-to 2 should offer 0, 1, and 2')
    await options.nth(drawCount).click()
    await draw.getByRole('button', {
      name: drawCount === 0 ? '略過抽牌' : `抽取 ${drawCount} 張牌`,
      exact: true,
    }).click()
    result.actions.push(`resolve-draw-${drawCount}`)
    await draw.waitFor({ state: 'hidden' })
    await page.waitForTimeout(250)

    assert.equal(
      await page.locator('.bottom-hand .hand-card-wrap').count(),
      6 + drawCount,
      'hand count should reflect cost first and optional draw second',
    )
    assert.equal(
      await page.locator('.bottom-hand .hand-card[title="Yoga Cookie"]').count(),
      0,
      'the paid FLIP card should leave the hand',
    )
    assert.equal(await skill.isEnabled(), false, 'Once Per Turn should disable a second activation')
    assert.match(await source.locator('.skill-unavailable-reason').innerText(), /每回合一次/)
    const trace = await readTrace(page)
    assertTraceKind(trace, 'begin-activate-skill', 'positive route should pay the skill cost')
    assertTraceKind(trace, 'resolve-draw-up-to', 'positive route should record the draw choice')
    await captureFinalState(page, result)
    assert.equal(result.finalPendingSurfaces, 0, 'Browser route must settle without a pending dialog')
    result.expectedImageUrl = record.imageUrl
    result.exactImageRequested = result.imageEvidence.exactImageRequested
    result.exactImageRendered = result.imageEvidence.exactImageRendered
    result.exactImageLoaded = result.imageEvidence.exactImageLoaded
    assert.deepEqual(errors, [], `BS9-033 positive browser errors: ${errors.join('; ')}`)
    result.status = 'PASS'
    result.screenshot = resolve(
      outputDirectory,
      `bs9-033-positive-${cardNumber.replace('@', '-at')}-${viewport.width}x${viewport.height}-draw-${drawCount}.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true })
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 7_000)
    await captureFinalState(page, result)
    result.screenshot = resolve(
      outputDirectory,
      `bs9-033-positive-${cardNumber.replace('@', '-at')}-${viewport.width}x${viewport.height}-failed.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true }).catch(() => {})
  } finally {
    await page.close()
  }
  return result
}

const runNegative = async (browser, viewport, cardNumber) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(7_000)
  const requestedImages = new Set()
  page.on('request', (request) => {
    if (request.resourceType() === 'image') requestedImages.add(request.url())
  })
  const errors = recordBrowserErrors(page)
  const route = `bs9-card-negative:${cardNumber}`
  const result = { route, cardNumber, viewport, status: 'FAIL', actions: [] }
  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${cardNumber.split('@')[0]}`,
      { waitUntil: 'domcontentloaded' },
    )
    await waitForGame(page)
    const record = recordBy(cardNumber)
    const { source, imageEvidence } = await assertVisibleGingerBrave(
      page,
      record,
      () => requestedImages.has(record.imageUrl),
    )
    result.imageEvidence = imageEvidence
    assert.equal(await page.locator('.bottom-hand .hand-card-wrap').count(), 7)
    assert.equal(
      await page.locator('.bottom-hand .hand-card[title="Yoga Cookie"]').count(),
      0,
      'negative fixture should retain seven cards but no FLIP cost',
    )
    const skill = source.locator('.skill-action')
    assert.equal(await skill.count(), 1)
    assert.equal(await skill.isEnabled(), false, 'non-FLIP hand must block activation')
    const reason = source.locator('.skill-unavailable-reason')
    assert.ok((await reason.count()) > 0)
    assert.ok((await reason.innerText()).trim().length > 0)
    const trace = await readTrace(page)
    assertNoTraceKind(trace, 'begin-activate-skill', 'blocked route must not pay any cost')
    assertNoTraceKind(trace, 'resolve-draw-up-to', 'blocked route must not open a draw decision')
    await captureFinalState(page, result)
    assert.equal(result.finalPendingSurfaces, 0, 'Browser route must settle without a pending dialog')
    result.expectedImageUrl = record.imageUrl
    result.exactImageRequested = result.imageEvidence.exactImageRequested
    result.exactImageRendered = result.imageEvidence.exactImageRendered
    result.exactImageLoaded = result.imageEvidence.exactImageLoaded
    assert.deepEqual(errors, [], `BS9-033 negative browser errors: ${errors.join('; ')}`)
    result.actions.push('blocked-without-flip-cost')
    result.status = 'PASS'
    result.screenshot = resolve(
      outputDirectory,
      `bs9-033-negative-${cardNumber.replace('@', '-at')}-${viewport.width}x${viewport.height}.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true })
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 7_000)
    await captureFinalState(page, result)
    result.screenshot = resolve(
      outputDirectory,
      `bs9-033-negative-${cardNumber.replace('@', '-at')}-${viewport.width}x${viewport.height}-failed.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true }).catch(() => {})
  } finally {
    await page.close()
  }
  return result
}

const waitForPreview = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (preview.exitCode !== null) {
      throw new Error(`Vite preview exited before serving on ${baseUrl}`)
    }
    try {
      if ((await fetch(baseUrl)).ok) return
    } catch {
      // Preview is still starting.
    }
    await wait(100)
  }
  throw new Error(`Vite preview did not start at ${baseUrl}`)
}

let browser
const results = []
try {
  await waitForPreview()
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })
  const cardNumbers = bs9Candidates.cards
    .filter((record) => record.baseCardNumber === 'BS9-033')
    .map((record) => record.cardNumber)
  if (cardNumbers.length === 0) throw new Error('Missing BS9-033 candidate records')
  for (const scenario of [
    ...cardNumbers.map((cardNumber) => ({ viewport: { width: 1907, height: 863 }, cardNumber, drawCount: 2 })),
    ...cardNumbers.map((cardNumber) => ({ viewport: { width: 1164, height: 777 }, cardNumber, drawCount: 0 })),
  ]) {
    const positive = await runPositive(
      browser,
      scenario.viewport,
      scenario.cardNumber,
      scenario.drawCount,
    )
    results.push(positive)
    console.log(
      `${positive.status} positive ${scenario.cardNumber} ${scenario.viewport.width}x${scenario.viewport.height}`,
      positive.error ?? '',
    )
    const negative = await runNegative(browser, scenario.viewport, scenario.cardNumber)
    results.push(negative)
    console.log(
      `${negative.status} negative ${scenario.cardNumber} ${scenario.viewport.width}x${scenario.viewport.height}`,
      negative.error ?? '',
    )
  }
} finally {
  await browser?.close()
  if (preview.exitCode === null) preview.kill()
}

const report = {
  baseUrl,
  scope: 'BS9-033 base/@1 candidate Activate; post-cost hand threshold, yellow energy, FLIP discard, draw 0/2, and no-FLIP blocker.',
  total: results.length,
  passed: results.filter((result) => result.status === 'PASS').length,
  imageLoadedLanes: results.filter((result) => result.status === 'PASS' && result.exactImageLoaded).length,
  traceLanes: results.filter((result) => result.status === 'PASS' && result.traceCommandKinds?.length > 0).length,
  settledLanes: results.filter((result) => result.status === 'PASS' && result.finalPendingSurfaces === 0).length,
  failed: results.filter((result) => result.status !== 'PASS'),
  results,
}
writeFileSync(
  resolve(outputDirectory, 'bs9-033-browser.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
process.exitCode = report.failed.length > 0 ? 1 : 0
