// This starts with equipment already attached. It cannot attest Cookie Equip HP/replacement.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-007-equipped-browser')
mkdirSync(out, { recursive: true })
const candidates = JSON.parse(readFileSync(resolve(root, 'data/candidates/official-festival-arena-bs12.en.json'), 'utf8')).cards
const references = readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json')).flatMap(file => JSON.parse(readFileSync(resolve(root, 'data/cards', file), 'utf8')).cards ?? [])
const cards = ['BS12-004', 'BS12-007', 'BS12-018', 'BS6-008', 'ST2-007'].map(number => [...candidates, ...references].find(card => card.cardNumber === number))
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'),
      hand: field?.querySelectorAll('.hand-card').length ?? 0,
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
        rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'),
        rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({ commandKind: entry.commandKind, steps: entry.steps })))
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }].filter(viewport => !process.env.BS12_BROWSER_WIDTHS || process.env.BS12_BROWSER_WIDTHS.split(',').includes(String(viewport.width)))) for (const scenario of ['equipped', 'unequipped'].filter(scenario => !process.env.BS12_BROWSER_SCENARIOS || process.env.BS12_BROWSER_SCENARIOS.split(',').includes(scenario))) {
    const page = await browser.newPage({ viewport })
    const result = { scenario, viewport, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), error: request.failure()?.errorText }))
    try {
      for (const card of cards) {
        await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      }
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=bs12-007:${scenario}&contract-card=BS12-007,BS12-018,BS6-008,ST2-007`)
      const host = page.locator('[data-card-instance-id="bs12-007-host"]')
      await host.waitFor()
      await host.locator('img').first().evaluate(image => image.decode())
      assert.equal(await host.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-018').imageUrl)
      assert.equal(await page.locator('.bottom-field .combat-card-wrap').count(), 1)
      const gear = host.getByRole('button', { name: '查看裝備：Producer Mic', exact: true })
      if (scenario === 'equipped') {
        await gear.click()
        const detail = page.getByRole('dialog', { name: 'Producer Mic 卡牌詳情' })
        await detail.waitFor()
        assert.match(await detail.innerText(), /BS12-007/)
        await detail.locator('img').first().evaluate(image => image.decode())
        assert.equal(await detail.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-007').imageUrl)
        await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-equipment-inspect.png`), fullPage: true })
        await detail.getByRole('button', { name: '關閉', exact: true }).click()
      } else assert.equal(await gear.count(), 0)
      result.before = await state(page)
      await host.locator('.card-face.is-attackable').click()
      await page.getByTestId('attack-payment-panel').waitFor()
      await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
      assert.deepEqual(await state(page), result.before)
      assert.deepEqual(await trace(page), [])
      await host.locator('.card-face.is-attackable').click()
      for (let i = 0; i < 4; i++) await page.locator(`.bottom-field [data-card-instance-id="bs12-007-attack-pay-${i}"] .card-face.is-targetable`).click()
      await page.locator('.top-field [data-card-instance-id="bs12-007-defender"] .card-face[aria-label^="選擇攻擊目標："]').click()
      await page.waitForFunction(expectedDeck => {
        const field = document.querySelector('.top-field')
        return field?.querySelector('.hp-card-stack')?.getAttribute('aria-label') === 'Sugar Swan Cookie HP 卡 2 張' &&
          Number(field?.querySelector('.deck-zone .resource-summary > strong')?.textContent) === expectedDeck &&
          !document.querySelector('.animation-overlay, .presentation-overlay')
      }, scenario === 'equipped' ? 10 : 6, { timeout: 20000 })
      await page.waitForFunction(() => window.__braverseContractTrace?.some(entry => entry.commandKind === 'resolve-attack-effect'))
      result.after = await state(page)
      result.trace = await trace(page)
      assert.equal(result.after.top.battle[0].hp, 2)
      assert.equal(result.after.top.trash, 4)
      assert.equal(result.after.top.hand, scenario === 'equipped' ? 0 : 4)
      assert.equal(result.after.top.deck, scenario === 'equipped' ? 10 : 6)
      assert.equal(result.after.bottom.battle[0].hp, 5)
      assert.equal(result.after.bottom.battle[0].rested, true)
      assert.equal(result.after.bottom.deck, 12)
      assert.equal(result.after.bottom.support.filter(entry => entry.rested).length, 4)
      const declared = result.trace.find(entry => entry.commandKind === 'declare-attack')
      assert.ok(declared)
      assert.equal(/FLIP 封鎖.*Producer Mic/.test(JSON.stringify(declared.steps)), scenario === 'equipped')
      assert.equal(result.trace.filter(entry => entry.commandKind === 'resolve-flip').length, scenario === 'equipped' ? 0 : 4)
      assert.equal(result.trace.filter(entry => entry.commandKind === 'resolve-draw-up-to').length, scenario === 'equipped' ? 0 : 4)
      assert.match(JSON.stringify(result.trace.find(entry => entry.commandKind === 'resolve-attack-effect')), /條件不成立，效果未執行/)
      assert.ok(!result.trace.some(entry => entry.commandKind === 'activate-skill' || entry.commandKind === 'begin-activate-skill'))
      await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-result.png`), fullPage: true })
      await page.locator('.top-field .discard-zone').click()
      const trash = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'AI 對手棄牌區', exact: true }) })
      await trash.waitFor()
      const revealedImages = trash.getByRole('img', { name: 'Chestnut Cookie', exact: true })
      assert.equal(await revealedImages.count(), 4)
      for (const image of await revealedImages.all()) await image.evaluate(image => image.decode())
      await trash.getByRole('button', { name: '關閉', exact: true }).click()
      if (scenario === 'equipped') {
        await gear.click()
        const detail = page.getByRole('dialog', { name: 'Producer Mic 卡牌詳情' })
        await detail.waitFor()
        assert.match(await detail.innerText(), /BS12-007/)
        await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-rested-inspect.png`), fullPage: true })
        await detail.getByRole('button', { name: '關閉', exact: true }).click()
        assert.deepEqual(await state(page), result.after)
        assert.deepEqual(await trace(page), result.trace)
      }
      assert.equal(result.errors.length, 0)
      assert.equal(result.networkFailures.length, 0)
      result.status = 'PASS'
      console.log('PASS ' + scenario + ' ' + viewport.width)
    } catch (error) { result.error = error.stack; result.after = await state(page); result.trace = await trace(page); console.error(error.stack); console.error(JSON.stringify({ state: result.after, commands: result.trace.map(entry => entry.commandKind) })); await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-failure.png`), fullPage: true }).catch(() => {}) }
    results.push(result)
    await page.close()
  }
} finally { await browser.close(); writeFileSync(resolve(out, 'results.json'), JSON.stringify({ scope: 'prepared equipment attack only; Cookie Equip HP/replacement remains unconfirmed', generatedAt: new Date().toISOString(), results }, null, 2)) }
if (results.some(result => result.status !== 'PASS')) process.exitCode = 1
