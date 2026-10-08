import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-045-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const cases = ['five', 'four', 'six', 'zero', 'all-rested', 'non-arena', 'opponent-only', 'battle-only', 'support-five', 'support-four', 'parent-zero', 'cancel-parent', 'deselect-parent', 'draw-zero', 'skip-draw', 'change-draw', 'skip-on-play', 'short-deck', 'last-deck', 'refresh-lv10', 'attack', 'attack-red', 'attack-wrong', 'attack-few', 'attack-rested', 'attack-rested-source', 'cancel-attack']
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return { hand: field.querySelectorAll('.hand-card').length, deck: Number(field.querySelector('.deck-zone .resource-summary > strong')?.textContent), trash: Number(field.querySelector('.discard-zone.resource-summary > strong')?.textContent),
      breakLevel: Number(field.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1]),
      support: [...field.querySelectorAll('.support-card-wrap')].map(node => node.querySelector('.card-face').classList.contains('is-rested')),
      battle: [...field.querySelectorAll('.combat-card-wrap')].map(node => ({ id: node.getAttribute('data-card-instance-id'), rested: node.querySelector('.card-face').classList.contains('is-rested'), hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]) })) }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, summary: e.summary, steps: e.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]'), null, { timeout: 20000 })
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const rows = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const isolated = scenario === 'isolated-opponent-turn'
    const row = { number: 'BS12-045', scenario, viewport, scope: isolated ? 'isolated-on-play-opponent-turn' : 'candidate-printed-045-on-play-draw-ordinary', printedSourceAttested: !isolated, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = suffix => page.screenshot({ path: resolve(out, `BS12-045-${scenario}-${viewport.width}-${suffix}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route=>route.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp'))}))
      const parentCase = ['support-five', 'support-four', 'parent-zero', 'cancel-parent', 'deselect-parent'].includes(scenario)
      const fixture = ['parent-zero', 'cancel-parent', 'deselect-parent'].includes(scenario) ? 'support-five' : ['draw-zero', 'skip-draw', 'change-draw', 'skip-on-play'].includes(scenario) ? 'five' : ['cancel-attack', 'attack-red'].includes(scenario) ? 'attack' : isolated ? 'opponent-turn' : scenario
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'five' ? 'card:BS12-045' : process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'four' ? 'card-negative:BS12-045' : 'bs12-045:'+fixture
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-045,BS12-001,BS12-003,BS12-005,BS12-006,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-028,BS12-029,BS12-030,BS12-031,BS12-046,BS12-055,BS6-008,BS7-055,BS7-061,BS8-025,ST4-001,ST4-002,ST4-003,ST4-004,ST4-005')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      row.before = await state(page)
      row.beforeTrace = await trace(page)
      const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-045-source"] button.card-face:not(.hp-card)')
      const attack = scenario.startsWith('attack') || scenario === 'cancel-attack'
      if (attack) {
        if (!['attack', 'attack-red', 'cancel-attack'].includes(scenario)) {
          assert.equal(await source.locator(':scope.is-attackable').count(), 0)
          await source.click()
          assert.equal(await page.getByRole('button', { name: '取消攻擊', exact: true }).count(), 0)
          assert.deepEqual(await state(page), row.before)
          assert.deepEqual(await trace(page), row.beforeTrace)
        } else {
          await source.click()
          const supports = page.locator('.bottom-field .support-card-wrap button.card-face')
          await supports.nth(0).click({ position: { x: 10, y: 25 } })
          await supports.nth(scenario === 'attack-red' ? 2 : 1).click({ position: { x: 10, y: 25 } })
          if (scenario === 'cancel-attack') {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await state(page), row.before)
            assert.deepEqual(await trace(page), row.beforeTrace)
          } else {
            await page.getByRole('button', { name: '選擇攻擊目標：Sugar Swan Cookie', exact: true }).click()
            await page.waitForFunction(() => document.querySelector('.top-field .combat-card-wrap .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 4 張'))
            await settle(page)
            const after = await state(page)
            assert.deepEqual(after.top.battle.map(c => c.hp), [4, 3])
            assert.equal(after.top.trash, 2)
            assert.deepEqual(after.bottom.support, scenario === 'attack-red' ? [true, false, true, false, false] : [true, true, false, false, false])
            assert.equal(after.bottom.battle[0].rested, true)
            assert.deepEqual(after.bottom.deck, row.before.bottom.deck)
            assert.deepEqual((await trace(page)).map(t => t.commandKind), ['declare-attack', 'resolve-battle'])
          }
        }
      } else {
        if (parentCase) {
          await page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-045-deployer"]').getByRole('button', { name: '啟動技能', exact: true }).click()
          const panel = page.getByRole('alertdialog')
          const target = panel.getByRole('button', { name: /^Clover Cookie Clover Cookie/ })
          if (scenario !== 'parent-zero') await target.click()
          if (scenario === 'deselect-parent') await target.click()
          await panel.getByRole('button', { name: scenario === 'cancel-parent' ? '取消技能' : '確認發動', exact: true }).click()
        } else if (!isolated) {
          const hand = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator('img[alt="Clover Cookie"]') })
          await hand.locator('button.card-face').click()
          await hand.getByRole('button', { name: '登場', exact: true }).click()
        }
        if (['parent-zero', 'cancel-parent', 'deselect-parent'].includes(scenario)) {
          assert.deepEqual(await state(page), row.before)
          assert.equal(await source.count(), 0)
          if (scenario === 'cancel-parent') assert.deepEqual(await trace(page), row.beforeTrace)
          else assert.deepEqual((await trace(page)).map(t => t.commandKind), ['begin-activate-skill', 'resolve-ability-effect'])
        } else {
          if (scenario === 'short-deck') await page.getByRole('alertdialog').getByRole('button', { name: /^Candy Diver Cookie Candy Diver Cookie/ }).click()
          await source.waitFor()
          await settle(page)
          row.entered = await state(page)
          assert.deepEqual(row.entered.bottom.battle.map(c => c.hp), [parentCase ? 5 : 2, 2])
          assert.equal(row.entered.bottom.deck, scenario === 'short-deck' ? 4 : ['last-deck', 'refresh-lv10'].includes(scenario) ? 1 : 10)
          const falseCondition = ['four', 'zero', 'opponent-only', 'battle-only', 'support-four'].includes(scenario)
          if (falseCondition) {
            assert.equal(await page.getByRole('alertdialog').count(), 0)
            assert.equal(row.entered.bottom.hand, 0)
          } else {
            const panel = page.getByRole('alertdialog')
            assert.match(await panel.innerText(), /最多抽 1 張牌/)
            await shot('on-play')
            await panel.getByRole('button', { name: scenario === 'skip-on-play' ? '略過整個登場效果' : '確認發動', exact: true }).click()
            const count = ['draw-zero', 'skip-draw', 'skip-on-play'].includes(scenario) ? 0 : 1
            if (scenario !== 'skip-on-play') {
              const drawPanel = page.locator('.draw-up-to-modal:visible')
              await drawPanel.waitFor()
              assert.equal(await drawPanel.locator('.draw-up-to-option').count(), 2)
              if (scenario === 'change-draw') {
                await drawPanel.getByRole('button', { name: /^抽 1 張/ }).click()
                await drawPanel.getByRole('button', { name: '不抽', exact: true }).click()
                assert.deepEqual(await state(page), row.entered)
              }
              if (scenario !== 'skip-draw') await drawPanel.getByRole('button', { name: count ? /^抽 1 張/ : '不抽', exact: count === 0 }).click()
              await drawPanel.getByRole('button', { name: count ? '抽取 1 張牌' : '略過抽牌', exact: true }).click()
              if (['last-deck', 'refresh-lv10'].includes(scenario)) await page.getByRole('alertdialog').getByRole('button', { name: /^Candy Diver Cookie Candy Diver Cookie/ }).click()
            }
            await settle(page)
            const after = await state(page)
            assert.equal(after.bottom.hand, count)
            assert.equal(after.bottom.deck, ['last-deck', 'refresh-lv10'].includes(scenario) ? 5 : row.entered.bottom.deck - count)
            assert.deepEqual(after.bottom.battle, row.entered.bottom.battle)
            assert.deepEqual(after.bottom.support, row.entered.bottom.support)
            assert.equal(after.bottom.trash, 0)
            assert.equal(after.bottom.breakLevel, scenario === 'refresh-lv10' ? 11 : ['last-deck', 'short-deck'].includes(scenario) ? 2 : 0)
            if (scenario === 'refresh-lv10') {
              await page.getByRole('heading', { name: 'AI 對手勝利', exact: true }).waitFor()
              assert.match(await page.locator('body').innerText(), /我方休息區的等級達到 10/)
            } else assert.equal(await page.getByRole('alertdialog').count(), 0)
            const kinds = (await trace(page)).slice(row.beforeTrace.length).map(t => t.commandKind)
            if (scenario === 'skip-on-play') assert.deepEqual(kinds, ['deploy-cookie', 'skip-on-play'])
            else {
              assert.equal(kinds.filter(k => k === 'begin-activate-skill').length, parentCase ? 2 : 1)
              assert.equal(kinds.filter(k => k === 'resolve-draw-up-to').length, 1)
              assert.equal(kinds.filter(k => k === 'refresh-deck').length, ['short-deck', 'last-deck', 'refresh-lv10'].includes(scenario) ? 1 : 0)
            }
          }
          assert.deepEqual((await state(page)).top, row.before.top)
          if (parentCase) assert.equal((await state(page)).bottom.support.length, row.before.bottom.support.length - 1)
          else assert.deepEqual((await state(page)).bottom.support, row.before.bottom.support)
        }
      }
      const art = page.locator(`.bottom-field img[src="${cards.find(c => c.cardNumber === 'BS12-045').imageUrl}"]`).first()
      await art.evaluate(img => img.decode())
      row.after = await state(page)
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
      console.log(`PASS BS12-045 ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { row.error = String(error.stack ?? error); row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { rows.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)); await page.close() }
  }
  console.log(`BS12-045 printed Browser ${rows.filter(r => r.printedSourceAttested).length}; isolated ${rows.filter(r => !r.printedSourceAttested).length}`)
} finally { await browser.close() }
