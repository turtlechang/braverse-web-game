import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const candidatePath = resolve(root, 'data/candidates/st6-st10/official-st10.en.json')
const candidateDocument = existsSync(candidatePath) ? JSON.parse(readFileSync(candidatePath, 'utf8')) : undefined
const formalPath = resolve(root, 'data/cards/official-st10-012.en.json')
const formalDocument = existsSync(formalPath) ? JSON.parse(readFileSync(formalPath, 'utf8')) : undefined
const card = formalDocument?.cards.find(record => record.cardNumber === 'ST10-012') ??
  candidateDocument?.cards.find(record => record.cardNumber === 'ST10-012')
assert.ok(card?.imageUrl, 'original printed ST10-012 record is required')
const artPath = resolve(root, 'output/st6-st10/images/ST10-012.webp')
assert.ok(existsSync(artPath), 'original printed ST10-012 art is required')
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

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4198)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}`
const output = resolve(root, 'output/st6-st10/st10-012-browser')
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
    'src/game/demo.ts', 'src/game/st10-012-demo.ts', 'src/game/commands.ts',
    'src/game/generated-card-pool.ts', 'src/hooks/useMatchController.ts',
  ].map(path => resolve(root, path)).filter(existsSync)
  const stale = inputs.filter(path => statSync(path).mtimeMs > buildTime)
  if (stale.length) throw new Error(`dist/index.html is older than ST10-012 sources; build required: ${stale.join(', ')}`)
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
const settleAnimation = async page => {
  for (let step = 0; step < 18; step += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click({ timeout: 1000 }).catch(() => {})
    await page.waitForTimeout(80)
  }
}
const readTrace = page => page.evaluate(() => window.__braverseContractTrace ?? [])
const readState = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent?.match(/\d+/)?.[0] ?? 0)
    return {
      hand: count('.row-stat-hand .row-stat-value'),
      deck: count('.deck-zone .resource-summary > strong'),
      trash: count('button.discard-zone.resource-summary > strong'),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({
        id: node.getAttribute('data-card-instance-id'),
        name: node.querySelector('.card-face')?.getAttribute('title') ?? '',
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
      })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const findCookieSide = (snapshot, instanceId) => ['bottom', 'top'].flatMap(side => {
  const entry = snapshot?.[side]?.battle.find(cookie => cookie.id === instanceId)
  return entry ? [{ side, state: snapshot[side], entry }] : []
})[0]
const readArt = async cardFace => {
  const image = cardFace.locator('img').first()
  if (await image.count()) {
    return {
      alt: await image.getAttribute('alt'),
      src: await image.getAttribute('src'),
      loaded: await image.evaluate(node => node.complete && node.naturalWidth > 0),
      width: await image.evaluate(node => node.naturalWidth),
      height: await image.evaluate(node => node.naturalHeight),
    }
  }
  return { loaded: false, fallback: await cardFace.locator('.card-fallback').innerText().catch(() => '') }
}
const waitForTrace = (page, kind) => page.waitForFunction(
  expected => (window.__braverseContractTrace ?? []).some(entry => entry.commandKind === expected),
  kind,
  { timeout: 15000 },
)
const waitForFlipToClose = page => page.waitForFunction(() => {
  const modal = document.querySelector('.flip-response-modal')
  return !modal || getComputedStyle(modal).display === 'none' || modal.getClientRects().length === 0
})

const viewports = [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]
const results = []
let browser
try {
  await waitForPreview()
  browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) })
  for (const viewport of viewports) for (const scenario of ['positive', 'negative']) {
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
    const result = { cardNumber: 'ST10-012', scenario, viewport, status: 'FAIL', errors }
    try {
      await page.route(card.imageUrl, route => route.fulfill({ status: 200, contentType: 'image/webp', body: art }))
      const url = new URL('/', baseUrl)
      url.searchParams.set('test-state', `st10-012-flip:${scenario}`)
      url.searchParams.set('contract-card', 'ST10-012')
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      const modal = page.locator('.flip-response-modal').last()
      await modal.waitFor({ state: 'visible' })
      const flipCard = modal.locator('.flip-reveal-card').first()
      const image = await readArt(flipCard)
      assert.equal(image.loaded, true, 'original ST10-012 art must load in the actual FLIP modal')
      assert.equal(image.alt, card.name)
      assert.equal(image.src, card.imageUrl)
      assert.equal(image.width, artDimensions.width)
      assert.equal(image.height, artDimensions.height)
      assert.match(await modal.innerText(), /Discard 1 card|棄置 1 張手牌/)
      result.originalArt = image
      result.before = await readState(page)
      const bearerId = result.before.bottom.battle.find(entry => entry.id?.includes('ST10-006'))?.id
      assert.ok(bearerId, 'the original ST10-006 Cookie must bear the revealed FLIP')
      const bearerBefore = findCookieSide(result.before, bearerId)
      assert.ok(bearerBefore)
      assert.equal(bearerBefore.entry.hp, 1, 'one HP must remain after the real attack reveals ST10-012')
      const handCount = bearerBefore.state.hand
      const deckCount = bearerBefore.state.deck
      const trashCount = bearerBefore.state.trash
      const decisionImageName = `${scenario}-${viewport.width}x${viewport.height}-decision.png`
      await page.screenshot({ path: resolve(output, decisionImageName), fullPage: true })
      result.decisionScreenshot = resolve(output, decisionImageName)

      if (scenario === 'positive') {
        const payment = modal.locator('.flip-card-page button')
        assert.equal(await payment.count(), 1, 'the printed discard cost must expose one real hand card')
        await payment.first().click()
        const activate = modal.getByRole('button', { name: '發動 FLIP', exact: true })
        assert.equal(await activate.isEnabled(), true)
        await activate.click()
        await waitForTrace(page, 'resolve-flip')
      } else {
        assert.equal(handCount, 0, 'negative route must have no payment card')
        assert.equal(await modal.locator('.flip-card-page button').count(), 0)
        assert.equal(await modal.getByRole('button', { name: '發動 FLIP', exact: true }).isEnabled(), false)
        await modal.getByRole('button', { name: '不發動', exact: true }).click()
        await waitForTrace(page, 'resolve-flip')
      }

      await waitForFlipToClose(page)
      await settleAnimation(page)
      result.after = await readState(page)
      const bearerAfter = findCookieSide(result.after, bearerId)
      assert.ok(bearerAfter, 'the damaged bearer must stay in battle')
      result.bearerAfterSide = bearerAfter.side
      const trace = await readTrace(page)
      result.traceKinds = trace.map(entry => entry.commandKind)
      assert.ok(trace.some(entry => entry.commandKind === 'resolve-next-damage'))
      const flipTrace = trace.find(entry => entry.commandKind === 'resolve-flip')
      assert.ok(flipTrace)
      const flipText = `${flipTrace.summary ?? ''} ${flipTrace.steps?.join(' ') ?? ''}`
      if (scenario === 'positive') {
        assert.equal(bearerAfter.state.hand, handCount - 1)
        assert.equal(bearerAfter.state.deck, deckCount - 1)
        assert.equal(bearerAfter.state.trash, trashCount + 2)
        assert.equal(bearerAfter.entry.hp, 2, 'paid ST10-012 must add one HP after its revealed card leaves the stack')
        assert.match(flipText, /發動了|已發動/)
        assert.doesNotMatch(flipText, /不發動|未執行/)
      } else {
        assert.equal(bearerAfter.state.hand, handCount)
        assert.equal(bearerAfter.state.deck, deckCount)
        assert.equal(bearerAfter.state.trash, trashCount + 1)
        assert.equal(bearerAfter.entry.hp, 1, 'declining without the printed payment must leave HP unchanged')
        assert.match(flipText, /不發動|未執行/)
      }
      assert.deepEqual(errors, [])
      result.publicLog = flipText
      const imageName = `${scenario}-${viewport.width}x${viewport.height}.png`
      await page.screenshot({ path: resolve(output, imageName), fullPage: true })
      result.screenshot = resolve(output, imageName)
      result.status = 'PASS'
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error)
      result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 8000)
      result.traceKinds = (await readTrace(page).catch(() => [])).map(entry => entry.commandKind)
    }
    results.push(result)
    console.log(result.status, scenario, `${viewport.width}x${viewport.height}`, result.error ?? '')
    await page.close()
  }
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    evidenceLevel: 'localhost test-state Browser evidence; not full-match or online acceptance',
    scope: 'ST10-012 original FLIP art, actual attack reveal, discard payment, HP gain, and no-hand skip at desktop and tablet sizes',
    cardNumber: 'ST10-012',
    summary: { total: results.length, passed: results.filter(result => result.status === 'PASS').length, failed: results.filter(result => result.status === 'FAIL').length },
    artDimensions,
    results,
  }
  writeFileSync(resolve(output, 'results.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ ...report, outputPath: resolve(output, 'results.json') }, null, 2))
  process.exitCode = report.summary.failed > 0 ? 1 : 0
} finally {
  await browser?.close()
  if (server && server.exitCode === null) server.kill()
}
