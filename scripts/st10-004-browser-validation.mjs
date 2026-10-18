import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const candidatePath = resolve(root, 'data/candidates/st6-st10/official-st10.en.json')
const candidateDocument = existsSync(candidatePath) ? JSON.parse(readFileSync(candidatePath, 'utf8')) : undefined
const formalPath = resolve(root, 'data/cards/official-st10.en.json')
const formalDocument = existsSync(formalPath) ? JSON.parse(readFileSync(formalPath, 'utf8')) : undefined
const card = formalDocument?.cards.find(record => record.cardNumber === 'ST10-004') ??
  candidateDocument?.cards.find(record => record.cardNumber === 'ST10-004')
assert.ok(card?.imageUrl, 'original printed ST10-004 record is required')
const artPath = resolve(root, 'output/st6-st10/images/ST10-004.webp')
assert.ok(existsSync(artPath), 'original printed ST10-004 art is required')
const art = readFileSync(artPath)
assert.equal(art.toString('ascii', 0, 4), 'RIFF')
assert.equal(art.toString('ascii', 8, 12), 'WEBP')
const artDimensions = {
  width: art.readUIntLE(24, 3) + 1,
  height: art.readUIntLE(27, 3) + 1,
}

const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const playwright = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwright.chromium ?? playwright.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4195)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}`
const output = resolve(root, 'output/st6-st10/st10-004-browser')
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
    'src/game/demo.ts', 'src/game/st10-004-demo.ts', 'src/game/battle.ts', 'src/game/commands.ts',
    'src/game/generated-card-pool.ts', 'src/hooks/useMatchController.ts',
    'src/components/battle/BattleResponseModals.tsx', 'src/components/battle/BattleRow.tsx',
    'src/components/modals/GameModals.tsx',
  ].map(path => resolve(root, path)).filter(existsSync)
  const stale = inputs.filter(path => statSync(path).mtimeMs > buildTime)
  if (stale.length) throw new Error(`dist/index.html is older than ST10-004 sources; build required: ${stale.join(', ')}`)
}

mkdirSync(output, { recursive: true })
const server = process.env.BRAVERSE_BASE_URL ? undefined : spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)
const wait = milliseconds => new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds))
const waitForPreview = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      if ((await fetch(baseUrl)).ok) return
    } catch { /* preview is starting */ }
    await wait(100)
  }
  throw new Error(`Braverse was not reachable at ${baseUrl}`)
}
const visible = async locator => await locator.count() > 0 && locator.first().isVisible().catch(() => false)
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
    })
    return {
      trash: count('.discard-zone.resource-summary > strong'),
      break: count('.break-zone .resource-summary > strong'),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(card),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({
        ...card(node),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
      })),
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
  for (let attempt = 0; attempt < 100; attempt += 1) {
    latest = await state(page)
    if (predicate(latest)) return latest
    await page.waitForTimeout(150)
  }
  throw new Error(`${label}; latest visible state: ${JSON.stringify(latest)}`)
}

const cases = [
  { id: 'pay-purple-blocker', testState: 'card:ST10-004', flow: 'block' },
  { id: 'decline-legal-blocker', testState: 'card:ST10-004', flow: 'decline' },
  { id: 'no-purple-energy', testState: 'card-negative:ST10-004', flow: 'unavailable' },
  { id: 'pay-printed-pn-attack', testState: 'card-attack:ST10-004', flow: 'attack' },
  { id: 'missing-neutral-attack-energy', testState: 'card-attack-negative:ST10-004', flow: 'attack-unavailable' },
]
const viewports = [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]
const requestedCase = process.env.ST10_004_BROWSER_SCENARIO
const requestedWidth = Number(process.env.ST10_004_BROWSER_VIEWPORT_WIDTH ?? 0)
const activeCases = requestedCase ? cases.filter(item => item.id === requestedCase) : cases
const activeViewports = requestedWidth ? viewports.filter(item => item.width === requestedWidth) : viewports
if (!activeCases.length) throw new Error(`Unknown ST10_004_BROWSER_SCENARIO: ${requestedCase}`)
if (!activeViewports.length) throw new Error(`Unknown ST10_004_BROWSER_VIEWPORT_WIDTH: ${requestedWidth}`)

const results = []
let browser
try {
  await waitForPreview()
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
    const evidence = { id: testCase.id, viewport, status: 'FAIL', errors }
    try {
      await page.route(card.imageUrl, route => route.fulfill({ status: 200, contentType: 'image/webp', body: art }))
      const url = new URL('/', baseUrl)
      url.searchParams.set('test-state', testCase.testState)
      url.searchParams.set('contract-card', 'ST10-004')
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      await settleAnimation(page)
      evidence.before = await state(page)
      evidence.traceBefore = await trace(page)
      assert.deepEqual(evidence.traceBefore, [], 'fixture setup must not fabricate Browser commands')
      await page.waitForFunction(imageUrl => [...document.images].some(image =>
        image.getAttribute('src') === imageUrl && image.complete && image.naturalWidth > 0), card.imageUrl)
      evidence.originalArt = await page.evaluate(imageUrl => {
        const image = [...document.images].find(candidate => candidate.getAttribute('src') === imageUrl)
        return image ? { src: image.getAttribute('src'), width: image.naturalWidth, height: image.naturalHeight } : null
      }, card.imageUrl)
      assert.deepEqual([evidence.originalArt.width, evidence.originalArt.height], [artDimensions.width, artDimensions.height])
      const response = page.locator('.attack-response-modal:visible').first()

      if (testCase.flow === 'attack') {
        assert.equal(evidence.before.own.battle.some(item => item.name === card.name && item.hp === 3), true)
        assert.deepEqual(evidence.before.own.support.map(item => item.name).sort(), ['GingerBrave', 'Nosy Wizard'])
        assert.equal(evidence.before.opponent.battle.find(item => item.name === 'Devil Cookie')?.hp, 4)
        const source = page.locator('.bottom-field .combat-card-wrap').filter({
          has: page.locator(`.card-face[title="${card.name}"]`),
        }).first()
        await clickReady(source.locator('.card-face.is-attackable'), 'Wizard Cookie ordinary attack')
        await page.locator('[data-testid="attack-payment-panel"]:visible').waitFor({ state: 'visible' })
        evidence.paymentIds = []
        for (const paymentName of ['Nosy Wizard', 'GingerBrave']) {
          const support = page.locator('.bottom-field .support-card-wrap').filter({
            has: page.locator(`.card-face[title="${paymentName}"]`),
          }).first()
          const payment = support.locator('.card-face.is-targetable:not(.is-selected)')
          evidence.paymentIds.push(await support.getAttribute('data-card-instance-id'))
          await clickReady(payment, `pay printed PN attack with ${paymentName}`)
        }
        const target = evidence.before.opponent.battle.find(item => item.name === 'Devil Cookie')
        assert.ok(target?.id, 'the original physical attack target must be present')
        await clickReady(page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${target.id}"] .card-face[aria-label^="選擇攻擊目標："]`),
          'select Devil Cookie as the printed attack target')
        await waitForCommand(page, 'declare-attack')
        evidence.after = await waitForObservedState(page, current =>
          current.opponent.battle.some(item => item.name === 'Devil Cookie' && item.hp === 3) &&
          current.own.battle.some(item => item.name === card.name && item.rested) &&
          current.own.support.length === 2 && current.own.support.every(item => item.rested),
        'the paid PN attack did not deal one normal damage')
        evidence.trace = await trace(page)
        const attackTrace = evidence.trace.find(entry => entry.commandKind === 'declare-attack')
        assert.ok(attackTrace?.steps.join(' ').includes(card.name), 'formal attack trace must identify Wizard Cookie')
        assert.equal(evidence.after.opponent.battle.find(item => item.name === 'Devil Cookie')?.hp, 3)
        assert.equal(evidence.after.own.battle.find(item => item.name === card.name)?.hp, 3)
        assert.deepEqual(evidence.paymentIds.sort(), evidence.after.own.support.filter(item => item.rested).map(item => item.id).sort())
      } else if (testCase.flow === 'attack-unavailable') {
        assert.deepEqual(evidence.before.own.support.map(item => item.name), ['Nosy Wizard'])
        const source = page.locator('.bottom-field .combat-card-wrap').filter({
          has: page.locator(`.card-face[title="${card.name}"]`),
        }).first()
        const attack = source.locator('.card-face.is-attackable')
        assert.ok(!await visible(attack) || !await attack.first().isEnabled(),
          'Wizard Cookie cannot attack when only the purple symbol is payable')
        evidence.after = await state(page)
        evidence.trace = await trace(page)
        assert.deepEqual(evidence.after, evidence.before)
        assert.equal(evidence.trace.some(entry => entry.commandKind === 'declare-attack'), false)
      } else if (testCase.flow === 'block') {
        await response.waitFor({ state: 'visible' })
        const responseCard = response.locator('.modal-card-options button').filter({ hasText: card.name }).first()
        await clickReady(responseCard, 'select Wizard Cookie Blocker')
        const modal = page.locator('.blocker-response-modal:visible').first()
        await modal.waitFor({ state: 'visible' })
        const blocker = modal.locator('.blocker-candidates button:not(:disabled)').filter({ hasText: card.name }).first()
        await clickReady(blocker, 'select the physical Wizard Cookie')
        const payment = modal.locator('.blocker-payment-candidates button:not(.is-selected):not(:disabled)').first()
        evidence.paymentId = await payment.evaluate(node => node.closest('[data-card-instance-id]')?.getAttribute('data-card-instance-id'))
        evidence.paymentText = await payment.innerText()
        await clickReady(payment, 'pay one purple support')
        await clickReady(modal.getByRole('button', { name: '使用 Blocker', exact: true }), 'confirm Blocker')
        await waitForCommand(page, 'play-blocker')
        evidence.after = await waitForObservedState(page, current =>
          current.own.battle.some(item => item.name === card.name && item.hp === 2) &&
          current.own.battle.some(item => item.name === 'Devil Cookie' && item.hp === 4) &&
          current.own.support.some(item => item.rested),
        'the paid attack was not redirected to Wizard Cookie')
        evidence.trace = await trace(page)
        assert.ok(evidence.trace.some(entry => entry.commandKind === 'play-blocker' &&
          entry.steps.join(' ').includes(card.name)), 'the formal command trace must name Wizard Cookie')
        assert.equal(evidence.after.own.support.filter(item => item.rested).length, 1)
        assert.equal(evidence.after.own.battle.find(item => item.name === card.name)?.hp, 2)
        assert.equal(evidence.after.own.battle.find(item => item.name === 'Devil Cookie')?.hp, 4)
      } else if (testCase.flow === 'decline') {
        await response.waitFor({ state: 'visible' })
        const option = response.locator('.modal-card-options button').filter({ hasText: card.name }).first()
        assert.equal(await option.count(), 1)
        evidence.responseText = await response.innerText()
        await clickReady(response.getByRole('button', { name: '不發動', exact: true }), 'decline the optional Blocker')
        evidence.after = await waitForObservedState(page, current =>
          current.own.battle.some(item => item.name === card.name && item.hp === 3) &&
          current.own.battle.some(item => item.name === 'Devil Cookie' && item.hp === 3) &&
          current.own.support.every(item => !item.rested),
        'the declined attack did not hit its original target')
        evidence.trace = await trace(page)
        assert.equal(evidence.trace.some(entry => entry.commandKind === 'play-blocker'), false)
        assert.equal(evidence.after.own.support.some(item => item.rested), false)
      } else {
        if (await visible(response)) {
          evidence.responseText = await response.innerText()
          assert.equal(await response.locator('.modal-card-options button').filter({ hasText: card.name }).count(), 0,
            'Wizard Cookie must not appear without purple energy')
          const pass = response.getByRole('button', { name: '不發動', exact: true })
          if (await visible(pass)) await clickReady(pass, 'pass the unavailable Blocker response')
        }
        evidence.after = await waitForObservedState(page, current =>
          current.own.battle.some(item => item.name === card.name && item.hp === 3) &&
          current.own.battle.some(item => item.name === 'Devil Cookie' && item.hp === 3) &&
          current.own.support.every(item => !item.rested),
        'the unblocked attack did not settle on Devil Cookie')
        evidence.trace = await trace(page)
        assert.equal(evidence.trace.some(entry => entry.commandKind === 'play-blocker'), false)
        assert.equal(evidence.after.own.support.some(item => item.rested), false)
        assert.equal(evidence.after.own.battle.find(item => item.name === 'Devil Cookie')?.hp, 3)
      }
      await settleAnimation(page)
      evidence.finalState = await state(page)
      assert.deepEqual(errors, [])
      evidence.status = 'PASS'
    } catch (error) {
      evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
      evidence.trace ??= await trace(page).catch(() => [])
      evidence.finalState ??= await state(page).catch(() => null)
      evidence.debug = await page.evaluate(() => ({
        statusToasts: [...document.querySelectorAll('.status-toast')].filter(node => node.getBoundingClientRect().width > 0)
          .map(node => node.textContent?.trim()),
        dialogs: [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')]
          .filter(node => node.getBoundingClientRect().width > 0).map(node => node.textContent?.trim().slice(0, 900)),
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
