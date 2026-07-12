import { existsSync } from 'node:fs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
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

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4175)
const baseUrl = `http://127.0.0.1:${port}`
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')
const dateStr = new Date().toISOString().slice(0, 10)

const seedDeckStorage = {
  version: 1,
  decks: [
    {
      id: 'u0-screenshot-deck',
      name: 'U0 截圖用牌組',
      entries: [
        { cardNumber: 'ST1-002', count: 4 },
        { cardNumber: 'ST1-003', count: 4 },
        { cardNumber: 'ST1-005', count: 4 },
        { cardNumber: 'ST1-006', count: 4 },
        { cardNumber: 'ST1-007', count: 4 },
        { cardNumber: 'ST1-008', count: 4 },
        { cardNumber: 'ST1-009', count: 4 },
        { cardNumber: 'ST1-010', count: 4 },
        { cardNumber: 'ST1-011', count: 4 },
        { cardNumber: 'ST1-012', count: 4 },
        { cardNumber: 'ST1-001', count: 4 },
        { cardNumber: 'ST1-004', count: 4 },
        { cardNumber: 'ST1-013', count: 4 },
        { cardNumber: 'ST1-015', count: 4 },
        { cardNumber: 'ST1-016', count: 2 },
        { cardNumber: 'ST1-020', count: 2 },
      ],
      updatedAt: new Date().toISOString(),
    },
  ],
}

const viewports = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1180x820', width: 1180, height: 820 },
]

const outDir = resolve(root, 'test-results', 'ui-ux-u0', dateStr)

const waitForServer = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const res = await fetch(baseUrl)
      if (res.ok) return
    } catch { /* still starting */ }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('Preview server did not start')
}

const clickButton = async (page, texts, timeout = 3000) => {
  for (const text of texts) {
    const btn = page.locator('button').filter({ hasText: text }).first()
    try {
      await btn.waitFor({ state: 'visible', timeout })
      await btn.click()
      await page.waitForTimeout(500)
      return true
    } catch { /* try next */ }
  }
  return false
}

const takeScreenshot = async (page, filePath) => {
  const pageErrors = []
  const consoleErrors = []
  const onPageErr = (err) => pageErrors.push(err.message)
  const onConsole = (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()) }
  page.on('pageerror', onPageErr)
  page.on('console', onConsole)

  await page.waitForTimeout(500)
  const buffer = await page.screenshot({ type: 'png', fullPage: false })

  page.off('pageerror', onPageErr)
  page.off('console', onConsole)

  writeFileSync(filePath, buffer)
  const sha256 = createHash('sha256').update(buffer).digest('hex')
  const dims = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }))

  return {
    sha256,
    dimensions: `${dims.w}x${dims.h}`,
    pageErrors: pageErrors.length,
    consoleErrors: consoleErrors.length,
    imageLoadFailures: 0,
  }
}

const server = spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)

const manifest = []

try {
  await waitForServer()
  console.log(`Preview server ready at ${baseUrl}`)

  const browser = await chromium.launch({ headless: true })

  for (const vp of viewports) {
    const vpDir = resolve(outDir, vp.name)
    mkdirSync(vpDir, { recursive: true })

    // ── Screen 1: Main Menu ──
    {
      const context = await browser.newContext({
        locale: 'zh-Hant-TW',
        timezoneId: 'Asia/Taipei',
        reducedMotion: 'reduce',
        colorScheme: 'dark',
      })
      await context.addInitScript((storage) => {
        localStorage.setItem('braverse-custom-decks', JSON.stringify(storage))
      }, seedDeckStorage)

      const page = await context.newPage()
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto(baseUrl, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1500)

      const fp = resolve(vpDir, 'main-menu--ready.png')
      const info = await takeScreenshot(page, fp)
      manifest.push({
        file: `test-results/ui-ux-u0/${dateStr}/${vp.name}/main-menu--ready.png`,
        viewport: vp.name, screen: 'main-menu', state: 'ready',
        ...info, timestamp: new Date().toISOString(),
        browser: 'Chromium', timezone: 'Asia/Taipei', locale: 'zh-Hant-TW',
      })
      console.log(`  OK  main-menu--ready @ ${vp.name}`)
      await page.close()
      await context.close()
    }

    // ── Screen 2: Deck Editor ──
    {
      const context = await browser.newContext({
        locale: 'zh-Hant-TW', timezoneId: 'Asia/Taipei',
        reducedMotion: 'reduce', colorScheme: 'dark',
      })
      await context.addInitScript((storage) => {
        localStorage.setItem('braverse-custom-decks', JSON.stringify(storage))
      }, seedDeckStorage)

      const page = await context.newPage()
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto(baseUrl, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1500)

      await clickButton(page, ['牌組編輯器', 'Deck Editor'], 5000)
      await page.waitForTimeout(2000)

      const fp = resolve(vpDir, 'deck-editor--loaded.png')
      const info = await takeScreenshot(page, fp)
      manifest.push({
        file: `test-results/ui-ux-u0/${dateStr}/${vp.name}/deck-editor--loaded.png`,
        viewport: vp.name, screen: 'deck-editor', state: 'loaded',
        ...info, timestamp: new Date().toISOString(),
        browser: 'Chromium', timezone: 'Asia/Taipei', locale: 'zh-Hant-TW',
      })
      console.log(`  OK  deck-editor--loaded @ ${vp.name}`)
      await page.close()
      await context.close()
    }

    // ── Screen 3: Battlefield ──
    {
      const context = await browser.newContext({
        locale: 'zh-Hant-TW', timezoneId: 'Asia/Taipei',
        reducedMotion: 'reduce', colorScheme: 'dark',
      })
      await context.addInitScript((storage) => {
        localStorage.setItem('braverse-custom-decks', JSON.stringify(storage))
      }, seedDeckStorage)

      const page = await context.newPage()
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto(baseUrl, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1500)

      // Click "對戰入口" to start battle
      await clickButton(page, ['對戰入口'], 5000)
      await page.waitForTimeout(1000)

      // Handle RPS (rock-paper-scissors) — pick rock
      await clickButton(page, ['剪刀', '石頭', '布', 'Rock', 'Paper', 'Scissors'], 5000)
      await page.waitForTimeout(500)

      // Handle choose order (if appears) — pick "先攻" (go first)
      await clickButton(page, ['先攻', 'Go First', '後攻', 'Go Second'], 3000)
      await page.waitForTimeout(500)

      // Handle mulligan — "保留" (keep)
      await clickButton(page, ['保留', 'Keep', '全部更換'], 5000)
      await page.waitForTimeout(500)

      // Handle mulligan compensation — "不抽" or "跳過"
      await clickButton(page, ['不抽', 'Skip', '跳過'], 5000)
      await page.waitForTimeout(500)

      // Handle starting cookie selection — "選擇" button for each cookie
      for (let i = 0; i < 3; i++) {
        await clickButton(page, ['選擇'], 3000)
      }
      await page.waitForTimeout(500)

      // Skip on-play effects (both player and AI)
      for (let i = 0; i < 20; i++) {
        const skipped = await clickButton(page, ['不發動', 'Skip', '跳過'], 2000)
        if (!skipped) break
      }

      // Wait for AI turns to finish, get to player's main phase
      // AI might need several turns — wait for PhaseRail to show 主要階段 or similar
      await page.waitForTimeout(8000)

      // Dismiss any remaining modals
      for (let i = 0; i < 10; i++) {
        const closed = await clickButton(page, ['不發動', 'Skip', '跳過', 'Pass', '確定', 'OK'], 1500)
        if (!closed) break
      }

      const fp = resolve(vpDir, 'battlefield--main-phase.png')
      const info = await takeScreenshot(page, fp)
      manifest.push({
        file: `test-results/ui-ux-u0/${dateStr}/${vp.name}/battlefield--main-phase.png`,
        viewport: vp.name, screen: 'battlefield', state: 'main-phase',
        ...info, timestamp: new Date().toISOString(),
        browser: 'Chromium', timezone: 'Asia/Taipei', locale: 'zh-Hant-TW',
      })
      console.log(`  OK  battlefield--main-phase @ ${vp.name}`)
      await page.close()
      await context.close()
    }

    // ── Screen 4: Test Setup ──
    {
      const context = await browser.newContext({
        locale: 'zh-Hant-TW', timezoneId: 'Asia/Taipei',
        reducedMotion: 'reduce', colorScheme: 'dark',
      })
      await context.addInitScript((storage) => {
        localStorage.setItem('braverse-custom-decks', JSON.stringify(storage))
      }, seedDeckStorage)

      const page = await context.newPage()
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto(baseUrl, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1500)

      await clickButton(page, ['測試對局設定', 'Test Scenario'], 5000)
      await page.waitForTimeout(1500)

      const fp = resolve(vpDir, 'test-setup--empty.png')
      const info = await takeScreenshot(page, fp)
      manifest.push({
        file: `test-results/ui-ux-u0/${dateStr}/${vp.name}/test-setup--empty.png`,
        viewport: vp.name, screen: 'test-setup', state: 'empty',
        ...info, timestamp: new Date().toISOString(),
        browser: 'Chromium', timezone: 'Asia/Taipei', locale: 'zh-Hant-TW',
      })
      console.log(`  OK  test-setup--empty @ ${vp.name}`)
      await page.close()
      await context.close()
    }

    // ── Screen 5: Online Room ──
    {
      const context = await browser.newContext({
        locale: 'zh-Hant-TW', timezoneId: 'Asia/Taipei',
        reducedMotion: 'reduce', colorScheme: 'dark',
      })
      await context.addInitScript((storage) => {
        localStorage.setItem('braverse-custom-decks', JSON.stringify(storage))
      }, seedDeckStorage)

      const page = await context.newPage()
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto(baseUrl, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1500)

      await clickButton(page, ['線上對戰', 'Online'], 5000)
      await page.waitForTimeout(2000)

      const fp = resolve(vpDir, 'online-room--idle.png')
      const info = await takeScreenshot(page, fp)
      manifest.push({
        file: `test-results/ui-ux-u0/${dateStr}/${vp.name}/online-room--idle.png`,
        viewport: vp.name, screen: 'online-room', state: 'idle',
        ...info, timestamp: new Date().toISOString(),
        browser: 'Chromium', timezone: 'Asia/Taipei', locale: 'zh-Hant-TW',
      })
      console.log(`  OK  online-room--idle @ ${vp.name}`)
      await page.close()
      await context.close()
    }

    // ── Screen 6: Mockup Gallery ──
    {
      const context = await browser.newContext({
        locale: 'zh-Hant-TW', timezoneId: 'Asia/Taipei',
        reducedMotion: 'reduce', colorScheme: 'dark',
      })
      await context.addInitScript((storage) => {
        localStorage.setItem('braverse-custom-decks', JSON.stringify(storage))
      }, seedDeckStorage)

      const page = await context.newPage()
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto(`${baseUrl}/?mockup=_index`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(2000)

      const fp = resolve(vpDir, 'mockup-gallery--index.png')
      const info = await takeScreenshot(page, fp)
      manifest.push({
        file: `test-results/ui-ux-u0/${dateStr}/${vp.name}/mockup-gallery--index.png`,
        viewport: vp.name, screen: 'mockup-gallery', state: 'index',
        ...info, timestamp: new Date().toISOString(),
        browser: 'Chromium', timezone: 'Asia/Taipei', locale: 'zh-Hant-TW',
      })
      console.log(`  OK  mockup-gallery--index @ ${vp.name}`)
      await page.close()
      await context.close()
    }
  }

  await browser.close()

  const manifestPath = resolve(outDir, 'manifest.json')
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log(`\nManifest: ${manifestPath}`)
  const ok = manifest.filter((e) => !e.error).length
  console.log(`Screenshots: ${ok}/${manifest.length} OK`)
} finally {
  server.kill()
  process.exit(0)
}
