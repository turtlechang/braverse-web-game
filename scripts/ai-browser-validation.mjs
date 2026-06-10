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

try {
  await waitForServer()
  const browser = await chromium.launch({
    headless: true,
    ...(browserExecutable
      ? { executablePath: browserExecutable }
      : {}),
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })

  await page.goto(baseUrl, { waitUntil: 'networkidle' })

  const completeOpeningSetup = async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const modal = page.locator('.opening-setup-modal')
      if ((await modal.count()) === 0 || !(await modal.isVisible())) return

      const heading = await modal.locator('h2').innerText()
      if (heading.includes('猜拳')) {
        await modal.getByRole('button', { name: '石頭' }).click()
      } else if (heading.includes('先攻或後攻')) {
        await modal.getByRole('button', { name: '選擇先攻' }).click()
      } else if (heading.includes('第一次調度')) {
        await modal.getByRole('button', { name: '保留手牌' }).click()
      } else if (heading.includes('起始餅乾')) {
        await modal
          .locator('.modal-card-options > button:not(:disabled)')
          .first()
          .click()
      }
      await page.waitForTimeout(60)
    }
    throw new Error('開局設定流程未在安全步數內完成。')
  }

  const playerSelect = page.getByTestId('player-deck-select')
  const aiSelect = page.getByTestId('ai-deck-select')
  const statusMessage = page.locator('.match-status small')

  assert.strictEqual(
    await playerSelect.inputValue(),
    'red',
    '初始 player-deck-select 應為 red',
  )
  assert.strictEqual(
    await aiSelect.inputValue(),
    'red',
    '初始 ai-deck-select 應為 red',
  )

  await playerSelect.selectOption('yellow')
  assert.strictEqual(
    await playerSelect.inputValue(),
    'yellow',
    'player-deck-select 應變為 yellow',
  )
  await statusMessage.filter({ hasText: '我方 黃色' }).waitFor()

  await aiSelect.selectOption('green')
  assert.strictEqual(
    await aiSelect.inputValue(),
    'green',
    'ai-deck-select 應變為 green',
  )
  await statusMessage.filter({ hasText: 'AI 綠色' }).waitFor()
  await completeOpeningSetup()

  await page.locator('button[title="查看官方範例牌組"]').click()
  await page.locator('.deck-list-modal').waitFor({ state: 'visible' })

  const deckHeading = page.locator('.deck-list-modal h2')
  await deckHeading.filter({ hasText: '黃色' }).waitFor()

  assert.ok(
    (await page.locator('.deck-reference-placeholder').count()) > 0,
    '應顯示 deck-reference-placeholder',
  )
  assert.strictEqual(
    await page.locator('.deck-reference-image img').count(),
    0,
    '不應有 starter-deck 圖片',
  )

  await page.getByTestId('view-ai-deck').click()
  await deckHeading.filter({ hasText: '綠色' }).waitFor()

  assert.ok(
    (await page.locator('.deck-reference-placeholder').count()) > 0,
    'AI 牌組應仍是 placeholder',
  )

  await page.locator('.deck-list-modal button.close-modal').click()
  await page.locator('.deck-list-modal').waitFor({ state: 'hidden' })

  await playerSelect.selectOption('red')
  assert.strictEqual(await playerSelect.inputValue(), 'red')
  await aiSelect.selectOption('red')
  assert.strictEqual(await aiSelect.inputValue(), 'red')
  await completeOpeningSetup()

  const runBreakToTrashTest = async (variant) => {
    const testUrl = `${baseUrl}?test-state=break-to-trash-${variant}`
    await page.goto(testUrl, { waitUntil: 'networkidle' })

    const handCardWrap = page.locator('.bottom-hand .hand-card-wrap').first()
    await handCardWrap.hover()

    const deployButton = handCardWrap.locator('.hand-card-action', { hasText: '登場' })
    await deployButton.waitFor({ state: 'visible' })
    await deployButton.click()

    const effectPanel = page.locator('.effect-panel')
    await effectPanel.waitFor({ state: 'visible' })

    const supportCards = page.locator('.bottom-field .support-cards .support-card')
    const supportCount = await supportCards.count()
    assert.ok(supportCount >= 2, `測試狀態應有至少 2 張支援卡，實際 ${supportCount}`)

    await supportCards.nth(0).click()
    await supportCards.nth(1).click()
    assert.ok(
      await supportCards.nth(0).evaluate((el) => el.classList.contains('is-rested')),
      '選取技能付款後支援卡應立即顯示橫置預覽',
    )

    const confirmButton = effectPanel.locator('button', { hasText: '確認效果' })

    if (variant === 'lv1') {
      const breakCards = page.locator('.bottom-field .break-cards .break-card')
      const breakCount = await breakCards.count()
      assert.ok(breakCount >= 1, 'LV.1 測試應有至少 1 張休息區卡牌')

      const firstBreakCard = breakCards.first()
      const isTargetable = await firstBreakCard.evaluate(
        (el) => el.classList.contains('is-targetable'),
      )
      assert.ok(isTargetable, 'LV.1 休息區卡牌應標示為效果目標')

      await firstBreakCard.click()
      const isSelected = await firstBreakCard.evaluate(
        (el) => el.classList.contains('is-selected'),
      )
      assert.ok(isSelected, '點選後休息區卡牌應進入已選狀態')

      await confirmButton.click()

      const statusMessage = page.locator('.match-status small')
      await statusMessage.filter({ hasText: /移至棄牌區/ }).waitFor()

      const discardZone = page.locator('.bottom-field .discard-zone')
      await discardZone.click()
      await page.locator('.card-pile-modal').waitFor({ state: 'visible' })
      assert.ok(
        (await page.locator('.card-pile-modal .card-pile-grid > button').count()) >= 1,
        '棄牌區清單應以卡圖顯示',
      )
      await page.locator('.card-pile-modal .close-modal').click()
    } else {
      const breakCards = page.locator('.bottom-field .break-cards .break-card')
      const breakCount = await breakCards.count()
      assert.ok(breakCount >= 1, 'LV.2 測試應有至少 1 張休息區卡牌')

      const firstBreakCard = breakCards.first()
      const isTargetable = await firstBreakCard.evaluate(
        (el) => el.classList.contains('is-targetable'),
      )
      assert.ok(!isTargetable, 'LV.2 休息區卡牌不應標示為效果目標')

      await confirmButton.click()

      const statusMessage = page.locator('.match-status small')
      await statusMessage.filter({ hasText: /沒有選擇休息區目標/ }).waitFor()
    }

    await page.waitForTimeout(1200)
    assert.strictEqual(
      await effectPanel.count(),
      0,
      '完成效果通知應在 1 秒後淡出並移除',
    )
  }

  await runBreakToTrashTest('lv1')
  await runBreakToTrashTest('lv2')

  await page.goto(`${baseUrl}?test-state=trap-payable`, {
    waitUntil: 'networkidle',
  })
  await page.locator('.battle-response-modal').waitFor({ state: 'visible' })
  assert.strictEqual(
    await page.locator('.battle-response-modal').count(),
    1,
    '可支付陷阱應顯示回應視窗',
  )

  await page.goto(`${baseUrl}?test-state=trap-unpayable`, {
    waitUntil: 'networkidle',
  })
  await page.waitForFunction(
    () => document.querySelector('.battle-response-modal') === null,
  )
  assert.strictEqual(
    await page.locator('.battle-response-modal').count(),
    0,
    '不可支付陷阱不應顯示回應視窗',
  )
  assert.ok(
    !(await page.locator('.match-status small').innerText()).includes('陷阱'),
    '不可支付陷阱自動略過時不應顯示提示文字',
  )

  await page.goto(`${baseUrl}?test-state=flip-response`, {
    waitUntil: 'networkidle',
  })
  const flipModal = page.locator('.flip-response-modal')
  await flipModal.waitFor({ state: 'visible' })
  const flipCards = flipModal.locator('.flip-card-page > button')
  const activateFlipButton = flipModal.getByRole('button', { name: '發動 FLIP' })
  assert.strictEqual(await flipCards.count(), 3, 'FLIP 每頁應顯示 3 張手牌')
  assert.ok(await activateFlipButton.isDisabled(), '未選棄牌時不可發動 FLIP')
  assert.strictEqual(
    await flipModal.locator('.flip-card-page').evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
    true,
    'FLIP 手牌選擇區不應出現水平卷軸',
  )

  await flipCards.first().click()
  assert.ok(!(await activateFlipButton.isDisabled()), '選擇 1 張手牌後應可發動')
  await flipModal.getByRole('button', { name: '下一頁手牌' }).click()
  assert.strictEqual(
    await flipModal.locator('.flip-page-indicator').innerText(),
    '2 / 2',
    '下一頁按鈕應切換到第 2 頁',
  )
  await flipModal.getByRole('button', { name: '上一頁手牌' }).click()
  assert.ok(
    await flipModal
      .locator('.flip-card-page > button')
      .first()
      .evaluate((element) => element.classList.contains('is-selected')),
    '切頁後應保留已選取的手牌',
  )
  await activateFlipButton.click()
  await flipModal.waitFor({ state: 'hidden' })

  const replacementUrl = `${baseUrl}?test-state=replacement-choice`
  await page.goto(replacementUrl, { waitUntil: 'networkidle' })
  const replacementModal = page.locator('.decision-modal')
  await replacementModal.waitFor({ state: 'visible' })
  assert.ok(
    (await replacementModal.innerText()).includes('是否要在戰鬥區放置新餅乾'),
    '補位視窗應詢問玩家是否放置餅乾',
  )
  assert.strictEqual(
    await replacementModal.getByRole('button', { name: '不補餅乾' }).count(),
    1,
    '補位視窗應提供不補餅乾按鈕',
  )
  await replacementModal
    .locator('.modal-card-options > button:not(:disabled)')
    .first()
    .click()
  await replacementModal.waitFor({ state: 'hidden' })
  assert.strictEqual(
    await page.locator('.bottom-field .combat-card-wrap').count(),
    2,
    '選擇餅乾後戰鬥區應補回第二張餅乾',
  )

  await page.goto(replacementUrl, { waitUntil: 'networkidle' })
  await replacementModal.waitFor({ state: 'visible' })
  await replacementModal.getByRole('button', { name: '不補餅乾' }).click()
  await replacementModal.waitFor({ state: 'hidden' })
  assert.strictEqual(
    await page.locator('.bottom-field .combat-card-wrap').count(),
    1,
    '選擇不補餅乾後應保留原本的一張戰鬥區餅乾',
  )
  await page.locator('.match-status small').filter({
    hasText: '已選擇不補餅乾',
  }).waitFor()

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await completeOpeningSetup()

  assert.strictEqual(
    await page.locator('.inspect-hand-button').count(),
    0,
    '不應再顯示 inspect-hand-button',
  )
  assert.strictEqual(
    await page.locator('.phase-rail .rail-ai-status').count(),
    1,
    'AI 狀態面板應位於 PhaseRail 內',
  )
  assert.ok(
    (await page.locator('.bottom-field .hp-card-stack .hp-card').count()) > 0,
    '我方戰鬥區餅乾下方應展開 HP 卡',
  )

  await page.getByRole('button', { name: '執行 20 場 AI 驗證' }).click()
  await page.getByTestId('ai-simulation-report').waitFor()

  const matches = []
  for (let index = 1; index <= 20; index += 1) {
    const row = page.getByTestId(`ai-simulation-match-${index}`)
    const validation = await row.getAttribute('data-validation')
    matches.push({
      match: index,
      seed: validation ? JSON.parse(validation).seed : null,
      text: (await row.innerText()).replace(/\s+/g, ' ').trim(),
      validation: validation ? JSON.parse(validation) : null,
    })
  }

  const stuckMatches = matches.filter(
    (match) => match.validation?.error,
  )
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    completed: 20 - stuckMatches.length,
    stuck: stuckMatches.length,
    matches,
  }

  await mkdir(outputDirectory, { recursive: true })
  await writeFile(
    resolve(outputDirectory, 'ai-browser-validation.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  )
  await page.screenshot({
    path: resolve(outputDirectory, 'ai-browser-validation.png'),
    fullPage: true,
  })
  await browser.close()

  console.log(JSON.stringify(report, null, 2))
  if (stuckMatches.length > 0) {
    process.exitCode = 1
  }
} finally {
  server.kill()
}
