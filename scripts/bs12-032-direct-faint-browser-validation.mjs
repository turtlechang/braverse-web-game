import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-032-direct-faint-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/candidates/official-festival-arena-bs12.en.json'), 'utf8')).cards
const formal = readdirSync(resolve(root, 'data/cards')).filter(f => f.endsWith('.json')).flatMap(f => JSON.parse(readFileSync(resolve(root, 'data/cards', f), 'utf8')).cards ?? [])
const cards = [...candidate, ...formal].filter(card => existsSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)))
// BS8-010 is a printed non-Arena source. These are negative/reference controls,
// never evidence of an Arena direct-faint positive trigger.
const cases = ['non-arena', 'opponent-turn', 'zero']
const state = page => page.evaluate(() => {
  const f = document.querySelector('.bottom-field')
  return { deck: Number(f.querySelector('.deck-zone .resource-summary > strong')?.textContent), trash: Number(f.querySelector('.discard-zone.resource-summary > strong')?.textContent),
    breakLevel: Number(f.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1]),
    support: [...f.querySelectorAll('.support-card-wrap')].map(n => n.querySelector('.card-face').classList.contains('is-rested')),
    battle: [...f.querySelectorAll('.combat-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]) })) }
})
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const rows = []
try {
  for (const number of ['BS12-032', 'BS12-032@1']) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases) {
    const page = await browser.newPage({ viewport })
    const row = { number, scenario, viewport, scope: 'printed BS8-010 non-Arena direct-faint reference control', printedArenaSourceAttested: false, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    try {
      for (const card of cards) await page.route(card.imageUrl, r => r.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const fixture = scenario === 'opponent-turn' || scenario === 'non-arena' ? `mechanism-faint-${scenario}` : 'mechanism-faint'
      row.testState = `${number.toLowerCase()}:${fixture}`
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${row.testState}&contract-card=BS12-032,BS8-010`)
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      row.before = await state(page)
      const panel = page.locator('.effect-panel:not(.is-complete):visible')
      if (scenario === 'opponent-turn') {
        assert.equal(await panel.count(), 0)
      } else {
        await panel.waitFor()
        assert.match(await panel.innerText(), /BS8-010/)
        assert.match(await panel.innerText(), /Then, make up to 1 of your Cookies faint/)
        if (scenario !== 'zero') await panel.getByRole('button').filter({ hasText: 'Caramel Choux Cookie' }).click()
        await panel.getByRole('button', { name: '確認發動', exact: true }).click()
        await page.waitForFunction(() => (window.__braverseContractTrace ?? []).some(e => e.commandKind === 'resolve-attack-effect'))
      }
      assert.equal(await page.getByRole('heading', { name: 'Caramel Choux Cookie 發動休息區移入效果', exact: true }).count(), 0)
      const replacement = page.getByRole('button', { name: '不補餅乾', exact: true })
      if (await replacement.count()) await replacement.click()
      row.after = await state(page)
      if (scenario === 'zero' || scenario === 'opponent-turn') assert.deepEqual(row.after, row.before)
      else {
        assert.equal(row.after.breakLevel, 1)
        assert.equal(row.after.trash, 2)
        assert.equal(row.after.battle.length, 1)
        assert.equal(row.after.battle[0].hp, row.before.battle[1].hp)
        assert.equal(row.after.deck, 12)
        assert.deepEqual(row.after.support, [true, true, true])
      }
      row.trace = await page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, steps: e.steps })))
      assert.equal(row.trace.filter(e => e.commandKind === 'resolve-after-damage-effect').length, 0)
      assert.equal(row.trace.filter(e => e.commandKind === 'resolve-attack-effect').length, scenario === 'opponent-turn' ? 0 : 1)
      assert.deepEqual(row.errors, [])
      row.mountedOriginalArt = await page.evaluate(async urls => Promise.all([...document.images].filter(img => urls.includes(img.src)).map(async img => { await img.decode(); assertImage(img); return {url:img.src,alt:img.alt,naturalWidth:img.naturalWidth}; function assertImage(image) { if (!image.naturalWidth) throw new Error(`Original art failed: ${image.src}`) } })), cards.map(card => card.imageUrl))
      row.cancelledOriginalImageRequests = row.networkFailures.filter(e => e.resourceType === 'image' && e.error === 'net::ERR_ABORTED' && cards.some(card => card.imageUrl === e.url))
      row.networkFailures = row.networkFailures.filter(e => !row.cancelledOriginalImageRequests.includes(e))
      assert.deepEqual(row.networkFailures, [])
      await page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-result.png`) })
      row.status = 'PASS'
      console.log(`PASS printed non-Arena direct-faint ${number} ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { row.error = String(error.stack ?? error); row.dom = await page.locator('body').innerText().catch(() => ''); throw error }
    finally { rows.push(row); writeFileSync(resolve(out, 'results.json'), JSON.stringify(rows, null, 2)); await page.close() }
  }
  console.log(`BS12-032 printed non-Arena direct-faint control Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
