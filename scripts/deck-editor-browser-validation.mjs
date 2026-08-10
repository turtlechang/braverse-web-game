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

const openImportPayload = JSON.stringify({
  name: 'Open Format Browser Validation',
  format: 'standard',
  entries: deckEntries.map((entry, index) =>
    index === 0 ? { cardNumber: 'BS3-013', count: 4 } : entry,
  ),
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
    // Close/clear/import-overwrite confirm via window.confirm() when there are
    // unsaved changes (see DeckEditorModal.tsx); this flow always wants to proceed.
    page.on('dialog', (dialog) => dialog.accept())

    try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    await page.evaluate(() => localStorage.setItem('braverse-custom-decks', '[]'))
    await page.reload({ waitUntil: 'networkidle' })
    await page.locator('[data-testid="open-deck-editor"]').click()

    const editor = page.locator('[data-testid="deck-editor-page"]')
    await editor.waitFor({ state: 'visible' })
    assert.equal(await editor.locator('[data-testid="deck-editor-search"]').count(), 1)
    const filterToggle = editor.locator('[data-testid="deck-editor-filter-toggle"]')
    assert.equal(await filterToggle.getAttribute('aria-expanded'), 'false')
    assert.equal(await editor.locator('.deck-editor-page-filter-row select').count(), 0)
    await filterToggle.click()
    assert.equal(await filterToggle.getAttribute('aria-expanded'), 'true')
    assert.equal(await editor.locator('.deck-editor-page-filter-row select').count(), 4)
    await filterToggle.click()
    assert.equal(await filterToggle.getAttribute('aria-expanded'), 'false')
    assert.ok(await editor.locator('.deck-editor-page-pool-card-button').count() > 0)

    await editor.locator('[data-testid="deck-editor-search"]').fill('ST1-001')
    const searchedCard = editor.locator('.deck-editor-page-pool-card-button[title^="ST1-001 "]').first()
    await searchedCard.waitFor({ state: 'visible' })
    for (let count = 1; count <= 4; count += 1) {
      await searchedCard.click()
      await page.waitForFunction(
        (expectedCount) =>
          document.querySelector('[data-testid="deck-editor-page"] .deck-editor-page-counter strong')?.textContent?.trim() ===
          String(expectedCount),
        count,
      )
      assert.equal(
        (await editor.locator('.deck-editor-page-counter strong').textContent())?.trim(),
        String(count),
      )
    }
    assert.equal(await searchedCard.isDisabled(), true)
    assert.equal(await editor.locator('.deck-editor-page-pool-count').count(), 1)
    assert.equal(await editor.locator('[data-testid^="deck-editor-deck-section-"]').count(), 5)
    assert.equal(await editor.locator('[data-testid="deck-editor-extra-deck"]').count(), 1)
    // An incomplete (4/60) deck is still saveable as a draft (P1-1): the save
    // button stays enabled and switches to the amber "儲存草稿" draft styling.
    const saveButton = editor.locator('[data-testid="deck-editor-page-save"]')
    assert.equal(await saveButton.isEnabled(), true)
    assert.equal(await saveButton.evaluate((el) => el.classList.contains('is-draft')), true)
    assert.match((await saveButton.textContent()) ?? '', /儲存草稿/)

    await editor.locator('.deck-editor-page-io button').nth(1).click()
    const importDialog = page.locator('[data-testid="deck-editor-import-modal"]')
    await importDialog.waitFor({ state: 'visible' })
    assert.equal(await importDialog.getAttribute('role'), 'dialog')
    assert.equal(await importDialog.getAttribute('aria-modal'), 'true')
    const importTextarea = importDialog.locator('textarea')
    const nameBeforeInvalidImport = await editor.locator('.deck-editor-page-name input').inputValue()
    await importTextarea.fill('{')
    await importDialog.locator('button').last().click()
    const importStatus = editor.locator('.deck-editor-page-status')
    await importStatus.waitFor({ state: 'visible' })
    assert.ok(((await importStatus.textContent()) ?? '').trim().length > 0)
    assert.equal(await importDialog.isVisible(), true)
    assert.equal(await editor.locator('.deck-editor-page-name input').inputValue(), nameBeforeInvalidImport)
    assert.equal(
      (await editor.locator('.deck-editor-page-counter strong').textContent())?.trim(),
      '4',
    )

    await editor.locator('[data-testid="deck-format-select"]').selectOption('open')
    await importTextarea.fill(openImportPayload)
    await importDialog.locator('button').last().click()
    await importDialog.waitFor({ state: 'hidden' })
    assert.equal(
      await editor.locator('.deck-editor-page-name input').inputValue(),
      'Open Format Browser Validation',
    )
    assert.equal(await editor.locator('[data-testid="deck-format-select"]').inputValue(), 'open')
    assert.match(
      (await editor.locator('.deck-editor-page-counter').textContent()) ?? '',
      /60\s*\/\s*60/,
    )
    assert.equal(await saveButton.isEnabled(), true)
    assert.equal(await saveButton.evaluate((el) => el.classList.contains('is-draft')), false)

    const metrics = await page.evaluate(() => {
      const element = document.querySelector('[data-testid="deck-editor-page"]')
      if (!(element instanceof HTMLElement)) throw new Error('deck editor page missing')
      const rect = element.getBoundingClientRect()
      return {
        page: {
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
    assert.ok(metrics.page.left >= -1)
    assert.ok(metrics.page.right <= viewport.width + 1)
    assert.ok(
      metrics.page.width <= viewport.width + 1,
      `${viewport.width}x${viewport.height} page width ${metrics.page.width} exceeds viewport`,
    )
    assert.ok(
      metrics.documentWidth <= viewport.width + 1,
      `${viewport.width}x${viewport.height} document width ${metrics.documentWidth} exceeds viewport`,
    )

    await saveButton.click()
    await editor.waitFor({ state: 'hidden' })
    const savedStorage = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('braverse-custom-decks') ?? '[]'),
    )
    assert.equal(savedStorage.version, 1)
    const savedDecks = savedStorage.decks
    assert.equal(savedDecks.length, 1)
    assert.equal(savedDecks[0].name, 'Open Format Browser Validation')
    assert.equal(savedDecks[0].format, 'open')
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
