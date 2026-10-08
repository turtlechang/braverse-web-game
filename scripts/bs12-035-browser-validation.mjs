import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-035-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/candidates/official-festival-arena-bs12.en.json'), 'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,`test-results/bs12-official-art/${card.cardNumber}.webp`)))
const cases = ['positive', 'zero-target', 'other-target', 'draw-zero', 'peach-cost', 'skip', 'cancel-cost', 'back-energy', 'deselect-cost', 'wrong-energy', 'no-energy', 'rested-energy', 'no-cost', 'opponent-turn', 'break-nine', 'attack', 'attack-rested', 'cancel-attack']
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return { hand: field.querySelectorAll('.hand-card').length, deck: Number(field.querySelector('.deck-zone .resource-summary > strong')?.textContent),
      trash: Number(field.querySelector('.discard-zone.resource-summary > strong')?.textContent), breakLevel: Number(field.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1]),
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
  for (const number of ['BS12-035', 'BS12-035@1']) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => s !== 'draw-zero' && (!process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s)))) {
    const page = await browser.newPage({ viewport })
    const row = { number, scenario, viewport, scope: 'printed-035-OnPlay-and-ordinary-with-Sugar-Swan-6HP', status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = suffix => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${suffix}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl,r=>r.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,`test-results/bs12-official-art/${card.cardNumber}.webp`))}))
      const attack = ['attack', 'attack-rested', 'cancel-attack'].includes(scenario)
      const fixture = attack ? scenario === 'attack-rested' ? scenario : 'attack' : ['peach-cost', 'wrong-energy', 'no-energy', 'rested-energy', 'no-cost', 'opponent-turn', 'break-nine'].includes(scenario) ? scenario : 'peach-cost'
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'peach-cost' ? `card:${number}` : process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'no-cost' ? `card-negative:${number}` : `${number.toLowerCase()}:${fixture}`
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${row.testState}&contract-card=BS12-035,BS12-004,BS12-033,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-028,BS12-029,BS12-030,BS12-031,BS12-046,bs12-032-opponent-hp-5,bs12-032-opponent-other-hp-2`)
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      row.before = await state(page)
      if (attack) {
        const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-035-source"] button.card-face:not(.hp-card)')
        await source.locator('img').evaluate(img => img.decode())
        assert.equal(await source.locator('img').getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
        await source.click()
        if (scenario === 'attack-rested') {
          assert.equal(await page.getByRole('button', { name: '取消攻擊', exact: true }).count(), 0)
          assert.deepEqual(await state(page), row.before)
        } else {
          await page.locator('.bottom-field .support-card-wrap button.card-face').click()
          if (scenario === 'cancel-attack') {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await state(page), row.before)
          } else {
            await page.getByRole('button', { name: '選擇攻擊目標：Sugar Swan Cookie', exact: true }).click()
            await settle(page)
            await page.waitForFunction(() => document.querySelector('.top-field .combat-card-wrap .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 5 張'))
            const after = await state(page)
            assert.deepEqual(after.top.battle.map(c => c.hp), [5, 3])
            assert.equal(after.top.trash, 1)
            assert.deepEqual(after.bottom, { ...row.before.bottom, support: [true], battle: row.before.bottom.battle.map(cookie => ({ ...cookie, rested: cookie.id === 'bs12-035-source' ? true : cookie.rested })) })
            assert.equal(await page.locator('.optional-cost-attack-inline, .draw-up-to-modal').count(), 0)
          }
        }
      } else {
        if (scenario !== 'opponent-turn') {
          const hand = page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-035-source"]')
          await hand.locator('img').evaluate(img => img.decode())
          assert.equal(await hand.locator('img').getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
          await hand.locator('button.card-face').click()
          await hand.getByRole('button', { name: '登場', exact: true }).click()
          await settle(page)
        }
        row.entered = await state(page)
        assert.equal(row.entered.bottom.deck, 12)
        assert.deepEqual(row.entered.bottom.battle.map(c => c.hp), [2, 2])
        const blocked = ['wrong-energy', 'no-energy', 'rested-energy', 'no-cost', 'opponent-turn'].includes(scenario)
        if (blocked) {
          await page.waitForFunction(() => !document.querySelector('.effect-panel:not(.is-complete)'))
          assert.deepEqual(await state(page), row.entered)
          assert.equal((await trace(page)).filter(e => e.commandKind === 'begin-activate-skill').length, 0)
        } else {
          const panel = page.locator('.effect-panel:not(.is-complete)')
          await panel.waitFor()
          assert.match(await panel.innerText(), /Kouign-Amann Cookie/)
          const next = panel.getByRole('button', { name: '下一步', exact: true })
          assert.equal(await next.isEnabled(), false)
          if (scenario === 'skip') await panel.getByRole('button', { name: '略過整個登場效果', exact: true }).click()
          else {
            await panel.getByRole('button', { name: 'GingerBrave GingerBrave 點擊選取', exact: true }).click()
            await next.click()
            const confirm = panel.getByRole('button', { name: '確認發動', exact: true })
            assert.equal(await confirm.isEnabled(), false)
            const cost = panel.getByRole('button', { name: fixture === 'peach-cost' ? /^Peach Cookie Peach Cookie / : /^Espresso Cookie Espresso Cookie / })
            assert.equal(await panel.getByRole('button', { name: /Candy Diver Cookie/ }).count(), 0)
            await cost.click()
            if (scenario === 'deselect-cost') { await cost.click(); assert.equal(await confirm.isEnabled(), false); await cost.click() }
            if (scenario === 'back-energy') { await panel.getByRole('button', { name: '上一步', exact: true }).click(); await next.click(); assert.equal(await cost.getAttribute('aria-pressed'), 'true') }
            // A payment draft can style support as REST, but has not committed any command.
            assert.deepEqual({ ...(await state(page)), bottom: { ...(await state(page)).bottom, support: row.entered.bottom.support } }, row.entered)
            assert.equal((await trace(page)).filter(e => e.commandKind === 'begin-activate-skill').length, 0)
            await shot('cost-selection')
            if (scenario === 'cancel-cost') await panel.getByRole('button', { name: '略過整個登場效果', exact: true }).click()
            else {
              await confirm.click()
              if (scenario === 'break-nine') {
                await page.waitForFunction(() => /勝利|敗北/.test(document.body.innerText))
                const after = await state(page)
                assert.equal(after.bottom.breakLevel, 10)
                assert.equal(after.bottom.deck, 12)
                assert.deepEqual(after.top, row.entered.top)
                assert.equal(await page.locator('.draw-up-to-modal').count(), 0)
              } else {
                await panel.getByRole('button', { name: '確認發動', exact: true }).waitFor()
                if (scenario !== 'zero-target') {
                  await panel.getByRole('button', { name: scenario === 'other-target' ? /Candy Diver Cookie Candy Diver Cookie/ : /Sugar Swan Cookie Sugar Swan Cookie/ }).click()
                }
                await panel.getByRole('button', { name: '確認發動', exact: true }).click()
                const draw = page.locator('.draw-up-to-modal')
                if (fixture !== 'peach-cost') {
                  await draw.waitFor()
                  assert.match(await draw.innerText(), /Espresso Cookie/)
                  const damaged = await state(page)
                  assert.deepEqual(damaged.top.battle.map(c => c.hp), scenario === 'zero-target' ? [6, 3] : scenario === 'other-target' ? [6, 1] : [4, 3])
                  assert.equal(damaged.bottom.deck, 12)
                  if (scenario === 'draw-zero') await draw.getByRole('button', { name: '略過抽牌', exact: true }).click()
                  else { await draw.locator('.draw-up-to-option').filter({ hasText: '抽 1 張' }).click(); await draw.getByRole('button', { name: '抽取 1 張牌', exact: true }).click() }
                }
                const after = await state(page)
                assert.deepEqual(after.top.battle.map(c => c.hp), scenario === 'zero-target' ? [6, 3] : scenario === 'other-target' ? [6, 1] : [4, 3])
                assert.equal(after.top.trash, scenario === 'zero-target' ? 0 : 2)
                assert.deepEqual(after.bottom.battle, row.entered.bottom.battle)
                assert.equal(after.bottom.deck, (fixture === 'peach-cost' || scenario === 'draw-zero') ? 12 : 11)
                assert.equal(after.bottom.hand, (fixture === 'peach-cost' || scenario === 'draw-zero') ? 1 : 2)
                assert.equal(after.bottom.trash, 0)
                assert.equal(after.bottom.breakLevel, 1)
                assert.deepEqual(after.bottom.support, [true])
              }
            }
          }
          if (['skip', 'cancel-cost'].includes(scenario)) assert.deepEqual(await state(page), row.entered)
        }
      }
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
  console.log(`BS12-035 confirmed Browser ${rows.length}/${rows.length}; R002 is excluded`)
} finally { await browser.close() }
