import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-023-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/candidates/official-festival-arena-bs12.en.json'), 'utf8')).cards
const references = readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json')).flatMap(file => JSON.parse(readFileSync(resolve(root, 'data/cards', file), 'utf8')).cards ?? [])
const cards = [...candidate.filter(card => existsSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`))), ...["ST4-001","BS7-061","BS6-008"].map(number => references.find(card => card.cardNumber === number))]
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
const cases = ['zero', 'two', 'three', 'five', 'six', 'eight', 'nine', 'non-arena', 'high-level', 'green-arena', 'opponent-break', 'trash-arena', 'history-only', 'opponent-turn', 'no-energy', 'rested-support', 'attack', 'wrong-energy', 'few-yellow', 'few-energy', 'rested-energy', 'refresh', 'skip-onplay', 'hand-preview', 'payment-deselect', 'cancel-payment', 'cancel-target']
const routeCase = value => value === 'skip-onplay' ? 'nine' : value === 'hand-preview' ? 'three' : ['payment-deselect', 'cancel-payment', 'cancel-target'].includes(value) ? 'attack' : value
const expectedGain = value => ['zero', 'two', 'non-arena', 'high-level', 'opponent-break', 'trash-arena', 'history-only', 'skip-onplay'].includes(value) ? 0
  : value === 'nine' ? 3 : ['six', 'eight', 'refresh'].includes(value) ? 2 : 1
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({ viewport })
    const result = { number: 'BS12-023', scenario, viewport, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), error: request.failure()?.errorText, resourceType: request.resourceType() }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const fixture = routeCase(scenario)
      const testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'three' ? 'card:BS12-023'
        : process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'zero' ? 'card-negative:BS12-023' : `bs12-023:${fixture}`
      result.testState = testState
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${testState}&contract-card=${scenario === 'refresh' ? 'BS12-023,BS12-022' : 'BS12-023'}`)
      await page.locator('.game-shell').waitFor()
      await settle(page)
      const attack = ['attack', 'wrong-energy', 'few-yellow', 'few-energy', 'rested-energy', 'payment-deselect', 'cancel-payment', 'cancel-target'].includes(scenario)
      const initialEntry = attack || scenario === 'opponent-turn'
      const hand = page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-023-source"]')
      const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-023-source"]')
      const art = (initialEntry ? source : hand).locator('img[alt="Chocolate Bonbon Cookie"]')
      await art.evaluate(image => image.decode())
      assert.equal(await art.getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-023').imageUrl)
      result.before = await state(page)
      result.scope = ['history-only', 'opponent-turn'].includes(scenario) ? 'Prepared movement/equipment/timing control; its printed parent not accepted' : 'Original printed cards and actual local commands'
      result.combatArt = await page.locator('.combat-card-wrap').evaluateAll(async (nodes, urls) => Promise.all(nodes.map(async node => {
        const image = node.querySelector('img')
        if (!image || !urls.includes(image.src)) throw new Error('Missing original combat art')
        await image.decode()
        if (!image.naturalWidth) throw new Error('Original combat art did not load')
        return { id: node.getAttribute('data-card-instance-id'), url: image.src }
      })), cards.map(card => card.imageUrl))
      assert.equal(result.combatArt.length, result.before.bottom.battle.length + result.before.top.battle.length)
      result.beforeTrace = await trace(page)
      assert.ok(result.before.bottom.battle.length <= 2 && result.before.top.battle.length <= 2)
      assert.equal(result.before.bottom.hand, initialEntry ? 0 : 1)
      assert.equal(result.before.bottom.deck, initialEntry ? 16 : scenario === 'refresh' ? 5 : 20)
      if (scenario === 'hand-preview') {
        await hand.locator('.card-face').click()
        assert.equal(await hand.getByRole('button', { name: '登場', exact: true }).isEnabled(), true)
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
        assert.equal(result.entered.bottom.battle.find(c => c.id === 'bs12-023-source').hp, 4)
        assert.equal(result.entered.bottom.deck, scenario === 'refresh' ? 1 : 16)
        assert.equal(result.entered.bottom.hand, 0)
        const panel = page.locator('.effect-panel:not(.is-complete)')
        await panel.waitFor()
        assert.match(await panel.innerText(), /Chocolate Bonbon Cookie/)
        assert.match(await panel.innerText(), /我方休息區每有 3 張【Arena】餅乾/)
        assert.equal(await panel.locator('.modal-card-options > button').count(), 0)
        assert.equal(await panel.getByRole('button', { name: '支付代價', exact: true }).count(), 0)
        const box = await panel.boundingBox()
        assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1)
        await shot('on-play')
        await panel.getByRole('button', { name: scenario === 'skip-onplay' ? '略過整個登場效果' : '確認發動', exact: true }).click()
        await settle(page)
        if (scenario === 'refresh') {
          const refresh = page.getByRole('alertdialog').filter({ hasText: '牌庫 Refresh' })
          await refresh.waitFor()
          assert.equal((await state(page)).bottom.battle.find(c => c.id === 'bs12-023-source').hp, 5)
          await shot('pending-refresh')
          await refresh.getByRole('button', { name: 'Mint Wafer Cookie Mint Wafer Cookie', exact: true }).click()
          await settle(page)
        }
        await page.waitForFunction(() => !document.querySelector('.effect-panel:not(.is-complete)'))
        const gained = expectedGain(scenario)
        result.skillAfter = await state(page)
        const after = result.skillAfter
        assert.equal(after.bottom.battle.find(c => c.id === 'bs12-023-source').hp, 4 + gained)
        assert.equal(after.bottom.deck, scenario === 'refresh' ? 11 : 16 - gained)
        assert.equal(after.bottom.hand, 0)
        assert.equal(after.bottom.battle.find(c => c.id === 'bs12-023-source').rested, false)
        assert.deepEqual(after.bottom.battle[0], result.entered.bottom.battle[0])
        assert.deepEqual(after.bottom.support, result.before.bottom.support)
        assert.equal(after.bottom.trash, scenario === 'refresh' ? 0 : result.before.bottom.trash)
        assert.deepEqual(after.top, result.before.top)
        const commands = (await trace(page)).map(entry => entry.commandKind)
        assert.deepEqual(commands, [...result.beforeTrace.map(e => e.commandKind), ...(!initialEntry ? ['deploy-cookie'] : []),
          ...(scenario === 'skip-onplay' ? ['skip-on-play'] : ['begin-activate-skill', 'resolve-ability-effect']), ...(scenario === 'refresh' ? ['refresh-deck'] : [])])
        if (scenario !== 'skip-onplay' && scenario !== 'refresh') {
          assert.match(JSON.stringify(await trace(page)), gained === 0 ? /未增加 HP/ : new RegExp(`Chocolate Bonbon Cookie.*增加 ${gained} 點 HP`))
          result.statusText = await page.locator('main > [role="status"]').first().innerText()
          assert.match(result.statusText, gained === 0 ? /未增加 HP/ : new RegExp(`Chocolate Bonbon Cookie 獲得 ${gained} HP`))
        }
      } else {
        const beforeAttack = await state(page)
        if (['wrong-energy', 'few-yellow', 'few-energy', 'rested-energy'].includes(scenario)) {
          assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
          assert.deepEqual(await state(page), beforeAttack)
          assert.deepEqual(await trace(page), result.beforeTrace)
        } else {
          await source.locator('.card-face.is-attackable').click()
          const support = index => page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="bs12-023-payment-${index}"] .card-face`)
          await support(2).click()
          if (scenario === 'payment-deselect') {
            await support(2).click()
            assert.deepEqual(await state(page), beforeAttack)
            await support(2).click()
          }
          if (scenario === 'cancel-payment') await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
          else {
            await support(0).click()
            await support(1).click()
            await shot('attack-payment')
            if (scenario === 'cancel-target') await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            else {
              await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-023-opponent"] .card-face[aria-label^="選擇攻擊目標："]').click()
              await page.waitForFunction(() => /HP 卡 3 張/.test(document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="bs12-023-opponent"] .hp-card-stack')?.getAttribute('aria-label') ?? ''), null, { timeout: 20000 })
              await settle(page)
              const after = await state(page)
              assert.deepEqual(after.top.battle.map(c => c.hp), [3, 4])
              assert.equal(after.top.trash, 3)
              assert.equal(after.bottom.battle.find(c => c.id === 'bs12-023-source').rested, true)
              assert.equal(after.bottom.battle.find(c => c.id === 'bs12-023-source').hp, 4)
              assert.deepEqual(after.bottom.support, beforeAttack.bottom.support.map(s => ({ ...s, rested: true })))
              assert.equal(after.bottom.deck, 16)
              assert.equal((await trace(page)).filter(e => e.commandKind === 'declare-attack').length, 1)
              assert.equal((await trace(page)).some(e => e.commandKind === 'resolve-attack-effect'), false)
            }
          }
          if (['cancel-payment', 'cancel-target'].includes(scenario)) {
            assert.deepEqual(await state(page), beforeAttack)
            assert.deepEqual(await trace(page), result.beforeTrace)
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
    console.log(`PASS BS12-023 ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-023 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
