import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url))), require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium, out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-104-browser')
mkdirSync(out, { recursive: true })
const records = ['data/cards/official-festival-arena-bs12.en.json', ...readdirSync(resolve(root, 'data/cards')).filter(f => f.endsWith('.json')).map(f => `data/cards/${f}`)]
  .flatMap(path => JSON.parse(readFileSync(resolve(root, path), 'utf8')).cards ?? [])
const art=records.map(record=>({record,path:['bs12-official-art','bs11-official-art'].map(dir=>resolve(root,'test-results/'+dir+'/'+record.cardNumber+'.webp')).find(existsSync)})).filter(entry=>entry.path)
for(const entry of art)assert.ok(entry.record.imageUrl&&existsSync(entry.path))
const cards=art.map(entry=>entry.record)
const name='Recipe For Acting Success',sourceArt=records.find(c=>c.cardNumber==='BS12-104').imageUrl
const state = page => page.evaluate(() => {
  const side = id => {
    const field = document.querySelector(`.battle-row[data-animation-player="${id}"]`)
    return { deck: Number(field?.querySelector('.deck-zone .resource-summary > strong')?.textContent), trash: Number(field?.querySelector('.discard-zone.resource-summary > strong')?.textContent),
      hand: Number(field?.querySelector('[aria-label^="手牌 "]')?.getAttribute('aria-label')?.match(/手牌 (\d+)/)?.[1] ?? 0),
      handIds: [...(field?.querySelectorAll('.hand-card-wrap') ?? [])].map(n => n.getAttribute('data-card-instance-id')),
      breakLevel: Number(field?.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1] ?? 0),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(n => ({ id: n.getAttribute('data-card-instance-id'), attack: Number(n.querySelector('.badge-atk')?.textContent), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN), rested: n.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(n => ({ id: n.getAttribute('data-card-instance-id'), rested: n.querySelector('.card-face')?.classList.contains('is-rested') ?? false })) }
  }
  return { own: side('player-one'), enemy: side('player-two') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, summary: e.summary, rawSteps:e.steps, steps: (e.steps ?? []).map(s => typeof s === 'string' ? s : s.text) })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') && ![...document.querySelectorAll('button')].some(b => b.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
const fixtures = ['positive', 'two-targets', 'non-arena', 'pudding', 'strategist', 'rested-target', 'mixed', 'ordinary', 'arena-only', 'hand-only', 'support-only', 'trash-only', 'break-only', 'opponent-only', 'no-target', 'no-energy', 'wrong-energy', 'rested-energy', 'spare-energy', 'opponent-turn', 'outside-main', 'one-card', 'empty-deck', 'no-refresh', 'break-nine', 'stack']
const extras = ['draw-zero', 'buff-zero', 'zero-both', 'other-target', 'deselect-target', 'return-target', 'max-target', 'cancel-payment', 'deselect-payment', 'reopen', 'minimize-payment', 'minimize-draw', 'minimize-target', 'details', 'spare-other', 'expiry', 'draw-select-change']
const blocked = ['no-energy', 'wrong-energy', 'rested-energy', 'opponent-turn', 'outside-main']
const invalid = ['ordinary', 'arena-only', 'hand-only', 'support-only', 'trash-only', 'break-only', 'opponent-only', 'no-target']
const route = s => s === 'spare-other' ? 'spare-energy' : ['other-target', 'max-target'].includes(s) ? 'two-targets' : extras.includes(s) ? 'positive' : s
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }].filter(v => !process.env.BS12_BROWSER_WIDTHS || process.env.BS12_BROWSER_WIDTHS.split(',').includes(String(v.width)))) for (const scenario of [...fixtures, ...extras].filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport }), row = { number: 'BS12-104', scenario, viewport, printedSourceAttested:true,status:'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), error: r.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    const fits = async panel => { const box = await panel.boundingBox(); assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1) }
    const refresh = async () => { const modal = page.locator('.decision-modal:visible'); await modal.waitFor(); assert.match(await modal.innerText(), /牌庫 Refresh/); await shot('refresh'); await modal.getByRole('button').filter({ hasText: 'Peach Cookie' }).click(); await settle(page) }
    try {
      for (const a of art) await page.route(a.record.imageUrl, r => r.fulfill({ contentType: 'image/webp', body: readFileSync(a.path) }))
      row.testState=process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='positive'?'card:BS12-104':process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='no-energy'?'card-negative:BS12-104':'bs12-104:'+route(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card='+cards.map(c=>c.cardNumber).join(','))
      await page.locator('.game-shell').waitFor(); await settle(page); row.before = await state(page);row.beforeTrace=await trace(page); assert.deepEqual(await trace(page),row.beforeTrace)
      if (scenario === 'empty-deck') { await refresh(); row.refreshedBeforePayment = await state(page); assert.equal(row.refreshedBeforePayment.own.deck, 6); assert.equal(row.refreshedBeforePayment.own.support[0].rested, true);assert.equal(row.refreshedBeforePayment.own.hand,2);row.beforeTrace=await trace(page) }
      const original = row.refreshedBeforePayment ?? row.before
      const hand = page.locator('.battle-row[data-animation-player="player-one"] .hand-card-wrap[data-card-instance-id="bs12-104-item"]')
      const img = hand.locator('img').first(); assert.equal(await img.getAttribute('src'), sourceArt); await img.evaluate(i => i.decode()); row.originalArtVisible = true
      await hand.locator('button.card-face').click()
      if (scenario === 'details') {
        await hand.getByRole('button', { name: '詳情', exact: true }).click(); const detail = page.getByRole('dialog', { name: `${name} 卡牌詳情`, exact: true }); await detail.waitFor()
        assert.match(await detail.innerText(), /Draw up to 1.*Then.*Special Play.*battle area.*1.*attack damage/s); await shot('details'); await detail.getByRole('button', { name: '關閉', exact: true }).click()
        assert.deepEqual(await state(page), original); await hand.locator('button.card-face').click()
      }
      if (blocked.includes(scenario)) { assert.equal(await hand.getByRole('button', { name: '使用', exact: true }).count(), 0); assert.deepEqual(await state(page), original); assert.deepEqual(await trace(page),row.beforeTrace) }
      else {
        const paymentIndex = scenario === 'spare-other' || scenario === 'empty-deck' ? 1 : 0
        const payItem = async (id, payment) => {
          const card = page.locator(`.hand-card-wrap[data-card-instance-id="${id}"]`)
          if (id !== 'bs12-104-item') await card.locator('button.card-face').click()
          await card.getByRole('button', { name: '使用', exact: true }).click(); const panel = page.locator('.effect-panel:not(.is-complete):visible'); await panel.waitFor(); await fits(panel)
          const payments = panel.locator('.effect-candidates-payment .effect-candidate-entry > button:not([disabled])'), confirm = panel.getByRole('button', { name: '確認發動', exact: true })
          assert.equal(await confirm.isEnabled(), false); assert.equal(await panel.locator('.effect-candidates-target button').count(), 0)
          await payments.nth(payment).click(); assert.equal(await confirm.isEnabled(), true)
          if (scenario === 'deselect-payment') { await payments.nth(payment).click(); assert.equal(await confirm.isEnabled(), false); await payments.nth(payment).click() }
          if (scenario === 'reopen') { await panel.getByRole('button', { name: '取消技能', exact: true }).click(); assert.deepEqual(await state(page), original); assert.deepEqual(await trace(page),row.beforeTrace); await card.locator('button.card-face').click(); await card.getByRole('button', { name: '使用', exact: true }).click(); assert.equal(await confirm.isEnabled(), false); await payments.nth(payment).click() }
          if (scenario === 'minimize-payment') { await panel.getByRole('button', { name: '縮小', exact: true }).click(); await page.locator('.effect-panel-dock').click(); assert.match(await panel.innerText(), /已選 1／1/) }
          await shot('payment')
          if (scenario === 'cancel-payment') { await panel.getByRole('button', { name: '取消技能', exact: true }).click(); assert.deepEqual(await state(page), original); assert.deepEqual(await trace(page),row.beforeTrace); return false }
          await confirm.click(); await settle(page); return true
        }
        if (await payItem('bs12-104-item', scenario === 'empty-deck' ? 0 : paymentIndex)) {
          row.paid = await state(page); assert.equal(row.paid.own.hand, original.own.hand - 1); assert.equal(row.paid.own.trash, original.own.trash + 1)
          assert.equal(row.paid.own.support[paymentIndex].rested, true); assert.equal(row.paid.own.deck, original.own.deck); assert.deepEqual(row.paid.enemy, original.enemy); assert.deepEqual(row.paid.own.battle, original.own.battle)
          const drawCount = ['draw-zero', 'zero-both', 'stack'].includes(scenario) ? 0 : 1
          const doDraw = async count => {
            const modal = page.locator('.draw-up-to-modal:visible'); await modal.waitFor(); await fits(modal); assert.match(await modal.innerText(), /Recipe For Acting Success.*最多.*1.*張/s)
            assert.equal(await modal.locator('.draw-up-to-option').count(), 2); if (count) await modal.locator('.draw-up-to-option').filter({ hasText: '抽 1 張' }).click()
            if (scenario === 'draw-select-change') { await modal.getByRole('button', { name: '不抽', exact: true }).click(); await modal.locator('.draw-up-to-option').filter({ hasText: '抽 1 張' }).click() }
            if (scenario === 'minimize-draw') { await modal.getByRole('button', { name: '縮小', exact: true }).click(); await page.locator('.decision-reveal-dock').click(); assert.match(await modal.locator('.is-selected').innerText(), /抽 1 張/) }
            await shot('draw'); await modal.getByRole('button', { name: count ? '抽取 1 張牌' : '略過抽牌', exact: true }).click(); await settle(page)
          }
          await doDraw(drawCount)
          if (['one-card', 'break-nine'].includes(scenario)) await refresh()
          if (['no-refresh', 'break-nine'].includes(scenario)) { await page.getByRole('heading', { name: 'AI 對手勝利', exact: true }).waitFor(); row.finished = true; assert.match(await page.locator('body').innerText(), scenario === 'no-refresh' ? /我方無法完成牌庫 Refresh/ : /我方休息區的等級達到 10/); assert.equal((await state(page)).own.battle[0].attack, original.own.battle[0].attack) }
          else {
            const zero = invalid.includes(scenario) || ['buff-zero', 'zero-both', 'return-target'].includes(scenario)
            const chosen = scenario === 'other-target' ? 'bs12-104-other' : 'bs12-104-target'
            const selectBonus = async () => {
              const panel = page.locator('.effect-panel:not(.is-complete):visible'); await panel.waitFor(); await fits(panel); assert.match(await panel.innerText(), /Recipe For Acting Success/)
              const targets = panel.getByRole('button').filter({ hasText: '玩家・戰鬥區第' }); assert.equal(await targets.count(), invalid.includes(scenario) ? 0 : route(scenario) === 'two-targets' ? 2 : 1)
              if (!zero || scenario === 'return-target') {
                await targets.nth(chosen === 'bs12-104-other' ? 1 : 0).click()
                if (scenario === 'deselect-target') { await targets.first().click(); assert.match(await panel.innerText(), /已選 0／1/); await targets.first().click() }
                if (scenario === 'max-target') { await targets.nth(1).click(); assert.equal(await targets.first().getAttribute('aria-pressed'), 'true'); assert.equal(await targets.nth(1).getAttribute('aria-pressed'), 'false') }
                if (scenario === 'return-target') { assert.equal(await panel.getByRole('button', { name: '上一步', exact: true }).count(), 0); assert.equal(await panel.getByRole('button', { name: '取消技能', exact: true }).count(), 0); await targets.first().click(); assert.match(await panel.innerText(), /已選 0／1/) }
                if (scenario === 'minimize-target') { await panel.getByRole('button', { name: '縮小', exact: true }).click(); await page.locator('.effect-panel-dock').click(); assert.match(await panel.innerText(), /已選 1／1/) }
              }
              await shot('target'); await panel.getByRole('button', { name: '確認發動', exact: true }).click(); await settle(page)
            }
            await selectBonus(); row.settled = await state(page)
            assert.equal(row.settled.own.hand, original.own.hand - 1 + drawCount)
            assert.equal(row.settled.own.deck, scenario === 'one-card' ? 7 : original.own.deck - drawCount)
            assert.equal(row.settled.own.trash, scenario === 'one-card' ? 0 : original.own.trash + 1)
            assert.deepEqual(row.settled.enemy, original.enemy)
            assert.deepEqual(row.settled.own.battle, original.own.battle.map(c => ({ ...c, attack: c.attack + (!zero && c.id === chosen ? 1 : 0) })))
            const effectTrace = await trace(page); assert.deepEqual(effectTrace.map(e => e.commandKind), [...row.beforeTrace.map(e=>e.commandKind),'begin-play-item', 'resolve-ability-effect', 'resolve-draw-up-to', ...(scenario==='one-card'?['refresh-deck']:[]), 'resolve-ability-effect'])
            const publicTrace = JSON.stringify(effectTrace); assert.ok(!publicTrace.includes('bs12-104-own-deck-0')); assert.ok(!publicTrace.includes('Sweet Jams Guitar')); assert.match(publicTrace, drawCount ? /抽了 1 張牌/ : /不抽牌|抽了 0 張牌/)
            if (['positive', 'non-arena', 'arena-only', 'draw-zero', 'buff-zero', 'zero-both', 'one-card'].includes(scenario)) {
              await page.getByRole('button', { name: '對戰紀錄', exact: true }).click(); const log = page.getByRole('complementary', { name: '對戰紀錄側欄', exact: true }); await log.locator('.battle-log-entry').filter({ hasText: '使用了道具卡' }).first().click()
              row.visiblePublicLog = await log.innerText(); assert.ok(!row.visiblePublicLog.includes('Sweet Jams Guitar')); await shot('public-log'); await page.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
            }
            if (scenario === 'stack') {
              await payItem('bs12-104-item-2', 0); await doDraw(0); await selectBonus(); row.stacked = await state(page); assert.equal(row.stacked.own.battle[0].attack, 4); assert.equal(row.stacked.own.hand, 0); assert.equal(row.stacked.own.trash, 2)
            }
            if (['positive', 'non-arena', 'strategist', 'other-target', 'draw-zero', 'stack'].includes(scenario)) {
              const own = page.locator('.battle-row[data-animation-player="player-one"]'), attacker = own.locator(`.combat-card-wrap[data-card-instance-id="${chosen}"]`)
              await attacker.locator('.card-face.is-attackable').click()
              const indices = scenario === 'stack' ? [2, 3] : [1, 2]
              for (const index of indices) await own.locator(`.support-card-wrap[data-card-instance-id="bs12-104-payment-${index}"] .card-face`).click()
              const opponent = page.locator('.battle-row[data-animation-player="player-two"] .combat-card-wrap[data-card-instance-id="bs12-104-opponent"] .card-face[aria-label^="選擇攻擊目標："]')
              await opponent.click()
              await page.waitForFunction(stack => {
                const hp = document.querySelector('.combat-card-wrap[data-card-instance-id="bs12-104-opponent"] .hp-card-stack')
                return stack ? !hp : hp?.getAttribute('aria-label')?.includes('HP 卡 1 張')
              }, scenario === 'stack')
              await settle(page); row.attacked = await state(page)
              if (scenario === 'stack') { assert.equal(row.attacked.enemy.battle.length, 0); assert.equal(row.attacked.enemy.trash, 4); assert.equal(row.attacked.enemy.breakLevel, 3) }
              else { assert.equal(row.attacked.enemy.battle[0].hp, 1); assert.equal(row.attacked.enemy.trash, 3) }
              assert.equal(row.attacked.own.battle.find(c => c.id === chosen).rested, true); assert.ok(indices.every(i => row.attacked.own.support[i].rested)); await shot('attack')
            }
            if (scenario === 'expiry') { await page.getByRole('button', { name: '結束主要階段', exact: true }).click(); await page.getByRole('button', { name: '結束回合', exact: true }).click(); await settle(page); row.expired = await state(page); assert.equal(row.expired.own.battle[0].attack, 2); await shot('expired') }
          }
        }
      }
      row.after = await state(page); row.trace = await trace(page); await shot('result'); assert.deepEqual(row.errors,[])
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
      console.log(`PASS BS12-104 ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { row.error = error.stack ?? String(error); row.dom = (await page.locator('body').innerText()).slice(0, 16000); await shot('FAIL'); results.push(row); writeFileSync(resolve(out,process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'), JSON.stringify(results, null, 2)); throw error }
    finally { await page.close() }
    results.push(row); writeFileSync(resolve(out,process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'), JSON.stringify(results, null, 2))
  }
} finally { await browser.close() }
console.log(`BS12-104 Browser ${results.filter(r => r.status === 'PASS').length}/${results.length}`)
