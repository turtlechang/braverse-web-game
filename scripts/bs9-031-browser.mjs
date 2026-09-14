import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import bs9Candidates from '../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json' with { type: 'json' }

/**
 * BS9-031 Alchemist Cookie 的實卡 A/B Browser 驗證：
 * - 正向：先用正式 P-018 Mustard Cookie 的 OnPlay 效果傷害移除己方
 *   HP，再由真實 HP FLIP 提供己方 LV.3 Cookie，支付棄 1 張手牌並驗證
 *   「自己回合」Then 抽牌可選 0 或 1 張。
 * - 負向：同一張實卡與目標、棄牌資源保留，但切到對手回合；
 *   +1 HP 仍結算，Then 抽牌決策不應出現。
 *
 * 兩條路徑都使用 localhost 的候選 fixture，畫面上的 Cookie、手牌、
 * HP 卡與牌庫內容來自正式官方 adapter；候選資料不會寫入正式牌池。
 * Browser gate 只接受 FLIP reveal 的 exact official image 已實際載入，
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

const port = Number(process.env.BRAVERSE_BS9_031_TEST_PORT ?? 4199)
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

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const recordBy = (cardNumber) => {
  const record = bs9Candidates.cards.find((candidate) => candidate.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS9 candidate ${cardNumber}`)
  return record
}
const visibleFlip = (page) => page.locator('.flip-response-modal:visible').first()
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
    // Official art is intentionally retained in the fixture. A restricted
    // network may block it; CardFace's named fallback is still a visual card.
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

const assertPhysicalFlipCard = async (flip, record, imageRequested) => {
  const reveal = flip.locator('.flip-reveal-card')
  assert.equal(await reveal.count(), 1, 'BS9-031 FLIP should render a revealed card')
  return assertPhysicalCardImage(reveal, record, imageRequested)
}

const deployMustardAndResolveOnPlay = async (page) => {
  const mustard = page.locator('.bottom-hand .hand-card[title="Mustard Cookie"]')
  await mustard.waitFor({ state: 'visible' })
  await mustard.click()
  const deploy = page.locator('.bottom-hand .hand-card-actions:visible').first().getByRole('button', {
    name: '登場',
    exact: true,
  })
  await deploy.waitFor({ state: 'visible' })
  await deploy.click()

  // P-018 has two un-targeted damage effects. The shared EffectPanel first
  // collects its discard cost, then advances through both effects using the
  // same UI confirmation path as a normal match.
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').first()
  await panel.waitFor({ state: 'visible' })
  assert.match(await panel.innerText(), /Mustard Cookie/)
  const discard = panel.locator('.effect-candidates-discard-hand button').first()
  await discard.waitFor({ state: 'visible' })
  await discard.click()
  for (let step = 0; step < 3; step += 1) {
    const current = page.locator('.effect-panel[role="alertdialog"]:visible').first()
    if (await current.count() === 0) break
    const primary = current.locator('.effect-panel-primary-action')
    await primary.waitFor({ state: 'visible' })
    await primary.click()
    await page.waitForTimeout(100)
  }
  await visibleFlip(page).waitFor({ state: 'visible' })
}

const inspectFlipAndPay = async (page, record, imageRequested) => {
  const flip = visibleFlip(page)
  await flip.waitFor({ state: 'visible' })
  assert.match(await flip.innerText(), /Alchemist Cookie FLIP/)
  assert.match(await flip.innerText(), /Discard 1 card/i)
  assert.match(await flip.innerText(), /LV\.3 Cookies gains \+1 HP/i)
  assert.match(await flip.innerText(), /activated during your turn/i)
  const imageEvidence = await assertPhysicalFlipCard(flip, record, imageRequested)

  const targetGroup = flip.getByRole('group', { name: 'FLIP 效果目標' })
  const targets = targetGroup.locator('button')
  assert.equal(await targets.count(), 1, 'BS9-031 should expose exactly one LV.3 target')
  assert.match(await targets.first().innerText(), /Mustard Cookie/)
  assert.doesNotMatch(await flip.innerText(), /Golden Cheese Cookie|Pomegranate Cookie/)
  await targets.first().click()

  const handOptions = flip.locator('.flip-card-page button')
  assert.ok((await handOptions.count()) >= 3, 'BS9-031 should expose real hand cards for discard')
  await handOptions.first().click()
  const activate = flip.getByRole('button', { name: '發動 FLIP', exact: true })
  assert.equal(await activate.isEnabled(), true, 'BS9-031 should be activatable after target and discard selection')
  await activate.click()
  return imageEvidence
}

const assertBoardAfterResolution = async (page, { drawCount, activeTurn }) => {
  const target = page.locator(
    '.bottom-field [data-card-instance-id="bs9-bs9-031-trigger"] .badge-hp',
  )
  await target.waitFor({ state: 'visible' })
  assert.match(await target.innerText(), /^5\//, 'LV.3 target should gain one HP card')
  const handCount = drawCount
    ? 3
    : 2
  assert.equal(
    await page.locator('.bottom-hand .hand-card-wrap').count(),
    handCount,
    `BS9-031 ${activeTurn} route should leave ${handCount} hand cards`,
  )
  assert.equal(
    await page.getByLabel(`玩家牌庫 ${drawCount ? 18 : 19} 張`).count(),
    1,
    `BS9-031 ${activeTurn} route should expose the expected deck count`,
  )
  assert.equal(
    await page.locator('.bottom-field [title="棄牌區 3 張"]').count(),
    1,
    'BS9-031 should place the discarded hand card and revealed FLIP in discard',
  )
  assert.equal(await page.locator('[role="alertdialog"]:visible').count(), 0)
}

const runPositive = async (browser, viewport, drawCount, cardNumber) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(7000)
  const requestedImages = new Set()
  page.on('request', (request) => {
    if (request.resourceType() === 'image') requestedImages.add(request.url())
  })
  const errors = recordBrowserErrors(page)
  const route = `bs9-card:${cardNumber}`
  const result = { route, cardNumber, viewport, drawCount, status: 'FAIL', actions: [] }
  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=BS9-031`,
      { waitUntil: 'domcontentloaded' },
    )
    await waitForGame(page)
    const record = recordBy(cardNumber)
    await deployMustardAndResolveOnPlay(page)
    result.actions.push('deploy-mustard-on-play-effect-damage')
    result.imageEvidence = await inspectFlipAndPay(
      page,
      record,
      () => requestedImages.has(record.imageUrl),
    )
    result.actions.push('inspect-target-and-pay-discard')

    const draw = visibleDraw(page)
    await draw.waitFor({ state: 'visible' })
    assert.match(await draw.innerText(), /Alchemist Cookie/)
    assert.match(await draw.innerText(), /最多 1 張牌/)
    const options = draw.locator('.draw-up-to-option')
    assert.equal(await options.count(), 2, 'BS9-031 own-turn Then should offer draw 0 or 1')
    await options.nth(drawCount).click()
    await draw.getByRole('button', {
      name: drawCount === 0 ? '略過抽牌' : '抽取 1 張牌',
      exact: true,
    }).click()
    result.actions.push(`resolve-draw-up-to-${drawCount}`)
    await draw.waitFor({ state: 'hidden' })
    await page.waitForTimeout(250)
    await assertBoardAfterResolution(page, { drawCount, activeTurn: 'own-turn' })

    const trace = await readTrace(page)
    assertTraceKind(trace, 'resolve-flip', 'BS9-031 正向路徑應留下 FLIP 結算')
    assertTraceKind(trace, 'resolve-draw-up-to', 'BS9-031 正向路徑應留下 Then 抽牌決策')
    await captureFinalState(page, result)
    assert.equal(result.finalPendingSurfaces, 0, 'Browser route must settle without a pending dialog')
    result.expectedImageUrl = record.imageUrl
    result.exactImageRequested = result.imageEvidence.exactImageRequested
    result.exactImageRendered = result.imageEvidence.exactImageRendered
    result.exactImageLoaded = result.imageEvidence.exactImageLoaded
    assert.deepEqual(errors, [], `BS9-031 positive browser errors: ${errors.join('; ')}`)
    result.status = 'PASS'
    result.screenshot = resolve(
      outputDirectory,
      `bs9-031-${cardNumber}-positive-${viewport.width}x${viewport.height}-draw-${drawCount}.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true })
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 7000)
    await captureFinalState(page, result)
    result.screenshot = resolve(
      outputDirectory,
      `bs9-031-${cardNumber}-positive-${viewport.width}x${viewport.height}-draw-${drawCount}-failed.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true }).catch(() => {})
  } finally {
    await page.close()
  }
  return result
}

const runNegative = async (browser, viewport, cardNumber) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(7000)
  const requestedImages = new Set()
  page.on('request', (request) => {
    if (request.resourceType() === 'image') requestedImages.add(request.url())
  })
  const errors = recordBrowserErrors(page)
  const route = `bs9-card-negative:${cardNumber}`
  const result = { route, cardNumber, viewport, status: 'FAIL', actions: [] }
  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=BS9-031`,
      { waitUntil: 'domcontentloaded' },
    )
    await waitForGame(page)
    const record = recordBy(cardNumber)
    result.imageEvidence = await inspectFlipAndPay(
      page,
      record,
      () => requestedImages.has(record.imageUrl),
    )
    result.actions.push('inspect-target-and-pay-discard')
    await page.waitForTimeout(300)
    assert.equal(await page.locator('.draw-up-to-modal:visible').count(), 0)
    await assertBoardAfterResolution(page, { drawCount: 0, activeTurn: 'opponent-turn' })
    const trace = await readTrace(page)
    assertTraceKind(trace, 'resolve-flip', 'BS9-031 負向路徑仍應留下 HP FLIP 結算')
    assertNoTraceKind(trace, 'resolve-draw-up-to', '對手回合不應送出 Then 抽牌決策')
    await captureFinalState(page, result)
    assert.equal(result.finalPendingSurfaces, 0, 'Browser route must settle without a pending dialog')
    result.expectedImageUrl = record.imageUrl
    result.exactImageRequested = result.imageEvidence.exactImageRequested
    result.exactImageRendered = result.imageEvidence.exactImageRendered
    result.exactImageLoaded = result.imageEvidence.exactImageLoaded
    assert.deepEqual(errors, [], `BS9-031 negative browser errors: ${errors.join('; ')}`)
    result.status = 'PASS'
    result.screenshot = resolve(
      outputDirectory,
      `bs9-031-${cardNumber}-negative-${viewport.width}x${viewport.height}.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true })
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 7000)
    await captureFinalState(page, result)
    result.screenshot = resolve(
      outputDirectory,
      `bs9-031-${cardNumber}-negative-${viewport.width}x${viewport.height}-failed.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true }).catch(() => {})
  } finally {
    await page.close()
  }
  return result
}

const preview = spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)

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
  throw new Error(`Vite preview did not start on ${baseUrl}`)
}

const results = []
const cardNumbers = bs9Candidates.cards
  .filter((record) => record.baseCardNumber === 'BS9-031')
  .map((record) => record.cardNumber)
if (cardNumbers.length === 0) throw new Error('Missing BS9-031 candidate records')
let browser
try {
  await waitForPreview()
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })
  const viewports = [
    { viewport: { width: 1907, height: 863 }, drawCount: 1 },
    { viewport: { width: 1164, height: 777 }, drawCount: 0 },
  ]
  for (const { viewport, drawCount } of viewports) {
    for (const cardNumber of cardNumbers) {
      results.push(await runPositive(browser, viewport, drawCount, cardNumber))
      results.push(await runNegative(browser, viewport, cardNumber))
    }
  }
} finally {
  await browser?.close()
  if (preview.exitCode === null) preview.kill()
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  scope: 'BS9-031 physical FLIP target, discard cost, own-turn Then draw 0/1, and opponent-turn A/B.',
  total: results.length,
  passed: results.filter((result) => result.status === 'PASS').length,
  imageLoadedLanes: results.filter((result) => result.status === 'PASS' && result.exactImageLoaded).length,
  traceLanes: results.filter((result) => result.status === 'PASS' && result.traceCommandKinds?.length > 0).length,
  settledLanes: results.filter((result) => result.status === 'PASS' && result.finalPendingSurfaces === 0).length,
  failed: results.filter((result) => result.status !== 'PASS'),
  results,
}
writeFileSync(
  resolve(outputDirectory, 'bs9-031-browser.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
process.exitCode = report.failed.length > 0 ? 1 : 0
