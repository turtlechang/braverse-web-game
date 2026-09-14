import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import bs9Candidates from '../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json' with { type: 'json' }

/** BS9-034～038 candidate Browser matrix. These localhost fixtures exercise
 * the same React controls and GameCommand boundary as a match, while remaining
 * isolated from the promoted card pool. */
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

const port = Number(process.env.BRAVERSE_BS9_034_038_TEST_PORT ?? 4202)
const baseUrl = `http://127.0.0.1:${port}`
const outputDirectory = resolve(root, 'output/playwright')
mkdirSync(outputDirectory, { recursive: true })
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')
const browserExecutable =
  process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find((candidate) => existsSync(candidate))
const preview = spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const trace = (page) => page.evaluate(() => window.__braverseContractTrace ?? [])
const panel = (page) => page.locator('.effect-panel[role="alertdialog"]:visible').first()
const assertTrace = (entries, kind, message) =>
  assert.ok(entries.some((entry) => entry.commandKind === kind), message)
const assertNoTrace = (entries, kind, message) =>
  assert.equal(entries.some((entry) => entry.commandKind === kind), false, message)
const waitForTrace = async (page, kind) => {
  await page.waitForFunction(
    (expectedKind) =>
      (window.__braverseContractTrace ?? []).some(
        (entry) => entry.commandKind === expectedKind,
      ),
    kind,
  )
  return trace(page)
}

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
    if (matches.some(isLoaded)) return {
      exactImageRendered: true,
      exactImageLoaded: true,
      exactImageRequested: exactRequested,
    }
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
        resolvePromise({
          exactImageRendered: matches.length > 0,
          exactImageLoaded: loaded,
          exactImageRequested: exactRequested,
        })
      }
      const onLoad = () => {
        if (matches.some(isLoaded)) finish(true)
      }
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

const recordErrors = (page) => {
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

const openRoute = async (page, route, contractCard) => {
  await page.goto(
    `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${contractCard}`,
    { waitUntil: 'domcontentloaded' },
  )
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await page.waitForTimeout(220)
}

const assertNamedCard = async (locator, title) => {
  await locator.waitFor({ state: 'visible' })
  const face = locator.locator(`.card-face[title="${title}"]`).first()
  assert.equal(await face.count(), 1, `${title} should be rendered by name`)
  assert.ok(
    (await face.locator('img').count()) > 0 ||
      (await face.locator('.card-fallback').count()) > 0,
    `${title} should render official art or its named fallback`,
  )
}

const handCard = (page, title) =>
  page.locator(`.bottom-hand .hand-card-wrap:has(.hand-card[title="${title}"])`).first()
const fieldCard = (page, instanceId) =>
  page.locator(`.bottom-field [data-card-instance-id="${instanceId}"]`).first()

const deploy = async (page, title) => {
  const card = handCard(page, title)
  await assertNamedCard(card, title)
  await card.locator('.hand-card').click()
  const action = card.locator('.hand-card-action').filter({ hasText: '登場' })
  await action.waitFor({ state: 'visible' })
  await action.click()
}

const run034 = async (page, negative, _viewport, result) => {
  await deploy(page, 'Fortune Teller Cookie')
  const effect = panel(page)
  if (negative) {
    const entries = await waitForTrace(page, 'skip-on-play')
    assert.equal(await effect.count(), 0, 'unpayable On Play must auto-skip without opening a target UI')
    assertTrace(entries, 'skip-on-play', 'blocked BS9-034 must explicitly skip On Play')
    assertNoTrace(entries, 'resolve-reorder-hp', 'blocked BS9-034 must not reorder HP')
    result.blocker = 'all yellow supports are rested'
    return
  }
  await effect.waitFor({ state: 'visible' })
  assert.match(await effect.innerText(), /Flipped Card|Fortune Teller Cookie/)
  const payments = effect.locator('.effect-candidates-payment button:not(:disabled)')
  assert.equal(await payments.count(), 2)
  await payments.first().click()
  await effect.locator('.effect-panel-primary-action').click()
  const targets = effect.locator('.effect-candidates-target button:not(:disabled)')
  await targets.first().waitFor({ state: 'visible' })
  assert.equal(await targets.count(), 2, 'only the two opponent Cookies are legal')
  await targets.first().click()
  await effect.locator('.effect-panel-primary-action').click()
  const reorder = page.locator('.hp-reorder-modal[role="alertdialog"]:visible')
  await reorder.waitFor({ state: 'visible' })
  assert.match(await reorder.innerText(), /Fortune Teller Cookie|重新排列 HP/)
  assert.equal(await reorder.locator('.hp-reorder-list li').count(), 4)
  await reorder.locator('.hp-reorder-list li').nth(1).getByRole('button', { name: /往上移/ }).click()
  await reorder.getByRole('button', { name: '確認 HP 順序', exact: true }).click()
  await reorder.waitFor({ state: 'hidden' })
  const entries = await waitForTrace(page, 'resolve-reorder-hp')
  for (const kind of ['deploy-cookie', 'begin-activate-skill', 'resolve-ability-effect', 'resolve-reorder-hp']) {
    assertTrace(entries, kind, `BS9-034 should trace ${kind}`)
  }
}

const run035Activate = async (page, negative, _viewport, result) => {
  const source = fieldCard(page, 'bs9-bs9-035-source')
  await assertNamedCard(source, 'Truthless Recluse')
  const skill = source.locator('.skill-action')
  if (negative) {
    assert.equal(await skill.isEnabled(), false, 'empty hand must block Activate')
    assert.match(await source.locator('.skill-unavailable-reason').innerText(), /條件|支付/)
    assertNoTrace(await trace(page), 'begin-activate-skill', 'blocked Activate must not pay a cost')
    result.blocker = 'no hand card for the Activate discard cost'
    return
  }
  assert.equal(await skill.isEnabled(), true)
  await skill.click()
  const effect = panel(page)
  await effect.waitFor({ state: 'visible' })
  const discards = effect.locator('.effect-candidates-discard-hand button:not(:disabled)')
  assert.equal(await discards.count(), 5, 'Activate may discard any one hand card')
  await discards.nth(1).click()
  await effect.locator('.effect-panel-primary-action').click()
  if (await effect.isVisible().catch(() => false)) {
    const primary = effect.locator('.effect-panel-primary-action')
    if (await primary.isEnabled()) await primary.click()
  }
  await effect.waitFor({ state: 'hidden' })
  assert.equal(await skill.isEnabled(), false, 'Once Per Turn must disable a second use')
  const entries = await trace(page)
  assertTrace(entries, 'begin-activate-skill', 'Activate should pay its discard')
  assertTrace(entries, 'resolve-ability-effect', 'Activate should apply HP-gain prevention')
}

const optionalAttack = (page) => page.locator(
  '.effect-panel[role="alertdialog"]:visible:has(.optional-cost-attack-inline), .optional-cost-attack-modal[role="alertdialog"]:visible',
).first()

const run035Attack = async (page, negative, _viewport, result) => {
  const source = fieldCard(page, 'bs9-bs9-035-source')
  await assertNamedCard(source, 'Truthless Recluse')
  const modal = optionalAttack(page)
  await modal.waitFor({ state: 'visible' })
  assert.match(await modal.innerText(), /FLIP|Truthless Recluse/)
  const pay = modal.getByRole('button', { name: '支付', exact: true })
  if (negative) {
    assert.equal(await pay.isEnabled(), false, 'no FLIP Cookie must disable payment')
    await modal.getByRole('button', { name: '略過', exact: true }).click()
    await modal.waitFor({ state: 'hidden' })
    const entries = await waitForTrace(page, 'resolve-optional-cost-attack')
    assertTrace(entries, 'resolve-optional-cost-attack', 'blocked Then must retain an explicit skip')
    result.blocker = 'no FLIP Cookie in hand for the attack Then cost'
    return
  }
  assert.equal(await pay.isEnabled(), true)
  await pay.click()
  const costStep = modal.locator('.optional-cost-col').filter({ hasText: '代價' })
  const costs = costStep.locator('button:not(:disabled)')
  assert.equal(await costs.count(), 1, 'only Yoga Cookie satisfies the FLIP Cookie cost')
  assert.match(await costs.first().innerText(), /Yoga Cookie/)
  await costs.first().click()
  await modal.getByRole('button', { name: '下一步', exact: true }).click()
  const targetStep = modal.locator('.optional-cost-col').filter({ hasText: '目標' })
  const targets = targetStep.locator('button:not(:disabled)')
  await targets.first().waitFor({ state: 'visible' })
  assert.equal(await targets.count(), 2)
  await targets.first().click()
  await modal.getByRole('button', { name: '確認', exact: true }).click()
  await modal.waitFor({ state: 'hidden' })
  const entries = await waitForTrace(page, 'resolve-optional-cost-attack')
  assertTrace(entries, 'resolve-attack-effect', 'attack Then should open through its battle command')
  assertTrace(entries, 'resolve-optional-cost-attack', 'attack Then should pay through its decision command')
}

const run036 = async (page, negative, viewport, result) => {
  const source = fieldCard(page, 'bs9-bs9-036-source')
  await assertNamedCard(source, 'Bookseller')
  await page.locator('.next-phase-button').click()
  const effect = panel(page)
  await effect.waitFor({ state: 'visible' })
  const modes = effect.locator('.effect-candidates-choice button')
  assert.equal(await modes.count(), 2)
  const discardMode = modes.nth(0)
  const hpMode = modes.nth(1)
  if (negative) {
    assert.equal(await discardMode.isDisabled(), true)
    assert.match(await discardMode.innerText(), /目前無法支付/)
    assert.equal(await hpMode.isEnabled(), true)
    result.blocker = 'no FLIP Cookie in hand; only the source HP branch is legal'
  }
  const chooseDiscard = !negative && viewport.width > 1500
  const hpBefore = await source.locator('.hp-card').count()
  await (chooseDiscard ? discardMode : hpMode).click()
  await effect.locator('.effect-panel-primary-action').click()
  if (chooseDiscard) {
    await effect.locator('.effect-panel-primary-action').click()
    const discard = page.locator('.hand-discard-modal[role="alertdialog"]:visible')
    await discard.waitFor({ state: 'visible' })
    const candidates = discard.locator('button').filter({ hasText: 'Yoga Cookie' })
    assert.equal(await candidates.count(), 1)
    await candidates.click()
    await discard.getByRole('button', { name: /確認棄置/ }).click()
    await discard.waitFor({ state: 'hidden' })
    await waitForTrace(page, 'resolve-opponent-hand-discard')
  } else {
    const target = effect.locator('.effect-candidates-target button:not(:disabled)')
    await target.waitFor({ state: 'visible' })
    assert.equal(await target.count(), 1, 'the source must be the only HP-cost target')
    await target.click()
    await effect.locator('.effect-panel-primary-action').click()
    await effect.waitFor({ state: 'hidden' })
    await waitForTrace(page, 'resolve-ability-effect')
    assert.equal(await source.locator('.hp-card').count(), hpBefore - 1)
  }
  const entries = await trace(page)
  assertTrace(entries, 'resolve-ability-effect', 'Bookseller must resolve the selected branch')
  if (chooseDiscard) {
    assertTrace(entries, 'resolve-opponent-hand-discard', 'FLIP discard must use the authoritative hand decision')
  }
}

const run037 = async (page, negative, _viewport, result) => {
  const modal = page.locator('.faint-response-modal[role="alertdialog"]:visible')
  await modal.waitFor({ state: 'visible' })
  assert.match(await modal.innerText(), /Apple Faerie Cookie/)
  const candidates = modal.locator('.faint-card-candidates button')
  if (negative) {
    assert.equal(await candidates.count(), 0, 'wrong-colour FLIP and yellow non-FLIP must stay hidden')
    await modal.getByRole('button', { name: /不選擇目標/ }).click()
    result.blocker = 'trash has no card satisfying yellow + Cookie + FLIP'
  } else {
    assert.equal(await candidates.count(), 2, 'exactly the two yellow FLIP Cookies are legal')
    const texts = await candidates.allInnerTexts()
    assert.match(texts.join(' '), /Yoga Cookie/)
    assert.match(texts.join(' '), /Alchemist Cookie/)
    for (const button of await candidates.all()) await button.click()
    await modal.getByRole('button', { name: /確認/ }).click()
  }
  await modal.waitFor({ state: 'hidden' })
  assertTrace(await waitForTrace(page, 'resolve-faint-effect'), 'resolve-faint-effect', 'Apple Faerie must resolve through the faint command')
}

const run038 = async (page, negative, _viewport, result) => {
  const beforeHp = await page.locator('.bottom-field .hp-card').count()
  await deploy(page, 'Chess Choco Cookie')
  const effect = panel(page)
  if (negative) {
    await page.waitForTimeout(250)
    assert.equal(await effect.count(), 0, 'missing twin must auto-skip On Play')
    const entries = await trace(page)
    assertTrace(entries, 'skip-on-play', 'missing twin must leave a truthful skip trace')
    assertNoTrace(entries, 'resolve-ability-effect', 'missing twin must not resolve HP gain')
    assert.equal(await page.locator('.bottom-field .hp-card').count(), beforeHp + 4)
    result.blocker = 'no other Chess Choco Cookie in the battle area'
    return
  }
  await effect.waitFor({ state: 'visible' })
  assert.match(await effect.innerText(), /We are twins|Chess Choco Cookie/)
  const fixedTargets = effect.locator('.effect-candidates-target button:disabled')
  assert.equal(await fixedTargets.count(), 2, 'both friendly Chess Choco Cookies must be fixed targets')
  await effect.locator('.effect-panel-primary-action').click()
  await effect.waitFor({ state: 'hidden' })
  const afterHp = await page.locator('.bottom-field .hp-card').count()
  assert.equal(afterHp, beforeHp + 6)
  result.effectWitness = {
    kind: 'all-own-cookie-hp-gain',
    beforeHp,
    afterHp,
    delta: afterHp - beforeHp,
  }
  const entries = await waitForTrace(page, 'resolve-ability-effect')
  assertTrace(entries, 'deploy-cookie', 'Chess Choco must deploy through the real command')
  assertTrace(entries, 'resolve-ability-effect', 'the all-friendly HP gain must resolve')
}

const handlers = {
  '034': run034,
  '035-activate': run035Activate,
  '035-attack': run035Attack,
  '036': run036,
  '037': run037,
  '038': run038,
}

const runCase = async (browser, testCase) => {
  const page = await browser.newPage({ viewport: testCase.viewport })
  page.setDefaultTimeout(10_000)
  const requestedImages = new Set()
  page.on('request', (request) => {
    if (request.resourceType() === 'image') requestedImages.add(request.url())
  })
  const errors = recordErrors(page)
  const result = { ...testCase, status: 'FAIL' }
  try {
    await openRoute(page, testCase.route, testCase.contractCard)
    const record = bs9Candidates.cards.find((candidate) => candidate.cardNumber === testCase.cardNumber)
    if (!record) throw new Error(`Missing BS9 candidate ${testCase.cardNumber}`)
    Object.assign(result, await assertExactImageLoaded(page, record, requestedImages.has(record.imageUrl)))
    await handlers[testCase.handler](page, testCase.negative, testCase.viewport, result)
    result.expectedImageUrl = record.imageUrl
    result.trace = await trace(page)
    result.traceCommandKinds = result.trace.map((entry) => entry.commandKind)
    result.finalPendingSurfaces = await readVisibleFinalSurfaces(page)
    assert.deepEqual(result.finalPendingSurfaces, [], `${testCase.cardNumber} must settle all pending UI surfaces: ${result.finalPendingSurfaces.join(', ')}`)
    result.negativeEvidence = testCase.negative ? Boolean(result.blocker) : false
    if (testCase.negative) assert.equal(result.negativeEvidence, true, `${testCase.cardNumber} negative route must record blocker evidence`)
    result.publicState = await page.evaluate(() => ({
      body: document.body.innerText.slice(0, 7_000),
      battleCards: [...document.querySelectorAll('.bottom-field .combat-card-wrap')].map((node) => ({
        id: node.getAttribute('data-card-instance-id'),
        title: node.querySelector('.card-face')?.getAttribute('title') ?? null,
        hp: node.querySelector('.badge-hp')?.textContent?.trim() ?? null,
        atk: node.querySelector('.badge-atk')?.textContent?.trim() ?? null,
      })),
    }))
    assert.deepEqual(errors, [], errors.join('; '))
    result.status = 'PASS'
  } catch (error) {
    result.error = error instanceof Error ? error.stack ?? error.message : String(error)
    result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 9_000)
    result.trace = await trace(page).catch(() => [])
    result.traceCommandKinds = result.trace.map((entry) => entry.commandKind)
    result.finalPendingSurfaces = await readVisibleFinalSurfaces(page).catch(() => [])
    result.negativeEvidence = testCase.negative ? Boolean(result.blocker) : false
  } finally {
    const slug = `${testCase.cardNumber}-${testCase.handler}-${testCase.negative ? 'negative' : 'positive'}-${testCase.viewport.width}x${testCase.viewport.height}`
    result.screenshot = resolve(outputDirectory, `bs9-${slug}${result.status === 'PASS' ? '' : '-failed'}.png`)
    await page.screenshot({ path: result.screenshot, fullPage: true }).catch(() => {})
    await page.close()
  }
  console.log(`${result.status} ${testCase.cardNumber} ${testCase.handler} ${testCase.negative ? 'negative' : 'positive'} ${testCase.viewport.width}x${testCase.viewport.height}`, result.error?.split('\n')[0] ?? '')
  return result
}

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
  throw new Error(`Vite preview did not start at ${baseUrl}`)
}

const viewports = [
  { width: 1907, height: 863 },
  { width: 1164, height: 777 },
]
const cardRecords = (baseCard) => {
  const records = bs9Candidates.cards.filter((record) => record.baseCardNumber === baseCard)
  if (records.length === 0) throw new Error(`Missing BS9 candidates for ${baseCard}`)
  return records.map((record) => record.cardNumber)
}
const cases = viewports.flatMap((viewport) =>
  [
    ...cardRecords('BS9-034').flatMap((cardNumber) => [
      { handler: '034', route: `bs9-card:${cardNumber}`, contractCard: 'BS9-034', negative: false, viewport, cardNumber },
      { handler: '034', route: `bs9-card-negative:${cardNumber}`, contractCard: 'BS9-034', negative: true, viewport, cardNumber },
    ]),
    ...cardRecords('BS9-035').flatMap((cardNumber) => [
      { handler: '035-activate', route: `bs9-card:${cardNumber}`, contractCard: 'BS9-035', negative: false, viewport, cardNumber },
      { handler: '035-activate', route: `bs9-card-negative:${cardNumber}`, contractCard: 'BS9-035', negative: true, viewport, cardNumber },
      { handler: '035-attack', route: `card-attack:${cardNumber}`, contractCard: 'BS9-035', negative: false, viewport, cardNumber },
      { handler: '035-attack', route: `card-attack-negative:${cardNumber}`, contractCard: 'BS9-035', negative: true, viewport, cardNumber },
    ]),
    ...cardRecords('BS9-036').flatMap((cardNumber) => [
      { handler: '036', route: `bs9-card:${cardNumber}`, contractCard: 'BS9-036', negative: false, viewport, cardNumber },
      { handler: '036', route: `bs9-card-negative:${cardNumber}`, contractCard: 'BS9-036', negative: true, viewport, cardNumber },
    ]),
    ...cardRecords('BS9-037').flatMap((cardNumber) => [
      { handler: '037', route: `bs9-card:${cardNumber}`, contractCard: 'BS9-037', negative: false, viewport, cardNumber },
      { handler: '037', route: `bs9-card-negative:${cardNumber}`, contractCard: 'BS9-037', negative: true, viewport, cardNumber },
    ]),
    ...cardRecords('BS9-038').flatMap((cardNumber) => [
      { handler: '038', route: `bs9-card:${cardNumber}`, contractCard: 'BS9-038', negative: false, viewport, cardNumber },
      { handler: '038', route: `bs9-card-negative:${cardNumber}`, contractCard: 'BS9-038', negative: true, viewport, cardNumber },
    ]),
  ],
)

let browser
const results = []
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
  baseUrl,
  scope: 'BS9-034..038 candidate payment, cost, target, timing, branch, and blocked-path Browser matrix',
  total: results.length,
  passed: results.filter((result) => result.status === 'PASS').length,
  failed: results.filter((result) => result.status !== 'PASS'),
  results,
}
writeFileSync(resolve(outputDirectory, 'bs9-034-038-browser.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({ total: report.total, passed: report.passed, failed: report.failed.map((item) => ({ handler: item.handler, negative: item.negative, viewport: item.viewport, error: item.error?.split('\n')[0] })) }, null, 2))
process.exitCode = report.failed.length > 0 ? 1 : 0
