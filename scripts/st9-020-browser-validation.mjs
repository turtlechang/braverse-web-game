import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cardNumber = 'ST9-020'
const formalPath = resolve(root, 'data/cards/official-st9-020.en.json')
const candidatePath = resolve(root, 'data/cards/official-st9-020.en.json')
const document = JSON.parse(readFileSync(existsSync(formalPath) ? formalPath : candidatePath, 'utf8'))
const card = document.cards.find(record => record.cardNumber === cardNumber)
assert.ok(card?.imageUrl, `original printed ${cardNumber} record is required`)
const imagePath = resolve(root, `output/st6-st10/images/${cardNumber}.webp`)
assert.ok(existsSync(imagePath), `original printed ${cardNumber} image is required`)

const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4189)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}`
const output = resolve(root, 'output/st6-st10/st9-020-browser')
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
    'src/App.tsx', 'src/game/demo.ts', 'src/game/st9-020-demo.ts', 'src/game/generated-card-pool.ts',
    'src/game/commands.ts', 'src/game/effects/execute.ts', 'src/game/effects/targeting.ts',
    'src/cards/official-effect-adapter.ts', 'src/hooks/useMatchController.ts', 'src/hooks/usePendingEffect.ts',
    'src/components/battle/OnlineBattleView.tsx', 'src/components/battle/BattleRow.tsx',
    'src/components/effects/EffectPanel.tsx', 'src/components/modals/GameModals.tsx',
    'src/components/panels/BattleLogSidebar.tsx',
  ].map(path => resolve(root, path)).filter(existsSync)
  const staleInputs = buildInputs.filter(path => statSync(path).mtimeMs > buildTime)
  if (staleInputs.length > 0) {
    throw new Error(`dist/index.html is older than ST9-020 sources; build required: ${staleInputs.join(', ')}`)
  }
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
      // Preview or a supplied local server is still starting.
    }
    await wait(100)
  }
  throw new Error(`Braverse was not reachable at ${baseUrl}`)
}
const visible = async locator => await locator.count() > 0 && locator.first().isVisible().catch(() => false)
const settleAnimation = page => page.waitForFunction(() =>
  !document.querySelector('.match-animation-layer[data-playing="true"]') &&
  ![...document.querySelectorAll('button')].some(button => button.textContent?.trim() === '略過目前演出'),
null, { timeout: 20000 })
const readState = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    const card = node => ({
      id: node.getAttribute('data-card-instance-id'),
      name: node.querySelector('img')?.getAttribute('alt') ?? '',
      rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
    })
    const stage = field?.querySelector('.stage-zone .stage-card img')
    return {
      deck: count('.deck-zone .resource-summary > strong'),
      trash: count('.discard-zone.resource-summary > strong'),
      hand: [...(field?.querySelectorAll('.hand-card-wrap') ?? [])].map(card),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({
        ...card(node),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
      })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(card),
      stage: stage?.getAttribute('alt') ?? null,
    }
  }
  return { own: side('bottom'), opponent: side('top') }
})
const readTrace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({
  commandKind: entry.commandKind,
  summary: entry.summary,
  steps: entry.steps,
})))
const waitForCommand = (page, kind, count = 1) => page.waitForFunction(
  ({ expected, minimum }) => (window.__braverseContractTrace ?? []).filter(entry => entry.commandKind === expected).length >= minimum,
  { expected: kind, minimum: count },
  { timeout: 15000 },
)
const captureErrors = page => {
  const errors = []
  const ignoredNetworkErrors = []
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
  page.on('console', message => {
    if (message.type() !== 'error') return
    const url = message.location().url ?? ''
    const entry = `console: ${message.text()} (${url || 'unknown URL'})`
    if ((url.endsWith('/favicon.ico') && message.text().includes('404')) ||
        (url.includes('cookierunbraverse.com/data/en_storage/') && /ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(message.text()))) {
      ignoredNetworkErrors.push(entry)
    } else errors.push(entry)
  })
  return { errors, ignoredNetworkErrors }
}
const scenarios = [
  { id: 'low-hand-draw-one', testState: 'card:ST9-020', drawCount: 1, conditionMet: true },
  { id: 'low-hand-draw-zero', testState: 'card:ST9-020', drawCount: 0, conditionMet: true },
  { id: 'high-hand-paid-noop', testState: 'card-negative:ST9-020', drawCount: null, conditionMet: false },
]
const viewports = [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]
const results = []
let browser

try {
  await waitForPreview()
  browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) })
  for (const viewport of viewports) for (const scenario of scenarios) {
    const page = await browser.newPage({ viewport })
    page.setDefaultTimeout(10000)
    const console = captureErrors(page)
    const result = {
      card: cardNumber, scenario: scenario.id, testState: scenario.testState, viewport,
      status: 'FAIL', errors: console.errors, ignoredNetworkErrors: console.ignoredNetworkErrors,
      screenshots: [], originalArt: null,
    }
    const screenshot = async suffix => {
      const path = resolve(output, `${scenario.id}-${viewport.width}-${suffix}.png`)
      await page.screenshot({ path, fullPage: true })
      result.screenshots.push(path)
    }
    try {
      await page.route(card.imageUrl, route => route.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) }))
      const url = new URL('/', baseUrl)
      url.searchParams.set('test-state', scenario.testState)
      url.searchParams.set('contract-card', cardNumber)
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      await settleAnimation(page)
      result.before = await readState(page)
      result.traceBefore = await readTrace(page)
      assert.deepEqual(result.traceBefore, [], 'loading a main-phase fixture must not fabricate commands')
      assert.equal(result.before.own.hand[0].name, card.name)
      assert.equal(result.before.own.hand.length, scenario.conditionMet ? 3 : 5)
      assert.equal(result.before.own.stage, null)
      await page.waitForFunction(imageUrl => [...document.images].some(image => image.src === imageUrl && image.complete && image.naturalWidth > 0), card.imageUrl)
      result.originalArt = await page.evaluate(imageUrl => {
        const image = [...document.images].find(candidate => candidate.src === imageUrl)
        return image ? { src: image.src, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight } : null
      }, card.imageUrl)
      assert.deepEqual([result.originalArt?.naturalWidth, result.originalArt?.naturalHeight], [746, 1038], 'original ST9-020 art must render')

      assert.equal(result.before.own.support.length, 3)
      assert.equal(result.before.own.support.filter(support => !support.rested).length, 1,
        'the fixture must expose exactly one ready Support for the printed B placement cost')
      const hand = page.locator(`.bottom-field .hand-card-wrap[data-card-instance-id="${result.before.own.hand[0].id}"]`)
      await hand.locator('.hand-card').click()
      const place = hand.getByRole('button', { name: '放置', exact: true })
      await place.waitFor({ state: 'visible' })
      await place.click()
      const placement = page.locator('.stage-placement-modal[role="alertdialog"]:visible').first()
      await placement.waitFor({ state: 'visible' })
      result.placementWindow = await placement.innerText()
      assert.match(result.placementWindow, /放置費用/)
      const payments = placement.locator('.faint-payment-candidates > button')
      assert.equal(await payments.count(), 1, 'only the active blue Support should pay the B placement cost')
      await payments.first().click()
      const confirmPlace = placement.getByRole('button', { name: '支付並放置', exact: true })
      assert.equal(await confirmPlace.isEnabled(), true)
      await screenshot('blue-payment-selected')
      await confirmPlace.click()
      await waitForCommand(page, 'play-stage')
      result.afterPlacement = await readState(page)
      assert.equal(result.afterPlacement.own.stage, card.name)
      assert.equal(result.afterPlacement.own.hand.length, scenario.conditionMet ? 2 : 4)
      assert.equal(result.afterPlacement.own.support.filter(support => support.rested).length, 3,
        'the chosen blue Support must be rested after placement')

      await page.getByRole('button', { name: '啟動', exact: true }).click()
      const activationPanel = page.locator('.effect-panel:not(.is-complete):visible').first()
      await activationPanel.waitFor({ state: 'visible', timeout: 15000 })
      result.activationPanel = await activationPanel.innerText()
      assert.ok(result.activationPanel.includes(card.name), 'the original Stage must own its Activate effect')
      await screenshot('activation-confirmation')
      await activationPanel.getByRole('button', { name: '確認發動', exact: true }).last().click()
      await waitForCommand(page, 'begin-activate-stage')
      await settleAnimation(page)

      if (scenario.conditionMet) {
        const draw = page.locator('.draw-up-to-modal[role="alertdialog"]:visible').first()
        await draw.waitFor({ state: 'visible', timeout: 15000 })
        result.drawPrompt = await draw.innerText()
        assert.ok(result.drawPrompt.includes(card.name))
        const drawOption = draw.locator('.draw-up-to-option').nth(scenario.drawCount)
        await drawOption.click()
        const drawConfirm = draw.getByRole('button', {
          name: scenario.drawCount === 0 ? '略過抽牌' : `抽取 ${scenario.drawCount} 張牌`, exact: true,
        })
        await drawConfirm.click()
        await waitForCommand(page, 'resolve-draw-up-to')
      }

      result.after = await readState(page)
      result.trace = await readTrace(page)
      assert.equal(result.after.own.stage, card.name)
      assert.equal(result.after.own.hand.length, scenario.conditionMet ? 2 + scenario.drawCount : 4)
      assert.equal(result.after.own.deck, result.before.own.deck - (scenario.drawCount ?? 0))
      assert.equal(result.after.own.trash, result.before.own.trash)
      assert.equal(result.after.own.support.filter(support => support.rested).length, 3)
      assert.ok(result.trace.some(entry => entry.commandKind === 'play-stage'))
      assert.ok(result.trace.some(entry => entry.commandKind === 'begin-activate-stage'))
      if (scenario.conditionMet) {
        assert.ok(result.trace.some(entry => entry.commandKind === 'resolve-draw-up-to'))
      } else {
        const activationTrace = result.trace.find(entry => entry.commandKind === 'begin-activate-stage')
        assert.ok(activationTrace?.steps?.some(step => String(step).includes('條件不成立')),
          'the paid REST activation must publicly record the unmet hand-size condition')
        assert.ok(!result.trace.some(entry => entry.commandKind === 'resolve-draw-up-to'))
      }
      assert.deepEqual(console.errors, [])
      result.publicTrace = result.trace.filter(entry => ['play-stage', 'begin-activate-stage', 'resolve-draw-up-to'].includes(entry.commandKind))
      await screenshot(scenario.conditionMet ? `draw-${scenario.drawCount}` : 'condition-noop')
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

console.log(JSON.stringify(results, null, 2))
if (results.some(result => result.status !== 'PASS')) process.exitCode = 1
