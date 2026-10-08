import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-028-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-festival-arena-bs12.en.json'), 'utf8')).cards
const formal = readdirSync(resolve(root, 'data/cards')).filter(f => f.endsWith('.json')).flatMap(f => JSON.parse(readFileSync(resolve(root, 'data/cards', f), 'utf8')).cards ?? [])
const cards = [...candidate.filter(card => existsSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`))), ...formal.filter(card => ["ST2-002","ST4-001"].includes(card.cardNumber))]
const cases = ['positive', 'no-cost', 'non-arena', 'arena-item', 'red-only', 'wrong-energy', 'rested-energy', 'no-energy', 'opponent-turn', 'outside-main', 'break-nine', 'short-deck', 'draw-zero', 'draw-one', 'draw-two', 'cost-red', 'cost-deselect', 'cost-max', 'cancel-energy', 'cancel-cost', 'back-energy', 'payment-deselect', 'draw-select-change', 'skip-draw', 'source-detail']
const blocked = ['no-cost', 'non-arena', 'arena-item', 'wrong-energy', 'rested-energy', 'no-energy', 'opponent-turn', 'outside-main']
const fixture = s => cases.indexOf(s) <= cases.indexOf('short-deck') ? s : 'positive'
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { hand: field?.querySelectorAll('.hand-card').length ?? 0, deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'),
      breakLevel: Number(field?.querySelector('.break-zone .zone-heading strong')?.textContent?.match(/LV\. (\d+)/)?.[1] ?? NaN),
      breakNames: [...(field?.querySelectorAll('.break-card-wrap img') ?? [])].map(n => n.getAttribute('alt')),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(n => n.querySelector('.card-face')?.classList.contains('is-rested') ?? false),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(n => ({ id: n.getAttribute('data-card-instance-id'), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN) })) }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, steps: e.steps, summary: e.summary })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') && ![...document.querySelectorAll('button')].some(b => b.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const result = { scenario, viewport, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => result.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') result.errors.push(m.text()) })
    page.on('requestfailed', r => result.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, r => r.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const fixtureScenario = fixture(scenario)
      result.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixtureScenario === 'positive' ? 'card:BS12-028' : process.env.BS12_BROWSER_ROUTE === 'generic' && fixtureScenario === 'no-cost' ? 'card-negative:BS12-028' : `bs12-028:${fixtureScenario}`
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${result.testState}&contract-card=BS12-028`)
      await page.locator('.game-shell').waitFor()
      await settle(page)
      result.before = await state(page)
      const handSource = page.getByRole('button', { name: 'Luxury Red Carpet', exact: true })
      await handSource.locator('img').evaluate(img => img.decode())
      assert.equal(await handSource.locator('img').getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-028').imageUrl)
      await handSource.click()
      const use = page.getByRole('button', { name: '使用', exact: true })
      if (blocked.includes(scenario)) {
        if (await use.count()) assert.equal(await use.isEnabled(), false)
        assert.equal(await page.locator('.effect-panel-body:visible').count(), 0)
        assert.deepEqual(await state(page), result.before)
        assert.deepEqual(await trace(page), [])
      } else {
        await use.waitFor()
        if (scenario === 'source-detail') {
          await page.getByRole('button', { name: '詳情', exact: true }).click()
          const detail = page.getByRole('dialog', { name: 'Luxury Red Carpet 卡牌詳情', exact: true })
          assert.match(await detail.innerText(), /Place 1.*Arena.*Cookie.*hand.*break area/s)
          await detail.locator('img[alt="Luxury Red Carpet"]').evaluate(img => img.decode())
          await shot('detail')
          await detail.getByRole('button', { name: '關閉', exact: true }).click()
          assert.deepEqual(await state(page), result.before)
          await handSource.click()
        }
        await use.click()
        const panel = page.locator('.effect-panel:visible')
        await panel.waitFor()
        const next = panel.getByRole('button', { name: '下一步', exact: true })
        const payment = panel.locator('.effect-candidates-payment .effect-candidate-entry > button')
        assert.equal(await payment.count(), 1)
        assert.equal(await next.isEnabled(), false)
        if (scenario === 'cancel-energy') await panel.getByRole('button', { name: '取消技能', exact: true }).click()
        else {
          await payment.click()
          if (scenario === 'payment-deselect') { await payment.click(); assert.equal(await next.isEnabled(), false); await payment.click() }
          assert.equal(await next.isEnabled(), true)
          await next.click()
          const cost = panel.locator('.effect-candidates-cost-hand-to-break .effect-candidate-entry > button')
          assert.equal(await cost.count(), scenario === 'red-only' ? 1 : 2)
          assert.match(await panel.innerText(), /手牌 → 休息區（道具代價）/)
          const confirm = panel.getByRole('button', { name: '確認發動', exact: true })
          assert.equal(await confirm.isEnabled(), false)
          const selectedName = ['red-only', 'cost-red'].includes(scenario) ? 'Cherry Cookie' : 'GingerBrave'
          const selected = cost.filter({ hasText: selectedName })
          await selected.click()
          if (scenario === 'cost-deselect') { await selected.click(); assert.equal(await confirm.isEnabled(), false); await selected.click() }
          if (scenario === 'cost-max') { await cost.filter({ hasText: 'Cherry Cookie' }).click(); assert.equal(await selected.getAttribute('aria-pressed'), 'true'); assert.equal(await cost.filter({ hasText: 'Cherry Cookie' }).getAttribute('aria-pressed'), 'false') }
          if (scenario === 'back-energy') { await panel.getByRole('button', { name: '上一步', exact: true }).click(); assert.equal(await next.isEnabled(), true); await next.click(); assert.equal(await selected.getAttribute('aria-pressed'), 'true') }
          assert.equal((await state(page)).bottom.hand, result.before.bottom.hand)
          assert.deepEqual((await state(page)).bottom.breakNames, result.before.bottom.breakNames)
          assert.equal((await state(page)).bottom.trash, result.before.bottom.trash)
          assert.deepEqual(await trace(page), [])
          const bounds = await panel.boundingBox()
          assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1)
          await shot('cost')
          if (scenario === 'cancel-cost') await panel.getByRole('button', { name: '取消技能', exact: true }).click()
          else {
            await confirm.click()
            await settle(page)
            result.paid = await state(page)
            assert.equal(result.paid.bottom.hand, result.before.bottom.hand - 2)
            assert.equal(result.paid.bottom.deck, result.before.bottom.deck)
            assert.equal(result.paid.bottom.trash, result.before.bottom.trash + 1)
            assert.equal(result.paid.bottom.breakLevel, result.before.bottom.breakLevel + 1)
            assert.equal(result.paid.bottom.breakNames.at(-1), selectedName)
            assert.deepEqual(result.paid.bottom.support, [true])
            assert.deepEqual(result.paid.bottom.battle, result.before.bottom.battle)
            assert.deepEqual(result.paid.top, result.before.top)
            if (scenario === 'break-nine') {
              assert.equal(await page.locator('.draw-up-to-modal:visible').count(), 0)
              assert.match(await page.locator('body').innerText(), /勝利|敗北/)
            } else {
              assert.doesNotMatch(await page.locator('body').innerText(), /Luxury Red Carpet已支付代價，請選擇效果目標/)
              await confirm.click()
              const drawModal = page.locator('.draw-up-to-modal:visible')
              await drawModal.waitFor()
              const count = scenario === 'draw-zero' || scenario === 'skip-draw' ? 0 : scenario === 'draw-one' || scenario === 'draw-select-change' ? 1 : scenario === 'draw-two' ? 2 : 3
              if (scenario === 'draw-select-change') { await drawModal.locator('.draw-up-to-option').filter({ hasText: '抽 3 張' }).click(); assert.deepEqual(await state(page), result.paid) }
              if (scenario !== 'skip-draw') await drawModal.locator('.draw-up-to-option').filter({ hasText: count === 0 ? '不抽' : `抽 ${count} 張` }).click()
              await drawModal.getByRole('button', { name: count === 0 ? '略過抽牌' : `抽取 ${count} 張牌`, exact: true }).click()
              if (scenario === 'short-deck') {
                const refresh = page.locator('.decision-modal:visible')
                await refresh.waitFor()
                assert.match(await refresh.innerText(), /牌庫 Refresh/)
                await refresh.getByRole('button').filter({ hasText: 'Muscle Cookie' }).click()
              }
              await settle(page)
              await drawModal.waitFor({ state: 'hidden' })
              const after = await state(page)
              assert.equal(after.bottom.hand, result.paid.bottom.hand + count)
              assert.equal(after.bottom.deck, scenario === 'short-deck' ? 6 : result.paid.bottom.deck - count)
              assert.equal(after.bottom.breakLevel, scenario === 'short-deck' ? 7 : result.paid.bottom.breakLevel)
              assert.equal(after.bottom.trash, scenario === 'short-deck' ? 0 : result.paid.bottom.trash)
              assert.deepEqual(after.bottom.battle, result.before.bottom.battle)
              assert.deepEqual(after.top, result.before.top)
            }
            result.trace = await trace(page)
            assert.deepEqual(result.trace.map(entry => entry.commandKind), scenario === 'break-nine'
              ? ['begin-play-item']
              : ['begin-play-item', 'resolve-ability-effect', 'resolve-draw-up-to'])
            assert.equal(result.trace[0].commandKind, 'begin-play-item')
            assert.match(result.trace[0].steps.join(' '), /道具代價.*手牌餅乾放入休息區/)
            assert.match(result.trace[0].steps.join(' '), new RegExp(selectedName))
            assert.match(result.trace[0].steps.join(' '), /支付能量/)
          }
        }
        if (scenario.startsWith('cancel-')) { await settle(page); assert.deepEqual(await state(page), result.before); assert.deepEqual(await trace(page), []) }
      }
      result.after = await state(page)
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
      await shot('result')
      result.status = 'PASS'
    } catch (error) { result.error = String(error.stack ?? error); result.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { results.push(result); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(results, null, 2)); await page.close() }
    console.log(`PASS BS12-028 ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-028 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
