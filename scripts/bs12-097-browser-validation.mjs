import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-097-browser')
mkdirSync(out, { recursive: true })
const records = ['data/candidates/official-festival-arena-bs12.en.json', ...readdirSync(resolve(root, 'data/cards')).filter(f => f.endsWith('.json')).map(f => `data/cards/${f}`)]
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
  const point = await locator.evaluate(el => {
    const box = el.getBoundingClientRect()
    for (const x of [0.15, 0.3, 0.5, 0.7, 0.85]) for (const y of [0.3, 0.5, 0.7]) {
      const px = box.left + box.width * x, py = box.top + box.height * y
      if (el.contains(document.elementFromPoint(px, py))) return { x: box.width * x, y: box.height * y }
    }
    return null
  })
  assert.ok(point, 'Support card has no exposed clickable area')
  await locator.click({ position: point })
}
const blocked = ['no-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main']
const cases = ['deploy', 'attack', 'red-energy', 'blue-energy', 'green-energy', 'yellow-energy', 'purple-energy', 'black-energy', 'spare-energy', ...blocked,
  'cancel-payment', 'cancel-target', 'payment-deselect', 'other-target', 'target-faints', 'target-flip', 'flip-skip']
const route = c => ['cancel-payment', 'cancel-target', 'payment-deselect', 'other-target'].includes(c) ? 'attack' : c === 'flip-skip' ? 'target-flip' : c
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(c => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(c))) {
    const page = await browser.newPage({ viewport })
    const row = { number: 'BS12-097', scenario, viewport, printedSourceAttested: true, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    const own = page.locator('.battle-row[data-animation-player="player-one"]'), enemy = page.locator('.battle-row[data-animation-player="player-two"]')
    const source = own.locator('.combat-card-wrap[data-card-instance-id="bs12-097-source"]')
    try {
      for (const a of art) await page.route(a.record.imageUrl, r => r.fulfill({ contentType: 'image/webp', body: readFileSync(a.path) }))
      row.testState=process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='attack'?'card:BS12-097':process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='no-energy'?'card-negative:BS12-097':'bs12-097:'+route(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card='+cards.map(c=>c.cardNumber).join(','))
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' }); await settle(page)
      row.before = await state(page); row.beforeTrace=await trace(page)
      if (scenario === 'deploy') {
        const hand = own.locator('.hand-card-wrap').filter({ has: page.locator('img[alt="Subtle Jasmine Cake Hound"]') })
        await hand.locator('button.card-face').click()
        assert.equal(await hand.getByRole('button', { name: '特殊登場', exact: true }).count(), 0)
        await hand.getByRole('button', { name: '詳情', exact: true }).click()
        const detail = page.locator('.card-detail-modal'); await detail.waitFor()
        assert.deepEqual(await detail.locator('.card-detail-rules > .card-rule-section > strong').allTextContents(), ['攻擊'])
        assert.match(await detail.innerText(), /LV 1.*HP 2.*攻擊 1.*費用 1/)
        assert.match(await detail.innerText(), /Rolling in Grass/)
        const detailImage = detail.locator('img[alt="Subtle Jasmine Cake Hound"]'); await detailImage.evaluate(i => i.decode())
        assert.equal(await detailImage.getAttribute('src'), art.find(entry=>entry.record.cardNumber==='BS12-097').record.imageUrl)
        await shot('details'); await detail.locator('.close-modal').click()
        assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
        await hand.locator('button.card-face').click(); await hand.getByRole('button', { name: '登場', exact: true }).click(); await source.waitFor(); await settle(page)
        const after = await state(page); assert.deepEqual(after.own.battle.map(c => c.hp), [2, 2]); assert.equal(after.own.deck, 10); assert.equal(after.own.hand, 0)
        assert.deepEqual(after.own.support, row.before.own.support); assert.deepEqual(after.enemy, row.before.enemy)
      }
      const img = source.locator('img').first(); await img.evaluate(i => i.decode()); assert.equal(await img.getAttribute('src'), art.find(entry=>entry.record.cardNumber==='BS12-097').record.imageUrl); assert.ok(await img.evaluate(i => i.naturalWidth > 300 && i.naturalHeight > 400)); row.originalArtVisible = true
      assert.equal(await source.locator('.skill-action').count(), 0)
      if (blocked.includes(scenario)) { assert.equal(await source.locator('.card-face.is-attackable').count(), 0); assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace); await shot('blocked') }
      else if (scenario !== 'deploy') {
        await source.locator('.card-face.is-attackable').click()
        if (scenario === 'cancel-payment') { await page.getByRole('button', { name: '取消攻擊', exact: true }).click(); assert.deepEqual(await state(page), row.before) }
        else {
          const pay = i => own.locator(`.support-card-wrap[data-card-instance-id="bs12-097-payment-${i}"] .card-face`)
          const targetId = scenario === 'other-target' ? 'bs12-097-opponent-other' : 'bs12-097-opponent'
          const target = enemy.locator(`.combat-card-wrap[data-card-instance-id="${targetId}"] .card-face[aria-label^="選擇攻擊目標："]`)
          await pay(0).click(); await target.waitFor()
          if (scenario === 'payment-deselect') { await clickExposedCard(pay(0)); assert.equal(await target.count(), 0); await clickExposedCard(pay(0)); await target.waitFor() }
          const preview = await state(page); assert.deepEqual(preview.own.support.map(s => s.rested), preview.own.support.map((_, i) => i === 0)); assert.equal(preview.own.battle[0].rested, false); assert.deepEqual(preview.enemy, row.before.enemy); assert.deepEqual(await trace(page), row.beforeTrace); await shot('payment')
          if (scenario === 'cancel-target') { await page.getByRole('button', { name: '取消攻擊', exact: true }).click(); assert.deepEqual(await state(page), row.before) }
          else {
            await target.click()
            if (['target-flip', 'flip-skip'].includes(scenario)) {
              const flip = page.locator('.flip-response-modal'); await flip.waitFor()
              const box = await flip.boundingBox(); assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1)
              await shot('flip')
              if (scenario === 'flip-skip') await flip.getByRole('button', { name: '不發動', exact: true }).click()
              else { await flip.locator('.flip-hand-carousel').getByRole('button').first().click(); await flip.getByRole('group', { name: 'FLIP 效果目標' }).getByRole('button').filter({ hasText: 'Kohlrabi Cookie' }).click(); await flip.getByRole('button', { name: '發動 FLIP', exact: true }).click() }
            }
            await page.waitForFunction(({ targetId, expectedHp }) => { const n = document.querySelector(`.combat-card-wrap[data-card-instance-id="${targetId}"] .hp-card-stack`); return expectedHp === 0 ? !n : n?.getAttribute('aria-label')?.includes(`HP 卡 ${expectedHp} 張`) }, { targetId, expectedHp: ['target-faints', 'flip-skip'].includes(scenario) ? 0 : scenario==='other-target'?3:1 })
            await settle(page); await page.waitForFunction(() => !document.querySelector('.effect-panel:not(.is-complete)'))
            const after = await state(page); assert.equal(after.own.battle[0].hp, 2); assert.equal(after.own.battle[0].rested, true); assert.equal(after.own.deck, 12); assert.equal(after.own.trash, 0)
            assert.deepEqual(after.own.support.map(s => s.rested), after.own.support.map((_, i) => i === 0)); assert.equal(after.enemy.trash, scenario === 'target-flip' ? 2 : 1)
            if (scenario === 'other-target') assert.equal(after.enemy.battle[0].hp, 2)
            else assert.equal(after.enemy.battle.find(c => c.id === 'bs12-097-opponent-other').hp, 4)
            assert.equal(after.enemy.deck, scenario === 'target-flip' ? 11 : 12); assert.equal(after.enemy.hand, scenario === 'flip-skip' ? 1 : 0); assert.equal(after.enemy.breakCount, ['target-faints', 'flip-skip'].includes(scenario) ? 1 : 0)
            const commands = (await trace(page)).map(e => e.commandKind); assert.equal(commands.filter(c => c === 'declare-attack').length, 1); assert.equal(commands.some(c => c.includes('optional-cost') || c.includes('activate-skill')), false)
            if (['attack', 'black-energy', 'target-faints', 'target-flip'].includes(scenario)) {
              await page.getByRole('button', { name: '對戰紀錄', exact: true }).click(); const log = page.getByRole('complementary', { name: '對戰紀錄側欄' })
              await log.getByRole('button').filter({ hasText: 'Subtle Jasmine Cake Hound' }).first().click(); row.visiblePublicLog = await log.innerText(); assert.match(row.visiblePublicLog, ['target-faints','target-flip'].includes(scenario)?/Subtle Jasmine Cake Hound.*Kohlrabi Cookie/:/Subtle Jasmine Cake Hound.*Peach Cookie/); await shot('public-log'); await page.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
            }
          }
        }
      }
      row.after = await state(page); row.trace = await trace(page); await shot('result'); assert.deepEqual(row.errors, [])
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
    results.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'), JSON.stringify(results, null, 2)); console.log(`PASS BS12-097 ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-097 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
