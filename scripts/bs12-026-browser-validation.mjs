import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-026-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/candidates/official-festival-arena-bs12.en.json'), 'utf8')).cards
const references = readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json')).flatMap(file => JSON.parse(readFileSync(resolve(root, 'data/cards', file), 'utf8')).cards ?? [])
const cards = [...candidate.filter(card => existsSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`))), ...references.filter(card => ["ST4-001","BS7-061","BS6-008"].includes(card.cardNumber))]
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
// Overlapping support previews are selected through their exposed area. Find
// an actual hit-tested point rather than forcing clicks through the next card.
const clickExposedSupport = async (page, card) => {
  const point = await card.evaluate(node => {
    const box = node.getBoundingClientRect()
    for (let x = box.left + 8; x < box.right - 4; x += 8) for (let y = box.top + 8; y < box.bottom - 4; y += 8) {
      if (node.contains(document.elementFromPoint(x, y))) return { x, y }
    }
    return null
  })
  assert.ok(point, 'payment support must expose a clickable area')
  await page.mouse.click(point.x, point.y)
}
const cases = ['four-arena', 'five-arena', 'mixed-arena', 'three-arena', 'high-level', 'non-arena-break', 'opponent-break', 'trash-arena',
  'turn-event', 'green-event', 'hand-event', 'faint-event', 'removed-event', 'previous-turn', 'non-arena-event', 'opponent-event', 'both', 'no-condition',
  'no-hand', 'item-hand', 'blue-hand', 'target-faints', 'wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'deploy',
  'hand-preview', 'skip-then', 'skip-false-then', 'discard-deselect', 'return-discard', 'cancel-payment', 'cancel-target', 'payment-deselect', 'other-target']
const negative = ['three-arena', 'high-level', 'non-arena-break', 'opponent-break', 'trash-arena', 'previous-turn', 'non-arena-event', 'opponent-event', 'no-condition', 'skip-false-then']
const blocked = ['wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn']
const route = scenario => ['hand-preview', 'deploy'].includes(scenario) ? 'deploy' : scenario === 'skip-false-then' ? 'three-arena'
  : cases.indexOf(scenario) >= cases.indexOf('skip-then') ? 'four-arena' : scenario
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({ viewport })
    const result = { scenario, viewport, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const fixtureScenario = route(scenario)
      result.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixtureScenario === 'four-arena' ? 'card:BS12-026' : process.env.BS12_BROWSER_ROUTE === 'generic' && fixtureScenario === 'no-hand' ? 'card-negative:BS12-026' : `bs12-026:${fixtureScenario}`
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${result.testState}&contract-card=BS12-026`)
      await page.locator('.game-shell').waitFor()
      await settle(page)
      result.before = await state(page)
      result.beforeTrace = await trace(page)
      assert.ok(result.before.bottom.battle.length <= 2 && result.before.top.battle.length <= 2)
      const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-026-source"]')
      if (['deploy', 'hand-preview'].includes(scenario)) {
        const hand = page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-026-source"]')
        await hand.locator('.card-face').click()
        const preview = page.getByRole('complementary', { name: 'Banana Roti Cookie快速預覽', exact: true })
        assert.match(await preview.innerText(), /BS12-026/)
        await preview.getByRole('img', { name: 'Banana Roti Cookie', exact: true }).evaluate(img => img.decode())
        assert.equal(await preview.getByRole('img', { name: 'Banana Roti Cookie', exact: true }).getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-026').imageUrl)
        assert.deepEqual(await state(page), result.before)
        assert.deepEqual(await trace(page), result.beforeTrace)
        await shot('hand-preview')
        if (scenario === 'deploy') {
          await hand.getByRole('button', { name: '登場', exact: true }).click()
          await source.waitFor()
          await settle(page)
          assert.equal((await state(page)).bottom.deck, 13)
          assert.equal((await state(page)).bottom.hand, 1)
          assert.equal((await state(page)).bottom.battle[0].hp, 5)
          assert.deepEqual((await trace(page)).map(e => e.commandKind), ['deploy-cookie'])
        }
      }
      if (scenario !== 'hand-preview') {
        result.entered = await state(page)
        result.enteredTrace = await trace(page)
        assert.equal(result.entered.bottom.battle[0].hp, 5)
        assert.equal(result.entered.bottom.battle[0].attack, 3)
        await source.locator('img').first().evaluate(img => img.decode())
        assert.equal(await source.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-026').imageUrl)
        assert.equal(await source.locator('.skill-action').count(), 0)
        if (blocked.includes(scenario)) {
          assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
          assert.deepEqual(await state(page), result.entered)
          assert.deepEqual(await trace(page), result.enteredTrace)
          await shot('blocked')
        } else {
          await source.locator('.card-face.is-attackable').click()
          const supports = page.locator('.bottom-field .support-card-wrap .card-face')
          const other = scenario === 'other-target'
          const target = page.locator(`.top-field .combat-card-wrap[data-card-instance-id="bs12-026-opponent${other ? '-other' : ''}"] .card-face:not(.hp-card)`)
          if (scenario === 'cancel-payment') {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await state(page), result.entered)
            assert.deepEqual(await trace(page), result.enteredTrace)
          } else {
            for (const index of [2, 0, 1]) await supports.nth(index).click()
            assert.deepEqual(await state(page), { ...result.entered, bottom: { ...result.entered.bottom, support: result.entered.bottom.support.map(s => ({ ...s, rested: true })) } })
            assert.match(await target.getAttribute('aria-label'), /^選擇攻擊目標：/)
            assert.deepEqual(await trace(page), result.enteredTrace)
            if (scenario === 'payment-deselect') {
              await clickExposedSupport(page, supports.nth(1))
              assert.equal((await state(page)).bottom.support.filter(s => s.rested).length, 2)
              assert.doesNotMatch(await target.getAttribute('aria-label') ?? '', /^選擇攻擊目標：/)
              await clickExposedSupport(page, supports.nth(1))
            }
            await shot('ordinary-payment')
            if (scenario === 'cancel-target') {
              await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
              assert.deepEqual(await state(page), result.entered)
              assert.deepEqual(await trace(page), result.enteredTrace)
            } else {
              await target.click()
              const then = page.locator('.optional-cost-attack-inline:visible')
              await then.waitFor({ timeout: 20000 })
              // Read the transient status before waiting for the remaining animation.
              const pendingStatus = await page.locator('.battle-status-message').innerText()
              await settle(page)
              assert.match(pendingStatus, /等待決定是否支付攻擊後續效果代價/)
              assert.doesNotMatch(pendingStatus, /已略過/)
              result.ordinary = await state(page)
              assert.deepEqual(result.ordinary.top.battle.map(c => c.hp), scenario === 'target-faints' ? [4] : other ? [6, 1] : scenario === 'opponent-event' ? [3] : [3, 4])
              assert.equal(result.ordinary.top.trash, result.entered.top.trash + 3)
              assert.deepEqual(result.ordinary.bottom, { ...result.entered.bottom, battle: result.entered.bottom.battle.map(c => ({ ...c, rested: true })), support: result.entered.bottom.support.map(s => ({ ...s, rested: true })) })
              assert.match(await then.innerText(), /棄置 1 張手牌/)
              await page.locator('.effect-source-card img').first().evaluate(img => img.decode())
              assert.equal(await page.locator('.effect-source-card img').first().getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-026').imageUrl)
              if (negative.includes(scenario)) assert.match(await then.innerText(), /條件不成立/)
              else assert.doesNotMatch(await then.innerText(), /條件不成立/)
              const bounds = await then.boundingBox()
              assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1)
              await shot('then')
              const skip = ['no-hand', 'skip-then', 'skip-false-then'].includes(scenario)
              if (skip) {
                assert.equal(await then.getByRole('button', { name: '支付', exact: true }).isEnabled(), scenario !== 'no-hand')
                await then.getByRole('button', { name: '略過', exact: true }).click()
              } else {
                await then.getByRole('button', { name: '支付', exact: true }).click()
                const costs = then.locator('.modal-card-options > button')
                const confirm = then.getByRole('button', { name: '確認', exact: true })
                assert.equal(await confirm.isEnabled(), false)
                const cost = costs.filter({ hasText: scenario === 'item-hand' ? cards.find(c => c.cardNumber === 'BS12-012').name : scenario === 'blue-hand' ? cards.find(c => c.cardNumber === 'ST4-001').name : 'Mint Wafer Cookie' })
                assert.equal(await cost.count(), 1)
                await cost.click()
                assert.equal(await confirm.isEnabled(), true)
                assert.deepEqual(await state(page), result.ordinary)
                if (scenario === 'discard-deselect') {
                  await cost.click()
                  assert.equal(await confirm.isEnabled(), false)
                  await cost.click()
                }
                if (scenario === 'return-discard') {
                  await then.getByRole('button', { name: '返回', exact: true }).click()
                  assert.deepEqual(await state(page), result.ordinary)
                  await then.getByRole('button', { name: '支付', exact: true }).click()
                  assert.equal(await confirm.isEnabled(), false)
                  await cost.click()
                }
                assert.equal(await then.locator('.optional-cost-col').filter({ hasText: '個對手' }).count(), 0)
                await shot('discard-cost')
                await confirm.click()
              }
              await page.waitForFunction(() => !document.querySelector('.optional-cost-attack-inline'), null, { timeout: 20000 })
              await settle(page)
              result.afterThen = await state(page)
              const damage = !skip && !negative.includes(scenario) && scenario !== 'target-faints'
              assert.deepEqual(result.afterThen.top.battle.map(c => c.hp), scenario === 'target-faints' ? [4] : other ? [6] : scenario === 'opponent-event' ? [3] : [damage ? 2 : 3, 4])
              assert.equal(result.afterThen.bottom.hand, result.ordinary.bottom.hand - (skip ? 0 : 1))
              assert.equal(result.afterThen.bottom.trash, result.ordinary.bottom.trash + (skip ? 0 : 1))
              assert.equal(result.afterThen.top.trash, result.ordinary.top.trash + (damage ? 1 : 0))
              assert.equal(result.afterThen.bottom.deck, result.entered.bottom.deck)
              assert.deepEqual(result.afterThen.bottom.support, result.ordinary.bottom.support)
              assert.deepEqual(result.afterThen.bottom.battle, result.ordinary.bottom.battle)
              const commands = (await trace(page)).slice(result.enteredTrace.length).map(e => e.commandKind)
              assert.deepEqual(commands, ['declare-attack', 'resolve-attack-effect', 'resolve-optional-cost-attack'])
              result.thenTrace = (await trace(page)).at(-1)
              const steps = result.thenTrace.steps.join(' ')
              if (skip) assert.match(steps, /未支付代價/)
              else {
                assert.match(steps, /棄置手牌/)
                if (negative.includes(scenario)) assert.match(steps, /條件不成立/)
                else if (scenario === 'target-faints') assert.match(steps, /原受攻擊餅乾已離場/)
                else {
                  assert.match(steps, /原受攻擊/)
                  assert.match(steps, /受到 1 點傷害/)
                  assert.doesNotMatch(steps, /沒有符合條件的目標/)
                }
              }
              await shot('then-result')
            }
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
      writeFileSync(resolve(out, 'results.json'), JSON.stringify(results, null, 2))
      throw error
    } finally { await page.close() }
    results.push(result)
    writeFileSync(resolve(out, 'results.json'), JSON.stringify(results, null, 2))
    console.log(`PASS BS12-026 ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-026 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
