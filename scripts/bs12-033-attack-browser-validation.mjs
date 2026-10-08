import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-033-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/candidates/official-festival-arena-bs12.en.json'), 'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,`test-results/bs12-official-art/${card.cardNumber}.webp`)))
// Independent ordinary attack/image evidence. Arena trigger matrices are separate.
const cases = ['attack', 'mixed-energy', 'wrong-energy', 'one-energy', 'rested-energy', 'cancel-payment', 'cancel-full-payment', 'deselect-payment', 'other-target']
const blocked = ['wrong-energy', 'one-energy', 'rested-energy']
const readState = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { hand: field?.querySelectorAll('.hand-card').length ?? 0, deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'),
      breakLevel: Number(field?.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1] ?? NaN),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(n => n.querySelector('.card-face')?.classList.contains('is-rested') ?? false),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(n => ({ id: n.getAttribute('data-card-instance-id'), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN), rested: n.querySelector('.card-face')?.classList.contains('is-rested') ?? false })) }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, steps: e.steps, summary: e.summary })))
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const number of ['BS12-033', 'BS12-033@1']) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const result = { number, scenario, viewport, status: 'RUNNING', errors: [], networkFailures: [] }
    page.on('pageerror', e => result.errors.push(String(e)))
    page.on('console', m => { if (m.type() === 'error') result.errors.push(m.text()) })
    page.on('requestfailed', r => result.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl,r=>r.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,`test-results/bs12-official-art/${card.cardNumber}.webp`))}))
      const fixture = cases.slice(0, 5).includes(scenario) ? scenario : 'attack'
      // Ordinary damage logs are associated with the public revealed HP card.
      // These IDs are known local fixture fillers, not private live deck data.
      result.testState = `${number.toLowerCase()}:${fixture}`
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${result.testState}&contract-card=BS12-033,BS12-004,BS12-033,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-028,BS12-029,BS12-030,BS12-031,BS12-046,bs12-032-opponent-hp-5,bs12-032-opponent-other-hp-2`)
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      result.before = await readState(page)
      const source = page.getByRole('button', { name: 'Espresso Cookie', exact: true })
      await source.locator('img').evaluate(img => img.decode())
      assert.equal(await source.locator('img').getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
      await source.click()
      const cancel = page.getByRole('button', { name: '取消攻擊', exact: true })
      if (blocked.includes(scenario)) {
        assert.equal(await cancel.count(), 0)
        assert.match(await page.locator('[data-card-instance-id="bs12-032-source"] .energy-shortfall-hint').innerText(), /符合能量需求的活躍支援卡/)
        assert.deepEqual(await readState(page), result.before)
        assert.deepEqual(await trace(page), [])
      } else {
        await cancel.waitFor()
        const supports = page.locator('.bottom-field .support-card-wrap button.card-face')
        // Support cards overlap; click the exposed left edge, as a player would.
        const selectSupport = index => supports.nth(index).click({ position: { x: 10, y: 25 } })
        await selectSupport(0)
        assert.equal(await page.getByRole('button', { name: '選擇攻擊目標：Langue de Chat Cookie', exact: true }).count(), 0)
        if (scenario === 'deselect-payment') { await selectSupport(0); assert.match(await page.locator('.attack-payment-panel').innerText(), /已選 0/); await selectSupport(0) }
        if (scenario !== 'cancel-payment') await selectSupport(1)
        await shot('payment')
        if (scenario.startsWith('cancel-')) {
          await cancel.click()
          assert.deepEqual(await readState(page), result.before)
          assert.deepEqual(await trace(page), [])
        } else {
          const targetName = scenario === 'other-target' ? 'Candy Diver Cookie' : 'Langue de Chat Cookie'
          await page.getByRole('button', { name: `選擇攻擊目標：${targetName}`, exact: true }).click()
          const targetId = scenario === 'other-target' ? 'bs12-032-opponent-other' : 'bs12-032-opponent'
          await page.waitForFunction(id => Number(document.querySelector(`.top-field [data-card-instance-id="${id}"] .hp-card-stack`)?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]) === (id.endsWith('other') ? 2 : 5), targetId)
          await page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]'))
          result.after = await readState(page)
          assert.equal(result.after.top.battle.find(c => c.id === targetId).hp, result.before.top.battle.find(c => c.id === targetId).hp - 1)
          assert.deepEqual(result.after.top.battle.filter(c => c.id !== targetId), result.before.top.battle.filter(c => c.id !== targetId))
          assert.deepEqual(result.after.bottom.support, [true, true])
          assert.equal(result.after.bottom.battle.find(c => c.id === 'bs12-032-source').rested, true)
          assert.equal(result.after.top.trash, 1)
          assert.equal(result.after.bottom.deck, 12)
          assert.equal(result.after.bottom.trash, 0)
          assert.equal(result.after.bottom.breakLevel, 0)
          result.trace = await trace(page)
          assert.equal(result.trace[0].commandKind, 'declare-attack')
          assert.equal(result.trace.filter(e => e.commandKind === 'resolve-next-damage').length, 1)
          assert.equal(result.trace.some(e => e.commandKind === 'resolve-battle'), false)
          assert.equal(result.trace.some(e => e.commandKind === 'resolve-after-damage-effect'), false)
        }
      }
      result.after ??= await readState(page)
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
      await shot('result')
      result.status = 'PASS'
    } catch (error) { result.error = String(error.stack ?? error); result.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { results.push(result); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'attack-results.json'), JSON.stringify(results, null, 2)); await page.close() }
    console.log(`PASS ${number} ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-033 attack Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
