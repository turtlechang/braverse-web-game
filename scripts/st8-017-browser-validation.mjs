import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cardNumber = 'ST8-017'
const document = JSON.parse(readFileSync(resolve(root, 'data/cards/official-st8-014-017.en.json'), 'utf8'))
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

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4187)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}`
const output = resolve(root, 'output/st6-st10/st8-017-browser')
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')
const distIndex = resolve(root, 'dist/index.html')
const browserExecutable = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)

// Never build implicitly. Root runs this Browser suite only after the final build.
if (!process.env.BRAVERSE_BASE_URL) {
  if (!existsSync(distIndex)) throw new Error('dist/index.html is missing; build must finish before Browser validation')
  const buildTime = statSync(distIndex).mtimeMs
  const buildInputs = [
    'src/App.tsx',
    'src/game/demo.ts',
    'src/game/battle.ts',
    'src/game/st8-017-demo.ts',
    'src/game/generated-card-pool.ts',
    'src/game/commands.ts',
    'src/game/effects/execute.ts',
    'src/game/effects/targeting.ts',
    'src/game/effects/public-condition.ts',
    'src/cards/official-effect-adapter.ts',
    'src/hooks/useMatchController.ts',
    'src/components/battle/BattleResponseModals.tsx',
    'src/components/modals/GameModals.tsx',
    'src/components/modals/PendingDecisionModals.tsx',
    'src/components/panels/BattleLogSidebar.tsx',
  ].map(path => resolve(root, path)).filter(existsSync)
  const staleInputs = buildInputs.filter(path => statSync(path).mtimeMs > buildTime)
  if (staleInputs.length > 0) {
    throw new Error(`dist/index.html is older than ST8-017 sources; build required: ${staleInputs.join(', ')}`)
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
      // Preview or the supplied local server is still starting.
    }
    await wait(100)
  }
  throw new Error(`Braverse was not reachable at ${baseUrl}`)
}
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

const attachErrorCapture = page => {
  const errors = []
  const ignoredNetworkErrors = []
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
  page.on('console', message => {
    if (message.type() !== 'error') return
    const text = message.text()
    const url = message.location().url ?? ''
    const entry = `console: ${text} (${url || 'unknown URL'})`
    if ((url.endsWith('/favicon.ico') && text.includes('404')) ||
        (url.includes('cookierunbraverse.com/data/en_storage/') && /ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(text))) {
      ignoredNetworkErrors.push(entry)
    } else {
      errors.push(entry)
    }
  })
  return { errors, ignoredNetworkErrors }
}

const visible = async locator => await locator.count() > 0 && locator.first().isVisible().catch(() => false)
const waitForCommand = (page, kind) => page.waitForFunction(
  expected => (window.__braverseContractTrace ?? []).some(entry => entry.commandKind === expected),
  kind,
  { timeout: 12000 },
)

const recordPublicLog = async (page, sourceName) => {
  const toggle = page.getByTestId('battle-log-toggle')
  if (await toggle.count() === 0) return null
  await toggle.click()
  const entries = page.locator('.battle-log-entry')
  const count = await entries.count()
  for (let index = 0; index < count; index += 1) {
    const entry = entries.nth(index)
    const group = entry.locator('xpath=..')
    const summary = await entry.innerText()
    if (await entry.getAttribute('aria-expanded') !== 'true' && await entry.isEnabled()) {
      await entry.click()
    }
    const details = await group.locator('.battle-log-steps').innerText().catch(() => '')
    if (`${summary}\n${details}`.includes(sourceName)) return { summary, details }
    if (await entry.getAttribute('aria-expanded') === 'true') await entry.click()
  }
  assert.fail(`the public battle log must identify the printed Trap ${sourceName}`)
}

const viewports = [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]
const scenarios = [
  { id: 'equal-supports-draw-zero', testState: 'card:ST8-017', drawCount: 0, supportCounts: [3, 3] },
  { id: 'equal-supports-draw-one', testState: 'card:ST8-017', drawCount: 1, supportCounts: [3, 3] },
  { id: 'unequal-supports-no-then', testState: 'card-negative:ST8-017', drawCount: null, supportCounts: [3, 4] },
]
const results = []
let browser

try {
  await waitForPreview()
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })

  for (const viewport of viewports) for (const scenario of scenarios) {
    const page = await browser.newPage({ viewport })
    page.setDefaultTimeout(10000)
    const console = attachErrorCapture(page)
    const result = {
      card: cardNumber,
      scenario: scenario.id,
      testState: scenario.testState,
      viewport,
      status: 'FAIL',
      errors: console.errors,
      ignoredNetworkErrors: console.ignoredNetworkErrors,
      screenshots: [],
      originalArt: null,
    }
    const screenshot = async suffix => {
      const path = resolve(output, `${scenario.id}-${viewport.width}-${suffix}.png`)
      await page.screenshot({ path, fullPage: true })
      result.screenshots.push(path)
    }
    try {
      await page.route(card.imageUrl, route => route.fulfill({
        status: 200,
        contentType: 'image/webp',
        body: readFileSync(imagePath),
      }))
      const url = new URL('/', baseUrl)
      url.searchParams.set('test-state', scenario.testState)
      url.searchParams.set('contract-card', cardNumber)
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      await settleAnimation(page)
      result.before = await readState(page)
      result.traceBefore = await readTrace(page)
      assert.deepEqual(result.traceBefore, [], 'loading the response-window fixture must not fabricate commands')
      assert.equal(result.before.own.hand.length, 1)
      assert.equal(result.before.own.hand[0].name, card.name)
      assert.equal(result.before.own.support.length, scenario.supportCounts[0])
      assert.equal(result.before.opponent.support.length, scenario.supportCounts[1])
      assert.deepEqual(result.before.own.battle.map(cookie => cookie.hp), [6])
      assert.equal(result.before.opponent.battle[0]?.name, 'Wind Archer Cookie')
      assert.equal(result.before.opponent.battle.length, 2)
      assert.deepEqual(result.before.opponent.battle.map(cookie => cookie.hp), [6, 2])

      await page.waitForFunction(imageUrl => [...document.images].some(image =>
        image.src === imageUrl && image.complete && image.naturalWidth > 0), card.imageUrl)
      result.originalArt = await page.evaluate(imageUrl => {
        const image = [...document.images].find(candidate => candidate.src === imageUrl)
        return image ? { src: image.src, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight } : null
      }, card.imageUrl)
      assert.ok(result.originalArt?.naturalWidth > 0 && result.originalArt.naturalHeight > 0,
        `the original printed ${cardNumber} art must render from the locally verified card image`)

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
      assert.equal(await payments.count(), 2, 'GG must offer exactly two active green Support payment cards')
      await payments.nth(0).click()
      await payments.nth(1).click()
      await screenshot('gg-payment-selected')
      const next = trap.getByRole('button', { name: '下一步', exact: true }).first()
      if (await visible(next)) {
        assert.equal(await next.isEnabled(), true, 'the two-card GG payment must enable the next step')
        await next.click()
      }

      const targets = trap.locator('.trap-effect-target-step .trap-target-options > button, .trap-target-options > button')
      assert.equal(await targets.count(), 2, 'the optional effect must offer both opponent Cookies')
      const attackerTarget = trap.locator('.trap-target-options button.is-attacker').first()
      assert.equal(await attackerTarget.count(), 1, 'the currently attacking Wind Archer must be targetable')
      await attackerTarget.click()
      assert.equal(await trap.locator('.trap-target-options button.is-selected.is-attacker').count(), 1,
        'the attack damage reduction target must be the current attacker')
      await screenshot('attacker-target-selected')

      let submitted = false
      for (let step = 0; step < 6; step += 1) {
        const nextStep = trap.getByRole('button', { name: '下一步', exact: true }).first()
        if (await visible(nextStep)) {
          if (!(await nextStep.isEnabled())) break
          await nextStep.click()
          continue
        }
        const confirm = trap.getByRole('button', { name: '確認發動', exact: true }).last()
        await confirm.waitFor({ state: 'visible' })
        assert.equal(await confirm.isEnabled(), true, 'selecting the optional target and GG payment must enable activation')
        await screenshot('confirm-trap')
        await confirm.click()
        submitted = true
        break
      }
      assert.equal(submitted, true, 'the trap response must reach and submit its confirmation step')
      await waitForCommand(page, 'play-trap')

      if (scenario.drawCount !== null) {
        const draw = page.locator('.draw-up-to-modal[role="alertdialog"]:visible').first()
        await draw.waitFor({ state: 'visible' })
        result.drawWindow = await draw.innerText()
        assert.match(result.drawWindow, /最多 1 張/)
        const choices = draw.locator('.draw-up-to-option')
        assert.equal(await choices.count(), 2, 'the Then must offer zero or one card')
        if (scenario.drawCount === 1) {
          await choices.filter({ hasText: '抽 1 張' }).first().click()
          await screenshot('draw-one-selected')
          await draw.getByRole('button', { name: '抽取 1 張牌', exact: true }).click()
        } else {
          await draw.getByRole('button', { name: '不抽', exact: true }).click()
          await screenshot('draw-zero-selected')
          await draw.getByRole('button', { name: '略過抽牌', exact: true }).click()
        }
        await waitForCommand(page, 'resolve-draw-up-to')
      } else {
        assert.equal(await page.locator('.draw-up-to-modal:visible').count(), 0,
          'unequal support counts must skip the equality-gated Then draw')
      }

      // Wait until the normal attack continues and resolves. The selected
      // attacker deals 3 normally; with this Trap it must deal only 1.
      let attackSettled = false
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
        if (await visible(skip)) await skip.click()
        const current = await readState(page)
        const noModal = !(await visible(page.locator('.trap-response-modal:visible'))) &&
          !(await visible(page.locator('.draw-up-to-modal:visible'))) &&
          !(await visible(page.locator('.flip-response-modal:visible')))
        const noAnimation = await page.evaluate(() => !document.querySelector('.match-animation-layer[data-playing="true"]'))
        if (current.own.battle[0]?.hp === 5 && noModal && noAnimation) {
          attackSettled = true
          break
        }
        await page.waitForTimeout(120)
      }
      assert.equal(attackSettled, true, 'the current attack must finish after the Trap response')

      result.after = await readState(page)
      result.trace = await readTrace(page)
      const kinds = result.trace.map(entry => entry.commandKind)
      assert.ok(kinds.includes('play-trap'), `expected the formal Trap command, got ${kinds.join(', ')}`)
      assert.equal(result.after.own.hand.length, scenario.drawCount === 1 ? 1 : 0,
        'only the optional draw may add a card to the defender’s hand')
      assert.equal(result.after.own.deck, result.before.own.deck - (scenario.drawCount ?? 0))
      assert.equal(result.after.own.trash, result.before.own.trash + 2,
        'the Trap and the HP card revealed by the continuing normal attack must enter trash')
      assert.equal(result.after.own.support.length, result.before.own.support.length)
      assert.equal(result.after.own.support.filter(support => support.rested).length, 3,
        'both GG payments and the fixture’s initially rested Support must remain rested')
      assert.equal(result.after.own.battle[0]?.hp, 5,
        'the defender must take one attack damage after the selected attacker receives -2 attack damage')
      assert.equal(result.after.opponent.battle[0]?.hp, result.before.opponent.battle[0]?.hp,
        'the attacking Cookie must not take damage from its own Trap modifier')
      assert.ok(result.trace.find(entry => entry.commandKind === 'play-trap')?.steps.join(' ').includes('Wind Archer Cookie'),
        'the public Trap command must identify the selected attacker target')
      assert.equal(kinds.includes('resolve-draw-up-to'), scenario.drawCount !== null,
        'the equality branch must produce the selected draw command, while unequal counts skip it')
      result.publicLog = await recordPublicLog(page, card.name)
      assert.ok(result.publicLog, 'the public battle record must be available after the Trap resolves')
      assert.deepEqual(console.errors, [], 'unexpected browser console or page errors')
      await screenshot('resolved')
      result.status = 'PASS'
    } catch (error) {
      result.error = String(error.stack ?? error)
      result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 10000)
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
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({
    card: cardNumber,
    originalImage: { url: card.imageUrl, path: imagePath },
    baseUrl,
    viewports,
    scenarios,
    build: existsSync(distIndex) ? { path: distIndex, lastModified: statSync(distIndex).mtime.toISOString() } : null,
    results,
  }, null, 2))
  await browser?.close().catch(() => {})
  server?.kill()
}

console.log(JSON.stringify(results, null, 2))
const failures = results.filter(result => result.status !== 'PASS')
if (failures.length > 0) {
  throw new Error(`ST8-017 Browser validation failed for ${failures.length}/${results.length} scenarios; see ${resolve(output, 'results.json')}`)
}
