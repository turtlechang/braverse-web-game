import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const candidateDocument = JSON.parse(readFileSync(resolve(root, 'data/candidates/st6-st10/official-st10.en.json'), 'utf8'))
const formalPath = resolve(root, 'data/cards/official-st10-017-018-020.en.json')
const formalDocument = existsSync(formalPath) ? JSON.parse(readFileSync(formalPath, 'utf8')) : undefined
const cardNumbers = ['ST10-017', 'ST10-018', 'ST10-020']
const cards = new Map(cardNumbers.map(cardNumber => [
  cardNumber,
  formalDocument?.cards.find(record => record.cardNumber === cardNumber) ??
    candidateDocument.cards.find(record => record.cardNumber === cardNumber),
]))
for (const [cardNumber, card] of cards) {
  assert.ok(card?.imageUrl, `original printed ${cardNumber} record is required`)
  assert.ok(existsSync(resolve(root, `output/st6-st10/images/${cardNumber}.webp`)), `original printed ${cardNumber} image is required`)
}

const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4193)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}`
const output = resolve(
  root,
  process.env.BRAVERSE_BROWSER_OUTPUT_DIR ?? 'output/st6-st10/st10-017-018-020-browser',
)
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
    'src/App.tsx', 'src/game/demo.ts', 'src/game/st10-017-018-020-demo.ts',
    'src/game/st10-017-018-020-route.test.ts', 'src/game/st10-017-018-020-physical.test.ts',
    'src/game/commands.ts', 'src/game/battle.ts', 'src/game/effects/execute.ts',
    'src/game/effects/targeting.ts', 'src/cards/official-effect-adapter.ts',
    'src/hooks/useMatchController.ts', 'src/hooks/usePendingEffect.ts',
    'src/components/battle/BattleResponseModals.tsx', 'src/components/modals/GameModals.tsx',
    'src/components/effects/EffectPanel.tsx', 'src/components/effects/EffectPanel.css',
  ].map(path => resolve(root, path)).filter(existsSync)
  const staleInputs = buildInputs.filter(path => statSync(path).mtimeMs > buildTime)
  if (staleInputs.length > 0) throw new Error(`dist/index.html is older than ST10 sources; build required: ${staleInputs.join(', ')}`)
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
      stageRested: field?.querySelector('.stage-zone .card-face.stage-card')?.classList.contains('is-rested') ?? false,
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
  { timeout: 20000 },
)
const recordPublicLog = async (page, sourceName) => {
  const toggle = page.getByTestId('battle-log-toggle')
  if (!(await toggle.count())) return null
  await toggle.click()
  const entries = page.locator('.battle-log-entry')
  for (let index = 0; index < await entries.count(); index += 1) {
    const entry = entries.nth(index)
    const group = entry.locator('xpath=..')
    const summary = await entry.innerText()
    if (await entry.getAttribute('aria-expanded') !== 'true' && await entry.isEnabled()) await entry.click()
    const details = await group.locator('.battle-log-steps').innerText().catch(() => '')
    if (`${summary}\n${details}`.includes(sourceName)) return { summary, details }
    if (await entry.getAttribute('aria-expanded') === 'true') await entry.click()
  }
  assert.fail(`the public battle log must identify original card ${sourceName}`)
}
const captureScreenshot = async (page, result, suffix) => {
  const path = resolve(output, `${result.scenario}-${result.viewport.width}-${suffix}.png`)
  await page.screenshot({ path, fullPage: true })
  result.screenshots.push(path)
}
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
  { kind: 'trap', cardNumber: 'ST10-017', id: 'mill-after-target', testState: 'st10-trap:ST10-017:positive', cost: 2, target: 'attacker', mill: 3 },
  { kind: 'trap', cardNumber: 'ST10-017', id: 'mill-after-skip', testState: 'st10-trap:ST10-017:skip-target', cost: 2, target: 'skip', mill: 3 },
  { kind: 'trap', cardNumber: 'ST10-017', id: 'mill-zero', testState: 'st10-trap:ST10-017:positive', cost: 2, target: 'attacker', mill: 0 },
  { kind: 'trap', cardNumber: 'ST10-017', id: 'mill-one', testState: 'st10-trap:ST10-017:positive', cost: 2, target: 'attacker', mill: 1 },
  { kind: 'trap', cardNumber: 'ST10-017', id: 'mill-two', testState: 'st10-trap:ST10-017:positive', cost: 2, target: 'attacker', mill: 2 },
  { kind: 'trap', cardNumber: 'ST10-017', id: 'st10-017-no-purple-cannot-pay', testState: 'st10-trap:ST10-017:no-purple-payment', cost: 2, target: 'unavailable', damage: 4 },
  { kind: 'trap', cardNumber: 'ST10-018', id: 'recover-level-three', testState: 'st10-trap:ST10-018:positive', cost: 3, target: 'attacker', recover: 'Candy Corn Cookie' },
  { kind: 'trap', cardNumber: 'ST10-018', id: 'recover-after-skip', testState: 'st10-trap:ST10-018:skip-target', cost: 3, target: 'skip', recover: 'Candy Corn Cookie' },
  { kind: 'trap', cardNumber: 'ST10-018', id: 'no-level-three-target', testState: 'st10-trap:ST10-018:no-lv3', cost: 3, target: 'attacker', recover: null },
  { kind: 'trap', cardNumber: 'ST10-018', id: 'st10-018-no-purple-cannot-pay', testState: 'st10-trap:ST10-018:no-purple-payment', cost: 3, target: 'unavailable', damage: 4 },
  { kind: 'stage', cardNumber: 'ST10-020', id: 'place-and-trash-purple-level-one', testState: 'st10-stage:positive', target: 'Nosy Wizard' },
  { kind: 'stage', cardNumber: 'ST10-020', id: 'place-and-resolve-no-target', testState: 'st10-stage:no-target', target: null },
  { kind: 'stage', cardNumber: 'ST10-020', id: 'no-purple-cannot-place', testState: 'st10-stage:no-purple-payment', target: 'unavailable' },
]
const viewports = [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]
const requestedScenarioIds = process.env.BRAVERSE_SCENARIOS?.split(',').map(value => value.trim()).filter(Boolean)
const runScenarios = requestedScenarioIds?.length
  ? scenarios.filter(scenario => requestedScenarioIds.includes(scenario.id))
  : scenarios
const unknownScenarioIds = requestedScenarioIds?.filter(id => !scenarios.some(scenario => scenario.id === id)) ?? []
if (unknownScenarioIds.length > 0) {
  throw new Error(`Unknown Browser scenario filter: ${unknownScenarioIds.join(', ')}`)
}
const requestedViewportWidth = Number(process.env.BRAVERSE_VIEWPORT_WIDTH ?? 0)
const runViewports = requestedViewportWidth ? viewports.filter(viewport => viewport.width === requestedViewportWidth) : viewports
if (runViewports.length === 0) throw new Error(`Unsupported Browser viewport width: ${requestedViewportWidth}`)
const results = []
let browser

const openFixture = async (page, scenario, card) => {
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
  await page.waitForFunction(imageUrl => [...document.images].some(image =>
    image.src === imageUrl && image.complete && image.naturalWidth > 0), card.imageUrl)
  const originalArt = await page.evaluate(imageUrl => {
    const image = [...document.images].find(candidate => candidate.src === imageUrl)
    return image ? { src: image.src, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight } : null
  }, card.imageUrl)
  assert.deepEqual([originalArt?.naturalWidth, originalArt?.naturalHeight], [746, 1038], `original ${scenario.cardNumber} art must render`)
  return originalArt
}

const settleOpponentAttack = async (page, expectedDamage, beforeHp) => {
  let settled = false
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const skipAnimation = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skipAnimation)) await skipAnimation.click()
    const state = await readState(page)
    const defender = state.own.battle.find(cookie => cookie.name === 'Lobster Cookie')
    const responseOpen = await visible(page.locator('.trap-response-modal[role="alertdialog"]')) ||
      await visible(page.locator('.attack-response-modal[role="alertdialog"]')) ||
      await visible(page.locator('.effect-panel[role="alertdialog"]')) ||
      await visible(page.locator('.flip-response-modal[role="alertdialog"]'))
    const noAnimation = await page.evaluate(() => !document.querySelector('.match-animation-layer[data-playing="true"]'))
    if (defender?.hp === beforeHp - expectedDamage && !responseOpen && noAnimation) {
      settled = true
      break
    }
    await page.waitForTimeout(100)
  }
  assert.equal(settled, true, 'the original Pudding Cookie attack must finish with the printed Trap damage result')
}

const runTrap = async (page, scenario, card, result) => {
  result.before = await readState(page)
  result.traceBefore = await readTrace(page)
  assert.equal(result.before.own.hand.length, 3)
  assert.equal(result.before.own.hand[0]?.name, card.name)
  assert.equal(result.before.own.battle[0]?.name, 'Lobster Cookie')
  assert.equal(result.before.opponent.battle[0]?.name, 'Pudding Cookie')
  assert.equal(result.before.opponent.battle[0]?.hp, 4)

  if (scenario.target === 'unavailable') {
    assert.equal(result.before.own.support.length, 3)
    const chooser = page.locator('.attack-response-modal[role="alertdialog"]:visible').first()
    if (await visible(chooser)) {
      assert.equal(await chooser.locator('.modal-card-options button').filter({ hasText: card.name }).count(), 0,
        'the printed Trap must not be offered when no purple energy can pay its cost')
      await chooser.getByRole('button', { name: '不發動', exact: true }).click()
    }
    let settled = false
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const state = await readState(page)
      const responseOpen = await visible(page.locator('.trap-response-modal[role="alertdialog"]')) ||
        await visible(page.locator('.attack-response-modal[role="alertdialog"]'))
      const noAnimation = await page.evaluate(() => !document.querySelector('.match-animation-layer[data-playing="true"]'))
      if (state.own.battle.find(cookie => cookie.name === 'Lobster Cookie')?.hp === 1 && !responseOpen && noAnimation) {
        settled = true
        break
      }
      await page.waitForTimeout(100)
    }
    assert.equal(settled, true, 'the unmodified attack must settle when the printed Trap cannot be paid')
    result.after = await readState(page)
    result.trace = await readTrace(page)
    assert.equal(result.after.own.hand.some(entry => entry.name === card.name), true)
    assert.equal(result.after.own.support.filter(entry => entry.rested).length, 0)
    assert.ok(!result.trace.some(entry => entry.commandKind === 'play-trap'))
    assert.equal(result.after.own.battle.find(cookie => cookie.name === 'Lobster Cookie')?.hp, 1,
      'without a purple payment, the unmodified original 4-damage attack must settle')
    return
  }

  assert.deepEqual(result.traceBefore, [], 'loading the physical attack fixture must not fabricate Browser commands')
  assert.equal(result.before.own.battle[0]?.hp, 5)
  assert.equal(result.before.own.support.length, scenario.cost)
  const initialHp = result.before.own.battle[0].hp

  const trap = page.locator('.trap-response-modal[role="alertdialog"]:visible').first()
  const chooser = page.locator('.attack-response-modal[role="alertdialog"]:visible').first()
  for (let attempt = 0; attempt < 100 && !(await visible(trap)); attempt += 1) {
    if (await visible(chooser)) {
      const option = chooser.locator('.modal-card-options button').filter({ hasText: card.name }).first()
      if (await visible(option)) await option.click()
    }
    await page.waitForTimeout(100)
  }
  await trap.waitFor({ state: 'visible' })
  result.trapWindow = await trap.innerText()
  assert.match(result.trapWindow, /攻擊宣告回應/)
  const trapOption = trap.locator('.modal-card-options button').filter({ hasText: card.name }).first()
  if (await visible(trapOption)) await trapOption.click()

  const energy = trap.locator('.trap-guided-section').filter({ hasText: '能量支付' }).first()
  await energy.waitFor({ state: 'visible' })
  const payments = energy.locator('.trap-discard-options > button')
  assert.equal(await payments.count(), scenario.cost, 'only original purple Supports may be offered for the printed cost')
  for (let index = 0; index < scenario.cost; index += 1) await payments.nth(index).click()
  const next = trap.getByRole('button', { name: '下一步', exact: true }).first()
  await next.waitFor({ state: 'visible' })
  assert.equal(await next.isEnabled(), true)
  await next.click()

  const steps = trap.locator('.trap-effect-target-step')
  await steps.first().waitFor({ state: 'visible' })
  const expectedTargetSteps = scenario.cardNumber === 'ST10-018' && scenario.recover ? 2 : 1
  assert.equal(await steps.count(), expectedTargetSteps,
    'each printed optional target effect must have a separate target-selection step')
  const firstStep = steps.nth(0)
  if (scenario.target === 'attacker') {
    const attacker = firstStep.locator('.trap-target-options button.is-attacker')
    assert.equal(await attacker.count(), 1, 'the printed -2 effect must allow the actual attacking Pudding Cookie')
    await attacker.click()
  } else {
    const skipTarget = firstStep.locator('.trap-target-skip')
    assert.equal(await skipTarget.count(), 1, 'the optional attack-damage effect must allow selecting zero targets')
    await skipTarget.click()
  }

  if (scenario.cardNumber === 'ST10-018' && scenario.recover) {
    const recoveryStep = steps.nth(1)
    const recoveryOptions = recoveryStep.locator('.trap-target-options > button')
    assert.equal(await recoveryOptions.count(), 1, 'only the original purple LV.3 Cookie may be recovered')
    assert.match(await recoveryOptions.first().innerText(), /Candy Corn Cookie/)
    await recoveryOptions.first().click()
  }

  await captureScreenshot(page, result, 'before-confirm')
  const confirm = trap.getByRole('button', { name: '確認發動', exact: true }).last()
  await confirm.waitFor({ state: 'visible' })
  assert.equal(await confirm.isEnabled(), true)
  await confirm.click()
  await waitForCommand(page, 'play-trap')
  if (scenario.cardNumber === 'ST10-017') {
    const millPanel = page.locator('.effect-panel:not(.is-complete):visible').first()
    await millPanel.waitFor({ state: 'visible', timeout: 15000 })
    const millChoices = millPanel.locator('.effect-deck-to-trash-amount button')
    assert.equal(await millChoices.count(), 4, 'the printed up-to-3 Then must offer choices from zero through three')
    assert.deepEqual(
      await millChoices.allTextContents().then(values => values.map(value => value.trim())),
      ['0 張', '1 張', '2 張', '3 張'],
    )
    const selectedAmount = scenario.mill
    await millChoices.filter({ hasText: `${selectedAmount} 張` }).click()
    assert.equal(await millChoices.filter({ hasText: `${selectedAmount} 張` }).getAttribute('aria-pressed'), 'true')
    await captureScreenshot(page, result, 'mill-choice')
    const resolveMill = millPanel.locator('.effect-panel-primary-action')
    assert.equal(await resolveMill.isEnabled(), true)
    await resolveMill.click()
    await waitForCommand(page, 'resolve-ability-effect')
  }
  const attackDamage = scenario.target === 'skip' ? 4 : 2
  await settleOpponentAttack(page, attackDamage, initialHp)

  result.after = await readState(page)
  result.trace = await readTrace(page)
  const playTrace = result.trace.find(entry => entry.commandKind === 'play-trap')
  assert.ok(playTrace, 'the Browser UI must submit the authoritative play-trap command')
  assert.ok(playTrace.steps.join(' ').includes(card.name), 'the formal command trace must identify the printed Trap')
  assert.equal(result.after.own.battle.find(cookie => cookie.name === 'Lobster Cookie')?.hp, initialHp - attackDamage)
  assert.equal(result.after.own.support.filter(entry => entry.rested).length, scenario.cost)
  if (scenario.cardNumber === 'ST10-017') {
    const millAmount = scenario.mill
    assert.equal(result.after.own.deck, result.before.own.deck - millAmount)
    assert.equal(result.after.own.trash, result.before.own.trash + 1 + millAmount + attackDamage,
      'the played Trap, the selected number of top deck cards, and attack HP cards must enter trash')
    assert.ok(result.trace.some(entry => entry.commandKind === 'resolve-ability-effect'),
      'the chosen mill amount must be submitted through the authoritative ability-effect command')
    result.publicLog = await recordPublicLog(page, card.name)
  } else if (scenario.recover) {
    assert.ok(result.after.own.hand.some(entry => entry.name === scenario.recover), 'the printed purple LV.3 Cookie must return to hand')
    assert.equal(result.after.own.trash, result.before.own.trash + attackDamage,
      'the Trap enters trash, the recovered LV.3 leaves trash, and attack HP cards enter trash')
    assert.ok(result.trace.some(entry => entry.steps.join(' ').includes('Candy Corn Cookie')))
  } else {
    assert.equal(result.after.own.hand.some(entry => entry.name === card.name), false)
    assert.equal(result.after.own.trash, result.before.own.trash + 1 + attackDamage)
    if (scenario.target === 'skip') assert.equal(result.after.own.battle.find(cookie => cookie.name === 'Lobster Cookie')?.hp, 1,
      'skipping the optional attack target must leave the original 4 damage unchanged')
  }
  if (scenario.cardNumber === 'ST10-018' && !result.publicLog) result.publicLog = await recordPublicLog(page, card.name)
}

const runStage = async (page, scenario, card, result) => {
  result.before = await readState(page)
  result.traceBefore = await readTrace(page)
  assert.deepEqual(result.traceBefore, [], 'loading a main-phase fixture must not fabricate Browser commands')
  assert.equal(result.before.own.hand[0]?.name, card.name)
  assert.equal(result.before.own.stage, null)

  const handCard = page.locator(`.bottom-field .hand-card-wrap[data-card-instance-id="${result.before.own.hand[0].id}"]`)
  await handCard.locator('.hand-card').click()
  const place = handCard.getByRole('button', { name: '放置', exact: true })
  if (scenario.target === 'unavailable') {
    if (await visible(place)) {
      if (await place.isEnabled()) {
        await place.click()
        const placement = page.locator('.stage-placement-modal[role="alertdialog"]:visible').first()
        await placement.waitFor({ state: 'visible' })
        assert.equal(await placement.locator('.faint-payment-candidates > button').count(), 0,
          'no original purple Support may be offered for ST10-020 placement')
        assert.equal(await placement.getByRole('button', { name: '支付並放置', exact: true }).isEnabled(), false)
      } else {
        assert.equal(await place.isEnabled(), false)
      }
    }
    result.after = await readState(page)
    result.trace = await readTrace(page)
    assert.equal(result.after.own.stage, null)
    assert.equal(result.after.own.hand.some(entry => entry.name === card.name), true)
    assert.equal(result.after.own.support.filter(entry => entry.rested).length, 0)
    assert.ok(!result.trace.some(entry => entry.commandKind === 'play-stage'))
    return
  }

  await place.waitFor({ state: 'visible' })
  assert.equal(await place.isEnabled(), true)
  await place.click()
  const placement = page.locator('.stage-placement-modal[role="alertdialog"]:visible').first()
  await placement.waitFor({ state: 'visible' })
  result.placementWindow = await placement.innerText()
  assert.match(result.placementWindow, /放置費用/)
  const payments = placement.locator('.faint-payment-candidates > button')
  assert.equal(await payments.count(), 1, 'only the original purple Support can pay the printed P placement cost')
  await payments.first().click()
  const confirmPlace = placement.getByRole('button', { name: '支付並放置', exact: true })
  assert.equal(await confirmPlace.isEnabled(), true)
  await captureScreenshot(page, result, 'placement-payment')
  await confirmPlace.click()
  await waitForCommand(page, 'play-stage')
  result.afterPlacement = await readState(page)
  assert.equal(result.afterPlacement.own.stage, card.name)
  assert.equal(result.afterPlacement.own.hand.length, result.before.own.hand.length - 1)
  assert.equal(result.afterPlacement.own.support.filter(entry => entry.rested).length, 1)

  const activate = page.getByRole('button', { name: '啟動', exact: true }).first()
  await activate.waitFor({ state: 'visible' })
  await activate.click()
  const panel = page.locator('.effect-panel:not(.is-complete):visible').first()
  await panel.waitFor({ state: 'visible', timeout: 15000 })
  result.activationPanel = await panel.innerText()
  assert.ok(result.activationPanel.includes(card.name), 'the printed Stage must own its Activate effect')
  const nextPhase = panel.getByRole('button', { name: '下一步', exact: true }).last()
  await nextPhase.waitFor({ state: 'visible' })
  assert.equal(await nextPhase.isEnabled(), true)
  await nextPhase.click()
  const targetButtons = panel.locator('.effect-candidates-target > .effect-candidate-entry > button')
  if (scenario.target) {
    assert.equal(await targetButtons.count(), 1, 'only the actual purple LV.1 Cookie is a legal target')
    assert.match(await targetButtons.first().innerText(), /Nosy Wizard/)
    await targetButtons.first().click()
  } else {
    assert.equal(await targetButtons.count(), 0, 'the blue LV.1 Cookie must not be offered to the purple-only effect')
  }
  await captureScreenshot(page, result, 'activation')
  const confirmEffect = panel.getByRole('button', { name: '確認發動', exact: true }).last()
  assert.equal(await confirmEffect.isEnabled(), true)
  await confirmEffect.click()
  await waitForCommand(page, 'resolve-ability-effect')

  result.after = await readState(page)
  result.trace = await readTrace(page)
  assert.equal(result.after.own.stage, card.name)
  assert.equal(result.after.own.stageRested, true, 'activation must REST Wizard Archives')
  assert.equal(result.after.own.support.filter(entry => entry.rested).length, 1)
  assert.ok(result.trace.some(entry => entry.commandKind === 'begin-activate-stage'))
  assert.ok(result.trace.some(entry => entry.commandKind === 'resolve-ability-effect'))
  if (scenario.target) {
    const targetBefore = result.before.own.battle.find(cookie => cookie.name === 'Nosy Wizard')
    assert.ok(targetBefore, 'the fixture must contain the original purple LV.1 Cookie')
    assert.equal(result.after.own.battle.some(cookie => cookie.name === 'Nosy Wizard'), false)
    assert.equal(result.after.own.battle.some(cookie => cookie.name === 'Snow Sugar Cookie'), true)
    assert.equal(result.after.own.trash, result.before.own.trash + 1 + targetBefore.hp,
      'the original Cookie and its printed HP cards must all enter trash')
    assert.ok(result.trace.some(entry => entry.steps.join(' ').includes('Nosy Wizard')))
  } else {
    assert.deepEqual(result.after.own.battle.map(cookie => cookie.name), ['Snow Sugar Cookie'])
    assert.equal(result.after.own.trash, result.before.own.trash)
  }
  result.publicLog = await recordPublicLog(page, card.name)
}

try {
  await waitForPreview()
  browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) })
  for (const viewport of runViewports) for (const scenario of runScenarios) {
    const card = cards.get(scenario.cardNumber)
    const page = await browser.newPage({ viewport })
    page.setDefaultTimeout(10000)
    const console = captureErrors(page)
    const result = {
      card: scenario.cardNumber, scenario: scenario.id, testState: scenario.testState, viewport,
      status: 'FAIL', errors: console.errors, ignoredNetworkErrors: console.ignoredNetworkErrors,
      screenshots: [], originalArt: null,
    }
    try {
      result.originalArt = await openFixture(page, scenario, card)
      if (scenario.kind === 'trap') await runTrap(page, scenario, card, result)
      else await runStage(page, scenario, card, result)
      assert.deepEqual(console.errors, [])
      result.status = 'PASS'
    } catch (error) {
      result.error = String(error.stack ?? error)
      result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 12000)
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
  writeFileSync(resolve(output, 'results.json'), JSON.stringify(results, null, 2))
  await browser?.close().catch(() => {})
  server?.kill()
}

console.log(JSON.stringify(results, null, 2))
if (results.some(result => result.status !== 'PASS')) process.exitCode = 1
