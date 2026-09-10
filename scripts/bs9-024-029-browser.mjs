import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
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

const port = Number(process.env.BRAVERSE_BS9_TEST_PORT ?? 4186)
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
const outputDirectory = resolve(root, 'test-results')
mkdirSync(outputDirectory, { recursive: true })

const preview = spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)
const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))

const cases = [
  {
    card: 'BS9-024',
    title: 'Golden Cheese Cookie',
    mode: 'skill',
    positiveRoute: 'card-skill:BS9-024',
    negativeRoute: 'card-skill-negative:BS9-024',
  },
  {
    card: 'BS9-024',
    title: 'Golden Cheese Cookie',
    mode: 'attack',
    positiveRoute: 'card-attack:BS9-024',
    negativeRoute: 'card-attack-negative:BS9-024',
  },
  {
    card: 'BS9-025',
    title: 'Mala Sauce Cookie',
    mode: 'review',
    reviewOnly: true,
    positiveRoute: 'bs9-card:BS9-025',
    negativeRoute: 'bs9-card-negative:BS9-025',
  },
  {
    card: 'BS9-026',
    title: 'Burnt Cheese Cookie',
    mode: 'flip-draw',
    positiveRoute: 'bs9-card:BS9-026',
    negativeRoute: 'bs9-card-negative:BS9-026',
  },
  {
    card: 'BS9-027',
    title: 'Vampire Cookie',
    mode: 'skill',
    positiveRoute: 'card-skill:BS9-027',
    negativeRoute: 'card-skill-negative:BS9-027',
  },
  {
    card: 'BS9-028',
    title: 'Butter Squid Cookie',
    mode: 'vanilla',
    positiveRoute: 'bs9-card:BS9-028',
    negativeRoute: 'bs9-card-negative:BS9-028',
  },
  {
    card: 'BS9-029',
    title: 'Caramel Choux Cookie',
    mode: 'flip-pair',
    positiveRoute: 'bs9-card:BS9-029',
    negativeRoute: 'bs9-card-negative:BS9-029',
  },
]

const recordBrowserErrors = (page) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const location = message.location()
    const messageText = message.text()
    if (location.url?.endsWith('/favicon.ico') && messageText.includes('404')) return
    if (
      location.url?.includes('cookierunbraverse.com/data/en_storage/') &&
      /ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(messageText)
    ) return
    errors.push(`console: ${messageText} (${location.url || 'unknown URL'})`)
  })
  return errors
}

const readTrace = (page) => page.evaluate(() => window.__braverseContractTrace ?? [])
const waitForGame = async (page) => {
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await page.waitForTimeout(300)
}
const visiblePanel = (page) => page.locator('.effect-panel[role="alertdialog"]:visible').first()
const sourceBattle = (page, card) =>
  page.locator(`.bottom-field .combat-card-wrap[data-card-instance-id="bs9-${card.toLowerCase()}-source"]`).first()
const sourceHand = (page, title) =>
  page.locator(`.bottom-hand .hand-card-wrap:has(.hand-card[title="${title}"])`).first()
const assertTraceKind = (trace, kind, message) => {
  assert.ok(trace.some((entry) => entry.commandKind === kind), message)
}
const assertNoTraceKind = (trace, kind, message) => {
  assert.equal(trace.some((entry) => entry.commandKind === kind), false, message)
}

const readSnapshot = async (page) => page.evaluate(() => {
  const cardSnapshot = (node) => ({
    id: node.getAttribute('data-card-instance-id'),
    title: node.querySelector('.card-face')?.getAttribute('title'),
    hp: node.querySelector('.badge-hp')?.textContent?.trim() ?? '',
    text: node.textContent ?? '',
  })
  return {
    body: document.body.innerText,
    battleCards: [...document.querySelectorAll('.battle-row .combat-card-wrap')].map(cardSnapshot),
    trace: window.__braverseContractTrace ?? [],
  }
})

const runSkill = async (page, testCase, negative, result) => {
  const source = sourceBattle(page, testCase.card)
  await source.waitFor({ state: 'visible' })
  const skill = source.locator('.skill-action')
  assert.equal(await skill.count(), 1, `${testCase.card} 應有啟動技能入口`)
  if (negative) {
    assert.equal(await skill.isEnabled(), false, '條件不成立時技能入口應停用')
    const reason = source.locator('.skill-unavailable-reason')
    assert.ok((await reason.count()) > 0, '負向路徑應顯示規則層封鎖原因')
    assert.ok((await reason.first().innerText()).trim().length > 0)
    assertNoTraceKind(await readTrace(page), 'begin-activate-skill', '負向路徑不應送出技能啟動命令')
    result.actions.push('blocked-skill')
    return
  }

  assert.equal(await skill.isEnabled(), true, '正向路徑技能入口應可用')
  await skill.click()
  result.actions.push('begin-activate-skill')
  const panel = visiblePanel(page)
  await panel.waitFor({ state: 'visible' })
  const targets = panel.locator('.effect-candidates-target button:not(:disabled)')
  // sourceOnly effects (including Golden Cheese's gain HP) resolve against
  // the source implicitly and therefore do not render a target selector.
  if (await targets.count()) await targets.first().click()
  await panel.locator('.effect-panel-primary-action').click()
  result.actions.push('resolve-skill')
  await panel.waitFor({ state: 'hidden' })
  await page.waitForTimeout(220)
  const snapshot = await readSnapshot(page)
  assertTraceKind(snapshot.trace, 'begin-activate-skill', '正向路徑應留下 begin-activate-skill')
  assertTraceKind(snapshot.trace, 'resolve-ability-effect', '正向路徑應留下 resolve-ability-effect')
  const sourceSnapshot = snapshot.battleCards.find((entry) => entry.id === `bs9-${testCase.card.toLowerCase()}-source`)
  assert.match(sourceSnapshot?.hp ?? '', /5\//, `${testCase.card} 正向技能應改變來源 HP`)
}

const runVampireSkill = async (page, negative, result) => {
  const source = sourceBattle(page, 'BS9-027')
  await source.waitFor({ state: 'visible' })
  const skill = source.locator('.skill-action')
  assert.equal(await skill.count(), 1, 'BS9-027 應有啟動技能入口')
  assert.equal(await skill.isEnabled(), true)
  await skill.click()
  result.actions.push('begin-activate-skill')

  const firstPanel = visiblePanel(page)
  await firstPanel.waitFor({ state: 'visible' })
  const handTargets = firstPanel.locator('.effect-candidates-target button:not(:disabled)')
  if (negative) {
    assert.equal(await handTargets.count(), 0, '負向路徑應移除可選手牌，保留零張選項')
  } else {
    assert.ok((await handTargets.count()) >= 1, '正向路徑應提供手牌目標')
    await handTargets.first().click()
    result.actions.push('select-hand-to-hp')
  }
  await firstPanel.locator('.effect-panel-primary-action').click()
  await page.waitForTimeout(160)

  const secondPanel = visiblePanel(page)
  await secondPanel.waitFor({ state: 'visible' })
  const sourceTarget = secondPanel.locator('.effect-candidates-target button:not(:disabled)')
  assert.equal(await sourceTarget.count(), 1, 'BS9-027 第二段應只提供來源餅乾')
  assert.match(await sourceTarget.first().innerText(), /Vampire Cookie/)
  await sourceTarget.first().click()
  await secondPanel.locator('.effect-panel-primary-action').click()
  result.actions.push('resolve-damage-step')
  await secondPanel.waitFor({ state: 'hidden' })
  await page.waitForTimeout(220)

  const snapshot = await readSnapshot(page)
  assertTraceKind(snapshot.trace, 'begin-activate-skill', 'BS9-027 應留下技能啟動紀錄')
  assert.ok(
    snapshot.trace.filter((entry) => entry.commandKind === 'resolve-ability-effect').length >= 2,
    'BS9-027 應留下手牌與傷害兩段效果結算',
  )
  const sourceSnapshot = snapshot.battleCards.find((entry) => entry.id === 'bs9-bs9-027-source')
  assert.match(sourceSnapshot?.hp ?? '', negative ? /4\// : /5\//, 'BS9-027 最後 HP 應反映先加 HP 再受傷或零張後受傷')
}

const runAttack = async (page, negative, result) => {
  const source = sourceBattle(page, 'BS9-024')
  await source.waitFor({ state: 'visible' })
  if (negative) {
    assert.equal(await source.locator('.card-face.is-attackable').count(), 0, '能量不足時不得宣告攻擊')
    const shortfall = source.locator('.energy-shortfall-hint')
    assert.ok((await shortfall.count()) > 0, '能量不足負向路徑應顯示原因')
    assert.match(await shortfall.first().innerText(), /能量不足/)
    assertNoTraceKind(await readTrace(page), 'declare-attack', '負向路徑不應宣告攻擊')
    result.actions.push('blocked-attack')
    return
  }

  const panel = visiblePanel(page)
  await panel.waitFor({ state: 'visible' })
  assert.match(await panel.innerText(), /攻擊後續效果|Golden Cheese Cookie|HP 回手/)
  await panel.getByRole('button', { name: '支付', exact: true }).click()
  result.actions.push('pay-optional-attack')
  await page.waitForTimeout(100)

  const hpStep = visiblePanel(page).locator('.optional-cost-col').filter({ hasText: 'HP 回手代價' })
  await hpStep.waitFor({ state: 'visible' })
  const hpCard = hpStep.locator('.modal-card-options button:not(:disabled)').first()
  assert.equal(await hpCard.count(), 1, 'BS9-024 應提供來源最上方 HP 卡回手代價')
  await hpCard.click()
  await visiblePanel(page).getByRole('button', { name: '下一步', exact: true }).click()
  result.actions.push('select-hp-to-hand')
  await page.waitForTimeout(100)

  const targetStep = visiblePanel(page).locator('.optional-cost-col').filter({ hasText: '目標' })
  await targetStep.waitFor({ state: 'visible' })
  const target = targetStep.locator('.modal-card-options button:not(:disabled)').first()
  assert.equal(await target.count(), 1, 'BS9-024 攻擊後傷害應鎖定當次攻擊目標')
  await target.click()
  await visiblePanel(page).getByRole('button', { name: '確認', exact: true }).click()
  result.actions.push('resolve-optional-attack')
  await visiblePanel(page).waitFor({ state: 'hidden' })
  await page.waitForTimeout(300)
  const snapshot = await readSnapshot(page)
  assertTraceKind(snapshot.trace, 'resolve-attack-effect', 'BS9-024 應留下攻擊後效果紀錄')
  assertTraceKind(snapshot.trace, 'resolve-optional-cost-attack', 'BS9-024 應留下可選代價支付紀錄')
  const sourceSnapshot = snapshot.battleCards.find((entry) => entry.id === 'bs9-bs9-024-source')
  const targetSnapshot = snapshot.battleCards.find((entry) => entry.id === 'bs9-opponent-red-lv1')
  assert.match(sourceSnapshot?.hp ?? '', /4\//, '支付 HP 回手後來源應少一張 HP')
  assert.match(targetSnapshot?.hp ?? '', /3\//, '攻擊後效果應對當次目標造成 1 傷害')
}

const runFlip = async (page, testCase, negative, result) => {
  const modal = page.locator('.flip-response-modal:visible').first()
  await modal.waitFor({ state: 'visible' })
  assert.equal(await modal.locator('h2').innerText(), `${testCase.title} FLIP`)

  if (negative) {
    await modal.getByRole('button', { name: '不發動', exact: true }).click()
    result.actions.push('skip-flip')
    await modal.waitFor({ state: 'hidden' })
    await page.waitForTimeout(250)
    const snapshot = await readSnapshot(page)
    assertTraceKind(snapshot.trace, 'resolve-flip', `${testCase.card} 負向路徑應留下 resolve-flip`)
    const flipEntry = snapshot.trace.find((entry) => entry.commandKind === 'resolve-flip')
    assert.match(`${flipEntry?.summary ?? ''} ${flipEntry?.steps?.join(' ') ?? ''}`, /未發動|略過|未執行/)
    result.actions.push('flip-skipped')
    return
  }

  if (testCase.mode === 'flip-draw') {
    await modal.getByRole('button', { name: '發動 FLIP', exact: true }).click()
    result.actions.push('activate-flip')
    const draw = page.locator('.draw-up-to-modal:visible').first()
    await draw.waitFor({ state: 'visible' })
    assert.match(await draw.innerText(), /最多.*1 張牌/)
    const options = draw.locator('.draw-up-to-option')
    assert.equal(await options.count(), 2)
    await options.nth(1).click()
    await draw.locator('.draw-up-to-actions button:not(:disabled)').click()
    result.actions.push('draw-one')
    await draw.waitFor({ state: 'hidden' })
    await page.waitForTimeout(220)
    const snapshot = await readSnapshot(page)
    assertTraceKind(snapshot.trace, 'resolve-flip', 'BS9-026 應留下 resolve-flip')
    assertTraceKind(snapshot.trace, 'resolve-draw-up-to', 'BS9-026 應留下抽牌結算')
    assert.match(snapshot.body, /已從牌庫抽取 1 張牌/)
    return
  }

  assert.equal(testCase.mode, 'flip-pair')
  assert.match(await modal.innerText(), /供牌|接收餅乾/)
  const donorGroup = modal.locator('[aria-label="FLIP 效果供牌目標"]')
  const receiverGroup = modal.locator('[aria-label="FLIP 效果接收目標"]')
  assert.equal(await donorGroup.count(), 1)
  assert.equal(await receiverGroup.count(), 1)
  const donor = donorGroup.getByRole('button', { name: /Pomegranate Cookie/ }).first()
  const receiver = receiverGroup.getByRole('button', { name: /Lassi Guard Kulfi/ }).first()
  await donor.click()
  assert.equal(await modal.getByRole('button', { name: '發動 FLIP', exact: true }).isEnabled(), false, '只選供牌時不得送出半套目標')
  await receiver.click()
  assert.equal(await modal.getByRole('button', { name: '發動 FLIP', exact: true }).isEnabled(), true)
  await modal.getByRole('button', { name: '發動 FLIP', exact: true }).click()
  result.actions.push('activate-paired-flip')
  await modal.waitFor({ state: 'hidden' })
  await page.waitForTimeout(280)
  const snapshot = await readSnapshot(page)
  assertTraceKind(snapshot.trace, 'resolve-flip', 'BS9-029 應留下 resolve-flip')
  const donorSnapshot = snapshot.battleCards.find((entry) => entry.id === 'bs9-own-companion')
  const receiverSnapshot = snapshot.battleCards.find((entry) => entry.id === 'bs9-flip-defender')
  assert.match(donorSnapshot?.hp ?? '', /3\//, 'BS9-029 供牌應移除一張 HP')
  assert.match(receiverSnapshot?.hp ?? '', /2\//, 'BS9-029 接收牌應增加一張 HP')
}

const runVanilla = async (page, testCase, result) => {
  const hand = sourceHand(page, testCase.title)
  await hand.waitFor({ state: 'visible' })
  await hand.locator('.hand-card').click()
  const deploy = hand.locator('.hand-card-action').filter({ hasText: '登場' })
  assert.equal(await deploy.count(), 1, `${testCase.card} 應提供登場入口`)
  await deploy.click()
  result.actions.push('deploy-cookie')
  await page.waitForTimeout(300)
  assert.equal(await visiblePanel(page).count(), 0, '無技能餅乾不應開啟效果面板')
  const snapshot = await readSnapshot(page)
  assert.ok(snapshot.battleCards.some((entry) => entry.title === testCase.title), '登場後應保留實卡名稱')
  assertTraceKind(snapshot.trace, 'deploy-cookie', 'vanilla 路徑應留下 deploy-cookie')
}

const runReview = async (page, testCase, result) => {
  const hand = sourceHand(page, testCase.title)
  await hand.waitFor({ state: 'visible' })
  await hand.locator('.hand-card').click()
  const detailButton = hand.locator('.hand-card-detail')
  await detailButton.waitFor({ state: 'visible' })
  await detailButton.click()
  const detail = page.locator('.card-detail-modal:visible').first()
  await detail.waitFor({ state: 'visible' })
  assert.match(await detail.innerText(), /Mala Sauce Cookie/)
  assert.match(await detail.innerText(), /Tough Rook/)
  assert.equal(await page.locator('.flip-response-modal:visible').count(), 0)
  result.reviewOnly = true
  result.actions.push('inspect-card-detail')
  await detail.locator('.close-modal').click()
  await page.waitForTimeout(100)
  assert.equal(await page.locator('.card-detail-modal:visible').count(), 0)
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
    ...(testCase.reviewOnly ? { reviewOnly: true } : {}),
  }
  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${testCase.card}`,
      { waitUntil: 'domcontentloaded' },
    )
    await waitForGame(page)
    if (testCase.mode !== 'attack' && testCase.mode !== 'flip-draw' && testCase.mode !== 'flip-pair') {
      assert.ok(await page.locator(`.card-face[title="${testCase.title}"]`).count(), `${testCase.title} 實卡應出現在 fixture`)
    }
    if (testCase.mode === 'skill') {
      if (testCase.card === 'BS9-027') await runVampireSkill(page, negative, result)
      else await runSkill(page, testCase, negative, result)
    } else if (testCase.mode === 'attack') {
      await runAttack(page, negative, result)
    } else if (testCase.mode === 'review') {
      await runReview(page, testCase, result)
    } else if (testCase.mode === 'flip-draw' || testCase.mode === 'flip-pair') {
      await runFlip(page, testCase, negative, result)
    } else {
      await runVanilla(page, testCase, result)
    }
    result.trace = await readTrace(page)
    result.errors = errors
    assert.equal(errors.length, 0, `browser errors: ${errors.join('; ')}`)
    result.status = 'PASS'
    result.screenshot = resolve(
      outputDirectory,
      `bs9-${testCase.card}-${testCase.mode}-${negative ? 'negative' : 'positive'}-${viewport.width}x${viewport.height}.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true })
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 7000)
    result.trace = await readTrace(page).catch(() => [])
    await page.screenshot({
      path: resolve(
        outputDirectory,
        `bs9-${testCase.card}-${testCase.mode}-${negative ? 'negative' : 'positive'}-${viewport.width}x${viewport.height}.png`,
      ),
      fullPage: true,
    }).catch(() => {})
  } finally {
    await page.close()
  }
  return result
}

const waitForPreview = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (preview.exitCode !== null) throw new Error(`Vite preview exited before serving on ${baseUrl}`)
    try {
      if ((await fetch(baseUrl)).ok) return
    } catch {
      // Preview is still starting.
    }
    await wait(100)
  }
  throw new Error(`Vite preview did not start at ${baseUrl}`)
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
          `${result.status} ${testCase.card} ${testCase.mode} ${negative ? 'negative' : 'positive'} ${viewport.width}x${viewport.height}`,
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
  viewports: [
    { width: 1907, height: 863 },
    { width: 1164, height: 777 },
  ],
  scope: 'BS9-024～029 candidate routes; BS9-025 is review-only and remains fail-closed.',
  total: results.length,
  passed: results.filter((result) => result.status === 'PASS').length,
  failed: results.filter((result) => result.status !== 'PASS'),
  results,
}
writeFileSync(
  resolve(outputDirectory, 'bs9-024-029-browser.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
process.exitCode = report.failed.length > 0 ? 1 : 0
