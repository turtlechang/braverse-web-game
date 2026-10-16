import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const candidatePath = resolve(root, 'data/candidates/st6-st10/official-st10.en.json')
const candidateDocument = existsSync(candidatePath) ? JSON.parse(readFileSync(candidatePath, 'utf8')) : undefined
const formalPath = resolve(root, 'data/cards/official-st10-010.en.json')
const formalDocument = existsSync(formalPath) ? JSON.parse(readFileSync(formalPath, 'utf8')) : undefined
const card = formalDocument?.cards.find(record => record.cardNumber === 'ST10-010') ??
  candidateDocument?.cards.find(record => record.cardNumber === 'ST10-010')
assert.ok(card?.imageUrl, 'original printed ST10-010 record is required')
const artPath = resolve(root, 'output/st6-st10/images/ST10-010.webp')
assert.ok(existsSync(artPath), 'original printed ST10-010 art is required')
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
const output = resolve(root, 'output/st6-st10/st10-010-browser')
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
    'src/game/demo.ts', 'src/game/st10-010-demo.ts', 'src/game/commands.ts',
    'src/game/generated-card-pool.ts', 'src/hooks/useMatchController.ts',
  ].map(path => resolve(root, path)).filter(existsSync)
  const stale = inputs.filter(path => statSync(path).mtimeMs > buildTime)
  if (stale.length) throw new Error(`dist/index.html is older than ST10-010 sources; build required: ${stale.join(', ')}`)
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
  { id: 'neutral-attack-one-damage', testState: 'card-attack:ST10-010', flow: 'attack' },
  { id: 'neutral-attack-no-energy', testState: 'card-attack-negative:ST10-010', flow: 'unavailable' },
]
const viewports = [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]
const requestedCase = process.env.ST10_010_BROWSER_SCENARIO
const requestedWidth = Number(process.env.ST10_010_BROWSER_VIEWPORT_WIDTH ?? 0)
const activeCases = requestedCase ? cases.filter(item => item.id === requestedCase) : cases
const activeViewports = requestedWidth ? viewports.filter(item => item.width === requestedWidth) : viewports
if (!activeCases.length) throw new Error(`Unknown ST10_010_BROWSER_SCENARIO: ${requestedCase}`)
if (!activeViewports.length) throw new Error(`Unknown ST10_010_BROWSER_VIEWPORT_WIDTH: ${requestedWidth}`)

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
    page.on('requestfailed', request => {
      if (!request.url().includes('cookierunbraverse.com')) errors.push(`requestfailed: ${request.url()}`)
    })
    const evidence = { id: testCase.id, viewport, status: 'FAIL', errors }
    try {
      await page.route(card.imageUrl, route => route.fulfill({ status: 200, contentType: 'image/webp', body: art }))
      const url = new URL('/', baseUrl)
      url.searchParams.set('test-state', testCase.testState)
      url.searchParams.set('contract-card', 'ST10-010')
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
      const source = page.locator('.bottom-field .combat-card-wrap').filter({
        has: page.locator(`.card-face[title="${card.name}"]`),
      }).first()
      assert.equal(await source.count(), 1, 'the original Prophet Cookie must appear exactly once in battle')

      if (testCase.flow === 'attack') {
        assert.equal(evidence.before.own.battle.find(item => item.name === card.name)?.hp, 2)
        assert.equal(evidence.before.own.support.length, 1, 'one off-color original support pays neutral N')
        assert.equal(evidence.before.opponent.battle.length, 1)
        const target = evidence.before.opponent.battle[0]
        assert.ok(target?.id && target.hp > 1, 'the original target must survive one printed damage')
        await page.screenshot({ path: resolve(output, `${testCase.id}-${viewport.width}-before.png`), fullPage: true })
        await clickReady(source.locator('.card-face.is-attackable'), 'Prophet Cookie ordinary attack')
        await page.locator('[data-testid="attack-payment-panel"]:visible').waitFor({ state: 'visible' })
        const payment = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').first()
        evidence.paymentId = await payment.evaluate(node => node.closest('[data-card-instance-id]')?.getAttribute('data-card-instance-id'))
        await clickReady(payment, 'pay neutral attack with one purple support')
        await clickReady(page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${target.id}"] .card-face[aria-label^="選擇攻擊目標："]`),
          'select the original opponent Cookie as the attack target')
        await waitForCommand(page, 'declare-attack')
        evidence.after = await waitForObservedState(page, current =>
          current.opponent.battle[0]?.hp === target.hp - 1 &&
          current.own.battle[0]?.rested === true &&
          current.own.support[0]?.rested === true,
        'the paid printed attack did not deal exactly one normal damage')
        evidence.trace = await trace(page)
        const attackTrace = evidence.trace.find(entry => entry.commandKind === 'declare-attack')
        assert.ok(attackTrace?.steps.join(' ').includes(card.name), 'formal attack trace must identify Prophet Cookie')
        assert.equal(evidence.after.own.battle[0]?.hp, 2, 'Prophet Cookie must retain its printed HP')
        assert.equal(evidence.after.own.trash, evidence.before.own.trash)
        assert.equal(evidence.after.own.break, evidence.before.own.break)
        assert.equal(evidence.after.opponent.trash, evidence.before.opponent.trash + 1,
          'one real target HP card must enter the trash after normal damage')
        assert.equal(evidence.after.opponent.break, evidence.before.opponent.break)
        assert.deepEqual(evidence.after.own.support.map(item => item.id), [evidence.paymentId])
        await page.screenshot({ path: resolve(output, `${testCase.id}-${viewport.width}-after.png`), fullPage: true })
      } else {
        assert.equal(evidence.before.own.support.length, 0)
        const attack = source.locator('.card-face.is-attackable')
        assert.ok(!await visible(attack) || !await attack.first().isEnabled(),
          'Prophet Cookie cannot declare its printed N attack without energy')
        evidence.after = await state(page)
        evidence.trace = await trace(page)
        assert.deepEqual(evidence.after, evidence.before)
        assert.equal(evidence.trace.some(entry => entry.commandKind === 'declare-attack'), false)
        await page.screenshot({ path: resolve(output, `${testCase.id}-${viewport.width}-blocked.png`), fullPage: true })
      }
      assert.deepEqual(errors, [], `Browser errors for ${testCase.id}`)
      evidence.status = 'PASS'
    } catch (error) {
      evidence.error = String(error)
      evidence.after ??= await state(page).catch(() => undefined)
      evidence.trace ??= await trace(page).catch(() => undefined)
    }
    results.push(evidence)
    await page.close()
  }
} finally {
  await browser?.close()
  server?.kill()
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  cardNumber: 'ST10-010',
  evidenceLevel: 'localhost-test-state; not formal match or online sync',
  viewports,
  results,
  summary: {
    total: results.length,
    passed: results.filter(result => result.status === 'PASS').length,
    failed: results.filter(result => result.status !== 'PASS').length,
  },
}
writeFileSync(resolve(output, 'results.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(report.summary))
if (report.summary.failed > 0) process.exitCode = 1
