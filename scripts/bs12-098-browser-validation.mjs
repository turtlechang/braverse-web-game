import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url))), require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-098-browser')
mkdirSync(out, { recursive: true })
const records = ['data/cards/official-festival-arena-bs12.en.json', ...readdirSync(resolve(root, 'data/cards')).filter(f => f.endsWith('.json')).map(f => `data/cards/${f}`)]
  .flatMap(path => JSON.parse(readFileSync(resolve(root, path), 'utf8')).cards ?? [])
const art=records.map(record=>({record,path:['bs12-official-art','bs11-official-art'].map(dir=>resolve(root,'test-results/'+dir+'/'+record.cardNumber+'.webp')).find(existsSync)})).filter(entry=>entry.path)
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
const clickExposedCard = async locator => {
  const point = await locator.evaluate(el => { const b = el.getBoundingClientRect(); for (const x of [0.15, 0.3, 0.5, 0.7, 0.85]) for (const y of [0.3, 0.5, 0.7]) if (el.contains(document.elementFromPoint(b.left + b.width * x, b.top + b.height * y))) return { x: b.width * x, y: b.height * y }; return null })
  assert.ok(point, 'Card has no exposed clickable area'); await locator.click({ position: point })
}
const specialBlocked = ['special-wrong-color', 'special-wrong-level', 'special-wrong-zone', 'special-no-cost', 'special-opponent-only', 'special-other-turn', 'special-outside-main']
const attackBlocked = ['attack-wrong-energy', 'attack-few-energy', 'attack-rested-energy', 'attack-source-rested', 'attack-opponent-turn', 'attack-outside-main']
const flipBlocked = ['flip-lv-one', 'flip-no-black', 'flip-black-non-arena', 'flip-split', 'flip-support-only', 'flip-hand-only', 'flip-trash-only', 'flip-break-only', 'flip-opponent-only', 'flip-last-hp-lv-one']
const cases = ['deploy', 'details', 'special', 'special-non-arena', 'special-rested', 'special-full', 'special-two-candidates', 'special-other-cost', 'special-cancel', 'special-deselect', 'special-max', 'special-licorice', 'special-refresh', 'special-refresh-defeat', ...specialBlocked,
  'attack', 'attack-spare-energy', 'attack-faint', 'attack-cancel-payment', 'attack-cancel-target', 'attack-deselect', ...attackBlocked,
  'flip', 'flip-level-three', 'flip-black-bearer', 'flip-non-arena-bearer', 'flip-rested', 'flip-level-three-condition', ...flipBlocked,
  'flip-skip', 'flip-minimize', 'flip-last-hp', 'flip-last-hp-self', 'flip-last-hp-skip', 'flip-refresh', 'flip-refresh-defeat']
const route = scenario => scenario === 'details' ? 'deploy' : ['special-other-cost', 'special-max'].includes(scenario) ? 'special-two-candidates' : ['special-cancel', 'special-deselect'].includes(scenario) ? 'special' : ['attack-cancel-payment', 'attack-cancel-target', 'attack-deselect'].includes(scenario) ? 'attack' : scenario === 'flip-last-hp-skip' ? 'flip-last-hp' : ['flip-skip', 'flip-minimize'].includes(scenario) ? 'flip' : scenario
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(c => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(c))) {
    const page = await browser.newPage({ viewport }), row = { number: 'BS12-098', scenario, viewport, printedSourceAttested: true, status: 'FAIL', errors: [], networkFailures: [] }
    page.setDefaultTimeout(12000)
    page.on('pageerror', e => row.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) }); page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    const own = page.locator('.battle-row[data-animation-player="player-one"]'), enemy = page.locator('.battle-row[data-animation-player="player-two"]')
    const hand = own.locator('.hand-card-wrap').filter({ has: page.locator('img[alt="Caramel Pudding Cake Hound"]') }), source = own.locator('.combat-card-wrap[data-card-instance-id="bs12-098-source"]')
    const fits = async modal => { const b = await modal.boundingBox(); assert.ok(b && b.x >= 0 && b.y >= 0 && b.x + b.width <= viewport.width + 1 && b.y + b.height <= viewport.height + 1) }
    const replacements = async () => { await settle(page); const skip = page.getByRole('button', { name: '不補餅乾', exact: true }); if (await skip.isVisible()) { await skip.click(); await settle(page) } }
    const refresh = async () => { const modal = page.locator('.decision-modal').filter({ hasText: '牌庫 Refresh' }); await modal.waitFor(); await fits(modal); await shot('refresh'); await modal.locator('.decision-card-options > button').filter({ has: page.locator(`img[alt="${scenario.startsWith('flip') ? 'Chocolate Bonbon Cookie' : 'Blueberry Cake Hound'}"]`) }).click(); await settle(page) }
    try {
      for (const a of art) await page.route(a.record.imageUrl, r => r.fulfill({ contentType: 'image/webp', body: readFileSync(a.path) }))
      row.testState=process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='special'?'card:BS12-098':process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='special-wrong-level'?'card-negative:BS12-098':'bs12-098:'+route(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card='+cards.map(c=>c.cardNumber).join(','))
      await page.locator('.game-shell').waitFor(); await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' }); await settle(page)
      row.before = await state(page); row.beforeTrace=await trace(page)
      if (flipBlocked.includes(scenario)) {
        const expectedHp=scenario==='flip-lv-one'?1:scenario==='flip-black-non-arena'||scenario==='flip-split'?3:2
        await page.waitForFunction(({fainted,expectedHp})=>{const hp=document.querySelector('.combat-card-wrap[data-card-instance-id="bs12-098-bearer"] .hp-card-stack');return fainted?!hp:hp?.getAttribute('aria-label')?.includes('HP 卡 '+expectedHp+' 張')},{fainted:scenario==='flip-last-hp-lv-one',expectedHp})
        await settle(page)
        if (scenario === 'flip-last-hp-lv-one') {
          const skip = page.getByRole('button', { name: '不補餅乾', exact: true }); await skip.waitFor(); await skip.click(); await settle(page)
        }
        row.before = await state(page); row.beforeTrace=await trace(page)
        await own.locator('button.discard-zone').click(); const pile = page.locator('.card-pile-modal'); await pile.waitFor()
        const img = pile.locator('img[alt="Caramel Pudding Cake Hound"]'); await img.evaluate(i => i.decode()); assert.equal(await img.getAttribute('src'), art.find(entry=>entry.record.cardNumber==='BS12-098').record.imageUrl); assert.ok(await img.evaluate(i => i.naturalWidth > 300 && i.naturalHeight > 400))
        await pile.locator('.card-pile-grid > button').filter({ has: page.locator('img[alt="Caramel Pudding Cake Hound"]') }).click(); const detail = page.locator('.card-detail-modal'); await detail.waitFor(); await fits(detail)
        const sections = detail.locator('.card-detail-rules > .card-rule-section'); assert.deepEqual(await sections.locator('strong').allTextContents(), ['技能', '攻擊', 'FLIP']); assert.match(await sections.nth(0).innerText(), /Special Play.*LV\.1 Cookie/); assert.match(await sections.nth(2).innerText(), /LV\.2 or higher Cookie that used this card as HP/)
        await shot('blocked-source'); await detail.locator('.close-modal').click(); if (await pile.isVisible()) await pile.locator('.close-modal').click(); row.originalArtVisible = true
      } else {
        const sourceImg = page.locator('img[alt="Caramel Pudding Cake Hound"]').first(); await sourceImg.waitFor(); await sourceImg.evaluate(i => i.decode()); assert.equal(await sourceImg.getAttribute('src'), art.find(entry=>entry.record.cardNumber==='BS12-098').record.imageUrl); assert.ok(await sourceImg.evaluate(i => i.naturalWidth > 300 && i.naturalHeight > 400)); row.originalArtVisible = true
        if (scenario.startsWith('flip')) row.before = await state(page); row.beforeTrace=await trace(page)
      }
      if (scenario === 'details') {
        await hand.locator('button.card-face').click(); await hand.getByRole('button', { name: '詳情', exact: true }).click()
        const detail = page.locator('.card-detail-modal'); await detail.waitFor(); await fits(detail)
        const sections = detail.locator('.card-detail-rules > .card-rule-section'); assert.deepEqual(await sections.locator('strong').allTextContents(), ['技能', '攻擊', 'FLIP']); assert.match(await sections.nth(0).innerText(), /Special Play.*LV\.1 Cookie/); assert.doesNotMatch(await sections.nth(0).innerText(), /gains \+1 HP/); assert.match(await sections.nth(1).innerText(), /Relaxing Nap/); assert.match(await sections.nth(2).innerText(), /LV\.2 or higher Cookie that used this card as HP gains \+1 HP/)
        await shot('details'); await detail.locator('.close-modal').click(); assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), [])
      } else if (scenario === 'deploy') {
        await hand.locator('button.card-face').click(); await hand.getByRole('button', { name: '登場', exact: true }).click(); await source.waitFor(); await settle(page)
        const after = await state(page); assert.deepEqual(after.own.battle.map(c => c.hp), [1, 1]); assert.equal(after.own.deck, 11); assert.equal(after.own.hand, 0); assert.equal(after.own.trash, 0)
      } else if (scenario.startsWith('special')) {
        if (scenario === 'special-licorice') {
          const licorice = own.locator('.combat-card-wrap[data-card-instance-id="bs12-095-cost"]'); await licorice.locator('.skill-action').click()
          const panel = page.locator('.effect-panel'); await panel.waitFor(); const fixed = panel.getByRole('button').filter({ hasText: 'Licorice Cookie' }); assert.equal(await fixed.getAttribute('data-fixed-target'), 'true'); assert.equal(await fixed.isEnabled(), false); await panel.getByRole('button', { name: '確認發動', exact: true }).click(); await settle(page)
        }
        row.beforeCost = await state(page)
        await hand.locator('button.card-face').click()
        if (specialBlocked.includes(scenario)) { assert.equal(await hand.getByRole('button', { name: '特殊登場', exact: true }).count(), 0); assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), []) }
        else {
          await hand.getByRole('button', { name: '特殊登場', exact: true }).click(); const modal = page.locator('.special-play-modal'); await modal.waitFor(); await fits(modal)
          assert.match(await modal.locator('.special-play-source > div > p').innerText(), /Special Play.*LV\.1 Cookie/); assert.doesNotMatch(await modal.locator('.special-play-source > div > p').innerText(), /Discard 1 card|gains \+1 HP/)
          const choices = modal.locator('.special-play-candidate'), confirm = modal.getByRole('button', { name: '確認特殊登場', exact: true }); assert.equal(await confirm.isEnabled(), false)
          const index = scenario === 'special-other-cost' ? 1 : 0; await choices.nth(index).click(); assert.equal(await confirm.isEnabled(), true)
          if (scenario === 'special-deselect') { await choices.nth(index).click(); assert.equal(await confirm.isEnabled(), false); await choices.nth(index).click() }
          if (scenario === 'special-max') { await choices.nth(1).click(); assert.equal(await choices.nth(1).getAttribute('aria-pressed'), 'false'); assert.equal(await choices.nth(0).getAttribute('aria-pressed'), 'true') }
          assert.deepEqual(await state(page), row.beforeCost); await shot('cost')
          if (scenario === 'special-cancel') { await modal.getByRole('button', { name: '取消', exact: true }).click(); assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), []) }
          else {
            await confirm.click(); await source.waitFor(); await settle(page); if (scenario.includes('refresh')) await refresh()
            if (scenario === 'special-refresh-defeat') { await page.getByRole('button', { name: '查看對戰紀錄', exact: true }).waitFor(); assert.match(await page.locator('body').innerText(), /休息區的等級達到 10/) }
            else { await replacements(); const after = await state(page); assert.equal(after.own.battle.at(-1).hp, 1); assert.equal(after.own.hand, 0); assert.equal(after.own.deck, scenario === 'special-refresh' ? 1 : 11); assert.equal(after.own.trash, scenario === 'special-refresh' ? 0 : scenario === 'special-licorice' ? 5 : 2); assert.equal(after.own.breakCount, scenario === 'special-refresh' ? 1 : 0); assert.equal(await page.locator('.flip-response-modal, .faint-response-modal').count(), 0) }
            assert.equal((await trace(page)).filter(e => e.commandKind === 'deploy-cookie').length, 1)
          }
        }
      } else if (scenario.startsWith('attack')) {
        if (attackBlocked.includes(scenario)) { assert.equal(await source.locator('.card-face.is-attackable').count(), 0); assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), []) }
        else {
          await source.locator('.card-face.is-attackable').click()
          if (scenario === 'attack-cancel-payment') { await page.getByRole('button', { name: '取消攻擊', exact: true }).click(); assert.deepEqual(await state(page), row.before) }
          else {
            const pay = i => own.locator(`.support-card-wrap[data-card-instance-id="bs12-095-payment-${i}"] .card-face`), target = enemy.locator('.card-face[aria-label^="選擇攻擊目標："]')
            await pay(0).click(); assert.equal(await target.count(), 0); await pay(1).click(); await target.waitFor()
            if (scenario === 'attack-deselect') { await clickExposedCard(pay(0)); assert.equal(await target.count(), 0); await clickExposedCard(pay(0)); await target.waitFor() }
            assert.deepEqual(await trace(page), []); await shot('payment')
            if (scenario === 'attack-cancel-target') { await page.getByRole('button', { name: '取消攻擊', exact: true }).click(); assert.deepEqual(await state(page), row.before) }
            else { await target.click(); await page.waitForFunction(faint => { const hp = document.querySelector('.combat-card-wrap[data-card-instance-id="bs12-095-opponent"] .hp-card-stack'); return faint ? !hp : hp?.getAttribute('aria-label')?.includes('HP 卡 3 張') }, scenario === 'attack-faint'); await replacements(); const after = await state(page); assert.deepEqual(after.own.support.map(c => c.rested), scenario === 'attack-spare-energy' ? [true, true, false] : [true, true]); assert.equal(after.own.battle[0].rested, true); assert.equal(after.own.battle[0].hp, 1); assert.equal(after.enemy.trash, 2); assert.equal(after.enemy.breakCount, scenario === 'attack-faint' ? 1 : 0); assert.equal(after.own.deck, 12); assert.equal(await page.locator('.effect-panel:not(.is-complete), .optional-cost-attack-modal').count(), 0) }
          }
        }
      } else if (flipBlocked.includes(scenario)) {
        assert.equal(await page.locator('.flip-response-modal, .effect-panel:not(.is-complete)').count(), 0)
        assert.equal(row.before.own.deck, 12); assert.deepEqual(row.before.own.battle.map(c => c.hp), scenario==='flip-last-hp-lv-one'?[4]:scenario==='flip-lv-one'?[1,4]:scenario==='flip-black-non-arena'?[3,1]:scenario==='flip-split'?[3,3]:[2,2])
        assert.equal(row.before.own.hand, scenario === 'flip-hand-only' ? 1 : 0)
        assert.equal(row.before.own.trash, scenario==='flip-last-hp-lv-one'||scenario==='flip-trash-only'?2:1)
        assert.equal(row.before.own.breakCount, scenario === 'flip-last-hp-lv-one' || scenario === 'flip-break-only' ? 1 : 0)
        assert.ok((await trace(page)).some(e => e.commandKind === 'resolve-next-damage')); assert.equal((await trace(page)).filter(e => e.commandKind === 'resolve-flip').length, 0)
      } else {
        const modal = page.locator('.flip-response-modal'); await modal.waitFor(); await fits(modal)
        const flipText = (await modal.innerText()).replace(/\s+/g, ' '); assert.match(flipText, /LV\.2 or higher Cookie that used this card as HP gains \+1 HP/)
        assert.equal(await modal.locator('.flip-card-page > button').count(), 0)
        assert.equal(await modal.getByRole('group', { name: 'FLIP 效果目標' }).count(), 0)
        const go = modal.getByRole('button', { name: '發動 FLIP', exact: true }); assert.equal(await go.isEnabled(), true)
        if (scenario === 'flip-minimize') { await modal.getByRole('button', { name: '縮小', exact: true }).click(); const restore = page.getByRole('button').filter({ hasText: 'FLIP 效果待確認' }); await restore.waitFor(); await shot('minimized'); await restore.click(); await modal.waitFor(); assert.equal(await go.isEnabled(), true) }
        row.beforeActivation = await state(page); await shot('flip')
        const skip = ['flip-skip', 'flip-last-hp-skip'].includes(scenario)
        await modal.getByRole('button', { name: skip ? '不發動' : '發動 FLIP', exact: true }).click(); await settle(page)
        if (scenario.startsWith('flip-refresh')) { const interim = await state(page); assert.deepEqual(interim.own.battle.map(c => c.hp), [3, 2]); assert.equal(interim.own.deck, 0); assert.equal(interim.own.hand, 0); await refresh() }
        if (scenario === 'flip-refresh-defeat') { await page.getByRole('button', { name: '查看對戰紀錄', exact: true }).waitFor(); assert.match(await page.locator('body').innerText(), /休息區的等級達到 10/); assert.deepEqual((await state(page)).own.battle.map(c => c.hp), [3, 2]) }
        else {
          if (scenario === 'flip-last-hp-skip') { const skipReplacement = page.getByRole('button', { name: '不補餅乾', exact: true }); await skipReplacement.waitFor(); await skipReplacement.click(); await settle(page) }
          else await replacements()
          const after = await state(page), last = scenario.startsWith('flip-last-hp'), refreshed = scenario === 'flip-refresh'
          const expectedHp=row.beforeActivation.own.battle.map((c,i)=>c.hp+(!skip&&i===0?1:0));if(skip&&last)expectedHp.shift();assert.deepEqual(after.own.battle.map(c=>c.hp),expectedHp)
          assert.equal(after.own.hand, row.beforeActivation.own.hand); assert.equal(after.own.deck, refreshed ? 2 : row.beforeActivation.own.deck - (skip ? 0 : 1))
          assert.equal(after.own.trash, refreshed ? 0 : row.beforeActivation.own.trash+1); assert.equal(after.own.breakCount, skip && last || refreshed ? row.beforeActivation.own.breakCount + 1 : row.beforeActivation.own.breakCount)
          assert.deepEqual(after.own.support, row.beforeActivation.own.support)
          assert.equal((await trace(page)).filter(e => e.commandKind === 'resolve-flip').length, 1)
          assert.equal(await page.locator('.flip-response-modal, .draw-up-to-selector, .effect-panel:not(.is-complete), .faint-response-modal').count(), 0)
        }
      }
      if (['special', 'special-non-arena', 'attack', 'flip', 'flip-lv-one', 'flip-split', 'flip-last-hp', 'flip-last-hp-self', 'flip-last-hp-lv-one', 'flip-refresh'].includes(scenario)) {
        await page.getByRole('button', { name: '對戰紀錄', exact: true }).click(); const log = page.getByRole('complementary', { name: '對戰紀錄側欄' }); await log.getByRole('list').getByRole('button').first().click(); row.visiblePublicLog = await log.innerText(); assert.match(row.visiblePublicLog, /Caramel Pudding Cake Hound/); await shot('public-log'); await page.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
      }
      row.after = await state(page); row.trace = await trace(page)
      assert.equal(await page.locator('.special-play-modal, .flip-response-modal, .draw-up-to-selector, .decision-modal, .faint-response-modal, .effect-panel:not(.is-complete)').count(), 0)
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
    results.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'), JSON.stringify(results, null, 2)); console.log('PASS BS12-098 ' + scenario + ' ' + viewport.width + 'x' + viewport.height)
  }
  console.log('BS12-098 Browser ' + results.length + '/' + results.length)
} finally { await browser.close() }
