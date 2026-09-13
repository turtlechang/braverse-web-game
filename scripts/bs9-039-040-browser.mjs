import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import bs9Candidates from '../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json' with { type: 'json' }

/**
 * BS9-039 / BS9-040 localhost candidate Browser A/B:
 * - 039 confirms the printed neutral-three normal attack and its no-energy block.
 * - 040 pays its printed yellow Activate cost, visibly reveals the top card,
 *   then distinguishes a Cookie with FLIP from a non-FLIP official card.
 *
 * All routes stay in the candidate-only test-state surface.
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

const port = Number(process.env.BRAVERSE_BS9_039_040_TEST_PORT ?? 4205)
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
const visiblePanel = (page) => page.locator('.effect-panel[role="alertdialog"]:visible').first()
const visibleReveal = (page) => page.locator('.card-reveal-modal:visible').first()
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

const assertTraceKind = (trace, kind, message) =>
  assert.ok(trace.some((entry) => entry.commandKind === kind), message)
const assertNoTraceKind = (trace, kind, message) =>
  assert.equal(trace.some((entry) => entry.commandKind === kind), false, message)

const finalSurfaceSelectors = [
  ['effect-panel', '.effect-panel[role="alertdialog"]'],
  ['effect-order', '.effect-order-modal'],
  ['draw-up-to', '.draw-up-to-modal'],
  ['hand-discard', '.hand-discard-modal'],
  ['inspect-deck', '.inspect-deck-modal'],
  ['stage-placement', '.stage-placement-modal'],
  ['flip-response', '.flip-response-modal'],
  ['trap-response', '.trap-response-modal'],
  ['attack-response', '.attack-response-modal'],
  ['attack-response-skill', '.attack-response-skill-modal'],
  ['blocker-response', '.blocker-response-modal'],
  ['optional-cost-attack', '.optional-cost-attack-modal'],
  ['faint-response', '.faint-response-modal'],
  ['hp-reorder', '.hp-reorder-modal'],
  ['card-reveal', '.card-reveal-modal'],
  ['discard-reveal', '.discard-reveal-modal'],
  ['extra-deck-attack', '.extra-deck-attack-modal'],
  ['attack-payment', '.attack-payment-panel'],
  ['card-detail', '.card-detail-modal'],
]

const readVisibleFinalSurfaces = async (page) => page.evaluate((selectors) =>
  selectors.filter(([, selector]) => [...document.querySelectorAll(selector)].some((node) => {
    const style = window.getComputedStyle(node)
    return style.display !== 'none' && style.visibility !== 'hidden' && node.getBoundingClientRect().width > 0
  })).map(([name]) => name), finalSurfaceSelectors)

const assertExactImageLoaded = async (page, record, requested) => {
  const imageEvidence = await page.locator('img').evaluateAll((nodes, options) => {
    const { expectedUrl, exactRequested } = options
    const matches = nodes.filter((node) => [node.getAttribute('src'), node.currentSrc, node.src].includes(expectedUrl))
    const isLoaded = (node) => node.complete && node.naturalWidth > 0
    if (matches.some(isLoaded)) return { exactImageRendered: true, exactImageLoaded: true, exactImageRequested: exactRequested }
    return new Promise((resolvePromise) => {
      let settled = false
      const timeout = window.setTimeout(() => finish(false), 10_000)
      const finish = (loaded) => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        for (const node of matches) {
          node.removeEventListener('load', onLoad)
          node.removeEventListener('error', onError)
        }
        resolvePromise({ exactImageRendered: matches.length > 0, exactImageLoaded: loaded, exactImageRequested: exactRequested })
      }
      const onLoad = () => { if (matches.some(isLoaded)) finish(true) }
      const onError = () => {
        if (matches.length > 0 && matches.every((node) => node.complete && node.naturalWidth === 0)) finish(false)
      }
      for (const node of matches) {
        node.addEventListener('load', onLoad)
        node.addEventListener('error', onError)
      }
      if (matches.length === 0) finish(false)
      else if (matches.every((node) => node.complete)) onError()
    })
  }, { expectedUrl: record.imageUrl, exactRequested: requested }).catch(() => ({
    exactImageRendered: false,
    exactImageLoaded: false,
    exactImageRequested: requested,
  }))
  assert.equal(imageEvidence.exactImageRendered, true, `${record.cardNumber} must render its exact official image URL`)
  assert.equal(imageEvidence.exactImageLoaded, true, `${record.cardNumber} must load its exact official image URL`)
  return imageEvidence
}

const waitForGame = async (page) => {
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await page.waitForTimeout(250)
}

const assertPhysicalCard = async (locator, cardName) => {
  await locator.waitFor({ state: 'visible' })
  const face = locator.locator(
    `:scope.card-face[title="${cardName}"], .card-face[title="${cardName}"]`,
  ).first()
  assert.equal(await face.count(), 1, `${cardName} must retain its card-face title`)
  assert.match(await face.getAttribute('class') ?? '', /(?:^|\s)card-face(?:\s|$)/,
    `${cardName} must use the CardFace component`)
  assert.ok(
    (await face.locator('img').count()) === 1 ||
      (await face.locator('.card-fallback').count()) === 1,
    `${cardName} must show official art or its named fallback`,
  )
}

const deployChocoBar = async (page) => {
  const inHand = page.locator('.bottom-hand .hand-card[title="Choco Bar Cookie"]')
  await assertPhysicalCard(inHand, 'Choco Bar Cookie')
  await inHand.click()
  const deploy = page
    .locator('.bottom-hand .hand-card-actions:visible')
    .getByRole('button', { name: '登場', exact: true })
  await deploy.click()
  const source = page.locator('.bottom-field [data-card-instance-id="bs9-bs9-039-source"]').first()
  await assertPhysicalCard(source, 'Choco Bar Cookie')
  return source
}

const run039 = async (browser, viewport, negative) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(7_000)
  const requestedImages = new Set()
  page.on('request', (request) => {
    if (request.resourceType() === 'image') requestedImages.add(request.url())
  })
  const errors = recordBrowserErrors(page)
  const route = `${negative ? 'bs9-card-negative' : 'bs9-card'}:BS9-039`
  const result = { cardNumber: 'BS9-039', route, viewport, status: 'FAIL', actions: [] }
  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=BS9-039`,
      { waitUntil: 'domcontentloaded' },
    )
    await waitForGame(page)
    const record = bs9Candidates.cards.find((candidate) => candidate.cardNumber === 'BS9-039')
    if (!record) throw new Error('Missing BS9-039 candidate')
    Object.assign(result, await assertExactImageLoaded(page, record, requestedImages.has(record.imageUrl)))
    const source = await deployChocoBar(page)
    result.actions.push('deploy-vanilla-cookie')
    assert.equal(await page.locator('[role="alertdialog"]:visible').count(), 0)

    if (negative) {
      assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
      const hint = source.locator('.energy-shortfall-hint')
      assert.ok(await hint.count(), 'rested supports must explain the attack block')
      assert.match(await hint.first().innerText(), /能量不足/)
      assertNoTraceKind(await readTrace(page), 'declare-attack', 'blocked route must not declare attack')
      result.actions.push('blocked-neutral-three-attack')
    } else {
      const attackable = source.locator('.card-face.is-attackable')
      await attackable.click()
      for (let count = 0; count < 3; count += 1) {
        const payment = page
          .locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)')
          .first()
        await payment.waitFor({ state: 'visible' })
        await payment.click()
      }
      const target = page.getByRole('button', {
        name: '選擇攻擊目標：Melon Bun Cookie', exact: true,
      })
      await target.click()
      await page.waitForFunction(
        () => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === 'declare-attack'),
        undefined,
        { timeout: 7_000 },
      )
      assertTraceKind(await readTrace(page), 'declare-attack', 'neutral-three attack must use the normal command path')
      result.actions.push('pay-neutral-three-and-declare-attack')
    }

    result.expectedImageUrl = record.imageUrl
    result.trace = await readTrace(page)
    result.traceCommandKinds = result.trace.map((entry) => entry.commandKind)
    result.finalPendingSurfaces = await readVisibleFinalSurfaces(page)
    assert.deepEqual(result.finalPendingSurfaces, [], `BS9-039 must settle pending UI surfaces: ${result.finalPendingSurfaces.join(', ')}`)
    result.negativeEvidence = negative ? result.actions.includes('blocked-neutral-three-attack') : false
    if (negative) assert.equal(result.negativeEvidence, true, 'BS9-039 negative route must retain blocked-attack evidence')
    result.publicState = await page.evaluate(() => ({
      body: document.body.innerText.slice(0, 7_000),
      battleCards: [...document.querySelectorAll('.bottom-field .combat-card-wrap')].map((node) => ({
        id: node.getAttribute('data-card-instance-id'),
        title: node.querySelector('.card-face')?.getAttribute('title') ?? null,
        hp: node.querySelector('.badge-hp')?.textContent?.trim() ?? null,
        atk: node.querySelector('.badge-atk')?.textContent?.trim() ?? null,
      })),
    }))
    assert.deepEqual(errors, [], `BS9-039 browser errors: ${errors.join('; ')}`)
    result.status = 'PASS'
    result.screenshot = resolve(
      outputDirectory,
      `bs9-039-${negative ? 'negative' : 'positive'}-${viewport.width}x${viewport.height}.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true })
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 7_000)
    result.trace = await readTrace(page).catch(() => [])
    result.traceCommandKinds = result.trace.map((entry) => entry.commandKind)
    result.finalPendingSurfaces = await readVisibleFinalSurfaces(page).catch(() => [])
    result.negativeEvidence = negative ? result.actions.includes('blocked-neutral-three-attack') : false
    result.screenshot = resolve(
      outputDirectory,
      `bs9-039-${negative ? 'negative' : 'positive'}-${viewport.width}x${viewport.height}-failed.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true }).catch(() => {})
  } finally {
    await page.close()
  }
  return result
}

const source040 = (page) => page.locator(
  '.bottom-field [data-card-instance-id="bs9-bs9-040-source"]',
).first()

const run040 = async (browser, viewport, negative, drawCount) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(7_000)
  const requestedImages = new Set()
  page.on('request', (request) => {
    if (request.resourceType() === 'image') requestedImages.add(request.url())
  })
  const errors = recordBrowserErrors(page)
  const route = `${negative ? 'bs9-card-negative' : 'bs9-card'}:BS9-040`
  const result = { cardNumber: 'BS9-040', route, viewport, status: 'FAIL', actions: [] }
  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=BS9-040`,
      { waitUntil: 'domcontentloaded' },
    )
    await waitForGame(page)
    const record = bs9Candidates.cards.find((candidate) => candidate.cardNumber === 'BS9-040')
    if (!record) throw new Error('Missing BS9-040 candidate')
    Object.assign(result, await assertExactImageLoaded(page, record, requestedImages.has(record.imageUrl)))
    const source = source040(page)
    await assertPhysicalCard(source, 'Cauliflower Cookie')
    const skill = source.locator('.skill-action')
    assert.equal(await skill.isEnabled(), true, 'Cauliflower Activate should have a yellow payment')
    await skill.click()
    const panel = visiblePanel(page)
    await panel.waitFor({ state: 'visible' })
    assert.match(await panel.innerText(), /Cauliflower Cookie/)
    const payment = panel.locator('.effect-candidates-payment button:not(:disabled)')
    assert.equal(await payment.count(), 1, 'fixture should expose exactly one yellow payment')
    await payment.click()
    await panel.getByRole('button', { name: '確認發動', exact: true }).click()
    result.actions.push('pay-one-yellow-energy')

    const reveal = visibleReveal(page)
    await reveal.waitFor({ state: 'visible' })
    assert.match(await reveal.innerText(), negative ? /條件未匹配/ : /條件匹配/)
    assert.match(await reveal.innerText(), negative ? /Surprise! Lassi Jar/ : /Yoga Cookie/)
    const revealCard = reveal.locator('.reveal-card')
    assert.ok(
      (await revealCard.locator('img').count()) === 1 ||
        (await revealCard.locator('.card-fallback').count()) === 1,
      'revealed official card needs a visible card face',
    )
    await reveal.getByRole('button', { name: '確認並繼續', exact: true }).click()
    result.actions.push('confirm-top-deck-reveal')

    if (negative) {
      await reveal.waitFor({ state: 'hidden' })
      await page.waitForTimeout(200)
      assert.equal(await visibleDraw(page).count(), 0, 'non-FLIP top card must not open a draw choice')
      assertNoTraceKind(await readTrace(page), 'resolve-draw-up-to', 'mismatch must not draw')
      result.actions.push('stop-after-non-flip-reveal')
    } else {
      const draw = visibleDraw(page)
      await draw.waitFor({ state: 'visible' })
      assert.match(await draw.innerText(), /最多 1 張牌/)
      const options = draw.locator('.draw-up-to-option')
      assert.equal(await options.count(), 2)
      await options.nth(drawCount).click()
      await draw.getByRole('button', {
        name: drawCount === 0 ? '略過抽牌' : '抽取 1 張牌', exact: true,
      }).click()
      await draw.waitFor({ state: 'hidden' })
      assertTraceKind(await readTrace(page), 'resolve-draw-up-to', 'matching FLIP Cookie must reach draw decision')
      result.actions.push(`draw-${drawCount}`)
    }

    assert.equal(await skill.isEnabled(), false, 'Once Per Turn must be consumed after the reveal')
    const trace = await readTrace(page)
    assertTraceKind(trace, 'begin-activate-skill', 'Activate cost must go through the command layer')
    assertTraceKind(trace, 'resolve-ability-effect', 'both routes must resolve the reveal effect')
    result.expectedImageUrl = record.imageUrl
    result.trace = trace
    result.traceCommandKinds = trace.map((entry) => entry.commandKind)
    result.finalPendingSurfaces = await readVisibleFinalSurfaces(page)
    assert.deepEqual(result.finalPendingSurfaces, [], `BS9-040 must settle pending UI surfaces: ${result.finalPendingSurfaces.join(', ')}`)
    result.negativeEvidence = negative ? !trace.some((entry) => entry.commandKind === 'resolve-draw-up-to') : false
    if (negative) assert.equal(result.negativeEvidence, true, 'BS9-040 negative route must retain non-FLIP no-draw evidence')
    result.publicState = await page.evaluate(() => ({
      body: document.body.innerText.slice(0, 7_000),
      battleCards: [...document.querySelectorAll('.bottom-field .combat-card-wrap')].map((node) => ({
        id: node.getAttribute('data-card-instance-id'),
        title: node.querySelector('.card-face')?.getAttribute('title') ?? null,
        hp: node.querySelector('.badge-hp')?.textContent?.trim() ?? null,
        atk: node.querySelector('.badge-atk')?.textContent?.trim() ?? null,
      })),
    }))
    assert.deepEqual(errors, [], `BS9-040 browser errors: ${errors.join('; ')}`)
    result.status = 'PASS'
    result.screenshot = resolve(
      outputDirectory,
      `bs9-040-${negative ? 'negative' : 'positive'}-${viewport.width}x${viewport.height}.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true })
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 7_000)
    result.trace = await readTrace(page).catch(() => [])
    result.traceCommandKinds = result.trace.map((entry) => entry.commandKind)
    result.finalPendingSurfaces = await readVisibleFinalSurfaces(page).catch(() => [])
    result.negativeEvidence = negative ? !result.trace.some((entry) => entry.commandKind === 'resolve-draw-up-to') : false
    result.screenshot = resolve(
      outputDirectory,
      `bs9-040-${negative ? 'negative' : 'positive'}-${viewport.width}x${viewport.height}-failed.png`,
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
    if (preview.exitCode !== null) throw new Error(`Vite preview exited before serving on ${baseUrl}`)
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
  for (const { viewport, drawCount } of [
    { viewport: { width: 1907, height: 863 }, drawCount: 1 },
    { viewport: { width: 1164, height: 777 }, drawCount: 0 },
  ]) {
    results.push(await run039(browser, viewport, false))
    results.push(await run039(browser, viewport, true))
    results.push(await run040(browser, viewport, false, drawCount))
    results.push(await run040(browser, viewport, true, drawCount))
  }
} finally {
  await browser?.close()
  if (preview.exitCode === null) preview.kill()
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  scope: 'BS9-039 vanilla neutral-three attack A/B; BS9-040 yellow Activate top-deck FLIP Cookie reveal and draw A/B.',
  total: results.length,
  passed: results.filter((result) => result.status === 'PASS').length,
  failed: results.filter((result) => result.status !== 'PASS'),
  results,
}
writeFileSync(
  resolve(outputDirectory, 'bs9-039-040-browser.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
process.exitCode = report.failed.length > 0 ? 1 : 0
