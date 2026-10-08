import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-058-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/cards/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const cases = ['positive', 'red-hand', 'green-hand', 'item-hand', 'stage-hand', 'no-hand', 'non-arena-hand', 'opponent-cost-only', 'last-hp', 'follow-up', 'short-deck', 'last-deck', 'refresh-lv10', 'isolated-own-turn', 'attack', 'attack-wrong', 'attack-few', 'attack-rested-energy', 'attack-source-rested', 'deploy', 'draw-zero', 'draw-one', 'skip', 'skip-draft', 'deselect', 'draw-switch', 'attack-cancel-payment', 'attack-cancel-target']
cases.splice(9, 0, 'last-hp-refresh')
const extras = ['draw-zero', 'draw-one', 'skip', 'skip-draft', 'deselect', 'draw-switch', 'attack-cancel-payment', 'attack-cancel-target']
const routeCase = scenario => extras.includes(scenario) ? scenario.startsWith('attack-') ? 'attack' : 'positive' : scenario
const readState = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return { hand: field.querySelectorAll('.hand-card').length, deck: Number(field.querySelector('.deck-zone .resource-summary>strong')?.textContent), trash: Number(field.querySelector('.discard-zone.resource-summary>strong')?.textContent), breakLevel: Number(field.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1]),
      battle: [...field.querySelectorAll('.combat-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]), rested: n.querySelector('.card-face').classList.contains('is-rested') })),
      support: [...field.querySelectorAll('.support-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), rested: n.querySelector('.card-face').classList.contains('is-rested') })) }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, summary: e.summary, steps: e.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]'), null, { timeout: 20000 })
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const rows = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const number of ['BS12-058', 'BS12-058@1']) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const row = { number, scenario, viewport, printedSourceAttested: scenario !== 'isolated-own-turn', scope: scenario === 'isolated-own-turn' ? 'isolated-turn' : 'candidate-local', status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => row.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()) })
    page.on('requestfailed', request => row.networkFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route=>route.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp'))}))
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && routeCase(scenario) === 'positive' ? 'card:'+number : process.env.BS12_BROWSER_ROUTE === 'generic' && routeCase(scenario) === 'non-arena-hand' ? 'card-negative:'+number : 'bs12-058:'+number+':'+routeCase(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-001,BS12-003,BS12-005,BS12-007,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-017,BS12-019,BS12-024,BS12-028,BS12-029,BS12-030,BS12-031,BS12-038,BS12-039,BS12-041,BS12-044,BS12-046,BS12-048,BS12-050,BS12-051,BS12-053,BS12-054,BS12-054@1,BS12-055,BS12-055@1,BS12-056,BS12-056@1,BS12-057,BS12-058,BS12-058@1,BS12-067,BS12-068,BS4-095,BS6-008,BS6-010,BS9-014,ST4-001')
      await page.locator('.game-shell').waitFor()
      await settle(page)
      row.before = await readState(page)
      assert.ok(row.before.bottom.battle.length <= 2 && row.before.top.battle.length <= 2)
      assert.deepEqual(await trace(page), [])
      const source = page.locator('.bottom-field [data-card-instance-id="bs12-058-source"]')
      if (scenario === 'deploy') {
        const hand = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator('img[alt="Peppermint Cookie"]') })
        await hand.locator('button.card-face').click()
        await hand.getByRole('button', { name: '登場', exact: true }).click()
        await source.waitFor()
        await settle(page)
        const after = await readState(page)
        assert.deepEqual(after.bottom.battle.map(c => c.hp), [2, 1])
        assert.equal(after.bottom.deck, 11)
        assert.equal(after.bottom.hand, 0)
        assert.deepEqual(after.top, row.before.top)
        assert.deepEqual((await trace(page)).map(c => c.commandKind), ['deploy-cookie'])
        assert.equal(await page.locator('[role="alertdialog"]').count(), 0)
      } else if (scenario.startsWith('attack')) {
        await source.locator('img').first().evaluate(i => i.decode())
        assert.equal(await source.locator('img').first().getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
        assert.equal(await source.locator('.skill-action').count(), 0)
        if (!['attack', 'attack-cancel-payment', 'attack-cancel-target'].includes(scenario)) {
          assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
          assert.deepEqual(await readState(page), row.before)
          assert.deepEqual(await trace(page), [])
        } else {
          await source.locator('.card-face.is-attackable').click()
          if (scenario !== 'attack-cancel-payment') await page.locator('.bottom-field [data-card-instance-id="bs12-058-payment"] .card-face').click({ position: { x: 10, y: 25 } })
          if (scenario.startsWith('attack-cancel')) {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await readState(page), row.before)
            assert.deepEqual(await trace(page), [])
          } else {
            await page.getByRole('button', { name: '選擇攻擊目標：Candy Diver Cookie', exact: true }).click()
            await page.waitForFunction(() => document.querySelector('.top-field [data-card-instance-id="bs12-058-opponent"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 2 張'))
            await settle(page)
            const after = await readState(page)
            assert.equal(after.top.battle[0].hp, 2)
            assert.equal(after.bottom.battle[1].rested, true)
            assert.ok(after.bottom.support.every(s => s.rested))
            assert.equal(after.bottom.hand, 0)
            assert.ok(!(await trace(page)).some(c => c.commandKind === 'resolve-attack-effect'))
          }
        }
      } else {
        const dialog = page.locator('.flip-response-modal')
        await dialog.waitFor()
        await dialog.locator('img[alt="Peppermint Cookie"]').first().evaluate(i => i.decode())
        assert.equal(await dialog.locator('img[alt="Peppermint Cookie"]').first().getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
        assert.match(await dialog.innerText(), /公開 1 張【Arena】手牌並放到自己的牌庫底/)
        const box = await dialog.boundingBox()
        assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1)
        const choices = dialog.locator('.modal-card-options > button')
        const activate = dialog.getByRole('button', { name: '發動 FLIP', exact: true })
        assert.equal(await activate.isEnabled(), false)
        const invalid = ['no-hand', 'non-arena-hand', 'opponent-cost-only'].includes(scenario)
        assert.equal(await choices.count(), invalid ? 0 : 1)
        const skip = invalid || ['skip', 'skip-draft'].includes(scenario)
        if (!invalid && scenario !== 'skip') {
          await choices.click()
          if (scenario === 'deselect') { await choices.click(); assert.equal(await activate.isEnabled(), false); await choices.click() }
          assert.deepEqual(await readState(page), row.before)
          assert.deepEqual(await trace(page), [])
        }
        if (skip) {
          if (invalid) assert.match(await dialog.innerText(), /符合代價的手牌不足/)
          await dialog.getByRole('button', { name: '不發動', exact: true }).click()
          await dialog.waitFor({ state: 'hidden' })
          await settle(page)
          const after = await readState(page)
          assert.equal(after.bottom.hand, row.before.bottom.hand)
          assert.equal(after.bottom.deck, row.before.bottom.deck)
          assert.equal(after.bottom.trash, 1)
          assert.equal(await page.locator('.draw-up-to-selector').count(), 0)
        } else {
          await shot('cost')
          await activate.click()
          const draw = page.locator('.draw-up-to-selector')
          await draw.waitFor()
          const paid = await readState(page)
          assert.equal(paid.bottom.hand, row.before.bottom.hand - 1)
          assert.equal(paid.bottom.deck, row.before.bottom.deck + 1)
          assert.equal(paid.bottom.trash, row.before.bottom.trash + 1)
          assert.deepEqual(paid.bottom.battle, row.before.bottom.battle)
          assert.equal(paid.bottom.breakLevel, row.before.bottom.breakLevel)
          const count = scenario === 'draw-zero' ? 0 : scenario === 'draw-one' ? 1 : 2
          if (scenario === 'draw-switch') {
            await draw.getByRole('button', { name: /^抽 2 張/ }).click()
            await draw.getByRole('button', { name: /^抽 1 張/ }).click()
            await draw.getByRole('button', { name: '不抽', exact: true }).click()
            assert.deepEqual(await readState(page), paid)
          }
          await draw.getByRole('button', { name: count === 0 ? '不抽' : new RegExp(`^抽 ${count} 張`) }).click()
          await shot('draw')
          await draw.getByRole('button', { name: count === 0 ? '略過抽牌' : `抽取 ${count} 張牌`, exact: true }).click()
          if (['last-deck', 'last-hp-refresh', 'refresh-lv10'].includes(scenario)) {
            const refresh = page.getByRole('alertdialog')
            await refresh.waitFor()
            await refresh.getByRole('button', { name: /^Candy Diver Cookie Candy Diver Cookie/ }).first().click()
            if (scenario === 'refresh-lv10') await page.getByRole('heading', { name: 'AI 對手勝利', exact: true }).waitFor()
          }
          await draw.waitFor({ state: 'hidden' })
          await settle(page)
          if (['last-hp', 'last-hp-refresh', 'follow-up'].includes(scenario)) await page.waitForFunction(() => !document.querySelector('.bottom-field [data-card-instance-id="bs12-058-bearer"]'))
          const after = await readState(page)
          assert.equal(after.bottom.hand, row.before.bottom.hand - 1 + count)
          assert.equal(after.bottom.deck, ['last-deck', 'last-hp-refresh', 'refresh-lv10'].includes(scenario) ? 6 : row.before.bottom.deck + 1 - count)
          if (['last-hp', 'last-hp-refresh', 'follow-up'].includes(scenario)) {
            assert.deepEqual(after.bottom.battle.map(c => c.id), ['bs12-058-ally'])
            assert.equal(after.bottom.breakLevel, scenario === 'last-hp-refresh' ? 4 : 2)
          }
          const commands = await trace(page)
          assert.equal(commands.filter(c => c.commandKind === 'resolve-flip').length, 1)
          assert.equal(commands.filter(c => c.commandKind === 'resolve-draw-up-to').length, 1)
          assert.match(commands.flatMap(c => c.steps ?? []).join(' '), /公開手牌並放到自己的牌庫底/)
          assert.ok(!commands.flatMap(c => c.steps ?? []).join(' ').includes('FLIP 代價：棄置手牌'))
        }
      }
      row.after = await readState(page); row.trace = await trace(page)
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
    } catch (error) { row.error = error.stack; row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure'); throw error }
    finally { rows.push(row); await page.close() }
    console.log(`PASS ${number} ${scenario} ${viewport.width}`)
  }
} finally { await browser.close(); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)) }
console.log(`BS12-058 candidate Browser: ${rows.filter(r => r.status === 'PASS').length}/${rows.length}`)
