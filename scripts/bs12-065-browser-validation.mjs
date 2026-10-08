import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-065-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const references = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...references].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const fixtures = ['positive', 'green-arena', 'red-arena', 'yellow-arena', 'non-arena', 'level-one', 'level-three', 'arena-item', 'no-hand', 'short-deck', 'empty-deck', 'no-energy', 'wrong-energy', 'rested-energy', 'disabled', 'used', 'main', 'draw-zero', 'skip-then', 'zero-target', 'other-target', 'cancel-payment', 'cancel-target', 'cancel-then']
const cases = [...fixtures, 'payment-deselect', 'target-deselect', 'target-max', 'back-energy', 'cost-deselect', 'draw-switch']
const route = s => fixtures.includes(s) ? s : 'positive'
const readState = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return { deck: Number(field.querySelector('.deck-zone .resource-summary>strong')?.textContent), trash: Number(field.querySelector('.discard-zone.resource-summary>strong')?.textContent), hand: field.querySelectorAll('.hand-card').length,
      battle: [...field.querySelectorAll('.combat-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]), attack: Number(n.querySelector('.badge-atk')?.textContent), rested: n.querySelector('.card-face').classList.contains('is-rested') })),
      support: [...field.querySelectorAll('.support-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), rested: n.querySelector('.card-face').classList.contains('is-rested') })) }
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
    const row = { number: 'BS12-065', scenario, viewport, printedSourceAttested: !['disabled','used'].includes(scenario), errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const routeCase = route(scenario)
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && routeCase === 'positive' ? 'card:BS12-065' : process.env.BS12_BROWSER_ROUTE === 'generic' && routeCase === 'non-arena' ? 'card-negative:BS12-065' : 'bs12-065:'+routeCase
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-001,BS12-002,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-019,BS12-021,BS12-027,BS12-028,BS12-029,BS12-030,BS12-031,BS12-040,BS12-046,BS12-059,BS12-060,BS12-061,BS12-064,BS12-065,BS12-066,BS12-067,BS12-068,BS6-008,BS7-061,ST4-001')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      row.beforeTrace = await trace(page)
      const modal = page.locator('.trap-response-modal:visible')
      if (['no-energy', 'wrong-energy', 'rested-energy', 'disabled', 'used', 'main'].includes(scenario)) {
        assert.equal(await modal.count(), 0)
        if (scenario === 'disabled') await page.getByRole('button', { name: '了解，繼續傷害結算', exact: true }).click()
        if (scenario !== 'main') await page.waitForFunction(() => document.querySelector('[data-card-instance-id="bs12-064-source"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 1 張'))
        assert.deepEqual(await trace(page), scenario === 'main' ? [{commandKind:'deploy-cookie',steps:[]},{commandKind:'skip-on-play',steps:[]}] : [...[{commandKind:'deploy-cookie',steps:[]},{commandKind:'skip-on-play',steps:[]}],{commandKind:'resolve-battle',steps:[]}])
        assert.equal((await readState(page)).bottom.hand, 2)
      } else {
        await modal.waitFor()
        assert.deepEqual(row.beforeTrace,[{commandKind:'deploy-cookie',steps:[]},{commandKind:'skip-on-play',steps:[]}])
        row.before = await readState(page)
        const trap = modal.locator('.modal-card-options>button').filter({ hasText: 'Misdelivered Fan Letter' })
        await trap.locator('img').evaluate(i => i.decode())
        assert.equal(await trap.locator('img').getAttribute('src'), cards.find(c => c.cardNumber === 'BS12-065').imageUrl)
        await trap.click()
        const next = modal.getByRole('button', { name: '下一步', exact: true })
        assert.equal(await next.isEnabled(), false)
        if (scenario !== 'cancel-payment') {
          const energy = modal.locator('.trap-guided-section .trap-discard-options>button')
          await energy.click()
          if (scenario === 'payment-deselect') { await energy.click(); assert.equal(await next.isEnabled(), false); await energy.click() }
          await next.click()
          if (scenario === 'back-energy') { await modal.getByRole('button', { name: '上一步', exact: true }).click(); await next.click() }
          const targets = modal.locator('.trap-effect-target-step .trap-target-options>button')
          assert.equal(await targets.count(), 2)
          const target = targets.filter({ hasText: scenario === 'other-target' ? 'Langue de Chat Cookie' : 'Sour Belt Cookie' })
          if (scenario !== 'zero-target') await target.click()
          if (scenario === 'target-deselect') { await target.click(); await target.click() }
          if (scenario === 'target-max') { await targets.filter({ hasText: 'Langue de Chat Cookie' }).click(); assert.equal(await modal.locator('.trap-target-options>button.is-selected').count(), 1); await target.click() }
          assert.deepEqual(await trace(page), [{commandKind:'deploy-cookie',steps:[]},{commandKind:'skip-on-play',steps:[]}])
          if (scenario === 'cancel-target') await modal.getByRole('button', { name: '不發動', exact: true }).click()
          else await modal.getByRole('button', { name: '確認發動', exact: true }).click()
        } else await modal.getByRole('button', { name: '不發動', exact: true }).click()
        if (['cancel-payment', 'cancel-target'].includes(scenario)) {
          await page.waitForFunction(() => document.querySelector('[data-card-instance-id="bs12-064-source"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 1 張'))
          const after = await readState(page)
          assert.equal(after.bottom.hand, 2)
          assert.equal(after.bottom.deck, 12)
          assert.deepEqual(after.bottom.support, row.before.bottom.support)
          assert.deepEqual(await trace(page), [...[{commandKind:'deploy-cookie',steps:[]},{commandKind:'skip-on-play',steps:[]}],{commandKind:'resolve-battle',steps:[]}])
        } else {
          await page.getByRole('button', { name: '確認發動', exact: true }).click()
          const then = page.locator('.optional-cost-attack-inline')
          await then.waitFor()
          row.opened = await readState(page)
          assert.equal(row.opened.bottom.hand, scenario === 'no-hand' ? 0 : 1)
          assert.equal(row.opened.bottom.trash, row.before.bottom.trash + 1)
          assert.deepEqual(row.opened.bottom.battle, row.before.bottom.battle)
          assert.match(await then.innerText(), /公開 1 張 LV.2 Arena 餅乾手牌.*同一張牌放入牌庫底/)
          assert.doesNotMatch(await then.innerText(), /棄置/)
          const unavailable = ['non-arena', 'level-one', 'level-three', 'arena-item', 'no-hand'].includes(scenario)
          const skip = unavailable || ['skip-then', 'cancel-then'].includes(scenario)
          if (skip) {
            assert.equal(await then.getByRole('button', { name: '支付', exact: true }).isEnabled(), !unavailable)
            if (scenario === 'cancel-then') { await then.getByRole('button', { name: '支付', exact: true }).click(); await then.locator('.modal-card-options>button').click(); await then.getByRole('button', { name: '返回', exact: true }).click(); assert.deepEqual(await readState(page), row.opened) }
            await then.getByRole('button', { name: '略過', exact: true }).click()
          } else {
            await then.getByRole('button', { name: '支付', exact: true }).click()
            const option = then.locator('.modal-card-options>button')
            const confirm = then.getByRole('button', { name: '確認', exact: true })
            assert.equal(await option.count(), 1)
            assert.equal(await confirm.isEnabled(), false)
            await option.click()
            if (scenario === 'cost-deselect') { await option.click(); assert.equal(await confirm.isEnabled(), false); await option.click() }
            assert.deepEqual(await readState(page), row.opened)
            await shot('public-cost-draft')
            await confirm.click()
            row.paid = await readState(page)
            assert.equal(row.paid.bottom.hand, 0)
            assert.equal(row.paid.bottom.deck, row.opened.bottom.deck + 1)
            assert.equal(row.paid.bottom.trash, row.opened.bottom.trash)
            await page.getByRole('button', { name: '確認發動', exact: true }).click()
            const draw = page.locator('.draw-up-to-modal:visible')
            await draw.waitFor()
            const count = scenario === 'draw-zero' ? 0 : 1
            if (scenario === 'draw-switch') { await draw.getByRole('button', { name: /^抽 1 張/ }).click(); await draw.getByRole('button', { name: '不抽', exact: true }).click(); assert.deepEqual(await readState(page), row.paid) }
            if (count) await draw.getByRole('button', { name: /^抽 1 張/ }).click()
            await draw.getByRole('button', { name: count ? '抽取 1 張牌' : '略過抽牌', exact: true }).click()
            if (scenario === 'empty-deck') {
              const refresh = page.locator('.decision-modal:visible')
              await refresh.waitFor()
              await refresh.getByRole('button').filter({ hasText: 'Sour Belt Cookie' }).click()
            }
            if (await page.getByRole('button', { name: '確認發動', exact: true }).count()) await page.getByRole('button', { name: '確認發動', exact: true }).click()
          }
          const hp = ['zero-target', 'other-target'].includes(scenario) ? 1 : 2
          await page.waitForFunction(expected => document.querySelector('[data-card-instance-id="bs12-064-source"] .hp-card-stack')?.getAttribute('aria-label')?.includes(`HP 卡 ${expected} 張`), hp)
          await settle(page)
          row.after = await readState(page)
          if (scenario !== 'empty-deck') assert.equal(row.after.bottom.deck, row.before.bottom.deck + (skip ? 0 : 1) - (!skip && scenario !== 'draw-zero' ? 1 : 0))
          assert.equal(row.after.bottom.hand, skip ? row.opened.bottom.hand : scenario === 'draw-zero' ? 0 : 1)
          assert.deepEqual(row.after.bottom.support, row.opened.bottom.support)
          assert.deepEqual(row.after.top, row.opened.top)
          const kinds = (await trace(page)).map(e => e.commandKind)
          assert.ok(kinds.indexOf('play-trap') < kinds.indexOf('resolve-optional-cost-attack'))
          if (!skip) { assert.ok(kinds.indexOf('resolve-optional-cost-attack') < kinds.indexOf('resolve-draw-up-to')); assert.match(JSON.stringify(await trace(page)), /公開手牌並將同一張牌放入牌庫底/) }
        }
      }
      await shot('result')
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
      row.status = 'PASS'
    } catch (error) {
      row.error = String(error.stack ?? error)
      row.dom = await page.locator('body').innerText().catch(() => '')
      rows.push(row)
      writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2))
      throw error
    } finally { await page.close() }
    rows.push(row)
    writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2))
    console.log(`PASS BS12-065 ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-065 Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
