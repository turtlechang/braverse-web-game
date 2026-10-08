import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-073-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/cards/official-festival-arena-bs12.en.json'),'utf8')).cards
const references = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...references].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const fixtures = ['positive', 'deploy', 'green-arena', 'red-arena', 'yellow-arena', 'level-one', 'level-three', 'non-arena', 'arena-item', 'top-only', 'same-name', 'same-name-alt', 'five', 'seven', 'empty-deck', 'short-deck', 'refresh-defeat', 'no-refresh-cookie', 'onplay-opponent-turn', 'onplay-source-rested', 'receiver', 'receiver-mismatch', 'attack', 'attack-item-cost', 'attack-equipped', 'attack-ally', 'attack-no-hand', 'attack-one-energy', 'attack-wrong-energy', 'attack-rested-energy', 'attack-source-rested', 'attack-opponent-turn', 'attack-outside-main', 'attack-target-faints', 'attack-flip', 'attack-awakened']
const cases = [...fixtures, 'skip-onplay', 'reveal-minimize', 'receiver-deselect', 'skip-then', 'back-then', 'cost-deselect', 'cost-minimize', 'cancel-payment', 'cancel-target', 'payment-deselect']
const blockedAttack = ['attack-one-energy', 'attack-wrong-energy', 'attack-rested-energy', 'attack-source-rested', 'attack-opponent-turn', 'attack-outside-main']
const mismatch = ['same-name', 'same-name-alt', 'non-arena', 'level-one', 'level-three', 'arena-item', 'top-only']
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return { hand: field.querySelectorAll('.hand-card-wrap').length,
      deck: Number(field.querySelector('.deck-zone .resource-summary>strong')?.textContent), trash: Number(field.querySelector('.discard-zone.resource-summary>strong')?.textContent),
      support: [...field.querySelectorAll('.support-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), rested: n.querySelector('.card-face').classList.contains('is-rested') && !n.querySelector('.card-face').classList.contains('is-selected') })),
      battle: [...field.querySelectorAll('.combat-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]), rested: n.querySelector('.card-face').classList.contains('is-rested') })),
      breakLevel: Number(field.querySelector('.break-zone .zone-heading strong')?.textContent.match(/LV\. (\d+)/)?.[1]) }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, steps: e.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]'), null, { timeout: 20000 })
const acknowledgeUntil = async (page, expected) => {
  for (let i = 0; i < 80; i++) {
    if (await expected.isVisible()) return
    const info = page.getByRole('button', { name: '確認並繼續', exact: true })
    if (await info.isVisible()) await info.click()
    else await page.waitForTimeout(100)
  }
  await expected.waitFor({ timeout: 10000 })
}
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const rows = []
try {
  for (const number of (process.env.BS12_BROWSER_PRINTS ?? 'BS12-073').split(',')) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) {
    for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
      const page = await browser.newPage({ viewport })
      const row = { number, scenario, viewport, scope: 'candidate-local; full OnPlay and BB2/source-only Then; Awaken underlay deferred', printedSourceAttested: !['attack-equipped','attack-awakened'].includes(scenario), status: 'FAIL', errors: [], networkFailures: [] }
      const shot = label => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${label}.png`) })
      page.on('pageerror', e => row.errors.push(e.message))
      page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
      page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
      try {
        for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
        const attack = scenario.startsWith('attack') || ['skip-then', 'back-then', 'cost-deselect', 'cost-minimize', 'cancel-payment', 'cancel-target', 'payment-deselect'].includes(scenario)
        const receiver = scenario.startsWith('receiver')
        const fixture = fixtures.includes(scenario) ? scenario : receiver ? 'receiver' : attack ? 'attack-ally' : 'positive'
        const physicalRoute = fixture
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'positive' ? 'card:'+number : process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'non-arena' ? 'card-negative:'+number : 'bs12-073:'+number+':'+physicalRoute
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-001,BS12-002,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-019,BS12-021,BS12-027,BS12-028,BS12-029,BS12-030,BS12-031,BS12-040,BS12-046,BS12-058,BS12-059,BS12-060,BS12-061,BS12-064,BS12-069,BS12-070,BS12-071,BS12-072,BS12-073,BS3-082,BS6-008,BS6-017,BS7-061,ST4-001'+','+number)
        await page.locator('.game-shell').waitFor()
        await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
        await settle(page)
        row.before = await state(page)
        row.setupTrace = await trace(page)
        const source = page.locator(`.${receiver ? 'top' : 'bottom'}-field .combat-card-wrap[data-card-instance-id="bs12-073-source"]`)
        const panel = page.locator('.effect-panel:not(.is-complete):visible')
        if (scenario === 'deploy') {
          const hand = page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-073-source"]')
          await hand.locator('.card-face').click()
          assert.deepEqual(await state(page), row.before)
          await hand.getByRole('button', { name: '登場', exact: true }).click()
          await source.waitFor()
          const entered = await state(page)
          assert.equal(entered.bottom.battle[0].hp, 2)
          assert.equal(entered.bottom.deck, row.before.bottom.deck - 2)
          assert.equal(entered.bottom.hand, row.before.bottom.hand - 1)
          row.before = entered
        }
        await source.locator('img').first().evaluate(i => i.decode())
        assert.equal(await source.locator('img').first().getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
        if (receiver) {
          const modal = page.getByRole('alertdialog').filter({ hasText: 'DJ Miya 要求你棄置手牌' })
          await modal.waitFor()
          assert.equal(await modal.getByRole('button', { name: /^確認棄置/ }).isEnabled(), false)
          assert.equal(await modal.getByRole('button', { name: '略過', exact: true }).count(), 0)
          const choice = modal.getByRole('button', { name: 'Baguette Cookie Baguette Cookie', exact: true })
          await choice.click()
          if (scenario === 'receiver-deselect') {
            await choice.click()
            assert.equal(await modal.getByRole('button', { name: /^確認棄置/ }).isEnabled(), false)
            await choice.click()
          }
          assert.deepEqual(await state(page), row.before)
          await modal.getByRole('button', { name: '確認棄置 (1)', exact: true }).click()
          await modal.waitFor({ state: 'hidden' })
          row.after = await state(page)
          assert.equal(row.after.bottom.hand, row.before.bottom.hand - 1)
          assert.equal(row.after.bottom.trash, row.before.bottom.trash + 1)
          assert.deepEqual(row.after.top, row.before.top)
          assert.deepEqual(row.after.bottom.battle, row.before.bottom.battle)
          assert.ok((await trace(page)).some(c => c.commandKind === 'resolve-opponent-hand-discard'))
        } else if (attack) {
          if (blockedAttack.includes(scenario)) {
            assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
            assert.deepEqual(await state(page), row.before)
            assert.deepEqual(await trace(page), row.setupTrace)
          } else {
            await source.locator('.card-face.is-attackable').click()
            const supports = page.locator('.bottom-field .support-card-wrap .card-face')
            await supports.nth(0).click({ position: { x: 10, y: 25 } })
            assert.equal(await page.getByRole('button', { name: /^選擇攻擊目標/ }).count(), 0)
            if (scenario === 'payment-deselect') {
              await supports.nth(0).click({ position: { x: 10, y: 25 } })
              assert.equal(await page.getByRole('button', { name: /^選擇攻擊目標/ }).count(), 0)
              await supports.nth(0).click({ position: { x: 10, y: 25 } })
            }
            if (scenario !== 'cancel-payment') await supports.nth(1).click({ position: { x: 10, y: 25 } })
            if (scenario.startsWith('cancel-')) {
              await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
              assert.deepEqual(await state(page), row.before)
              assert.deepEqual(await trace(page), row.setupTrace)
            } else {
              await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-064-opponent"]').getByRole('button', { name: /^選擇攻擊目標/ }).click()
              const pay = page.getByRole('button', { name: '支付', exact: true })
              if (scenario === 'attack-awakened') {
                await page.waitForFunction(() => document.querySelector('.top-field .combat-card-wrap .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 4 張') && !document.querySelector('.effect-panel:not(.is-complete)'))
                await settle(page)
                row.after = await state(page)
                assert.equal(row.after.bottom.hand, row.before.bottom.hand)
                assert.equal(row.after.bottom.deck, row.before.bottom.deck)
                assert.equal((await trace(page)).filter(c => c.commandKind === 'resolve-optional-cost-attack').length, 0)
              } else {
                await acknowledgeUntil(page, pay)
                await settle(page)
                row.ordinary = await state(page)
                const expectedHp = scenario === 'attack-target-faints' ? [4] : [4, 4]
                assert.deepEqual(row.ordinary.top.battle.map(c => c.hp), expectedHp)
                assert.equal(row.ordinary.bottom.battle[0].rested, true)
                assert.ok(row.ordinary.bottom.support.every(s => s.rested))
                assert.equal(row.ordinary.bottom.deck, row.before.bottom.deck)
                assert.equal(row.ordinary.bottom.hand, row.before.bottom.hand)
                assert.match(await panel.innerText(), /Then, <discard 1 card\.> Place this Cookie on the bottom of your deck/)
                if (scenario === 'skip-then' || scenario === 'attack-no-hand') {
                  if (scenario === 'attack-no-hand') assert.equal(await pay.isEnabled(), false)
                  await page.getByRole('button', { name: '略過', exact: true }).click()
                  row.after = await state(page)
                  assert.deepEqual(row.after.bottom, row.ordinary.bottom)
                } else {
                  await pay.click()
                  const confirm = panel.getByRole('button', { name: '確認', exact: true })
                  assert.equal(await confirm.isEnabled(), false)
                  assert.equal(await panel.getByRole('button', { name: 'DJ Miya DJ Miya', exact: true }).count(), 0)
                  if (scenario === 'back-then') {
                    await panel.getByRole('button', { name: '返回', exact: true }).click()
                    assert.deepEqual(await state(page), row.ordinary)
                    await pay.click()
                  }
                  const itemName = cards.find(c => c.cardNumber === 'BS12-027').name
                  const costName = scenario === 'attack-item-cost' ? `${itemName} ${itemName}` : 'Langue de Chat Cookie Langue de Chat Cookie'
                  const choice = panel.getByRole('button', { name: costName, exact: true })
                  await choice.click()
                  if (scenario === 'cost-deselect') {
                    await choice.click()
                    assert.equal(await confirm.isEnabled(), false)
                    await choice.click()
                  }
                  if (scenario === 'cost-minimize') {
                    await panel.getByRole('button', { name: '縮小', exact: true }).click()
                    await page.locator('.effect-panel-dock:visible').click()
                    assert.equal(await confirm.isEnabled(), true)
                  }
                  assert.deepEqual(await state(page), row.ordinary)
                  await confirm.click()
                  const replacement = page.getByRole('button', { name: '不補餅乾', exact: true })
                  await replacement.waitFor()
                  row.moved = await state(page)
                  assert.equal(row.moved.bottom.deck, row.before.bottom.deck + 1)
                  assert.equal(row.moved.bottom.hand, row.before.bottom.hand - 1)
                  assert.equal(row.moved.bottom.trash, row.before.bottom.trash + 3 + (scenario === 'attack-equipped' ? 1 : 0))
                  assert.deepEqual(row.moved.bottom.battle, row.ordinary.bottom.battle.slice(1))
                  assert.deepEqual(row.moved.top, row.ordinary.top)
                  assert.equal(row.moved.bottom.breakLevel, row.before.bottom.breakLevel)
                  await replacement.click()
                  if (row.moved.bottom.battle.length === 0) await page.locator('.result-modal').waitFor()
                  const kinds = (await trace(page)).map(c => c.commandKind)
                  assert.ok(kinds.indexOf('declare-attack') < kinds.indexOf('resolve-optional-cost-attack'))
                  assert.match((await trace(page)).flatMap(c => c.steps).join(' '), /放到持有者牌庫底/)
                  if (scenario === 'attack-flip') assert.ok(kinds.some(k => k === 'resolve-flip'))
                }
              }
            }
          }
        } else {
          if (scenario !== 'empty-deck') {
            await panel.waitFor()
            assert.match(await panel.innerText(), /名稱不是 DJ Miya/)
          }
          if (scenario === 'empty-deck') {
            assert.equal(await panel.count(), 0)
            assert.deepEqual(await state(page), row.before)
            assert.ok((await trace(page)).some(c => c.commandKind === 'skip-on-play'))
            assert.equal((await trace(page)).filter(c => c.commandKind === 'begin-activate-skill').length, 0)
          } else if (scenario === 'skip-onplay') {
            await panel.getByRole('button', { name: '略過整個登場效果', exact: true }).click()
            assert.deepEqual(await state(page), row.before)
          } else {
            await panel.getByRole('button', { name: '確認發動', exact: true }).click()
            const reveal = page.locator('.card-reveal-modal:visible')
            await reveal.waitFor()
            const matched = !mismatch.includes(scenario)
            assert.match(await reveal.innerText(), matched ? /條件匹配/ : /條件未匹配/)
            await reveal.locator('img').first().evaluate(i => i.decode())
            assert.deepEqual(await state(page), row.before)
            if (scenario === 'reveal-minimize') {
              await reveal.getByRole('button', { name: '縮小', exact: true }).click()
              await page.locator('.card-reveal-dock:visible').click()
              assert.deepEqual(await state(page), row.before)
            }
            const expectedNumber = scenario === 'same-name' ? number : scenario === 'same-name-alt' ? (number === 'BS12-073' ? 'BS12-073@1' : 'BS12-073')
              : scenario === 'green-arena' ? 'BS12-040' : scenario === 'red-arena' ? 'BS12-002' : scenario === 'yellow-arena' ? 'BS12-021'
                : ['non-arena', 'top-only'].includes(scenario) ? 'ST4-001' : scenario === 'level-one' ? 'BS12-061' : scenario === 'level-three' ? 'BS12-019' : scenario === 'arena-item' ? 'BS12-027' : 'BS12-060'
            assert.equal(await reveal.locator('img').first().getAttribute('src'), cards.find(c => c.cardNumber === expectedNumber).imageUrl)
            await shot('actual-bottom-reveal')
            await reveal.getByRole('button', { name: '確認並繼續', exact: true }).click()
            if (['short-deck', 'refresh-defeat'].includes(scenario)) {
              const refresh = page.locator('.decision-modal:visible')
              await refresh.waitFor()
              row.beforeRefresh = await state(page)
              assert.equal(row.beforeRefresh.bottom.hand, row.before.bottom.hand + 1)
              assert.equal(row.beforeRefresh.bottom.deck, 0)
              assert.deepEqual(row.beforeRefresh.top, row.before.top)
              await refresh.getByRole('button').filter({ hasText: 'Sour Belt Cookie' }).click()
            }
            if (['refresh-defeat', 'no-refresh-cookie'].includes(scenario)) {
              await page.locator('.result-modal').waitFor()
              assert.equal((await state(page)).top.hand, row.before.top.hand)
              assert.equal((await trace(page)).filter(c => c.commandKind === 'resolve-opponent-hand-discard').length, 0)
            } else {
              if (scenario !== 'five') {
                await panel.getByRole('button', { name: '確認發動', exact: true }).waitFor()
                row.returned = await state(page)
                assert.equal(row.returned.bottom.hand, row.before.bottom.hand + (matched ? 1 : 0))
                assert.equal(row.returned.bottom.deck, scenario === 'short-deck' ? 8 : row.before.bottom.deck - (matched ? 1 : 0))
                assert.equal(row.returned.top.hand, row.before.top.hand)
                await panel.getByRole('button', { name: '確認發動', exact: true }).click()
                const publicDiscard = page.getByRole('alertdialog', { name: '對手棄置的卡牌', exact: true })
                await publicDiscard.waitFor()
                await publicDiscard.getByRole('button', { name: '確認並繼續', exact: true }).click()
                await publicDiscard.waitFor({ state: 'hidden' })
              }
              await settle(page)
              row.after = await state(page)
              assert.equal(row.after.bottom.hand, row.before.bottom.hand + (matched ? 1 : 0))
              assert.equal(row.after.top.hand, row.before.top.hand - (scenario === 'five' ? 0 : 1))
              assert.equal(row.after.top.trash, row.before.top.trash + (scenario === 'five' ? 0 : 1))
              assert.deepEqual(row.after.bottom.battle, row.before.bottom.battle)
              assert.deepEqual(row.after.bottom.support, row.before.bottom.support)
              const kinds = (await trace(page)).map(c => c.commandKind)
              assert.ok(kinds.includes('begin-activate-skill'))
              assert.ok(kinds.includes('resolve-reveal-top-deck'))
              if (scenario !== 'five') assert.ok(kinds.indexOf('resolve-reveal-top-deck') < kinds.indexOf('resolve-opponent-hand-discard'))
              if (scenario === 'short-deck') assert.ok(kinds.indexOf('refresh-deck') < kinds.indexOf('resolve-opponent-hand-discard'))
            }
          }
        }
        await settle(page)
        row.after ??= await state(page)
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
        console.log(`PASS ${number} ${scenario} ${viewport.width}`)
      } catch (error) { row.error = error.stack ?? String(error); await shot('failure').catch(() => {}); throw error }
      finally { rows.push(row); writeFileSync(resolve(out, `${process.env.BS12_BROWSER_CASES ? 'subset-' : ''}results-${number}.json`), JSON.stringify(rows.filter(r => r.number === number), null, 2)); await page.close() }
    }
  }
} finally { await browser.close() }
console.log(`BS12-073 candidate local Browser ${rows.length}/${rows.length}; formal BS12/online not covered.`)
