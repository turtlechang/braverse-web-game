import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-089-browser')
mkdirSync(out, { recursive: true })
const records = ['data/candidates/official-festival-arena-bs12.en.json', ...readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json')).map(file => `data/cards/${file}`)]
  .flatMap(path => JSON.parse(readFileSync(resolve(root, path), 'utf8')).cards ?? [])
const requiredCards = records.map(card=>({card,path:['bs12-official-art','bs11-official-art'].map(dir=>resolve(root,'test-results/'+dir+'/'+card.cardNumber+'.webp')).find(existsSync)})).filter(entry=>entry.path)
for(const entry of requiredCards)assert.ok(entry.card.imageUrl&&existsSync(entry.path))
const cards=requiredCards.map(entry=>entry.card)
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
const blockCases = ['response', 'item-cost', 'stage-cost', 'trap-cost', 'rested-source', 'block-skip', 'cancel-block', 'back', 'back-paid', 'minimize', 'deselect', 'select-second', 'second-response', 'all-opponents']
const autoCases = ['direct-attack', 'faints', 'unrelated', 'lv2', 'lv5', 'support-source', 'hand-source', 'second-battle']
const cases = [...blockCases, ...unavailable, ...ordinary, ...autoCases, 'attacker-lv3', 'attacker-faints', 'attacker-lv2', 'attacker-lv5', 'attacker-unrelated', 'attacker-all-opponents', 'redirect-away', 'flip-rescue', 'flip-skip', 'zero-damage']
const routeCase = scenario => ['block-skip', 'cancel-block', 'back', 'back-paid', 'minimize', 'deselect'].includes(scenario) ? 'response'
  : scenario === 'select-second' ? 'twice' : ['cancel-payment', 'cancel-target'].includes(scenario) ? 'attack' : scenario.startsWith('flip-') ? 'last-hp-flip' : scenario
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const number of ['BS12-089', 'BS12-089@1'].filter(value => !process.env.BS12_BROWSER_NUMBERS || process.env.BS12_BROWSER_NUMBERS.split(',').includes(value)))
    for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }])
      for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
        const page = await browser.newPage({ viewport })
        const result = { number, scenario, viewport, printedSourceAttested: true, status: 'FAIL', errors: [], networkFailures: [] }
        page.on('pageerror', error => result.errors.push(error.message))
        page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
        page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText }))
        const shot = label => page.screenshot({ path: resolve(out, `${number.replace('@', '-')}-${scenario}-${viewport.width}-${label}.png`) })
        const source = page.locator(`${scenario.startsWith('attacker-') ? '.top-field' : '.bottom-field'} .combat-card-wrap[data-card-instance-id="bs12-089-source"]`)
        const waitEffect = () => page.waitForFunction(count => (window.__braverseContractTrace ?? []).filter(entry => entry.commandKind === 'resolve-attack-effect').length >= count, ['second-battle', 'second-response'].includes(scenario) ? 2 : 1)
        const waitHp = (side, id, hp) => page.waitForFunction(({ side, id, hp }) => document.querySelector(`.${side}-field .combat-card-wrap[data-card-instance-id="${id}"] .hp-card-stack`)?.getAttribute('aria-label')?.includes(`HP 卡 ${hp} 張`), { side, id, hp })
        const openBlock = async (name = 'Werewolf Cookie') => {
          await page.getByRole('alertdialog').getByRole('button', { name: `${name} ${name}`, exact: true }).click()
          const dialog = page.locator('.blocker-response-modal')
          await dialog.waitFor()
          const box = await dialog.boundingBox()
          assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1)
          return dialog
        }
        try {
          for (const { card, path } of requiredCards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(path) }))
          result.testState=process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='response'?'card:'+number:process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='non-arena'?'card-negative:'+number:'bs12-089:'+number+':'+routeCase(scenario)
          await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state='+result.testState+'&contract-card='+requiredCards.map(entry=>entry.card.cardNumber).join(','))
          await page.locator('.game-shell').waitFor()
          await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
          await settle(page)
          result.before = await state(page)
          result.beforeTrace = await trace(page)
          assert.ok(result.before.bottom.battle.length <= 2 && result.before.top.battle.length <= 2)
          const art = page.locator('img[alt="Werewolf Cookie"]').first()
          if (await art.count()) {
            await art.evaluate(image => image.decode())
            assert.equal(await art.getAttribute('src'), records.find(card => card.cardNumber === number).imageUrl)
            assert.ok(await art.evaluate(image => image.naturalWidth > 300 && image.naturalHeight > 400))
            result.originalArtVisible = true
          }
          if (ordinary.includes(scenario)) {
            if (scenario === 'deploy') {
              const hand = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator('img[alt="Werewolf Cookie"]') })
              await hand.locator('button.card-face').click()
              await hand.getByRole('button', { name: '登場', exact: true }).click()
              await source.waitFor()
              assert.deepEqual((await state(page)).bottom.battle.map(cookie => cookie.hp), [5, 5])
              assert.equal((await state(page)).bottom.deck, 7)
            } else if (!['attack', 'cancel-payment', 'cancel-target'].includes(scenario)) {
              assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
              assert.deepEqual(await state(page), result.before)
              assert.deepEqual(await trace(page), result.beforeTrace)
            } else {
              await source.locator('.card-face.is-attackable').click()
              if (scenario !== 'cancel-payment') for (const i of [0, 1, 2]) await page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="bs12-089-payment-${i}"] .card-face`).click()
              await shot('payment')
              if (scenario !== 'attack') {
                await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
                assert.deepEqual(await state(page), result.before)
                assert.deepEqual(await trace(page), result.beforeTrace)
              } else {
                await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-089-attacker"] .card-face[aria-label^="選擇攻擊目標："]').click()
                await page.waitForFunction(() => document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="bs12-089-attacker"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 3 張'))
                await settle(page)
                const after = await state(page)
                assert.deepEqual(after.top.battle.map(cookie => cookie.hp), [3, 2])
                assert.deepEqual(after.bottom.support.map(support => support.rested), [true, true, true])
                assert.deepEqual(after.bottom.battle.map(cookie => cookie.hp), [5])
                assert.equal(after.bottom.deck, 12)
                assert.equal(after.bottom.trash, 0)
              }
            }
          } else if (scenario.startsWith('attacker-')) {
            const attacker = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-089-attacker"] .card-face.is-attackable')
            await attacker.click()
            for (let i = 0; i < (['attacker-lv5', 'attacker-all-opponents'].includes(scenario) ? 4 : 3); i++) await page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="bs12-089-enemy-payment-${i}"] .card-face`).click()
            await shot('payment')
            await page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${scenario === 'attacker-unrelated' ? 'bs12-089-ally' : 'bs12-089-source'}"] .card-face[aria-label^="選擇攻擊目標："]`).click()
            if (scenario === 'attacker-lv2') {
              const panel = page.locator('.effect-panel:not(.is-complete):visible')
              await panel.waitFor()
              assert.match(await panel.innerText(), /原受攻擊.*不能改選/)
              const target = panel.locator('.effect-candidates-target .effect-candidate-entry > button')
              if (await target.count()) await target.click()
              await shot('then')
              await panel.getByRole('button', { name: '確認發動', exact: true }).click()
            } else if (scenario === 'attacker-unrelated') {
              const modal = page.locator('.optional-cost-attack-inline:visible')
              await modal.waitFor()
              await modal.getByRole('button', { name: '支付', exact: true }).click()
              await modal.locator('.modal-card-options > button').click()
              await shot('then-cost')
              await modal.getByRole('button', { name: '確認', exact: true }).click()
            }
            if (scenario !== 'attacker-lv5') await waitEffect()
            else await page.waitForFunction(() => !document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="bs12-089-source"]'))
            if (scenario === 'attacker-lv2') await waitHp('top', 'bs12-089-source', 1)
            if (scenario === 'attacker-unrelated') await waitHp('top', 'bs12-089-ally', 1)
            await settle(page)
            const after = await state(page)
            assert.deepEqual(after.top.battle.map(cookie => cookie.hp), ['attacker-lv3', 'attacker-all-opponents'].includes(scenario) ? [2, 5] : scenario === 'attacker-lv2' ? [1, 5] : scenario === 'attacker-unrelated' ? [5, 1] : [5])
            assert.equal(after.bottom.hand, scenario === 'attacker-unrelated' ? 0 : 1)
            assert.equal(after.bottom.trash, scenario === 'attacker-unrelated' ? 1 : 0)
            assert.equal(await page.locator('.optional-cost-attack-inline:visible').count(), 0)
            assert.equal(await page.locator('.effect-panel:not(.is-complete):visible').count(), 0)
            if (['attacker-lv3', 'attacker-faints', 'attacker-all-opponents'].includes(scenario)) assert.match((await trace(page)).map(entry => entry.steps?.join(' ')).join(' '), /Werewolf Cookie.*LV\.3.*本次戰鬥.*無法發動/)
          } else if (blockCases.includes(scenario) || ['lv2', 'lv5'].includes(scenario)) {
            let dialog = await openBlock()
            const costs = () => dialog.getByRole('group', { name: 'Blocker 手牌代價' }).getByRole('button')
            const confirm = () => dialog.getByRole('button', { name: '使用 Blocker', exact: true })
            assert.equal(await confirm().isEnabled(), false)
            assert.equal(await costs().count(), scenario === 'select-second' ? 2 : 1)
            const skipped = ['block-skip', 'cancel-block', 'back'].includes(scenario)
            if (scenario !== 'block-skip') await costs().first().click()
            assert.deepEqual(await state(page), result.before)
            assert.deepEqual(await trace(page), result.beforeTrace)
            if (scenario === 'deselect') { await costs().first().click(); assert.equal(await confirm().isEnabled(), false); await costs().first().click() }
            if (scenario === 'select-second') { assert.equal(await costs().nth(1).isEnabled(), false); await costs().first().click(); await costs().nth(1).click() }
            if (scenario === 'minimize') { await dialog.getByRole('button', { name: '縮小', exact: true }).click(); await page.locator('.card-reveal-dock:visible').click(); assert.equal(await costs().first().getAttribute('aria-pressed'), 'true') }
            if (['back', 'back-paid'].includes(scenario)) { await dialog.getByRole('button', { name: '返回', exact: true }).click(); dialog = await openBlock(); assert.equal(await confirm().isEnabled(), false); if (scenario === 'back-paid') await costs().first().click() }
            await shot('block-cost')
            await dialog.getByRole('button', { name: skipped ? '不使用' : '使用 Blocker', exact: true }).click()
            if (scenario !== 'lv5') await waitEffect()
            else await page.waitForFunction(() => !document.querySelector('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-089-source"]'))
            if (skipped) await waitHp('bottom', 'bs12-089-ally', 1)
            if (scenario === 'lv2') await waitHp('bottom', 'bs12-089-source', 1)
            await settle(page)
            const after = await state(page)
            assert.deepEqual(after.bottom.battle.map(cookie => cookie.hp), skipped ? [5, 1] : scenario === 'lv2' ? [1, 5] : ['lv5', 'second-response'].includes(scenario) ? [5] : [2, 5])
            assert.equal(after.bottom.hand, result.before.bottom.hand - (skipped ? 0 : 1))
            assert.equal(after.top.hand, skipped ? 0 : 1)
            assert.deepEqual(after.bottom.support, result.before.bottom.support)
            assert.equal(after.bottom.deck, 12)
            if (!skipped && !['lv2', 'lv5'].includes(scenario)) assert.match((await trace(page)).map(entry => entry.steps?.join(' ')).join(' '), /Werewolf Cookie.*LV\.3.*無法發動/)
          } else if (unavailable.includes(scenario) || autoCases.includes(scenario)) {
            if (['unrelated', 'second-battle'].includes(scenario)) await page.getByRole('alertdialog').getByRole('button', { name: '不發動', exact: true }).click()
            await waitEffect()
            if (!['direct-attack', 'faints'].includes(scenario)) await waitHp('bottom', 'bs12-089-ally', 1)
            await settle(page)
            const after = await state(page)
            const suppressed = ['direct-attack', 'faints'].includes(scenario)
            assert.deepEqual(after.bottom.battle.map(cookie => cookie.hp), scenario === 'faints' ? [5] : scenario === 'second-battle' ? [2, 1] : ['support-source', 'hand-source'].includes(scenario) ? [1] : suppressed ? [2, 5] : [5, 1])
            assert.equal(after.top.hand, suppressed ? 1 : 0)
            assert.equal((await trace(page)).filter(entry => entry.commandKind === 'play-blocker').length, scenario === 'second-battle' ? 1 : 0)
          } else if (scenario === 'redirect-away') {
            const dialog = await openBlock('Peperoncino Cookie')
            await shot('other-blocker')
            await dialog.getByRole('button', { name: '使用 Blocker', exact: true }).click()
            await waitEffect()
            await page.waitForFunction(() => !document.querySelector('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-089-ally"]'))
            await settle(page)
            const after = await state(page)
            assert.deepEqual(after.bottom.battle.map(cookie => cookie.hp), [5])
            assert.equal(after.bottom.hand, 1)
            assert.equal(after.top.hand, 0)
            assert.doesNotMatch((await trace(page)).map(entry => entry.steps?.join(' ')).join(' '), /Werewolf Cookie.*無法發動/)
          } else if (scenario.startsWith('flip-')) {
            const modal = page.locator('.flip-response-modal')
            await modal.waitFor()
            if (scenario === 'flip-skip') await modal.getByRole('button', { name: '不發動', exact: true }).click()
            else {
              await modal.locator('.flip-hand-carousel').getByRole('button', { name: 'Currant Cream Cookie Currant Cream Cookie', exact: true }).click()
              await modal.getByRole('group', { name: 'FLIP 效果目標' }).getByRole('button').filter({ hasText: 'Werewolf Cookie' }).click()
              await shot('flip-cost-and-target')
              await modal.getByRole('button', { name: '發動 FLIP', exact: true }).click()
            }
            await waitEffect()
            await settle(page)
            const after = await state(page)
            assert.deepEqual(after.bottom.battle.map(cookie => cookie.hp), scenario === 'flip-rescue' ? [1, 5] : [5])
            assert.equal(after.top.hand, 1)
          } else if (scenario === 'zero-damage') {
            const modal = page.getByRole('alertdialog')
            await modal.locator('.modal-card-options > button').filter({ hasText: 'Clumsy Day' }).click()
            await modal.locator('.trap-guided-section .trap-discard-options > button').click()
            await modal.getByRole('button', { name: '下一步', exact: true }).click()
            const costs = modal.locator('.trap-position-cost .modal-card-options > button')
            await costs.nth(0).click(); await costs.nth(1).click()
            await modal.getByRole('button', { name: '下一步', exact: true }).click()
            await modal.locator('.trap-effect-target-step .trap-target-options > button').filter({ hasText: 'Banana Roti Cookie' }).click()
            await shot('trap-zero')
            await modal.getByRole('button', { name: '確認發動', exact: true }).click()
            await waitEffect()
            await settle(page)
            const after = await state(page)
            assert.deepEqual(after.bottom.battle.map(cookie => cookie.hp), [5, 5])
            assert.equal(after.top.hand, 1)
            assert.equal(after.bottom.trash, 1)
          }
          result.after = await state(page)
          result.trace = await trace(page)
          if (['response', 'wrong-color'].includes(scenario)) {
            await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
            const log = page.getByRole('complementary', { name: '對戰紀錄側欄' })
            await log.getByRole('button', { name: /Banana Roti Cookie 攻擊/ }).first().click()
            const text = await log.innerText()
            if (scenario === 'response') {
              assert.match(text, /Blocker 代價：棄置手牌：Currant Cream Cookie/)
              assert.match(text, /Werewolf Cookie.*LV\.3.*本次戰鬥.*無法發動/)
              assert.match(text, /未支付後續代價/)
            } else {
              assert.match(text, /Langue de Chat Cookie/)
              assert.match(text, /受到 1 點傷害/)
              assert.doesNotMatch(text, /Werewolf Cookie.*無法發動/)
            }
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
  console.log(`BS12-089 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
