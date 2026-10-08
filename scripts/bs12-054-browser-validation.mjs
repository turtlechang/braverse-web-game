import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-054-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/cards/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const fixtures = ['positive', 'empty-trash', 'item-trash', 'item-only-support', 'no-support', 'rested-cost', 'all-rested', 'source-rested', 'opponent-turn', 'outside-main', 'used', 'source-support', 'attack', 'attack-few', 'attack-wrong', 'attack-rested-energy', 'attack-rested-source', 'deploy']
const extras = ['zero', 'cancel-cost', 'cancel-target', 'back-cost', 'deselect-cost', 'cost-max', 'target-max', 'target-switch', 'target-deselect', 'recover-blue', 'recover-yellow', 'cost-blue', 'cost-item', 'cost-stage', 'same-cookie-blue', 'empty-trash-zero', 'cancel-attack-payment', 'cancel-attack-target']
const cases = [...fixtures, ...extras]
const blocked = ['no-support', 'opponent-turn', 'outside-main', 'used', 'source-support']
const route = s => s === 'same-cookie-blue' || s === 'empty-trash-zero' ? 'empty-trash' : s.startsWith('cancel-attack') ? 'attack' : fixtures.includes(s) ? s : 'positive'
const readState = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return { deck: Number(field.querySelector('.deck-zone .resource-summary>strong')?.textContent), trash: Number(field.querySelector('.discard-zone.resource-summary>strong')?.textContent), hand: field.querySelectorAll('.hand-card').length,
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
  for (const number of ['BS12-054', 'BS12-054@1']) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const row = { number, scenario, viewport, scope: 'candidate-printed-any-support-trash-optional-any-Cookie-rested-recovery-GGN-ordinary', status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = suffix => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${suffix}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route=>route.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp'))}))
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && route(scenario) === 'positive' ? 'card:'+number : process.env.BS12_BROWSER_ROUTE === 'generic' && route(scenario) === 'no-support' ? 'card-negative:'+number : 'bs12-054:'+number+':'+route(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-001,BS12-003,BS12-005,BS12-007,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-017,BS12-019,BS12-024,BS12-028,BS12-029,BS12-030,BS12-031,BS12-038,BS12-039,BS12-041,BS12-044,BS12-046,BS12-048,BS12-050,BS12-051,BS12-053,BS12-054,BS12-054@1,BS12-055,BS12-055@1,BS12-056,BS12-056@1,BS12-057,BS12-058,BS12-058@1,BS12-067,BS12-068,BS4-095,BS6-008,BS6-010,BS9-014,ST4-001')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      row.before = await readState(page); row.beforeTrace = await trace(page)
      const wrap = page.locator('[data-card-instance-id="bs12-054-source"]')
      const image = wrap.locator('img[alt="Mint Choco Cookie"]').first()
      await image.evaluate(i => i.decode())
      assert.equal(await image.getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
      if (scenario === 'deploy') {
        await wrap.locator('button.card-face').click()
        await wrap.getByRole('button', { name: '登場', exact: true }).click()
        await page.waitForFunction(() => document.querySelector('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-054-source"]'))
        await settle(page)
        const after = await readState(page)
        assert.deepEqual(after.bottom.battle.map(c => c.hp), [2, 4]); assert.equal(after.bottom.deck, 8)
        assert.deepEqual((await trace(page)).map(e => e.commandKind), ['deploy-cookie'])
      } else if (scenario.startsWith('attack') || scenario.startsWith('cancel-attack')) {
        const source = wrap.locator('button.card-face:not(.hp-card)')
        if (scenario !== 'attack' && !scenario.startsWith('cancel-attack')) {
          assert.equal(await source.locator(':scope.is-attackable').count(), 0)
          assert.deepEqual(await readState(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
        } else {
          await source.click()
          if (scenario !== 'cancel-attack-payment') for (let i = 0; i < 3; i++) await page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="bs12-054-support-${i}"] button.card-face`).click({ position: { x: 10, y: 25 } })
          if (scenario.startsWith('cancel-attack')) {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await readState(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
          } else {
            await page.getByRole('button', { name: '選擇攻擊目標：Sugar Swan Cookie', exact: true }).click()
            await page.waitForFunction(() => document.querySelector('.top-field .combat-card-wrap .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 3 張'))
            await settle(page)
            const after = await readState(page)
            assert.deepEqual(after.top.battle.map(c => c.hp), [3, 3]); assert.equal(after.top.trash, 4)
            assert.deepEqual(after.bottom.support.map(c => c.rested), [true, true, true, false, false])
            assert.deepEqual((await trace(page)).map(e => e.commandKind), ['declare-attack', 'resolve-battle'])
          }
        }
      } else if (blocked.includes(scenario)) {
        const skill = wrap.getByRole('button', { name: '啟動技能', exact: true })
        if (await skill.count()) assert.equal(await skill.isEnabled(), false)
        assert.equal(await page.getByRole('alertdialog').count(), 0)
        assert.deepEqual(await readState(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
      } else {
        await wrap.getByRole('button', { name: '啟動技能', exact: true }).click()
        const panel = page.getByRole('alertdialog')
        const next = panel.getByRole('button', { name: '下一步', exact: true })
        assert.match(await panel.innerText(), /每回合一次/)
        assert.equal(await panel.locator('img[alt="Mint Choco Cookie"]').getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
        assert.equal(await next.isEnabled(), false)
        const names = ['Basil Pesto Cookie', 'Greenbell Cookie', 'Candy Diver Cookie', 'Wonderful Melody', 'Orchestra Hall']
        let costIndex = ['cost-blue', 'same-cookie-blue'].includes(scenario) ? 2 : scenario === 'cost-item' ? 3 : scenario === 'cost-stage' ? 4 : 0
        if (scenario === 'item-only-support') costIndex = 0
        const costName = scenario === 'item-only-support' ? names[3] : names[costIndex]
        const choice = name => panel.getByRole('button', { name: new RegExp(`^${name} ${name}`) })
        assert.equal(await panel.locator('.effect-candidates .effect-candidate-entry>button').count(), row.before.bottom.support.length)
        await choice(costName).click()
        if (scenario === 'deselect-cost') { await choice(costName).click(); assert.equal(await next.isEnabled(), false); await choice(costName).click() }
        if (scenario === 'cost-max') { assert.equal(await choice(names[1]).count(), 0); assert.match(await panel.innerText(), /已選 1／1 張支援區代價/); assert.equal(await next.isEnabled(), true) }
        if (scenario === 'cancel-cost') {
          await panel.getByRole('button', { name: '取消技能', exact: true }).click()
          assert.deepEqual(await readState(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
        } else {
          await next.click()
          assert.match(await panel.innerText(), /棄牌區.*餅乾.*疲勞狀態放入支援區/)
          const cookieCost = scenario !== 'item-only-support' && costIndex <= 2
          const originalCount = route(scenario) === 'empty-trash' || scenario === 'item-trash' ? 0 : 3
          const options = panel.locator('.effect-candidates .effect-candidate-entry>button')
          assert.equal(await options.count(), originalCount + (cookieCost ? 1 : 0))
          assert.equal(await choice('Wonderful Melody').count(), 0); assert.equal(await choice('Orchestra Hall').count(), 0)
          let targetId = ['zero', 'empty-trash-zero', 'target-deselect'].includes(scenario) ? null : ['empty-trash', 'item-trash', 'same-cookie-blue'].includes(scenario) ? `bs12-054-support-${costIndex}` : scenario === 'recover-blue' ? 'bs12-054-trash-1' : scenario === 'recover-yellow' ? 'bs12-054-trash-2' : 'bs12-054-trash-0'
          let targetName = ['empty-trash', 'item-trash', 'same-cookie-blue'].includes(scenario) ? costName : scenario === 'recover-blue' ? 'Candy Diver Cookie' : scenario === 'recover-yellow' ? 'GingerBrave' : 'Melon Soda Cookie'
          if (scenario === 'back-cost') {
            await choice('Basil Pesto Cookie').click()
            await panel.getByRole('button', { name: '上一步', exact: true }).click()
            await choice(names[0]).click(); await choice(names[3]).click(); costIndex = 3
            await next.click()
            assert.equal(await choice('Basil Pesto Cookie').count(), 0); assert.match(await panel.innerText(), /已選 0／1/)
          }
          if (targetId) await choice(targetName).click()
          if (scenario === 'target-deselect') { await choice('Melon Soda Cookie').click(); await choice('Melon Soda Cookie').click() }
          if (scenario === 'target-max') { await choice('Candy Diver Cookie').click(); assert.equal(await panel.locator('.effect-candidates .effect-candidate-entry>button.is-selected').count(), 1) }
          if (scenario === 'target-switch') { await choice('Melon Soda Cookie').click(); await choice('Candy Diver Cookie').click(); targetId = 'bs12-054-trash-1'; targetName = 'Candy Diver Cookie' }
          assert.deepEqual(await readState(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
          await shot('targets')
          if (scenario === 'cancel-target') {
            await panel.getByRole('button', { name: '取消技能', exact: true }).click()
            assert.deepEqual(await readState(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
          } else {
            await panel.getByRole('button', { name: '確認發動', exact: true }).click()
            await page.waitForFunction(() => !document.querySelector('.effect-panel:not(.is-complete)'))
            await settle(page)
            const after = await readState(page)
            assert.deepEqual(after.bottom.support, [...row.before.bottom.support.filter((_, i) => i !== costIndex), ...(targetId ? [{ id: targetId, rested: true }] : [])])
            assert.equal(after.bottom.trash, row.before.bottom.trash + 1 - (targetId ? 1 : 0))
            assert.deepEqual(after.bottom.battle, row.before.bottom.battle); assert.equal(after.bottom.hand, row.before.bottom.hand); assert.equal(after.bottom.deck, row.before.bottom.deck); assert.deepEqual(after.top, row.before.top)
            assert.equal(await wrap.getByRole('button', { name: '啟動技能', exact: true }).isEnabled(), false)
            const receipt = await trace(page)
            assert.deepEqual(receipt.map(e => e.commandKind), ['begin-activate-skill', 'resolve-ability-effect'])
            assert.ok(receipt[0].steps.some(s => s.includes('支援區') && s.includes('棄牌區')))
            assert.ok(receipt[1].steps.some(s => targetId ? s.includes(`1 張卡移入支援區（疲勞）：${targetName}`) : s.includes('選擇 0 張，此段未移動卡牌')))
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
      await shot('result'); row.status = 'PASS'; console.log(`PASS ${number} ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { row.error = String(error.stack ?? error); row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { rows.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)); await page.close() }
  }
  console.log(`BS12-054 Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
