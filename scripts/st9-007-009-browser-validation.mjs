import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cardNumbers = ['ST9-006', 'ST9-007', 'ST9-008', 'ST9-009']
const candidateDocument = JSON.parse(readFileSync(resolve(root, 'data/cards/official-st9.en.json'), 'utf8'))
const st9004To006Document = JSON.parse(readFileSync(resolve(root, 'data/cards/official-st9-004-006.en.json'), 'utf8'))
const formalPath = resolve(root, 'data/cards/official-st9-007-008.en.json')
const formalDocument = existsSync(formalPath) ? JSON.parse(readFileSync(formalPath, 'utf8')) : undefined
const cards = new Map(cardNumbers.map(cardNumber => [
  cardNumber,
  formalDocument?.cards.find(record => record.cardNumber === cardNumber) ??
    st9004To006Document.cards.find(record => record.cardNumber === cardNumber) ??
    candidateDocument.cards.find(record => record.cardNumber === cardNumber),
]))
for (const cardNumber of cardNumbers) {
  assert.ok(cards.get(cardNumber)?.imageUrl, `original printed ${cardNumber} record is required`)
  assert.ok(existsSync(resolve(root, `output/st6-st10/images/${cardNumber}.webp`)), `original printed ${cardNumber} art is required`)
}
const artDimensions = new Map(cardNumbers.map(cardNumber => {
  const art = readFileSync(resolve(root, `output/st6-st10/images/${cardNumber}.webp`))
  assert.equal(art.toString('ascii', 0, 4), 'RIFF', `${cardNumber} art must be a WebP RIFF file`)
  assert.equal(art.toString('ascii', 8, 12), 'WEBP', `${cardNumber} art must be WebP`)
  assert.equal(art.toString('ascii', 12, 16), 'VP8X', `${cardNumber} art must use the extended WebP header`)
  return [cardNumber, { width: art.readUIntLE(24, 3) + 1, height: art.readUIntLE(27, 3) + 1 }]
}))

const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4195)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}`
const output = resolve(root, process.env.ST9_BROWSER_OUTPUT_DIR ?? 'output/st6-st10/st9-007-009-browser')
assert.equal(existsSync(output), false, 'Use a fresh ST9 Browser output directory')
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
    'src/game/demo.ts', 'src/game/st9-007-009-demo.ts', 'src/game/st9-004-006-demo.ts',
    'src/game/st9-009-trigger.test.ts', 'src/game/commands.ts', 'src/game/battle.ts',
    'src/game/skills.ts', 'src/game/effects/execute.ts', 'src/game/effects/hand-to-trash-trigger.ts',
    'src/game/generated-card-pool.ts', 'src/cards/official-effect-adapter.ts',
    'src/hooks/useMatchController.ts', 'src/hooks/usePendingEffect.ts',
    'src/components/effects/EffectPanel.tsx', 'src/components/modals/PendingDecisionModals.tsx',
    'src/components/battle/PendingDecisionModals.tsx',
  ].map(path => resolve(root, path)).filter(existsSync)
  const staleInputs = buildInputs.filter(path => statSync(path).mtimeMs > buildTime)
  if (staleInputs.length > 0) throw new Error(`dist/index.html is older than ST9 sources; build required: ${staleInputs.join(', ')}`)
}

mkdirSync(output, { recursive: true })
const server = process.env.BRAVERSE_BASE_URL ? undefined : spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: root, stdio: 'ignore', windowsHide: true },
)
const wait = ms => new Promise(resolvePromise => setTimeout(resolvePromise, ms))
const waitForPreview = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) {
      throw new Error(`Owned ST9 preview exited before acceptance: ${server.exitCode}`)
    }
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
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({
  commandKind: entry.commandKind,
  summary: entry.summary,
  steps: entry.steps,
})))
const waitForCommand = (page, kind, count = 1) => page.waitForFunction(
  ({ expected, minimum }) => (window.__braverseContractTrace ?? [])
    .filter(entry => entry.commandKind === expected).length >= minimum,
  { expected: kind, minimum: count },
  { timeout: 20000 },
)
const readState = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent?.match(/\d+/)?.[0] ?? 0)
    const getCard = node => ({
      id: node.getAttribute('data-card-instance-id'),
      name: node.querySelector('.card-face')?.getAttribute('title') ?? node.querySelector('img')?.getAttribute('alt') ?? '',
      rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
    })
    return {
      deck: count('.deck-zone .resource-summary > strong'),
      trash: count('.discard-zone.resource-summary > strong'),
      hand: [...(field?.querySelectorAll('.hand-card-wrap') ?? [])].map(getCard),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(getCard),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({
        ...getCard(node),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
      })),
    }
  }
  return { own: side('bottom'), opponent: side('top') }
})
const waitForState = async (page, predicate, label) => {
  let latest
  for (let attempt = 0; attempt < 100; attempt += 1) {
    latest = await readState(page)
    if (predicate(latest)) return latest
    await page.waitForTimeout(150)
  }
  throw new Error(`${label}; latest visible state: ${JSON.stringify(latest)}`)
}
const settleAnimation = async page => {
  for (let step = 0; step < 20; step += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click({ timeout: 1000 }).catch(() => {})
    await page.waitForTimeout(100)
  }
}
const captureErrors = page => {
  const errors = []
  const ignoredNetworkErrors = []
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
  page.on('console', message => {
    if (message.type() !== 'error') return
    const url = message.location().url ?? ''
    const value = `${message.text()} (${url || 'unknown URL'})`
    if ((url.endsWith('/favicon.ico') && message.text().includes('404')) ||
        (url.includes('cookierunbraverse.com/data/en_storage/') && /ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(message.text()))) {
      ignoredNetworkErrors.push(value)
    } else errors.push(value)
  })
  return { errors, ignoredNetworkErrors }
}
const sourceCard = (page, name) => page.locator('.bottom-field .combat-card-wrap').filter({
  has: page.locator(`.card-face[title="${name}"]`),
}).first()
const selectAttackPayments = async (page, evidence, count, targetIndex = 0) => {
  await page.locator('[data-testid="attack-payment-panel"]:visible').waitFor({ state: 'visible' })
  evidence.attackPaymentIds = []
  for (let index = 0; index < count; index += 1) {
    const payment = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').first()
    evidence.attackPaymentIds.push(await payment.evaluate(node => node.closest('.support-card-wrap')?.getAttribute('data-card-instance-id')))
    await clickReady(payment, `attack payment ${index + 1}`)
  }
  const targetId = evidence.before.opponent.battle[targetIndex]?.id
  const target = page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${targetId}"] .card-face[aria-label^="選擇攻擊目標："]`)
  await clickReady(target, 'printed Cookie attack target')
}
const chooseDraw = async (page, drawCount, evidence) => {
  const modal = page.locator('.draw-up-to-modal:visible').last()
  await modal.waitFor({ state: 'visible' })
  const options = modal.locator('.draw-up-to-option')
  assert.ok(await options.count() > drawCount, `draw option ${drawCount} must be available`)
  await clickReady(options.nth(drawCount), `choose draw ${drawCount}`)
  evidence.drawSelection = await modal.innerText()
  await clickReady(modal.locator('.draw-up-to-actions button').last(), 'confirm draw choice')
  await waitForCommand(page, 'resolve-draw-up-to')
}

const scenarios = [
  { cardNumber: 'ST9-007', id: 'activate-draw-zero', route: 'card:ST9-007', flow: 'activate', drawCount: 0 },
  { cardNumber: 'ST9-007', id: 'activate-draw-one', route: 'card:ST9-007', flow: 'activate', drawCount: 1 },
  { cardNumber: 'ST9-007', id: 'activate-high-hand', route: 'card-negative:ST9-007', flow: 'high-hand' },
  { cardNumber: 'ST9-008', id: 'on-play-return-and-gain-hp', route: 'card:ST9-008', flow: 'on-play' },
  { cardNumber: 'ST9-008', id: 'on-play-no-eligible-return', route: 'card-negative:ST9-008', flow: 'on-play-negative' },
  { cardNumber: 'ST9-009', id: 'sea-fairy-then-discards-wave-drop', route: 'card:ST9-009', flow: 'sea-fairy-then', sourceCards: ['ST9-006'], contractCards: 'ST9-006,ST9-009', discardWaveDrop: true },
  { cardNumber: 'ST9-009', id: 'sea-fairy-then-keeps-wave-drop', route: 'card-negative:ST9-009', flow: 'sea-fairy-then', sourceCards: ['ST9-006'], contractCards: 'ST9-006,ST9-009', discardWaveDrop: false },
]
const viewports = [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]
const requestedScenario = process.env.ST9_BROWSER_SCENARIO
const requestedWidth = Number(process.env.ST9_BROWSER_VIEWPORT_WIDTH ?? 0)
const activeScenarios = requestedScenario ? scenarios.filter(scenario => scenario.id === requestedScenario) : scenarios
const activeViewports = requestedWidth ? viewports.filter(viewport => viewport.width === requestedWidth) : viewports
if (!activeScenarios.length) throw new Error(`Unknown ST9_BROWSER_SCENARIO: ${requestedScenario}`)
if (!activeViewports.length) throw new Error(`Unknown ST9_BROWSER_VIEWPORT_WIDTH: ${requestedWidth}`)

const activate007 = async (page, evidence, drawCount) => {
  const source = sourceCard(page, cards.get('ST9-007').name)
  await clickReady(source.locator('.skill-action').filter({ hasText: '啟動技能' }).first(), 'Peppermint Activate')
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
  await panel.waitFor({ state: 'visible' })
  evidence.activatePanel = await panel.innerText()
  await clickReady(panel.locator('.effect-panel-primary-action:visible').last(), 'resolve Peppermint Activate')
  await waitForCommand(page, 'begin-activate-skill')
  await waitForCommand(page, 'resolve-ability-effect')
  await chooseDraw(page, drawCount, evidence)
  evidence.after = await waitForState(page, current => current.own.hand.length === 3 + drawCount,
    'Peppermint draw selection did not settle')
  assert.equal(evidence.after.own.battle.find(cookie => cookie.name === cards.get('ST9-007').name)?.rested, false)
  assert.equal(evidence.after.own.deck, evidence.before.own.deck - drawCount)
  const skill = sourceCard(page, cards.get('ST9-007').name).locator('.skill-action').filter({ hasText: '啟動技能' }).first()
  assert.ok(!await visible(skill) || !await skill.isEnabled(), 'Once Per Turn must prevent another ST9-007 activation')
}

const highHand007 = async (page, evidence) => {
  const skill = sourceCard(page, cards.get('ST9-007').name).locator('.skill-action').filter({ hasText: '啟動技能' })
  assert.equal(evidence.before.own.hand.length, 4)
  assert.ok(await skill.count() === 0 || !await skill.first().isEnabled(), 'four cards must block the printed Activate condition')
  evidence.after = await readState(page)
  evidence.trace = await trace(page)
  assert.deepEqual(evidence.after, evidence.before)
  assert.equal(evidence.trace.some(entry => entry.commandKind === 'begin-activate-skill'), false)
}

const deploy008 = async (page, evidence) => {
  const instanceId = evidence.before.own.hand.find(card => card.name === cards.get('ST9-008').name)?.id
  assert.ok(instanceId, 'original Crimson Coral must begin in the hand')
  const handCard = page.locator(`.bottom-field .hand-card-wrap[data-card-instance-id="${instanceId}"]`)
  await handCard.locator('.hand-card').click()
  await clickReady(handCard.locator('.hand-card-action').filter({ hasText: '登場' }).first(), 'deploy Crimson Coral')
  await waitForCommand(page, 'deploy-cookie')
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
  await panel.waitFor({ state: 'visible' })
  evidence.onPlayPanel = await panel.innerText()
  assert.match(evidence.onPlayPanel, /LV\.2|LV\. 2|LV\.2 以下|返回手牌/)
  const returnedCookie = panel.locator('.effect-candidates-battle-to-hand button').filter({ hasText: 'Sugar Swan Cookie' }).first()
  await clickReady(returnedCookie, 'select the real LV.2 Sugar Swan cost')
  await clickReady(panel.locator('.effect-panel-primary-action:visible').last(), 'pay the On Play return cost')
  await waitForCommand(page, 'begin-activate-skill')
  await waitForCommand(page, 'resolve-ability-effect')
  evidence.after = await waitForState(page,
    current => current.own.battle.find(cookie => cookie.name === cards.get('ST9-008').name)?.hp === 6 &&
      current.own.hand.some(card => card.name === 'Sugar Swan Cookie'),
    'Crimson Coral did not return Sugar Swan and gain its printed HP')
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some(entry => entry.commandKind === 'deploy-cookie'))
  assert.ok(evidence.trace.some(entry => entry.commandKind === 'begin-activate-skill'))
  assert.ok(evidence.trace.some(entry => entry.commandKind === 'resolve-ability-effect'))
}

const noEligibleReturn008 = async (page, evidence) => {
  const instanceId = evidence.before.own.hand.find(card => card.name === cards.get('ST9-008').name)?.id
  assert.ok(instanceId)
  assert.equal(evidence.before.own.battle.filter(cookie => cookie.name !== cards.get('ST9-008').name)
    .every(cookie => cookie.name === 'Sea Fairy Cookie'), true)
  const handCard = page.locator(`.bottom-field .hand-card-wrap[data-card-instance-id="${instanceId}"]`)
  await handCard.locator('.hand-card').click()
  await clickReady(handCard.locator('.hand-card-action').filter({ hasText: '登場' }).first(), 'deploy Crimson Coral without a return candidate')
  await waitForCommand(page, 'deploy-cookie')
  evidence.after = await waitForState(page,
    current => current.own.battle.some(cookie => cookie.name === cards.get('ST9-008').name) &&
      current.own.hand.length === evidence.before.own.hand.length - 1,
    'Crimson Coral should deploy while its unavailable On Play is skipped')
  await page.waitForTimeout(300)
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some(entry => entry.commandKind === 'skip-on-play'))
  assert.equal(evidence.trace.some(entry => entry.commandKind === 'begin-activate-skill'), false)
  assert.equal(evidence.after.own.battle.find(cookie => cookie.name === cards.get('ST9-008').name)?.hp, 5)
  assert.equal(evidence.after.own.battle.some(cookie => cookie.name === 'Sea Fairy Cookie'), true)
  assert.equal(evidence.after.own.hand.some(card => card.name === 'Sea Fairy Cookie'), false)
}

const seaFairyThen = async (page, evidence, discardWaveDrop) => {
  const seaFairy = cards.get('ST9-006')
  const waveDropCard = cards.get('ST9-009')
  const source = sourceCard(page, seaFairy.name)
  await clickReady(source.locator('.card-face.is-attackable'), 'Sea Fairy printed BBB attack')
  await selectAttackPayments(page, evidence, 3)
  await waitForCommand(page, 'declare-attack')
  await waitForCommand(page, 'resolve-attack-effect')

  const optional = page.locator('.optional-cost-attack-inline:visible').first()
  await optional.waitFor({ state: 'visible' })
  evidence.thenPanel = await optional.innerText()
  assert.match(evidence.thenPanel, /discard 2 cards|棄置 2 張|棄牌 2 張|棄 2 張/)
  await clickReady(optional.getByRole('button', { name: '支付', exact: true }), 'pay the printed discard-two Then')
  const discard = optional.locator('.optional-cost-col').filter({ hasText: /手牌|棄牌/ })
    .locator('.modal-card-options button:not(.is-selected)')
  assert.equal(await discard.count(), evidence.before.own.hand.length)
  const waveDropOption = discard.filter({ hasText: waveDropCard.name })
  assert.equal(await waveDropOption.count(), 1, 'Wave Drop must be a legal hand-cost candidate')
  evidence.discardedNames = []
  const otherDiscard = discard.filter({ hasNotText: waveDropCard.name })
  if (discardWaveDrop) {
    evidence.discardedNames.push(await waveDropOption.innerText())
    await clickReady(waveDropOption, 'discard the original Wave Drop for Sea Fairy Then')
    evidence.discardedNames.push(await otherDiscard.first().innerText())
    await clickReady(otherDiscard.first(), 'select the second printed Then discard')
  } else {
    assert.equal(await waveDropOption.count(), 1, 'Wave Drop must remain an available card while two other cards are paid')
    assert.equal(await otherDiscard.count(), evidence.before.own.hand.length - 1)
    for (let index = 0; index < 2; index += 1) {
      evidence.discardedNames.push(await otherDiscard.first().innerText())
      await clickReady(otherDiscard.first(), `select non-Wave-Drop card ${index + 1}`)
    }
  }

  await clickReady(optional.getByRole('button', { name: '下一步', exact: true }).last(),
    'continue to Sea Fairy all-opponent damage')
  const targets = optional.locator('.optional-cost-col .modal-card-options button')
  assert.equal(await targets.count(), evidence.before.opponent.battle.length)
  const confirm = optional.getByRole('button', { name: '確認', exact: true }).last()
  for (let index = 0; index < await targets.count(); index += 1) {
    await clickReady(targets.nth(index), `select opponent Cookie ${index + 1} for printed Then damage`)
  }
  await settleAnimation(page)
  evidence.paymentScreenshot = resolve(output, `${evidence.scenario}-${evidence.viewport.width}-payment.png`)
  await page.screenshot({ path: evidence.paymentScreenshot, fullPage: true })
  await clickReady(confirm, 'confirm Sea Fairy discard-two Then')
  await waitForCommand(page, 'resolve-optional-cost-attack')

  if (discardWaveDrop) {
    const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
    await panel.waitFor({ state: 'visible' })
    evidence.waveDropPanel = await panel.innerText()
    assert.match(evidence.waveDropPanel, /Wave Drop|抽|draw/i)
    await clickReady(panel.locator('.effect-panel-primary-action:visible').last(), 'resolve Wave Drop passive')
    await waitForCommand(page, 'resolve-ability-effect')
    await chooseDraw(page, 1, evidence)
    evidence.after = await waitForState(page,
      current => current.own.hand.length === evidence.before.own.hand.length - 1 &&
        current.own.deck === evidence.before.own.deck - 1 &&
        !current.own.hand.some(card => card.name === waveDropCard.name) &&
        current.own.battle.filter(cookie => cookie.rested).length === 1 &&
        current.opponent.battle.map(cookie => cookie.hp).join(',') === '1,2' &&
        current.opponent.trash === evidence.before.opponent.trash + 5 &&
        current.own.trash === evidence.before.own.trash + 2,
      'ST9-009 did not trigger and draw after Sea Fairy paid its Then cost')
  } else {
    evidence.after = await waitForState(page,
      current => current.own.hand.length === evidence.before.own.hand.length - 2 &&
        current.own.hand.some(card => card.name === waveDropCard.name) &&
        current.opponent.battle.map(cookie => cookie.hp).join(',') === '1,2' &&
        current.opponent.trash === evidence.before.opponent.trash + 5 &&
        current.own.trash === evidence.before.own.trash + 2,
      'Wave Drop should remain in hand when Sea Fairy discards other cards')
    assert.equal(await page.locator('.draw-up-to-modal:visible').count(), 0)
  }
  await settleAnimation(page)
  evidence.after = await readState(page)
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some(entry => entry.commandKind === 'declare-attack'))
  assert.ok(evidence.trace.some(entry => entry.commandKind === 'resolve-optional-cost-attack'))
  // Public contract traces omit private command payloads. Check the actual UI
  // payment choices and public zone changes here; rule tests check instance IDs.
  assert.equal(evidence.before.own.hand.filter(card => card.name === waveDropCard.name).length, 1)
  assert.equal(evidence.discardedNames.length, 2)
  assert.equal(evidence.discardedNames.filter(name => name.includes(waveDropCard.name)).length,
    discardWaveDrop ? 1 : 0)
  if (discardWaveDrop) {
    assert.ok(evidence.trace.some(entry => entry.commandKind === 'resolve-ability-effect'))
    assert.ok(evidence.trace.some(entry => entry.commandKind === 'resolve-draw-up-to'))
    assert.equal(evidence.after.own.hand.length, evidence.before.own.hand.length - 1)
    assert.equal(evidence.after.own.deck, evidence.before.own.deck - 1)
    assert.equal(evidence.after.own.hand.some(card => card.name === waveDropCard.name), false)
  } else {
    assert.equal(evidence.trace.some(entry => entry.commandKind === 'resolve-ability-effect'), false)
    assert.equal(evidence.after.own.hand.some(card => card.name === waveDropCard.name), true)
  }
  assert.equal(evidence.after.own.support.filter(item => item.rested).length, 3)
  assert.ok(evidence.trace.find(entry => entry.commandKind === 'resolve-optional-cost-attack')
    ?.steps.join(' ').includes('Sea Fairy Cookie'))
}

const scenariosResult = []
let browser
try {
  if (!process.env.BRAVERSE_BASE_URL) {
    if (!existsSync(distIndex)) throw new Error('dist/index.html is missing; build must finish before Browser validation')
  }
  await waitForPreview()
  browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) })
  for (const viewport of activeViewports) for (const scenario of activeScenarios) {
    const card = cards.get(scenario.cardNumber)
    const page = await browser.newPage({ viewport })
    page.setDefaultTimeout(15000)
    const console = captureErrors(page)
    const evidence = {
      card: scenario.cardNumber, scenario: scenario.id, testState: scenario.route, viewport,
      contractCards: scenario.contractCards ?? scenario.cardNumber,
      status: 'FAIL', errors: console.errors, ignoredNetworkErrors: console.ignoredNetworkErrors,
      originalArt: null,
    }
    try {
      for (const artCardNumber of new Set([scenario.cardNumber, ...(scenario.sourceCards ?? [])])) {
        const artCard = cards.get(artCardNumber)
        await page.route(artCard.imageUrl, route => route.fulfill({
          status: 200, contentType: 'image/webp',
          body: readFileSync(resolve(root, `output/st6-st10/images/${artCardNumber}.webp`)),
        }))
      }
      const url = new URL('/', baseUrl)
      url.searchParams.set('test-state', scenario.route)
      url.searchParams.set('contract-card', scenario.contractCards ?? scenario.cardNumber)
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      await settleAnimation(page)
      evidence.before = await readState(page)
      evidence.traceBefore = await trace(page)
      assert.deepEqual(evidence.traceBefore, [], 'fixture setup must not fabricate Browser commands')
      await page.waitForFunction(imageUrl => [...document.images].some(image =>
        image.src === imageUrl && image.complete && image.naturalWidth > 0), card.imageUrl)
      evidence.originalArt = await page.evaluate(imageUrl => {
        const image = [...document.images].find(candidate => candidate.src === imageUrl)
        return image ? { src: image.src, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight } : null
      }, card.imageUrl)
      const dimensions = artDimensions.get(scenario.cardNumber)
      assert.deepEqual([evidence.originalArt?.naturalWidth, evidence.originalArt?.naturalHeight],
        [dimensions.width, dimensions.height], 'the original printed card art must render at its native dimensions')
      evidence.sourceArt = []
      for (const sourceCardNumber of scenario.sourceCards ?? []) {
        const sourceCardRecord = cards.get(sourceCardNumber)
        await page.waitForFunction(imageUrl => [...document.images].some(image =>
          image.src === imageUrl && image.complete && image.naturalWidth > 0), sourceCardRecord.imageUrl)
        const originalSourceArt = await page.evaluate(imageUrl => {
          const image = [...document.images].find(candidate => candidate.src === imageUrl)
          return image ? { src: image.src, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight } : null
        }, sourceCardRecord.imageUrl)
        const sourceDimensions = artDimensions.get(sourceCardNumber)
        assert.deepEqual([originalSourceArt?.naturalWidth, originalSourceArt?.naturalHeight],
          [sourceDimensions.width, sourceDimensions.height], `${sourceCardNumber} original art must render at native dimensions`)
        evidence.sourceArt.push({ cardNumber: sourceCardNumber, ...originalSourceArt })
      }

      if (scenario.flow === 'activate') await activate007(page, evidence, scenario.drawCount)
      else if (scenario.flow === 'high-hand') await highHand007(page, evidence)
      else if (scenario.flow === 'on-play') await deploy008(page, evidence)
      else if (scenario.flow === 'on-play-negative') await noEligibleReturn008(page, evidence)
      else if (scenario.flow === 'sea-fairy-then') await seaFairyThen(page, evidence, scenario.discardWaveDrop)
      assert.deepEqual(console.errors, [])
      evidence.trace ??= await trace(page)
      evidence.screenshot = resolve(output, `${scenario.id}-${viewport.width}-PASS.png`)
      await page.screenshot({ path: evidence.screenshot, fullPage: true })
      evidence.status = 'PASS'
    } catch (error) {
      evidence.error = String(error.stack ?? error)
      evidence.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 9000)
      evidence.after = await readState(page).catch(() => null)
      evidence.trace = await trace(page).catch(() => [])
      evidence.screenshot = resolve(output, `${scenario.id}-${viewport.width}-${evidence.status}.png`)
      await page.screenshot({ path: evidence.screenshot, fullPage: true }).catch(() => {})
    }
    scenariosResult.push(evidence)
    await page.close()
  }
} finally {
  if (browser) await browser.close()
  if (server) server.kill()
}

const report = {
  generatedAt: new Date().toISOString(),
  scope: 'ST9-007 through ST9-009 original-card local test-state Browser acceptance through actual payment/target UI, ability timing, printed Then costs, ST9-009 hand-to-trash passive resolution, and settlement. This is not online or full-match acceptance.',
  viewports: activeViewports,
  scenarios: scenariosResult,
}
const reportPath = resolve(output, 'results.json')
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
const summary = {
  reportPath,
  total: scenariosResult.length,
  passed: scenariosResult.filter(result => result.status === 'PASS').length,
  failed: scenariosResult.filter(result => result.status !== 'PASS').length,
  failures: scenariosResult.filter(result => result.status !== 'PASS').map(result => ({
    card: result.card,
    scenario: result.scenario,
    viewport: result.viewport.width,
    error: result.error?.split('\n')[0],
  })),
}
console.log(JSON.stringify(summary, null, 2))
if (summary.failed > 0) process.exitCode = 1
