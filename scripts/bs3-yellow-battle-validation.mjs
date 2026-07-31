import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { strict as assert } from 'node:assert'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const BS3_PRESETS = {
  'bs3-yellow-counter': { label: 'BS3 Yellow Counter', emoji: '\u{1F7E1}' },
  'bs3-red-pitaya': { label: 'BS3 Red Pitaya', emoji: '\u{1F534}' },
  'bs3-blue-sorbet': { label: 'BS3 Blue Sorbet', emoji: '\u{1F535}' },
  'bs3-green-lily': { label: 'BS3 Green Lily', emoji: '\u{1F7E2}' },
  'bs3-purple-dark-cacao': { label: 'BS3 Purple Dark Cacao', emoji: '\u{1F7E3}' },
}

const deckChoice = process.env.BS3_DECK ?? 'bs3-yellow-counter'
const preset = BS3_PRESETS[deckChoice]
if (!preset) {
  console.error(`未知的 BS3 牌組: ${deckChoice}`)
  console.error(`可用：${Object.keys(BS3_PRESETS).join(', ')}`)
  process.exit(1)
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightRoot = process.env.PLAYWRIGHT_NODE_MODULES
const playwrightEntry = require.resolve('playwright', {
  paths: playwrightRoot ? [playwrightRoot] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium =
  playwrightModule.chromium ?? playwrightModule.default?.chromium

if (!chromium) {
  throw new Error('載入 Playwright 後找不到 Chromium。')
}

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4173)
const baseUrl = `http://127.0.0.1:${port}`
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')
const outputDirectory = resolve(root, 'test-results')
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

const waitForServer = async () => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {
      // starting up
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`Vite preview 未在 ${baseUrl} 啟動。`)
}

const main = async () => {
  await mkdir(outputDirectory, { recursive: true })
  console.log(`${preset.emoji} 啟動 ${preset.label} 瀏覽器對戰驗證…`)
  await waitForServer()
  console.log('✅ Vite preview 就緒')

  const browser = await chromium.launch({
    headless: true,
    executablePath: browserExecutable,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  })

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  })
  const page = await context.newPage()

  const prefix = deckChoice.replace('bs3-', '').replace('-', '-')
  const takeScreenshot = async (label) => {
    const filePath = resolve(
      outputDirectory,
      `bs3-${prefix}-${label}-${Date.now()}.png`,
    )
    await page.screenshot({ path: filePath, fullPage: false })
    return filePath
  }

  try {
    // ── 主選單 ──
    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    console.log('📄 主選單載入完成')

    // ── 選擇 BS3 牌組 ──
    const aiDeckSelect = page.locator('select').nth(1)
    const selectExists = await aiDeckSelect.count()
    assert.ok(selectExists > 0, '找不到 AI 牌組下拉選單')

    const option = aiDeckSelect.locator(`option[value="${deckChoice}"]`)
    const optionExists = await option.count()
    assert.ok(optionExists > 0, `找不到 ${deckChoice} 選項`)

    await aiDeckSelect.selectOption(deckChoice)
    await page.waitForTimeout(300)
    console.log(`🎴 選擇 ${preset.label} 牌組`)

    // ── AI 等級 Lv.4 ──
    const aiLevelSelect = page.locator('select').nth(2)
    if ((await aiLevelSelect.count()) > 0) {
      await aiLevelSelect.selectOption('4')
      console.log('🧠 AI 等級設為 Lv.4')
    }

    // ── 開始對戰 ──
    const startButton = page.locator('button', { hasText: '開始對戰' })
    await startButton.waitFor({ state: 'visible', timeout: 10000 })
    await startButton.click()
    console.log('⚔️  點擊開始對戰')
    await page.waitForTimeout(2000)

    // ── AI 自動對戰 ──
    const autoBtnCount = await page.locator('button', { hasText: 'AI 自動' }).count()
    if (autoBtnCount > 0) {
      console.log('🤖 點擊 AI 自動進行對戰…')
      for (let step = 0; step < 500; step += 1) {
        await page.waitForTimeout(200)
        const btn = page.locator('button', { hasText: 'AI 自動' })
        if ((await btn.count()) === 0) break
        try {
          await btn.click({ timeout: 5000 })
        } catch {
          break
        }
      }
    } else {
      console.log('⏳ 等待對局自動進行中…')
      await page.waitForTimeout(15000)
    }

    // ── 等待結果 ──
    try {
      await page.locator('.result-modal, [data-testid="result"]').waitFor({
        state: 'visible',
        timeout: 60000,
      })
      console.log('🏁 對局結束，結果 modal 已顯示')
    } catch {
      const hasVictory = (await page.locator('text=勝利').count()) > 0
      const hasDefeat = (await page.locator('text=敗北').count()) > 0
      assert.ok(hasVictory || hasDefeat, '對局未正常結束')
      console.log('⚠️  結果 modal 未出現，但對局已結束')
    }

    // ── 截圖 ──
    const screenshotPath = await takeScreenshot('result')
    console.log(`📸 結算截圖: ${screenshotPath}`)

    // ── 無 crash ──
    const overlayCount = await page.locator('.react-error-overlay, body > iframe').count()
    if (overlayCount > 0) {
      await takeScreenshot('error-overlay')
      throw new Error('頁面存在 React error overlay')
    }

    console.log(`✅ ${preset.label} 瀏覽器對戰驗證通過`)
  } catch (error) {
    const errorPath = await takeScreenshot('failure')
    console.error(`❌ 驗證失敗 (截圖: ${errorPath})`)
    throw error
  } finally {
    await browser.close()
    server.kill()
  }
}

main().catch((error) => {
  console.error(error)
  server.kill()
  process.exit(1)
})
