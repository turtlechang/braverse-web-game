import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-068-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/cards/official-festival-arena-bs12.en.json'),'utf8')).cards
const references = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...references].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const fixtures = ['positive', 'difference-one', 'equal-support', 'more-own', 'large-gap', 'all-opponent-rested', 'non-cookie-support', 'no-energy', 'wrong-energy', 'rested-energy', 'opponent-turn', 'outside-main', 'short-deck', 'refresh-defeat', 'empty-deck', 'no-refresh-cookie']
const cases = [...fixtures, 'draw-zero', 'return-zero', 'return-one', 'change-draw', 'cancel-energy', 'cancel-paid-draft', 'payment-deselect', 'support-deselect', 'support-max', 'support-change', 'source-detail', 'empty-draw-one']
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return { deck: Number(field.querySelector('.deck-zone .resource-summary>strong')?.textContent), hand: field.querySelectorAll('.hand-card-wrap').length,
      trash: Number(field.querySelector('.discard-zone.resource-summary>strong')?.textContent),
      support: [...field.querySelectorAll('.support-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), rested: n.querySelector('.card-face').classList.contains('is-rested') })),
      battle: [...field.querySelectorAll('.combat-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]), rested: n.querySelector('.card-face').classList.contains('is-rested') })) }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, steps: e.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]'), null, { timeout: 20000 })
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const rows = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const row = { number: 'BS12-068', scenario, viewport, printedSourceAttested: true, errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const routeCase = (fixtures.includes(scenario) ? scenario : scenario === 'empty-draw-one' ? 'empty-deck' : 'positive')
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && routeCase === 'positive' ? 'card:BS12-068' : process.env.BS12_BROWSER_ROUTE === 'generic' && routeCase === 'difference-one' ? 'card-negative:BS12-068' : 'bs12-068:'+routeCase
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-001,BS12-002,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-019,BS12-021,BS12-027,BS12-028,BS12-029,BS12-030,BS12-031,BS12-040,BS12-046,BS12-059,BS12-060,BS12-061,BS12-064,BS12-065,BS12-066,BS12-067,BS12-068,BS6-008,BS7-061,ST4-001')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      row.before = await state(page)
      const source = page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-068-item"]')
      await source.locator('button.card-face').click()
      const use = source.getByRole('button', { name: '使用', exact: true })
      if (['no-energy', 'wrong-energy', 'rested-energy', 'opponent-turn', 'outside-main'].includes(scenario)) {
        if (await use.count()) assert.equal(await use.isEnabled(), false)
        assert.equal(await page.locator('.effect-panel:not(.is-complete)').count(), 0)
        assert.deepEqual(await state(page), row.before)
        assert.deepEqual(await trace(page), [{commandKind:'deploy-cookie',steps:[]},{commandKind:'skip-on-play',steps:[]}])
      } else {
        if (scenario === 'source-detail') {
          await source.getByRole('button', { name: '詳情', exact: true }).click()
          const detail = page.getByRole('dialog', { name: 'Bone-afide Multivitamin Jelly 卡牌詳情', exact: true })
          await detail.waitFor()
          assert.match(await detail.innerText(), /Draw up to 1.*2 or more cards less.*return up to 2/s)
          await detail.locator('img').first().evaluate(i => i.decode())
          await detail.getByRole('button', { name: '關閉', exact: true }).click()
          assert.deepEqual(await state(page), row.before)
          await source.getByRole('button', { name: 'Bone-afide Multivitamin Jelly', exact: true }).click()
        }
        await use.click()
        const panel = page.locator('.effect-panel:not(.is-complete)')
        await panel.waitFor()
        const pay = panel.getByRole('button', { name: '確認發動', exact: true })
        assert.equal(await pay.isEnabled(), false)
        const payment = panel.locator('.effect-candidates-payment .effect-candidate-entry>button')
        assert.equal(await payment.count(), 1)
        assert.equal(await panel.locator('img').first().getAttribute('src'), cards.find(c => c.cardNumber === 'BS12-068').imageUrl)
        await panel.locator('img').first().evaluate(i => i.decode())
        if (scenario !== 'cancel-energy') {
          await payment.click()
          if (scenario === 'payment-deselect') { await payment.click(); assert.equal(await pay.isEnabled(), false); await payment.click() }
          const draft = await state(page)
          assert.deepEqual(draft, { ...row.before, bottom: { ...row.before.bottom, support: row.before.bottom.support.map(s => ({ ...s, rested: true })) } })
        }
        if (['cancel-energy', 'cancel-paid-draft'].includes(scenario)) {
          await panel.getByRole('button', { name: '取消技能', exact: true }).click()
          assert.deepEqual(await state(page), row.before)
          assert.deepEqual(await trace(page), [{commandKind:'deploy-cookie',steps:[]},{commandKind:'skip-on-play',steps:[]}])
        } else {
          await pay.click()
          const drawModal = page.locator('.draw-up-to-modal:visible')
          await drawModal.waitFor()
          row.paid = await state(page)
          assert.equal(row.paid.bottom.hand, 0)
          assert.equal(row.paid.bottom.trash, row.before.bottom.trash + 1)
          assert.equal(row.paid.bottom.deck, row.before.bottom.deck)
          assert.deepEqual(row.paid.top, row.before.top)
          assert.deepEqual(row.paid.bottom.support, row.before.bottom.support.map(s => ({ ...s, rested: true })))
          const drawCount = ['draw-zero', 'change-draw', 'empty-deck'].includes(scenario) ? 0 : 1
          assert.equal(await drawModal.locator('.draw-up-to-option').count(), 2)
          if (scenario === 'change-draw') { await drawModal.getByRole('button', { name: /^抽 1 張/ }).click(); await drawModal.getByRole('button', { name: '不抽', exact: true }).click(); assert.deepEqual(await state(page), row.paid) }
          else await drawModal.getByRole('button', { name: drawCount ? /^抽 1 張/ : '不抽', exact: drawCount === 0 }).click()
          await shot('draw')
          await drawModal.getByRole('button', { name: drawCount ? '抽取 1 張牌' : '略過抽牌', exact: true }).click()
          await drawModal.waitFor({ state: 'hidden' })
          await settle(page)
          const refresh = ['short-deck', 'refresh-defeat', 'empty-deck', 'empty-draw-one'].includes(scenario)
          if (refresh) {
            const decision = page.locator('.decision-modal:visible')
            await decision.waitFor()
            row.beforeRefresh = await state(page)
            assert.deepEqual(row.beforeRefresh.top, row.before.top)
            assert.equal(row.beforeRefresh.bottom.hand, scenario === 'empty-draw-one' ? 0 : drawCount)
            assert.equal(row.beforeRefresh.bottom.deck, 0)
            await decision.getByRole('button', { name: /^Sour Belt Cookie/ }).click()
            await settle(page)
          }
          if (['refresh-defeat', 'no-refresh-cookie'].includes(scenario)) {
            await page.locator('.result-modal').waitFor()
            row.after = await state(page)
            assert.deepEqual(row.after.top, row.before.top)
          } else {
            await panel.waitFor()
            row.beforeReturn = await state(page)
            assert.equal(row.beforeReturn.bottom.hand, drawCount)
            assert.equal(row.beforeReturn.bottom.deck, refresh ? scenario === 'empty-draw-one' ? 7 : 8 : row.before.bottom.deck - drawCount)
            assert.deepEqual(row.beforeReturn.top, row.before.top)
            const targets = panel.locator('.effect-candidates-target .effect-candidate-entry>button')
            const falseCondition = ['difference-one', 'equal-support', 'more-own'].includes(scenario)
            const returnCount = falseCondition || scenario === 'return-zero' ? 0 : scenario === 'return-one' ? 1 : 2
            if (falseCondition) { assert.equal(await targets.count(), 0); assert.match(await panel.innerText(), /目前條件不成立/) }
            else {
              assert.equal(await targets.count(), row.before.top.support.length)
              assert.equal(await panel.getByRole('button', { name: /^Candy Diver Cookie Candy Diver Cookie/ }).count(), 0)
              assert.match(await panel.innerText(), /對手最多2 張支援區卡返回對手手牌/)
            }
            const indices = returnCount === 2 && scenario === 'non-cookie-support' ? [0, 2] : Array.from({ length: returnCount }, (_, i) => i)
            for (const index of indices) await targets.nth(index).click()
            if (scenario === 'support-deselect') { await targets.nth(1).click(); assert.equal(await panel.locator('.effect-candidates-target .effect-candidate-entry>button[aria-pressed="true"]').count(), 1); await targets.nth(1).click() }
            if (scenario === 'support-max') { await targets.nth(2).click(); assert.equal(await targets.nth(2).getAttribute('aria-pressed'), 'false') }
            if (scenario === 'support-change') { await targets.nth(1).click(); await targets.nth(2).click(); indices[1] = 2 }
            assert.deepEqual(await state(page), row.beforeReturn)
            await shot('return-draft')
            await panel.getByRole('button', { name: '確認發動', exact: true }).click()
            await panel.waitFor({ state: 'hidden' })
            await settle(page)
            row.after = await state(page)
            assert.equal(row.after.top.hand, returnCount)
            assert.deepEqual(row.after.top.support, row.before.top.support.filter((_, i) => !indices.includes(i)))
            assert.equal(row.after.top.deck, row.before.top.deck)
            assert.equal(row.after.top.trash, row.before.top.trash)
            assert.deepEqual(row.after.bottom, row.beforeReturn.bottom)
            if (falseCondition) assert.match((await trace(page)).at(-1).steps.join(' '), /條件不成立/)
          }
          const after = await state(page)
          assert.deepEqual(after.bottom.battle, row.before.bottom.battle)
          assert.deepEqual(after.top.battle, row.before.top.battle)
          const kinds = (await trace(page)).map(e => e.commandKind)
          assert.equal(kinds.filter(k => k === 'begin-play-item').length, 1)
          assert.equal(kinds.filter(k => k === 'resolve-draw-up-to').length, 1)
          assert.ok(kinds.indexOf('begin-play-item') < kinds.indexOf('resolve-draw-up-to'))
          if (refresh && scenario !== 'refresh-defeat') assert.ok(kinds.indexOf('refresh-deck') > kinds.indexOf('resolve-draw-up-to') && kinds.lastIndexOf('resolve-ability-effect') > kinds.indexOf('refresh-deck'))
        }
      }
      row.after = await state(page)
      row.trace = await trace(page)
      assert.deepEqual(row.errors, [])
      // Transient HP faces can be removed before their original-art request
      // finishes. Keep every cancellation, and require all mounted original
      // images (including payment/target/log faces) to decode successfully.
      row.mountedOriginalArt = await page.evaluate(async urls => {
        const mounted = [...document.images].filter(img => urls.includes(img.src))
        return Promise.all(mounted.map(async img => {
          await img.decode()
          if (!img.naturalWidth) throw new Error(`Original card art failed: ${img.src}`)
          return { url: img.src, alt: img.alt, naturalWidth: img.naturalWidth }
        }))
      }, cards.map(card => card.imageUrl))
      row.cancelledOriginalImageRequests = row.networkFailures.filter(entry =>
        entry.resourceType === 'image' && entry.error === 'net::ERR_ABORTED' && cards.some(card => card.imageUrl === entry.url))
      row.networkFailures = row.networkFailures.filter(entry => !row.cancelledOriginalImageRequests.includes(entry))
      assert.deepEqual(row.networkFailures, [])
      await shot('result')
      row.status = 'PASS'
      console.log(`PASS BS12-068 ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { row.error = String(error.stack ?? error); row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { rows.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)); await page.close() }
  }
  console.log(`BS12-068 Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
