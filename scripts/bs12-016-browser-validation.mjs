import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-016-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-festival-arena-bs12.en.json'), 'utf8')).cards
const references = readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json')).flatMap(file => JSON.parse(readFileSync(resolve(root, 'data/cards', file), 'utf8')).cards ?? [])
const cards = [...candidate.filter(card => existsSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`))), ...["BS4-095","BS7-061","ST1-001","ST4-001","BS6-008"].map(number => references.find(card => card.cardNumber === number))]
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
const cases = ['select-rest', 'select-skip', 'zero-rest', 'zero-skip', 'deselect', 'cancel-skill', 'green-arena', 'active-target', 'source-rested', 'source-rested-skip', 'solo-rest', 'solo-skip', 'non-arena', 'equipment', 'support-only', 'opponent-only', 'no-energy', 'opponent-turn', 'effect-ready', 'already-active-ready', 'attack-normal', 'attack-other', 'skill-attack', 'target-faints', 'wrong-energy', 'few-red', 'rested-energy', 'cancel-attack', 'item-cancel-payment', 'item-cancel-target']
const routeCase = scenario => ['select-rest', 'select-skip', 'zero-rest', 'zero-skip', 'deselect', 'cancel-skill', 'skill-attack', 'cancel-attack'].includes(scenario) ? 'positive'
  : scenario.startsWith('solo-') ? 'solo' : scenario === 'source-rested-skip' ? 'source-rested'
    : scenario.startsWith('item-cancel-') ? 'effect-ready' : scenario
const panelFor = page => page.locator('.effect-panel:not(.is-complete):visible')
const candidatesFor = panel => panel.locator('.effect-candidates-target .effect-candidate-entry > button')
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const number of ['BS12-016', 'BS12-016@1']) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({ viewport })
    const result = { number, scenario, viewport, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), error: request.failure()?.errorText, resourceType: request.resourceType() }))
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const fixture = routeCase(scenario)
      const testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'positive' ? `card:${number}`
        : process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'opponent-turn' ? `card-negative:${number}` : `bs12-016:${number}:${fixture}`
      result.testState = testState
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${testState}&contract-card=BS12-016`)
      await page.locator('.game-shell').waitFor()
      const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-016-source"]')
      await source.locator('img').first().evaluate(image => image.decode())
      assert.equal(await source.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === number).imageUrl)
      if (scenario === 'attack-normal') {
        await page.getByRole('button', { name: '略過支援階段', exact: true }).waitFor({ timeout: 20000 })
        await settle(page)
        await page.getByRole('button', { name: '略過支援階段', exact: true }).click()
      }
      await settle(page)
      result.before = await state(page)
      result.scope = ['equipment', 'opponent-turn'].includes(fixture) ? 'Prepared equipment/timing control; parent lifecycle not accepted' : 'Printed local effect operation'
      result.combatArt = await page.locator('.combat-card-wrap').evaluateAll(async (nodes, urls) => Promise.all(nodes.map(async node => {
        const image = node.querySelector('img')
        if (!image || !urls.includes(image.src)) throw new Error('Missing original combat art')
        await image.decode()
        if (!image.naturalWidth) throw new Error('Original combat art did not load')
        return { id: node.getAttribute('data-card-instance-id'), url: image.src }
      })), cards.map(card => card.imageUrl))
      assert.equal(result.combatArt.length, result.before.bottom.battle.length + result.before.top.battle.length)
      assert.equal(result.before.bottom.battle[0].hp, 4)
      assert.equal(result.before.bottom.battle[0].attack, 3)
      assert.equal(result.before.top.battle[0].hp, scenario === 'target-faints' ? 3 : 6)
      assert.equal(result.before.top.battle[1].hp, 4)
      assert.equal(result.before.bottom.deck, scenario === 'attack-normal' ? 10 : 12)
      const skillCases = !['opponent-turn', 'effect-ready', 'already-active-ready', 'attack-normal', 'attack-other', 'target-faints', 'cancel-attack', 'item-cancel-payment', 'item-cancel-target'].includes(scenario)
      if (scenario === 'opponent-turn') {
        assert.equal(await source.locator('.skill-action').count(), 0)
        assert.deepEqual(await trace(page), [])
      } else if (skillCases) {
        await source.getByRole('button', { name: '啟動技能', exact: true }).click()
        const panel = panelFor(page)
        await panel.waitFor()
        assert.match(await panel.innerText(), /另一張【Arena】餅乾.*可選 0 張/s)
        assert.equal(await panel.locator('.effect-candidates-payment').count(), 0)
        const noTargets = ['zero-rest', 'zero-skip', 'solo-rest', 'solo-skip', 'non-arena', 'equipment', 'support-only', 'opponent-only'].includes(scenario)
        const hasCandidates = !['solo-rest', 'solo-skip', 'non-arena', 'equipment', 'support-only', 'opponent-only'].includes(scenario)
        assert.equal(await candidatesFor(panel).count(), hasCandidates ? 1 : 0)
        if (hasCandidates) assert.doesNotMatch(await candidatesFor(panel).innerText(), /Strawberry Mochi Cookie/)
        if (!noTargets) await candidatesFor(panel).click()
        if (scenario === 'deselect') await candidatesFor(panel).click()
        if (scenario === 'cancel-skill') {
          await panel.getByRole('button', { name: '取消技能', exact: true }).click()
          assert.deepEqual(await state(page), result.before)
          assert.deepEqual(await trace(page), [])
          assert.equal(await source.getByRole('button', { name: '啟動技能', exact: true }).isEnabled(), true)
        } else {
          await page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-ready.png`) })
          await panel.getByRole('button', { name: '確認發動', exact: true }).click()
          await settle(page)
          await panel.waitFor()
          assert.match(await panel.innerText(), /第 2 \/ 2 段/)
          assert.match(await panel.innerText(), /技能來源餅乾橫置.*可選 0 張/s)
          assert.equal(await panel.getByRole('button', { name: '取消技能', exact: true }).count(), 0)
          assert.equal(await candidatesFor(panel).count(), 1)
          assert.match(await candidatesFor(panel).innerText(), /Strawberry Mochi Cookie/)
          result.firstAfter = await state(page)
          const selectedAlly = !noTargets && scenario !== 'deselect'
          assert.equal(result.firstAfter.bottom.battle[0].rested, result.before.bottom.battle[0].rested)
          if (selectedAlly) assert.equal(result.firstAfter.bottom.battle[1].rested, false)
          else assert.deepEqual(result.firstAfter, result.before)
          assert.deepEqual(result.firstAfter.bottom.support, result.before.bottom.support)
          const restSource = !['select-skip', 'zero-skip', 'deselect', 'solo-skip', 'no-energy', 'source-rested-skip', 'skill-attack', 'wrong-energy', 'few-red', 'rested-energy'].includes(scenario)
          if (restSource) await candidatesFor(panel).click()
          await page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-rest.png`) })
          await panel.getByRole('button', { name: '確認發動', exact: true }).click()
          await settle(page)
          result.skillAfter = await state(page)
          assert.equal(result.skillAfter.bottom.battle[0].rested, restSource || result.before.bottom.battle[0].rested)
          assert.deepEqual(result.skillAfter.bottom.battle.map(c => c.hp), result.before.bottom.battle.map(c => c.hp))
          assert.deepEqual(result.skillAfter.bottom.support, result.before.bottom.support)
          assert.deepEqual(result.skillAfter.top, result.before.top)
          assert.equal(result.skillAfter.bottom.deck, result.before.bottom.deck)
          assert.equal(result.skillAfter.bottom.trash, 0)
          assert.equal(await source.getByRole('button', { name: '啟動技能', exact: true }).isEnabled(), false)
          result.skillTrace = await trace(page)
          assert.deepEqual(result.skillTrace.map(entry => entry.commandKind), ['begin-activate-skill', 'resolve-ability-effect', 'resolve-ability-effect'])
          assert.match(result.skillTrace[1].steps.join(' '), selectedAlly ? /已設為活躍/ : /未將任何餅乾設為活躍/)
          assert.match(result.skillTrace[2].steps.join(' '), restSource ? /Strawberry Mochi Cookie 已橫置/ : /未將任何餅乾橫置/)
          await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
          await page.getByRole('button', { name: /玩家 發動了「Strawberry Mochi Cookie」的技能/ }).click()
          result.publicSkillText = await page.locator('body').innerText()
          await page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-skill-trace.png`) })
          await page.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
        }
      }
      const itemCases = ['effect-ready', 'already-active-ready', 'attack-other', 'target-faints', 'item-cancel-payment', 'item-cancel-target']
      if (itemCases.includes(scenario)) {
        await page.getByRole('button', { name: 'Sweet Jams Guitar', exact: true }).click()
        await page.getByRole('button', { name: '使用', exact: true }).click()
        const panel = panelFor(page)
        await panel.locator('.effect-candidates-payment .effect-candidate-entry > button').nth(0).click()
        if (scenario === 'item-cancel-payment') await panel.getByRole('button', { name: '取消技能', exact: true }).click()
        else {
          await panel.getByRole('button', { name: '下一步', exact: true }).click()
          assert.equal(await candidatesFor(panel).count(), 2)
          await candidatesFor(panel).nth(scenario === 'attack-other' ? 1 : 0).click()
          if (scenario === 'item-cancel-target') await panel.getByRole('button', { name: '取消技能', exact: true }).click()
          else await panel.getByRole('button', { name: '確認發動', exact: true }).click()
        }
        await settle(page)
        result.itemAfter = await state(page)
        if (scenario.startsWith('item-cancel-')) {
          assert.deepEqual(result.itemAfter, result.before)
          assert.deepEqual(await trace(page), [])
        } else {
          assert.equal(result.itemAfter.bottom.battle[scenario === 'attack-other' ? 1 : 0].rested, false)
          assert.deepEqual(result.itemAfter.bottom.support.map(s => s.rested), [true, false, false, false])
          assert.equal(result.itemAfter.bottom.trash, 1)
          assert.equal(result.itemAfter.bottom.hand, 0)
        }
      }
      if (scenario === 'cancel-attack') {
        await source.locator('.card-face.is-attackable').click()
        await page.locator('.bottom-field .support-card-wrap[data-card-instance-id="bs12-016-payment-0"] .card-face').click()
        await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
        assert.deepEqual(await state(page), result.before)
        assert.deepEqual(await trace(page), [])
      }
      if (['effect-ready', 'already-active-ready', 'attack-normal', 'attack-other', 'skill-attack', 'target-faints'].includes(scenario)) {
        const payments = itemCases.includes(scenario) ? [1, 2, 3] : [0, 1, 2]
        await source.locator('.card-face.is-attackable').click()
        for (const index of payments) await page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="bs12-016-payment-${index}"] .card-face`).click()
        await page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-payment.png`) })
        await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-016-opponent"] .card-face[aria-label^="選擇攻擊目標："]').click()
        await page.waitForFunction(isFaint => {
          const target = document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="bs12-016-opponent"]')
          return !target || (!isFaint && /HP 卡 3 張/.test(target.querySelector('.hp-card-stack')?.getAttribute('aria-label') ?? ''))
        }, scenario === 'target-faints', { timeout: 20000 })
        await settle(page)
        const panel = panelFor(page)
        if (await panel.count()) {
          assert.match(await panel.innerText(), /對原受攻擊的同一張餅乾造成 2 傷害（不能改選）/)
          if (await candidatesFor(panel).count()) {
            assert.equal(await candidatesFor(panel).count(), 1)
            await candidatesFor(panel).click()
          }
          await panel.getByRole('button', { name: '確認發動', exact: true }).click()
        }
        await settle(page)
        result.attackAfter = await state(page)
        const qualified = ['effect-ready', 'already-active-ready'].includes(scenario)
        const faint = scenario === 'target-faints'
        assert.equal(result.attackAfter.top.battle.find(c => c.id === 'bs12-016-opponent')?.hp, faint ? undefined : qualified ? 1 : 3)
        assert.equal(result.attackAfter.top.battle.find(c => c.id === 'bs12-016-opponent-other').hp, 4)
        assert.equal(result.attackAfter.top.trash, qualified ? 5 : 3)
        assert.equal(result.attackAfter.bottom.battle[0].hp, 4)
        assert.equal(result.attackAfter.bottom.battle[0].rested, true)
        assert.equal(result.attackAfter.bottom.support.every(s => s.rested), true)
        result.attackTrace = (await trace(page)).filter(entry => ['declare-attack', 'resolve-attack-effect'].includes(entry.commandKind))
        assert.deepEqual(result.attackTrace.map(entry => entry.commandKind), ['declare-attack', 'resolve-attack-effect'])
        assert.match(result.attackTrace[1].steps.join(' '), qualified ? /Sugar Swan Cookie.*受到 2 點傷害/ : faint ? /原受攻擊餅乾已離場，無追加傷害目標/ : /條件不成立，效果未執行/)
        await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
        await page.getByRole('button', { name: /攻擊 玩家 · 主要階段 玩家 使用「Strawberry Mochi Cookie」攻擊/ }).click()
        result.publicAttackText = await page.locator('body').innerText()
        await page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-attack-trace.png`) })
        await page.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
      }
      if (['wrong-energy', 'few-red', 'rested-energy', 'no-energy'].includes(scenario)) assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
      result.after = await state(page)
      await page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-result.png`) })
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
    console.log(`PASS ${number} ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-016 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
