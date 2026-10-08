import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-052-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const fixtures = ['positive', 'rested-entry', 'no-hand', 'item-hand', 'stage-hand', 'non-arena-hand', 'hand', 'stage-entry', 'full-battle', 'last-hp', 'short-deck', 'last-deck', 'refresh-lv10', 'isolated-opponent-turn', 'attack', 'attack-blue', 'attack-wrong', 'attack-few', 'attack-rested-energy', 'attack-rested-source']
const extras = ['zero', 'skip-on-play', 'skip-after-draft', 'deselect-cost', 'cost-max', 'back-cost', 'target-zero-after-deselect', 'target-max', 'target-switch', 'damage-first-foe', 'parent-zero', 'cancel-parent-payment', 'cancel-parent-target', 'stage-zero', 'stage-skip', 'attack-cancel']
const cases = [...fixtures, ...extras]
const readState = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return { deck: Number(field.querySelector('.deck-zone .resource-summary>strong')?.textContent), trash: Number(field.querySelector('.discard-zone.resource-summary>strong')?.textContent), hand: field.querySelectorAll('.hand-card').length,
      breakLevel: Number(field.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1]),
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
  for (const number of ['BS12-052', 'BS12-052@1']) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const row = { number, scenario, viewport, printedSourceAttested: scenario !== 'isolated-opponent-turn', scope: scenario === 'isolated-opponent-turn' ? 'isolated-support-entry-opponent-turn' : 'candidate-printed-support-OnPlay-discard-one-foe-zero-or-one-damage', status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${label}.png`) })
    try {
      const attack = scenario.startsWith('attack')
      const stage = ['stage-entry', 'stage-zero', 'stage-skip'].includes(scenario)
      const fixture = stage ? 'stage-entry' : scenario === 'attack-cancel' ? 'attack' : extras.includes(scenario) ? 'positive' : scenario
      for (const card of cards) await page.route(card.imageUrl, route=>route.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp'))}))
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'positive' ? 'card:'+number : process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'hand' ? 'card-negative:'+number : 'bs12-052:'+number+':'+fixture
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-001,BS12-003,BS12-005,BS12-006,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-019,BS12-022,BS12-028,BS12-029,BS12-030,BS12-031,BS12-038,BS12-039,BS12-041,BS12-044,BS12-046,BS12-048,BS12-049,BS12-050,BS12-051,BS12-052,BS12-053,BS12-055,BS12-070,BS6-008,BS7-055,BS7-061,ST3-001,ST4-001,ST4-002,ST4-003,ST4-004,ST4-005')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      row.before = await readState(page)
      const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-052-source"]')
      const panel = page.getByRole('alertdialog')
      let entered = scenario === 'isolated-opponent-turn'
      if (attack) {
        const image = source.locator('img').first()
        await image.evaluate(i => i.decode())
        assert.equal(await image.getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
        if (['attack-wrong', 'attack-few', 'attack-rested-energy', 'attack-rested-source'].includes(scenario)) {
          assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
          assert.deepEqual(await readState(page), row.before)
          assert.deepEqual(await trace(page), [])
        } else {
          await source.locator('.card-face.is-attackable').click()
          await page.locator('.bottom-field [data-card-instance-id="bs12-052-payment-0"] .card-face').click({ position: { x: 10, y: 25 } })
          const target = page.getByRole('button', { name: '選擇攻擊目標：Sugar Swan Cookie', exact: true })
          assert.equal(await target.count(), 0)
          await page.locator('.bottom-field [data-card-instance-id="bs12-052-payment-1"] .card-face').click({ position: { x: 10, y: 25 } })
          if (scenario === 'attack-cancel') {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await readState(page), row.before)
            assert.deepEqual(await trace(page), [])
          } else {
            await target.click()
            await page.waitForFunction(() => document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="bs12-044-opponent"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 4 張'))
            await settle(page)
            assert.deepEqual((await readState(page)).top.battle.map(c => c.hp), [4, 3])
            assert.equal((await readState(page)).top.trash, 2)
            assert.deepEqual((await readState(page)).bottom.support.map(c => c.rested), [true, true, false])
            assert.equal(await panel.count(), 0)
            assert.equal((await trace(page)).filter(e => e.commandKind === 'declare-attack').length, 1)
          }
        }
      } else {
        if (scenario === 'hand') {
          const hand = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator('img[alt="Cocoa Cookie"]') })
          await hand.locator('button.card-face').click()
          await hand.getByRole('button', { name: '登場', exact: true }).click()
          entered = true
        } else if (stage) {
          await page.locator('.bottom-field .stage-quick-action').click()
          await panel.getByRole('button', { name: '下一步', exact: true }).click()
          await panel.getByRole('button', { name: /^Cocoa Cookie Cocoa Cookie/ }).click()
          await panel.getByRole('button', { name: '確認發動', exact: true }).click()
          entered = true
        } else if (!entered) {
          await page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-051-source"] .card-face.is-attackable').click()
          if (scenario === 'cancel-parent-payment') await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
          else {
            await page.locator('.bottom-field [data-card-instance-id="bs12-051-support-0"] .card-face').click({ position: { x: 10, y: 25 } })
            if (scenario === 'cancel-parent-target') await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            else {
              await page.getByRole('button', { name: '選擇攻擊目標：Sugar Swan Cookie', exact: true }).click()
              await panel.waitFor()
              assert.equal((await readState(page)).top.battle[0].hp, 5)
              const cocoa = panel.getByRole('button', { name: /^Cocoa Cookie Cocoa Cookie/ })
              const empty = scenario === 'full-battle' || scenario === 'parent-zero'
              if (scenario === 'full-battle') assert.equal(await cocoa.count(), 0)
              if (!empty) {
                assert.equal(await cocoa.locator('img').getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
                await cocoa.locator('img').evaluate(i => i.decode())
                await cocoa.click()
              }
              await panel.getByRole('button', { name: '確認發動', exact: true }).click()
              entered = !empty
            }
          }
        }
        if (['cancel-parent-payment', 'cancel-parent-target'].includes(scenario)) {
          assert.deepEqual(await readState(page), row.before)
          assert.deepEqual(await trace(page), [])
        }
        if (entered) {
          if (['last-deck', 'short-deck', 'refresh-lv10'].includes(scenario)) {
            await panel.getByRole('button', { name: /^Candy Diver Cookie Candy Diver Cookie/ }).click()
            if (scenario === 'refresh-lv10') await page.getByRole('heading', { name: 'AI 對手勝利', exact: true }).waitFor()
          }
          await source.waitFor()
          await settle(page)
          const image = source.locator('img').first()
          await image.evaluate(i => i.decode())
          assert.equal(await image.getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
          row.entry = await readState(page)
          if (stage) assert.equal(row.entry.bottom.stageRested, true)
          assert.equal(row.entry.bottom.battle.find(c => c.id === 'bs12-052-source').hp, scenario === 'refresh-lv10' ? 1 : 2)
          assert.equal(row.entry.bottom.battle.find(c => c.id === 'bs12-052-source').rested, false)
          if (['hand', 'no-hand', 'refresh-lv10'].includes(scenario)) {
            assert.equal(await page.getByRole('button', { name: '略過整個登場效果', exact: true }).count(), 0)
            assert.deepEqual(row.entry.top.battle.map(c => c.hp), [5 - (scenario === 'hand' ? -1 : 0), 3])
            if (scenario === 'refresh-lv10') { assert.equal(row.entry.bottom.breakLevel, 11); assert.equal(row.entry.bottom.hand, 2); assert.equal(row.entry.bottom.trash, 0) }
          } else {
            await panel.waitFor()
            assert.match(await panel.innerText(), /選擇 1 張手牌棄置/)
            assert.equal(await panel.locator('img[alt="Cocoa Cookie"]').first().getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
            const skip = ['skip-on-play', 'skip-after-draft', 'stage-skip'].includes(scenario)
            const cost = panel.locator('.effect-candidate-entry>button')
            const firstCostName = scenario === 'item-hand' ? 'Wonderful Melody' : scenario === 'stage-hand' ? 'Orchestra Hall' : scenario === 'non-arena-hand' ? 'Candy Diver Cookie' : 'Muscle Cookie'
            const selectedCost = cost.filter({ hasText: firstCostName })
            assert.equal(await cost.count(), 2)
            if (skip && scenario !== 'skip-after-draft') await panel.getByRole('button', { name: '略過整個登場效果', exact: true }).click()
            else {
              assert.equal(await panel.getByRole('button', { name: '下一步', exact: true }).isEnabled(), false)
              await selectedCost.click()
              if (scenario === 'deselect-cost') { await selectedCost.click(); assert.equal(await panel.getByRole('button', { name: '下一步', exact: true }).isEnabled(), false); await selectedCost.click() }
              if (scenario === 'cost-max') { assert.equal(await cost.count(), 1); assert.equal(await cost.filter({ hasText: 'Sweet Jams Guitar' }).count(), 0); assert.equal(await panel.locator('.effect-candidate-entry>button.is-selected').count(), 1) }
              assert.deepEqual(await readState(page), row.entry)
              await shot('cost')
              if (skip) await panel.getByRole('button', { name: '略過整個登場效果', exact: true }).click()
              else {
                await panel.getByRole('button', { name: '下一步', exact: true }).click()
                if (scenario === 'back-cost') { await panel.getByRole('button', { name: '上一步', exact: true }).click(); assert.deepEqual(await readState(page), row.entry); await panel.getByRole('button', { name: '下一步', exact: true }).click() }
                const target = n => panel.getByRole('button', { name: n === 0 ? /^Sugar Swan Cookie Sugar Swan Cookie AI 對手/ : /^Candy Diver Cookie Candy Diver Cookie AI 對手/ })
                assert.equal(await panel.locator('.effect-candidate-entry>button').count(), 2)
                let targetIndex = ['zero', 'stage-zero'].includes(scenario) ? null : scenario === 'damage-first-foe' ? 0 : 1
                if (targetIndex !== null) await target(targetIndex).click()
                if (scenario === 'target-zero-after-deselect') { await target(1).click(); targetIndex = null }
                if (scenario === 'target-max') { await target(0).click(); assert.equal(await panel.locator('.effect-candidate-entry>button.is-selected').count(), 1) }
                if (scenario === 'target-switch') { await target(1).click(); await target(0).click(); targetIndex = 0 }
                assert.deepEqual(await readState(page), row.entry)
                await shot('target')
                await panel.getByRole('button', { name: '確認發動', exact: true }).click()
                await settle(page)
                await page.waitForFunction(({ index, before }) => {
                  if (index === null) return true
                  const id = index === 0 ? 'bs12-044-opponent' : 'bs12-044-opponent-other'
                  const n = document.querySelector(`.top-field [data-card-instance-id="${id}"] .hp-card-stack`)
                  return before === 1 ? !n : n?.getAttribute('aria-label')?.includes(`HP 卡 ${before - 1} 張`)
                }, { index: targetIndex, before: targetIndex === null ? 0 : row.entry.top.battle[targetIndex].hp })
                const after = await readState(page)
                assert.equal(after.bottom.hand, row.entry.bottom.hand - 1)
                assert.equal(after.bottom.trash, row.entry.bottom.trash + 1)
                assert.deepEqual(after.bottom.battle, row.entry.bottom.battle)
                assert.equal(after.bottom.deck, row.entry.bottom.deck)
                assert.deepEqual(after.bottom.support, row.entry.bottom.support)
                assert.deepEqual(after.top.battle, row.entry.top.battle.flatMap((c, i) => i === targetIndex ? c.hp === 1 ? [] : [{ ...c, hp: c.hp - 1 }] : [c]))
                if (targetIndex !== null) assert.equal(after.top.trash, row.entry.top.trash + 1)
                row.damageTarget = targetIndex
                const discarded = page.locator('.bottom-field .discard-zone img')
                assert.equal(await discarded.getAttribute('alt'), firstCostName)
                const commands = await trace(page)
                assert.equal(commands.filter(e => e.commandKind === 'begin-activate-skill').length, 1)
                assert.equal(commands.filter(e => e.commandKind === 'resolve-ability-effect').length, stage ? 2 : 1)
              }
            }
            if (skip) assert.deepEqual(await readState(page), row.entry)
            if (stage) {
              // Completing Cocoa must hydrate Orchestra Hall as the source of
              // its continuation, never show the Stage Then on a Cocoa panel.
              await page.waitForFunction(() => [...document.querySelectorAll('[role="alertdialog"]')].some(n => n.textContent.includes('Orchestra Hall') && !n.textContent.includes('Cocoa Cookie')))
              assert.match(await panel.innerText(), /Orchestra Hall/)
              const confirm = panel.getByRole('button', { name: '確認發動', exact: true })
              if (await confirm.count()) await confirm.click()
              await panel.getByRole('button', { name: '略過', exact: true }).click()
            }
            await page.waitForFunction(() => !document.querySelector('[role="alertdialog"]'))
          }
        } else if (['parent-zero', 'full-battle'].includes(scenario)) {
          assert.equal(await source.count(), 0)
          assert.equal((await readState(page)).bottom.deck, row.before.bottom.deck)
          assert.equal((await readState(page)).bottom.hand, row.before.bottom.hand)
        }
      }
      row.after = await readState(page)
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
      console.log(`PASS ${number} ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { row.error = String(error.stack ?? error); row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { rows.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)); await page.close() }
  }
  console.log(`BS12-052 Browser ${rows.length}/${rows.length}; isolated ${rows.filter(r => r.scenario === 'isolated-opponent-turn').length}`)
} finally { await browser.close() }
