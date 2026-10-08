import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-074-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const references = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...references].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const fixtures = ['extra', 'extra-no-event', 'extra-non-arena', 'extra-top', 'extra-hand', 'extra-support', 'extra-opponent', 'extra-old-turn', 'extra-full', 'extra-used', 'extra-opponent-turn', 'extra-outside-main', 'onplay', 'onplay-first', 'onplay-short', 'onplay-refresh-defeat', 'onplay-no-refresh-cookie', 'positive', 'green-arena', 'red-arena', 'yellow-arena', 'bottom-dj', 'level-one', 'level-three', 'non-arena', 'arena-item', 'top-only', 'empty-deck', 'short-deck', 'refresh-defeat', 'no-refresh-cookie', 'one-energy', 'two-energy', 'wrong-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main', 'target-last-hp', 'other-last-hp', 'target-faints', 'flip', 'ordinary-flip']
const cases = [...fixtures, 'close-extra', 'draw-zero', 'draw-one', 'skip-onplay', 'draw-deselect', 'skip-then', 'back-then', 'cancel-payment', 'cancel-target', 'payment-deselect', 'zero-target', 'other-target', 'target-deselect', 'target-reselect', 'target-limit', 'target-minimize', 'reveal-minimize']
const blockedAttack = ['one-energy', 'two-energy', 'wrong-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main']
const mismatch = ['level-one', 'level-three', 'non-arena', 'arena-item', 'top-only']
const fixture = scenario => fixtures.includes(scenario) ? scenario : scenario === 'close-extra' ? 'extra' : ['draw-zero', 'draw-one', 'skip-onplay', 'draw-deselect'].includes(scenario) ? 'onplay' : 'positive'
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return { hand: field.querySelectorAll('.hand-card-wrap').length, deck: Number(field.querySelector('.deck-zone .resource-summary>strong')?.textContent), trash: Number(field.querySelector('.discard-zone.resource-summary>strong')?.textContent),
      battle: [...field.querySelectorAll('.combat-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]), rested: n.querySelector('.card-face').classList.contains('is-rested') })),
      support: [...field.querySelectorAll('.support-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), rested: n.querySelector('.card-face').classList.contains('is-rested') && !n.querySelector('.card-face').classList.contains('is-selected') })) }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, steps: e.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]'), null, { timeout: 20000 })
const acknowledgeUntil = async (page, expected) => {
  for (let i = 0; i < 80; i++) { if (await expected.isVisible()) return; const info = page.getByRole('button', { name: '確認並繼續', exact: true }); if (await info.isVisible()) await info.click(); else await page.waitForTimeout(100) }
  await expected.waitFor()
}
const waitDone = page => page.waitForFunction(() => [...document.querySelectorAll('button')].some(n => n.textContent?.includes('結束主要階段') && !n.disabled) && !document.querySelector('[role="alertdialog"]'))
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const rows = []
try {
  for (const number of (process.env.BS12_BROWSER_PRINTS ?? 'BS12-074').split(',')) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const row = { number, scenario, viewport, scope: 'candidate-local precise EXTRA event; second-player draw; BBB3 bottom-return then optional opponent top HP movement', printedSourceAttested: !['extra-non-arena','extra-top','extra-opponent','extra-used'].includes(scenario), status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) }); page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = suffix => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${suffix}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'extra' ? 'card:'+number : process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'extra-no-event' ? 'card-negative:'+number : 'bs12-074:'+number+':'+fixture(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-001,BS12-002,BS12-003,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-016,BS12-019,BS12-021,BS12-027,BS12-028,BS12-029,BS12-030,BS12-031,BS12-040,BS12-046,BS12-058,BS12-059,BS12-060,BS12-061,BS12-064,BS12-069,BS12-070,BS12-071,BS12-072,BS12-073,BS12-074,BS12-075,BS12-076,BS12-077,BS12-078,BS12-083,BS12-084,BS12-086,BS4-090,BS4-014,BS6-008,BS6-017,BS7-061,ST4-001'+','+number)
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' }); await settle(page)
      row.before = await state(page); row.setupTrace = await trace(page)
      assert.ok(row.before.bottom.battle.length <= 2 && row.before.top.battle.length <= 2)
      const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-074-source"]')
      const panel = page.locator('.effect-panel:not(.is-complete)')
      if (scenario.startsWith('extra') || scenario === 'close-extra') {
        await page.getByRole('button', { name: '玩家 EXTRA Deck 1 張', exact: true }).click()
        const extra = page.getByRole('dialog', { name: '玩家 EXTRA Deck', exact: true })
        await extra.locator('img').evaluate(i => i.decode()); assert.equal(await extra.locator('img').getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
        assert.equal(await extra.getByRole('button', { name: /Awaken/ }).count(), 0)
        if (scenario === 'extra') {
          await extra.getByRole('button', { name: '從 EXTRA 登場', exact: true }).click(); await source.waitFor(); await settle(page)
          row.after = await state(page)
          assert.equal(row.after.bottom.battle[1].hp, 5); assert.equal(row.after.bottom.deck, row.before.bottom.deck - 5)
          assert.deepEqual(row.after.bottom.battle[0], row.before.bottom.battle[0]); assert.deepEqual(row.after.bottom.support, row.before.bottom.support); assert.deepEqual(row.after.top, row.before.top)
          assert.equal((await trace(page)).filter(c => c.commandKind === 'play-extra-deck-cookie').length, 1)
        } else {
          if (scenario !== 'close-extra') { assert.equal(await extra.getByRole('button', { name: '從 EXTRA 登場', exact: true }).count(), 0); assert.match(await extra.innerText(), /本回合|主要階段|最多.*兩|每回合|只能由目前回合/) }
          await page.getByRole('button', { name: '玩家 EXTRA Deck 1 張', exact: true }).click(); assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), row.setupTrace)
        }
      } else {
        await source.locator('img').first().evaluate(i => i.decode()); assert.equal(await source.locator('img').first().getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
        if (fixture(scenario).startsWith('onplay')) {
          if (scenario === 'onplay-first') { assert.equal(await panel.count(), 0); assert.deepEqual(await state(page), row.before) }
          else if (scenario === 'skip-onplay') { await panel.getByRole('button', { name: '略過整個登場效果', exact: true }).click(); assert.deepEqual(await state(page), row.before) }
          else {
            await panel.getByRole('button', { name: '確認發動', exact: true }).click()
            const draw = page.locator('.draw-up-to-modal:visible'); await draw.waitFor()
            assert.deepEqual(await draw.locator('.draw-up-to-option-label').allTextContents(), ['不抽', '抽 1 張', '抽 2 張'])
            const count = scenario === 'draw-zero' ? 0 : scenario === 'draw-one' ? 1 : 2
            await draw.locator('.draw-up-to-option').nth(count).click()
            if (scenario === 'draw-deselect') { await draw.locator('.draw-up-to-option').nth(0).click(); await draw.locator('.draw-up-to-option').nth(count).click() }
            assert.deepEqual(await state(page), row.before); await shot('draw-draft')
            await draw.getByRole('button', { name: count ? `抽取 ${count} 張牌` : '略過抽牌', exact: true }).click()
            if (scenario === 'onplay-short' || scenario === 'onplay-refresh-defeat') { const refresh = page.locator('.decision-modal:visible'); await refresh.waitFor(); await refresh.getByRole('button').filter({ hasText: 'Sour Belt Cookie' }).first().click() }
            if (scenario.includes('defeat') || scenario.includes('no-refresh-cookie')) await page.locator('.result-modal').waitFor()
            else await waitDone(page)
            await settle(page); row.after = await state(page)
            assert.equal(row.after.bottom.hand, scenario.includes('defeat') || scenario.includes('no-refresh-cookie') ? 1 : count)
            assert.deepEqual(row.after.bottom.battle, row.before.bottom.battle); assert.deepEqual(row.after.top, row.before.top)
          }
        } else if (blockedAttack.includes(scenario)) {
          assert.equal(await source.locator('.card-face.is-attackable').count(), 0); assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), row.setupTrace)
        } else {
          await source.locator('.card-face.is-attackable').click()
          const support = page.locator('.bottom-field .support-card-wrap .card-face')
          await support.nth(1).click({ position: { x: 10, y: 25 } }); assert.equal(await page.getByRole('button', { name: /^選擇攻擊目標/ }).count(), 0)
          if (scenario === 'payment-deselect') { await support.nth(1).click({ position: { x: 10, y: 25 } }); await support.nth(1).click({ position: { x: 10, y: 25 } }) }
          if (scenario !== 'cancel-payment') { await support.nth(2).click({ position: { x: 10, y: 25 } }); assert.equal(await page.getByRole('button', { name: /^選擇攻擊目標/ }).count(), 0); await support.nth(3).click({ position: { x: 10, y: 25 } }) }
          if (scenario.startsWith('cancel-')) { await page.getByRole('button', { name: '取消攻擊', exact: true }).click(); assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), row.setupTrace) }
          else {
            await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-064-opponent"]').getByRole('button', { name: /^選擇攻擊目標/ }).click()
            const pay = panel.getByRole('button', { name: '支付', exact: true })
            if (scenario === 'empty-deck') { await waitDone(page); row.after = await state(page); assert.equal((await trace(page)).filter(c => c.commandKind === 'resolve-optional-cost-attack').length, 0) }
            else {
              await acknowledgeUntil(page, pay); await settle(page); row.ordinary = await state(page)
              assert.deepEqual(row.ordinary.top.battle.map(c => c.hp), scenario === 'target-faints' ? [4] : scenario === 'other-last-hp' ? [3, 1] : scenario === 'target-last-hp' ? [1, 4] : [3, 4])
              assert.equal(row.ordinary.bottom.battle[1].rested, true); assert.ok(row.ordinary.bottom.support.every(s => s.rested)); assert.equal(row.ordinary.bottom.deck, row.before.bottom.deck)
              if (scenario === 'skip-then') { await panel.getByRole('button', { name: '略過', exact: true }).click(); await waitDone(page); assert.deepEqual((await state(page)).top, row.ordinary.top) }
              else {
                await pay.click()
                if (scenario === 'back-then') { await panel.getByRole('button', { name: '返回', exact: true }).click(); assert.deepEqual(await state(page), row.ordinary); await pay.click() }
                await panel.getByRole('button', { name: '確認', exact: true }).click()
                const reveal = page.locator('.card-reveal-modal:visible'); await reveal.waitFor(); assert.match(await reveal.innerText(), mismatch.includes(scenario) ? /條件未匹配/ : /條件匹配/)
                assert.deepEqual(await state(page), row.ordinary); await reveal.locator('img').first().evaluate(i => i.decode())
                if (scenario === 'reveal-minimize') { await reveal.getByRole('button', { name: '縮小', exact: true }).click(); await page.locator('.card-reveal-dock:visible').click(); assert.deepEqual(await state(page), row.ordinary) }
                await shot('bottom-reveal'); await reveal.getByRole('button', { name: '確認並繼續', exact: true }).click()
                if (['short-deck', 'refresh-defeat'].includes(scenario)) { const refresh = page.locator('.decision-modal:visible'); await refresh.waitFor(); assert.deepEqual((await state(page)).top, row.ordinary.top); await shot('refresh-before-hp'); await refresh.getByRole('button').filter({ hasText: 'Sour Belt Cookie' }).first().click() }
                if (['refresh-defeat', 'no-refresh-cookie'].includes(scenario)) { await page.locator('.result-modal').waitFor(); assert.deepEqual((await state(page)).top, row.ordinary.top) }
                else {
                  if (!mismatch.includes(scenario)) {
                    const confirm = panel.getByRole('button', { name: '確認發動', exact: true }); await confirm.waitFor(); row.returned = await state(page)
                    assert.equal(row.returned.bottom.hand, 1); assert.deepEqual(row.returned.top, row.ordinary.top); assert.match(await panel.innerText(), /最上方 1 張 HP 卡.*牌庫底/)
                    const targets = panel.getByRole('button').filter({ hasText: /AI 對手・戰鬥區/ })
                    assert.equal(await targets.count(), scenario === 'target-faints' ? 1 : 2); assert.equal(await confirm.isEnabled(), true)
                    if (scenario !== 'zero-target') {
                      const index = ['other-target', 'other-last-hp'].includes(scenario) ? 1 : 0
                      await targets.nth(index).click()
                      if (scenario === 'target-deselect') { await targets.nth(index).click(); await targets.nth(index).click() }
                      if (scenario === 'target-reselect') { await targets.nth(0).click(); await targets.nth(1).click(); assert.match(await panel.innerText(), /已選 1／1/) }
                      if (scenario === 'target-limit') { await targets.nth(1).click(); assert.match(await panel.innerText(), /已選 1／1/) }
                      if (scenario === 'target-minimize') { await panel.getByRole('button', { name: '縮小', exact: true }).click(); await page.locator('.effect-panel-dock:visible').click() }
                    }
                    assert.deepEqual(await state(page), row.returned); await shot('hp-target-draft'); await confirm.click()
                  }
                  await waitDone(page); await settle(page); row.after = await state(page)
                  const expected = mismatch.includes(scenario) || scenario === 'zero-target' ? row.ordinary.top.battle.map(c => c.hp) : scenario === 'target-last-hp' ? [4] : scenario === 'other-last-hp' ? [3] : scenario === 'target-faints' ? [3] : ['other-target', 'target-reselect'].includes(scenario) ? [3, 3] : [2, 4]
                  assert.deepEqual(row.after.top.battle.map(c => c.hp), expected)
                  assert.equal(row.after.bottom.hand, mismatch.includes(scenario) ? 0 : 1); assert.deepEqual(row.after.bottom.battle, row.ordinary.bottom.battle)
                  if (!mismatch.includes(scenario) && scenario !== 'zero-target') assert.equal(row.after.top.deck, row.ordinary.top.deck + 1)
                  if (!mismatch.includes(scenario) && scenario !== 'zero-target') {
                    const movedCookie = scenario === 'target-last-hp' ? 'Muscle Cookie' : scenario === 'other-last-hp' ? 'Pink Choco Cookie' : ['other-target', 'target-reselect', 'target-faints'].includes(scenario) ? 'Langue de Chat Cookie' : 'Sugar Swan Cookie'
                    assert.ok((await page.locator('body').innerText()).includes(`${movedCookie} 的最上方 1 張 HP 卡已放到持有者牌庫底。`))
                  }
                  if (!mismatch.includes(scenario) && scenario !== 'zero-target') assert.match((await trace(page)).filter(c => c.commandKind === 'resolve-ability-effect').at(-1).steps.join(' '), /最上方 1 張 HP 卡放到持有者牌庫底；HP/)
                  if (scenario === 'flip') { assert.equal((await trace(page)).filter(c => c.commandKind === 'resolve-flip').length, 0); assert.equal(row.after.top.hand, 0) }
                  const kinds = (await trace(page)).slice(row.setupTrace.length).map(c => c.commandKind)
                  assert.ok(kinds.indexOf('declare-attack') < kinds.indexOf('resolve-reveal-top-deck'))
                  if (!mismatch.includes(scenario)) assert.ok(kinds.indexOf('resolve-reveal-top-deck') < kinds.indexOf('resolve-ability-effect'))
                }
              }
            }
          }
        }
      }
      row.trace = await trace(page); assert.deepEqual(row.errors, [])
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
      assert.deepEqual(row.networkFailures, []); await shot('result'); row.status = 'PASS'; console.log(`PASS ${number} ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { row.error = String(error.stack ?? error); row.dom = await page.locator('body').innerText().catch(() => ''); row.trace = await trace(page); await shot('failure').catch(() => {}); throw error }
    finally { rows.push(row); writeFileSync(resolve(out, `${process.env.BS12_BROWSER_CASES ? 'subset' : 'results'}-${number}.json`), JSON.stringify(rows.filter(r => r.number === number), null, 2)); await page.close() }
  }
  console.log(`BS12-074 Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
