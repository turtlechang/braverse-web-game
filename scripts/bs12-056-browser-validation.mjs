import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-056-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/cards/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const fixtureCases = ['extra-named', 'extra-named-rested', 'extra-seven', 'extra-seven-rested', 'extra-six', 'extra-seven-mixed', 'extra-non-arena', 'extra-wrong-name', 'extra-support-name', 'extra-opponent-name', 'extra-equipment', 'extra-full', 'extra-used', 'extra-outside-main', 'extra-opponent-turn', 'extra-refresh', 'positive', 'first-player', 'no-hand', 'all-blue', 'few-energy', 'rested-energy', 'source-rested', 'outside-main', 'opponent-turn', 'target-faints']
const extraCases = ['close-extra', 'active-target', 'cost-cookie', 'cost-blue', 'ready-stage', 'ready-paid-support', 'ready-zero', 'cancel-payment', 'cancel-target', 'skip-then', 'return-cost', 'discard-deselect', 'ready-deselect', 'ready-reselect', 'ready-back', 'ready-limit']
const blockedEntry = ['extra-six', 'extra-seven-mixed', 'extra-non-arena', 'extra-wrong-name', 'extra-support-name', 'extra-opponent-name', 'extra-equipment', 'extra-full', 'extra-used', 'extra-outside-main', 'extra-opponent-turn']
const blockedAttack = ['few-energy', 'rested-energy', 'source-rested', 'outside-main', 'opponent-turn']
const route = s => s === 'close-extra' ? 'extra-named' : s === 'active-target' || fixtureCases.includes(s) ? s : 'positive'
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return { deck: Number(field.querySelector('.deck-zone .resource-summary>strong')?.textContent), trash: Number(field.querySelector('.discard-zone.resource-summary>strong')?.textContent), hand: field.querySelectorAll('.hand-card').length,
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
  for (const number of ['BS12-056', 'BS12-056@1']) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of [...fixtureCases, ...extraCases].filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const row = { number, scenario, viewport, printedSourceAttested: !['extra-equipment','extra-used'].includes(scenario), scope: 'candidate-ordinary-EXTRA-OR-name-AND-Arena-or-seven-green-supports-NN-two-second-player-one-hand-zero-to-one-support-active', status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = suffix => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${suffix}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route=>route.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp'))}))
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && route(scenario) === 'extra-named' ? 'card:'+number : process.env.BS12_BROWSER_ROUTE === 'generic' && route(scenario) === 'extra-six' ? 'card-negative:'+number : 'bs12-056:'+number+':'+route(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-001,BS12-003,BS12-005,BS12-007,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-017,BS12-019,BS12-024,BS12-028,BS12-029,BS12-030,BS12-031,BS12-038,BS12-039,BS12-041,BS12-044,BS12-046,BS12-048,BS12-050,BS12-051,BS12-053,BS12-054,BS12-054@1,BS12-055,BS12-055@1,BS12-056,BS12-056@1,BS12-057,BS12-058,BS12-058@1,BS12-067,BS12-068,BS4-095,BS6-008,BS6-010,BS9-014,ST4-001')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      row.before = await state(page); row.beforeTrace = await trace(page)
      assert.ok(row.before.bottom.battle.length <= 2 && row.before.top.battle.length <= 2)
      const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-056-source"]')
      if (scenario.startsWith('extra-') || scenario === 'close-extra') {
        assert.equal(await source.count(), 0)
        await page.getByRole('button', { name: '玩家 EXTRA Deck 1 張', exact: true }).click()
        const extra = page.getByRole('dialog', { name: '玩家 EXTRA Deck', exact: true })
        await extra.locator('img').evaluate(i => i.decode())
        assert.equal(await extra.locator('img').getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
        assert.equal(await extra.getByRole('button', { name: /Awaken/ }).count(), 0)
        if (blockedEntry.includes(scenario)) {
          assert.equal(await extra.getByRole('button', { name: '從 EXTRA 登場', exact: true }).count(), 0)
          assert.match(await extra.innerText(), /尚未符合|最多.*兩|每回合|主要階段|只能由目前回合的玩家|本回合/)
          await shot('entry-blocked')
          await page.getByRole('button', { name: '玩家 EXTRA Deck 1 張', exact: true }).click()
          assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
        } else if (scenario === 'close-extra') {
          await page.getByRole('button', { name: '玩家 EXTRA Deck 1 張', exact: true }).click()
          assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
        } else {
          await extra.getByRole('button', { name: '從 EXTRA 登場', exact: true }).click()
          if (scenario === 'extra-refresh') {
            const refresh = page.getByRole('alertdialog')
            const choices = refresh.getByRole('button', { name: /^Peach Cookie Peach Cookie/ })
            assert.equal(await choices.count(), 1)
            await choices.first().click()
          }
          await source.waitFor(); await settle(page)
          const after = await state(page)
          assert.equal(after.bottom.battle.length, 2); assert.equal(after.bottom.battle[1].hp, 3)
          assert.deepEqual(after.bottom.battle[0], row.before.bottom.battle[0])
          assert.deepEqual(after.bottom.support, row.before.bottom.support)
          assert.equal(after.bottom.hand, 3)
          assert.equal(after.bottom.trash, 0); assert.equal(after.bottom.deck, scenario === 'extra-refresh' ? 1 : 13)
          assert.deepEqual(after.top, row.before.top)
          assert.equal(await page.locator('.optional-cost-attack-inline').count(), 0)
          assert.equal(await page.getByRole('button', { name: '玩家 EXTRA Deck 0 張', exact: true }).count(), 1)
          assert.deepEqual((await trace(page)).map(e => e.commandKind), ['play-extra-deck-cookie', ...(scenario === 'extra-refresh' ? ['refresh-deck'] : [])])
          await source.locator('img').first().evaluate(i => i.decode())
          assert.equal(await source.locator('img').first().getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
        }
      } else {
        assert.equal(row.before.bottom.deck, 13)
        assert.equal(row.before.bottom.battle[1].hp, 3)
        await source.locator('img').first().evaluate(i => i.decode())
        assert.equal(await source.locator('img').first().getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
        assert.equal(await source.locator('.skill-action').count(), 0)
        const attackButton = source.locator('button.card-face:not(.hp-card)')
        if (blockedAttack.includes(scenario)) {
          assert.equal(await attackButton.locator(':scope.is-attackable').count(), 0)
          assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
        } else {
          await attackButton.click()
          if (scenario !== 'cancel-payment') for (const i of [0, 1]) await page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="bs12-056-support-${i}"] button.card-face`).click({ position: { x: 10, y: 25 } })
          if (scenario.startsWith('cancel-')) {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
          } else {
            await page.getByRole('button', { name: '選擇攻擊目標：Sugar Swan Cookie', exact: true }).click()
            const then = page.locator('.optional-cost-attack-inline:visible')
            if (scenario === 'first-player') {
              await page.waitForFunction(() => document.querySelector('.top-field .combat-card-wrap .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 4 張'))
              await settle(page)
              assert.equal(await then.count(), 0)
              const after = await state(page)
              assert.equal(after.bottom.hand, 3); assert.equal(after.bottom.trash, 0)
              assert.deepEqual(after.bottom.support.map(s => s.rested), [true, true, true, true])
              assert.deepEqual(after.top.battle.map(c => c.hp), [4, 3])
            } else {
              await then.waitFor(); await settle(page)
              row.ordinary = await state(page)
              assert.deepEqual(row.ordinary.top.battle.map(c => c.hp), scenario === 'target-faints' ? [3] : [4, 3])
              assert.deepEqual(row.ordinary.bottom.support.map(s => s.rested), row.before.bottom.support.map((s, i) => i < 2 || s.rested))
              assert.equal(row.ordinary.bottom.battle[1].rested, true)
              assert.match(await then.innerText(), /棄置 1 張手牌/)
              const bounds = await then.boundingBox()
              assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1)
              await shot('then')
              const skip = ['no-hand', 'skip-then'].includes(scenario)
              let targetIndex = scenario === 'ready-stage' ? 3 : scenario === 'ready-paid-support' ? 0 : 2
              const zero = ['ready-zero', 'ready-deselect'].includes(scenario)
              if (skip) {
                assert.equal(await then.getByRole('button', { name: '支付', exact: true }).isEnabled(), scenario !== 'no-hand')
                await then.getByRole('button', { name: '略過', exact: true }).click()
              } else {
                await then.getByRole('button', { name: '支付', exact: true }).click()
                const costs = then.locator('.modal-card-options > button')
                assert.equal(await costs.count(), 3)
                const next = then.getByRole('button', { name: '下一步', exact: true })
                assert.equal(await next.isEnabled(), false)
                const cost = costs.nth(scenario === 'cost-cookie' ? 0 : scenario === 'cost-blue' ? 2 : 1)
                await cost.click()
                if (scenario === 'discard-deselect') { await cost.click(); assert.equal(await next.isEnabled(), false); await cost.click() }
                if (scenario === 'return-cost') {
                  await then.getByRole('button', { name: '返回', exact: true }).click()
                  assert.deepEqual(await state(page), row.ordinary)
                  await then.getByRole('button', { name: '支付', exact: true }).click()
                  assert.equal(await next.isEnabled(), false); await cost.click()
                }
                assert.deepEqual(await state(page), row.ordinary)
                await next.click()
                const targets = then.locator('.modal-card-options > button')
                assert.equal(await targets.count(), 4)
                assert.match(await then.innerText(), /支援區|支援卡/)
                if (scenario !== 'ready-zero') await targets.nth(targetIndex).click()
                if (scenario === 'ready-limit') {
                  await targets.nth(3).click()
                  assert.equal(await targets.locator(':scope.is-selected').count(), 1)
                }
                if (['ready-deselect', 'ready-reselect'].includes(scenario)) { await targets.nth(targetIndex).click(); if (scenario === 'ready-reselect') { targetIndex = 1; await targets.nth(targetIndex).click() } }
                if (scenario === 'ready-back') {
                  await then.getByRole('button', { name: '上一步', exact: true }).click()
                  assert.deepEqual(await state(page), row.ordinary)
                  await next.click()
                }
                assert.deepEqual(await state(page), row.ordinary)
                await shot('ready-selection')
                await then.getByRole('button', { name: '確認', exact: true }).click()
              }
              await page.waitForFunction(() => !document.querySelector('.optional-cost-attack-inline'), null, { timeout: 20000 }); await settle(page)
              const after = await state(page)
              assert.equal(after.bottom.hand, row.ordinary.bottom.hand - (skip ? 0 : 1))
              assert.equal(after.bottom.trash, row.ordinary.bottom.trash + (skip ? 0 : 1))
              assert.equal(after.bottom.deck, row.ordinary.bottom.deck)
              assert.deepEqual(after.bottom.battle, row.ordinary.bottom.battle)
              assert.deepEqual(after.top, row.ordinary.top)
              assert.deepEqual(after.bottom.support.map(s => s.rested), row.ordinary.bottom.support.map((s, i) => !skip && !zero && i === targetIndex ? false : s.rested))
              const commands = (await trace(page)).map(e => e.commandKind)
              assert.deepEqual(commands, ['declare-attack', 'resolve-next-damage', 'resolve-next-damage', 'resolve-attack-effect', 'resolve-optional-cost-attack'])
              row.thenTrace = (await trace(page)).at(-1)
              const steps = row.thenTrace.steps.join(' ')
              if (skip) assert.match(steps, /未支付代價/)
              else { assert.match(steps, /棄置手牌/); assert.match(steps, zero ? /選擇 0 張支援卡/ : /1 張支援卡設為活躍/) }
            }
          }
        }
      }
      row.after = await state(page); row.trace = await trace(page)
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
      await shot('result'); row.status = 'PASS'
    } catch (e) { row.error = e.stack; await shot('failure'); rows.push(row); writeFileSync(resolve(out, 'results.json'), JSON.stringify(rows, null, 2)); throw e }
    finally { await page.close() }
    rows.push(row); console.log(`PASS ${number} ${scenario} ${viewport.width}`)
  }
} finally { await browser.close(); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)) }
console.log(`BS12-056 candidate Browser: ${rows.filter(r => r.status === 'PASS').length}/${rows.length}`)
