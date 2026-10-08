// BS12-009: R plus mandatory resting cost, optional opponent attack modifier.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-009-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-festival-arena-bs12.en.json'), 'utf8')).cards
const references = readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json')).flatMap(file => JSON.parse(readFileSync(resolve(root, 'data/cards', file), 'utf8')).cards ?? [])
const cards = [...candidate.filter(card => existsSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`))), ...['BS4-095', 'BS7-061', 'ST4-001'].map(number => references.find(card => card.cardNumber === number))]
const cases = ['attacker', 'other', 'zero', 'cancel-energy', 'cancel-cost', 'cancel-target', 'deselect', 'back-cost', 'one-rested', 'two-rested', 'non-arena', 'mic-equipped', 'no-energy', 'wrong-energy', 'rested-energy', 'disabled', 'used']
const blockedCases = cases.slice(8)
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
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), error: request.failure()?.errorText, resourceType: request.resourceType() }))
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const route = blockedCases.includes(scenario) ? scenario : 'positive'
      const testState = process.env.BS12_BROWSER_ROUTE === 'generic' && route === 'positive' ? 'card:BS12-009'
        : process.env.BS12_BROWSER_ROUTE === 'generic' && route === 'two-rested' ? 'card-negative:BS12-009' : `bs12-009:${route}`
      result.testState = testState
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${testState}&contract-card=BS12-009`)
      await page.locator('.game-shell').waitFor()
      await settle(page)
      for (const id of ['bs12-009-attacker', 'bs12-009-ally', 'bs12-009-other']) await page.locator(`[data-card-instance-id="${id}"] img`).first().evaluate(image => image.decode())
      result.before = await state(page)
      const modal = page.locator('.trap-response-modal:visible')
      if (blockedCases.includes(scenario)) {
        if (scenario === 'disabled') {
          await page.getByRole('button', { name: '了解，繼續傷害結算', exact: true }).waitFor()
          assert.match(await modal.innerText(), /本次戰鬥無法發動陷阱/)
          assert.equal(await modal.locator('.modal-card-options > button').count(), 0, 'The seal notice must not offer any trap')
        } else assert.equal(await modal.count(), 0, 'Unaffordable traps cannot be offered')
        if (scenario === 'disabled') {
          await page.getByRole('button', { name: '了解，繼續傷害結算', exact: true }).click()
        }
        await page.waitForFunction(() => !document.querySelector('[data-card-instance-id="bs12-009-defender"]'))
        await page.getByRole('button', { name: '不補餅乾', exact: true }).click()
        await settle(page)
        result.after = await state(page)
        assert.equal(result.after.bottom.hand, 1, 'Trap stays in hand after the normal attack')
        assert.equal(result.after.bottom.trash, scenario === 'mic-equipped' ? 5 : 4, 'Only HP and fainted host equipment enter trash')
        assert.equal(result.after.bottom.deck, 12)
        assert.equal(result.after.bottom.battle.length, 1)
        assert.equal(result.after.bottom.battle[0].rested, scenario === 'two-rested')
        assert.ok(result.after.bottom.support.every(card => card.rested === (scenario === 'rested-energy')))
        await page.locator('.hand-card img').first().evaluate(image => image.decode())
        assert.deepEqual(await trace(page), [])
      } else {
        await modal.waitFor()
        const trap = modal.locator('.modal-card-options > button').filter({ hasText: 'Clumsy Day' })
        await trap.locator('img').first().evaluate(image => image.decode())
        assert.equal(await trap.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-009').imageUrl)
        await trap.click()
        const next = modal.getByRole('button', { name: '下一步', exact: true })
        assert.equal(await next.isEnabled(), false)
        if (scenario !== 'cancel-energy') {
          await modal.locator('.trap-guided-section .trap-discard-options > button').click()
          await next.click()
          const costs = modal.locator('.trap-position-cost .modal-card-options > button')
          assert.equal(await costs.count(), 2)
          assert.match(await modal.innerText(), /陷阱代價.*2.*Arena.*橫置/s)
          assert.equal(await next.isEnabled(), false)
          await costs.nth(0).click()
          assert.equal(await next.isEnabled(), false, 'One Cookie cannot pay two-Cookie cost')
          if (scenario !== 'cancel-cost') {
            await costs.nth(1).click()
            if (scenario === 'deselect') {
              await costs.nth(0).click()
              assert.equal(await next.isEnabled(), false)
              await costs.nth(0).click()
            }
            result.preview = await state(page)
            assert.deepEqual({ ...result.preview, bottom: { ...result.preview.bottom, support: result.before.bottom.support } }, result.before, 'Only payment CSS previews a rest; Cookies/zones remain unchanged')
            assert.deepEqual(await trace(page), [])
            await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-cost.png`) })
            await next.click()
            if (scenario === 'back-cost') {
              await modal.getByRole('button', { name: '上一步', exact: true }).click()
              assert.equal(await costs.nth(0).getAttribute('aria-pressed'), 'true')
              await next.click()
            }
            const targets = modal.locator('.trap-effect-target-step .trap-target-options > button')
            assert.equal(await targets.count(), 2, 'Every opponent Cookie can be selected')
            const confirm = modal.getByRole('button', { name: '確認發動', exact: true })
            assert.equal(await confirm.isEnabled(), true, 'Up to one allows zero targets')
            if (scenario !== 'zero') await (scenario === 'other' ? targets.filter({ hasText: 'Peach Cookie' }) : targets.filter({ hasText: 'Langue de Chat Cookie' })).click()
            if (scenario === 'deselect') {
              await targets.filter({ hasText: 'Langue de Chat Cookie' }).click()
              assert.equal(await confirm.isEnabled(), true)
              await targets.filter({ hasText: 'Langue de Chat Cookie' }).click()
            }
            const targetPreview = await state(page)
            assert.deepEqual({ ...targetPreview, bottom: { ...targetPreview.bottom, support: result.before.bottom.support } }, result.before)
            assert.deepEqual(await trace(page), [])
            await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-target.png`) })
            if (scenario !== 'cancel-target') {
              await confirm.click()
              await modal.waitFor({ state: 'hidden' })
              await page.waitForFunction(() => (window.__braverseContractTrace ?? []).some(entry => entry.commandKind === 'play-trap'))
              result.trace = await trace(page)
              assert.deepEqual(result.trace.map(entry => entry.commandKind), ['play-trap'])
              const steps = result.trace[0].steps
              assert.match(JSON.stringify(steps), /支付能量.*陷阱代價/s)
              const positionStep = steps.find(step => step.includes('陷阱代價'))
              assert.match(positionStep, /Langue de Chat Cookie/)
              assert.match(positionStep, /Pancake Cookie/)
              if (['zero', 'other'].includes(scenario)) {
                await page.waitForFunction(() => !document.querySelector('[data-card-instance-id="bs12-009-defender"]'))
                await page.getByRole('button', { name: '不補餅乾', exact: true }).click()
              } else {
                await page.waitForFunction(() => document.querySelector('[data-card-instance-id="bs12-009-defender"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 3 張'))
              }
              await settle(page)
              result.after = await state(page)
              assert.equal(result.after.bottom.hand, 0)
              assert.equal(result.after.bottom.support[0].rested, true)
              assert.ok(result.after.bottom.battle.every(cookie => cookie.rested))
              assert.equal(result.after.bottom.trash, ['zero', 'other'].includes(scenario) ? 5 : 2)
              assert.equal(result.after.bottom.deck, result.before.bottom.deck)
              assert.deepEqual(result.after.top, result.before.top)
              const attackerDamage = Number(await page.locator('[data-card-instance-id="bs12-009-attacker"] .badge-atk').innerText())
              const otherDamage = Number(await page.locator('[data-card-instance-id="bs12-009-other"] .badge-atk').innerText())
              assert.equal(attackerDamage, ['zero', 'other'].includes(scenario) ? 4 : 1)
              assert.equal(otherDamage, scenario === 'other' ? 0 : 1)
              result.attackBadges = { attackerDamage, otherDamage }
            }
          }
        }
        if (scenario.startsWith('cancel')) {
          await modal.getByRole('button', { name: '不發動', exact: true }).click()
          // Cancellation declines the response; no trap/payment/status cost is spent.
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
