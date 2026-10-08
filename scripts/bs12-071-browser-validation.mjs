import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-071-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const references = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...references].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const fixtures = ['positive', 'green-arena', 'red-arena', 'yellow-arena', 'non-arena', 'level-one', 'level-three', 'arena-item', 'top-only', 'short-deck', 'refresh-defeat', 'no-refresh-cookie', 'empty-deck', 'no-energy', 'source-rested', 'opponent-turn', 'outside-main', 'two-cookies', 'equipped', 'once-used', 'hand-decoy']
const cases = [...fixtures, 'cancel-activation', 'skip-cost', 'return-cost', 'reveal-minimize', 'cost-minimize', 'attack', 'attack-mixed', 'attack-one', 'attack-wrong', 'attack-rested', 'attack-source-rested', 'cancel-attack']
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return { hand: field.querySelectorAll('.hand-card-wrap').length, deck: Number(field.querySelector('.deck-zone .resource-summary>strong')?.textContent), trash: Number(field.querySelector('.discard-zone.resource-summary>strong')?.textContent),
      support: [...field.querySelectorAll('.support-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), rested: n.querySelector('.card-face').classList.contains('is-rested') })),
      battle: [...field.querySelectorAll('.combat-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]), rested: n.querySelector('.card-face').classList.contains('is-rested') })),
      breakLevel: Number(field.querySelector('.break-zone .zone-heading strong')?.textContent.match(/LV\. (\d+)/)?.[1]) }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, steps: e.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]'), null, { timeout: 20000 })
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const rows = []
try {
  for (const number of (process.env.BS12_BROWSER_PRINTS ?? 'BS12-071').split(',')) {
    for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) {
      for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
        const page = await browser.newPage({ viewport })
        const row = { number, scenario, viewport, printedSourceAttested: scenario !== 'equipped', status: 'FAIL', errors: [], networkFailures: [] }
        const shot = label => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${label}.png`) })
        page.on('pageerror', e => row.errors.push(e.message))
        page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
        page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
        try {
          for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
          const fixture = fixtures.includes(scenario) ? scenario : ({ 'attack-mixed': 'mixed-energy', 'attack-one': 'one-energy', 'attack-wrong': 'wrong-energy', 'attack-rested': 'rested-energy', 'attack-source-rested': 'source-rested' }[scenario] ?? 'positive')
          const physicalRoute = fixture
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'positive' ? 'card:'+number : process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'non-arena' ? 'card-negative:'+number : 'bs12-071:'+number+':'+physicalRoute
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-001,BS12-002,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-019,BS12-021,BS12-027,BS12-028,BS12-029,BS12-030,BS12-031,BS12-040,BS12-046,BS12-058,BS12-059,BS12-060,BS12-061,BS12-064,BS12-069,BS12-070,BS12-071,BS12-072,BS12-073,BS3-082,BS6-008,BS6-017,BS7-061,ST4-001'+','+number)
          await page.locator('.game-shell').waitFor()
          await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
          await settle(page)
          row.before = await state(page)
          const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-071-source"]')
          await source.locator('img').first().evaluate(i => i.decode())
          assert.equal(await source.locator('img').first().getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
          if (scenario.startsWith('attack') || scenario === 'cancel-attack') {
            if (['attack-one', 'attack-wrong', 'attack-rested', 'attack-source-rested'].includes(scenario)) {
              assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
              assert.deepEqual(await state(page), row.before)
            } else {
              await source.locator('.card-face.is-attackable').click()
              const support = page.locator('.bottom-field .support-card-wrap .card-face')
              await support.nth(0).click({ position: { x: 10, y: 25 } })
              assert.equal(await page.getByRole('button', { name: /^選擇攻擊目標/ }).count(), 0)
              await support.nth(1).click({ position: { x: 10, y: 25 } })
              if (scenario === 'cancel-attack') {
                await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
                assert.deepEqual(await state(page), row.before)
                assert.deepEqual(await trace(page), [])
              } else {
                await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-064-opponent"]').getByRole('button', { name: /^選擇攻擊目標/ }).click()
                await page.waitForFunction(() => document.querySelector('.top-field .combat-card-wrap .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 5 張') && !document.querySelector('.effect-panel:not(.is-complete)'))
                row.after = await state(page)
                assert.deepEqual(row.after.top.battle.map(c => c.hp), [5, 4])
                assert.equal(row.after.bottom.battle[0].rested, true)
                assert.ok(row.after.bottom.support.every(s => s.rested))
                assert.equal(row.after.bottom.deck, row.before.bottom.deck)
                assert.equal((await trace(page)).filter(e => e.commandKind === 'resolve-reveal-top-deck').length, 0)
              }
            }
          } else {
            const activate = source.getByRole('button', { name: '啟動技能', exact: true })
            if (['opponent-turn', 'outside-main', 'once-used'].includes(scenario)) {
              assert.ok(await activate.count() === 0 || !await activate.isEnabled())
              assert.deepEqual(await state(page), row.before)
            } else {
              await activate.click()
              const panel = page.locator('.effect-panel:not(.is-complete)')
              await panel.waitFor()
              assert.match(await panel.innerText(), /Reveal 1 card from the bottom.*Play that Cookie/s)
              assert.equal(await panel.locator('.effect-candidates-payment').count(), 0)
              assert.deepEqual(await state(page), row.before)
              if (scenario === 'cancel-activation') {
                await panel.getByRole('button', { name: '取消技能', exact: true }).click()
                assert.deepEqual(await state(page), row.before)
                assert.deepEqual(await trace(page), [])
              } else {
                await panel.getByRole('button', { name: '確認發動', exact: true }).click()
                if (scenario === 'empty-deck') {
                  await panel.waitFor({ state: 'hidden' })
                  assert.deepEqual(await state(page), row.before)
                } else {
                  const reveal = page.locator('.card-reveal-modal:visible')
                  await reveal.waitFor()
                  const mismatch = ['non-arena', 'level-one', 'level-three', 'arena-item', 'top-only'].includes(scenario)
                  assert.match(await reveal.innerText(), mismatch ? /條件未匹配/ : /可支付來源餅乾進棄牌區/)
                  await reveal.locator('img').evaluate(i => i.decode())
                  assert.deepEqual(await state(page), row.before)
                  if (scenario === 'reveal-minimize') {
                    await reveal.getByRole('button', { name: '縮小', exact: true }).click()
                    await page.locator('.card-reveal-dock').click()
                    assert.deepEqual(await state(page), row.before)
                  }
                  await shot('public-bottom')
                  await reveal.getByRole('button', { name: '確認並繼續', exact: true }).click()
                  if (mismatch) {
                    await panel.waitFor({ state: 'hidden' })
                    assert.deepEqual(await state(page), row.before)
                  } else {
                    await panel.getByRole('button', { name: '支付', exact: true }).waitFor()
                    assert.match(await panel.innerText(), /技能登場代價（可選）/)
                    assert.doesNotMatch(await panel.innerText(), /Then 可選效果/)
                    assert.match(await panel.innerText(), /代價：將此餅乾送入棄牌區/)
                    assert.deepEqual(await state(page), row.before)
                    if (scenario === 'cost-minimize') {
                      await panel.getByRole('button', { name: '縮小', exact: true }).click()
                      await page.locator('.effect-panel-dock').click()
                    }
                    if (scenario === 'skip-cost') {
                      await panel.getByRole('button', { name: '略過', exact: true }).click()
                      assert.deepEqual(await state(page), row.before)
                    } else {
                      await panel.getByRole('button', { name: '支付', exact: true }).click()
                      assert.deepEqual(await state(page), row.before)
                      if (scenario === 'return-cost') {
                        await panel.getByRole('button', { name: '返回', exact: true }).click()
                        assert.deepEqual(await state(page), row.before)
                        await panel.getByRole('button', { name: '支付', exact: true }).click()
                      }
                      await shot('source-cost')
                      await panel.getByRole('button', { name: '確認', exact: true }).click()
                      await panel.getByRole('button', { name: '確認發動', exact: true }).waitFor()
                      row.paid = await state(page)
                      assert.equal(row.paid.bottom.battle.some(c => c.id === 'bs12-071-source'), false)
                      assert.equal(row.paid.bottom.deck, row.before.bottom.deck)
                      assert.equal(row.paid.bottom.trash, row.before.bottom.trash + (scenario === 'equipped' ? 5 : 4))
                      assert.equal(await page.getByRole('button', { name: '不補餅乾', exact: true }).count(), 0)
                      assert.match(await panel.innerText(), /同一張牌庫底餅乾登場/)
                      await panel.getByRole('button', { name: '確認發動', exact: true }).click()
                      if (['short-deck', 'no-refresh-cookie', 'refresh-defeat'].includes(scenario)) {
                        const refresh = page.locator('.decision-modal:visible')
                        await refresh.waitFor()
                        row.beforeRefresh = await state(page)
                        assert.equal(row.beforeRefresh.bottom.battle[0].hp, 0)
                        await refresh.getByRole('button').filter({ hasText: scenario === 'no-refresh-cookie' ? 'Ice Pop Cookie' : 'Sour Belt Cookie' }).click()
                      }
                      if (scenario === 'refresh-defeat') await page.locator('.result-modal').waitFor()
                      else {
                        if (scenario === 'yellow-arena' || scenario === 'red-arena') {
                          const skip = page.getByRole('button', { name: '不發動', exact: true })
                          if (await skip.count()) await skip.click()
                        }
                        const skipReplacement = page.getByRole('button', { name: '不補餅乾', exact: true })
                        if (await skipReplacement.count()) await skipReplacement.click()
                        await settle(page)
                        row.after = await state(page)
                        const hp = scenario === 'green-arena' ? 3 : 2
                        assert.equal(row.after.bottom.battle.at(-1).id, 'bs12-069-bottom')
                        assert.equal(row.after.bottom.battle.at(-1).hp, hp)
                        assert.equal(row.after.bottom.hand, row.before.bottom.hand)
                        assert.deepEqual(row.after.bottom.support, row.before.bottom.support)
                        assert.deepEqual(row.after.top, row.before.top)
                        if (!['short-deck', 'no-refresh-cookie'].includes(scenario)) assert.equal(row.after.bottom.deck, row.before.bottom.deck - 1 - hp)
                      }
                    }
                    const commands = (await trace(page)).map(e => e.commandKind)
                    assert.ok(commands.indexOf('resolve-reveal-top-deck') < commands.indexOf('resolve-optional-cost-attack'))
                  }
                }
              }
            }
          }
          await settle(page)
          row.after ??= await state(page)
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
          console.log(`PASS ${number} ${scenario} ${viewport.width}`)
        } catch (error) { row.error = error.stack ?? String(error); await shot('failure').catch(() => {}); throw error }
        finally { rows.push(row); writeFileSync(resolve(out, `${number}-${process.env.BS12_BROWSER_CASES ? 'subset-' : ''}results.json`), JSON.stringify(rows, null, 2)); await page.close() }
      }
    }
  }
} finally { await browser.close() }
console.log(`BS12-071 candidate local Browser ${rows.length}/${rows.length}; formal BS12/online not covered.`)
