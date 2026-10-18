import assert from 'node:assert/strict'
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4185)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}`
const output = resolve(root, 'output/st6-st10/st8-015')
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')
const distIndex = resolve(root, 'dist/index.html')
const browserExecutable = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)

// Never build implicitly: when using Vite preview, stop if any source used by
// this card's route/effect/UI changed after dist was generated.
if (!process.env.BRAVERSE_BASE_URL) {
  if (!existsSync(distIndex)) throw new Error('dist/index.html is missing; build must be completed before Browser validation')
  const buildTime = statSync(distIndex).mtimeMs
  const buildInputs = [
    'src/App.tsx',
    'src/game/demo.ts',
    'src/game/st8-015-demo.ts',
    'src/game/generated-card-pool.ts',
    'src/game/commands.ts',
    'src/game/effects/execute.ts',
    'src/game/effects/targeting.ts',
    'src/cards/official-effect-adapter.ts',
    'src/hooks/usePendingEffect.ts',
    'src/components/effects/EffectPanel.tsx',
  ].map(path => resolve(root, path)).filter(existsSync)
  const staleInputs = buildInputs.filter(path => statSync(path).mtimeMs > buildTime)
  if (staleInputs.length > 0) {
    throw new Error(`dist/index.html is older than ST8-015 source changes; build required before Browser validation: ${staleInputs.join(', ')}`)
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
      // Preview or the supplied dev server is still starting.
    }
    await wait(100)
  }
  throw new Error(`Braverse was not reachable at ${baseUrl}`)
}
const settle = page => page.waitForFunction(() =>
  !document.querySelector('.match-animation-layer[data-playing="true"]') &&
  ![...document.querySelectorAll('button')].some(button => button.textContent?.trim() === '略過目前演出'),
null, { timeout: 20000 })

const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    const card = node => ({
      id: node.getAttribute('data-card-instance-id'),
      name: node.querySelector('img')?.getAttribute('alt') ?? '',
      rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
    })
    return {
      deck: count('.deck-zone .resource-summary > strong'),
      trash: count('.discard-zone.resource-summary > strong'),
      hand: [...(field?.querySelectorAll('.hand-card-wrap') ?? [])].map(card),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({
        ...card(node),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
      })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(card),
    }
  }
  return { own: side('bottom'), opponent: side('top') }
})

const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({
  commandKind: entry.commandKind,
  summary: entry.summary,
  steps: entry.steps,
})))

const observeConsole = page => {
  const errors = []
  const ignoredNetworkErrors = []
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
  page.on('console', message => {
    if (message.type() !== 'error') return
    const text = message.text()
    const url = message.location().url ?? ''
    const entry = `console: ${text} (${url || 'unknown URL'})`
    if (url.endsWith('/favicon.ico') && text.includes('404')) {
      ignoredNetworkErrors.push(entry)
    } else if (url.includes('cookierunbraverse.com/data/en_storage/') && /ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(text)) {
      ignoredNetworkErrors.push(entry)
    } else {
      errors.push(entry)
    }
  })
  return { errors, ignoredNetworkErrors }
}

const viewports = [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]
const scenarios = [
  { id: 'positive-return-new', testState: 'card:ST8-015', placeOne: true, returnKind: 'new' },
  { id: 'positive-return-other', testState: 'card:ST8-015', placeOne: true, returnKind: 'other' },
  { id: 'positive-zero-then-other', testState: 'card:ST8-015', placeOne: false, returnKind: 'other' },
  { id: 'negative-no-wind-skip-then', testState: 'card-negative:ST8-015', placeOne: null, returnKind: 'none' },
  { id: 'negative-no-wind-return-other', testState: 'card-negative:ST8-015', placeOne: null, returnKind: 'other' },
]
const results = []
let browser

const activePanel = page => page.locator('.effect-panel:not(.is-complete):visible').first()
const primaryAction = page => activePanel(page).locator('.effect-panel-primary-action:visible').last()
const clickPrimary = async page => {
  const button = primaryAction(page)
  await button.waitFor({ state: 'visible' })
  assert.ok(await button.isEnabled(), `effect action must be enabled: ${await button.innerText()}`)
  await button.click()
}
const waitForCommand = (page, kind) => page.waitForFunction(
  expected => (window.__braverseContractTrace ?? []).some(entry => entry.commandKind === expected),
  kind,
  { timeout: 10000 },
)

try {
  await waitForPreview()
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })

  for (const viewport of viewports) for (const scenario of scenarios) {
    const page = await browser.newPage({ viewport })
    page.setDefaultTimeout(10000)
    const console = observeConsole(page)
    const result = {
      card: 'ST8-015', scenario: scenario.id, testState: scenario.testState,
      viewport, status: 'FAIL', errors: [], consoleErrors: console.errors,
      ignoredNetworkErrors: console.ignoredNetworkErrors, screenshots: [],
    }
    const screenshot = async suffix => {
      const path = resolve(output, `${scenario.id}-${viewport.width}-${suffix}.png`)
      await page.screenshot({ path, fullPage: true })
      result.screenshots.push(path)
    }
    try {
      await page.goto(`${baseUrl}/?test-state=${scenario.testState}&contract-card=ST8-015`, { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      await settle(page)
      result.before = await state(page)
      result.traceBefore = await trace(page)
      assert.equal(result.before.own.hand.length, 1, 'the original ST8-015 Item must start in hand')
      assert.match(result.before.own.hand[0].name, /Essence of the Tempest/)
      assert.equal(result.before.own.support.filter(support => !support.rested && support.id.includes('ST3-019')).length, 2,
        'the fixture must expose exactly two active green supports for GG')
      assert.equal(result.before.own.battle.some(cookie => /Wind Archer Cookie/.test(cookie.name)),
        scenario.testState === 'card:ST8-015', 'positive/negative fixture must differ only by the Wind Archer witness')
      assert.deepEqual(result.traceBefore, [], 'loading a test-state must not fabricate formal commands')

      const item = page.getByRole('button', { name: 'Essence of the Tempest', exact: true })
      assert.equal(await item.count(), 1, 'the physical Item must be present and selectable')
      await item.click()
      const use = page.getByRole('button', { name: '使用', exact: true })
      assert.equal(await use.count(), 1, 'the Item must expose its normal use action')
      await use.click()

      const paymentPanel = activePanel(page)
      await paymentPanel.waitFor({ state: 'visible' })
      assert.match(await paymentPanel.innerText(), /Essence of the Tempest/)
      const paymentButtons = paymentPanel.locator('.effect-candidates-payment .effect-candidate-entry > button')
      assert.equal(await paymentButtons.count(), 2, 'GG must be payable from the fixture supports')
      for (let index = 0; index < 2; index += 1) {
        const unselected = paymentPanel.locator('.effect-candidates-payment .effect-candidate-entry > button:not(.is-selected)')
        assert.ok(await unselected.count() > 0, 'select two distinct payment cards')
        await unselected.first().click()
      }
      await screenshot('payment')
      assert.deepEqual(await trace(page), [], 'selected payment is a draft until the player confirms')

      // The wizard exposes the printed 0/1 mode before it evaluates the
      // conditional effect. Without Wind Archer, deliberately select one to
      // verify the condition blocks placement but preserves the independent Then.
      await clickPrimary(page)
      const choices = activePanel(page).locator('.effect-candidates-choice button')
      await choices.first().waitFor({ state: 'visible' })
      assert.equal(await choices.count(), 2, 'the up-to-one placement must offer exactly one or zero')
      await choices.nth(scenario.placeOne === false ? 1 : 0).click()
      await screenshot('placement-choice')
      await clickPrimary(page)
      await clickPrimary(page)
      await waitForCommand(page, 'begin-play-item')
      await settle(page)
      result.afterItemActivation = await state(page)
      result.traceAfterItemActivation = await trace(page)
      assert.equal(result.afterItemActivation.own.hand.length, 0, 'the used Item must leave hand')
      assert.equal(result.afterItemActivation.own.trash, result.before.own.trash + 1, 'the Item must enter trash')
      const placedCount = scenario.placeOne === true ? 1 : 0
      assert.equal(result.afterItemActivation.own.support.filter(support => support.rested).length,
        result.before.own.support.filter(support => support.rested).length + 2 + placedCount,
        'the two GG supports are rested, with the optional newly placed card also rested')
      assert.equal(result.afterItemActivation.own.deck, result.before.own.deck - placedCount,
        'the selected first effect must resolve before the separate Then target is chosen')

      if (scenario.placeOne !== null) {
        await screenshot('placement-resolved-before-then')
      }

      const thenPanel = activePanel(page)
      await thenPanel.locator('.effect-candidates-target').waitFor({ state: 'visible' })
      await settle(page)
      result.afterPlacement = await state(page)
      result.traceBeforeThen = await trace(page)
      const oldTarget = result.before.own.support.find(support => (support.id ?? '').includes('ST1-016'))
      assert.ok(oldTarget, 'the fixture must contain an independent existing support for the Then')

      let returnedCard
      if (scenario.returnKind === 'new') {
        const beforeIds = new Set(result.before.own.support.map(support => support.id))
        const newlyPlaced = result.afterPlacement.own.support.find(support => !beforeIds.has(support.id))
        assert.ok(newlyPlaced, 'the selected top card must enter support before the Then')
        assert.equal(newlyPlaced.rested, true, 'the top card must enter support rested')
        returnedCard = newlyPlaced
      } else if (scenario.returnKind === 'other') {
        returnedCard = oldTarget
      }

      const thenButtons = thenPanel.locator('.effect-candidates-target .effect-candidate-entry > button')
      if (returnedCard) {
        const targetButton = thenButtons.filter({ hasText: returnedCard.name })
        assert.equal(await targetButton.count(), 1, `Then must offer the intended support card: ${returnedCard.name}`)
        await targetButton.click()
      } else {
        assert.ok(await thenButtons.count() > 0, 'the optional Then should still list the existing supports')
      }
      await screenshot('then-selection')
      await clickPrimary(page)
      await settle(page)

      result.after = await state(page)
      result.trace = await trace(page)
      const kinds = result.trace.map(entry => entry.commandKind)
      assert.ok(kinds.includes('begin-play-item'), `expected the formal Item command, got ${kinds.join(', ')}`)
      assert.ok(kinds.includes('resolve-ability-effect'), `expected formal effect-resolution commands, got ${kinds.join(', ')}`)
      assert.equal(result.after.own.hand.length, returnedCard ? 1 : 0,
        'only the optional support-to-hand Then may add a card to hand')
      assert.equal(result.after.own.trash, result.before.own.trash + 1)
      assert.ok(result.trace.some(entry =>
        entry.summary.includes('ST8-015') && entry.summary.includes('Essence of the Tempest')),
        'the command trace must identify the physical Item')

      if (scenario.placeOne === true) {
        assert.equal(result.after.own.deck, result.before.own.deck - 1, 'placing one must consume exactly the top card')
        const newSupport = result.afterPlacement.own.support.find(support =>
          !result.before.own.support.some(previous => previous.id === support.id),
        )
        assert.ok(newSupport?.rested, 'the top card is rested at the intermediate Then checkpoint')
        if (scenario.returnKind === 'new') {
          assert.ok(result.after.own.hand.some(card => card.name === newSupport.name),
            'the newly placed rested card must be a legal Then return target')
          assert.ok(!result.after.own.support.some(support => support.id === newSupport.id))
        } else {
          assert.ok(result.after.own.support.some(support => support.id === newSupport.id && support.rested),
            'returning another support must leave the newly placed card rested in support')
          assert.ok(result.after.own.hand.some(card => card.name === oldTarget.name))
        }
      } else if (scenario.placeOne === false) {
        assert.equal(result.after.own.deck, result.before.own.deck, 'choosing zero must leave the deck unchanged')
        assert.equal(result.afterPlacement.own.support.length, result.afterItemActivation.own.support.length,
          'choosing zero must not add a support card')
        assert.ok(result.after.own.hand.some(card => card.name === oldTarget.name),
          'the Then still returns an existing support after choosing zero')
      } else {
        assert.equal(result.after.own.deck, result.before.own.deck, 'no Wind Archer must skip deck-to-support')
        assert.equal(result.afterPlacement.own.support.length, result.afterItemActivation.own.support.length,
          'the no-Wind condition must not add a support')
        if (returnedCard) assert.ok(result.after.own.hand.some(card => card.name === oldTarget.name))
      }

      assert.deepEqual(console.errors, [], 'unexpected browser console/page errors')
      result.status = 'PASS'
    } catch (error) {
      result.error = String(error.stack ?? error)
      result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 7000)
      result.finalState = await state(page).catch(() => null)
      result.trace = await trace(page).catch(() => [])
    } finally {
      const finalScreenshot = resolve(output, `${scenario.id}-${viewport.width}-${result.status}.png`)
      await page.screenshot({ path: finalScreenshot, fullPage: true }).catch(() => {})
      result.screenshots.push(finalScreenshot)
      results.push(result)
      await page.close()
    }
  }
} finally {
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({
    card: 'ST8-015',
    baseUrl,
    viewports,
    scenarios: scenarios.map(({ id, testState, placeOne, returnKind }) => ({ id, testState, placeOne, returnKind })),
    build: existsSync(distIndex) ? { path: distIndex, lastModified: statSync(distIndex).mtime.toISOString() } : null,
    results,
  }, null, 2))
  await browser?.close().catch(() => {})
  server?.kill()
}

console.log(JSON.stringify(results, null, 2))
const failures = results.filter(result => result.status !== 'PASS')
if (failures.length > 0) {
  throw new Error(`ST8-015 Browser validation failed for ${failures.length}/${results.length} scenarios; see ${resolve(output, 'results.json')}`)
}
