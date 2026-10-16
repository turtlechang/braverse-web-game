import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cardNumbers = ['ST9-010', 'ST9-011']
const candidateDocument = JSON.parse(readFileSync(resolve(root, 'data/cards/official-st9-010-011.en.json'), 'utf8'))
const formalPath = resolve(root, 'data/cards/official-st9-010-011.en.json')
const formalDocument = existsSync(formalPath) ? JSON.parse(readFileSync(formalPath, 'utf8')) : undefined
const cards = new Map(cardNumbers.map(cardNumber => [
  cardNumber,
  formalDocument?.cards.find(record => record.cardNumber === cardNumber) ??
    candidateDocument.cards.find(record => record.cardNumber === cardNumber),
]))
for (const [cardNumber, card] of cards) {
  assert.ok(card?.imageUrl, `original printed ${cardNumber} record is required`)
  assert.ok(existsSync(resolve(root, `output/st6-st10/images/${cardNumber}.webp`)), `original printed ${cardNumber} art is required`)
}

const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4197)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}`
const output = resolve(root, 'output/st6-st10/st9-010-011-browser')
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
    'src/game/demo.ts', 'src/game/st9-010-011-demo.ts', 'src/game/battle.ts', 'src/game/commands.ts',
    'src/game/generated-card-pool.ts', 'src/cards/official-card-adapter.ts', 'src/cards/official-effect-adapter.ts',
    'src/hooks/useMatchController.ts', 'src/App.tsx', 'src/components/battle/BattleResponseModals.tsx',
    'src/components/battle/BattleRow.tsx', 'src/components/modals/GameModals.tsx',
    'src/components/effects/EffectPanel.tsx',
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
  for (let step = 0; step < 25; step += 1) {
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
  commandKind: entry.commandKind,
  summary: entry.summary,
  steps: entry.steps,
})))
const waitForState = async (page, predicate, label) => {
  let latest
  for (let attempt = 0; attempt < 100; attempt += 1) {
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

const scenarios = cardNumbers.flatMap(cardNumber => [
  { cardNumber, id: `${cardNumber}-flip-paid-hp-gain`, testState: `card:${cardNumber}`, activate: true },
  { cardNumber, id: `${cardNumber}-flip-no-hand-cost`, testState: `card-negative:${cardNumber}`, activate: false },
])
const viewports = [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]
const results = []
let browser

try {
  await waitForPreview()
  browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) })
  for (const viewport of viewports) for (const scenario of scenarios) {
    const card = cards.get(scenario.cardNumber)
    const result = { ...scenario, viewport, status: 'FAIL', errors: [], ignoredNetworkErrors: [] }
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    const consoleErrors = captureErrors(page)
    try {
      const localArt = readFileSync(resolve(root, `output/st6-st10/images/${scenario.cardNumber}.webp`))
      await page.route(card.imageUrl, route => route.fulfill({ status: 200, contentType: 'image/webp', body: localArt }))
      const url = new URL('/', baseUrl)
      url.searchParams.set('test-state', scenario.testState)
      url.searchParams.set('contract-card', scenario.cardNumber)
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      result.before = await readState(page)
      result.traceBefore = await readTrace(page)
      assert.deepEqual(result.traceBefore, [], 'the test-state must not fabricate Browser commands')
      assert.equal(result.before.own.battle[0]?.name, 'Aquamarine Cookie')
      assert.equal(result.before.own.battle[0]?.hp, 2)
      assert.equal(result.before.own.support.length, 1)
      assert.equal(result.before.opponent.battle[0]?.name, 'Devil Cookie')
      assert.equal(result.before.opponent.battle[0]?.hp, 4)
      assert.equal(result.before.opponent.hand.length, scenario.activate ? 1 : 0)

      const source = page.locator('.bottom-field .combat-card-wrap').filter({
        has: page.locator('.card-face[title="Aquamarine Cookie"]'),
      }).first()
      await clickReady(source.locator('.card-face.is-attackable'), 'Aquamarine Cookie printed attack')
      const paymentPanel = page.locator('[data-testid="attack-payment-panel"]:visible')
      await paymentPanel.waitFor({ state: 'visible' })
      const support = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').first()
      result.attackPaymentId = await support.evaluate(node => node.closest('.support-card-wrap')?.getAttribute('data-card-instance-id'))
      await clickReady(support, 'one blue support for the printed N attack')
      const targetId = result.before.opponent.battle[0].id
      await clickReady(
        page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${targetId}"] .card-face[aria-label^="選擇攻擊目標："]`),
        'the physical Cookie holding the printed FLIP',
      )
      // The contract trace is intentionally filtered to the FLIP card under
      // test, so the separate ST9-002 declare-attack command is not included.
      await waitForCommand(page, 'resolve-next-damage')
      const flipModal = page.locator('.flip-response-modal:visible').first()
      await flipModal.waitFor({ state: 'visible' })
      assert.ok((await flipModal.innerText()).includes(card.name), 'the real HP reveal must open the defender-controlled FLIP modal')
      const paymentCards = flipModal.locator('.flip-card-page button')
      const activateFlip = flipModal.getByRole('button', { name: '發動 FLIP', exact: true })
      result.flipUi = {
        cardName: card.name,
        handPaymentCount: await paymentCards.count(),
        activateDisabledBeforeChoice: await activateFlip.isDisabled(),
      }
      await page.screenshot({ path: resolve(output, `${scenario.id}-${viewport.width}-flip-payment.png`), fullPage: true })
      if (scenario.activate) {
        assert.equal(result.flipUi.handPaymentCount, 1, 'the defender must see the actual printed hand-cost choice')
        assert.equal(result.flipUi.activateDisabledBeforeChoice, true, 'FLIP cannot be activated before paying its printed discard cost')
        result.flipUi.handPaymentCard = (await paymentCards.first().innerText()).trim()
        await clickReady(paymentCards.first(), 'select one real hand card for the FLIP cost')
        assert.equal(await paymentCards.first().evaluate(node => node.classList.contains('is-selected')), true)
        assert.equal(await activateFlip.isEnabled(), true, 'the printed FLIP becomes payable after selecting one hand card')
        await clickReady(activateFlip, 'confirm the player-controlled FLIP payment')
      } else {
        assert.equal(result.flipUi.handPaymentCount, 0, 'the defender must have no card available for the printed hand cost')
        assert.equal(result.flipUi.activateDisabledBeforeChoice, true, 'the unaffordable FLIP must remain disabled')
        await clickReady(flipModal.getByRole('button', { name: '不發動', exact: true }), 'skip the unaffordable FLIP')
      }
      await waitForCommand(page, 'resolve-flip')
      await settleAnimation(page)
      result.after = await waitForState(page, state =>
        state.opponent.battle[0]?.hp === (scenario.activate ? 4 : 3) &&
        state.own.battle[0]?.rested === true &&
        state.own.support.filter(item => item.rested).length === 1 &&
        state.opponent.hand.length === 0,
      `ST9 attack and FLIP sequence did not settle for ${scenario.id}`)
      result.trace = await readTrace(page)
      const revealTrace = result.trace.find(entry => entry.commandKind === 'resolve-next-damage')
      assert.ok(revealTrace?.summary.includes(card.name), 'the public damage trace must identify the revealed physical FLIP')
      const flipTrace = result.trace.find(entry => entry.commandKind === 'resolve-flip')
      assert.ok(flipTrace, 'the optional FLIP decision must reach the authoritative command trace')
      if (scenario.activate) {
        assert.match(flipTrace.summary, new RegExp(`${card.name}.*FLIP`))
        assert.ok(flipTrace.steps.some(step => /棄置手牌/.test(step)), 'the public trace must record the printed discard cost')
        assert.deepEqual(result.after.own.support.filter(item => item.rested).map(item => item.id), [result.attackPaymentId])
        assert.equal(result.after.opponent.deck, result.before.opponent.deck - 1, 'one real deck card becomes the gained HP')
        assert.equal(result.after.opponent.trash, result.before.opponent.trash + 2, 'the FLIP and exactly one hand-cost card enter trash')
        await page.waitForFunction(imageUrl => [...document.images].some(image =>
          image.src === imageUrl && image.complete && image.naturalWidth > 0), card.imageUrl)
        result.originalArt = await page.evaluate(imageUrl => {
          const image = [...document.images].find(candidate => candidate.src === imageUrl)
          return image ? { src: image.src, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight } : null
        }, card.imageUrl)
        assert.equal(result.originalArt?.src, card.imageUrl, 'the visible FLIP must use the original official image URL')
        assert.ok(result.originalArt?.naturalWidth > 0 && result.originalArt?.naturalHeight > 0,
          'the original local card art must load at its actual source dimensions')
      } else {
        assert.match(flipTrace.summary, /選擇不發動 FLIP 效果/)
        assert.equal(result.after.opponent.deck, result.before.opponent.deck)
        assert.equal(result.after.opponent.trash, result.before.opponent.trash + 1, 'only the revealed FLIP moves to trash')
      }
      assert.deepEqual(consoleErrors.errors, [])
      result.ignoredNetworkErrors = consoleErrors.ignoredNetworkErrors
      await page.screenshot({ path: resolve(output, `${scenario.id}-${viewport.width}-resolved.png`), fullPage: true })
      result.status = 'PASS'
    } catch (error) {
      result.error = String(error.stack ?? error)
      result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 10000)
      result.finalState = await readState(page).catch(() => null)
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
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), viewports, scenarios: results }, null, 2))
  await browser?.close().catch(() => {})
  server?.kill()
}

console.log(JSON.stringify({ total: results.length, passed: results.filter(result => result.status === 'PASS').length, results }, null, 2))
if (results.some(result => result.status !== 'PASS')) process.exitCode = 1
