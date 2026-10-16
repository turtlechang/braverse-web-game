import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const candidatePath = resolve(root, 'data/candidates/st6-st10/official-st10.en.json')
const candidateDocument = existsSync(candidatePath) ? JSON.parse(readFileSync(candidatePath, 'utf8')) : undefined
const formalPath = resolve(root, 'data/cards/official-st10-014-016.en.json')
const formalDocument = existsSync(formalPath) ? JSON.parse(readFileSync(formalPath, 'utf8')) : undefined
const allCards = [...(formalDocument?.cards ?? []), ...(candidateDocument?.cards ?? [])]
const cards = new Map(allCards.map(card => [card.cardNumber, card]))
const cardNumbers = ['ST10-014', 'ST10-015', 'ST10-016']
const cardByNumber = new Map(cardNumbers.map(number => {
  const card = cards.get(number)
  assert.ok(card?.imageUrl, `original printed ${number} record is required`)
  const artPath = resolve(root, `output/st6-st10/images/${number}.webp`)
  assert.ok(existsSync(artPath), `original printed ${number} art is required`)
  const art = readFileSync(artPath)
  assert.equal(art.toString('ascii', 0, 4), 'RIFF')
  assert.equal(art.toString('ascii', 8, 12), 'WEBP')
  return [number, {
    ...card,
    art,
    artDimensions: { width: art.readUIntLE(24, 3) + 1, height: art.readUIntLE(27, 3) + 1 },
  }]
}))

const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const playwright = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwright.chromium ?? playwright.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4205)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}`
const output = resolve(root, 'output/st6-st10/st10-014-016-browser')
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
  const inputs = [
    'src/cards/official-effect-adapter.ts', 'src/game/demo.ts', 'src/game/st10-014-016-demo.ts',
    'src/game/types.ts', 'src/game/effects/targeting.ts', 'src/game/commands.ts',
    'src/game/generated-card-pool.ts', 'src/hooks/useMatchController.ts',
  ].map(path => resolve(root, path)).filter(existsSync)
  const stale = inputs.filter(path => statSync(path).mtimeMs > buildTime)
  if (stale.length) throw new Error(`dist/index.html is older than ST10-014..016 sources; build required: ${stale.join(', ')}`)
}

mkdirSync(output, { recursive: true })
const server = process.env.BRAVERSE_BASE_URL ? undefined : spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)
const wait = milliseconds => new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds))
const waitForPreview = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      if ((await fetch(baseUrl)).ok) return
    } catch { /* preview is starting */ }
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
  for (let step = 0; step < 18; step += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click({ timeout: 1000 }).catch(() => {})
    await page.waitForTimeout(80)
  }
}
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({
  commandKind: entry.commandKind,
  summary: entry.summary,
  steps: entry.steps,
})))
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent?.match(/\d+/)?.[0] ?? 0)
    const cardName = node => node.querySelector('.card-face')?.getAttribute('title') ??
      node.querySelector('img')?.getAttribute('alt') ?? ''
    return {
      hand: count('.row-stat-hand .row-stat-value'),
      deck: count('.deck-zone .resource-summary > strong'),
      trash: count('button.discard-zone.resource-summary > strong'),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(node => ({
        id: node.getAttribute('data-card-instance-id'),
        name: cardName(node),
        rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
      })),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({
        id: node.getAttribute('data-card-instance-id'),
        name: cardName(node),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
      })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const waitForCommand = (page, kind) => page.waitForFunction(
  expected => (window.__braverseContractTrace ?? []).some(entry => entry.commandKind === expected),
  kind,
  { timeout: 15000 },
)
const waitForSettledEffects = page => page.waitForFunction(() => {
  const active = [...document.querySelectorAll('.effect-panel')].some(panel =>
    panel.getClientRects().length > 0 && !panel.classList.contains('is-complete'))
  return !active
}, { timeout: 15000 })

const cases = [
  { cardNumber: 'ST10-014', scenario: 'positive', energy: 1, sacrifice: true, targets: 2, selectedTargets: 1, timing: 'before-payment', effect: true },
  { cardNumber: 'ST10-014', scenario: 'no-material', unavailable: true },
  { cardNumber: 'ST10-015', scenario: 'battle-witness', energy: 2, targets: 2, selectedTargets: 1, timing: 'before-payment', effect: true },
  { cardNumber: 'ST10-015', scenario: 'trash-witness', energy: 2, targets: 2, selectedTargets: 1, timing: 'before-payment', effect: true },
  { cardNumber: 'ST10-015', scenario: 'no-witness', energy: 2, targets: 0, selectedTargets: 0, effect: false },
  { cardNumber: 'ST10-016', scenario: 'fifteen-trash', energy: 1, targets: 2, selectedTargets: 1, timing: 'before-payment', effect: true },
  { cardNumber: 'ST10-016', scenario: 'fourteen-trash', energy: 1, targets: 2, selectedTargets: 1, timing: 'after-payment', effect: true },
  { cardNumber: 'ST10-016', scenario: 'thirteen-trash', energy: 1, targets: 0, selectedTargets: 0, effect: false },
]
const viewports = [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]
const results = []
let browser
try {
  await waitForPreview()
  browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) })
  for (const viewport of viewports) for (const testCase of cases) {
    const card = cardByNumber.get(testCase.cardNumber)
    if (!card) throw new Error(`Missing card ${testCase.cardNumber}`)
    const page = await browser.newPage({ viewport })
    page.setDefaultTimeout(15000)
    const errors = []
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
    page.on('console', message => {
      if (message.type() === 'error' && !message.location().url?.includes('cookierunbraverse.com')) {
        errors.push(`console: ${message.text()}`)
      }
    })
    page.on('requestfailed', request => {
      if (!request.url().includes('cookierunbraverse.com')) errors.push(`requestfailed: ${request.url()}`)
    })
    const result = { ...testCase, viewport, status: 'FAIL', errors }
    try {
      await page.route(card.imageUrl, route => route.fulfill({ status: 200, contentType: 'image/webp', body: card.art }))
      const url = new URL('/', baseUrl)
      url.searchParams.set('test-state', `st10-item:${testCase.cardNumber}:${testCase.scenario}`)
      url.searchParams.set('contract-card', testCase.cardNumber)
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      await settleAnimation(page)
      result.before = await state(page)
      result.traceBefore = await trace(page)
      assert.deepEqual(result.traceBefore, [], 'fixture setup must not fabricate Browser commands')
      await page.waitForFunction(imageUrl => [...document.images].some(image =>
        image.getAttribute('src') === imageUrl && image.complete && image.naturalWidth > 0), card.imageUrl)
      result.originalArt = await page.evaluate(imageUrl => {
        const image = [...document.images].find(candidate => candidate.getAttribute('src') === imageUrl)
        return image ? { src: image.getAttribute('src'), width: image.naturalWidth, height: image.naturalHeight, alt: image.alt } : null
      }, card.imageUrl)
      assert.deepEqual([result.originalArt.width, result.originalArt.height], [card.artDimensions.width, card.artDimensions.height])
      assert.equal(result.originalArt.alt, card.name)
      const source = page.getByRole('button', { name: card.name, exact: true })
      assert.equal(await source.count(), 1, 'one original printed Item must be in the hand')

      if (testCase.unavailable) {
        await source.click()
        const use = page.getByRole('button', { name: '使用', exact: true })
        result.useAction = { count: await use.count(), enabled: await use.first().isEnabled().catch(() => false) }
        assert.ok(result.useAction.count === 0 || !result.useAction.enabled,
          'ST10-014 must not be usable without an eligible original purple LV1 battle Cookie')
        result.after = await state(page)
        result.trace = await trace(page)
        assert.deepEqual(result.after, result.before)
        assert.deepEqual(result.trace, [])
        result.status = 'PASS'
      } else {
        await source.click()
        await clickReady(page.getByRole('button', { name: '使用', exact: true }), `${card.name} Item action`)
        const costPanel = page.locator('.effect-panel:not(.is-complete):visible').last()
        await costPanel.waitFor({ state: 'visible' })
        const paymentButtons = costPanel.locator('.effect-candidates-payment .effect-candidate-entry > button:not(.is-selected)')
        assert.ok(await paymentButtons.count() >= testCase.energy, `${testCase.cardNumber} needs ${testCase.energy} real purple support payments`)
        for (let index = 0; index < testCase.energy; index += 1) {
          const payment = costPanel.locator('.effect-candidates-payment .effect-candidate-entry > button:not(.is-selected)').first()
          await clickReady(payment, `pay ${testCase.cardNumber} purple energy ${index + 1}`)
        }
        const advancePanel = async label => {
          const panel = page.locator('.effect-panel:not(.is-complete):visible').last()
          await clickReady(panel.locator('.effect-panel-primary-action:visible').last(), label)
        }
        if (testCase.sacrifice) {
          await advancePanel('advance from energy to the printed Cookie cost')
          const sacrificePanel = page.locator('.effect-panel:not(.is-complete):visible').last()
          const sacrifice = sacrificePanel.locator('.effect-candidates-trash-battle .effect-candidate-entry > button:not(.is-selected)')
          assert.equal(await sacrifice.count(), 1, 'ST10-014 must offer the original purple LV1 Cookie as its printed cost')
          await clickReady(sacrifice, 'select original purple LV1 battle Cookie cost')
          result.sacrificeLabel = await sacrifice.innerText().catch(() => '')
          await page.screenshot({ path: resolve(output, `${testCase.cardNumber}-${testCase.scenario}-${viewport.width}-payment.png`), fullPage: true })
          await advancePanel('advance from Cookie cost to Item effect targets')
        } else if (testCase.timing === 'before-payment') {
          await advancePanel('advance from energy to Item effect targets')
        }

        if (testCase.effect && testCase.timing === 'before-payment') {
          const targetPanel = page.locator('.effect-panel:not(.is-complete):visible').last()
          await targetPanel.waitFor({ state: 'visible' })
          const targets = targetPanel.locator('.effect-candidates-target .effect-candidate-entry > button:not(.is-selected)')
          assert.equal(await targets.count(), testCase.targets, `${testCase.cardNumber} must show the exact legal opponent targets`)
          result.targetLabels = []
          for (let index = 0; index < testCase.selectedTargets; index += 1) {
            const target = targetPanel.locator('.effect-candidates-target .effect-candidate-entry > button:not(.is-selected)').first()
            result.targetLabels.push(await target.innerText())
            await clickReady(target, `select ${testCase.cardNumber} opponent Cookie target ${index + 1}`)
          }
          await page.screenshot({ path: resolve(output, `${testCase.cardNumber}-${testCase.scenario}-${viewport.width}-targets.png`), fullPage: true })
          const confirm = targetPanel.locator('.effect-panel-primary-action:visible').last()
          await clickReady(confirm, `confirm ${testCase.cardNumber} costs and targets`)
          await waitForCommand(page, 'begin-play-item')
          await waitForCommand(page, 'resolve-ability-effect')
        } else {
          if (testCase.timing === 'after-payment' || !testCase.effect) {
            await advancePanel('confirm printed Item costs')
            await waitForCommand(page, 'begin-play-item')
          }
          if (testCase.timing === 'after-payment' && testCase.effect) {
            const targetPanel = page.locator('.effect-panel:not(.is-complete):visible').last()
            await targetPanel.waitFor({ state: 'visible' })
            const targets = targetPanel.locator('.effect-candidates-target .effect-candidate-entry > button:not(.is-selected)')
            assert.equal(await targets.count(), testCase.targets, `${testCase.cardNumber} must show the exact legal post-payment opponent targets`)
            result.targetLabels = []
            for (let index = 0; index < testCase.selectedTargets; index += 1) {
              const target = targetPanel.locator('.effect-candidates-target .effect-candidate-entry > button:not(.is-selected)').first()
              result.targetLabels.push(await target.innerText())
              await clickReady(target, `select ${testCase.cardNumber} post-payment target ${index + 1}`)
            }
            await page.screenshot({ path: resolve(output, `${testCase.cardNumber}-${testCase.scenario}-${viewport.width}-targets.png`), fullPage: true })
            await clickReady(targetPanel.locator('.effect-panel-primary-action:visible').last(), `resolve ${testCase.cardNumber} post-payment effect`)
            await waitForCommand(page, 'resolve-ability-effect')
          } else if (!testCase.effect) {
            const noEffectPanel = page.locator('.effect-panel:not(.is-complete):visible').last()
            if (await visible(noEffectPanel)) {
              const candidates = noEffectPanel.locator('.effect-candidates-target .effect-candidate-entry > button')
              assert.equal(await candidates.count(), 0, `${testCase.cardNumber} condition failure must not expose effect targets`)
              const confirm = noEffectPanel.locator('.effect-panel-primary-action:visible').last()
              if (await visible(confirm) && await confirm.isEnabled()) await confirm.click()
            }
          }
        }

        await waitForSettledEffects(page).catch(() => {})
        await settleAnimation(page)
        result.after = await state(page)
        result.trace = await trace(page)
        const kinds = result.trace.map(entry => entry.commandKind)
        assert.ok(kinds.includes('begin-play-item'), `expected real Item payment command; got ${kinds.join(', ')}`)
        const activation = result.trace.find(entry => entry.commandKind === 'begin-play-item')
        assert.ok(`${activation?.summary ?? ''} ${activation?.steps?.join(' ') ?? ''}`.includes(card.name),
          'public Item trace must identify the printed source card')

        assert.equal(result.after.bottom.hand, result.before.bottom.hand - 1)
        assert.equal(result.after.bottom.trash, result.before.bottom.trash + 1 + (testCase.sacrifice
          ? 1 + (result.before.bottom.battle.find(cookie => cookie.id?.includes('ST5-005'))?.hp ?? 0)
          : 0))
        assert.equal(result.after.bottom.support.filter(support => support.rested).length,
          result.before.bottom.support.filter(support => support.rested).length + testCase.energy)
        if (testCase.sacrifice) {
          assert.equal(result.after.bottom.battle.some(cookie => cookie.id?.includes('ST5-005')), false)
        }

        const targetChanges = result.before.top.battle.map(before => ({
          id: before.id,
          name: before.name,
          beforeHp: before.hp,
          afterHp: result.after.top.battle.find(after => after.id === before.id)?.hp,
        }))
        result.targetChanges = targetChanges
        if (testCase.effect) {
          assert.equal(kinds.includes('resolve-ability-effect'), true)
          assert.equal(result.after.top.trash, result.before.top.trash + testCase.selectedTargets)
          const changed = targetChanges.filter(target => target.afterHp === target.beforeHp - 1)
          assert.equal(changed.length, testCase.selectedTargets, `${testCase.cardNumber} must move/remove one top HP for each selected opponent Cookie`)
        } else {
          assert.equal(result.after.top.trash, result.before.top.trash)
          assert.deepEqual(targetChanges.map(target => target.afterHp), targetChanges.map(target => target.beforeHp))
          assert.ok(kinds.includes('begin-play-item'), 'inactive effect still pays the printed Item energy cost')
        }
        assert.deepEqual(errors, [])
        result.status = 'PASS'
      }
      await page.screenshot({ path: resolve(output, `${testCase.cardNumber}-${testCase.scenario}-${viewport.width}-${result.status}.png`), fullPage: true })
    } catch (error) {
      result.error = String(error.stack ?? error)
      result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 7000)
      result.after ??= await state(page).catch(() => undefined)
      result.trace ??= await trace(page).catch(() => undefined)
      await page.screenshot({ path: resolve(output, `${testCase.cardNumber}-${testCase.scenario}-${viewport.width}-FAIL.png`), fullPage: true }).catch(() => {})
    }
    results.push(result)
    console.log(result.status, testCase.cardNumber, testCase.scenario, `${viewport.width}x${viewport.height}`, result.error ?? '')
    await page.close()
  }
} finally {
  await browser?.close()
  if (server && server.exitCode === null) server.kill()
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  evidenceLevel: 'localhost test-state UI evidence; not full-match or online acceptance',
  scope: 'ST10-014..016 original card art, printed Item costs, target/condition paths, and post-effect HP/trash state at desktop and tablet sizes',
  viewports,
  results,
  summary: {
    total: results.length,
    passed: results.filter(result => result.status === 'PASS').length,
    failed: results.filter(result => result.status !== 'PASS').length,
  },
}
writeFileSync(resolve(output, 'results.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(report.summary))
if (report.summary.failed > 0) process.exitCode = 1
