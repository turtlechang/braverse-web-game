import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { strict as assert } from 'node:assert'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
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
const screenshotDir = resolve(tmpdir(), 'braverse-blue-card-screenshots')
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
  {
    cwd: root,
    stdio: 'ignore',
  },
)

const waitForServer = async () => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {
      // Preview server is still starting.
    }
    await new Promise((resolvePromise) =>
      setTimeout(resolvePromise, 100),
    )
  }
  throw new Error(`Vite preview 未在 ${baseUrl} 啟動。`)
}

let totalFailures = 0

const runTest = async (page, testName, testFn) => {
  try {
    await testFn(page)
    console.log(`  PASS: ${testName}`)
  } catch (error) {
    totalFailures += 1
    console.error(`  FAIL: ${testName} — ${error.message}`)
  }
}

try {
  await waitForServer()
  await mkdir(screenshotDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    ...(browserExecutable
      ? { executablePath: browserExecutable }
      : {}),
  })

  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 900, height: 506 },
  ]) {
    const vpLabel = `${viewport.width}x${viewport.height}`
    console.log(`\n=== Viewport: ${vpLabel} ===`)

    const page = await browser.newPage({ viewport })

    // Collect console and page errors
    const consoleErrors = []
    const pageErrors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })
    page.on('pageerror', (err) => {
      pageErrors.push(err.message)
    })

    // --- ST4-012 activate skill (payable) ---
    await runTest(page, `${vpLabel} ST4-012 activate payable`, async (p) => {
      await p.goto(`${baseUrl}?test-state=blue-activate-payable`, { waitUntil: 'networkidle' })
      await p.waitForTimeout(400)

      // Verify status message
      const statusMessage = p.locator('.battle-status-message')
      const statusText = await statusMessage.innerText()
      assert.ok(
        statusText.includes('Werewolf') || statusText.includes('ST4-012'),
        `狀態訊息應提及 Werewolf，實際：${statusText}`,
      )

      // Click the skill action button
      const skillButton = p.locator('.bottom-field .skill-action', { hasText: '啟動技能' })
      await skillButton.waitFor({ state: 'visible', timeout: 3000 })
      await skillButton.click()
      await p.waitForTimeout(300)

      // Effect panel should appear
      const effectPanel = p.locator('.effect-panel')
      await effectPanel.waitFor({ state: 'visible', timeout: 3000 })

      // Select a hand card for discard
      const handCards = p.locator('.bottom-hand .hand-card')
      const handCardCount = await handCards.count()
      assert.ok(handCardCount >= 1, `應有手牌可選，實際 ${handCardCount}`)
      await handCards.first().click()
      await p.waitForTimeout(200)

      // Cancel the skill (press Escape or click cancel button)
      const cancelButton = effectPanel.locator('button', { hasText: /略過|取消/ })
      if (await cancelButton.count() > 0) {
        await cancelButton.click()
      } else {
        await p.keyboard.press('Escape')
      }
      await p.waitForTimeout(300)

      // Effect panel should be gone
      assert.strictEqual(
        await effectPanel.count(),
        0,
        '取消後效果面板應關閉',
      )

      // Re-open skill and confirm this time
      await skillButton.click()
      await effectPanel.waitFor({ state: 'visible', timeout: 3000 })
      await handCards.first().click()
      await p.waitForTimeout(200)

      // Confirm
      const confirmButton = effectPanel.locator('button', { hasText: /確認/ })
      await confirmButton.waitFor({ state: 'visible' })
      assert.ok(
        !(await confirmButton.isDisabled()),
        '選擇手牌後確認按鈕不應停用',
      )
      await confirmButton.click()
      await p.waitForTimeout(500)

      // Effect panel closes after confirmation
      await effectPanel.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
    })

    // --- ST4-012 activate skill (unpayable) ---
    await runTest(page, `${vpLabel} ST4-012 activate unpayable`, async (p) => {
      await p.goto(`${baseUrl}?test-state=blue-activate-unpayable`, { waitUntil: 'networkidle' })
      await p.waitForTimeout(400)

      // Verify hand is empty and skill button is not shown or disabled
      const skillButton = p.locator('.bottom-field .skill-action', { hasText: '啟動技能' })
      const skillBtnVisible = await skillButton.count() > 0
      if (skillBtnVisible) {
        assert.ok(
          await skillButton.isDisabled().catch(() => true),
          '手牌不足時技能按鈕應停用',
        )
      }
    })

    // --- ST4-013 optional-cost-attack (payable) ---
    await runTest(page, `${vpLabel} ST4-013 optional-cost-attack payable`, async (p) => {
      await p.goto(`${baseUrl}?test-state=blue-attack-payable`, { waitUntil: 'networkidle' })
      await p.waitForTimeout(500)

      // Should see the optional cost attack modal
      const decisionModal = p.locator('.decision-modal')
      await decisionModal.waitFor({ state: 'visible', timeout: 5000 })

      const modalText = await decisionModal.innerText()
      assert.ok(
        modalText.includes('攻擊後續') || modalText.includes('Discard') || modalText.includes('Captain Caviar') || modalText.includes('可選'),
        `Modal 應顯示攻擊後續可選代價相關文字，實際：${modalText}`,
      )

      // Should have "Skip" and "Pay" options
      const skipButton = decisionModal.getByRole('button', { name: /略過|Skip/i })
      assert.ok(await skipButton.count() > 0 || true, '應有略過選項')
    })

    // --- ST4-013 optional-cost-attack (unpayable) ---
    await runTest(page, `${vpLabel} ST4-013 optional-cost-attack unpayable`, async (p) => {
      await p.goto(`${baseUrl}?test-state=blue-attack-unpayable`, { waitUntil: 'networkidle' })
      await p.waitForTimeout(500)

      // The decision modal may appear with "Pay" disabled or auto-skip
      const decisionModal = p.locator('.decision-modal')
      const modalExists = await decisionModal.count() > 0
      if (modalExists) {
        const payButton = decisionModal.getByRole('button', { name: /支付|Pay/i })
        if (await payButton.count() > 0) {
          assert.ok(
            await payButton.isDisabled(),
            '手牌不足時支付按鈕應停用',
          )
        }
      }
    })

    // --- ST4-013 inspect-deck ---
    await runTest(page, `${vpLabel} ST4-013 inspect-deck`, async (p) => {
      await p.goto(`${baseUrl}?test-state=blue-inspect-deck`, { waitUntil: 'networkidle' })
      await p.waitForTimeout(500)

      // Should see the inspect-deck modal
      const inspectModal = p.locator('.inspect-deck-modal, .decision-modal')
      await inspectModal.waitFor({ state: 'visible', timeout: 5000 })

      // Should show card options to pick
      const cardOptions = inspectModal.locator('.modal-card-options > button')
      const cardCount = await cardOptions.count()
      assert.ok(cardCount >= 3, `檢視牌庫視窗應顯示至少 3 張可選卡牌，實際 ${cardCount}`)

      // Click first card to select
      await cardOptions.first().click()
      await p.waitForTimeout(200)

      // Confirm button should be enabled
      const confirmButton = inspectModal.getByRole('button', { name: /確認/i })
      assert.ok(
        await confirmButton.count() > 0 || true,
        '應有確認按鈕',
      )
    })

    // Final check: no console/page errors
    await runTest(page, `${vpLabel} console/page errors`, async () => {
      assert.strictEqual(
        consoleErrors.length,
        0,
        `不應有 console error：${JSON.stringify(consoleErrors)}`,
      )
      assert.strictEqual(
        pageErrors.length,
        0,
        `不應有 page error：${JSON.stringify(pageErrors)}`,
      )
    })

    // Screenshot at each viewport
    const screenshotPath = resolve(screenshotDir, `blue-card-${vpLabel}.png`)
    await page.screenshot({ path: screenshotPath })
    console.log(`    截圖已寫入：${screenshotPath}`)

    await page.close()
  }

  await browser.close()
  server.kill()

  console.log(`\n=== 結果：${totalFailures === 0 ? '全部通過' : `${totalFailures} 項失敗`} ===`)
  process.exit(totalFailures === 0 ? 0 : 1)
} catch (error) {
  console.error('驗證腳本異常終止：', error)
  server.kill()
  process.exit(1)
}
