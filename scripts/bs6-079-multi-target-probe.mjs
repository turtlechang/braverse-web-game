import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
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
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')
const browserExecutable =
  process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find((candidate) => existsSync(candidate))
const outputPath = resolve(
  root,
  process.env.BS6_079_PROBE_OUTPUT ?? 'docs/bs6-079-multi-target-probe-2026-08-15.json',
)

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const server = spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)

const operations = []
const consoleErrors = []
const pageErrors = []

try {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(baseUrl)).ok) break
    } catch {
      // Preview server is still starting.
    }
    await wait(100)
  }

  const browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  page.setDefaultTimeout(10000)
  page.setDefaultNavigationTimeout(20000)
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (text.startsWith('Failed to load resource:')) return
    if (text.includes('net::ERR_NETWORK_ACCESS_DENIED')) return
    if (message.location().url?.includes('cookierunbraverse.com/data/en_storage/')) return
    consoleErrors.push(text)
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto(`${baseUrl}?test-state=${encodeURIComponent('card:BS6-079')}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await wait(500)

  const inline = page.locator('.optional-cost-attack-inline').first()
  assert.ok(await inline.isVisible(), 'BS6-079 optional cost window must open')

  // 1. Pay decision: click 支付.
  const pay = inline.locator('.modal-actions-decision button').filter({ hasText: /支付|Pay/ }).first()
  assert.ok(await pay.isEnabled(), 'pay button must be enabled with a legal discard candidate')
  await pay.click()
  operations.push('pay')

  // 2. Cost phase: discard one hand card, then 下一步.
  const handCandidates = inline.locator('.modal-card-options button')
  const handCount = await handCandidates.count()
  assert.ok(handCount >= 1, 'discard candidates must include hand cards')
  await handCandidates.first().click()
  operations.push('select-discard')
  const next = inline.locator('.modal-actions-sticky button:not(:disabled)').last()
  assert.ok(await next.isEnabled(), 'next step must be enabled after discard selection')
  await next.click()
  operations.push('next')
  await wait(250)

  // 3. Target phase: must expose up-to-3 opponent support selection.
  const targetText = await inline.innerText()
  assert.match(targetText, /最多選擇 3 個對手支援區的卡作為目標/, 'target phase label must say up to 3 opponent support cards')

  const supportButtons = inline.locator(
    '.optional-cost-col .modal-card-options button:not(.is-selected)',
  )
  for (let index = 0; index < 3; index += 1) {
    const candidate = supportButtons.nth(0)
    if (!(await candidate.isEnabled().catch(() => false))) break
    await candidate.click()
    operations.push(`select-support-${index + 1}`)
    await wait(120)
  }
  const selectedCount = await inline.locator(
    '.optional-cost-col .modal-card-options button.is-selected',
  ).count()
  assert.equal(selectedCount, 3, 'player must be able to select exactly 3 opponent support cards')
  const selectedText = await inline.innerText()
  assert.match(selectedText, /已選 3/, 'target phase progress must show 3 selected')

  const confirm = inline.locator('.modal-actions-sticky button:not(:disabled)').last()
  assert.ok(await confirm.isEnabled(), 'confirm must be enabled after 3 selections')
  await confirm.click()
  operations.push('confirm')
  await wait(800)

  // 4. Assert the opponent support area now has exactly 3 rested cards.
  const restedSupports = page.locator('.top-field .support-card-wrap .card-face.is-rested')
  const restedCount = await restedSupports.count()
  assert.equal(restedCount, 3, 'exactly 3 opponent support cards must be rested after resolution')
  const totalOpponentSupports = await page.locator('.top-field .support-card-wrap').count()
  assert.equal(totalOpponentSupports, 4, 'the opponent fixture must keep 4 support cards')

  // 5. No pending modal remains and no console/page errors.
  const pendingSurface =
    (await page.locator('.effect-panel[role="alertdialog"]').count()) +
    (await page.locator('.optional-cost-attack-inline').count())
  assert.equal(pendingSurface, 0, 'no pending effect UI may remain')
  assert.deepEqual(consoleErrors, [], `console errors: ${JSON.stringify(consoleErrors)}`)
  assert.deepEqual(pageErrors, [], `page errors: ${JSON.stringify(pageErrors)}`)

  const report = {
    generatedAt: new Date().toISOString(),
    browser: browserExecutable ?? 'playwright-chromium',
    viewport: '1440x960',
    card: 'BS6-079',
    scope:
      'Browser proof that the optional attack cost can be paid and the player can then select up to 3 opponent support cards to rest.',
    status: 'PASS',
    operations,
    assertions: {
      selectedSupports: selectedCount,
      restedSupports,
      totalOpponentSupports,
      consoleErrors,
      pageErrors,
    },
  }
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log('PASS BS6-079 multi-target rest flow')
  console.log(`Evidence: ${outputPath}`)
  await browser.close()
} catch (error) {
  console.error('FAIL', error instanceof Error ? error.message : String(error))
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        card: 'BS6-079',
        status: 'FAIL',
        operations,
        error: error instanceof Error ? error.message : String(error),
        consoleErrors,
        pageErrors,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
  process.exitCode = 1
} finally {
  server.kill()
}
