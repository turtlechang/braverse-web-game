import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { strict as assert } from 'node:assert'
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
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
  }
  throw new Error(`Vite preview 未在 ${baseUrl} 啟動。`)
}

const main = async () => {
  await mkdir(outputDirectory, { recursive: true })
  console.log('🟡 啟動 BS3 Yellow Counter 瀏覽器對戰驗證…')
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

  /** 截圖輔助（僅在失敗時／階段性記錄時寫入 test-results） */
  const takeScreenshot = async (label) => {
    const filePath = resolve(
      outputDirectory,
      `bs3-yellow-${label}-${Date.now()}.png`,
    )
    await page.screenshot({ path: filePath, fullPage: false })
    return filePath
  }

  try {
    // ── Step 1: 進入主選單 ──
    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    console.log('📄 主選單載入完成')

    // ── Step 2: 選擇 BS3 Yellow Counter 牌組 ──
    // 點擊 AI 牌組下拉
    const aiDeckSelect = page.locator('select').nth(1) // 第二個 <select> 是 AI 牌組
    const exists = await aiDeckSelect.count()
    assert.ok(exists > 0, '找不到 AI 牌組下拉選單')

    // 選擇「第三彈黃色・反擊流」
    const bs3YellowOption = aiDeckSelect.locator(
      'option[value="bs3-yellow-counter"]',
    )
    const optionExists = await bs3YellowOption.count()
    assert.ok(optionExists > 0, '找不到 bS3-yellow-counter 選項')

    await aiDeckSelect.selectOption('bs3-yellow-counter')
    await page.waitForTimeout(300)
    console.log('🎴 選擇 BS3 Yellow Counter 牌組')

    // ── Step 3: 選擇 AI 等級為 Lv.4 ──
    const aiLevelSelect = page.locator('select').nth(2) // 第三個 <select> 是 AI 等級
    const levelExists = await aiLevelSelect.count()
    if (levelExists > 0) {
      await aiLevelSelect.selectOption('4')
      console.log('🧠 AI 等級設為 Lv.4')
    }

    // ── Step 4: 點擊開始對戰 ──
    const startButton = page.locator('button', { hasText: '開始對戰' })
    await startButton.waitFor({ state: 'visible', timeout: 10000 })
    await startButton.click()
    console.log('⚔️  點擊開始對戰')
    await page.waitForTimeout(2000)

    // ── Step 5: 自動推進來完成開局流程（如果有的話）──
    // 有些版本需要按「自動」來完成開局選擇
    const autoPlayButton = page.locator('button', { hasText: 'AI 自動' })
    const hasAutoButton = await autoPlayButton.count()

    if (hasAutoButton > 0) {
      console.log('🤖 點擊 AI 自動進行對戰…')
      // 反覆點擊 AI 自動直到對局結束，最多 500 步
      for (let step = 0; step < 500; step += 1) {
        await page.waitForTimeout(200)
        const btn = page.locator('button', { hasText: 'AI 自動' })
        const count = await btn.count()
        if (count === 0) break
        try {
          await btn.click({ timeout: 5000 })
        } catch {
          break
        }
      }
    } else {
      // 沒有 AI 自動按鈕：等待對局結束（React 元件渲染結果 modal）
      console.log('⏳ 等待對局自動進行中…')
      await page.waitForTimeout(15000)
    }

    // ── Step 6: 等待結果 modal 出現 ──
    try {
      const resultModal = page.locator('.result-modal, [data-testid="result"]')
      await resultModal.waitFor({ state: 'visible', timeout: 60000 })
      console.log('🏁 對局結束，結果 modal 已顯示')
    } catch {
      // 可能以其他方式結束
      const battleContainer = page.locator('.battle-container, .game-field')
      const stillThere = await battleContainer.count()
      assert.ok(
        stillThere === 0 || (await page.locator('text=勝利').count()) > 0 || (await page.locator('text=敗北').count()) > 0,
        '對局未正常結束，也無結果畫面',
      )
      console.log('⚠️  結果 modal 未出現，但對局狀態看似已結束')
    }

    // ── Step 7: 截圖記錄 ──
    const finalScreenshot = await takeScreenshot('result')
    console.log(`📸 結算截圖: ${finalScreenshot}`)

    // ── Step 8: 驗證 ──
    // 頁面上不應該有 React error overlay 或未捕獲錯誤
    const errorOverlay = page.locator('.react-error-overlay, body > iframe')
    const overlayCount = await errorOverlay.count()
    if (overlayCount > 0) {
      await takeScreenshot('error-overlay')
      throw new Error('頁面存在 React error overlay')
    }

    console.log('✅ BS3 Yellow Counter 瀏覽器對戰驗證通過')
  } catch (error) {
    const errorScreenshot = await takeScreenshot('failure')
    console.error(`❌ 驗證失敗 (截圖: ${errorScreenshot})`)
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
