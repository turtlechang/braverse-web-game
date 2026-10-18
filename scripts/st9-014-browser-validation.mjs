import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cardNumber = 'ST9-014'
const candidateDocument = JSON.parse(readFileSync(resolve(root, 'data/cards/official-st9-014.en.json'), 'utf8'))
const formalPath = resolve(root, 'data/cards/official-st9-014.en.json')
const formalDocument = existsSync(formalPath) ? JSON.parse(readFileSync(formalPath, 'utf8')) : undefined
const card = formalDocument?.cards.find(record => record.cardNumber === cardNumber) ??
  candidateDocument.cards.find(record => record.cardNumber === cardNumber)
assert.ok(card?.imageUrl, `original printed ${cardNumber} record is required`)
assert.equal(card.type, 'item')
assert.equal(card.name, 'Glittering Pearl Shell')
assert.equal(card.color, 'BLUE')
assert.equal(card.skill.text, '<{B}{B}> <Discard 3 cards.> Select up to 1 of your Cookies. That Cookie gains +2 HP.')

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

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4204)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}`
const output = resolve(root, 'output/st6-st10/st9-014-browser')
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
    'src/game/demo.ts', 'src/game/st9-014-demo.ts', 'src/game/commands.ts',
    'src/game/generated-card-pool.ts', 'src/hooks/usePendingEffect.ts', 'src/hooks/useMatchController.ts',
    'src/components/effects/EffectPanel.tsx', 'src/components/modals/GameModals.tsx', 'src/App.tsx',
  ].map(path => resolve(root, path)).filter(existsSync)
  const staleInputs = buildInputs.filter(path => statSync(path).mtimeMs > buildTime)
  if (staleInputs.length > 0) throw new Error(`dist/index.html is older than ST9-014 sources; build required: ${staleInputs.join(', ')}`)
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
  { id: 'heal-one-cookie', testState: 'card:ST9-014', kind: 'resolve', target: 'Aquamarine Cookie' },
  { id: 'choose-zero-cookie', testState: 'card:ST9-014', kind: 'resolve', target: null },
  { id: 'cancel-cost-draft', testState: 'card:ST9-014', kind: 'cancel' },
  { id: 'insufficient-discard-hand', testState: 'card-skill-negative:ST9-014', kind: 'unpayable', reason: 'hand' },
  { id: 'no-blue-support', testState: 'card-negative:ST9-014', kind: 'unpayable', reason: 'support' },
]
const viewports = [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]
const requestedScenario = process.env.ST9_014_BROWSER_SCENARIO
const requestedWidth = Number(process.env.ST9_014_BROWSER_VIEWPORT_WIDTH ?? 0)
const activeScenarios = requestedScenario ? scenarios.filter(scenario => scenario.id === requestedScenario) : scenarios
const activeViewports = requestedWidth ? viewports.filter(viewport => viewport.width === requestedWidth) : viewports
if (!activeScenarios.length) throw new Error(`Unknown ST9_014_BROWSER_SCENARIO: ${requestedScenario}`)
if (!activeViewports.length) throw new Error(`Unknown ST9_014_BROWSER_VIEWPORT_WIDTH: ${requestedWidth}`)

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
      const expectedHandNames = scenario.reason === 'hand'
        ? ['Glittering Pearl Shell', 'Mala Sauce Cookie', 'Mushroom Spore Punch']
        : ['Glittering Pearl Shell', 'Mala Sauce Cookie', 'Mushroom Spore Punch', 'Bad Omen']
      assert.deepEqual(result.before.own.hand.map(entry => entry.name), expectedHandNames,
        'the physical fixture must start with the printed Item and its original hand cards')
      assert.equal(result.before.own.hand[0]?.name, card.name)
      assert.equal(result.before.own.support.length, scenario.kind === 'unpayable' && scenario.reason === 'support' ? 1 : 2)
      assert.equal(result.before.own.support.every(entry => !entry.rested), true)
      if (scenario.reason === 'support') assert.equal(result.before.own.support[0]?.name, 'Mushroom Spore Punch')
      if (scenario.reason === 'hand') assert.equal(result.before.own.hand.length, 3)
      else if (scenario.kind !== 'unpayable') assert.equal(result.before.own.hand.length, 4)
      await page.waitForFunction(imageUrl => [...document.images].some(image =>
        image.src === imageUrl && image.complete && image.naturalWidth > 0), card.imageUrl)
      result.originalArt = await page.evaluate(imageUrl => {
        const image = [...document.images].find(candidate => candidate.src === imageUrl)
        return image ? { src: image.src, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight } : null
      }, card.imageUrl)
      assert.deepEqual([result.originalArt?.naturalWidth, result.originalArt?.naturalHeight],
        [artDimensions.width, artDimensions.height], 'original ST9-014 art must render at native dimensions')
      await page.screenshot({ path: resolve(output, `${scenario.id}-${viewport.width}-before.png`), fullPage: true })

      await clickReady(page.getByRole('button', { name: card.name, exact: true }).first(), 'select the printed Item')
      const useButton = page.getByRole('button', { name: '使用', exact: true }).last()
      if (scenario.kind === 'unpayable' && await useButton.count() > 0 && !await useButton.isEnabled()) {
        result.blockedAt = 'disabled-use-action'
        result.after = await readState(page)
      } else {
        if (scenario.kind === 'unpayable' && await useButton.count() === 0) {
          result.blockedAt = 'no-use-action'
          result.after = await readState(page)
        } else {
          await clickReady(useButton, 'open the physical Item cost UI')
          const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
          await panel.waitFor({ state: 'visible' })
          result.initialCostPanel = await panel.innerText()
          assert.match(result.initialCostPanel, /Glittering Pearl Shell/)
          const paymentCandidates = panel.locator('.effect-candidates-payment .effect-candidate-entry > button')
          const primary = panel.locator('.effect-panel-primary-action:visible').last()

          if (scenario.kind === 'unpayable' && scenario.reason === 'support') {
            result.paymentCandidateCount = await paymentCandidates.count()
            assert.equal(result.paymentCandidateCount, 0, 'red Support must not be offered for the printed BB payment')
            assert.equal(await primary.isDisabled(), true, 'the Item must not advance without two blue energy units')
            result.blockedAt = 'blue-support-payment'
            result.after = await readState(page)
            assert.deepEqual(result.after, result.before)
            assert.deepEqual(await readTrace(page), [])
          } else {
            assert.equal(await paymentCandidates.count(), 2, 'exactly two active original blue Supports must pay BB')
            result.paymentChoices = await paymentCandidates.allInnerTexts()
            for (let index = 0; index < 2; index += 1) {
              await clickReady(paymentCandidates.nth(index), 'select one physical blue Support for BB')
              assert.deepEqual(await readTrace(page), [], 'energy selections stay drafts before confirmation')
              assert.deepEqual(await readState(page), result.before, 'energy selection must not mutate zones before confirmation')
            }
            await clickReady(primary, 'continue to the three-card hand cost')
            const discardCandidates = panel.locator('.effect-candidates-discard-hand .effect-candidate-entry > button')
            const discardPrimary = panel.locator('.effect-panel-primary-action:visible').last()

            if (scenario.kind === 'unpayable' && scenario.reason === 'hand') {
              result.discardCandidateCount = await discardCandidates.count()
              assert.equal(result.discardCandidateCount, 2, 'only the two real non-source cards can pay the hand cost')
              assert.equal(await discardPrimary.isDisabled(), true, 'two cards cannot satisfy Discard 3')
              result.blockedAt = 'three-card-discard-cost'
              result.after = await readState(page)
              assert.deepEqual(result.after, result.before)
              assert.deepEqual(await readTrace(page), [])
            } else {
              assert.equal(await discardCandidates.count(), 3, 'the cost must offer the three original hand cards, not the source Item')
              result.discardChoices = await discardCandidates.allInnerTexts()
              assert.match(result.discardChoices.join(' '), /Mala Sauce Cookie/)
              assert.match(result.discardChoices.join(' '), /Mushroom Spore Punch/)
              assert.match(result.discardChoices.join(' '), /Bad Omen/)
              for (let index = 0; index < 3; index += 1) {
                await clickReady(discardCandidates.nth(index), 'select one of the three physical hand-cost cards')
                assert.deepEqual(await readTrace(page), [], 'discard selections stay drafts before confirmation')
                assert.deepEqual(await readState(page), result.before, 'discard selection must not mutate zones before confirmation')
              }
              await page.screenshot({ path: resolve(output, `${scenario.id}-${viewport.width}-costs.png`), fullPage: true })

              if (scenario.kind === 'cancel') {
                await clickReady(panel.getByRole('button', { name: '取消技能', exact: true }), 'cancel the unpaid Item draft')
                await panel.waitFor({ state: 'hidden' })
                result.afterCancel = await readState(page)
                assert.deepEqual(result.afterCancel, result.before)
                assert.deepEqual(await readTrace(page), [])
                await clickReady(page.getByRole('button', { name: card.name, exact: true }).first(), 'reselect the original Item')
                await clickReady(page.getByRole('button', { name: '使用', exact: true }).last(), 'reopen the Item payment UI')
                const reopenedPanel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
                await reopenedPanel.waitFor({ state: 'visible' })
                assert.equal(await reopenedPanel.locator('.effect-candidates-payment .effect-candidate-entry > button').count(), 2)
                assert.deepEqual(await readState(page), result.before)
                await clickReady(reopenedPanel.getByRole('button', { name: '取消技能', exact: true }), 'cancel the reopened draft')
                result.after = await readState(page)
                assert.deepEqual(result.after, result.before)
                assert.deepEqual(await readTrace(page), [])
              } else {
                await clickReady(discardPrimary, 'continue to the optional Cookie target')
                const targetPanel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
                await targetPanel.waitFor({ state: 'visible' })
                assert.deepEqual(await readTrace(page), [], 'BB and hand-cost selections remain uncommitted drafts until target confirmation')
                assert.deepEqual(await readState(page), result.before, 'the staged target choice must not mutate any zone before final confirmation')
                const targetCandidates = targetPanel.locator('.effect-candidates-target .effect-candidate-entry > button')
                assert.equal(await targetCandidates.count(), 2, 'only the two real own Battle Cookies are offered')
                result.targetChoices = await targetCandidates.allInnerTexts()
                assert.match(result.targetChoices.join(' '), /Aquamarine Cookie/)
                assert.match(result.targetChoices.join(' '), /Gold Citrine Cookie/)
                if (scenario.target) {
                  const target = targetCandidates.filter({ hasText: scenario.target })
                  assert.equal(await target.count(), 1, 'the chosen own Cookie must be an available target')
                  await clickReady(target, 'select Aquamarine Cookie for +2 HP')
                  assert.deepEqual(await readTrace(page), [],
                    'target selection must remain a draft until confirmed')
                  assert.deepEqual(await readState(page), result.before, 'the target selection must remain an uncommitted draft')
                }
                await page.screenshot({ path: resolve(output, `${scenario.id}-${viewport.width}-target.png`), fullPage: true })
                const targetAction = targetPanel.locator('.effect-panel-primary-action:visible').last()
                result.targetActionLabel = await targetAction.innerText()
                await clickReady(targetAction, scenario.target ? 'confirm the optional +2 HP target' : 'resolve the effect with zero targets')
                await waitForCommand(page, 'begin-play-item')
                await settleAnimation(page)
                result.after = await waitForState(page, state => state.own.trash === result.before.own.trash + 4,
                  'ST9-014 costs and effect did not settle')
                assert.equal(result.after.own.hand.length, 0)
                assert.equal(result.after.own.support.filter(entry => entry.rested).length, 2)
                assert.equal(result.after.own.deck, result.before.own.deck - (scenario.target ? 2 : 0))
                const targetAfter = result.after.own.battle.find(entry => entry.name === scenario.target)
                if (scenario.target) {
                  assert.equal(targetAfter?.hp, 4, 'the printed two-HP Aquamarine Cookie receives two actual HP cards')
                  assert.deepEqual(result.after.own.battle.find(entry => entry.name === 'Gold Citrine Cookie')?.hp,
                    result.before.own.battle.find(entry => entry.name === 'Gold Citrine Cookie')?.hp,
                    'the unselected own Cookie must remain unchanged')
                } else {
                  assert.deepEqual(result.after.own.battle.map(entry => entry.hp), result.before.own.battle.map(entry => entry.hp),
                    'choosing zero optional targets pays the cost but adds no HP')
                }
                result.trace = await readTrace(page)
                assert.ok(result.trace.some(entry => entry.commandKind === 'begin-play-item'))
              }
            }
          }
        }
      }

      if (scenario.kind === 'unpayable') {
        result.after ??= await readState(page)
        assert.deepEqual(result.after, result.before, 'unpayable resources must preserve all game zones')
        assert.deepEqual(await readTrace(page), [], 'unpayable resources must submit no command')
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
    scope: 'Original ST9-014 printing through local test-state UI: BB payment, exactly three physical hand-card costs, optional zero-to-one own Cookie gaining two HP, and blocked payment/cost paths. This is not online or full-match acceptance.',
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
