import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-012-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/candidates/official-festival-arena-bs12.en.json'), 'utf8')).cards
const references = readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json')).flatMap(file => JSON.parse(readFileSync(resolve(root, 'data/cards', file), 'utf8')).cards ?? [])
const cards = [...candidate.filter(card => existsSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`))), ...['BS4-095', 'BS7-061', 'ST1-001', 'ST4-001'].map(number => references.find(card => card.cardNumber === number))]
const cases = ['two', 'one-first', 'one-second', 'reverse', 'zero', 'deselect', 'back', 'cancel-payment', 'cancel-target', 'active-target', 'wrong-color', 'wrong-keyword', 'no-target', 'no-energy', 'wrong-energy', 'rested-energy', 'opponent-turn']
const blocked = ['no-energy', 'wrong-energy', 'rested-energy']
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'),
      hand: field?.querySelectorAll('.hand-card').length ?? 0,
      stage: field?.querySelector('.stage-zone img')?.getAttribute('src') ?? null,
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
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({ commandKind: entry.commandKind, summary: entry.summary, steps: entry.steps })))
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
      const fixture = cases.slice(9).includes(scenario) ? scenario : 'positive'
      const testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'positive' ? 'card:BS12-012'
        : process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'no-energy' ? 'card-negative:BS12-012' : `bs12-012:${fixture}`
      result.testState = testState
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${testState}&contract-card=BS12-012`)
      await page.locator('.game-shell').waitFor()
      await settle(page)
      result.before = await state(page)
      await page.getByRole('button', { name: 'Sweet Jams Guitar', exact: true }).locator('img').evaluate(image => image.decode())
      await page.getByRole('button', { name: 'Sweet Jams Guitar', exact: true }).click()
      if (blocked.includes(scenario) || scenario === 'opponent-turn') {
        assert.equal(await page.getByRole('button', { name: '使用', exact: true }).count(), 0)
        assert.equal(await page.locator('.effect-panel:not(.is-complete):visible').count(), 0)
        result.after = await state(page)
        result.trace = await trace(page)
        assert.deepEqual(result.after, result.before)
        assert.deepEqual(result.trace, [])
      } else {
        await page.getByRole('button', { name: '使用', exact: true }).click()
        const panel = page.locator('.effect-panel:not(.is-complete):visible')
        await panel.waitFor()
        assert.match(await panel.innerText(), /BS12-012/)
        await panel.locator('.effect-source-card .card-face img').evaluate(image => image.decode())
        assert.equal(await panel.locator('.effect-source-card .card-face img').getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-012').imageUrl)
        const next = panel.getByRole('button', { name: '下一步', exact: true })
        assert.equal(await next.isEnabled(), false)
        const payment = panel.locator('.effect-candidates-payment .effect-candidate-entry > button')
        assert.equal(await payment.count(), 1)
        await payment.click()
        assert.equal(await next.isEnabled(), true)
        // The board previews the selected support as rested before payment.
        const preview = structuredClone(result.before)
        preview.bottom.support[0].rested = true
        assert.deepEqual(await state(page), preview)
        assert.deepEqual(await trace(page), [])
        await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-payment.png`) })
        if (scenario === 'cancel-payment') await panel.getByRole('button', { name: '取消技能', exact: true }).click()
        else {
          await next.click()
          assert.match(await panel.innerText(), /最多 2 張我方戰鬥區的紅色【Arena】餅乾.*可選 0 張/s)
          const targets = panel.locator('.effect-candidates-target .effect-candidate-entry > button')
          const expected = scenario === 'no-target' ? [] : ['wrong-color', 'wrong-keyword'].includes(scenario) ? ['Cheerleader Cookie'] : ['Cheerleader Cookie', 'Langue de Chat Cookie']
          const names = await targets.allTextContents()
          assert.equal(names.length, expected.length)
          names.forEach((name, index) => assert.ok(name.includes(expected[index])))
          result.candidates = expected
          const selected = ['zero', 'no-target', 'deselect', 'cancel-target'].includes(scenario) ? []
            : scenario === 'one-second' ? ['Langue de Chat Cookie']
              : ['one-first', 'active-target', 'wrong-color', 'wrong-keyword'].includes(scenario) ? ['Cheerleader Cookie']
                : scenario === 'reverse' ? ['Langue de Chat Cookie', 'Cheerleader Cookie'] : expected
          if (scenario === 'deselect') {
            await targets.filter({ hasText: 'Cheerleader Cookie' }).click()
            await targets.filter({ hasText: 'Cheerleader Cookie' }).click()
            assert.equal(await targets.filter({ hasText: 'Cheerleader Cookie' }).getAttribute('aria-pressed'), 'false')
          }
          for (const name of selected) await targets.filter({ hasText: name }).click()
          if (scenario === 'back') {
            await panel.getByRole('button', { name: '上一步', exact: true }).click()
            assert.deepEqual(await state(page), preview)
            assert.equal(await panel.locator('.effect-candidates-payment .effect-candidate-entry > button').getAttribute('aria-pressed'), 'true')
            await panel.getByRole('button', { name: '下一步', exact: true }).click()
            // Returning preserves the selected targets as well as unpaid energy.
            for (const name of selected) assert.equal(await targets.filter({ hasText: name }).getAttribute('aria-pressed'), 'true')
          }
          result.selection = await panel.innerText()
          await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-selection.png`) })
          assert.deepEqual(await state(page), preview)
          assert.deepEqual(await trace(page), [])
          if (scenario === 'cancel-target') await panel.getByRole('button', { name: '取消技能', exact: true }).click()
          else {
            await panel.getByRole('button', { name: '確認發動', exact: true }).click()
            result.resultText = await page.locator('.effect-panel.is-complete:visible').innerText()
            if (!selected.length) assert.match(result.resultText, /未選擇餅乾，未將任何餅乾設為活躍/)
            else for (const name of selected) assert.ok(result.resultText.includes(name))
            await settle(page)
            result.after = await state(page)
            assert.equal(result.after.bottom.hand, 0)
            assert.equal(result.after.bottom.trash, 1)
            assert.equal(result.after.bottom.support[0].rested, true)
            assert.deepEqual(result.after.bottom.battle.map(card => card.rested), [selected.includes('Cheerleader Cookie') ? false : result.before.bottom.battle[0].rested, selected.includes('Langue de Chat Cookie') ? false : result.before.bottom.battle[1].rested])
            assert.deepEqual(result.after.bottom.battle.map(card => card.hp), result.before.bottom.battle.map(card => card.hp))
            assert.deepEqual(result.after.bottom.battle.map(card => card.equipped), result.before.bottom.battle.map(card => card.equipped))
            assert.deepEqual(result.after.top, result.before.top)
            for (const key of ['deck', 'stage']) assert.deepEqual(result.after.bottom[key], result.before.bottom[key])
            result.trace = await trace(page)
            assert.deepEqual(result.trace.map(entry => entry.commandKind), ['begin-play-item', 'resolve-ability-effect'])
            assert.match(result.trace[0].steps.join(' '), /支付.*Langue de Chat Cookie/)
            if (!selected.length) assert.match(result.trace[1].steps.join(' '), /選擇 0 個目標/)
            else for (const name of selected) assert.ok(result.trace[1].steps.join(' ').includes(name))
            await page.getByRole('button', { name: '結束主要階段', exact: true }).click()
            await page.getByRole('button', { name: '結束回合', exact: true }).click()
            await settle(page)
            assert.equal(await page.locator('.effect-panel:not(.is-complete):visible').count(), 0)
            assert.match(await page.title(), /對手回合/)
          }
        }
        if (['cancel-payment', 'cancel-target'].includes(scenario)) {
          result.after = await state(page)
          result.trace = await trace(page)
          assert.deepEqual(result.after, result.before)
          assert.deepEqual(result.trace, [])
          assert.equal(await page.locator('.effect-panel:not(.is-complete):visible').count(), 0)
          assert.equal(await page.getByRole('button', { name: '結束主要階段', exact: true }).isEnabled(), true)
        }
      }
      await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-result.png`) })
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
      await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-failure.png`) }).catch(() => {})
      results.push(result)
      writeFileSync(resolve(out, 'results.json'), JSON.stringify(results, null, 2))
      throw error
    } finally { await page.close() }
    results.push(result)
    writeFileSync(resolve(out, 'results.json'), JSON.stringify(results, null, 2))
    console.log(`PASS ${scenario} ${viewport.width}x${viewport.height}`)
  }
} finally { await browser.close() }
console.log(`BS12-012 Browser ${results.filter(result => result.status === 'PASS').length}/${results.length}`)
