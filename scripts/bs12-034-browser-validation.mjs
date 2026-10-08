import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-034-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-festival-arena-bs12.en.json'), 'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,`test-results/bs12-official-art/${card.cardNumber}.webp`)))
const cases = ['hand-self', 'hand-ally', 'hand-zero', 'battle-source', 'battle-ally', 'battle-zero', 'rested-ally', 'equipped-ally', 'lv2-ally', 'non-arena-ally', 'four-arena', 'three-arena', 'non-arena-break', 'high-level', 'opponent-break', 'wrong-energy', 'one-energy', 'rested-energy', 'rested-source', 'skip-then', 'cancel-payment', 'deselect-cost', 'back-cost', 'change-cost', 'short-deck', 'break-nine']
const state = page => page.evaluate(() => {
  const side = name => {
    const f = document.querySelector(`.${name}-field`)
    return { hand: f.querySelectorAll('.hand-card').length, deck: Number(f.querySelector('.deck-zone .resource-summary > strong')?.textContent), trash: Number(f.querySelector('.discard-zone.resource-summary > strong')?.textContent),
      breakLevel: Number(f.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1]),
      support: [...f.querySelectorAll('.support-card-wrap')].map(n => n.querySelector('.card-face').classList.contains('is-rested')),
      battle: [...f.querySelectorAll('.combat-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]) })) }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, steps: e.steps })))
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const rows = []
try {
  for (const number of ['BS12-034', 'BS12-034@1']) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const row = { number, scenario, viewport, scope: 'candidate-printed-034-ordinary-passive-then-combined-cost', status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = suffix => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${suffix}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl,r=>r.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,`test-results/bs12-official-art/${card.cardNumber}.webp`))}))
      const fixture = ['rested-ally', 'equipped-ally', 'lv2-ally', 'non-arena-ally', 'four-arena', 'three-arena', 'non-arena-break', 'high-level', 'opponent-break', 'wrong-energy', 'one-energy', 'rested-energy', 'rested-source', 'short-deck', 'break-nine'].includes(scenario) ? scenario : 'positive'
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'positive' ? `card:${number}` : process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'one-energy' ? `card-negative:${number}` : `${number.toLowerCase()}:${fixture}`
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${row.testState}&contract-card=BS12-034,BS6-008,BS12-004,BS12-033,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-028,BS12-029,BS12-030,BS12-031,BS12-046,bs12-032-opponent-hp-5,bs12-032-opponent-other-hp-2`)
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      const source = page.locator('.bottom-field .combat-card-wrap').getByRole('button', { name: 'Madeleine Cookie', exact: true })
      await source.locator('img').evaluate(img => img.decode())
      assert.equal(await source.locator('img').getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
      row.before = await state(page)
      await source.click()
      const blocked = ['wrong-energy', 'one-energy', 'rested-energy', 'rested-source'].includes(scenario)
      if (blocked) {
        assert.equal(await page.getByRole('button', { name: '取消攻擊', exact: true }).count(), 0)
        assert.deepEqual(await state(page), row.before)
        assert.deepEqual(await trace(page), [])
      } else {
        const supports = page.locator('.bottom-field .support-card-wrap button.card-face')
        await supports.nth(0).click({ position: { x: 10, y: 25 } })
        assert.equal(await page.getByRole('button', { name: '選擇攻擊目標：Sugar Swan Cookie', exact: true }).count(), 0)
        if (scenario === 'cancel-payment') {
          await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
          assert.deepEqual(await state(page), row.before)
          assert.deepEqual(await trace(page), [])
        } else {
          await supports.nth(1).click({ position: { x: 10, y: 25 } })
          await page.getByRole('button', { name: '選擇攻擊目標：Sugar Swan Cookie', exact: true }).click()
          const modal = page.locator('.optional-cost-attack-inline:visible, .optional-cost-attack-modal:visible')
          await modal.waitFor()
          row.ordinary = await state(page)
          const ordinary = scenario === 'four-arena' ? 3 : 2
          assert.deepEqual(row.ordinary.top.battle, row.before.top.battle.map((cookie, i) => ({ ...cookie, hp: cookie.hp - (i === 0 ? ordinary : 0) })))
          assert.deepEqual(row.ordinary.bottom.support, [true, true])
          if (scenario === 'skip-then') {
            await modal.getByRole('button', { name: '略過', exact: true }).click()
            assert.deepEqual(await state(page), row.ordinary)
          } else {
            await modal.getByRole('button', { name: '支付', exact: true }).click()
            const costs = modal.locator('.optional-cookie-break-cost .modal-card-options > button')
            const next = modal.getByRole('button', { name: '下一步', exact: true })
            assert.equal(await next.isEnabled(), false)
            const paidSource = scenario === 'battle-source'
            const paidAlly = ['battle-ally', 'battle-zero', 'rested-ally', 'equipped-ally'].includes(scenario)
            const costName = paidSource ? '戰鬥區・Madeleine Cookie' : paidAlly ? scenario === 'equipped-ally' ? '戰鬥區・Shining Glitter Cookie' : '戰鬥區・GingerBrave' : '手牌・Peach Cookie'
            const selected = costs.filter({ hasText: costName })
            assert.equal(await costs.filter({ hasText: 'Candy Diver Cookie' }).count(), 0)
            await selected.click()
            if (scenario === 'deselect-cost') { await selected.click(); assert.equal(await next.isEnabled(), false); await selected.click() }
            assert.deepEqual(await state(page), row.ordinary)
            await shot('cost-selection')
            await next.click()
            if (['back-cost', 'change-cost'].includes(scenario)) {
              await modal.getByRole('button', { name: '上一步', exact: true }).click()
              if (scenario === 'change-cost') { await selected.click(); await costs.filter({ hasText: '戰鬥區・Madeleine Cookie' }).click(); await costs.filter({ hasText: '戰鬥區・Madeleine Cookie' }).click(); await selected.click() }
              assert.equal(await selected.getAttribute('aria-pressed'), 'true')
              await next.click()
            }
            const zeroHp = ['hand-zero', 'battle-zero'].includes(scenario)
            const recipient = paidSource || ['hand-ally', 'non-arena-ally'].includes(scenario) ? 'bs12-034-ally' : 'bs12-034-source'
            const targets = modal.locator('.optional-cost-col .modal-card-options > button')
            assert.equal(await targets.filter({ hasText: costName.split('・')[1] }).count(), 0)
            assert.equal(await targets.count(), paidSource || paidAlly || scenario === 'lv2-ally' ? 1 : 2)
            if (!zeroHp) await targets.filter({ hasText: recipient === 'bs12-034-source' ? 'Madeleine Cookie' : scenario === 'non-arena-ally' ? 'Snow Sugar Cookie' : 'GingerBrave' }).click()
            assert.deepEqual(await state(page), row.ordinary)
            await shot('target-selection')
            await modal.getByRole('button', { name: '確認', exact: true }).click()
            if (scenario === 'break-nine') {
              await page.waitForFunction(() => /勝利|敗北/.test(document.body.innerText))
              row.after = await state(page)
              assert.equal(row.after.bottom.breakLevel, 10)
              assert.equal(row.after.bottom.deck, 12)
              assert.deepEqual(row.after.bottom.battle, row.ordinary.bottom.battle)
            } else {
              if (scenario === 'short-deck') await page.getByRole('alertdialog').getByRole('button', { name: 'Muscle Cookie Muscle Cookie', exact: true }).click()
              for (let i = 0; i < 2; i++) if (await page.getByRole('button', { name: '不補餅乾', exact: true }).count()) await page.getByRole('button', { name: '不補餅乾', exact: true }).click()
              await page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]'))
              row.after = await state(page)
              const costId = paidSource ? 'bs12-034-source' : paidAlly ? 'bs12-034-ally' : 'bs12-034-hand'
              assert.deepEqual(row.after.bottom.battle, row.ordinary.bottom.battle.filter(cookie => cookie.id !== costId).map(cookie => ({ ...cookie, hp: cookie.hp + (!zeroHp && cookie.id === recipient ? 2 : 0) })))
              assert.equal(row.after.bottom.deck, scenario === 'short-deck' ? 4 : 12 - (zeroHp ? 0 : 2))
              assert.equal(row.after.bottom.hand, paidSource || paidAlly ? 2 : 1)
              assert.equal(row.after.bottom.trash, scenario === 'short-deck' ? 0 : paidSource || paidAlly ? scenario === 'equipped-ally' ? 3 : 2 : 0)
              assert.equal(row.after.bottom.breakLevel, row.ordinary.bottom.breakLevel + 1 + (scenario === 'short-deck' ? 3 : 0))
              assert.deepEqual(row.after.top, row.ordinary.top)
            }
            row.trace = await trace(page)
            const costTrace = row.trace.filter(entry => entry.commandKind === 'resolve-optional-cost-attack')
            assert.equal(costTrace.length, 1)
            assert.match(costTrace[0].steps.join(' '), /代價.*休息區/)
          }
        }
      }
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
      row.after ??= await state(page)
      row.trace ??= await trace(page)
      await shot('result')
      row.status = 'PASS'
      console.log(`PASS ${number} ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { row.error = String(error.stack ?? error); row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { rows.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)); await page.close() }
  }
  console.log(`BS12-034 printed Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
