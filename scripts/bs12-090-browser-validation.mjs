import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-090-browser')
mkdirSync(out, { recursive: true })
const records = ['data/cards/official-festival-arena-bs12.en.json', ...readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json')).map(file => `data/cards/${file}`)]
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
const blocks = ['response', 'item-cost', 'stage-cost', 'trap-cost', 'rested-source', 'second-response', 'block-skip', 'cancel-block', 'back', 'back-paid', 'minimize', 'deselect', 'select-second']
const faints = ['faint-four', 'faint-five', 'mixed-break', 'other-color', 'non-arena-target', 'no-hand-faint', 'direct-attack', 'no-target', 'zero', 'choose-blocker', 'deselect-faint', 'minimize-faint', 'replace-selection', 'faint-three', 'wrong-zones', 'lv10-defeat']
const cases = [...blocks, ...unavailable, ...ordinary, ...faints, 'flip-rescue', 'flip-skip']
const routeCase = scenario => ['block-skip', 'cancel-block', 'back', 'back-paid', 'minimize', 'deselect'].includes(scenario) ? 'response'
  : scenario === 'select-second' ? 'twice' : ['zero', 'choose-blocker', 'deselect-faint', 'minimize-faint', 'replace-selection'].includes(scenario) ? 'faint-four'
    : scenario.startsWith('flip-') ? 'last-hp-flip' : ['cancel-payment', 'cancel-target'].includes(scenario) ? 'attack' : scenario
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const number of ['BS12-090', 'BS12-090@1'].filter(value => !process.env.BS12_BROWSER_NUMBERS || process.env.BS12_BROWSER_NUMBERS.split(',').includes(value)))
    for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }])
      for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
        const page = await browser.newPage({ viewport })
        const result = { number, scenario, viewport, printedSourceAttested: true, status: 'FAIL', errors: [], networkFailures: [] }
        page.on('pageerror', error => result.errors.push(error.message))
        page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
        page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText }))
        const shot = label => page.screenshot({ path: resolve(out, `${number.replace('@', '-')}-${scenario}-${viewport.width}-${label}.png`) })
        const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-090-source"]')
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
          await page.getByRole('alertdialog').getByRole('button', { name: 'Milky Way Cookie Milky Way Cookie', exact: true }).click()
          const dialog = page.locator('.blocker-response-modal')
          await dialog.waitFor()
          await modalFits(dialog)
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
          result.testState=process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='faint-four'?'card:'+number:process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='faint-three'?'card-negative:'+number:'bs12-090:'+number+':'+routeCase(scenario)
          await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state='+result.testState+'&contract-card='+required.map(entry=>entry.record.cardNumber).join(','))
          await page.locator('.game-shell').waitFor()
          await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
          await settle(page)
          result.before = await state(page)
          result.beforeTrace = await trace(page)
          await checkArt(page.locator('img[alt="Milky Way Cookie"]').first())
          result.originalArtVisible = true
          if (ordinary.includes(scenario)) {
            if (scenario === 'deploy') {
              const hand = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator('img[alt="Milky Way Cookie"]') })
              await hand.locator('button.card-face').click()
              await hand.getByRole('button', { name: '登場', exact: true }).click()
              await source.waitFor()
              assert.deepEqual((await state(page)).bottom.battle.map(cookie => cookie.hp), [5, 4])
              assert.equal((await state(page)).bottom.deck, 8)
            } else if (!['attack', 'cancel-payment', 'cancel-target'].includes(scenario)) {
              assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
              assert.deepEqual(await state(page), result.before)
              assert.deepEqual(await trace(page), result.beforeTrace)
            } else {
              await source.locator('.card-face.is-attackable').click()
              if (scenario !== 'cancel-payment') for (const i of [0, 1, 2]) await page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="bs12-090-payment-${i}"] .card-face`).click()
              await shot('payment')
              if (scenario !== 'attack') {
                await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
                assert.deepEqual(await state(page), result.before)
                assert.deepEqual(await trace(page), result.beforeTrace)
              } else {
                await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-090-attacker"] .card-face[aria-label^="選擇攻擊目標："]').click()
                await page.waitForFunction(() => !document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="bs12-090-attacker"]'))
                await settle(page)
                assert.deepEqual((await state(page)).top.battle.map(cookie => cookie.hp), [2])
                assert.deepEqual((await state(page)).bottom.support.map(support => support.rested), [true, true, true])
              }
            }
          } else if (blocks.includes(scenario)) {
            let dialog = await openBlock()
            const cost = () => dialog.getByRole('group', { name: 'Blocker 手牌代價' }).getByRole('button')
            assert.equal(await dialog.getByRole('button', { name: '使用 Blocker', exact: true }).isEnabled(), false)
            const skipped = ['block-skip', 'cancel-block', 'back'].includes(scenario)
            if (scenario !== 'block-skip') await cost().first().click()
            assert.deepEqual(await state(page), result.before)
            assert.deepEqual(await trace(page), result.beforeTrace)
            if (scenario === 'deselect') { await cost().first().click(); assert.equal(await dialog.getByRole('button', { name: '使用 Blocker', exact: true }).isEnabled(), false); await cost().first().click() }
            if (scenario === 'select-second') { assert.equal(await cost().nth(1).isEnabled(), false); await cost().first().click(); await cost().nth(1).click() }
            if (scenario === 'minimize') { await dialog.getByRole('button', { name: '縮小', exact: true }).click(); await page.locator('.card-reveal-dock:visible').click(); assert.equal(await cost().first().getAttribute('aria-pressed'), 'true') }
            if (['back', 'back-paid'].includes(scenario)) { await dialog.getByRole('button', { name: '返回', exact: true }).click(); dialog = await openBlock(); assert.equal(await dialog.getByRole('button', { name: '使用 Blocker', exact: true }).isEnabled(), false); if (scenario === 'back-paid') await cost().first().click() }
            await shot('block-cost')
            await dialog.getByRole('button', { name: skipped ? '不使用' : '使用 Blocker', exact: true }).click()
            await page.waitForFunction(({ skipped, twice }) => document.querySelector(`.bottom-field .combat-card-wrap[data-card-instance-id="${skipped ? 'bs12-090-ally' : 'bs12-090-source'}"] .hp-card-stack`)?.getAttribute('aria-label')?.includes(`HP 卡 ${skipped ? 4 : twice ? 2 : 3} 張`), { skipped, twice: scenario === 'second-response' })
            await settle(page)
            const after = await state(page)
            assert.deepEqual(after.bottom.battle.map(cookie => cookie.hp), skipped ? [4, 4] : scenario === 'second-response' ? [2, 5] : [3, 5])
            assert.equal(after.bottom.hand, result.before.bottom.hand - (skipped ? 0 : 1))
            assert.deepEqual(after.bottom.support, result.before.bottom.support)
          } else if (unavailable.includes(scenario)) {
            await page.waitForFunction(() => document.querySelector('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-090-ally"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 4 張'))
            assert.deepEqual((await state(page)).bottom.battle.map(cookie => cookie.hp), [4, 4])
            assert.equal((await state(page)).bottom.hand, result.before.bottom.hand)
            assert.equal((await trace(page)).some(entry => entry.commandKind === 'play-blocker'), false)
          } else {
            if (scenario.startsWith('flip-')) {
              const flip = page.locator('.flip-response-modal')
              await flip.waitFor()
              if (scenario === 'flip-skip') await flip.getByRole('button', { name: '不發動', exact: true }).click()
              else {
                await flip.locator('.flip-hand-carousel').getByRole('button', { name: 'Currant Cream Cookie Currant Cream Cookie', exact: true }).click()
                await flip.getByRole('group', { name: 'FLIP 效果目標' }).getByRole('button').filter({ hasText: 'Milky Way Cookie' }).click()
                await shot('flip-cost-and-target')
                await flip.getByRole('button', { name: '發動 FLIP', exact: true }).click()
                await source.waitFor()
                assert.deepEqual((await state(page)).bottom.battle.map(cookie => cookie.hp), [1, 5])
                assert.equal((await trace(page)).some(entry => entry.commandKind === 'resolve-faint-effect'), false)
              }
            } else if (!['direct-attack', 'no-hand-faint'].includes(scenario)) await payBlock()
            if (['faint-three', 'wrong-zones', 'lv10-defeat'].includes(scenario)) {
              await source.waitFor({ state: 'detached' })
              await settle(page)
              if (scenario === 'lv10-defeat') await page.getByRole('button', { name: '查看對戰紀錄', exact: true }).waitFor()
              else await finishReplacement()
              assert.equal((await trace(page)).some(entry => entry.commandKind === 'resolve-faint-effect'), false)
              assert.equal(await page.locator('.faint-response-modal').count(), 0)
            } else if (scenario !== 'flip-rescue') {
              const dialog = page.locator('.faint-response-modal')
              await dialog.waitFor()
              await settle(page)
              await modalFits(dialog)
              await checkArt(dialog.locator('img[alt="Milky Way Cookie"]').first())
              assert.match(await dialog.innerText(), /自己的休息區 LV\.1 餅乾/)
              assert.equal(await dialog.locator('.faint-cost-section, .faint-payment-section').count(), 0)
              const candidates = dialog.locator('.faint-card-candidates > button')
              const beforeMove = await state(page)
              const targetName = scenario === 'other-color' ? 'GingerBrave' : scenario === 'non-arena-target' ? 'Snow Sugar Cookie' : scenario === 'choose-blocker' ? 'Pudding Cookie' : 'Currant Cream Cookie'
              const pick = () => candidates.filter({ hasText: targetName }).first()
              const zero = ['zero', 'no-target'].includes(scenario)
              if (scenario === 'no-target') assert.equal(await candidates.count(), 0)
              if (!zero) {
                await pick().click()
                assert.deepEqual(await state(page), beforeMove)
                if (scenario === 'replace-selection') { await candidates.filter({ hasText: 'Pudding Cookie' }).first().click(); assert.equal(await candidates.filter({ hasText: 'Pudding Cookie' }).first().getAttribute('aria-pressed'), 'false'); await pick().click(); await candidates.filter({ hasText: 'Pudding Cookie' }).first().click() }
                if (scenario === 'deselect-faint') { await pick().click(); assert.equal(await dialog.getByRole('button', { name: '不選擇目標', exact: true }).isEnabled(), true); await pick().click() }
                if (scenario === 'minimize-faint') { await dialog.getByRole('button', { name: '縮小', exact: true }).click(); await page.locator('.decision-reveal-dock:visible').click(); assert.equal(await pick().getAttribute('aria-pressed'), 'true') }
              }
              await shot('faint-target')
              await dialog.getByRole('button', { name: zero ? '不選擇目標' : '確認 (1)', exact: true }).click()
              await page.waitForFunction(() => (window.__braverseContractTrace ?? []).some(entry => entry.commandKind === 'resolve-faint-effect'))
              await finishReplacement()
              await settle(page)
              const after = await state(page)
              assert.equal(after.bottom.trash, beforeMove.bottom.trash + (zero ? 0 : 1))
              assert.equal(after.bottom.breakCount, beforeMove.bottom.breakCount - (zero ? 0 : 1))
              assert.equal(after.bottom.hand, beforeMove.bottom.hand)
              assert.equal(after.bottom.deck, beforeMove.bottom.deck)
              assert.deepEqual(after.bottom.support, beforeMove.bottom.support)
              if (!zero) assert.match((await trace(page)).flatMap(entry => entry.steps ?? []).join(' '), /休息區.*棄牌區/)
            }
          }
          result.after = await state(page)
          result.trace = await trace(page)
          if (['faint-four', 'zero'].includes(scenario)) {
            await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
            const log = page.getByRole('complementary', { name: '對戰紀錄側欄' })
            await log.getByRole('button', { name: /Muscle Cookie 攻擊/ }).first().click()
            const text = await log.innerText()
            assert.match(text, scenario === 'zero' ? /未選擇休息區目標，沒有卡牌移動/ : /Currant Cream Cookie.*休息區.*棄牌區/)
            result.visiblePublicLog = text
            await shot('public-log')
            await page.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
          }
          await shot('result')
          assert.deepEqual(result.errors, [])
      // Transient HP faces can be removed before their original-art request
      // finishes. Keep every cancellation, and require all mounted original
      // images (including payment/target/log faces) to decode successfully.
      result.mountedOriginalArt = await page.evaluate(async urls => {
        const mounted = [...document.images].filter(img => urls.includes(img.src))
        return Promise.all(mounted.map(async img => {
          await img.decode()
          if (!img.naturalWidth) throw new Error(`Original card art failed: ${img.src}`)
          return { url: img.src, alt: img.alt, naturalWidth: img.naturalWidth }
        }))
      }, cards.map(card => card.imageUrl))
      result.cancelledOriginalImageRequests = result.networkFailures.filter(entry =>
        entry.resourceType === 'image' && entry.error === 'net::ERR_ABORTED' && cards.some(card => card.imageUrl === entry.url))
      result.networkFailures = result.networkFailures.filter(entry => !result.cancelledOriginalImageRequests.includes(entry))
      assert.deepEqual(result.networkFailures, [])
          result.status = 'PASS'
        } catch (error) {
          result.error = String(error.stack ?? error)
          result.after = await state(page).catch(() => null)
          result.trace = await trace(page).catch(() => [])
          result.dom = await page.locator('body').innerText().catch(() => '')
          results.push(result)
          writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'), JSON.stringify(results, null, 2))
          throw error
        } finally { await page.close() }
        results.push(result)
        writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'), JSON.stringify(results, null, 2))
        console.log(`PASS ${number} ${scenario} ${viewport.width}x${viewport.height}`)
      }
  console.log(`BS12-090 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
