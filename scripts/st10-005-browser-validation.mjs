import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const candidatePath = resolve(root, 'data/candidates/st6-st10/official-st10.en.json')
const formalPath = resolve(root, 'data/cards/official-st10-005.en.json')
const candidateDocument = existsSync(candidatePath) ? JSON.parse(readFileSync(candidatePath, 'utf8')) : undefined
const formalDocument = existsSync(formalPath) ? JSON.parse(readFileSync(formalPath, 'utf8')) : undefined
const card = formalDocument?.cards.find(record => record.cardNumber === 'ST10-005') ??
  candidateDocument?.cards.find(record => record.cardNumber === 'ST10-005')
assert.ok(card?.imageUrl, 'original printed ST10-005 record is required')
const artPath = resolve(root, 'output/st6-st10/images/ST10-005.webp')
assert.ok(existsSync(artPath), 'original printed ST10-005 art is required')
const art = readFileSync(artPath)
assert.equal(art.toString('ascii', 0, 4), 'RIFF')
assert.equal(art.toString('ascii', 8, 12), 'WEBP')
const artDimensions = { width: art.readUIntLE(24, 3) + 1, height: art.readUIntLE(27, 3) + 1 }

const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const playwright = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwright.chromium ?? playwright.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4196)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}`
const output = resolve(root, 'output/st6-st10/st10-005-browser')
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')
const distIndex = resolve(root, 'dist/index.html')
const browserExecutable = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
if (!process.env.BRAVERSE_BASE_URL) {
  if (!existsSync(distIndex)) throw new Error('dist/index.html is missing; build must finish before Browser validation')
  const buildTime = statSync(distIndex).mtimeMs
  const inputs = [
    'src/game/demo.ts', 'src/game/st10-005-demo.ts', 'src/game/commands.ts',
    'src/game/generated-card-pool.ts', 'src/hooks/usePendingEffect.ts',
    'src/components/effects/EffectPanel.tsx', 'src/components/battle/PendingDecisionModals.tsx',
  ].map(path => resolve(root, path)).filter(existsSync)
  const stale = inputs.filter(path => statSync(path).mtimeMs > buildTime)
  if (stale.length) throw new Error(`dist/index.html is older than ST10-005 sources; build required: ${stale.join(', ')}`)
}

mkdirSync(output, { recursive: true })
let server
const wait = milliseconds => new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds))
const visible = async locator => await locator.count() > 0 && await locator.first().isVisible().catch(() => false)
const clickReady = async (locator, label) => {
  await locator.waitFor({ state: 'visible' })
  assert.equal(await locator.isEnabled(), true, `${label} must be enabled`)
  await locator.click()
}
const settleAnimation = async page => {
  for (let step = 0; step < 18; step += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click({ timeout: 1000, force: true }).catch(() => {})
    await page.waitForTimeout(80)
  }
}
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({
  commandKind: entry.commandKind,
  summary: entry.summary,
  steps: entry.steps,
  payload: entry.payload,
})))
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent?.match(/\d+/)?.[0] ?? 0)
    const card = node => ({
      id: node.getAttribute('data-card-instance-id'),
      name: node.querySelector('.card-face')?.getAttribute('title') ?? node.querySelector('img')?.getAttribute('alt') ?? '',
      rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
      hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
    })
    return {
      hand: [...(field?.querySelectorAll('.hand-card-wrap') ?? [])].map(card),
      trash: count('.discard-zone.resource-summary > strong'),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(card),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(card),
    }
  }
  return { own: side('bottom'), opponent: side('top') }
})
const waitForCommand = (page, kind) => page.waitForFunction(
  expected => (window.__braverseContractTrace ?? []).some(entry => entry.commandKind === expected),
  kind,
  { timeout: 20000 },
)
const waitForObservedState = async (page, predicate, label) => {
  let latest
  for (let attempt = 0; attempt < 120; attempt += 1) {
    latest = await state(page)
    if (predicate(latest)) return latest
    await page.waitForTimeout(150)
  }
  throw new Error(`${label}; latest visible state: ${JSON.stringify(latest)}`)
}
const advanceToFinalAction = async panel => {
  for (let step = 0; step < 8; step += 1) {
    const primary = panel.locator('.effect-panel-primary-action:visible').last()
    await primary.waitFor({ state: 'visible' })
    const label = (await primary.innerText()).trim()
    if (!label.includes('下一步')) return primary
    await clickReady(primary, `advance effect panel: ${label}`)
  }
  throw new Error('ST10-005 effect panel did not reach its final action')
}

const cases = [
  { id: 'on-play-pay-discard-and-damage', testState: 'card:ST10-005', flow: 'on-play-damage' },
  { id: 'on-play-pay-discard-without-moonlight', testState: 'card-negative:ST10-005', flow: 'on-play-no-condition' },
  { id: 'on-play-pay-discard-and-select-zero', testState: 'card:ST10-005', flow: 'on-play-zero-target' },
  { id: 'pay-purple-for-printed-attack', testState: 'card-attack:ST10-005', flow: 'attack' },
  { id: 'no-purple-for-printed-attack', testState: 'card-attack-negative:ST10-005', flow: 'attack-unavailable' },
]
const viewports = [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]
const requestedCase = process.env.ST10_005_BROWSER_SCENARIO
const requestedWidth = Number(process.env.ST10_005_BROWSER_VIEWPORT_WIDTH ?? 0)
const activeCases = requestedCase ? cases.filter(item => item.id === requestedCase) : cases
const activeViewports = requestedWidth ? viewports.filter(item => item.width === requestedWidth) : viewports
if (!activeCases.length) throw new Error(`Unknown ST10_005_BROWSER_SCENARIO: ${requestedCase}`)
if (!activeViewports.length) throw new Error(`Unknown ST10_005_BROWSER_VIEWPORT_WIDTH: ${requestedWidth}`)

const runOnPlay = async (page, testCase, evidence) => {
  const source = page.locator('.bottom-field .hand-card-wrap').filter({
    has: page.locator('.card-face[title="Dreamcatcher"]'),
  }).first()
  await source.waitFor({ state: 'visible' })
  const image = source.locator('.card-face img').first()
  await image.waitFor({ state: 'visible' })
  evidence.art = await image.evaluate(node => ({
    alt: node.getAttribute('alt'), src: node.getAttribute('src'), loaded: node.complete && node.naturalWidth > 0,
    width: node.naturalWidth, height: node.naturalHeight,
  }))
  assert.equal(evidence.art.src, card.imageUrl)
  assert.equal(evidence.art.alt, 'Dreamcatcher')
  assert.equal(evidence.art.loaded, true)
  assert.deepEqual([evidence.art.width, evidence.art.height], [artDimensions.width, artDimensions.height])
  await clickReady(source.locator('.card-face').first(), 'select original Dreamcatcher')
  await clickReady(source.locator('.hand-card-action').filter({ hasText: '登場' }).first(), 'normal deploy Dreamcatcher')
  await waitForCommand(page, 'deploy-cookie')

  let panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
  await panel.waitFor({ state: 'visible' })
  evidence.initialPanel = await panel.innerText()
  assert.match(evidence.initialPanel, /Dreamcatcher/)
  assert.match(evidence.initialPanel, /棄置 1 張手牌|選擇 1 張手牌棄置/)
  const discard = panel.locator('.effect-candidates-discard-hand button:not(.is-selected)').first()
  await clickReady(discard, 'select the authentic physical discard payment')

  panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
  let primary = await advanceToFinalAction(panel)
  if (testCase.flow === 'on-play-damage') {
    const target = panel.locator('.effect-candidates-target button').filter({ hasText: 'Devil Cookie' }).first()
    await clickReady(target, 'select the original opponent Devil Cookie')
    primary = panel.locator('.effect-panel-primary-action:visible').last()
  }
  await clickReady(primary, testCase.flow === 'on-play-damage' ? 'confirm printed 1 damage' : 'confirm optional target choice')
  await waitForCommand(page, 'begin-activate-skill')
  await settleAnimation(page)
  evidence.after = await waitForObservedState(page, current =>
    current.own.battle.some(item => item.name === 'Dreamcatcher') &&
    current.own.trash === evidence.before.own.trash + 1 &&
    (testCase.flow === 'on-play-damage'
      ? current.opponent.battle.some(item => item.name === 'Devil Cookie' && item.hp === evidence.before.opponent.battle.find(target => target.name === 'Devil Cookie')?.hp - 1)
      : current.opponent.battle.some(item => item.name === 'Devil Cookie' && item.hp === evidence.before.opponent.battle.find(target => target.name === 'Devil Cookie')?.hp)),
    'ST10-005 On Play payment or target settlement did not match the physical card',
  )
  evidence.trace = await trace(page)
  const activation = evidence.trace.find(entry => entry.commandKind === 'begin-activate-skill')
  assert.ok(activation, 'the On Play must use the formal begin-activate-skill command')
  assert.ok(activation.steps.some(step => step.includes('棄置手牌：GingerBrave')),
    'the formal activation trace must identify the physical hand card paid as cost')
  assert.equal(evidence.after.own.trash, evidence.before.own.trash + 1)
  const opponentTargetBefore = evidence.before.opponent.battle.find(item => item.name === 'Devil Cookie')
  const opponentTargetAfter = evidence.after.opponent.battle.find(item => item.name === 'Devil Cookie')
  assert.ok(opponentTargetBefore && opponentTargetAfter)
  assert.equal(opponentTargetAfter.hp, opponentTargetBefore.hp - Number(testCase.flow === 'on-play-damage'))
}

const runAttack = async (page, testCase, evidence) => {
  const source = page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator('.card-face[title="Dreamcatcher"]'),
  }).first()
  if (testCase.flow === 'attack-unavailable') {
    const attack = source.locator('.card-face.is-attackable')
    assert.equal(await visible(attack), false, 'Dreamcatcher needs one ready purple support for its printed P attack')
    evidence.after = await state(page)
    evidence.trace = await trace(page)
    assert.deepEqual(evidence.after, evidence.before)
    assert.equal(evidence.trace.some(entry => entry.commandKind === 'declare-attack'), false)
    return
  }

  await clickReady(source.locator('.card-face.is-attackable'), 'select Dreamcatcher ordinary attack')
  await page.locator('[data-testid="attack-payment-panel"]:visible').waitFor({ state: 'visible' })
  const support = page.locator('.bottom-field .support-card-wrap').first()
  const payment = support.locator('.card-face.is-targetable:not(.is-selected)')
  evidence.paymentId = await support.getAttribute('data-card-instance-id')
  await clickReady(payment, 'pay the printed P attack with purple Support')
  const target = evidence.before.opponent.battle.find(item => item.name === 'Devil Cookie')
  assert.ok(target?.id)
  await clickReady(page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${target.id}"] .card-face[aria-label^="選擇攻擊目標："]`),
    'target the original physical Devil Cookie')
  await waitForCommand(page, 'declare-attack')
  evidence.after = await waitForObservedState(page, current =>
    current.opponent.battle.some(item => item.name === 'Devil Cookie' && item.hp === target.hp - 1) &&
    current.own.battle.some(item => item.name === 'Dreamcatcher' && item.rested) &&
    current.own.support.some(item => item.id === evidence.paymentId && item.rested),
  'the printed P attack did not pay and settle one ordinary damage')
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some(entry => entry.commandKind === 'declare-attack'))
  assert.equal(evidence.after.opponent.battle.find(item => item.name === 'Devil Cookie')?.hp, target.hp - 1)
}

const results = []
let browser
try {
  if (!process.env.BRAVERSE_BASE_URL) {
    server = spawn(process.execPath, [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)], {
      cwd: root, stdio: 'ignore',
    })
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        if ((await fetch(baseUrl)).ok) break
      } catch { /* preview is starting */ }
      await wait(100)
    }
  }
  browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) })
  for (const viewport of activeViewports) for (const testCase of activeCases) {
    const page = await browser.newPage({ viewport })
    page.setDefaultTimeout(15000)
    const errors = []
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
    page.on('console', message => {
      if (message.type() === 'error' && !message.location().url?.includes('cookierunbraverse.com')) {
        errors.push(`console: ${message.text()}`)
      }
    })
    const evidence = { id: testCase.id, testState: testCase.testState, flow: testCase.flow, viewport, status: 'FAIL', errors }
    try {
      await page.route(card.imageUrl, route => route.fulfill({ status: 200, contentType: 'image/webp', body: art }))
      const url = new URL('/', baseUrl)
      url.searchParams.set('test-state', testCase.testState)
      url.searchParams.set('contract-card', 'ST10-005')
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      await settleAnimation(page)
      evidence.before = await state(page)
      evidence.traceBefore = await trace(page)
      assert.deepEqual(evidence.traceBefore, [], 'fixture setup must not fabricate Browser commands')
      if (testCase.flow.startsWith('on-play-')) await runOnPlay(page, testCase, evidence)
      else await runAttack(page, testCase, evidence)
      await settleAnimation(page)
      evidence.finalState = await state(page)
      assert.deepEqual(errors, [])
      evidence.status = 'PASS'
    } catch (error) {
      evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
      evidence.trace ??= await trace(page).catch(() => [])
      evidence.finalState ??= await state(page).catch(() => null)
      evidence.debug = await page.evaluate(() => ({
        toasts: [...document.querySelectorAll('.status-toast')].filter(node => node.getBoundingClientRect().width > 0)
          .map(node => node.textContent?.trim()),
        dialogs: [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')]
          .filter(node => node.getBoundingClientRect().width > 0).map(node => node.textContent?.trim().slice(0, 1000)),
        buttons: [...document.querySelectorAll('button')].filter(node => node.getBoundingClientRect().width > 0)
          .map(node => node.textContent?.trim()).filter(Boolean).slice(-24),
      })).catch(() => null)
    } finally {
      evidence.screenshot = resolve(output, `${testCase.id}-${viewport.width}-${evidence.status}.png`)
      await page.screenshot({ path: evidence.screenshot, fullPage: true }).catch(() => {})
      results.push(evidence)
      await page.close()
    }
  }
} finally {
  writeFileSync(resolve(output, 'results.json'), JSON.stringify(results, null, 2))
  await browser?.close().catch(() => {})
  server?.kill()
}

console.log(JSON.stringify({ total: results.length, passed: results.filter(result => result.status === 'PASS').length, results }, null, 2))
if (results.some(result => result.status !== 'PASS')) process.exitCode = 1
