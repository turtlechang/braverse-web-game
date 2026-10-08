import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-083-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/cards/official-festival-arena-bs12.en.json'),'utf8')).cards
const references = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...references].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const usedCards = cards
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'), hand: field?.querySelectorAll('.hand-card').length ?? 0,
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'), hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN), rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'), rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({ commandKind: entry.commandKind, summary: entry.summary, steps: entry.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') && ![...document.querySelectorAll('button')].some(button => button.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
const blocked = ['wrong-energy', 'rested-energy', 'no-energy', 'opponent-turn', 'outside-main', 'dj-no-hand']
const cases = ['positive', 'red-blocker', 'two-blockers', 'select-second', 'no-blocker', 'full-field', ...blocked, 'zero', 'cancel-payment', 'cancel-target', 'back', 'deselect', 'minimize', 'dj-new-target', 'dj-existing-target', 'dj-zero', 'dj-cancel', 'dj-deselect', 'short-deck', 'refresh-defeat', 'no-refresh-cookie']
const route = scenario => ['select-second'].includes(scenario) ? 'two-blockers' : ['zero', 'cancel-payment', 'cancel-target', 'back', 'deselect', 'minimize'].includes(scenario) ? 'positive' : ['dj-zero', 'dj-cancel', 'dj-deselect'].includes(scenario) ? 'dj-new-target' : scenario
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({ viewport })
    const result = { number: 'BS12-083', scenario, viewport, printedSourceAttested: true, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of usedCards) await page.route(card.imageUrl, request => request.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      result.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'positive' ? 'card:BS12-083' : process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'no-blocker' ? 'card-negative:BS12-083' : 'bs12-083:'+route(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+result.testState+'&contract-card='+cards.map(card=>card.cardNumber).join(','))
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      result.before = await state(page)
      assert.ok(result.before.bottom.battle.length <= 2 && result.before.top.battle.length <= 2)
      const hand = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator('img[alt="Rock Spirit Guitar String"]') })
      await hand.locator('button.card-face').click()
      const use = hand.getByRole('button', { name: '使用', exact: true })
      const dialog = () => page.getByRole('alertdialog')
      if (blocked.includes(scenario)) {
        assert.ok(await use.count() === 0 || !await use.isEnabled())
        assert.deepEqual(await state(page), result.before)
        assert.deepEqual(await trace(page), [])
      } else {
        await use.click()
        const dj = scenario.startsWith('dj-')
        assert.equal(await dialog().getByRole('button', { name: dj ? '確認發動' : '下一步', exact: true }).isEnabled(), false)
        await dialog().locator('.effect-candidates-payment button').first().click()
        if (scenario === 'cancel-payment') {
          await dialog().getByRole('button', { name: '取消技能', exact: true }).click()
          assert.deepEqual(await state(page), result.before)
          assert.deepEqual(await trace(page), [])
        } else {
          if (dj) {
            assert.equal(await dialog().locator('.effect-candidates-target button').count(), 0)
            await dialog().getByRole('button', { name: '確認發動', exact: true }).click()
            assert.deepEqual(await state(page), result.before)
            if (scenario === 'dj-cancel') {
              await dialog().getByRole('button', { name: '取消使用道具', exact: true }).click()
              assert.deepEqual(await state(page), result.before)
              assert.deepEqual((await trace(page)).map(e => e.commandKind), ['begin-play-item', 'cancel-item-activation'])
            } else {
              const tax = dialog().getByRole('button', { name: 'Pudding Cookie Pudding Cookie', exact: true })
              assert.equal(await dialog().getByRole('button', { name: '確認棄置 (0)', exact: true }).isEnabled(), false)
              await tax.click()
              if (scenario === 'dj-deselect') { await tax.click(); assert.equal(await dialog().getByRole('button', { name: '確認棄置 (0)', exact: true }).isEnabled(), false); await tax.click() }
              await dialog().getByRole('button', { name: '確認棄置 (1)', exact: true }).click()
              await dialog().locator('.effect-candidates-target').waitFor()
            }
          } else {
            await dialog().getByRole('button', { name: '下一步', exact: true }).click()
            if (scenario === 'back') {
              await dialog().getByRole('button', { name: '上一步', exact: true }).click()
              assert.deepEqual(await trace(page), [])
              await dialog().getByRole('button', { name: '下一步', exact: true }).click()
            }
          }
          if (scenario !== 'dj-cancel') {
            const candidates = dialog().locator('.effect-candidates-target button')
            const expectedCount = ['no-blocker', 'full-field'].includes(scenario) ? 0 : ['two-blockers', 'select-second', 'dj-existing-target'].includes(scenario) ? 2 : 1
            assert.equal(await candidates.count(), expectedCount)
            assert.match(await dialog().innerText(), /具有 Blocker/)
            if (scenario === 'cancel-target') {
              await dialog().getByRole('button', { name: '取消技能', exact: true }).click()
              assert.deepEqual(await state(page), result.before)
              assert.deepEqual(await trace(page), [])
            } else {
              const zero = ['zero', 'no-blocker', 'full-field', 'dj-zero'].includes(scenario)
              if (!zero) {
                await candidates.nth(scenario === 'select-second' ? 1 : 0).click()
                if (scenario === 'deselect') { await candidates.first().click(); assert.match(await dialog().innerText(), /已選 0／1/); await candidates.first().click() }
                if (scenario === 'two-blockers') { await candidates.nth(1).click(); assert.match(await dialog().innerText(), /已選 1／1/) }
              }
              if (scenario === 'minimize') {
                await dialog().getByRole('button', { name: '縮小', exact: true }).click()
                await page.getByRole('button', { name: 'Rock Spirit Guitar String 使用物品', exact: true }).click()
                assert.match(await dialog().innerText(), /已選 1／1/)
              }
              await shot('selection')
              await dialog().getByRole('button', { name: '確認發動', exact: true }).click()
              await settle(page)
              if (['short-deck', 'refresh-defeat'].includes(scenario)) {
                await dialog().getByRole('button', { name: 'Gnome Band Gnome Band', exact: true }).click()
                await settle(page)
              }
              const after = await state(page)
              assert.deepEqual(after.top, result.before.top)
              assert.equal(after.bottom.hand, dj ? 0 : 1)
              assert.ok(after.bottom.support[0].rested)
              assert.deepEqual(after.bottom.battle[0], result.before.bottom.battle[0])
              if (zero) { assert.deepEqual(after.bottom.battle, result.before.bottom.battle); assert.equal(after.bottom.deck, 12) }
              else {
                const red = ['red-blocker', 'select-second'].includes(scenario)
                const target = scenario === 'dj-existing-target' ? 'bs12-083-blocker' : dj ? 'bs12-083-hand-blocker' : red ? 'bs12-083-red-blocker' : 'bs12-083-blocker'
                assert.equal(after.bottom.battle[1].id, target)
                assert.equal(after.bottom.battle[1].hp, ['refresh-defeat', 'no-refresh-cookie'].includes(scenario) ? 1 : red ? 3 : 2)
                assert.equal(after.bottom.battle[1].rested, false)
                assert.equal(after.bottom.deck, scenario === 'refresh-defeat' ? 2 : scenario === 'no-refresh-cookie' ? 0 : scenario === 'short-deck' ? 1 : red ? 9 : 10)
              }
              if (['refresh-defeat', 'no-refresh-cookie'].includes(scenario)) {
                await page.getByRole('button', { name: '再來一局', exact: true }).waitFor()
                assert.match(await dialog().innerText(), scenario === 'refresh-defeat' ? /休息區的等級達到 10/ : /無法完成牌庫 Refresh/)
              }
              else assert.ok(await page.getByRole('button', { name: '結束主要階段', exact: true }).isEnabled())
              const kinds = (await trace(page)).map(e => e.commandKind)
              assert.deepEqual(kinds, [...(dj ? ['begin-play-item', 'resolve-opponent-hand-discard'] : ['begin-play-item']), 'resolve-ability-effect', ...(['short-deck', 'refresh-defeat'].includes(scenario) ? ['refresh-deck'] : [])])
            }
          }
        }
      }
      result.after = await state(page)
      result.trace = await trace(page)
      result.images = await page.locator('img').evaluateAll(images => images.filter(img => img.getBoundingClientRect().width > 0).map(img => ({ alt: img.alt, loaded: img.complete && img.naturalWidth > 0 })))
      assert.ok(result.images.every(img => img.loaded), JSON.stringify(result.images.filter(img => !img.loaded)))
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
      await shot('final')
      result.status = 'PASS'
      console.log(`PASS ${scenario} ${viewport.width}`)
    } catch (error) {
      result.error = String(error?.stack ?? error)
      await shot('failure').catch(() => {})
      results.push(result)
      writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(results, null, 2))
      throw error
    } finally { await page.close() }
    results.push(result)
    writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(results, null, 2))
  }
} finally { await browser.close() }
console.log(`BS12-083 Browser ${results.filter(result => result.status === 'PASS').length}/${results.length}`)
