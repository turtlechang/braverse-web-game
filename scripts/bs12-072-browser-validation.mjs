import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-072-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const references = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...references].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const fixtures = ['positive', 'green-arena', 'red-arena', 'yellow-arena', 'level-one', 'level-three', 'non-arena', 'rested-target', 'equipped-target', 'same-name', 'no-target', 'hand-only', 'support-only', 'stage-only', 'no-energy', 'one-energy', 'wrong-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main', 'once-used', 'short-deck', 'awakened-target']
const cases = [...fixtures, 'zero', 'cancel-energy', 'cancel-target', 'back-energy', 'payment-deselect', 'payment-switch', 'target-deselect', 'minimize', 'replacement', 'attack', 'attack-one', 'attack-wrong', 'attack-rested', 'attack-source-rested', 'cancel-attack']
const blocked = ['no-energy', 'wrong-energy', 'rested-energy', 'opponent-turn', 'outside-main', 'once-used']
const noTarget = ['non-arena', 'level-three', 'no-target', 'hand-only', 'support-only', 'stage-only', 'awakened-target']
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return { hand: field.querySelectorAll('.hand-card-wrap').length,
      deck: Number(field.querySelector('.deck-zone .resource-summary>strong')?.textContent), trash: Number(field.querySelector('.discard-zone.resource-summary>strong')?.textContent),
      // BattleRow previews draft payment by rotating selected supports. A
      // selected card is a visual draft; the trace must still contain no pay.
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
  for (const number of (process.env.BS12_BROWSER_PRINTS ?? 'BS12-072').split(',')) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) {
    for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
      const page = await browser.newPage({ viewport })
      const row = { number, scenario, viewport, scope: 'candidate-confirmed-Activate-B1-other-own-LV2-or-lower-Arena-and-BB2; entire-Then-deferred-R004', printedSourceAttested: !['equipped-target','awakened-target'].includes(scenario), status: 'FAIL', errors: [], networkFailures: [] }
      const shot = label => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${label}.png`) })
      page.on('pageerror', e => row.errors.push(e.message))
      page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
      page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
      try {
        for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
        const fixture = fixtures.includes(scenario) ? scenario : ({ 'attack-one': 'one-energy', 'attack-wrong': 'wrong-energy', 'attack-rested': 'rested-energy', 'attack-source-rested': 'source-rested' }[scenario] ?? 'positive')
        const physicalRoute = fixture
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'positive' ? 'card:'+number : process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'non-arena' ? 'card-negative:'+number : 'bs12-072:'+number+':'+physicalRoute
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-001,BS12-002,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-019,BS12-021,BS12-027,BS12-028,BS12-029,BS12-030,BS12-031,BS12-040,BS12-046,BS12-058,BS12-059,BS12-060,BS12-061,BS12-064,BS12-069,BS12-070,BS12-071,BS12-072,BS12-073,BS3-082,BS6-008,BS6-017,BS7-061,ST4-001'+','+number)
        await page.locator('.game-shell').waitFor()
        await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
        await settle(page)
        row.before = await state(page)
        row.setupTrace = await trace(page)
        assert.deepEqual(row.setupTrace.map(c => c.commandKind), scenario === 'once-used' ? ['begin-activate-skill', 'resolve-ability-effect'] : [])
        const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-072-source"]')
        await source.locator('img').first().evaluate(i => i.decode())
        assert.equal(await source.locator('img').first().getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
        const panel = page.locator('.effect-panel:not(.is-complete)')
        if (scenario.startsWith('attack') || scenario === 'cancel-attack') {
          if (['attack-one', 'attack-wrong', 'attack-rested', 'attack-source-rested'].includes(scenario)) {
            assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
            assert.deepEqual(await state(page), row.before)
          } else {
            await source.locator('.card-face.is-attackable').click()
            await page.locator('.bottom-field .support-card-wrap .card-face').nth(0).click({ position: { x: 10, y: 25 } })
            assert.equal(await page.getByRole('button', { name: /^選擇攻擊目標/ }).count(), 0)
            await page.locator('.bottom-field .support-card-wrap .card-face').nth(1).click({ position: { x: 10, y: 25 } })
            if (scenario === 'cancel-attack') {
              await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
              assert.deepEqual(await state(page), row.before)
              assert.deepEqual(await trace(page), [])
            } else {
              await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-064-opponent"]').getByRole('button', { name: /^選擇攻擊目標/ }).click()
              await page.waitForFunction(() => document.querySelector('.top-field .combat-card-wrap .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 4 張') && !document.querySelector('.effect-panel:not(.is-complete)'))
              await settle(page)
              const after = await state(page)
              assert.deepEqual(after.top.battle.map(c => c.hp), [4, 4])
              assert.equal(after.bottom.hand, row.before.bottom.hand)
              assert.equal(after.bottom.deck, row.before.bottom.deck)
              assert.equal(after.bottom.trash, row.before.bottom.trash)
              assert.ok(after.bottom.support.every(c => c.rested))
              assert.equal(after.bottom.battle[0].rested, true)
              assert.ok((await trace(page)).some(c => c.commandKind === 'declare-attack'))
              assert.ok((await trace(page)).every(c => !['resolve-optional-cost-attack', 'resolve-reveal-top-deck', 'begin-activate-skill'].includes(c.commandKind)))
            }
          }
        } else {
          const activate = source.getByRole('button', { name: '啟動技能', exact: true })
          if (blocked.includes(scenario)) {
            assert.ok(await activate.count() === 0 || !await activate.isEnabled())
            assert.deepEqual(await state(page), row.before)
            assert.deepEqual(await trace(page), row.setupTrace)
          } else {
            await activate.click()
            await panel.waitFor()
            assert.match(await panel.innerText(), /Place up to 1 other LV\.2 or lower.*Arena.*bottom of your deck/s)
            const payments = panel.getByRole('button', { name: /^Candy Diver Cookie Candy Diver Cookie/ })
            assert.equal(await panel.getByRole('button', { name: '下一步', exact: true }).isEnabled(), false)
            assert.deepEqual(await state(page), row.before)
            if (scenario === 'cancel-energy') await panel.getByRole('button', { name: '取消技能', exact: true }).click()
            else {
              const paymentIndex = scenario === 'payment-switch' ? 1 : 0
              await payments.nth(paymentIndex).click()
              if (scenario === 'payment-deselect') {
                await payments.nth(0).click()
                assert.equal(await panel.getByRole('button', { name: '下一步', exact: true }).isEnabled(), false)
                await payments.nth(0).click()
              }
              await shot('payment')
              await panel.getByRole('button', { name: '下一步', exact: true }).click()
              const candidates = panel.locator('.effect-candidate-entry>button')
              assert.equal(await candidates.count(), noTarget.includes(scenario) ? 0 : 1)
              assert.match(await panel.innerText(), /來源以外、LV\.2 以下、【Arena】/)
              assert.deepEqual(await state(page), row.before)
              const choose = !noTarget.includes(scenario) && !['zero', 'cancel-target'].includes(scenario)
              if (choose) await candidates.first().click()
              if (scenario === 'target-deselect') await candidates.first().click()
              if (scenario === 'back-energy') {
                await panel.getByRole('button', { name: '上一步', exact: true }).click()
                assert.deepEqual(await state(page), row.before)
                await panel.getByRole('button', { name: '下一步', exact: true }).click()
                if (await panel.locator('.effect-candidate-entry>button.is-selected').count() === 0) await candidates.first().click()
              }
              if (scenario === 'minimize') {
                await panel.getByRole('button', { name: '縮小', exact: true }).click()
                await page.locator('.effect-panel-dock').click()
              }
              await shot('target')
              if (scenario === 'cancel-target') await panel.getByRole('button', { name: '取消技能', exact: true }).click()
              else {
                await panel.getByRole('button', { name: '確認發動', exact: true }).click()
                const moved = choose && scenario !== 'target-deselect'
                const replacement = page.getByRole('button', { name: '不補餅乾', exact: true })
                if (moved) {
                  await replacement.waitFor()
                  row.moved = await state(page)
                  const target = row.before.bottom.battle.find(c => c.id === 'bs12-072-target')
                  assert.equal(row.moved.bottom.deck, row.before.bottom.deck + 1)
                  assert.equal(row.moved.bottom.trash, row.before.bottom.trash + target.hp + (scenario === 'equipped-target' ? 1 : 0))
                  assert.deepEqual(row.moved.bottom.battle, row.before.bottom.battle.filter(c => c.id !== 'bs12-072-target'))
                  if (scenario === 'replacement') await page.getByRole('button', { name: 'Ice Pop Cookie Ice Pop Cookie', exact: true }).click()
                  else await replacement.click()
                }
                await settle(page)
                row.after = await state(page)
                assert.deepEqual(row.after.top, row.before.top)
                assert.deepEqual(row.after.bottom.support, row.before.bottom.support.map((s, i) => i === paymentIndex ? { ...s, rested: true } : s))
                assert.equal(row.after.bottom.breakLevel, row.before.bottom.breakLevel)
                assert.deepEqual(row.after.bottom.battle[0], row.before.bottom.battle[0])
                if (!moved) {
                  assert.deepEqual(row.after.bottom.battle, row.before.bottom.battle)
                  assert.equal(row.after.bottom.deck, row.before.bottom.deck)
                  assert.equal(row.after.bottom.trash, row.before.bottom.trash)
                } else if (scenario === 'replacement') {
                  assert.equal(row.after.bottom.battle[1].id, 'bs12-072-replacement')
                  assert.equal(row.after.bottom.battle[1].hp, 3)
                  assert.equal(row.after.bottom.deck, row.before.bottom.deck - 2)
                }
                assert.equal(row.after.bottom.hand, row.before.bottom.hand - (scenario === 'replacement' ? 1 : 0))
                const commands = await trace(page)
                assert.deepEqual(commands.slice(0, 2).map(c => c.commandKind), ['begin-activate-skill', 'resolve-ability-effect'])
                assert.match(commands.flatMap(c => c.steps).join(' '), moved ? /放到持有者牌庫底/ : /未選擇目標/)
                assert.equal(await activate.isEnabled(), false)
              }
            }
            if (['cancel-energy', 'cancel-target'].includes(scenario)) {
              assert.deepEqual(await state(page), row.before)
              assert.deepEqual(await trace(page), [])
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
      finally { rows.push(row); writeFileSync(resolve(out, `${number}-${process.env.BS12_BROWSER_CASES ? 'subset-' : ''}results.json`), JSON.stringify(rows, null, 2)); await page.close() }
    }
  }
} finally { await browser.close() }
console.log(`BS12-072 confirmed branches candidate local Browser ${rows.length}/${rows.length}; Then R004/formal BS12/online not covered.`)
