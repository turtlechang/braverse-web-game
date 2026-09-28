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
const imageUrl = candidate.cards.find((card) => card.cardNumber === 'BS11-006')?.imageUrl
const imagePath = resolve(root, 'test-results/bs11-official-art/BS11-006.webp')
const outputDir = resolve(root, 'test-results/bs11-006-browser')
mkdirSync(outputDir, { recursive: true })
const viewports = [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]
const scenarios = ['positive', 'no-macaron', 'no-item']
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
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map((node) => ({
        name: node.querySelector('.card-face')?.getAttribute('title'),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
      })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const skipAnimations = async (page) => {
  for (let i = 0; i < 18; i += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click({ timeout: 1000 }).catch(() => {})
    await page.waitForTimeout(100)
  }
}
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
const results = []
try {
  for (const viewport of viewports) for (const scenario of scenarios) {
    const page = await browser.newPage({ viewport })
    page.setDefaultTimeout(12000)
    const evidence = { scenario, viewport, status: 'FAIL', errors: [] }
    page.on('pageerror', (error) => evidence.errors.push(error.message))
    if (imageUrl && existsSync(imagePath)) {
      await page.route(imageUrl, (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) }))
    }
    try {
      const url = new URL('/', process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')
      url.searchParams.set('test-state', `bs11-006-on-play:${scenario}`)
      url.searchParams.set('contract-card', 'BS11-006')
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      evidence.before = await state(page)
      const card = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator('.card-face[title="Castanets"]') }).first()
      await card.waitFor({ state: 'visible' })
      evidence.art = await card.locator('.card-face').first().evaluate((node) => {
        const image = node.querySelector('img')
        return { url: image?.getAttribute('src'), loaded: Boolean(image?.complete && image.naturalWidth > 0) }
      })
      await click(card.locator('.card-face').first(), 'select Castanets')
      await click(card.locator('.hand-card-action').filter({ hasText: '登場' }).first(), 'deploy Castanets')
      await skipAnimations(page)
      const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
      evidence.panel = await visible(panel) ? await panel.innerText() : null
      if (await visible(panel)) {
        const discard = panel.locator('.effect-candidates-discard-hand:visible button:not(.is-selected)').first()
        if (scenario === 'no-item') {
          assert.equal(await visible(discard), false)
          evidence.disabled = !await panel.locator('.effect-panel-primary-action:visible').last().isEnabled()
        } else {
          await click(discard, 'red Item On Play cost')
          const primary = panel.locator('.effect-panel-primary-action:visible').last()
          await click(primary, 'resolve Castanets On Play')
          await skipAnimations(page)
        }
      }
      evidence.after = await state(page)
      evidence.trace = await trace(page)
      assert.equal(evidence.art.url, imageUrl)
      if (existsSync(imagePath)) assert.equal(evidence.art.loaded, true)
      assert.equal(evidence.after.bottom.battle.some((entry) => entry.name === 'Castanets'), true)
      assert.ok(evidence.trace.some((entry) => entry.commandKind === 'deploy-cookie'))
      if (scenario === 'positive') {
        assert.ok(evidence.trace.some((entry) => entry.commandKind === 'begin-activate-skill'))
        assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect'))
        assert.equal(evidence.before.top.battle[0].hp - evidence.after.top.battle[0].hp, 1)
        assert.equal(evidence.before.top.battle[1].hp - evidence.after.top.battle[1].hp, 1)
        assert.equal(evidence.after.bottom.trash, evidence.before.bottom.trash + 1)
      } else {
        assert.ok(evidence.trace.some((entry) => entry.commandKind === 'skip-on-play'))
        assert.equal(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect'), false)
        assert.equal(evidence.before.top.battle[0].hp, evidence.after.top.battle[0].hp)
        assert.equal(evidence.before.top.battle[1].hp, evidence.after.top.battle[1].hp)
      }
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
    console.log(`${evidence.status} BS11-006-${scenario} ${viewport.width}x${viewport.height}${evidence.error ? ': ' + evidence.error.split('\n')[0] : ''}`)
  }
} finally {
  await browser.close()
}
const artifactPath = resolve(outputDir, `bs11-006-browser-${Date.now()}.json`)
const summary = { total: results.length, passed: results.filter((entry) => entry.status === 'PASS').length }
writeFileSync(artifactPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2) + '\n')
console.log(JSON.stringify({ artifactPath, summary }))
if (summary.passed !== summary.total) process.exitCode = 1
