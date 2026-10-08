import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-031-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-festival-arena-bs12.en.json'), 'utf8')).cards
const formal = readdirSync(resolve(root, 'data/cards')).filter(f => f.endsWith('.json')).flatMap(f => JSON.parse(readFileSync(resolve(root, 'data/cards', f), 'utf8')).cards ?? [])
const cards = [...candidate.filter(card => existsSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`))), ...formal.filter(card => ["ST2-002","ST4-001","BS7-055"].includes(card.cardNumber))]
// An initially empty opponent board is only a unit terminal-state boundary, not a legal Browser fixture.
const fixtures = ['positive', 'two-costs', 'no-cost', 'red-arena', 'yellow-non-arena', 'equipment-only', 'support-only', 'rested-cost', 'no-energy', 'one-energy', 'wrong-energy', 'mixed-energy', 'rested-energy', 'opponent-turn', 'outside-main', 'break-nine', 'single-cookie', 'equipped-cost', 'opponent-faints', 'short-deck']
const extras = ['draw-zero', 'zero-both', 'damage-zero', 'other-target', 'cancel-energy', 'cancel-cost', 'back-energy', 'deselect-energy', 'deselect-cost', 'cost-max', 'target-max', 'deselect-target', 'draw-select-change', 'skip-draw', 'source-detail', 'single-cookie-skip']
const cases = [...fixtures, ...extras]
const blocked = ['equipped-cost', 'no-cost', 'red-arena', 'yellow-non-arena', 'equipment-only', 'support-only', 'no-energy', 'one-energy', 'wrong-energy', 'mixed-energy', 'rested-energy', 'opponent-turn', 'outside-main']
const fixture = s => s === 'cost-max' ? 'two-costs' : s === 'single-cookie-skip' ? 'single-cookie' : extras.includes(s) ? 'positive' : s
const readState = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { hand: field?.querySelectorAll('.hand-card').length ?? 0, deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'),
      breakLevel: Number(field?.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1] ?? NaN),
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
    const result = { number: 'BS12-031', scenario, viewport, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => result.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') result.errors.push(m.text()) })
    page.on('requestfailed', r => result.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, r => r.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const fixtureScenario = fixture(scenario)
      result.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixtureScenario === 'positive' ? 'card:BS12-031' : process.env.BS12_BROWSER_ROUTE === 'generic' && fixtureScenario === 'no-cost' ? 'card-negative:BS12-031' : `bs12-031:${fixtureScenario}`
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${result.testState}&contract-card=BS12-031`)
      await page.locator('.game-shell').waitFor()
      await settle(page)
      result.before = await readState(page)
      assert.deepEqual(await trace(page), [])
      const handSource = page.getByRole('button', { name: 'Fashionista Spotlight', exact: true })
      await handSource.locator('img').evaluate(img => img.decode())
      assert.equal(await handSource.locator('img').getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-031').imageUrl)
      await handSource.click()
      const use = page.getByRole('button', { name: '使用', exact: true })
      if (blocked.includes(scenario)) {
        if (await use.count()) assert.equal(await use.isEnabled(), false)
        assert.equal(await page.locator('.effect-panel:not(.is-complete):visible').count(), 0)
        assert.deepEqual(await readState(page), result.before)
        assert.deepEqual(await trace(page), [])
      } else {
        await use.waitFor()
        if (scenario === 'source-detail') {
          await page.getByRole('button', { name: '詳情', exact: true }).click()
          assert.match(await page.locator('.card-detail-modal:visible').innerText(), /BS12-031/)
          await page.locator('.card-detail-modal:visible').getByRole('button', { name: '關閉', exact: true }).click()
          assert.deepEqual(await readState(page), result.before)
          await handSource.click()
        }
        await use.click()
        const panel = page.locator('.effect-panel:not(.is-complete):visible')
        await panel.waitFor()
        const energy = panel.locator('.effect-candidates-payment .effect-candidate-entry > button')
        const next = panel.getByRole('button', { name: '下一步', exact: true })
        assert.equal(await next.isEnabled(), false)
        await energy.nth(0).click()
        assert.equal(await next.isEnabled(), false)
        await energy.nth(1).click()
        assert.equal(await next.isEnabled(), true)
        if (scenario === 'deselect-energy') { await energy.nth(0).click(); assert.equal(await next.isEnabled(), false); await energy.nth(0).click() }
        await shot('energy')
        if (scenario === 'cancel-energy') await panel.getByRole('button', { name: '取消技能', exact: true }).click()
        else {
          await next.click()
          const cost = panel.locator('.effect-candidates-trash-battle button')
          const confirm = panel.getByRole('button', { name: '確認發動', exact: true })
          assert.equal(await confirm.isEnabled(), false)
          assert.match(await panel.innerText(), /代價放入休息區/)
          assert.equal(await cost.count(), ['two-costs', 'cost-max'].includes(scenario) ? 2 : 1)
          const selectedName = scenario === 'two-costs' ? 'Mayor Cuckoobeans' : 'GingerBrave'
          const selected = cost.filter({ hasText: selectedName })
          await selected.click()
          if (scenario === 'deselect-cost') { await selected.click(); assert.equal(await confirm.isEnabled(), false); await selected.click() }
          if (scenario === 'cost-max') { await cost.filter({ hasText: 'Mayor Cuckoobeans' }).click(); assert.equal(await selected.getAttribute('aria-pressed'), 'true'); assert.equal(await cost.filter({ hasText: 'Mayor Cuckoobeans' }).getAttribute('aria-pressed'), 'false') }
          if (scenario === 'back-energy') { await panel.getByRole('button', { name: '上一步', exact: true }).click(); assert.equal(await next.isEnabled(), true); await next.click(); assert.equal(await selected.getAttribute('aria-pressed'), 'true') }
          const draft = await readState(page)
          assert.deepEqual({ ...draft.bottom, support: result.before.bottom.support }, result.before.bottom)
          assert.deepEqual(draft.top, result.before.top)
          assert.deepEqual(await trace(page), [])
          const bounds = await panel.boundingBox()
          assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1)
          await shot('cost')
          if (scenario === 'cancel-cost') await panel.getByRole('button', { name: '取消技能', exact: true }).click()
          else {
            await confirm.click()
            await settle(page)
            result.paid = await readState(page)
            const selectedBefore = result.before.bottom.battle.find(c => c.id === (scenario === 'two-costs' ? 'bs12-031-other' : 'bs12-031-cost'))
            assert.equal(result.paid.bottom.hand, result.before.bottom.hand - 1)
            assert.equal(result.paid.bottom.deck, result.before.bottom.deck)
            assert.equal(result.paid.bottom.trash, result.before.bottom.trash + 1 + selectedBefore.hp + (scenario === 'equipped-cost' ? 1 : 0))
            assert.equal(result.paid.bottom.breakLevel, result.before.bottom.breakLevel + 1)
            assert.equal(result.paid.bottom.breakNames.at(-1), selectedName)
            assert.deepEqual(result.paid.bottom.support, [true, true])
            assert.deepEqual(result.paid.bottom.battle, result.before.bottom.battle.filter(c => c.id !== selectedBefore.id))
            assert.deepEqual(result.paid.top, result.before.top)
            if (scenario === 'break-nine') {
              assert.equal(await page.locator('.draw-up-to-modal:visible').count(), 0)
              assert.match(await page.locator('body').innerText(), /勝利|敗北/)
            } else {
              const drawModal = page.locator('.draw-up-to-modal:visible')
              await drawModal.waitFor()
              const count = ['draw-zero', 'zero-both', 'skip-draw'].includes(scenario) ? 0 : 1
              if (scenario === 'draw-select-change') { await drawModal.getByRole('button', { name: '不抽', exact: true }).click(); assert.deepEqual(await readState(page), result.paid) }
              if (count) await drawModal.locator('.draw-up-to-option').filter({ hasText: '抽 1 張' }).click()
              await drawModal.getByRole('button', { name: count ? '抽取 1 張牌' : '略過抽牌', exact: true }).click()
              if (scenario === 'short-deck') {
                const refresh = page.locator('.decision-modal:visible')
                await refresh.waitFor()
                assert.match(await refresh.innerText(), /牌庫 Refresh/)
                assert.deepEqual((await readState(page)).top, result.before.top)
                await refresh.getByRole('button').filter({ hasText: 'Muscle Cookie' }).click()
              }
              await settle(page)
              await drawModal.waitFor({ state: 'hidden' })
              const targetPanel = page.locator('.effect-panel:not(.is-complete):visible')
              await targetPanel.waitFor()
              const targets = targetPanel.getByRole('button').filter({ hasText: 'AI 對手・戰鬥區第' })
              assert.equal(await targets.count(), 2)
              const zero = ['zero-both', 'damage-zero'].includes(scenario)
              const targetIndex = scenario === 'other-target' ? 1 : 0
              if (!zero) {
                await targets.nth(targetIndex).click()
                if (scenario === 'deselect-target') { await targets.nth(targetIndex).click(); assert.match(await targetPanel.innerText(), /已選 0／1/); await targets.nth(targetIndex).click() }
                if (scenario === 'target-max') { await targets.nth(1).click(); assert.equal(await targets.nth(0).getAttribute('aria-pressed'), 'true'); assert.equal(await targets.nth(1).getAttribute('aria-pressed'), 'false') }
              }
              result.drawn = await readState(page)
              assert.equal(result.drawn.bottom.hand, result.paid.bottom.hand + count)
              assert.equal(result.drawn.bottom.deck, scenario === 'short-deck' ? 8 : result.paid.bottom.deck - count)
              assert.deepEqual(result.drawn.top, result.before.top)
              assert.equal(await page.getByRole('button', { name: '不補餅乾', exact: true }).count(), 0)
              await shot('target')
              await targetPanel.getByRole('button', { name: '確認發動', exact: true }).click()
              await settle(page)
              const damaged = await readState(page)
              if (!zero && scenario === 'opponent-faints') {
                assert.deepEqual(damaged.top.battle, [result.before.top.battle[1]])
                assert.equal(damaged.top.breakLevel, 3)
              } else {
                assert.deepEqual(damaged.top.battle, result.before.top.battle.map((c, i) => ({ ...c, hp: c.hp - (!zero && i === targetIndex ? 1 : 0) })))
              }
              assert.equal(damaged.top.trash, result.before.top.trash + (zero ? 0 : 1))
              const replacement = page.locator('.decision-modal:visible')
              if (scenario === 'single-cookie' || scenario === 'single-cookie-skip') {
                await replacement.waitFor()
                if (scenario === 'single-cookie-skip') assert.equal(await page.getByRole('button', { name: '不補餅乾', exact: true }).count(), 0)
                await replacement.getByRole('button').filter({ hasText: 'GingerBrave' }).click()
                await settle(page)
                assert.equal((await readState(page)).bottom.battle[0].hp, 2)
              } else {
                while (await page.getByRole('button', { name: '不補餅乾', exact: true }).count()) { await page.getByRole('button', { name: '不補餅乾', exact: true }).click(); await settle(page) }
              }
            }
            result.trace = await trace(page)
            assert.equal(result.trace[0].commandKind, 'begin-play-item')
            assert.match(result.trace[0].steps.join(' '), /道具代價.*戰鬥區餅乾放入休息區/)
            assert.match(result.trace[0].steps.join(' '), new RegExp(selectedName))
            assert.match(result.trace[0].steps.join(' '), /支付能量/)
            if (scenario !== 'break-nine') assert.deepEqual(result.trace.slice(0, 4).map(e => e.commandKind), ['begin-play-item', 'resolve-ability-effect', 'resolve-draw-up-to', 'resolve-ability-effect'])
          }
        }
        if (scenario.startsWith('cancel-')) { await settle(page); assert.deepEqual(await readState(page), result.before); assert.deepEqual(await trace(page), []) }
      }
      result.after = await readState(page)
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
    console.log(`PASS BS12-031 ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-031 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
