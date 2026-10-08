import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-093-browser')
mkdirSync(out, { recursive: true })
const records = ['data/candidates/official-festival-arena-bs12.en.json', ...readdirSync(resolve(root, 'data/cards')).filter(f => f.endsWith('.json')).map(f => `data/cards/${f}`)]
  .flatMap(path => JSON.parse(readFileSync(resolve(root, path), 'utf8')).cards ?? [])
const art = records.map(record=>({record,path:['bs12-official-art','bs11-official-art'].map(dir=>resolve(root,'test-results/'+dir+'/'+record.cardNumber+'.webp')).find(existsSync)})).filter(entry=>entry.path)
for(const entry of art)assert.ok(entry.record.imageUrl&&existsSync(entry.path))
const cards=art.map(entry=>entry.record)
const state = page => page.evaluate(() => {
  const side = id => {
    const field = document.querySelector(`.battle-row[data-animation-player="${id}"]`)
    return { deck: Number(field?.querySelector('.deck-zone .resource-summary > strong')?.textContent), trash: Number(field?.querySelector('.discard-zone.resource-summary > strong')?.textContent),
      hand: Number(field?.querySelector('[aria-label^="手牌 "]')?.getAttribute('aria-label')?.match(/手牌 (\d+)/)?.[1] ?? 0),
      breakCount: Number(field?.querySelector('.break-zone .zone-heading b')?.textContent?.match(/\d+/)?.[0] ?? 0),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(n => ({ id: n.getAttribute('data-card-instance-id'), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN), rested: n.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(n => ({ id: n.getAttribute('data-card-instance-id'), rested: n.querySelector('.card-face')?.classList.contains('is-rested') ?? false })) }
  }
  return { own: side('player-one'), enemy: side('player-two') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, summary: e.summary, steps: e.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') && ![...document.querySelectorAll('button')].some(b => b.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
const ordinary = ['deploy', 'wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main', 'cancel-payment', 'cancel-target']
const blocks = ['response', 'item-cost', 'stage-cost', 'trap-cost', 'rested-blocker', 'second-response', 'block-skip', 'block-back', 'block-deselect', 'block-minimize']
const blockNegative = ['no-hand', 'wrong-hand-color', 'non-arena-hand', 'split-hand']
const attacks = ['attack', 'original-target', 'zero-target', 'then-skip', 'reverse-order', 'two-blockers', 'one-blocker', 'no-blocker', 'wrong-zones', 'ordinary-faint', 'damage-faint', 'flip-rescue', 'flip-skip', 'refresh', 'refresh-defeat', 'then-back', 'then-back-target', 'then-deselect', 'then-minimize', 'overselect']
const cases = [...ordinary, ...blocks, ...blockNegative, ...attacks]
const routeCase = c => c.startsWith('block-') ? 'response' : c.startsWith('flip-') ? 'last-hp-flip' : ['original-target', 'zero-target', 'then-skip', 'reverse-order', 'then-back', 'then-back-target', 'then-deselect', 'then-minimize', 'overselect', 'cancel-payment', 'cancel-target'].includes(c) ? 'attack' : c
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const number of ['BS12-093', 'BS12-093@1'].filter(n => !process.env.BS12_BROWSER_NUMBERS || process.env.BS12_BROWSER_NUMBERS.split(',').includes(n)))
    for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }])
      for (const scenario of cases.filter(c => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(c))) {
        const page = await browser.newPage({ viewport })
        const row = { number, scenario, viewport, printedSourceAttested: true, status: 'FAIL', errors: [], networkFailures: [] }
        page.on('pageerror', e => row.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
        page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
        const shot = label => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${label}.png`) })
        const ownField = page.locator('.battle-row[data-animation-player="player-one"]')
        const enemyField = page.locator('.battle-row[data-animation-player="player-two"]')
        const source = ownField.locator('.combat-card-wrap[data-card-instance-id="bs12-093-source"]')
        const fits = async d => { const b = await d.boundingBox(); assert.ok(b && b.x >= 0 && b.y >= 0 && b.x + b.width <= viewport.width + 1 && b.y + b.height <= viewport.height + 1) }
        const finishReplacement = async () => { const b = page.getByRole('button', { name: '不補餅乾', exact: true }); if (await b.count()) { await b.click(); await settle(page) } }
        try {
          for (const c of art) await page.route(c.record.imageUrl, r => r.fulfill({ contentType: 'image/webp', body: readFileSync(c.path) }))
          row.testState=process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='attack'?'card:'+number:process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='one-blocker'?'card-negative:'+number:'bs12-093:'+number+':'+routeCase(scenario)
          await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card='+art.map(entry=>entry.record.cardNumber).join(','))
          await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' }); await settle(page)
          const img = page.locator('img[alt="Rockstar Cookie"]').first(); await img.evaluate(i => i.decode())
          assert.equal(await img.getAttribute('src'), records.find(c => c.cardNumber === number).imageUrl)
          assert.ok(await img.evaluate(i => i.naturalWidth > 300 && i.naturalHeight > 400)); row.originalArtVisible = true
          row.before = await state(page); row.beforeTrace = await trace(page)
          if (ordinary.includes(scenario)) {
            if (scenario === 'deploy') {
              const hand = ownField.locator('.hand-card-wrap').filter({ has: page.locator('img[alt="Rockstar Cookie"]') })
              await hand.locator('button.card-face').click(); await hand.getByRole('button', { name: '登場', exact: true }).click(); await source.waitFor(); await settle(page)
              assert.deepEqual((await state(page)).own.battle.map(c => c.hp), [5, 4]); assert.equal((await state(page)).own.deck, 8)
            } else if (scenario.startsWith('cancel-')) {
              await source.locator('.card-face.is-attackable').click()
              if (scenario === 'cancel-target') for (const i of [0, 1, 2]) await ownField.locator(`.support-card-wrap[data-card-instance-id="bs12-093-payment-${i}"] .card-face`).click()
              await shot('payment'); await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
              assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
            } else { assert.equal(await source.locator('.card-face.is-attackable').count(), 0); assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace) }
          } else if (blockNegative.includes(scenario)) {
            assert.equal(await page.getByRole('alertdialog').getByRole('button', { name: 'Rockstar Cookie Rockstar Cookie', exact: true }).count(), 0)
            assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
          } else if (blocks.includes(scenario)) {
            const open = async () => { await page.getByRole('alertdialog').getByRole('button', { name: 'Rockstar Cookie Rockstar Cookie', exact: true }).click(); const d = page.locator('.blocker-response-modal'); await d.waitFor(); await fits(d); return d }
            let d = await open()
            const cost = () => d.getByRole('group', { name: 'Blocker 手牌代價' }).getByRole('button').first()
            assert.equal(await d.getByRole('button', { name: '使用 Blocker', exact: true }).isEnabled(), false)
            if (scenario !== 'block-skip') await cost().click()
            if (scenario === 'block-deselect') { await cost().click(); assert.equal(await d.getByRole('button', { name: '使用 Blocker', exact: true }).isEnabled(), false); await cost().click() }
            if (scenario === 'block-minimize') { await d.getByRole('button', { name: '縮小', exact: true }).click(); await page.locator('.card-reveal-dock:visible').click(); assert.equal(await cost().getAttribute('aria-pressed'), 'true') }
            if (scenario === 'block-back') { await d.getByRole('button', { name: '返回', exact: true }).click(); d = await open(); assert.equal(await d.getByRole('button', { name: '使用 Blocker', exact: true }).isEnabled(), false); await cost().click() }
            assert.deepEqual(await state(page), row.before); await shot('block-cost')
            await d.getByRole('button', { name: scenario === 'block-skip' ? '不使用' : '使用 Blocker', exact: true }).click(); await settle(page)
            await page.waitForFunction(({skipped,twice})=>document.querySelector(`.battle-row[data-animation-player="player-one"] .combat-card-wrap[data-card-instance-id="bs12-093-${skipped?'ally':'source'}"] .hp-card-stack`)?.getAttribute('aria-label')?.includes(`HP 卡 ${skipped?4:twice?2:3} 張`),{skipped:scenario==='block-skip',twice:scenario==='second-response'})
            const after = await state(page)
            assert.equal(after.own.deck, row.before.own.deck); assert.deepEqual(after.own.support, row.before.own.support)
            assert.equal(after.own.trash, row.before.own.trash + (scenario === 'block-skip' ? 1 : 2)); assert.equal(after.own.hand, row.before.own.hand - (scenario === 'block-skip' ? 0 : 1))
            assert.equal(after.own.battle.find(c => c.id === 'bs12-093-source').hp, scenario === 'block-skip' ? 4 : scenario === 'second-response' ? 2 : 3)
          } else {
            await source.locator('.card-face.is-attackable').click()
            for (const i of [0, 1, 2]) await ownField.locator(`.support-card-wrap[data-card-instance-id="bs12-093-payment-${i}"] .card-face`).click()
            await shot('ordinary-payment'); await enemyField.locator('.combat-card-wrap[data-card-instance-id="bs12-093-opponent"] .card-face[aria-label^="選擇攻擊目標："]').click()
            const panel = page.locator('.effect-panel').filter({ has: page.locator('.optional-cost-attack-cost') }); await panel.waitFor(); await settle(page)
            row.beforeCost = await state(page)
            assert.equal(row.beforeCost.enemy.battle.find(c => c.id === 'bs12-093-opponent')?.hp ?? 0, scenario === 'ordinary-faint' ? 0 : 2)
            assert.deepEqual(row.beforeCost.own.support.map(c => c.rested), [true, true, true]); assert.match(await panel.innerText(), /牌庫底/); assert.doesNotMatch(await panel.innerText(), /洗回牌庫/)
            const unavailable = ['one-blocker', 'no-blocker', 'wrong-zones'].includes(scenario)
            if (unavailable || scenario === 'then-skip') {
              if (unavailable) { assert.equal(await panel.getByRole('button', { name: '支付', exact: true }).isEnabled(), false); assert.match(await panel.innerText(), /沒有足夠/) }
              await shot('then-unavailable'); await panel.getByRole('button', { name: '略過', exact: true }).click(); await settle(page)
              assert.deepEqual(await state(page), row.beforeCost)
            } else {
              await panel.getByRole('button', { name: '支付', exact: true }).click()
              const card = name => panel.locator('.modal-card-options > button').filter({ hasText: name })
              assert.equal(await panel.locator('.modal-card-options > button').count(), scenario === 'two-blockers' ? 2 : 3)
              assert.equal(await panel.getByRole('button', { name: '下一步', exact: true }).isEnabled(), false)
              const order = scenario === 'reverse-order' ? ['Pudding Cookie', 'Peperoncino Cookie'] : ['Peperoncino Cookie', 'Pudding Cookie']
              await card(order[0]).click(); assert.match(await card(order[0]).innerText(), /牌庫底順序 1/); assert.equal(await panel.getByRole('button', { name: '下一步', exact: true }).isEnabled(), false)
              await card(order[1]).click(); assert.match(await card(order[1]).innerText(), /牌庫底順序 2/)
              if (scenario === 'then-deselect') { await card(order[0]).click(); assert.equal(await panel.getByRole('button', { name: '下一步', exact: true }).isEnabled(), false); await card(order[0]).click(); order.reverse() }
              if (scenario === 'overselect') { await card('Black Sapphire Cookie').click(); assert.equal(await card('Black Sapphire Cookie').getAttribute('class'), '') }
              if (scenario === 'then-minimize') { await panel.getByRole('button', { name: '縮小', exact: true }).click(); await page.locator('.effect-panel-dock:visible').filter({ hasText: 'Rockstar Cookie' }).click(); assert.match(await card(order[0]).innerText(), /牌庫底順序 1/) }
              if (scenario === 'then-back') { await panel.getByRole('button', { name: '返回', exact: true }).click(); await panel.getByRole('button', { name: '支付', exact: true }).click(); assert.equal(await panel.getByRole('button', { name: '下一步', exact: true }).isEnabled(), false); for (const n of order) await card(n).click() }
              row.bottomOrder = order; await shot('ordered-cost'); assert.deepEqual(await state(page), row.beforeCost)
              await panel.getByRole('button', { name: '下一步', exact: true }).click()
              if (scenario === 'then-back-target') { await panel.getByRole('button', { name: '上一步', exact: true }).click(); assert.match(await card(order[0]).innerText(), /牌庫底順序 1/); await panel.getByRole('button', { name: '下一步', exact: true }).click() }
              assert.equal(await panel.locator('.modal-card-options > button').count(), scenario === 'ordinary-faint' ? 1 : 2)
              if (scenario !== 'zero-target') await panel.locator('.modal-card-options > button').filter({ hasText: scenario === 'original-target' ? 'Cream Puff Cookie' : ['damage-faint','flip-rescue','flip-skip','refresh','refresh-defeat'].includes(scenario) ? 'Kohlrabi Cookie' : 'GingerBrave' }).click()
              await shot('damage-target'); await panel.getByRole('button', { name: '確認', exact: true }).click(); await settle(page)
              if (['flip-rescue', 'flip-skip', 'refresh', 'refresh-defeat'].includes(scenario)) {
                const flip = page.locator('.flip-response-modal'); await flip.waitFor(); await fits(flip)
                if (scenario === 'flip-skip') await flip.getByRole('button', { name: '不發動', exact: true }).click()
                else { await flip.locator('.flip-hand-carousel').getByRole('button').first().click(); await flip.getByRole('group', { name: 'FLIP 效果目標' }).getByRole('button').filter({ hasText: 'Kohlrabi Cookie' }).click(); await shot('flip'); await flip.getByRole('button', { name: '發動 FLIP', exact: true }).click() }
                if (scenario.startsWith('refresh')) { const modal = page.locator('.decision-modal:visible'); await modal.waitFor(); await shot('refresh'); await modal.getByRole('button').filter({ hasText: 'Langue de Chat Cookie' }).click() }
              }
              await finishReplacement(); await settle(page)
              const after = await state(page); assert.equal(after.own.deck, 14); assert.equal(after.own.trash, row.beforeCost.own.trash - 2); assert.deepEqual(after.own.support, row.beforeCost.own.support)
              if (scenario === 'zero-target') assert.deepEqual(after.enemy, row.beforeCost.enemy)
              else if (['ordinary-faint', 'original-target', 'attack', 'reverse-order', 'two-blockers', 'then-back', 'then-back-target', 'then-deselect', 'then-minimize', 'overselect'].includes(scenario)) assert.deepEqual(after.enemy.battle.map(c => c.hp), scenario === 'ordinary-faint' ? [1] : scenario === 'original-target' ? [1, 2] : [2, 1])
              else if (scenario === 'damage-faint' || scenario === 'flip-skip') { assert.equal(after.enemy.battle.length, 1); assert.equal(after.enemy.breakCount, 1) }
              else if (scenario === 'flip-rescue' || scenario === 'refresh') assert.deepEqual(after.enemy.battle.map(c => c.hp), [2, 1])
              else if (scenario === 'refresh-defeat') { const result = page.locator('.result-modal'); await result.waitFor(); assert.match(await result.innerText(), /玩家勝利/); assert.match(await result.innerText(), /對方休息區的等級達到 10/) }
              const bottomStep = (await trace(page)).flatMap(e => e.steps ?? []).find(s => /攻擊後代價.*牌庫底/.test(s))
              assert.ok(bottomStep?.endsWith(order.join('、')), `Actual command bottom order: ${bottomStep}`)
            }
          }
          row.after = await state(page); row.trace = await trace(page)
          if (['attack', 'zero-target', 'then-skip', 'response'].includes(scenario)) {
            await page.getByRole('button', { name: '對戰紀錄', exact: true }).click(); const log = page.getByRole('complementary', { name: '對戰紀錄側欄' })
            await log.getByRole('button').filter({ hasText: '攻擊' }).first().click(); row.visiblePublicLog = await log.innerText()
            assert.match(row.visiblePublicLog, scenario === 'response' ? /Blocker.*代價/ : scenario === 'then-skip' ? /略過.*未支付/ : /代價.*牌庫底/)
            await shot('public-log'); await page.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
          }
          await shot('result'); assert.deepEqual(row.errors, [])
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
      assert.deepEqual(row.networkFailures, []); row.status = 'PASS'
        } catch (error) { row.error = String(error.stack ?? error); row.after = await state(page).catch(() => null); row.trace = await trace(page).catch(() => []); row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failed').catch(() => {}); results.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'), JSON.stringify(results, null, 2)); throw error }
        finally { await page.close() }
        results.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'), JSON.stringify(results, null, 2)); console.log(`PASS ${number} ${scenario} ${viewport.width}x${viewport.height}`)
      }
  console.log(`BS12-093 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
