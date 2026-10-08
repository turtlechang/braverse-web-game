import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-032-faint-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/candidates/official-festival-arena-bs12.en.json'), 'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,`test-results/bs12-official-art/${card.cardNumber}.webp`)))
const cases = ['positive', 'nested-flip', 'no-condition', 'hp-zero', 'hp-deselect', 'cancel-payment']
const state = page => page.evaluate(() => {
  const side = name => {
    const f = document.querySelector(`.${name}-field`)
    return { deck: Number(f.querySelector('.deck-zone .resource-summary > strong')?.textContent), trash: Number(f.querySelector('.discard-zone.resource-summary > strong')?.textContent),
      breakLevel: Number(f.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1]),
      support: [...f.querySelectorAll('.support-card-wrap')].map(n => n.querySelector('.card-face').classList.contains('is-rested')),
      battle: [...f.querySelectorAll('.combat-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]), rested: n.querySelector('.card-face').classList.contains('is-rested') })) }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, steps: e.steps })))
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const rows = []
try {
  for (const number of ['BS12-032', 'BS12-032@1']) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const row = { number, scenario, viewport, scope: 'candidate-real-attack-arena-004-flip', status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = suffix => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${suffix}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl,r=>r.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,`test-results/bs12-official-art/${card.cardNumber}.webp`))}))
      const fixture = scenario === 'nested-flip' ? 'arena-faint-nested' : scenario === 'no-condition' ? 'arena-faint-no-condition' : 'arena-faint'
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'arena-faint' ? `card:${number}` : process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'arena-faint-no-condition' ? `card-negative:${number}` : `${number.toLowerCase()}:${fixture}`
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${row.testState}&contract-card=BS12-032,BS12-001,BS12-004,BS12-033,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-028,BS12-029,BS12-030,BS12-031,BS12-046,bs12-032-opponent-hp-5,bs12-032-opponent-other-hp-2`)
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      row.before = await state(page)
      const source = page.getByRole('button', { name: 'Caramel Choux Cookie', exact: true })
      await source.locator('img').evaluate(img => img.decode())
      assert.equal(await source.locator('img').getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
      await source.click()
      const supports = page.locator('.bottom-field .support-card-wrap button.card-face')
      await supports.nth(0).click({ position: { x: 10, y: 25 } })
      assert.equal(await page.getByRole('button', { name: '選擇攻擊目標：Langue de Chat Cookie', exact: true }).count(), 0)
      if (scenario === 'cancel-payment') {
        await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
        assert.deepEqual(await state(page), row.before)
        assert.deepEqual(await trace(page), [])
      } else {
        await supports.nth(1).click({ position: { x: 10, y: 25 } })
        await page.getByRole('button', { name: '選擇攻擊目標：Langue de Chat Cookie', exact: true }).click()
        const heading = page.getByRole('heading', { name: 'Caramel Choux Cookie 發動休息區移入效果', exact: true })
        if (scenario === 'no-condition') {
          await page.waitForFunction(() => !document.querySelector('.top-field [data-card-instance-id="bs12-032-opponent"]'))
          assert.equal(await heading.count(), 0)
        } else {
          // Own HP FLIP has no hand card to pay. Decline through the normal UI.
          if (scenario === 'nested-flip') {
            const skipFlip = page.getByRole('button', { name: '不發動', exact: true })
            await skipFlip.waitFor()
            await skipFlip.click()
          }
          await heading.waitFor()
          const candidate = page.locator('.bottom-field .combat-card-wrap').getByRole('button', { name: 'GingerBrave', exact: true })
          assert.equal(await candidate.count(), 1)
          if (scenario !== 'hp-zero') await candidate.click()
          if (scenario === 'hp-deselect') { await candidate.click(); assert.equal(await page.getByRole('button', { name: '確認略過', exact: true }).count(), 1); await candidate.click() }
          await shot('hp-selection')
          await page.getByRole('button', { name: scenario === 'hp-zero' ? '確認略過' : '確認 (1)', exact: true }).click()
        }
        for (let i = 0; i < 2; i++) {
          const replacement = page.getByRole('button', { name: '不補餅乾', exact: true })
          if (await replacement.count()) await replacement.click()
        }
        await page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]'))
        row.after = await state(page)
        assert.deepEqual(row.after.bottom.support, [true, true])
        assert.equal(row.after.top.breakLevel, 3)
        assert.equal(row.after.top.trash, 1)
        assert.equal(row.after.top.battle.length, 1)
        if (scenario === 'no-condition') {
          assert.equal(row.after.bottom.breakLevel, 0)
          assert.equal(row.after.bottom.trash, 0)
          assert.equal(row.after.bottom.battle[0].hp, 1)
          assert.equal(row.after.bottom.deck, 12)
        } else {
          assert.equal(row.after.bottom.breakLevel, 1)
          assert.equal(row.after.bottom.trash, 1)
          assert.equal(row.after.bottom.battle.length, 1)
          assert.equal(row.after.bottom.battle[0].hp, row.before.bottom.battle[1].hp + (scenario === 'hp-zero' ? 0 : 1))
          assert.equal(row.after.bottom.deck, scenario === 'hp-zero' ? 12 : 11)
        }
        row.trace = await trace(page)
        assert.equal(row.trace[0].commandKind, 'declare-attack')
        assert.equal(row.trace.filter(e => e.commandKind === 'resolve-after-damage-effect').length, scenario === 'no-condition' ? 0 : 1)
      }
      assert.deepEqual(row.errors, [])
      // Transient HP faces can be removed before their original-art request
      // finishes. Keep every cancellation, and require all mounted original
      // images (including payment/target/log faces) to decode successfully.
      row.mountedOriginalArt = await page.evaluate(async urls => {
        const mounted = [...document.images].filter(img => urls.includes(img.src))
        return Promise.all(mounted.map(async img => {
          await img.decode()
          if (!img.naturalWidth) throw new Error(`Original card art failed: ${img.src}`)
          return { url: img.src, alt: img.alt, naturalWidth: img.naturalWidth }
        }))
      }, cards.map(card => card.imageUrl))
      row.cancelledOriginalImageRequests = row.networkFailures.filter(entry =>
        entry.resourceType === 'image' && entry.error === 'net::ERR_ABORTED' && cards.some(card => card.imageUrl === entry.url))
      row.networkFailures = row.networkFailures.filter(entry => !row.cancelledOriginalImageRequests.includes(entry))
      assert.deepEqual(row.networkFailures, [])
      row.after ??= await state(page)
      row.trace ??= await trace(page)
      await shot('result')
      row.status = 'PASS'
      console.log(`PASS ${number} ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { row.error = String(error.stack ?? error); row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { rows.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)); await page.close() }
  }
  console.log(`BS12-032 actual Arena FLIP faint Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
