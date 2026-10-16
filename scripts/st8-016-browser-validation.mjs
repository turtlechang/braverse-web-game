import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cardNumber = 'ST8-016'
const document = JSON.parse(readFileSync(resolve(root, 'data/cards/official-st8-014-017.en.json'), 'utf8'))
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

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4186)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}`
const output = resolve(root, 'output/st6-st10/st8-016-browser')
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')
const distIndex = resolve(root, 'dist/index.html')
const browserExecutable = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)

// Never build implicitly. Root runs the Browser suite only after the final build.
if (!process.env.BRAVERSE_BASE_URL) {
  if (!existsSync(distIndex)) throw new Error('dist/index.html is missing; build must finish before Browser validation')
  const buildTime = statSync(distIndex).mtimeMs
  const buildInputs = [
    'src/App.tsx',
    'src/game/demo.ts',
    'src/game/st8-016-demo.ts',
    'src/game/generated-card-pool.ts',
    'src/game/battle.ts',
    'src/game/commands.ts',
    'src/game/effects/execute.ts',
    'src/game/effects/targeting.ts',
    'src/cards/official-effect-adapter.ts',
    'src/hooks/usePendingEffect.ts',
    'src/hooks/useMatchController.ts',
    'src/components/effects/EffectPanel.tsx',
    'src/components/battle/BattleResponseModals.tsx',
    'src/components/modals/GameModals.tsx',
  ].map(path => resolve(root, path)).filter(existsSync)
  const staleInputs = buildInputs.filter(path => statSync(path).mtimeMs > buildTime)
  if (staleInputs.length > 0) {
    throw new Error(`dist/index.html is older than ST8-016 sources; build required: ${staleInputs.join(', ')}`)
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
      // Preview or the supplied local server is still starting.
    }
    await wait(100)
  }
  throw new Error(`Braverse was not reachable at ${baseUrl}`)
}
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

const readTrace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({
  commandKind: entry.commandKind,
  summary: entry.summary,
  steps: entry.steps,
})))

const attachErrorCapture = page => {
  const errors = []
  const ignoredNetworkErrors = []
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
  page.on('console', message => {
    if (message.type() !== 'error') return
    const text = message.text()
    const url = message.location().url ?? ''
    const entry = `console: ${text} (${url || 'unknown URL'})`
    if ((url.endsWith('/favicon.ico') && text.includes('404')) ||
        (url.includes('cookierunbraverse.com/data/en_storage/') && /ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(text))) {
      ignoredNetworkErrors.push(entry)
    } else {
      errors.push(entry)
    }
  })
  return { errors, ignoredNetworkErrors }
}

const visible = async locator => await locator.count() > 0 && locator.first().isVisible().catch(() => false)
const activePanel = page => page.locator('.effect-panel:not(.is-complete):visible').first()
const clickPrimary = async page => {
  const action = page.locator('.effect-panel-primary-action:visible').last()
  await action.waitFor({ state: 'visible' })
  assert.equal(await action.isEnabled(), true, `effect panel action must be enabled: ${await action.innerText()}`)
  await action.click()
}
const waitForCommand = (page, kind) => page.waitForFunction(
  expected => (window.__braverseContractTrace ?? []).some(entry => entry.commandKind === expected),
  kind,
  { timeout: 12000 },
)

const recordPublicLog = async (page, sourceName) => {
  const toggle = page.getByTestId('battle-log-toggle')
  if (await toggle.count() === 0) return null
  await toggle.click()
  const entries = page.locator('.battle-log-entry')
  const matching = entries.filter({ hasText: sourceName }).first()
  await matching.waitFor({ state: 'visible' })
  const summary = await matching.innerText()
  await matching.click()
  const details = await page.locator('.battle-log-sidebar').innerText().catch(() => '')
  assert.match(`${summary}\n${details}`, new RegExp(sourceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  return { summary, details }
}

const viewports = [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]
const scenarios = [
  { id: 'condition-met-all-opponents', testState: 'card:ST8-016', expectEffect: true },
  { id: 'support-below-five-still-pays', testState: 'card-negative:ST8-016', expectEffect: false },
]
const results = []
let browser

try {
  await waitForPreview()
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })

  for (const viewport of viewports) for (const scenario of scenarios) {
    const page = await browser.newPage({ viewport })
    page.setDefaultTimeout(10000)
    const console = attachErrorCapture(page)
    const result = {
      card: cardNumber,
      scenario: scenario.id,
      testState: scenario.testState,
      viewport,
      status: 'FAIL',
      errors: console.errors,
      ignoredNetworkErrors: console.ignoredNetworkErrors,
      screenshots: [],
      originalArt: null,
    }
    const screenshot = async suffix => {
      const path = resolve(output, `${scenario.id}-${viewport.width}-${suffix}.png`)
      await page.screenshot({ path, fullPage: true })
      result.screenshots.push(path)
    }
    try {
      await page.route(card.imageUrl, route => route.fulfill({
        status: 200,
        contentType: 'image/webp',
        body: readFileSync(imagePath),
      }))
      const url = new URL('/', baseUrl)
      url.searchParams.set('test-state', scenario.testState)
      url.searchParams.set('contract-card', cardNumber)
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      await settleAnimation(page)
      result.before = await readState(page)
      result.traceBefore = await readTrace(page)
      assert.deepEqual(result.traceBefore, [], 'loading the physical-card route must not fabricate commands')
      assert.equal(result.before.own.hand.length, 1)
      assert.equal(result.before.own.hand[0].name, card.name)
      assert.equal(result.before.own.support.length, scenario.expectEffect ? 5 : 4)
      assert.deepEqual(result.before.opponent.battle.map(cookie => cookie.hp), [2, 1])
      assert.equal(result.before.own.battle.some(cookie => cookie.name === 'Wind Archer Cookie'), true,
        'both routes require Wind Archer in the battle area; the negative route fails only the five-support threshold')
      assert.equal(result.before.own.support.some(support => !support.rested), true,
        'one active green support must be available for G payment')

      await page.waitForFunction(imageUrl => [...document.images].some(image => image.src === imageUrl && image.complete && image.naturalWidth > 0), card.imageUrl)
      result.originalArt = await page.evaluate(imageUrl => {
        const image = [...document.images].find(candidate => candidate.src === imageUrl)
        return image ? { src: image.src, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight } : null
      }, card.imageUrl)
      assert.ok(result.originalArt?.naturalWidth > 0 && result.originalArt.naturalHeight > 0,
        'the original printed ST8-016 art must render from the locally verified card image')

      const item = page.getByRole('button', { name: card.name, exact: true })
      assert.equal(await item.count(), 1, 'the original Item in hand must be selectable')
      await item.click()
      await page.getByRole('button', { name: '使用', exact: true }).click()

      const paymentPanel = activePanel(page)
      await paymentPanel.waitFor({ state: 'visible' })
      assert.match(await paymentPanel.innerText(), new RegExp(card.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      const payments = paymentPanel.locator('.effect-candidates-payment .effect-candidate-entry > button')
      assert.equal(await payments.count(), 1, 'the fixture must provide exactly one active green payment source')
      await payments.first().click()
      await screenshot('payment-selected')
      assert.deepEqual(await readTrace(page), result.traceBefore, 'payment selection is a draft until activation')
      await clickPrimary(page)
      await waitForCommand(page, 'begin-play-item')
      await settleAnimation(page)

      result.afterActivation = await readState(page)
      result.traceAfterActivation = await readTrace(page)
      assert.equal(result.afterActivation.own.hand.length, 0, 'the activated Item must leave hand')
      assert.equal(result.afterActivation.own.trash, result.before.own.trash + 1, 'the Item must enter trash')
      assert.equal(result.afterActivation.own.support.length, result.before.own.support.length)
      assert.equal(result.afterActivation.own.support.filter(support => support.rested).length,
        result.before.own.support.filter(support => support.rested).length + 1,
        'G payment must rest exactly one support')
      assert.ok(result.traceAfterActivation.some(entry => entry.commandKind === 'begin-play-item'))
      await screenshot('after-activation')

      if (scenario.expectEffect) {
        await waitForCommand(page, 'resolve-ability-effect')
        await page.waitForFunction(() =>
          (window.__braverseContractTrace ?? []).filter(entry => entry.commandKind === 'resolve-next-damage').length >= 2,
          null,
          { timeout: 12000 },
        )
        const flipTargetId = result.before.opponent.battle[1]?.id
        await page.waitForFunction(expectedId => {
          const field = document.querySelector('.top-field')
          const target = [...(field?.querySelectorAll('.combat-card-wrap') ?? [])]
            .find(node => node.getAttribute('data-card-instance-id') === expectedId)
          const hpLabel = target?.querySelector('.hp-card-stack')?.getAttribute('aria-label') ?? ''
          const hp = Number(hpLabel.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN)
          return hp === 1 && (field?.querySelectorAll('.hand-card-wrap').length ?? -1) === 0
        }, flipTargetId, { timeout: 15000 })
        await settleAnimation(page)

        result.after = await readState(page)
        result.trace = await readTrace(page)
        const regularTarget = result.after.opponent.battle.find(cookie => cookie.id === result.before.opponent.battle[0]?.id)
        const flipTarget = result.after.opponent.battle.find(cookie => cookie.id === result.before.opponent.battle[1]?.id)
        assert.equal(regularTarget?.hp, 1, 'the 2-HP opposing Cookie must lose exactly one HP')
        assert.equal(flipTarget?.hp, 1, 'Basil Pesto Cookie FLIP must restore the one-HP target after damage')
        assert.equal(result.after.opponent.hand.length, result.before.opponent.hand.length - 1,
          'the opponent AI must pay Basil Pesto Cookie’s printed one-card FLIP cost')
        assert.equal(result.after.own.battle[0]?.hp, result.before.own.battle[0]?.hp,
          'the effect must not damage the Item controller’s Cookies')
        assert.equal(result.trace.filter(entry => entry.commandKind === 'resolve-next-damage').length, 2,
          'the all-Cookie sequence must resolve damage against both opposing Cookies')
        assert.ok(result.trace.some(entry => entry.commandKind === 'resolve-ability-effect'))
        assert.ok(result.trace.some(entry => `${entry.summary} ${entry.steps.join(' ')}`.includes(card.name)))
        result.publicLog = await recordPublicLog(page, card.name)
        assert.ok(result.publicLog, 'the public battle record must be available for the positive Item flow')
        assert.match(result.publicLog.details, /FLIP 代價：棄置手牌：Goblin Cookie/)
        assert.match(result.publicLog.details, /FLIP 效果結果：已發動「Basil Pesto Cookie」/)
        await screenshot('resolved')
      } else {
        await page.locator('.status-toast').filter({ hasText: /效果條件未滿足，效果未執行/ }).waitFor({ state: 'visible' })
        result.after = await readState(page)
        result.trace = await readTrace(page)
        assert.deepEqual(result.after.opponent.battle, result.before.opponent.battle,
          'four supports must fail the five-card condition and leave all Cookies unchanged')
        assert.deepEqual(result.after.own.battle, result.before.own.battle)
        assert.ok(result.trace.some(entry => entry.commandKind === 'begin-play-item'))
        assert.ok(result.trace.some(entry => `${entry.summary} ${entry.steps.join(' ')}`.includes('條件不成立')),
          'the public command record must explicitly report the unmet condition')
        assert.equal(result.trace.some(entry => entry.commandKind === 'resolve-ability-effect'), false)
        result.publicLog = await recordPublicLog(page, card.name)
        assert.ok(result.publicLog, 'the public battle record must be available for the paid no-op Item flow')
        await screenshot('condition-no-op')
      }

      assert.deepEqual(console.errors, [], 'unexpected browser console or page errors')
      result.status = 'PASS'
    } catch (error) {
      result.error = String(error.stack ?? error)
      result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 9000)
      result.finalState = await readState(page).catch(() => null)
      result.trace = await readTrace(page).catch(() => [])
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
    card: cardNumber,
    originalImage: { url: card.imageUrl, path: imagePath },
    baseUrl,
    viewports,
    scenarios,
    build: existsSync(distIndex) ? { path: distIndex, lastModified: statSync(distIndex).mtime.toISOString() } : null,
    results,
  }, null, 2))
  await browser?.close().catch(() => {})
  server?.kill()
}

console.log(JSON.stringify(results, null, 2))
const failures = results.filter(result => result.status !== 'PASS')
if (failures.length > 0) {
  throw new Error(`ST8-016 Browser validation failed for ${failures.length}/${results.length} scenarios; see ${resolve(output, 'results.json')}`)
}
