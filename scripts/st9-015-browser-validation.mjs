import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cardNumber = 'ST9-015'
const candidateDocument = JSON.parse(readFileSync(resolve(root, 'data/cards/official-st9-015.en.json'), 'utf8'))
const formalPath = resolve(root, 'data/cards/official-st9-015.en.json')
const formalDocument = existsSync(formalPath) ? JSON.parse(readFileSync(formalPath, 'utf8')) : undefined
const card = formalDocument?.cards.find(record => record.cardNumber === cardNumber) ??
  candidateDocument.cards.find(record => record.cardNumber === cardNumber)
assert.ok(card?.imageUrl, `original printed ${cardNumber} record is required`)
assert.equal(card.type, 'item')
assert.equal(card.name, 'Essence of the Ocean')
assert.equal(card.color, 'BLUE')
assert.equal(card.skill.text,
  '<{B}> If there are 5 cards or less in your hand, draw up to 1 card from your deck. Then, select up to 1 of your [Sea Fairy Cookie] with 5 or less HP remaining. That Cookie gains +1 HP.')

const artPath = resolve(root, `output/st6-st10/images/${cardNumber}.webp`)
assert.ok(existsSync(artPath), `original printed ${cardNumber} art is required`)
const originalArt = readFileSync(artPath)
assert.equal(originalArt.toString('ascii', 0, 4), 'RIFF', 'original art must be a WebP RIFF file')
assert.equal(originalArt.toString('ascii', 8, 12), 'WEBP', 'original art must be WebP')
assert.equal(originalArt.toString('ascii', 12, 16), 'VP8X', 'original art must use the extended WebP header')
const artDimensions = { width: originalArt.readUIntLE(24, 3) + 1, height: originalArt.readUIntLE(27, 3) + 1 }

const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4215)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}`
const output = resolve(root, 'output/st6-st10/st9-015-browser')
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
    'src/cards/contracts/ledger.ts', 'src/cards/official-effect-adapter.ts',
    'src/game/demo.ts', 'src/game/st9-015-demo.ts', 'src/game/commands.ts',
    'src/game/generated-card-pool.ts', 'src/hooks/usePendingEffect.ts', 'src/hooks/useMatchController.ts',
    'src/components/effects/EffectPanel.tsx', 'src/components/modals/GameModals.tsx', 'src/App.tsx',
  ].map(path => resolve(root, path)).filter(existsSync)
  const staleInputs = buildInputs.filter(path => statSync(path).mtimeMs > buildTime)
  if (staleInputs.length > 0) throw new Error(`dist/index.html is older than ST9-015 sources; build required: ${staleInputs.join(', ')}`)
}

mkdirSync(output, { recursive: true })
const server = process.env.BRAVERSE_BASE_URL ? undefined : spawn(
  process.execPath, [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
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
  for (let step = 0; step < 20; step += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click({ timeout: 1000 }).catch(() => {})
    await page.waitForTimeout(100)
  }
}
const waitForCommand = (page, kind) => page.waitForFunction(
  expected => (window.__braverseContractTrace ?? []).some(entry => entry.commandKind === expected),
  kind, { timeout: 20000 },
)
const readState = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent?.match(/\d+/)?.[0] ?? 0)
    const readCard = node => {
      const face = node.querySelector('.card-face')
      return {
        id: node.getAttribute('data-card-instance-id'),
        name: face?.getAttribute('title') ?? node.querySelector('img')?.getAttribute('alt') ?? '',
        rested: face?.classList.contains('is-rested') === true && !face.classList.contains('is-selected'),
      }
    }
    return {
      deck: count('.deck-zone .resource-summary > strong'),
      trash: count('.discard-zone.resource-summary > strong'),
      hand: [...(field?.querySelectorAll('.hand-card-wrap') ?? [])].map(readCard),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(readCard),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({
        ...readCard(node),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
      })),
    }
  }
  return { own: side('bottom'), opponent: side('top') }
})
const readTrace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({
  commandKind: entry.commandKind, summary: entry.summary, steps: entry.steps, payload: entry.payload,
})))
const waitForState = async (page, predicate, label) => {
  let latest
  for (let attempt = 0; attempt < 120; attempt += 1) {
    latest = await readState(page)
    if (predicate(latest)) return latest
    await page.waitForTimeout(150)
  }
  throw new Error(`${label}; latest visible state: ${JSON.stringify(latest)}`)
}
const captureErrors = page => {
  const errors = []
  const ignoredNetworkErrors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() !== 'error') return
    const url = message.location().url ?? ''
    const value = `${message.text()} (${url || 'unknown URL'})`
    if (url.endsWith('/favicon.ico') && message.text().includes('404') ||
        url.includes('cookierunbraverse.com/data/en_storage/') && /ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(message.text())) {
      ignoredNetworkErrors.push(value)
    } else errors.push(value)
  })
  return { errors, ignoredNetworkErrors }
}

const scenarios = [
  { id: 'draw-zero-and-heal-five-hp', testState: 'card:ST9-015', kind: 'draw-and-heal', drawCount: 0, heal: true },
  { id: 'draw-one-and-heal-five-hp', testState: 'card:ST9-015', kind: 'draw-and-heal', drawCount: 1, heal: true },
  { id: 'six-cards-after-use-still-heals', testState: 'card-skill-negative:ST9-015', kind: 'high-hand', heal: true },
  { id: 'draw-zero-and-skip-heal', testState: 'card:ST9-015', kind: 'draw-and-heal', drawCount: 0, heal: false },
  { id: 'no-blue-support', testState: 'card-negative:ST9-015', kind: 'unpayable' },
]
const viewports = [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]
const requestedScenario = process.env.ST9_015_BROWSER_SCENARIO
const requestedWidth = Number(process.env.ST9_015_BROWSER_VIEWPORT_WIDTH ?? 0)
const activeScenarios = requestedScenario ? scenarios.filter(scenario => scenario.id === requestedScenario) : scenarios
const activeViewports = requestedWidth ? viewports.filter(viewport => viewport.width === requestedWidth) : viewports
if (!activeScenarios.length) throw new Error(`Unknown ST9_015_BROWSER_SCENARIO: ${requestedScenario}`)
if (!activeViewports.length) throw new Error(`Unknown ST9_015_BROWSER_VIEWPORT_WIDTH: ${requestedWidth}`)

const results = []
let browser
try {
  await waitForPreview()
  browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) })
  for (const viewport of activeViewports) for (const scenario of activeScenarios) {
    const result = { card: cardNumber, ...scenario, viewport, status: 'FAIL', errors: [], ignoredNetworkErrors: [], originalArt: null }
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    const consoleErrors = captureErrors(page)
    try {
      page.setDefaultTimeout(10000)
      await page.route(card.imageUrl, route => route.fulfill({ status: 200, contentType: 'image/webp', body: originalArt }))
      const url = new URL('/', baseUrl)
      url.searchParams.set('test-state', scenario.testState)
      url.searchParams.set('contract-card', cardNumber)
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      await settleAnimation(page)
      result.before = await readState(page)
      result.traceBefore = await readTrace(page)
      assert.deepEqual(result.traceBefore, [], 'test-state setup must not fabricate Browser commands')
      assert.equal(result.before.own.hand.some(entry => entry.name === card.name), true, 'printed Item must start in hand')
      const fiveHpSeaFairy = result.before.own.battle.find(entry => entry.id.includes('-BS2-029-'))
      const sixHpSeaFairy = result.before.own.battle.find(entry => entry.id.includes('-ST9-006-'))
      const ownNonSeaFairy = result.before.own.battle.find(entry => entry.id.includes('-ST9-007-'))
      const opposingSeaFairy = result.before.opponent.battle.find(entry => entry.id.includes('-BS2-029-'))
      assert.equal(fiveHpSeaFairy?.hp, 5, 'original five-HP Sea Fairy must be present')
      assert.equal(sixHpSeaFairy?.hp, 6, 'original six-HP Sea Fairy must be present as a boundary control')
      assert.equal(ownNonSeaFairy?.hp, 5, 'the real own Peppermint Cookie must be present as a wrong-name target')
      assert.equal(opposingSeaFairy?.hp, 5, 'the real opposing Sea Fairy must be present as a wrong-owner target')
      await page.waitForFunction(imageUrl => [...document.images].some(image =>
        image.src === imageUrl && image.complete && image.naturalWidth > 0), card.imageUrl)
      result.originalArt = await page.evaluate(imageUrl => {
        const image = [...document.images].find(candidate => candidate.src === imageUrl)
        return image ? { src: image.src, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight } : null
      }, card.imageUrl)
      assert.deepEqual([result.originalArt?.naturalWidth, result.originalArt?.naturalHeight],
        [artDimensions.width, artDimensions.height], 'original ST9-015 art must render at native dimensions')
      await page.screenshot({ path: resolve(output, `${scenario.id}-${viewport.width}-before.png`), fullPage: true })

      const useButton = page.getByRole('button', { name: card.name, exact: true }).first()
      await clickReady(useButton, 'select the printed Item')
      const action = page.getByRole('button', { name: '使用', exact: true }).last()
      if (scenario.kind === 'unpayable') {
        if (await action.count() > 0 && await action.isEnabled()) {
          await clickReady(action, 'open the blue energy payment UI')
          const blockedPanel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
          await blockedPanel.waitFor({ state: 'visible' })
          result.paymentCandidateCount = await blockedPanel.locator('.effect-candidates-payment .effect-candidate-entry > button').count()
          assert.equal(result.paymentCandidateCount, 0, 'red Support must not be offered for the printed B payment')
          assert.equal(await blockedPanel.locator('.effect-panel-primary-action:visible').last().isDisabled(), true)
          result.blockedAt = 'blue-support-payment'
        } else {
          result.blockedAt = await action.count() === 0 ? 'no-use-action' : 'disabled-use-action'
        }
        result.after = await readState(page)
        assert.deepEqual(result.after, result.before, 'no-blue-support fixture must preserve all zones')
        assert.deepEqual(await readTrace(page), [], 'unpayable B must not submit a command')
      } else {
        await clickReady(action, 'open the physical blue payment UI')
        const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
        await panel.waitFor({ state: 'visible' })
        result.paymentPanel = await panel.innerText()
        const payments = panel.locator('.effect-candidates-payment .effect-candidate-entry > button')
        assert.equal(await payments.count(), 1, 'exactly one active blue Support must pay B')
        result.paymentChoice = await payments.first().innerText()
        await clickReady(payments.first(), 'select the original blue Support')
        assert.deepEqual(await readTrace(page), [], 'Support selection must remain an uncommitted draft')
        assert.deepEqual(await readState(page), result.before, 'draft B selection must not change zones')
        await clickReady(panel.locator('.effect-panel-primary-action:visible').last(), 'continue from B payment to the optional Then target')
        const activationTargets = panel.locator('.effect-candidates-target .effect-candidate-entry > button')
        assert.equal(await activationTargets.count(), 1,
          'the six-HP Sea Fairy must be excluded and only the original five-HP Cookie offered')
        if (scenario.kind === 'high-hand' || scenario.heal) {
          await clickReady(activationTargets.first(), 'draft the eligible five-HP Sea Fairy target')
        }
        assert.deepEqual(await readTrace(page), [], 'target choice must remain an uncommitted Item draft')
        assert.deepEqual(await readState(page), result.before, 'draft Then targeting must not change game zones')
        await clickReady(panel.locator('.effect-panel-primary-action:visible').last(), 'confirm the paid Item draft')
        await waitForCommand(page, 'begin-play-item')
        await settleAnimation(page)

        result.afterItem = await readState(page)
        const startingHandCount = scenario.kind === 'high-hand' ? 7 : 6
        const afterItemHandCount = startingHandCount - 1
        assert.equal(result.before.own.hand.length, startingHandCount)
        assert.equal(result.afterItem.own.hand.length, afterItemHandCount,
          'hand-size condition is evaluated after the Item leaves hand')
        assert.equal(result.afterItem.own.support.filter(entry => entry.rested).length, 1,
          'the selected blue Support must rest for B')
        assert.equal(result.afterItem.own.trash, result.before.own.trash + 1,
          'the physical Item must enter trash')

        if (scenario.kind === 'high-hand') {
          assert.equal(await visible(page.locator('.draw-up-to-modal:visible')), false,
            'six remaining hand cards must skip only the conditional draw')
          assert.equal(result.afterItem.own.battle.find(entry => entry.id.includes('-BS2-029-'))?.hp, 6,
            'the independent Then must still heal after the conditional draw is skipped')
          result.thenPanel = 'The paid high-hand route applied the independent Sea Fairy Then.'
        } else {
          if (!await visible(page.locator('.draw-up-to-modal:visible'))) {
            const drawPanel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
            await drawPanel.waitFor({ state: 'visible' })
            result.drawPanel = await drawPanel.innerText()
            assert.match(result.drawPanel, /抽|draw/i, 'the active effect panel must identify the printed draw step')
            await clickReady(drawPanel.locator('.effect-panel-primary-action:visible').last(), 'resolve the conditional draw effect')
          }
          await waitForCommand(page, 'resolve-ability-effect')
          const drawModal = page.locator('.draw-up-to-modal:visible').last()
          await drawModal.waitFor({ state: 'visible' })
          const drawOptions = drawModal.locator('.draw-up-to-option')
          assert.equal(await drawOptions.count(), 2, 'the printed up-to-1 draw offers 0 or 1 card')
          result.drawChoices = await drawOptions.allInnerTexts()
          await page.screenshot({ path: resolve(output, `${scenario.id}-${viewport.width}-draw.png`), fullPage: true })
          await clickReady(drawOptions.nth(scenario.drawCount), `choose to draw ${scenario.drawCount}`)
          await clickReady(drawModal.locator('.draw-up-to-actions button').last(), 'confirm the selected draw count')
          await waitForCommand(page, 'resolve-draw-up-to')
          await settleAnimation(page)

          const healPanel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
          await healPanel.waitFor({ state: 'visible' })
          result.thenPanel = await healPanel.innerText()
          const targets = healPanel.locator('.effect-candidates-target .effect-candidate-entry > button')
          assert.equal(await targets.count(), 1, 'the 6HP Sea Fairy must be excluded; only the 5HP Cookie is legal')
          if (scenario.heal) {
            await clickReady(targets.first(), 'select the eligible five-HP Sea Fairy')
          }
          await page.screenshot({ path: resolve(output, `${scenario.id}-${viewport.width}-then.png`), fullPage: true })
          await clickReady(healPanel.locator('.effect-panel-primary-action:visible').last(),
            scenario.heal ? 'resolve the Sea Fairy HP gain' : 'choose zero optional Sea Fairy targets')
          await waitForCommand(page, 'resolve-ability-effect')
        }

        await settleAnimation(page)
        result.after = await waitForState(page, state =>
          !state.own.battle.find(entry => entry.id.includes('-BS2-029-')) ||
          state.own.battle.find(entry => entry.id.includes('-BS2-029-'))?.hp === (scenario.kind === 'high-hand' || scenario.heal ? 6 : 5),
        'ST9-015 draw and Then effects did not settle')
        const expectedDraw = scenario.kind === 'high-hand' ? 0 : scenario.drawCount
        const expectedHeal = scenario.kind === 'high-hand' || scenario.heal ? 1 : 0
        assert.equal(result.after.own.hand.length, afterItemHandCount + expectedDraw)
        assert.equal(result.after.own.deck, result.before.own.deck - expectedDraw - expectedHeal,
          'draw and HP payment must both be reflected in deck count')
        assert.equal(result.after.own.trash, result.before.own.trash + 1)
        assert.equal(result.after.own.battle.find(entry => entry.id.includes('-BS2-029-'))?.hp, 5 + expectedHeal)
        assert.equal(result.after.own.battle.find(entry => entry.id.includes('-ST9-006-'))?.hp, 6,
          'the six-HP Sea Fairy is excluded and unchanged')
        result.trace = await readTrace(page)
        assert.ok(result.trace.some(entry => entry.commandKind === 'begin-play-item'))
        assert.ok(result.trace.some(entry => entry.commandKind === 'resolve-ability-effect'))
        if (scenario.kind !== 'high-hand') assert.ok(result.trace.some(entry => entry.commandKind === 'resolve-draw-up-to'))
      }

      assert.deepEqual(consoleErrors.errors, [])
      result.ignoredNetworkErrors = consoleErrors.ignoredNetworkErrors
      await page.screenshot({ path: resolve(output, `${scenario.id}-${viewport.width}-resolved.png`), fullPage: true })
      result.status = 'PASS'
    } catch (error) {
      result.error = String(error.stack ?? error)
      result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 10000)
      result.after = await readState(page).catch(() => null)
      result.trace = await readTrace(page).catch(() => [])
      result.errors = consoleErrors.errors
      result.ignoredNetworkErrors = consoleErrors.ignoredNetworkErrors
      await page.screenshot({ path: resolve(output, `${scenario.id}-${viewport.width}-failed.png`), fullPage: true }).catch(() => {})
    } finally {
      results.push(result)
      await context.close()
    }
  }
} finally {
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    scope: 'Original ST9-015 printing through local test-state UI: B Support payment, hand<=5 draw up to one, independent Then healing only an own Sea Fairy at <=5 HP, rejection of own non-Sea-Fairy and opposing Sea Fairy targets, zero-target choice, and no-blue-support block. This is not online or full-match acceptance.',
    viewports: activeViewports,
    scenarios: results,
  }, null, 2))
  await browser?.close().catch(() => {})
  server?.kill()
}

const summary = {
  reportPath: resolve(output, 'results.json'),
  total: results.length,
  passed: results.filter(result => result.status === 'PASS').length,
  failed: results.filter(result => result.status !== 'PASS').length,
  failures: results.filter(result => result.status !== 'PASS').map(result => ({
    scenario: result.id, viewport: result.viewport.width, error: result.error?.split('\n')[0],
  })),
}
console.log(JSON.stringify(summary, null, 2))
if (summary.failed > 0) process.exitCode = 1
