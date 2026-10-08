import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-091-browser')
mkdirSync(out, { recursive: true })
const records = ['data/candidates/official-festival-arena-bs12.en.json', ...readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json')).map(file => `data/cards/${file}`)]
  .flatMap(path => JSON.parse(readFileSync(resolve(root, path), 'utf8')).cards ?? [])
const required = records.map(record=>({record,path:['bs12-official-art','bs11-official-art'].map(dir=>resolve(root,'test-results/'+dir+'/'+record.cardNumber+'.webp')).find(existsSync)})).filter(entry=>entry.path)
for(const entry of required)assert.ok(entry.record.imageUrl&&existsSync(entry.path))
const cards=required.map(entry=>entry.record)
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'), hand: field?.querySelectorAll('.hand-card').length ?? 0,
      breakCount: Number(field?.querySelector('.break-zone .zone-heading b')?.textContent?.match(/\d+/)?.[0] ?? 0),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'), hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN), rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'), rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({ commandKind: entry.commandKind, summary: entry.summary, steps: entry.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') && ![...document.querySelectorAll('button')].some(button => button.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
const ordinary = ['deploy', 'attack', 'wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main', 'cancel-payment', 'cancel-target']
const unavailable = ['no-hand', 'wrong-color', 'non-arena', 'split-cost']
const blocks = ['response', 'item-cost', 'stage-cost', 'trap-cost', 'rested-source', 'block-skip', 'back', 'back-paid', 'minimize', 'deselect']
const faints = ['faint', 'direct-attack', 'no-hand-faint', 'old-target', 'zero-target', 'same-name-only', 'other-color', 'non-arena-target', 'no-blocker-target', 'short-deck', 'empty-deck', 'exact-deck', 'unpayable', 'refresh-defeat', 'second-response',
  'cost-skip', 'zero-recover', 'deselect-faint', 'minimize-cost', 'minimize-faint', 'old-target-choice', 'flip-rescue', 'flip-skip']
const cases = [...blocks, ...unavailable, ...ordinary, ...faints]
const routeCase = scenario => ['block-skip', 'back', 'back-paid', 'minimize', 'deselect'].includes(scenario) ? 'response'
  : ['cost-skip', 'zero-recover', 'deselect-faint', 'minimize-cost', 'minimize-faint'].includes(scenario) ? 'faint'
    : scenario === 'old-target-choice' ? 'old-target' : scenario.startsWith('flip-') ? 'last-hp-flip' : ['cancel-payment', 'cancel-target'].includes(scenario) ? 'attack' : scenario
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const number of ['BS12-091', 'BS12-091@1'].filter(value => !process.env.BS12_BROWSER_NUMBERS || process.env.BS12_BROWSER_NUMBERS.split(',').includes(value)))
    for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }])
      for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
        const page = await browser.newPage({ viewport })
        const row = { number, scenario, viewport, printedSourceAttested: true, status: 'FAIL', errors: [], networkFailures: [] }
        page.on('pageerror', error => row.errors.push(error.message))
        page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()) })
        page.on('requestfailed', request => row.networkFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText }))
        const shot = label => page.screenshot({ path: resolve(out, `${number.replace('@', '-')}-${scenario}-${viewport.width}-${label}.png`) })
        const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-091-source"]')
        const modalFits = async dialog => {
          const box = await dialog.boundingBox()
          assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1)
        }
        const checkArt = async locator => {
          await locator.evaluate(image => image.decode())
          assert.equal(await locator.getAttribute('src'), records.find(card => card.cardNumber === number).imageUrl)
          assert.ok(await locator.evaluate(image => image.naturalWidth > 300 && image.naturalHeight > 400))
        }
        const openBlock = async () => {
          await page.getByRole('alertdialog').getByRole('button', { name: 'Caramel Arrow Cookie Caramel Arrow Cookie', exact: true }).click()
          const dialog = page.locator('.blocker-response-modal')
          await dialog.waitFor(); await modalFits(dialog)
          return dialog
        }
        const payBlock = async () => {
          const dialog = await openBlock()
          await dialog.getByRole('group', { name: 'Blocker 手牌代價' }).getByRole('button').first().click()
          await dialog.getByRole('button', { name: '使用 Blocker', exact: true }).click()
        }
        const finishReplacement = async () => {
          const button = page.getByRole('button', { name: '不補餅乾', exact: true })
          if (await button.count()) await button.click()
        }
        try {
          for (const { record, path } of required) await page.route(record.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(path) }))
          row.testState=process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='faint'?'card:'+number:process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='no-blocker-target'?'card-negative:'+number:'bs12-091:'+number+':'+routeCase(scenario)
          await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card='+required.map(entry=>entry.record.cardNumber).join(','))
          await page.locator('.game-shell').waitFor()
          await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
          await settle(page)
          row.before = await state(page); row.beforeTrace = await trace(page)
          await checkArt(page.locator('.bottom-field img[alt="Caramel Arrow Cookie"]').first())
          row.originalArtVisible = true
          if (ordinary.includes(scenario)) {
            if (scenario === 'deploy') {
              const hand = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator('img[alt="Caramel Arrow Cookie"]') })
              await hand.locator('button.card-face').click(); await hand.getByRole('button', { name: '登場', exact: true }).click(); await source.waitFor()
              assert.deepEqual((await state(page)).bottom.battle.map(cookie => cookie.hp), [5, 2]); assert.equal((await state(page)).bottom.deck, 10)
            } else if (!['attack', 'cancel-payment', 'cancel-target'].includes(scenario)) {
              assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
              assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
            } else {
              await source.locator('.card-face.is-attackable').click()
              if (scenario !== 'cancel-payment') for (const i of [0, 1]) await page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="bs12-091-payment-${i}"] .card-face`).click()
              await shot('payment')
              if (scenario !== 'attack') {
                await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
                assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
              } else {
                await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-091-attacker"] .card-face[aria-label^="選擇攻擊目標："]').click()
                await page.waitForFunction(() => !document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="bs12-091-attacker"]')); await settle(page)
                assert.deepEqual((await state(page)).top.battle.map(cookie => cookie.hp), [2]); assert.deepEqual((await state(page)).bottom.support.map(support => support.rested), [true, true])
              }
            }
          } else if (blocks.includes(scenario)) {
            let dialog = await openBlock()
            const cost = () => dialog.getByRole('group', { name: 'Blocker 手牌代價' }).getByRole('button')
            assert.equal(await dialog.getByRole('button', { name: '使用 Blocker', exact: true }).isEnabled(), false)
            const skip = ['block-skip', 'back'].includes(scenario)
            if (scenario !== 'block-skip') await cost().first().click()
            assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
            if (scenario === 'deselect') { await cost().first().click(); assert.equal(await dialog.getByRole('button', { name: '使用 Blocker', exact: true }).isEnabled(), false); await cost().first().click() }
            if (scenario === 'minimize') { await dialog.getByRole('button', { name: '縮小', exact: true }).click(); await page.locator('.card-reveal-dock:visible').click(); assert.equal(await cost().first().getAttribute('aria-pressed'), 'true') }
            if (['back', 'back-paid'].includes(scenario)) { await dialog.getByRole('button', { name: '返回', exact: true }).click(); dialog = await openBlock(); assert.equal(await dialog.getByRole('button', { name: '使用 Blocker', exact: true }).isEnabled(), false); if (!skip) await cost().first().click() }
            await shot('block-cost'); await dialog.getByRole('button', { name: skip ? '不使用' : '使用 Blocker', exact: true }).click(); await settle(page)
            await page.waitForFunction(skipped => document.querySelector(`.bottom-field .combat-card-wrap[data-card-instance-id="${skipped ? 'bs12-091-ally' : 'bs12-091-source'}"] .hp-card-stack`)?.getAttribute('aria-label')?.includes(`HP 卡 ${skipped ? 4 : 1} 張`), skip)
            const after = await state(page)
            assert.deepEqual(after.bottom.battle.map(cookie => cookie.hp), skip ? [2, 4] : [1, 5])
            assert.equal(after.bottom.hand, row.before.bottom.hand - (skip ? 0 : 1)); assert.deepEqual(after.bottom.support, row.before.bottom.support)
          } else if (unavailable.includes(scenario)) {
            await page.waitForFunction(() => document.querySelector('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-091-ally"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 4 張'))
            assert.deepEqual((await state(page)).bottom.battle.map(cookie => cookie.hp), [2, 4]); assert.equal((await state(page)).bottom.hand, row.before.bottom.hand)
            assert.equal((await trace(page)).some(entry => entry.commandKind === 'play-blocker'), false)
          } else {
            if (scenario.startsWith('flip-')) {
              const flip = page.locator('.flip-response-modal'); await flip.waitFor()
              if (scenario === 'flip-skip') await flip.getByRole('button', { name: '不發動', exact: true }).click()
              else {
                await flip.locator('.flip-hand-carousel').getByRole('button', { name: 'Currant Cream Cookie Currant Cream Cookie', exact: true }).click()
                await flip.getByRole('group', { name: 'FLIP 效果目標' }).getByRole('button').filter({ hasText: 'Caramel Arrow Cookie' }).click()
                await flip.getByRole('button', { name: '發動 FLIP', exact: true }).click(); await source.waitFor()
                assert.deepEqual((await state(page)).bottom.battle.map(cookie => cookie.hp), [1, 5]); assert.equal((await trace(page)).some(entry => entry.commandKind === 'resolve-faint-effect'), false)
              }
            } else if (!['direct-attack', 'no-hand-faint', 'unpayable'].includes(scenario)) await payBlock()
            if (scenario !== 'flip-rescue') {
              const dialog = page.locator('.faint-response-modal'); await dialog.waitFor(); await settle(page); await modalFits(dialog)
              await checkArt(dialog.locator('img[alt="Caramel Arrow Cookie"]').first())
              assert.match(await dialog.innerText(), scenario === 'unpayable' ? /牌庫不足 3 張.*無法支付牌庫頂代價/ : /牌庫頂 3 張.*棄牌區/)
              assert.equal(await dialog.locator('.faint-card-candidates').count(), 0)
              row.beforeCost = await state(page)
              if (scenario === 'minimize-cost') { await dialog.getByRole('button', { name: '縮小', exact: true }).click(); await page.locator('.decision-reveal-dock:visible').click() }
              if (['cost-skip', 'unpayable'].includes(scenario)) {
                if (scenario === 'unpayable') assert.equal(await dialog.getByRole('button', { name: '支付代價', exact: true }).isEnabled(), false)
                await dialog.getByRole('button', { name: scenario === 'unpayable' ? '繼續' : '不發動', exact: true }).click()
                await finishReplacement(); await settle(page)
                const after = await state(page)
                assert.equal(after.bottom.deck, row.beforeCost.bottom.deck); assert.equal(after.bottom.trash, row.beforeCost.bottom.trash); assert.equal(after.bottom.hand, row.beforeCost.bottom.hand)
              } else {
                await shot('deck-cost'); await dialog.getByRole('button', { name: '支付代價', exact: true }).click()
                if (['short-deck', 'empty-deck', 'exact-deck', 'refresh-defeat'].includes(scenario)) {
                  const refresh = page.locator('.decision-modal:visible'); await refresh.waitFor(); await shot('refresh')
                  await refresh.getByRole('button').filter({ hasText: scenario === 'exact-deck' ? 'Currant Cream Cookie' : 'Black Sapphire Cookie' }).first().click()
                  await refresh.waitFor({ state: 'hidden' })
                }
                if (scenario === 'refresh-defeat') {
                  await page.locator('.result-modal').waitFor(); assert.equal(await dialog.count(), 0)
                } else {
                  await dialog.getByRole('button', { name: '不選擇目標', exact: true }).waitFor(); await settle(page); await modalFits(dialog)
                  assert.match(await dialog.innerText(), /Blocker.*排除 Caramel Arrow Cookie/)
                  row.afterCost = await state(page)
                  if (!['short-deck', 'empty-deck', 'exact-deck'].includes(scenario)) {
                    assert.equal(row.afterCost.bottom.deck, row.beforeCost.bottom.deck - 3); assert.equal(row.afterCost.bottom.trash, row.beforeCost.bottom.trash + 3)
                  }
                  const candidates = dialog.locator('.faint-card-candidates > button')
                  const zero = ['zero-recover', 'zero-target', 'same-name-only', 'no-blocker-target', 'short-deck', 'empty-deck', 'exact-deck'].includes(scenario)
                  if (['zero-target', 'same-name-only', 'no-blocker-target'].includes(scenario)) assert.equal(await candidates.count(), 0)
                  else if (!zero) {
                    const pick = () => scenario === 'old-target-choice' ? candidates.filter({ hasText: 'Black Sapphire Cookie' }).first() : candidates.filter({ hasText: scenario === 'other-color' || scenario === 'non-arena-target' ? 'Peperoncino Cookie' : 'Milky Way Cookie' }).first()
                    await pick().click(); assert.deepEqual(await state(page), row.afterCost)
                    if (scenario === 'deselect-faint') { await pick().click(); assert.equal(await dialog.getByRole('button', { name: '不選擇目標', exact: true }).isEnabled(), true); await pick().click() }
                    if (scenario === 'minimize-faint') { await dialog.getByRole('button', { name: '縮小', exact: true }).click(); await page.locator('.decision-reveal-dock:visible').click(); assert.equal(await pick().getAttribute('aria-pressed'), 'true') }
                  }
                  await shot('recovery'); await dialog.getByRole('button', { name: zero ? '不選擇目標' : '確認 (1)', exact: true }).click()
                  await finishReplacement(); await settle(page)
                  const after = await state(page)
                  assert.equal(after.bottom.hand, row.afterCost.bottom.hand + (zero ? 0 : 1)); assert.equal(after.bottom.trash, row.afterCost.bottom.trash - (zero ? 0 : 1))
                  assert.equal(after.bottom.deck, row.afterCost.bottom.deck); assert.equal(after.bottom.breakCount, row.afterCost.bottom.breakCount); assert.deepEqual(after.bottom.support, row.afterCost.bottom.support)
                  assert.match((await trace(page)).flatMap(entry => entry.steps ?? []).join(' '), /牌庫頂.*棄牌區/)
                }
              }
            }
          }
          row.after = await state(page); row.trace = await trace(page)
          if (['faint', 'zero-recover', 'cost-skip', 'same-name-only'].includes(scenario)) {
            await finishReplacement(); await settle(page)
            await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
            const log = page.getByRole('complementary', { name: '對戰紀錄側欄' })
            await log.getByRole('button', { name: /Caramel Arrow Cookie 攻擊/ }).first().click()
            const text = await log.innerText()
            assert.match(text, scenario === 'cost-skip' ? /未支付牌庫頂代價.*後續回收未執行/ : /牌庫頂 3 張.*棄牌區/)
            if (scenario === 'faint') assert.match(text, /Milky Way Cookie.*棄牌區返回手牌/)
            if (['zero-recover', 'same-name-only'].includes(scenario)) assert.match(text, /未選擇回收目標.*沒有卡牌返回手牌/)
            row.visiblePublicLog = text; await shot('public-log')
            await page.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
          }
          await shot('result'); assert.deepEqual(row.errors, [])
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
      assert.deepEqual(row.networkFailures, []); row.status = 'PASS'
        } catch (error) {
          row.error = String(error.stack ?? error); row.after = await state(page).catch(() => null); row.trace = await trace(page).catch(() => []); row.dom = await page.locator('body').innerText().catch(() => '')
          results.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'), JSON.stringify(results, null, 2)); throw error
        } finally { await page.close() }
        results.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'), JSON.stringify(results, null, 2)); console.log(`PASS ${number} ${scenario} ${viewport.width}x${viewport.height}`)
      }
  console.log(`BS12-091 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
