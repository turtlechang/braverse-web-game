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
const outputDir = resolve(root, 'test-results/bs11-108-browser')
mkdirSync(outputDir, { recursive: true })
const requestedWidth = Number(process.env.BS11_BROWSER_WIDTH)
const requestedScenario = process.env.BS11_BROWSER_SCENARIO
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
      deck: count('.deck-zone .resource-summary > strong'),
      trash: count('.discard-zone.resource-summary > strong'),
      stage: field?.querySelector('.stage-zone .resource-summary')?.getAttribute('title') ?? null,
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
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }].filter((entry) =>
    !requestedWidth || entry.width === requestedWidth)) {
    for (const cardNumber of ['BS11-108', 'BS11-108@1']) {
    const card = candidate.cards.find((entry) => entry.cardNumber === cardNumber)
    const imagePath = resolve(root, 'test-results/bs11-official-art', `${cardNumber.replace('@', '-at-')}.webp`)
    for (const scenario of ['positive', 'negative'].filter((entry) => !requestedScenario || entry === requestedScenario)) {
      const page = await browser.newPage({ viewport })
      page.setDefaultTimeout(12000)
      const evidence = { cardNumber, viewport, scenario, status: 'FAIL', errors: [] }
      page.on('pageerror', (error) => evidence.errors.push(error.message))
      if (existsSync(imagePath)) await page.route(card.imageUrl,
        (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) }))
      try {
        const url = new URL('/', process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')
        url.searchParams.set('test-state', `bs11-108-stage:${cardNumber}:${scenario}`)
        url.searchParams.set('contract-card', 'BS11-108')
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
        await page.locator('.game-shell').waitFor({ state: 'visible' })
        evidence.before = await state(page)
        const hand = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator(`.card-face[title="${card.name}"]`) }).first()
        await hand.waitFor({ state: 'visible' })
        evidence.art = await hand.locator('.card-face').first().evaluate((node) => {
          const image = node.querySelector('img')
          return { url: image?.getAttribute('src'), loaded: Boolean(image?.complete && image.naturalWidth > 0) }
        })
        await click(hand.locator('.card-face').first(), 'select Castle')
        await click(hand.locator('.hand-card-action').filter({ hasText: '放置' }).first(), 'place Castle')
        const placement = page.locator('.stage-placement-modal:visible').first()
        await placement.waitFor({ state: 'visible' })
        await click(placement.locator('.faint-payment-candidates button:not(.is-selected)').first(), 'black placement payment')
        await click(placement.getByRole('button', { name: '支付並放置', exact: true }), 'confirm placement')
        await skipAnimations(page)
        evidence.placed = await state(page)
        assert.ok(evidence.placed.bottom.stage?.includes(card.name))
        assert.equal(evidence.art.url, card.imageUrl)
        if (existsSync(imagePath)) assert.equal(evidence.art.loaded, true)
        const cookieName = scenario === 'positive' ? 'Pom-pom Dough Cookie' : 'bs11-108-normal-cookie'
        const cookie = page.locator('.bottom-field .hand-card-wrap').filter({
          has: page.locator(`.card-face[title="${cookieName}"]`),
        }).first()
        await click(cookie.locator('.card-face').first(), `select ${cookieName}`)
        if (scenario === 'positive') {
          await click(cookie.locator('.hand-card-action').filter({ hasText: '特殊登場' }).first(), 'special play Pom-pom')
          const special = page.locator('[role="dialog"]:visible').filter({ hasText: '特殊登場' }).last()
          await special.waitFor({ state: 'visible' })
          await click(special.locator('.special-play-candidate').first(), 'choose black LV1 sacrifice')
          await click(special.getByRole('button', { name: '確認特殊登場', exact: true }), 'confirm special play')
          await skipAnimations(page)
          for (let step = 0; step < 20; step += 1) {
            const onPlay = page.locator('.effect-panel[role="alertdialog"]:visible').last()
            const skip = onPlay.getByRole('button', { name: '略過整個登場效果', exact: true }).first()
            const declineReplacement = page.getByRole('button', { name: '不補餅乾', exact: true }).first()
            if (await visible(skip)) await click(skip, 'skip Pom-pom On Play')
            else if (await visible(declineReplacement)) await click(declineReplacement, 'finish Special Play replacement')
            else if (await visible(page.locator('.bottom-field .stage-quick-action'))) break
            await page.waitForTimeout(150)
          }
        } else {
          await click(cookie.locator('.hand-card-action').filter({ hasText: '登場' }).first(), 'normal Cookie deployment')
          await skipAnimations(page)
        }
        evidence.afterCookie = await state(page)
        evidence.afterCookieTrace = await trace(page)
        assert.ok(evidence.afterCookie.bottom.battle.some((entry) => entry.name === cookieName))
        const activate = page.locator('.bottom-field .stage-quick-action')
        if (scenario === 'negative') {
          assert.equal(await visible(activate), false)
          evidence.after = await state(page)
          evidence.trace = await trace(page)
          assert.equal(evidence.trace.some((entry) => entry.commandKind === 'begin-activate-stage'), false)
          assert.equal(evidence.after.bottom.supports.filter((entry) => entry.rested).length, 1)
        } else {
        assert.equal(evidence.afterCookie.bottom.battle.some((entry) => entry.name === 'bs11-108-black-lv1-sacrifice'), false)
        assert.equal(await visible(activate), true)
        await click(activate, 'activate Castle')
        const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
        await panel.waitFor({ state: 'visible' })
        evidence.panel = await panel.innerText()
        for (let step = 0; step < 5; step += 1) {
          const primary = panel.locator('.effect-panel-primary-action:visible').last()
          if (!await visible(primary)) break
          await click(primary, 'resolve Castle stage')
          await page.waitForTimeout(200)
          if (!await visible(panel)) break
        }
        await skipAnimations(page)
        const draw = page.locator('.draw-up-to-modal:visible').first()
        await draw.waitFor({ state: 'visible' })
        evidence.drawPanel = await draw.innerText()
        await click(draw.locator('.draw-up-to-option').filter({ hasText: '抽 1 張' }).first(), 'Castle draw one')
        await click(draw.getByRole('button', { name: '抽取 1 張牌', exact: true }), 'confirm Castle draw')
        await skipAnimations(page)
        const discard = page.locator('.hand-discard-modal:visible').first()
        await discard.waitFor({ state: 'visible' })
        evidence.discardPanel = await discard.innerText()
        await click(discard.locator('.hand-discard-options button:not(.is-selected)')
          .filter({ hasText: 'bs11-108-discard-witness' }).first(), 'Castle hand discard witness')
        await click(discard.locator('.hand-discard-actions button:not(:disabled)').first(), 'confirm Castle discard')
        await skipAnimations(page)
        evidence.after = await state(page)
        evidence.trace = await trace(page)
        assert.ok(evidence.after.bottom.stage?.includes(card.name))
        assert.equal(evidence.after.bottom.supports.filter((entry) => entry.rested).length, 1)
        assert.ok(evidence.trace.some((entry) => entry.commandKind === 'play-stage'))
        assert.ok(evidence.trace.some((entry) => entry.commandKind === 'begin-activate-stage'))
        assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-draw-up-to'))
        assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-opponent-hand-discard'))
        assert.equal(evidence.after.bottom.deck, evidence.afterCookie.bottom.deck - 1)
        assert.equal(evidence.after.bottom.trash, evidence.afterCookie.bottom.trash + 1)
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
    }
  }
} finally {
  await browser.close()
}
const artifactPath = resolve(outputDir, `bs11-108-browser-${Date.now()}.json`)
const summary = { total: results.length, passed: results.filter((entry) => entry.status === 'PASS').length }
writeFileSync(artifactPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2) + '\n')
console.log(JSON.stringify({ artifactPath, summary }))
if (summary.passed !== summary.total) process.exitCode = 1
