import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-087-browser')
mkdirSync(out, { recursive: true })
const candidate=JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal=readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards=[...candidate,...formal].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const fixtures = ['nine', 'eight', 'ten', 'mixed', 'non-arena', 'opponent-trash', 'other-zones', 'wrong-energy', 'rested-energy', 'no-energy', 'one-energy', 'one-rested', 'spare-energy', 'disabled', 'used', 'main', 'after-battle', 'dj', 'expired']
const cases = [...fixtures, 'other-nine', 'other-eight', 'zero-nine', 'zero-eight', 'skip', 'cancel-payment', 'cancel-target', 'back-payment', 'payment-deselect', 'target-deselect', 'skip-target', 'source-preview', 'collapse', 'over-select', 'reverse-payment']
const route = scenario => fixtures.includes(scenario) ? scenario : scenario === 'source-preview' ? 'main' : scenario.endsWith('-eight') ? 'eight' : 'nine'
const blocked = new Set(['wrong-energy', 'rested-energy', 'no-energy', 'one-energy', 'one-rested', 'disabled', 'used', 'main', 'after-battle'])
const zero = new Set(['zero-nine', 'zero-eight', 'skip-target'])
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
    const result = { number:'BS12-087', scenario, viewport, printedSourceAttested: !['disabled','used'].includes(scenario), status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, response => response.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      result.testState=process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='nine'?'card:'+'BS12-087':process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='eight'?'card-negative:'+'BS12-087':'bs12-087:'+route(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state='+result.testState+'&contract-card='+cards.map(card=>card.cardNumber).join(','))
      await page.locator('.game-shell').waitFor()
      await settle(page)
      const modal = page.locator('.trap-response-modal:visible')
      if (blocked.has(route(scenario)) || scenario === 'source-preview' || scenario === 'expired') {
        assert.equal(await modal.count(), 0)
        if (scenario === 'disabled') await page.getByRole('button', { name: '了解，繼續傷害結算', exact: true }).click()
        if (!['main', 'after-battle', 'source-preview', 'expired'].includes(scenario)) await page.waitForFunction(() => document.querySelector('[data-card-instance-id="bs12-087-defender"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 1 張'))
        await settle(page)
        result.after = await state(page)
        assert.equal(result.after.bottom.battle[0].hp, ['main', 'after-battle', 'source-preview', 'expired'].includes(scenario) ? 4 : 1)
        assert.equal(result.after.bottom.hand, scenario === 'expired' ? 2 : 1)
        assert.equal(result.after.bottom.deck, scenario === 'expired' ? 10 : 12)
        assert.equal(result.after.bottom.trash, scenario === 'expired' ? 10 : 9 + (['main', 'after-battle', 'source-preview'].includes(scenario) ? 0 : 3))
        assert.deepEqual(result.after.top.battle.map(cookie => cookie.attack), [3, 1])
        const preparedTrace = await trace(page)
        if (scenario === 'expired') {
          // This fixture advances public commands before opening; its Trap trace is preparation evidence.
          assert.deepEqual(preparedTrace.map(entry => entry.commandKind), ['play-trap', 'resolve-attack-effect'])
          assert.match(preparedTrace[0].steps.join(' '), /10.*10.*同一張.*-1/)
          result.preparationTrace = preparedTrace
        } else assert.deepEqual(preparedTrace.map(entry => entry.commandKind), ['main', 'after-battle', 'source-preview'].includes(scenario) ? [] : ['resolve-battle'])
        if (scenario === 'source-preview') {
          await page.getByRole('button', { name: 'Coming To An Understanding', exact: true }).click()
          const detail = page.getByRole('dialog', { name: 'Coming To An Understanding 卡牌詳情', exact: true })
          await detail.waitFor()
          assert.match(await detail.innerText(), /BS12-087/)
          assert.match(await detail.innerText(), /10.*Arena.*trash/i)
          assert.match(await detail.innerText(), /additional.*-1/i)
          await detail.locator('img[alt="Coming To An Understanding"]').evaluate(img => img.decode())
          assert.equal(await detail.locator('img[alt="Coming To An Understanding"]').getAttribute('src'), cards.find(card=>card.cardNumber==='BS12-087').imageUrl)
          assert.ok(await detail.locator('img[alt="Coming To An Understanding"]').evaluate(img => img.naturalWidth > 0 && img.naturalHeight > 0))
          await shot('source')
          await detail.getByRole('button', { name: '關閉', exact: true }).click()
          assert.deepEqual(await state(page), result.after)
        }
      } else {
        await modal.waitFor()
        result.before = await state(page)
        await modal.locator('.modal-card-options > button').filter({ hasText: 'Coming To An Understanding' }).click()
        const next = modal.getByRole('button', { name: '下一步', exact: true })
        if (skipped.has(scenario) && scenario !== 'cancel-target') await modal.getByRole('button', { name: '不發動', exact: true }).click()
        else {
          const payments = modal.locator('.trap-guided-section .trap-discard-options > button')
          assert.equal(await payments.count(), 3)
          assert.equal(await next.isEnabled(), false)
          const firstPayment = scenario === 'reverse-payment' ? 1 : 0
          const secondPayment = scenario === 'reverse-payment' ? 0 : 1
          await payments.nth(firstPayment).click()
          assert.equal(await next.isEnabled(), false)
          await payments.nth(secondPayment).click()
          assert.equal(await next.isEnabled(), true)
          if (scenario === 'payment-deselect') { await payments.first().click(); assert.equal(await next.isEnabled(), false); await payments.first().click() }
          const preview = { ...result.before, bottom: { ...result.before.bottom, support: result.before.bottom.support.map((support, index) => ({ ...support, rested: support.rested || index < 2 })) } }
          assert.deepEqual(await state(page), preview)
          assert.deepEqual(await trace(page), [])
          await next.click()
          if (scenario === 'back-payment') { await modal.getByRole('button', { name: '上一步', exact: true }).click(); assert.equal(await next.isEnabled(), true); await next.click() }
          if (scenario === 'collapse') { await modal.getByRole('button', { name: '縮小', exact: true }).click(); await page.getByRole('button', { name: '攻擊宣告回應 已選擇 Coming To An Understanding', exact: true }).click() }
          assert.match(await modal.innerText(), /本回合攻擊傷害 -2/)
          assert.match(await modal.innerText(), /10 張以上【Arena】牌/)
          assert.match(await modal.innerText(), /同一張餅乾再 -1.*不能改選目標/)
          assert.match(await modal.innerText(), /不限卡片類型與顏色/)
          assert.match(await modal.innerText(), /先進棄牌區再判斷/)
          assert.equal(await modal.locator('.trap-effect-target-step').count(), 1)
          const targets = modal.locator('.trap-effect-target-step .trap-target-options > button')
          assert.equal(await targets.count(), 2)
          const confirm = modal.getByRole('button', { name: '確認發動', exact: true })
          assert.equal(await confirm.isEnabled(), true)
          const name = scenario.startsWith('other-') ? 'Affogato Cookie' : 'Strawberry Mochi Cookie'
          if (!zero.has(scenario)) await targets.filter({ hasText: name }).click()
          if (scenario === 'target-deselect') { await targets.filter({ hasText: name }).click(); assert.equal(await confirm.isEnabled(), true); await targets.filter({ hasText: name }).click() }
          if (scenario === 'over-select') { await targets.filter({ hasText: 'Affogato Cookie' }).click(); assert.equal(await modal.locator('.trap-target-options > button.is-selected').count(), 1) }
          if (scenario === 'skip-target') { await targets.filter({ hasText: name }).click(); await modal.getByRole('button', { name: '略過第 1 段效果', exact: true }).click(); assert.equal(await modal.locator('.trap-target-options > button.is-selected').count(), 0) }
          const bounds = await modal.boundingBox()
          assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1)
          assert.deepEqual(await state(page), preview)
          assert.deepEqual(await trace(page), [])
          await shot('target')
          if (scenario === 'cancel-target') await modal.getByRole('button', { name: '不發動', exact: true }).click()
          else await confirm.click()
        }
        await modal.waitFor({ state: 'hidden' })
        const activated = !skipped.has(scenario)
        const selectedOther = scenario.startsWith('other-') || scenario === 'over-select'
        const low = ['eight', 'non-arena', 'opponent-trash', 'other-zones'].includes(route(scenario))
        const damage = !activated || zero.has(scenario) || selectedOther ? 3 : low ? 1 : 0
        await page.waitForFunction(hp => document.querySelector('[data-card-instance-id="bs12-087-defender"] .hp-card-stack')?.getAttribute('aria-label')?.includes(`HP 卡 ${hp} 張`), 4 - damage)
        await settle(page)
        result.after = await state(page)
        assert.equal(result.after.bottom.battle[0].hp, 4 - damage)
        assert.equal(result.after.bottom.battle[1].hp,scenario==='dj'?2:3)
        assert.equal(result.after.bottom.deck, 12)
        assert.equal(result.after.bottom.trash, result.before.bottom.trash + damage + (activated ? 1 : 0))
        assert.equal(result.after.bottom.hand, result.before.bottom.hand - (activated ? 1 : 0))
        assert.deepEqual(result.after.bottom.support.map(support => support.rested), result.before.bottom.support.map((support, index) => support.rested || (activated && index < 2)))
        const expectedAttack = !activated || zero.has(scenario) ? [3, 1] : selectedOther ? [3, 0] : [low ? 1 : 0, 1]
        assert.deepEqual(result.after.top.battle.map(cookie => cookie.attack), expectedAttack)
        assert.deepEqual(result.after.top.battle.map(cookie => cookie.hp), result.before.top.battle.map(cookie => cookie.hp))
        assert.deepEqual(result.after.top.support, result.before.top.support)
        assert.equal(result.after.top.deck, result.before.top.deck)
        assert.equal(result.after.top.trash, result.before.top.trash)
        result.trace = await trace(page)
        assert.deepEqual(result.trace.map(entry => entry.commandKind), activated ? ['play-trap', 'resolve-battle'] : ['resolve-battle'])
        if (activated) {
          const text = result.trace[0].steps.join(' ')
          assert.match(text, /支付能量/)
          assert.match(text, zero.has(scenario) ? /未選擇.*兩段/ : /攻擊傷害 -2.*本回合/)
          if (!zero.has(scenario)) assert.match(text, low ? /條件不成立/ : /同一張.*攻擊傷害再 -1/)
          if (['nine', 'eight', 'zero-nine'].includes(scenario)) {
            await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
            const sidebar = page.getByRole('complementary', { name: '對戰紀錄側欄', exact: true })
            const entry = sidebar.getByRole('button', { name: /Coming To An Understanding.*發動了陷阱卡/ })
            await entry.click()
            const visibleLog = await sidebar.innerText()
            assert.match(visibleLog, /發動了陷阱卡「Coming To An Understanding」/)
            assert.match(visibleLog, zero.has(scenario) ? /未選擇.*兩段/ : low ? /9.*10.*條件不成立/ : /10.*10.*同一張.*-1/)
            result.visibleLog = visibleLog
            await shot('log')
            await sidebar.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
            assert.deepEqual(await state(page), result.after)
          }
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
      console.log(`PASS BS12-087 ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { result.error = String(error.stack ?? error); result.dom = await page.locator('body').innerText().catch(() => ''); throw error }
    finally { results.push(result); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'), JSON.stringify(results, null, 2)); await page.close() }
  }
  console.log(`BS12-087 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
