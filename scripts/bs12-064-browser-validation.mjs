import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-064-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const references = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...references].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'),
      hand: field?.querySelectorAll('.hand-card').length ?? 0,
      stage: field?.querySelector('.stage-zone img')?.getAttribute('src') ?? null,
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'),
        attack: Number(node.querySelector('.badge-atk')?.textContent ?? NaN),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
        rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
        equipped: node.querySelector('.badge-equip')?.getAttribute('aria-label') ?? null })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'),
        rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({ commandKind: entry.commandKind, summary: entry.summary, steps: entry.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') &&
  ![...document.querySelectorAll('button')].some(button => button.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
const cases = ['positive', 'green-arena', 'red-arena', 'yellow-arena', 'non-arena', 'level-one', 'level-three', 'arena-item', 'top-only', 'short-deck', 'deploy', 'attack', 'wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'draw-zero', 'draw-one', 'skip-skill', 'cancel-confirm', 'cancel-payment', 'cancel-target']
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const result = { number: 'BS12-064', scenario, viewport, printedSourceAttested: true, errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(String(error)))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const routeCase = scenario
      result.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && routeCase === 'positive' ? 'card:BS12-064' : process.env.BS12_BROWSER_ROUTE === 'generic' && routeCase === 'non-arena' ? 'card-negative:BS12-064' : 'bs12-064:'+routeCase
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+result.testState+'&contract-card=BS12-001,BS12-002,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-019,BS12-021,BS12-027,BS12-028,BS12-029,BS12-030,BS12-031,BS12-040,BS12-046,BS12-059,BS12-060,BS12-061,BS12-064,BS12-065,BS12-066,BS12-067,BS12-068,BS6-008,BS7-061,ST4-001')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      result.before = await state(page)
      result.beforeTrace = await trace(page)
      const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-064-source"]')
      if (scenario === 'deploy') {
        const hand = page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-064-source"]')
        await hand.locator('.card-face').click()
        const preview = page.getByRole('complementary', { name: 'Cream Puff Cookie快速預覽', exact: true })
        await preview.locator('img').first().evaluate(image => image.decode())
        assert.equal(await preview.locator('img').first().getAttribute('src'), candidate.find(card => card.cardNumber === 'BS12-064').imageUrl)
        assert.deepEqual(await state(page), result.before)
        await hand.getByRole('button', { name: '登場', exact: true }).click()
        await source.waitFor()
        assert.equal((await state(page)).bottom.battle[0].hp, 5)
        assert.equal((await state(page)).bottom.deck, 7)
      }
      result.entered = await state(page)
      await source.locator('img').first().evaluate(image => image.decode())
      assert.equal(await source.locator('img').first().getAttribute('src'), candidate.find(card => card.cardNumber === 'BS12-064').imageUrl)
      const ordinary = ['attack', 'wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'cancel-payment', 'cancel-target'].includes(scenario)
      if (ordinary) {
        if (['wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn'].includes(scenario)) {
          assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
          assert.deepEqual(await state(page), result.entered)
          assert.deepEqual(await trace(page), result.beforeTrace)
        } else {
          await source.locator('.card-face.is-attackable').click()
          if (scenario === 'cancel-payment') await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
          else {
            for (const support of result.entered.bottom.support) await page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="${support.id}"] .card-face`).click()
            if (scenario === 'cancel-target') await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            else {
              await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-064-opponent"] .card-face:not(.hp-card)').click()
              await page.waitForFunction(() => /HP 卡 3 張/.test(document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="bs12-064-opponent"] .hp-card-stack')?.getAttribute('aria-label') ?? ''), null, { timeout: 20000 })
              await settle(page)
              assert.deepEqual((await state(page)).top.battle.map(c => c.hp), [3, 4])
              assert.equal((await state(page)).bottom.support.every(s => s.rested), true)
              assert.equal((await state(page)).bottom.battle[0].rested, true)
            }
          }
          if (scenario.startsWith('cancel-')) {
            assert.deepEqual(await state(page), result.entered)
            assert.deepEqual(await trace(page), result.beforeTrace)
          }
        }
      } else {
        const panel = page.locator('.effect-panel:not(.is-complete)')
        await panel.waitFor()
        assert.equal(await panel.getByRole('button', { name: '支付代價', exact: true }).count(), 0)
        assert.match(await panel.innerText(), /展示牌庫底/)
        if (scenario === 'cancel-confirm') {
          assert.deepEqual(await state(page), result.entered)
          await panel.getByRole('button', { name: '略過整個登場效果', exact: true }).click()
          assert.deepEqual(await state(page), result.entered)
        } else if (scenario === 'skip-skill') {
          await panel.getByRole('button', { name: '略過整個登場效果', exact: true }).click()
          assert.deepEqual(await state(page), result.entered)
        } else {
          await panel.getByRole('button', { name: '確認發動', exact: true }).click()
          const reveal = page.locator('.card-reveal-modal')
          await reveal.waitFor()
          assert.match(await reveal.innerText(), /Cream Puff Cookie — 展示牌庫底/)
          assert.deepEqual(await state(page), result.entered)
          await reveal.locator('img').evaluate(image => image.decode())
          const matched = !['non-arena', 'level-one', 'level-three', 'arena-item', 'top-only'].includes(scenario)
          assert.match(await reveal.innerText(), matched ? /條件匹配/ : /條件未匹配/)
          const expectedNumber = scenario === 'green-arena' ? 'BS12-040' : scenario === 'red-arena' ? 'BS12-002' : scenario === 'yellow-arena' ? 'BS12-021'
            : ['non-arena', 'top-only'].includes(scenario) ? 'ST4-001' : scenario === 'level-one' ? 'BS12-061' : scenario === 'level-three' ? 'BS12-019' : scenario === 'arena-item' ? 'BS12-027' : 'BS12-060'
          assert.equal(await reveal.locator('img').getAttribute('src'), cards.find(card => card.cardNumber === expectedNumber).imageUrl)
          await shot('actual-bottom-reveal')
          await reveal.getByRole('button', { name: '確認並繼續', exact: true }).click()
          if (matched) {
            const drawModal = page.locator('.draw-up-to-modal')
            await drawModal.waitFor()
            result.afterReveal = await state(page)
            assert.equal(result.afterReveal.bottom.hand, 1)
            assert.equal(result.afterReveal.bottom.deck, result.entered.bottom.deck - 1)
            assert.deepEqual(result.afterReveal.bottom.battle, result.entered.bottom.battle)
            assert.deepEqual(await drawModal.locator('.draw-up-to-option-label').allTextContents(), ['不抽', '抽 1 張', '抽 2 張'])
            const count = scenario === 'draw-zero' ? 0 : scenario === 'draw-one' ? 1 : 2
            await drawModal.locator('.draw-up-to-option').nth(count).click()
            assert.deepEqual(await state(page), result.afterReveal)
            await shot('draw-choice')
            await drawModal.getByRole('button', { name: count ? `抽取 ${count} 張牌` : '略過抽牌', exact: true }).click()
            if (scenario === 'short-deck') {
              const refresh = page.locator('.decision-modal:visible')
              await refresh.waitFor()
              assert.match(await refresh.innerText(), /牌庫 Refresh/)
              await refresh.getByRole('button').filter({ hasText: cards.find(card => card.cardNumber === 'BS12-059').name }).click()
            }
            await drawModal.waitFor({ state: 'hidden' })
            await settle(page)
            assert.equal((await state(page)).bottom.hand, 1 + count)
            if (scenario !== 'short-deck') assert.equal((await state(page)).bottom.deck, result.entered.bottom.deck - 1 - count)
          } else {
            await reveal.waitFor({ state: 'hidden' })
            assert.deepEqual(await state(page), result.entered)
            assert.match(JSON.stringify(await trace(page)), /底牌維持原位，後段效果未執行/)
          }
        }
      }
      result.after = await state(page)
      result.trace = await trace(page)
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
      result.dom = await page.locator('body').innerText().catch(() => '')
      results.push(result)
      writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(results, null, 2))
      throw error
    } finally { await page.close() }
    results.push(result)
    writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(results, null, 2))
    console.log(`PASS BS12-064 ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-064 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
