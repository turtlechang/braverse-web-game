import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const playwright = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwright.chromium ?? playwright.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_BS9_TEST_PORT ?? 4185)
const baseUrl = `http://127.0.0.1:${port}`
const preview = spawn(
  process.execPath,
  [resolve(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)
const outputDirectory = resolve(root, 'test-results')
mkdirSync(outputDirectory, { recursive: true })
const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))

const cases = [
  ['BS9-010', 'Shadow Milk Cookie', 'extra'],
  ['BS9-011', 'Devil Cookie', 'on-play'],
  ['BS9-012', 'Knight Cookie', 'smoke'],
  ['BS9-013', 'Capricious Wizard', 'smoke'],
  ['BS9-014', 'Candy Apple Cookie', 'smoke'],
  ['BS9-015', 'Parfait Cookie', 'smoke'],
  ['BS9-016', 'Pizza Cookie', 'smoke'],
  ['BS9-017', 'Hollyberry Cookie', 'smoke'],
  ['BS9-018', 'Hero Cookie', 'smoke'],
  ['BS9-019', 'Juicy Stamina Jellies', 'item'],
  ['BS9-020', 'Fateful Cookie Cutter', 'item'],
  ['BS9-021', 'Stolen Light of Truth', 'smoke'],
  ['BS9-022', 'Paper Puppet Troupe', 'trap'],
  ['BS9-023', 'Atelier of Lies', 'stage'],
]

const recordErrors = (page) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const location = message.location()
    if (location.url?.endsWith('/favicon.ico') && message.text().includes('404')) return
    if (location.url?.includes('cookierunbraverse.com/data/en_storage/') && /ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(message.text())) return
    errors.push(`console: ${message.text()}`)
  })
  return errors
}

const readTrace = (page) => page.evaluate(() => window.__braverseContractTrace ?? [])
const waitForGame = async (page) => {
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await page.waitForTimeout(280)
}
const visiblePanel = (page) => page.locator('.effect-panel:visible').first()
const assertTrace = async (page, commandKind) => {
  const trace = await readTrace(page)
  assert.ok(trace.some((entry) => entry.commandKind === commandKind), `missing ${commandKind} trace`)
}

const settleOnPlay = async (page, title, negative) => {
  const card = page.locator(`.bottom-hand .hand-card[title="${title}"]`).first()
  await card.click()
  await page.locator('.hand-card-action').filter({ hasText: '登場' }).click({ force: true })
  await page.waitForTimeout(180)
  const panel = visiblePanel(page)
  if (negative) {
    assert.equal(await panel.count(), 0, 'condition-negative On Play should auto-skip')
    await assertTrace(page, 'skip-on-play')
    return
  }
  await panel.waitFor({ state: 'visible' })
  const target = panel.locator('.effect-candidates-target button:not(:disabled)').first()
  if (await target.count()) await target.click({ force: true })
  const primary = panel.locator('.effect-panel-primary-action').first()
  assert.equal(await primary.isEnabled(), true)
  await primary.click({ force: true })
  await page.waitForTimeout(180)
  await assertTrace(page, 'resolve-ability-effect')
}

const settleItem = async (page, title, negative) => {
  const card = page.locator(`.bottom-hand .hand-card[title="${title}"]`).first()
  await card.click()
  if (negative) {
    // A condition-blocked Item remains inspectable in hand, but the real UI
    // must not expose a 使用 action.  Keep this as the negative Browser
    // acceptance path instead of dispatching an illegal command by force.
    assert.equal(await page.locator('.hand-card-action').filter({ hasText: '使用' }).count(), 0)
    assert.match(await page.locator('body').innerText(), new RegExp(title))
    return
  }
  await page.locator('.hand-card-action').filter({ hasText: '使用' }).click({ force: true })
  await page.waitForTimeout(120)
  const panel = visiblePanel(page)
  await panel.waitFor({ state: 'visible' })
  const payments = panel.locator('.effect-candidates-payment button:not(.is-selected):not(:disabled)')
  const needed = title === 'Juicy Stamina Jellies' ? 2 : 1
  for (let index = 0; index < needed; index += 1) await payments.nth(index).click({ force: true })
  const confirm = panel.locator('.effect-panel-primary-action').first()
  await confirm.click({ force: true })
  await page.waitForTimeout(150)
  if (title === 'Juicy Stamina Jellies') {
    const targetPanel = visiblePanel(page)
    const target = targetPanel.locator('.effect-candidates-target button:not(:disabled)').first()
    if (await target.count()) await target.click({ force: true })
    await targetPanel.locator('.effect-panel-primary-action').first().click({ force: true })
    await page.waitForTimeout(180)
    await assertTrace(page, 'resolve-ability-effect')
    return
  }
  const draw = page.locator('.draw-up-to-modal:visible')
  await draw.waitFor({ state: 'visible' })
  assert.match(await draw.innerText(), /最多 2 張|最多.*2 張/)
  await draw.locator('.draw-up-to-option').nth(2).click({ force: true })
  await draw.locator('.draw-up-to-actions button').click({ force: true })
  await page.waitForTimeout(120)
  const discard = page.locator('.hand-discard-modal:visible')
  await discard.waitFor({ state: 'visible' })
  await discard.locator('.hand-discard-options button:not(.is-selected)').first().click({ force: true })
  await discard.locator('.hand-discard-actions button').click({ force: true })
  await page.waitForTimeout(180)
  await assertTrace(page, 'resolve-opponent-hand-discard')
}

const settleExtra = async (page, negative) => {
  const summary = page.locator('button.resource-summary[aria-label^="玩家 EXTRA Deck"]').first()
  await summary.click({ force: true })
  const play = page.getByRole('button', { name: '從 EXTRA 登場', exact: true })
  if (negative) {
    assert.equal(await play.count(), 0, 'negative EXTRA requirement should not offer play')
    assert.match(await page.locator('body').innerText(), /EXTRA|尚未|不能|不符合/)
    return
  }
  await play.click({ force: true })
  await page.waitForTimeout(120)
  const panel = visiblePanel(page)
  await panel.locator('.effect-candidates-target button:not(:disabled)').first().click({ force: true })
  await panel.locator('.effect-panel-primary-action').first().click({ force: true })
  await page.waitForTimeout(180)
  await assertTrace(page, 'play-extra-deck-cookie')
  await assertTrace(page, 'resolve-ability-effect')
}

const settleTrap = async (page, negative) => {
  const response = page.locator('.trap-response-modal:visible')
  await response.waitFor({ state: 'visible' })
  const trapButton = response.locator('button').filter({ hasText: 'Paper Puppet Troupe' }).first()
  if (negative) {
    await response.getByRole('button', { name: '不發動', exact: true }).click({ force: true })
    await page.waitForTimeout(120)
    // skip-trap is a system transition without a card source, so the public
    // contract trace intentionally omits it.  The rendered message is the
    // user-visible evidence that the response window was closed.
    assert.match(await page.locator('body').innerText(), /未發動回應，進入傷害結算|未發動陷阱，進入傷害結算/)
    return
  }
  await trapButton.click({ force: true })
  await page.waitForTimeout(100)
  const payment = response.locator('.trap-discard-options button:not(.is-selected):not(:disabled)').first()
  await payment.click({ force: true })
  await response.getByRole('button', { name: '下一步', exact: true }).click({ force: true })
  await page.waitForTimeout(100)
  const target = response.locator('.trap-target-candidates button:not(.is-selected):not(:disabled), .effect-candidates-target button:not(:disabled)').first()
  if (await target.count()) await target.click({ force: true })
  const next = response.getByRole('button', { name: /下一步|發動|確認/, exact: false }).last()
  if (await next.isEnabled().catch(() => false)) await next.click({ force: true })
  await page.waitForTimeout(150)
  await assertTrace(page, 'play-trap')
}

const settleStage = async (page, negative) => {
  const card = page.locator('.bottom-hand .hand-card[title="Atelier of Lies"]')
  await card.click()
  await page.locator('.hand-card-action').filter({ hasText: '放置' }).click({ force: true })
  const placement = page.locator('.stage-placement-modal:visible')
  await placement.waitFor({ state: 'visible' })
  await placement.locator('.faint-payment-candidates button:not(:disabled)').first().click({ force: true })
  await placement.getByRole('button', { name: '支付並放置', exact: true }).click({ force: true })
  await page.waitForTimeout(160)
  if (negative) {
    const activate = page.getByRole('button', { name: '啟動', exact: true })
    assert.equal(await activate.isEnabled().catch(() => false), false)
    return
  }
  await page.getByRole('button', { name: '啟動', exact: true }).click({ force: true })
  const panel = visiblePanel(page)
  await panel.locator('.effect-candidates-payment button:not(:disabled)').first().click({ force: true })
  await panel.locator('.effect-panel-primary-action').first().click({ force: true })
  await page.waitForTimeout(100)
  // Stage activation has a separate mandatory "rest this card" step after
  // payment.  Advance that step before selecting the Cookie targets.
  let target = page.locator('.effect-panel:visible .effect-candidates-target button:not(:disabled)').first()
  if (!(await target.count())) {
    const extraCost = page.locator('.effect-panel:visible').first()
    assert.match(await extraCost.innerText(), /將效果來源卡橫置/)
    await extraCost.locator('.effect-panel-primary-action').first().click({ force: true })
    await page.waitForTimeout(100)
    target = page.locator('.effect-panel:visible .effect-candidates-target button:not(:disabled)').first()
  }
  if (await target.count()) await target.click({ force: true })
  await page.locator('.effect-panel:visible .effect-panel-primary-action').first().click({ force: true })
  await page.waitForTimeout(150)
  await assertTrace(page, 'begin-activate-stage')
}

const run = async (browser, card, title, mode, negative) => {
  const page = await browser.newPage({ viewport: { width: 1164, height: 777 } })
  page.setDefaultTimeout(7_000)
  const errors = recordErrors(page)
  const route = `bs9-card${negative ? '-negative' : ''}:${card}`
  const result = { card, title, mode, negative, route, status: 'FAIL', actions: [] }
  try {
    await page.goto(`${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${card}`, { waitUntil: 'domcontentloaded' })
    await waitForGame(page)
    if (mode !== 'extra') {
      assert.ok(await page.locator(`.card-face[title="${title}"]`).count(), `${title} card should be mounted in the candidate fixture`)
    }
    if (mode === 'extra') await settleExtra(page, negative)
    else if (mode === 'on-play') await settleOnPlay(page, title, negative)
    else if (mode === 'item') await settleItem(page, title, negative)
    else if (mode === 'trap') await settleTrap(page, negative)
    else if (mode === 'stage') await settleStage(page, negative)
    result.trace = await readTrace(page)
    result.errors = errors
    assert.equal(errors.length, 0, `browser errors: ${errors.join('; ')}`)
    result.status = 'PASS'
    await page.screenshot({ path: resolve(outputDirectory, `bs9-${card}-${negative ? 'negative' : 'positive'}-1164x777.png`), fullPage: true })
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    result.trace = await readTrace(page).catch(() => [])
    result.body = await page.locator('body').innerText().catch(() => '')
  } finally {
    await page.close()
  }
  return result
}

for (let attempt = 0; attempt < 80; attempt += 1) {
  try {
    if ((await fetch(baseUrl)).ok) break
  } catch { /* preview is still starting */ }
  await wait(100)
  if (attempt === 79) throw new Error(`Vite preview did not start at ${baseUrl}`)
}

let browser
const results = []
try {
  const executablePath = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find((candidate) => existsSync(candidate))
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
  for (const [card, title, mode] of cases) {
    for (const negative of [false, true]) {
      const result = await run(browser, card, title, mode, negative)
      results.push(result)
      console.log(`${result.status} ${card} ${negative ? 'negative' : 'positive'} ${result.error ?? ''}`)
    }
  }
} finally {
  await browser?.close()
  if (preview.exitCode === null) preview.kill()
}

const report = {
  baseUrl,
  viewport: { width: 1164, height: 777 },
  scope: 'BS9 candidate routes only; candidate data remains isolated from the formal card pool.',
  total: results.length,
  passed: results.filter((result) => result.status === 'PASS').length,
  failed: results.filter((result) => result.status !== 'PASS'),
  results,
}
writeFileSync(resolve(outputDirectory, 'bs9-010-023-browser.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
process.exitCode = report.failed.length > 0 ? 1 : 0
