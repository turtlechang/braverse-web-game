import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-044-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const cases = ['positive', 'ready-cookie', 'ready-item', 'ready-zero', 'deselect-ready', 'retarget-ready', 'entry-zero', 'entry-other', 'deselect-entry', 'cancel-entry', 'not-herb', 'wrong-name', 'rested-herb', 'source-rested', 'active-target', 'all-active', 'blue-target', 'no-arena', 'item-only', 'no-support', 'full-battle', 'existing-herb', 'opponent-turn', 'outside-main', 'used', 'last-deck', 'short-deck', 'refresh-lv10', 'attack', 'attack-wrong', 'attack-few', 'attack-rested', 'cancel-attack', 'deploy']
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return { hand: field.querySelectorAll('.hand-card').length, deck: Number(field.querySelector('.deck-zone .resource-summary > strong')?.textContent), trash: Number(field.querySelector('.discard-zone.resource-summary > strong')?.textContent),
      breakLevel: Number(field.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1]),
      support: [...field.querySelectorAll('.support-card-wrap')].map(node => node.querySelector('.card-face').classList.contains('is-rested')),
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
    const row = { number: 'BS12-044', scenario, viewport, scope: 'candidate-printed-044-named-support-entry-ready-ordinary', status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = suffix => page.screenshot({ path: resolve(out, `BS12-044-${scenario}-${viewport.width}-${suffix}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route=>route.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp'))}))
      const fixture = ['ready-cookie', 'ready-item', 'ready-zero', 'deselect-ready', 'retarget-ready', 'entry-zero', 'entry-other', 'deselect-entry', 'cancel-entry'].includes(scenario) ? 'positive' : scenario === 'cancel-attack' ? 'attack' : scenario
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'positive' ? 'card:BS12-044' : process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'item-only' ? 'card-negative:BS12-044' : 'bs12-044:'+fixture
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-044,BS12-001,BS12-003,BS12-005,BS12-006,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-028,BS12-029,BS12-030,BS12-031,BS12-046,BS12-055,BS6-008,BS7-055,BS7-061,BS8-025,ST4-001,ST4-002,ST4-003,ST4-004,ST4-005')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      row.before = await state(page)
      row.beforeTrace = await trace(page)
      const sourceWrap = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-044-source"]')
      const source = sourceWrap.locator('button.card-face:not(.hp-card)')
      if (scenario === 'deploy') {
        const hand = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator('img[alt="Herb Teapot"]') })
        await hand.locator('button.card-face').click()
        await hand.getByRole('button', { name: '登場', exact: true }).click()
        await source.waitFor()
        await settle(page)
        const after = await state(page)
        assert.deepEqual(after.bottom.battle.map(c => c.hp), [2, 2])
        assert.equal(after.bottom.deck, 10)
        assert.equal(after.bottom.hand, 0)
        assert.deepEqual(after.bottom.support, row.before.bottom.support)
        assert.deepEqual(after.top, row.before.top)
        assert.deepEqual((await trace(page)).map(t => t.commandKind), ['deploy-cookie'])
      } else if (scenario.startsWith('attack') || scenario === 'cancel-attack') {
        if (['attack-wrong', 'attack-few', 'attack-rested'].includes(scenario)) {
          assert.equal(await source.locator(':scope.is-attackable').count(), 0)
          await source.click()
          assert.equal(await page.getByRole('button', { name: '取消攻擊', exact: true }).count(), 0)
          assert.deepEqual(await state(page), row.before)
          assert.deepEqual(await trace(page), row.beforeTrace)
        } else {
          await source.click()
          const supports = page.locator('.bottom-field .support-card-wrap button.card-face')
          await supports.nth(0).click({ position: { x: 10, y: 25 } })
          await supports.nth(1).click({ position: { x: 10, y: 25 } })
          if (scenario === 'cancel-attack') {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await state(page), row.before)
            assert.deepEqual(await trace(page), row.beforeTrace)
          } else {
            await page.getByRole('button', { name: '選擇攻擊目標：Sugar Swan Cookie', exact: true }).click()
            await page.waitForFunction(() => document.querySelector('.top-field .combat-card-wrap .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 4 張'))
            await settle(page)
            const after = await state(page)
            assert.deepEqual(after.top.battle.map(c => c.hp), [4, 3])
            assert.equal(after.top.trash, 2)
            assert.deepEqual(after.bottom.support, [true, true, false, false])
            assert.equal(after.bottom.battle[0].rested, true)
            assert.deepEqual(after.bottom.battle[0].hp, 2)
            assert.deepEqual((await trace(page)).map(t => t.commandKind), ['declare-attack', 'resolve-battle'])
          }
        }
      } else if (['opponent-turn', 'outside-main', 'used'].includes(scenario)) {
        const activation = sourceWrap.getByRole('button', { name: '啟動技能', exact: true })
        if (scenario === 'opponent-turn') assert.equal(await activation.count(), 0)
        else assert.equal(await activation.isEnabled(), false)
        assert.deepEqual(await state(page), row.before)
        assert.deepEqual(await trace(page), row.beforeTrace)
      } else {
        await sourceWrap.getByRole('button', { name: '啟動技能', exact: true }).click()
        const panel = page.getByRole('alertdialog')
        await panel.waitFor()
        assert.match(await panel.innerText(), /從支援區選最多 1 張【Arena】餅乾登場。可選 0 張。/)
        const candidates = panel.locator('.effect-candidate-entry > button')
        const empty = ['item-only', 'no-support', 'full-battle', 'existing-herb'].includes(scenario)
        assert.equal(await candidates.count(), empty ? 0 : ['no-arena', 'blue-target'].includes(scenario) ? 1 : 2)
        assert.equal(await panel.getByRole('button', { name: '確認發動', exact: true }).isEnabled(), true)
        assert.equal(await panel.locator('img[alt="Sweet Jams Guitar"]').count(), 0)
        assert.equal(await panel.locator('img[alt="Crown Stage"]').count(), 0)
        const zero = empty || ['entry-zero', 'deselect-entry', 'no-arena'].includes(scenario)
        if (!zero || scenario === 'deselect-entry' || scenario === 'cancel-entry') {
          await candidates.nth(scenario === 'entry-other' ? 1 : 0).click()
          if (scenario === 'deselect-entry') await candidates.nth(0).click()
          if (scenario === 'positive') { await candidates.nth(1).click(); assert.match(await panel.innerText(), /已選 1／1/); assert.match(await candidates.nth(0).innerText(), /已選/); }
        }
        await shot('entry-selection')
        if (scenario === 'cancel-entry') {
          await panel.getByRole('button', { name: '取消技能', exact: true }).click()
          assert.deepEqual(await state(page), row.before)
          assert.deepEqual(await trace(page), row.beforeTrace)
        } else {
          await panel.getByRole('button', { name: '確認發動', exact: true }).click()
          if (['last-deck', 'short-deck', 'refresh-lv10'].includes(scenario)) {
            const refresh = page.getByRole('alertdialog')
            await refresh.getByRole('button', { name: /^Candy Diver Cookie Candy Diver Cookie/ }).click()
          }
          await settle(page)
          const noThen = zero || ['not-herb', 'wrong-name', 'entry-other', 'refresh-lv10'].includes(scenario)
          if (noThen) {
            await page.waitForFunction(() => !document.querySelector('[role="alertdialog"]'))
            const after = await state(page)
            if (zero) assert.deepEqual(after, row.before)
            else if (scenario === 'refresh-lv10') {
              await page.getByRole('heading', { name: 'AI 對手勝利', exact: true }).waitFor()
              assert.equal(after.bottom.breakLevel, 11)
              assert.deepEqual(after.bottom.support, [true, true, true])
              assert.match(await page.locator('body').innerText(), /我方休息區的等級達到 10/)
            } else {
              assert.equal(after.bottom.battle.length, 2)
              assert.deepEqual(after.bottom.support, scenario === 'entry-other' ? [false, true, true] : [true, true, true])
              assert.equal(after.bottom.deck, 10)
            }
          } else {
            await panel.waitFor()
            assert.match(await panel.innerText(), /第 2 \/ 2 段/)
            assert.match(await panel.innerText(), /將最多 1 張支援區卡設為活躍/)
            const targets = panel.locator('.effect-candidate-entry > button')
            assert.equal(await targets.count(), 3)
            assert.equal(await panel.getByRole('button', { name: '取消技能', exact: true }).count(), 0)
            for (const n of [scenario === 'blue-target' ? 'ST4-001' : 'BS12-041', 'BS12-012', 'BS12-011']) {
              const img = panel.locator(`img[src="${cards.find(c => c.cardNumber === n).imageUrl}"]`)
              assert.equal(await img.count(), 1)
              await img.evaluate(i => i.decode())
            }
            row.entered = await state(page)
            assert.deepEqual(row.entered.bottom.battle.map(c => c.hp), [2, 2])
            assert.equal(row.entered.bottom.deck, scenario === 'last-deck' ? 5 : scenario === 'short-deck' ? 4 : 10)
            const index = ['ready-cookie', 'active-target', 'all-active', 'blue-target'].includes(scenario) ? 0 : scenario === 'ready-item' ? 1 : 2
            if (scenario !== 'ready-zero') {
              await targets.nth(index).click()
              if (scenario === 'deselect-ready') { await targets.nth(index).click(); assert.match(await panel.innerText(), /已選 0／1/); }
              if (scenario === 'retarget-ready') { await targets.nth(index).click(); await targets.nth(1).click(); }
            }
            await shot('ready-selection')
            await panel.getByRole('button', { name: '確認發動', exact: true }).click()
            await settle(page)
            const after = await state(page)
            const expected = [...row.entered.bottom.support]
            if (!['ready-zero', 'deselect-ready'].includes(scenario)) expected[scenario === 'retarget-ready' ? 1 : index] = false
            assert.deepEqual(after.bottom.support, expected)
            assert.deepEqual(after.bottom.battle, row.entered.bottom.battle)
            assert.equal(after.bottom.battle[0].rested, scenario === 'source-rested')
            assert.deepEqual(after.bottom.deck, row.entered.bottom.deck)
            assert.equal(after.bottom.hand, 0)
            assert.equal(after.bottom.trash, 0)
            assert.equal(after.bottom.breakLevel, ['last-deck', 'short-deck'].includes(scenario) ? 2 : 0)
          }
          assert.deepEqual((await state(page)).top, row.before.top)
          if (scenario !== 'refresh-lv10') assert.equal(await sourceWrap.getByRole('button', { name: '啟動技能', exact: true }).isEnabled(), false)
          assert.deepEqual((await trace(page)).slice(row.beforeTrace.length).map(t => t.commandKind), noThen ? ['begin-activate-skill', 'resolve-ability-effect', ...(scenario === 'refresh-lv10' ? ['refresh-deck'] : [])] : ['begin-activate-skill', 'resolve-ability-effect', ...(['last-deck', 'short-deck'].includes(scenario) ? ['refresh-deck'] : []), 'resolve-ability-effect'])
        }
      }
      await source.locator('img').evaluate(img => img.decode())
      assert.equal(await source.locator('img').getAttribute('src'), cards.find(c => c.cardNumber === 'BS12-044').imageUrl)
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
      console.log(`PASS BS12-044 ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { row.error = String(error.stack ?? error); row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { rows.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)); await page.close() }
  }
  console.log(`BS12-044 printed Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
