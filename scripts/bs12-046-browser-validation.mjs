import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-046-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const cases = ['draw-two', 'draw-one', 'draw-zero', 'skip-draw', 'change-draw', 'rested-entry', 'removed', 'old-turn', 'hand-entry', 'no-event', 'parent-zero', 'cancel-parent', 'deselect-parent', 'cancel-item', 'cancel-paid-draft', 'deselect-payment', 'wrong-draft-payment', 'no-energy', 'wrong-energy', 'rested-energy', 'opponent-turn', 'outside-main', 'short-deck', 'short-refresh-two', 'last-deck', 'refresh-lv10', 'isolated-opponent-entry']
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return { hand: field.querySelectorAll('.hand-card').length, deck: Number(field.querySelector('.deck-zone .resource-summary > strong')?.textContent), trash: Number(field.querySelector('.discard-zone.resource-summary > strong')?.textContent),
      breakLevel: Number(field.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1]),
      support: [...field.querySelectorAll('.support-card-wrap')].map(node => node.querySelector('.card-face').classList.contains('is-rested')),
      supportIds: [...field.querySelectorAll('.support-card-wrap')].map(node => node.getAttribute('data-card-instance-id')),
      battle: [...field.querySelectorAll('.combat-card-wrap')].map(node => ({ id: node.getAttribute('data-card-instance-id'), rested: node.querySelector('.card-face').classList.contains('is-rested'), hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]) })) }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, summary: e.summary, steps: e.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]'), null, { timeout: 20000 })
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const rows = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const isolated = scenario === 'isolated-opponent-entry'
    const row = { number: 'BS12-046', scenario, viewport, scope: isolated ? scenario === 'removed' ? 'isolated-departure-after-printed-044-entry' : 'isolated-opponent-support-entry' : 'candidate-printed-camera-044-support-entry', printedSourceAttested: !isolated, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = suffix => page.screenshot({ path: resolve(out, `BS12-046-${scenario}-${viewport.width}-${suffix}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route=>route.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp'))}))
      const preEntry = ['draw-two', 'draw-one', 'draw-zero', 'skip-draw', 'change-draw', 'rested-entry', 'parent-zero', 'cancel-parent', 'deselect-parent'].includes(scenario)
      const fixture = preEntry ? scenario === 'rested-entry' ? scenario : 'positive' : ['cancel-item', 'cancel-paid-draft', 'deselect-payment', 'wrong-draft-payment'].includes(scenario) ? 'no-event' : scenario === 'isolated-opponent-entry' ? 'opponent-entry' : scenario === 'short-refresh-two' ? 'short-deck' : scenario
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'positive' ? 'card:BS12-046' : process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'hand-entry' ? 'card-negative:BS12-046' : 'bs12-046:'+fixture
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-046,BS12-001,BS12-003,BS12-005,BS12-006,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-028,BS12-029,BS12-030,BS12-031,BS12-046,BS12-055,BS6-008,BS7-055,BS7-061,BS8-025,ST4-001,ST4-002,ST4-003,ST4-004,ST4-005')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      row.before = await state(page)
      row.beforeTrace = await trace(page)
      if (preEntry) {
        await page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-044-source"]').getByRole('button', { name: '啟動技能', exact: true }).click()
        const panel = page.getByRole('alertdialog')
        const target = panel.getByRole('button', { name: /^Herb Cookie Herb Cookie/ })
        if (scenario !== 'parent-zero') await target.click()
        if (scenario === 'deselect-parent') await target.click()
        await panel.getByRole('button', { name: scenario === 'cancel-parent' ? '取消技能' : '確認發動', exact: true }).click()
        if (!['parent-zero', 'cancel-parent', 'deselect-parent'].includes(scenario)) {
          await page.getByRole('alertdialog').getByRole('button', { name: '確認發動', exact: true }).click()
          await settle(page)
          assert.deepEqual((await state(page)).bottom.battle.map(c => c.hp), [2, 2])
          assert.equal((await state(page)).bottom.deck, 10)
        } else assert.deepEqual(await state(page), row.before)
      }
      if (scenario === 'removed') {
        await shot('printed-stage-faint-replacement')
        await page.getByRole('button', { name: '不補餅乾', exact: true }).click()
        await settle(page)
        assert.equal(await page.getByRole('alertdialog').count(), 0)
        assert.deepEqual((await state(page)).bottom.battle.map(c => c.hp), [2])
        row.departureTrace = await trace(page)
        // Card-specific traces omit replacement commands with no source card.
        // Check the printed departure command and the visible skip result.
        assert.equal(row.departureTrace.at(-1).commandKind, 'activate-stage')
        assert.match(row.departureTrace.at(-1).steps.join(' '), /Tower of Sweet Chaos.*Herb Cookie/)
        await page.getByText('已選擇不補餅乾。', { exact: true }).waitFor()
      }
      row.beforeItem = await state(page)
      const hand = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator('img[alt="E-Z Camera"]') })
      await hand.locator('button.card-face').click()
      if (['no-energy', 'wrong-energy', 'rested-energy', 'opponent-turn', 'outside-main'].includes(scenario)) {
        const use = hand.getByRole('button', { name: '使用', exact: true })
        if (await use.count()) assert.equal(await use.isEnabled(), false)
        assert.deepEqual(await state(page), row.beforeItem)
        assert.deepEqual(await trace(page), row.beforeTrace)
      } else {
        await hand.getByRole('button', { name: '使用', exact: true }).click()
        const panel = page.getByRole('alertdialog')
        assert.equal(await panel.getByRole('button', { name: '確認發動', exact: true }).isEnabled(), false)
        const payer = panel.getByRole('button', { name: /^Basil Pesto Cookie Basil Pesto Cookie/ })
        if (scenario !== 'cancel-item') await payer.click()
        if (scenario === 'deselect-payment') {
          await payer.click()
          assert.equal(await panel.getByRole('button', { name: '確認發動', exact: true }).isEnabled(), false)
          await payer.click()
        }
        if (scenario === 'wrong-draft-payment') {
          assert.equal(await panel.getByRole('button', { name: /^Sweet Jams Guitar/ }).count(), 0)
          assert.equal(await panel.getByRole('button', { name: /^Crown Stage/ }).count(), 0)
        }
        await shot('payment')
        if (['cancel-item', 'cancel-paid-draft'].includes(scenario)) {
          await panel.getByRole('button', { name: '取消技能', exact: true }).click()
          assert.deepEqual(await state(page), row.beforeItem)
          assert.deepEqual(await trace(page), row.beforeTrace)
        } else {
          await panel.getByRole('button', { name: '確認發動', exact: true }).click()
          const event = !['no-event', 'old-turn', 'hand-entry', 'parent-zero', 'cancel-parent', 'deselect-parent', 'deselect-payment', 'wrong-draft-payment', 'isolated-opponent-entry'].includes(scenario)
          const count = scenario === 'draw-one' || scenario === 'short-deck' ? 1 : ['draw-zero', 'skip-draw'].includes(scenario) ? 0 : 2
          if (event) {
            const drawPanel = page.locator('.draw-up-to-modal:visible')
            await drawPanel.waitFor()
            assert.equal(await drawPanel.locator('.draw-up-to-option').count(), 3)
            row.paid = await state(page)
            assert.equal(row.paid.bottom.deck, row.beforeItem.bottom.deck)
            assert.equal(row.paid.bottom.hand, row.beforeItem.bottom.hand - 1)
            assert.equal(row.paid.bottom.trash, row.beforeItem.bottom.trash + 1)
            if (scenario === 'change-draw') {
              await drawPanel.getByRole('button', { name: /^抽 2 張/ }).click()
              await drawPanel.getByRole('button', { name: '不抽', exact: true }).click()
              assert.deepEqual(await state(page), row.paid)
            }
            if (scenario !== 'skip-draw') await drawPanel.getByRole('button', { name: count ? new RegExp(`^抽 ${count} 張`) : '不抽', exact: count === 0 }).click()
            await drawPanel.getByRole('button', { name: count ? `抽取 ${count} 張牌` : '略過抽牌', exact: true }).click()
            if (['short-deck', 'short-refresh-two', 'last-deck', 'refresh-lv10'].includes(scenario)) await page.getByRole('alertdialog').getByRole('button', { name: /^Candy Diver Cookie Candy Diver Cookie/ }).click()
            await settle(page)
            const after = await state(page)
            assert.equal(after.bottom.hand, row.beforeItem.bottom.hand - 1 + count)
            assert.equal(after.bottom.deck, scenario === 'short-refresh-two' ? 5 : ['short-deck', 'last-deck', 'refresh-lv10'].includes(scenario) ? 6 : row.beforeItem.bottom.deck - count)
            assert.equal(after.bottom.trash, ['short-deck', 'short-refresh-two', 'last-deck', 'refresh-lv10'].includes(scenario) ? 0 : row.beforeItem.bottom.trash + 1)
            if (scenario === 'refresh-lv10') {
              await page.getByRole('heading', { name: 'AI 對手勝利', exact: true }).waitFor()
              assert.equal(after.bottom.breakLevel, 11)
            } else assert.equal(await page.getByRole('alertdialog').count(), 0)
            const kinds = (await trace(page)).map(t => t.commandKind)
            assert.equal(kinds.filter(k => k === 'resolve-draw-up-to').length, 1)
          } else {
            await settle(page)
            assert.equal(await page.getByRole('alertdialog').count(), 0)
            const after = await state(page)
            assert.equal(after.bottom.hand, row.beforeItem.bottom.hand - 1)
            assert.equal(after.bottom.deck, row.beforeItem.bottom.deck)
            assert.equal(after.bottom.trash, row.beforeItem.bottom.trash + 1)
            assert.match((await trace(page)).at(-1).steps.join(' '), /條件不成立，效果未執行/)
          }
          const after = await state(page)
          assert.deepEqual(after.bottom.battle, row.beforeItem.bottom.battle)
          assert.deepEqual(after.top, row.before.top)
          assert.deepEqual(after.bottom.support, row.beforeItem.bottom.support.map((rested, i) => row.beforeItem.bottom.supportIds[i] === 'bs12-044-support-1' ? true : rested))
          assert.equal((await trace(page)).filter(t => t.commandKind === 'begin-play-item').length, 1)
        }
      }
      await page.locator(`img[src="${cards.find(c => c.cardNumber === 'BS12-046').imageUrl}"]`).first().evaluate(img => img.decode())
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
      console.log(`PASS BS12-046 ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { row.error = String(error.stack ?? error); row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { rows.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)); await page.close() }
  }
  console.log(`BS12-046 printed Browser ${rows.filter(r => r.printedSourceAttested).length}; isolated ${rows.filter(r => !r.printedSourceAttested).length}`)
} finally { await browser.close() }
