import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cardNumbers = ['ST9-004', 'ST9-005', 'ST9-006']
const candidateDocument = JSON.parse(readFileSync(resolve(root, 'data/cards/official-st9-004-006.en.json'), 'utf8'))
const formalPath = resolve(root, 'data/cards/official-st9-004-006.en.json')
const formalDocument = existsSync(formalPath) ? JSON.parse(readFileSync(formalPath, 'utf8')) : undefined
const cards = new Map(cardNumbers.map(cardNumber => [
  cardNumber,
  formalDocument?.cards.find(record => record.cardNumber === cardNumber) ??
    candidateDocument.cards.find(record => record.cardNumber === cardNumber),
]))
for (const cardNumber of cardNumbers) {
  assert.ok(cards.get(cardNumber)?.imageUrl, `original printed ${cardNumber} record is required`)
  assert.ok(existsSync(resolve(root, `output/st6-st10/images/${cardNumber}.webp`)), `original printed ${cardNumber} art is required`)
}
const originalArtDimensions = new Map(cardNumbers.map(cardNumber => {
  const art = readFileSync(resolve(root, `output/st6-st10/images/${cardNumber}.webp`))
  assert.equal(art.toString('ascii', 0, 4), 'RIFF', `${cardNumber} art must be a WebP RIFF file`)
  assert.equal(art.toString('ascii', 8, 12), 'WEBP', `${cardNumber} art must be WebP`)
  assert.equal(art.toString('ascii', 12, 16), 'VP8X', `${cardNumber} art must use the extended WebP header`)
  return [cardNumber, {
    width: art.readUIntLE(24, 3) + 1,
    height: art.readUIntLE(27, 3) + 1,
  }]
}))

const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4194)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}`
const output = resolve(root, 'output/st6-st10/st9-004-006-browser')
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
    'src/game/demo.ts', 'src/game/st9-004-006-demo.ts', 'src/game/battle.ts', 'src/game/commands.ts',
    'src/game/effects/execute.ts', 'src/game/generated-card-pool.ts', 'src/cards/official-effect-adapter.ts',
    'src/hooks/useMatchController.ts', 'src/hooks/usePendingEffect.ts',
    'src/components/battle/BattleResponseModals.tsx', 'src/components/battle/BattleRow.tsx',
    'src/components/modals/GameModals.tsx', 'src/components/modals/optionalCostAttackPrompt.ts',
    'src/components/effects/EffectPanel.tsx',
    'src/components/modals/PendingDecisionModals.tsx',
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
  for (let step = 0; step < 24; step += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click({ timeout: 1000 }).catch(() => {})
    await page.waitForTimeout(100)
  }
}
const waitForCommand = (page, kind, count = 1) => page.waitForFunction(
  ({ expected, minimum }) => (window.__braverseContractTrace ?? [])
    .filter(entry => entry.commandKind === expected).length >= minimum,
  { expected: kind, minimum: count },
  { timeout: 20000 },
)
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({
  commandKind: entry.commandKind,
  summary: entry.summary,
  steps: entry.steps,
  payload: entry.payload,
})))
const state = page => page.evaluate(() => {
  const readSide = name => {
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
      break: count('.break-zone .resource-summary > strong'),
      hand: [...(field?.querySelectorAll('.hand-card-wrap') ?? [])].map(card),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(card),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({
        ...card(node),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
      })),
    }
  }
  return { own: readSide('bottom'), opponent: readSide('top') }
})
const waitForObservedState = async (page, predicate, label) => {
  let latest
  for (let attempt = 0; attempt < 75; attempt += 1) {
    latest = await state(page)
    if (predicate(latest)) return latest
    await page.waitForTimeout(200)
  }
  throw new Error(`${label}; latest visible state: ${JSON.stringify(latest)}`)
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

const scenarios = [
  { cardNumber: 'ST9-004', id: 'flip-draw-zero', testState: 'card-attack:ST9-004', flow: 'flip', drawCount: 0 },
  { cardNumber: 'ST9-004', id: 'flip-draw-one', testState: 'card-attack:ST9-004', flow: 'flip', drawCount: 1 },
  { cardNumber: 'ST9-004', id: 'insufficient-bbb', testState: 'card-attack-negative:ST9-004', flow: 'attack-negative' },
  { cardNumber: 'ST9-005', id: 'blue-blocker', testState: 'card:ST9-005', flow: 'blocker' },
  { cardNumber: 'ST9-005', id: 'blocker-no-blue', testState: 'card-negative:ST9-005', flow: 'blocker-negative' },
  { cardNumber: 'ST9-006', id: 'activate-draw-zero-then', testState: 'card:ST9-006', flow: 'activate-then', drawCount: 0 },
  { cardNumber: 'ST9-006', id: 'activate-draw-one-then', testState: 'card:ST9-006', flow: 'activate-then', drawCount: 1 },
  { cardNumber: 'ST9-006', id: 'activate-high-hand', testState: 'card-negative:ST9-006', flow: 'high-hand' },
  { cardNumber: 'ST9-006', id: 'attack-insufficient-bbb', testState: 'card-attack-negative:ST9-006', flow: 'attack-negative' },
]
const viewports = [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]
const requestedScenario = process.env.ST9_BROWSER_SCENARIO
const requestedViewportWidth = Number(process.env.ST9_BROWSER_VIEWPORT_WIDTH ?? 0)
const activeScenarios = requestedScenario ? scenarios.filter(scenario => scenario.id === requestedScenario) : scenarios
const activeViewports = requestedViewportWidth ? viewports.filter(viewport => viewport.width === requestedViewportWidth) : viewports
if (activeScenarios.length === 0) throw new Error(`Unknown ST9_BROWSER_SCENARIO: ${requestedScenario}`)
if (activeViewports.length === 0) throw new Error(`Unknown ST9_BROWSER_VIEWPORT_WIDTH: ${requestedViewportWidth}`)
const results = []
let browser

const selectAttackPayments = async (page, count, evidence) => {
  await page.locator('[data-testid="attack-payment-panel"]:visible').waitFor({ state: 'visible' })
  evidence.attackPaymentIds = []
  for (let index = 0; index < count; index += 1) {
    const payment = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').first()
    evidence.attackPaymentIds.push(await payment.evaluate(node => node.closest('.support-card-wrap')?.getAttribute('data-card-instance-id')))
    await clickReady(payment, `blue attack payment ${index + 1}`)
  }
  const targetId = evidence.before.opponent.battle[0]?.id
  const target = page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${targetId}"] .card-face[aria-label^="選擇攻擊目標："]`)
  await clickReady(target, 'printed Cookie attack target')
  await waitForCommand(page, 'declare-attack')
}

const chooseDraw = async (page, drawCount, evidence) => {
  const modal = page.locator('.draw-up-to-modal:visible').last()
  await modal.waitFor({ state: 'visible' })
  const option = modal.locator('.draw-up-to-option').nth(drawCount)
  await clickReady(option, `draw ${drawCount}`)
  evidence.drawSelection = await modal.innerText()
  await clickReady(modal.locator('.draw-up-to-actions button').last(), 'confirm draw choice')
  await waitForCommand(page, 'resolve-draw-up-to')
}

const runFlip = async (page, evidence, drawCount) => {
  const source = page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator(`.card-face[title="${cards.get('ST9-004').name}"]`),
  }).first()
  await source.waitFor({ state: 'visible' })
  await clickReady(source.locator('.card-face.is-attackable'), 'Pond Dino printed attack')
  await selectAttackPayments(page, 3, evidence)
  const flipModal = page.locator('.flip-response-modal:visible').first()
  await flipModal.waitFor({ state: 'visible' })
  assert.ok((await flipModal.innerText()).includes(cards.get('ST9-004').name), 'the real HP card must offer its printed FLIP')
  await clickReady(flipModal.getByRole('button', { name: '發動 FLIP', exact: true }), 'activate Pond Dino FLIP')
  await waitForCommand(page, 'resolve-flip')
  await chooseDraw(page, drawCount, evidence)
  await waitForObservedState(page, current =>
    current.opponent.battle[0]?.hp === 1 &&
    current.opponent.hand.length === drawCount &&
    current.opponent.trash === 3,
  'Pond Dino attack did not reach its printed three-damage settlement')
  await settleAnimation(page)
  evidence.after = await state(page)
  evidence.trace = await trace(page)
  assert.equal(evidence.after.own.battle[0]?.rested, true)
  assert.equal(evidence.after.own.support.filter(item => item.rested).length, 3)
  assert.equal(evidence.after.opponent.battle[0]?.hp, 1)
  assert.equal(evidence.after.opponent.hand.length, drawCount)
  assert.equal(evidence.after.opponent.trash, 3)
  const flip = evidence.trace.find(entry => entry.commandKind === 'resolve-flip')
  assert.ok(flip?.summary.includes(cards.get('ST9-004').name), 'the original FLIP Cookie must be recorded')
  assert.ok(evidence.trace.some(entry => entry.commandKind === 'resolve-draw-up-to'))
  assert.ok(evidence.trace.some(entry => entry.commandKind === 'resolve-next-damage' &&
    entry.summary.includes(cards.get('ST9-004').name)), 'the contract trace must identify the original revealed FLIP card')
}

const runAttackNegative = async (page, evidence) => {
  const sourceCard = cards.get(evidence.card)
  const source = page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator(`.card-face[title="${sourceCard.name}"]`),
  }).first()
  const attack = source.locator('.card-face.is-attackable')
  assert.ok(!await visible(attack) || !await attack.first().isEnabled(), 'two active blue Supports cannot pay BBB')
  evidence.after = await state(page)
  evidence.trace = await trace(page)
  assert.deepEqual(evidence.after, evidence.before)
  assert.equal(evidence.trace.some(entry => entry.commandKind === 'declare-attack'), false)
}

const runBlocker = async (page, evidence, positive) => {
  const blocker = page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator(`.card-face[title="${cards.get('ST9-005').name}"]`),
  }).first()
  await blocker.waitFor({ state: 'visible' })
  if (!positive) {
    const response = page.locator('.attack-response-modal:visible').first()
    if (await visible(response)) {
      const candidate = response.locator('.modal-card-options button').filter({
        hasText: cards.get('ST9-005').name,
      })
      assert.equal(await candidate.count(), 0, 'wrong-color energy must not offer Mystic Opal as a Blocker response')
      const pass = response.getByRole('button', { name: '不發動', exact: true })
      if (await visible(pass)) await clickReady(pass, 'pass unavailable Blocker response')
    }
    evidence.after = await waitForObservedState(page, current =>
      current.own.battle.find(item => item.name === cards.get('ST9-005').name)?.hp === 3 &&
      current.own.battle.find(item => item.name === 'Lobster Cookie')?.hp === 1 &&
      current.own.support.every(item => !item.rested),
    'unblocked attack did not settle on the printed target')
    await settleAnimation(page)
    evidence.after = await state(page)
    evidence.trace = await trace(page)
    assert.equal(evidence.trace.some(entry => entry.commandKind === 'play-blocker'), false)
    assert.equal(evidence.after.own.battle.find(item => item.name === cards.get('ST9-005').name)?.hp, 3)
    assert.equal(evidence.after.own.battle.find(item => item.name === 'Lobster Cookie')?.hp, 1)
    assert.equal(evidence.after.own.support.some(item => item.rested), false)
    return
  }

  const response = page.locator('.attack-response-modal:visible').first()
  await response.waitFor({ state: 'visible' })
  const responseCandidate = response.locator('.modal-card-options button').filter({
    hasText: cards.get('ST9-005').name,
  }).first()
  await clickReady(responseCandidate, 'select Mystic Opal as Blocker response')
  const modal = page.locator('.blocker-response-modal:visible').first()
  await modal.waitFor({ state: 'visible' })
  const candidate = modal.locator('.blocker-candidates button:not(:disabled)').filter({
    hasText: cards.get('ST9-005').name,
  }).first()
  await clickReady(candidate, 'select Mystic Opal Blocker')
  const payment = modal.locator('.blocker-payment-candidates button:not(.is-selected):not(:disabled)').first()
  evidence.blockerPaymentId = await payment.evaluate(node => node.closest('[data-card-instance-id]')?.getAttribute('data-card-instance-id'))
  await clickReady(payment, 'pay blue Blocker cost')
  await clickReady(modal.getByRole('button', { name: '使用 Blocker', exact: true }), 'confirm Blocker')
  await waitForCommand(page, 'play-blocker')
  evidence.after = await waitForObservedState(page, current =>
    !current.own.battle.some(item => item.name === cards.get('ST9-005').name) &&
    current.own.battle.find(item => item.name === 'Lobster Cookie')?.hp === 5 &&
    current.own.support.filter(item => item.rested).length === 1 &&
    current.opponent.battle[0]?.rested === true,
  'Blocker response did not settle on the printed Blocker Cookie')
  await settleAnimation(page)
  evidence.after = await state(page)
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some(entry => entry.commandKind === 'play-blocker' &&
    entry.steps.join(' ').includes(cards.get('ST9-005').name)))
  assert.equal(evidence.after.own.support.filter(item => item.rested).length, 1)
  assert.equal(evidence.after.own.battle.some(item => item.name === cards.get('ST9-005').name), false)
  assert.equal(evidence.after.own.battle.find(item => item.name === 'Lobster Cookie')?.hp, 5)
  assert.equal(evidence.after.opponent.battle[0]?.rested, true)
}

const runHighHand = async (page, evidence) => {
  const source = page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator(`.card-face[title="${cards.get('ST9-006').name}"]`),
  }).first()
  const skill = source.locator('.skill-action')
  assert.ok(!await visible(skill) || !await skill.first().isEnabled(), 'hand size six must block the printed Activate')
  evidence.after = await state(page)
  evidence.trace = await trace(page)
  assert.equal(evidence.before.own.hand.length, 6)
  assert.deepEqual(evidence.after, evidence.before)
  assert.equal(evidence.trace.some(entry => entry.commandKind === 'begin-activate-skill'), false)
}

const runActivateThen = async (page, evidence, drawCount) => {
  const source = page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator(`.card-face[title="${cards.get('ST9-006').name}"]`),
  }).first()
  await source.locator('.skill-action').filter({ hasText: '啟動技能' }).first().waitFor({ state: 'visible' })
  await clickReady(source.locator('.skill-action').filter({ hasText: '啟動技能' }).first(), 'Sea Fairy Activate')
  const activation = page.locator('.effect-panel[role="alertdialog"]:visible').last()
  await activation.waitFor({ state: 'visible' })
  evidence.activationPanel = await activation.innerText()
  await clickReady(activation.locator('.effect-panel-primary-action:visible').last(), 'resolve Sea Fairy Activate')
  await waitForCommand(page, 'resolve-ability-effect')
  await chooseDraw(page, drawCount, evidence)
  await settleAnimation(page)
  evidence.afterActivation = await state(page)
  assert.equal(evidence.afterActivation.own.hand.length, 5 + drawCount)
  assert.equal(evidence.afterActivation.own.battle[0]?.rested, false)

  await clickReady(source.locator('.card-face.is-attackable'), 'Sea Fairy printed BBB attack')
  await selectAttackPayments(page, 3, evidence)
  await waitForCommand(page, 'resolve-attack-effect')
  const optional = page.locator('.optional-cost-attack-inline:visible').first()
  await optional.waitFor({ state: 'visible' })
  evidence.thenPanel = await optional.innerText()
  await clickReady(optional.getByRole('button', { name: '支付', exact: true }), 'pay printed discard-two Then')
  const discard = optional.locator('.optional-cost-col').filter({ hasText: /手牌|棄牌/ })
    .locator('.modal-card-options button:not(.is-selected)')
  assert.equal(await discard.count(), 5 + drawCount, 'the actual hand must be offered for the printed discard-two cost')
  evidence.discardedNames = []
  for (let index = 0; index < 2; index += 1) {
    const choice = discard.nth(index)
    evidence.discardedNames.push(await choice.innerText())
    await clickReady(choice, `discard printed Then card ${index + 1}`)
  }
  await clickReady(optional.getByRole('button', { name: '下一步', exact: true }).last(),
    'continue to the printed all-opponent target step')
  const targets = optional.locator('.optional-cost-col .modal-card-options button')
  assert.equal(await targets.count(), evidence.before.opponent.battle.length,
    'the Then target step must offer every opposing Cookie')
  evidence.thenTargets = []
  const confirm = optional.getByRole('button', { name: '確認', exact: true }).last()
  for (let index = 0; index < await targets.count(); index += 1) {
    const target = targets.nth(index)
    evidence.thenTargets.push(await target.innerText())
    await clickReady(target, `select opponent Cookie ${index + 1} for Then damage`)
    if (index < (await targets.count()) - 1) {
      assert.equal(await confirm.isEnabled(), false,
        'all-target damage must not confirm after selecting only part of the legal target set')
    }
  }
  await settleAnimation(page)
  await clickReady(confirm, 'confirm discard-two Then')
  await page.waitForTimeout(250)
  evidence.confirmFeedback = await page.locator('.status-toast').allTextContents()
  evidence.commandsAfterConfirm = (await trace(page)).map(entry => entry.commandKind)
  await waitForCommand(page, 'resolve-optional-cost-attack')
  evidence.after = await waitForObservedState(page, current =>
    current.own.hand.length === 3 + drawCount &&
    current.own.support.filter(item => item.rested).length === 3 &&
    current.opponent.battle.map(item => item.hp).join(',') === '1,2',
  'Sea Fairy attack and all-opponent damage did not settle')
  await settleAnimation(page)
  evidence.after = await state(page)
  evidence.trace = await trace(page)
  assert.equal(evidence.after.own.hand.length, 3 + drawCount)
  assert.equal(evidence.after.own.support.filter(item => item.rested).length, 3)
  assert.deepEqual(evidence.after.opponent.battle.map(item => item.hp), [1, 2])
  assert.ok(evidence.trace.some(entry => entry.commandKind === 'begin-activate-skill'))
  assert.ok(evidence.trace.some(entry => entry.commandKind === 'resolve-ability-effect'))
  assert.ok(evidence.trace.some(entry => entry.commandKind === 'resolve-draw-up-to'))
  assert.ok(evidence.trace.some(entry => entry.commandKind === 'declare-attack'))
  const thenTrace = evidence.trace.find(entry => entry.commandKind === 'resolve-optional-cost-attack')
  assert.ok(thenTrace, 'the discard-two Then must be submitted as an authoritative command')
  assert.ok(thenTrace.steps.join(' ').includes('Sea Fairy Cookie'))
}

try {
  await waitForPreview()
  browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) })
  for (const viewport of activeViewports) for (const scenario of activeScenarios) {
    const card = cards.get(scenario.cardNumber)
    const page = await browser.newPage({ viewport })
    page.setDefaultTimeout(15000)
    const console = captureErrors(page)
    const evidence = {
      card: scenario.cardNumber, scenario: scenario.id, testState: scenario.testState, viewport,
      status: 'FAIL', errors: console.errors, ignoredNetworkErrors: console.ignoredNetworkErrors,
      originalArt: null,
    }
    try {
      await page.route(card.imageUrl, route => route.fulfill({
        status: 200, contentType: 'image/webp',
        body: readFileSync(resolve(root, `output/st6-st10/images/${scenario.cardNumber}.webp`)),
      }))
      const url = new URL('/', baseUrl)
      url.searchParams.set('test-state', scenario.testState)
      url.searchParams.set('contract-card', scenario.cardNumber)
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      await settleAnimation(page)
      evidence.before = await state(page)
      evidence.traceBefore = await trace(page)
      assert.deepEqual(evidence.traceBefore, [], 'fixture setup must not fabricate Browser commands')
      const onScreen = await page.waitForFunction(imageUrl => [...document.images]
        .some(image => image.getAttribute('src') === imageUrl && image.complete && image.naturalWidth > 0), card.imageUrl)
      evidence.originalArt = await page.evaluate(imageUrl => {
        const image = [...document.images].find(candidate => candidate.getAttribute('src') === imageUrl)
        return image ? { src: image.getAttribute('src'), width: image.naturalWidth, height: image.naturalHeight } : null
      }, card.imageUrl)
      assert.ok(onScreen)
      const expectedArt = originalArtDimensions.get(scenario.cardNumber)
      assert.deepEqual([evidence.originalArt.width, evidence.originalArt.height], [expectedArt.width, expectedArt.height],
        `${scenario.cardNumber} must render its local original card art at the source image dimensions`)

      if (scenario.flow === 'flip') await runFlip(page, evidence, scenario.drawCount)
      else if (scenario.flow === 'attack-negative') await runAttackNegative(page, evidence)
      else if (scenario.flow === 'blocker') await runBlocker(page, evidence, true)
      else if (scenario.flow === 'blocker-negative') await runBlocker(page, evidence, false)
      else if (scenario.flow === 'high-hand') await runHighHand(page, evidence)
      else if (scenario.flow === 'activate-then') await runActivateThen(page, evidence, scenario.drawCount)
      assert.deepEqual(console.errors, [])
      evidence.status = 'PASS'
    } catch (error) {
      evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
      evidence.trace ??= await trace(page).catch(() => [])
      evidence.finalState = await state(page).catch(() => null)
      evidence.debug = await page.evaluate(() => ({
        statusToasts: [...document.querySelectorAll('.status-toast')]
          .filter(node => node.getBoundingClientRect().width > 0).map(node => node.textContent?.trim()),
        dialogs: [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')]
          .filter(node => node.getBoundingClientRect().width > 0).map(node => node.textContent?.trim().slice(0, 1000)),
        buttons: [...document.querySelectorAll('button')].filter(node => node.getBoundingClientRect().width > 0)
          .map(node => ({ text: node.textContent?.trim(), disabled: node.disabled, className: node.className }))
          .slice(-35),
      })).catch(() => null)
    } finally {
      evidence.screenshot = resolve(output, `${scenario.id}-${viewport.width}-${evidence.status}.png`)
      await page.screenshot({ path: evidence.screenshot, fullPage: true }).catch(() => {})
      results.push(evidence)
      await page.close()
    }
  }
} finally {
  writeFileSync(resolve(output, 'results.json'), JSON.stringify(results, null, 2))
  await browser?.close().catch(() => {})
  server?.kill()
}

console.log(JSON.stringify({ total: results.length, passed: results.filter(result => result.status === 'PASS').length, results }, null, 2))
if (results.some(result => result.status !== 'PASS')) process.exitCode = 1
