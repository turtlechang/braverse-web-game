import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const candidatePath = resolve(root, 'data/candidates/st6-st10/official-st10.en.json')
const formalPath = resolve(root, 'data/cards/official-st10-006.en.json')
const candidateDocument = existsSync(candidatePath) ? JSON.parse(readFileSync(candidatePath, 'utf8')) : undefined
const formalDocument = existsSync(formalPath) ? JSON.parse(readFileSync(formalPath, 'utf8')) : undefined
const card = formalDocument?.cards.find(record => record.cardNumber === 'ST10-006') ??
  candidateDocument?.cards.find(record => record.cardNumber === 'ST10-006')
assert.ok(card?.imageUrl, 'original printed ST10-006 record is required')

const artPath = resolve(root, 'output/st6-st10/images/ST10-006.webp')
assert.ok(existsSync(artPath), 'original printed ST10-006 art is required')
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

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4197)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}`
const output = resolve(root, 'output/st6-st10/st10-006-browser')
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
    'src/game/demo.ts', 'src/game/st10-006-demo.ts', 'src/game/commands.ts',
    'src/game/effects/execute.ts', 'src/game/skills.ts', 'src/game/generated-card-pool.ts',
    'src/hooks/useMatchController.ts', 'src/hooks/usePendingEffect.ts',
    'src/components/effects/EffectPanel.tsx', 'src/components/modals/GameModals.tsx',
  ].map(path => resolve(root, path)).filter(existsSync)
  const stale = inputs.filter(path => statSync(path).mtimeMs > buildTime)
  if (stale.length) throw new Error(`dist/index.html is older than ST10-006 sources; build required: ${stale.join(', ')}`)
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
    if (await visible(skip)) await skip.click({ timeout: 1000 }).catch(() => {})
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
  throw new Error('ST10-006 effect panel did not reach its final action')
}

const cases = [
  { id: 'owner-turn-select-opponent', testState: 'card:ST10-006', target: 'select' },
  { id: 'owner-turn-select-zero', testState: 'card:ST10-006', target: 'zero' },
  { id: 'item-cost-select-opponent', testState: 'st10-006-cost', target: 'cost-select' },
  { id: 'opponent-turn-no-trigger', testState: 'card-negative:ST10-006', target: 'off-turn' },
]
const viewports = [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]
const requestedCase = process.env.ST10_006_BROWSER_SCENARIO
const requestedWidth = Number(process.env.ST10_006_BROWSER_VIEWPORT_WIDTH ?? 0)
const activeCases = requestedCase ? cases.filter(item => item.id === requestedCase) : cases
const activeViewports = requestedWidth ? viewports.filter(item => item.width === requestedWidth) : viewports
if (!activeCases.length) throw new Error(`Unknown ST10_006_BROWSER_SCENARIO: ${requestedCase}`)
if (!activeViewports.length) throw new Error(`Unknown ST10_006_BROWSER_VIEWPORT_WIDTH: ${requestedWidth}`)

const runRemoval = async (page, testCase, evidence) => {
  const poisonInBattle = current => current.own.battle.some(item => item.name.includes('Poison Mushroom'))
  const settleReplacementChoice = async () => {
    const declineReplacement = page.getByRole('button', { name: '不補餅乾', exact: true }).first()
    if (!await visible(declineReplacement)) return
    evidence.replacementPrompt = await page.locator('[role="dialog"]:visible, [role="alertdialog"]:visible').allInnerTexts()
    await clickReady(declineReplacement, 'decline the optional replacement Cookie after Blueberry Pie leaves battle')
    await declineReplacement.waitFor({ state: 'hidden' })
    evidence.replacementDecision = '不補餅乾'
  }
  const hasOnPlayPanel = async () => {
    const panel = page.locator('.effect-panel[role="alertdialog"]:visible').filter({
      hasText: 'Poison Mushroom Cookie',
    }).last()
    return await visible(panel)
  }

  if (!poisonInBattle(evidence.before)) {
    const source = page.locator('.bottom-field .hand-card-wrap').filter({
      has: page.locator('.card-face[title*="Poison Mushroom"]'),
    }).first()
    await source.waitFor({ state: 'visible' })
    await clickReady(source.locator('.card-face').first(), 'select the original Poison Mushroom Cookie')
    await clickReady(source.locator('.hand-card-action').filter({ hasText: '登場' }).first(), 'deploy Poison Mushroom')
    await waitForObservedState(page, poisonInBattle,
      'the real Poison Mushroom deployment did not move the original Cookie into battle')
    await page.locator('.effect-panel[role="alertdialog"]:visible').filter({
      hasText: 'Poison Mushroom Cookie',
    }).waitFor({ state: 'visible' })
  } else {
    assert.equal(await hasOnPlayPanel(), true,
      'a pre-deployed Poison Mushroom must expose its original On Play payment panel')
    evidence.preexistingOnPlayPanel = true
  }

  let panel = page.locator('.effect-panel[role="alertdialog"]:visible').filter({
    hasText: 'Poison Mushroom Cookie',
  }).last()
  await panel.waitFor({ state: 'visible' })
  evidence.onPlayCostPanel = await panel.innerText()
  assert.match(evidence.onPlayCostPanel, /Poison Mushroom/)
  assert.match(evidence.onPlayCostPanel, /P|紫/)
  const payment = panel.locator('.effect-candidates-payment button:not(.is-selected)').first()
  await clickReady(payment, 'select the original purple Support payment')
  panel = page.locator('.effect-panel[role="alertdialog"]:visible').filter({
    hasText: 'Poison Mushroom Cookie',
  }).last()
  await panel.locator('.effect-candidates-payment button.is-selected').waitFor({ state: 'visible' })
  assert.match(await panel.innerText(), /已選\s*1／\s*1 張能量支援卡/)
  const primary = await advanceToFinalAction(panel)
  await clickReady(primary, 'pay P and activate the real On Play effect')

  if (testCase.target === 'off-turn') {
    evidence.after = await waitForObservedState(page, current =>
      current.opponent.battle.every(item => item.name !== 'Blueberry Pie Cookie') &&
      current.opponent.trash === evidence.before.opponent.trash + 3 &&
      poisonInBattle(current),
    'the opponent-turn effect did not move Blueberry Pie and both HP cards to its owner trash',
    )
    await page.waitForTimeout(500)
    evidence.pendingUi = await page.locator('.effect-panel[role="alertdialog"]:visible').allInnerTexts()
    assert.equal(evidence.pendingUi.some(text => text.includes('Blueberry Pie')), false,
      'the owner-turn-only departure skill must not open on the opponent turn')
    evidence.trace = await trace(page)
    assert.equal(evidence.trace.some(entry => entry.summary?.includes('Blueberry Pie Cookie') ||
      entry.steps?.some(step => String(step).includes('Blueberry Pie Cookie'))), false,
    'the off-turn removal must not resolve a Blueberry Pie skill')
    assert.equal(evidence.trace.some(entry => entry.commandKind === 'resolve-ability-effect'), false,
      'the off-turn removal must not produce an ST10-006 effect-resolution trace')
    await settleReplacementChoice()
    return
  }

  evidence.parentRemoval = await waitForObservedState(page, current =>
    !current.own.battle.some(item => item.name.includes('Blueberry Pie')) &&
    current.own.trash === evidence.before.own.trash + 3,
  'Poison Mushroom did not move Blueberry Pie and its two printed HP cards to trash',
  )
  panel = page.locator('.effect-panel[role="alertdialog"]:visible').filter({
    hasText: 'Blueberry Pie Cookie',
  }).last()
  await panel.waitFor({ state: 'visible' })
  await page.waitForFunction(() => {
    const text = [...document.querySelectorAll('.effect-panel[role="alertdialog"]')]
      .filter(node => node.getBoundingClientRect().width > 0)
      .map(node => node.textContent ?? '').join(' ')
    return text.includes('Blueberry Pie')
  }, { timeout: 20000 })
  panel = page.locator('.effect-panel[role="alertdialog"]:visible').filter({
    hasText: 'Blueberry Pie Cookie',
  }).last()
  evidence.departurePanel = await panel.innerText()
  assert.match(evidence.departurePanel, /Blueberry Pie/)

  if (testCase.target === 'select') {
    const target = panel.locator('.effect-candidates-target button').filter({ hasText: 'Moonlight' }).first()
    await clickReady(target, 'select the original opponent Moonlight Cookie')
  }
  const confirm = await advanceToFinalAction(panel)
  await clickReady(confirm, testCase.target === 'select' ? 'confirm one opponent damage target' : 'confirm zero optional targets')
  await waitForCommand(page, 'resolve-ability-effect')
  await settleAnimation(page)
  evidence.after = await waitForObservedState(page, current =>
    current.own.battle.some(item => item.name.includes('Poison Mushroom')) &&
    !current.own.battle.some(item => item.name.includes('Blueberry Pie')) &&
    current.own.trash === evidence.before.own.trash + 3 &&
    current.opponent.battle.some(item => item.name.includes('Moonlight') &&
      item.hp === evidence.before.opponent.battle.find(target => target.name.includes('Moonlight'))?.hp - Number(testCase.target === 'select')),
  'ST10-006 direct-to-trash trigger or optional damage did not settle',
  )
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some(entry => entry.commandKind === 'resolve-ability-effect' &&
    entry.summary?.includes('ST10-006')),
  'the contract trace must attribute the optional damage to the printed Blueberry Pie skill')

  await settleReplacementChoice()
}

const runCostRemoval = async (page, evidence) => {
  const source = page.locator('.bottom-field .hand-card-wrap').filter({
    has: page.locator('.card-face[title*="Little Star"]'),
  }).first()
  await source.waitFor({ state: 'visible' })
  await clickReady(source.locator('.card-face').first(), 'select the original Little Star item')
  await clickReady(source.locator('.hand-card-action').filter({ hasText: '使用' }).first(), 'use Little Star')

  let panel = page.locator('.effect-panel[role="alertdialog"]:visible').filter({
    hasText: 'Little Star',
  }).last()
  await panel.waitFor({ state: 'visible' })
  evidence.paymentPanel = await panel.innerText()
  assert.match(evidence.paymentPanel, /Little Star/)
  assert.match(evidence.paymentPanel, /紫|P/)

  const payment = panel.locator('.effect-candidates-payment button:not(.is-selected)').first()
  await clickReady(payment, 'select the original purple Support payment for Little Star')
  panel = page.locator('.effect-panel[role="alertdialog"]:visible').filter({
    hasText: 'Little Star',
  }).last()
  await panel.locator('.effect-candidates-payment button.is-selected').waitFor({ state: 'visible' })
  assert.match(await panel.innerText(), /已選\s*1／\s*1 張能量支援卡/)

  const nextCostStep = panel.locator('.effect-panel-primary-action:visible').last()
  await clickReady(nextCostStep, 'advance from the P payment to the Cookie cost step')
  panel = page.locator('.effect-panel[role="alertdialog"]:visible').filter({
    hasText: 'Little Star',
  }).last()
  const costCookie = panel.locator('.effect-candidates-trash-battle button').filter({
    hasText: 'Blueberry Pie Cookie',
  }).first()
  await clickReady(costCookie, 'select original Blueberry Pie as the direct-trash Cookie cost')
  panel = page.locator('.effect-panel[role="alertdialog"]:visible').filter({
    hasText: 'Little Star',
  }).last()
  await panel.locator('.effect-candidates-trash-battle button.is-selected').waitFor({ state: 'visible' })
  evidence.costSelection = await panel.innerText()
  assert.match(evidence.costSelection, /已選\s*1／\s*1 張戰鬥區餅乾代價/)
  const confirm = await advanceToFinalAction(panel)
  evidence.parentEffectPanel = await panel.innerText()
  assert.match(evidence.parentEffectPanel, /對手|Opponent/)
  assert.match(evidence.parentEffectPanel, /已選\s*0／\s*1/)
  await clickReady(confirm, 'pay Little Star P, trash Blueberry Pie, and choose zero targets for Little Star')
  evidence.afterParentZero = await waitForObservedState(page, current =>
    !current.own.battle.some(item => item.name.includes('Blueberry Pie Cookie')) &&
    current.own.trash === evidence.before.own.trash + 4 &&
    current.opponent.trash === evidence.before.opponent.trash &&
    current.opponent.battle.some(item => item.name.includes('Moonlight') &&
      item.hp === evidence.before.opponent.battle.find(card => card.name.includes('Moonlight'))?.hp),
  'Little Star zero-target resolution should finish before the Blueberry Pie departure choice')

  evidence.costDeparture = await waitForObservedState(page, current =>
    !current.own.battle.some(item => item.name.includes('Blueberry Pie Cookie')) &&
    current.own.trash === evidence.before.own.trash + 4,
  'ST10-013 did not pay P and move itself plus Blueberry Pie and both HP cards directly to trash')

  panel = page.locator('.effect-panel[role="alertdialog"]:visible').filter({
    hasText: 'Blueberry Pie Cookie',
  }).last()
  await panel.waitFor({ state: 'visible' })
  evidence.departurePanel = await panel.innerText()
  assert.match(evidence.departurePanel, /Blueberry Pie Cookie/)
  const target = panel.locator('.effect-candidates-target button').filter({ hasText: 'Moonlight' }).first()
  await clickReady(target, 'select original opponent Moonlight for Blueberry Pie damage')
  const resolve = await advanceToFinalAction(panel)
  await clickReady(resolve, 'resolve the departure trigger after paying the On Play cost')

  evidence.after = await waitForObservedState(page, current =>
    !current.own.battle.some(item => item.name.includes('Blueberry Pie Cookie')) &&
    current.own.trash === evidence.before.own.trash + 4 &&
    current.opponent.battle.some(item => item.name.includes('Moonlight') &&
      item.hp === evidence.before.opponent.battle.find(card => card.name.includes('Moonlight'))?.hp - 1),
  'the queued Blueberry Pie departure effect did not resolve its selected one damage')
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some(entry => entry.commandKind === 'resolve-ability-effect' &&
    entry.summary?.includes('ST10-006')),
  'the trace must show the ST10-006 departure effect after Little Star pays its cost')
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
    const evidence = { id: testCase.id, testState: testCase.testState, target: testCase.target, viewport, status: 'FAIL', errors }
    try {
      await page.route(card.imageUrl, route => route.fulfill({ status: 200, contentType: 'image/webp', body: art }))
      const url = new URL('/', baseUrl)
      url.searchParams.set('test-state', testCase.testState)
      url.searchParams.set('contract-card', 'ST10-006')
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      await settleAnimation(page)
      evidence.before = await state(page)
      evidence.traceBefore = await trace(page)
      assert.deepEqual(evidence.traceBefore, [], 'fixture setup must not fabricate Browser commands')
      const blueberryField = testCase.target === 'off-turn' ? page.locator('.top-field') : page.locator('.bottom-field')
      const blueberry = blueberryField.locator('.combat-card-wrap').filter({
        has: page.locator('.card-face[title*="Blueberry Pie"]'),
      }).first()
      await blueberry.waitFor({ state: 'visible' })
      const image = blueberry.locator('.card-face img').first()
      evidence.art = await image.evaluate(node => ({
        alt: node.getAttribute('alt'), src: node.getAttribute('src'), loaded: node.complete && node.naturalWidth > 0,
        width: node.naturalWidth, height: node.naturalHeight,
      }))
      assert.equal(evidence.art.src, card.imageUrl)
      assert.equal(evidence.art.loaded, true)
      assert.deepEqual([evidence.art.width, evidence.art.height], [artDimensions.width, artDimensions.height])
      if (testCase.target === 'cost-select') await runCostRemoval(page, evidence)
      else await runRemoval(page, testCase, evidence)
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
