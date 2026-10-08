// BS12-008: independent printed threshold, self-trash cost and optional ready.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-008-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-festival-arena-bs12.en.json'), 'utf8')).cards
const references = readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json')).flatMap(file => JSON.parse(readFileSync(resolve(root, 'data/cards', file), 'utf8')).cards ?? [])
const cards = [...candidate.filter(card => existsSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`))), ...['BS7-061', 'ST1-001', 'ST2-007', 'ST4-001'].map(number => references.find(card => card.cardNumber === number))]
const cases = ['positive', 'five', 'rested-support', 'rested-source', 'active-target', 'cheerleader', 'zero', 'cancel-target', 'deselect', 'replacement', 'no-target', 'three', 'wrong-color', 'wrong-keyword', 'opponent-turn']
const blockedCases = ['three', 'wrong-color', 'wrong-keyword', 'opponent-turn']
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
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const cardNumber of ['BS12-008', 'BS12-008@1']) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({ viewport })
    const result = { cardNumber, scenario, viewport, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), error: request.failure()?.errorText }))
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const route = ['zero', 'cancel-target', 'deselect', 'replacement'].includes(scenario) ? 'positive' : scenario
      const testState = process.env.BS12_BROWSER_ROUTE === 'generic' && route === 'positive' ? `card:${cardNumber}`
        : process.env.BS12_BROWSER_ROUTE === 'generic' && route === 'wrong-keyword' ? `card-negative:${cardNumber}` : `bs12-008:${cardNumber}:${route}`
      result.testState = testState
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${testState}&contract-card=BS12-008,ST2-007,ST4-001,BS12-005`)
      const source = page.locator('.bottom-field [data-card-instance-id="bs12-008-source"]')
      await source.waitFor()
      const img = source.locator('img').first()
      await img.evaluate(image => image.decode())
      assert.equal(await img.getAttribute('src'), cards.find(card => card.cardNumber === cardNumber).imageUrl)
      result.before = await state(page)
      assert.ok(result.before.bottom.battle.length <= 2)
      const skill = source.getByRole('button', { name: '啟動技能', exact: true })
      if (blockedCases.includes(scenario)) {
        assert.ok(await skill.count() === 0 || !await skill.isEnabled())
        assert.deepEqual(await state(page), result.before)
        assert.deepEqual(await trace(page), [])
      } else {
        await skill.click()
        const panel = page.locator('.effect-panel:visible')
        await panel.waitFor()
        assert.match(await panel.innerText(), /技能代價.*來源餅乾.*棄牌區/s)
        assert.equal(await panel.locator('.effect-candidates-payment').count(), 0, 'No energy payment is printed')
        const targets = panel.locator('.effect-candidate-entry > button')
        assert.equal(await targets.count(), scenario === 'no-target' ? 0 : 1, 'Self and opponent are excluded after self-trash cost')
        const confirm = panel.getByRole('button', { name: '確認發動', exact: true })
        assert.equal(await confirm.isEnabled(), true, 'Up to one allows zero')
        if (!['zero', 'no-target'].includes(scenario)) await targets.click()
        if (scenario === 'deselect') {
          await targets.click()
          assert.equal(await targets.getAttribute('aria-pressed'), 'false')
          assert.equal(await confirm.isEnabled(), true)
          await targets.click()
        }
        assert.deepEqual(await state(page), result.before)
        assert.deepEqual(await trace(page), [])
        await page.screenshot({ path: resolve(out, `${cardNumber}-${scenario}-${viewport.width}-target.png`) })
        if (scenario === 'cancel-target') {
          await panel.getByRole('button', { name: '取消技能', exact: true }).click()
          await panel.waitFor({ state: 'hidden' })
          assert.deepEqual(await state(page), result.before)
          assert.deepEqual(await trace(page), [])
        } else {
          await confirm.click()
          await panel.waitFor({ state: 'hidden' })
          await settle(page)
          const modal = page.locator('.decision-modal:visible')
          await modal.waitFor()
          result.afterEffect = await state(page)
          assert.equal(result.afterEffect.bottom.trash, 4)
          assert.equal(result.afterEffect.bottom.hand, 1)
          assert.equal(result.afterEffect.bottom.deck, 12)
          assert.deepEqual(result.afterEffect.bottom.support, result.before.bottom.support)
          assert.deepEqual(result.afterEffect.top, result.before.top)
          assert.deepEqual(result.afterEffect.bottom.battle.map(c => c.id), scenario === 'no-target' ? [] : ['bs12-008-target'])
          if (scenario !== 'no-target') assert.equal(result.afterEffect.bottom.battle[0].rested, scenario === 'zero')
          result.trace = await trace(page)
          assert.deepEqual(result.trace.map(e => e.commandKind), ['begin-activate-skill', 'resolve-ability-effect'])
          assert.match(JSON.stringify(result.trace[0].steps), /技能代價.*Shiningberry Cookie.*3.*HP/s)
          if (scenario === 'no-target' || scenario === 'replacement') {
            await modal.locator('.modal-card-options button').filter({ hasText: 'Chestnut Cookie' }).click()
            await settle(page)
            assert.equal((await state(page)).bottom.hand, 0)
            assert.equal((await state(page)).bottom.deck, 11)
          } else {
            await modal.getByRole('button', { name: '不補餅乾', exact: true }).click()
          }
          await modal.waitFor({ state: 'hidden' })
          if (scenario === 'cheerleader') assert.equal(await page.locator('.bottom-field [data-card-instance-id="bs12-008-target"]').getByRole('button', { name: '啟動技能', exact: true }).isEnabled(), true)
          assert.ok(!JSON.stringify(await trace(page)).includes('activate-flip'), 'Trashed HP does not trigger FLIP')
        }
      }
      result.after = await state(page)
      result.trace = await trace(page)
      assert.deepEqual(result.errors, [])
      assert.deepEqual(result.networkFailures, [])
      await page.mouse.move(viewport.width - 5, viewport.height - 5)
      await settle(page)
      await page.screenshot({ path: resolve(out, `${cardNumber}-${scenario}-${viewport.width}-result.png`) })
      result.status = 'PASS'
    } catch (error) {
      result.error = String(error.stack ?? error)
      result.debug = await page.locator('body').innerText().catch(() => '')
    } finally {
      results.push(result)
      await page.close()
    }
    console.log(`${result.status} ${cardNumber} ${scenario} ${viewport.width}${result.error ? ': ' + result.error.split('\n')[0] : ''}`)
    if (result.status !== 'PASS') throw new Error(result.error)
  }
} finally {
  await browser.close()
  writeFileSync(resolve(out, 'results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2) + '\n')
}
