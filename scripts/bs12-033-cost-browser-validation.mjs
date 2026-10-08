import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, 'test-results/bs12-033-cost-browser')
mkdirSync(out, { recursive: true })
const cards = JSON.parse(readFileSync(resolve(root, 'data/cards/official-festival-arena-bs12.en.json'), 'utf8')).cards
cards.push(...JSON.parse(readFileSync(resolve(root, 'data/cards/official-starter-deck-blue.en.json'), 'utf8')).cards)
const cases = ['draw-both', 'item-zero', 'item-three', 'source-zero', 'cancel-cost', 'deselect-cost']
const state = page => page.evaluate(() => {
  const f = document.querySelector('.bottom-field')
  return { hand: f.querySelectorAll('.hand-card').length, deck: Number(f.querySelector('.deck-zone .resource-summary > strong')?.textContent), trash: Number(f.querySelector('.discard-zone.resource-summary > strong')?.textContent),
    breakLevel: Number(f.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1]),
    support: [...f.querySelectorAll('.support-card-wrap')].map(n => n.querySelector('.card-face').classList.contains('is-rested')),
    battle: [...f.querySelectorAll('.combat-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]) })) }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, steps: e.steps })))
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const rows = []
try {
  for (const number of ['BS12-033', 'BS12-033@1']) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const row = { number, scenario, viewport, scope: 'candidate-real-028-hand-arena-cost-033-draw', status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), error: r.failure()?.errorText }))
    const shot = suffix => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${suffix}.png`) })
    try {
      for (const n of [number, 'BS12-028', 'BS12-024', 'BS12-001', 'BS12-019', 'ST4-001']) {
        const card = cards.find(c => c.cardNumber === n)
        await page.route(card.imageUrl, r => r.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${n}.webp`)) }))
      }
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${number.toLowerCase()}:cost-hand&contract-card=BS12-028,BS12-033`)
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      const sourceImage = page.locator('.bottom-field .hand-card img[alt="Espresso Cookie"]')
      await sourceImage.evaluate(img => img.decode())
      assert.equal(await sourceImage.getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
      row.before = await state(page)
      await page.getByRole('button', { name: 'Luxury Red Carpet', exact: true }).click()
      await page.getByRole('button', { name: '使用', exact: true }).click()
      const panel = page.locator('.effect-panel:not(.is-complete):visible')
      const next = panel.getByRole('button', { name: '下一步', exact: true })
      assert.equal(await next.isEnabled(), false)
      await panel.locator('.effect-candidates-payment .effect-candidate-entry > button').nth(0).click()
      await next.click()
      const cost = panel.locator('.effect-candidates-cost-hand-to-break .effect-candidate-entry > button').filter({ hasText: 'Espresso Cookie' })
      const confirm = panel.getByRole('button', { name: '確認發動', exact: true })
      assert.equal(await confirm.isEnabled(), false)
      await cost.click()
      if (scenario === 'deselect-cost') { await cost.click(); assert.equal(await confirm.isEnabled(), false); await cost.click() }
      // Selected payment is rendered REST in the draft; no command or zone move has committed.
      const draft = await state(page)
      assert.deepEqual({ ...draft, support: row.before.support }, row.before)
      assert.deepEqual(await trace(page), [])
      await shot('cost-selection')
      if (scenario === 'cancel-cost') {
        await panel.getByRole('button', { name: '取消技能', exact: true }).click()
        assert.deepEqual(await state(page), row.before)
        assert.deepEqual(await trace(page), [])
      } else {
        await confirm.click()
        await panel.getByRole('button', { name: '確認發動', exact: true }).click()
        const draw = page.locator('.draw-up-to-modal:visible')
        await draw.waitFor()
        assert.match(await draw.innerText(), /Luxury Red Carpet/)
        const itemCount = scenario === 'item-zero' ? 0 : scenario === 'item-three' ? 3 : 1
        if (itemCount) await draw.locator('.draw-up-to-option').filter({ hasText: `抽 ${itemCount} 張` }).click()
        await draw.getByRole('button', { name: itemCount ? `抽取 ${itemCount} 張牌` : '略過抽牌', exact: true }).click()
        await page.waitForFunction(() => document.querySelector('.draw-up-to-modal')?.textContent?.includes('Espresso Cookie'))
        const sourceCount = scenario === 'source-zero' ? 0 : 1
        await draw.locator('img[alt="Espresso Cookie"]').evaluate(img => img.decode())
        assert.equal(await draw.locator('img[alt="Espresso Cookie"]').getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
        assert.equal(await draw.locator('.draw-up-to-option').filter({ hasText: '抽 1 張' }).count(), 1)
        assert.equal(await draw.locator('.draw-up-to-option').filter({ hasText: '抽 2 張' }).count(), 0)
        row.beforeSourceDraw = await state(page)
        assert.equal(row.beforeSourceDraw.deck, row.before.deck - itemCount)
        assert.deepEqual(row.beforeSourceDraw.battle, row.before.battle)
        await shot('source-draw-selection')
        if (sourceCount) await draw.locator('.draw-up-to-option').filter({ hasText: '抽 1 張' }).click()
        await draw.getByRole('button', { name: sourceCount ? '抽取 1 張牌' : '略過抽牌', exact: true }).click()
        await page.waitForFunction(() => !document.querySelector('.draw-up-to-modal'))
        row.after = await state(page)
        assert.equal(row.after.deck, row.before.deck - itemCount - sourceCount)
        assert.equal(row.after.hand, row.before.hand - 2 + itemCount + sourceCount)
        assert.equal(row.after.trash, row.before.trash + 1)
        assert.equal(row.after.breakLevel, 1)
        assert.deepEqual(row.after.support, [true, false])
        assert.deepEqual(row.after.battle, row.before.battle)
        row.trace = await trace(page)
        assert.deepEqual(row.trace.map(e => e.commandKind), ['begin-play-item', 'resolve-ability-effect', 'resolve-draw-up-to', 'resolve-after-damage-effect', 'resolve-draw-up-to'])
        assert.match(row.trace[0].steps.join(' '), /代價.*休息區/)
        assert.match(row.trace[3].steps.join(' '), /Espresso Cookie.*抽牌選擇.*最多 1 張/)
      }
      assert.deepEqual(row.errors, [])
      assert.deepEqual(row.networkFailures, [])
      row.after ??= await state(page)
      row.trace ??= await trace(page)
      await shot('result')
      row.status = 'PASS'
      console.log(`PASS ${number} ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { row.error = String(error.stack ?? error); row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { rows.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)); await page.close() }
  }
  console.log(`BS12-033 real hand cost Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
