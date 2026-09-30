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
const outputDir = resolve(root, 'test-results/bs11-010-browser')
mkdirSync(outputDir, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-dark-enchantress-war-bs11.en.json'), 'utf8'))
const byNumber = new Map(candidate.cards.map((record) => [record.cardNumber, record]))
const cases = ['BS11-010', 'BS11-010@1'].flatMap((cardNumber) =>
  ['positive', 'negative'].map((scenario) => ({ cardNumber, scenario })))
const requested = process.env.BS11_BROWSER_CASES?.split(',').map((value) => value.trim()).filter(Boolean)
const selectedCases = requested?.length ? cases.filter((entry) => requested.includes(`${entry.cardNumber}-${entry.scenario}`)) : cases
const widths = process.env.BS11_BROWSER_WIDTHS?.split(',').map(Number).filter(Number.isFinite)
const viewports = [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]
const selectedViewports = widths?.length ? viewports.filter((entry) => widths.includes(entry.width)) : viewports
if (!selectedCases.length || !selectedViewports.length) throw new Error('No BS11-010 case selected')

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
      })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const art = (locator) => locator.evaluate((node) => {
  const image = node.querySelector('img')
  return { url: image?.getAttribute('src'), loaded: Boolean(image?.complete && image.naturalWidth > 0) }
})
const settle = async (page) => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click()
    const response = page.locator('.attack-response-modal:visible').first()
    if (await visible(response)) {
      const decline = response.getByRole('button', { name: '不發動', exact: true }).first()
      if (await visible(decline)) await decline.click()
    }
    const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
    if (await visible(panel)) {
      const primary = panel.locator('.effect-panel-primary-action:visible').last()
      if (await visible(primary) && await primary.isEnabled()) await primary.click()
    }
    const confirm = page.getByRole('button', { name: '確認並繼續', exact: true }).first()
    if (await visible(confirm)) await confirm.click()
    if (await page.locator('.next-phase-button').isEnabled().catch(() => false) &&
      !await visible(page.locator('.trap-response-modal:visible')) &&
      !await visible(page.locator('.effect-panel:visible'))) return
    await page.waitForTimeout(100)
  }
  throw new Error('BS11-010 attack did not settle')
}

const runCase = async (page, testCase, evidence) => {
  evidence.before = await state(page)
  const name = "Flame's Protection"
  const card = page.locator('.bottom-field .hand-card-wrap').filter({
    has: page.locator(`.card-face[title="${name}"]`),
  }).first()
  await card.waitFor({ state: 'visible' })
  evidence.art = await art(card.locator('.card-face').first())
  const trap = page.locator('.trap-response-modal[role="alertdialog"]:visible').first()
  const chooser = page.locator('.attack-response-modal:visible').first()
  for (let attempt = 0; attempt < 100 && !await visible(trap); attempt += 1) {
    if (await visible(chooser)) {
      const option = chooser.locator('.modal-card-options button').filter({ hasText: name }).first()
      if (await visible(option)) await option.click()
    }
    await page.waitForTimeout(100)
  }
  await trap.waitFor({ state: 'visible' })
  evidence.trapText = await trap.innerText()
  const initialOption = trap.locator('.modal-card-options button').filter({ hasText: name }).first()
  if (await visible(initialOption)) await clickReady(initialOption, 'choose Flame Protection')
  const payment = trap.locator('.trap-guided-section').filter({ hasText: '能量支付' })
    .locator('.modal-card-options button:not(.is-selected)').first()
  await clickReady(payment, 'Flame Protection red payment')
  const next = trap.getByRole('button', { name: '下一步', exact: true }).first()
  if (await visible(next)) await clickReady(next, 'Flame Protection target step')
  await clickReady(trap.locator('.trap-target-options button.is-attacker').first(), 'Flame Protection attacker target')
  for (let step = 0; step < 6; step += 1) {
    const nextStep = trap.getByRole('button', { name: '下一步', exact: true }).first()
    if (await visible(nextStep)) {
      await clickReady(nextStep, 'Flame Protection next step')
      continue
    }
    await clickReady(trap.getByRole('button', { name: '確認發動', exact: true }).last(), 'Flame Protection confirm')
    break
  }
  await waitForCommand(page, 'play-trap')
  const optional = page.locator('.effect-panel[role="alertdialog"]:visible').filter({ hasText: 'Then 可選效果' }).last()
  for (let attempt = 0; attempt < 40 && !await visible(optional); attempt += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click({ timeout: 1000 }).catch(() => {})
    const segment = page.locator('.effect-panel[role="alertdialog"]:visible').last()
    if (await visible(segment)) {
      const primary = segment.locator('.effect-panel-primary-action:visible').last()
      if (await visible(primary) && await primary.isEnabled()) await clickReady(primary, 'continue Trap Then segment')
    }
    await page.waitForTimeout(100)
  }
  await optional.waitFor({ state: 'visible' })
  evidence.optionalText = await optional.innerText()
  await clickReady(optional.getByRole('button', { name: '支付', exact: true }), 'pay optional neutral energy')
  const neutral = optional.locator('.optional-cost-col').filter({ hasText: '能量' })
    .locator('.modal-card-options button').filter({ hasText: 'bs11-010-neutral-payment' }).first()
  await clickReady(neutral, 'select neutral support')
  for (let step = 0; step < 5 && await visible(optional); step += 1) {
    const target = optional.locator('.optional-cost-col').filter({ hasText: '目標' })
      .locator('.modal-card-options button:not(.is-selected)').first()
    if (await visible(target)) await clickReady(target, 'second independent opponent target')
    const nextStep = optional.getByRole('button', { name: '下一步', exact: true }).first()
    if (await visible(nextStep)) await clickReady(nextStep, 'optional Then next step')
    else await clickReady(optional.getByRole('button', { name: '確認', exact: true }).last(), 'confirm optional Then')
    await page.waitForTimeout(150)
  }
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const targetPanel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
    const target = targetPanel.locator('.effect-candidates-target:visible button:not(.is-selected)')
      .filter({ hasText: 'opp-lv3' }).first()
    if (await visible(target)) {
      await clickReady(target, 'Flame Protection second damage target')
      await clickReady(targetPanel.locator('.effect-panel-primary-action:visible').last(), 'resolve second damage')
      break
    }
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click({ timeout: 1000 }).catch(() => {})
    await page.waitForTimeout(100)
  }
  await settle(page)
  evidence.after = await state(page)
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'play-trap' &&
    entry.steps.some((step) => step.includes('bs11-010-red-payment'))))
  assert.equal(evidence.before.bottom.battle[0].hp - evidence.after.bottom.battle[0].hp, 5)
  assert.equal(evidence.before.top.battle[0].hp, evidence.after.top.battle[0].hp)
  assert.equal(evidence.before.top.battle[1].hp - evidence.after.top.battle[1].hp,
    testCase.scenario === 'positive' ? 1 : 0)
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-optional-cost-attack' &&
    entry.steps.some((step) => step.includes('bs11-010-neutral-payment'))))
  if (testCase.scenario === 'negative') {
    assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-optional-cost-attack' &&
      entry.steps.some((step) => step.includes('條件不成立，效果未執行'))))
  } else {
    assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect' &&
      entry.steps.some((step) => step.includes('opp-lv3'))))
  }
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'play-trap'))
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
      if (imageUrl && existsSync(imagePath)) {
        await page.route(imageUrl, (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) }))
        evidence.officialArtDelivery = 'official CDN bytes served from local test artifact'
      }
      try {
        const url = new URL('/', baseUrl)
        url.searchParams.set('test-state', `bs11-010-trap:${testCase.cardNumber}:${testCase.scenario}`)
        url.searchParams.set('contract-card', 'BS11-010')
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
        await page.locator('.game-shell').waitFor({ state: 'visible' })
        await runCase(page, testCase, evidence)
        assert.equal(evidence.art.url, imageUrl)
        if (existsSync(imagePath)) assert.equal(evidence.art.loaded, true)
        assert.deepEqual(evidence.errors, [])
        evidence.status = 'PASS'
      } catch (error) {
        evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
        evidence.trace ??= await trace(page).catch(() => [])
        evidence.debug = await page.evaluate(() => ({
          modals: [...document.querySelectorAll('.effect-panel, .trap-response-modal, .attack-response-modal')]
            .filter((node) => node.getBoundingClientRect().width > 0).map((node) => `${node.className}: ${node.textContent?.trim().slice(0, 700)}`),
          dialogs: [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')]
            .filter((node) => node.getBoundingClientRect().width > 0).map((node) => node.textContent?.trim().slice(0, 800)),
          buttons: [...document.querySelectorAll('button')].filter((node) => node.getBoundingClientRect().width > 0)
            .map((node) => node.textContent?.trim()).filter(Boolean).slice(-25),
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
const artifactPath = resolve(outputDir, `bs11-010-browser-${Date.now()}.json`)
const summary = { total: results.length, passed: results.filter((entry) => entry.status === 'PASS').length }
writeFileSync(artifactPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2) + '\n')
console.log(JSON.stringify({ artifactPath, summary }))
if (summary.passed !== summary.total) process.exitCode = 1
