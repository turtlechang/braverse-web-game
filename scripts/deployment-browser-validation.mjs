import { strict as assert } from 'node:assert'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightRoot = process.env.PLAYWRIGHT_NODE_MODULES
const playwrightEntry = require.resolve('playwright', {
  paths: playwrightRoot ? [playwrightRoot] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium
if (!chromium) throw new Error('Playwright Chromium unavailable')

const deploymentInput = process.env.BRAVERSE_DEPLOYMENT_URL ?? process.argv[2]
if (!deploymentInput) {
  throw new Error('BRAVERSE_DEPLOYMENT_URL or a URL argument is required')
}

const deploymentUrl = new URL(deploymentInput)
const allowAnyHost = process.env.BRAVERSE_ALLOW_ANY_DEPLOYMENT_URL === 'true'
const isAllowedHost =
  (deploymentUrl.hostname.startsWith('braverse-web-game') &&
    deploymentUrl.hostname.endsWith('.vercel.app')) ||
  deploymentUrl.hostname === 'localhost' ||
  deploymentUrl.hostname === '127.0.0.1'
if (!allowAnyHost && !isAllowedHost) {
  throw new Error(
    `Refusing deployment host ${deploymentUrl.hostname}; set BRAVERSE_ALLOW_ANY_DEPLOYMENT_URL=true to override`,
  )
}
if (!['http:', 'https:'].includes(deploymentUrl.protocol)) {
  throw new Error('Deployment URL must use http or https')
}

const label = process.env.BRAVERSE_DEPLOYMENT_LABEL ?? 'Deployment'
const wsUrl = process.env.BRAVERSE_WS_URL ?? 'wss://braverse-web-game.onrender.com'
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const browserExecutable =
  process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ].find((candidate) => existsSync(candidate))

const artifactSlug = `${label}-${deploymentUrl.hostname}`
  .toLowerCase()
  .replace(/[^a-z0-9.-]+/g, '-')
const outputDirectory = resolve(root, 'test-results', 'deployment-browser', artifactSlug)
mkdirSync(outputDirectory, { recursive: true })

const deckEntries = [
  ['ST1-002', 4], ['ST1-003', 4], ['ST1-005', 4], ['ST1-006', 4],
  ['ST1-007', 4], ['ST1-008', 4], ['ST1-009', 4], ['ST1-010', 4],
  ['ST1-011', 4], ['ST1-012', 4], ['ST1-001', 4], ['ST1-004', 4],
  ['ST1-013', 4], ['ST1-015', 4], ['ST1-016', 2], ['ST1-020', 2],
].map(([cardNumber, count]) => ({ cardNumber, count }))
const deckName = `Deployment Smoke ${label}`
const importPayload = JSON.stringify({ name: deckName, entries: deckEntries })

const rootUrl = deploymentUrl.toString()
const rewriteProbe = new URL('/deployment-smoke', deploymentUrl)
const rewriteUrl = rewriteProbe.toString()
const startedAt = Date.now()
const report = {
  generatedAt: new Date().toISOString(),
  label,
  deploymentUrl: deploymentUrl.toString(),
  wsUrl,
  status: 'FAIL',
  checks: {},
  diagnostics: {},
}

let browser
let page
try {
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
  })
  page = await context.newPage()
  if (bypassSecret) {
    // Scope the protection token to this deployment origin. A context-wide
    // header would also be sent to the official card-image CDN.
    await page.route(`${deploymentUrl.origin}/**`, async (route) => {
      await route.continue({
        headers: {
          ...route.request().headers(),
          'x-vercel-protection-bypass': bypassSecret,
        },
      })
    })
  }
  page.setDefaultTimeout(20_000)
  page.setDefaultNavigationTimeout(45_000)

  const pageErrors = []
  const consoleErrors = []
  const sameOriginRequestFailures = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    const location = message.location()
    if (location.url?.endsWith('/favicon.ico')) return
    if (text.includes('Failed to load resource')) return
    consoleErrors.push(location.url ? `${text} (${location.url})` : text)
  })
  page.on('requestfailed', (request) => {
    const requestUrl = new URL(request.url())
    if (requestUrl.origin !== deploymentUrl.origin) return
    if (!['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(request.resourceType())) {
      return
    }
    sameOriginRequestFailures.push(
      `${request.resourceType()} ${request.url()}: ${request.failure()?.errorText ?? 'unknown'}`,
    )
  })
  page.on('dialog', (dialog) => dialog.accept())

  const rootResponse = await page.goto(rootUrl, { waitUntil: 'domcontentloaded' })
  assert.ok(rootResponse, 'Deployment root did not return a response')
  assert.ok(rootResponse.status() < 400, `Deployment root returned ${rootResponse.status()}`)
  if (new URL(page.url()).hostname === 'vercel.com') {
    throw new Error(
      'Deployment is protected by Vercel Authentication; configure VERCEL_AUTOMATION_BYPASS_SECRET for automated Preview acceptance',
    )
  }
  await page.locator('.main-menu-shell').waitFor({ state: 'visible' })
  report.checks.root = { status: rootResponse.status(), mainMenu: true }

  const rewriteResponse = await page.goto(rewriteUrl, { waitUntil: 'domcontentloaded' })
  assert.ok(rewriteResponse, 'SPA rewrite probe did not return a response')
  assert.ok(rewriteResponse.status() < 400, `SPA rewrite returned ${rewriteResponse.status()}`)
  await page.locator('.main-menu-shell').waitFor({ state: 'visible' })
  report.checks.spaRewrite = { status: rewriteResponse.status(), mainMenu: true }

  await page.evaluate(() => localStorage.removeItem('braverse-custom-decks'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="open-deck-editor"]').click()
  const editor = page.locator('[data-testid="deck-editor-page"]')
  await editor.waitFor({ state: 'visible' })
  const poolCount = await editor.locator('.deck-editor-page-pool-card-button').count()
  assert.ok(poolCount > 0, 'Deck editor card pool is empty')

  const firstCardImage = editor.locator('.deck-page-card-image').first()
  await firstCardImage.scrollIntoViewIfNeeded()
  await page.waitForFunction(
    () => {
      const image = document.querySelector('[data-testid="deck-editor-page"] .deck-page-card-image')
      return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
    },
    undefined,
    { timeout: 30_000 },
  )
  report.checks.cardPool = {
    cards: poolCount,
    firstImageLoaded: true,
    firstImageUrl: await firstCardImage.getAttribute('src'),
  }

  await editor.locator('.deck-editor-page-io button').nth(1).click()
  const importDialog = editor.locator('.deck-editor-page-import')
  await importDialog.waitFor({ state: 'visible' })
  await importDialog.locator('textarea').fill(importPayload)
  await importDialog.locator('button').last().click()
  await importDialog.waitFor({ state: 'hidden' })
  assert.match(
    (await editor.locator('.deck-editor-page-counter').textContent()) ?? '',
    /60\s*\/\s*60/,
    'Imported deck is not 60 cards',
  )
  const saveButton = editor.locator('[data-testid="deck-editor-page-save"]')
  assert.equal(await saveButton.isEnabled(), true, 'Imported deck cannot be saved')
  assert.equal(
    await saveButton.evaluate((element) => element.classList.contains('is-draft')),
    false,
    'Imported deck is still marked as a draft',
  )
  await saveButton.click()
  await editor.waitFor({ state: 'hidden' })
  await page.locator('.main-menu-deck-card', { hasText: deckName }).waitFor({ state: 'visible' })
  report.checks.deckImport = { name: deckName, cards: 60, legal: true }

  const websocketMs = await page.evaluate(
    ({ url, timeoutMs }) =>
      new Promise((resolvePromise, reject) => {
        const started = performance.now()
        const socket = new WebSocket(url)
        const timer = window.setTimeout(() => {
          socket.close()
          reject(new Error(`WebSocket open timed out after ${timeoutMs}ms`))
        }, timeoutMs)
        socket.addEventListener('open', () => {
          window.clearTimeout(timer)
          const elapsed = Math.round(performance.now() - started)
          socket.close()
          resolvePromise(elapsed)
        })
        socket.addEventListener('error', () => {
          window.clearTimeout(timer)
          reject(new Error('WebSocket connection failed'))
        })
      }),
    { url: wsUrl, timeoutMs: 90_000 },
  )
  report.checks.websocket = { opened: true, milliseconds: websocketMs }

  await page.locator('.main-menu-primary').click()
  await page.locator('.game-shell').waitFor({ state: 'visible', timeout: 30_000 })
  report.checks.battleEntry = { entered: true }

  assert.deepEqual(pageErrors, [], `Page errors: ${pageErrors.join('; ')}`)
  assert.deepEqual(consoleErrors, [], `Console errors: ${consoleErrors.join('; ')}`)
  assert.deepEqual(
    sameOriginRequestFailures,
    [],
    `Same-origin request failures: ${sameOriginRequestFailures.join('; ')}`,
  )
  report.diagnostics = { pageErrors, consoleErrors, sameOriginRequestFailures }
  report.status = 'PASS'
} catch (error) {
  report.error = error instanceof Error ? error.stack ?? error.message : String(error)
  if (page) {
    report.diagnostics.pageUrl = page.url()
    report.diagnostics.visibleText = (await page.locator('body').innerText().catch(() => ''))
      .replace(/\s+/g, ' ')
      .slice(0, 1_500)
  }
  process.exitCode = 1
} finally {
  report.durationMs = Date.now() - startedAt
  if (page) {
    await page.screenshot({
      path: resolve(outputDirectory, 'final.png'),
      fullPage: true,
    }).catch(() => {})
  }
  writeFileSync(
    resolve(outputDirectory, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  )
  await browser?.close().catch(() => {})
  console.log(JSON.stringify(report, null, 2))
}
