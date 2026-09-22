import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, 'test-results/bs10-008-browser')
mkdirSync(output, { recursive: true })
const baseUrl = process.env.BRAVERSE_BS10_BASE_URL ?? 'http://127.0.0.1:4190'
const executablePath = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find(existsSync)
const viewports = [
  { width: 1907, height: 863 },
  { width: 1164, height: 777 },
]
const selectedViewports = process.env.BRAVERSE_BS10_VIEWPORTS
  ? viewports.filter((viewport) => process.env.BRAVERSE_BS10_VIEWPORTS.split(',').includes(String(viewport.width)))
  : viewports
assert.ok(selectedViewports.length > 0, 'at least one viewport must be selected')
const only = process.env.BRAVERSE_BS10_ONLY ?? 'all'
const sourceRecord = JSON.parse(readFileSync(resolve(root, 'data/cards/official-paradise-of-passion-and-sloth-catacombs-of-silence-bs10.en.json'), 'utf8')).cards
  .find((record) => record.cardNumber === 'BS10-008')
assert.ok(sourceRecord?.imageUrl, 'BS10-008 official candidate image is required')
const sourceImagePath = new URL(sourceRecord.imageUrl).pathname
const contractCards = 'BS10-008,BS6-047,BS6-079,BS6-017,BS6-015,BS6-004'

const cases = [
  ['008-nonlethal-pay', 'nonlethal', 'pay'],
  ['008-nonlethal-skip', 'nonlethal', 'skip'],
  ['008-last-hp-pay', 'last-hp', 'pay'],
  ['008-last-hp-skip', 'last-hp', 'skip'],
  ['008-no-hand-skip', 'no-hand', 'skip'],
  ['008-two-damage-pay', 'two-damage', 'pay'],
  ['008-refresh-one-pay', 'refresh-one', 'pay'],
  ['008-refresh-two-pay', 'refresh-two', 'pay'],
]

const visible = (page, selector) => page.locator(`${selector}:visible`).first()
const publicState = async (page) => page.evaluate(() => {
  const readField = (side) => {
    const root = document.querySelector(`.${side}-field`)
    if (!root) return null
    const text = (selector) => root.querySelector(selector)?.textContent?.trim() ?? null
    return {
      hand: text('.row-stat-hand .row-stat-value'),
      deck: text('.deck-zone .resource-summary > strong'),
      trash: text('button.discard-zone.resource-summary > strong'),
      break: text('.break-zone .zone-heading b'),
      support: [...root.querySelectorAll('.support-card-wrap .card-face')].map((card) => ({
        title: card.getAttribute('title'),
        rested: card.classList.contains('is-rested'),
      })),
      battle: [...root.querySelectorAll('.combat-card-wrap')].map((entry) => ({
        id: entry.getAttribute('data-card-instance-id'),
        name: entry.querySelector('.card-face')?.getAttribute('title'),
        hp: entry.querySelector('.badge-hp')?.textContent?.trim() ?? null,
        rested: entry.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
      })),
    }
  }
  return {
    bottom: readField('bottom'),
    top: readField('top'),
    phase: document.querySelector('.turn-indicator strong')?.textContent?.trim() ?? null,
  }
})
const readTrace = (page) => page.evaluate(() => Array.isArray(window.__braverseContractTrace) ? window.__braverseContractTrace : [])
const traceKinds = (entries) => entries.map((entry) => entry.commandKind)
const countOf = (value) => Number(value?.match(/-?\d+/)?.[0])
const assertTraceSequence = (entries, expected) => {
  let cursor = -1
  for (const kind of expected) {
    const index = entries.findIndex((entry, position) => position > cursor && entry.commandKind === kind)
    assert.notEqual(index, -1, `trace must contain ${expected.join(' -> ')}`)
    cursor = index
  }
}
const waitForImages = async (page) => {
  await page.waitForFunction((expectedPath) => {
    const images = [...document.images]
    const source = images.find((image) => new URL(image.src, window.location.href).pathname === expectedPath)
    return source?.complete === true && source.naturalWidth > 0
  }, sourceImagePath)
  await page.waitForFunction(() => [...document.images]
    .filter((image) => image.getClientRects().length > 0)
    .every((image) => image.complete && image.naturalWidth > 0), undefined, { timeout: 15000 })
  const failed = await page.evaluate(() => [...document.images]
    .filter((image) => image.getClientRects().length > 0)
    .filter((image) => !image.complete || image.naturalWidth <= 0)
    .map((image) => image.currentSrc || image.src))
  assert.deepEqual(failed, [], `visible card images did not decode: ${failed.join(', ')}`)
  return page.evaluate((expectedPath) => [...document.images]
    .filter((image) => image.getClientRects().length > 0)
    .map((image) => ({ src: image.currentSrc || image.src, path: new URL(image.src, window.location.href).pathname }))
    .filter((image) => image.path === expectedPath || image.path.includes('/cards/')),
  sourceImagePath)
}
const waitSettled = async (page) => page.waitForFunction(() => {
  const visibleModal = (selector) => [...document.querySelectorAll(selector)].some((element) => {
    const style = window.getComputedStyle(element)
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0
  })
  return document.querySelector('.match-animation-layer')?.getAttribute('data-playing') !== 'true' &&
    !visibleModal('.flip-response-modal, .effect-panel, .decision-modal, .draw-up-to-modal, .battle-response-modal')
})
const waitCommand = async (page, kind) => page.waitForFunction((wanted) => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === wanted), kind)
const screenshot = async (page, evidence, stage) => {
  const path = resolve(output, `${evidence.label}-${evidence.viewport.width}-${stage}.png`)
  await page.screenshot({ path, fullPage: true })
  evidence.screenshots[stage] = path
}
const capturePublicLog = async (page, evidence) => {
  const toggle = page.locator('[data-testid="battle-log-toggle"]')
  await toggle.click()
  const entries = page.locator('.battle-log-entry')
  for (let index = 0; index < await entries.count(); index += 1) {
    const entry = entries.nth(index)
    if (await entry.getAttribute('aria-expanded') === 'false') await entry.click()
  }
  evidence.publicLog = [...await entries.allTextContents(), await page.locator('body').innerText()]
  if (evidence.replacementAction) assert.ok(evidence.publicLog.some((text) => /不補餅乾|不補位/.test(text)), 'public battle log must show the no-replacement action')
  await screenshot(page, evidence, 'continued-log')
}

const chooseHandCost = async (page, evidence) => {
  const flip = visible(page, '.flip-response-modal')
  const candidates = flip.locator('.flip-card-page button')
  assert.ok(await candidates.count() > 0, 'FLIP payment must expose a real hand card')
  await candidates.first().click()
  const activate = flip.getByRole('button', { name: '發動 FLIP', exact: true })
  assert.equal(await activate.isEnabled(), true)
  await screenshot(page, evidence, 'payment')
  await activate.click()
}

const resolveFlip = async (page, evidence, mode) => {
  const flip = visible(page, '.flip-response-modal')
  await flip.waitFor()
  assert.match(await flip.innerText(), /Lemon Cookie|FLIP/)
  if (mode === 'skip') {
    await screenshot(page, evidence, 'payment')
    await flip.getByRole('button', { name: '不發動', exact: true }).click()
  } else {
    await chooseHandCost(page, evidence)
  }
  await waitCommand(page, 'resolve-flip')
}

const resolveReplacement = async (page, evidence) => {
  const decision = visible(page, '.decision-modal')
  if (!(await decision.count())) return
  await decision.waitFor()
  const skip = decision.getByRole('button', { name: '不補餅乾', exact: true })
  assert.equal(await skip.count(), 1, 'replacement must expose the public no-replacement action')
  await skip.click()
  await decision.waitFor({ state: 'hidden' })
  evidence.replacementAction = 'skip-replacement'
}

const resolveRefresh = async (page, evidence) => {
  const decision = visible(page, '.decision-modal')
  await decision.waitFor()
  await screenshot(page, evidence, 'refresh')
  const options = decision.locator('.decision-card-options button:not(:disabled)')
  assert.ok(await options.count() > 0, 'Refresh must expose a legal Cookie choice')
  const legal = options.filter({ hasText: 'Mint Choco Cookie' }).first()
  assert.equal(await legal.count(), 1, 'Refresh must expose the formal BS6-004 Mint Choco Cookie option')
  await legal.click()
  await waitCommand(page, 'refresh-deck')
}

const resolveReplacementIfVisible = async (page, evidence) => {
  const decision = visible(page, '.decision-modal')
  if (await decision.count()) await resolveReplacement(page, evidence)
}

const waitForReplacementOrAdvance = async (page) => page.waitForFunction(() => {
  const decision = document.querySelector('.decision-modal')
  const visibleDecision = decision && getComputedStyle(decision).display !== 'none' && decision.getClientRects().length > 0
  const next = document.querySelector('.next-phase-button')
  return Boolean(visibleDecision || (next && !next.disabled))
})

const runCase = async (browser, viewport, label, scenario, mode) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(15000)
  const evidence = { card: 'BS10-008', label, scenario, mode, viewport, route: `bs10-008-flip&scenario=${scenario}`, status: 'FAIL', errors: [], knownWarnings: [], screenshots: {} }
  page.on('pageerror', (error) => evidence.errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const url = message.location().url
    if (message.text().includes('Failed to load resource') && url.includes('favicon.ico')) evidence.knownWarnings.push({ text: message.text(), url })
    else evidence.errors.push(`console: ${message.text()} @ ${url}`)
  })
  page.on('response', (response) => {
    if (response.status() < 400) return
    const item = { status: response.status(), url: response.url(), type: response.request().resourceType() }
    if (item.url.includes('favicon.ico')) evidence.knownWarnings.push(item)
    else evidence.errors.push(`${item.status} response: ${item.url}`)
  })
  page.on('requestfailed', (request) => {
    const item = { url: request.url(), type: request.resourceType(), reason: request.failure()?.errorText ?? 'unknown' }
    if (item.url.includes('favicon.ico')) evidence.knownWarnings.push(item)
    else evidence.errors.push(`request failed: ${item.url} ${item.reason}`)
  })
  try {
    await page.goto(`${baseUrl}/?test-state=bs10-008-flip&scenario=${scenario}&contract-card=${encodeURIComponent(contractCards)}`, { waitUntil: 'domcontentloaded' })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    evidence.imagesBefore = await waitForImages(page)
    evidence.before = await publicState(page)
    const beforeOwn = evidence.before.bottom.battle.some((entry) => entry.name === 'Croissant Cookie') ? evidence.before.bottom : evidence.before.top
    const beforeOpponent = evidence.before.bottom === beforeOwn ? evidence.before.top : evidence.before.bottom
    const survivorBefore = beforeOwn.battle.find((entry) => entry.name === 'Croissant Cookie')
    const attackerBefore = beforeOpponent.battle.find((entry) => /Pink Choco Cookie|Choco Ball Cookie/.test(entry.name ?? ''))
    assert.equal(survivorBefore?.hp, '1/5')
    assert.ok(attackerBefore, 'attacker must be the real Pink Choco Cookie or Choco Ball Cookie')
    evidence.initialPublic = { survivor: survivorBefore, attacker: attackerBefore, ownSupport: beforeOwn.support, opponentSupport: beforeOpponent.support }
    await screenshot(page, evidence, 'before')
    if (scenario === 'no-hand') {
      const flip = visible(page, '.flip-response-modal')
      await flip.waitFor()
      const handOptions = flip.locator('.flip-card-page button')
      assert.equal(await handOptions.count(), 0, 'no-hand FLIP must expose zero payment cards')
      const activate = flip.getByRole('button', { name: '發動 FLIP', exact: true })
      assert.equal(await activate.isEnabled(), false, 'no-hand FLIP activation must be disabled')
      evidence.negativeReason = await flip.innerText()
      assert.match(evidence.negativeReason, /手牌|棄置/)
      await screenshot(page, evidence, 'payment')
      await flip.getByRole('button', { name: '不發動', exact: true }).click()
      await waitCommand(page, 'resolve-flip')
      await waitForReplacementOrAdvance(page)
      await resolveReplacementIfVisible(page, evidence)
      await waitSettled(page)
      const declinedTrace = (await readTrace(page)).find((entry) => entry.commandKind === 'resolve-flip')
      assert.ok(declinedTrace, 'no-hand route must emit resolve-flip')
      assert.match(`${declinedTrace.summary} ${declinedTrace.steps?.join(' ') ?? ''}`, /不發動|未執行/)
      const noHandAfter = await publicState(page)
      const noHandOwn = noHandAfter.bottom.battle.some((entry) => entry.name === 'Croissant Cookie') ? noHandAfter.bottom : noHandAfter.top
      const noHandOpponent = noHandAfter.bottom === noHandOwn ? noHandAfter.top : noHandAfter.bottom
      assert.deepEqual([countOf(noHandOwn.hand), countOf(noHandOwn.deck), countOf(noHandOwn.trash), countOf(noHandOwn.break), noHandOwn.battle.find((entry) => entry.name === 'Lemon Cookie')?.hp ?? null], [0, 2, 1, 1, null])
      evidence.afterSettlement = noHandAfter
      assert.deepEqual(noHandAfter.bottom.battle.some((entry) => entry.name === 'Croissant Cookie') ? noHandAfter.bottom.support : noHandAfter.top.support, evidence.initialPublic.ownSupport)
      assert.deepEqual(noHandAfter.bottom.battle.some((entry) => entry.name === 'Croissant Cookie') ? noHandAfter.top.support : noHandAfter.bottom.support, evidence.initialPublic.opponentSupport)
      const noHandAttacker = noHandOpponent.battle.find((entry) => entry.id === evidence.initialPublic.attacker.id)
      assert.deepEqual(noHandAttacker && { id: noHandAttacker.id, hp: noHandAttacker.hp }, { id: evidence.initialPublic.attacker.id, hp: evidence.initialPublic.attacker.hp })
      await screenshot(page, evidence, 'settled')
    } else {
      await resolveFlip(page, evidence, mode)
      if (scenario.startsWith('refresh-')) await resolveRefresh(page, evidence)
      await waitForReplacementOrAdvance(page)
      await resolveReplacementIfVisible(page, evidence)
      await waitSettled(page)
      evidence.afterSettlement = await publicState(page)
      const beforeOwn = evidence.before.bottom.battle.some((entry) => entry.name === 'Croissant Cookie') ? evidence.before.bottom : evidence.before.top
      const afterOwn = evidence.afterSettlement.bottom.battle.some((entry) => entry.name === 'Croissant Cookie') ? evidence.afterSettlement.bottom : evidence.afterSettlement.top
      const expected = {
        '008-nonlethal-pay': [0, 1, 2, 0, '2/2'], '008-nonlethal-skip': [1, 2, 1, 0, '1/2'],
        '008-last-hp-pay': [0, 1, 2, 0, '1/2'], '008-last-hp-skip': [1, 2, 1, 1, null],
        '008-two-damage-pay': [0, 1, 3, 1, null], '008-refresh-one-pay': [0, 2, 0, 1, '1/2'],
        '008-refresh-two-pay': [0, 2, 1, 2, null],
      }[label]
      assert.deepEqual([countOf(afterOwn.hand), countOf(afterOwn.deck), countOf(afterOwn.trash), countOf(afterOwn.break), afterOwn.battle.find((entry) => entry.name === 'Lemon Cookie')?.hp ?? null], [...expected.slice(0, 3), expected[3], expected[4]])
      const beforeOpponent = evidence.before.bottom === beforeOwn ? evidence.before.top : evidence.before.bottom
      const afterOpponent = evidence.afterSettlement.bottom === afterOwn ? evidence.afterSettlement.top : evidence.afterSettlement.bottom
      assert.deepEqual(afterOpponent.support, beforeOpponent.support)
      assert.ok(afterOwn.battle.some((entry) => entry.name === 'Croissant Cookie'), 'survivor must remain visible')
      await screenshot(page, evidence, 'settled')
      const entries = await readTrace(page)
      assertTraceSequence(entries, ['resolve-next-damage', 'resolve-flip'])
      const flipEntry = entries.find((entry) => entry.commandKind === 'resolve-flip')
      assert.ok(flipEntry)
      const flipText = `${flipEntry.summary} ${flipEntry.steps?.join(' ') ?? ''}`
      if (mode === 'pay') {
        assert.match(flipText, /發動了|已發動/)
        assert.doesNotMatch(flipText, /不發動|未執行/)
      } else {
        assert.match(flipText, /不發動|未執行/)
      }
      if (scenario.startsWith('refresh-')) {
        assertTraceSequence(entries, ['resolve-next-damage', 'resolve-flip', 'refresh-deck'])
      }
      if (scenario === 'refresh-two') {
        await page.waitForFunction(() => {
          const trace = window.__braverseContractTrace ?? []
          const refreshIndex = trace.findIndex((entry) => entry.commandKind === 'refresh-deck')
          return refreshIndex >= 0 && trace.some((entry, index) => index > refreshIndex && entry.commandKind === 'resolve-next-damage')
        })
        assertTraceSequence(await readTrace(page), ['resolve-next-damage', 'resolve-flip', 'refresh-deck', 'resolve-next-damage'])
      }
      const afterOwnBattle = afterOwn.battle.find((entry) => entry.name === 'Croissant Cookie')
      const afterAttacker = afterOpponent.battle.find((entry) => entry.id === evidence.initialPublic.attacker.id)
      assert.equal(afterOwnBattle?.hp, '1/5')
      assert.deepEqual(afterOwn.support, evidence.initialPublic.ownSupport)
      assert.deepEqual(afterOpponent.support, evidence.initialPublic.opponentSupport)
      assert.deepEqual(afterAttacker && { id: afterAttacker.id, hp: afterAttacker.hp }, { id: evidence.initialPublic.attacker.id, hp: evidence.initialPublic.attacker.hp })
    }
    const phaseBefore = evidence.afterSettlement?.phase ?? evidence.before.phase
    const next = page.locator('.next-phase-button')
    await next.waitFor({ state: 'visible' })
    assert.equal(await next.isEnabled(), true, 'settled route must expose legal phase advance')
    await next.click()
    await page.waitForFunction((previous) => document.querySelector('.turn-indicator strong')?.textContent?.trim() !== previous, phaseBefore)
    evidence.continued = await publicState(page)
    assert.equal(evidence.continued.phase, '結束階段')
    await screenshot(page, evidence, 'continued')
    if (evidence.replacementAction) await capturePublicLog(page, evidence)
    evidence.trace = await readTrace(page)
    assert.deepEqual(evidence.errors, [])
    evidence.status = 'PASS'
  } catch (error) {
    evidence.error = error.stack ?? String(error)
    evidence.body = await page.locator('body').innerText().catch(() => '')
    evidence.after = await publicState(page).catch(() => null)
    evidence.trace = await readTrace(page).catch(() => [])
  } finally {
    await page.screenshot({ path: resolve(output, `${label}-${viewport.width}-${evidence.status}.png`), fullPage: true }).catch(() => {})
    await page.close()
  }
  console.log(`BS10-008 ${label} ${viewport.width}x${viewport.height}: ${evidence.status}${evidence.error ? ` ${evidence.error.split('\n')[0]}` : ''}`)
  return evidence
}

const main = async () => {
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
  const results = []
  let failed = false
  const selectedCases = cases.filter(([label, scenario]) => only === 'all' || only === scenario || only === label)
  assert.ok(selectedCases.length > 0, `BRAVERSE_BS10_ONLY=${only} selected no cases`)
  try {
    outer: for (const viewport of selectedViewports) {
      for (const [label, scenario, mode] of selectedCases) {
        const result = await runCase(browser, viewport, label, scenario, mode)
        results.push(result)
        writeFileSync(resolve(output, 'report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, viewports: selectedViewports, results }, null, 2))
        if (result.status !== 'PASS') { failed = true; break outer }
      }
    }
  } finally {
    await browser.close()
  }
  const report = { generatedAt: new Date().toISOString(), baseUrl, viewports: selectedViewports, total: results.length, passed: results.filter((result) => result.status === 'PASS').length, failed: results.filter((result) => result.status !== 'PASS'), results }
  writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2))
  if (failed || results.length !== selectedViewports.length * cases.filter(([label, scenario]) => only === 'all' || only === scenario || only === label).length) process.exitCode = 1
}

await main()
