import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cardNumber = 'ST8-019'
const document = JSON.parse(readFileSync(resolve(root, 'data/cards/official-st8-019-020.en.json'), 'utf8'))
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

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4188)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}`
const output = resolve(root, 'output/st6-st10/st8-019-browser')
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
    'src/App.tsx', 'src/game/demo.ts', 'src/game/battle.ts', 'src/game/st8-019-demo.ts',
    'src/game/generated-card-pool.ts', 'src/game/commands.ts', 'src/game/effects/execute.ts',
    'src/game/effects/targeting.ts', 'src/game/effects/public-condition.ts',
    'src/cards/official-effect-adapter.ts', 'src/hooks/useMatchController.ts',
    'src/components/battle/BattleResponseModals.tsx', 'src/components/modals/GameModals.tsx',
    'src/components/panels/BattleLogSidebar.tsx',
  ].map(path => resolve(root, path)).filter(existsSync)
  const staleInputs = buildInputs.filter(path => statSync(path).mtimeMs > buildTime)
  if (staleInputs.length > 0) {
    throw new Error(`dist/index.html is older than ST8-019 sources; build required: ${staleInputs.join(', ')}`)
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
      // Preview or a supplied local server is still starting.
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
  commandKind: entry.commandKind,
  summary: entry.summary,
  steps: entry.steps,
})))
const waitForCommand = (page, kind) => page.waitForFunction(
  expected => (window.__braverseContractTrace ?? []).some(entry => entry.commandKind === expected),
  kind,
  { timeout: 12000 },
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
  { id: 'equal-supports-same-target', testState: 'card:ST8-019', supportCounts: [3, 3], selected: 'attacker', damage: 1 },
  { id: 'unequal-supports-base-reduction', testState: 'card-negative:ST8-019', supportCounts: [3, 4], selected: 'attacker', damage: 2 },
  { id: 'equal-supports-select-zero', testState: 'card:ST8-019', supportCounts: [3, 3], selected: 'zero', damage: 4 },
]
const results = []
let browser

try {
  await waitForPreview()
  browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) })
  for (const viewport of viewports) for (const scenario of scenarios) {
    const page = await browser.newPage({ viewport })
    page.setDefaultTimeout(10000)
    const console = captureErrors(page)
    const result = {
      card: cardNumber, scenario: scenario.id, testState: scenario.testState, viewport,
      status: 'FAIL', errors: console.errors, ignoredNetworkErrors: console.ignoredNetworkErrors,
      screenshots: [], originalArt: null,
    }
    const screenshot = async suffix => {
      const path = resolve(output, `${scenario.id}-${viewport.width}-${suffix}.png`)
      await page.screenshot({ path, fullPage: true })
      result.screenshots.push(path)
    }
    try {
      await page.route(card.imageUrl, route => route.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) }))
      const url = new URL('/', baseUrl)
      url.searchParams.set('test-state', scenario.testState)
      url.searchParams.set('contract-card', cardNumber)
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      await settleAnimation(page)
      result.before = await readState(page)
      result.traceBefore = await readTrace(page)
      assert.deepEqual(result.traceBefore, [], 'loading a response-window fixture must not fabricate commands')
      assert.equal(result.before.own.hand.length, 1)
      assert.equal(result.before.own.hand[0].name, card.name)
      assert.equal(result.before.own.support.length, scenario.supportCounts[0])
      assert.equal(result.before.opponent.support.length, scenario.supportCounts[1])
      assert.equal(result.before.own.battle[0]?.hp, 6)
      assert.equal(result.before.opponent.battle.length, 2)
      assert.equal(result.before.opponent.battle[0]?.name, 'Pudding Cookie')
      assert.equal(result.before.opponent.battle[1]?.name, 'GingerBrave')
      await page.waitForFunction(imageUrl => [...document.images].some(image => image.src === imageUrl && image.complete && image.naturalWidth > 0), card.imageUrl)
      result.originalArt = await page.evaluate(imageUrl => {
        const image = [...document.images].find(candidate => candidate.src === imageUrl)
        return image ? { src: image.src, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight } : null
      }, card.imageUrl)
      assert.deepEqual([result.originalArt?.naturalWidth, result.originalArt?.naturalHeight], [746, 1038], 'original ST8-019 art must render')

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
      assert.equal(await payments.count(), 2, 'GG must offer exactly two active green Supports')
      await payments.nth(0).click()
      await payments.nth(1).click()
      await screenshot('gg-selected')
      const next = trap.getByRole('button', { name: '下一步', exact: true }).first()
      if (await visible(next)) {
        assert.equal(await next.isEnabled(), true)
        await next.click()
      }

      const targets = trap.locator('.trap-effect-target-step .trap-target-options > button')
      assert.equal(await targets.count(), 2, 'the printed optional effect must expose both opposing Cookies')
      if (scenario.selected === 'attacker') {
        const attackerTarget = trap.locator('.trap-effect-target-step .trap-target-options button.is-attacker').first()
        assert.equal(await attackerTarget.count(), 1, 'the attacking Pudding Cookie must be targetable')
        await attackerTarget.click()
        assert.equal(await attackerTarget.evaluate(button => button.classList.contains('is-selected')), true)
      } else {
        await trap.locator('.trap-target-skip').filter({ hasText: '略過第 1 段效果' }).click()
        assert.equal(await trap.locator('.trap-effect-target-step .trap-target-options button.is-selected').count(), 0)
      }
      await screenshot('target-selected')
      const confirm = trap.getByRole('button', { name: '確認發動', exact: true }).last()
      await confirm.waitFor({ state: 'visible' })
      assert.equal(await confirm.isEnabled(), true)
      await screenshot('confirm')
      await confirm.click()
      await waitForCommand(page, 'play-trap')
      assert.equal(await page.locator('.draw-up-to-modal:visible').count(), 0, 'Bad Omen Then modifies the same Cookie; it does not open a draw choice')

      let settled = false
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
        if (await visible(skip)) await skip.click()
        const current = await readState(page)
        const noModal = !(await visible(page.locator('.trap-response-modal:visible'))) && !(await visible(page.locator('.flip-response-modal:visible')))
        const noAnimation = await page.evaluate(() => !document.querySelector('.match-animation-layer[data-playing="true"]'))
        if (current.own.battle[0]?.hp === 6 - scenario.damage && noModal && noAnimation) {
          settled = true
          break
        }
        await page.waitForTimeout(120)
      }
      assert.equal(settled, true, 'the original attack must settle with damage reduced only on the selected attacker')
      result.after = await readState(page)
      result.trace = await readTrace(page)
      const trapTrace = result.trace.find(entry => entry.commandKind === 'play-trap')
      assert.ok(trapTrace, 'the UI must submit the authoritative play-trap command')
      const targetName = scenario.selected === 'attacker' ? 'Pudding Cookie' : null
      if (targetName) assert.ok(trapTrace.steps.join(' ').includes(targetName), 'the public command trace must name the selected target')
      assert.equal(result.after.own.battle[0]?.hp, 6 - scenario.damage)
      assert.equal(result.after.opponent.battle[0]?.hp, result.before.opponent.battle[0]?.hp)
      assert.equal(result.after.own.trash, result.before.own.trash + 1 + scenario.damage, 'the Trap and each revealed HP card must enter trash')
      assert.equal(result.after.own.support.filter(support => support.rested).length, 3, 'both GG payment cards must be rested')
      result.publicLog = await recordPublicLog(page, card.name)
      assert.ok(result.publicLog)
      assert.deepEqual(console.errors, [])
      await screenshot('resolved')
      result.status = 'PASS'
    } catch (error) {
      result.error = String(error.stack ?? error)
      result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 10000)
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
