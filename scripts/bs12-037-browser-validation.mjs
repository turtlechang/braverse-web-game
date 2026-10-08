import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-037-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,`test-results/bs12-official-art/${card.cardNumber}.webp`)))
const cases = ['four', 'zero', 'three', 'five', 'seven', 'eight', 'mixed-colors', 'non-arena', 'high-level', 'opponent-break', 'trash-arena', 'support-arena', 'source-rested', 'skill-zero', 'skill-other', 'cancel-skill', 'back-skill', 'wrong-energy', 'no-energy', 'rested-energy', 'opponent-turn', 'outside-main', 'used', 'deploy', 'attack', 'then-other', 'then-zero', 'skip-then', 'back-then', 'deselect-then', 'attack-three-energy', 'attack-wrong', 'attack-rested', 'target-faints', 'cancel-attack']
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
  for (const number of ['BS12-037', 'BS12-037@1']) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const row = { number, scenario, viewport, scope: 'candidate-printed-037-skill-attack-then', status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = suffix => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${suffix}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl,route=>route.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,`test-results/bs12-official-art/${card.cardNumber}.webp`))}))
      const attack = ['attack', 'then-other', 'then-zero', 'skip-then', 'back-then', 'deselect-then', 'attack-three-energy', 'attack-wrong', 'attack-rested', 'target-faints', 'cancel-attack'].includes(scenario)
      const fixture = ['then-other', 'then-zero', 'skip-then', 'back-then', 'deselect-then', 'cancel-attack'].includes(scenario) ? 'attack' : ['skill-zero', 'skill-other', 'cancel-skill', 'back-skill'].includes(scenario) ? 'four' : scenario
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'four' ? `card:${number}` : process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'wrong-energy' ? `card-negative:${number}` : `${number.toLowerCase()}:${fixture}`
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${row.testState}&contract-card=BS12-037,BS6-008,BS12-008,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-028,BS12-029,BS12-030,BS12-031,BS12-046`)
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      row.before = await state(page)
      row.beforeTrace = await trace(page)
      let source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-037-source"] button.card-face:not(.hp-card)')
      if (scenario === 'deploy') {
        const hand = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator('img[alt="Financier Cookie"]') })
        await hand.locator('button.card-face').click()
        await hand.getByRole('button', { name: '登場', exact: true }).click()
        await source.waitFor()
        await settle(page)
        const after = await state(page)
        assert.deepEqual(after.bottom.battle.map(c => c.hp), [2, 5])
        assert.equal(after.bottom.hand, 0)
        assert.equal(after.bottom.deck, 7)
        assert.deepEqual(after.bottom.support, row.before.bottom.support)
        assert.deepEqual(after.top, row.before.top)
        assert.deepEqual((await trace(page)).map(e => e.commandKind), ['deploy-cookie'])
      } else if (attack) {
        if (['attack-wrong', 'attack-rested'].includes(scenario)) {
          assert.equal(await source.locator(':scope.is-attackable').count(), 0)
          await source.click()
          assert.equal(await page.getByRole('button', { name: '取消攻擊', exact: true }).count(), 0)
          assert.deepEqual(await state(page), row.before)
          assert.deepEqual(await trace(page), row.beforeTrace)
        } else {
          await source.click()
          const supports = page.locator('.bottom-field .support-card-wrap button.card-face')
          for (let i = 0; i < 3; i++) await supports.nth(i).click({ position: { x: 10, y: 25 } })
          if (scenario === 'cancel-attack') {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await state(page), row.before)
            assert.deepEqual(await trace(page), row.beforeTrace)
          } else {
            await page.getByRole('button', { name: `選擇攻擊目標：${scenario === 'target-faints' ? 'Shiningberry Cookie' : 'Sugar Swan Cookie'}`, exact: true }).click()
            const modal = page.locator('.optional-cost-attack-inline:visible, .optional-cost-attack-modal:visible')
            await modal.waitFor()
            await settle(page)
            row.ordinary = await state(page)
            assert.deepEqual(row.ordinary.top.battle.map(c => c.hp), scenario === 'target-faints' ? [3] : [3, 3])
            assert.deepEqual(row.ordinary.bottom.support, [true, true, true, ...(scenario === 'attack-three-energy' ? [] : [false])])
            if (scenario === 'skip-then' || scenario === 'attack-three-energy') {
              if (scenario === 'attack-three-energy') assert.equal(await modal.getByRole('button', { name: '支付', exact: true }).isEnabled(), false)
              await modal.getByRole('button', { name: '略過', exact: true }).click()
              assert.deepEqual(await state(page), row.ordinary)
            } else {
              await modal.getByRole('button', { name: '支付', exact: true }).click()
              const energy = modal.getByRole('button', { name: /^Candy Diver Cookie Candy Diver Cookie/ })
              const next = modal.getByRole('button', { name: '下一步', exact: true })
              assert.equal(await next.isEnabled(), false)
              assert.equal(await modal.locator('.modal-card-options > button').count(), 1)
              await energy.click()
              if (scenario === 'deselect-then') { await energy.click(); assert.equal(await next.isEnabled(), false); await energy.click() }
              await next.click()
              if (scenario === 'back-then') { await modal.getByRole('button', { name: '上一步', exact: true }).click(); await next.click() }
              const targets = modal.locator('.modal-card-options > button')
              assert.equal(await targets.count(), scenario === 'target-faints' ? 1 : 2)
              const other = scenario === 'then-other' || scenario === 'target-faints'
              if (scenario !== 'then-zero') await targets.filter({ hasText: other ? 'Candy Diver Cookie' : 'Sugar Swan Cookie' }).click()
              assert.deepEqual(await state(page), row.ordinary)
              await shot('then-target')
              await modal.getByRole('button', { name: '確認', exact: true }).click()
              await page.waitForFunction(() => !document.querySelector('.optional-cost-attack-inline, .optional-cost-attack-modal'))
              await settle(page)
              const after = await state(page)
              assert.deepEqual(after.top.battle.map(c => c.hp), scenario === 'target-faints' ? [2] : scenario === 'then-zero' ? [3, 3] : other ? [3, 2] : [2, 3])
              assert.deepEqual(after.bottom, { ...row.ordinary.bottom, support: [true, true, true, true] })
              assert.equal(after.top.trash, scenario === 'then-zero' ? 3 : 4)
            }
          }
        }
      } else {
        const skill = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-037-source"]').getByRole('button', { name: '啟動技能', exact: true })
        if (['wrong-energy', 'no-energy', 'rested-energy', 'opponent-turn', 'outside-main', 'used'].includes(scenario)) {
          if (await skill.count()) assert.equal(await skill.isEnabled(), false)
          assert.deepEqual(await state(page), row.before)
          assert.deepEqual(await trace(page), row.beforeTrace)
        } else {
          await skill.click()
          const panel = page.getByRole('alertdialog')
          await panel.waitFor()
          const next = panel.getByRole('button', { name: '下一步', exact: true })
          assert.equal(await next.isEnabled(), false)
          assert.equal(await panel.getByRole('button', { name: /^Candy Diver Cookie Candy Diver Cookie/ }).count(), 0)
          await panel.getByRole('button', { name: /^GingerBrave GingerBrave/ }).first().click()
          await next.click()
          assert.match(await panel.innerText(), /目前休息區每 4 張【Arena】餅乾造成 1 點傷害/)
          assert.equal(await panel.getByRole('button', { name: /^(Sugar Swan Cookie Sugar Swan Cookie|Candy Diver Cookie Candy Diver Cookie)/ }).count(), 2)
          if (scenario === 'back-skill') { await panel.getByRole('button', { name: '上一步', exact: true }).click(); await next.click() }
          if (scenario === 'cancel-skill') {
            await panel.getByRole('button', { name: '取消技能', exact: true }).click()
            assert.deepEqual(await state(page), row.before)
            assert.deepEqual(await trace(page), row.beforeTrace)
          } else {
            if (scenario !== 'skill-zero') await panel.getByRole('button', { name: scenario === 'skill-other' ? /^Candy Diver Cookie Candy Diver Cookie/ : /^Sugar Swan Cookie Sugar Swan Cookie/ }).click()
            await panel.getByRole('button', { name: '確認發動', exact: true }).click()
            await page.waitForFunction(() => !document.querySelector('.effect-panel:not(.is-complete)'))
            await settle(page)
            const after = await state(page)
            const zero = ['zero', 'three', 'non-arena', 'high-level', 'opponent-break', 'trash-arena', 'support-arena', 'skill-zero'].includes(scenario)
            const amount = zero ? 0 : scenario === 'eight' ? 2 : 1
            assert.deepEqual(after.top.battle.map(c => c.hp), scenario === 'skill-other' ? [6, 2] : [6 - amount, 3])
            assert.equal(after.top.trash, amount)
            assert.deepEqual(after.bottom, { ...row.before.bottom, support: [true, false, false, false] })
            assert.equal(await skill.isEnabled(), false)
            const records = await trace(page)
            assert.equal(records.filter(e => e.commandKind === 'begin-activate-skill').length, 1)
            assert.equal(records.filter(e => e.commandKind === 'resolve-ability-effect').length, 1)
            assert.match(records.flatMap(e => [e.summary, ...e.steps]).join(' '), amount === 0 ? /未造成傷害|未選擇/ : new RegExp(`(?:受到|造成) ${amount} 點傷害`))
          }
        }
      }
      await source.locator('img').evaluate(img => img.decode())
      assert.equal(await source.locator('img').getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
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
      console.log(`PASS ${number} ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { row.error = String(error.stack ?? error); row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { rows.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)); await page.close() }
  }
  console.log(`BS12-037 printed Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
