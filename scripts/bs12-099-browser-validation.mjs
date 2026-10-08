import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url))), require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-099-browser')
mkdirSync(out, { recursive: true })
const records = ['data/cards/official-festival-arena-bs12.en.json', ...readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json')).map(file => `data/cards/${file}`)]
  .flatMap(path => JSON.parse(readFileSync(resolve(root, path), 'utf8')).cards ?? [])
const art=records.map(record=>({record,path:['bs12-official-art','bs11-official-art'].map(dir=>resolve(root,'test-results/'+dir+'/'+record.cardNumber+'.webp')).find(existsSync)})).filter(entry=>entry.path)
for(const entry of art)assert.ok(entry.record.imageUrl&&existsSync(entry.path))
const cards=art.map(entry=>entry.record)
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`), count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'), hand: field?.querySelectorAll('.hand-card').length ?? 0,
      breakCount: Number(field?.querySelector('.break-zone .zone-heading b')?.textContent?.match(/\d+/)?.[0] ?? 0),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'), hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN), rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'), rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
    }
  }
  return { own: side('bottom'), enemy: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({ commandKind: entry.commandKind, summary: entry.summary, steps: entry.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') && ![...document.querySelectorAll('button')].some(button => button.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
const ordinary = ['attack', 'deploy', 'wrong-energy', 'few-energy', 'rested-energy', 'attack-rested', 'opponent-turn', 'outside-main', 'spare-energy', 'cancel-payment', 'cancel-target', 'non-faint-trash', 'cancel-special', 'non-faint-hand', 'cancel-return']
const blockedTargets = ['non-arena', 'wrong-color', 'split', 'zero-target', 'zones']
const refreshes = ['short-deck', 'empty-deck', 'exact-deck', 'refresh-defeat']
const cases = ['faint', 'old-target', 'old-target-choice', 'same-name', 'lv-one', ...blockedTargets, 'own-turn', 'rested-source', 'hand-and-support', ...refreshes,
  'unpayable', 'effect-damage', 'direct-faint', 'cost-skip', 'paid-zero', 'deselect-target', 'minimize-cost', 'minimize-target', 'flip-rescue', 'flip-skip', ...ordinary]
const route = scenario => ['old-target-choice', 'cost-skip'].includes(scenario) ? 'old-target'
  : ['paid-zero', 'deselect-target', 'minimize-cost', 'minimize-target'].includes(scenario) ? 'faint'
    : scenario.startsWith('flip-') ? 'last-hp-flip' : ['cancel-payment', 'cancel-target'].includes(scenario) ? 'attack'
      : scenario === 'cancel-special' ? 'non-faint-trash' : scenario === 'cancel-return' ? 'non-faint-hand' : scenario
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }])
    for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
      const page = await browser.newPage({ viewport }), row = { number: 'BS12-099', scenario, viewport, printedSourceAttested:true,status:'FAIL', errors: [], networkFailures: [] }
      page.on('pageerror', error => row.errors.push(error.message))
      page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()) })
      page.on('requestfailed', request => row.networkFailures.push({ url: request.url(), error: request.failure()?.errorText }))
      const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
      const fits = async dialog => { const box = await dialog.boundingBox(); assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1) }
      const checkArt = async locator => { await locator.evaluate(image => image.decode()); assert.equal(await locator.getAttribute('src'), records.find(card => card.cardNumber === 'BS12-099').imageUrl); assert.ok(await locator.evaluate(image => image.naturalWidth === 746 && image.naturalHeight === 1038)); row.originalArtVisible = true }
      const replacement = async required => {
        const skip = page.getByRole('button', { name: '不補餅乾', exact: true })
        if (required) await skip.waitFor()
        if (await skip.isVisible()) await skip.click()
        await settle(page)
      }
      const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-099-source"]')
      try {
        for (const card of art) await page.route(card.record.imageUrl, route => route.fulfill({ path: card.path, contentType: 'image/webp' }))
        row.testState=process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='faint'?'card:BS12-099':process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='unpayable'?'card-negative:BS12-099':'bs12-099:'+route(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card='+cards.map(c=>c.cardNumber).join(','))
        await page.locator('.game-shell').waitFor(); await settle(page)
        const modal = page.locator('.faint-response-modal')
        if (ordinary.includes(scenario)) {
          if (scenario === 'deploy') await checkArt(page.locator('.bottom-field .hand-card img[alt="Cake Hound"]'))
          else await checkArt(source.locator('img[alt="Cake Hound"]'))
          row.before = await state(page); row.beforeTrace=await trace(page)
          if (scenario === 'deploy') {
            const hand = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator('img[alt="Cake Hound"]') }); await hand.locator('button.card-face').click(); await hand.getByRole('button', { name: '登場', exact: true }).click()
            await source.waitFor(); await settle(page); const after = await state(page)
            assert.deepEqual(after.own.battle.map(c => ({id:c.id,hp:c.hp})), [{id:'bs12-099-ally',hp:4},{id:'bs12-099-source',hp:2}]); assert.equal(after.own.deck, 10); assert.equal(after.own.hand, 0); assert.equal(after.own.trash, 0)
          } else if (['non-faint-hand','cancel-return'].includes(scenario)) {
            const hand=page.locator('.bottom-field .hand-card-wrap').filter({has:page.locator('img[alt="Emergency Lifebuoy"]')});await hand.locator('button.card-face').click();await hand.getByRole('button',{name:'使用',exact:true}).click()
            const panel=page.locator('.effect-panel:visible');await panel.waitFor();await fits(panel);const next=panel.getByRole('button',{name:'下一步',exact:true});assert.equal(await next.isEnabled(),false)
            await panel.locator('.effect-candidates-payment .effect-candidate-entry > button').click();await next.click()
            const target=panel.locator('.effect-candidates-target .effect-candidate-entry > button').filter({has:page.locator('img[alt="Cake Hound"]')});await target.click();await shot('return-target')
            if(scenario==='cancel-return'){await panel.getByRole('button',{name:'取消技能',exact:true}).click();assert.deepEqual(await state(page),row.before);assert.deepEqual(await trace(page),row.beforeTrace)}
            else{await panel.getByRole('button',{name:'確認發動',exact:true}).click();await source.waitFor({state:'hidden'});await replacement(false);const after=await state(page);assert.deepEqual(after.own.battle.map(c=>c.hp),[4]);assert.equal(after.own.hand,1);assert.equal(after.own.deck,12);assert.equal(after.own.trash,3);assert.equal(after.own.breakCount,0);assert.deepEqual(after.own.support.map(c=>c.rested),[true]);assert.equal(await modal.count(),0);assert.equal((await trace(page)).some(e=>e.commandKind==='resolve-faint-effect'),false);assert.equal(await page.locator('.bottom-field .hand-card-wrap img[alt="Cake Hound"]').count(),1)}
          } else if (['non-faint-trash', 'cancel-special'].includes(scenario)) {
            const hand = page.locator('.bottom-field .hand-card-wrap'); await hand.locator('button.card-face').click(); await hand.getByRole('button', { name: '特殊登場', exact: true }).click()
            const special = page.locator('.special-play-modal'); await special.waitFor(); await fits(special); await special.locator('.special-play-candidate').click(); await shot('special-cost')
            if (scenario === 'cancel-special') { await special.getByRole('button', { name: '取消', exact: true }).click(); assert.deepEqual(await state(page), row.before) }
            else { await special.getByRole('button', { name: '確認特殊登場', exact: true }).click(); await source.waitFor({ state: 'hidden' }); await replacement(true); const after = await state(page)
              assert.deepEqual(after.own.battle.map(c => c.hp), [4, 1]); assert.equal(after.own.breakCount, 0); assert.equal(after.own.trash, 3); assert.equal(after.own.deck, 11); assert.equal(after.own.hand, 0)
              assert.equal(await modal.count(), 0); assert.equal((await trace(page)).some(entry => entry.commandKind === 'resolve-faint-effect'), false)
            }
          } else {
            const attack = source.locator('.card-face.is-attackable')
            if (['wrong-energy', 'few-energy', 'rested-energy', 'attack-rested', 'opponent-turn', 'outside-main'].includes(scenario)) {
              assert.ok(await attack.count() === 0 || !await attack.isEnabled()); assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), row.beforeTrace)
            } else {
              await attack.click()
              await page.locator('.bottom-field .support-card-wrap[data-card-instance-id="bs12-099-payment-0"] .card-face').click()
              assert.equal(await page.locator('.top-field .card-face[aria-label^="選擇攻擊目標："]').count(), 0)
              if (scenario === 'cancel-payment') { await page.getByRole('button', { name: '取消攻擊', exact: true }).click(); assert.deepEqual(await state(page), row.before) }
              else { await page.locator('.bottom-field .support-card-wrap[data-card-instance-id="bs12-099-payment-1"] .card-face').click(); await shot('payment')
                if (scenario === 'cancel-target') { await page.getByRole('button', { name: '取消攻擊', exact: true }).click(); assert.deepEqual(await state(page), row.before) }
                else { await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-099-opponent"] .card-face[aria-label^="選擇攻擊目標："]').click()
                  await page.waitForFunction(() => document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="bs12-099-opponent"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 3 張')); await settle(page)
                  const after = await state(page); assert.deepEqual(after.own.support.map(s => s.rested), [true, true, false]); assert.equal(after.enemy.trash, 2); assert.equal(after.enemy.breakCount, 0); assert.equal(after.own.battle[0].hp, 2); assert.equal(after.own.deck, 12); assert.equal(await modal.count(), 0)
                }
              }
            }
          }
        } else {
          if (scenario.startsWith('flip-')) {
            const flip = page.locator('.flip-response-modal'); await flip.waitFor(); await checkArt(page.locator('.bottom-field img[alt="Cake Hound"]').first())
            if (scenario === 'flip-skip') await flip.getByRole('button', { name: '不發動', exact: true }).click()
            else { await flip.locator('.flip-hand-carousel').getByRole('button', { name: 'Sweet Jams Guitar Sweet Jams Guitar', exact: true }).click(); await flip.getByRole('group', { name: 'FLIP 效果目標' }).getByRole('button').filter({ hasText: 'Cake Hound' }).click(); await flip.getByRole('button', { name: '發動 FLIP', exact: true }).click(); await settle(page)
              assert.deepEqual((await state(page)).own.battle.map(c => c.hp), [1, 4]); assert.equal(await modal.count(), 0); assert.equal((await trace(page)).some(e => e.commandKind === 'resolve-faint-effect'), false)
            }
          }
          if (scenario !== 'flip-rescue') {
            await modal.waitFor(); await settle(page); await fits(modal); await checkArt(modal.locator('img[alt="Cake Hound"]').first())
            assert.match(await modal.innerText(), scenario === 'unpayable' ? /無法支付牌庫頂代價/ : /牌庫頂 3 張.*棄牌區/)
            assert.equal(await modal.locator('.faint-card-candidates').count(), 0)
            row.beforeCost = await state(page)
            if (scenario === 'minimize-cost') { await modal.getByRole('button', { name: '縮小', exact: true }).click(); await page.locator('.decision-reveal-dock:visible').click(); assert.deepEqual(await state(page), row.beforeCost) }
            await shot('deck-cost')
            if (['cost-skip', 'unpayable'].includes(scenario)) {
              if (scenario === 'unpayable') assert.equal(await modal.getByRole('button', { name: '支付代價', exact: true }).isEnabled(), false)
              await modal.getByRole('button', { name: scenario === 'unpayable' ? '繼續' : '不發動', exact: true }).click(); await replacement(false)
              assert.deepEqual(await state(page), row.beforeCost)
            } else {
              await modal.getByRole('button', { name: '支付代價', exact: true }).click()
              if (refreshes.includes(scenario)) { const refresh = page.locator('.decision-modal:visible'); await refresh.waitFor(); await fits(refresh); await shot('refresh')
                await refresh.getByRole('button').filter({ hasText: scenario === 'refresh-defeat' ? 'Butter Roll Cookie' : 'Peach Cookie' }).first().click(); await refresh.waitFor({ state: 'hidden' })
              }
              if (scenario === 'refresh-defeat') { await page.locator('.result-modal').waitFor(); assert.equal(await modal.count(), 0) }
              else { await modal.getByRole('button', { name: '不選擇目標', exact: true }).waitFor(); await settle(page); await fits(modal)
                row.afterCost = await state(page)
                const choices = modal.locator('.faint-card-candidates > button'), names = await choices.allTextContents()
                row.candidates = names.map(name => name.replace(/\s+/g, ' ').trim())
                const expected = blockedTargets.includes(scenario) ? [] : ['old-target', 'old-target-choice'].includes(scenario) ? ['Subtle Jasmine Cake Hound', 'Butter Roll Cookie']
                  : scenario === 'same-name' ? ['Cake Hound'] : scenario === 'lv-one' ? ['Blueberry Cake Hound'] : refreshes.includes(scenario) ? null : ['Butter Roll Cookie']
                if (expected) { assert.equal(names.length, expected.length); for (let i = 0; i < names.length; i++) assert.ok(names[i].includes(expected[i]), `Unexpected candidate ${names[i]}`) }
                assert.doesNotMatch(names.join(' '), /Licorice Cookie|Peach Cookie|Sweet Jams Guitar/)
                if (!refreshes.includes(scenario)) { assert.equal(row.afterCost.own.deck, row.beforeCost.own.deck - 3); assert.equal(row.afterCost.own.trash, row.beforeCost.own.trash + 3) }
                const zero = blockedTargets.includes(scenario) || scenario === 'paid-zero' || refreshes.includes(scenario)
                if (!zero) { const pick = choices.filter({ hasText: scenario === 'old-target-choice' ? 'Subtle Jasmine Cake Hound' : expected[expected.length - 1] }).first(); await pick.click(); assert.deepEqual(await state(page), row.afterCost)
                  if (scenario === 'deselect-target') { await pick.click(); assert.equal(await modal.getByRole('button', { name: '不選擇目標', exact: true }).isEnabled(), true); await pick.click() }
                  if (scenario === 'minimize-target') { await modal.getByRole('button', { name: '縮小', exact: true }).click(); await page.locator('.decision-reveal-dock:visible').click(); assert.equal(await pick.getAttribute('aria-pressed'), 'true') }
                }
                await shot('recovery'); await modal.getByRole('button', { name: zero ? '不選擇目標' : '確認 (1)', exact: true }).click(); await replacement(!zero || scenario === 'zones')
                const after = await state(page); assert.equal(after.own.hand, row.afterCost.own.hand + (zero ? 0 : 1)); assert.equal(after.own.trash, row.afterCost.own.trash - (zero ? 0 : 1)); assert.equal(after.own.deck, row.afterCost.own.deck); assert.equal(after.own.breakCount, row.afterCost.own.breakCount); assert.deepEqual(after.own.support, row.afterCost.own.support); assert.deepEqual(after.enemy, row.afterCost.enemy)
                assert.equal((await trace(page)).filter(e => e.commandKind === 'resolve-faint-effect').length, 2)
              }
            }
          }
        }
        row.after = await state(page); row.trace = await trace(page)
        if (['faint', 'same-name', 'old-target-choice', 'paid-zero', 'cost-skip', 'non-arena', 'attack', 'non-faint-trash'].includes(scenario)) {
          await page.getByRole('button', { name: '對戰紀錄', exact: true }).click(); const log = page.getByRole('complementary', { name: '對戰紀錄側欄' }); await log.getByRole('list').getByRole('button').first().click(); row.visiblePublicLog = await log.innerText()
          assert.match(row.visiblePublicLog, /Cake Hound/)
          if (scenario === 'cost-skip') assert.match(row.visiblePublicLog, /未支付牌庫頂代價.*後續回收未執行/)
          else if (!['attack', 'non-faint-trash'].includes(scenario)) { assert.match(row.visiblePublicLog, /牌庫頂 3 張.*棄牌區/); if (['paid-zero', 'non-arena'].includes(scenario)) assert.match(row.visiblePublicLog, /沒有卡牌返回手牌/); else assert.match(row.visiblePublicLog, /棄牌區返回手牌/) }
          await shot('public-log'); await page.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
        }
        assert.equal(await page.locator('.faint-response-modal,.special-play-modal,.flip-response-modal,.decision-modal,.effect-panel:not(.is-complete)').count(), 0)
        await shot('result'); assert.deepEqual(row.errors,[])
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
      } catch (error) { row.error = String(error.stack ?? error); row.after = await state(page).catch(() => null); row.trace = await trace(page).catch(() => []); row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => undefined); results.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'), JSON.stringify(results, null, 2)); throw error }
      finally { await page.close() }
      results.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'), JSON.stringify(results, null, 2)); console.log(`PASS BS12-099 ${scenario} ${viewport.width}x${viewport.height}`)
    }
  console.log(`BS12-099 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
