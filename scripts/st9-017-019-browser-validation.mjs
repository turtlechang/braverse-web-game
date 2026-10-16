import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const candidateDocument = JSON.parse(readFileSync(resolve(root, 'data/cards/official-st9-017-019.en.json'), 'utf8'))
const formalPath = resolve(root, 'data/cards/official-st9-017-019.en.json')
const formalDocument = existsSync(formalPath) ? JSON.parse(readFileSync(formalPath, 'utf8')) : undefined
const cardNumbers = ['ST9-017', 'ST9-018', 'ST9-019']
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

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4191)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}`
const output = resolve(root, 'output/st6-st10/st9-017-019-browser')
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
    'src/App.tsx', 'src/game/demo.ts', 'src/game/st9-trap-demo.ts', 'src/game/battle.ts',
    'src/game/commands.ts', 'src/game/effects/execute.ts', 'src/game/effects/targeting.ts',
    'src/cards/official-effect-adapter.ts', 'src/hooks/useMatchController.ts',
    'src/components/battle/BattleResponseModals.tsx', 'src/components/modals/GameModals.tsx',
    'src/components/effects/EffectPanel.tsx', 'src/components/modals/PendingDecisionModals.tsx',
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
  commandKind: entry.commandKind, summary: entry.summary, steps: entry.steps,
})))
const waitForCommand = (page, kind) => page.waitForFunction(
  expected => (window.__braverseContractTrace ?? []).some(entry => entry.commandKind === expected),
  kind,
  { timeout: 15000 },
)
const waitForNextCommand = (page, kind, previousCount) => page.waitForFunction(
  ({ expected, count }) => (window.__braverseContractTrace ?? []).filter(entry => entry.commandKind === expected).length > count,
  { expected: kind, count: previousCount },
  { timeout: 15000 },
)
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
  assert.fail(`the public battle log must identify printed Trap ${sourceName}`)
}

const viewports = [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]
const scenarios = [
  { cardNumber: 'ST9-017', id: 'low-hand-draw-two', testState: 'card:ST9-017', hand: 3, blueCost: 3, then: 'draw-two', attackDamage: 1, discard: 0 },
  { cardNumber: 'ST9-017', id: 'high-hand-skips-draw', testState: 'card-negative:ST9-017', hand: 5, blueCost: 3, then: 'no-draw', attackDamage: 1, discard: 0 },
  { cardNumber: 'ST9-018', id: 'pay-discard-same-cookie', testState: 'card:ST9-018', hand: 2, blueCost: 1, then: 'pay', discard: 1, attackDamage: 2 },
  { cardNumber: 'ST9-018', id: 'skip-optional-discard', testState: 'card-negative:ST9-018', hand: 2, blueCost: 1, then: 'skip', discard: 0, attackDamage: 3 },
  { cardNumber: 'ST9-019', id: 'pay-discard-damage-independent-cookie', testState: 'card:ST9-019', hand: 3, blueCost: 1, then: 'pay', discard: 2, attackDamage: 3, effectTarget: 'Candy Diver Cookie', effectTargetCount: 2, effectHp: 2 },
  { cardNumber: 'ST9-019', id: 'one-hp-cookie-is-not-then-target', testState: 'card-negative:ST9-019', hand: 3, blueCost: 1, then: 'pay', discard: 2, attackDamage: 3, effectTarget: 'Pudding Cookie', effectTargetCount: 1, effectHp: 3 },
]
const results = []
let browser

const settleBattle = async (page, scenario, initial) => {
  let settled = false
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click()
    const current = await readState(page)
    const ownTargetHp = 5 - scenario.attackDamage
    const opponentTargetName = scenario.effectTarget ?? initial.opponent.battle[1]?.name
    const opponentTargetHp = scenario.effectHp ?? initial.opponent.battle[1]?.hp
    const opponentTarget = current.opponent.battle.find(cookie => cookie.name === opponentTargetName)
    const decisionOpen = await visible(page.locator('.trap-response-modal[role="alertdialog"]')) ||
      await visible(page.locator('.flip-response-modal[role="alertdialog"]')) ||
      await visible(page.locator('.draw-up-to-modal[role="alertdialog"]')) ||
      await visible(page.locator('.optional-cost-attack-modal[role="alertdialog"]')) ||
      await visible(page.locator('.effect-panel[role="alertdialog"]'))
    const noAnimation = await page.evaluate(() => !document.querySelector('.match-animation-layer[data-playing="true"]'))
    if (current.own.battle[0]?.hp === ownTargetHp &&
        opponentTarget?.hp === opponentTargetHp &&
        !decisionOpen && noAnimation) {
      settled = true
      break
    }
    await page.waitForTimeout(120)
  }
  assert.equal(settled, true, 'the printed Trap and the original Pudding Cookie attack must settle')
}

try {
  await waitForPreview()
  browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) })
  for (const viewport of viewports) for (const scenario of scenarios) {
    const card = cards.get(scenario.cardNumber)
    const page = await browser.newPage({ viewport })
    page.setDefaultTimeout(10000)
    const console = captureErrors(page)
    const result = {
      card: scenario.cardNumber, scenario: scenario.id, testState: scenario.testState, viewport,
      status: 'FAIL', errors: console.errors, ignoredNetworkErrors: console.ignoredNetworkErrors,
      screenshots: [], originalArt: null,
    }
    const screenshot = async suffix => {
      const path = resolve(output, `${scenario.id}-${viewport.width}-${suffix}.png`)
      await page.screenshot({ path, fullPage: true })
      result.screenshots.push(path)
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
      result.before = await readState(page)
      result.traceBefore = await readTrace(page)
      assert.deepEqual(result.traceBefore, [], 'the physical attack fixture must not fabricate Browser commands')
      assert.equal(result.before.own.hand.length, scenario.hand)
      assert.equal(result.before.own.hand[0]?.name, card.name)
      assert.equal(result.before.own.support.length, 3)
      assert.equal(result.before.opponent.support.length, 3)
      assert.equal(result.before.own.battle[0]?.name, 'Lobster Cookie')
      assert.equal(result.before.own.battle[0]?.hp, 5)
      assert.equal(result.before.opponent.battle[0]?.name, 'Pudding Cookie')
      assert.equal(result.before.opponent.battle[0]?.hp, 4)
      assert.equal(result.before.opponent.battle.length, 2)
      if (scenario.cardNumber === 'ST9-019' && scenario.id.includes('one-hp')) {
        assert.equal(result.before.opponent.battle[1]?.name, 'Squid Ink Cookie')
        assert.equal(result.before.opponent.battle[1]?.hp, 1)
      } else {
        assert.equal(result.before.opponent.battle[1]?.name, 'Candy Diver Cookie')
        assert.equal(result.before.opponent.battle[1]?.hp, 3)
      }

      await page.waitForFunction(imageUrl => [...document.images].some(image => image.src === imageUrl && image.complete && image.naturalWidth > 0), card.imageUrl)
      result.originalArt = await page.evaluate(imageUrl => {
        const image = [...document.images].find(candidate => candidate.src === imageUrl)
        return image ? { src: image.src, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight } : null
      }, card.imageUrl)
      assert.deepEqual([result.originalArt?.naturalWidth, result.originalArt?.naturalHeight], [746, 1038], `original ${scenario.cardNumber} art must render`)

      const trap = page.locator('.trap-response-modal[role="alertdialog"]:visible').first()
      const chooser = page.locator('.attack-response-modal:visible').first()
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
      const originalTrap = trap.locator('.modal-card-options button').filter({ hasText: card.name }).first()
      if (await visible(originalTrap)) await originalTrap.click()

      const energy = trap.locator('.trap-guided-section').filter({ hasText: '能量支付' }).first()
      await energy.waitFor({ state: 'visible' })
      const payments = energy.locator('.trap-discard-options > button')
      assert.equal(await payments.count(), 3, 'the fixture must expose three active original blue Supports')
      for (let index = 0; index < scenario.blueCost; index += 1) await payments.nth(index).click()
      const next = trap.getByRole('button', { name: '下一步', exact: true }).first()
      if (await visible(next)) {
        assert.equal(await next.isEnabled(), true)
        await next.click()
      }

      const targets = trap.locator('.trap-effect-target-step .trap-target-options > button')
      assert.equal(await targets.count(), 2, 'the printed Trap must expose both actual opposing Cookies')
      const attackerTarget = trap.locator('.trap-effect-target-step .trap-target-options button.is-attacker').first()
      assert.equal(await attackerTarget.count(), 1)
      await attackerTarget.click()
      assert.equal(await attackerTarget.evaluate(button => button.classList.contains('is-selected')), true)
      await screenshot('first-target-selected')
      const confirmTrap = trap.getByRole('button', { name: '確認發動', exact: true }).last()
      await confirmTrap.waitFor({ state: 'visible' })
      assert.equal(await confirmTrap.isEnabled(), true)
      await confirmTrap.click()
      await waitForCommand(page, 'play-trap')

      if (scenario.then === 'draw-two') {
        const draw = page.locator('.draw-up-to-modal[role="alertdialog"]:visible')
        await draw.waitFor({ state: 'visible' })
        await draw.locator('.draw-up-to-option').nth(2).click()
        await draw.getByRole('button', { name: '抽取 2 張牌', exact: true }).click()
        await waitForCommand(page, 'resolve-draw-up-to')
      } else if (scenario.then === 'no-draw') {
        assert.equal(await page.locator('.draw-up-to-modal:visible').count(), 0, 'the hand-size condition must skip only the Then draw')
      } else {
        let panel = page.locator('.effect-panel[role="alertdialog"]:visible').first()
        await panel.waitFor({ state: 'visible' })
        if (!(await panel.innerText()).includes('Then 可選效果')) {
          assert.match(await panel.innerText(), /陷阱效果/)
          const previousCount = await page.evaluate(() => (window.__braverseContractTrace ?? []).filter(entry => entry.commandKind === 'resolve-ability-effect').length)
          await panel.getByRole('button', { name: '確認發動', exact: true }).click()
          await waitForNextCommand(page, 'resolve-ability-effect', previousCount)
          panel = page.locator('.effect-panel[role="alertdialog"]:visible').first()
        }
        await panel.waitFor({ state: 'visible' })
        assert.match(await panel.innerText(), /Then 可選效果/)
        if (scenario.then === 'skip') {
          await panel.getByRole('button', { name: '略過', exact: true }).click()
          await waitForCommand(page, 'resolve-optional-cost-attack')
        } else {
          const pay = panel.getByRole('button', { name: '支付', exact: true })
          await pay.click()
          const discard = panel.locator('.optional-cost-attack-inline .optional-cost-col .modal-card-options > button')
          assert.equal(await discard.count(), scenario.discard, 'the actual hand must offer the printed discard count')
          for (let index = 0; index < scenario.discard; index += 1) await discard.nth(index).click()
          await panel.getByRole('button', { name: '確認', exact: true }).click()
          await waitForCommand(page, 'resolve-optional-cost-attack')

          const effectPanel = page.locator('.effect-panel[role="alertdialog"]:visible').first()
          await effectPanel.waitFor({ state: 'visible' })
          const previousCount = await page.evaluate(() => (window.__braverseContractTrace ?? []).filter(entry => entry.commandKind === 'resolve-ability-effect').length)
          if (scenario.cardNumber === 'ST9-018') {
            assert.match(await effectPanel.innerText(), /先前選定的同一張餅乾/)
            assert.match(await effectPanel.innerText(), /Pudding Cookie/)
            const fixedTarget = effectPanel.locator('.effect-candidates-target > .effect-candidate-entry > button')
            assert.equal(await fixedTarget.count(), 1, 'ST9-018 must retain exactly the original target')
            assert.match(await fixedTarget.innerText(), /Pudding Cookie/)
            assert.equal(await fixedTarget.isDisabled(), true, 'ST9-018 target is fixed and cannot be changed')
          } else {
            const effectTargets = effectPanel.locator('.effect-candidates-target > .effect-candidate-entry > button')
            assert.equal(await effectTargets.count(), scenario.effectTargetCount, 'the Then must expose only legal physical target Cookies')
            assert.equal(await effectPanel.getByRole('button', { name: /Squid Ink Cookie/ }).count(), 0, 'a Cookie with only 1 HP must not be a target for ST9-019 Then damage')
            const thenTarget = effectTargets.filter({ hasText: scenario.effectTarget }).first()
            assert.equal(await thenTarget.count(), 1, `the physical Then target ${scenario.effectTarget} must be selectable`)
            await thenTarget.click()
          }
          await effectPanel.getByRole('button', { name: '確認發動', exact: true }).click()
          await waitForNextCommand(page, 'resolve-ability-effect', previousCount)
        }
      }

      await settleBattle(page, scenario, result.before)
      result.after = await readState(page)
      result.trace = await readTrace(page)
      const trapTrace = result.trace.find(entry => entry.commandKind === 'play-trap')
      assert.ok(trapTrace, 'the UI must submit the authoritative play-trap command')
      assert.ok(trapTrace.steps.join(' ').includes(card.name), 'the formal command trace must identify the printed Trap by its original name')
      if (scenario.then === 'pay') {
        const optionalIndex = result.trace.findIndex(entry => entry.commandKind === 'resolve-optional-cost-attack')
        const optionalTrace = result.trace[optionalIndex]
        assert.ok(optionalTrace, 'the UI must record payment of the optional Then cost')
        assert.ok(optionalTrace.steps.some(step => step.includes('等待後續傷害／FLIP 或巢狀效果結算')))
        assert.ok(!optionalTrace.steps.some(step => step.includes('目標：未選擇目標（效果未生效）')))
        const effectTrace = result.trace.slice(optionalIndex + 1).find(entry => entry.commandKind === 'resolve-ability-effect')
        assert.ok(effectTrace, 'the queued Then effect must resolve in its own command')
        assert.ok(effectTrace.steps.join(' ').includes(scenario.effectTarget ?? 'Pudding Cookie'))
      }
      assert.equal(result.after.own.battle[0]?.hp, 5 - scenario.attackDamage)
      assert.equal(result.after.own.trash, result.before.own.trash + 1 + scenario.attackDamage + scenario.discard)
      assert.equal(result.after.own.support.filter(support => support.rested).length, scenario.blueCost)
      if (scenario.effectTarget && scenario.effectTarget !== 'Candy Diver Cookie') {
        assert.equal(result.after.opponent.battle[0]?.hp, 3)
      }
      if (scenario.effectTarget === 'Candy Diver Cookie') assert.equal(result.after.opponent.battle[1]?.hp, 2)
      if (scenario.cardNumber === 'ST9-017' && scenario.then === 'draw-two') {
        assert.equal(result.after.own.hand.length, 4)
        assert.equal(result.after.own.deck, result.before.own.deck - 2)
      }
      result.publicLog = await recordPublicLog(page, card.name)
      assert.ok(result.publicLog)
      assert.deepEqual(console.errors, [])
      await screenshot('resolved')
      result.status = 'PASS'
    } catch (error) {
      result.error = String(error.stack ?? error)
      result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 12000)
      result.finalState = await readState(page).catch(() => null)
      result.trace = await readTrace(page).catch(() => [])
    } finally {
      await page.screenshot({ path: resolve(output, `${scenario.id}-${viewport.width}-${result.status}.png`), fullPage: true }).catch(() => {})
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
