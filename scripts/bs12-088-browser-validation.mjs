import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-088-browser')
mkdirSync(out, { recursive: true })
const candidate=JSON.parse(readFileSync(resolve(root,'data/cards/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal=readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards=[...candidate,...formal].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const records=cards
const requiredCards=cards.map(card=>({card,path:resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')}))
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
const blocked = ['no-hand', 'wrong-color', 'non-arena', 'split-cost']
const faintCases = ['faint-two', 'faint-one', 'faint-zero', 'faint-skip', 'faint-deselect', 'faint-minimize', 'faint-red-item', 'faint-purple-trap', 'only-block-cost', 'no-faint-cost', 'direct-attack', 'short-deck', 'refresh-defeat', 'lv10-defeat', 'flip-skip']
const cases = ['response', 'item-cost', 'stage-cost', 'trap-cost', 'rested-source', 'second-response', ...blocked, 'block-skip', 'cancel-block', 'back', 'back-paid', 'minimize', 'deselect', 'select-second', ...faintCases, 'flip-rescue', ...ordinary]
const routeCase = scenario => ['block-skip', 'cancel-block', 'back', 'back-paid', 'minimize', 'deselect'].includes(scenario) ? 'response'
  : scenario.startsWith('flip-') ? 'last-hp-flip' : scenario === 'select-second' ? 'twice' : ['cancel-payment', 'cancel-target'].includes(scenario) ? 'attack' : scenario.startsWith('faint-') && !['faint-red-item', 'faint-purple-trap'].includes(scenario) ? 'faint' : scenario
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const number of ['BS12-088', 'BS12-088@1'].filter(value => !process.env.BS12_BROWSER_NUMBERS || process.env.BS12_BROWSER_NUMBERS.split(',').includes(value)))
    for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }])
      for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
        const page = await browser.newPage({ viewport })
        const result = { number, scenario, viewport, printedSourceAttested: true, status: 'FAIL', errors: [], networkFailures: [] }
        page.on('pageerror', error => result.errors.push(error.message))
        page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
        page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText }))
        const shot = label => page.screenshot({ path: resolve(out, `${number.replace('@', '-')}-${scenario}-${viewport.width}-${label}.png`) })
        const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-088-source"]')
        const modalFits = async dialog => {
          const box = await dialog.boundingBox()
          assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1)
        }
        const checkArt = async locator => {
          const sourceRecord = records.find(card => card.cardNumber === number)
          await locator.evaluate(image => image.decode())
          assert.equal(await locator.getAttribute('src'), sourceRecord.imageUrl)
          assert.ok(await locator.evaluate(image => image.naturalWidth > 300 && image.naturalHeight > 400))
        }
        const openBlock = async () => {
          await page.getByRole('alertdialog').getByRole('button', { name: 'Black Sapphire Cookie Black Sapphire Cookie', exact: true }).click()
          const dialog = page.locator('.blocker-response-modal')
          await dialog.waitFor()
          await modalFits(dialog)
          assert.match(await dialog.innerText(), /Blocker/)
          assert.equal(await dialog.locator('img[alt="紫色能量"]').count(), 1)
          assert.doesNotMatch(await dialog.innerText(), /\{P\}|REST|每回合一次/)
          return dialog
        }
        const payBlock = async (second = false) => {
          const dialog = await openBlock()
          const cost = dialog.getByRole('group', { name: 'Blocker 手牌代價' }).getByRole('button')
          await cost.nth(second ? 1 : 0).click()
          await dialog.getByRole('button', { name: '使用 Blocker', exact: true }).click()
        }
        try {
          for (const { card, path } of requiredCards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(path) }))
          result.testState=process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='response'?'card:'+number:process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='non-arena'?'card-negative:'+number:'bs12-088:'+number+':'+routeCase(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state='+result.testState+'&contract-card='+cards.map(card=>card.cardNumber).join(','))
          await page.locator('.game-shell').waitFor()
          await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
          if (blocked.includes(scenario)) await page.waitForFunction(() => document.querySelector('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-088-ally"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 3 張'))
          else if (!ordinary.includes(scenario)) await page.getByRole('alertdialog').waitFor()
          await settle(page)
          result.before = await state(page)
          result.beforeTrace = await trace(page)
          assert.ok(result.before.bottom.battle.length <= 2 && result.before.top.battle.length <= 2)
          if (scenario !== 'deploy' && scenario !== 'direct-attack') await checkArt(source.locator('img[alt="Black Sapphire Cookie"]').first())
          if (scenario === 'deploy') {
            const hand = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator('img[alt="Black Sapphire Cookie"]') })
            await checkArt(hand.locator('img[alt="Black Sapphire Cookie"]').first())
            await hand.locator('button.card-face').click()
            await hand.getByRole('button', { name: '登場', exact: true }).click()
            await source.waitFor()
            await settle(page)
            const after = await state(page)
            assert.deepEqual(after.bottom.battle.map(card => card.hp), [4, 3])
            assert.equal(after.bottom.deck, 9)
            assert.equal(after.bottom.hand, 0)
            assert.equal((await trace(page)).some(entry => entry.commandKind === 'play-blocker' || entry.commandKind === 'resolve-faint-effect'), false)
          } else if (ordinary.includes(scenario)) {
            if (!['attack', 'cancel-payment', 'cancel-target'].includes(scenario)) {
              assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
              assert.deepEqual(await state(page), result.before)
              assert.deepEqual(await trace(page), result.beforeTrace)
            } else {
              await source.locator('.card-face.is-attackable').click()
              if (scenario !== 'cancel-payment') for (const i of [0, 1]) await page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="bs12-088-payment-${i}"] .card-face`).click()
              await shot('payment')
              if (scenario !== 'attack') {
                await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
                assert.deepEqual(await state(page), result.before)
                assert.deepEqual(await trace(page), result.beforeTrace)
              } else {
                await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-088-attacker"] .card-face[aria-label^="選擇攻擊目標："]').click()
                await page.waitForFunction(() => document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="bs12-088-attacker"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 1 張'))
                await settle(page)
                const after = await state(page)
                assert.deepEqual(after.top.battle.map(card => card.hp), [1, 2])
                assert.deepEqual(after.bottom.support.map(support => support.rested), [true, true, false])
                assert.equal(after.bottom.battle[0].hp, 3)
                assert.equal(after.bottom.battle[0].rested, true)
                assert.equal(after.bottom.trash, 0)
                assert.equal(after.bottom.deck, 12)
                assert.equal((await trace(page)).some(entry => entry.commandKind === 'play-blocker' || entry.commandKind === 'resolve-faint-effect'), false)
              }
            }
          } else if (blocked.includes(scenario)) {
            assert.equal(await page.locator('.blocker-response-modal').count(), 0)
            assert.deepEqual(result.before.bottom.battle.map(card => card.hp), [3, 3])
            assert.equal(result.before.bottom.trash, 1)
            assert.equal((await trace(page)).some(entry => entry.commandKind === 'play-blocker'), false)
          } else if (scenario === 'flip-rescue') {
            await payBlock()
            const flip = page.locator('.flip-response-modal')
            await flip.waitFor()
            await modalFits(flip)
            assert.equal(await page.locator('.faint-response-modal').count(), 0)
            assert.equal((await state(page)).bottom.breakCount, 0)
            await flip.locator('.flip-hand-carousel').getByRole('button', { name: 'GingerBrave GingerBrave', exact: true }).click()
            const targets = flip.getByRole('group', { name: 'FLIP 效果目標' }).getByRole('button')
            assert.equal(await targets.count(), 2)
            assert.deepEqual((await targets.allTextContents()).map(text => text.trim()).sort(), ['Black Sapphire Cookie', 'Muscle Cookie'])
            await targets.getByText('Black Sapphire Cookie', { exact: true }).click()
            await shot('flip-rescue')
            await flip.getByRole('button', { name: '發動 FLIP', exact: true }).click()
            await page.waitForFunction(() => document.querySelector('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-088-source"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 1 張'))
            await settle(page)
            const after = await state(page)
            assert.deepEqual(after.bottom.battle.map(card => card.hp), [1, 4])
            assert.equal(after.bottom.breakCount, 0)
            assert.equal(after.bottom.deck, 11)
            assert.equal(after.bottom.hand, 0)
            assert.equal(after.bottom.trash, 5)
            assert.deepEqual(after.bottom.support, result.before.bottom.support)
            assert.deepEqual(after.top, result.before.top)
            assert.equal((await trace(page)).filter(entry => entry.commandKind === 'resolve-flip').length, 1)
            assert.equal((await trace(page)).some(entry => ['resolve-faint-effect', 'resolve-draw-up-to'].includes(entry.commandKind)), false)
          } else if (faintCases.includes(scenario)) {
            if (scenario !== 'direct-attack') await payBlock()
            if (scenario === 'flip-skip') {
              const flip = page.locator('.flip-response-modal')
              await flip.waitFor()
              assert.equal(await page.locator('.faint-response-modal').count(), 0)
              assert.equal((await state(page)).bottom.breakCount, 0)
              await flip.getByRole('button', { name: '不發動', exact: true }).click()
            }
            if (scenario === 'lv10-defeat') {
              await page.getByRole('button', { name: '查看對戰紀錄', exact: true }).waitFor()
              assert.equal((await state(page)).bottom.hand, 1)
              assert.equal((await trace(page)).some(entry => entry.commandKind === 'resolve-faint-effect'), false)
            } else {
              const dialog = page.locator('.faint-response-modal')
              await dialog.waitFor()
              await settle(page)
              await modalFits(dialog)
              await checkArt(dialog.locator('img[alt="Black Sapphire Cookie"]').first())
              assert.match(await dialog.innerText(), /BS12-088|Black Sapphire Cookie/)
              assert.equal(await dialog.locator('.faint-payment-section').count(), 0)
              const paidBefore = await state(page)
              assert.deepEqual(paidBefore.bottom.battle.map(card => card.hp), [4])
              assert.equal(paidBefore.bottom.breakCount, scenario === 'refresh-defeat' ? 4 : 1)
              const choices = dialog.locator('.faint-cost-hand-candidates > button')
              const unavailable = ['only-block-cost', 'no-faint-cost'].includes(scenario)
              const skip = scenario === 'faint-skip' || unavailable
              if (unavailable) {
                assert.equal(await choices.count(), 0)
                assert.equal(await dialog.getByRole('button', { name: '確認結算', exact: true }).isEnabled(), false)
                assert.match(await dialog.innerText(), /沒有符合條件的手牌，無法支付此效果/)
              } else if (!skip) {
                assert.equal(await choices.count(), scenario === 'direct-attack' ? 2 : 1)
                await choices.last().click()
                assert.deepEqual(await state(page), paidBefore)
                if (scenario === 'faint-deselect') {
                  await choices.last().click()
                  assert.equal(await dialog.getByRole('button', { name: '確認結算', exact: true }).isEnabled(), false)
                  await choices.last().click()
                }
                if (scenario === 'faint-minimize') {
                  await dialog.getByRole('button', { name: '縮小', exact: true }).click()
                  await page.locator('.card-reveal-dock:visible').click()
                  assert.equal(await choices.last().getAttribute('aria-pressed'), 'true')
                }
              }
              await shot('faint-cost')
              await dialog.getByRole('button', { name: skip ? '不發動' : '確認結算', exact: true }).click()
              if (!skip) {
                const draw = page.locator('.draw-up-to-modal')
                await draw.waitFor()
                await checkArt(draw.locator('img[alt="Black Sapphire Cookie"]').first())
                await modalFits(draw)
                const count = scenario === 'faint-zero' ? 0 : scenario === 'faint-one' ? 1 : 2
                if (count) await draw.getByRole('button', { name: new RegExp(`^抽 ${count} 張`) }).click()
                await shot('draw')
                await draw.getByRole('button', { name: count ? `抽取 ${count} 張牌` : '略過抽牌', exact: true }).click()
                if (['short-deck', 'refresh-defeat'].includes(scenario)) {
                  const refresh = page.getByRole('alertdialog')
                  await refresh.getByRole('button', { name: 'Currant Cream Cookie Currant Cream Cookie', exact: true }).click()
                }
              }
              if (scenario === 'refresh-defeat') await page.getByRole('button', { name: '查看對戰紀錄', exact: true }).waitFor()
              else {
                await page.getByRole('button', { name: '不補餅乾', exact: true }).click()
                await settle(page)
              }
              const after = await state(page)
              if (!skip && scenario !== 'refresh-defeat') {
                const drawn = scenario === 'faint-zero' ? 0 : scenario === 'faint-one' ? 1 : 2
                assert.equal(after.bottom.hand, drawn + (scenario === 'direct-attack' ? 1 : 0))
                assert.equal(after.bottom.deck, scenario === 'short-deck' ? 3 : 12 - drawn)
                assert.equal(after.bottom.trash, scenario === 'short-deck' ? 0 : scenario === 'direct-attack' ? 4 : 5)
              } else if (skip) {
                assert.equal(after.bottom.hand, paidBefore.bottom.hand)
                assert.equal(after.bottom.deck, paidBefore.bottom.deck)
                assert.equal(after.bottom.trash, paidBefore.bottom.trash)
              }
              assert.deepEqual(after.bottom.support, result.before.bottom.support)
              assert.deepEqual(after.top, result.before.top)
              assert.equal((await trace(page)).filter(entry => entry.commandKind === 'resolve-faint-effect').length, 1)
              assert.equal((await trace(page)).filter(entry => entry.commandKind === 'resolve-draw-up-to').length, skip ? 0 : 1)
              if (!skip) assert.match((await trace(page)).find(entry => entry.commandKind === 'resolve-faint-effect').steps.join(' '), /棄置.*手牌|手牌.*棄置/)
            }
          } else {
            let dialog = await openBlock()
            const cost = () => dialog.getByRole('group', { name: 'Blocker 手牌代價' }).getByRole('button')
            const confirm = () => dialog.getByRole('button', { name: '使用 Blocker', exact: true })
            assert.equal(await confirm().isEnabled(), false)
            assert.equal(await cost().count(), ['select-second', 'twice'].includes(scenario) ? 2 : 1)
            const skipped = ['block-skip', 'cancel-block', 'back'].includes(scenario)
            if (scenario !== 'block-skip') await cost().first().click()
            assert.deepEqual(await state(page), result.before)
            assert.deepEqual(await trace(page), result.beforeTrace)
            if (scenario === 'deselect') {
              await cost().first().click()
              assert.equal(await confirm().isEnabled(), false)
              await cost().first().click()
            } else if (scenario === 'select-second') {
              assert.equal(await cost().nth(1).isEnabled(), false)
              await cost().first().click()
              await cost().nth(1).click()
            } else if (scenario === 'minimize') {
              await dialog.getByRole('button', { name: '縮小', exact: true }).click()
              await page.locator('.card-reveal-dock:visible').click()
              assert.equal(await cost().first().getAttribute('aria-pressed'), 'true')
            } else if (['back', 'back-paid'].includes(scenario)) {
              await dialog.getByRole('button', { name: '返回', exact: true }).click()
              dialog = await openBlock()
              assert.equal(await confirm().isEnabled(), false)
              if (scenario === 'back-paid') await cost().first().click()
            }
            await shot('block-cost')
            await dialog.getByRole('button', { name: skipped ? '不使用' : '使用 Blocker', exact: true }).click()
            await page.waitForFunction(({ skip, second }) => document.querySelector(`.bottom-field .combat-card-wrap[data-card-instance-id="${skip ? 'bs12-088-ally' : 'bs12-088-source'}"] .hp-card-stack`)?.getAttribute('aria-label')?.includes(`HP 卡 ${skip ? 3 : second ? 1 : 2} 張`), { skip: skipped, second: scenario === 'second-response' })
            await settle(page)
            const after = await state(page)
            assert.deepEqual(after.bottom.battle.map(card => card.hp), skipped ? [3, 3] : scenario === 'second-response' ? [1, 4] : [2, 4])
            assert.equal(after.bottom.hand, result.before.bottom.hand - (skipped ? 0 : 1))
            assert.equal(after.bottom.trash, result.before.bottom.trash + (skipped ? 1 : 2))
            assert.equal(after.bottom.deck, 12)
            assert.deepEqual(after.bottom.support, result.before.bottom.support)
            assert.deepEqual(after.top, result.before.top)
            assert.equal((await trace(page)).filter(entry => entry.commandKind === 'play-blocker').length, scenario === 'second-response' ? 2 : skipped ? 0 : 1)
            if (!skipped) assert.match((await trace(page)).find(entry => entry.commandKind === 'play-blocker').steps[0], /Blocker 代價：棄置手牌/)
          }
          result.after = await state(page)
          result.trace = await trace(page)
          if (scenario === 'faint-two') {
            await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
            const log = page.getByRole('complementary', { name: '對戰紀錄側欄' })
            await log.getByRole('button', { name: /Onion Cookie 攻擊/ }).click()
            const text = await log.innerText()
            assert.match(text, /Blocker 代價：棄置手牌：Currant Cream Cookie/)
            assert.match(text, /昏厥效果代價：棄置手牌：GingerBrave/)
            assert.match(text, /抽牌結果：抽了 2 張牌/)
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
  console.log(`BS12-088 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
