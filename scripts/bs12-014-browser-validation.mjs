import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-014-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-festival-arena-bs12.en.json'), 'utf8')).cards
const references = readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json')).flatMap(file => JSON.parse(readFileSync(resolve(root, 'data/cards', file), 'utf8')).cards ?? [])
const cards = [...candidate.filter(card => existsSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`))), ...["BS4-095","BS7-061","ST1-001","ST4-001"].map(number => references.find(card => card.cardNumber === number))]
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
const cases = ['positive', 'solo', 'non-arena', 'green-arena', 'other-rested', 'already-active', 'equipment', 'support-only', 'opponent-only', 'two-copies', 'effect-ready', 'no-energy', 'wrong-energy', 'rested-energy', 'opponent-turn', 'cancel-attack']
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const number of ['BS12-014', 'BS12-014@1']) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({ viewport })
    const result = { number, scenario, viewport, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), error: request.failure()?.errorText, resourceType: request.resourceType() }))
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const fixture = scenario === 'cancel-attack' ? 'positive' : scenario
      const testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'positive' ? `card:${number}`
        : process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'solo' ? `card-negative:${number}` : `bs12-014:${number}:${fixture}`
      result.testState = testState
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${testState}&contract-card=BS12-014`)
      await page.locator('.game-shell').waitFor()
      const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-014-source"]')
      await source.locator('img').first().evaluate(image => image.decode())
      assert.equal(await source.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === number).imageUrl)
      if (scenario === 'opponent-turn') {
        await settle(page)
        result.after = await state(page)
        assert.equal(result.after.bottom.battle[0].rested, true)
        assert.equal(result.after.bottom.support.every(card => card.rested), true)
        assert.equal(result.after.bottom.hand, 0)
        assert.equal(result.after.bottom.deck, 12)
        assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
      } else {
        if (scenario !== 'rested-energy') await page.getByRole('button', { name: '略過支援階段', exact: true }).waitFor({ timeout: 20000 })
        await settle(page)
        result.phaseAfter = await state(page)
        const blocked = ['solo', 'non-arena', 'equipment', 'support-only', 'opponent-only', 'effect-ready'].includes(scenario)
        assert.equal(result.phaseAfter.bottom.battle[0].rested, blocked)
        assert.equal(result.phaseAfter.bottom.battle[0].attack, 3)
        assert.equal(result.phaseAfter.bottom.battle[0].hp, 1)
        assert.equal(result.phaseAfter.bottom.battle.slice(1).every(card => card.rested === (scenario === 'rested-energy')), true)
        assert.equal(result.phaseAfter.bottom.support.every(card => card.rested === (scenario === 'rested-energy')), true)
        assert.equal(result.phaseAfter.bottom.trash, 0)
        assert.equal(result.phaseAfter.top.trash, 0)
        assert.equal(result.phaseAfter.top.battle[0].rested, true)
        assert.equal(result.phaseAfter.top.battle[0].hp, 4)
        assert.equal(result.phaseAfter.top.deck, 12)
        if (scenario !== 'rested-energy') {
          assert.equal(result.phaseAfter.bottom.deck, 10)
          assert.equal(result.phaseAfter.bottom.hand, scenario === 'effect-ready' ? 3 : 2)
          result.trace = await trace(page)
          // Passive phase evidence is visible in the ordinary public log even if card-filter trace omits phase commands.
          await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
          await page.getByRole('button', { name: /抽牌 玩家 · 活躍階段 玩家 抽了 2 張牌/ }).click()
          const publicText = await page.locator('body').innerText()
          result.publicPhaseSteps = publicText.split('\n').filter(line => line.startsWith('活躍階段：'))
          assert.equal(result.publicPhaseSteps.length, scenario === 'two-copies' ? 2 : 1)
          assert.match(result.publicPhaseSteps.join(' '), blocked || scenario === 'already-active' ? /沒有另一張【Arena】餅乾.*未將來源設為活躍/ : /有另一張【Arena】餅乾.*已設為活躍/)
          await page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-phase.png`) })
          await page.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
          await page.getByRole('button', { name: '略過支援階段', exact: true }).click()
        }
        await settle(page)
        assert.equal(await page.getByRole('button', { name: '啟動技能', exact: true }).count(), 0)
        if (scenario === 'effect-ready') {
          await page.getByRole('button', { name: 'Sweet Jams Guitar', exact: true }).click()
          await page.getByRole('button', { name: '使用', exact: true }).click()
          const panel = page.locator('.effect-panel:not(.is-complete):visible')
          await panel.locator('.effect-candidates-payment .effect-candidate-entry > button').nth(0).click()
          await panel.getByRole('button', { name: '下一步', exact: true }).click()
          assert.equal(await panel.locator('.effect-candidates-target .effect-candidate-entry > button').count(), 1)
          await panel.locator('.effect-candidates-target .effect-candidate-entry > button').click()
          await panel.getByRole('button', { name: '確認發動', exact: true }).click()
          await settle(page)
          result.itemAfter = await state(page)
          assert.equal(result.itemAfter.bottom.battle[0].rested, false)
          assert.equal(result.itemAfter.bottom.battle[0].hp, 1)
          assert.equal(result.itemAfter.bottom.battle[1].hp, 2)
          assert.equal(result.itemAfter.bottom.trash, 1)
          assert.equal(result.itemAfter.bottom.support[0].rested, true)
        }
        if (scenario === 'cancel-attack') {
          const beforeCancel = await state(page)
          await source.locator('.card-face.is-attackable').click()
          await page.locator('.bottom-field .support-card-wrap[data-card-instance-id="bs12-014-payment-0"] .card-face').click()
          await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
          assert.deepEqual(await state(page), beforeCancel)
        } else if (scenario === 'positive' || scenario === 'effect-ready') {
          const payments = scenario === 'effect-ready' ? [1, 2] : [0, 1]
          await source.locator('.card-face.is-attackable').click()
          for (const index of payments) await page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="bs12-014-payment-${index}"] .card-face`).click()
          await page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-payment.png`) })
          await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-014-opponent"] .card-face[aria-label^="選擇攻擊目標："]').click()
          await page.waitForFunction(() => document.querySelector('.top-field .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 1 張'), null, { timeout: 20000 })
          await settle(page)
          result.attackAfter = await state(page)
          assert.equal(result.attackAfter.top.battle[0].hp, 1)
          assert.equal(result.attackAfter.top.trash, 3)
          assert.equal(result.attackAfter.bottom.battle[0].rested, true)
          assert.equal(result.attackAfter.bottom.battle[0].hp, 1)
          assert.deepEqual(result.attackAfter.bottom.support.map(card => card.rested), scenario === 'effect-ready' ? [true, true, true] : [true, true, false])
        } else if (blocked || ['no-energy', 'wrong-energy', 'rested-energy'].includes(scenario)) assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
        result.after = await state(page)
      }
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
      await page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-failure.png`) }).catch(() => {})
      results.push(result)
      writeFileSync(resolve(out, 'results.json'), JSON.stringify(results, null, 2))
      throw error
    } finally { await page.close() }
    results.push(result)
    writeFileSync(resolve(out, 'results.json'), JSON.stringify(results, null, 2))
    console.log(`PASS ${number} ${scenario} ${viewport.width}x${viewport.height}`)
  }
} finally { await browser.close() }
console.log(`BS12-014 Browser ${results.filter(result => result.status === 'PASS').length}/${results.length}`)
