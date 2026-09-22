import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, 'test-results/bs10-009-browser')
mkdirSync(output, { recursive: true })
const baseUrl = process.env.BRAVERSE_BS10_BASE_URL ?? 'http://127.0.0.1:4190'
const executablePath = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find(existsSync)
const viewports = [{ width: 1907, height: 863 }, { width: 1164, height: 777 }]
const selectedViewports = process.env.BRAVERSE_BS10_VIEWPORTS
  ? viewports.filter((viewport) => process.env.BRAVERSE_BS10_VIEWPORTS.split(',').includes(String(viewport.width)))
  : viewports
assert.ok(selectedViewports.length > 0)
const only = process.env.BRAVERSE_BS10_ONLY ?? 'all'
const candidateRecords = JSON.parse(readFileSync(resolve(root, 'data/cards/official-paradise-of-passion-and-sloth-catacombs-of-silence-bs10.en.json'), 'utf8')).cards
const candidate = candidateRecords.find((record) => record.cardNumber === 'BS10-009')
assert.ok(candidate?.imageUrl, 'BS10-009 candidate image is required')
const imagePath = new URL(candidate.imageUrl).pathname
const contractCards = 'BS10-009,BS6-047,BS6-071,BS6-079,BS6-017,BS6-002,BS6-004'
const cases = [
  ['009-normal-pay', 'normal', 'pay'],
  ['009-source-last-hp', 'source-last-hp', 'pay'],
  ['009-ally-last-hp', 'ally-last-hp', 'pay'],
  ['009-mixed-support-attack', 'mixed-support', 'attack'],
  ['009-wrong-target', 'wrong-target', 'negative'],
  ['009-once-used', 'once-used', 'negative'],
]

const visible = (page, selector) => page.locator(`${selector}:visible`).first()
const trace = (page) => page.evaluate(() => Array.isArray(window.__braverseContractTrace) ? window.__braverseContractTrace : [])
const waitTrace = (page, kind) => page.waitForFunction((wanted) => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === wanted), kind)
const waitSettled = (page) => page.waitForFunction(() => {
  const visibleModal = (selector) => [...document.querySelectorAll(selector)].some((element) => {
    const style = getComputedStyle(element)
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0
  })
  return document.querySelector('.match-animation-layer')?.getAttribute('data-playing') !== 'true' &&
    !visibleModal('.effect-panel, .decision-modal, .draw-up-to-modal, .battle-response-modal, [data-testid="attack-payment-panel"]')
})
const publicState = (page) => page.evaluate(() => {
  const field = (side) => {
    const root = document.querySelector(`.${side}-field`)
    if (!root) return null
    const text = (selector) => root.querySelector(selector)?.textContent?.trim() ?? null
    return {
      hand: text('.row-stat-hand .row-stat-value'),
      deck: text('.deck-zone .resource-summary > strong'),
      trash: text('button.discard-zone.resource-summary > strong'),
      break: text('.break-zone .zone-heading b'),
      support: [...root.querySelectorAll('.support-card-wrap .card-face')].map((card) => ({ title: card.getAttribute('title'), rested: card.classList.contains('is-rested') })),
      battle: [...root.querySelectorAll('.combat-card-wrap')].map((entry) => ({
        id: entry.getAttribute('data-card-instance-id'),
        name: entry.querySelector('.card-face')?.getAttribute('title'),
        hp: entry.querySelector('.badge-hp')?.textContent?.trim() ?? null,
      })),
    }
  }
  return { bottom: field('bottom'), top: field('top'), phase: document.querySelector('.turn-indicator strong')?.textContent?.trim() ?? null }
})
const numberFrom = (value) => Number(value?.match(/-?\d+/)?.[0])
const screenshot = async (page, evidence, stage) => {
  const path = resolve(output, `${evidence.label}-${evidence.viewport.width}-${stage}.png`)
  await page.screenshot({ path, fullPage: true })
  evidence.screenshots[stage] = path
}
const waitImages = async (page) => {
  await page.waitForFunction((expected) => [...document.images].some((image) => new URL(image.src, location.href).pathname === expected && image.complete && image.naturalWidth > 0), imagePath)
  try {
    await page.waitForFunction(() => [...document.images]
      .filter((image) => image.getClientRects().length > 0)
      .every((image) => image.complete && image.naturalWidth > 0), undefined, { timeout: 15000 })
  } catch (error) {
    const details = await page.evaluate(() => [...document.images]
      .filter((image) => image.getClientRects().length > 0)
      .map((image) => ({ src: image.currentSrc || image.src, complete: image.complete, naturalWidth: image.naturalWidth })))
    throw new Error(`${error.message}; imageDetails=${JSON.stringify(details)}`)
  }
  const failed = await page.evaluate(() => [...document.images].filter((image) => image.getClientRects().length > 0 && (!image.complete || image.naturalWidth <= 0)).map((image) => image.currentSrc || image.src))
  assert.deepEqual(failed, [], `visible images did not decode: ${failed.join(', ')}`)
  return page.evaluate((expected) => [...document.images].filter((image) => new URL(image.src, location.href).pathname === expected).map((image) => ({ src: image.currentSrc || image.src, complete: image.complete, naturalWidth: image.naturalWidth })), imagePath)
}
const sourceCard = (page) => page.locator('.bottom-field .combat-card-wrap').filter({ has: page.locator('.card-face[title="Cranberry Cookie"]') }).first()

const activateSkill = async (page, evidence, costTargetName = 'Cranberry Cookie', effectTargetName = 'Cranberry Cookie') => {
  const source = sourceCard(page)
  await source.waitFor()
  const skill = source.locator('.skill-action')
  assert.equal(await skill.isEnabled(), true)
  await skill.click()
  const panel = visible(page, '.effect-panel')
  await panel.waitFor()
  const candidates = panel.locator('.effect-candidates-hp-cost button')
  assert.ok(await candidates.count() > 0, 'HP cost must expose legal real Cookie targets')
  assert.equal(await panel.locator('.effect-panel-primary-action').isEnabled(), false, 'unpaid HP target must disable confirmation')
  const target = candidates.filter({ hasText: costTargetName }).first()
  assert.equal(await target.count(), 1, `HP cost target ${costTargetName} must be visible`)
  await target.click()
  assert.match(await panel.innerText(), /已選 1 張／1 張 HP 費用/, 'selected HP target must be visible before confirmation')
  assert.equal(await panel.locator('.effect-panel-primary-action').isEnabled(), true)
  await screenshot(page, evidence, 'payment')
  await panel.locator('.effect-panel-primary-action').click()
  const nextPanel = visible(page, '.effect-panel')
  const effectTargets = nextPanel.locator('.effect-candidates-target button')
  if (await effectTargets.count()) {
    const effectTarget = effectTargets.filter({ hasText: effectTargetName }).first()
    assert.equal(await effectTarget.count(), 1, `effect target ${effectTargetName} must be visible`)
    await effectTarget.click()
    assert.equal(await nextPanel.locator('.effect-panel-primary-action').isEnabled(), true)
    await nextPanel.locator('.effect-panel-primary-action').click()
  }
  await waitTrace(page, 'begin-activate-skill')
}

const settleAbility = async (page, evidence) => {
  const panel = visible(page, '.effect-panel')
  if (await panel.count()) {
    const primary = panel.locator('.effect-panel-primary-action')
    if (await primary.count() && await primary.isEnabled()) await primary.click()
  }
  const faint = page.locator('.faint-response-modal:visible').first()
  await faint.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
  if (await faint.count()) {
    const confirm = faint.locator('.modal-actions button, .faint-modal-actions button').filter({ hasText: /確認/ }).last()
    assert.equal(await confirm.count(), 1, 'faint response must expose a confirmation action')
    await confirm.click()
    await faint.waitFor({ state: 'hidden' })
    await waitTrace(page, 'resolve-faint-effect')
    evidence.faint = 'resolved'
  }
  const draw = visible(page, '.draw-up-to-modal')
  await draw.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
  if (await draw.count()) {
    const option = draw.locator('.draw-up-to-option').first()
    await option.click()
    await draw.locator('.draw-up-to-actions button').click()
    await waitTrace(page, 'resolve-draw-up-to')
  }
  const continuation = visible(page, '.effect-panel')
  if (await continuation.count()) {
    const target = continuation.locator('.effect-candidates-target button:not(.is-selected)').first()
    if (await target.count()) await target.click()
    const primary = continuation.locator('.effect-panel-primary-action')
    if (await primary.count() && await primary.isEnabled()) await primary.click()
  }
  await waitTrace(page, 'resolve-ability-effect')
  const replacement = page.locator('.decision-modal:visible').first()
  try {
    await replacement.waitFor({ state: 'visible', timeout: 5000 })
    const skip = replacement.getByRole('button', { name: '不補餅乾', exact: true })
    assert.equal(await skip.count(), 1, 'replacement must expose the exact 不補餅乾 choice')
    await skip.click()
    evidence.replacement = 'skip-replacement'
  } catch (error) {
    if (!String(error?.message ?? error).includes('Timeout')) throw error
  }
  await waitSettled(page)
}

const runCase = async (browser, viewport, label, scenario, mode) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(15000)
  const evidence = { card: 'BS10-009', label, scenario, mode, viewport, status: 'FAIL', errors: [], knownWarnings: [], screenshots: {} }
  page.on('pageerror', (error) => evidence.errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const url = message.location().url
    if (message.text().includes('Failed to load resource') && url.includes('favicon.ico')) evidence.knownWarnings.push({ text: message.text(), url })
    else evidence.errors.push(`console: ${message.text()} @ ${url}`)
  })
  page.on('response', (response) => {
    if (response.status() < 400) return
    if (response.url().includes('favicon.ico')) evidence.knownWarnings.push({ status: response.status(), url: response.url() })
    else evidence.errors.push(`${response.status()} response: ${response.url()}`)
  })
  page.on('requestfailed', (request) => {
    if (request.url().includes('favicon.ico')) evidence.knownWarnings.push({ url: request.url(), reason: request.failure()?.errorText })
    else evidence.errors.push(`request failed: ${request.url()} ${request.failure()?.errorText ?? 'unknown'}`)
  })
  try {
    await page.goto(`${baseUrl}/?test-state=bs10-009-hp-cost&scenario=${scenario}&contract-card=${encodeURIComponent(contractCards)}`, { waitUntil: 'domcontentloaded' })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    evidence.images = await waitImages(page)
    evidence.before = await publicState(page)
    await screenshot(page, evidence, 'before')
    const source = sourceCard(page)
    const ownSide = evidence.before.bottom.battle.some((entry) => entry.id === 'bs10-009-preview-source') ? 'bottom' : 'top'
    if (mode === 'negative') {
      if (scenario === 'wrong-target') {
        assert.equal(await source.locator('.skill-action').isEnabled(), true, 'source itself should remain a legal HP-cost target')
        await source.locator('.skill-action').click()
        const panel = visible(page, '.effect-panel')
        await panel.waitFor()
        const candidates = panel.locator('.effect-candidates-hp-cost button')
        assert.ok(await candidates.count() > 0, 'wrong-target case must still expose the source as a legal target')
        assert.equal(await candidates.filter({ hasText: 'Pink Choco Cookie' }).count(), 0, 'LV1 wrong target must not be offered for the HP cost')
        evidence.negativeReason = await panel.innerText()
        await panel.locator('.skip-effect').click()
        await panel.waitFor({ state: 'hidden' }).catch(() => {})
      } else {
        assert.equal(await source.locator('.skill-action').isEnabled(), false)
        evidence.negativeReason = await source.locator('.skill-unavailable-reason').innerText()
        assert.match(evidence.negativeReason, /一次|合法|條件|支付|目標/)
      }
      assert.deepEqual(await publicState(page), evidence.before)
    } else {
      await activateSkill(page, evidence, scenario === 'ally-last-hp' ? 'Soda Cookie' : 'Cranberry Cookie', 'Cranberry Cookie')
      if (scenario === 'once-used') throw new Error('unreachable once-used positive path')
      await settleAbility(page, evidence)
      evidence.after = await publicState(page)
      const own = evidence.after[ownSide]
      if (scenario === 'source-last-hp') {
        assert.equal(own.battle.some((entry) => entry.name === 'Cranberry Cookie'), false)
        assert.equal(numberFrom(own.break), 1)
      } else {
        assert.ok(own.battle.some((entry) => entry.name === 'Cranberry Cookie'))
      }
      await screenshot(page, evidence, 'settled')
      if (mode === 'attack') {
        const attackCard = own.battle.find((entry) => entry.name === 'Cranberry Cookie')
        assert.ok(attackCard, 'Cranberry must remain for reduced-cost attack')
        await page.locator(`[data-card-instance-id="${attackCard.id}"] .card-face.is-attackable`).click()
        const red = page.locator('.bottom-field .support-card-wrap .card-face[title="Dark Choco Cookie"]').first()
        await red.click()
        const target = page.locator('.top-field .combat-card-wrap .card-face[aria-label^="選擇攻擊目標："]').first()
        await target.click()
        await waitTrace(page, 'resolve-battle')
        await waitSettled(page)
        evidence.afterAttack = await publicState(page)
        const opponent = evidence.afterAttack.top.battle.find((entry) => entry.name === 'Croissant Cookie')
        assert.equal(numberFrom(opponent?.hp), 3)
        await screenshot(page, evidence, 'after-attack')
      }
    }
    evidence.trace = await trace(page)
    assert.deepEqual(evidence.errors, [])
    evidence.status = 'PASS'
  } catch (error) {
    evidence.error = error.stack ?? String(error)
    evidence.body = await page.locator('body').innerText().catch(() => '')
    evidence.after = await publicState(page).catch(() => null)
    evidence.trace = await trace(page).catch(() => [])
  } finally {
    await page.screenshot({ path: resolve(output, `${label}-${viewport.width}-${evidence.status}.png`), fullPage: true }).catch(() => {})
    await page.close()
  }
  console.log(`BS10-009 ${label} ${viewport.width}x${viewport.height}: ${evidence.status}${evidence.error ? ` ${evidence.error.split('\n')[0]}` : ''}`)
  return evidence
}

const main = async () => {
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
  const selectedCases = cases.filter(([label, scenario]) => only === 'all' || only === scenario || only === label)
  assert.ok(selectedCases.length > 0, `BRAVERSE_BS10_ONLY=${only} selected no cases`)
  const results = []
  let failed = false
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
  if (failed || results.length !== selectedViewports.length * selectedCases.length) process.exitCode = 1
}

await main()
