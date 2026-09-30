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
const outputDir = resolve(root, 'test-results/bs11-067-068-browser')
mkdirSync(outputDir, { recursive: true })
const records = {
  'BS11-067': { name: 'Black Raisin Cookie', image: 'O0rvY1l3l-5KUrK6rSctNg.webp' },
  'BS11-067@1': { name: 'Black Raisin Cookie', image: 'HIi-p2c23fh3emDZ5dwwQg.webp' },
  'BS11-068': { name: 'Black Sapphire Cookie', image: 'KMrnyr3w6OwXGWc2eSdV-Q.webp' },
  'BS11-068@1': { name: 'Black Sapphire Cookie', image: 'llEsSq8qJYaSXwHHpOYVpQ.webp' },
}
const executablePath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
const viewports = [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]
const cases = Object.keys(records).flatMap((cardNumber) => ['positive', 'negative'].map((scenario) => ({
  id: `${cardNumber}-${scenario}`,
  cardNumber,
  scenario,
  route: `bs11-${cardNumber.slice(5, 8)}-${cardNumber.startsWith('BS11-067') ? 'attack' : 'faint'}:${cardNumber}:${scenario}`,
})))
const requested = process.env.BS11_BROWSER_CASES?.split(',').map((part) => part.trim()).filter(Boolean)
const selectedCases = requested?.length ? cases.filter((testCase) => requested.includes(testCase.id)) : cases
if (!selectedCases.length || requested?.some((id) => !cases.some((testCase) => testCase.id === id))) {
  throw new Error('Unknown or empty BS11_BROWSER_CASES selection')
}
const widths = process.env.BS11_BROWSER_WIDTHS?.split(',').map(Number).filter(Number.isFinite)
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
    const field = document.querySelector('.' + name + '-field')
    const count = (selector) => Number(field?.querySelector(selector)?.textContent?.match(/\d+/)?.[0] ?? NaN)
    return {
      handCount: field?.querySelectorAll('.hand-card-wrap').length ?? 0,
      deckCount: count('.deck-zone .resource-summary > strong'),
      discardCount: count('.discard-zone.resource-summary > strong'),
      breakCount: count('.break-zone.resource-summary > strong'),
      supports: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map((node) => ({
        id: node.getAttribute('data-card-instance-id'),
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
const waitForPostAttack = async (page) => {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (await visible(page.locator('.optional-cost-attack-inline:visible'))) return
    const response = page.locator('.attack-response-modal:visible').first()
    if (await visible(response)) {
      const decline = response.getByRole('button', { name: '不發動', exact: true }).first()
      if (await visible(decline)) await decline.click()
    }
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click()
    await wait(100)
  }
  throw new Error('BS11-067 did not reach its optional attack Then')
}
const art = (locator) => locator.evaluate((node) => {
  const image = node.querySelector('img')
  return { url: image?.getAttribute('src') ?? null, alt: image?.getAttribute('alt') ?? null,
    loaded: Boolean(image?.complete && image.naturalWidth > 0) }
})

const run067 = async (page, testCase, evidence) => {
  const source = page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator('.card-face[title="Black Raisin Cookie"]'),
  }).first()
  await source.waitFor({ state: 'visible' })
  evidence.art = await art(source.locator('.card-face').first())
  evidence.before = await readState(page)
  const sourceId = await source.getAttribute('data-card-instance-id')
  const target = evidence.before.top.battle[0]
  assert.ok(target)
  await clickReady(source.locator('.card-face.is-attackable'), 'Black Raisin attack')
  const payment = page.locator('[data-testid="attack-payment-panel"]')
  await payment.waitFor({ state: 'visible' })
  for (let index = 0; index < 2; index += 1) {
    await clickReady(page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').first(),
      `Black Raisin attack blue payment ${index + 1}`)
  }
  assert.match(await payment.innerText(), /付款合法/)
  await clickReady(page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${target.id}"] .card-face[aria-label^="選擇攻擊目標："]`),
    'Black Raisin attack target')
  await waitForCommand(page, 'declare-attack')
  await waitForPostAttack(page)
  await skipAnimations(page)
  const optional = page.locator('.optional-cost-attack-inline:visible').first()
  evidence.optionalText = await optional.innerText()
  assert.match(evidence.optionalText, /支付|藍色|能量/)
  if (testCase.scenario === 'positive') {
    await clickReady(optional.getByRole('button', { name: '支付', exact: true }), 'pay Black Raisin Then')
    const blue = optional.locator('.optional-cost-col').filter({ hasText: '能量' })
      .locator('.modal-card-options button:not(.is-selected)').first()
    await clickReady(blue, 'Black Raisin third blue payment')
    for (let step = 0; step < 5 && await visible(optional); step += 1) {
      const primary = optional.locator('.modal-actions-sticky button').last()
      const label = await primary.innerText()
      await clickReady(primary, 'advance Black Raisin Then')
      if (label === '確認') break
    }
    await waitForCommand(page, 'resolve-optional-cost-attack')
    const hand = page.locator('.hand-discard-modal:visible').first()
    await hand.waitFor({ state: 'visible' })
    assert.match(await hand.innerText(), /牌庫頂/)
    await clickReady(hand.locator('.hand-discard-options button').first(), 'select hand card for deck top')
    await clickReady(hand.locator('.hand-discard-actions button').last(), 'confirm hand card deck top')
    await waitForCommand(page, 'resolve-opponent-hand-discard')
  } else {
    const pay = optional.getByRole('button', { name: '支付', exact: true })
    assert.equal(await pay.isEnabled(), false, 'the two attack supports cannot also pay 1B Then')
    await clickReady(optional.getByRole('button', { name: '略過', exact: true }), 'skip unaffordable Then')
    await waitForCommand(page, 'resolve-optional-cost-attack')
  }
  await skipAnimations(page)
  evidence.after = await readState(page)
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'declare-attack'))
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-optional-cost-attack'))
  assert.equal(evidence.before.top.battle.find((entry) => entry.id === target.id)?.hp -
    evidence.after.top.battle.find((entry) => entry.id === target.id)?.hp, 2)
  if (testCase.scenario === 'positive') {
    assert.equal(evidence.after.bottom.battle.some((entry) => entry.id === sourceId), false)
    assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-opponent-hand-discard'))
    assert.equal(evidence.after.bottom.deckCount, evidence.before.bottom.deckCount + 1,
      'source to bottom, one draw, and one hand card to top increase the deck by one')
    assert.equal(evidence.after.bottom.handCount, evidence.before.bottom.handCount,
      'the one drawn card replaces the hand card placed on deck top')
  } else {
    assert.equal(evidence.after.bottom.battle.some((entry) => entry.id === sourceId), true)
    assert.equal(evidence.after.bottom.deckCount, evidence.before.bottom.deckCount)
    assert.equal(evidence.after.bottom.handCount, evidence.before.bottom.handCount)
  }
  assert.equal(evidence.after.bottom.supports.filter((support) => support.rested).length,
    testCase.scenario === 'positive' ? 3 : 2)
}

const run068 = async (page, testCase, evidence) => {
  const modal = page.locator('.faint-response-modal:visible').first()
  await modal.waitFor({ state: 'visible' })
  evidence.art = await art(modal.locator('.faint-effect-card-detail .card-face').first())
  evidence.before = await readState(page)
  evidence.modalText = await modal.innerText()
  assert.match(evidence.modalText, /Black Sapphire Cookie/)
  const target = evidence.before.top.battle[0]
  assert.ok(target && target.hp === 2)
  if (testCase.scenario === 'positive') {
    await clickReady(modal.locator('.faint-payment-candidates button:not(.is-selected)').first(), 'Black Sapphire blue payment')
    await clickReady(modal.locator('.faint-card-candidates button:not(.is-selected)').first(), 'Black Sapphire opponent target')
    await clickReady(modal.locator('.modal-actions button').last(), 'resolve Black Sapphire faint effect')
    await waitForCommand(page, 'resolve-faint-effect')
  } else {
    assert.equal(await modal.locator('.faint-payment-candidates button').count(), 0)
    assert.equal(await modal.locator('.modal-actions button').last().isEnabled(), false)
    await clickReady(modal.locator('.modal-actions button').first(), 'skip unaffordable Black Sapphire faint effect')
    await waitForCommand(page, 'resolve-faint-effect')
  }
  await skipAnimations(page)
  evidence.after = await readState(page)
  evidence.trace = await trace(page)
  const hpAfter = evidence.after.top.battle.find((entry) => entry.id === target.id)?.hp
  assert.equal(hpAfter, testCase.scenario === 'positive' ? 1 : 2)
  assert.equal(evidence.after.top.deckCount, evidence.before.top.deckCount + (testCase.scenario === 'positive' ? 1 : 0))
  assert.equal(evidence.after.bottom.supports[0]?.rested, true)
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
      const record = records[testCase.cardNumber]
      const imagePath = resolve(root, 'test-results/bs11-official-art', `${testCase.cardNumber.replace('@', '-at-')}.webp`)
      const imageUrl = `https://cookierunbraverse.com/data/en_storage/${record.image}`
      const localArt = existsSync(imagePath)
      if (localArt) {
        await page.route(imageUrl, (route) => route.fulfill({
          status: 200, contentType: 'image/webp', body: readFileSync(imagePath),
        }))
        evidence.officialArtDelivery = 'official CDN bytes served from local test artifact'
      }
      try {
        const url = new URL('/', baseUrl)
        url.searchParams.set('test-state', testCase.route)
        url.searchParams.set('contract-card', testCase.cardNumber.split('@')[0])
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
        await page.locator('.game-shell').waitFor({ state: 'visible' })
        if (testCase.cardNumber.startsWith('BS11-067')) await run067(page, testCase, evidence)
        else await run068(page, testCase, evidence)
        assert.equal(evidence.art.url, imageUrl)
        if (localArt) assert.equal(evidence.art.loaded, true)
        else evidence.officialArtDelivery = evidence.art.loaded ? 'live CDN image loaded' : 'official URL only; image load unverified'
        assert.deepEqual(evidence.errors, [])
        evidence.status = 'PASS'
      } catch (error) {
        evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
        evidence.trace ??= await trace(page).catch(() => [])
        evidence.debug = await page.evaluate(() => ({
          modals: [...document.querySelectorAll('.faint-response-modal, .optional-cost-attack-inline, .hand-discard-modal, .attack-response-modal')]
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
const artifactPath = resolve(outputDir, `bs11-067-068-browser-${Date.now()}.json`)
const summary = { total: results.length, passed: results.filter((entry) => entry.status === 'PASS').length }
writeFileSync(artifactPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2) + '\n')
console.log(JSON.stringify({ artifactPath, summary }))
if (summary.passed !== summary.total) process.exitCode = 1
