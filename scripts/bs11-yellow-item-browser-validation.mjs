import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const entry = require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })
const module = await import(pathToFileURL(entry).href)
const chromium = module.chromium ?? module.default?.chromium
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-dark-enchantress-war-bs11.en.json'), 'utf8'))
const cards = candidate.cards.filter((card) => ['BS11-030', 'BS11-031'].includes(card.cardNumber))
const outputDir = resolve(root, 'test-results/bs11-yellow-item-browser')
mkdirSync(outputDir, { recursive: true })
const cases = cards.flatMap((card) => ['positive', 'negative'].map((scenario) => ({ card, scenario })))
const viewports = [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]
const visible = async (locator) => await locator.count() > 0 && await locator.first().isVisible().catch(() => false)
const click = async (locator, label) => {
  await locator.waitFor({ state: 'visible' })
  assert.equal(await locator.isEnabled(), true, `${label} must be enabled`)
  await locator.click()
}
const trace = (page) => page.evaluate(() => (window.__braverseContractTrace ?? []).map((entry) => ({
  commandKind: entry.commandKind,
  steps: Array.isArray(entry.steps) ? entry.steps.map(String) : [],
})))
const state = (page) => page.evaluate(() => {
  const side = (name) => {
    const field = document.querySelector(`.${name}-field`)
    const count = (selector) => Number(field?.querySelector(selector)?.textContent?.match(/\d+/)?.[0] ?? NaN)
    return {
      hand: field?.querySelectorAll('.hand-card-wrap').length ?? 0,
      trash: count('.discard-zone.resource-summary > strong'),
      supports: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map((node) => ({ rested: Boolean(node.querySelector('.card-face.is-rested')) })),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map((node) => ({
        name: node.querySelector('.card-face')?.getAttribute('title'),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
      })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const skipAnimations = async (page) => {
  for (let i = 0; i < 16; i += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click({ timeout: 1000 }).catch(() => {})
    await page.waitForTimeout(100)
  }
}
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
const results = []
try {
  for (const viewport of viewports) for (const testCase of cases) {
    const { card, scenario } = testCase
    const page = await browser.newPage({ viewport })
    page.setDefaultTimeout(12000)
    const evidence = { cardNumber: card.cardNumber, scenario, viewport, status: 'FAIL', errors: [] }
    page.on('pageerror', (error) => evidence.errors.push(error.message))
    const imagePath = resolve(root, 'test-results/bs11-official-art', `${card.cardNumber}.webp`)
    if (existsSync(imagePath)) await page.route(card.imageUrl,
      (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) }))
    try {
      const url = new URL('/', process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')
      url.searchParams.set('test-state', `bs11-yellow-item:${card.cardNumber}:${scenario}`)
      url.searchParams.set('contract-card', card.cardNumber)
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      evidence.before = await state(page)
      const hand = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator(`.card-face[title="${card.name}"]`) }).first()
      await hand.waitFor({ state: 'visible' })
      evidence.art = await hand.locator('.card-face').first().evaluate((node) => {
        const image = node.querySelector('img')
        return { url: image?.getAttribute('src'), loaded: Boolean(image?.complete && image.naturalWidth > 0) }
      })
      await click(hand.locator('.card-face').first(), `select ${card.name}`)
      const use = hand.locator('.hand-card-action').filter({ hasText: '使用' }).first()
      evidence.useVisible = await visible(use)
      if (evidence.useVisible && await use.isEnabled()) {
        await click(use, `use ${card.name}`)
        const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
        await panel.waitFor({ state: 'visible' })
        evidence.panel = await panel.innerText()
        const cost = 1
        for (let index = 0; index < cost; index += 1) {
          await click(panel.locator('.effect-candidates-payment:visible button:not(.is-selected)').first(), `yellow payment ${index + 1}`)
        }
        for (let step = 0; step < 5 && await visible(panel); step += 1) {
          const target = panel.locator('.effect-candidates-target:visible button:not(.is-selected)').first()
          if (await visible(target)) await click(target, 'Item target')
          const primary = panel.locator('.effect-panel-primary-action:visible').last()
          if (!await visible(primary)) break
          await click(primary, 'resolve Item')
          await page.waitForTimeout(200)
        }
        await skipAnimations(page)
      }
      evidence.after = await state(page)
      evidence.trace = await trace(page)
      assert.equal(evidence.art.url, card.imageUrl)
      if (existsSync(imagePath)) assert.equal(evidence.art.loaded, true)
      assert.equal(evidence.after.bottom.trash, evidence.before.bottom.trash + (scenario === 'positive' ? 1 : 0))
      assert.equal(evidence.after.bottom.supports.filter((entry) => entry.rested).length, scenario === 'positive' ? 1 : 0)
      assert.equal(evidence.trace.some((entry) => entry.commandKind === 'begin-play-item'), scenario === 'positive')
      if (card.cardNumber === 'BS11-030') {
        assert.equal(evidence.after.bottom.battle[0].hp - evidence.before.bottom.battle[0].hp, scenario === 'positive' ? 1 : 0)
      } else {
        assert.equal(evidence.after.top.battle[0].hp, evidence.before.top.battle[0].hp)
        assert.equal(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect' &&
          entry.steps.some((step) => step.includes('Wizard Cookie'))), scenario === 'positive')
      }
      if (scenario === 'negative') assert.equal(evidence.useVisible, false)
      assert.deepEqual(evidence.errors, [])
      evidence.status = 'PASS'
    } catch (error) {
      evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
      evidence.trace ??= await trace(page).catch(() => [])
      evidence.debug = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')]
        .filter((node) => node.getBoundingClientRect().width > 0).map((node) => node.textContent?.trim().slice(0, 600))).catch(() => [])
    } finally {
      await page.close()
    }
    results.push(evidence)
    console.log(`${evidence.status} ${card.cardNumber}-${scenario} ${viewport.width}x${viewport.height}${evidence.error ? ': ' + evidence.error.split('\n')[0] : ''}`)
  }
} finally {
  await browser.close()
}
const artifactPath = resolve(outputDir, `bs11-yellow-item-browser-${Date.now()}.json`)
const summary = { total: results.length, passed: results.filter((entry) => entry.status === 'PASS').length }
writeFileSync(artifactPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2) + '\n')
console.log(JSON.stringify({ artifactPath, summary }))
if (summary.passed !== summary.total) process.exitCode = 1
