import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import bs9Candidates from '../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json' with { type: 'json' }

/**
 * Candidate-only Browser A/B gate for BS9-046..049. Each route loads the
 * isolated candidate fixture, so passing this script never promotes BS9 data.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const playwright = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwright.chromium ?? playwright.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_BS9_046_049_TEST_PORT ?? 4207)
const baseUrl = `http://127.0.0.1:${port}`
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')
const browserExecutable = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((candidate) => existsSync(candidate))
const outputDirectory = resolve(root, 'output/playwright')
mkdirSync(outputDirectory, { recursive: true })

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const panel = (page) => page.locator('.effect-panel[role="alertdialog"]:visible').first()
const flip = (page) => page.locator('.flip-response-modal:visible').first()
const trap = (page) => page.locator('.trap-response-modal:visible').first()
const faint = (page) => page.locator('.faint-response-modal:visible').first()
const trace = (page) => page.evaluate(() => window.__braverseContractTrace ?? [])

const recordBrowserErrors = (page) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const location = message.location()
    if (location.url?.endsWith('/favicon.ico') && message.text().includes('404')) return
    if (
      location.url?.includes('cookierunbraverse.com/data/en_storage/') &&
      /ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(message.text())
    ) return
    errors.push(`console: ${message.text()} (${location.url || 'unknown URL'})`)
  })
  return errors
}

const assertTrace = (entries, kind, message) =>
  assert.ok(entries.some((entry) => entry.commandKind === kind), message)

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

const waitForGame = async (page) => {
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await page.waitForTimeout(250)
}

const assertPhysicalCard = async (locator, name) => {
  await locator.waitFor({ state: 'visible' })
  const fallback = locator.locator('.card-fallback')
  const image = locator.locator('img')
  const fallbackText = (await fallback.count()) ? (await fallback.allInnerTexts()).join(' ') : ''
  const alts = (await image.count())
    ? await image.evaluateAll((elements) => elements.map((element) => element.getAttribute('alt')))
    : []
  assert.ok(
    fallbackText.includes(name) || alts.includes(name),
    `${name} must render as a named card face or official-card fallback`,
  )
}

const readAttack = async (page, field, instanceId) => {
  const badge = page.locator(`.${field}-field [data-card-instance-id="${instanceId}"] .badge-atk`).first()
  await badge.waitFor({ state: 'visible' })
  const match = (await badge.innerText()).match(/(\d+)/)
  if (!match) throw new Error(`Cannot read attack for ${instanceId}`)
  return Number(match[1])
}

const readHp = async (page, field, instanceId) => {
  const badge = page.locator(`.${field}-field [data-card-instance-id="${instanceId}"] .badge-hp`).first()
  await badge.waitFor({ state: 'visible' })
  const match = (await badge.innerText()).match(/(\d+)\s*\//)
  if (!match) throw new Error(`Cannot read HP for ${instanceId}`)
  return Number(match[1])
}

const selectHandCard = async (page, name) => {
  const wrap = page.locator(`.bottom-hand .hand-card-wrap:has(.hand-card[title="${name}"])`).first()
  const card = wrap.locator('.hand-card').first()
  await assertPhysicalCard(card, name)
  await card.click()
  return wrap
}

const clickPrimary = async (effectPanel) => {
  const primary = effectPanel.locator('.effect-panel-primary-action')
  await primary.waitFor({ state: 'visible' })
  assert.equal(await primary.isEnabled(), true, 'all printed costs and choices must be complete before confirmation')
  await primary.click()
}

const run046 = async (page, negative, result) => {
  const modal = trap(page)
  await modal.waitFor({ state: 'visible' })
  const card = modal.locator('.modal-card-options button').filter({ hasText: 'Fragmented Soul' }).first()
  await assertPhysicalCard(card, 'Fragmented Soul')
  await card.click()
  const next = modal.getByRole('button', { name: '下一步', exact: true })
  const paymentSection = modal.locator('.trap-guided-section').filter({ hasText: '能量支付' })
  const payments = paymentSection.locator('.trap-discard-options button:not(:disabled)')
  assert.equal(await payments.count(), 2, 'Fragmented Soul must require exactly two yellow energy payments')
  await payments.nth(0).click()
  await payments.nth(1).click()
  await next.click()
  const attackerId = 'bs9-opponent-red-lv1'
  const beforeAttack = await readAttack(page, 'top', attackerId)
  const target = modal.locator('.trap-target-options button.is-attacker:not(:disabled)')
  assert.equal(await target.count(), 1, 'only the attacking opponent Cookie is the legal response target')
  await target.click()
  if (!negative) {
    const recoveryTarget = modal
      .locator('.trap-target-options button:not(:disabled)')
      .filter({ hasText: 'Yoga Cookie' })
      .first()
    await recoveryTarget.waitFor({ state: 'visible' })
    await recoveryTarget.click()
  }
  await modal.getByRole('button', { name: '確認發動', exact: true }).click()
  await modal.waitFor({ state: 'hidden' })
  assert.equal(await readAttack(page, 'top', attackerId), beforeAttack - 2, 'first printed effect must reduce attack by 2')

  const effectPanel = panel(page)
  if (negative) {
    await page.waitForTimeout(250)
    assert.equal(await effectPanel.count(), 0, 'no FLIP Cookie in trash must skip only the optional Then recovery')
    result.actions.push('pay-two-yellow-target-attacker-reduce-attack-and-skip-empty-flip-recovery')
    return
  }
  await page.waitForTimeout(250)
  assert.equal(await effectPanel.count(), 0, 'selected FLIP Cookie should resolve inside the trap command')
  assert.equal(await page.locator('.bottom-hand .hand-card[title="Yoga Cookie"]').count(), 1)
  result.actions.push('pay-two-yellow-reduce-attacker-then-return-flip-cookie-from-trash')
}

const run047 = async (page, negative, result) => {
  const wrap = await selectHandCard(page, 'Yogurt River of Rebirth')
  const place = wrap.locator('.hand-card-action').filter({ hasText: '放置' })
  assert.equal(await place.count(), 1, 'stage card must offer a placement action')
  await place.click()
  const placement = page.locator('.stage-placement-modal:visible')
  await placement.waitFor({ state: 'visible' })
  await assertPhysicalCard(placement.locator('.faint-effect-card-detail').first(), 'Yogurt River of Rebirth')
  const payment = placement.locator('.stage-placement-payment .faint-payment-candidates > button:not(:disabled)')
  assert.equal(await payment.count(), 1, 'fixture must expose exactly one yellow placement payment')
  await payment.click()
  const confirmPlacement = placement.getByRole('button', { name: '支付並放置', exact: true })
  assert.equal(await confirmPlacement.isEnabled(), true)
  await confirmPlacement.click()
  await placement.waitFor({ state: 'hidden' })
  await assertPhysicalCard(page.locator('.bottom-field .stage-card').first(), 'Yogurt River of Rebirth')

  const activate = page.locator('.bottom-field .stage-quick-action').first()
  await activate.waitFor({ state: 'visible' })
  await activate.click()
  const effectPanel = panel(page)
  await effectPanel.waitFor({ state: 'visible' })
  const discards = effectPanel.locator('.effect-candidates-discard-hand button:not(:disabled)')
  assert.equal(await discards.count(), 4, 'Activate must expose the four remaining hand cards for its discard cost')
  await discards.first().click()
  await clickPrimary(effectPanel)
  await page.waitForTimeout(100)

  const targets = effectPanel.locator('.effect-candidates-target button:not(:disabled)')
  if (negative) {
    assert.equal(await targets.count(), 0, 'non-FLIP trash cards cannot be recovered by the stage')
    await clickPrimary(effectPanel)
    await effectPanel.waitFor({ state: 'hidden' })
    result.actions.push('place-stage-pay-placement-rest-source-discard-and-resolve-empty-flip-recovery')
    return
  }
  assert.equal(await targets.count(), 1, 'stage recovery must expose only the real FLIP Cookie')
  assert.match(await targets.first().innerText(), /Yoga Cookie/)
  await targets.first().click()
  await clickPrimary(effectPanel)
  await effectPanel.waitFor({ state: 'hidden' })
  assert.equal(await page.locator('.bottom-hand .hand-card[title="Yoga Cookie"]').count(), 1)
  result.actions.push('place-stage-pay-placement-rest-source-discard-and-return-flip-cookie')
}

const run048 = async (page, cardNumber, negative, result) => {
  const modal = flip(page)
  await modal.waitFor({ state: 'visible' })
  assert.match(await modal.innerText(), /Matcha Cookie FLIP/)
  await assertPhysicalCard(modal.locator('.flip-reveal-card'), 'Matcha Cookie')
  const defenderId = 'bs9-flip-defender'
  const before = await readHp(page, 'bottom', defenderId)
  const activate = modal.getByRole('button', { name: '發動 FLIP', exact: true })
  if (negative) {
    assert.equal(await activate.isDisabled(), true, 'without a hand card the FLIP discard cost must remain blocked')
    await modal.getByRole('button', { name: '不發動', exact: true }).click()
    await modal.waitFor({ state: 'hidden' })
    assert.equal(await readHp(page, 'bottom', defenderId), before)
    result.actions.push(`${cardNumber}-block-flip-without-discard-cost`)
    return
  }
  const costs = modal.locator('.flip-card-page button:not(:disabled)')
  assert.ok(await costs.count(), 'FLIP must expose a hand card to discard')
  await costs.first().click()
  assert.equal(await activate.isEnabled(), true)
  await activate.click()
  await modal.waitFor({ state: 'hidden' })
  const after = await readHp(page, 'bottom', defenderId)
  assert.equal(after, before + 1, 'discarding one hand card must add exactly one HP')
  result.effectWitness = {
    kind: 'attached-hp-gain',
    before,
    after,
    delta: after - before,
  }
  result.actions.push(`${cardNumber}-discard-one-hand-and-gain-one-attached-hp`)
}

const run049 = async (page, cardNumber, negative, result) => {
  const modal = faint(page)
  await modal.waitFor({ state: 'visible' })
  assert.match(await modal.innerText(), /Fig Cookie/)
  await assertPhysicalCard(modal.locator('.faint-effect-card-detail').first(), 'Fig Cookie')
  const candidates = modal.locator(
    '.faint-target-candidates button:not(:disabled), .faint-card-candidates button:not(:disabled)',
  )
  const targetId = 'bs9-opponent-red-lv1'
  if (negative) {
    assert.equal(await candidates.count(), 0, 'an opponent LV.3 Cookie must not be offered as Fig Cookie faint target')
    await modal.locator('.modal-actions button').last().click()
    await modal.waitFor({ state: 'hidden' })
    assert.equal(await page.locator(`.top-field .support-card-wrap[data-card-instance-id="${targetId}"]`).count(), 0)
    result.actions.push(`${cardNumber}-skip-without-opponent-lv1-target`)
    return
  }
  assert.equal(await candidates.count(), 1, 'only the opponent LV.1 Cookie should be selectable')
  await candidates.first().click()
  await modal.locator('.modal-actions button').last().click()
  await modal.waitFor({ state: 'hidden' })
  // Top-field support cards deliberately overlap in the compact layout, so
  // the wrapper may be clipped from Playwright's visible-box definition. Its
  // DOM presence and the rendered CardFace rested class are the observable
  // zone/state evidence here.
  const moved = page.locator(`.top-field .support-card-wrap[data-card-instance-id="${targetId}"]`).first()
  assert.equal(await moved.count(), 1, 'selected opponent LV.1 must move into that opponent support area')
  assert.match(
    (await moved.locator('.support-card').getAttribute('class')) ?? '',
    /is-rested/,
    'moved opponent Cookie must enter support rested',
  )
  assert.equal(await page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${targetId}"]`).count(), 0)
  result.actions.push(`${cardNumber}-move-opponent-lv1-to-opponent-rested-support`)
}

const runCase = async (browser, cardNumber, viewport, negative) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(7_000)
  const requestedImages = new Set()
  page.on('request', (request) => {
    if (request.resourceType() === 'image') requestedImages.add(request.url())
  })
  const errors = recordBrowserErrors(page)
  const route = `${negative ? 'bs9-card-negative' : 'bs9-card'}:${cardNumber}`
  // Runtime ids intentionally collapse alternate art to their base card id.
  // Keep the fixture on its printed variant but request its command trace with
  // the runtime id, otherwise an alternate's legitimate command is filtered.
  const runtimeCardId = cardNumber.replace(/@\d+$/, '')
  const result = { cardNumber, route, viewport, negative, status: 'FAIL', actions: [] }
  try {
    await page.goto(`${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${runtimeCardId}`, {
      waitUntil: 'domcontentloaded',
    })
    await waitForGame(page)
    const record = bs9Candidates.cards.find((candidate) => candidate.cardNumber === cardNumber)
    if (!record) throw new Error(`Missing BS9 candidate ${cardNumber}`)
    Object.assign(result, await assertExactImageLoaded(page, record, requestedImages.has(record.imageUrl)))
    if (cardNumber === 'BS9-046') await run046(page, negative, result)
    else if (cardNumber === 'BS9-047') await run047(page, negative, result)
    else if (cardNumber === 'BS9-048' || cardNumber === 'BS9-048@1') await run048(page, cardNumber, negative, result)
    else if (cardNumber === 'BS9-049' || cardNumber === 'BS9-049@1') await run049(page, cardNumber, negative, result)
    else throw new Error(`Unhandled BS9 card ${cardNumber}`)

    const entries = await trace(page)
    if (cardNumber === 'BS9-046') assertTrace(entries, 'play-trap', 'Trap A/B must pass through the command layer')
    else if (cardNumber === 'BS9-047') {
      assertTrace(entries, 'play-stage', 'stage placement must pass through the command layer')
      assertTrace(entries, 'begin-activate-stage', 'stage activation must pay/rest/discard through the command layer')
    } else if (cardNumber.startsWith('BS9-048')) assertTrace(entries, 'resolve-flip', 'FLIP A/B must record its decision')
    else assertTrace(entries, 'resolve-faint-effect', 'Fig faint A/B must record the faint decision')
    result.expectedImageUrl = record.imageUrl
    result.trace = entries
    result.traceCommandKinds = entries.map((entry) => entry.commandKind)
    result.finalPendingSurfaces = await readVisibleFinalSurfaces(page)
    assert.deepEqual(result.finalPendingSurfaces, [], `${cardNumber} must settle pending UI surfaces: ${result.finalPendingSurfaces.join(', ')}`)
    result.negativeEvidence = negative ? entries.length > 0 : false
    if (negative) assert.equal(result.negativeEvidence, true, `${cardNumber} negative route must retain no-op/blocker evidence`)
    result.publicState = await page.evaluate(() => ({
      body: document.body.innerText.slice(0, 7_000),
      battleCards: [...document.querySelectorAll('.battle-row .combat-card-wrap')].map((node) => ({
        id: node.getAttribute('data-card-instance-id'),
        title: node.querySelector('.card-face')?.getAttribute('title') ?? null,
        hp: node.querySelector('.badge-hp')?.textContent?.trim() ?? null,
        atk: node.querySelector('.badge-atk')?.textContent?.trim() ?? null,
      })),
    }))
    assert.deepEqual(errors, [], `${cardNumber} Browser errors: ${errors.join('; ')}`)
    result.status = 'PASS'
    result.screenshot = resolve(outputDirectory, `${cardNumber}-${negative ? 'negative' : 'positive'}-${viewport.width}x${viewport.height}.png`)
    await page.screenshot({ path: result.screenshot, fullPage: true })
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 7_000)
    result.trace = await trace(page).catch(() => [])
    result.traceCommandKinds = result.trace.map((entry) => entry.commandKind)
    result.finalPendingSurfaces = await readVisibleFinalSurfaces(page).catch(() => [])
    result.negativeEvidence = negative ? result.trace.length > 0 : false
    result.screenshot = resolve(outputDirectory, `${cardNumber}-${negative ? 'negative' : 'positive'}-${viewport.width}x${viewport.height}-failed.png`)
    await page.screenshot({ path: result.screenshot, fullPage: true }).catch(() => {})
  } finally {
    await page.close()
  }
  return result
}

const preview = spawn(process.execPath, [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: root,
  stdio: 'ignore',
})

const waitForPreview = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (preview.exitCode !== null) throw new Error(`Vite preview exited before serving on ${baseUrl}`)
    try {
      if ((await fetch(baseUrl)).ok) return
    } catch {
      // Preview is still starting.
    }
    await wait(100)
  }
  throw new Error(`Vite preview did not start on ${baseUrl}`)
}

const cards = ['BS9-046', 'BS9-047', 'BS9-048', 'BS9-048@1', 'BS9-049', 'BS9-049@1']
const results = []
let browser
try {
  await waitForPreview()
  browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) })
  for (const viewport of [
    { width: 1907, height: 863 },
    { width: 1164, height: 777 },
  ]) {
    for (const cardNumber of cards) {
      results.push(await runCase(browser, cardNumber, viewport, false))
      results.push(await runCase(browser, cardNumber, viewport, true))
    }
  }
} finally {
  await browser?.close()
  if (preview.exitCode === null) preview.kill()
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  scope: 'BS9-046 Trap Then recovery; 047 stage placement/Activate recovery; 048 two FLIP variants; 049 two faint variants. Candidate fixture Browser A/B only, not a full match or online proof.',
  total: results.length,
  passed: results.filter((result) => result.status === 'PASS').length,
  failed: results.filter((result) => result.status !== 'PASS'),
  results,
}
writeFileSync(resolve(outputDirectory, 'bs9-046-049-browser.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({
  total: report.total,
  passed: report.passed,
  failed: report.failed.map((result) => ({
    cardNumber: result.cardNumber,
    negative: result.negative,
    viewport: result.viewport,
    error: result.error?.split('\n')[0],
  })),
}, null, 2))
process.exitCode = report.failed.length > 0 ? 1 : 0
