import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-025-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/candidates/official-festival-arena-bs12.en.json'), 'utf8')).cards
const references = readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json')).flatMap(file => JSON.parse(readFileSync(resolve(root, 'data/cards', file), 'utf8')).cards ?? [])
const cards = [...candidate.filter(card => existsSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`))), ...references.filter(card => ["ST4-001","BS9-029","P-024","BS6-008","BS6-017"].includes(card.cardNumber))]
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
const cases = ['positive', 'red-choux', 'rested-choux', 'no-choux', 'wrong-name', 'opponent-choux', 'support-choux', 'no-energy', 'rested-support', 'opponent-turn', 'zero', 'skip-onplay', 'target-deselect', 'selected-then-skip', 'hand-preview', 'attack', 'wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'target-faints', 'cancel-payment', 'cancel-attack-target', 'payment-deselect']
const attackCases = ['attack', 'wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'target-faints', 'cancel-payment', 'cancel-attack-target', 'payment-deselect']
const emptyCases = ['no-choux', 'wrong-name', 'opponent-choux', 'support-choux']
const routeCase = value => ['cancel-payment', 'cancel-attack-target', 'payment-deselect'].includes(value) ? 'attack' : ['zero', 'skip-onplay', 'target-deselect', 'selected-then-skip', 'hand-preview'].includes(value) ? 'positive' : value
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({ viewport })
    const result = { number: 'BS12-025', scenario, viewport, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const fixtureScenario = routeCase(scenario)
      result.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixtureScenario === 'positive' ? 'card:BS12-025' : process.env.BS12_BROWSER_ROUTE === 'generic' && fixtureScenario === 'no-choux' ? 'card-negative:BS12-025' : `bs12-025:${fixtureScenario}`
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${result.testState}&contract-card=BS12-025`)
      await page.locator('.game-shell').waitFor()
      await settle(page)
      result.before = await state(page)
      result.beforeTrace = await trace(page)
      const attack = attackCases.includes(scenario)
      const initialEntry = attack || scenario === 'opponent-turn'
      const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-025-source"]')
      const hand = page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-025-source"]')
      assert.equal(result.before.bottom.deck, initialEntry ? 11 : 12)
      assert.equal(result.before.bottom.hand, initialEntry ? 0 : 1)
      if (scenario === 'hand-preview') {
        await hand.locator('.card-face').click()
        const preview = page.getByRole('complementary', { name: 'Mayor Cuckoobeans快速預覽', exact: true })
        assert.match(await preview.innerText(), /BS12-025.*COOKIE/s)
        assert.match(await preview.innerText(), /Select up to 1 \[Caramel Choux Cookie\]/)
        assert.equal(await preview.getByRole('img', { name: 'Mayor Cuckoobeans', exact: true }).getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-025').imageUrl)
        await preview.getByRole('img', { name: 'Mayor Cuckoobeans', exact: true }).evaluate(image => image.decode())
        assert.deepEqual(await state(page), result.before)
        assert.deepEqual(await trace(page), result.beforeTrace)
      } else if (!attack) {
        if (!initialEntry) {
          await hand.locator('.card-face').click()
          await hand.getByRole('button', { name: '登場', exact: true }).click()
          await settle(page)
          await source.waitFor()
        }
        result.entered = await state(page)
        assert.equal(result.entered.bottom.battle.find(c => c.id === 'bs12-025-source').hp, 1)
        assert.equal(result.entered.bottom.deck, 11)
        assert.equal(result.entered.bottom.hand, 0)
        assert.equal(await source.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-025').imageUrl)
        await source.locator('img').first().evaluate(image => image.decode())
        const panel = page.locator('.effect-panel:not(.is-complete)')
        await panel.waitFor()
        assert.match(await panel.innerText(), /Mayor Cuckoobeans/)
        assert.match(await panel.innerText(), /最多 1 張我方「Caramel Choux Cookie」餅乾/)
        assert.equal(await panel.getByRole('button', { name: '支付代價', exact: true }).count(), 0)
        const options = panel.getByRole('button', { name: /^Caramel Choux Cookie/ })
        assert.equal(await options.count(), emptyCases.includes(scenario) ? 0 : 1)
        if (!emptyCases.includes(scenario)) {
          assert.match(await options.first().innerText(), /Caramel Choux Cookie/)
          const image = options.first().getByRole('img', { name: 'Caramel Choux Cookie', exact: true })
          assert.equal(await image.getAttribute('src'), cards.find(card => card.cardNumber === (scenario === 'red-choux' ? 'P-024' : 'BS9-029')).imageUrl)
          await image.evaluate(image => image.decode())
        }
        const box = await panel.boundingBox()
        assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1)
        await shot('on-play')
        const skip = ['skip-onplay', 'selected-then-skip'].includes(scenario)
        const selected = !emptyCases.includes(scenario) && !['zero', 'skip-onplay'].includes(scenario)
        if (selected) {
          await options.first().click()
          assert.equal(await options.first().getAttribute('aria-pressed'), 'true')
          assert.deepEqual(await state(page), result.entered)
          if (scenario === 'target-deselect') {
            await options.first().click()
            assert.equal(await options.first().getAttribute('aria-pressed'), 'false')
            assert.deepEqual(await state(page), result.entered)
            await options.first().click()
          }
        }
        await panel.getByRole('button', { name: skip ? '略過整個登場效果' : '確認發動', exact: true }).click()
        await page.waitForFunction(() => !document.querySelector('.effect-panel:not(.is-complete)'))
        await settle(page)
        result.skillAfter = await state(page)
        const gain = selected && !skip ? 1 : 0
        assert.deepEqual(result.skillAfter, { ...result.entered, bottom: { ...result.entered.bottom, deck: 11 - gain,
          battle: result.entered.bottom.battle.map(c => ({ ...c, hp: c.hp + (c.id === 'bs12-025-ally' ? gain : 0) })) } })
        assert.deepEqual((await trace(page)).map(entry => entry.commandKind), skip ? ['deploy-cookie', 'skip-on-play'] : scenario === 'opponent-turn' ? ['begin-activate-skill', 'resolve-ability-effect'] : ['deploy-cookie', 'begin-activate-skill', 'resolve-ability-effect'])
        result.statusText = (await page.getByRole('status').allTextContents()).join(' ')
        if (!skip) {
          const text = await page.locator('body').innerText()
          assert.match(text, gain ? /Caramel Choux Cookie.*獲得 1 HP/ : /未.*HP/)
          const steps = (await trace(page)).flatMap(entry => entry.steps ?? []).join(' ')
          assert.match(steps, gain ? /「Caramel Choux Cookie」增加 1 點 HP/ : /未增加 HP/)
        }
        await shot('settled')
      } else {
        const blocked = ['wrong-energy', 'few-energy', 'rested-energy', 'source-rested'].includes(scenario)
        assert.equal(result.before.bottom.battle.find(c => c.id === 'bs12-025-source').hp, 1)
        assert.deepEqual(result.beforeTrace.map(e => e.commandKind), ['deploy-cookie', 'skip-on-play'])
        if (blocked) {
          assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
          assert.deepEqual(await state(page), result.before)
          assert.deepEqual(await trace(page), result.beforeTrace)
          await shot('blocked')
        } else {
          await source.locator('.card-face.is-attackable').click()
          const support = page.locator('.bottom-field .support-card-wrap[data-card-instance-id="bs12-025-payment-0"] .card-face')
          const target = page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-025-opponent"] .card-face:not(.hp-card)')
          if (scenario === 'cancel-payment') {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await state(page), result.before)
            assert.deepEqual(await trace(page), result.beforeTrace)
          } else {
            await support.click()
            assert.deepEqual(await state(page), { ...result.before, bottom: { ...result.before.bottom, support: result.before.bottom.support.map(s => ({ ...s, rested: true })) } })
            assert.match(await target.getAttribute('aria-label'), /^選擇攻擊目標：/)
            if (scenario === 'payment-deselect') {
              await support.click()
              assert.deepEqual(await state(page), result.before)
              await support.click()
            }
            if (scenario === 'cancel-attack-target') {
              await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
              assert.deepEqual(await state(page), result.before)
              assert.deepEqual(await trace(page), result.beforeTrace)
            } else {
              await target.click()
              await page.waitForFunction(faint => {
                const node = document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="bs12-025-opponent"]')
                return faint ? !node : /HP 卡 5 張/.test(node?.querySelector('.hp-card-stack')?.getAttribute('aria-label') ?? '')
              }, scenario === 'target-faints', { timeout: 20000 })
              await settle(page)
              result.attackAfter = await state(page)
              assert.deepEqual(result.attackAfter.top.battle.map(c => c.hp), scenario === 'target-faints' ? [4] : [5, 4])
              assert.equal(result.attackAfter.top.trash, 1)
              assert.deepEqual(result.attackAfter.bottom, { ...result.before.bottom, support: result.before.bottom.support.map(s => ({ ...s, rested: true })),
                battle: result.before.bottom.battle.map(c => ({ ...c, rested: c.id === 'bs12-025-source' || c.rested })) })
              assert.deepEqual((await trace(page)).slice(result.beforeTrace.length).map(e => e.commandKind), ['declare-attack', 'resolve-battle'])
              assert.equal(await page.locator('.effect-panel:not(.is-complete)').count(), 0)
              await shot('attack-result')
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
    console.log(`PASS BS12-025 ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-025 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
