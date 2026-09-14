import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import bs9Candidates from '../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json' with { type: 'json' }

/**
 * BS9-042..045 candidate-only Browser A/B gate.  Every route uses official
 * card data through the localhost candidate fixture; no candidate is promoted.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const playwright = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwright.chromium ?? playwright.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_BS9_042_045_TEST_PORT ?? 4206)
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
const draw = (page) => page.locator('.draw-up-to-modal:visible').first()
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
const assertNoTrace = (entries, kind, message) =>
  assert.equal(entries.some((entry) => entry.commandKind === kind), false, message)

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

const readHp = async (page, field, instanceId) => {
  const badge = page.locator(`.${field}-field [data-card-instance-id="${instanceId}"] .badge-hp`).first()
  await badge.waitFor({ state: 'visible' })
  const match = (await badge.innerText()).match(/(\d+)\s*\//)
  if (!match) throw new Error(`Cannot read HP for ${instanceId}`)
  return Number(match[1])
}

const selectHandItem = async (page, name) => {
  const wrap = page.locator(`.bottom-hand .hand-card-wrap:has(.hand-card[title="${name}"])`).first()
  const card = wrap.locator('.hand-card').first()
  await assertPhysicalCard(card, name)
  await card.click()
  const use = wrap.locator('.hand-card-action').filter({ hasText: '使用' })
  return { wrap, use }
}

const selectPaymentAndDiscard = async (page, expectedDiscardCount) => {
  const effectPanel = panel(page)
  await effectPanel.waitFor({ state: 'visible' })
  const payment = effectPanel.locator('.effect-candidates-payment button:not(:disabled)')
  assert.equal(await payment.count(), 1, 'fixture must expose exactly one yellow payment')
  await payment.click()
  await effectPanel.locator('.effect-panel-primary-action').click()
  const discard = effectPanel.locator('.effect-candidates-discard-hand button:not(:disabled)')
  await discard.first().waitFor({ state: 'visible' })
  assert.equal(await discard.count(), expectedDiscardCount, 'discard candidates must respect the printed filter')
  await discard.first().click()
  await effectPanel.locator('.effect-panel-primary-action').click()
  return effectPanel
}

const run042 = async (page, negative, result) => {
  const modal = flip(page)
  await modal.waitFor({ state: 'visible' })
  assert.match(await modal.innerText(), /Financier Cookie FLIP/)
  assert.match(await modal.innerText(), /Discard 1 card/i)
  await assertPhysicalCard(modal.locator('.flip-reveal-card'), 'Financier Cookie')
  const defenderId = 'bs9-flip-defender'
  const before = await readHp(page, 'bottom', defenderId)
  assert.equal(before, 1)
  const activate = modal.getByRole('button', { name: '發動 FLIP', exact: true })
  if (negative) {
    assert.equal(await activate.isDisabled(), true, 'no hand card must block the FLIP discard cost')
    await modal.getByRole('button', { name: '不發動', exact: true }).click()
    await modal.waitFor({ state: 'hidden' })
    assert.equal(await readHp(page, 'bottom', defenderId), before)
    result.actions.push('block-flip-without-hand-cost')
    return
  }
  const costs = modal.locator('.flip-card-page button')
  assert.ok(await costs.count(), 'FLIP must show hand cards for its discard cost')
  await costs.first().click()
  assert.equal(await activate.isEnabled(), true)
  await activate.click()
  await modal.waitFor({ state: 'hidden' })
  const after = await readHp(page, 'bottom', defenderId)
  assert.equal(after, before + 1)
  result.effectWitness = {
    kind: 'attached-hp-gain',
    before,
    after,
    delta: after - before,
  }
  result.actions.push('discard-one-hand-and-gain-attached-hp')
}

const run043 = async (page, negative, result) => {
  const { use } = await selectHandItem(page, 'Heart Stained With Lies')
  const soulJamHp = page.locator(
    '.top-field [data-card-instance-id="bs9-opponent-red-lv1"] .hp-card[title="Soul Jam: Light of Destruction"]',
  )
  if (negative) {
    assert.equal(await use.count(), 0, 'below LV.4 must not offer an unusable Item action')
    const detail = page.locator('.card-detail-modal:visible').first()
    if (await detail.count()) {
      await detail.locator('.close-modal').click()
      await detail.waitFor({ state: 'hidden' })
    }
    await page.waitForTimeout(250)
    assert.equal(await panel(page).count(), 0, 'below LV.4 must not open an equipped-card target panel')
    assert.equal(await soulJamHp.count(), 0)
    result.actions.push('block-item-action-below-break-lv4')
    return
  }
  assert.equal(await use.count(), 1, 'LV.4 condition must expose the Item-use action')
  await use.click()
  const effectPanel = panel(page)
  await effectPanel.waitFor({ state: 'visible' })
  const payment = effectPanel.locator('.effect-candidates-payment button:not(:disabled)')
  assert.equal(await payment.count(), 1)
  await payment.click()
  await effectPanel.locator('.effect-panel-primary-action').click()
  const targets = effectPanel.locator('.effect-candidates-target button:not(:disabled)')
  assert.equal(await targets.count(), 1, 'only the equipped Soul Jam is a legal target, not its host Cookie')
  assert.match(await targets.first().innerText(), /Soul Jam: Light of Destruction/)
  await targets.first().click()
  await effectPanel.locator('.effect-panel-primary-action').click()
  await effectPanel.waitFor({ state: 'hidden' })
  await soulJamHp.waitFor({ state: 'visible' })
  result.actions.push('pay-yellow-and-move-opponent-equipped-soul-jam-face-up-to-host-hp')
}

const run044 = async (page, negative, result) => {
  const { use } = await selectHandItem(page, 'Shadow Milk Cookie Doll')
  assert.equal(await use.count(), 1)
  await use.click()
  const effectPanel = await selectPaymentAndDiscard(page, 4)
  if (negative) {
    await page.waitForTimeout(250)
    assert.equal(
      await effectPanel.locator('.effect-candidates-target button:not(:disabled)').count(),
      0,
      'non-FLIP/yellow trash cards must not become return targets',
    )
    await effectPanel.locator('.effect-panel-primary-action').click()
    await effectPanel.waitFor({ state: 'hidden' })
    result.actions.push('pay-and-discard-then-auto-skip-without-yellow-flip-cookie')
    return
  }
  const targets = effectPanel.locator('.effect-candidates-target button:not(:disabled)')
  assert.equal(await targets.count(), 2, 'only two yellow FLIP Cookies should be returnable')
  assert.match((await targets.allInnerTexts()).join(' '), /Yoga Cookie/)
  assert.match((await targets.allInnerTexts()).join(' '), /Alchemist Cookie/)
  await targets.nth(1).click()
  await targets.nth(0).click()
  await effectPanel.locator('.effect-panel-primary-action').click()
  await effectPanel.waitFor({ state: 'hidden' })
  assert.equal(await page.locator('.bottom-hand .hand-card[title="Yoga Cookie"]').count(), 1)
  assert.equal(await page.locator('.bottom-hand .hand-card[title="Alchemist Cookie"]').count(), 1)
  result.actions.push('pay-yellow-discard-one-and-return-two-yellow-flip-cookies')
}

const run045 = async (page, negative, result, drawCount) => {
  const modal = trap(page)
  await modal.waitFor({ state: 'visible' })
  const card = modal.locator('.modal-card-options button').filter({ hasText: 'Overtaken Other-Realm' }).first()
  await assertPhysicalCard(card, 'Overtaken Other-Realm')
  await card.click()
  const next = modal.getByRole('button', { name: '下一步', exact: true })
  if (negative) {
    throw new Error('Unpayable BS9-045 must not enter the Trap response modal')
  }
  const energy = modal.locator('.trap-guided-section').filter({ hasText: '能量支付' })
  const payment = energy.locator('.trap-discard-options button')
  assert.equal(await payment.count(), 1)
  await payment.click()
  await next.click()
  const cost = modal.locator('.trap-guided-section').filter({ hasText: '額外代價' })
  const flipCosts = cost.locator('.trap-discard-options button')
  assert.equal(await flipCosts.count(), 2, 'only runtime FLIP Cookies can pay the printed discard cost')
  await flipCosts.nth(0).click()
  await flipCosts.nth(1).click()
  await next.click()
  const target = modal.locator('.trap-target-options button.is-attacker')
  assert.equal(await target.count(), 1, 'the current attacker is the legal printed opponent target')
  await target.click()
  await modal.getByRole('button', { name: '確認發動', exact: true }).click()
  const drawModal = draw(page)
  await drawModal.waitFor({ state: 'visible' })
  const options = drawModal.locator('.draw-up-to-option')
  assert.equal(await options.count(), 3, 'Then must offer draw 0, 1, or 2')
  await options.nth(drawCount).click()
  await drawModal.getByRole('button', { name: drawCount === 0 ? '略過抽牌' : `抽取 ${drawCount} 張牌`, exact: true }).click()
  await drawModal.waitFor({ state: 'hidden' })
  result.actions.push(`pay-yellow-discard-two-flips-target-attacker-and-draw-${drawCount}`)
}

const handlers = {
  'BS9-042': run042,
  'BS9-043': run043,
  'BS9-044': run044,
  'BS9-045': run045,
}

const runCase = async (browser, cardNumber, viewport, negative, drawCount) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(7_000)
  const requestedImages = new Set()
  page.on('request', (request) => {
    if (request.resourceType() === 'image') requestedImages.add(request.url())
  })
  const errors = recordBrowserErrors(page)
  const route = `${negative ? 'bs9-card-negative' : 'bs9-card'}:${cardNumber}`
  const result = { cardNumber, route, viewport, negative, status: 'FAIL', actions: [] }
  try {
    await page.goto(`${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${cardNumber}`, {
      waitUntil: 'domcontentloaded',
    })
    await waitForGame(page)
    const record = bs9Candidates.cards.find((candidate) => candidate.cardNumber === cardNumber)
    if (!record) throw new Error(`Missing BS9 candidate ${cardNumber}`)
    Object.assign(result, await assertExactImageLoaded(page, record, requestedImages.has(record.imageUrl)))
    if (cardNumber === 'BS9-045' && negative) {
      const trapCard = page.locator('.bottom-hand .hand-card[title="Overtaken Other-Realm"]')
      await assertPhysicalCard(trapCard, 'Overtaken Other-Realm')
      await page.waitForTimeout(350)
      assert.equal(await trap(page).count(), 0, 'two real FLIP Cookies are required before the Trap response can open')
      result.actions.push('block-trap-before-response-without-two-flip-cookies')
    } else {
      await handlers[cardNumber](page, negative, result, drawCount)
    }
    const entries = await trace(page)
    if (cardNumber === 'BS9-042') {
      assertTrace(entries, 'resolve-flip', 'both FLIP routes must produce a FLIP decision trace')
    } else if (cardNumber === 'BS9-043') {
      if (negative) assertNoTrace(entries, 'begin-play-item', 'unmet break condition must block the Item command')
      else {
        assertTrace(entries, 'begin-play-item', 'Item must use the command layer')
        assertTrace(entries, 'resolve-ability-effect', 'met break condition must resolve selected equipment')
      }
    } else if (cardNumber === 'BS9-044') {
      assertTrace(entries, 'begin-play-item', 'Item costs must use the command layer')
      assertTrace(entries, 'resolve-ability-effect', 'return/no-target resolution must be recorded')
    } else {
      if (negative) assertNoTrace(entries, 'play-trap', 'unpayable FLIP cost must block the Trap command')
      else {
        assertTrace(entries, 'play-trap', 'paid Trap must use the command layer')
        assertTrace(entries, 'resolve-draw-up-to', 'Then draw must reach its own decision')
      }
    }
    result.expectedImageUrl = record.imageUrl
    result.trace = entries
    result.traceCommandKinds = entries.map((entry) => entry.commandKind)
    result.finalPendingSurfaces = await readVisibleFinalSurfaces(page)
    assert.deepEqual(result.finalPendingSurfaces, [], `${cardNumber} must settle pending UI surfaces: ${result.finalPendingSurfaces.join(', ')}`)
    result.negativeEvidence = negative
      ? (cardNumber === 'BS9-042'
          ? entries.some((entry) => entry.commandKind === 'resolve-flip')
          : cardNumber === 'BS9-043'
            ? !entries.some((entry) => entry.commandKind === 'begin-play-item')
            : cardNumber === 'BS9-044'
              ? entries.some((entry) => entry.commandKind === 'resolve-ability-effect')
              : !entries.some((entry) => entry.commandKind === 'play-trap'))
      : false
    if (negative) assert.equal(result.negativeEvidence, true, `${cardNumber} negative route must retain blocked/no-op evidence`)
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
    result.negativeEvidence = negative ? Boolean(result.blocker) : false
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

const results = []
let browser
try {
  await waitForPreview()
  browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) })
  for (const { viewport, drawCount } of [
    { viewport: { width: 1907, height: 863 }, drawCount: 2 },
    { viewport: { width: 1164, height: 777 }, drawCount: 0 },
  ]) {
    for (const cardNumber of Object.keys(handlers)) {
      results.push(await runCase(browser, cardNumber, viewport, false, drawCount))
      results.push(await runCase(browser, cardNumber, viewport, true, drawCount))
    }
  }
} finally {
  await browser?.close()
  if (preview.exitCode === null) preview.kill()
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  scope: 'BS9-042 FLIP hand cost/attached HP; 043 break LV.4 equipped Soul Jam; 044 yellow FLIP trash recovery; 045 Trap FLIP discard, attack reduction, Then draw A/B.',
  total: results.length,
  passed: results.filter((result) => result.status === 'PASS').length,
  failed: results.filter((result) => result.status !== 'PASS'),
  results,
}
writeFileSync(resolve(outputDirectory, 'bs9-042-045-browser.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({ total: report.total, passed: report.passed, failed: report.failed.map((result) => ({ cardNumber: result.cardNumber, negative: result.negative, viewport: result.viewport, error: result.error?.split('\n')[0] })) }, null, 2))
process.exitCode = report.failed.length > 0 ? 1 : 0
