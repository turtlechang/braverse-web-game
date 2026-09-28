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
const records = Object.fromEntries(candidate.cards.map((card) => [card.cardNumber, card]))
const outputDir = resolve(root, 'test-results/bs11-035-on-play-browser')
mkdirSync(outputDir, { recursive: true })
const viewports = [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]
const scenarios = ['positive', 'negative']
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
      hand: [...(field?.querySelectorAll('.hand-card-wrap') ?? [])].map((node) => node.getAttribute('data-card-instance-id')),
      trash: count('.discard-zone.resource-summary > strong'),
      breakCount: Number(field?.querySelector('.break-zone .zone-heading b')?.textContent?.match(/\d+/)?.[0] ?? NaN),
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
  for (let i = 0; i < 18; i += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click({ timeout: 1000 }).catch(() => {})
    await page.waitForTimeout(100)
  }
}
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
const results = []
try {
  for (const viewport of viewports) for (const cardNumber of ['BS11-035', 'BS11-035@1']) for (const scenario of scenarios) {
    const page = await browser.newPage({ viewport })
    page.setDefaultTimeout(12000)
    const evidence = { cardNumber, scenario, viewport, status: 'FAIL', errors: [] }
    page.on('pageerror', (error) => evidence.errors.push(error.message))
    const imageUrl = records[cardNumber].imageUrl
    const imagePath = resolve(root, 'test-results/bs11-official-art', `${cardNumber.replace('@', '-at-')}.webp`)
    if (imageUrl && existsSync(imagePath)) {
      await page.route(imageUrl, (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) }))
    }
    try {
      const url = new URL('/', process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')
      url.searchParams.set('test-state', `bs11-035-on-play:${cardNumber}:${scenario}`)
      url.searchParams.set('contract-card', 'BS11-035')
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      evidence.before = await state(page)
      const card = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator('.card-face[title="Millennial Tree Cookie"]') }).first()
      await card.waitFor({ state: 'visible' })
      evidence.art = await card.locator('.card-face').first().evaluate((node) => {
        const image = node.querySelector('img')
        return { url: image?.getAttribute('src'), loaded: Boolean(image?.complete && image.naturalWidth > 0) }
      })
      await click(card.locator('.card-face').first(), 'select Millennial Tree')
      await click(card.locator('.hand-card-action').filter({ hasText: '登場' }).first(), 'deploy Millennial Tree')
      await skipAnimations(page)
      const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
      evidence.panel = await visible(panel) ? await panel.innerText() : null
      if (scenario === 'positive') {
        await panel.waitFor({ state: 'visible' })
        for (let step = 0; step < 12; step += 1) {
          const current = page.locator('.effect-panel[role="alertdialog"]:visible').last()
          if (!await visible(current)) {
            if ((await trace(page)).filter((entry) => entry.commandKind === 'resolve-ability-effect').length >= 2) break
            await page.waitForTimeout(150)
            continue
          }
          const payment = current.locator('.effect-candidates-payment:visible button:not(.is-selected)').first()
          if (await visible(payment)) { await click(payment, 'yellow On Play payment'); continue }
          const cost = current.locator('.effect-candidates-cost-hand-to-break:visible button:not(.is-selected)').first()
          if (await visible(cost)) { await click(cost, 'hand Cookie to Break'); continue }
          const firstEffect = !(await trace(page)).some((entry) => entry.commandKind === 'resolve-ability-effect')
          const target = current.locator('.effect-candidates-target:visible button:not(.is-selected)')
            .filter({ hasText: firstEffect ? 'Burnt Cheese Cookie' : 'Fettuccine Cookie' }).first()
          if (await visible(target)) { await click(target, 'return Yellow LV2 Cookie'); continue }
          await click(current.locator('.effect-panel-primary-action:visible').last(), 'advance Millennial Tree On Play')
          await page.waitForTimeout(150)
        }
        if ((await trace(page)).filter((entry) => entry.commandKind === 'resolve-ability-effect').length === 1) {
          const second = page.locator('.effect-panel[role="alertdialog"]:visible').filter({ hasText: '第 2 / 2 段' }).last()
          await second.waitFor({ state: 'visible' })
          const fettuccine = second.locator('.effect-candidates-target button').filter({ hasText: 'Fettuccine Cookie' }).first()
          if (!((await fettuccine.getAttribute('class')) ?? '').includes('is-selected')) await click(fettuccine, 'return Fettuccine Cookie')
          await click(second.locator('.effect-panel-primary-action:visible').last(), 'confirm second On Play segment')
        }
        await page.waitForFunction(() => (window.__braverseContractTrace ?? [])
          .filter((entry) => entry.commandKind === 'resolve-ability-effect').length >= 2)
        await skipAnimations(page)
      }
      evidence.after = await state(page)
      evidence.trace = await trace(page)
      assert.equal(evidence.art.url, imageUrl)
      if (existsSync(imagePath)) assert.equal(evidence.art.loaded, true)
      assert.equal(evidence.after.bottom.battle.some((entry) => entry.name === 'Millennial Tree Cookie'), true)
      assert.ok(evidence.trace.some((entry) => entry.commandKind === 'deploy-cookie'))
      if (scenario === 'positive') {
        assert.ok(evidence.trace.some((entry) => entry.commandKind === 'begin-activate-skill'))
        assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect'))
        assert.equal(evidence.after.bottom.hand.includes('bs11-035-break-to-hand-target'), true)
        assert.equal(evidence.after.bottom.breakCount, 1)
        assert.equal(evidence.after.bottom.supports.filter((entry) => entry.rested).length, 2)
      } else {
        assert.ok(evidence.trace.some((entry) => entry.commandKind === 'skip-on-play'))
        assert.equal(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect'), false)
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
    console.log(`${evidence.status} ${cardNumber}-${scenario} ${viewport.width}x${viewport.height}${evidence.error ? ': ' + evidence.error.split('\n')[0] : ''}`)
  }
} finally {
  await browser.close()
}
const artifactPath = resolve(outputDir, `bs11-035-on-play-browser-${Date.now()}.json`)
const summary = { total: results.length, passed: results.filter((entry) => entry.status === 'PASS').length }
writeFileSync(artifactPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2) + '\n')
console.log(JSON.stringify({ artifactPath, summary }))
if (summary.passed !== summary.total) process.exitCode = 1
