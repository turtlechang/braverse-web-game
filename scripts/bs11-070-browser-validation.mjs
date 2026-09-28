import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const module = await import(pathToFileURL(playwrightEntry).href)
const chromium = module.chromium ?? module.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')
const baseUrl = process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'
const outputDir = resolve(root, 'test-results/bs11-070-browser')
mkdirSync(outputDir, { recursive: true })
const cards = {
  'BS11-070': 'khSl0OygsG0XYSC63wFyhg.webp',
  'BS11-070@1': 'BpTMxn66SnEAAXXgCs89Iw.webp',
}
const executablePath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
const cases = Object.keys(cards).flatMap((cardNumber) => ['positive', 'negative', 'top', 'bottom', 'skip'].map((scenario) => ({
  id: `${cardNumber}-${scenario}`, cardNumber, scenario,
})))
const requested = process.env.BS11_BROWSER_CASES?.split(',').map((part) => part.trim()).filter(Boolean)
const selectedCases = requested?.length ? cases.filter((testCase) => requested.includes(testCase.id)) : cases
if (!selectedCases.length || requested?.some((id) => !cases.some((testCase) => testCase.id === id))) {
  throw new Error('Unknown or empty BS11_BROWSER_CASES selection')
}
const widths = process.env.BS11_BROWSER_WIDTHS?.split(',').map(Number).filter(Number.isFinite)
const viewports = [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]
const selectedViewports = widths?.length ? viewports.filter((viewport) => widths.includes(viewport.width)) : viewports
if (!selectedViewports.length) throw new Error('Unknown BS11_BROWSER_WIDTHS selection')
const wait = (ms) => new Promise((done) => setTimeout(done, ms))
const visible = async (locator) => await locator.count() > 0 && await locator.first().isVisible().catch(() => false)
const trace = (page) => page.evaluate(() => (window.__braverseContractTrace ?? []).map((entry) => ({
  commandKind: entry.commandKind,
  steps: Array.isArray(entry.steps) ? entry.steps.map(String) : [],
})))
const waitForCommand = (page, kind) => page.waitForFunction(
  (commandKind) => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === commandKind), kind,
)
const readState = (page) => page.evaluate(() => {
  const side = (name) => {
    const field = document.querySelector(`.${name}-field`)
    const count = (selector) => Number(field?.querySelector(selector)?.textContent?.match(/\d+/)?.[0] ?? NaN)
    return {
      handCount: field?.querySelectorAll('.hand-card-wrap').length ?? 0,
      deckCount: count('.deck-zone .resource-summary > strong'),
      discardCount: count('.discard-zone.resource-summary > strong'),
      supports: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map((node) => ({
        rested: Boolean(node.querySelector('.card-face.is-rested')),
      })),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map((node) => ({
        id: node.getAttribute('data-card-instance-id'),
        name: node.querySelector('.card-face')?.getAttribute('title'),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
      })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const clickReady = async (locator, label) => {
  await locator.waitFor({ state: 'visible' })
  assert.equal(await locator.isEnabled(), true, `${label} must be enabled`)
  await locator.click()
}
const skipAnimations = async (page) => {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click()
    await wait(100)
  }
}
const art = (locator) => locator.evaluate((node) => {
  const image = node.querySelector('img')
  return { url: image?.getAttribute('src') ?? null, loaded: Boolean(image?.complete && image.naturalWidth > 0) }
})

const runAttack = async (page, testCase, evidence) => {
  evidence.before = await readState(page)
  const source = page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator('.card-face[title="Pure Vanilla Cookie"]'),
  }).first()
  await source.waitFor({ state: 'visible' })
  evidence.art = await art(source.locator('.card-face').first())
  const ally = evidence.before.bottom.battle.find((entry) => entry.name === 'bs11-070-ally-lv1')
  const target = evidence.before.top.battle[0]
  assert.ok(ally && target)
  await clickReady(source.locator('.card-face.is-attackable'), 'Pure Vanilla BNN attack')
  const attackPanel = page.locator('[data-testid="attack-payment-panel"]')
  await attackPanel.waitFor({ state: 'visible' })
  for (let index = 0; index < 3; index += 1) {
    await clickReady(page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').first(),
      `Pure Vanilla attack payment ${index + 1}`)
  }
  assert.match(await attackPanel.innerText(), /付款合法/)
  await clickReady(page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${target.id}"] .card-face[aria-label^="選擇攻擊目標："]`),
    'Pure Vanilla attack target')
  await waitForCommand(page, 'declare-attack')
  for (let attempt = 0; attempt < 180 && !await visible(page.locator('.optional-cost-attack-inline:visible')); attempt += 1) {
    const response = page.locator('.attack-response-modal:visible').first()
    if (await visible(response)) {
      const decline = response.getByRole('button', { name: '不發動', exact: true }).first()
      if (await visible(decline)) await decline.click()
    }
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click()
    await wait(100)
  }
  await skipAnimations(page)
  const optional = page.locator('.optional-cost-attack-inline:visible').first()
  await optional.waitFor({ state: 'visible' })
  evidence.optionalText = await optional.innerText()
  if (testCase.scenario === 'skip') {
    assert.equal(await optional.getByRole('button', { name: '支付', exact: true }).isEnabled(), false)
    await clickReady(optional.getByRole('button', { name: '略過', exact: true }), 'skip unpaid Pure Vanilla Then')
  } else {
    await clickReady(optional.getByRole('button', { name: '支付', exact: true }), 'pay Pure Vanilla Then')
    await clickReady(optional.locator('.optional-cost-col').filter({ hasText: '能量' })
      .locator('.modal-card-options button:not(.is-selected)').first(), 'Pure Vanilla extra neutral payment')
    await clickReady(optional.locator('.modal-actions-sticky button').last(), 'confirm Pure Vanilla Then payment')
  }
  await waitForCommand(page, 'resolve-optional-cost-attack')
  if (testCase.scenario !== 'skip') {
    const choicePanel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
    await choicePanel.waitFor({ state: 'visible' })
    const modes = choicePanel.locator('.effect-candidates-choice button')
    assert.equal(await modes.count(), 2)
    await clickReady(modes.nth(testCase.scenario === 'top' ? 0 : 1), 'choose Pure Vanilla deck destination')
    await clickReady(choicePanel.locator('.effect-panel-primary-action').last(), 'confirm Pure Vanilla deck destination')
    const targetPanel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
    await targetPanel.waitFor({ state: 'visible' })
    const candidates = targetPanel.locator('.effect-candidates-target button:not(.is-selected)')
    assert.equal(await candidates.count(), 1, 'only the other LV1 ally can be moved')
    await clickReady(candidates.first(), 'select other LV1 ally')
    await clickReady(targetPanel.locator('.effect-panel-primary-action').last(), 'move other ally to deck')
    await waitForCommand(page, 'resolve-ability-effect')
  }
  await skipAnimations(page)
  evidence.after = await readState(page)
  evidence.trace = await trace(page)
  assert.equal(target.hp - evidence.after.top.battle.find((entry) => entry.id === target.id)?.hp, 3)
  assert.equal(evidence.after.bottom.battle.some((entry) => entry.id === ally.id), testCase.scenario === 'skip')
  assert.equal(evidence.after.bottom.deckCount,
    evidence.before.bottom.deckCount + (testCase.scenario === 'skip' ? 0 : 1))
  assert.equal(evidence.after.bottom.discardCount,
    evidence.before.bottom.discardCount + (testCase.scenario === 'skip' ? 0 : ally.hp))
  if (testCase.scenario !== 'skip') {
    assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect'))
  }
  assert.equal(evidence.after.bottom.supports.filter((entry) => entry.rested).length,
    testCase.scenario === 'skip' ? 3 : 4)
}

const runCase = async (page, testCase, evidence) => {
  evidence.before = await readState(page)
  const handEntry = page.locator('.bottom-field .hand-card-wrap').filter({
    has: page.locator('.card-face[title="Pure Vanilla Cookie"]'),
  }).first()
  await handEntry.waitFor({ state: 'visible' })
  evidence.art = await art(handEntry.locator('.card-face').first())
  await clickReady(handEntry.locator('.card-face').first(), 'select Pure Vanilla')
  await clickReady(handEntry.locator('.hand-card-action').filter({ hasText: '登場' }).first(), 'deploy Pure Vanilla')
  await waitForCommand(page, 'deploy-cookie')
  await skipAnimations(page)
  if (testCase.scenario === 'negative') {
    await waitForCommand(page, 'skip-on-play')
    evidence.after = await readState(page)
    evidence.trace = await trace(page)
    assert.equal(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect'), false)
    assert.equal(evidence.after.bottom.handCount, evidence.before.bottom.handCount - 1)
    assert.equal(evidence.after.bottom.deckCount, evidence.before.bottom.deckCount - 4,
      'normal LV2 deployment still places four HP cards')
    assert.equal(evidence.after.bottom.discardCount, evidence.before.bottom.discardCount)
    return
  }
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
  await panel.waitFor({ state: 'visible' })
  evidence.panelText = await panel.innerText()
  const discard = panel.locator('.effect-candidates-discard-hand:visible button:not(.is-selected)')
  assert.equal(await discard.count(), 1, 'exactly the Ancient Cookie in hand must be offered')
  await clickReady(discard.first(), 'discard Ancient Cookie cost')
  for (let step = 0; step < 5; step += 1) {
    const primary = panel.locator('.effect-panel-primary-action:visible').last()
    if (!await visible(primary)) break
    const label = await primary.innerText()
    await clickReady(primary, 'advance Pure Vanilla On Play')
    if (!label.includes('下一步')) break
  }
  await waitForCommand(page, 'resolve-ability-effect')
  const draw = page.locator('.draw-up-to-modal:visible').first()
  await draw.waitFor({ state: 'visible' })
  await clickReady(draw.locator('.draw-up-to-option').nth(2), 'draw two Pure Vanilla cards')
  await clickReady(draw.locator('.draw-up-to-actions button').last(), 'confirm Pure Vanilla draw')
  await waitForCommand(page, 'resolve-draw-up-to')
  await skipAnimations(page)
  evidence.after = await readState(page)
  evidence.trace = await trace(page)
  assert.equal(evidence.after.bottom.handCount, evidence.before.bottom.handCount,
    'deploy one, discard one Ancient, draw two')
  assert.equal(evidence.after.bottom.deckCount, evidence.before.bottom.deckCount - 6,
    'normal LV2 deployment uses four HP cards, then On Play draws two')
  assert.equal(evidence.after.bottom.discardCount, evidence.before.bottom.discardCount + 1)
  assert.ok(evidence.after.bottom.battle.some((entry) => entry.name === 'Pure Vanilla Cookie'))
}

const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
const results = []
try {
  for (const viewport of selectedViewports) {
    for (const testCase of selectedCases) {
      const page = await browser.newPage({ viewport })
      page.setDefaultTimeout(15000)
      const evidence = { id: testCase.id, viewport, status: 'FAIL', errors: [] }
      page.on('pageerror', (error) => evidence.errors.push(error.message))
      const imageUrl = `https://cookierunbraverse.com/data/en_storage/${cards[testCase.cardNumber]}`
      const imagePath = resolve(root, 'test-results/bs11-official-art', `${testCase.cardNumber.replace('@', '-at-')}.webp`)
      const localArt = existsSync(imagePath)
      if (localArt) {
        await page.route(imageUrl, (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) }))
        evidence.officialArtDelivery = 'official CDN bytes served from local test artifact'
      }
      try {
        const url = new URL('/', baseUrl)
        url.searchParams.set('test-state', testCase.scenario === 'positive' || testCase.scenario === 'negative'
          ? `bs11-070-on-play:${testCase.cardNumber}:${testCase.scenario}`
          : `bs11-070-attack:${testCase.cardNumber}:${testCase.scenario}`)
        url.searchParams.set('contract-card', 'BS11-070')
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
        await page.locator('.game-shell').waitFor({ state: 'visible' })
        if (testCase.scenario === 'positive' || testCase.scenario === 'negative') await runCase(page, testCase, evidence)
        else await runAttack(page, testCase, evidence)
        assert.equal(evidence.art.url, imageUrl)
        if (localArt) assert.equal(evidence.art.loaded, true)
        else evidence.officialArtDelivery = evidence.art.loaded ? 'live CDN image loaded' : 'official URL only; image load unverified'
        assert.deepEqual(evidence.errors, [])
        evidence.status = 'PASS'
      } catch (error) {
        evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
        evidence.trace ??= await trace(page).catch(() => [])
        evidence.debug = await page.evaluate(() => ({
          modals: [...document.querySelectorAll('.effect-panel, .draw-up-to-modal')]
            .filter((node) => node.getBoundingClientRect().width > 0).map((node) => node.className),
          buttons: [...document.querySelectorAll('button')]
            .filter((node) => node.getBoundingClientRect().width > 0 && !node.disabled)
            .map((node) => node.textContent?.trim()).filter(Boolean).slice(0, 25),
        })).catch(() => null)
      } finally {
        await page.close()
      }
      results.push(evidence)
      console.log(`${evidence.status} ${testCase.id} ${viewport.width}x${viewport.height}${evidence.error ? ': ' + evidence.error.split('\n')[0] : ''}`)
    }
  }
} finally {
  await browser.close()
}
const artifactPath = resolve(outputDir, `bs11-070-browser-${Date.now()}.json`)
const summary = { total: results.length, passed: results.filter((entry) => entry.status === 'PASS').length }
writeFileSync(artifactPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2) + '\n')
console.log(JSON.stringify({ artifactPath, summary }))
if (summary.passed !== summary.total) process.exitCode = 1
