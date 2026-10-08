import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-075-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/cards/official-festival-arena-bs12.en.json'),'utf8')).cards
const references = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...references].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const fixtures = ['positive', 'deploy', 'four', 'six', 'repeat', 'source-rested', 'no-hand', 'opponent-turn', 'outside-main', 'item-cost', 'non-arena-cost', 'same-name-cost', 'receiver', 'attack', 'attack-one-energy', 'attack-wrong-energy', 'attack-rested-energy', 'attack-source-rested', 'attack-opponent-turn', 'attack-outside-main', 'attack-flip', 'attack-target-faints']
const cases = [...fixtures, 'cancel-skill', 'cost-deselect', 'cost-minimize', 'receiver-deselect', 'receiver-minimize', 'receiver-limit', 'cancel-payment', 'cancel-target', 'payment-deselect']
const blockedSkill = ['source-rested', 'no-hand', 'opponent-turn', 'outside-main']
const blockedAttack = ['attack-one-energy', 'attack-wrong-energy', 'attack-rested-energy', 'attack-source-rested', 'attack-opponent-turn', 'attack-outside-main']
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
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const rows = []
try {
  for (const number of (process.env.BS12_BROWSER_PRINTS ?? 'BS12-075').split(',')) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) {
    for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
      const page = await browser.newPage({ viewport })
      const row = { number, scenario, viewport, scope: 'candidate-local; one own hand discard and source REST; opponent five-hand chosen discard; PP2 ordinary attack', printedSourceAttested: true, status: 'FAIL', errors: [], networkFailures: [] }
      const shot = label => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${label}.png`) })
      page.on('pageerror', e => row.errors.push(e.message))
      page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
      page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
      try {
        for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
        const attack = scenario.startsWith('attack') || ['cancel-payment', 'cancel-target', 'payment-deselect'].includes(scenario)
        const receiver = scenario.startsWith('receiver')
        const fixture = fixtures.includes(scenario) ? scenario : receiver ? 'receiver' : attack ? 'attack' : 'positive'
        row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'positive' ? 'card:'+number : process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'four' ? 'card-negative:'+number : 'bs12-075:'+number+':'+fixture
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-001,BS12-002,BS12-003,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-016,BS12-019,BS12-021,BS12-027,BS12-028,BS12-029,BS12-030,BS12-031,BS12-040,BS12-046,BS12-058,BS12-059,BS12-060,BS12-061,BS12-064,BS12-069,BS12-070,BS12-071,BS12-072,BS12-073,BS12-074,BS12-075,BS12-076,BS12-077,BS12-078,BS12-083,BS12-084,BS12-086,BS4-090,BS4-014,BS6-008,BS6-017,BS7-061,ST4-001'+','+number)
        await page.locator('.game-shell').waitFor()
        await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
        await settle(page)
        row.before = await state(page)
        row.setupTrace = await trace(page)
        const source = page.locator(`.${receiver ? 'top' : 'bottom'}-field .combat-card-wrap[data-card-instance-id="bs12-075-source"]`)
        if (scenario === 'deploy') {
          const hand = page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-075-source"]')
          await hand.locator('.card-face').click()
          await hand.getByRole('button', { name: '登場', exact: true }).click()
          await source.waitFor()
          const entered = await state(page)
          assert.equal(entered.bottom.battle[0].hp, 3)
          assert.equal(entered.bottom.deck, row.before.bottom.deck - 3)
          assert.equal(entered.bottom.hand, row.before.bottom.hand - 1)
          row.before = entered
        }
        await source.locator('img').first().evaluate(i => i.decode())
        assert.equal(await source.locator('img').first().getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
        if (receiver) {
          const modal = page.getByRole('alertdialog').filter({ hasText: 'Gnome Band 要求你棄置手牌' })
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
          if (scenario === 'receiver-limit') {
            await modal.getByRole('button', { name: 'Muscle Cookie Muscle Cookie', exact: true }).click()
            assert.equal(await modal.getByRole('button', { name: '確認棄置 (1)', exact: true }).isEnabled(), true)
          }
          if (scenario === 'receiver-minimize') {
            await modal.getByRole('button', { name: '縮小', exact: true }).click()
            await page.getByRole('button', { name: /^Gnome Band 已選擇/ }).click()
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
          assert.equal(await page.locator('.bottom-field .discard-zone img').getAttribute('src'), cards.find(c => c.cardNumber === 'BS12-040').imageUrl)
        } else if (attack) {
          if (blockedAttack.includes(scenario)) {
            assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
            assert.deepEqual(await state(page), row.before)
            assert.deepEqual(await trace(page), row.setupTrace)
          } else {
            await source.locator('.card-face.is-attackable').click()
            const supports = page.locator('.bottom-field .support-card-wrap .card-face')
            await supports.nth(0).click({ position: { x: 10, y: 25 } })
            if (scenario === 'payment-deselect') {
              await supports.nth(0).click({ position: { x: 10, y: 25 } })
              assert.deepEqual(await state(page), row.before)
              await supports.nth(0).click({ position: { x: 10, y: 25 } })
            }
            if (scenario !== 'cancel-payment') await supports.nth(1).click({ position: { x: 10, y: 25 } })
            if (scenario.startsWith('cancel-')) {
              await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
              assert.deepEqual(await state(page), row.before)
              assert.deepEqual(await trace(page), row.setupTrace)
            } else {
              await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-064-opponent"]').getByRole('button', { name: /^選擇攻擊目標/ }).click()
              for (let i = 0; i < 100; i++) {
                if (await page.getByRole('button', { name: '結束主要階段', exact: true }).isEnabled()) break
                const info = page.getByRole('button', { name: '確認並繼續', exact: true })
                const skip = page.getByRole('button', { name: '略過', exact: true })
                if (await info.isVisible()) await info.click()
                else if (await skip.isVisible()) await skip.click()
                else await page.waitForTimeout(100)
              }
              await settle(page)
              row.after = await state(page)
              assert.deepEqual(row.after.top.battle.map(c => c.hp), [4, 4])
              assert.equal(row.after.bottom.battle[0].rested, true)
              assert.equal(row.after.bottom.battle[0].hp, 3)
              assert.ok(row.after.bottom.support.every(s => s.rested))
              assert.equal(row.after.bottom.hand, row.before.bottom.hand)
              assert.equal(row.after.bottom.trash, row.before.bottom.trash)
              assert.equal((await trace(page)).filter(c => c.commandKind === 'begin-activate-skill' || c.commandKind === 'resolve-optional-cost-attack').length, 0)
              assert.ok((await trace(page)).some(c => c.commandKind === 'declare-attack'))
              if (scenario === 'attack-target-faints') {
                assert.equal(row.after.top.breakLevel, 2)
                assert.deepEqual(row.after.top.battle[0], row.before.top.battle[1])
                assert.equal(row.after.top.battle[1].id, 'bs12-075-receiver-hand-0')
                assert.equal(row.after.top.battle[1].rested, false)
                assert.equal(row.after.top.hand, row.before.top.hand - 1)
                assert.equal(row.after.top.deck, row.before.top.deck - 4)
                assert.equal(row.after.top.trash, row.before.top.trash + 2)
                assert.ok(!row.after.top.battle.some(c => c.id === 'bs12-064-opponent'))
              }
            }
          }
        } else if (scenario === 'repeat') {
          const payAndFinish = async name => {
            await source.getByRole('button', { name: '啟動技能', exact: true }).click()
            const panel = page.getByRole('alertdialog').filter({ hasText: '額外代價' })
            await panel.getByRole('button', { name: `${name} ${name} 點擊選取`, exact: true }).click()
            await panel.getByRole('button', { name: '確認發動', exact: true }).click()
            const publicDiscard = page.getByRole('alertdialog', { name: '對手棄置的卡牌', exact: true })
            await publicDiscard.waitFor()
            await publicDiscard.getByRole('button', { name: '確認並繼續', exact: true }).click()
            await publicDiscard.waitFor({ state: 'hidden' })
            await settle(page)
          }
          await payAndFinish('Langue de Chat Cookie')
          row.first = await state(page)
          assert.equal(row.first.top.hand, 5)
          assert.equal(row.first.bottom.battle[1].rested, true)
          const ready = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-075-ready-source"]')
          await ready.getByRole('button', { name: '啟動技能', exact: true }).click()
          const panel = page.getByRole('alertdialog').filter({ hasText: 'Strawberry Mochi Cookie' })
          await panel.getByRole('button', { name: /^Gnome Band Gnome Band 玩家・戰鬥區第 2 張/ }).click()
          await panel.getByRole('button', { name: '確認發動', exact: true }).click()
          await panel.getByText('第 2 / 2 段', { exact: true }).waitFor()
          await panel.getByRole('button', { name: '確認發動', exact: true }).click()
          await source.getByRole('button', { name: '啟動技能', exact: true }).waitFor()
          assert.equal((await state(page)).bottom.battle[1].rested, false)
          await payAndFinish('Muscle Cookie')
          row.after = await state(page)
          assert.equal(row.after.top.hand, 4)
          assert.equal(row.after.top.trash, 2)
          assert.equal(row.after.bottom.hand, 0)
          assert.equal(row.after.bottom.trash, 2)
          assert.deepEqual(row.after.bottom.battle.map(c => [c.hp, c.rested]), [[4, false], [3, true]])
          assert.deepEqual(row.after.bottom.support, row.before.bottom.support)
          assert.equal(row.after.bottom.deck, row.before.bottom.deck)
          assert.equal((await trace(page)).filter(c => c.commandKind === 'resolve-opponent-hand-discard').length, 2)
          assert.equal((await trace(page)).filter(c => c.commandKind === 'begin-activate-skill').length, 3)
        } else if (blockedSkill.includes(scenario)) {
          const skill = source.getByRole('button', { name: '啟動技能', exact: true })
          if (scenario === 'opponent-turn') assert.equal(await skill.count(), 0)
          else assert.equal(await skill.isEnabled(), false)
          assert.deepEqual(await state(page), row.before)
          assert.deepEqual(await trace(page), row.setupTrace)
        } else {
          await source.getByRole('button', { name: '啟動技能', exact: true }).click()
          const panel = page.getByRole('alertdialog').filter({ hasText: '額外代價' })
          await panel.waitFor()
          assert.match(await panel.innerText(), /將效果來源卡橫置/)
          assert.equal(await panel.getByRole('button', { name: '確認發動', exact: true }).isEnabled(), false)
          const choice = panel.getByRole('button', { name: /(?:點擊選取|點擊取消)$/ })
          await choice.click()
          if (scenario === 'cost-deselect') {
            await choice.click()
            assert.equal(await panel.getByRole('button', { name: '確認發動', exact: true }).isEnabled(), false)
            await choice.click()
          }
          if (scenario === 'cost-minimize') {
            await panel.getByRole('button', { name: '縮小', exact: true }).click()
            await page.locator('.effect-panel-dock:visible').click()
          }
          assert.deepEqual(await state(page), row.before)
          if (scenario === 'cancel-skill') {
            await panel.getByRole('button', { name: '取消技能', exact: true }).click()
            assert.deepEqual(await state(page), row.before)
            assert.deepEqual(await trace(page), row.setupTrace)
          } else {
            await panel.getByRole('button', { name: '確認發動', exact: true }).click()
            if (scenario === 'four') {
              await page.getByText('Gnome Band已支付代價；效果條件未滿足，效果未執行。', { exact: true }).first().waitFor()
              await page.waitForFunction(() => document.querySelectorAll('.bottom-field .hand-card-wrap').length === 0)
              row.after = await state(page)
              assert.deepEqual(row.after.top, row.before.top)
              assert.equal(row.after.bottom.hand, row.before.bottom.hand - 1)
              assert.equal(row.after.bottom.trash, row.before.bottom.trash + 1)
              assert.equal(row.after.bottom.battle[0].rested, true)
              assert.equal((await trace(page)).filter(c => c.commandKind === 'resolve-opponent-hand-discard').length, 0)
            } else {
            const publicDiscard = page.getByRole('alertdialog', { name: '對手棄置的卡牌', exact: true })
            await publicDiscard.waitFor()
            row.paid = await state(page)
            assert.equal(row.paid.bottom.hand, row.before.bottom.hand - 1)
            assert.equal(row.paid.bottom.trash, row.before.bottom.trash + 1)
            assert.equal(row.paid.bottom.battle[0].rested, true)
            assert.equal(row.paid.top.hand, row.before.top.hand)
            await publicDiscard.getByRole('button', { name: '確認並繼續', exact: true }).click()
            await publicDiscard.waitFor({ state: 'hidden' })
            await settle(page)
            row.after = await state(page)
            assert.equal(row.after.top.hand, row.before.top.hand - 1)
            assert.equal(row.after.top.trash, row.before.top.trash + 1)
            assert.equal(row.after.bottom.battle[0].hp, 3)
            assert.deepEqual(row.after.bottom.support, row.before.bottom.support)
            assert.equal(row.after.bottom.deck, row.before.bottom.deck)
            const kinds = (await trace(page)).map(c => c.commandKind)
            assert.ok(kinds.includes('begin-activate-skill'))
            assert.ok(kinds.indexOf('begin-activate-skill') < kinds.indexOf('resolve-opponent-hand-discard'))
            assert.equal(kinds.includes('declare-attack'), false)
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
      finally { rows.push(row); writeFileSync(resolve(out, `results-${number}.json`), JSON.stringify(rows.filter(r => r.number === number), null, 2)); await page.close() }
    }
  }
} finally { await browser.close() }
