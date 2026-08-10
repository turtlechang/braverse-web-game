import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightRoot = process.env.PLAYWRIGHT_NODE_MODULES
const playwrightEntry = require.resolve('playwright', {
  paths: playwrightRoot ? [playwrightRoot] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium

if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4179)
const baseUrl = `http://127.0.0.1:${port}`
const candidatePath = resolve(
  root,
  'data/candidates/official-p-0xx-remaining.en.json',
)
const reportPath = resolve(root, 'docs/p0xx-browser-audit-2026-08-10.json')
const vitePackageJson = require.resolve('vite/package.json', { paths: [root] })
const viteEntry = resolve(dirname(vitePackageJson), 'bin/vite.js')
const browserExecutable =
  process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find((candidate) => existsSync(candidate))

const source = JSON.parse(await readFile(candidatePath, 'utf8'))
const cards = [...source.cards].sort((left, right) =>
  left.cardNumber.localeCompare(right.cardNumber, undefined, { numeric: true }),
)
assert.equal(cards.length, 127, 'P-0XX candidate inventory must contain 127 records')

const hasText = (value) => typeof value === 'string' && value.trim().length > 0

const getEffectSurfaces = (card) => {
  const surfaces = []
  if (card.type === 'cookie' && hasText(card.skill?.text)) surfaces.push('skill')
  if (hasText(card.attackText) && /\bThen\b/i.test(card.attackText)) {
    surfaces.push('attack-then')
  }
  if (card.type === 'flip' && hasText(card.flipText)) surfaces.push('flip')
  if (card.type === 'item') surfaces.push('item')
  if (card.type === 'trap') surfaces.push('trap')
  if (card.type === 'stage') surfaces.push('stage')
  return surfaces.length > 0 ? surfaces : ['vanilla-attack']
}

const ignoredConsoleError = (message) => {
  if (message.type() !== 'error') return true
  const location = message.location()
  const text = message.text()
  if (location.url?.endsWith('/favicon.ico') && text.includes('404')) return true
  if (
    location.url?.includes('cookierunbraverse.com/data/en_storage/') &&
    /ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(text)
  ) {
    return true
  }
  return false
}

const waitForPreview = async () => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {
      // Preview server is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
  }
  throw new Error(`Vite preview did not start at ${baseUrl}`)
}

const firstPrompt = (bodyText) => {
  const lines = bodyText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  return (
    lines.find((line) =>
      /選擇|支付|費用|目標|效果|發動|攻擊|陷阱|FLIP|On Play|Activate/i.test(line),
    ) ?? null
  )
}

const runCardCheck = async (page, card) => {
  const consoleErrors = []
  const pageErrors = []
  const onConsole = (message) => {
    if (!ignoredConsoleError(message)) {
      const location = message.location()
      consoleErrors.push(
        location.url ? `${message.text()} (${location.url})` : message.text(),
      )
    }
  }
  const onPageError = (error) => pageErrors.push(error.message)
  page.on('console', onConsole)
  page.on('pageerror', onPageError)

  try {
    await page.goto(
      `${baseUrl}?test-state=card:${encodeURIComponent(card.cardNumber)}`,
      { waitUntil: 'domcontentloaded' },
    )
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    // Modal creation is intentionally deferred by the React controller. The
    // delay avoids treating a valid lazy modal as a failed card route.
    await page.waitForTimeout(350)

    const bodyText = await page.locator('body').innerText()
    assert.ok(
      !/Application Error|GameErrorBoundary|Unhandled Runtime Error|Something went wrong/i.test(
        bodyText,
      ),
      'error boundary or application error appeared',
    )
    const renderedCardName = await page
      .locator('img[alt], .card-fallback')
      .evaluateAll((nodes, expectedName) =>
        nodes.some((node) => {
          const value =
            node instanceof HTMLImageElement ? node.alt : node.textContent ?? ''
          return value.includes(expectedName)
        }),
      card.name,
      )
    assert.ok(
      bodyText.includes(card.name) || renderedCardName,
      `card face for ${card.cardNumber} (${card.name}) was not rendered`,
    )
    assert.equal(
      consoleErrors.length,
      0,
      `console errors: ${JSON.stringify(consoleErrors)}`,
    )
    assert.equal(pageErrors.length, 0, `page errors: ${JSON.stringify(pageErrors)}`)

    const modalCount = await page.locator('[role="dialog"]').count()
    const actionCount = await page
      .locator('button:not([disabled]), [role="button"]:not([aria-disabled="true"])')
      .count()
    const surfaces = getEffectSurfaces(card)
    return {
      cardNumber: card.cardNumber,
      baseCardNumber: card.baseCardNumber,
      variant: card.variant,
      name: card.name,
      type: card.type,
      color: card.color,
      effectSurfaces: surfaces,
      status: 'PASS',
      auditStatus: '載入通過',
      flow: 'candidate-card-check-entry',
      promptVisible: firstPrompt(bodyText),
      modalVisible: modalCount > 0,
      actionableControls: actionCount,
    }
  } finally {
    page.off('console', onConsole)
    page.off('pageerror', onPageError)
  }
}

const server = spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)
let browser
const results = []

try {
  await waitForPreview()
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  page.setDefaultTimeout(7000)

  console.log(
    `=== P-0XX Browser candidate audit (${cards.length} records, ${browserExecutable ?? 'Playwright Chromium'}) ===`,
  )
  for (const card of cards) {
    try {
      const result = await runCardCheck(page, card)
      results.push(result)
      console.log(`PASS ${card.cardNumber} ${card.name} [${result.effectSurfaces.join(',')}]`)
    } catch (error) {
      const failure = {
        cardNumber: card.cardNumber,
        baseCardNumber: card.baseCardNumber,
        variant: card.variant,
        name: card.name,
        type: card.type,
        color: card.color,
        effectSurfaces: getEffectSurfaces(card),
        status: 'FAIL',
        auditStatus: '阻塞',
        flow: 'candidate-card-check-entry',
        error: error instanceof Error ? error.message : String(error),
      }
      results.push(failure)
      console.log(`FAIL ${card.cardNumber} ${card.name}: ${failure.error}`)
    }
  }

  await page.close()
  await browser.close()
  browser = undefined
  server.kill()

  const passed = results.filter((result) => result.status === 'PASS').length
  const failed = results.filter((result) => result.status === 'FAIL').length
  const effectCards = results.filter((result) =>
    result.effectSurfaces.some((surface) => surface !== 'vanilla-attack'),
  )
  const report = {
    generatedAt: new Date().toISOString(),
    browser: browserExecutable ?? 'playwright-chromium',
    viewport: '1440x960',
    source: 'data/candidates/official-p-0xx-remaining.en.json',
    scope:
      'Candidate card-check entry audit for every P-0XX record. This report separates route/card rendering from interactive effect proof; it is not a promote approval by itself.',
    summary: {
      total: results.length,
      passed,
      failed,
      effectBearingRecords: effectCards.length,
      interactiveEffectProof: 0,
      byType: Object.fromEntries(
        [...new Set(cards.map((card) => card.type))].map((type) => [
          type,
          {
            total: results.filter((result) => result.type === type).length,
            passed: results.filter(
              (result) => result.type === type && result.status === 'PASS',
            ).length,
            failed: results.filter(
              (result) => result.type === type && result.status === 'FAIL',
            ).length,
          },
        ]),
      ),
    },
    results,
  }
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(`\nSummary: ${passed}/${results.length} loaded; ${failed} failed`)
  console.log(`Effect-bearing records needing interactive proof: ${effectCards.length}`)
  console.log(`Evidence: ${reportPath}`)
  process.exitCode = failed === 0 ? 0 : 1
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  server.kill()
}
