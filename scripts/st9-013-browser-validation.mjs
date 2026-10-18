import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cardNumber = 'ST9-013'
const candidateDocument = JSON.parse(readFileSync(resolve(root, 'data/cards/official-st9-013.en.json'), 'utf8'))
const formalPath = resolve(root, 'data/cards/official-st9-013.en.json')
const formalDocument = existsSync(formalPath) ? JSON.parse(readFileSync(formalPath, 'utf8')) : undefined
const card = formalDocument?.cards.find(record => record.cardNumber === cardNumber) ??
  candidateDocument.cards.find(record => record.cardNumber === cardNumber)
assert.ok(card?.imageUrl, `original printed ${cardNumber} record is required`)
assert.equal(card.type, 'item')
assert.equal(card.name, 'Shimmering Moonlit Coral')
assert.equal(card.color, 'BLUE')
assert.equal(card.skill.text, '<{B}> <Discard 1 {B} card from your hand.> Draw up to 2 cards from your deck.')

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

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4203)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}`
const output = resolve(root, 'output/st6-st10/st9-013-browser')
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
    'src/game/demo.ts', 'src/game/st9-013-demo.ts', 'src/game/commands.ts',
    'src/game/generated-card-pool.ts', 'src/hooks/usePendingEffect.ts', 'src/hooks/useMatchController.ts',
    'src/components/effects/EffectPanel.tsx', 'src/components/modals/GameModals.tsx', 'src/App.tsx',
  ].map(path => resolve(root, path)).filter(existsSync)
  const staleInputs = buildInputs.filter(path => statSync(path).mtimeMs > buildTime)
  if (staleInputs.length > 0) throw new Error(`dist/index.html is older than ST9-013 sources; build required: ${staleInputs.join(', ')}`)
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
      // BattleRow visually rotates a selected payment support before commit.
      // That selected preview is not authoritative fatigue in the game state.
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
  commandKind: entry.commandKind,
  summary: entry.summary,
  steps: entry.steps,
  payload: entry.payload,
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
  ...[0, 1, 2].map(drawCount => ({
    id: `draw-${drawCount}`, testState: 'card:ST9-013', kind: 'draw', drawCount,
  })),
  { id: 'cancel-after-cost-draft', testState: 'card:ST9-013', kind: 'cancel', drawCount: 0 },
  { id: 'no-blue-hand-card', testState: 'card-skill-negative:ST9-013', kind: 'unpayable', reason: 'hand' },
  { id: 'no-blue-support', testState: 'card-negative:ST9-013', kind: 'unpayable', reason: 'support' },
]
const viewports = [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]
const requestedScenario = process.env.ST9_013_BROWSER_SCENARIO
const requestedWidth = Number(process.env.ST9_013_BROWSER_VIEWPORT_WIDTH ?? 0)
const activeScenarios = requestedScenario ? scenarios.filter(scenario => scenario.id === requestedScenario) : scenarios
const activeViewports = requestedWidth ? viewports.filter(viewport => viewport.width === requestedWidth) : viewports
if (!activeScenarios.length) throw new Error(`Unknown ST9_013_BROWSER_SCENARIO: ${requestedScenario}`)
if (!activeViewports.length) throw new Error(`Unknown ST9_013_BROWSER_VIEWPORT_WIDTH: ${requestedWidth}`)

const results = []
let browser
try {
  await waitForPreview()
  browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) })
  for (const viewport of activeViewports) for (const scenario of activeScenarios) {
    const result = {
      card: cardNumber, ...scenario, viewport, status: 'FAIL', errors: [], ignoredNetworkErrors: [], originalArt: null,
    }
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
      assert.equal(result.before.own.hand.some(entry => entry.name === card.name), true, 'physical Item must begin in hand')
      const redHandCard = result.before.own.hand.find(entry => entry.id.includes('-ST6-001-'))
      assert.ok(redHandCard, 'the printed red Mala Sauce Cookie must begin in hand')
      await page.waitForFunction(imageUrl => [...document.images].some(image =>
        image.src === imageUrl && image.complete && image.naturalWidth > 0), card.imageUrl)
      result.originalArt = await page.evaluate(imageUrl => {
        const image = [...document.images].find(candidate => candidate.src === imageUrl)
        return image ? { src: image.src, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight } : null
      }, card.imageUrl)
      assert.deepEqual([result.originalArt?.naturalWidth, result.originalArt?.naturalHeight],
        [artDimensions.width, artDimensions.height], 'original ST9-013 art must render at native dimensions')
      await page.screenshot({ path: resolve(output, `${scenario.id}-${viewport.width}-before.png`), fullPage: true })

      const handItem = page.getByRole('button', { name: card.name, exact: true }).first()
      await clickReady(handItem, 'select the printed Item')
      const useButton = page.getByRole('button', { name: '使用', exact: true }).last()
      if (scenario.kind === 'unpayable' && await useButton.count() === 0) {
        result.blockedAt = 'no-use-action'
        result.after = await readState(page)
      } else if (scenario.kind === 'unpayable' && !await useButton.isEnabled()) {
        result.blockedAt = 'disabled-use-action'
        result.after = await readState(page)
      } else {
        await clickReady(useButton, 'open the physical Item cost UI')
        const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
        await panel.waitFor({ state: 'visible' })
        result.initialCostPanel = await panel.innerText()
        assert.match(result.initialCostPanel, /Shimmering Moonlit Coral/)

        const paymentCandidates = panel.locator('.effect-candidates-payment .effect-candidate-entry > button')
        if (scenario.kind === 'unpayable' && scenario.reason === 'support') {
          result.paymentCandidateCount = await paymentCandidates.count()
          assert.equal(result.paymentCandidateCount, 0, 'red Support must not be offered for the printed B payment')
          const primary = panel.locator('.effect-panel-primary-action:visible').last()
          assert.equal(await primary.isDisabled(), true, 'the Item must not advance without its blue energy payment')
          result.blockedAt = 'blue-support-payment'
        } else {
          assert.equal(await paymentCandidates.count(), 1, 'exactly one active blue Support can pay B')
          result.paymentChoice = await paymentCandidates.first().innerText()
          await clickReady(paymentCandidates.first(), 'select the physical blue Support for B')
          assert.deepEqual(await readTrace(page), [], 'cost selection remains a draft until confirmation')
          assert.deepEqual(await readState(page), result.before, 'selecting B must not change any game zone')
          await clickReady(panel.locator('.effect-panel-primary-action:visible').last(), 'continue to the blue hand-card cost')

          const discardCandidates = panel.locator('.effect-candidates-discard-hand .effect-candidate-entry > button')
          if (scenario.kind === 'unpayable') {
            result.discardCandidateCount = await discardCandidates.count()
            assert.equal(result.discardCandidateCount, 0, 'red hand cards must not be offered for the printed blue discard cost')
            assert.equal(await panel.locator('.effect-panel-primary-action:visible').last().isDisabled(), true,
              'the Item must not activate without a blue card to discard')
            result.blockedAt = 'blue-hand-discard'
          } else {
            assert.equal(await discardCandidates.count(), 1, 'only the original blue Aquamarine Cookie is a legal hand cost')
            result.discardChoice = await discardCandidates.first().innerText()
            assert.match(result.discardChoice, /Aquamarine Cookie/)
            await clickReady(discardCandidates.first(), 'select the original blue hand card cost')
            await page.screenshot({ path: resolve(output, `${scenario.id}-${viewport.width}-costs.png`), fullPage: true })
            assert.deepEqual(await readTrace(page), [], 'blue B and blue hand-card choices remain uncommitted drafts')
            assert.deepEqual(await readState(page), result.before, 'selecting the blue discard must not change any game zone')
            if (scenario.kind === 'cancel') {
              await clickReady(panel.getByRole('button', { name: '取消技能', exact: true }), 'cancel the unpaid Item draft')
              await panel.waitFor({ state: 'hidden' })
              result.afterCancel = await readState(page)
              assert.deepEqual(result.afterCancel, result.before, 'cancelling the unpaid draft must preserve all zones')
              assert.deepEqual(await readTrace(page), [], 'cancelling an unpaid draft must not submit a command')

              await clickReady(page.getByRole('button', { name: card.name, exact: true }).first(), 'reselect the original Item')
              await clickReady(page.getByRole('button', { name: '使用', exact: true }).last(), 'reopen the Item payment UI')
              const reopenedPanel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
              await reopenedPanel.waitFor({ state: 'visible' })
              const reopenedPayments = reopenedPanel.locator('.effect-candidates-payment .effect-candidate-entry > button')
              assert.equal(await reopenedPayments.count(), 1, 'the reopened Item must still offer its physical blue Support')
              await clickReady(reopenedPayments.first(), 'select B again after cancellation')
              assert.deepEqual(await readState(page), result.before, 'the reopened B draft must remain uncommitted')
              await clickReady(reopenedPanel.locator('.effect-panel-primary-action:visible').last(), 'continue after reopening')
              const reopenedDiscard = reopenedPanel.locator('.effect-candidates-discard-hand .effect-candidate-entry > button')
              assert.equal(await reopenedDiscard.count(), 1, 'the reopened Item must still offer its physical blue hand cost')
              result.reopenedDiscardChoice = await reopenedDiscard.first().innerText()
              assert.match(result.reopenedDiscardChoice, /Aquamarine Cookie/)
              result.after = await readState(page)
              result.trace = await readTrace(page)
              assert.deepEqual(result.after, result.before, 'reopened cost selection must leave the original zones intact')
              assert.deepEqual(result.trace, [], 'reopening and selecting costs must still be an uncommitted draft')
            } else {
            await clickReady(panel.locator('.effect-panel-primary-action:visible').last(), 'confirm the physical Item costs')
            await waitForCommand(page, 'begin-play-item')
            await waitForCommand(page, 'resolve-ability-effect')

            const drawModal = page.locator('.draw-up-to-modal:visible').last()
            await drawModal.waitFor({ state: 'visible' })
            const options = drawModal.locator('.draw-up-to-option')
            assert.equal(await options.count(), 3, 'the Item UI must offer 0, 1, or 2 cards')
            result.drawChoices = await options.allInnerTexts()
            await page.screenshot({ path: resolve(output, `${scenario.id}-${viewport.width}-draw-choice.png`), fullPage: true })
            await clickReady(options.nth(scenario.drawCount), `choose to draw ${scenario.drawCount}`)
            await clickReady(drawModal.locator('.draw-up-to-actions button').last(), 'confirm the actual draw count')
            await waitForCommand(page, 'resolve-draw-up-to')
            await settleAnimation(page)
            result.after = await waitForState(page, state => state.own.hand.length === 1 + scenario.drawCount,
              'ST9-013 draw-up-to did not settle at the selected count')
            assert.equal(result.after.own.deck, result.before.own.deck - scenario.drawCount)
            assert.equal(result.after.own.trash, result.before.own.trash + 2,
              'the physical Item and blue hand-cost card must both enter the trash')
            assert.equal(result.after.own.support.filter(entry => entry.rested).length, 1,
              'the selected blue Support must rest for B')
            assert.equal(result.after.own.hand.some(entry => entry.id === redHandCard.id), true,
              'the physical red hand card must remain in hand')
            result.trace = await readTrace(page)
            assert.ok(result.trace.some(entry => entry.commandKind === 'begin-play-item'))
            assert.ok(result.trace.some(entry => entry.commandKind === 'resolve-ability-effect'))
            assert.ok(result.trace.some(entry => entry.commandKind === 'resolve-draw-up-to'))
            }
          }
        }

        if (scenario.kind === 'unpayable') {
          result.after = await readState(page)
          assert.deepEqual(result.after, result.before, 'an unavailable blue payment/cost must not change any visible zone')
          assert.deepEqual(await readTrace(page), [], 'unpayable cost UI must not submit a game command')
        }
      }

      if (scenario.kind === 'unpayable') {
        assert.deepEqual(result.after, result.before, 'an unpayable route must preserve hand, Support, deck, and trash')
        assert.deepEqual(await readTrace(page), [], 'an unpayable route must not submit a game command')
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
    scope: 'Original ST9-013 printing through local test-state UI: B Support payment, blue hand-card discard, draw choices 0/1/2, and disabled no-blue-hand/no-blue-support paths. This is not online or full-match acceptance.',
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
