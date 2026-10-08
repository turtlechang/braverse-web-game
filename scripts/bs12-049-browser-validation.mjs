import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-049-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/cards/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const fixtures = ['positive', 'rested-cost', 'non-arena-only', 'opponent-only', 'battle-only', 'no-energy', 'wrong-energy', 'rested-energy', 'disabled', 'used', 'main', 'after-battle', 'last-deck', 'refresh-lv10']
const extras = ['skip-initial', 'cancel-energy', 'cancel-target', 'back-energy', 'payment-deselect', 'target-deselect', 'target-max', 'source-preview', 'skip-then', 'return-cost', 'deselect-cost', 'cost-max', 'draw-zero', 'draw-switch', 'draw-skip', 'zero-first', 'other-first', 'return-item', 'return-stage', 'return-blue', 'return-initial-payment', 'return-non-arena-attempt']
const cases = [...fixtures, ...extras]
const route = s => s === 'source-preview' ? 'main' : fixtures.includes(s) ? s : 'positive'
const blocked = ['no-energy', 'wrong-energy', 'rested-energy', 'disabled', 'used', 'main', 'after-battle']
const readState = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return { deck: Number(field.querySelector('.deck-zone .resource-summary>strong')?.textContent), trash: Number(field.querySelector('.discard-zone.resource-summary>strong')?.textContent), hand: field.querySelectorAll('.hand-card').length,
      breakLevel: Number(field.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1]),
      battle: [...field.querySelectorAll('.combat-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]), attack: Number(n.querySelector('.badge-atk')?.textContent), rested: n.querySelector('.card-face').classList.contains('is-rested') })),
      support: [...field.querySelectorAll('.support-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), rested: n.querySelector('.card-face').classList.contains('is-rested') })) }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, steps: e.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]'), null, { timeout: 20000 })
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const rows = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const row = { number: 'BS12-049', scenario, viewport, printedSourceAttested: !['disabled','used'].includes(scenario), scope: ['disabled','used'].includes(scenario) ? 'isolated-response-flags-with-printed-cards' : 'candidate-printed-G-reduction-Arena-support-return-draw', status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route=>route.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp'))}))
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && route(scenario) === 'positive' ? 'card:'+'BS12-049' : process.env.BS12_BROWSER_ROUTE === 'generic' && route(scenario) === 'non-arena-only' ? 'card-negative:'+'BS12-049' : 'bs12-049:'+route(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-001,BS12-003,BS12-005,BS12-006,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-019,BS12-022,BS12-028,BS12-029,BS12-030,BS12-031,BS12-038,BS12-039,BS12-041,BS12-044,BS12-046,BS12-048,BS12-049,BS12-050,BS12-051,BS12-052,BS12-053,BS12-055,BS12-070,BS6-008,BS7-055,BS7-061,ST3-001,ST4-001,ST4-002,ST4-003,ST4-004,ST4-005')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      row.initialTrace = await trace(page)
      if (!['main','after-battle'].includes(route(scenario))) {
        assert.equal(row.initialTrace[0].commandKind,'declare-attack')
        assert.match(row.initialTrace[0].steps.join(' '),/Langue de Chat Cookie.*Shining Glitter Cookie/)
        assert.deepEqual((await readState(page)).top.support.slice(0,3).map(s=>s.rested),[true,true,true])
      }
      const modal = page.locator('.trap-response-modal:visible')
      if (blocked.includes(route(scenario))) {
        if (scenario === 'disabled') {
          const notice = page.getByRole('button', { name: '了解，繼續傷害結算', exact: true })
          await notice.waitFor()
          await notice.click()
          await modal.waitFor({ state: 'hidden' })
        }
        assert.equal(await modal.count(), 0)
        if (!['main', 'after-battle'].includes(route(scenario))) await page.waitForFunction(() => document.querySelector('[data-card-instance-id="bs12-009-defender"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 1 張'))
        await settle(page)
        const after = await readState(page)
        assert.equal(after.bottom.hand, 1)
        assert.equal(after.bottom.deck, 12)
        assert.equal(after.bottom.battle[0].hp, ['main', 'after-battle'].includes(route(scenario)) ? 5 : 1)
        row.blockedTrace = await trace(page)
        assert.deepEqual(row.blockedTrace.map(e=>e.commandKind),['main','after-battle'].includes(route(scenario))?[]:['declare-attack',...Array(4).fill('resolve-next-damage')])
        if (scenario === 'source-preview') {
          await page.getByRole('button', { name: 'Immersed Audience', exact: true }).click()
          const detail = page.getByRole('dialog', { name: 'Immersed Audience 卡牌詳情', exact: true })
          await detail.waitFor()
          assert.match(await detail.innerText(), /return 1.*Arena.*support area/s)
          const image = detail.locator('img[alt="Immersed Audience"]')
          assert.equal(await image.getAttribute('src'), cards.find(c => c.cardNumber === 'BS12-049').imageUrl)
          await image.evaluate(i => i.decode())
          await shot('detail')
          await detail.getByRole('button', { name: '關閉', exact: true }).click()
          assert.deepEqual(await readState(page), after)
        }
      } else {
        await modal.waitFor()
        row.before = await readState(page)
        if (scenario === 'opponent-only') assert.ok(row.before.top.support.some(c => c.id === 'bs12-049-opponent-arena'))
        const trap = modal.locator('.modal-card-options>button').filter({ hasText: 'Immersed Audience' })
        await trap.locator('img').evaluate(i => i.decode())
        assert.equal(await trap.locator('img').getAttribute('src'), cards.find(c => c.cardNumber === 'BS12-049').imageUrl)
        await trap.click()
        const next = modal.getByRole('button', { name: '下一步', exact: true })
        assert.equal(await next.isEnabled(), false)
        const energy = modal.locator('.trap-guided-section .trap-discard-options>button')
        assert.equal(await energy.count(), 1)
        const cancelInitial = ['skip-initial', 'cancel-energy', 'cancel-target'].includes(scenario)
        if (!['skip-initial', 'cancel-energy'].includes(scenario)) {
          await energy.click()
          if (scenario === 'payment-deselect') { await energy.click(); assert.equal(await next.isEnabled(), false); await energy.click() }
          await next.click()
          if (scenario === 'back-energy') { await modal.getByRole('button', { name: '上一步', exact: true }).click(); assert.equal(await next.isEnabled(), true); await next.click() }
          const targets = modal.locator('.trap-effect-target-step .trap-target-options>button')
          assert.equal(await targets.count(), 2)
          const target = targets.filter({ hasText: scenario === 'other-first' ? 'Peach Cookie' : 'Langue de Chat Cookie' })
          if (scenario !== 'zero-first') await target.click()
          if (scenario === 'target-deselect') { await target.click(); await target.click() }
          if (scenario === 'target-max') {
            await targets.filter({ hasText: 'Peach Cookie' }).click()
            assert.equal(await modal.locator('.trap-target-options>button.is-selected').count(), 1)
            await target.click()
          }
          const paymentPreview = structuredClone(row.before)
          paymentPreview.bottom.support[0].rested = true
          assert.deepEqual(await readState(page), paymentPreview)
          assert.deepEqual(await trace(page), row.initialTrace)
          if (scenario === 'cancel-target') await modal.getByRole('button', { name: '不發動', exact: true }).click()
          else await modal.getByRole('button', { name: '確認發動', exact: true }).click()
        } else await modal.getByRole('button', { name: '不發動', exact: true }).click()
        if (cancelInitial) {
          await page.waitForFunction(() => document.querySelector('[data-card-instance-id="bs12-009-defender"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 1 張'))
          const after = await readState(page)
          assert.equal(after.bottom.hand, 1)
          assert.deepEqual(after.bottom.support, row.before.bottom.support)
          assert.equal(after.bottom.deck, 12)
          assert.deepEqual((await trace(page)).map(e=>e.commandKind),['declare-attack',...Array(4).fill('resolve-next-damage')])
        } else {
          await page.getByRole('button', { name: '確認發動', exact: true }).click()
          const then = page.locator('.optional-cost-attack-inline')
          await then.waitFor()
          row.opened = await readState(page)
          assert.equal(row.opened.bottom.hand, 0)
          assert.equal(row.opened.bottom.trash, row.before.bottom.trash + 1)
          assert.equal(row.opened.bottom.support[0].rested, true)
          assert.deepEqual(row.opened.bottom.battle, row.before.bottom.battle)
          assert.equal(row.opened.top.battle[0].attack, ['zero-first', 'other-first'].includes(scenario) ? 4 : 3)
          assert.match(await then.innerText(), /將 1 張支援區【Arena】卡返回手牌/)
          const unavailable = ['non-arena-only', 'opponent-only', 'battle-only'].includes(scenario)
          const skipThen = unavailable || scenario === 'skip-then'
          if (skipThen) {
            assert.equal(await then.getByRole('button', { name: '支付', exact: true }).isEnabled(), !unavailable)
            await shot('then-blocked-or-skipped')
            await then.getByRole('button', { name: '略過', exact: true }).click()
          } else {
            await then.getByRole('button', { name: '支付', exact: true }).click()
            const options = then.locator('.modal-card-options>button')
            const confirm = then.getByRole('button', { name: '確認', exact: true })
            assert.equal(await options.count(), 4)
            assert.equal(await options.filter({ hasText: 'Candy Diver Cookie' }).count(), 0)
            assert.equal(await confirm.isEnabled(), false)
            const returnName = scenario === 'return-item' || scenario === 'rested-cost' ? 'Sweet Jams Guitar' : scenario === 'return-stage' ? 'Crown Stage' : scenario === 'return-blue' ? 'Stardust Cookie' : 'Basil Pesto Cookie'
            const choice = options.filter({ hasText: returnName })
            await choice.click()
            if (scenario === 'deselect-cost') { await choice.click(); assert.equal(await confirm.isEnabled(), false); await choice.click() }
            if (scenario === 'cost-max') { await options.filter({ hasText: 'Sweet Jams Guitar' }).click(); assert.equal(await then.locator('.modal-card-options>button.is-selected').count(), 1) }
            if (scenario === 'return-cost') {
              await then.getByRole('button', { name: '返回', exact: true }).click()
              assert.deepEqual(await readState(page), row.opened)
              await then.getByRole('button', { name: '支付', exact: true }).click()
              assert.equal(await confirm.isEnabled(), false)
              await choice.click()
            }
            assert.deepEqual(await readState(page), row.opened)
            await shot('return-cost')
            await confirm.click()
            row.paid = await readState(page)
            assert.equal(row.paid.bottom.hand, 1)
            assert.equal(row.paid.bottom.support.length, row.opened.bottom.support.length - 1)
            assert.equal(row.paid.bottom.deck, row.opened.bottom.deck)
            assert.deepEqual(row.paid.bottom.battle, row.opened.bottom.battle)
            await page.getByRole('button', { name: '確認發動', exact: true }).click()
            const draw = page.locator('.draw-up-to-modal:visible')
            await draw.waitFor()
            const drawCount = ['draw-zero', 'draw-skip'].includes(scenario) ? 0 : 1
            if (scenario === 'draw-switch') { await draw.getByRole('button', { name: /^抽 1 張/ }).click(); await draw.getByRole('button', { name: '不抽', exact: true }).click(); assert.deepEqual(await readState(page), row.paid) }
            if (drawCount) await draw.getByRole('button', { name: /^抽 1 張/ }).click()
            await draw.getByRole('button', { name: drawCount ? '抽取 1 張牌' : '略過抽牌', exact: true }).click()
            if (['last-deck', 'refresh-lv10'].includes(scenario)) {
              await page.getByRole('alertdialog').getByRole('button', { name: /^Candy Diver Cookie Candy Diver Cookie/ }).click()
              if (scenario === 'last-deck' && await page.getByRole('button', { name: '確認發動', exact: true }).count()) await page.getByRole('button', { name: '確認發動', exact: true }).click()
            }
          }
          if (scenario === 'refresh-lv10') {
            await page.getByRole('heading', { name: 'AI 對手勝利', exact: true }).waitFor()
            const after = await readState(page)
            assert.equal(after.bottom.battle[0].hp, 5)
            assert.equal(after.bottom.breakLevel, 11)
            assert.equal(after.bottom.hand, 2)
          } else {
            const hp = ['zero-first', 'other-first'].includes(scenario) ? 1 : 2
            await page.waitForFunction(expected => document.querySelector('[data-card-instance-id="bs12-009-defender"] .hp-card-stack')?.getAttribute('aria-label')?.includes(`HP 卡 ${expected} 張`), hp)
            await settle(page)
            const after = await readState(page)
            const drawCount = skipThen || ['draw-zero', 'draw-skip'].includes(scenario) ? 0 : 1
            assert.equal(after.bottom.hand, skipThen ? 0 : 1 + drawCount)
            assert.equal(after.bottom.deck, scenario === 'last-deck' ? 6 : 12 - drawCount)
            assert.equal(after.bottom.support.length, row.before.bottom.support.length - (skipThen ? 0 : 1))
            assert.equal(after.bottom.trash, scenario === 'last-deck' ? 3 : row.before.bottom.trash + 1 + (5 - hp))
            assert.deepEqual(after.top.support, row.before.top.support)
            const kinds = (await trace(page)).map(e => e.commandKind)
            assert.ok(kinds.includes('play-trap') && kinds.includes('resolve-optional-cost-attack'))
            assert.ok(kinds.indexOf('play-trap') < kinds.indexOf('resolve-optional-cost-attack'))
            if (!skipThen) {
              assert.ok(kinds.indexOf('resolve-optional-cost-attack') < kinds.indexOf('resolve-draw-up-to'))
              assert.ok((await trace(page)).find(e => e.commandKind === 'resolve-optional-cost-attack').steps.some(s => s.includes('支援卡返回手牌')))
            }
          }
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
      console.log(`PASS BS12-049 ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { row.error = String(error.stack ?? error); row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { rows.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)); await page.close() }
  }
  console.log(`BS12-049 Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
