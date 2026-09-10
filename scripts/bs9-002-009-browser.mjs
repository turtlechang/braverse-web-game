import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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

const port = Number(process.env.BRAVERSE_BS9_TEST_PORT ?? 4184)
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

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const outputDirectory = resolve(root, 'test-results')
mkdirSync(outputDirectory, { recursive: true })

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
  throw new Error(`Vite preview did not start at ${baseUrl}`)
}

const cases = [
  {
    card: 'BS9-002',
    title: 'Princess Cookie',
    mode: 'activate',
    positiveRoute: 'bs9-card:BS9-002',
    negativeRoute: 'bs9-card-negative:BS9-002@1',
  },
  {
    card: 'BS9-003',
    title: 'Strawberry Cookie',
    mode: 'on-play',
    positiveRoute: 'bs9-card:BS9-003',
    negativeRoute: 'bs9-card-negative:BS9-003@1',
  },
  {
    card: 'BS9-004',
    title: 'Linzer Cookie',
    mode: 'vanilla',
    positiveRoute: 'bs9-card:BS9-004',
    negativeRoute: 'bs9-card-negative:BS9-004@1',
  },
  {
    card: 'BS9-005',
    title: 'Macaron Cookie',
    mode: 'flip',
    positiveRoute: 'bs9-card:BS9-005',
    negativeRoute: 'bs9-card-negative:BS9-005@1',
  },
  {
    card: 'BS9-006',
    title: 'Melted Choco Cookie',
    mode: 'on-play',
    positiveRoute: 'bs9-card:BS9-006',
    negativeRoute: 'bs9-card-negative:BS9-006@1',
  },
  {
    card: 'BS9-007',
    title: 'Cherry Blossom Cookie',
    mode: 'flip',
    positiveRoute: 'bs9-card:BS9-007',
    negativeRoute: 'bs9-card-negative:BS9-007@1',
  },
  {
    card: 'BS9-008',
    title: 'Blueberry Cookie',
    mode: 'vanilla',
    positiveRoute: 'bs9-card:BS9-008',
    negativeRoute: 'bs9-card-negative:BS9-008',
  },
  {
    card: 'BS9-009',
    title: 'Birthday Cake Cookie',
    mode: 'on-play',
    positiveRoute: 'bs9-card:BS9-009',
    negativeRoute: 'bs9-card-negative:BS9-009',
  },
]

const recordBrowserErrors = (page) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const location = message.location()
    const text = message.text()
    if (location.url?.endsWith('/favicon.ico') && text.includes('404')) return
    if (
      location.url?.includes('cookierunbraverse.com/data/en_storage/') &&
      /ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(text)
    ) return
    errors.push(`console: ${text} (${location.url || 'unknown URL'})`)
  })
  return errors
}

const readTrace = async (page) =>
  page.evaluate(() => window.__braverseContractTrace ?? [])

const readSnapshot = async (page) =>
  page.evaluate(() => ({
    body: document.body.innerText,
    handTitles: [...document.querySelectorAll('.bottom-hand .hand-card')]
      .map((node) => node.getAttribute('title'))
      .filter(Boolean),
    battleCards: [...document.querySelectorAll('.bottom-field .combat-card-wrap')]
      .map((node) => ({
        id: node.getAttribute('data-card-instance-id'),
        title: node.querySelector('.card-face')?.getAttribute('title'),
        text: node.innerText,
      })),
    trace: window.__braverseContractTrace ?? [],
  }))

const waitForGame = async (page) => {
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await page.waitForTimeout(260)
}

const visibleEffectPanel = (page) => page.locator('.effect-panel:visible').first()

const sourceBattleCard = (page, title) =>
  page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator(`.card-face[title="${title}"]`),
  }).first()

const sourceHandCard = (page, title) =>
  page.locator('.bottom-hand .hand-card-wrap').filter({
    has: page.locator(`.hand-card[title="${title}"]`),
  }).first()

const assertTraceKind = (trace, kind, message) => {
  assert.ok(trace.some((entry) => entry.commandKind === kind), message)
}

const assertNoTraceKind = (trace, kind, message) => {
  assert.equal(trace.some((entry) => entry.commandKind === kind), false, message)
}

const runActivate = async (page, testCase, negative, result) => {
  const source = sourceBattleCard(page, testCase.title)
  await source.waitFor({ state: 'visible' })
  const skill = source.locator('.skill-action')
  assert.equal(await skill.count(), 1, 'BS9-002 應有啟動技能入口')
  if (negative) {
    assert.equal(await skill.isEnabled(), false, '上一回合條件不成立時技能入口應停用')
    const body = await page.locator('body').innerText()
    assert.match(body, /對手上一回合.*尚未達到/, '負向路徑應顯示上一回合昏厥條件原因')
    assertNoTraceKind(await readTrace(page), 'begin-activate-skill', '負向路徑不應送出技能啟動命令')
    result.actions.push('blocked-activate')
    return
  }

  assert.equal(await skill.isEnabled(), true, '上一回合條件成立時技能入口應可用')
  await skill.click()
  result.actions.push('begin-activate')
  const panel = visibleEffectPanel(page)
  await panel.waitFor({ state: 'visible' })
  assert.match(await panel.innerText(), /Princess Cookie|LV\.1 Cookie fainted|上一回合/)
  const targets = panel.locator('.effect-candidates-target button')
  assert.equal(await targets.count(), 1, 'BS9-002 應只提供來源餅乾作為目標')
  await targets.first().click()
  result.actions.push('select-source-target')
  const confirm = panel.locator('.effect-panel-primary-action')
  assert.equal(await confirm.isEnabled(), true)
  await confirm.click()
  result.actions.push('resolve-activate')
  await panel.waitFor({ state: 'hidden' })
  await page.waitForTimeout(220)
  const snapshot = await readSnapshot(page)
  assertTraceKind(snapshot.trace, 'begin-activate-skill', '正向路徑應留下 begin-activate-skill')
  assertTraceKind(snapshot.trace, 'resolve-ability-effect', '正向路徑應留下 resolve-ability-effect')
  assert.match(snapshot.body, /Princess Cookie 攻擊傷害 \+1/, '正向路徑應顯示 +1 攻擊傷害結果')
}

const runOnPlay = async (page, testCase, negative, result) => {
  const hand = sourceHandCard(page, testCase.title)
  await hand.waitFor({ state: 'visible' })
  await hand.locator('.hand-card').click()
  result.actions.push('select-hand-cookie')
  const deploy = hand.locator('.hand-card-action').filter({ hasText: '登場' })
  assert.equal(await deploy.count(), 1, `${testCase.card} 應提供登場入口`)
  await deploy.click()
  result.actions.push('deploy-cookie')
  await page.waitForTimeout(320)

  const panel = visibleEffectPanel(page)
  if (negative && (testCase.card === 'BS9-006' || testCase.card === 'BS9-009')) {
    assert.equal(await panel.count(), 0, `${testCase.card} 負向條件不成立時不應開啟效果面板`)
    const snapshot = await readSnapshot(page)
    assert.match(snapshot.body, /效果尚未滿足發動條件/)
    assertTraceKind(snapshot.trace, 'skip-on-play', '條件不成立時應留下跳過登場效果紀錄')
    assertNoTraceKind(snapshot.trace, 'resolve-ability-effect', '條件不成立時不應結算效果')
    result.actions.push('blocked-on-play')
    return
  }

  await panel.waitFor({ state: 'visible' })
  if (negative) {
    assert.equal(testCase.card, 'BS9-003')
    await panel.locator('.skip-effect').click()
    result.actions.push('skip-on-play')
    await panel.waitFor({ state: 'hidden' })
    const snapshot = await readSnapshot(page)
    assert.match(snapshot.body, /OnPlay 技能未發動/)
    assertTraceKind(snapshot.trace, 'skip-on-play', '負向路徑應留下跳過登場效果紀錄')
    assertNoTraceKind(snapshot.trace, 'resolve-ability-effect', '跳過登場效果不應結算效果')
    return
  }

  if (testCase.card === 'BS9-003') {
    assert.match(await panel.innerText(), /Select up to 1.*\+1 attack damage/)
    const targets = panel.locator('.effect-candidates-target button')
    assert.equal(await targets.count(), 2, 'BS9-003 應提供兩張我方餅乾目標')
    await targets.first().click()
    result.actions.push('select-own-target')
    await panel.locator('.effect-panel-primary-action').click()
    result.actions.push('resolve-on-play')
    await panel.waitFor({ state: 'hidden' })
    const snapshot = await readSnapshot(page)
    assertTraceKind(snapshot.trace, 'resolve-ability-effect', 'BS9-003 應留下效果結算')
    assert.match(snapshot.body, /Pomegranate Cookie 攻擊傷害 \+1/)
    return
  }

  if (testCase.card === 'BS9-006') {
    assert.match(await panel.innerText(), /受到的傷害.*-3/)
    const targets = panel.locator('.effect-candidates-target button')
    assert.equal(await targets.count(), 1, 'BS9-006 應只提供來源餅乾目標')
    assert.match(await targets.first().innerText(), /Melted Choco Cookie/)
    await targets.first().click()
    result.actions.push('select-source-target')
    await panel.locator('.effect-panel-primary-action').click()
    result.actions.push('resolve-on-play')
    await panel.waitFor({ state: 'hidden' })
    const snapshot = await readSnapshot(page)
    assertTraceKind(snapshot.trace, 'resolve-ability-effect', 'BS9-006 應留下效果結算')
    assert.match(snapshot.body, /Melted Choco Cookie.*-3/)
    return
  }

  assert.equal(testCase.card, 'BS9-009')
  assert.match(await panel.innerText(), /最多抽 1 張牌/)
  await panel.locator('.effect-panel-primary-action').click()
  result.actions.push('open-draw-up-to')
  const draw = page.locator('.draw-up-to-modal:visible').first()
  await draw.waitFor({ state: 'visible' })
  assert.match(await draw.innerText(), /最多.*1 張牌/)
  const drawOptions = draw.locator('.draw-up-to-option')
  assert.equal(await drawOptions.count(), 2)
  await drawOptions.nth(1).click()
  result.actions.push('select-draw-one')
  await draw.locator('.draw-up-to-actions button').click()
  result.actions.push('resolve-draw-up-to')
  await draw.waitFor({ state: 'hidden' })
  const snapshot = await readSnapshot(page)
  assertTraceKind(snapshot.trace, 'resolve-draw-up-to', 'BS9-009 應留下抽牌結算')
  assert.match(snapshot.body, /已從牌庫抽取 1 張牌/)
}

const runVanilla = async (page, testCase, negative, result) => {
  const hand = sourceHandCard(page, testCase.title)
  await hand.waitFor({ state: 'visible' })
  await hand.locator('.hand-card').click()
  const deploy = hand.locator('.hand-card-action').filter({ hasText: '登場' })
  assert.equal(await deploy.count(), 1, `${testCase.card} 應提供登場入口`)
  await deploy.click()
  result.actions.push('deploy-cookie')
  await page.waitForTimeout(320)
  assert.equal(await visibleEffectPanel(page).count(), 0, '無技能餅乾不應開啟效果面板')
  const snapshot = await readSnapshot(page)
  assert.ok(
    snapshot.battleCards.some((entry) => entry.title === testCase.title),
    `${testCase.card} 登場後應在我方戰鬥區保留實卡名稱`,
  )
  assertTraceKind(snapshot.trace, 'deploy-cookie', 'vanilla 路徑應留下 deploy-cookie')
  result.negative = negative
}

const runFlip = async (page, testCase, negative, result) => {
  const modal = page.locator('.flip-response-modal:visible').first()
  await modal.waitFor({ state: 'visible' })
  assert.equal(await modal.locator('h2').innerText(), `${testCase.title} FLIP`)
  if (testCase.card === 'BS9-005') {
    assert.match(await modal.innerText(), /Discard 1 card.*gains \+1 HP/)
  } else {
    assert.match(await modal.innerText(), /Draw up to 1 card from your deck/)
  }

  if (negative) {
    await modal.getByRole('button', { name: '不發動', exact: true }).click()
    result.actions.push('skip-flip')
    await modal.waitFor({ state: 'hidden' })
    await page.waitForTimeout(240)
    const snapshot = await readSnapshot(page)
    assert.match(snapshot.body, /未發動 FLIP/)
    const flipEntry = snapshot.trace.find((entry) => entry.commandKind === 'resolve-flip')
    assert.ok(flipEntry, '負向 FLIP 路徑應留下 resolve-flip')
    assert.match(`${flipEntry.summary ?? ''} ${flipEntry.steps?.join(' ') ?? ''}`, /未發動|略過|未執行/)
    return
  }

  if (testCase.card === 'BS9-005') {
    const handChoices = modal.locator('.flip-card-page button')
    assert.ok((await handChoices.count()) > 0, 'BS9-005 應提供可棄置的手牌')
    await handChoices.first().click()
    result.actions.push('select-discard-hand')
  }
  await modal.getByRole('button', { name: '發動 FLIP', exact: true }).click()
  result.actions.push('activate-flip')
  await modal.waitFor({ state: 'hidden' })
  await page.waitForTimeout(280)

  if (testCase.card === 'BS9-005') {
    const snapshot = await readSnapshot(page)
    const defender = snapshot.battleCards.find((entry) => entry.title === 'Lassi Guard Kulfi')
    assert.match(defender?.text ?? '', /2\/5/, 'BS9-005 應使附著餅乾獲得 +1 HP')
    assert.match(snapshot.body, /已發動Macaron Cookie/)
    assertTraceKind(snapshot.trace, 'resolve-flip', 'BS9-005 應留下 resolve-flip')
    return
  }

  const draw = page.locator('.draw-up-to-modal:visible').first()
  await draw.waitFor({ state: 'visible' })
  const options = draw.locator('.draw-up-to-option')
  assert.equal(await options.count(), 2)
  await options.nth(1).click()
  result.actions.push('select-draw-one')
  await draw.locator('.draw-up-to-actions button').click()
  result.actions.push('resolve-draw-up-to')
  await draw.waitFor({ state: 'hidden' })
  const snapshot = await readSnapshot(page)
  assertTraceKind(snapshot.trace, 'resolve-flip', 'BS9-007 應留下 resolve-flip')
  assertTraceKind(snapshot.trace, 'resolve-draw-up-to', 'BS9-007 應留下抽牌結算')
  assert.match(snapshot.body, /已從牌庫抽取 1 張牌/)
}

const runScenario = async (browser, viewport, testCase, negative) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(7_000)
  const errors = recordBrowserErrors(page)
  const route = negative ? testCase.negativeRoute : testCase.positiveRoute
  const result = {
    card: testCase.card,
    mode: testCase.mode,
    viewport,
    negative,
    route,
    status: 'FAIL',
    actions: [],
  }

  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${testCase.card}`,
      { waitUntil: 'domcontentloaded' },
    )
    await waitForGame(page)
    if (testCase.mode === 'activate') {
      await runActivate(page, testCase, negative, result)
    } else if (testCase.mode === 'on-play') {
      await runOnPlay(page, testCase, negative, result)
    } else if (testCase.mode === 'flip') {
      await runFlip(page, testCase, negative, result)
    } else {
      await runVanilla(page, testCase, negative, result)
    }
    result.snapshot = await readSnapshot(page)
    result.trace = result.snapshot.trace
    result.errors = errors
    assert.equal(errors.length, 0, `browser errors: ${errors.join('; ')}`)
    const screenshotPath = resolve(
      outputDirectory,
      `bs9-${testCase.card}-${negative ? 'negative' : 'positive'}-${viewport.width}x${viewport.height}.png`,
    )
    await page.screenshot({ path: screenshotPath, fullPage: true })
    result.screenshot = screenshotPath
    result.status = 'PASS'
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 6000)
    result.trace = await readTrace(page).catch(() => [])
    await page.screenshot({
      path: resolve(
        outputDirectory,
        `bs9-${testCase.card}-${negative ? 'negative' : 'positive'}-${viewport.width}x${viewport.height}.png`,
      ),
      fullPage: true,
    }).catch(() => {})
  } finally {
    await page.close()
  }
  return result
}

let browser
const results = []
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
    for (const testCase of cases) {
      for (const negative of [false, true]) {
        const result = await runScenario(browser, viewport, testCase, negative)
        results.push(result)
        console.log(
          `${result.status} ${testCase.card} ${negative ? 'negative' : 'positive'} ${viewport.width}x${viewport.height}`,
          result.error ?? '',
        )
      }
    }
  }
} finally {
  await browser?.close()
  if (preview.exitCode === null) preview.kill()
}

const report = {
  baseUrl,
  total: results.length,
  passed: results.filter((result) => result.status === 'PASS').length,
  failed: results.filter((result) => result.status !== 'PASS'),
  results,
}
writeFileSync(
  resolve(outputDirectory, 'bs9-002-009-browser.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
process.exitCode = report.failed.length > 0 ? 1 : 0
