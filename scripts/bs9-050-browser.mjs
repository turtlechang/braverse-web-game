import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import bs9Candidates from '../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json' with { type: 'json' }

/**
 * Candidate-only Browser A/B gate for BS9-050 and its alternate art.
 * The routes use the isolated candidate fixture and never promote card data.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES
    ? [process.env.PLAYWRIGHT_NODE_MODULES]
    : [root],
})
const playwright = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwright.chromium ?? playwright.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_BS9_050_TEST_PORT ?? 4208)
const baseUrl = `http://127.0.0.1:${port}`
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')
const browserExecutable =
  process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find((candidate) => existsSync(candidate))
const outputDirectory = resolve(root, 'output/playwright')
mkdirSync(outputDirectory, { recursive: true })

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const trace = (page) => page.evaluate(() => window.__braverseContractTrace ?? [])
const effectPanel = (page) =>
  page.locator('.effect-panel[role="alertdialog"]:visible').first()
const optionalAttack = (page) =>
  page
    .locator(
      '.effect-panel[role="alertdialog"]:visible:has(.optional-cost-attack-inline), .optional-cost-attack-modal[role="alertdialog"]:visible',
    )
    .first()

const recordBrowserErrors = (page) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const location = message.location()
    const text = message.text()
    if (location.url?.endsWith('/favicon.ico') && text.includes('404')) return
    if (
      location.url?.includes('cookierunbraverse.com/data/en_storage/') &&
      /ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(text)
    ) return
    errors.push(`console: ${text} (${location.url || 'unknown URL'})`)
  })
  return errors
}

const assertTrace = (entries, commandKind, message) =>
  assert.ok(entries.some((entry) => entry.commandKind === commandKind), message)

const finalSurfaceSelectors = [
  ['effect-panel', '.effect-panel[role="alertdialog"]'],
  ['effect-order', '.effect-order-modal'],
  ['draw-up-to', '.draw-up-to-modal'],
  ['hand-discard', '.hand-discard-modal'],
  ['inspect-deck', '.inspect-deck-modal'],
  ['stage-placement', '.stage-placement-modal'],
  ['flip-response', '.flip-response-modal'],
  ['trap-response', '.trap-response-modal'],
  ['attack-response', '.attack-response-modal'],
  ['attack-response-skill', '.attack-response-skill-modal'],
  ['blocker-response', '.blocker-response-modal'],
  ['optional-cost-attack', '.optional-cost-attack-modal'],
  ['faint-response', '.faint-response-modal'],
  ['hp-reorder', '.hp-reorder-modal'],
  ['card-reveal', '.card-reveal-modal'],
  ['discard-reveal', '.discard-reveal-modal'],
  ['extra-deck-attack', '.extra-deck-attack-modal'],
  ['attack-payment', '.attack-payment-panel'],
  ['card-detail', '.card-detail-modal'],
]

const readVisibleFinalSurfaces = async (page) => page.evaluate((selectors) =>
  selectors.filter(([, selector]) => [...document.querySelectorAll(selector)].some((node) => {
    const style = window.getComputedStyle(node)
    return style.display !== 'none' && style.visibility !== 'hidden' && node.getBoundingClientRect().width > 0
  })).map(([name]) => name), finalSurfaceSelectors)

const assertExactImageLoaded = async (page, record, requested) => {
  const imageEvidence = await page.locator('img').evaluateAll((nodes, options) => {
    const { expectedUrl, exactRequested } = options
    const matches = nodes.filter((node) => [node.getAttribute('src'), node.currentSrc, node.src].includes(expectedUrl))
    const isLoaded = (node) => node.complete && node.naturalWidth > 0
    if (matches.some(isLoaded)) return { exactImageRendered: true, exactImageLoaded: true, exactImageRequested: exactRequested }
    return new Promise((resolvePromise) => {
      let settled = false
      const timeout = window.setTimeout(() => finish(false), 10_000)
      const finish = (loaded) => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        for (const node of matches) {
          node.removeEventListener('load', onLoad)
          node.removeEventListener('error', onError)
        }
        resolvePromise({ exactImageRendered: matches.length > 0, exactImageLoaded: loaded, exactImageRequested: exactRequested })
      }
      const onLoad = () => { if (matches.some(isLoaded)) finish(true) }
      const onError = () => {
        if (matches.length > 0 && matches.every((node) => node.complete && node.naturalWidth === 0)) finish(false)
      }
      for (const node of matches) {
        node.addEventListener('load', onLoad)
        node.addEventListener('error', onError)
      }
      if (matches.length === 0) finish(false)
      else if (matches.every((node) => node.complete)) onError()
    })
  }, { expectedUrl: record.imageUrl, exactRequested: requested }).catch(() => ({
    exactImageRendered: false,
    exactImageLoaded: false,
    exactImageRequested: requested,
  }))
  assert.equal(imageEvidence.exactImageRendered, true, `${record.cardNumber} must render its exact official image URL`)
  assert.equal(imageEvidence.exactImageLoaded, true, `${record.cardNumber} must load its exact official image URL`)
  return imageEvidence
}

const waitForTrace = async (page, commandKind, minimum = 1) => {
  await page.waitForFunction(
    ({ commandKind: expectedKind, minimum: expectedMinimum }) =>
      (window.__braverseContractTrace ?? []).filter(
        (entry) => entry.commandKind === expectedKind,
      ).length >= expectedMinimum,
    { commandKind, minimum },
  )
  return trace(page)
}

const waitForGame = async (page) => {
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await page.waitForTimeout(250)
}

const assertPhysicalCard = async (locator, name) => {
  await locator.waitFor({ state: 'visible' })
  const fallbackText = (await locator.locator('.card-fallback').allInnerTexts().catch(() => [])).join(' ')
  const imageAlts = await locator
    .locator('img')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('alt')))
    .catch(() => [])
  assert.ok(
    fallbackText.includes(name) || imageAlts.includes(name),
    `${name} must render as a named card face or official-card fallback`,
  )
}

const readHp = async (page, field, instanceId) => {
  const badge = page
    .locator(`.${field}-field [data-card-instance-id="${instanceId}"] .badge-hp`)
    .first()
  await badge.waitFor({ state: 'visible' })
  const match = (await badge.innerText()).match(/(\d+)\s*\//)
  if (!match) throw new Error(`Cannot read HP for ${instanceId}`)
  return Number(match[1])
}

const support = (page, instanceId) =>
  page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="${instanceId}"]`).first()

const openRoute = async (page, route, contractCard) => {
  await page.goto(
    `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${contractCard}`,
    { waitUntil: 'domcontentloaded' },
  )
  await waitForGame(page)
}

const runSkill = async (page, negative, result) => {
  const source = page.locator(
    '.bottom-field [data-card-instance-id="bs9-bs9-050-source"]',
  )
  await assertPhysicalCard(source, 'Wind Archer Cookie')
  const action = source.locator('.skill-action').first()
  await action.waitFor({ state: 'visible' })

  if (negative) {
    assert.equal(await action.isDisabled(), true, 'one trashed support card must block Crow Storm')
    const reason = source.locator('.skill-unavailable-reason')
    assert.match(await reason.innerText(), /支援卡.*2/)
    assert.equal(await effectPanel(page).count(), 0, 'blocked Crow Storm must not open an effect panel')
    assert.equal(
      (await trace(page)).some((entry) => entry.commandKind === 'begin-activate-skill'),
      false,
      'blocked Crow Storm must not dispatch activation',
    )
    result.actions.push('blocked-crow-storm-at-one-trashed-support')
    return
  }

  const targetId = 'bs9-bs9-050-skill-support-1'
  const targetSupport = support(page, targetId)
  await targetSupport.waitFor({ state: 'attached' })
  assert.match(
    (await targetSupport.locator('.support-card').getAttribute('class')) ?? '',
    /is-rested/,
    'the positive fixture must expose a rested support target',
  )
  assert.equal(await action.isEnabled(), true)
  await action.click()

  const panel = effectPanel(page)
  await panel.waitFor({ state: 'visible' })
  assert.match(await panel.innerText(), /Crow Storm|Wind Archer Cookie/)
  const candidates = panel.locator('.effect-candidates-target button:not(:disabled)')
  await candidates.first().waitFor({ state: 'visible' })
  assert.equal(await candidates.count(), 1, 'Crow Storm must expose exactly one rested support target')
  assert.match(await candidates.first().innerText(), /Soul Jam|支援/)
  await candidates.first().click()
  const confirm = panel.locator('.effect-panel-primary-action')
  assert.equal(await confirm.isEnabled(), true)
  await confirm.click()
  await panel.waitFor({ state: 'hidden' })
  await waitForTrace(page, 'resolve-ability-effect')

  assert.equal(await action.isDisabled(), true, 'Crow Storm must be Once Per Turn')
  assert.doesNotMatch(
    (await targetSupport.locator('.support-card').getAttribute('class')) ?? '',
    /is-rested/,
    'Crow Storm must set the selected support active',
  )
  const entries = await trace(page)
  assertTrace(entries, 'begin-activate-skill', 'Crow Storm must dispatch its activation')
  assertTrace(entries, 'resolve-ability-effect', 'Crow Storm must resolve its selected support')
  result.actions.push('select-rested-support-set-active-and-lock-once-per-turn')
}

const runAttack = async (page, negative, result) => {
  const source = page.locator(
    '.bottom-field [data-card-instance-id="bs9-bs9-050-source"]',
  )
  await assertPhysicalCard(source, 'Wind Archer Cookie')
  const modal = optionalAttack(page)
  await modal.waitFor({ state: 'visible' })
  assert.match(await modal.innerText(), /Arrow of Darkness|Wind Archer Cookie/)
  const pay = modal.getByRole('button', { name: '支付', exact: true })

  if (negative) {
    assert.equal(await pay.isDisabled(), true, 'one support card must block the two-card Then payment')
    assert.match(await modal.innerText(), /支援區卡|略過/)
    await modal.getByRole('button', { name: '略過', exact: true }).click()
    await modal.waitFor({ state: 'hidden' })
    const entries = await waitForTrace(page, 'resolve-optional-cost-attack')
    assert.equal(
      (await page.locator('.bottom-field .support-card-wrap[data-card-instance-id^="bs9-bs9-050-attack-support-"]').count()),
      1,
      'blocked Then must not move the remaining support card',
    )
    assertTrace(entries, 'resolve-optional-cost-attack', 'blocked Then must leave an explicit skip trace')
    assert.equal(await page.locator('[role="alertdialog"]:visible').count(), 0)
    result.actions.push('skip-two-support-then-with-one-support-available')
    return
  }

  assert.equal(await pay.isEnabled(), true)
  await pay.click()
  const supportStep = modal.locator('.optional-cost-col').filter({ hasText: '支援棄牌' })
  await supportStep.waitFor({ state: 'visible' })
  const supportButtons = supportStep.locator('.modal-card-options button:not(:disabled)')
  assert.equal(await supportButtons.count(), 5, 'Then must expose five active support cards before selecting two')
  await supportButtons.nth(0).click()
  await supportButtons.nth(1).click()
  await modal.getByRole('button', { name: '下一步', exact: true }).click()

  const targetStep = modal.locator('.optional-cost-col').filter({ hasText: '目標' })
  await targetStep.waitFor({ state: 'visible' })
  const targets = targetStep.locator('.modal-card-options button:not(:disabled)')
  assert.equal(await targets.count(), 2, 'all two opponent Cookies must be selectable')
  // Reverse the printed field order to prove the sequential damage order is
  // supplied by the player rather than silently taken from the fixture array.
  await targets.nth(1).click()
  await targets.nth(0).click()
  assert.equal(await modal.getByRole('button', { name: '確認', exact: true }).isEnabled(), true)

  const beforeLv1 = await readHp(page, 'top', 'bs9-opponent-red-lv1')
  const beforeLv3 = await readHp(page, 'top', 'bs9-opponent-red-lv3')
  await modal.getByRole('button', { name: '確認', exact: true }).click()
  await modal.waitFor({ state: 'hidden' })
  const entries = await waitForTrace(page, 'resolve-optional-cost-attack')
  assertTrace(entries, 'resolve-optional-cost-attack', 'Then payment must cross the command boundary')
  await waitForTrace(page, 'resolve-next-damage', 2)
  await page.waitForTimeout(120)
  assert.equal(await readHp(page, 'top', 'bs9-opponent-red-lv1'), beforeLv1 - 1)
  assert.equal(await readHp(page, 'top', 'bs9-opponent-red-lv3'), beforeLv3 - 1)
  assert.equal(
    await page.locator('.bottom-field .support-card-wrap[data-card-instance-id^="bs9-bs9-050-attack-support-"]').count(),
    3,
    'exactly two support cards must leave the support area',
  )
  assert.equal(await page.locator('[role="alertdialog"]:visible').count(), 0)
  result.actions.push('trash-two-supports-select-both-opponent-cookies-and-resolve-sequential-damage')
}

const runCase = async (browser, testCase) => {
  const page = await browser.newPage({ viewport: testCase.viewport })
  page.setDefaultTimeout(10_000)
  const requestedImages = new Set()
  page.on('request', (request) => {
    if (request.resourceType() === 'image') requestedImages.add(request.url())
  })
  const errors = recordBrowserErrors(page)
  const result = { ...testCase, status: 'FAIL', actions: [] }
  try {
    await openRoute(page, testCase.route, testCase.contractCard)
    const record = bs9Candidates.cards.find((candidate) => candidate.cardNumber === testCase.cardNumber)
    if (!record) throw new Error(`Missing BS9 candidate ${testCase.cardNumber}`)
    Object.assign(result, await assertExactImageLoaded(page, record, requestedImages.has(record.imageUrl)))
    if (testCase.surface === 'skill') await runSkill(page, testCase.negative, result)
    else await runAttack(page, testCase.negative, result)
    result.expectedImageUrl = record.imageUrl
    result.trace = await trace(page)
    result.traceCommandKinds = result.trace.map((entry) => entry.commandKind)
    result.finalPendingSurfaces = await readVisibleFinalSurfaces(page)
    assert.deepEqual(result.finalPendingSurfaces, [], `${testCase.cardNumber} must settle pending UI surfaces: ${result.finalPendingSurfaces.join(', ')}`)
    result.negativeEvidence = testCase.negative ? result.actions.length > 0 : false
    if (testCase.negative) assert.equal(result.negativeEvidence, true, `${testCase.cardNumber} negative route must retain blocker/skip evidence`)
    result.publicState = await page.evaluate(() => ({
      body: document.body.innerText.slice(0, 7_000),
      battleCards: [...document.querySelectorAll('.battle-row .combat-card-wrap')].map((node) => ({
        id: node.getAttribute('data-card-instance-id'),
        title: node.querySelector('.card-face')?.getAttribute('title') ?? null,
        hp: node.querySelector('.badge-hp')?.textContent?.trim() ?? null,
        atk: node.querySelector('.badge-atk')?.textContent?.trim() ?? null,
      })),
    }))
    assert.deepEqual(errors, [], `${testCase.cardNumber} Browser errors: ${errors.join('; ')}`)
    result.status = 'PASS'
  } catch (error) {
    result.error = error instanceof Error ? error.stack ?? error.message : String(error)
    result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 9_000)
    result.trace = await trace(page).catch(() => [])
    result.traceCommandKinds = result.trace.map((entry) => entry.commandKind)
    result.finalPendingSurfaces = await readVisibleFinalSurfaces(page).catch(() => [])
    result.negativeEvidence = testCase.negative ? result.actions.length > 0 : false
  } finally {
    const slug = `${testCase.cardNumber}-${testCase.surface}-${testCase.negative ? 'negative' : 'positive'}-${testCase.viewport.width}x${testCase.viewport.height}`
    result.screenshot = resolve(outputDirectory, `${slug}${result.status === 'PASS' ? '' : '-failed'}.png`)
    await page.screenshot({ path: result.screenshot, fullPage: true }).catch(() => {})
    await page.close()
  }
  console.log(
    `${result.status} ${testCase.cardNumber} ${testCase.surface} ${testCase.negative ? 'negative' : 'positive'} ${testCase.viewport.width}x${testCase.viewport.height}`,
    result.error?.split('\n')[0] ?? '',
  )
  return result
}

const preview = spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)

const waitForPreview = async () => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (preview.exitCode !== null) throw new Error(`Vite preview exited before serving ${baseUrl}`)
    try {
      if ((await fetch(baseUrl)).ok) return
    } catch {
      // preview is still starting
    }
    await wait(100)
  }
  throw new Error(`Vite preview did not start on ${baseUrl}`)
}

const viewports = [
  { width: 1907, height: 863 },
  { width: 1164, height: 777 },
]
const cards = ['BS9-050', 'BS9-050@1']
const cases = viewports.flatMap((viewport) =>
  cards.flatMap((cardNumber) => [
    {
      cardNumber,
      contractCard: cardNumber.replace(/@\d+$/, ''),
      route: `card-skill:${cardNumber}`,
      surface: 'skill',
      negative: false,
      viewport,
    },
    {
      cardNumber,
      contractCard: cardNumber.replace(/@\d+$/, ''),
      route: `card-skill-negative:${cardNumber}`,
      surface: 'skill',
      negative: true,
      viewport,
    },
    {
      cardNumber,
      contractCard: cardNumber.replace(/@\d+$/, ''),
      route: `card-attack:${cardNumber}`,
      surface: 'attack',
      negative: false,
      viewport,
    },
    {
      cardNumber,
      contractCard: cardNumber.replace(/@\d+$/, ''),
      route: `card-attack-negative:${cardNumber}`,
      surface: 'attack',
      negative: true,
      viewport,
    },
  ]),
)

const results = []
let browser
try {
  await waitForPreview()
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })
  for (const testCase of cases) results.push(await runCase(browser, testCase))
} finally {
  await browser?.close()
  if (preview.exitCode === null) preview.kill()
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  scope: 'BS9-050 Wind Archer Cookie Crow Storm and Arrow of Darkness support-trash Then; candidate fixture Browser A/B only, not a full match or online proof.',
  total: results.length,
  passed: results.filter((result) => result.status === 'PASS').length,
  failed: results.filter((result) => result.status !== 'PASS'),
  results,
}
writeFileSync(resolve(outputDirectory, 'bs9-050-browser.json'), JSON.stringify(report, null, 2))
console.log(
  JSON.stringify(
    {
      total: report.total,
      passed: report.passed,
      failed: report.failed.map((result) => ({
        cardNumber: result.cardNumber,
        surface: result.surface,
        negative: result.negative,
        viewport: result.viewport,
        error: result.error?.split('\n')[0],
      })),
    },
    null,
    2,
  ),
)
process.exitCode = report.failed.length > 0 ? 1 : 0
