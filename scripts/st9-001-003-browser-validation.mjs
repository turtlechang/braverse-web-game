import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cardNumbers = ['ST9-001', 'ST9-002', 'ST9-003']
const candidateDocument = JSON.parse(readFileSync(resolve(root, 'data/cards/official-st9-001-003.en.json'), 'utf8'))
const formalPath = resolve(root, 'data/cards/official-st9-001-003.en.json')
const formalDocument = existsSync(formalPath) ? JSON.parse(readFileSync(formalPath, 'utf8')) : undefined
const cards = new Map(cardNumbers.map(cardNumber => [
  cardNumber,
  formalDocument?.cards.find(record => record.cardNumber === cardNumber) ??
    candidateDocument.cards.find(record => record.cardNumber === cardNumber),
]))
for (const [cardNumber, card] of cards) {
  assert.ok(card?.imageUrl, `original printed ${cardNumber} record is required`)
  assert.ok(existsSync(resolve(root, `output/st6-st10/images/${cardNumber}.webp`)), `original printed ${cardNumber} image is required`)
}

const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4192)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}`
const output = resolve(root, 'output/st6-st10/st9-001-003-browser')
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
  const buildInputs = [
    'src/game/demo.ts', 'src/game/st9-001-003-demo.ts', 'src/game/battle.ts', 'src/game/commands.ts',
    'src/game/generated-card-pool.ts', 'src/cards/official-card-adapter.ts', 'src/hooks/useMatchController.ts',
    'src/components/battle/BattleResponseModals.tsx', 'src/components/battle/BattleRow.tsx',
    'src/components/modals/GameModals.tsx', 'src/components/effects/EffectPanel.tsx',
  ].map(path => resolve(root, path)).filter(existsSync)
  const staleInputs = buildInputs.filter(path => statSync(path).mtimeMs > buildTime)
  if (staleInputs.length > 0) throw new Error(`dist/index.html is older than ST9 sources; build required: ${staleInputs.join(', ')}`)
}

mkdirSync(output, { recursive: true })
const server = process.env.BRAVERSE_BASE_URL ? undefined : spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)
const wait = ms => new Promise(resolvePromise => setTimeout(resolvePromise, ms))
const waitForPreview = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(baseUrl)).ok) return
    } catch {
      // The local preview is still starting.
    }
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
  for (let step = 0; step < 30; step += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click({ timeout: 1000 }).catch(() => {})
    await page.waitForTimeout(100)
  }
}
const waitForCommand = (page, kind) => page.waitForFunction(
  expected => (window.__braverseContractTrace ?? []).some(entry => entry.commandKind === expected),
  kind,
  { timeout: 15000 },
)
const readState = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    const card = node => ({
      id: node.getAttribute('data-card-instance-id'),
      name: node.querySelector('.card-face')?.getAttribute('title') ?? node.querySelector('img')?.getAttribute('alt') ?? '',
      rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
    })
    return {
      deck: count('.deck-zone .resource-summary > strong'),
      trash: count('.discard-zone.resource-summary > strong'),
      hand: [...(field?.querySelectorAll('.hand-card-wrap') ?? [])].map(card),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(card),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({
        ...card(node),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
      })),
    }
  }
  return { own: side('bottom'), opponent: side('top') }
})
const readTrace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({
  commandKind: entry.commandKind, summary: entry.summary, steps: entry.steps,
})))
const captureErrors = page => {
  const errors = []
  const ignoredNetworkErrors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() !== 'error') return
    const url = message.location().url ?? ''
    const item = `${message.text()} (${url || 'unknown URL'})`
    if (url.endsWith('/favicon.ico') && message.text().includes('404')) ignoredNetworkErrors.push(item)
    else errors.push(item)
  })
  return { errors, ignoredNetworkErrors }
}

const cost = { 'ST9-001': 3, 'ST9-002': 1, 'ST9-003': 3 }
const damage = { 'ST9-001': 3, 'ST9-002': 1, 'ST9-003': 3 }
const scenarios = cardNumbers.flatMap(cardNumber => [
  { cardNumber, id: `${cardNumber}-printed-attack`, testState: `card:${cardNumber}`, positive: true },
  { cardNumber, id: `${cardNumber}-insufficient-energy`, testState: `card-negative:${cardNumber}`, positive: false },
])
const viewports = [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]
const results = []
let browser

try {
  await waitForPreview()
  browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) })
  for (const viewport of viewports) for (const scenario of scenarios) {
    const card = cards.get(scenario.cardNumber)
    const page = await browser.newPage({ viewport })
    page.setDefaultTimeout(12000)
    const console = captureErrors(page)
    const result = {
      card: scenario.cardNumber, scenario: scenario.id, testState: scenario.testState, viewport,
      status: 'FAIL', errors: console.errors, ignoredNetworkErrors: console.ignoredNetworkErrors,
      originalArt: null,
    }
    const screenshot = async suffix => {
      const path = resolve(output, `${scenario.id}-${viewport.width}-${suffix}.png`)
      await page.screenshot({ path, fullPage: true })
      result.screenshots ??= []
      result.screenshots.push(path)
    }
    try {
      await page.route(card.imageUrl, route => route.fulfill({
        status: 200, contentType: 'image/webp',
        body: readFileSync(resolve(root, `output/st6-st10/images/${scenario.cardNumber}.webp`)),
      }))
      const url = new URL('/', baseUrl)
      url.searchParams.set('test-state', scenario.testState)
      url.searchParams.set('contract-card', scenario.cardNumber)
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      result.before = await readState(page)
      result.traceBefore = await readTrace(page)
      assert.deepEqual(result.traceBefore, [], 'the test-state must not fabricate Browser commands')
      assert.equal(result.before.own.battle[0]?.name, card.name)
      assert.equal(result.before.own.battle[0]?.hp, card.hp)
      assert.equal(result.before.own.support.length, scenario.positive ? cost[scenario.cardNumber] : cost[scenario.cardNumber] - 1)
      assert.equal(result.before.opponent.battle[0]?.name, 'Devil Cookie')
      assert.equal(result.before.opponent.battle[0]?.hp, 4)

      await page.waitForFunction(imageUrl => [...document.images].some(image => image.src === imageUrl && image.complete && image.naturalWidth > 0), card.imageUrl)
      result.originalArt = await page.evaluate(imageUrl => {
        const image = [...document.images].find(candidate => candidate.src === imageUrl)
        return image ? { src: image.src, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight } : null
      }, card.imageUrl)
      assert.deepEqual([result.originalArt?.naturalWidth, result.originalArt?.naturalHeight], [746, 1038])

      const source = page.locator('.bottom-field .combat-card-wrap').filter({
        has: page.locator(`.card-face[title="${card.name}"]`),
      }).first()
      if (!scenario.positive) {
        const attack = source.locator('.card-face.is-attackable')
        assert.ok(!await visible(attack) || !await attack.first().isEnabled(), 'insufficient printed energy must prevent an attack')
        result.after = await readState(page)
        result.trace = await readTrace(page)
        assert.deepEqual(result.after, result.before)
        assert.equal(result.trace.some(entry => entry.commandKind === 'declare-attack'), false)
      } else {
        await clickReady(source.locator('.card-face.is-attackable'), `${scenario.cardNumber} attack`)
        const paymentPanel = page.locator('[data-testid="attack-payment-panel"]:visible')
        await paymentPanel.waitFor({ state: 'visible' })
        result.paymentIds = []
        for (let index = 0; index < cost[scenario.cardNumber]; index += 1) {
          const payment = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').first()
          const id = await payment.evaluate(node => node.closest('.support-card-wrap')?.getAttribute('data-card-instance-id'))
          result.paymentIds.push(id)
          await clickReady(payment, `${scenario.cardNumber} energy payment ${index + 1}`)
        }
        const target = result.before.opponent.battle[0]
        await clickReady(page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${target.id}"] .card-face[aria-label^="選擇攻擊目標："]`),
          `${scenario.cardNumber} physical target`)
        await waitForCommand(page, 'declare-attack')

        if (scenario.cardNumber === 'ST9-003') {
          await waitForCommand(page, 'resolve-flip')
        }

        await settleAnimation(page)
        result.after = await readState(page)
        result.trace = await readTrace(page)
        assert.equal(result.after.opponent.battle[0]?.hp, 4 - damage[scenario.cardNumber])
        assert.equal(result.after.own.battle[0]?.rested, true)
        assert.equal(result.after.own.support.filter(support => support.rested).length, cost[scenario.cardNumber])
        assert.deepEqual(result.paymentIds.sort(), result.after.own.support.filter(support => support.rested).map(support => support.id).sort())
        const attackTrace = result.trace.find(entry => entry.commandKind === 'declare-attack')
        assert.ok(attackTrace?.steps.join(' ').includes(card.name), 'formal command trace must identify the printed attacker')
        if (scenario.cardNumber === 'ST9-003') {
          const flipTrace = result.trace.find(entry => entry.commandKind === 'resolve-flip')
          assert.ok(flipTrace, 'the real FLIP response must reach the authoritative command')
          assert.match(flipTrace.summary, /Blue Whale Cookie.*FLIP/)
          assert.equal(result.after.opponent.hand.length, result.before.opponent.hand.length + 1)
          assert.equal(result.after.opponent.battle[0]?.hp, 1)
        }
      }
      assert.deepEqual(console.errors, [])
      await screenshot('resolved')
      result.status = 'PASS'
    } catch (error) {
      result.error = String(error.stack ?? error)
      result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 10000)
      result.finalState = await readState(page).catch(() => null)
      result.trace = await readTrace(page).catch(() => [])
    } finally {
      await page.screenshot({ path: resolve(output, `${scenario.id}-${viewport.width}-${result.status}.png`), fullPage: true }).catch(() => {})
      results.push(result)
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
