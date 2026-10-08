import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url))), require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-cake-hound-details-browser')
mkdirSync(out, { recursive: true })
const cards = JSON.parse(readFileSync(resolve(root, 'data/cards/official-festival-arena-bs12.en.json'), 'utf8')).cards
const art = cards.filter(card => ['BS12-095', 'BS12-096', 'BS12-003', 'BS12-011', 'BS12-061', 'BS12-062'].includes(card.cardNumber))
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const rows = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const number of ['BS12-095', 'BS12-096']) {
    const page = await browser.newPage({ viewport }), name = number === 'BS12-095' ? 'Blueberry Cake Hound' : 'Crimson Danger Cake Hound'
    const row = { number, viewport, status: 'FAIL', scope: 'Shared candidate details regression; not added to the general card operation matrix', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) }); page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), error: r.failure()?.errorText }))
    try {
      for (const card of art) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${number.toLowerCase()}:special-wrong-color&contract-card=${number}`)
      await page.locator('.game-shell').waitFor(); await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      const hand = page.locator('.battle-row[data-animation-player="player-one"] .hand-card-wrap').filter({ has: page.locator(`img[alt="${name}"]`) })
      await hand.locator('button.card-face').click(); assert.equal(await hand.getByRole('button', { name: '特殊登場', exact: true }).count(), 0)
      await hand.getByRole('button', { name: '詳情', exact: true }).click(); const detail = page.locator('.card-detail-modal'); await detail.waitFor()
      const img = detail.locator(`img[alt="${name}"]`); await img.evaluate(i => i.decode()); assert.equal(await img.getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
      assert.ok(await img.evaluate(i => i.naturalWidth === 746 && i.naturalHeight === 1038)); row.originalArtVisible = true
      const sections = detail.locator('.card-detail-rules > .card-rule-section'); assert.deepEqual(await sections.locator('strong').allTextContents(), ['技能', '攻擊', 'FLIP'])
      assert.match(await sections.nth(0).innerText(), /Special Play.*LV\.1 Cookie.*battle area into your trash/)
      assert.match(await sections.nth(2).innerText(), number === 'BS12-095' ? /Discard 1 card.*gains \+1 HP/ : /5 cards or less.*draw up to 2 cards/)
      assert.equal(await sections.nth(1).locator('.attack-power-value').innerText(), '2')
      const box = await detail.boundingBox(); assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1)
      row.details = await detail.innerText(); await page.screenshot({ path: resolve(out, `${number}-${viewport.width}-details.png`) }); await detail.locator('.close-modal').click()
      row.trace = await page.evaluate(() => window.__braverseContractTrace ?? []); assert.deepEqual(row.trace, []); assert.deepEqual(row.errors, []); assert.deepEqual(row.networkFailures, []); row.status = 'PASS'
    } catch (error) { row.error = String(error.stack ?? error); await page.screenshot({ path: resolve(out, `${number}-${viewport.width}-failed.png`) }).catch(() => {}); rows.push(row); writeFileSync(resolve(out, 'results.json'), JSON.stringify(rows, null, 2)); throw error }
    finally { await page.close() }
    rows.push(row); writeFileSync(resolve(out, 'results.json'), JSON.stringify(rows, null, 2)); console.log(`PASS details ${number} ${viewport.width}x${viewport.height}`)
  }
  console.log(`Cake Hound shared details Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
