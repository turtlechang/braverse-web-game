import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cardNumber = 'ST9-012'
const candidateDocument = JSON.parse(readFileSync(resolve(root, 'data/cards/official-st9-012.en.json'), 'utf8'))
const formalPath = resolve(root, 'data/cards/official-st9-012.en.json')
const formalDocument = existsSync(formalPath)
  ? JSON.parse(readFileSync(formalPath, 'utf8'))
  : undefined
const card = formalDocument?.cards.find(record => record.cardNumber === cardNumber) ??
  candidateDocument.cards.find(record => record.cardNumber === cardNumber)
const artPath = resolve(root, `output/st6-st10/images/${cardNumber}.webp`)
assert.ok(card?.imageUrl, `original printed ${cardNumber} record is required`)
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

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4198)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}`
const output = resolve(root, 'output/st6-st10/st9-012-browser')
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
    'src/game/demo.ts', 'src/game/st9-012-demo.ts', 'src/game/battle.ts', 'src/game/commands.ts',
    'src/game/generated-card-pool.ts', 'src/cards/official-effect-adapter.ts',
    'src/hooks/usePendingEffect.ts', 'src/hooks/useMatchController.ts', 'src/App.tsx',
    'src/components/battle/BattleRow.tsx', 'src/components/battle/PendingDecisionModals.tsx',
    'src/components/modals/PendingDecisionModals.tsx',
  ].map(path => resolve(root, path)).filter(existsSync)
  const staleInputs = buildInputs.filter(path => statSync(path).mtimeMs > buildTime)
  if (staleInputs.length > 0) throw new Error(`dist/index.html is older than ST9-012 sources; build required: ${staleInputs.join(', ')}`)
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
  for (let step = 0; step < 20; step += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click({ timeout: 1000 }).catch(() => {})
    await page.waitForTimeout(100)
  }
}
const waitForCommand = (page, kind) => page.waitForFunction(
  expected => (window.__braverseContractTrace ?? []).some(entry => entry.commandKind === expected),
  kind,
  { timeout: 20000 },
)
const readState = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent?.match(/\d+/)?.[0] ?? 0)
    const readCard = node => ({
      id: node.getAttribute('data-card-instance-id'),
      name: node.querySelector('.card-face')?.getAttribute('title') ?? node.querySelector('img')?.getAttribute('alt') ?? '',
      rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
    })
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
    id: `on-play-draw-${drawCount}`,
    testState: 'card-skill:ST9-012',
    kind: 'on-play',
    drawCount,
  })),
  { id: 'on-play-hand-five-negative', testState: 'card-skill-negative:ST9-012', kind: 'on-play-negative' },
  { id: 'attack-then-pay-target', testState: 'card-attack:ST9-012', kind: 'attack', choice: 'pay-target' },
  { id: 'attack-then-pay-zero-target', testState: 'card-attack:ST9-012', kind: 'attack', choice: 'pay-zero' },
  { id: 'attack-then-skip', testState: 'card-attack:ST9-012', kind: 'attack', choice: 'skip' },
  {
    id: 'attack-then-unpayable-blue',
    testState: 'card-attack-then-unpayable:ST9-012',
    kind: 'attack',
    choice: 'unpayable',
  },
  { id: 'attack-no-sea-fairy', testState: 'card-negative:ST9-012', kind: 'attack-negative' },
]
const viewports = [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]
const requestedScenario = process.env.ST9_012_BROWSER_SCENARIO
const requestedWidth = Number(process.env.ST9_012_BROWSER_VIEWPORT_WIDTH ?? 0)
const activeScenarios = requestedScenario ? scenarios.filter(scenario => scenario.id === requestedScenario) : scenarios
const activeViewports = requestedWidth ? viewports.filter(viewport => viewport.width === requestedWidth) : viewports
if (!activeScenarios.length) throw new Error(`Unknown ST9_012_BROWSER_SCENARIO: ${requestedScenario}`)
if (!activeViewports.length) throw new Error(`Unknown ST9_012_BROWSER_VIEWPORT_WIDTH: ${requestedWidth}`)
const results = []
let browser

try {
  await waitForPreview()
  browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) })
  for (const viewport of activeViewports) for (const scenario of activeScenarios) {
    const result = {
      card: cardNumber,
      ...scenario,
      viewport,
      status: 'FAIL',
      errors: [],
      ignoredNetworkErrors: [],
      originalArt: null,
    }
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    const consoleErrors = captureErrors(page)
    try {
      await page.route(card.imageUrl, route => route.fulfill({
        status: 200, contentType: 'image/webp', body: originalArt,
      }))
      const url = new URL('/', baseUrl)
      url.searchParams.set('test-state', scenario.testState)
      url.searchParams.set('contract-card', cardNumber)
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      await settleAnimation(page)
      result.before = await readState(page)
      result.traceBefore = await readTrace(page)
      assert.deepEqual(result.traceBefore, [], 'the test-state must not fabricate Browser commands')
      await page.waitForFunction(imageUrl => [...document.images].some(image =>
        image.src === imageUrl && image.complete && image.naturalWidth > 0), card.imageUrl)
      result.originalArt = await page.evaluate(imageUrl => {
        const image = [...document.images].find(candidate => candidate.src === imageUrl)
        return image ? { src: image.src, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight } : null
      }, card.imageUrl)
      assert.deepEqual([result.originalArt?.naturalWidth, result.originalArt?.naturalHeight],
        [artDimensions.width, artDimensions.height], 'original ST9-012 art must render at its native dimensions')
      await page.screenshot({ path: resolve(output, `${scenario.id}-${viewport.width}-before.png`), fullPage: true })

      if (scenario.kind === 'on-play' || scenario.kind === 'on-play-negative') {
        const sourceCard = result.before.own.hand.find(entry => entry.name === card.name)
        assert.ok(sourceCard, 'physical White Pearl Cookie must start in hand')
        assert.equal(result.before.own.battle.length, 0)
        assert.equal(result.before.own.hand.length, scenario.kind === 'on-play' ? 5 : 6)
        const handCard = page.locator(`.bottom-field .hand-card-wrap[data-card-instance-id="${sourceCard.id}"]`)
        await clickReady(handCard.locator('.hand-card'), 'select physical White Pearl Cookie')
        await clickReady(handCard.locator('.hand-card-action').filter({ hasText: '登場' }).first(), 'deploy White Pearl Cookie')
        await waitForCommand(page, 'deploy-cookie')

        if (scenario.kind === 'on-play') {
          const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
          await panel.waitFor({ state: 'visible' })
          result.onPlayPanel = await panel.innerText()
          assert.match(result.onPlayPanel, /White Pearl Cookie/)
          await clickReady(panel.locator('.effect-panel-primary-action:visible').last(), 'confirm White Pearl On Play')
          await waitForCommand(page, 'begin-activate-skill')
          await waitForCommand(page, 'resolve-ability-effect')

          const drawModal = page.locator('.draw-up-to-modal:visible').last()
          await drawModal.waitFor({ state: 'visible' })
          const options = drawModal.locator('.draw-up-to-option')
          assert.equal(await options.count(), 3, 'the On Play UI must offer 0, 1, or 2 cards')
          result.drawChoices = await options.allInnerTexts()
          await clickReady(options.nth(scenario.drawCount), `choose On Play draw ${scenario.drawCount}`)
          result.drawPanel = await drawModal.innerText()
          await clickReady(drawModal.locator('.draw-up-to-actions button').last(), 'confirm actual On Play draw choice')
          await waitForCommand(page, 'resolve-draw-up-to')
          await settleAnimation(page)
          result.after = await waitForState(page, state =>
            state.own.battle.some(entry => entry.name === card.name && entry.hp === 2) &&
            state.own.hand.length === 4 + scenario.drawCount,
          'White Pearl On Play did not resolve the selected draw count')
          assert.equal(result.after.own.deck, result.before.own.deck - 2 - scenario.drawCount,
            'two deck cards become printed HP before the selected draw count')
          result.trace = await readTrace(page)
          assert.ok(result.trace.some(entry => entry.commandKind === 'deploy-cookie'))
          assert.ok(result.trace.some(entry => entry.commandKind === 'begin-activate-skill'))
          assert.ok(result.trace.some(entry => entry.commandKind === 'resolve-ability-effect'))
          assert.ok(result.trace.some(entry => entry.commandKind === 'resolve-draw-up-to'))
        } else {
          await waitForCommand(page, 'skip-on-play')
          await settleAnimation(page)
          result.after = await waitForState(page, state =>
            state.own.battle.some(entry => entry.name === card.name && entry.hp === 2) &&
            state.own.hand.length === 5,
          'White Pearl with five cards after deployment must skip its On Play draw')
          assert.equal(result.after.own.deck, result.before.own.deck - 2)
          assert.equal(await visible(page.locator('.draw-up-to-modal')), false)
          result.trace = await readTrace(page)
          assert.ok(result.trace.some(entry => entry.commandKind === 'skip-on-play'))
          assert.equal(result.trace.some(entry => entry.commandKind === 'begin-activate-skill'), false)
          assert.equal(result.trace.some(entry => entry.commandKind === 'resolve-draw-up-to'), false)
        }
      } else {
        const attacker = result.before.own.battle.find(entry => entry.name === card.name)
        const target = result.before.opponent.battle.find(entry => entry.name === 'Devil Cookie')
        assert.ok(attacker, 'physical White Pearl must begin in the battle area')
        assert.ok(target, 'physical Devil Cookie must be available as the attack target')
        assert.equal(result.before.own.support.length, 3)
        if (scenario.choice === 'unpayable') {
          assert.ok(result.before.own.support.some(entry => entry.id?.includes('BS3-018')),
            'the unpayable route must expose the real red Support beside two blue attack payments')
        }
        assert.equal(result.before.opponent.battle[0].hp, 4)
        if (scenario.kind === 'attack') {
          assert.ok(result.before.own.battle.some(entry => entry.name === 'Sea Fairy Cookie'),
            'the positive attack route needs the printed Sea Fairy condition witness')
        } else {
          assert.equal(result.before.own.battle.some(entry => entry.name === 'Sea Fairy Cookie'), false,
            'the negative route must lack the printed Sea Fairy witness')
        }

        const attackerCard = page.locator(`.bottom-field .combat-card-wrap[data-card-instance-id="${attacker.id}"]`)
        await clickReady(attackerCard.locator('.card-face.is-attackable'), 'declare White Pearl BB ordinary attack')
        const paymentPanel = page.locator('[data-testid="attack-payment-panel"]:visible')
        await paymentPanel.waitFor({ state: 'visible' })
        result.attackPaymentIds = []
        for (let index = 0; index < 2; index += 1) {
          const payment = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').first()
          result.attackPaymentIds.push(await payment.evaluate(node => node.closest('.support-card-wrap')?.getAttribute('data-card-instance-id')))
          await clickReady(payment, `pay ordinary attack B ${index + 1} of 2`)
        }
        const targetFace = page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${target.id}"] .card-face[aria-label^="選擇攻擊目標："]`)
        await clickReady(targetFace, 'choose Devil Cookie for the printed ordinary attack')
        await waitForCommand(page, 'resolve-attack-effect')
        await settleAnimation(page)
        result.baseAttack = await waitForState(page, state => state.opponent.battle[0]?.hp === 2,
          'the BB ordinary attack must first deal two real damage')
        assert.equal(result.baseAttack.own.support.filter(entry => entry.rested).length, 2)

        if (scenario.kind === 'attack-negative') {
          await page.waitForTimeout(250)
          assert.equal(await visible(page.locator('.optional-cost-attack-modal')), false,
            'without Sea Fairy the gated Then should not open a payment UI')
          result.after = await readState(page)
          assert.equal(result.after.opponent.battle[0]?.hp, 2)
          assert.equal(result.after.own.support.filter(entry => entry.rested).length, 2)
          assert.equal(result.after.own.support.filter(entry => !entry.rested).length, 1)
          result.trace = await readTrace(page)
          const effect = result.trace.find(entry => entry.commandKind === 'resolve-attack-effect')
          assert.ok(effect, 'the real attack-effect resolver must inspect the condition')
          assert.match(`${effect.summary ?? ''} ${(effect.steps ?? []).join(' ')}`, /條件不成立|未執行/)
        } else {
          const modal = page.locator('.effect-panel[role="alertdialog"]:visible').last()
          await modal.waitFor({ state: 'visible' })
          result.thenModal = await modal.innerText()
          assert.match(result.thenModal, /攻擊後續效果/)
          assert.match(result.thenModal, /Then/)
          assert.match(result.thenModal, /White Pearl Cookie/)
          assert.equal(await visible(modal.locator('.optional-cost-attack-inline')), true,
            'the attack Then must render its real optional-cost payment and target UI')
          await page.screenshot({ path: resolve(output, `${scenario.id}-${viewport.width}-then-payment.png`), fullPage: true })

          if (scenario.choice === 'unpayable') {
            const warning = modal.locator('.optional-cost-attack-condition-warning:visible').last()
            await warning.waitFor({ state: 'visible' })
            result.paymentUnavailableWarning = await warning.innerText()
            assert.match(result.paymentUnavailableWarning, /沒有足夠的可支付藍色能量/)
            assert.match(result.paymentUnavailableWarning, /請選擇「略過」/)
            const payButton = modal.getByRole('button', { name: '支付', exact: true })
            const skipButton = modal.getByRole('button', { name: '略過', exact: true })
            assert.equal(await payButton.isDisabled(), true,
              'the UI must block an optional B payment when only a red Support remains')
            assert.equal(await skipButton.isEnabled(), true,
              'the player must still be able to skip the unpayable optional Then')
            assert.equal(await visible(modal.locator('.optional-cost-col')), false,
              'the UI must not open a payment-selection step without a legal blue Support')
            await page.screenshot({ path: resolve(output, `${scenario.id}-${viewport.width}-unpayable.png`), fullPage: true })
            await clickReady(skipButton, 'skip the unpayable optional Then')
          } else if (scenario.choice === 'skip') {
            await clickReady(modal.getByRole('button', { name: '略過', exact: true }), 'skip optional Then B payment')
          } else {
            await clickReady(modal.getByRole('button', { name: '支付', exact: true }), 'open optional Then payment steps')
            const energyStep = modal.locator('.optional-cost-col:visible')
            await energyStep.waitFor({ state: 'visible' })
            result.thenEnergyChoices = await energyStep.innerText()
            const paymentChoice = energyStep.locator('.modal-card-options button').first()
            assert.equal(await energyStep.locator('.modal-card-options button').count(), 1,
              'after paying BB, exactly one active blue Support remains for Then B')
            await clickReady(paymentChoice, 'select the remaining real blue Support for Then B')
            await clickReady(modal.getByRole('button', { name: '下一步', exact: true }), 'continue from support payment to target selection')
            const targetStep = modal.locator('.optional-cost-col:visible')
            await targetStep.waitFor({ state: 'visible' })
            result.thenTargetChoices = await targetStep.innerText()
            assert.match(result.thenTargetChoices, /最多選擇 1 個|目標/)
            const targetChoice = targetStep.locator('.modal-card-options button').filter({ hasText: 'Devil Cookie' }).first()
            if (scenario.choice === 'pay-target') {
              await clickReady(targetChoice, 'select Devil Cookie for the optional one damage')
            } else {
              assert.equal(await targetChoice.count(), 1, 'the legal optional target is visible')
            }
            await clickReady(modal.getByRole('button', { name: '確認', exact: true }),
              scenario.choice === 'pay-target' ? 'confirm optional damage target' : 'pay Then B while selecting zero targets')
          }
          await waitForCommand(page, 'resolve-optional-cost-attack')
          await settleAnimation(page)
          const expectedHp = scenario.choice === 'pay-target' ? 1 : 2
          result.after = await waitForState(page, state => state.opponent.battle[0]?.hp === expectedHp,
            'optional Then payment and selected target did not settle')
          assert.equal(result.after.own.support.filter(entry => entry.rested).length,
            scenario.choice === 'skip' || scenario.choice === 'unpayable' ? 2 : 3,
            'only the chosen support payment changes the real Support rest state')
          if (scenario.choice === 'unpayable') {
            assert.deepEqual(result.after.own.support, result.baseAttack.own.support,
              'a blocked payment and subsequent skip must not alter the already-paid BB support state')
            result.trace = await readTrace(page)
            assert.match(
              result.trace.find(entry => entry.commandKind === 'resolve-optional-cost-attack')?.summary ?? '',
              /選擇略過/,
              'the unpayable route must record the player skipping the optional Then',
            )
          }
          result.trace = await readTrace(page)
          assert.ok(result.trace.some(entry => entry.commandKind === 'resolve-optional-cost-attack'),
            'both paying and skipping must be a real optional-cost command')
        }
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
    scope: 'Original ST9-012 physical printing through real local test-state UI: On Play hand condition and draw choices at the exact four-card boundary; BB attack payment; optional B Then payment, unavailable-blue warning and skip, target selection, zero target; Sea Fairy condition failure. This is not online or full-match acceptance.',
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
    scenario: result.id,
    viewport: result.viewport.width,
    error: result.error?.split('\n')[0],
  })),
}
console.log(JSON.stringify(summary, null, 2))
if (summary.failed > 0) process.exitCode = 1
