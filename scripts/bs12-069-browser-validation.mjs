import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-069-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const references = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...references].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const fixtures = ['positive', 'green-arena', 'red-arena', 'yellow-arena', 'non-arena', 'level-one', 'level-three', 'arena-item', 'top-only', 'short-deck', 'refresh-defeat', 'no-refresh-cookie', 'empty-deck', 'no-energy', 'one-energy', 'wrong-energy', 'mixed-energy', 'rested-energy', 'opponent-turn', 'outside-main', 'target-faints', 'target-rested', 'flip']
const cases = [...fixtures, 'zero-target', 'other-target', 'cancel-payment', 'cancel-paid-draft', 'payment-deselect', 'target-deselect', 'target-max', 'change-target', 'source-detail']
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return { hand: field.querySelectorAll('.hand-card-wrap').length, deck: Number(field.querySelector('.deck-zone .resource-summary>strong')?.textContent), trash: Number(field.querySelector('.discard-zone.resource-summary>strong')?.textContent),
      support: [...field.querySelectorAll('.support-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), rested: n.querySelector('.card-face').classList.contains('is-rested') })),
      battle: [...field.querySelectorAll('.combat-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]), rested: n.querySelector('.card-face').classList.contains('is-rested') })),
      breakLevel: Number(field.querySelector('.break-zone .zone-heading strong')?.textContent.match(/LV\. (\d+)/)?.[1]) }
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
    const row = { scenario, viewport, number: 'BS12-069', printedSourceAttested: true, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const physicalRoute = (fixtures.includes(scenario) ? scenario : 'positive')
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'positive' ? 'card:'+'BS12-069' : process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'non-arena' ? 'card-negative:'+'BS12-069' : 'bs12-069:'+physicalRoute
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-001,BS12-002,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-019,BS12-021,BS12-027,BS12-028,BS12-029,BS12-030,BS12-031,BS12-040,BS12-046,BS12-058,BS12-059,BS12-060,BS12-061,BS12-064,BS12-069,BS12-070,BS12-071,BS12-072,BS12-073,BS3-082,BS6-008,BS6-017,BS7-061,ST4-001'+'')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      row.before = await state(page)
      const source = page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-069-item"]')
      await source.locator('button.card-face').click()
      const use = source.getByRole('button', { name: '使用', exact: true })
      if (['empty-deck', 'no-energy', 'one-energy', 'wrong-energy', 'mixed-energy', 'rested-energy', 'opponent-turn', 'outside-main'].includes(scenario)) {
        if (await use.count()) assert.equal(await use.isEnabled(), false)
        assert.equal(await page.locator('.effect-panel:not(.is-complete)').count(), 0)
        assert.deepEqual(await state(page), row.before)
        assert.deepEqual(await trace(page),[{commandKind:'deploy-cookie',steps:[]},{commandKind:'skip-on-play',steps:[]}])
      } else {
        if (scenario === 'source-detail') {
          await source.getByRole('button', { name: '詳情', exact: true }).click()
          const detail = page.getByRole('dialog', { name: 'Pop Pop Photocard 卡牌詳情', exact: true })
          await detail.waitFor()
          assert.match(await detail.innerText(), /Reveal 1 card.*bottom.*LV.2.*Arena.*damage/s)
          await detail.locator('img').first().evaluate(i => i.decode())
          await shot('detail')
          await detail.getByRole('button', { name: '關閉', exact: true }).click()
          assert.deepEqual(await state(page), row.before)
          await source.locator('button.card-face').click()
        }
        await use.click()
        const panel = page.locator('.effect-panel:not(.is-complete)')
        await panel.waitFor()
        const payment = panel.locator('.effect-candidates-payment .effect-candidate-entry>button')
        const pay = panel.getByRole('button', { name: '確認發動', exact: true })
        assert.equal(await payment.count(), 2)
        assert.equal(await pay.isEnabled(), false)
        assert.equal(await panel.locator('img').first().getAttribute('src'), cards.find(c => c.cardNumber === 'BS12-069').imageUrl)
        if (scenario !== 'cancel-payment') {
          await payment.nth(0).click()
          assert.equal(await pay.isEnabled(), false)
          await payment.nth(1).click()
          if (scenario === 'payment-deselect') { await payment.nth(1).click(); assert.equal(await pay.isEnabled(), false); await payment.nth(1).click() }
          assert.equal(await pay.isEnabled(), true)
        }
        assert.deepEqual(await trace(page),[{commandKind:'deploy-cookie',steps:[]},{commandKind:'skip-on-play',steps:[]}])
        if (['cancel-payment', 'cancel-paid-draft'].includes(scenario)) {
          await panel.getByRole('button', { name: '取消技能', exact: true }).click()
          assert.deepEqual(await state(page), row.before)
          assert.deepEqual(await trace(page),[{commandKind:'deploy-cookie',steps:[]},{commandKind:'skip-on-play',steps:[]}])
        } else {
          await pay.click()
          const reveal = page.locator('.card-reveal-modal:visible')
          await reveal.waitFor()
          row.opened = await state(page)
          assert.equal(row.opened.bottom.hand, 0)
          assert.equal(row.opened.bottom.deck, row.before.bottom.deck)
          assert.equal(row.opened.bottom.trash, row.before.bottom.trash + 1)
          assert.equal(row.opened.bottom.support.every(s => s.rested), true)
          assert.deepEqual(row.opened.bottom.battle, row.before.bottom.battle)
          assert.deepEqual(row.opened.top, row.before.top)
          const mismatch = ['non-arena', 'level-one', 'level-three', 'arena-item', 'top-only'].includes(scenario)
          const number = scenario === 'green-arena' ? 'BS12-040' : scenario === 'red-arena' ? 'BS12-002' : scenario === 'yellow-arena' ? 'BS12-021'
            : ['non-arena', 'top-only'].includes(scenario) ? 'ST4-001' : scenario === 'level-one' ? 'BS12-061' : scenario === 'level-three' ? 'BS12-019' : scenario === 'arena-item' ? 'BS12-027' : 'BS12-060'
          assert.match(await reveal.innerText(), /Pop Pop Photocard — 展示牌庫底/)
          assert.match(await reveal.innerText(), mismatch ? /條件未匹配/ : /條件匹配/)
          assert.equal(await reveal.locator('img').getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
          await reveal.locator('img').evaluate(i => i.decode())
          await shot('public-bottom')
          await reveal.getByRole('button', { name: '確認並繼續', exact: true }).click()
          const refresh = ['short-deck', 'refresh-defeat'].includes(scenario)
          if (refresh) {
            const modal = page.locator('.decision-modal:visible')
            await modal.waitFor()
            row.beforeRefresh = await state(page)
            assert.equal(row.beforeRefresh.bottom.hand, 1)
            assert.equal(row.beforeRefresh.bottom.deck, 0)
            assert.deepEqual(row.beforeRefresh.top, row.before.top)
            await shot('refresh-before-damage')
            await modal.getByRole('button').filter({ hasText: 'Sour Belt Cookie' }).click()
          }
          if (['refresh-defeat', 'no-refresh-cookie'].includes(scenario)) {
            await page.locator('.result-modal').waitFor()
            row.after = await state(page)
            assert.equal(row.after.bottom.hand, 1)
            assert.deepEqual(row.after.top, row.before.top)
            assert.equal((await trace(page)).filter(e => e.commandKind === 'resolve-ability-effect').length, 1)
          } else {
            if (!mismatch) {
              await panel.waitFor()
              row.returned = await state(page)
              assert.equal(row.returned.bottom.hand, 1)
              assert.equal(row.returned.bottom.deck, refresh ? 8 : row.before.bottom.deck - 1)
              assert.deepEqual(row.returned.top, row.before.top)
              assert.match(await panel.innerText(), /物品效果/)
              assert.match(await panel.locator('.effect-source-description').innerText(), /Reveal 1 card.*bottom.*That Cookie receives 1 damage/s)
              assert.equal(await panel.locator('img').first().getAttribute('src'), cards.find(c => c.cardNumber === 'BS12-069').imageUrl)
              const targets = panel.getByRole('button').filter({ hasText: /AI 對手・戰鬥區/ })
              assert.equal(await targets.count(), 2)
              if (scenario !== 'zero-target') await targets.nth(scenario === 'other-target' ? 1 : 0).click()
              if (scenario === 'target-deselect') { await targets.nth(0).click(); await targets.nth(0).click() }
              if (scenario === 'target-max') { await targets.nth(1).click(); assert.equal(await targets.filter({ hasText: '已選取' }).count(), 1); assert.match(await targets.nth(0).innerText(), /已選取/) }
              if (scenario === 'change-target') { await targets.nth(0).click(); await targets.nth(1).click() }
              assert.deepEqual(await state(page), row.returned)
              await shot('damage-draft')
              await panel.getByRole('button', { name: '確認發動', exact: true }).click()
            }
            const expectedHp = scenario === 'target-faints' ? [4] : mismatch || scenario === 'zero-target' ? [6, 4] : ['other-target', 'change-target'].includes(scenario) ? [6, 3] : [5, 4]
            await page.waitForFunction(expected => {
              const hp = [...document.querySelectorAll('.top-field .combat-card-wrap .hp-card-stack')].map(n => Number(n.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]))
              return JSON.stringify(hp) === JSON.stringify(expected) && !document.querySelector('.effect-panel:not(.is-complete)') && !document.querySelector('.decision-modal')
            }, expectedHp)
            if (scenario === 'flip') await page.waitForFunction(() =>
              document.querySelectorAll('.top-field .hand-card-wrap').length === 2 &&
              Number(document.querySelector('.top-field .deck-zone .resource-summary>strong')?.textContent) === 11 &&
              Number(document.querySelector('.top-field .discard-zone.resource-summary>strong')?.textContent) === 1)
            await settle(page)
            row.after = await state(page)
            assert.equal(row.after.bottom.hand, mismatch ? 0 : 1)
            assert.equal(row.after.bottom.deck, mismatch ? row.before.bottom.deck : refresh ? 8 : row.before.bottom.deck - 1)
            assert.deepEqual(row.after.bottom.battle, row.before.bottom.battle)
            assert.deepEqual(row.after.bottom.support, row.opened.bottom.support)
            assert.deepEqual(row.after.top.battle.map(c => c.hp), expectedHp)
            assert.equal(row.after.top.breakLevel, scenario === 'target-faints' ? 1 : 0)
            const kinds = (await trace(page)).map(e => e.commandKind)
            assert.ok(kinds.indexOf('begin-play-item') < kinds.indexOf('resolve-reveal-top-deck'))
            if (!mismatch) assert.ok(kinds.indexOf('resolve-reveal-top-deck') < kinds.lastIndexOf('resolve-ability-effect'))
            if (refresh) assert.ok(kinds.indexOf('refresh-deck') < kinds.lastIndexOf('resolve-ability-effect'))
            if (scenario === 'flip') {
              assert.ok(kinds.includes('resolve-flip'))
              assert.ok(kinds.includes('resolve-draw-up-to'))
              assert.equal(row.after.top.hand, 2)
              assert.equal(row.after.top.deck, 11)
            }
          }
        }
      }
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
      console.log(`PASS BS12-069 ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { row.error = String(error.stack ?? error); row.trace = await trace(page); row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { rows.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)); await page.close() }
  }
  console.log(`BS12-069 Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
