import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-011-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/candidates/official-festival-arena-bs12.en.json'), 'utf8')).cards
const references = readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json')).flatMap(file => JSON.parse(readFileSync(resolve(root, 'data/cards', file), 'utf8')).cards ?? [])
const cards = [...candidate.filter(card => existsSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`))), ...['BS4-095', 'BS7-061', 'ST4-001'].map(number => references.find(card => card.cardNumber === number))]
const cases = ['red', 'green', 'zero', 'cancel', 'deselect', 'max', 'active-target', 'non-arena', 'no-target', 'mic-equipped', 'no-energy', 'wrong-energy', 'rested-energy', 'opponent-turn', 'removed', 'replaced', 'rested-stage']
const blocked = ['no-energy', 'wrong-energy', 'rested-energy']
const prepared = ['opponent-turn', 'removed', 'rested-stage']
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'),
      hand: field?.querySelectorAll('.hand-card').length ?? 0,
      stage: field?.querySelector('.stage-zone img')?.getAttribute('src') ?? null,
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
        rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
        equipped: node.querySelector('.badge-equip')?.getAttribute('aria-label') ?? null })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'),
        rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({ commandKind: entry.commandKind, summary: entry.summary, steps: entry.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') &&
  ![...document.querySelectorAll('button')].some(button => button.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({ viewport })
    const result = { scenario, viewport, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), error: request.failure()?.errorText, resourceType: request.resourceType() }))
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const route = cases.slice(6).includes(scenario) ? scenario : 'positive'
      const testState = process.env.BS12_BROWSER_ROUTE === 'generic' && route === 'positive' ? 'card:BS12-011'
        : process.env.BS12_BROWSER_ROUTE === 'generic' && route === 'no-energy' ? 'card-negative:BS12-011' : `bs12-011:${route}`
      result.testState = testState
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${testState}&contract-card=BS12-011`)
      await page.locator('.game-shell').waitFor()
      await settle(page)
      result.before = await state(page)
      if (scenario === 'opponent-turn') {
        assert.equal(await page.locator('.effect-panel:not(.is-complete):visible').count(), 0)
        assert.equal(await page.getByRole('button', { name: '啟動場景', exact: true }).count(), 0)
        result.after = await state(page)
        assert.deepEqual(result.after, result.before)
        result.trace = await trace(page)
        assert.ok(result.trace.every(entry => entry.commandKind === 'play-stage'))
      } else if (blocked.includes(scenario)) {
        const handCard = page.getByRole('button', { name: 'Crown Stage', exact: true })
        await handCard.locator('img').evaluate(image => image.decode())
        await handCard.click()
        assert.equal(await page.getByRole('button', { name: '放置', exact: true }).count(), 0)
        assert.equal(await page.getByRole('alertdialog', { name: 'Crown Stage 場景放置付款', exact: true }).count(), 0)
        assert.match(await page.locator('body').innerText(), /BS12-011/)
        result.after = await state(page)
        result.trace = await trace(page)
        assert.deepEqual(result.after, result.before)
        assert.deepEqual(result.trace, [])
        result.blockReason = scenario === 'no-energy' ? 'No support energy' : scenario === 'wrong-energy' ? 'Only blue support' : 'Red support rested'
      } else {
        if (!prepared.includes(scenario)) {
          const hand = page.locator('.bottom-field .hand-card').filter({ hasText: 'Crown Stage' })
          // The card has an accessible name even when its face contains only art.
          const handCard = await hand.count() ? hand : page.getByRole('button', { name: 'Crown Stage', exact: true })
          await handCard.locator('img').evaluate(image => image.decode())
          await handCard.click()
          await page.getByRole('button', { name: '放置', exact: true }).click()
          const modal = page.getByRole('alertdialog', { name: 'Crown Stage 場景放置付款', exact: true })
          await modal.waitFor()
          assert.match(await modal.innerText(), /BS12-011/)
          assert.equal(await modal.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-011').imageUrl)
          await modal.locator('img').first().evaluate(image => image.decode())
          const confirm = modal.getByRole('button', { name: '支付並放置', exact: true })
          assert.equal(await confirm.isEnabled(), false)
          const payments = modal.locator('.modal-card-options > button')
          if (blocked.includes(scenario)) {
            assert.equal(await payments.count(), 0)
            await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-blocked.png`) })
            await modal.getByRole('button', { name: '取消', exact: true }).click()
            result.after = await state(page)
            result.trace = await trace(page)
            assert.deepEqual(result.after, result.before)
            assert.deepEqual(result.trace, [])
          } else {
            assert.equal(await payments.count(), 1)
            await payments.click()
            assert.equal(await confirm.isEnabled(), true)
            if (scenario === 'cancel') {
              await modal.getByRole('button', { name: '取消', exact: true }).click()
              result.after = await state(page)
              result.trace = await trace(page)
              assert.deepEqual(result.after, result.before)
              assert.deepEqual(result.trace, [])
            } else {
              await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-payment.png`) })
              await confirm.click()
              await modal.waitFor({ state: 'hidden' })
              await settle(page)
              result.placed = await state(page)
              assert.equal(result.placed.bottom.hand, 0)
              assert.equal(result.placed.bottom.support[0].rested, true)
              assert.deepEqual(result.placed.bottom.battle, result.before.bottom.battle)
              assert.equal(result.placed.bottom.trash, scenario === 'replaced' ? 1 : 0)
              assert.equal(result.placed.bottom.stage, cards.find(card => card.cardNumber === 'BS12-011').imageUrl)
              assert.equal(await page.locator('.effect-panel:not(.is-complete):visible').count(), 0)
            }
          }
        }
        if (!blocked.includes(scenario) && scenario !== 'cancel') {
          await page.getByRole('button', { name: '結束主要階段', exact: true }).click()
          assert.equal(await page.locator('.effect-panel:not(.is-complete):visible').count(), 0)
          await page.getByRole('button', { name: '結束回合', exact: true }).click()
          if (scenario === 'removed') {
            assert.equal(await page.locator('.effect-panel:not(.is-complete):visible').count(), 0)
            result.after = await state(page)
            assert.deepEqual(result.after.bottom.battle, result.before.bottom.battle)
            result.trace = await trace(page)
            assert.ok(result.trace.every(entry => entry.commandKind === 'play-stage'))
          } else {
            const panel = page.locator('.effect-panel:not(.is-complete):visible')
            await panel.waitFor()
            assert.match(await panel.innerText(), /回合結束效果/)
            assert.match(await panel.innerText(), /BS12-011/)
            assert.match(await panel.innerText(), /Arena.*可選 0 張/s)
            await panel.locator('.effect-source-card .card-face img').evaluate(image => image.decode())
            const targets = panel.locator('.effect-candidates-target .effect-candidate-entry > button')
            const names = await targets.allTextContents()
            const expected = scenario === 'no-target' ? [] : scenario === 'mic-equipped' ? ['Pancake Cookie'] : scenario === 'non-arena' ? ['Cheerleader Cookie'] : ['Cheerleader Cookie', 'Pancake Cookie']
            assert.equal(names.length, expected.length)
            names.forEach((name, index) => assert.ok(name.includes(expected[index])))
            result.candidates = expected
            const selected = ['green', 'max', 'mic-equipped', 'rested-stage'].includes(scenario) ? 'Pancake Cookie' : 'Cheerleader Cookie'
            if (!['zero', 'no-target'].includes(scenario)) {
              await targets.filter({ hasText: selected }).click()
              if (scenario === 'deselect') await targets.filter({ hasText: selected }).click()
              if (scenario === 'max') {
                await targets.filter({ hasText: 'Cheerleader Cookie' }).click()
                assert.equal(await targets.filter({ hasText: 'Cheerleader Cookie' }).getAttribute('aria-pressed'), 'false')
                assert.equal(await targets.filter({ hasText: selected }).getAttribute('aria-pressed'), 'true')
              }
            }
            result.selection = await panel.innerText()
            await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-selection.png`) })
            await panel.getByRole('button', { name: '確認發動', exact: true }).click()
            await panel.waitFor({ state: 'hidden' })
            const noOp = ['zero', 'no-target', 'deselect'].includes(scenario)
            result.resultText = await page.locator('.effect-panel.is-complete:visible').innerText()
            assert.match(result.resultText, noOp ? /未選擇餅乾，未將任何餅乾設為活躍/ : new RegExp(`${selected} 已設為活躍`))
            await settle(page)
            result.after = await state(page)
            const baseline = result.placed ?? result.before
            assert.deepEqual(result.after.bottom.battle.map(card => card.hp), baseline.bottom.battle.map(card => card.hp))
            assert.deepEqual(result.after.bottom.battle.map(card => card.rested), noOp ? baseline.bottom.battle.map(card => card.rested) : selected === 'Pancake Cookie' ? [baseline.bottom.battle[0].rested, false] : [false, true])
            assert.deepEqual(result.after.top, baseline.top)
            for (const key of ['deck', 'hand', 'support', 'trash', 'stage']) assert.deepEqual(result.after.bottom[key], baseline.bottom[key])
            result.trace = await trace(page)
            assert.deepEqual(result.trace.map(entry => entry.commandKind), ['play-stage', 'resolve-ability-effect'])
            assert.match(result.trace[0].steps.join(' '), /支付.*Langue de Chat Cookie/)
            assert.match(result.trace[1].steps.join(' '), noOp ? /選擇 0 個目標/ : new RegExp(selected))
            await page.getByRole('button', { name: '結束回合', exact: true }).click()
            await settle(page)
            assert.equal(await page.locator('.effect-panel:not(.is-complete):visible').count(), 0)
            assert.match(await page.title(), /對手回合/)
          }
        }
      }
      await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-result.png`) })
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
      result.status = 'PASS'
    } catch (error) {
      result.error = String(error.stack ?? error)
      result.dom = await page.locator('body').innerText().catch(() => '')
      await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-failure.png`) }).catch(() => {})
      results.push(result)
      writeFileSync(resolve(out, 'results.json'), JSON.stringify(results, null, 2))
      throw error
    } finally { await page.close() }
    results.push(result)
    writeFileSync(resolve(out, 'results.json'), JSON.stringify(results, null, 2))
    console.log(`PASS ${scenario} ${viewport.width}x${viewport.height}`)
  }
} finally { await browser.close() }
console.log(`BS12-011 Browser ${results.filter(result => result.status === 'PASS').length}/${results.length}`)
