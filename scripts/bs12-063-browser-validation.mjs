import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-063-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const references = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...references].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
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
const cases = ['positive', 'no-host', 'host-rested', 'host-support', 'host-hand', 'host-trash', 'host-break', 'host-equipped', 'opponent-host', 'source-rested', 'one-damage', 'two-damage', 'three-damage', 'other-target', 'attack', 'wrong-energy', 'few-energy', 'rested-energy', 'deploy', 'cancel-payment', 'cancel-target', 'effect-positive', 'effect-no-host', 'effect-other-target', 'effect-zero', 'effect-cancel-payment', 'effect-cancel-target']
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(c => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(c))) {
    const page = await browser.newPage({ viewport })
    const result = { number: 'BS12-063', scenario, viewport, printedSourceAttested: scenario !== 'host-equipped' && !scenario.startsWith('effect-'), isolated: scenario === 'host-equipped' || scenario.startsWith('effect-'), status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const outgoing = ['attack', 'wrong-energy', 'few-energy', 'rested-energy', 'deploy', 'cancel-payment', 'cancel-target'].includes(scenario)
      result.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && (scenario.startsWith('cancel-') ? 'attack' : scenario) === 'positive' ? 'card:BS12-063' : process.env.BS12_BROWSER_ROUTE === 'generic' && (scenario.startsWith('cancel-') ? 'attack' : scenario) === 'no-host' ? 'card-negative:BS12-063' : 'bs12-063:'+(scenario.startsWith('cancel-') ? 'attack' : scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+result.testState+'&contract-card=BS12-001,BS12-003,BS12-005,BS12-007,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-017,BS12-019,BS12-021,BS12-024,BS12-028,BS12-029,BS12-030,BS12-031,BS12-038,BS12-039,BS12-041,BS12-046,BS12-059,BS12-060,BS12-061,BS12-062,BS12-063,BS4-095,BS6-008,BS6-017,BS7-061,BS11-012,ST4-001,P-069')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      result.before = await state(page)
      result.beforeTrace = await trace(page)
      const sourceField = outgoing ? 'bottom' : 'top'
      const source = page.locator(`.${sourceField}-field .combat-card-wrap[data-card-instance-id="bs12-063-source"]`)
      if (scenario.startsWith('effect-')) {
        const hand = page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-063-damage-item"]')
        await hand.locator('.card-face').click()
        await page.getByRole('button', { name: '使用', exact: true }).click()
        const panel = page.locator('.effect-panel:not(.is-complete):visible')
        await panel.waitFor()
        const payment = panel.locator('.effect-candidates-payment .effect-candidate-entry > button')
        assert.equal(await payment.count(), 2)
        if (scenario === 'effect-cancel-payment') {
          await panel.getByRole('button', { name: '取消技能', exact: true }).click()
          assert.deepEqual(await state(page), result.before)
          assert.deepEqual(await trace(page), result.beforeTrace)
        } else {
          await payment.nth(0).click()
          await payment.nth(1).click()
          await shot('effect-payment')
          await panel.getByRole('button', { name: '下一步', exact: true }).click()
          const targets = panel.getByRole('button').filter({ hasText: 'AI 對手・戰鬥區第' })
          assert.equal(await targets.count(), scenario === 'effect-no-host' ? 1 : 2)
          if (scenario !== 'effect-zero') await targets.nth(scenario === 'effect-other-target' ? 1 : 0).click()
          await shot('effect-target')
          if (scenario === 'effect-cancel-target') {
            await panel.getByRole('button', { name: '取消技能', exact: true }).click()
            assert.deepEqual(await state(page), result.before)
            assert.deepEqual(await trace(page), result.beforeTrace)
          } else {
            await panel.getByRole('button', { name: '確認發動', exact: true }).click()
            await settle(page)
            await panel.waitFor({ state: 'hidden' })
            result.settled = await state(page)
            assert.deepEqual(result.settled.top.battle.map(c => c.hp), scenario === 'effect-zero' ? [2, 2]
              : scenario === 'effect-no-host' ? [] : scenario === 'effect-other-target' ? [2] : [1, 2])
            assert.equal(result.settled.top.trash, scenario === 'effect-zero' ? 0 : ['effect-no-host', 'effect-other-target'].includes(scenario) ? 2 : 1)
            assert.equal(result.settled.bottom.trash, 1)
            assert.equal(result.settled.bottom.hand, 0)
            assert.equal(result.settled.bottom.deck, result.before.bottom.deck)
            assert.equal(result.settled.top.deck, result.before.top.deck)
            assert.deepEqual(result.settled.bottom.battle, result.before.bottom.battle)
            assert.equal(result.settled.bottom.support.every(s => s.rested), true)
            assert.deepEqual((await trace(page)).slice(result.beforeTrace.length).map(e => e.commandKind), ['begin-play-item', 'resolve-ability-effect'])
            result.publicEffectText = await page.locator('body').innerText()
            if (scenario === 'effect-positive') assert.match(result.publicEffectText, /CAKE POPs 受到 1 傷害。/)
            if (scenario === 'effect-zero') assert.match(result.publicEffectText, /未選擇傷害目標，效果未造成傷害。/)
          }
        }
      } else if (scenario === 'deploy') {
        const hand = page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-063-source"]')
        await hand.locator('.card-face').click()
        const preview = page.getByRole('complementary', { name: 'CAKE POPs快速預覽', exact: true })
        assert.match(await preview.innerText(), /BS12-063/)
        assert.match(await preview.innerText(), /Popping Candy Cookie/)
        assert.equal(await preview.getByRole('img', { name: 'CAKE POPs', exact: true }).getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-063').imageUrl)
        await shot('preview')
        await hand.getByRole('button', { name: '登場', exact: true }).click()
        await source.waitFor()
        await settle(page)
        assert.equal((await state(page)).bottom.deck, 10)
        assert.equal((await state(page)).bottom.battle[0].hp, 2)
        assert.deepEqual((await trace(page)).map(e => e.commandKind), ['deploy-cookie'])
      } else {
        assert.equal(result.before[sourceField].battle[0].hp, 2)
        assert.equal(result.before[sourceField].deck, 10)
        const art = source.locator('img').first()
        assert.equal(await art.getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-063').imageUrl)
        await art.evaluate(img => img.decode())
        assert.equal(await source.locator('.skill-action').count(), 0)
        const attacker = page.locator(`.bottom-field .combat-card-wrap[data-card-instance-id="${outgoing ? 'bs12-063-source' : 'bs12-063-attacker'}"]`)
        if (['wrong-energy', 'few-energy', 'rested-energy'].includes(scenario)) {
          assert.equal(await attacker.locator('.card-face.is-attackable').count(), 0)
          assert.deepEqual(await state(page), result.before)
          assert.deepEqual(await trace(page), result.beforeTrace)
          await shot('blocked')
        } else {
          await attacker.locator('.card-face.is-attackable').click()
          if (scenario === 'cancel-payment') {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await state(page), result.before)
            assert.deepEqual(await trace(page), result.beforeTrace)
          } else {
            const payments = result.before.bottom.support
            for (const payment of payments) await page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="${payment.id}"] .card-face`).click({ position: { x: 10, y: 25 } })
            await shot('payment')
            if (scenario === 'cancel-target') {
              await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
              assert.deepEqual(await state(page), result.before)
              assert.deepEqual(await trace(page), result.beforeTrace)
            } else {
              const targetId = outgoing ? 'bs12-063-attacker' : scenario === 'other-target' ? 'bs12-063-host' : 'bs12-063-source'
              await page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${targetId}"] .card-face:not(.hp-card)`).click()
              const blockedHost = ['no-host', 'host-support', 'host-hand', 'host-trash', 'host-break', 'host-equipped', 'opponent-host'].includes(scenario)
              const faint = blockedHost || scenario === 'other-target'
              await page.waitForFunction(({ targetId, hp, faint }) => {
                const node = document.querySelector(`.top-field .combat-card-wrap[data-card-instance-id="${targetId}"]`)
                return faint ? !node : new RegExp(`HP 卡 ${hp} 張`).test(node?.querySelector('.hp-card-stack')?.getAttribute('aria-label') ?? '')
              }, { targetId, hp: outgoing ? 3 : 1, faint }, { timeout: 20000 })
              await settle(page)
              result.settled = await state(page)
              assert.deepEqual(result.settled.top.battle.map(c => c.hp), outgoing ? [3] : scenario === 'other-target' ? [2] : blockedHost ? [] : [1, 2])
              assert.equal(result.settled.top.trash, result.before.top.trash + (outgoing ? 3 : faint ? 2 : 1) + (scenario === 'host-equipped' ? 1 : 0))
              assert.equal(result.settled.top.deck, result.before.top.deck)
              assert.equal(result.settled.top.hand, result.before.top.hand)
              assert.deepEqual(result.settled.bottom, { ...result.before.bottom,
                battle: result.before.bottom.battle.map((c, i) => ({ ...c, rested: i === 0 ? true : c.rested })),
                support: result.before.bottom.support.map(s => ({ ...s, rested: true })) })
              assert.deepEqual((await trace(page)).slice(result.beforeTrace.length).map(e => e.commandKind), ['declare-attack', 'resolve-battle'])
              assert.equal(await page.locator('.effect-panel:not(.is-complete)').count(), 0)
              await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
              await page.getByRole('button', { name: /(?:CAKE POPs|Muscle Cookie|Sonic Water Cookie|Sorbet Shark Cookie) 攻擊 玩家/ }).click()
              result.publicLog = await page.locator('body').innerText()
              assert.match(result.publicLog, /CAKE POPs/)
              assert.match(result.publicLog, /自動結算了戰鬥/)
              await shot('public-trace')
              await page.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
            }
          }
        }
      }
      result.after = await state(page)
      result.trace = await trace(page)
      await shot('result')
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
      writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(results, null, 2))
      throw error
    } finally { await page.close() }
    results.push(result)
    writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(results, null, 2))
    console.log(`PASS BS12-063 ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-063 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
