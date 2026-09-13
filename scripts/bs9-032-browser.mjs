import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import bs9Candidates from '../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json' with { type: 'json' }

/**
 * BS9-032 Yoga Cookie 的實卡 FLIP A/B Browser 驗證：
 * - 正向：正式 P-018 的 On Play 效果傷害翻開 BS9-032，先選擇抽 0／1，
 *   再確認 Then 只列出休息中的己方 Pomegranate Cookie；桌機選取目標，
 *   平板選 0，兩條都驗證可選語意。
 * - 負向：保留相同卡片、休息目標與抽牌資源，只切到對手回合；第一段
 *   抽牌仍可處理，Then 不得顯示 Yoga Cookie 的目標面板或改變休息狀態。
 *
 * 所有路徑都使用 localhost candidate fixture，沒有把 BS9 寫入正式牌池。
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

const port = Number(process.env.BRAVERSE_BS9_032_TEST_PORT ?? 4203)
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
const visibleEffect = (page) => page.locator('.effect-panel[role="alertdialog"]:visible').first()
const readTrace = (page) => page.evaluate(() => window.__braverseContractTrace ?? [])

const recordBrowserErrors = (page) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const location = message.location()
    const messageText = message.text()
    if (location.url?.endsWith('/favicon.ico') && messageText.includes('404')) return
    errors.push(`console: ${messageText} (${location.url || 'unknown URL'})`)
  })
  return errors
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
  assert.equal(
    exactImageRequested,
    true,
    `${record.cardNumber} exact official image request must be observed`,
  )
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

const fieldCard = (page, instanceId) =>
  page.locator(`.bottom-field [data-card-instance-id="${instanceId}"]`).first()

const isRested = async (page, instanceId) => {
  const card = fieldCard(page, instanceId)
  await card.waitFor({ state: 'visible' })
  return card.locator('.card-face').first().evaluate(
    (element) => element.classList.contains('is-rested'),
  )
}

const deployMustardAndOpenFlip = async (page) => {
  const mustard = page.locator('.bottom-hand .hand-card[title="Mustard Cookie"]')
  await mustard.waitFor({ state: 'visible' })
  await mustard.click()
  const deploy = page
    .locator('.bottom-hand .hand-card-actions:visible')
    .first()
    .getByRole('button', { name: '登場', exact: true })
  await deploy.waitFor({ state: 'visible' })
  await deploy.click()

  const panel = visibleEffect(page)
  await panel.waitFor({ state: 'visible' })
  assert.match(await panel.innerText(), /Mustard Cookie/)
  const discard = panel.locator('.effect-candidates-discard-hand button').first()
  await discard.waitFor({ state: 'visible' })
  await discard.click()
  for (let step = 0; step < 3; step += 1) {
    const current = visibleEffect(page)
    if ((await current.count()) === 0) break
    const primary = current.locator('.effect-panel-primary-action')
    await primary.waitFor({ state: 'visible' })
    await primary.click()
    await page.waitForTimeout(100)
  }
  await visibleFlip(page).waitFor({ state: 'visible' })
}

const resolveFlipAndDraw = async (page, drawCount, record, imageRequested) => {
  const flip = visibleFlip(page)
  await flip.waitFor({ state: 'visible' })
  const flipText = await flip.innerText()
  assert.match(flipText, /Yoga Cookie FLIP/)
  assert.match(flipText, /Draw up to 1 card/i)
  assert.match(flipText, /set up to 1 of your Cookies as active/i)
  const visual = flip.locator('.flip-reveal-card')
  assert.equal(await visual.count(), 1, 'BS9-032 should render its official card visual')
  const imageEvidence = await assertPhysicalCardImage(visual, record, imageRequested)
  await flip.getByRole('button', { name: '發動 FLIP', exact: true }).click()

  const draw = visibleDraw(page)
  await draw.waitFor({ state: 'visible' })
  assert.match(await draw.innerText(), /Yoga Cookie/)
  assert.match(await draw.innerText(), /最多 1 張牌/)
  const options = draw.locator('.draw-up-to-option')
  assert.equal(await options.count(), 2, 'BS9-032 should offer draw 0 or 1')
  await options.nth(drawCount).click()
  await draw.getByRole('button', {
    name: drawCount === 0 ? '略過抽牌' : '抽取 1 張牌',
    exact: true,
  }).click()
  await draw.waitFor({ state: 'hidden' })
  return imageEvidence
}

const resolveYogaThen = async (page, selectTarget) => {
  const panel = visibleEffect(page)
  await panel.waitFor({ state: 'visible' })
  const text = await panel.innerText()
  assert.match(text, /Yoga Cookie/)
  assert.match(text, /設為活躍|set.*active/i)
  const targets = panel.locator('.effect-candidates-target button:not(:disabled)')
  assert.equal(await targets.count(), 1, 'BS9-032 should expose only one rested friendly Cookie')
  assert.match(await targets.first().innerText(), /Pomegranate Cookie/)
  if (selectTarget) await targets.first().click()
  const primary = panel.locator('.effect-panel-primary-action')
  assert.equal(await primary.isEnabled(), true, 'up to 1 should allow selecting zero')
  await primary.click()
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('.effect-panel[role="alertdialog"]'))
      .every((candidate) => {
        const style = window.getComputedStyle(candidate)
        const rect = candidate.getBoundingClientRect()
        const visible = style.display !== 'none' && style.visibility !== 'hidden' &&
          rect.width > 0 && rect.height > 0
        return !visible || !candidate.textContent?.includes('Yoga Cookie')
      }),
    undefined,
    { timeout: 7000 },
  )
}

const settleMustardContinuation = async (page) => {
  for (let step = 0; step < 4; step += 1) {
    const panel = visibleEffect(page)
    if ((await panel.count()) === 0) return
    const text = await panel.innerText()
    assert.doesNotMatch(text, /Yoga Cookie/, 'Yoga Cookie Then must not remain unresolved')
    const primary = panel.locator('.effect-panel-primary-action')
    await primary.waitFor({ state: 'visible' })
    await primary.click()
    await page.waitForTimeout(120)
  }
  assert.equal(await visibleEffect(page).count(), 0, 'Mustard continuation should settle')
}

const runPositive = async (browser, viewport, { drawCount, selectTarget }) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(7000)
  const requestedImages = new Set()
  page.on('request', (request) => {
    if (request.resourceType() === 'image') requestedImages.add(request.url())
  })
  const errors = recordBrowserErrors(page)
  const route = 'bs9-card:BS9-032'
  const result = { route, viewport, drawCount, selectTarget, status: 'FAIL', actions: [] }
  const targetId = 'bs9-bs9-032-effect-target'
  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=BS9-032`,
      { waitUntil: 'domcontentloaded' },
    )
    await waitForGame(page)
    assert.equal(await isRested(page, targetId), true, 'target should start rested')
    const record = recordBy('BS9-032')
    await deployMustardAndOpenFlip(page)
    result.actions.push('deploy-mustard-on-play-effect-damage')
    result.imageEvidence = await resolveFlipAndDraw(
      page,
      drawCount,
      record,
      () => requestedImages.has(record.imageUrl),
    )
    result.actions.push(`resolve-flip-draw-${drawCount}`)
    await resolveYogaThen(page, selectTarget)
    result.actions.push(selectTarget ? 'select-rested-cookie' : 'select-zero-cookie')
    await settleMustardContinuation(page)
    await page.waitForTimeout(250)

    const restedAfter = await isRested(page, targetId)
    assert.equal(
      restedAfter,
      !selectTarget,
      selectTarget ? 'selected Cookie should become active' : 'choose-zero should keep Cookie rested',
    )
    const trace = await readTrace(page)
    assert.ok(trace.some((entry) => entry.commandKind === 'resolve-flip'))
    assert.ok(trace.some((entry) => entry.commandKind === 'resolve-draw-up-to'))
    assert.ok(
      trace.some((entry) =>
        String(entry.summary ?? '').includes('Yoga Cookie') ||
        (entry.steps ?? []).some((step) => String(step).includes('Yoga Cookie')),
      ),
      'public trace should identify Yoga Cookie',
    )
    await captureFinalState(page, result)
    assert.equal(result.finalPendingSurfaces, 0, 'Browser route must settle without a pending dialog')
    result.expectedImageUrl = record.imageUrl
    result.exactImageRequested = result.imageEvidence.exactImageRequested
    result.exactImageRendered = result.imageEvidence.exactImageRendered
    result.exactImageLoaded = result.imageEvidence.exactImageLoaded
    assert.deepEqual(errors, [], `BS9-032 positive browser errors: ${errors.join('; ')}`)
    result.status = 'PASS'
    result.restedAfter = restedAfter
    result.screenshot = resolve(
      outputDirectory,
      `bs9-032-positive-${viewport.width}x${viewport.height}-${selectTarget ? 'select-1' : 'select-0'}.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true })
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 7000)
    await captureFinalState(page, result)
    result.screenshot = resolve(
      outputDirectory,
      `bs9-032-positive-${viewport.width}x${viewport.height}-failed.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true }).catch(() => {})
  } finally {
    await page.close()
  }
  return result
}

const runNegative = async (browser, viewport, drawCount) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(7000)
  const requestedImages = new Set()
  page.on('request', (request) => {
    if (request.resourceType() === 'image') requestedImages.add(request.url())
  })
  const errors = recordBrowserErrors(page)
  const route = 'bs9-card-negative:BS9-032'
  const result = { route, viewport, drawCount, status: 'FAIL', actions: [] }
  const targetId = 'bs9-bs9-032-effect-target'
  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=BS9-032`,
      { waitUntil: 'domcontentloaded' },
    )
    await waitForGame(page)
    assert.equal(await isRested(page, targetId), true, 'negative target should start rested')
    const record = recordBy('BS9-032')
    result.imageEvidence = await resolveFlipAndDraw(
      page,
      drawCount,
      record,
      () => requestedImages.has(record.imageUrl),
    )
    result.actions.push(`resolve-flip-draw-${drawCount}`)
    await page.waitForTimeout(200)
    if ((await visibleEffect(page).count()) > 0) {
      assert.doesNotMatch(
        await visibleEffect(page).innerText(),
        /Yoga Cookie/,
        'opponent-turn route must not expose Yoga Cookie Then targets',
      )
    }
    await settleMustardContinuation(page)
    await page.waitForTimeout(250)
    assert.equal(await isRested(page, targetId), true, 'opponent-turn route must keep target rested')
    const trace = await readTrace(page)
    assert.ok(trace.some((entry) => entry.commandKind === 'resolve-flip'))
    assert.ok(trace.some((entry) => entry.commandKind === 'resolve-draw-up-to'))
    assert.equal(
      trace.some((entry) =>
        String(entry.summary ?? '').includes('已設為活躍') ||
        (entry.steps ?? []).some((step) => String(step).includes('已設為活躍')),
      ),
      false,
      'opponent-turn route must not resolve Yoga Cookie Then',
    )
    await captureFinalState(page, result)
    assert.equal(result.finalPendingSurfaces, 0, 'Browser route must settle without a pending dialog')
    result.expectedImageUrl = record.imageUrl
    result.exactImageRequested = result.imageEvidence.exactImageRequested
    result.exactImageRendered = result.imageEvidence.exactImageRendered
    result.exactImageLoaded = result.imageEvidence.exactImageLoaded
    assert.deepEqual(errors, [], `BS9-032 negative browser errors: ${errors.join('; ')}`)
    result.status = 'PASS'
    result.screenshot = resolve(
      outputDirectory,
      `bs9-032-negative-${viewport.width}x${viewport.height}.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true })
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 7000)
    await captureFinalState(page, result)
    result.screenshot = resolve(
      outputDirectory,
      `bs9-032-negative-${viewport.width}x${viewport.height}-failed.png`,
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
let browser
try {
  await waitForPreview()
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })
  const cases = [
    { viewport: { width: 1907, height: 863 }, drawCount: 1, selectTarget: true },
    { viewport: { width: 1164, height: 777 }, drawCount: 0, selectTarget: false },
  ]
  for (const testCase of cases) {
    results.push(await runPositive(browser, testCase.viewport, testCase))
    results.push(await runNegative(browser, testCase.viewport, testCase.drawCount))
  }
} finally {
  await browser?.close()
  if (preview.exitCode === null) preview.kill()
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  scope: 'BS9-032 physical FLIP draw 0/1, own-turn rested-Cookie set active 0/1, and opponent-turn A/B.',
  total: results.length,
  passed: results.filter((result) => result.status === 'PASS').length,
  imageLoadedLanes: results.filter((result) => result.status === 'PASS' && result.exactImageLoaded).length,
  traceLanes: results.filter((result) => result.status === 'PASS' && result.traceCommandKinds?.length > 0).length,
  settledLanes: results.filter((result) => result.status === 'PASS' && result.finalPendingSurfaces === 0).length,
  failed: results.filter((result) => result.status !== 'PASS'),
  results,
}
writeFileSync(
  resolve(outputDirectory, 'bs9-032-browser.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
process.exitCode = report.failed.length > 0 ? 1 : 0
