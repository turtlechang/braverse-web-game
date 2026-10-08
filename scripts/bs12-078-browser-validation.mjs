import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-078-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const references = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...references].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const ordinary = ['deploy', 'attack', 'wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main', 'cancel-payment', 'cancel-target', 'payment-deselect']
const blocked = ['no-hand', 'wrong-color', 'non-arena', 'split-cost']
const cases = [...ordinary, 'positive', 'four', 'six', ...blocked, 'item-cost', 'stage-cost', 'trap-cost', 'last-hp', 'decline', 'cost-deselect', 'cost-minimize', 'cancel-draft', 'receiver', 'receiver-deselect', 'receiver-limit', 'receiver-minimize']
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'),
      hand: Number(field?.querySelector('[aria-label*="狀態："]')?.getAttribute('aria-label')?.match(/手牌 (\d+)/)?.[1] ?? NaN),
      handIds: [...field.querySelectorAll('.hand-card-wrap')].map(n => n.getAttribute('data-card-instance-id')),
      breakLevel: Number(field.querySelector('.break-zone')?.textContent?.match(/LV\. (\d+)/)?.[1] ?? NaN),
      battle: [...field.querySelectorAll('.combat-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'),
        hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
        rested: n.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
      support: [...field.querySelectorAll('.support-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), rested: n.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, payload: e.payload, summary: e.summary, steps: e.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]'), null, { timeout: 20000 })
const clickExposed = async (page, locator) => {
  const point = await locator.evaluate(button => {
    const r = button.getBoundingClientRect()
    for (const fx of [0.15, 0.3, 0.5, 0.7, 0.85]) for (const fy of [0.3, 0.5, 0.7]) {
      const x = r.x + r.width * fx, y = r.y + r.height * fy
      const hit = document.elementFromPoint(x, y)
      if (hit && (hit === button || button.contains(hit))) return { x, y }
    }
    return null
  })
  assert.ok(point, 'Support payment has no exposed clickable point')
  await page.mouse.click(point.x, point.y)
}
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const rows = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const row = { number: 'BS12-078', scenario, viewport, printedSourceAttested: true, status: 'FAIL', errors: [], networkFailures: [] }
    const page = await browser.newPage({ viewport })
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, r => r.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const isOrdinary = ordinary.includes(scenario), receiver = scenario.startsWith('receiver')
      const fixture = receiver ? 'receiver' : ['cancel-payment', 'cancel-target', 'payment-deselect'].includes(scenario) ? 'attack' : ['cost-deselect', 'cost-minimize', 'cancel-draft'].includes(scenario) ? 'positive' : scenario
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'positive' ? 'card:'+'BS12-078' : process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'non-arena' ? 'card-negative:'+'BS12-078' : 'bs12-078:'+(ordinary.includes(scenario)?(cases.includes(scenario)&&['cancel-payment','cancel-target','payment-deselect'].includes(scenario)?'attack':scenario):scenario.startsWith('receiver')?'receiver':['cost-deselect','cost-minimize','cancel-draft'].includes(scenario)?'positive':scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-001,BS12-002,BS12-003,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-016,BS12-019,BS12-021,BS12-027,BS12-028,BS12-029,BS12-030,BS12-031,BS12-040,BS12-046,BS12-058,BS12-059,BS12-060,BS12-061,BS12-064,BS12-069,BS12-070,BS12-071,BS12-072,BS12-073,BS12-074,BS12-075,BS12-076,BS12-077,BS12-078,BS12-083,BS12-084,BS12-086,BS4-090,BS4-014,BS6-008,BS6-017,BS7-061,ST4-001'+'')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      row.before = await state(page)
      row.setupTrace = await trace(page)
      assert.ok(row.before.bottom.battle.length <= 2 && row.before.top.battle.length <= 2)
      if (isOrdinary) {
        const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-078-source"]')
        if (scenario === 'deploy') {
          const hand = page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-078-source"]')
          await hand.locator('.card-face').click()
          await hand.getByRole('button', { name: '登場', exact: true }).click()
          await source.waitFor()
          await settle(page)
          const after = await state(page)
          assert.equal(after.bottom.battle[0].hp, 3)
          assert.equal(after.bottom.deck, 9)
          assert.equal(after.bottom.hand, 0)
          assert.deepEqual(after.top, row.before.top)
          assert.deepEqual(after.bottom.support, row.before.bottom.support)
          assert.deepEqual((await trace(page)).map(e => e.commandKind), ['deploy-cookie'])
        }
        await source.locator('img').first().evaluate(i => i.decode())
        assert.equal(await source.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-078').imageUrl)
        assert.equal(await source.locator('.skill-action').count(), 0)
        if (['wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main'].includes(scenario)) {
          assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
          assert.deepEqual(await state(page), row.before)
          assert.deepEqual(await trace(page), row.setupTrace)
        } else if (scenario !== 'deploy') {
          await source.locator('.card-face.is-attackable').click()
          const pay = i => page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="bs12-078-payment-${i}"] .card-face`)
          await clickExposed(page, pay(0))
          if (scenario === 'payment-deselect') {
            assert.equal(await pay(0).evaluate(b => b.classList.contains('is-selected')), true)
            await clickExposed(page, pay(0))
            assert.equal(await pay(0).evaluate(b => b.classList.contains('is-selected')), false)
            assert.match(await page.locator('body').innerText(), /已選 0／3 張支援卡/)
            assert.deepEqual(await state(page), row.before)
            await clickExposed(page, pay(0))
          }
          if (scenario !== 'cancel-payment') for (const i of [1, 2]) await clickExposed(page, pay(i))
          if (scenario.startsWith('cancel-')) {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await state(page), row.before)
            assert.deepEqual(await trace(page), row.setupTrace)
          } else {
            await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-078-attacker"]').getByRole('button', { name: /^選擇攻擊目標/ }).click()
            await page.getByRole('button', { name: '結束主要階段', exact: true }).waitFor()
            await page.waitForFunction(() => document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="bs12-078-attacker"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 1 張'))
            await settle(page)
            const after = await state(page)
            assert.deepEqual(after.top.battle.map(c => c.hp), [1, 4])
            assert.equal(after.bottom.battle[0].hp, 3)
            assert.equal(after.bottom.battle[0].rested, true)
            assert.ok(after.bottom.support.every(s => s.rested))
            assert.equal(after.bottom.deck, row.before.bottom.deck)
            assert.equal(after.bottom.trash, row.before.bottom.trash)
            assert.equal(after.top.trash, row.before.top.trash + 3)
            const commands = (await trace(page)).map(e => e.commandKind)
            assert.ok(commands.includes('declare-attack'))
            assert.equal(commands.includes('resolve-flip'), false)
            assert.equal(commands.includes('resolve-opponent-hand-discard'), false)
          }
        }
      } else if (receiver) {
        const modal = page.getByRole('alertdialog').filter({ hasText: 'Onion Cookie 要求你棄置手牌' })
        await modal.waitFor()
        await modal.locator('img[alt="Onion Cookie"]').evaluate(i => i.decode())
        assert.equal(await modal.locator('img[alt="Onion Cookie"]').getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-078').imageUrl)
        const confirm = () => modal.getByRole('button', { name: /^確認棄置/ })
        assert.equal(await confirm().isEnabled(), false)
        assert.equal(await modal.getByRole('button', { name: '略過', exact: true }).count(), 0)
        const a = modal.getByRole('button', { name: 'Baguette Cookie Baguette Cookie', exact: true })
        const b = modal.getByRole('button', { name: 'Gnome Band Gnome Band', exact: true })
        await a.click()
        assert.equal(await confirm().isEnabled(), false)
        await b.click()
        assert.equal(await confirm().isEnabled(), true)
        if (scenario === 'receiver-limit') {
          await modal.getByRole('button', { name: 'Muscle Cookie Muscle Cookie', exact: true }).click()
          assert.equal(await modal.locator('.hand-discard-card-option > button.is-selected').count(), 2)
          assert.equal(await a.getAttribute('class'), 'is-selected')
          assert.equal(await b.getAttribute('class'), 'is-selected')
        }
        if (scenario === 'receiver-deselect') {
          await a.click()
          assert.equal(await confirm().isEnabled(), false)
          await b.click()
          assert.equal(await modal.getByRole('button', { name: '確認棄置 (0)', exact: true }).isEnabled(), false)
          await b.click(); await a.click()
        }
        if (scenario === 'receiver-minimize') {
          await modal.getByRole('button', { name: '縮小', exact: true }).click()
          await page.getByRole('button', { name: /^Onion Cookie 已選擇/ }).click()
          assert.equal(await confirm().isEnabled(), true)
        }
        assert.deepEqual(await state(page), row.before)
        assert.deepEqual(await trace(page), row.setupTrace)
        await shot('selected-two')
        await modal.getByRole('button', { name: '確認棄置 (2)', exact: true }).click()
        await modal.waitFor({ state: 'hidden' })
        await settle(page)
        const after = await state(page)
        assert.equal(after.bottom.hand, 3)
        assert.equal(after.bottom.trash, 2)
        assert.deepEqual(after.bottom.handIds, ['bs12-078-receiver-hand-0', 'bs12-078-receiver-hand-1', 'bs12-078-receiver-hand-3'])
        assert.deepEqual(after.bottom.battle, row.before.bottom.battle)
        assert.deepEqual(after.bottom.support, row.before.bottom.support)
        assert.equal(after.bottom.deck, row.before.bottom.deck)
        assert.deepEqual(after.top, row.before.top)
        assert.ok((await trace(page)).some(e => e.commandKind === 'resolve-opponent-hand-discard'))
        assert.equal(await page.getByRole('button', { name: '結束主要階段', exact: true }).isEnabled(), true)
      } else if (scenario === 'four') {
        assert.equal(await page.getByRole('heading', { name: 'Onion Cookie FLIP', exact: true }).count(), 0)
        assert.equal(row.before.top.hand, 4)
        assert.equal(row.before.top.trash, 0)
        assert.equal(row.before.bottom.hand, 1)
        assert.equal(row.before.bottom.trash, 1)
        assert.deepEqual(row.before.bottom.battle.map(c => c.hp), [3, 4])
        assert.equal(row.setupTrace.some(e => e.commandKind === 'resolve-flip'), false)
        assert.equal(row.setupTrace.some(e => e.commandKind === 'resolve-opponent-hand-discard'), false)
      } else {
        const modal = page.getByRole('alertdialog').filter({ hasText: 'Onion Cookie FLIP' })
        await modal.waitFor()
        assert.equal(await modal.getByRole('img', { name: '紫色能量', exact: true }).count(), 1)
        assert.equal((await modal.innerText()).includes('{P}'), false)
        await modal.locator('img[alt="Onion Cookie"]').evaluate(i => i.decode())
        assert.equal(await modal.locator('img[alt="Onion Cookie"]').getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-078').imageUrl)
        const activate = modal.getByRole('button', { name: '發動 FLIP', exact: true })
        const choices = modal.locator('.modal-card-options > button')
        assert.equal(await activate.isEnabled(), false)
        const declined = blocked.includes(scenario) || ['decline', 'cancel-draft'].includes(scenario)
        if (blocked.includes(scenario)) assert.equal(await choices.count(), 0)
        else {
          assert.equal(await choices.count(), 1)
          const costNumber = scenario === 'item-cost' ? 'BS12-083' : scenario === 'stage-cost' ? 'BS12-084' : scenario === 'trap-cost' ? 'BS12-086' : 'BS12-075'
          await choices.locator('img').evaluate(i => i.decode())
          assert.equal(await choices.locator('img').getAttribute('src'), cards.find(c => c.cardNumber === costNumber).imageUrl)
          if (scenario !== 'decline') {
            await choices.click()
            assert.equal(await activate.isEnabled(), true)
            if (scenario === 'cost-deselect') {
              await choices.click(); assert.equal(await activate.isEnabled(), false); await choices.click()
            }
            if (scenario === 'cost-minimize') {
              await modal.getByRole('button', { name: '縮小', exact: true }).click()
              const dock = page.locator('.card-reveal-dock:visible')
              assert.match(await dock.innerText(), /Onion Cookie\s+FLIP 效果待確認/)
              await dock.click()
              assert.equal(await activate.isEnabled(), true)
            }
          }
        }
        assert.deepEqual(await state(page), row.before)
        assert.deepEqual(await trace(page), row.setupTrace)
        await shot('before-confirm')
        await modal.getByRole('button', { name: declined ? '不發動' : '發動 FLIP', exact: true }).click()
        await modal.waitFor({ state: 'hidden' })
        if (!declined) {
          const publicDiscard = page.getByRole('alertdialog', { name: '對手棄置的卡牌', exact: true })
          await publicDiscard.waitFor()
          assert.equal(await publicDiscard.locator('article').count(), 2)
          await publicDiscard.getByRole('button', { name: '確認並繼續', exact: true }).click()
          await publicDiscard.waitFor({ state: 'hidden' })
        }
        if (scenario === 'last-hp') {
          await page.getByRole('button', { name: '不補餅乾', exact: true }).click()
        }
        await settle(page)
        const after = await state(page)
        assert.equal(after.bottom.hand, row.before.bottom.hand - (declined ? 0 : 1))
        assert.equal(after.bottom.trash, row.before.bottom.trash + (declined ? 1 : 2))
        assert.equal(after.top.hand, row.before.top.hand - (declined ? 0 : 2))
        assert.equal(after.top.trash, row.before.top.trash + (declined ? 0 : 2))
        assert.equal(after.bottom.deck, row.before.bottom.deck)
        assert.equal(after.top.deck, row.before.top.deck)
        assert.deepEqual(after.bottom.support, row.before.bottom.support)
        assert.deepEqual(after.top.battle, row.before.top.battle)
        assert.deepEqual(after.top.support, row.before.top.support)
        if (scenario === 'last-hp') {
          assert.equal(after.bottom.breakLevel, 1)
          assert.deepEqual(after.bottom.battle, row.before.bottom.battle.filter(c => c.id !== 'bs12-078-bearer'))
        } else assert.deepEqual(after.bottom.battle, row.before.bottom.battle)
        const commands = (await trace(page)).map(e => e.commandKind)
        assert.equal(commands.filter(k => k === 'resolve-flip').length, 1)
        assert.equal(commands.filter(k => k === 'resolve-opponent-hand-discard').length, declined ? 0 : 1)
        if (!declined) assert.ok(commands.indexOf('resolve-flip') < commands.indexOf('resolve-opponent-hand-discard'))
      }
      await settle(page)
      row.after = await state(page); row.trace = await trace(page)
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
      await shot('result'); row.status = 'PASS'
      console.log(`PASS BS12-078 ${scenario} ${viewport.width}`)
    } catch (error) {
      row.error = error.stack ?? String(error)
      row.dom = await page.locator('body').innerText().catch(() => '')
      await shot('failure').catch(() => {})
      throw error
    } finally { rows.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)); await page.close() }
  }
} finally { await browser.close() }
