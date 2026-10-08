import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-020-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/candidates/official-festival-arena-bs12.en.json'), 'utf8')).cards
const references = readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json')).flatMap(file => JSON.parse(readFileSync(resolve(root, 'data/cards', file), 'utf8')).cards ?? [])
const cards = [...candidate.filter(card => existsSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`))), ...["BS6-017","BS7-061","ST4-001","BS6-008"].map(number => references.find(card => card.cardNumber === number))]
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
const cases = ['positive', 'one', 'other', 'zero', 'skip', 'deselect', 'cancel-draft', 'three-arena', 'five-arena', 'non-arena-break', 'opponent-break', 'trash-arena', 'high-level', 'mixed-arena', 'no-hand', 'item-hand', 'last-hp', 'last-hp-other', 'follow-up', 'attack', 'wrong-energy', 'few-energy', 'rested-energy', 'cancel-attack']
const routeCase = scenario => ['one', 'other', 'zero', 'skip', 'deselect', 'cancel-draft'].includes(scenario) ? 'positive' : scenario === 'last-hp-other' ? 'last-hp' : scenario === 'cancel-attack' ? 'attack' : scenario
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({ viewport })
    const result = { number: 'BS12-020', scenario, viewport, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), error: request.failure()?.errorText, resourceType: request.resourceType() }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const fixture = routeCase(scenario)
      const testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'positive' ? 'card:BS12-020'
        : process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'three-arena' ? 'card-negative:BS12-020' : `bs12-020:${fixture}`
      result.testState = testState
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${testState}&contract-card=BS12-020`)
      await page.locator('.game-shell').waitFor()
      await settle(page)
      result.before = await state(page)
      result.scope = false ? 'Prepared movement/equipment/timing control; its printed parent not accepted' : 'Original printed cards and actual local commands'
      result.combatArt = await page.locator('.combat-card-wrap').evaluateAll(async (nodes, urls) => Promise.all(nodes.map(async node => {
        const image = node.querySelector('img')
        if (!image || !urls.includes(image.src)) throw new Error('Missing original combat art')
        await image.decode()
        if (!image.naturalWidth) throw new Error('Original combat art did not load')
        return { id: node.getAttribute('data-card-instance-id'), url: image.src }
      })), cards.map(card => card.imageUrl))
      assert.equal(result.combatArt.length, result.before.bottom.battle.length + result.before.top.battle.length)
      assert.ok(result.before.bottom.battle.length <= 2 && result.before.top.battle.length <= 2)
      const attackCase = ['attack', 'wrong-energy', 'few-energy', 'rested-energy', 'cancel-attack'].includes(scenario)
      if (attackCase) {
        const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-020-source"]')
        await source.locator('img').first().evaluate(image => image.decode())
        assert.equal(await source.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-020').imageUrl)
        assert.equal(await source.locator('.skill-action').count(), 0)
        if (['wrong-energy', 'few-energy', 'rested-energy'].includes(scenario)) {
          assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
          assert.deepEqual(await state(page), result.before)
          assert.deepEqual(await trace(page), [])
        } else {
          await source.locator('.card-face.is-attackable').click()
          for (const index of [2, 0, 1]) await page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="bs12-020-payment-${index}"] .card-face`).click()
          await shot('payment')
          if (scenario === 'cancel-attack') {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await state(page), result.before)
            assert.deepEqual(await trace(page), [])
          } else {
            await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-019-opponent"] .card-face[aria-label^="選擇攻擊目標："]').click()
            await page.waitForFunction(() => /HP 卡 3 張/.test(document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="bs12-019-opponent"] .hp-card-stack')?.getAttribute('aria-label') ?? ''))
            await settle(page)
            const after = await state(page)
            assert.deepEqual(after.top.battle.map(c => c.hp), [3, 4])
            assert.equal(after.top.trash, 3)
            assert.equal(after.bottom.battle[0].hp, 3)
            assert.equal(after.bottom.battle[0].rested, true)
            assert.deepEqual(after.bottom.support, result.before.bottom.support.map(s => ({ ...s, rested: true })))
            assert.equal(after.bottom.deck, 12)
            assert.equal(after.bottom.trash, 0)
            assert.deepEqual((await trace(page)).filter(t => t.commandKind === 'resolve-attack-effect'), [])
          }
        }
      } else {
        const blocked = ['three-arena', 'non-arena-break', 'opponent-break', 'trash-arena', 'high-level'].includes(scenario)
        const dialog = page.locator('.flip-response-modal')
        if (blocked) {
          assert.equal(await dialog.count(), 0)
          assert.equal(result.before.bottom.deck, 12)
          assert.equal(result.before.bottom.hand, 1)
          assert.deepEqual(result.before.bottom.battle.map(c => c.hp), [3, 3])
          assert.equal(result.before.bottom.trash, scenario === 'trash-arena' ? 5 : 1)
          assert.equal((await trace(page)).some(t => t.commandKind === 'resolve-flip'), false)
        } else {
          await dialog.waitFor()
          const art = dialog.locator('img[alt="Strawberry Stick Cookie"]').first()
          await art.evaluate(image => image.decode())
          assert.equal(await art.getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-020').imageUrl)
          assert.match(await dialog.innerText(), /4.*Arena|Arena.*4/s)
          const candidates = dialog.locator('.flip-choice-options[aria-label="FLIP 效果目標"] > button')
          assert.deepEqual((await candidates.locator(':scope > span').allTextContents()).map(s => s.trim()), [scenario.startsWith('last-hp') ? 'Mint Wafer Cookie' : scenario === 'follow-up' ? 'Parfait Cookie' : 'Langue de Chat Cookie', 'Candy Diver Cookie'])
          const pay = dialog.locator('.modal-card-options > button')
          const activate = dialog.getByRole('button', { name: '發動 FLIP', exact: true })
          assert.equal(await activate.isEnabled(), false)
          if (scenario === 'no-hand' || scenario === 'skip') {
            assert.equal(await pay.count(), scenario === 'no-hand' ? 0 : 1)
            await dialog.getByRole('button', { name: '不發動', exact: true }).click()
          } else {
            const zero = scenario === 'zero'
            const onlyBearer = ['one', 'last-hp'].includes(scenario)
            const onlyOther = ['other', 'last-hp-other'].includes(scenario)
            if (!zero) {
              if (!onlyBearer) await candidates.nth(1).click()
              if (!onlyOther) await candidates.nth(0).click()
            }
            assert.deepEqual(await candidates.evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-pressed'))), [!zero && !onlyOther ? 'true' : 'false', !zero && !onlyBearer ? 'true' : 'false'])
            await pay.click()
            if (scenario === 'deselect') {
              await candidates.nth(0).click()
              await candidates.nth(1).click()
              await pay.click()
              assert.equal(await activate.isEnabled(), false)
              assert.deepEqual(await candidates.evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-pressed'))), ['false', 'false'])
              assert.deepEqual(await state(page), result.before)
              await candidates.nth(1).click()
              await candidates.nth(0).click()
              await pay.click()
            }
            await shot('selection')
            assert.equal(await activate.isEnabled(), true)
            if (scenario === 'cancel-draft') await dialog.getByRole('button', { name: '不發動', exact: true }).click()
            else await activate.click()
          }
          await dialog.waitFor({ state: 'hidden' })
          await settle(page)
          const declined = ['no-hand', 'skip', 'cancel-draft'].includes(scenario)
          const targets = declined || scenario === 'zero' ? 0 : ['one', 'other', 'last-hp', 'last-hp-other'].includes(scenario) ? 1 : 2
          const bearerGain = !declined && !['zero', 'other', 'last-hp-other'].includes(scenario)
          const otherGain = !declined && !['zero', 'one', 'last-hp'].includes(scenario)
          await page.waitForFunction(() => !document.querySelector('.effect-panel:not(.is-complete)'))
          result.flipAfter = await state(page)
          const after = result.flipAfter
          assert.equal(after.bottom.battle.find(c => c.id === 'bs12-020-bearer')?.hp, scenario === 'last-hp-other' ? undefined : scenario === 'last-hp' ? 1 : scenario === 'follow-up' ? 2 : bearerGain ? 4 : 3)
          assert.equal(after.bottom.battle.find(c => c.id === 'bs12-020-companion').hp, otherGain ? 4 : 3)
          assert.equal(after.bottom.deck, 12 - targets)
          assert.equal(after.bottom.hand, scenario === 'no-hand' || !declined ? 0 : 1)
          assert.equal(after.bottom.trash, (declined ? 1 : 2) + (scenario === 'follow-up' ? 3 : 0))
          assert.deepEqual(after.bottom.support, result.before.bottom.support)
          assert.deepEqual(after.top, result.before.top)
          const flipTrace = (await trace(page)).filter(t => t.commandKind === 'resolve-flip')
          assert.equal(flipTrace.length, 1)
          assert.match(flipTrace[0].steps.join(' '), declined ? /不發動|略過/ : targets === 0 ? /未選擇目標|未補入|未增加|沒有/ : /HP|血量/)
          if (scenario === 'last-hp-other') {
            await page.getByRole('button', { name: '不補餅乾', exact: true }).click()
            await settle(page)
            assert.deepEqual(await state(page), after)
          }
          await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
          await shot('public-trace')
          await page.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
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
    console.log(`PASS BS12-020 ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-020 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
