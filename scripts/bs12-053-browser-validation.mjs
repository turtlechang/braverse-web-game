import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-053-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/cards/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const cases = ['response', 'response-rested-source', 'response-other', 'response-no-support', 'response-rested-support', 'response-used', 'cost-item', 'cost-blue', 'cost-green-other', 'cost-deselect', 'cost-max', 'cost-back', 'response-zero', 'response-target-other', 'response-target-max', 'response-target-switch', 'response-skip-afterdraft', 'attack', 'attack-active-fifth', 'attack-rested-fifth', 'attack-few', 'attack-wrong', 'attack-rested-energy', 'attack-rested-source', 'attack-source-support', 'attack-target-faint', 'attack-other-faint', 'attack-cancel-payment', 'attack-cancel-target', 'attack-reverse-order', 'attack-flip']
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
  for (const number of ['BS12-053', 'BS12-053@1']) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const row = { number, scenario, viewport, printedSourceAttested: scenario !== 'response-used', scope: scenario === 'response-used' ? 'isolated-once-used-flag-with-printed-cards' : 'candidate-printed-attack-response-support-trash-and-GGGN-ordinary-then-all-opponents', status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${label}.png`) })
    try {
      const attack = scenario.startsWith('attack')
      const fixture = attack ? ['attack-cancel-payment', 'attack-cancel-target', 'attack-reverse-order'].includes(scenario) ? 'attack' : scenario
        : ['response', 'response-rested-source', 'response-other', 'response-no-support', 'response-rested-support', 'response-used'].includes(scenario) ? scenario : 'response'
      for (const card of cards) await page.route(card.imageUrl, route=>route.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp'))}))
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'response' ? 'card:'+number : process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'response-no-support' ? 'card-negative:'+number : 'bs12-053:'+number+':'+fixture
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-001,BS12-003,BS12-005,BS12-006,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-019,BS12-022,BS12-028,BS12-029,BS12-030,BS12-031,BS12-038,BS12-039,BS12-041,BS12-044,BS12-046,BS12-048,BS12-049,BS12-050,BS12-051,BS12-052,BS12-053,BS12-055,BS12-070,BS6-008,BS7-055,BS7-061,ST3-001,ST4-001,ST4-002,ST4-003,ST4-004,ST4-005')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      row.before = await readState(page)
      const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-053-source"]')
      const sourceImage = fixture === 'attack-source-support' ? page.locator('.bottom-field .support-card-wrap[data-card-instance-id="bs12-053-source"] img') : source.locator('img').first()
      await sourceImage.evaluate(i => i.decode())
      assert.equal(await sourceImage.getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
      const panel = page.getByRole('alertdialog')
      if (!attack) {
        if (['response-no-support', 'response-used'].includes(scenario)) {
          await page.waitForFunction(() => document.querySelector('.bottom-field [data-card-instance-id="bs12-053-source"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 2 張'))
          assert.equal(await page.getByRole('heading', { name: '發動攻擊回應技能' }).count(), 0)
          assert.deepEqual((await readState(page)).bottom.support, row.before.bottom.support)
          assert.equal((await trace(page)).filter(e => e.commandKind === 'play-attack-response').length, 0)
        } else {
          await panel.getByRole('button', { name: 'Kumiho Cookie Kumiho Cookie', exact: true }).click()
          const confirm = panel.getByRole('button', { name: '支付代價並發動', exact: true })
          assert.equal(await confirm.isEnabled(), false)
          const costs = panel.locator('.attack-response-support-trash-candidates>button')
          assert.equal(await costs.count(), 4)
          const index = scenario === 'cost-item' ? 2 : scenario === 'cost-blue' ? 3 : scenario === 'cost-green-other' ? 1 : 0
          await costs.nth(index).click()
          if (scenario === 'cost-deselect') { await costs.nth(index).click(); assert.equal(await confirm.isEnabled(), false); await costs.nth(index).click() }
          if (scenario === 'cost-max') { await costs.nth(1).click(); assert.equal(await panel.locator('.attack-response-support-trash-candidates>button.is-selected').count(), 1) }
          if (scenario === 'cost-back') {
            await panel.getByRole('button', { name: '返回回應選擇', exact: true }).click()
            assert.deepEqual(await readState(page), row.before)
            await panel.getByRole('button', { name: 'Kumiho Cookie Kumiho Cookie', exact: true }).click()
            assert.equal(await confirm.isEnabled(), false)
            await costs.nth(index).click()
          }
          assert.deepEqual(await readState(page), row.before)
          await shot('cost')
          if (scenario === 'response-skip-afterdraft') {
            await panel.getByRole('button', { name: '略過此回應', exact: true }).click()
            await page.waitForFunction(() => document.querySelector('.bottom-field [data-card-instance-id="bs12-053-source"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 2 張'))
            assert.deepEqual((await readState(page)).bottom.support, row.before.bottom.support)
            assert.equal((await trace(page)).filter(e => e.commandKind === 'play-attack-response').length, 0)
          } else {
            await confirm.click()
            await panel.getByText('攻擊回應技能效果', { exact: true }).waitFor()
            row.paid = await readState(page)
            assert.deepEqual(row.paid.bottom.battle, row.before.bottom.battle)
            assert.equal(row.paid.bottom.support.length, 3)
            assert.equal(row.paid.bottom.trash, 1)
            assert.equal(await panel.getByText('對手攻擊時', { exact: true }).count(), 1)
            assert.equal(await panel.getByText('每回合一次', { exact: true }).count(), 1)
            const target = i => panel.getByRole('button', { name: i === 0 ? /^Langue de Chat Cookie Langue de Chat Cookie AI/ : /^Candy Diver Cookie Candy Diver Cookie AI/ })
            let targetIndex = scenario === 'response-zero' ? null : scenario === 'response-target-other' ? 1 : 0
            if (targetIndex !== null) await target(targetIndex).click()
            if (scenario === 'response-target-max') { await target(1).click(); assert.equal(await panel.locator('.effect-candidate-entry>button.is-selected').count(), 1) }
            if (scenario === 'response-target-switch') { await target(0).click(); await target(1).click(); targetIndex = 1 }
            assert.deepEqual((await readState(page)).bottom.battle, row.before.bottom.battle)
            await shot('target-before-damage')
            await panel.getByRole('button', { name: '確認發動', exact: true }).click()
            const initialHp = row.before.bottom.battle.find(c=>c.id===(scenario==='response-other'?'bs12-053-ally':'bs12-053-source')).hp
            const finalHp = initialHp - (targetIndex === 0 ? 2 : 4)
            const damagedId = scenario === 'response-other' ? 'bs12-053-ally' : 'bs12-053-source'
            await page.waitForFunction(({ id, hp }) => document.querySelector(`.bottom-field [data-card-instance-id="${id}"] .hp-card-stack`)?.getAttribute('aria-label')?.includes(`HP 卡 ${hp} 張`), { id: damagedId, hp: finalHp })
            assert.equal((await readState(page)).bottom.trash, 1 + initialHp - finalHp)
            assert.equal((await trace(page)).filter(e => e.commandKind === 'play-attack-response').length, 1)
            assert.equal((await trace(page)).filter(e => e.commandKind === 'resolve-ability-effect').length, 1)
            assert.equal(await panel.count(), 0)
          }
        }
      } else {
        if (['attack-few', 'attack-wrong', 'attack-rested-energy', 'attack-rested-source', 'attack-source-support'].includes(scenario)) {
          assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
          assert.deepEqual(await readState(page), row.before)
          assert.deepEqual(await trace(page), [])
        } else {
          await source.locator('.card-face.is-attackable').click()
          if (scenario !== 'attack-cancel-payment') for (let i = 0; i < 4; i++) {
            if (i < 3) assert.equal(await page.getByRole('button', { name: '選擇攻擊目標：Sugar Swan Cookie', exact: true }).count(), 0)
            await page.locator(`.bottom-field [data-card-instance-id="bs12-053-support-${i}"] .card-face`).click({ position: { x: 10, y: 25 } })
          }
          if (scenario.startsWith('attack-cancel')) {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await readState(page), row.before)
            assert.deepEqual(await trace(page), [])
          } else {
            await page.getByRole('button', { name: '選擇攻擊目標：Sugar Swan Cookie', exact: true }).click()
            if (scenario === 'attack-active-fifth') {
              await page.waitForFunction(() => document.querySelector('.top-field [data-card-instance-id="bs12-044-opponent"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 3 張'))
              await settle(page)
              assert.deepEqual((await readState(page)).top.battle.map(c => c.hp), [3, 3])
              assert.equal(await panel.count(), 0)
            } else {
              await panel.getByText('攻擊後續效果', { exact: true }).first().waitFor()
              row.ordinary = await readState(page)
              assert.deepEqual(row.ordinary.top.battle.map(c => c.hp), scenario === 'attack-target-faint' ? [3] : scenario === 'attack-other-faint' ? [3, 1] : [3, 3])
              const targets = panel.locator('.effect-candidate-entry>button')
              const count = scenario === 'attack-target-faint' ? 1 : 2
              assert.equal(await targets.count(), count)
              assert.equal(await panel.getByRole('button', { name: '確認發動', exact: true }).isEnabled(), false)
              for (const i of scenario === 'attack-reverse-order' ? [1, 0] : count === 1 ? [0] : [0, 1]) {
                await targets.nth(i).click()
                if (count === 2 && await panel.locator('.effect-candidate-entry>button.is-selected').count() === 1) assert.equal(await panel.getByRole('button', { name: '確認發動', exact: true }).isEnabled(), false)
              }
              await shot('all-targets')
              await panel.getByRole('button', { name: '確認發動', exact: true }).click()
              if (scenario === 'attack-flip') {
                // Opponent AI declines the actual revealed printed HP FLIP; trace must still include its reveal and response.
                await page.waitForFunction(() => (window.__braverseContractTrace ?? []).some(e => e.commandKind === 'resolve-flip'))
              }
              await page.waitForFunction(({ faint }) => {
                const b = [...document.querySelectorAll('.top-field .combat-card-wrap')]
                return b.length === (faint ? 1 : 2) && b.every(n => n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 2 張'))
              }, { faint: ['attack-target-faint', 'attack-other-faint'].includes(scenario) })
              assert.equal(await panel.count(), 0)
              assert.equal((await readState(page)).bottom.battle[0].hp, 6)
            }
            assert.equal((await readState(page)).bottom.support.slice(0, 4).every(c => c.rested), true)
            assert.equal((await trace(page)).filter(e => e.commandKind === 'declare-attack').length, 1)
          }
        }
      }
      await settle(page)
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
  console.log(`BS12-053 Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
