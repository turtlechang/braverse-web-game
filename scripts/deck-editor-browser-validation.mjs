import { strict as assert } from 'node:assert'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
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

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4175)
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

const importPayload = JSON.stringify({
  name: 'Deck Editor Browser Validation',
  entries: deckEntries,
})

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

let browser
try {
  await waitForServer()
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })

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
      if (message.text().includes('net::ERR_NETWORK_ACCESS_DENIED')) return
      errors.push(message.text())
    })

    try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    await page.evaluate(() => localStorage.setItem('braverse-custom-decks', '[]'))
    await page.reload({ waitUntil: 'networkidle' })
    await page.locator('[data-testid="open-deck-editor"]').click()

    const modal = page.locator('.deck-editor-modal')
    await modal.waitFor({ state: 'visible' })
    assert.equal(await modal.locator('.deck-editor-search').count(), 1)
    assert.equal(await modal.locator('.deck-editor-filters select').count(), 7)
    assert.ok(await modal.locator('.deck-editor-pool-card-btn').count() > 0)

    await modal.locator('.deck-editor-search').fill('ST1-001')
    const searchedCard = modal.locator('.deck-editor-pool-card-btn[title^="ST1-001 "]').first()
    await searchedCard.waitFor({ state: 'visible' })
    for (let count = 1; count <= 4; count += 1) {
      await searchedCard.click()
      await page.waitForFunction(
        (expectedCount) =>
          document.querySelector('.deck-editor-deck-entry-count')?.textContent?.trim() ===
          String(expectedCount),
        count,
      )
      assert.equal(
        (await modal.locator('.deck-editor-deck-entry-count').textContent())?.trim(),
        String(count),
      )
    }
    assert.equal(await searchedCard.isDisabled(), true)
    assert.equal(await modal.locator('.deck-editor-pool-card.at-max').count(), 1)
    assert.equal(await modal.locator('.deck-editor-save-btn').isDisabled(), true)

    await modal.locator('.deck-editor-io-btn').nth(1).click()
    const importDialog = modal.locator('.deck-editor-import-dialog')
    await importDialog.waitFor({ state: 'visible' })
    const importTextarea = importDialog.locator('.deck-editor-import-textarea')
    const nameBeforeInvalidImport = await modal.locator('.deck-editor-name-input').inputValue()
    await importTextarea.fill('{')
    await importDialog.locator('.deck-editor-import-confirm').click()
    const importStatus = modal.locator('.deck-editor-status')
    await importStatus.waitFor({ state: 'visible' })
    assert.ok(((await importStatus.textContent()) ?? '').trim().length > 0)
    assert.equal(await importDialog.isVisible(), true)
    assert.equal(await modal.locator('.deck-editor-name-input').inputValue(), nameBeforeInvalidImport)
    assert.equal(
      (await modal.locator('.deck-editor-deck-entry-count').textContent())?.trim(),
      '4',
    )

    await importTextarea.fill(importPayload)
    await importDialog.locator('.deck-editor-import-confirm').click()
    await importDialog.waitFor({ state: 'hidden' })
    assert.equal(
      await modal.locator('.deck-editor-name-input').inputValue(),
      'Deck Editor Browser Validation',
    )
    assert.match(
      (await modal.locator('.deck-editor-deck-header').textContent()) ?? '',
      /60\s*\/\s*60/,
    )
    assert.equal(await modal.locator('.deck-editor-save-btn').isEnabled(), true)

    const metrics = await page.evaluate(() => {
      const element = document.querySelector('.deck-editor-modal')
      if (!(element instanceof HTMLElement)) throw new Error('deck editor modal missing')
      const rect = element.getBoundingClientRect()
      return {
        modal: {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        },
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }
    })
    assert.ok(metrics.modal.left >= -1)
    assert.ok(metrics.modal.right <= viewport.width + 1)
    assert.ok(metrics.modal.top >= -1)
    assert.ok(metrics.modal.bottom <= viewport.height + 1)
    assert.ok(
      metrics.documentWidth <= viewport.width + 1,
      `${viewport.width}x${viewport.height} document width ${metrics.documentWidth} exceeds viewport`,
    )

    await modal.locator('.deck-editor-save-btn').click()
    await modal.waitFor({ state: 'hidden' })
    const savedStorage = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('braverse-custom-decks') ?? '[]'),
    )
    assert.equal(savedStorage.version, 1)
    const savedDecks = savedStorage.decks
    assert.equal(savedDecks.length, 1)
    assert.equal(savedDecks[0].name, 'Deck Editor Browser Validation')
    assert.equal(
      savedDecks[0].entries.reduce((total, entry) => total + entry.count, 0),
      60,
    )
    assert.equal(errors.length, 0, `${viewport.width}x${viewport.height}: ${errors.join('; ')}`)
    results.push({ viewport: `${viewport.width}x${viewport.height}`, ...metrics })
    } catch (error) {
      const outputDirectory = resolve(root, 'test-results')
      mkdirSync(outputDirectory, { recursive: true })
      await page.screenshot({
        path: resolve(outputDirectory, `deck-editor-${viewport.width}x${viewport.height}.png`),
        fullPage: true,
      })
      throw error
    } finally {
      await page.close()
    }
  }

  console.log(JSON.stringify({ completed: results.length, results }, null, 2))
} finally {
  await browser?.close()
  server.kill()
}
