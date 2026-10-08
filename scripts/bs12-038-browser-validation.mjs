import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-038-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/cards/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,`test-results/bs12-official-art/${card.cardNumber}.webp`)))
const cases = ['positive', 'equal-before', 'equal-after', 'more-after', 'foe-zero', 'zero-after', 'source-rested', 'opponent-rested', 'hand', 'full-battle', 'short-deck', 'last-deck', 'skip-on-play', 'parent-zero', 'cancel-parent', 'deselect-parent', 'attack', 'attack-wrong', 'attack-few', 'attack-rested-energy', 'attack-rested-source', 'cancel-attack', 'isolated-opponent-turn']
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
  for (const number of ['BS12-038', 'BS12-038@1']) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => s !== 'isolated-opponent-turn' && (!process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s)))) {
    const page = await browser.newPage({ viewport })
    const isolated = scenario === 'isolated-opponent-turn'
    const row = { number, scenario, viewport, scope: isolated ? 'isolated-support-entry-rule-ui' : 'candidate-printed-038-support-entry-ordinary', printedSourceAttested: !isolated, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = suffix => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${suffix}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl,route=>route.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,`test-results/bs12-official-art/${card.cardNumber}.webp`))}))
      const attack = scenario.startsWith('attack') || scenario === 'cancel-attack'
      const fixture = ['skip-on-play', 'parent-zero', 'cancel-parent', 'deselect-parent'].includes(scenario) ? 'positive' : scenario === 'cancel-attack' ? 'attack' : scenario
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'positive' ? `card:${number}` : process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'equal-after' ? `card-negative:${number}` : `${number.toLowerCase()}:${fixture}`
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${row.testState}&contract-card=BS12-038,BS6-008,BS7-055,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-028,BS12-029,BS12-030,BS12-031,BS12-046`)
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      row.before = await state(page)
      row.beforeTrace = await trace(page)
      const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-038-source"] button.card-face:not(.hp-card)')
      const image = page.locator(`.bottom-field img[src="${cards.find(c => c.cardNumber === number).imageUrl}"]`).first()
      await image.evaluate(img => img.decode())
      if (attack) {
        assert.deepEqual(row.before.bottom.battle.map(c => c.hp), [5, 2])
        if (scenario !== 'attack' && scenario !== 'cancel-attack') {
          assert.equal(await source.locator(':scope.is-attackable').count(), 0)
          await source.click()
          assert.equal(await page.getByRole('button', { name: '取消攻擊', exact: true }).count(), 0)
          assert.deepEqual(await state(page), row.before)
          assert.deepEqual(await trace(page), row.beforeTrace)
        } else {
          assert.deepEqual(row.before.bottom.support, [false, false, true])
          await source.click()
          const supports = page.locator('.bottom-field .support-card-wrap button.card-face')
          await supports.nth(0).click({ position: { x: 10, y: 25 } })
          await supports.nth(1).click({ position: { x: 10, y: 25 } })
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
            assert.deepEqual(after.bottom.support, [true, true, true])
            assert.equal(after.bottom.battle[1].rested, true)
            assert.deepEqual((await trace(page)).slice(row.beforeTrace.length).map(e => e.commandKind), ['declare-attack', 'resolve-next-damage', 'resolve-next-damage'])
          }
        }
      } else {
        if (scenario === 'hand') {
          const hand = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator('img[alt="Greenbell Cookie"]') })
          await hand.locator('button.card-face').click()
          await hand.getByRole('button', { name: '登場', exact: true }).click()
        } else if (!isolated) {
          const parent = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-038-deployer"]')
          await parent.locator('img[alt="Shining Glitter Cookie"]').evaluate(img => img.decode())
          await parent.getByRole('button', { name: '啟動技能', exact: true }).click()
          const panel = page.getByRole('alertdialog')
          await panel.waitFor()
          const target = panel.getByRole('button', { name: /^Greenbell Cookie Greenbell Cookie/ })
          if (scenario === 'full-battle') {
            assert.equal(await target.count(), 0)
            await panel.getByRole('button', { name: '取消技能', exact: true }).click()
            assert.deepEqual(await state(page), row.before)
            assert.deepEqual(await trace(page), row.beforeTrace)
          } else {
            if (scenario !== 'parent-zero') await target.click()
            if (scenario === 'deselect-parent') await target.click()
            if (scenario === 'cancel-parent') {
              await panel.getByRole('button', { name: '取消技能', exact: true }).click()
              assert.deepEqual(await state(page), row.before)
              assert.deepEqual(await trace(page), row.beforeTrace)
            } else await panel.getByRole('button', { name: '確認發動', exact: true }).click()
          }
        }
        const noEntry = ['parent-zero', 'cancel-parent', 'deselect-parent', 'full-battle'].includes(scenario)
        if (!noEntry) {
          if (scenario === 'short-deck') {
            const refresh = page.getByRole('alertdialog')
            await refresh.getByRole('button', { name: /^Candy Diver Cookie Candy Diver Cookie/ }).click()
          }
          await source.waitFor()
          await settle(page)
          row.entry = await state(page)
          assert.deepEqual(row.entry.bottom.battle.map(c => c.hp), [5, 2])
          const noEffect = ['equal-after', 'more-after', 'foe-zero', 'hand'].includes(scenario)
          if (noEffect) {
            assert.equal(await page.getByRole('button', { name: '略過整個登場效果', exact: true }).count(), 0)
            assert.equal(row.entry.bottom.deck, 10)
            assert.equal(row.entry.bottom.support.length, row.before.bottom.support.length - (scenario === 'hand' ? 0 : 1))
            const skipped = (await trace(page)).slice(row.beforeTrace.length).find(e => e.commandKind === 'skip-on-play')
            assert.ok(skipped)
            assert.match(skipped.summary, scenario === 'hand' ? /本次不是從支援區登場/ : /登場效果：條件不成立/)
            assert.doesNotMatch(skipped.summary, /選擇不發動/)
            assert.ok(skipped.steps.includes(scenario === 'hand'
              ? '效果未生效：本次不是從支援區登場，未符合登場來源條件。'
              : '登場效果結果：條件不成立，效果未執行。'))
          } else {
            const panel = page.getByRole('alertdialog')
            assert.match(await panel.innerText(), /從牌庫頂放 1 張到支援區（疲勞）/)
            await shot('on-play')
            await panel.getByRole('button', { name: scenario === 'skip-on-play' ? '略過整個登場效果' : '確認發動', exact: true }).click()
            if (scenario === 'last-deck') {
              const refresh = page.getByRole('alertdialog')
              await refresh.getByRole('button', { name: /^Candy Diver Cookie Candy Diver Cookie/ }).click()
            }
            await page.waitForFunction(() => !document.querySelector('.effect-panel:not(.is-complete)'))
            await settle(page)
            const after = await state(page)
            if (scenario === 'skip-on-play') {
              assert.deepEqual(after, row.entry)
              const skipped = (await trace(page)).slice(row.beforeTrace.length).find(e => e.commandKind === 'skip-on-play')
              assert.match(skipped.summary, /選擇不發動/)
              assert.doesNotMatch(skipped.summary, /條件不成立/)
            }
            else {
              assert.equal(after.bottom.support.length, row.entry.bottom.support.length + 1)
              assert.equal(after.bottom.support.at(-1), true)
              if (!['short-deck', 'last-deck'].includes(scenario)) {
                const placed = page.locator('.bottom-field .support-card-wrap').last().locator('img')
                assert.equal(await placed.getAttribute('alt'), 'Muscle Cookie')
                assert.equal(await placed.getAttribute('src'), cards.find(c => c.cardNumber === 'ST3-001').imageUrl)
                await placed.evaluate(img => img.decode())
              }
              assert.equal(after.bottom.deck, scenario === 'short-deck' ? 4 : scenario === 'last-deck' ? 5 : 9)
              assert.deepEqual(after.bottom.battle, row.entry.bottom.battle)
              assert.equal(after.bottom.breakLevel, ['short-deck', 'last-deck'].includes(scenario) ? 2 : 0)
              assert.equal(after.bottom.trash, 0)
              assert.deepEqual(after.top, row.entry.top)
              assert.match(await page.locator('body').innerText(), /放了 1 張到支援區/)
              assert.deepEqual((await trace(page)).slice(row.beforeTrace.length).filter(e => e.commandKind !== 'refresh-deck').map(e => e.commandKind), ['begin-activate-skill', 'resolve-ability-effect', 'begin-activate-skill', 'resolve-ability-effect'])
            }
          }
          assert.equal(await source.locator('img').getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
        } else if (['parent-zero', 'deselect-parent'].includes(scenario)) {
          assert.deepEqual(await state(page), row.before)
          assert.equal(await source.count(), 0)
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
  console.log(`BS12-038 printed Browser ${rows.filter(r => r.printedSourceAttested).length}; isolated ${rows.filter(r => !r.printedSourceAttested).length}`)
} finally { await browser.close() }
