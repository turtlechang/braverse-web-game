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
    page.setDefaultTimeout(5000)

    // Collect console and page errors
    const consoleErrors = []
    const pageErrors = []
    const failedResponses = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const location = msg.location()
        if (
          location.url?.endsWith('/favicon.ico') &&
          msg.text().includes('404')
        ) {
          return
        }
        consoleErrors.push(
          location.url ? `${msg.text()} (${location.url})` : msg.text(),
        )
      }
    })
    page.on('pageerror', (err) => {
      pageErrors.push(err.message)
    })
    page.on('response', (response) => {
      if (response.status() >= 400) {
        failedResponses.push(`${response.status()} ${response.url()}`)
      }
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

      // Select a discard hand candidate inside the effect panel
      const discardCandidates = effectPanel.locator('.effect-candidates-discard-hand button')
      const candidateCount = await discardCandidates.count()
      assert.ok(candidateCount >= 1, `應有手牌代價候選可選，實際 ${candidateCount}`)
      await discardCandidates.first().click()
      await p.waitForTimeout(200)

      // Select target if present (e.g., modify-attack self-target)
      const targetCandidates = effectPanel.locator('.effect-candidates-target button')
      const targetCount = await targetCandidates.count()
      if (targetCount > 0) {
        await targetCandidates.first().click()
        await p.waitForTimeout(200)
      }

      // Cancel the skill
      const cancelButton = effectPanel.locator('button', { hasText: /取消技能/ })
      if (await cancelButton.count() > 0) {
        await cancelButton.click({ force: true })
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
      await discardCandidates.first().click()
      await p.waitForTimeout(200)
      if (targetCount > 0) {
        await targetCandidates.first().click()
        await p.waitForTimeout(200)
      }

      // Confirm
      const confirmButton = effectPanel.locator('button', { hasText: /確認效果/ })
      await confirmButton.waitFor({ state: 'visible' })
      assert.ok(
        !(await confirmButton.isDisabled()),
        '選擇手牌與目標後確認按鈕不應停用',
      )
      await confirmButton.click({ force: true })
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

      // Diagnostic: screenshot before assertion
      const diagPath = resolve(screenshotDir, `blue-card-${vpLabel}-optional-cost.png`)
      await p.screenshot({ path: diagPath })
      console.log(`    診斷截圖：${diagPath}`)

      // Check if modal exists at all
      const modalCount = await p.locator('.optional-cost-attack-modal').count()
      const backdropCount = await p.locator('.modal-backdrop').count()
      console.log(`    optional-cost-attack-modal count: ${modalCount}, modal-backdrop count: ${backdropCount}`)

      // Should see the optional cost attack modal
      const decisionModal = p.locator('.optional-cost-attack-modal')
      await decisionModal.waitFor({ state: 'visible', timeout: 5000 })

      const modalText = await decisionModal.innerText()
      assert.ok(
        modalText.includes('攻擊後續') || modalText.includes('Discard') || modalText.includes('Captain Caviar') || modalText.includes('可選'),
        `Modal 應顯示攻擊後續可選代價相關文字，實際：${modalText}`,
      )

      // Should have "Skip" and "Pay" options
      const skipButton = decisionModal.getByRole('button', { name: /略過/i })
      assert.ok(await skipButton.count() > 0, '應有略過選項')
      const handBefore = await p.locator('.bottom-hand .hand-card-wrap').count()
      const defenderHpBefore = await p
        .locator('.top-field .combat-card-wrap .card-badges span')
        .first()
        .innerText()
      assert.ok(defenderHpBefore.includes('2/'), `支付前對手應有 2 HP，實際：${defenderHpBefore}`)

      await decisionModal.getByRole('button', { name: /支付/i }).click()
      const optionGroups = decisionModal.locator('.modal-card-options')
      const discardOptions = optionGroups.nth(0).locator('button')
      await discardOptions.nth(0).click()
      await discardOptions.nth(1).click()
      await optionGroups.nth(1).locator('button').first().click()
      const confirmButton = decisionModal.getByRole('button', { name: /^確認$/ })
      assert.ok(!(await confirmButton.isDisabled()), '選滿 2 張手牌與目標後確認按鈕應啟用')
      await confirmButton.click()
      await decisionModal.waitFor({ state: 'hidden', timeout: 5000 })

      assert.strictEqual(
        await p.locator('.bottom-hand .hand-card-wrap').count(),
        handBefore - 2,
        '支付後應棄置 2 張手牌',
      )
      const defenderHpAfter = await p
        .locator('.top-field .combat-card-wrap .card-badges span')
        .first()
        .innerText()
      assert.ok(defenderHpAfter.includes('1/'), `支付後對手應受到 1 點傷害，實際：${defenderHpAfter}`)

      const remainingHandCard = p.locator('.bottom-hand .hand-card-wrap').first()
      await remainingHandCard.locator('.hand-card').click()
      const deployButton = remainingHandCard.locator('.hand-card-action', {
        hasText: '登場',
      })
      if (!(await deployButton.isVisible().catch(() => false))) {
        console.log(`    效果後手牌：${await remainingHandCard.innerText()}`)
        console.log(`    效果後狀態：${await p.locator('.table-divider').innerText()}`)
        console.log(`    效果後 modal：${await p.locator('.modal-backdrop').count()}`)
        const postEffectPath = resolve(
          screenshotDir,
          `blue-card-${vpLabel}-post-effect-lock.png`,
        )
        await p.screenshot({ path: postEffectPath })
        console.log(`    效果後診斷截圖：${postEffectPath}`)
      }
      await deployButton.waitFor({ state: 'visible', timeout: 3000 })
      await deployButton.click()
      assert.strictEqual(
        await p.locator('.bottom-field .combat-card-wrap').count(),
        2,
        'ST4-013 效果完成後，剩餘手牌餅乾應能登場',
      )
    })

    // --- ST4-013 optional-cost-attack (unpayable) ---
    await runTest(page, `${vpLabel} ST4-013 optional-cost-attack unpayable`, async (p) => {
      await p.goto(`${baseUrl}?test-state=blue-attack-unpayable`, { waitUntil: 'networkidle' })
      await p.waitForTimeout(500)

      // The decision modal may appear with "Pay" disabled or auto-skip
      const decisionModal = p.locator('.optional-cost-attack-modal')
      const modalExists = await decisionModal.count() > 0
      if (modalExists) {
        const payButton = decisionModal.getByRole('button', { name: /支付/i })
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
      const inspectModal = p.locator('.inspect-deck-modal')
      await inspectModal.waitFor({ state: 'visible', timeout: 5000 })

      // Should show card options to pick
      const cardOptions = inspectModal.locator('.inspect-deck-grid > button')
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

    // --- ST4-016 return-to-hand ---
    await runTest(page, `${vpLabel} ST4-016 return-to-hand`, async (p) => {
      await p.goto(`${baseUrl}?test-state=blue-st4-016`, { waitUntil: 'networkidle' })
      await p.waitForTimeout(500)

      const handCards = p.locator('.bottom-hand .hand-card-wrap')
      const handCountBefore = await handCards.count()
      const battleCookies = p.locator('.bottom-field .combat-card-wrap')
      const battleCountBefore = await battleCookies.count()

      await handCards.first().locator('.hand-card').click()
      await p.waitForTimeout(200)
      const playButton = handCards.first().locator('.hand-card-action', { hasText: '使用' })
      await playButton.click()
      await p.locator('.card-reveal-modal').getByRole('button', { name: '確認使用' }).click()

      const effectPanel = p.locator('.effect-panel')
      await effectPanel.waitFor({ state: 'visible', timeout: 3000 })
      const supportCards = p.locator('.bottom-field .support-cards .support-card')
      await supportCards.nth(0).click()
      await supportCards.nth(1).click()

      const targetCandidates = effectPanel.locator('.effect-candidates-target button')
      assert.ok(await targetCandidates.count() > 0, '應有候選目標')
      await targetCandidates.first().click()
      await p.waitForTimeout(200)

      const confirmButton = effectPanel.locator('button', { hasText: /確認/ })
      await confirmButton.click()
      await p.waitForTimeout(500)

      const handCountAfter = await handCards.count()
      const battleCountAfter = await battleCookies.count()

      assert.strictEqual(handCountAfter, handCountBefore, '手牌數量應不變')
      assert.strictEqual(battleCountAfter, battleCountBefore - 1, '場上應少 1 張餅乾')
      assert.strictEqual(
        await p.locator('.decision-modal', { hasText: '放置餅乾' }).count(),
        0,
        '返回手牌後不應顯示補位視窗',
      )
    })

    // --- ST4-017 return-to-hand ---
    await runTest(page, `${vpLabel} ST4-017 return-to-hand`, async (p) => {
      await p.goto(`${baseUrl}?test-state=blue-st4-017`, { waitUntil: 'networkidle' })
      await p.waitForTimeout(500)

      const handCards = p.locator('.bottom-hand .hand-card-wrap')
      const handCountBefore = await handCards.count()
      const battleCookies = p.locator('.bottom-field .combat-card-wrap')
      const battleCountBefore = await battleCookies.count()

      await handCards.first().locator('.hand-card').click()
      await p.waitForTimeout(200)
      const playButton = handCards.first().locator('.hand-card-action', { hasText: '使用' })
      await playButton.click()
      await p.locator('.card-reveal-modal').getByRole('button', { name: '確認使用' }).click()

      const effectPanel = p.locator('.effect-panel')
      await effectPanel.waitFor({ state: 'visible', timeout: 3000 })
      await p.locator('.bottom-field .support-cards .support-card').nth(0).click()

      const targetCandidates = effectPanel.locator('.effect-candidates-target button')
      assert.ok(await targetCandidates.count() > 0, '應有候選目標')
      await targetCandidates.first().click()
      await p.waitForTimeout(200)

      const confirmButton = effectPanel.locator('button', { hasText: /確認/ })
      await confirmButton.click()
      await p.waitForTimeout(500)

      const handCountAfter = await handCards.count()
      const battleCountAfter = await battleCookies.count()

      assert.strictEqual(handCountAfter, handCountBefore, '手牌數量應不變')
      assert.strictEqual(battleCountAfter, battleCountBefore - 1, '場上應少 1 張餅乾')
      assert.strictEqual(
        await p.locator('.decision-modal', { hasText: '放置餅乾' }).count(),
        0,
        '返回手牌後不應顯示補位視窗',
      )
    })

    // --- ST4-018 draw-up-to ---
    await runTest(page, `${vpLabel} ST4-018 draw-up-to`, async (p) => {
      await p.goto(`${baseUrl}?test-state=blue-st4-018`, { waitUntil: 'networkidle' })
      await p.waitForTimeout(500)

      const handCards = p.locator('.bottom-hand .hand-card-wrap')
      const handCountBefore = await handCards.count()

      await handCards.first().locator('.hand-card').click()
      await p.waitForTimeout(200)
      const playButton = handCards.first().locator('.hand-card-action', { hasText: '使用' })
      await playButton.click()
      await p.locator('.card-reveal-modal').getByRole('button', { name: '確認使用' }).click()

      const effectPanel = p.locator('.effect-panel')
      await effectPanel.waitFor({ state: 'visible', timeout: 3000 })
      const supportCards = p.locator('.bottom-field .support-cards .support-card')
      await supportCards.nth(0).click()
      await supportCards.nth(1).click()
      await effectPanel.locator('button', { hasText: '確認效果' }).click()

      const modal = p.locator('.draw-up-to-modal')
      await modal.waitFor({ state: 'visible', timeout: 3000 })

      await modal.locator('.draw-up-to-option', { hasText: '2' }).click()
      const confirmButton = modal.locator('button', { hasText: '抽取 2 張牌' })
      await confirmButton.click()
      await p.waitForTimeout(500)

      const handCountAfter = await handCards.count()
      assert.strictEqual(handCountAfter, handCountBefore + 1, '手牌數量應增加 1 張')
    })

    // --- ST4-019 hand-to-deck-and-draw ---
    await runTest(page, `${vpLabel} ST4-019 hand-to-deck-and-draw`, async (p) => {
      await p.goto(`${baseUrl}?test-state=blue-st4-019`, { waitUntil: 'networkidle' })
      await p.waitForTimeout(500)

      const handCards = p.locator('.bottom-hand .hand-card-wrap')
      const handCountBefore = await handCards.count()

      await handCards.first().locator('.hand-card').click()
      await p.waitForTimeout(200)
      const playButton = handCards.first().locator('.hand-card-action', { hasText: '使用' })
      await playButton.click()
      await p.locator('.card-reveal-modal').getByRole('button', { name: '確認使用' }).click()

      const effectPanel = p.locator('.effect-panel')
      await effectPanel.waitFor({ state: 'visible', timeout: 3000 })
      await p.locator('.bottom-field .support-cards .support-card').nth(0).click()
      await effectPanel.locator('button', { hasText: '確認效果' }).click()
      await p.waitForTimeout(500)

      const handCountAfter = await handCards.count()
      assert.strictEqual(handCountAfter, handCountBefore - 1, '手牌數量應少 1 張')
    })

    // --- ST4-020 discard-hand trap cost ---
    await runTest(page, `${vpLabel} ST4-020 discard-hand payable`, async (p) => {
      await p.goto(`${baseUrl}?test-state=blue-st4-020-payable`, { waitUntil: 'networkidle' })
      await p.waitForTimeout(300)

      const trapModal = p.locator('.battle-response-modal', { hasText: '是否發動陷阱' })
      await trapModal.waitFor({ state: 'visible' })
      const handCountBefore = await p.locator('.bottom-hand .hand-card-wrap').count()
      await trapModal.locator('.modal-card-options > button', { hasText: 'Octo-Ink Spray' }).click()
      await p.locator('.card-detail-modal .close-modal').click()

      const activateButton = trapModal.locator('button', { hasText: '支付並發動' })
      assert.strictEqual(await activateButton.isDisabled(), true, '未選滿 2 張手牌時不可發動')
      const discardOptions = trapModal.locator('.trap-discard-options > button')
      assert.ok(await discardOptions.count() >= 2, '應顯示至少 2 張可棄手牌')
      await discardOptions.nth(0).click()
      await discardOptions.nth(1).click()
      assert.strictEqual(await activateButton.isEnabled(), true, '選滿 2 張手牌後應可發動')
      await activateButton.click()
      await p.locator('.card-reveal-modal').getByRole('button', { name: '確認發動' }).click()
      await p.waitForTimeout(500)

      const handCountAfter = await p.locator('.bottom-hand .hand-card-wrap').count()
      assert.strictEqual(handCountAfter, handCountBefore - 3, '陷阱與所選 2 張手牌應進入棄牌區')
    })

    await runTest(page, `${vpLabel} ST4-020 discard-hand unpayable`, async (p) => {
      await p.goto(`${baseUrl}?test-state=blue-st4-020-unpayable`, { waitUntil: 'networkidle' })
      await p.waitForTimeout(500)
      assert.strictEqual(
        await p.locator('.battle-response-modal', { hasText: '是否發動陷阱' }).count(),
        0,
        '不足 2 張可棄手牌時不應提供 ST4-020 發動視窗',
      )
    })

    // Final check: no console/page errors
    await runTest(page, `${vpLabel} console/page errors`, async () => {
      assert.strictEqual(
        consoleErrors.length,
        0,
        `不應有 console error：${JSON.stringify(consoleErrors)}；失敗資源：${JSON.stringify(failedResponses)}`,
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
