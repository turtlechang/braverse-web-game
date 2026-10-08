import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-051-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const fixtures = ['positive', 'rested-entry', 'high-level', 'no-arena', 'item-only', 'full-battle', 'no-energy', 'wrong-energy', 'rested-energy', 'source-rested', 'source-support', 'opponent-turn', 'outside-main', 'target-last-hp', 'last-deck', 'short-deck', 'refresh-lv10']
const extras = ['zero', 'skip', 'payment-support-entry', 'blue-entry', 'deselect-target', 'switch-target', 'target-max', 'cancel-payment', 'cancel-target', 'wrong-draft-payment', 'deselect-payment', 'retry-after-cancel']
const cases = [...fixtures, ...extras]
const blocked = ['no-energy', 'wrong-energy', 'rested-energy', 'source-rested', 'source-support', 'opponent-turn', 'outside-main']
const readState = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return { deck: Number(field.querySelector('.deck-zone .resource-summary>strong')?.textContent), trash: Number(field.querySelector('.discard-zone.resource-summary>strong')?.textContent), hand: field.querySelectorAll('.hand-card').length,
      breakLevel: Number(field.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1]),
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
  for (const number of ['BS12-051', 'BS12-051@1']) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const row = { number, scenario, viewport, scope: 'candidate-printed-G-ordinary-one-optional-Arena-support-entry', status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${label}.png`) })
    try {
      const fixture = extras.includes(scenario) ? 'positive' : scenario
      for (const card of cards) await page.route(card.imageUrl, route=>route.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp'))}))
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'positive' ? 'card:'+number : process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'no-arena' ? 'card-negative:'+number : 'bs12-051:'+number+':'+fixture
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-001,BS12-003,BS12-005,BS12-006,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-019,BS12-022,BS12-028,BS12-029,BS12-030,BS12-031,BS12-038,BS12-039,BS12-041,BS12-044,BS12-046,BS12-048,BS12-049,BS12-050,BS12-051,BS12-052,BS12-053,BS12-055,BS12-070,BS6-008,BS7-055,BS7-061,ST3-001,ST4-001,ST4-002,ST4-003,ST4-004,ST4-005')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      row.before = await readState(page)
      const source = page.locator('[data-card-instance-id="bs12-051-source"]')
      const image = source.locator('img').first()
      await image.evaluate(i => i.decode())
      assert.equal(await image.getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
      assert.equal(await source.locator('.skill-action').count(), 0)
      if (blocked.includes(scenario)) {
        assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
        assert.deepEqual(await readState(page), row.before)
        assert.deepEqual(await trace(page), [])
      } else {
        const attacker = source.locator('.card-face.is-attackable')
        const support = i => page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="bs12-051-support-${i}"] .card-face`)
        const target = page.getByRole('button', { name: '選擇攻擊目標：Sugar Swan Cookie', exact: true })
        await attacker.click()
        if (scenario === 'cancel-payment') {
          await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
        } else {
          if (scenario === 'wrong-draft-payment') {
            await support(1).click({ position: { x: 10, y: 25 } })
            assert.equal(await target.count(), 0)
            assert.deepEqual(await trace(page), [])
            assert.deepEqual(await readState(page), row.before)
            await page.getByRole('dialog', { name: 'Stardust Cookie 卡牌詳情', exact: true }).getByRole('button', { name: '關閉', exact: true }).click()
          }
          await support(0).click({ position: { x: 10, y: 25 } })
          if (scenario === 'deselect-payment') {
            await support(0).click({ position: { x: 10, y: 25 } })
            assert.equal(await target.count(), 0)
            assert.deepEqual(await readState(page), row.before)
            await support(0).click({ position: { x: 10, y: 25 } })
          }
          assert.equal(await target.count(), 1)
          if (['cancel-target', 'retry-after-cancel'].includes(scenario)) {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await readState(page), row.before)
            assert.deepEqual(await trace(page), [])
            if (scenario === 'retry-after-cancel') { await attacker.click(); await support(0).click({ position: { x: 10, y: 25 } }) }
          }
          if (scenario !== 'cancel-target') {
            await target.click()
            const panel = page.getByRole('alertdialog')
            await panel.waitFor()
            assert.match(await panel.innerText(), /從支援區選最多 1 張【Arena】餅乾登場。可選 0 張/)
            assert.equal(await panel.locator('img[alt="Cream Ferret Cookie"]').getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
            row.opened = await readState(page)
            assert.equal(row.opened.top.battle.find(c => c.id === 'bs12-044-opponent')?.hp, scenario === 'target-last-hp' ? undefined : 5)
            assert.deepEqual(row.opened.top.battle.find(c => c.id === 'bs12-044-opponent-other'), row.before.top.battle[1])
            assert.equal(row.opened.top.trash, 1)
            assert.equal(row.opened.bottom.battle[0].rested, true)
            assert.equal(row.opened.bottom.support[0].rested, true)
            assert.equal(row.opened.bottom.deck, row.before.bottom.deck)
            const options = panel.locator('.effect-candidates .effect-candidate-entry>button')
            const unavailable = ['no-arena', 'item-only', 'full-battle'].includes(scenario)
            assert.equal(await options.count(), unavailable ? 0 : 2)
            const select = i => options.filter({ hasText: i === 0 ? 'Basil Pesto Cookie' : scenario === 'high-level' ? 'Melon Soda Cookie' : 'Stardust Cookie' })
            for (const i of unavailable ? [] : [0, 1]) {
              const cardNumber = i === 0 ? 'BS12-041' : scenario === 'high-level' ? 'BS12-039' : 'BS12-070'
              assert.equal(await select(i).locator('img').getAttribute('src'), cards.find(c => c.cardNumber === cardNumber).imageUrl)
              await select(i).locator('img').evaluate(img => img.decode())
            }
            let selected = unavailable || ['zero', 'skip', 'deselect-target'].includes(scenario) ? null : scenario === 'payment-support-entry' || scenario === 'positive' ? 0 : 1
            if (scenario === 'deselect-target') { await select(0).click(); await select(0).click() }
            if (selected !== null) await select(selected).click()
            if (['switch-target', 'target-max'].includes(scenario)) {
              if (scenario === 'switch-target') await select(1).click()
              await select(0).click()
              assert.equal(await panel.locator('.effect-candidates .effect-candidate-entry>button.is-selected').count(), 1)
              selected = scenario === 'switch-target' ? 0 : 1
            }
            assert.deepEqual(await readState(page), row.opened)
            await shot('then-selection')
            await panel.getByRole('button', { name: scenario === 'skip' ? '略過' : '確認發動', exact: true }).click()
            if (['last-deck', 'short-deck', 'refresh-lv10'].includes(scenario)) {
              const refresh = page.getByRole('alertdialog')
              await refresh.getByRole('button', { name: /^Candy Diver Cookie Candy Diver Cookie/ }).click()
            }
            if (scenario === 'refresh-lv10') await page.getByRole('heading', { name: 'AI 對手勝利', exact: true }).waitFor()
            else await page.waitForFunction(() => !document.querySelector('[role="alertdialog"]'))
            await settle(page)
            const after = await readState(page)
            assert.equal(after.bottom.battle.length, row.before.bottom.battle.length + (selected === null ? 0 : 1))
            assert.equal(after.bottom.support.length, row.before.bottom.support.length - (selected === null ? 0 : 1))
            assert.equal(after.bottom.battle[0].hp, 2)
            assert.equal(after.bottom.hand, 0)
            if (selected !== null) {
              const entered = after.bottom.battle.at(-1)
              const hp = scenario === 'refresh-lv10' ? 1 : scenario === 'high-level' ? 4 : 2
              assert.equal(entered.id, `bs12-051-support-${selected}`)
              assert.equal(entered.hp, hp)
              assert.equal(entered.rested, false)
              assert.equal(after.bottom.deck, scenario === 'last-deck' ? 5 : scenario === 'short-deck' ? 4 : scenario === 'refresh-lv10' ? 5 : row.before.bottom.deck - hp)
            } else assert.equal(after.bottom.deck, row.before.bottom.deck)
            if (scenario === 'refresh-lv10') assert.equal(after.bottom.breakLevel, 11)
            const commands = await trace(page)
            assert.equal(commands.filter(e => e.commandKind === 'declare-attack').length, 1)
            assert.equal(commands.filter(e => e.commandKind === 'resolve-attack-effect').length, 1)
            assert.ok(commands.findIndex(e => e.commandKind === 'resolve-next-damage') < commands.findIndex(e => e.commandKind === 'resolve-attack-effect'))
            const steps = commands.find(e => e.commandKind === 'resolve-attack-effect').steps
            assert.ok(steps.some(s => selected === null ? /沒有支援區餅乾登場/.test(s) : /支援區餅乾登場.*配置 \d+ HP/.test(s)))
          }
        }
        if (['cancel-payment', 'cancel-target'].includes(scenario)) { assert.deepEqual(await readState(page), row.before); assert.deepEqual(await trace(page), []) }
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
      console.log(`PASS ${number} ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { row.error = String(error.stack ?? error); row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { rows.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)); await page.close() }
  }
  console.log(`BS12-051 Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
