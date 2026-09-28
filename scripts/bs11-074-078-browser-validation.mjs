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
const executablePath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'
const outputDir = resolve(root, 'test-results/bs11-074-078-browser')
mkdirSync(outputDir, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-dark-enchantress-war-bs11.en.json'), 'utf8'))
const byNumber = new Map(candidate.cards.map((record) => [record.cardNumber, record]))
const cases = ['BS11-074', 'BS11-077', 'BS11-078'].flatMap((cardNumber) =>
  ['positive', 'negative'].map((scenario) => ({ cardNumber, scenario })))
const requested = process.env.BS11_BROWSER_CASES?.split(',').map((value) => value.trim()).filter(Boolean)
const selectedCases = requested?.length ? cases.filter((entry) => requested.includes(`${entry.cardNumber}-${entry.scenario}`)) : cases
if (!selectedCases.length) throw new Error('No BS11-074～078 cases selected')
const widths = process.env.BS11_BROWSER_WIDTHS?.split(',').map(Number).filter(Number.isFinite)
const viewports = [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]
const selectedViewports = widths?.length ? viewports.filter((entry) => widths.includes(entry.width)) : viewports
if (!selectedViewports.length) throw new Error('No viewport selected')

const visible = async (locator) => await locator.count() > 0 && await locator.first().isVisible().catch(() => false)
const clickReady = async (locator, label) => {
  await locator.waitFor({ state: 'visible' })
  assert.equal(await locator.isEnabled(), true, `${label} must be enabled`)
  await locator.click()
}
const trace = (page) => page.evaluate(() => (window.__braverseContractTrace ?? []).map((entry) => ({
  commandKind: entry.commandKind,
  steps: Array.isArray(entry.steps) ? entry.steps.map(String) : [],
})))
const waitForCommand = (page, kind) => page.waitForFunction(
  (commandKind) => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === commandKind), kind,
)
const skipAnimations = async (page) => {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click()
    await page.waitForTimeout(100)
  }
}
const state = (page) => page.evaluate(() => {
  const side = (name) => {
    const field = document.querySelector(`.${name}-field`)
    const count = (selector) => Number(field?.querySelector(selector)?.textContent?.match(/\d+/)?.[0] ?? NaN)
    return {
      trash: count('.discard-zone.resource-summary > strong'),
      supports: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map((node) => ({
        rested: Boolean(node.querySelector('.card-face.is-rested')),
      })),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map((node) => ({
        id: node.getAttribute('data-card-instance-id'),
        name: node.querySelector('.card-face')?.getAttribute('title'),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
        attack: Number(node.querySelector('.badge-atk')?.textContent?.match(/\d+/)?.[0] ?? NaN),
      })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const art = (locator) => locator.evaluate((node) => {
  const image = node.querySelector('img')
  return { url: image?.getAttribute('src'), loaded: Boolean(image?.complete && image.naturalWidth > 0) }
})
const attack = async (page, name, paymentCount, evidence) => {
  const source = page.locator('.bottom-field .combat-card-wrap').filter({ has: page.locator(`.card-face[title="${name}"]`) }).first()
  const target = evidence.before.top.battle[0]
  assert.ok(target)
  await clickReady(source.locator('.card-face.is-attackable'), `${name} attack`)
  await page.locator('[data-testid="attack-payment-panel"]').waitFor({ state: 'visible' })
  for (let index = 0; index < paymentCount; index += 1) {
    await clickReady(page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').first(),
      `${name} payment ${index + 1}`)
  }
  await clickReady(page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${target.id}"] .card-face[aria-label^="選擇攻擊目標："]`),
    `${name} target`)
  await waitForCommand(page, 'declare-attack')
}
const run074 = async (page, testCase, evidence) => {
  evidence.before = await state(page)
  const source = page.locator('.bottom-field .combat-card-wrap').filter({ has: page.locator('.card-face[title="Chocolate Bark Cookie"]') }).first()
  evidence.art = await art(source.locator('.card-face').first())
  if (testCase.scenario === 'negative') {
    const offered = source.locator('.card-face.is-attackable')
    assert.ok(!await visible(offered) || !await offered.isEnabled())
    evidence.after = await state(page)
    evidence.trace = await trace(page)
    assert.deepEqual(evidence.after, evidence.before)
    assert.equal(evidence.trace.some((entry) => entry.commandKind === 'declare-attack'), false)
    return
  }
  await attack(page, 'Chocolate Bark Cookie', 1, evidence)
  await skipAnimations(page)
  evidence.after = await state(page)
  evidence.trace = await trace(page)
  assert.equal(evidence.before.top.battle[0].hp - evidence.after.top.battle[0].hp, 1)
  assert.equal(evidence.after.bottom.supports.filter((entry) => entry.rested).length, 1)
}
const run077 = async (page, testCase, evidence) => {
  evidence.before = await state(page)
  const helmet = page.locator('.bottom-field .combat-card-wrap').filter({ has: page.locator('.card-face[title="Dark Spirit Helmet"]') }).first()
  evidence.art = await art(helmet.locator('.card-face').first())
  assert.equal(evidence.before.bottom.trash, testCase.scenario === 'positive' ? 15 : 14)
  assert.equal(evidence.before.bottom.battle.find((entry) => entry.name === 'Dark Choco Cookie')?.attack,
    testCase.scenario === 'positive' ? 4 : 3)
  await attack(page, 'Dark Choco Cookie', 4, evidence)
  await skipAnimations(page)
  evidence.after = await state(page)
  evidence.trace = await trace(page)
  assert.equal(evidence.before.top.battle[0].hp - evidence.after.top.battle[0].hp,
    testCase.scenario === 'positive' ? 4 : 3)
  assert.equal(evidence.after.bottom.supports.filter((entry) => entry.rested).length, 4)
  assert.equal(evidence.after.bottom.battle.find((entry) => entry.name === 'Dark Spirit Helmet')?.hp, 2)
}
const run078 = async (page, testCase, evidence) => {
  evidence.before = await state(page)
  const source = page.locator('.bottom-field .combat-card-wrap').filter({ has: page.locator('.card-face[title="Caramel Arrow Cookie"]') }).first()
  evidence.art = await art(source.locator('.card-face').first())
  assert.equal(evidence.before.bottom.trash, testCase.scenario === 'positive' ? 15 : 14)
  await attack(page, 'Caramel Arrow Cookie', 3, evidence)
  for (let attempt = 0; attempt < 160 && !await visible(page.locator('.optional-cost-attack-inline:visible')); attempt += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click()
    await page.waitForTimeout(100)
  }
  await skipAnimations(page)
  const optional = page.locator('.optional-cost-attack-inline:visible').first()
  if (testCase.scenario === 'positive') {
    await optional.waitFor({ state: 'visible' })
    evidence.optionalText = await optional.innerText()
    assert.match(evidence.optionalText, /紫色能量|紫色|1 點/)
    await clickReady(optional.getByRole('button', { name: '支付', exact: true }), 'pay Caramel Arrow Then')
    await clickReady(optional.locator('.optional-cost-col').filter({ hasText: '能量' })
      .locator('.modal-card-options button').first(), 'pay purple Then')
    await clickReady(optional.locator('.modal-actions-sticky button').last(), 'advance Caramel Arrow target')
    const target = optional.locator('.modal-card-options button').first()
    if (await visible(target)) await clickReady(target, 'select Caramel Arrow Then target')
    await clickReady(optional.locator('.modal-actions-sticky button').last(), 'confirm Caramel Arrow Then')
    await waitForCommand(page, 'resolve-optional-cost-attack')
  } else {
    assert.equal(await visible(optional), false, '14 cards in trash must not offer Then cost')
  }
  await skipAnimations(page)
  evidence.after = await state(page)
  evidence.trace = await trace(page)
  assert.equal(evidence.before.top.battle[0].hp - evidence.after.top.battle[0].hp,
    testCase.scenario === 'positive' ? 4 : 3)
  assert.equal(evidence.after.bottom.supports.filter((entry) => entry.rested).length,
    testCase.scenario === 'positive' ? 4 : 3)
  if (testCase.scenario === 'positive') {
    assert.equal(evidence.after.top.trash, evidence.before.top.trash + 4)
  }
}

const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
const results = []
try {
  for (const viewport of selectedViewports) {
    for (const testCase of selectedCases) {
      const page = await browser.newPage({ viewport })
      page.setDefaultTimeout(15000)
      const evidence = { id: `${testCase.cardNumber}-${testCase.scenario}`, viewport, status: 'FAIL', errors: [] }
      page.on('pageerror', (error) => evidence.errors.push(error.message))
      const imageUrl = byNumber.get(testCase.cardNumber)?.imageUrl
      const imagePath = resolve(root, 'test-results/bs11-official-art', `${testCase.cardNumber}.webp`)
      const localArt = imageUrl && existsSync(imagePath)
      if (localArt) {
        await page.route(imageUrl, (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) }))
        evidence.officialArtDelivery = 'official CDN bytes served from local test artifact'
      }
      try {
        const url = new URL('/', baseUrl)
        url.searchParams.set('test-state', testCase.cardNumber === 'BS11-074'
          ? `bs11-074-attack:${testCase.scenario}`
          : testCase.cardNumber === 'BS11-077'
            ? `bs11-077-aura:${testCase.scenario}`
            : `bs11-078-attack:${testCase.scenario}`)
        url.searchParams.set('contract-card', testCase.cardNumber === 'BS11-077' ? 'BS11-072' : testCase.cardNumber)
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
        await page.locator('.bottom-field .combat-card-wrap').first().waitFor({ state: 'visible' })
        if (testCase.cardNumber === 'BS11-074') await run074(page, testCase, evidence)
        else if (testCase.cardNumber === 'BS11-077') await run077(page, testCase, evidence)
        else await run078(page, testCase, evidence)
        assert.equal(evidence.art.url, imageUrl)
        if (localArt) assert.equal(evidence.art.loaded, true)
        assert.deepEqual(evidence.errors, [])
        evidence.status = 'PASS'
      } catch (error) {
        evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
        evidence.trace ??= await trace(page).catch(() => [])
        evidence.debug = await page.evaluate(() => ({
          modals: [...document.querySelectorAll('.effect-panel, .optional-cost-attack-inline')]
            .filter((node) => node.getBoundingClientRect().width > 0).map((node) => node.textContent?.trim().slice(0, 400)),
          message: document.querySelector('.status-toast')?.textContent,
        })).catch(() => null)
      } finally {
        await page.close()
      }
      results.push(evidence)
      console.log(`${evidence.status} ${evidence.id} ${viewport.width}x${viewport.height}${evidence.error ? ': ' + evidence.error.split('\n')[0] : ''}`)
    }
  }
} finally {
  await browser.close()
}
const artifactPath = resolve(outputDir, `bs11-074-078-browser-${Date.now()}.json`)
const summary = { total: results.length, passed: results.filter((entry) => entry.status === 'PASS').length }
writeFileSync(artifactPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2) + '\n')
console.log(JSON.stringify({ artifactPath, summary }))
if (summary.passed !== summary.total) process.exitCode = 1
