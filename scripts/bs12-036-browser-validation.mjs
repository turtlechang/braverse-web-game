import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-036-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/cards/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,`test-results/bs12-official-art/${card.cardNumber}.webp`)))
const cases = ['positive', 'first-player', 'skip-on-play', 'close-extra', 'three-arena', 'wrong-color', 'non-arena', 'high-level', 'opponent-break', 'full-battle', 'opponent-turn', 'outside-main', 'attack', 'wrong-energy', 'few-energy', 'rested-energy', 'rested-source', 'cancel-attack']
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return { hand: field.querySelectorAll('.hand-card').length, deck: Number(field.querySelector('.deck-zone .resource-summary > strong')?.textContent), trash: Number(field.querySelector('.discard-zone.resource-summary > strong')?.textContent),
      extra: Number.parseInt(field.querySelector('[aria-label*="EXTRA Deck"][data-extra-deck-ready] > strong')?.textContent, 10), breakLevel: Number(field.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1]),
      support: [...field.querySelectorAll('.support-card-wrap')].map(node => node.querySelector('.card-face').classList.contains('is-rested')),
      battle: [...field.querySelectorAll('.combat-card-wrap')].map(node => ({ id: node.getAttribute('data-card-instance-id'), rested: node.querySelector('.card-face').classList.contains('is-rested'), hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]) })) }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, summary: e.summary, steps: e.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]'), null, { timeout: 20000 })
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const rows = []
try {
  for (const number of ['BS12-036', 'BS12-036@1']) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const row = { number, scenario, viewport, scope: 'printed-036-EXTRA-OnPlay-ordinary-and-decline-R003-with-Sugar-Swan-6HP', status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = suffix => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${suffix}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl,route=>route.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,`test-results/bs12-official-art/${card.cardNumber}.webp`))}))
      const attack = ['attack', 'wrong-energy', 'few-energy', 'rested-energy', 'rested-source', 'cancel-attack'].includes(scenario)
      const fixture = ['skip-on-play', 'close-extra'].includes(scenario) ? 'positive' : scenario === 'cancel-attack' ? 'attack' : scenario
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'positive' ? `card:${number}` : process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'three-arena' ? `card-negative:${number}` : `${number.toLowerCase()}:${fixture}`
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${row.testState}&contract-card=BS12-036,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-028,BS12-029,BS12-030,BS12-031,BS12-046`)
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      row.before = await state(page)
      row.beforeTrace = await trace(page)
      assert.equal(row.before.bottom.extra, attack ? 0 : 1)
      if (attack) {
        const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-036-source"] button.card-face:not(.hp-card)')
        await source.locator('img').evaluate(img => img.decode())
        assert.equal(await source.locator('img').getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
        assert.deepEqual(row.before.bottom.battle.map(c => c.hp), [2, 6])
        await source.click()
        if (!['attack', 'cancel-attack'].includes(scenario)) {
          assert.equal(await page.getByRole('button', { name: '取消攻擊', exact: true }).count(), 0)
          assert.deepEqual(await state(page), row.before)
          assert.deepEqual(await trace(page), row.beforeTrace)
        } else {
          const supports = page.locator('.bottom-field .support-card-wrap button.card-face')
          for (let i = 0; i < 3; i++) await supports.nth(i).click({ position: { x: 10, y: 25 } })
          if (scenario === 'cancel-attack') {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await state(page), row.before)
            assert.deepEqual(await trace(page), row.beforeTrace)
          } else {
            await page.getByRole('button', { name: '選擇攻擊目標：Sugar Swan Cookie', exact: true }).click()
            await page.waitForFunction(() => document.querySelector('.top-field .combat-card-wrap .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 3 張'))
            await settle(page)
            const after = await state(page)
            assert.deepEqual(after.top.battle.map(c => c.hp), [3, 3])
            assert.equal(after.top.trash, 3)
            assert.deepEqual(after.bottom, { ...row.before.bottom, support: [true, true, true], battle: row.before.bottom.battle.map(cookie => ({ ...cookie, rested: cookie.id === 'bs12-036-source' ? true : cookie.rested })) })
            await page.locator('.optional-cost-attack-inline:visible,.optional-cost-attack-modal:visible').getByRole('button', { name: '略過', exact: true }).click()
            assert.equal(await page.locator('.optional-cost-attack-inline').count(), 0)
          }
        }
      } else {
        await page.getByRole('button', { name: '玩家 EXTRA Deck 1 張', exact: true }).click()
        const extra = page.getByRole('dialog', { name: '玩家 EXTRA Deck', exact: true })
        await extra.locator('img').evaluate(img => img.decode())
        assert.equal(await extra.locator('img').getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
        const legal = ['positive', 'first-player', 'skip-on-play', 'close-extra'].includes(scenario)
        const play = extra.getByRole('button', { name: '從 EXTRA 登場', exact: true })
        assert.equal(await play.count(), legal ? 1 : 0)
        if (!legal || scenario === 'close-extra') {
          await page.getByRole('button', { name: '玩家 EXTRA Deck 1 張', exact: true }).click()
          assert.deepEqual(await state(page), row.before)
          assert.deepEqual(await trace(page), row.beforeTrace)
        } else {
          await play.click()
          await settle(page)
          row.entered = await state(page)
          assert.equal(row.entered.bottom.extra, 0)
          assert.equal(row.entered.bottom.deck, 10)
          assert.deepEqual(row.entered.bottom.battle.map(c => c.hp), [2, 4])
          assert.equal(row.entered.bottom.hand, 0)
          assert.equal(row.entered.bottom.trash, 0)
          assert.deepEqual(row.entered.bottom.support, [false, false, false])
          assert.equal(row.entered.bottom.breakLevel, row.before.bottom.breakLevel)
          assert.equal(await page.locator('.optional-cost-attack-inline, .optional-cost-attack-modal').count(), 0)
          const panel = page.locator('.effect-panel:not(.is-complete)')
          if (scenario === 'first-player') {
            await page.waitForFunction(() => !document.querySelector('.effect-panel:not(.is-complete)'))
            assert.deepEqual(await state(page), row.entered)
            const skipped = (await trace(page)).slice(row.beforeTrace.length).find(entry => entry.commandKind === 'skip-on-play')
            assert.match(skipped.summary, /登場效果：條件不成立/)
            assert.doesNotMatch(skipped.summary, /選擇不發動/)
          } else {
            await panel.waitFor()
            assert.match(await panel.innerText(), /Clotted Cream Cookie/)
            assert.match(await panel.innerText(), /獲得 2 HP/)
            assert.equal(await panel.locator('.modal-card-options > button').count(), 0)
            await shot('on-play-choice')
            await panel.getByRole('button', { name: scenario === 'skip-on-play' ? '略過整個登場效果' : '確認發動', exact: true }).click()
            await page.waitForFunction(() => !document.querySelector('.effect-panel:not(.is-complete)'))
            const after = await state(page)
            assert.deepEqual(after.top, row.before.top)
            assert.deepEqual(after.bottom.battle.map(c => c.hp), [2, scenario === 'skip-on-play' ? 4 : 6])
            assert.equal(after.bottom.deck, scenario === 'skip-on-play' ? 10 : 8)
            assert.deepEqual(after.bottom.support, row.before.bottom.support)
            assert.equal(after.bottom.breakLevel, row.before.bottom.breakLevel)
            if (scenario === 'skip-on-play') {
              const skipped = (await trace(page)).slice(row.beforeTrace.length).find(entry => entry.commandKind === 'skip-on-play')
              assert.match(skipped.summary, /選擇不發動/)
              assert.doesNotMatch(skipped.summary, /條件不成立/)
            }
          }
        }
      }
      row.after = await state(page)
      row.trace = await trace(page)
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
      await shot('result')
      row.status = 'PASS'
      console.log(`PASS ${number} ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { row.error = String(error.stack ?? error); row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { rows.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)); await page.close() }
  }
  console.log(`BS12-036 printed EXTRA/OnPlay/ordinary and declined R003 Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
