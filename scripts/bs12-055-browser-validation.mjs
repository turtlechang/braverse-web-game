import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-055-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const fixtures = ['positive', 'rested-entry', 'source-rested', 'hand-origin', 'other-cookie', 'old-turn', 'no-hand', 'source-support', 'opponent-turn', 'outside-main', 'deck-item', 'deck-stage', 'deck-blue', 'refresh', 'refresh-lv10', 'source-only', 'source-only-no-cookie', 'empty-deck', 'attack', 'attack-wrong', 'attack-rested-energy', 'attack-rested-source', 'deploy']
const extras = ['zero', 'zero-refresh', 'cancel-cost', 'cancel-choice', 'cancel-confirm', 'back-cost', 'deselect-cost', 'cost-item', 'cost-blue', 'cancel-attack-payment', 'cancel-attack-target']
const blocked = ['hand-origin', 'other-cookie', 'old-turn', 'no-hand', 'source-support', 'opponent-turn', 'outside-main']
const route = s => s === 'zero-refresh' ? 'refresh' : s.startsWith('cancel-attack') ? 'attack' : fixtures.includes(s) ? s : 'positive'
const readState = page => page.evaluate(() => {
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
  for (const number of ['BS12-055', 'BS12-055@1']) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of [...fixtures, ...extras].filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const row = { number, scenario, viewport, scope: 'candidate-this-source-support-entry-this-turn-paid-hand-and-source-trash-zero-or-one-rested-deck-support-G-ordinary', status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = suffix => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${suffix}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route=>route.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp'))}))
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && route(scenario) === 'positive' ? 'card:'+number : process.env.BS12_BROWSER_ROUTE === 'generic' && route(scenario) === 'hand-origin' ? 'card-negative:'+number : 'bs12-055:'+number+':'+route(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-001,BS12-003,BS12-005,BS12-007,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-017,BS12-019,BS12-024,BS12-028,BS12-029,BS12-030,BS12-031,BS12-038,BS12-039,BS12-041,BS12-044,BS12-046,BS12-048,BS12-050,BS12-051,BS12-053,BS12-054,BS12-054@1,BS12-055,BS12-055@1,BS12-056,BS12-056@1,BS12-057,BS12-058,BS12-058@1,BS12-067,BS12-068,BS4-095,BS6-008,BS6-010,BS9-014,ST4-001')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      row.before = await readState(page); row.beforeTrace = await trace(page)
      const wrap = page.locator('[data-card-instance-id="bs12-055-source"]')
      const image = wrap.locator('img[alt="Herb Cookie"]').first()
      await image.evaluate(i => i.decode())
      assert.equal(await image.getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
      if (scenario === 'deploy') {
        await wrap.locator('button.card-face').click()
        await wrap.getByRole('button', { name: '登場', exact: true }).click()
        await page.waitForFunction(() => document.querySelector('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-055-source"]'))
        await settle(page)
        const after = await readState(page)
        assert.deepEqual(after.bottom.battle.map(c => c.hp), [2, 2]); assert.equal(after.bottom.deck, 12)
        assert.equal(await wrap.getByRole('button', { name: '啟動技能', exact: true }).isEnabled(), false)
        assert.match(await wrap.innerText(), /這張餅乾本回合從自己的支援區登場/)
        assert.deepEqual((await trace(page)).map(e => e.commandKind), ['deploy-cookie'])
      } else if (scenario.startsWith('attack') || scenario.startsWith('cancel-attack')) {
        const source = wrap.locator('button.card-face:not(.hp-card)')
        if (scenario !== 'attack' && !scenario.startsWith('cancel-attack')) {
          assert.equal(await source.locator(':scope.is-attackable').count(), 0)
          assert.deepEqual(await readState(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
        } else {
          await source.click()
          if (scenario !== 'cancel-attack-payment') await page.locator('.bottom-field .support-card-wrap[data-card-instance-id="bs12-055-support-0"] button.card-face').click({ position: { x: 10, y: 25 } })
          if (scenario.startsWith('cancel-attack')) {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await readState(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
          } else {
            await page.getByRole('button', { name: '選擇攻擊目標：Sugar Swan Cookie', exact: true }).click()
            await page.waitForFunction(() => document.querySelector('.top-field .combat-card-wrap .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 5 張'))
            await settle(page)
            const after = await readState(page)
            assert.deepEqual(after.top.battle.map(c => c.hp), [5, 3]); assert.equal(after.top.trash, 2)
            assert.deepEqual(after.bottom.support.map(c => c.rested), [true, false, false, false])
            assert.equal(after.bottom.battle[1].rested, true)
            assert.deepEqual((await trace(page)).map(e => e.commandKind), ['declare-attack', 'resolve-battle'])
          }
        }
      } else if (blocked.includes(scenario)) {
        const skill = wrap.getByRole('button', { name: '啟動技能', exact: true })
        if (await skill.count()) assert.equal(await skill.isEnabled(), false)
        if (['hand-origin', 'other-cookie', 'old-turn'].includes(scenario)) assert.match(await wrap.innerText(), /這張餅乾本回合從自己的支援區登場/)
        assert.equal(await page.getByRole('alertdialog').count(), 0)
        assert.deepEqual(await readState(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
      } else {
        await wrap.getByRole('button', { name: '啟動技能', exact: true }).click()
        const panel = page.getByRole('alertdialog')
        const next = panel.getByRole('button', { name: '下一步', exact: true })
        assert.match(await panel.innerText(), /來源餅乾及其 HP 卡/)
        assert.equal(await next.isEnabled(), false)
        const names = ['Peach Cookie', 'Wonderful Melody', 'Candy Diver Cookie']
        let costIndex = scenario === 'cost-item' ? 1 : scenario === 'cost-blue' ? 2 : 0
        const choice = name => panel.getByRole('button', { name: new RegExp(`^${name} ${name}`) })
        assert.equal(await panel.locator('.effect-candidates .effect-candidate-entry>button').count(), scenario === 'source-only-no-cookie' ? 1 : 3)
        await choice(names[costIndex]).click()
        if (scenario === 'deselect-cost') { await choice(names[costIndex]).click(); assert.equal(await next.isEnabled(), false); await choice(names[costIndex]).click() }
        if (scenario === 'cancel-cost') {
          await panel.getByRole('button', { name: '取消技能', exact: true }).click()
        } else {
          await next.click()
          assert.equal(await panel.locator('.effect-candidates-choice button').count(), 2)
          assert.equal(await next.isEnabled(), false)
          if (scenario === 'back-cost') {
            await panel.getByRole('button', { name: '上一步', exact: true }).click()
            await choice(names[costIndex]).click(); costIndex = 1; await choice(names[costIndex]).click(); await next.click()
          }
          await shot('choice')
          if (scenario === 'cancel-choice') {
            await panel.getByRole('button', { name: '取消技能', exact: true }).click()
          } else {
            const zero = ['zero', 'zero-refresh', 'empty-deck'].includes(scenario)
            await panel.getByRole('button', { name: zero ? '2 不放置卡牌' : '1 將牌庫頂 1 張卡以疲勞狀態放入支援區', exact: true }).click()
            await next.click()
            assert.match(await panel.innerText(), new RegExp(`從牌庫頂放 ${zero ? 0 : 1} 張到支援區`))
            assert.deepEqual(await readState(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
            await shot('confirm')
            if (scenario === 'cancel-confirm') {
              await panel.getByRole('button', { name: '取消技能', exact: true }).click()
            } else {
              await panel.getByRole('button', { name: '確認發動', exact: true }).click()
              await page.waitForFunction(() => !document.querySelector('.effect-panel:not(.is-complete)'))
              await settle(page)
              const afterEffect = await readState(page)
              assert.deepEqual(afterEffect.bottom.battle, scenario.startsWith('source-only') ? [] : [row.before.bottom.battle[0]])
              assert.deepEqual(afterEffect.bottom.support, [...row.before.bottom.support, ...(zero ? [] : [{ id: 'bs12-055-deck-2', rested: true }])])
              assert.equal(afterEffect.bottom.hand, row.before.bottom.hand - 1); assert.equal(afterEffect.bottom.trash, 4)
              assert.equal(afterEffect.bottom.deck, row.before.bottom.deck - (zero ? 0 : 1)); assert.deepEqual(afterEffect.top, row.before.top)
              const receipt = await trace(page)
              assert.deepEqual(receipt.map(e => e.commandKind), ['begin-activate-skill', 'resolve-ability-effect'])
              assert.ok(receipt[0].steps.some(s => s.includes('Herb Cookie') && s.includes('技能代價')))
              assert.ok(receipt[0].steps.some(s => s.includes(names[costIndex]) && s.includes('棄')))
              assert.ok(receipt[1].steps.some(s => s.includes('支援區') || s.includes('0 張')))
              if (['refresh', 'refresh-lv10'].includes(scenario)) {
                assert.match(await page.getByRole('alertdialog').innerText(), /Refresh/)
                const peach = page.getByRole('alertdialog').getByRole('button', { name: /^Peach Cookie Peach Cookie/ })
                assert.equal(await peach.count(), 1) // One actual printed Peach; Herb is a distinct LV2 choice.
                await peach.first().click()
                await settle(page)
                assert.equal((await readState(page)).bottom.deck, 3)
                assert.equal((await readState(page)).bottom.trash, 0)
              }
              if (scenario === 'source-only') {
                assert.equal(await page.getByRole('button', { name: '不補餅乾', exact: true }).count(), 0)
                await page.getByRole('alertdialog').getByRole('button', { name: 'Candy Diver Cookie Candy Diver Cookie', exact: true }).click()
                await settle(page)
                assert.deepEqual((await readState(page)).bottom.battle.map(c => ({ id: c.id, hp: c.hp })), [{ id: 'bs12-055-hand-2', hp: 3 }])
                assert.equal((await readState(page)).bottom.deck, 8)
              } else if (scenario !== 'refresh-lv10') await page.getByRole('button', { name: '不補餅乾', exact: true }).click()
              await settle(page)
              if (['refresh-lv10', 'source-only-no-cookie'].includes(scenario)) {
                await page.getByRole('heading', { name: 'AI 對手勝利', exact: true }).waitFor()
                assert.match(await page.locator('body').innerText(), scenario === 'refresh-lv10' ? /我方休息區的等級達到 10/ : /沒有.*餅乾/)
              } else assert.equal(await page.getByRole('alertdialog').count(), 0)
              // The card-scoped trace excludes skip-replacement, which has no source card.
              assert.deepEqual((await trace(page)).map(e => e.commandKind), ['begin-activate-skill', 'resolve-ability-effect', ...(['refresh', 'refresh-lv10'].includes(scenario) ? ['refresh-deck'] : []), ...(scenario === 'source-only' ? ['replace-cookie'] : [])])
              if (!['refresh-lv10', 'source-only-no-cookie'].includes(scenario)) assert.equal(await page.getByRole('button', { name: '結束主要階段', exact: true }).isEnabled(), true)
            }
          }
        }
        if (scenario.startsWith('cancel-') && !scenario.startsWith('cancel-attack')) { assert.deepEqual(await readState(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace) }
      }
      row.after = await readState(page); row.trace = await trace(page)
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
      await shot('result'); row.status = 'PASS'; console.log(`PASS ${number} ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { row.error = String(error.stack ?? error); row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { rows.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)); await page.close() }
  }
  console.log(`BS12-055 Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
