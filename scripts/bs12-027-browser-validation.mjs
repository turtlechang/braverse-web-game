import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-027-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-festival-arena-bs12.en.json'), 'utf8')).cards
const references = readdirSync(resolve(root, 'data/cards')).filter(f => f.endsWith('.json')).flatMap(f => JSON.parse(readFileSync(resolve(root, 'data/cards', f), 'utf8')).cards ?? [])
const cards = [...candidate.filter(card => existsSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`))), ...references.filter(card => ["ST2-001","ST2-002","ST4-001","BS7-061","BS8-009","BS8-021"].includes(card.cardNumber))]
const cases = ['four', 'three', 'five', 'arena-only', 'yellow-only', 'non-arena', 'high-level', 'opponent-break', 'trash-arena', 'support-arena', 'battle-arena', 'free-no-energy', 'free-wrong-energy', 'free-rested-energy', 'no-energy', 'wrong-energy', 'rested-energy', 'disabled', 'used', 'main', 'after-battle', 'zero-free', 'zero-paid', 'other-free', 'other-paid', 'skip-free', 'skip-paid', 'cancel-energy', 'cancel-target', 'back-energy', 'payment-deselect', 'target-deselect', 'source-preview']
const route = scenario => cases.indexOf(scenario) <= cases.indexOf('after-battle') ? scenario : scenario.endsWith('-paid') || ['cancel-energy', 'cancel-target', 'back-energy', 'payment-deselect'].includes(scenario) ? 'three' : 'four'
const blocked = ['no-energy', 'wrong-energy', 'rested-energy', 'disabled', 'used', 'main', 'after-battle']
const free = ['four', 'five', 'free-no-energy', 'free-wrong-energy', 'free-rested-energy']
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'), hand: field?.querySelectorAll('.hand-card').length ?? 0,
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(n => ({ id: n.getAttribute('data-card-instance-id'), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN), attack: Number(n.querySelector('.badge-atk')?.textContent ?? NaN), rested: n.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(n => ({ id: n.getAttribute('data-card-instance-id'), rested: n.querySelector('.card-face')?.classList.contains('is-rested') ?? false })) }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, steps: e.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') && ![...document.querySelectorAll('button')].some(b => b.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
const resultsFile = resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json')
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const result = { scenario, viewport, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => result.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') result.errors.push(m.text()) })
    page.on('requestfailed', r => result.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, r => r.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const fixtureScenario = route(scenario)
      result.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixtureScenario === 'four' ? 'card:BS12-027' : process.env.BS12_BROWSER_ROUTE === 'generic' && fixtureScenario === 'no-energy' ? 'card-negative:BS12-027' : `bs12-027:${fixtureScenario}`
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${result.testState}&contract-card=BS12-027`)
      await page.locator('.game-shell').waitFor()
      await settle(page)
      const modal = page.locator('.trap-response-modal:visible')
      if (blocked.includes(scenario)) {
        assert.equal(await modal.count(), 0)
        if (scenario === 'disabled') await page.getByRole('button', { name: '了解，繼續傷害結算', exact: true }).click()
        if (!['main', 'after-battle'].includes(scenario)) await page.waitForFunction(hp => document.querySelector('[data-card-instance-id="bs12-027-defender"] .hp-card-stack')?.getAttribute('aria-label')?.includes(`HP 卡 ${hp} 張`), scenario === 'disabled' ? 2 : 1)
        await settle(page)
        result.after = await state(page)
        assert.equal(result.after.bottom.hand, 1)
        assert.equal(result.after.bottom.trash, ['main', 'after-battle'].includes(scenario) ? 0 : scenario === 'disabled' ? 3 : scenario === 'used' ? 5 : 4)
        assert.equal(result.after.bottom.deck, 12)
        assert.equal(result.after.bottom.battle[0].hp, ['main', 'after-battle'].includes(scenario) ? 5 : scenario === 'disabled' ? 2 : 1)
        assert.equal(result.after.bottom.support.some(s => s.rested), scenario === 'rested-energy')
        result.controlTrace = await trace(page)
        if (scenario === 'used') {
          assert.equal(result.controlTrace.length, 1)
          assert.equal(result.controlTrace[0].commandKind, 'play-trap')
          assert.match(result.controlTrace[0].steps.join(' '), /Designers' Yapping/)
          assert.match(result.controlTrace[0].steps.join(' '), /選擇 0 個目標.*未套用攻擊傷害修改/)
          assert.doesNotMatch(result.controlTrace[0].steps.join(' '), /支付能量/)
        } else assert.deepEqual(result.controlTrace, [])
        await page.locator('.hand-card img').first().evaluate(img => img.decode())
        if (scenario === 'main') {
          await page.getByRole('button', { name: "Designers' Yapping", exact: true }).click()
          const detail = page.getByRole('dialog', { name: "Designers' Yapping 卡牌詳情", exact: true })
          await detail.waitFor()
          assert.match(await detail.innerText(), /BS12-027/)
          assert.match(await detail.innerText(), /If there are 4/)
          assert.equal(await detail.getByRole('button').count(), 1)
          await detail.locator('img[alt="Designers\' Yapping"]').evaluate(img => img.decode())
          await shot('hand-detail')
          await detail.getByRole('button', { name: '關閉', exact: true }).click()
          assert.deepEqual(await state(page), result.after)
          assert.deepEqual(await trace(page), [])
        }
      } else {
        await modal.waitFor()
        result.before = await state(page)
        const trap = modal.locator('.modal-card-options > button').filter({ hasText: "Designers' Yapping" })
        await trap.locator('img').first().evaluate(img => img.decode())
        assert.equal(await trap.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-027').imageUrl)
        await trap.click()
        const next = modal.getByRole('button', { name: '下一步', exact: true })
        const isFree = free.includes(route(scenario))
        result.isFree = isFree
        if (scenario.startsWith('skip-') || scenario === 'cancel-energy') {
          await modal.getByRole('button', { name: '不發動', exact: true }).click()
        } else {
          if (!isFree) {
            assert.equal(await next.isEnabled(), false)
            const payments = modal.locator('.trap-guided-section .trap-discard-options > button')
            await payments.first().click()
            assert.equal(await next.isEnabled(), true)
            if (scenario === 'payment-deselect') { await payments.first().click(); assert.equal(await next.isEnabled(), false); await payments.first().click() }
          }
          if (!isFree) {
            assert.equal(await next.isEnabled(), true)
            await shot('payment')
            await next.click()
          } else {
            assert.equal(await next.count(), 0)
            assert.equal(await modal.locator('.trap-guided-section .trap-discard-options > button').count(), 0)
          }
          if (scenario === 'back-energy') {
            await modal.getByRole('button', { name: '上一步', exact: true }).click()
            assert.equal(await next.isEnabled(), true)
            await next.click()
          }
          const targets = modal.locator('.trap-effect-target-step .trap-target-options > button')
          assert.equal(await targets.count(), 2)
          const bounds = await modal.boundingBox()
          assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1)
          const confirm = modal.getByRole('button', { name: '確認發動', exact: true })
          assert.equal(await confirm.isEnabled(), true)
          if (!scenario.startsWith('zero-')) await targets.filter({ hasText: scenario.startsWith('other-') ? 'Peach Cookie' : 'Langue de Chat Cookie' }).click()
          if (scenario === 'target-deselect') { await targets.filter({ hasText: 'Langue de Chat Cookie' }).click(); assert.equal(await confirm.isEnabled(), true); await targets.filter({ hasText: 'Langue de Chat Cookie' }).click() }
          assert.deepEqual((await state(page)).bottom.battle, result.before.bottom.battle)
          assert.equal((await state(page)).bottom.hand, 1)
          assert.equal((await state(page)).bottom.trash, result.before.bottom.trash)
          assert.deepEqual(await trace(page), [])
          await shot('target')
          if (scenario === 'cancel-target') await modal.getByRole('button', { name: '不發動', exact: true }).click()
          else await confirm.click()
        }
        await modal.waitFor({ state: 'hidden' })
        const skipped = scenario.startsWith('skip-') || scenario.startsWith('cancel-')
        const reduced = !skipped && !scenario.startsWith('zero-') && !scenario.startsWith('other-')
        await page.waitForFunction(hp => document.querySelector('[data-card-instance-id="bs12-027-defender"] .hp-card-stack')?.getAttribute('aria-label')?.includes(`HP 卡 ${hp} 張`), reduced ? 2 : 1)
        await settle(page)
        result.after = await state(page)
        assert.equal(result.after.bottom.battle[0].hp, reduced ? 2 : 1)
        assert.equal(result.after.bottom.battle[1].hp, result.before.bottom.battle[1].hp)
        assert.deepEqual(result.after.top.battle.map(c => c.attack), [reduced ? 3 : 4, scenario.startsWith('other-') ? 0 : 1])
        assert.equal(result.after.bottom.hand, skipped ? 1 : 0)
        assert.equal(result.after.bottom.trash, result.before.bottom.trash + (reduced ? 3 : 4) + (skipped ? 0 : 1))
        assert.equal(result.after.bottom.deck, 12)
        assert.deepEqual(result.after.bottom.support.map(s => s.rested), result.before.bottom.support.map((s, i) => s.rested || (!skipped && !isFree && i === 0)))
        result.trace = await trace(page)
        assert.deepEqual(result.trace.map(e => e.commandKind), skipped ? [] : ['play-trap'])
        if (!skipped) {
          assert.match(result.trace[0].steps.join(' '), /Designers' Yapping/)
          if (!isFree) assert.match(result.trace[0].steps.join(' '), /支付能量/)
          if (reduced || scenario.startsWith('other-')) assert.match(result.trace[0].steps.join(' '), /選擇目標/)
        }
      }
      assert.deepEqual(result.errors, [])
      // Transient HP faces can be removed before their original-art request
      // finishes. Keep every cancellation, and require all mounted original
      // images (including payment/target/log faces) to decode successfully.
      result.mountedOriginalArt = await page.evaluate(async urls => {
        const mounted = [...document.images].filter(img => urls.includes(img.src))
        return Promise.all(mounted.map(async img => {
          await img.decode()
          if (!img.naturalWidth) throw new Error(`Original card art failed: ${img.src}`)
          return { url: img.src, alt: img.alt, naturalWidth: img.naturalWidth }
        }))
      }, cards.map(card => card.imageUrl))
      result.cancelledOriginalImageRequests = result.networkFailures.filter(entry =>
        entry.resourceType === 'image' && entry.error === 'net::ERR_ABORTED' && cards.some(card => card.imageUrl === entry.url))
      result.networkFailures = result.networkFailures.filter(entry => !result.cancelledOriginalImageRequests.includes(entry))
      assert.deepEqual(result.networkFailures, [])
      await shot('result')
      result.status = 'PASS'
    } catch (error) {
      result.error = String(error.stack ?? error)
      result.dom = await page.locator('body').innerText().catch(() => '')
      throw error
    } finally { results.push(result); writeFileSync(resultsFile, JSON.stringify(results, null, 2)); await page.close() }
    console.log(`PASS BS12-027 ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-027 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
