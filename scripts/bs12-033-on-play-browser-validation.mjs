import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, 'test-results/bs12-033-on-play-browser')
mkdirSync(out, { recursive: true })
const cards = ['official-arena-of-glory-bs7.en.json', 'official-starter-deck-blue.en.json'].flatMap(file => JSON.parse(readFileSync(resolve(root, 'data/cards', file), 'utf8')).cards)
cards.push(...JSON.parse(readFileSync(resolve(root, 'data/cards/official-festival-arena-bs12.en.json'), 'utf8')).cards)
const cases = ['positive', 'whole-skip-cost', 'whole-skip-target', 'deselect', 'back', 'damage-zero', 'draw-zero', 'rested', 'equipped', 'non-arena', 'refresh', 'break-nine', 'other-target', 'opponent-turn']
const fixture = s => ({ rested: 'on-play-rested', equipped: 'on-play-equipped', 'non-arena': 'on-play-non-arena', refresh: 'on-play-short-deck', 'break-nine': 'on-play-break-nine', 'opponent-turn': 'on-play-opponent-turn' }[s] ?? 'on-play')
const state = page => page.evaluate(() => {
  const side = name => {
    const f = document.querySelector(`.${name}-field`)
    return { deck: Number(f.querySelector('.deck-zone .resource-summary > strong')?.textContent), trash: Number(f.querySelector('.discard-zone.resource-summary > strong')?.textContent),
      breakLevel: Number(f.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1]), hand: f.querySelectorAll('.hand-card').length,
      support: [...f.querySelectorAll('.support-card-wrap')].map(n => n.querySelector('.card-face').classList.contains('is-rested')),
      battle: [...f.querySelectorAll('.combat-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]), rested: n.querySelector('.card-face').classList.contains('is-rested') })) }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, steps: e.steps })))
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const rows = []
try {
  for (const number of ['BS12-033', 'BS12-033@1']) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const row = { number, scenario, viewport, scope: 'candidate-bs7-033-on-play-033-draw', status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), error: r.failure()?.errorText }))
    const shot = suffix => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${suffix}.png`) })
    try {
      for (const n of [number, 'BS7-033', 'BS12-001', 'BS12-019', 'BS12-007', 'ST4-001']) {
        const card = cards.find(c => c.cardNumber === n)
        await page.route(card.imageUrl, r => r.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${n}.webp`)) }))
      }
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${number.toLowerCase()}:${fixture(scenario)}&contract-card=BS7-033,BS12-033,BS12-019`)
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      for (const name of ['Candy Drop Cookie', 'Espresso Cookie']) await page.locator(`.bottom-field img[alt="${name}"]`).evaluate(img => img.decode())
      row.before = await state(page)
      const panel = page.locator('.effect-panel:not(.is-complete):visible')
      const next = panel.getByRole('button', { name: '下一步', exact: true })
      if (scenario === 'non-arena') {
        // The controller declines an unpayable OnPlay before opening a panel.
        await page.getByRole('button', { name: '結束主要階段', exact: true }).waitFor()
        assert.equal(await panel.count(), 0)
        assert.deepEqual((await trace(page)).map(e => e.commandKind), ['skip-on-play'])
        assert.deepEqual(await state(page), row.before)
        assert.equal(await page.getByRole('heading', { name: 'Espresso Cookie 發動休息區移入效果', exact: true }).count(), 0)
      } else if (scenario === 'whole-skip-cost') {
        await panel.waitFor()
        await panel.getByRole('button', { name: '略過整個登場效果', exact: true }).click()
        assert.deepEqual(await state(page), row.before)
      } else {
        await panel.waitFor()
        const cost = panel.locator('.effect-candidates-trash-battle button')
        assert.equal(await cost.count(), 1)
        assert.match(await cost.innerText(), /Espresso Cookie/)
        assert.equal(await next.isEnabled(), false)
        await cost.click()
        if (scenario === 'deselect') { await cost.click(); assert.equal(await next.isEnabled(), false); await cost.click() }
        assert.deepEqual(await state(page), row.before)
        await next.click()
        if (scenario === 'back') { await panel.getByRole('button', { name: '上一步', exact: true }).click(); assert.equal(await cost.getAttribute('aria-pressed'), 'true'); await next.click() }
        assert.deepEqual(await state(page), row.before)
        assert.deepEqual(await trace(page), [])
        await shot('selection')
        if (scenario === 'whole-skip-target') {
          await panel.getByRole('button', { name: '略過整個登場效果', exact: true }).click()
          assert.deepEqual(await state(page), row.before)
        } else {
          if (scenario !== 'damage-zero') await panel.getByRole('button').filter({ hasText: `AI 對手・戰鬥區第 ${scenario === 'other-target' ? 2 : 1} 張` }).click()
          await panel.getByRole('button', { name: '確認發動', exact: true }).click()
          if (scenario === 'break-nine') {
            await page.waitForFunction(() => /勝利|敗北/.test(document.body.innerText))
            assert.match(await page.locator('body').innerText(), /勝利|敗北/)
            row.after = await state(page)
            assert.equal(row.after.bottom.breakLevel, 10)
            assert.equal(row.after.bottom.deck, 12)
            assert.deepEqual(row.after.top, row.before.top)
          } else if (scenario === 'opponent-turn') {
            await page.waitForFunction(() => (window.__braverseContractTrace ?? []).some(e => e.commandKind === 'resolve-ability-effect'))
            while (await page.getByRole('button', { name: '不補餅乾', exact: true }).count()) await page.getByRole('button', { name: '不補餅乾', exact: true }).click()
            row.after = await state(page)
            assert.deepEqual(row.after.bottom.battle, row.before.bottom.battle.filter(c => c.id !== 'bs12-032-source'))
            assert.equal(row.after.bottom.trash, 2)
            assert.equal(row.after.bottom.breakLevel, 1)
            assert.equal(row.after.bottom.deck, 12)
            assert.deepEqual(row.after.bottom.support, row.before.bottom.support)
            assert.deepEqual(row.after.top.battle, row.before.top.battle.map((c, i) => ({ ...c, hp: c.hp - (i === 0 ? 2 : 0) })))
            assert.equal(await page.getByRole('heading', { name: 'Espresso Cookie 發動休息區移入效果', exact: true }).count(), 0)
            row.trace = await trace(page)
            assert.deepEqual(row.trace.map(e => e.commandKind), ['begin-activate-skill', 'resolve-ability-effect'])
            assert.match(row.trace[0].steps.join(' '), /代價.*休息區/)
          } else {
            await page.locator('.draw-up-to-modal').waitFor()
            await page.locator('.draw-up-to-modal img[alt="Espresso Cookie"]').evaluate(img => img.decode())
            assert.equal(await page.locator('.draw-up-to-modal img[alt="Espresso Cookie"]').getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
            row.paid = await state(page)
            assert.deepEqual(row.paid.bottom.battle, row.before.bottom.battle.filter(c => c.id !== 'bs12-032-source'))
            assert.equal(row.paid.bottom.trash, row.before.bottom.trash + (scenario === 'equipped' ? 3 : 2))
            assert.equal(row.paid.bottom.deck, row.before.bottom.deck)
            assert.equal(row.paid.bottom.breakLevel, 1)
            assert.deepEqual(row.paid.top.battle, row.before.top.battle.map((c, i) => ({ ...c, hp: c.hp - (scenario !== 'damage-zero' && i === (scenario === 'other-target' ? 1 : 0) ? 2 : 0) })))
            if (scenario !== 'draw-zero') await page.locator('.draw-up-to-option').filter({ hasText: '抽 1 張' }).click()
            assert.deepEqual(await state(page), row.paid)
            await page.getByRole('button', { name: scenario === 'draw-zero' ? '略過抽牌' : '抽取 1 張牌', exact: true }).click()
            if (scenario === 'refresh') await page.getByRole('alertdialog').getByRole('button', { name: 'Muscle Cookie Muscle Cookie', exact: true }).click()
            while (await page.getByRole('button', { name: '不補餅乾', exact: true }).count()) await page.getByRole('button', { name: '不補餅乾', exact: true }).click()
            row.after = await state(page)
            assert.deepEqual(row.after.bottom.battle, row.paid.bottom.battle)
            assert.equal(row.after.bottom.hand, scenario === 'draw-zero' ? 0 : 1)
            assert.equal(row.after.bottom.deck, scenario === 'refresh' ? 6 : scenario === 'draw-zero' ? 12 : 11)
            assert.equal(row.after.bottom.trash, scenario === 'refresh' ? 0 : row.paid.bottom.trash)
            assert.equal(row.after.bottom.breakLevel, scenario === 'refresh' ? 4 : 1)
            assert.deepEqual(row.after.bottom.support, row.before.bottom.support)
            assert.deepEqual(row.after.top, row.paid.top)
            row.trace = await trace(page)
            assert.deepEqual(row.trace.map(e => e.commandKind), ['begin-activate-skill', 'resolve-ability-effect', 'resolve-after-damage-effect', 'resolve-draw-up-to', ...(scenario === 'refresh' ? ['refresh-deck'] : [])])
            assert.match(row.trace[0].steps.join(' '), /代價.*休息區/)
            assert.match(row.trace[2].steps.join(' '), /抽牌選擇/)
            assert.match(row.trace[3].steps.join(' '), scenario === 'draw-zero' ? /0|略過|不抽/ : /1/)
          }
        }
      }
      assert.deepEqual(row.errors, [])
      assert.deepEqual(row.networkFailures, [])
      await shot('result')
      row.status = 'PASS'
    } catch (error) { row.error = String(error.stack ?? error); row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { rows.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)); await page.close() }
    console.log(`PASS BS7-033 Arena cost ${number} ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-033 real On Play cost Browser ${rows.length}/${rows.length}; fainting excluded`)
} finally { await browser.close() }
