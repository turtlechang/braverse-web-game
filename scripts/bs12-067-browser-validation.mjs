import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-067-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/cards/official-festival-arena-bs12.en.json'),'utf8')).cards
const references = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...references].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const fixtures = ['positive', 'green-arena', 'red-arena', 'yellow-arena', 'non-arena', 'level-one', 'level-three', 'arena-item', 'top-only', 'short-deck', 'refresh-defeat', 'empty-deck', 'replace', 'placed', 'no-energy', 'wrong-energy', 'rested-energy', 'one-energy', 'activation-no-energy', 'activation-wrong-energy', 'activation-rested-energy', 'rested-source', 'opponent-turn', 'outside-main']
const cases = [...fixtures, 'cancel-placement', 'deselect-placement', 'cancel-energy', 'cancel-cost', 'back-energy', 'deselect-energy', 'hand-preview']
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return { deck: Number(field.querySelector('.deck-zone .resource-summary>strong')?.textContent), hand: field.querySelectorAll('.hand-card').length,
      trash: Number(field.querySelector('.discard-zone.resource-summary>strong')?.textContent),
      stage: field.querySelector('.stage-zone img')?.getAttribute('src') ?? null,
      stageRested: field.querySelector('.stage-zone .card-face')?.classList.contains('is-rested') ?? false,
      battle: [...field.querySelectorAll('.combat-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]), rested: n.querySelector('.card-face').classList.contains('is-rested') })),
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
    const row = { number: 'BS12-067', scenario, viewport, printedSourceAttested: true, errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const routeCase = (fixtures.includes(scenario) ? scenario : 'positive')
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && routeCase === 'placed' ? 'card:BS12-067' : process.env.BS12_BROWSER_ROUTE === 'generic' && routeCase === 'non-arena' ? 'card-negative:BS12-067' : 'bs12-067:'+routeCase
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-001,BS12-002,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-019,BS12-021,BS12-027,BS12-028,BS12-029,BS12-030,BS12-031,BS12-040,BS12-046,BS12-059,BS12-060,BS12-061,BS12-064,BS12-065,BS12-066,BS12-067,BS12-068,BS6-008,BS7-061,ST4-001')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      row.before = await state(page)
      const stageCard = cards.find(c => c.cardNumber === 'BS12-067')
      const hand = page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-067-stage"]')
      if (scenario === 'hand-preview') {
        await hand.locator('button.card-face').click()
        await hand.getByRole('button', { name: '詳情', exact: true }).click()
        const detail = page.getByRole('dialog', { name: 'Comeback Stage 卡牌詳情', exact: true })
        await detail.waitFor()
        assert.match(await detail.innerText(), /bottom of your deck.*LV\.2.*Arena.*hand/s)
        assert.equal(await detail.locator('img').first().getAttribute('src'), stageCard.imageUrl)
        await detail.locator('img').first().evaluate(i => i.decode())
        await detail.getByRole('button', { name: '關閉', exact: true }).click()
        assert.deepEqual(await state(page), row.before)
      } else if (['no-energy', 'wrong-energy', 'rested-energy'].includes(scenario)) {
        await hand.locator('button.card-face').click()
        assert.equal(await hand.getByRole('button', { name: '放置', exact: true }).count(), 0)
        assert.deepEqual(await state(page), row.before)
        assert.deepEqual(await trace(page), [{commandKind:'deploy-cookie',steps:[]},{commandKind:'skip-on-play',steps:[]}])
      } else {
        if (row.before.bottom.hand) {
          await hand.locator('button.card-face').click()
          await hand.getByRole('button', { name: '放置', exact: true }).click()
          const modal = page.getByRole('alertdialog', { name: 'Comeback Stage 場景放置付款', exact: true })
          await modal.waitFor()
          const pay = modal.getByRole('button', { name: '支付並放置', exact: true })
          assert.equal(await pay.isEnabled(), false)
          assert.equal(await modal.locator('img').first().getAttribute('src'), stageCard.imageUrl)
          await modal.locator('img').first().evaluate(i => i.decode())
          const option = modal.locator('.modal-card-options>button').first()
          await option.click()
          if (scenario === 'deselect-placement') { await option.click(); assert.equal(await pay.isEnabled(), false); await option.click() }
          assert.deepEqual(await state(page), row.before)
          if (scenario === 'cancel-placement') {
            await modal.getByRole('button', { name: '取消', exact: true }).click()
            assert.deepEqual(await state(page), row.before)
            assert.deepEqual(await trace(page), [{commandKind:'deploy-cookie',steps:[]},{commandKind:'skip-on-play',steps:[]}])
          } else {
            await shot('placement-draft')
            await pay.click()
            await modal.waitFor({ state: 'hidden' })
            await settle(page)
            row.placed = await state(page)
            assert.equal(row.placed.bottom.stage, stageCard.imageUrl)
            assert.equal(row.placed.bottom.stageRested, false)
            assert.equal(row.placed.bottom.hand, 0)
            assert.equal(row.placed.bottom.deck, row.before.bottom.deck)
            assert.equal(row.placed.bottom.trash, row.before.bottom.trash + (scenario === 'replace' ? 1 : 0))
            assert.deepEqual(row.placed.bottom.support.map(s => s.rested), scenario === 'one-energy' ? [true] : [true, false])
          }
        } else row.placed = row.before
        if (scenario !== 'cancel-placement') {
          const blocked = ['empty-deck', 'one-energy', 'activation-no-energy', 'activation-wrong-energy', 'activation-rested-energy', 'rested-source', 'opponent-turn', 'outside-main'].includes(scenario)
          if (blocked) {
            assert.equal(await page.locator('.bottom-field .stage-quick-action').count(), 0)
            assert.deepEqual(await state(page), row.placed)
            assert.equal((await trace(page)).some(e => e.commandKind === 'begin-activate-stage'), false)
          } else {
            const placedTrace = await trace(page)
            await page.locator('.bottom-field .stage-quick-action').click()
            const panel = page.locator('.effect-panel:not(.is-complete)')
            await panel.waitFor()
            assert.equal(await panel.locator('img').first().getAttribute('src'), stageCard.imageUrl)
            const next = panel.getByRole('button', { name: '下一步', exact: true })
            assert.equal(await next.isEnabled(), false)
            const energy = panel.getByRole('button').filter({ hasText: 'Candy Diver Cookie' })
            assert.equal(await energy.count(), 1)
            if (scenario !== 'cancel-energy') {
              await energy.click()
              if (scenario === 'deselect-energy') { await energy.click(); assert.equal(await next.isEnabled(), false); await energy.click() }
              await next.click()
              assert.match(await panel.innerText(), /將效果來源卡橫置/)
              if (scenario === 'back-energy') {
                await panel.getByRole('button', { name: '上一步', exact: true }).click()
                assert.match(await panel.innerText(), /已選 1／1/)
                await next.click()
              }
            }
            row.draft = await state(page)
            assert.deepEqual(row.draft, scenario === 'cancel-energy' ? row.placed : {
              ...row.placed, bottom: { ...row.placed.bottom, support: row.placed.bottom.support.map((s, i) => ({ ...s, rested: i === 1 ? true : s.rested })) },
            })
            assert.deepEqual(await trace(page), placedTrace)
            if (['cancel-energy', 'cancel-cost'].includes(scenario)) {
              await panel.getByRole('button', { name: '取消技能', exact: true }).click()
              assert.deepEqual(await state(page), row.placed)
              assert.deepEqual(await trace(page), placedTrace)
            } else {
              await shot('activation-cost')
              await panel.getByRole('button', { name: '確認發動', exact: true }).click()
              const reveal = page.locator('.card-reveal-modal:visible')
              await reveal.waitFor()
              row.opened = await state(page)
              assert.equal(row.opened.bottom.stageRested, true)
              assert.equal(row.opened.bottom.support.every(s => s.rested), true)
              assert.equal(row.opened.bottom.hand, 0)
              assert.equal(row.opened.bottom.deck, row.placed.bottom.deck)
              assert.equal(row.opened.bottom.trash, row.placed.bottom.trash)
              assert.deepEqual(row.opened.bottom.battle, row.before.bottom.battle)
              assert.deepEqual(row.opened.top, row.before.top)
              const mismatch = ['non-arena', 'level-one', 'level-three', 'arena-item', 'top-only'].includes(scenario)
              const number = scenario === 'green-arena' ? 'BS12-040' : scenario === 'red-arena' ? 'BS12-002' : scenario === 'yellow-arena' ? 'BS12-021'
                : ['non-arena', 'top-only'].includes(scenario) ? 'ST4-001' : scenario === 'level-one' ? 'BS12-061' : scenario === 'level-three' ? 'BS12-019' : scenario === 'arena-item' ? 'BS12-027' : 'BS12-060'
              assert.match(await reveal.innerText(), /Comeback Stage — 展示牌庫底/)
              assert.match(await reveal.innerText(), mismatch ? /條件未匹配/ : /條件匹配/)
              assert.doesNotMatch(await reveal.innerText(), /後段效果/)
              assert.equal(await reveal.locator('img').getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
              await reveal.locator('img').evaluate(i => i.decode())
              await shot('public-bottom')
              await reveal.getByRole('button', { name: '確認並繼續', exact: true }).click()
              if (['short-deck', 'refresh-defeat'].includes(scenario)) {
                const refresh = page.locator('.decision-modal:visible')
                await refresh.waitFor()
                row.returned = await state(page)
                assert.equal(row.returned.bottom.hand, 1)
                assert.equal(row.returned.bottom.deck, 0)
                assert.deepEqual(row.returned.bottom.battle, row.before.bottom.battle)
                await shot('refresh')
                await refresh.getByRole('button').filter({ hasText: 'Sour Belt Cookie' }).click()
                if (scenario === 'refresh-defeat') await page.locator('.result-modal').waitFor()
                else await refresh.waitFor({ state: 'hidden' })
              }
              await reveal.waitFor({ state: 'hidden' })
              await settle(page)
              row.after = await state(page)
              assert.equal(row.after.bottom.hand, mismatch ? 0 : 1)
              assert.equal(row.after.bottom.deck, mismatch ? row.placed.bottom.deck : ['short-deck', 'refresh-defeat'].includes(scenario) ? 7 : row.placed.bottom.deck - 1)
              assert.deepEqual(row.after.bottom.battle, row.before.bottom.battle)
              assert.deepEqual(row.after.top, row.before.top)
              assert.equal(row.after.bottom.stageRested, true)
              assert.deepEqual(row.after.bottom.support, row.opened.bottom.support)
              assert.equal(await page.locator('.bottom-field .stage-quick-action').count(), 0)
              const kinds = (await trace(page)).map(e => e.commandKind)
              assert.ok(kinds.indexOf('begin-activate-stage') < kinds.indexOf('resolve-reveal-top-deck'))
              if (row.before.bottom.hand) assert.ok(kinds.indexOf('play-stage') < kinds.indexOf('begin-activate-stage'))
              if (['short-deck', 'refresh-defeat'].includes(scenario)) assert.ok(kinds.indexOf('resolve-reveal-top-deck') < kinds.indexOf('refresh-deck'))
              assert.equal(kinds.includes('resolve-draw-up-to'), false)
            }
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
    console.log(`PASS BS12-067 ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-067 Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
