// BS12-010 independent initial payment, optional resting cost, draw and linked modifier.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-010-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/candidates/official-festival-arena-bs12.en.json'), 'utf8')).cards
const references = readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json')).flatMap(file => JSON.parse(readFileSync(resolve(root, 'data/cards', file), 'utf8')).cards ?? [])
const cards = [...candidate.filter(card => existsSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`))), ...['BS4-095', 'BS7-061', 'ST4-001'].map(number => references.find(card => card.cardNumber === number))]
const cases = ['attacker', 'draw-zero', 'skip-then', 'other', 'zero', 'zero-draw-zero', 'cancel-energy', 'cancel-target', 'deselect', 'back-target', 'return-cost', 'reverse-cost', 'one-rested', 'two-rested', 'non-arena', 'mic-equipped', 'no-energy', 'wrong-energy', 'rested-energy', 'disabled', 'used']
const unavailableThen = ['one-rested', 'two-rested', 'non-arena', 'mic-equipped']
const blocked = ['no-energy', 'wrong-energy', 'rested-energy', 'disabled', 'used']
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'),
      hand: field?.querySelectorAll('.hand-card').length ?? 0,
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
        rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
        equipped: node.querySelector('.badge-equip')?.getAttribute('aria-label') ?? null })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'),
        rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({ commandKind: entry.commandKind, steps: entry.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') &&
  ![...document.querySelectorAll('button')].some(button => button.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({ viewport })
    const result = { scenario, viewport, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), error: request.failure()?.errorText, resourceType: request.resourceType() }))
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const route = [...unavailableThen, ...blocked].includes(scenario) ? scenario : 'positive'
      const testState = process.env.BS12_BROWSER_ROUTE === 'generic' && route === 'positive' ? 'card:BS12-010'
        : process.env.BS12_BROWSER_ROUTE === 'generic' && route === 'no-energy' ? 'card-negative:BS12-010' : `bs12-010:${route}`
      result.testState = testState
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${testState}&contract-card=BS12-010`)
      await page.locator('.game-shell').waitFor()
      await settle(page)
      result.before = await state(page)
      const modal = page.locator('.trap-response-modal:visible')
      if (blocked.includes(scenario)) {
        if (scenario === 'disabled') {
          await page.getByRole('button', { name: '了解，繼續傷害結算', exact: true }).waitFor()
          assert.match(await modal.innerText(), /本次戰鬥無法發動陷阱/)
          assert.equal(await modal.locator('.modal-card-options > button').count(), 0, 'The seal notice must not offer any trap')
        } else assert.equal(await modal.count(), 0, 'Unaffordable traps cannot be offered')
        if (scenario === 'disabled') await page.getByRole('button', { name: '了解，繼續傷害結算', exact: true }).click()
        await page.waitForFunction(() => !document.querySelector('[data-card-instance-id="bs12-009-defender"]'))
        await page.getByRole('button', { name: '不補餅乾', exact: true }).click()
        await settle(page)
        result.after = await state(page)
        assert.equal(result.after.bottom.hand, 1)
        assert.equal(result.after.bottom.deck, 12)
        assert.equal(result.after.bottom.trash, 4)
        assert.equal(result.after.bottom.support[0]?.rested ?? false, scenario === 'rested-energy')
        assert.deepEqual(await trace(page), [])
      } else {
        const trap = modal.locator('.modal-card-options > button').filter({ hasText: 'A Moment of Misunderstanding' })
        await trap.locator('img').evaluate(image => image.decode())
        await trap.click()
        assert.match(await modal.innerText(), /BS12-010/)
        assert.doesNotMatch(await modal.innerText(), /陷阱代價/)
        const next = modal.getByRole('button', { name: '下一步', exact: true })
        assert.equal(await next.isEnabled(), false)
        if (scenario !== 'cancel-energy') {
          await modal.locator('.trap-guided-section .trap-discard-options > button').click()
          await next.click()
          const targets = modal.locator('.trap-effect-target-step .trap-target-options > button')
          assert.equal(await targets.count(), 2)
          const confirm = modal.getByRole('button', { name: '確認發動', exact: true })
          assert.equal(await confirm.isEnabled(), true)
          if (!scenario.startsWith('zero')) await targets.filter({ hasText: scenario === 'other' ? 'Peach Cookie' : 'Langue de Chat Cookie' }).click()
          if (scenario === 'back-target') {
            await modal.getByRole('button', { name: '上一步', exact: true }).click()
            await next.click()
            assert.match(await targets.filter({ hasText: 'Langue de Chat Cookie' }).getAttribute('class'), /is-selected/)
          }
          if (scenario === 'deselect') {
            await targets.filter({ hasText: 'Langue de Chat Cookie' }).click()
            assert.equal(await confirm.isEnabled(), true)
            await targets.filter({ hasText: 'Langue de Chat Cookie' }).click()
          }
          assert.deepEqual(await trace(page), [])
          if (scenario !== 'cancel-target') {
            await confirm.click()
            await settle(page)
            await page.getByRole('button', { name: '確認發動', exact: true }).click()
            const then = page.locator('.optional-cost-attack-inline')
            await then.waitFor()
            result.initial = await state(page)
            assert.equal(result.initial.bottom.support[0].rested, true)
            assert.equal(result.initial.bottom.trash, 1)
            assert.equal(result.initial.bottom.hand, 0)
            assert.deepEqual(result.initial.bottom.battle, result.before.bottom.battle)
            assert.equal(Number(await page.locator('[data-card-instance-id="bs12-009-attacker"] .badge-atk').innerText()), scenario === 'other' || scenario.startsWith('zero') ? 4 : 3)
            await page.locator('.effect-source-card img').first().evaluate(image => image.decode())
            assert.match(await then.innerText(), /2 張 Arena 餅乾設為橫置/)
            assert.doesNotMatch(await then.innerText(), /代價：\s*無/)
            const skip = scenario === 'skip-then' || unavailableThen.includes(scenario)
            if (skip) {
              assert.equal(await then.getByRole('button', { name: '支付', exact: true }).isEnabled(), !unavailableThen.includes(scenario))
              if (unavailableThen.includes(scenario)) assert.match(await then.innerText(), /沒有足夠/)
              await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-then.png`) })
              await then.getByRole('button', { name: '略過', exact: true }).click()
            } else {
              await then.getByRole('button', { name: '支付', exact: true }).click()
              const costs = then.locator('.optional-position-cost .modal-card-options > button')
              const confirmCost = then.getByRole('button', { name: '確認', exact: true })
              assert.equal(await costs.count(), 2)
              assert.equal(await confirmCost.isEnabled(), false)
              await costs.nth(scenario === 'reverse-cost' ? 1 : 0).click()
              assert.equal(await confirmCost.isEnabled(), false)
              await costs.nth(scenario === 'reverse-cost' ? 0 : 1).click()
              if (scenario === 'deselect') {
                await costs.nth(0).click()
                assert.equal(await confirmCost.isEnabled(), false)
                await costs.nth(0).click()
              }
              if (scenario === 'return-cost') {
                await then.getByRole('button', { name: '返回', exact: true }).click()
                assert.deepEqual(await state(page), result.initial)
                await then.getByRole('button', { name: '支付', exact: true }).click()
                assert.equal(await costs.nth(0).getAttribute('aria-pressed'), 'false')
                await costs.nth(0).click(); await costs.nth(1).click()
              }
              assert.deepEqual(await state(page), result.initial)
              await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-cost.png`) })
              await confirmCost.click()
              await settle(page)
              await page.getByRole('button', { name: '確認發動', exact: true }).click()
              const drawModal = page.locator('.draw-up-to-modal:visible')
              await drawModal.waitFor()
              const drawCount = scenario.includes('draw-zero') ? 0 : 1
              await drawModal.locator('.draw-up-to-option').filter({ hasText: drawCount === 0 ? '不抽' : '抽 1 張' }).click()
              await drawModal.getByRole('button', { name: drawCount === 0 ? '略過抽牌' : '抽取 1 張牌', exact: true }).click()
              await settle(page)
              const linked = page.locator('.effect-panel-body')
              await linked.waitFor()
              const fixed = linked.locator('.effect-candidates-target button')
              assert.equal(await fixed.count(), scenario.startsWith('zero') ? 0 : 1)
              for (const button of await fixed.all()) assert.equal(await button.isEnabled(), false, 'Linked target is fixed and cannot be selected again')
              assert.match(await linked.innerText(), /不能改選目標|固定套用/)
              await page.getByRole('button', { name: '確認發動', exact: true }).click()
            }
            if (scenario === 'other' || scenario.startsWith('zero')) {
              await page.waitForFunction(() => !document.querySelector('[data-card-instance-id="bs12-009-defender"]'))
              await page.getByRole('button', { name: '不補餅乾', exact: true }).click()
            } else {
              await page.waitForFunction(expected => document.querySelector('[data-card-instance-id="bs12-009-defender"] .hp-card-stack')?.getAttribute('aria-label')?.includes(`HP 卡 ${expected} 張`), skip ? 1 : 2)
            }
            await settle(page)
            result.after = await state(page)
            result.trace = await trace(page)
            const expected = skip
              ? ['play-trap', 'resolve-ability-effect', 'resolve-optional-cost-attack']
              : ['play-trap', 'resolve-ability-effect', 'resolve-optional-cost-attack', 'resolve-ability-effect', 'resolve-draw-up-to', 'resolve-ability-effect']
            assert.deepEqual(result.trace.map(entry => entry.commandKind), expected)
            const drawCount = !skip && !scenario.includes('draw-zero') ? 1 : 0
            assert.equal(result.after.bottom.hand, drawCount)
            assert.equal(result.after.bottom.deck, 12 - drawCount)
            assert.equal(result.after.bottom.trash, scenario === 'other' || scenario.startsWith('zero') ? 5 : skip ? 4 : 3)
            assert.equal(result.after.bottom.support[0].rested, true)
            if (!skip) assert.ok(result.after.bottom.battle.every(cookie => cookie.rested))
            else assert.deepEqual(result.after.bottom.battle.map(c => c.rested), result.before.bottom.battle.map(c => c.rested))
            assert.deepEqual(result.after.top, result.before.top)
            const attackerDamage = Number(await page.locator('[data-card-instance-id="bs12-009-attacker"] .badge-atk').innerText())
            const otherDamage = Number(await page.locator('[data-card-instance-id="bs12-009-other"] .badge-atk').innerText())
            assert.equal(attackerDamage, scenario === 'other' || scenario.startsWith('zero') ? 4 : skip ? 3 : 2)
            assert.equal(otherDamage, scenario === 'other' ? 0 : 1)
            result.attackBadges = { attackerDamage, otherDamage }
            if (!skip) {
              assert.match(JSON.stringify(result.trace[2].steps), /餅乾設為橫置.*Langue de Chat Cookie|餅乾設為橫置.*Pancake Cookie/s)
              assert.match(JSON.stringify(result.trace[5].steps), scenario.startsWith('zero') ? /未選前段目標.*無合法目標/ : /同一張.*追加 -1/)
            }
          }
        }
        if (scenario.startsWith('cancel')) {
          await modal.getByRole('button', { name: '不發動', exact: true }).click()
          await modal.waitFor({ state: 'hidden' })
          const after = await state(page)
          assert.equal(after.bottom.hand, 1)
          assert.equal(after.bottom.support[0].rested, false)
          assert.ok(after.bottom.battle.every(cookie => !cookie.rested))
          assert.deepEqual(await trace(page), [])
          result.after = after
        }
      }
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
      await page.mouse.move(viewport.width - 5, viewport.height - 5)
      await settle(page)
      await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-result.png`) })
      result.status = 'PASS'
    } catch (error) {
      result.error = String(error.stack ?? error)
      result.debug = await page.locator('body').innerText().catch(() => '')
    } finally { results.push(result); await page.close() }
    console.log(`${result.status} ${scenario} ${viewport.width}${result.error ? ': ' + result.error.split('\n')[0] : ''}`)
    if (result.status !== 'PASS') throw new Error(result.error)
  }
} finally {
  await browser.close()
  writeFileSync(resolve(out, 'results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2) + '\n')
}
