import { strict as assert } from 'node:assert'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightRoot = process.env.PLAYWRIGHT_NODE_MODULES
const playwrightEntry = require.resolve('playwright', {
  paths: playwrightRoot ? [playwrightRoot] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium
if (!chromium) throw new Error('Playwright Chromium unavailable')

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4174)
const baseUrl = `http://127.0.0.1:${port}`
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')
const browserExecutable =
  process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ].find((candidate) => existsSync(candidate))

const server = spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)

const deckEntries = [
  ['ST1-002', 4], ['ST1-003', 4], ['ST1-005', 4], ['ST1-006', 4],
  ['ST1-007', 4], ['ST1-008', 4], ['ST1-009', 4], ['ST1-010', 4],
  ['ST1-011', 4], ['ST1-012', 4], ['ST1-001', 4], ['ST1-004', 4],
  ['ST1-013', 4], ['ST1-015', 4], ['ST1-016', 2], ['ST1-020', 2],
].map(([cardNumber, count]) => ({ cardNumber, count }))

const waitForServer = async () => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(baseUrl)).ok) return
    } catch {
      // Preview server is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
  }
  throw new Error(`Vite preview unavailable at ${baseUrl}`)
}

const browser = await (async () => {
  await waitForServer()
  return chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })
})()

try {
  const results = []
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 280, height: 720 },
  ]) {
    const page = await browser.newPage({ viewport })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() !== 'error') return
      const location = message.location()
      if (location.url?.endsWith('/favicon.ico')) return
      errors.push(message.text())
    })
    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    await page.evaluate((entries) => {
      const now = new Date().toISOString()
      localStorage.setItem('braverse-custom-decks', JSON.stringify([{
        id: 'online-modal-validation',
        name: 'Online modal validation',
        entries,
        createdAt: now,
        updatedAt: now,
      }]))
    }, deckEntries)
    await page.reload({ waitUntil: 'networkidle' })
    const openButton = page.locator('[data-testid="open-online-match"]')
    await openButton.waitFor({ state: 'visible' })
    assert.equal(await openButton.isEnabled(), true)
    await openButton.click()

    const panel = page.locator('.online-match-panel')
    await panel.waitFor({ state: 'visible' })
    const metrics = await page.evaluate(() => {
      const panel = document.querySelector('.online-match-panel')
      if (!(panel instanceof HTMLElement)) throw new Error('online panel missing')
      const panelRect = panel.getBoundingClientRect()
      const controls = [...panel.querySelectorAll('select, input, button')]
        .map((element) => element.getBoundingClientRect())
      const outOfBounds = controls.filter(
        (rect) => rect.left < panelRect.left - 1 || rect.right > panelRect.right + 1,
      )
      return {
        panel: { left: panelRect.left, right: panelRect.right, top: panelRect.top, bottom: panelRect.bottom, width: panelRect.width },
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        outOfBounds: outOfBounds.length,
        bodyScrollable: panel.querySelector('.online-match-body')?.scrollHeight > panel.querySelector('.online-match-body')?.clientHeight,
      }
    })
    assert.ok(metrics.panel.left >= -1)
    assert.ok(metrics.panel.right <= viewport.width + 1)
    assert.ok(
      metrics.documentWidth <= viewport.width + 1,
      `${viewport.width}x${viewport.height} document width ${metrics.documentWidth} exceeds viewport`,
    )
    assert.equal(metrics.outOfBounds, 0)
    const closeButton = panel.locator('.online-match-close')
    assert.equal(await closeButton.isVisible(), true)
    await closeButton.click()
    await panel.waitFor({ state: 'hidden' })
    assert.equal(errors.length, 0, `${viewport.width}x${viewport.height}: ${errors.join('; ')}`)
    results.push({ viewport: `${viewport.width}x${viewport.height}`, ...metrics })
    await page.close()
  }
  console.log(JSON.stringify({ completed: results.length, results }, null, 2))
} finally {
  await browser.close()
  server.kill()
}
