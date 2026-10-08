import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-070-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const references = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...references].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const fixtures = ['positive', 'green-arena', 'red-arena', 'yellow-arena', 'non-arena', 'level-one', 'level-three', 'arena-item', 'top-only', 'short-deck', 'refresh-defeat', 'no-refresh-cookie', 'empty-deck', 'no-energy', 'one-energy', 'wrong-energy', 'mixed-energy', 'rested-energy', 'opponent-turn', 'outside-main', 'target-faints', 'target-rested', 'source-rested', 'single-opponent', 'other-faints', 'flip', 'ordinary-flip', 'protected', 'all-protected', 'short-all-protected']
const cases = [...fixtures, 'skip-then', 'back-then', 'cancel-payment', 'cancel-target', 'payment-deselect', 'target-deselect', 'reverse-order']
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
const waitDone = (page, expected) => page.waitForFunction(hp => JSON.stringify([...document.querySelectorAll('.top-field .combat-card-wrap .hp-card-stack')].map(n => Number(n.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]))) === JSON.stringify(hp) && !document.querySelector('[role="alertdialog"]') && [...document.querySelectorAll('button')].some(n => n.textContent?.includes('結束主要階段') && !n.disabled), expected)
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const rows = []
try {
  for (const number of (process.env.BS12_BROWSER_PRINTS ?? 'BS12-070').split(',')) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const row = { number, scenario, viewport, printedSourceAttested: true, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const physicalRoute = (fixtures.includes(scenario) ? scenario : 'positive')
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'positive' ? 'card:'+number : process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'non-arena' ? 'card-negative:'+number : 'bs12-070:'+number+':'+physicalRoute
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-001,BS12-002,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-019,BS12-021,BS12-027,BS12-028,BS12-029,BS12-030,BS12-031,BS12-040,BS12-046,BS12-058,BS12-059,BS12-060,BS12-061,BS12-064,BS12-069,BS12-070,BS12-071,BS12-072,BS12-073,BS3-082,BS6-008,BS6-017,BS7-061,ST4-001'+','+number)
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      row.before = await state(page)
      const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-070-source"]')
      await source.locator('img').first().evaluate(i => i.decode())
      assert.equal(await source.locator('img').first().getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
      if (['no-energy', 'one-energy', 'wrong-energy', 'mixed-energy', 'rested-energy', 'opponent-turn', 'outside-main', 'source-rested'].includes(scenario)) {
        assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
        assert.deepEqual(await state(page), row.before)
        assert.deepEqual(await trace(page), [])
      } else {
        await source.locator('.card-face.is-attackable').click()
        const support = page.locator('.bottom-field .support-card-wrap .card-face')
        if (scenario !== 'cancel-payment') {
          await support.nth(0).click({ position: { x: 10, y: 25 } })
          assert.equal(await page.getByRole('button', { name: /^選擇攻擊目標/ }).count(), 0)
          await support.nth(1).click({ position: { x: 10, y: 25 } })
          if (scenario === 'payment-deselect') { await support.nth(1).click({ position: { x: 10, y: 25 } }); assert.equal(await page.getByRole('button', { name: /^選擇攻擊目標/ }).count(), 0); await support.nth(1).click({ position: { x: 10, y: 25 } }) }
        }
        assert.deepEqual(await trace(page), [])
        if (['cancel-payment', 'cancel-target'].includes(scenario)) {
          await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
          assert.deepEqual(await state(page), row.before)
          assert.deepEqual(await trace(page), [])
        } else {
          await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-064-opponent"]').getByRole('button', { name: /^選擇攻擊目標/ }).click()
          const ordinaryHp = ['all-protected','short-all-protected'].includes(scenario) ? [1,3] : scenario === 'protected' ? [4,3] : scenario === 'target-faints' ? [4] : scenario === 'single-opponent' ? [4] : scenario === 'other-faints' ? [4, 1] : [4, 4]
          const panel = page.getByRole('alertdialog')
          if (scenario === 'empty-deck') {
            await waitDone(page, ordinaryHp)
            row.after = await state(page)
            assert.equal(row.after.bottom.hand, 0)
            assert.equal(row.after.bottom.deck, 0)
            assert.equal((await trace(page)).filter(e => e.commandKind === 'resolve-optional-cost-attack').length, 0)
          } else {
            await panel.getByRole('button', { name: '支付', exact: true }).waitFor()
            await settle(page)
            row.ordinary = await state(page)
            assert.deepEqual(row.ordinary.top.battle.map(c => c.hp), ordinaryHp)
            assert.equal(row.ordinary.bottom.battle[0].rested, true)
            assert.ok(row.ordinary.bottom.support.every(s => s.rested))
            assert.equal(row.ordinary.bottom.hand, 0)
            assert.equal(row.ordinary.bottom.deck, row.before.bottom.deck)
            assert.match(await panel.innerText(), /代價：展示 1 張牌庫底卡/)
            if (scenario === 'skip-then') {
              await panel.getByRole('button', { name: '略過', exact: true }).click()
              await waitDone(page, ordinaryHp)
              row.after = await state(page)
              assert.deepEqual(row.after.bottom, row.ordinary.bottom)
              assert.deepEqual(row.after.top, row.ordinary.top)
              assert.equal((await trace(page)).filter(e => e.commandKind === 'resolve-reveal-top-deck').length, 0)
            } else {
              await panel.getByRole('button', { name: '支付', exact: true }).click()
              assert.deepEqual(await state(page), row.ordinary)
              if (scenario === 'back-then') {
                await panel.getByRole('button', { name: '返回', exact: true }).click()
                assert.deepEqual(await state(page), row.ordinary)
                await panel.getByRole('button', { name: '支付', exact: true }).click()
              }
              await panel.getByRole('button', { name: '確認', exact: true }).click()
              const reveal = page.locator('.card-reveal-modal:visible')
              await reveal.waitFor()
              assert.deepEqual(await state(page), row.ordinary)
              const mismatch = ['non-arena', 'level-one', 'level-three', 'arena-item', 'top-only'].includes(scenario)
              assert.match(await reveal.innerText(), mismatch ? /條件未匹配/ : /條件匹配/)
              await reveal.locator('img').first().evaluate(i => i.decode())
              await shot('public-bottom')
              await reveal.getByRole('button', { name: '確認並繼續', exact: true }).click()
              const refresh = ['short-deck', 'refresh-defeat', 'short-all-protected'].includes(scenario)
              if (refresh) {
                const modal = page.locator('.decision-modal:visible')
                await modal.waitFor()
                row.beforeRefresh = await state(page)
                assert.equal(row.beforeRefresh.bottom.hand, 1)
                assert.equal(row.beforeRefresh.bottom.deck, 0)
                assert.deepEqual(row.beforeRefresh.top, row.ordinary.top)
                await shot('refresh-before-damage')
                await modal.getByRole('button').filter({ hasText: 'Sour Belt Cookie' }).click()
              }
              if (['refresh-defeat', 'no-refresh-cookie'].includes(scenario)) {
                await page.locator('.result-modal').waitFor()
                row.after = await state(page)
                assert.equal(row.after.bottom.hand, 1)
                assert.deepEqual(row.after.top, row.ordinary.top)
                assert.equal((await trace(page)).filter(e => e.commandKind === 'resolve-ability-effect').length, 0)
              } else {
                const noDamage = mismatch || ['all-protected', 'short-all-protected'].includes(scenario)
                if (!noDamage) {
                  await panel.getByRole('button', { name: '確認發動', exact: true }).waitFor()
                  row.returned = await state(page)
                  assert.equal(row.returned.bottom.hand, 1)
                  assert.equal(row.returned.bottom.deck, refresh ? 7 : row.before.bottom.deck - 1)
                  assert.deepEqual(row.returned.top, row.ordinary.top)
                  assert.match(await panel.innerText(), /攻擊後續效果/)
                  assert.match(await panel.locator('.effect-source-attack-follow-up').innerText(), /reveal 1 card.*bottom.*all of your opponent.*damage/s)
                  assert.equal(await panel.locator('img').first().getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
                  assert.equal(await panel.getByText('Activate 啟動', { exact: true }).count(), 0)
                  const targets = panel.getByRole('button').filter({ hasText: /AI 對手・戰鬥區/ })
                  const count = ['target-faints', 'single-opponent', 'protected'].includes(scenario) ? 1 : 2
                  assert.equal(await targets.count(), count)
                  const confirm = panel.getByRole('button', { name: '確認發動', exact: true })
                  assert.equal(await confirm.isEnabled(), false)
                  const order = scenario === 'reverse-order' ? [1, 0] : count === 1 ? [0] : [0, 1]
                  for (const i of order) {
                    await targets.nth(i).click()
                    if (count === 2 && i === order[0]) assert.equal(await confirm.isEnabled(), false)
                  }
                  if (scenario === 'target-deselect') { await targets.nth(0).click(); assert.equal(await confirm.isEnabled(), false); await targets.nth(0).click() }
                  assert.deepEqual(await state(page), row.returned)
                  await shot('all-targets-draft')
                  await confirm.click()
                }
                const expectedHp = noDamage ? ordinaryHp : ['target-faints', 'single-opponent', 'other-faints'].includes(scenario) ? [3] : scenario === 'protected' ? [3, 3] : [3, 3]
                await waitDone(page, expectedHp)
                if (['flip', 'ordinary-flip'].includes(scenario)) await page.waitForFunction(() => document.querySelectorAll('.top-field .hand-card-wrap').length === 2 && Number(document.querySelector('.top-field .deck-zone .resource-summary>strong')?.textContent) === 11)
                await settle(page)
                row.after = await state(page)
                assert.equal(row.after.bottom.hand, mismatch ? 0 : 1)
                assert.equal(row.after.bottom.deck, mismatch ? row.before.bottom.deck : refresh ? 7 : row.before.bottom.deck - 1)
                assert.equal(row.after.bottom.battle[0].hp, 2)
                assert.deepEqual(row.after.bottom.support, row.ordinary.bottom.support)
                assert.equal(row.after.top.breakLevel, scenario === 'target-faints' ? 2 : scenario === 'other-faints' ? 1 : 0)
                const kinds = (await trace(page)).map(e => e.commandKind)
                assert.ok(kinds.indexOf('declare-attack') < kinds.indexOf('resolve-optional-cost-attack'))
                assert.ok(kinds.indexOf('resolve-optional-cost-attack') < kinds.indexOf('resolve-reveal-top-deck'))
                if (!noDamage) assert.ok(kinds.indexOf('resolve-reveal-top-deck') < kinds.indexOf('resolve-ability-effect'))
                if (refresh) assert.ok(kinds.indexOf('resolve-reveal-top-deck') < kinds.indexOf('refresh-deck'))
                if (refresh && !noDamage) assert.ok(kinds.indexOf('refresh-deck') < kinds.indexOf('resolve-ability-effect'))
                if (['flip', 'ordinary-flip'].includes(scenario)) { assert.ok(kinds.includes('resolve-flip')); assert.ok(kinds.includes('resolve-draw-up-to')) }
              }
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
      console.log(`PASS ${number} ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { row.error = String(error.stack ?? error); row.trace = await trace(page); row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { rows.push(row); writeFileSync(resolve(out, `${process.env.BS12_BROWSER_CASES ? 'subset' : 'results'}-${number}.json`), JSON.stringify(rows.filter(r => r.number === number), null, 2)); await page.close() }
  }
  console.log(`BS12-070 Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
