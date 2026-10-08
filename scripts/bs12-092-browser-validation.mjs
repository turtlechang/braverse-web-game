import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-092-browser')
mkdirSync(out, { recursive: true })
const records = ['data/cards/official-festival-arena-bs12.en.json', ...readdirSync(resolve(root, 'data/cards')).filter(f => f.endsWith('.json')).map(f => `data/cards/${f}`)]
  .flatMap(path => JSON.parse(readFileSync(resolve(root, path), 'utf8')).cards ?? [])
const required = records.map(record=>({record,path:['bs12-official-art','bs11-official-art'].map(dir=>resolve(root,'test-results/'+dir+'/'+record.cardNumber+'.webp')).find(existsSync)})).filter(entry=>entry.path)
for(const entry of required)assert.ok(entry.record.imageUrl&&existsSync(entry.path))
const cards=required.map(entry=>entry.record)
const state = page => page.evaluate(() => {
  const side = id => {
    const field = document.querySelector(`.battle-row[data-animation-player="${id}"]`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'),
      hand: Number(field?.querySelector('[aria-label^="手牌 "]')?.getAttribute('aria-label')?.match(/手牌 (\d+)/)?.[1] ?? NaN),
      breakCount: Number(field?.querySelector('.break-zone .zone-heading b')?.textContent?.match(/\d+/)?.[0] ?? 0),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(n => ({ id: n.getAttribute('data-card-instance-id'), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN), rested: n.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(n => ({ id: n.getAttribute('data-card-instance-id'), rested: n.querySelector('.card-face')?.classList.contains('is-rested') ?? false })) }
  }
  return { own: side('player-one'), enemy: side('player-two') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, summary: e.summary, steps: e.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') && ![...document.querySelectorAll('button')].some(b => b.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
const entryPositive = ['extra', 'extra-lv1', 'extra-non-arena', 'extra-rested', 'extra-full', 'entry-deselect', 'entry-back', 'entry-minimize', 'close-extra']
const entryNegative = ['break-two', 'split-break', 'non-arena-blocker', 'wrong-zones', 'cost-red', 'cost-lv3', 'no-cost', 'outside-main', 'extra-used', 'extra-opponent-turn']
const attacks = ['attack', 'first-player', 'then-one', 'then-zero', 'wrong-energy', 'few-energy', 'rested-energy', 'cancel-payment', 'cancel-target', 'discard-deselect', 'discard-minimize']
const faints = ['friendly-faint', 'hand-two', 'source-rested', 'source-faint', 'faint-minimize', 'faint-discard-deselect', 'faint-discard-minimize', 'flip-rescue', 'flip-skip']
const cases = [...entryPositive, ...entryNegative, ...attacks, ...faints]
const routeCase = c => c.startsWith('entry-') || c === 'close-extra' ? 'extra-full'
  : ['cancel-payment', 'cancel-target', 'discard-deselect', 'discard-minimize'].includes(c) ? 'attack'
    : c.startsWith('faint-') ? 'friendly-faint' : c.startsWith('flip-') ? 'last-hp-flip' : c
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const number of ['BS12-092', 'BS12-092@1'].filter(n => !process.env.BS12_BROWSER_NUMBERS || process.env.BS12_BROWSER_NUMBERS.split(',').includes(n)))
    for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }])
      for (const scenario of cases.filter(c => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(c))) {
        const page = await browser.newPage({ viewport })
        page.setDefaultTimeout(15000)
        const row = { number, scenario, viewport, printedSourceAttested: scenario!=='extra-used', status: 'FAIL', errors: [], networkFailures: [] }
        page.on('pageerror', e => row.errors.push(e.message))
        page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
        page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
        const shot = label => page.screenshot({ path: resolve(out, `${number.replace('@', '-')}-${scenario}-${viewport.width}-${label}.png`) })
        const source = page.locator('.battle-row[data-animation-player="player-one"] .combat-card-wrap[data-card-instance-id="bs12-092-source"]')
        const checkArt = async img => {
          await img.evaluate(i => i.decode())
          assert.equal(await img.getAttribute('src'), records.find(c => c.cardNumber === number).imageUrl)
          assert.ok(await img.evaluate(i => i.naturalWidth > 300 && i.naturalHeight > 400))
        }
        const fits = async modal => {
          const b = await modal.boundingBox()
          assert.ok(b && b.x >= 0 && b.y >= 0 && b.x + b.width <= viewport.width + 1 && b.y + b.height <= viewport.height + 1, 'Modal exceeds viewport')
        }
        const finishReplacement = async () => {
          const b = page.getByRole('button', { name: '不補餅乾', exact: true })
          if (await b.count()) await b.click()
        }
        const discard = async c => {
          const modal = page.locator('.hand-discard-modal')
          await modal.waitFor(); await settle(page); await fits(modal); await checkArt(modal.locator('img[alt="Black Lemonade Cookie"]').first())
          assert.match(await modal.innerText(), /必須選擇 1 張手牌棄置/)
          assert.match(await modal.innerText(), c.startsWith('faint-') || c === 'friendly-faint' || c === 'source-rested' || c === 'flip-skip'
            ? /When one of your Cookies faints/ : /Then, if you started the game going second/)
          const baseline = await state(page)
          const choices = modal.locator('.hand-discard-card-option > button')
          assert.equal(await choices.count(), baseline.enemy.hand)
          assert.equal(await modal.getByRole('button', { name: '確認棄置 (0)', exact: true }).isEnabled(), false)
          assert.equal(await modal.getByRole('button', { name: '略過', exact: true }).count(), 0)
          const pick = choices.filter({ hasText: baseline.enemy.hand === 1 ? 'Coming To An Understanding' : 'True Rock Spirit' })
          await pick.click()
          assert.deepEqual(await state(page), baseline)
          if (c.endsWith('deselect')) { await pick.click(); assert.equal(await modal.getByRole('button', { name: '確認棄置 (0)', exact: true }).isEnabled(), false); await pick.click() }
          if (c.endsWith('minimize')) { await modal.getByRole('button', { name: '縮小', exact: true }).click(); await page.locator('.decision-reveal-dock:visible').click(); assert.equal(await pick.getAttribute('class'), 'is-selected') }
          row.beforeOpponentChoice = baseline
          await shot('opponent-choice'); await modal.getByRole('button', { name: '確認棄置 (1)', exact: true }).click()
          await modal.waitFor({ state: 'hidden' }); await settle(page)
          const after = await state(page)
          assert.equal(after.enemy.hand, baseline.enemy.hand - 1); assert.equal(after.enemy.trash, baseline.enemy.trash + 1)
          assert.deepEqual(after.enemy.battle, baseline.enemy.battle); assert.deepEqual(after.own, baseline.own)
          assert.ok((await trace(page)).some(t => t.commandKind === 'resolve-opponent-hand-discard'))
        }
        try {
          for (const { record, path } of required) await page.route(record.imageUrl, r => r.fulfill({ contentType: 'image/webp', body: readFileSync(path) }))
row.testState=process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='extra'?'card:'+number:process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='break-two'?'card-negative:'+number:'bs12-092:'+number+':'+routeCase(scenario)
          row.route=row.testState
          await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card='+required.map(entry=>entry.record.cardNumber).join(','))
          await page.locator('.game-shell').waitFor()
          await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
          await settle(page); row.before = await state(page); row.beforeTrace = await trace(page)
          if ([...entryPositive, ...entryNegative].includes(scenario)) {
            await page.getByRole('button', { name: '玩家 EXTRA Deck 1 張', exact: true }).click()
            const extra = page.getByRole('dialog', { name: '玩家 EXTRA Deck', exact: true })
            await extra.waitFor(); await checkArt(extra.locator('img[alt="Black Lemonade Cookie"]').first()); row.originalArtVisible = true
            if (entryNegative.includes(scenario)) {
              assert.equal(await extra.getByRole('button', { name: '從 EXTRA 登場', exact: true }).count(), 0)
              assert.match(await extra.innerText(), /目前無法登場/)
              await shot('entry-blocked'); await page.getByRole('button', { name: '玩家 EXTRA Deck 1 張', exact: true }).click()
              assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
            } else if (scenario === 'close-extra') {
              await page.getByRole('button', { name: '玩家 EXTRA Deck 1 張', exact: true }).click()
              assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
            } else {
              await extra.getByRole('button', { name: '從 EXTRA 登場', exact: true }).click()
              const modal = page.getByRole('alertdialog').filter({ hasText: 'EXTRA 登場代價（必須支付）' })
              await modal.waitFor(); await fits(modal)
              assert.match(await modal.innerText(), /EXTRA 登場代價（必須支付）/)
              assert.equal(await modal.getByRole('button', { name: '略過', exact: true }).count(), 0)
              assert.deepEqual(await state(page), row.before)
              await modal.getByRole('button', { name: '支付代價', exact: true }).click()
              assert.match(await modal.innerText(), /戰鬥區代價/)
              const choice = modal.locator('.modal-card-options > button')
              assert.equal(await choice.count(), 1); assert.equal(await modal.getByRole('button', { name: '確認', exact: true }).isEnabled(), false)
              await choice.click()
              if (scenario === 'entry-deselect') { await choice.click(); assert.equal(await modal.getByRole('button', { name: '確認', exact: true }).isEnabled(), false); await choice.click() }
              if (scenario === 'entry-back') { await modal.getByRole('button', { name: '返回', exact: true }).click(); await modal.getByRole('button', { name: '支付代價', exact: true }).click(); assert.equal(await modal.getByRole('button', { name: '確認', exact: true }).isEnabled(), false); await choice.click() }
              if (scenario === 'entry-minimize') { await modal.getByRole('button', { name: '縮小', exact: true }).click(); await page.locator('.decision-reveal-dock:visible, .effect-panel-dock:visible').click(); assert.equal(await modal.getByRole('button', { name: '確認', exact: true }).isEnabled(), true) }
              assert.deepEqual(await state(page), row.before); await shot('entry-cost')
              await modal.getByRole('button', { name: '確認', exact: true }).click(); await source.waitFor(); await settle(page)
              const after = await state(page)
              assert.equal(after.own.deck, row.before.own.deck - 5); assert.equal(after.own.trash, row.before.own.trash + 1 + row.before.own.battle.find(c=>c.id==='bs12-092-cost').hp)
              assert.equal(after.own.hand, row.before.own.hand); assert.equal(after.own.breakCount, row.before.own.breakCount)
              assert.equal(after.own.battle.find(c => c.id === 'bs12-092-source').hp, 5); assert.equal(after.own.battle.some(c => c.id === 'bs12-092-cost'), false)
              assert.equal(after.own.battle.length, row.before.own.battle.length); assert.deepEqual(after.own.support, row.before.own.support); assert.deepEqual(after.enemy, row.before.enemy)
              assert.equal(await page.getByRole('button', { name: '玩家 EXTRA Deck 0 張', exact: true }).count(), 1)
              assert.deepEqual((await trace(page)).map(t => t.commandKind), ['play-extra-deck-cookie', 'resolve-optional-cost-attack'])
              assert.match((await trace(page)).flatMap(t => t.steps ?? []).join(' '), /棄牌區/)
              await checkArt(source.locator('img').first())
            }
          } else if (attacks.includes(scenario)) {
            await checkArt(source.locator('img').first()); row.originalArtVisible = true
            if (['wrong-energy', 'few-energy', 'rested-energy'].includes(scenario)) {
              assert.equal(await source.locator('.card-face.is-attackable').count(), 0); assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
            } else {
              await source.locator('.card-face.is-attackable').click()
              for (const i of scenario === 'cancel-payment' ? [0] : [0, 1, 2, 3]) await page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="bs12-092-payment-${i}"] .card-face`).click()
              await shot('attack-payment')
              if (scenario.startsWith('cancel-')) {
                await page.getByRole('button', { name: '取消攻擊', exact: true }).click(); assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
              } else {
                await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-092-opponent"] .card-face[aria-label^="選擇攻擊目標："]').click()
                await page.waitForFunction(() => document.querySelector('.battle-row[data-animation-player="player-two"] .combat-card-wrap[data-card-instance-id="bs12-092-opponent"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 1 張'), null, { timeout: 20000 })
                await settle(page)
                assert.deepEqual((await state(page)).own.support.map(s => s.rested), [true, true, true, true])
                const thenConfirm = page.getByRole('button', { name: '確認發動', exact: true })
                if (scenario !== 'first-player') { await thenConfirm.waitFor(); await thenConfirm.click() }
                if (!['first-player', 'then-zero'].includes(scenario)) await discard(scenario)
                else { assert.equal(await page.locator('.hand-discard-modal').count(), 0); assert.equal((await state(page)).enemy.hand, row.before.enemy.hand) }
                assert.deepEqual((await state(page)).enemy.battle.map(c => c.hp), [1, 2])
                assert.equal((await state(page)).enemy.trash, 4 + (['first-player', 'then-zero'].includes(scenario) ? 0 : 1))
                assert.equal((await state(page)).own.battle[0].hp, 5)
              }
            }
          } else {
            await checkArt(page.locator('img[alt="Black Lemonade Cookie"]').first()); row.originalArtVisible = true
            if (scenario.startsWith('flip-')) {
              const flip = page.locator('.flip-response-modal'); await flip.waitFor(); await fits(flip)
              if (scenario === 'flip-skip') await flip.getByRole('button', { name: '不發動', exact: true }).click()
              else {
                await flip.locator('.flip-hand-carousel').getByRole('button', { name: 'Sweet Jams Guitar Sweet Jams Guitar', exact: true }).click()
                await flip.getByRole('group', { name: 'FLIP 效果目標' }).getByRole('button').filter({ hasText: 'Kohlrabi Cookie' }).click()
                await shot('flip-rescue'); await flip.getByRole('button', { name: '發動 FLIP', exact: true }).click(); await settle(page)
                assert.deepEqual((await state(page)).own.battle.map(c => c.hp), [5, 1]); assert.equal((await state(page)).own.breakCount, 0)
                assert.equal((await trace(page)).some(t => t.commandKind === 'resolve-faint-effect'), false)
              }
            }
            if (scenario !== 'flip-rescue') {
              if (['hand-two', 'source-faint'].includes(scenario)) {
                await page.getByRole('button', { name: '不補餅乾', exact: true }).waitFor(); await settle(page)
                assert.equal(await page.locator('.faint-response-modal').count(), 0); assert.equal(await page.locator('.hand-discard-modal').count(), 0)
                assert.equal((await state(page)).enemy.hand, row.before.enemy.hand)
              } else {
                const modal = page.locator('.faint-response-modal'); await modal.waitFor(); await settle(page); await fits(modal)
                await checkArt(modal.locator('img[alt="Black Lemonade Cookie"]').first()); assert.match(await modal.innerText(), /When one of your Cookies faints/)
                assert.equal((await state(page)).own.battle.length, 1); assert.equal((await state(page)).own.battle[0].hp, 5)
                if (scenario === 'faint-minimize') { await modal.getByRole('button', { name: '縮小', exact: true }).click(); await page.locator('.decision-reveal-dock:visible').click() }
                await shot('friendly-faint'); await modal.getByRole('button', { name: '確認結算', exact: true }).click(); await discard(scenario)
              }
              await finishReplacement(); await settle(page)
              assert.equal((await state(page)).own.breakCount, 1)
              assert.equal(await page.getByRole('button', { name: '不補餅乾', exact: true }).count(), 0)
            }
          }
          row.after = await state(page); row.trace = await trace(page)
          if (['extra-full', 'attack', 'friendly-faint', 'hand-two', 'first-player'].includes(scenario)) {
            await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
            const log = page.getByRole('complementary', { name: '對戰紀錄側欄' })
            const button = log.getByRole('button').filter({ hasText: scenario === 'extra-full' ? 'EXTRA' : '攻擊' }).first()
            await button.click(); row.visiblePublicLog = await log.innerText()
            assert.match(row.visiblePublicLog, scenario === 'extra-full' ? /棄牌區/ : /宣告攻擊/)
            if (scenario === 'attack' || scenario === 'friendly-faint') assert.match(row.visiblePublicLog, /已棄置 1 張手牌至棄牌區：True Rock Spirit/)
            if (scenario === 'first-player') assert.match(row.visiblePublicLog, /條件不成立/)
            await shot('public-log'); await page.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
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
          await shot('failed').catch(() => {}); results.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'), JSON.stringify(results, null, 2)); throw error
        } finally { await page.close() }
        results.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'), JSON.stringify(results, null, 2)); console.log(`PASS ${number} ${scenario} ${viewport.width}x${viewport.height}`)
      }
  console.log(`BS12-092 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
