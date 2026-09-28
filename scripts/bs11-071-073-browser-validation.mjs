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
const outputDir = resolve(root, 'test-results/bs11-071-073-browser')
mkdirSync(outputDir, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-dark-enchantress-war-bs11.en.json'), 'utf8'))
const byNumber = new Map(candidate.cards.map((record) => [record.cardNumber, record]))
const cases = [
  ...['BS11-071', 'BS11-071@1', 'BS11-071@2'].flatMap((cardNumber) => ['positive', 'negative'].map((scenario) => ({ cardNumber, scenario }))),
  ...['positive', 'negative'].map((scenario) => ({ cardNumber: 'BS11-072', scenario })),
  ...['positive', 'negative'].map((scenario) => ({ cardNumber: 'BS11-073', scenario })),
]
const requested = process.env.BS11_BROWSER_CASES?.split(',').map((value) => value.trim()).filter(Boolean)
const selectedCases = requested?.length
  ? cases.filter((testCase) => requested.includes(`${testCase.cardNumber}-${testCase.scenario}`))
  : cases
if (!selectedCases.length) throw new Error('No BS11-071～073 cases selected')
const widths = process.env.BS11_BROWSER_WIDTHS?.split(',').map(Number).filter(Number.isFinite)
const viewports = [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]
const selectedViewports = widths?.length ? viewports.filter((viewport) => widths.includes(viewport.width)) : viewports
if (!selectedViewports.length) throw new Error('No viewport selected')

const visible = async (locator) => await locator.count() > 0 && await locator.first().isVisible().catch(() => false)
const clickReady = async (locator, label) => {
  await locator.waitFor({ state: 'visible' })
  assert.equal(await locator.isEnabled(), true, `${label} must be enabled`)
  await locator.click()
}
const waitForCommand = (page, kind) => page.waitForFunction(
  (commandKind) => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === commandKind), kind,
)
const trace = (page) => page.evaluate(() => (window.__braverseContractTrace ?? []).map((entry) => ({
  commandKind: entry.commandKind,
  steps: Array.isArray(entry.steps) ? entry.steps.map(String) : [],
})))
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
      hand: field?.querySelectorAll('.hand-card-wrap').length ?? 0,
      deck: count('.deck-zone .resource-summary > strong'),
      trash: count('.discard-zone.resource-summary > strong'),
      extra: count('.extra-deck-zone .resource-summary > strong'),
      supports: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map((node) => ({
        name: node.querySelector('.card-face')?.getAttribute('title') ?? node.textContent?.trim(),
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
const art = (locator) => locator.evaluate((node) => {
  const image = node.querySelector('img')
  return { url: image?.getAttribute('src'), loaded: Boolean(image?.complete && image.naturalWidth > 0) }
})

const run071 = async (page, testCase, evidence) => {
  evidence.before = await state(page)
  const source = page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator('.card-face[title="Shadow Milk Cookie"]'),
  }).first()
  evidence.art = await art(source.locator('.card-face').first())
  const target = evidence.before.top.battle[0]
  assert.ok(target)
  await clickReady(source.locator('.card-face.is-attackable'), 'Shadow Milk attack')
  await page.locator('[data-testid="attack-payment-panel"]').waitFor({ state: 'visible' })
  for (let index = 0; index < 3; index += 1) {
    await clickReady(page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').first(),
      `Shadow Milk attack payment ${index + 1}`)
  }
  await clickReady(page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${target.id}"] .card-face[aria-label^="選擇攻擊目標："]`),
    'Shadow Milk target')
  await waitForCommand(page, 'declare-attack')
  for (let attempt = 0; attempt < 180 && !await visible(page.locator('.optional-cost-attack-inline:visible')); attempt += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click()
    await page.waitForTimeout(100)
  }
  await skipAnimations(page)
  const optional = page.locator('.optional-cost-attack-inline:visible').first()
  await optional.waitFor({ state: 'visible' })
  evidence.optionalText = await optional.innerText()
  assert.match(evidence.optionalText, /1 點無色能量.*棄置 1 張手牌/)
  if (testCase.scenario === 'negative') {
    assert.equal(await optional.getByRole('button', { name: '支付', exact: true }).isEnabled(), false)
    await clickReady(optional.getByRole('button', { name: '略過', exact: true }), 'skip unaffordable Then')
  } else {
    await clickReady(optional.getByRole('button', { name: '支付', exact: true }), 'pay Shadow Milk Then')
    await clickReady(optional.locator('.optional-cost-col').filter({ hasText: '能量' })
      .locator('.modal-card-options button').first(), 'pay neutral support')
    await clickReady(optional.locator('.modal-actions-sticky button').last(), 'advance to discard')
    await clickReady(optional.locator('.modal-card-options button').first(), 'discard hand card')
    await clickReady(optional.locator('.modal-actions-sticky button').last(), 'confirm Then cost')
  }
  await waitForCommand(page, 'resolve-optional-cost-attack')
  if (testCase.scenario === 'positive') {
    await skipAnimations(page)
    const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
    await panel.waitFor({ state: 'visible' })
    const unavailable = panel.getByRole('button', { name: /Extra Deck Cookie On Play skill/ })
    assert.equal(await unavailable.isEnabled(), false)
    await clickReady(panel.getByRole('button', { name: /Extra Deck Cookie Activate skill/ }), 'choose EXTRA Activate')
    await clickReady(panel.locator('.effect-panel-primary-action').last(), 'advance EXTRA mode')
    await clickReady(panel.locator('.effect-panel-primary-action').last(), 'resolve EXTRA mode')
    const extra = page.locator('.extra-deck-attack-modal:visible')
    await extra.waitFor({ state: 'visible' })
    assert.match(await extra.innerText(), /必要選擇/)
    await clickReady(extra.locator('.extra-deck-attack-option').first(), 'choose BS9-055 EXTRA')
    await skipAnimations(page)
    await clickReady(page.locator('.effect-panel[role="alertdialog"]:visible .effect-panel-primary-action').last(),
      'resolve BS9-055 Activate')
  }
  await skipAnimations(page)
  evidence.after = await state(page)
  evidence.trace = await trace(page)
  assert.equal(evidence.before.top.battle[0].hp - evidence.after.top.battle[0].hp, 3)
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'declare-attack'))
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-optional-cost-attack'))
  if (testCase.scenario === 'positive') {
    assert.equal(evidence.after.bottom.hand, evidence.before.bottom.hand - 1)
    assert.equal(evidence.after.bottom.trash, evidence.before.bottom.trash + 2)
    assert.equal(evidence.after.bottom.extra, evidence.before.bottom.extra - 1)
    assert.equal(evidence.after.bottom.supports.length, 5)
    assert.ok(evidence.after.bottom.supports.at(-1)?.name?.includes('bs11-071-extra-skill-deck-top'))
    assert.equal(evidence.after.bottom.supports.at(-1)?.rested, true)
  } else {
    assert.equal(evidence.after.bottom.hand, evidence.before.bottom.hand)
    assert.equal(evidence.after.bottom.extra, evidence.before.bottom.extra)
    assert.equal(evidence.after.bottom.supports.length, 3)
  }
}

const run072 = async (page, testCase, evidence) => {
  evidence.before = await state(page)
  const source = page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator('.card-face[title="Dark Choco Cookie"]'),
  }).first()
  evidence.art = await art(source.locator('.card-face').first())
  const target = evidence.before.top.battle[0]
  assert.ok(target)
  assert.equal(evidence.before.bottom.trash, testCase.scenario === 'positive' ? 15 : 14)
  const skill = source.locator('.skill-action').filter({ hasText: '啟動技能' }).first()
  if (testCase.scenario === 'negative' && (!await visible(skill) || !await skill.isEnabled())) {
    evidence.after = await state(page)
    evidence.trace = await trace(page)
    assert.equal(evidence.trace.some((entry) => entry.commandKind === 'begin-activate-skill'), false)
    assert.equal(evidence.after.top.battle[0].hp, target.hp)
    return
  }
  await clickReady(skill, 'Dark Choco Activate')
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
  await panel.waitFor({ state: 'visible' })
  evidence.skillPanel = await panel.innerText()
  const payment = panel.locator('.effect-candidates-payment:visible button:not(.is-selected)')
  assert.ok(await payment.count() > 0)
  await clickReady(payment.first(), 'Dark Choco purple payment')
  await clickReady(panel.locator('.effect-panel-primary-action').last(), 'advance Dark Choco target')
  const targetChoice = panel.locator('.effect-candidates-target:visible button:not(.is-selected)').first()
  if (await visible(targetChoice)) await clickReady(targetChoice, 'select Dark Choco target')
  for (let attempt = 0; attempt < 4 && await visible(panel); attempt += 1) {
    const primary = panel.locator('.effect-panel-primary-action').last()
    if (!await primary.isEnabled()) break
    await clickReady(primary, 'resolve Dark Choco skill')
    if (await page.evaluate(() => (window.__braverseContractTrace ?? [])
      .some((entry) => entry.commandKind === 'resolve-ability-effect'))) break
  }
  await skipAnimations(page)
  evidence.after = await state(page)
  evidence.trace = await trace(page)
  if (testCase.scenario === 'positive') {
    assert.equal(target.hp - evidence.after.top.battle[0].hp, 1)
    assert.equal(evidence.after.bottom.supports.filter((entry) => entry.rested).length -
      evidence.before.bottom.supports.filter((entry) => entry.rested).length, 1)
    assert.ok(evidence.trace.some((entry) => entry.commandKind === 'begin-activate-skill'))
    assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect'))
  } else {
    assert.equal(evidence.after.top.battle[0].hp, target.hp)
    assert.equal(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect'), false)
  }
}

const run073 = async (page, testCase, evidence) => {
  evidence.before = await state(page)
  const source = page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator('.card-face[title="Marble Danish Cookie"]'),
  }).first()
  evidence.art = await art(source.locator('.card-face').first())
  const target = evidence.before.top.battle[0]
  assert.ok(target)
  const attack = source.locator('.card-face.is-attackable').first()
  if (testCase.scenario === 'negative') {
    assert.ok(!await visible(attack) || !await attack.isEnabled(), 'two supports cannot pay three neutral energy')
    evidence.after = await state(page)
    evidence.trace = await trace(page)
    assert.equal(evidence.trace.some((entry) => entry.commandKind === 'declare-attack'), false)
    assert.deepEqual(evidence.after, evidence.before)
    return
  }
  await clickReady(attack, 'Marble Danish attack')
  await page.locator('[data-testid="attack-payment-panel"]').waitFor({ state: 'visible' })
  for (let index = 0; index < 3; index += 1) {
    await clickReady(page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').first(),
      `Marble Danish neutral payment ${index + 1}`)
  }
  await clickReady(page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${target.id}"] .card-face[aria-label^="選擇攻擊目標："]`),
    'Marble Danish target')
  await waitForCommand(page, 'declare-attack')
  await skipAnimations(page)
  evidence.after = await state(page)
  evidence.trace = await trace(page)
  assert.equal(target.hp - evidence.after.top.battle[0].hp, 4)
  assert.equal(evidence.after.bottom.supports.filter((entry) => entry.rested).length, 3)
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'declare-attack'))
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
      const imagePath = resolve(root, 'test-results/bs11-official-art', `${testCase.cardNumber.replace('@', '-at-')}.webp`)
      const localArt = imageUrl && existsSync(imagePath)
      if (localArt) {
        await page.route(imageUrl, (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) }))
        evidence.officialArtDelivery = 'official CDN bytes served from local test artifact'
      }
      try {
        const url = new URL('/', baseUrl)
        url.searchParams.set('test-state', testCase.cardNumber.startsWith('BS11-071')
          ? `bs11-071-attack:${testCase.cardNumber}:${testCase.scenario}`
          : testCase.cardNumber === 'BS11-072'
            ? `bs11-072-skill:${testCase.scenario}`
            : `bs11-073-attack:${testCase.scenario}`)
        url.searchParams.set('contract-card', testCase.cardNumber.split('@')[0])
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
        await page.locator('.bottom-field .combat-card-wrap').first().waitFor({ state: 'visible' })
        if (testCase.cardNumber.startsWith('BS11-071')) await run071(page, testCase, evidence)
        else if (testCase.cardNumber === 'BS11-072') await run072(page, testCase, evidence)
        else await run073(page, testCase, evidence)
        assert.equal(evidence.art.url, imageUrl)
        if (localArt) assert.equal(evidence.art.loaded, true)
        assert.deepEqual(evidence.errors, [])
        evidence.status = 'PASS'
      } catch (error) {
        evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
        evidence.trace ??= await trace(page).catch(() => [])
        evidence.debug = await page.evaluate(() => ({
          modals: [...document.querySelectorAll('.effect-panel, .extra-deck-attack-modal')]
            .filter((node) => node.getBoundingClientRect().width > 0).map((node) => node.textContent?.trim().slice(0, 300)),
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
const artifactPath = resolve(outputDir, `bs11-071-073-browser-${Date.now()}.json`)
const summary = { total: results.length, passed: results.filter((entry) => entry.status === 'PASS').length }
writeFileSync(artifactPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2) + '\n')
console.log(JSON.stringify({ artifactPath, summary }))
if (summary.passed !== summary.total) process.exitCode = 1
