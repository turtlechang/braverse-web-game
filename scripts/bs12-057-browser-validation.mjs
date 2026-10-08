import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-057-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const fixtures = ['positive', 'cost-item', 'cost-stage', 'no-cost', 'cost-non-arena', 'cost-wrong-color', 'cost-split', 'opponent-cost-only', 'rested-target', 'only-high', 'no-target', 'target-only', 'target-equipped', 'movement-blocked', 'full-battle', 'opponent-turn', 'outside-main', 'refresh', 'refresh-lv10', 'isolated-opponent-on-play', 'support-entry', 'rested-support-entry', 'attack', 'attack-all-blue', 'attack-wrong', 'attack-few', 'attack-rested-energy', 'attack-source-rested']
const extras = ['zero', 'other-target', 'skip', 'skip-draft', 'back-cost', 'deselect-cost', 'target-deselect', 'target-switch', 'target-limit', 'cancel-hand', 'attack-cancel-payment', 'attack-cancel-target']
const noCost = ['no-cost', 'cost-non-arena', 'cost-wrong-color', 'cost-split', 'opponent-cost-only']
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
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of [...fixtures, ...extras].filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const row = { number: 'BS12-057', scenario, viewport, printedSourceAttested: !['target-equipped','isolated-opponent-on-play'].includes(scenario), scope: scenario === 'isolated-opponent-on-play' ? 'isolated-OnPlay-opponent-turn' : 'candidate-printed-BBN-two-OnPlay-blue-AND-Arena-hand-opponent-LV2-deck-bottom', status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `BS12-057-${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route=>route.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp'))}))
      const attack = scenario.startsWith('attack')
      const support = scenario.includes('support-entry')
      const route = attack && extras.includes(scenario) ? 'attack' : extras.includes(scenario) ? 'positive' : scenario
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && route === 'positive' ? 'card:'+'BS12-057' : process.env.BS12_BROWSER_ROUTE === 'generic' && route === 'cost-split' ? 'card-negative:'+'BS12-057' : 'bs12-057:'+route
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-001,BS12-003,BS12-005,BS12-007,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-017,BS12-019,BS12-024,BS12-028,BS12-029,BS12-030,BS12-031,BS12-038,BS12-039,BS12-041,BS12-044,BS12-046,BS12-048,BS12-050,BS12-051,BS12-053,BS12-054,BS12-054@1,BS12-055,BS12-055@1,BS12-056,BS12-056@1,BS12-057,BS12-058,BS12-058@1,BS12-067,BS12-068,BS4-095,BS6-008,BS6-010,BS9-014,ST4-001')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      row.before = await readState(page)
      const panel = page.getByRole('alertdialog')
      const source = page.locator('.bottom-field [data-card-instance-id="bs12-057-source"].combat-card-wrap')
      if (attack) {
        await source.locator('img').first().evaluate(i => i.decode())
        assert.equal(await source.locator('img').first().getAttribute('src'), cards.find(c => c.cardNumber === 'BS12-057').imageUrl)
        if (['attack-wrong', 'attack-few', 'attack-rested-energy', 'attack-source-rested'].includes(scenario)) {
          assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
          assert.deepEqual(await readState(page), row.before)
          assert.deepEqual(await trace(page), [])
        } else {
          await source.locator('.card-face.is-attackable').click()
          const target = page.getByRole('button', { name: '選擇攻擊目標：Candy Diver Cookie', exact: true })
          for (const i of [0, 1, 2]) {
            assert.equal(await target.count(), 0)
            await page.locator(`.bottom-field [data-card-instance-id="bs12-057-payment-${i}"] .card-face`).click({ position: { x: 10, y: 25 } })
            if (scenario === 'attack-cancel-payment') break
          }
          if (scenario.includes('cancel')) {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await readState(page), row.before)
            assert.deepEqual(await trace(page), [])
          } else {
            await target.click()
            await page.waitForFunction(() => document.querySelector('.top-field [data-card-instance-id="bs12-057-opponent-1"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 1 張'))
            const after = await readState(page)
            assert.equal(after.top.battle[1].hp, 1)
            assert.deepEqual(after.bottom.battle, row.before.bottom.battle.map(c => c.id === 'bs12-057-source' ? { ...c, rested: true } : c))
            assert.ok(after.bottom.support.every(s => s.rested))
            assert.equal(after.bottom.hand, row.before.bottom.hand)
            assert.equal(after.bottom.trash, row.before.bottom.trash)
            assert.equal(await panel.count(), 0)
            assert.ok((await trace(page)).some(c => c.commandKind === 'declare-attack'))
            assert.ok(!(await trace(page)).some(c => ['begin-activate-skill', 'resolve-ability-effect', 'resolve-optional-cost-attack'].includes(c.commandKind)))
          }
        }
      } else {
        if (support) {
          await page.locator('.bottom-field [data-card-instance-id="bs12-057-ally"] .card-face.is-attackable').click()
          await page.locator('.bottom-field [data-card-instance-id="bs12-057-payment-0"] .card-face').click({ position: { x: 10, y: 25 } })
          await page.getByRole('button', { name: '選擇攻擊目標：Candy Diver Cookie', exact: true }).click()
          await panel.waitFor()
          await panel.getByRole('button', { name: /^Marbleberry Cookie Marbleberry Cookie/ }).click()
          await panel.getByRole('button', { name: '確認發動', exact: true }).click()
        } else if (scenario !== 'isolated-opponent-on-play') {
          const hand = page.locator('.bottom-field').getByRole('button', { name: 'Marbleberry Cookie', exact: true }).first()
          await hand.click()
          if (['full-battle', 'opponent-turn', 'outside-main'].includes(scenario)) {
            const deploy = page.getByRole('button', { name: '登場', exact: true })
            assert.ok(await deploy.count() === 0 || !await deploy.isEnabled())
            assert.deepEqual(await readState(page), row.before)
            assert.deepEqual(await trace(page), [])
          } else if (scenario === 'cancel-hand') {
            await page.keyboard.press('Escape')
            assert.equal(await page.getByRole('button', { name: '登場', exact: true }).count(), 0)
            assert.deepEqual(await readState(page), row.before)
            assert.deepEqual(await trace(page), [])
          } else await page.getByRole('button', { name: '登場', exact: true }).click()
        }
        if (!['full-battle', 'opponent-turn', 'outside-main', 'cancel-hand'].includes(scenario)) {
          if (['refresh', 'refresh-lv10'].includes(scenario)) {
            await panel.getByRole('button', { name: /^Candy Diver Cookie Candy Diver Cookie/ }).first().click()
            if (scenario === 'refresh-lv10') await page.getByRole('heading', { name: 'AI 對手勝利', exact: true }).waitFor()
          }
          await source.waitFor()
          await source.locator('img').first().evaluate(i => i.decode())
          assert.equal(await source.locator('img').first().getAttribute('src'), cards.find(c => c.cardNumber === 'BS12-057').imageUrl)
          row.entry = await readState(page)
          assert.equal(row.entry.bottom.battle.find(c => c.id === 'bs12-057-source').hp, scenario === 'refresh-lv10' ? 2 : 4)
          assert.equal(row.entry.bottom.battle.find(c => c.id === 'bs12-057-source').rested, false)
          assert.equal(row.entry.bottom.deck, scenario === 'refresh' ? 3 : scenario === 'refresh-lv10' ? row.entry.bottom.deck : 12)
          if (noCost.includes(scenario) || scenario === 'refresh-lv10') {
            if (scenario !== 'refresh-lv10') await page.waitForFunction(() => !document.querySelector('[role="alertdialog"]'))
            else assert.ok((await trace(page)).every(c => c.commandKind !== 'begin-activate-skill' && c.commandKind !== 'resolve-ability-effect'))
            assert.equal(row.entry.bottom.trash, 0)
            assert.deepEqual(row.entry.top, row.before.top)
            if (scenario === 'refresh-lv10') assert.equal(row.entry.bottom.breakLevel, 11)
          } else {
            await panel.waitFor()
            assert.match(await panel.innerText(), /OnPlay.*登場|登場觸發/)
            assert.equal(await panel.locator('img[alt="Marbleberry Cookie"]').first().getAttribute('src'), cards.find(c => c.cardNumber === 'BS12-057').imageUrl)
            const cost = panel.locator('.effect-candidate-entry>button')
            assert.equal(await cost.count(), 1)
            const costName = scenario === 'cost-item' ? 'Bone-afide Multivitamin Jelly' : scenario === 'cost-stage' ? 'Comeback Stage' : 'Marbleberry Cookie'
            assert.ok((await cost.innerText()).includes(costName))
            assert.equal(await panel.getByRole('button', { name: '下一步', exact: true }).isEnabled(), false)
            const skip = scenario === 'skip' || scenario === 'skip-draft'
            if (scenario !== 'skip') {
              await cost.click()
              if (scenario === 'deselect-cost') { await cost.click(); assert.equal(await panel.getByRole('button', { name: '下一步', exact: true }).isEnabled(), false); await cost.click() }
              assert.deepEqual(await readState(page), row.entry)
              await shot('cost')
            }
            if (skip) {
              await panel.getByRole('button', { name: '略過整個登場效果', exact: true }).click()
              assert.deepEqual(await readState(page), row.entry)
            } else {
              await panel.getByRole('button', { name: '下一步', exact: true }).click()
              if (scenario === 'back-cost') { await panel.getByRole('button', { name: '上一步', exact: true }).click(); assert.deepEqual(await readState(page), row.entry); await panel.getByRole('button', { name: '下一步', exact: true }).click() }
              const targets = panel.locator('.effect-candidate-entry>button')
              const empty = ['only-high', 'no-target', 'movement-blocked'].includes(scenario)
              assert.equal(await targets.count(), empty ? 0 : scenario === 'target-only' ? 1 : 2)
              assert.match(await panel.innerText(), /最多 1 張對手餅乾.*牌庫底/)
              const target = i => panel.getByRole('button', { name: i === 0 ? scenario === 'target-equipped' ? /^Shining Glitter Cookie Shining Glitter Cookie AI 對手/ : /^Peach Cookie Peach Cookie AI 對手/ : /^Candy Diver Cookie Candy Diver Cookie AI 對手/ })
              let selected = empty || scenario === 'zero' ? null : scenario === 'other-target' ? 1 : 0
              if (selected !== null) await target(selected).click()
              if (scenario === 'target-deselect') { await target(0).click(); selected = null }
              if (scenario === 'target-switch') { await target(0).click(); await target(1).click(); selected = 1 }
              if (scenario === 'target-limit') { await target(1).click(); assert.equal(await panel.locator('.effect-candidate-entry>button.is-selected').count(), 1) }
              assert.deepEqual(await readState(page), row.entry)
              await shot('target')
              await panel.getByRole('button', { name: '確認發動', exact: true }).click()
              await settle(page)
              if (scenario === 'target-only') await page.locator('.top-field [data-card-instance-id="bs12-057-replacement"]').waitFor()
              if (selected !== null) await page.locator(`.top-field [data-card-instance-id="bs12-057-opponent-${selected}"]`).waitFor({ state: 'hidden' })
              const after = await readState(page)
              assert.equal(after.bottom.hand, row.entry.bottom.hand - 1)
              assert.equal(after.bottom.trash, 1)
              assert.deepEqual(after.bottom.battle, row.entry.bottom.battle)
              assert.deepEqual(after.bottom.support, row.entry.bottom.support)
              assert.equal(after.bottom.deck, row.entry.bottom.deck)
              if (selected === null) assert.deepEqual(after.top, row.entry.top)
              else {
                assert.equal(after.top.deck, scenario === 'target-only' ? 9 : row.entry.top.deck + 1)
                assert.equal(after.top.trash, row.entry.top.trash + row.entry.top.battle[selected].hp + (scenario === 'target-equipped' ? 1 : 0))
                assert.equal(after.top.breakLevel, 0)
                if (scenario !== 'target-only') assert.deepEqual(after.top.battle, row.entry.top.battle.filter((_, i) => i !== selected))
                else assert.equal(after.top.battle[0].hp, 2)
              }
              row.selected = selected
              const commands = await trace(page)
              row.trace = commands
              assert.equal(commands.filter(c => c.commandKind === 'begin-activate-skill').length, 1)
              assert.equal(commands.filter(c => c.commandKind === 'resolve-ability-effect').length, 1)
              const logText = commands.flatMap(c => c.steps ?? []).join(' ')
              assert.match(logText, new RegExp(costName))
              assert.match(logText, selected === null ? /未選擇目標|阻止|阻擋/ : /牌庫底/)
            }
            await page.waitForFunction(() => !document.querySelector('[role="alertdialog"]'))
          }
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
    } catch (error) { row.error = error.stack; row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure'); rows.push(row); writeFileSync(resolve(out, 'failure-results.json'), JSON.stringify(rows, null, 2)); throw error }
    finally { await page.close() }
    rows.push(row); console.log(`PASS BS12-057 ${scenario} ${viewport.width}`)
  }
} finally { await browser.close(); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)) }
console.log(`BS12-057 candidate Browser: ${rows.filter(r => r.status === 'PASS').length}/${rows.length}`)
