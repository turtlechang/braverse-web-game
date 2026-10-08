// Cookie Equip uses the user-supplied ruling: HP to trash, no replacement.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-007-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/candidates/official-festival-arena-bs12.en.json'), 'utf8')).cards
const references = readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json')).flatMap(file => JSON.parse(readFileSync(resolve(root, 'data/cards', file), 'utf8')).cards ?? [])
const cards = [...candidate.filter(card => existsSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`))), ...['BS6-008', 'ST2-007', 'ST4-001'].map(number => references.find(card => card.cardNumber === number))]
const cases = ['positive', 'rested-source', 'rested-host', 'cancel-payment', 'cancel-target', 'deselect', 'zero', 'attack', 'no-energy', 'wrong-energy', 'rested-energy', 'used', 'opponent-turn', 'no-host', 'wrong-host', 'opponent-host']
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
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), error: request.failure()?.errorText }))
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const route = blockedCases.includes(scenario) || ['rested-source', 'rested-host'].includes(scenario) ? scenario : 'positive'
      const testState = process.env.BS12_BROWSER_ROUTE === 'generic' && route === 'positive' ? 'card:BS12-007'
        : process.env.BS12_BROWSER_ROUTE === 'generic' && route === 'wrong-host' ? 'card-negative:BS12-007' : `bs12-007:${route}`
      result.testState = testState
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${testState}&contract-card=BS12-007,BS12-018,BS6-008,ST2-007`)
      const mic = page.locator('[data-card-instance-id="bs12-007-source"]')
      await mic.waitFor()
      await mic.locator('img').first().evaluate(image => image.decode())
      assert.equal(await mic.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-007').imageUrl)
      result.before = await state(page)
      assert.ok(result.before.bottom.battle.length <= 2 && result.before.top.battle.length <= 2)
      const printedHost = page.locator('[data-card-instance-id="bs12-007-host"]')
      if (await printedHost.count()) {
        await printedHost.locator('img').first().evaluate(image => image.decode())
        assert.equal(await printedHost.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === (scenario === 'wrong-host' ? 'ST4-001' : 'BS12-018')).imageUrl)
      }
      const skill = mic.getByRole('button', { name: '啟動技能', exact: true })
      if (blockedCases.includes(scenario)) {
        assert.ok(await skill.count() === 0 || !await skill.isEnabled())
        assert.deepEqual(await state(page), result.before)
        assert.deepEqual(await trace(page), [])
      } else {
        await skill.click()
        const panel = page.locator('.effect-panel:visible')
        await panel.waitFor()
        assert.match(await panel.innerText(), /BS12-007/)
        const next = panel.getByRole('button', { name: '下一步', exact: true })
        assert.equal(await next.isEnabled(), false)
        const payments = panel.locator('.effect-candidate-entry > button')
        assert.equal(await payments.count(), 5, 'The equip payment and four later attack supports are all legal 1R candidates')
        if (scenario !== 'cancel-payment') {
          await payments.first().click()
          await next.click()
          const targets = panel.locator('.effect-candidates-target .effect-candidate-entry > button')
          assert.equal(await targets.count(), 1)
          assert.match(await targets.innerText(), /Shining Glitter Cookie/)
          const confirm = panel.getByRole('button', { name: '確認發動', exact: true })
          assert.equal(await confirm.isEnabled(), false, 'The named host is mandatory')
          if (scenario !== 'zero') {
            await targets.click()
            if (scenario === 'deselect') {
              await targets.click()
              assert.equal(await confirm.isEnabled(), false)
              await targets.click()
            }
            assert.equal(await confirm.isEnabled(), true)
          }
          assert.deepEqual(await trace(page), [])
          const preview = await state(page)
          assert.deepEqual({ ...preview, bottom: { ...preview.bottom, support: result.before.bottom.support } }, result.before)
          await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-target.png`), fullPage: true })
          if (!['cancel-target', 'zero'].includes(scenario)) {
            await confirm.click()
            await panel.waitFor({ state: 'hidden' })
            await page.waitForFunction(() => document.querySelectorAll('.bottom-field .combat-card-wrap').length === 1 &&
              !document.querySelector('.animation-overlay, .presentation-overlay'))
            await settle(page)
            result.after = await state(page)
            assert.deepEqual(result.after.bottom.battle, [{ id: 'bs12-007-host', hp: 5, rested: scenario === 'rested-host', equipped: '查看裝備：Producer Mic' }])
            assert.equal(result.after.bottom.trash, 3)
            assert.equal(result.after.bottom.deck, 12)
            assert.equal(result.after.bottom.hand, 1, 'The eligible replacement Cookie stays in hand')
            assert.deepEqual(result.after.top, result.before.top)
            assert.equal(result.after.bottom.support.find(entry => entry.id === 'bs12-007-payment').rested, true)
            assert.equal(result.after.bottom.support.filter(entry => entry.id !== 'bs12-007-payment' && entry.rested).length, 0)
            result.trace = await trace(page)
            assert.deepEqual(result.trace.map(entry => entry.commandKind), ['begin-activate-skill', 'resolve-ability-effect'])
            assert.match(JSON.stringify(result.trace), /原 HP 3 張移入棄牌區.*不觸發補位登場/)
            assert.equal(await page.getByText('補位登場', { exact: true }).count(), 0)
            const host = page.locator('[data-card-instance-id="bs12-007-host"]')
            assert.equal(await host.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-018').imageUrl)
            await host.getByRole('button', { name: '查看裝備：Producer Mic', exact: true }).click()
            const detail = page.getByRole('dialog', { name: 'Producer Mic 卡牌詳情' })
            await detail.waitFor()
            await detail.locator('img').first().evaluate(image => image.decode())
            assert.equal(await detail.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-007').imageUrl)
            await detail.getByRole('button', { name: '關閉', exact: true }).click()
            await page.locator('.bottom-field .discard-zone').click()
            const trash = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: '玩家棄牌區', exact: true }) })
            await trash.waitFor()
            const hpImages = trash.getByRole('img', { name: 'Chestnut Cookie', exact: true })
            assert.equal(await hpImages.count(), 3, 'Original HP are in trash; Mic itself is attached')
            for (const image of await hpImages.all()) await image.evaluate(image => image.decode())
            await trash.getByRole('button', { name: '關閉', exact: true }).click()
            if (scenario === 'attack') {
              await host.locator('.card-face.is-attackable').click()
              for (let i = 0; i < 4; i++) await page.locator(`.bottom-field [data-card-instance-id="bs12-007-attack-pay-${i}"] .card-face.is-targetable`).click()
              await page.locator('.top-field [data-card-instance-id="bs12-007-defender"] .card-face[aria-label^="選擇攻擊目標："]').click()
              await page.waitForFunction(() => document.querySelector('.top-field .hp-card-stack')?.getAttribute('aria-label') === 'Sugar Swan Cookie HP 卡 2 張' && !document.querySelector('.animation-overlay, .presentation-overlay'))
              await settle(page)
              result.after = await state(page)
              assert.equal(result.after.top.battle[0].hp, 2)
              assert.equal(result.after.top.trash, 4)
              assert.equal(result.after.top.deck, 10)
              assert.equal(result.after.top.hand, 0)
              assert.equal(result.after.bottom.hand, 1)
              assert.equal(result.after.bottom.trash, 3)
              assert.equal(result.after.bottom.battle[0].rested, true)
              assert.equal(result.after.bottom.support.filter(entry => entry.rested).length, 5)
              result.trace = await trace(page)
              assert.equal(result.trace.filter(entry => entry.commandKind === 'resolve-flip').length, 0)
              assert.match(JSON.stringify(result.trace.find(entry => entry.commandKind === 'declare-attack')), /FLIP 封鎖.*Producer Mic/)
            }
          }
        }
        if (scenario.startsWith('cancel') || scenario === 'zero') {
          await panel.getByRole('button', { name: '取消技能', exact: true }).click()
          await panel.waitFor({ state: 'hidden' })
          assert.deepEqual(await state(page), result.before)
          assert.deepEqual(await trace(page), [])
          assert.equal(await skill.isEnabled(), true)
        }
      }
      result.after ??= await state(page)
      result.trace ??= await trace(page)
      await settle(page)
      await page.mouse.move(viewport.width - 5, viewport.height - 5)
      await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-result.png`), fullPage: true })
      assert.equal(result.errors.length, 0)
      assert.equal(result.networkFailures.length, 0)
      result.status = 'PASS'
      console.log('PASS ' + scenario + ' ' + viewport.width)
    } catch (error) { result.error = error.stack; console.error(error.stack); result.after = await state(page).catch(() => null); result.trace = await trace(page).catch(() => null); await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-failure.png`), fullPage: true }).catch(() => {}) }
    results.push(result)
    await page.close()
  }
} finally { await browser.close(); writeFileSync(resolve(out, 'results.json'), JSON.stringify({ scope: 'candidate skill Equip, supplied HP/no-replacement ruling, and subsequent host attack', generatedAt: new Date().toISOString(), results }, null, 2)) }
if (results.some(result => result.status !== 'PASS')) process.exitCode = 1
