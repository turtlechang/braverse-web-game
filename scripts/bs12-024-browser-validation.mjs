import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-024-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/candidates/official-festival-arena-bs12.en.json'), 'utf8')).cards
const references = readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json')).flatMap(file => JSON.parse(readFileSync(resolve(root, 'data/cards', file), 'utf8')).cards ?? [])
const cards = [...candidate.filter(card => existsSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`))), ...references.filter(card => ["ST4-001","BS7-061","BS6-008","BS6-017"].includes(card.cardNumber))]
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
const cases = ['positive', 'blue-energy', 'green-energy', 'yellow-energy', 'deploy', 'hand-preview', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'cancel-payment', 'cancel-target', 'payment-deselect', 'other-target', 'target-faints']
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({ viewport })
    const result = { number: 'BS12-024', scenario, viewport, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const routeCase = scenario === 'hand-preview' ? 'deploy' : ['cancel-payment', 'cancel-target', 'payment-deselect', 'other-target'].includes(scenario) ? 'positive' : scenario
      const fixtureScenario = routeCase
      result.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixtureScenario === 'positive' ? 'card:BS12-024' : process.env.BS12_BROWSER_ROUTE === 'generic' && fixtureScenario === 'few-energy' ? 'card-negative:BS12-024' : `bs12-024:${fixtureScenario}`
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${result.testState}&contract-card=BS12-024`)
      await page.locator('.game-shell').waitFor()
      await settle(page)
      result.before = await state(page)
      result.beforeTrace = await trace(page)
      assert.equal(result.before.bottom.deck, ['deploy', 'hand-preview'].includes(scenario) ? 12 : 10)
      assert.equal(result.before.bottom.hand, ['deploy', 'hand-preview'].includes(scenario) ? 1 : 0)
      assert.equal(result.before.top.battle.length, 2)
      const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-024-source"]')
      if (['deploy', 'hand-preview'].includes(scenario)) {
        const hand = page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-024-source"]')
        await hand.locator('.card-face').click()
        assert.equal(await hand.getByRole('button', { name: '登場', exact: true }).isEnabled(), true)
        const preview = page.getByRole('complementary', { name: 'GingerBrave快速預覽', exact: true })
        assert.match(await preview.innerText(), /BS12-024/)
        assert.equal(await preview.getByRole('img', { name: 'GingerBrave', exact: true }).getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-024').imageUrl)
        await preview.getByRole('img', { name: 'GingerBrave', exact: true }).evaluate(image => image.decode())
        assert.deepEqual(await state(page), result.before)
        assert.deepEqual(await trace(page), result.beforeTrace)
        await shot('hand-preview')
        if (scenario === 'deploy') {
          await hand.getByRole('button', { name: '登場', exact: true }).click()
          await settle(page)
          await source.waitFor()
          assert.equal((await state(page)).bottom.battle[0].hp, 2)
          assert.equal((await state(page)).bottom.deck, 10)
          assert.equal((await state(page)).bottom.hand, 0)
          assert.equal(await page.locator('.effect-panel:not(.is-complete)').count(), 0)
          assert.deepEqual((await trace(page)).map(e => e.commandKind), ['deploy-cookie'])
        }
      }
      if (scenario !== 'hand-preview') {
        result.entered = await state(page)
        result.enteredTrace = await trace(page)
        assert.equal(result.entered.bottom.battle.length, 1)
        assert.equal(result.entered.bottom.battle[0].hp, 2)
        await source.locator('img').first().evaluate(image => image.decode())
        assert.equal(await source.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-024').imageUrl)
        assert.equal(await source.locator('.skill-action').count(), 0)
        const blocked = ['few-energy', 'rested-energy', 'source-rested', 'opponent-turn'].includes(scenario)
        if (blocked) {
          assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
          assert.deepEqual(await state(page), result.entered)
          assert.deepEqual(await trace(page), result.enteredTrace)
          await shot('blocked')
        } else {
          await source.locator('.card-face.is-attackable').click()
          const support = page.locator('.bottom-field .support-card-wrap[data-card-instance-id="bs12-024-payment-0"] .card-face')
          const target = page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${scenario === 'other-target' ? 'bs12-024-opponent-other' : 'bs12-024-opponent'}"] .card-face:not(.hp-card)`)
          if (scenario === 'cancel-payment') {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await state(page), result.entered)
            assert.deepEqual(await trace(page), result.enteredTrace)
          } else {
            await support.click()
            assert.deepEqual(await state(page), { ...result.entered, bottom: { ...result.entered.bottom, support: result.entered.bottom.support.map(s => ({ ...s, rested: true })) } })
            assert.match(await target.getAttribute('aria-label'), /^選擇攻擊目標：/)
            assert.deepEqual(await trace(page), result.enteredTrace)
            if (scenario === 'payment-deselect') {
              await support.click()
              assert.deepEqual(await state(page), result.entered)
              assert.equal(await target.getAttribute('aria-label') === '選擇攻擊目標：Langue de Chat Cookie', false)
              await support.click()
            }
            await shot('payment')
            if (scenario === 'cancel-target') {
              await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
              assert.deepEqual(await state(page), result.entered)
              assert.deepEqual(await trace(page), result.enteredTrace)
            } else {
              await target.click()
              await page.waitForFunction(({ faint, other }) => {
                const node = document.querySelector(`.top-field .combat-card-wrap[data-card-instance-id="${other ? 'bs12-024-opponent-other' : 'bs12-024-opponent'}"]`)
                return faint ? !node : new RegExp(`HP 卡 ${other ? 3 : 5} 張`).test(node?.querySelector('.hp-card-stack')?.getAttribute('aria-label') ?? '')
              }, { faint: scenario === 'target-faints', other: scenario === 'other-target' }, { timeout: 20000 })
              await settle(page)
              result.attackAfter = await state(page)
              assert.deepEqual(result.attackAfter.top.battle.map(c => c.hp), scenario === 'target-faints' ? [4] : scenario === 'other-target' ? [6, 3] : [5, 4])
              assert.equal(result.attackAfter.top.trash, 1)
              assert.deepEqual(result.attackAfter.bottom, { ...result.entered.bottom, battle: result.entered.bottom.battle.map(c => ({ ...c, rested: true })), support: result.entered.bottom.support.map(s => ({ ...s, rested: true })) })
              assert.equal(result.attackAfter.top.deck, result.entered.top.deck)
              const commands = (await trace(page)).slice(result.enteredTrace.length).map(e => e.commandKind)
              assert.deepEqual(commands, ['declare-attack', 'resolve-battle'])
              assert.equal(await page.locator('.effect-panel:not(.is-complete)').count(), 0)
              await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
              await page.getByRole('button', { name: /GingerBrave 攻擊 玩家/ }).click()
              result.publicAttackText = await page.locator('body').innerText()
              assert.match(result.publicAttackText, new RegExp(`GingerBrave.*${scenario === 'other-target' ? 'Langue de Chat Cookie' : scenario === 'target-faints' ? 'Pink Choco Cookie' : 'Sugar Swan Cookie'}`))
              assert.match(result.publicAttackText, /自動結算了戰鬥/)
              await shot('public-trace')
              await page.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
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
    console.log(`PASS BS12-024 ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-024 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
