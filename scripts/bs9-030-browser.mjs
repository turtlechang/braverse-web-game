import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * BS9-030 的實卡 A/B Browser 驗證：
 * - 正向：從 EXTRA 支付 3 張黃色 FLIP Cookie，完成 On Play，宣告真實攻擊，
 *   再支付攻擊後代價並發動 BS9-026 的 FLIP 抽牌。
 * - 負向：只保留 2 張合格手牌，確認 EXTRA 入口由規則層停用。
 *
 * 兩條路徑都使用 localhost 的 card-check fixture；卡牌仍保留官方資料與
 * imageUrl，網路受限時 CardFace 會顯示同名 fallback，不把測試降成只查文字。
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES
    ? [process.env.PLAYWRIGHT_NODE_MODULES]
    : [root],
})
const playwright = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwright.chromium ?? playwright.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_BS9_030_TEST_PORT ?? 4198)
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
const outputDirectory = resolve(root, 'output/playwright')
mkdirSync(outputDirectory, { recursive: true })

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))

const recordBrowserErrors = (page) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const location = message.location()
    const text = message.text()
    if (location.url?.endsWith('/favicon.ico') && text.includes('404')) return
    // The official card images are intentionally kept in the fixture.  A
    // sandbox without external network access reports the blocked image load;
    // CardFace's named fallback remains a valid visual card representation.
    if (
      location.url?.includes('cookierunbraverse.com/data/en_storage/') &&
      /ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(text)
    ) return
    errors.push(`console: ${text} (${location.url || 'unknown URL'})`)
  })
  return errors
}

const readTrace = (page) => page.evaluate(() => window.__braverseContractTrace ?? [])
const visiblePanel = (page) => page.locator('.effect-panel[role="alertdialog"]:visible').first()
const assertTraceKind = (trace, kind, message) => {
  assert.ok(trace.some((entry) => entry.commandKind === kind), message)
}

const waitForGame = async (page) => {
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await page.waitForTimeout(250)
}

const openExtraEntry = async (page, ready) => {
  const extraDock = page.getByLabel('玩家 EXTRA Deck 1 張')
  await extraDock.waitFor({ state: 'visible' })
  assert.equal(
    await extraDock.getAttribute('data-extra-deck-ready'),
    String(ready),
    `BS9-030 EXTRA readiness should be ${ready}`,
  )
  await extraDock.click()
  const dialog = page.getByRole('dialog', { name: '玩家 EXTRA Deck' })
  await dialog.waitFor({ state: 'visible' })
  const entry = dialog.locator('.extra-deck-card-entry').filter({ hasText: 'BS9-030' })
  await entry.waitFor({ state: 'visible' })
  assert.match(await entry.innerText(), /Shadow Milk Cookie/)
  const image = entry.locator('.extra-deck-card-image')
  assert.equal(await image.count(), 1)
  assert.ok(
    (await image.locator('img').count()) === 1 ||
      (await image.locator('.card-fallback').count()) === 1,
    'BS9-030 EXTRA entry should render official art or its named visual fallback',
  )
  return { dialog, entry, extraDock }
}

const payEntryCost = async (page, entry) => {
  await entry.getByRole('button', { name: '從 EXTRA 登場' }).click()
  const panel = visiblePanel(page)
  await panel.waitFor({ state: 'visible' })
  assert.match(await panel.innerText(), /Shadow Milk Cookie/)
  assert.match(await panel.innerText(), /棄置 3 張手牌/)
  await panel.getByRole('button', { name: '支付代價', exact: true }).click()

  const cost = panel.locator('.optional-cost-col').filter({ hasText: '選擇 3 張手牌棄置' })
  const candidates = cost.locator('button')
  assert.equal(await candidates.count(), 4, 'BS9-030 positive fixture should expose four qualifying FLIP cards')
  // Keep the second Burnt Cheese Cookie for the attack Then so the detached
  // FLIP path opens its real draw-up-to decision.
  for (const index of [0, 2, 3]) await candidates.nth(index).click()
  assert.equal(await cost.locator('button.is-selected').count(), 3)
  await panel.getByRole('button', { name: '確認', exact: true }).click()
  // The entry payment immediately hands the same effect surface to the
  // materialized Cookie's On Play queue; React may reuse the alertdialog node
  // instead of briefly hiding it.
  await panel.getByText('OnPlay 登場', { exact: true }).first().waitFor({ state: 'visible' })
}

const resolveOnPlay = async (page) => {
  const panel = visiblePanel(page)
  await panel.waitFor({ state: 'visible' })
  assert.match(await panel.innerText(), /OnPlay 登場/)
  assert.match(await panel.innerText(), /LV\.1/)
  const target = panel.locator('.effect-candidates-target button:not(:disabled)').first()
  assert.equal(await panel.locator('.effect-candidates-target button:not(:disabled)').count(), 1)
  await target.click()
  await panel.getByRole('button', { name: '確認發動', exact: true }).click()
  await panel.waitFor({ state: 'hidden' })
}

const declareAttack = async (page) => {
  const attacker = page.locator(
    '.bottom-field [data-card-instance-id="bs9-030-demo-extra"] > .card-face.is-attackable',
  )
  await attacker.waitFor({ state: 'visible' })
  await attacker.click()
  for (let index = 0; index < 3; index += 1) {
    const payment = page.locator(
      '.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)',
    ).first()
    await payment.focus()
    await payment.press('Enter')
    await page.waitForTimeout(50)
  }
  assert.equal(
    await page.locator('.bottom-field .support-card-wrap .card-face.is-selected').count(),
    3,
  )
  await page.locator('.top-field .combat-card-wrap > .card-face').first().click()
  const panel = visiblePanel(page)
  await panel.waitFor({ state: 'visible' })
  assert.match(await panel.innerText(), /攻擊後續效果/)
  assert.match(await panel.innerText(), /discard 1 Cookie that has FLIP/i)
  return panel
}

const resolveDetachedFlip = async (page, panel) => {
  await panel.getByRole('button', { name: '支付', exact: true }).click()
  const cost = panel.locator('.optional-cost-col').filter({ hasText: '選擇 1 張手牌棄置' })
  assert.equal(await cost.locator('button').count(), 1)
  assert.match(await cost.locator('button').first().innerText(), /Burnt Cheese Cookie/)
  await cost.locator('button').first().click()
  await panel.getByRole('button', { name: '確認', exact: true }).click()
  await panel.waitFor({ state: 'hidden' })

  const flip = page.locator('.flip-response-modal:visible').first()
  await flip.waitFor({ state: 'visible' })
  assert.match(await flip.innerText(), /Burnt Cheese Cookie FLIP/)
  assert.match(await flip.innerText(), /Draw up to 1 card from your deck/i)
  await flip.getByRole('button', { name: '發動 FLIP', exact: true }).click()

  const draw = page.locator('.draw-up-to-modal:visible').first()
  await draw.waitFor({ state: 'visible' })
  assert.match(await draw.innerText(), /最多 1 張牌/)
  await draw.locator('.draw-up-to-option').first().click()
  await draw.locator('.draw-up-to-actions button:not(:disabled)').click()
  await draw.waitFor({ state: 'hidden' })
  await page.waitForTimeout(250)
  assert.equal(await page.locator('[role="alertdialog"]:visible').count(), 0)
}

const runPositive = async (browser, viewport) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(7000)
  const errors = recordBrowserErrors(page)
  const route = 'card:BS9-030'
  const result = { route, viewport, status: 'FAIL', actions: [] }
  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=BS9-030`,
      { waitUntil: 'domcontentloaded' },
    )
    await waitForGame(page)
    const { dialog, entry } = await openExtraEntry(page, true)
    result.actions.push('inspect-extra-entry')
    await payEntryCost(page, entry)
    result.actions.push('pay-extra-entry-cost')
    await resolveOnPlay(page)
    result.actions.push('resolve-on-play-break')
    const panel = await declareAttack(page)
    result.actions.push('declare-attack')
    await resolveDetachedFlip(page, panel)
    result.actions.push('resolve-detached-flip-draw-zero')
    const trace = await readTrace(page)
    assertTraceKind(trace, 'play-extra-deck-cookie', '正向路徑應留下 EXTRA 登場宣告')
    assertTraceKind(trace, 'resolve-optional-cost-attack', '正向路徑應留下 EXTRA 代價支付')
    assertTraceKind(trace, 'begin-activate-skill', '正向路徑應留下 On Play 啟動')
    assertTraceKind(trace, 'resolve-ability-effect', '正向路徑應留下 On Play 結算')
    assertTraceKind(trace, 'declare-attack', '正向路徑應留下真實攻擊宣告')
    assertTraceKind(trace, 'resolve-attack-effect', '正向路徑應留下攻擊後效果結算')
    assertTraceKind(trace, 'resolve-optional-cost-attack', '正向路徑應留下攻擊後代價支付')
    assertTraceKind(trace, 'resolve-flip', '正向路徑應留下 detached FLIP 結算')
    assertTraceKind(trace, 'resolve-draw-up-to', '正向路徑應留下 FLIP 抽牌決策')
    assert.equal(await page.getByLabel('玩家 EXTRA Deck 0 張').count(), 1)
    assert.equal(await page.locator('[role="alertdialog"]:visible').count(), 0)
    assert.deepEqual(errors, [], `BS9-030 positive browser errors: ${errors.join('; ')}`)
    result.status = 'PASS'
    result.trace = trace
    result.screenshot = resolve(
      outputDirectory,
      `bs9-030-positive-${viewport.width}x${viewport.height}.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true })
    // Keep the dialog reference live until after the screenshot so a failed
    // run reports a useful locator in Playwright's call log.
    void dialog
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 7000)
    result.trace = await readTrace(page).catch(() => [])
    result.screenshot = resolve(
      outputDirectory,
      `bs9-030-positive-${viewport.width}x${viewport.height}-failed.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true }).catch(() => {})
  } finally {
    await page.close()
  }
  return result
}

const runNegative = async (browser, viewport) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(7000)
  const errors = recordBrowserErrors(page)
  const route = 'card-negative:BS9-030'
  const result = { route, viewport, status: 'FAIL', actions: [] }
  try {
    await page.goto(`${baseUrl}/?test-state=${encodeURIComponent(route)}`, {
      waitUntil: 'domcontentloaded',
    })
    await waitForGame(page)
    const { entry } = await openExtraEntry(page, false)
    result.actions.push('inspect-extra-entry')
    assert.equal(
      await entry.getByRole('button', { name: '從 EXTRA 登場' }).count(),
      0,
      '負向路徑不應顯示 EXTRA 登場按鈕',
    )
    assert.match(await entry.innerText(), /目前無法登場/)
    assert.equal(await page.locator('[data-card-instance-id="bs9-030-demo-extra"]').count(), 0)
    const trace = await readTrace(page)
    assert.equal(
      trace.some((item) => item.commandKind === 'play-extra-deck-cookie'),
      false,
      '負向路徑不應送出 EXTRA 登場命令',
    )
    assert.deepEqual(errors, [], `BS9-030 negative browser errors: ${errors.join('; ')}`)
    result.status = 'PASS'
    result.trace = trace
    result.screenshot = resolve(
      outputDirectory,
      `bs9-030-negative-${viewport.width}x${viewport.height}.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true })
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 7000)
    result.trace = await readTrace(page).catch(() => [])
    result.screenshot = resolve(
      outputDirectory,
      `bs9-030-negative-${viewport.width}x${viewport.height}-failed.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true }).catch(() => {})
  } finally {
    await page.close()
  }
  return result
}

const preview = spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)
const waitForPreview = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (preview.exitCode !== null) {
      throw new Error(`Vite preview exited before serving on ${baseUrl}`)
    }
    try {
      if ((await fetch(baseUrl)).ok) return
    } catch {
      // Preview is still starting.
    }
    await wait(100)
  }
  throw new Error(`Vite preview did not start on ${baseUrl}`)
}

const results = []
let browser
try {
  await waitForPreview()
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })
  for (const viewport of [
    { width: 1907, height: 863 },
    { width: 1164, height: 777 },
  ]) {
    results.push(await runPositive(browser, viewport))
    results.push(await runNegative(browser, viewport))
  }
} finally {
  await browser?.close()
  if (preview.exitCode === null) preview.kill()
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  scope: 'BS9-030 real EXTRA entry, On Play, attack Then detached FLIP, and readiness A/B.',
  total: results.length,
  passed: results.filter((result) => result.status === 'PASS').length,
  failed: results.filter((result) => result.status !== 'PASS'),
  results,
}
writeFileSync(
  resolve(outputDirectory, 'bs9-030-browser.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
process.exitCode = report.failed.length > 0 ? 1 : 0
