import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
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

if (!chromium) {
  throw new Error('Playwright Chromium is unavailable')
}

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4179)
const baseUrl = `http://127.0.0.1:${port}`
const cardDataPath = resolve(
  root,
  'data/cards/official-age-of-heroes-and-kingdoms-bs4.en.json',
)
const reportPath = resolve(
  root,
  'data/decks/bs4-browser-audit-evidence-2026-08-04-final.json',
)
const vitePackageJson = require.resolve('vite/package.json', { paths: [root] })
const viteEntry = resolve(dirname(vitePackageJson), 'bin/vite.js')
const browserExecutable =
  process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ].find((candidate) => existsSync(candidate))

const source = JSON.parse(await readFile(cardDataPath, 'utf8'))
const cards = source.cards
  .filter((card) => card.cardNumber.startsWith('BS4-') && !card.variant)
  .sort((left, right) => left.cardNumber.localeCompare(right.cardNumber, undefined, { numeric: true }))

assert.equal(cards.length, 111, 'BS4 base card inventory must contain 111 cards')

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
    await page.goto(`${baseUrl}?test-state=card:${card.cardNumber}`, {
      waitUntil: 'domcontentloaded',
    })
    const shell = page.locator('.game-shell')
    await shell.waitFor({ state: 'visible' })
    await page.waitForTimeout(350)

    const bodyText = await page.locator('body').innerText()
    assert.ok(
      !/Application Error|GameErrorBoundary|Unhandled Runtime Error|Something went wrong/i.test(
        bodyText,
      ),
      'error boundary or application error appeared',
    )
    const renderedCardName = await page.locator('img[alt], .card-fallback').evaluateAll(
      (nodes, expectedName) =>
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
    assert.equal(consoleErrors.length, 0, `console errors: ${JSON.stringify(consoleErrors)}`)
    assert.equal(pageErrors.length, 0, `page errors: ${JSON.stringify(pageErrors)}`)

    return {
      cardNumber: card.cardNumber,
      name: card.name,
      type: card.type,
      color: card.color,
      status: 'PASS',
      flow: 'card-check-load',
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
    `=== BS4 Chrome card-check audit (${cards.length} cards, ${browserExecutable ?? 'Playwright Chromium'}) ===`,
  )
  for (const card of cards) {
    try {
      const result = await runCardCheck(page, card)
      results.push(result)
      console.log(`PASS ${card.cardNumber} ${card.name}`)
    } catch (error) {
      const failure = {
        cardNumber: card.cardNumber,
        name: card.name,
        type: card.type,
        color: card.color,
        status: 'FAIL',
        flow: 'card-check-load',
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
  const report = {
    generatedAt: new Date().toISOString(),
    browser: browserExecutable ?? 'playwright-chromium',
    viewport: '1440x960',
    source: 'data/cards/official-age-of-heroes-and-kingdoms-bs4.en.json',
    coverage:
      'Formal card-check load/flow-entry smoke for every BS4 base card. Interactive branches are covered separately by the condition and generic fixture audit.',
    summary: {
      total: results.length,
      passed,
      failed,
      byColor: Object.fromEntries(
        [...new Set(cards.map((card) => card.color))].map((color) => [
          color,
          {
            total: results.filter((result) => result.color === color).length,
            passed: results.filter(
              (result) => result.color === color && result.status === 'PASS',
            ).length,
            failed: results.filter(
              (result) => result.color === color && result.status === 'FAIL',
            ).length,
          },
        ]),
      ),
    },
    results,
  }
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(`\nSummary: ${passed}/${results.length} passed; ${failed} failed`)
  console.log(`Evidence: ${reportPath}`)
  process.exitCode = failed === 0 ? 0 : 1
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  server.kill()
}
