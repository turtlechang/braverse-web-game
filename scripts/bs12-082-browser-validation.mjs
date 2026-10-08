import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-082-browser')
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
const blocked = ['no-hand', 'wrong-energy', 'rested-energy', 'no-energy', 'missing-original-cost', 'multiple-source', 'opponent-turn', 'outside-main', 'hand-above-threshold']
const outside = ['source-hand', 'source-support', 'source-discard', 'source-break', 'own-source']
const cases = ['positive', 'rested-source', 'cookie-cost', 'item-cost', 'stage-cost', 'trap-cost', ...outside, ...blocked, 'attack', 'deploy', 'source-rested', 'cancel-payment', 'cancel-target', 'back', 'cancel-extra', 'minimize', 'deselect', 'select-second', 'twice', 'original-cost', 'zero-target', 'hand-threshold', 'threshold-cancel', 'threshold-payment-cancel']
const route = scenario => ['threshold-cancel', 'threshold-payment-cancel'].includes(scenario) ? 'hand-threshold' : ['cancel-payment', 'cancel-target', 'back', 'cancel-extra', 'minimize', 'deselect', 'zero-target'].includes(scenario) ? 'positive' : scenario === 'select-second' ? 'twice' : scenario
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({ viewport })
    const result = { number: 'BS12-082', scenario, viewport, printedSourceAttested: scenario !== 'multiple-source', status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of usedCards) await page.route(card.imageUrl, request => request.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      result.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'positive' ? 'card:BS12-082' : process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'no-hand' ? 'card-negative:BS12-082' : 'bs12-082:'+route(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+result.testState+'&contract-card='+cards.map(card=>card.cardNumber).join(','))
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      result.before = await state(page)
      assert.ok(result.before.bottom.battle.length <= 2 && result.before.top.battle.length <= 2)
      const dialog = () => page.getByRole('alertdialog')
      const threshold = ['hand-threshold', 'hand-above-threshold', 'threshold-cancel', 'threshold-payment-cancel'].includes(scenario)
      const chooseTarget = async () => {
        const target = dialog().getByRole('button', { name: /Langue de Chat Cookie Langue de Chat Cookie 玩家・戰鬥區第 1 張/ })
        if (scenario !== 'zero-target' && await target.count()) await target.click()
      }
      const openItem = async (index = 0) => {
        const original = scenario === 'original-cost' || scenario === 'missing-original-cost'
        const hand = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator(`img[alt="${threshold ? 'Warm Wind Flower' : original ? 'Luxury Red Carpet' : 'Sweet Jams Guitar'}"]`) }).nth(index)
        await hand.locator('button.card-face').click()
        return hand.getByRole('button', { name: '使用', exact: true })
      }
      const prepareItem = async () => {
        const use = await openItem()
        await use.click()
        await dialog().locator('.effect-candidates-payment button').first().click()
        if (threshold) await dialog().locator('.effect-candidates-payment button').nth(1).click()
        if (threshold) {
          if (scenario === 'threshold-payment-cancel') {
            await dialog().getByRole('button', { name: '取消技能', exact: true }).click()
            return false
          }
          await dialog().getByRole('button', { name: '確認發動', exact: true }).click()
          return true
        }
        if (scenario === 'cancel-payment') { await dialog().getByRole('button', { name: '取消技能', exact: true }).click(); return false }
        await dialog().getByRole('button', { name: '下一步', exact: true }).click()
        if (scenario === 'original-cost') {
          await dialog().getByRole('button', { name: /Gnome Band Gnome Band/ }).click()
        }
        if (scenario === 'cancel-target') { await dialog().getByRole('button', { name: '取消技能', exact: true }).click(); return false }
        if (scenario === 'back') {
          await dialog().getByRole('button', { name: '上一步', exact: true }).click()
          // Selected energy is rendered as a rested preview until confirmation;
          // returning to energy keeps that selection without committing a command.
          assert.deepEqual(await state(page), { ...result.before, bottom: { ...result.before.bottom,
            support: result.before.bottom.support.map(s => ({ ...s, rested: true })) } })
          assert.deepEqual(await trace(page), [])
          await dialog().getByRole('button', { name: '下一步', exact: true }).click()
        }
        if (!threshold) await chooseTarget()
        await dialog().getByRole('button', { name: '確認發動', exact: true }).click()
        return true
      }
      if (scenario === 'deploy') {
        const hand = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator('img[alt="DJ Cookie"]') })
        await hand.locator('button.card-face').click()
        await hand.getByRole('button', { name: '登場', exact: true }).click()
        await settle(page)
        assert.deepEqual((await state(page)).bottom.battle.map(c => c.hp), [4, 2])
        assert.equal((await state(page)).bottom.deck, 10)
        assert.deepEqual((await trace(page)).map(e => e.commandKind), ['deploy-cookie'])
      } else if (scenario === 'attack' || scenario === 'source-rested') {
        const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-082-source"]')
        if (scenario === 'source-rested') assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
        else {
          await source.locator('.card-face.is-attackable').click()
          for (let index = 0; index < 2; index++) await page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="bs12-082-payment-${index}"] .card-face`).click()
          await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-082-opponent"] .card-face:not(.hp-card)').click()
          await page.waitForFunction(() => document.querySelector('.top-field .combat-card-wrap .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 2 張'))
          await settle(page)
          assert.equal((await state(page)).top.trash, 2)
          assert.ok((await state(page)).bottom.support.every(s => s.rested))
          assert.equal((await trace(page)).some(e => e.commandKind === 'resolve-opponent-hand-discard'), false)
        }
      } else if (blocked.includes(scenario)) {
        const use = await openItem()
        assert.ok(await use.count() === 0 || !await use.isEnabled())
        assert.deepEqual(await state(page), result.before)
        assert.deepEqual(await trace(page), [])
      } else {
        const opened = await prepareItem()
        if (!opened) {
          assert.deepEqual(await state(page), result.before)
          assert.deepEqual(await trace(page), [])
        } else if (threshold) {
          await page.locator('.hand-discard-modal').waitFor()
          assert.deepEqual(await state(page), result.before)
          assert.equal(await dialog().locator('.hand-discard-card-option').count(), 3)
          await shot('unpaid')
          if (scenario === 'threshold-cancel') {
            await dialog().getByRole('button', { name: '取消使用道具', exact: true }).click()
            assert.deepEqual(await state(page), result.before)
            assert.deepEqual((await trace(page)).map(entry => entry.commandKind), ['begin-play-item', 'cancel-item-activation'])
          } else {
            await dialog().locator('.hand-discard-card-option > button').first().click()
            await dialog().getByRole('button', { name: '確認棄置 (1)', exact: true }).click()
            await settle(page)
            const paid = await state(page)
            assert.equal(paid.bottom.hand, 2)
            assert.equal(paid.bottom.trash, 2)
            assert.ok(paid.bottom.support.every(support => support.rested))
            assert.deepEqual(paid.bottom.battle, result.before.bottom.battle)
            assert.deepEqual(paid.top, result.before.top)
            await dialog().locator('.draw-up-to-option').filter({ hasText: '抽 4 張' }).click()
            await dialog().getByRole('button', { name: '抽取 4 張牌', exact: true }).click()
            await settle(page)
            const resultState = await state(page)
            assert.equal(resultState.bottom.hand, 6)
            assert.equal(resultState.bottom.deck, 8)
            assert.equal(resultState.bottom.trash, 2)
            const handImages = page.locator('.bottom-field .hand-card img')
            assert.equal(await handImages.count(), 6)
            await handImages.evaluateAll(images => Promise.all(images.map(image => image.decode())))
            assert.ok((await trace(page)).some(entry => entry.commandKind === 'resolve-draw-up-to'))
          }
        } else if (outside.includes(scenario)) {
          await settle(page)
          assert.equal(await page.locator('.hand-discard-modal').count(), 0)
          assert.equal((await state(page)).bottom.hand, result.before.bottom.hand - 1)
          assert.equal((await state(page)).bottom.trash, 1)
        } else {
          await page.locator('.hand-discard-modal').waitFor()
          assert.deepEqual(await state(page), result.before)
          assert.match((await trace(page)).at(-1).summary, /尚未支付費用/)
          assert.equal(await dialog().getByRole('button', { name: '確認棄置 (0)', exact: true }).isEnabled(), false)
          assert.equal(await dialog().locator('.hand-discard-options img[alt="Sweet Jams Guitar"]').count(), scenario === 'twice' || scenario === 'select-second' ? 1 : scenario === 'item-cost' ? 1 : 0)
          const costs = () => dialog().locator('.hand-discard-card-option > button')
          await costs().nth(scenario === 'select-second' ? 2 : 0).click()
          if (scenario === 'deselect') {
            await costs().first().click()
            assert.equal(await dialog().getByRole('button', { name: '確認棄置 (0)', exact: true }).isEnabled(), false)
            await costs().first().click()
          }
          if (scenario === 'minimize') {
            await dialog().getByRole('button', { name: '縮小', exact: true }).click()
            assert.deepEqual(await state(page), result.before)
            await page.locator('.decision-reveal-dock').click()
          }
          await shot('unpaid-tax')
          if (scenario === 'cancel-extra') {
            await dialog().getByRole('button', { name: '取消使用道具', exact: true }).click()
            await settle(page)
            assert.deepEqual(await state(page), result.before)
            assert.equal(await dialog().count(), 0)
            assert.equal((await trace(page)).at(-1).commandKind, 'cancel-item-activation')
            assert.match((await trace(page)).at(-1).summary, /未支付/)
          } else {
            await dialog().getByRole('button', { name: '確認棄置 (1)', exact: true }).click()
            if (scenario === 'original-cost') {
              await page.locator('.draw-up-to-modal').waitFor()
              await page.getByRole('button', { name: /抽 2 張/ }).click()
              await page.getByRole('button', { name: '抽取 2 張牌', exact: true }).click()
            }
            await settle(page)
            const paid = await state(page)
            assert.deepEqual(paid.top, result.before.top)
            assert.equal(paid.bottom.hand, result.before.bottom.hand - 2 + (scenario === 'original-cost' ? 1 : 0))
            assert.equal(paid.bottom.trash, 2)
            assert.equal(paid.bottom.support[0].rested, true)
            assert.equal(paid.bottom.battle[0].rested, scenario === 'zero-target' || scenario === 'original-cost')
            assert.equal(await dialog().count(), 0)
            assert.match((await trace(page)).find(e => e.commandKind === 'resolve-opponent-hand-discard').steps.join('\n'), /道具額外代價：棄置手牌/)
            if (scenario === 'twice') {
              await prepareItem()
              await page.locator('.hand-discard-modal').waitFor()
              assert.equal(await dialog().getByRole('button', { name: '確認棄置 (0)', exact: true }).isEnabled(), false)
              await costs().first().click()
              await dialog().getByRole('button', { name: '確認棄置 (1)', exact: true }).click()
              await settle(page)
              assert.equal((await state(page)).bottom.hand, 0)
              assert.equal((await state(page)).bottom.trash, 4)
              assert.ok((await state(page)).bottom.support.every(s => s.rested))
              assert.equal((await trace(page)).filter(e => e.commandKind === 'resolve-opponent-hand-discard').length, 2)
            }
          }
        }
      }
      result.after = await state(page)
      result.trace = await trace(page)
      await shot('result')
      const art = page.locator('img[alt="DJ Cookie"]').first()
      if (await art.count()) { await art.evaluate(img => img.decode()); assert.equal(await art.getAttribute('src'), usedCards.find(card=>card.cardNumber==='BS12-082').imageUrl) }
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
    process.stdout.write(`PASS ${scenario} ${viewport.width}x${viewport.height}\n`)
  }
} finally { await browser.close() }
process.stdout.write(`BS12-082 ${results.filter(result => result.status === 'PASS').length}/${results.length} PASS\n`)
