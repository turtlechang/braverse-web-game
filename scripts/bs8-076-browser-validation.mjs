import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
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
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4180)
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

const server = spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)

const waitForPreview = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
  }
  throw new Error(`Vite preview did not start at ${baseUrl}`)
}

const runChoice = async (browser, discardCount) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const url = message.location().url ?? ''
    if (url.endsWith('/favicon.ico') && message.text().includes('404')) return
    if (/Failed to load resource: net::ERR_NETWORK_ACCESS_DENIED/.test(message.text())) return
    errors.push(`console: ${message.text()} (${message.location().url || 'unknown URL'})`)
  })
  page.setDefaultTimeout(7000)

  try {
    await page.goto(
      `${baseUrl}?test-state=bs8-076-active-prevention&contract-card=BS8-076`,
      { waitUntil: 'networkidle' },
    )
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    const modal = page.locator('.hand-discard-modal')
    await modal.waitFor({ state: 'visible' })
    await assert.doesNotReject(async () => {
      await modal.getByText('可以選擇不棄置；若要讓目標餅乾成為活躍，必須恰好棄置 2 張手牌。').waitFor()
    })

    const confirm = modal.getByRole('button', { name: '確認棄置 (0)' })
    assert.equal(await confirm.isDisabled(), false, 'BS8-076 必須允許選擇 0 張手牌')
    if (discardCount === 2) {
      const choices = modal.locator('.hand-discard-options button')
      assert.equal(await choices.count(), 2, 'BS8-076 fixture 必須提供恰好 2 張手牌')
      await choices.nth(0).click({ force: true })
      await choices.nth(1).click({ force: true })
      await modal.getByRole('button', { name: '確認棄置 (2)' }).click({ force: true })
    } else {
      await confirm.click({ force: true })
    }
    await modal.waitFor({ state: 'hidden' })

    const target = page.locator(
      '.bottom-field .combat-card-wrap .card-face[title="BS8-076 Active Phase Target"]',
    )
    await target.waitFor({ state: 'visible' })
    const remainedRested = (await target.locator('.is-rested').count()) > 0 ||
      /is-rested/.test((await target.getAttribute('class')) ?? '')
    assert.equal(
      remainedRested,
      discardCount === 0,
      discardCount === 0
        ? '選擇 0 張手牌後，BS8-076 目標必須維持 rested'
        : '恰好棄置 2 張手牌後，BS8-076 目標必須成為 active',
    )
    assert.deepEqual(errors, [], `browser errors: ${errors.join('; ')}`)
    return {
      discardCount,
      targetRemainedRested: remainedRested,
      targetBecameActive: !remainedRested,
    }
  } finally {
    await page.close()
  }
}

let browser
try {
  await waitForPreview()
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })
  const zeroDiscard = await runChoice(browser, 0)
  const twoDiscard = await runChoice(browser, 2)
  console.log(JSON.stringify({
    card: 'BS8-076',
    browser: 'playwright',
    zeroDiscard,
    twoDiscard,
  }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  server.kill()
}
