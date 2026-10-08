import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-066-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const references = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...references].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const fixtures = ['positive', 'green-arena', 'red-arena', 'yellow-arena', 'non-arena', 'level-one', 'level-three', 'arena-item', 'top-only', 'short-deck', 'refresh-defeat', 'empty-deck', 'no-energy', 'wrong-energy', 'rested-energy', 'disabled', 'used', 'main', 'zero-target', 'other-target', 'cancel-payment', 'back-energy']
const cases = [...fixtures, 'payment-deselect', 'target-deselect', 'target-max', 'change-target']
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
const waitHp = (page, hp) => page.waitForFunction(n => document.querySelector('[data-card-instance-id="bs12-064-source"] .hp-card-stack')?.getAttribute('aria-label')?.includes(`HP 卡 ${n} 張`), hp)
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const rows = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const row = { number: 'BS12-066', scenario, viewport, printedSourceAttested: !['disabled','used'].includes(scenario), errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const routeCase = route(scenario)
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && routeCase === 'positive' ? 'card:BS12-066' : process.env.BS12_BROWSER_ROUTE === 'generic' && routeCase === 'non-arena' ? 'card-negative:BS12-066' : 'bs12-066:'+routeCase
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-001,BS12-002,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-019,BS12-021,BS12-027,BS12-028,BS12-029,BS12-030,BS12-031,BS12-040,BS12-046,BS12-059,BS12-060,BS12-061,BS12-064,BS12-065,BS12-066,BS12-067,BS12-068,BS6-008,BS7-061,ST4-001')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      row.beforeTrace = await trace(page)
      const modal = page.locator('.trap-response-modal:visible')
      if (['empty-deck', 'no-energy', 'wrong-energy', 'rested-energy', 'disabled', 'used', 'main'].includes(scenario)) {
        assert.equal(await modal.count(), 0)
        if (scenario === 'disabled') await page.getByRole('button', { name: '了解，繼續傷害結算', exact: true }).click()
        if (scenario !== 'main') await waitHp(page, 1)
        row.after = await readState(page)
        assert.deepEqual(await trace(page), scenario === 'main' ? [{commandKind:'deploy-cookie',steps:[]},{commandKind:'skip-on-play',steps:[]}] : [...[{commandKind:'deploy-cookie',steps:[]},{commandKind:'skip-on-play',steps:[]}],{commandKind:'resolve-battle',steps:[]}])
        assert.equal(row.after.bottom.hand, 1)
        if (scenario === 'no-energy') assert.equal(row.after.bottom.support.length, 0)
        else assert.equal(row.after.bottom.support.every(s => s.rested), scenario === 'rested-energy')
      } else {
        await modal.waitFor()
        assert.deepEqual(row.beforeTrace,[{commandKind:'deploy-cookie',steps:[]},{commandKind:'skip-on-play',steps:[]}])
        row.before = await readState(page)
        const trap = modal.locator('.modal-card-options>button').filter({ hasText: 'Perfect Ending Pose' })
        await trap.locator('img').evaluate(i => i.decode())
        assert.equal(await trap.locator('img').getAttribute('src'), cards.find(c => c.cardNumber === 'BS12-066').imageUrl)
        await trap.click()
        const confirm = modal.getByRole('button', { name: '確認發動', exact: true })
        assert.equal(await confirm.isEnabled(), false)
        const energy = modal.locator('.trap-guided-section .trap-discard-options>button')
        await energy.click()
        if (scenario === 'payment-deselect') { await energy.click(); assert.equal(await confirm.isEnabled(), false); await energy.click() }
        if (scenario === 'back-energy') { await modal.getByRole('button', { name: '上一步', exact: true }).click(); await modal.locator('.modal-card-options>button').filter({ hasText: 'Perfect Ending Pose' }).click(); await energy.click() }
        assert.deepEqual(await trace(page), [{commandKind:'deploy-cookie',steps:[]},{commandKind:'skip-on-play',steps:[]}])
        if (scenario === 'cancel-payment') {
          await modal.getByRole('button', { name: '不發動', exact: true }).click()
          await waitHp(page, 1)
          row.after = await readState(page)
          assert.equal(row.after.bottom.hand, 1)
          assert.equal(row.after.bottom.deck, row.before.bottom.deck)
          assert.deepEqual(row.after.bottom.support, row.before.bottom.support)
          assert.deepEqual(await trace(page), [...[{commandKind:'deploy-cookie',steps:[]},{commandKind:'skip-on-play',steps:[]}],{commandKind:'resolve-battle',steps:[]}])
        } else {
          await confirm.click()
          const reveal = page.locator('.card-reveal-modal:visible')
          await reveal.waitFor()
          row.opened = await readState(page)
          assert.equal(row.opened.bottom.hand, 0)
          assert.equal(row.opened.bottom.deck, row.before.bottom.deck)
          assert.equal(row.opened.bottom.trash, row.before.bottom.trash + 1)
          assert.deepEqual(row.opened.bottom.battle, row.before.bottom.battle)
          assert.deepEqual(row.opened.top, row.before.top)
          const mismatch = ['non-arena', 'level-one', 'level-three', 'arena-item', 'top-only'].includes(scenario)
          const number = scenario === 'green-arena' ? 'BS12-040' : scenario === 'red-arena' ? 'BS12-002' : scenario === 'yellow-arena' ? 'BS12-021'
            : ['non-arena', 'top-only'].includes(scenario) ? 'ST4-001' : scenario === 'level-one' ? 'BS12-061' : scenario === 'level-three' ? 'BS12-019' : scenario === 'arena-item' ? 'BS12-027' : 'BS12-060'
          assert.match(await reveal.innerText(), /Perfect Ending Pose — 展示牌庫底/)
          assert.match(await reveal.innerText(), mismatch ? /條件未匹配/ : /條件匹配/)
          assert.equal(await reveal.locator('img').getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
          await reveal.locator('img').evaluate(i => i.decode())
          await shot('public-bottom')
          await reveal.getByRole('button', { name: '確認並繼續', exact: true }).click()
          if (['short-deck', 'refresh-defeat'].includes(scenario)) {
            const refresh = page.locator('.decision-modal:visible')
            await refresh.waitFor()
            row.returned = await readState(page)
            assert.equal(row.returned.bottom.hand, 1)
            assert.equal(row.returned.bottom.deck, 0)
            assert.equal(row.returned.bottom.battle[0].hp, 5)
            assert.deepEqual(row.returned.top, row.opened.top)
            await shot('refresh-before-target')
            await refresh.getByRole('button').filter({ hasText: 'Sour Belt Cookie' }).click()
          }
          if (scenario === 'refresh-defeat') {
            await page.locator('.result-modal').waitFor()
            row.after = await readState(page)
            assert.equal(row.after.bottom.battle[0].hp, 5)
            assert.equal((await trace(page)).some(e => e.commandKind === 'resolve-ability-effect'), false)
          } else {
            if (!mismatch) {
              const panel = page.locator('.effect-panel:not(.is-complete)')
              await panel.waitFor()
              row.returned = await readState(page)
              assert.equal(row.returned.bottom.hand, 1)
              assert.equal(row.returned.bottom.deck, scenario === 'short-deck' ? 7 : row.before.bottom.deck - 1)
              assert.equal(row.returned.bottom.battle[0].hp, 5)
              assert.equal(await panel.locator('img').first().getAttribute('src'), cards.find(c => c.cardNumber === 'BS12-066').imageUrl)
              assert.match(await panel.innerText(), /最多 1 張對手餅乾.*-2/)
              const options = panel.getByRole('button').filter({ hasText: /AI 對手・戰鬥區/ })
              assert.equal(await options.count(), 2)
              const attacker = options.filter({ hasText: 'Sour Belt Cookie' })
              const other = options.filter({ hasText: 'Langue de Chat Cookie' })
              if (scenario !== 'zero-target') await (scenario === 'other-target' ? other : attacker).click()
              if (scenario === 'target-deselect') { await attacker.click(); await attacker.click() }
              if (scenario === 'target-max') {
                await other.click()
                assert.equal(await options.filter({ hasText: '已選取' }).count(), 1)
                assert.match(await attacker.innerText(), /已選取/)
                assert.doesNotMatch(await other.innerText(), /已選取/)
              }
              if (scenario === 'change-target') {
                await attacker.click()
                await other.click()
                assert.match(await other.innerText(), /已選取/)
                await other.click()
                await attacker.click()
              }
              assert.deepEqual(await readState(page), row.returned)
              await shot('target-draft')
              await panel.getByRole('button', { name: '確認發動', exact: true }).click()
            }
            await waitHp(page, mismatch || ['zero-target', 'other-target'].includes(scenario) ? 1 : 3)
            await settle(page)
            row.after = await readState(page)
            assert.equal(row.after.bottom.hand, mismatch ? 0 : 1)
            assert.equal(row.after.bottom.deck, mismatch ? row.before.bottom.deck : scenario === 'short-deck' ? 7 : row.before.bottom.deck - 1)
            assert.deepEqual(row.after.bottom.support, row.opened.bottom.support)
            assert.deepEqual(row.after.top.battle.map(c => c.hp), [4, 4])
            const kinds = (await trace(page)).map(e => e.commandKind)
            assert.ok(kinds.indexOf('play-trap') < kinds.indexOf('resolve-reveal-top-deck'))
            if (!mismatch) assert.ok(kinds.indexOf('resolve-reveal-top-deck') < kinds.lastIndexOf('resolve-ability-effect'))
            if (scenario === 'short-deck') assert.ok(kinds.indexOf('refresh-deck') < kinds.lastIndexOf('resolve-ability-effect'))
          }
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
    console.log(`PASS BS12-066 ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-066 Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
