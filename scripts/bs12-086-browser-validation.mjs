import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-086-browser')
mkdirSync(out, { recursive: true })
const candidate=JSON.parse(readFileSync(resolve(root,'data/cards/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal=readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards=[...candidate,...formal].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const cases = ['positive', 'red-target', 'rested-target', 'non-blocker', 'no-target', 'wrong-zones', 'wrong-energy', 'rested-energy', 'no-energy', 'spare-energy', 'disabled', 'used', 'main', 'after-battle', 'zero', 'skip', 'cancel-payment', 'cancel-target', 'back-payment', 'payment-deselect', 'target-deselect', 'skip-target', 'source-preview', 'collapse', 'over-select', 'next-turn', 'next-turn-end']
const routes = new Set(['positive', 'rested-target', 'non-blocker', 'no-target', 'wrong-zones', 'wrong-energy', 'rested-energy', 'no-energy', 'spare-energy', 'disabled', 'used', 'main', 'after-battle', 'next-turn'])
const route = scenario => scenario === 'next-turn-end' ? 'next-turn' : routes.has(scenario) ? scenario : 'positive'
const blocked = new Set(['wrong-energy', 'rested-energy', 'no-energy', 'disabled', 'used', 'main', 'after-battle'])
const zero = new Set(['zero', 'no-target', 'wrong-zones', 'skip-target'])
const skipped = new Set(['skip', 'cancel-payment', 'cancel-target'])
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'), hand: field?.querySelectorAll('.hand-card').length ?? 0,
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'), hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN), attack: Number(node.querySelector('.badge-atk')?.textContent ?? NaN), rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'), rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })) }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({ commandKind: entry.commandKind, steps: entry.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') && ![...document.querySelectorAll('button')].some(button => button.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({ viewport })
    const result = { number:'BS12-086', scenario, viewport, printedSourceAttested: !['disabled','used'].includes(scenario), status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, response => response.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      result.testState=process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='positive'?'card:'+'BS12-086':process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='no-target'?'card-negative:'+'BS12-086':'bs12-086:'+route(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state='+result.testState+'&contract-card='+cards.map(card=>card.cardNumber).join(','))
      await page.locator('.game-shell').waitFor()
      await settle(page)
      result.before = await state(page)
      const modal = page.locator('.trap-response-modal:visible')
      if (scenario.startsWith('next-turn')) {
        assert.equal(await modal.count(), 0)
        assert.deepEqual(result.before.bottom.battle.map(cookie => cookie.attack), [3, 1])
        if (scenario === 'next-turn') {
          await page.locator('[data-card-instance-id="bs12-086-blocker"] .card-face.is-attackable').click()
          await page.locator('.bottom-field [data-card-instance-id="bs12-086-payment-0"] .card-face').click()
          await page.locator('.top-field [data-card-instance-id="bs12-086-opponent"] .card-face:not(.hp-card)').click()
          await page.waitForFunction(() => document.querySelector('[data-card-instance-id="bs12-086-opponent"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 1 張'))
          await settle(page)
          result.after = await state(page)
          assert.equal(result.after.top.battle[1].hp, 1)
          assert.equal(result.after.top.battle[0].hp, 2)
          assert.equal(result.after.bottom.battle[0].rested, true)
          assert.equal(result.after.bottom.support[0].rested, true)
          assert.ok((await trace(page)).some(entry => entry.commandKind === 'declare-attack'))
        } else {
          // Actual phase buttons are inspected below; no state injection is used.
          await page.getByRole('button', { name: '結束主要階段', exact: true }).click()
          await page.getByRole('button', { name: '結束回合', exact: true }).click()
          await settle(page)
          result.after = await state(page)
          assert.deepEqual(result.after.bottom.battle.map(cookie => cookie.attack), [1, 1])
          assert.match(await page.getByRole('complementary', { name: '回合階段', exact: true }).innerText(), /TURN 4/)
        }
      } else if (blocked.has(scenario)) {
        assert.equal(await modal.count(), 0)
        if (scenario === 'disabled') await page.getByRole('button', { name: '了解，繼續傷害結算', exact: true }).click()
        if (scenario === 'wrong-energy') {
          // Red energy cannot pay P1, but may still pay Affogato's legitimate Blocker response.
          await page.getByRole('heading', { name: '選擇回應方式', exact: true }).waitFor()
          await page.getByRole('button', { name: '不發動', exact: true }).click()
        }
        if (!['main', 'after-battle'].includes(scenario)) await page.waitForFunction(hp=>document.querySelector('[data-card-instance-id="bs12-086-blocker"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 '+hp+' 張'),['non-blocker','no-target','wrong-zones'].includes(scenario)?2:1)
        await settle(page)
        result.after = await state(page)
        assert.deepEqual(result.after.bottom.battle.map(cookie => cookie.attack), [1, 1])
        assert.equal(result.after.bottom.hand, 1)
        assert.equal(result.after.bottom.trash, ['main', 'after-battle'].includes(scenario) ? 0 : 1)
        assert.deepEqual((await trace(page)).map(entry => entry.commandKind), ['main', 'after-battle'].includes(scenario) ? [] : ['resolve-battle'])
        if (scenario === 'main') {
          await page.getByRole('button', { name: 'True Rock Spirit', exact: true }).click()
          const detail = page.getByRole('dialog', { name: 'True Rock Spirit 卡牌詳情', exact: true })
          await detail.waitFor()
          assert.match(await detail.innerText(), /BS12-086/)
          assert.equal(await detail.getByRole('button').count(), 1)
          await detail.getByRole('button', { name: '關閉', exact: true }).click()
        }
      } else {
        await modal.waitFor()
        await modal.locator('.modal-card-options > button').filter({ hasText: 'True Rock Spirit' }).click()
        await modal.locator('img[alt="True Rock Spirit"]').first().evaluate(image => image.decode())
        assert.equal(await modal.locator('img[alt="True Rock Spirit"]').first().getAttribute('src'), cards.find(card=>card.cardNumber==='BS12-086').imageUrl)
        if (scenario === 'source-preview') {
          assert.match(await modal.innerText(), /BS12-086/)
          assert.match(await modal.innerText(), /Select up to 1 Cookie that has/)
          assert.match(await modal.innerText(), /Until the end of your next turn, that Cookie gains \+2 attack damage/)
          const art = await modal.locator('img[alt="True Rock Spirit"]').first().evaluate(image => ({ width: image.naturalWidth, height: image.naturalHeight }))
          assert.ok(art.width > 100 && art.height > art.width)
        }
        const next = modal.getByRole('button', { name: '下一步', exact: true })
        assert.equal(await next.isEnabled(), false)
        if (scenario === 'skip' || scenario === 'cancel-payment') await modal.getByRole('button', { name: '不發動', exact: true }).click()
        else {
          const payments = modal.locator('.trap-guided-section .trap-discard-options > button')
          await payments.filter({ hasText: 'Currant Cream Cookie' }).first().click()
          assert.equal(await next.isEnabled(), true)
          if (scenario === 'payment-deselect') { await payments.first().click(); assert.equal(await next.isEnabled(), false); await payments.first().click() }
          const paidPreview = { ...result.before, bottom: { ...result.before.bottom, support: result.before.bottom.support.map((support, index) => ({ ...support, rested: support.rested || index === 0 })) } }
          assert.deepEqual(await state(page), paidPreview)
          await shot('payment')
          await next.click()
          assert.match(await modal.innerText(), /己方戰鬥區具有 Blocker 技能/)
          assert.match(await modal.innerText(), /直到自己的下個回合結束/)
          assert.match(await modal.innerText(), /可選 0 張/)
          if (scenario === 'back-payment') { await modal.getByRole('button', { name: '上一步', exact: true }).click(); assert.equal(await next.isEnabled(), true); await next.click() }
          if (scenario === 'collapse') { await modal.getByRole('button', { name: '縮小', exact: true }).click(); await page.getByRole('button', { name: '攻擊宣告回應 已選擇 True Rock Spirit', exact: true }).click() }
          const targets = modal.locator('.trap-effect-target-step .trap-target-options > button')
          assert.equal(await targets.count(), ['no-target', 'wrong-zones'].includes(scenario) ? 0 : scenario === 'non-blocker' ? 1 : 2)
          const bounds = await modal.boundingBox()
          assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1)
          const confirm = modal.getByRole('button', { name: '確認發動', exact: true })
          assert.equal(await confirm.isEnabled(), true)
          const selectedName = ['red-target', 'rested-target', 'non-blocker'].includes(scenario) ? 'Affogato Cookie' : 'Pudding Cookie'
          if (!zero.has(scenario)) await targets.filter({ hasText: selectedName }).click()
          if (scenario === 'target-deselect') { await targets.filter({ hasText: selectedName }).click(); assert.equal(await confirm.isEnabled(), true); await targets.filter({ hasText: selectedName }).click() }
          if (scenario === 'over-select') { await targets.filter({ hasText: 'Affogato Cookie' }).click(); assert.equal(await modal.locator('.trap-target-options > button.is-selected').count(), 1) }
          if (scenario === 'skip-target') { await targets.filter({ hasText: 'Pudding Cookie' }).click(); await modal.getByRole('button', { name: '略過第 1 段效果', exact: true }).click(); assert.equal(await modal.locator('.trap-target-options > button.is-selected').count(), 0) }
          assert.deepEqual(await state(page), paidPreview)
          assert.deepEqual(await trace(page), [])
          await shot('target')
          if (scenario === 'cancel-target') await modal.getByRole('button', { name: '不發動', exact: true }).click()
          else await confirm.click()
        }
        await modal.waitFor({ state: 'hidden' })
        await page.waitForFunction(hp=>document.querySelector('[data-card-instance-id="bs12-086-blocker"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 '+hp+' 張'),['non-blocker','no-target','wrong-zones'].includes(scenario)?2:1)
        await settle(page)
        result.after = await state(page)
        const redSelected = ['red-target', 'rested-target', 'non-blocker', 'over-select'].includes(scenario)
        const activated = !skipped.has(scenario)
        const baseAttack = ['non-blocker', 'no-target', 'wrong-zones'].includes(scenario) ? 2 : 1
        assert.deepEqual(result.before.bottom.battle.map(cookie => cookie.attack), [baseAttack, 1])
        assert.deepEqual(result.after.bottom.battle.map(cookie => cookie.attack), activated && !zero.has(scenario) ? redSelected ? [baseAttack, 3] : [baseAttack + 2, 1] : [baseAttack, 1])
        assert.equal(result.after.bottom.battle[0].hp,['non-blocker','no-target','wrong-zones'].includes(scenario)?2:1)
        assert.equal(result.after.bottom.battle[1].hp, result.before.bottom.battle[1].hp)
        assert.deepEqual(result.after.top, result.before.top)
        assert.equal(result.after.bottom.deck, 12)
        assert.equal(result.after.bottom.trash, result.before.bottom.trash + 1 + (activated ? 1 : 0))
        assert.equal(result.after.bottom.hand, result.before.bottom.hand - (activated ? 1 : 0))
        assert.deepEqual(result.after.bottom.support.map(support => support.rested), result.before.bottom.support.map((support, index) => support.rested || (activated && index === 0)))
        result.trace = await trace(page)
        assert.deepEqual(result.trace.map(entry => entry.commandKind), activated ? ['play-trap', 'resolve-battle'] : ['resolve-battle'])
        if (activated) {
          assert.match(result.trace[0].steps.join(' '), /支付能量/)
          assert.match(result.trace[0].steps.join(' '), zero.has(scenario) ? /未選擇 Blocker/ : /\+2.*下個回合結束/)
        }
      }
      assert.deepEqual(result.errors, [])
      // Transient HP faces can be removed before their original-art request
      // finishes. Keep every cancellation, and require all mounted original
      // images (including payment/target/log faces) to decode successfully.
      result.mountedOriginalArt = await page.evaluate(async urls => {
        const mounted = [...document.images].filter(img => urls.includes(img.src))
        return Promise.all(mounted.map(async img => {
          await img.decode()
          if (!img.naturalWidth) throw new Error(`Original card art failed: ${img.src}`)
          return { url: img.src, alt: img.alt, naturalWidth: img.naturalWidth }
        }))
      }, cards.map(card => card.imageUrl))
      result.cancelledOriginalImageRequests = result.networkFailures.filter(entry =>
        entry.resourceType === 'image' && entry.error === 'net::ERR_ABORTED' && cards.some(card => card.imageUrl === entry.url))
      result.networkFailures = result.networkFailures.filter(entry => !result.cancelledOriginalImageRequests.includes(entry))
      assert.deepEqual(result.networkFailures, [])
      await shot('result')
      result.status = 'PASS'
      console.log(`PASS BS12-086 ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { result.error = String(error.stack ?? error); result.dom = await page.locator('body').innerText().catch(() => ''); throw error }
    finally { results.push(result); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'), JSON.stringify(results, null, 2)); await page.close() }
  }
  console.log(`BS12-086 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
