import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-032-cost-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-festival-arena-bs12.en.json'), 'utf8')).cards
const formal = readdirSync(resolve(root, 'data/cards')).filter(f => f.endsWith('.json')).flatMap(f => JSON.parse(readFileSync(resolve(root, 'data/cards', f), 'utf8')).cards ?? [])
const cards = ['BS12-032', 'BS12-032@1', 'BS12-031', 'BS12-028', 'BS12-024', 'BS12-019', 'BS12-001', 'BS6-008', 'BS12-007', 'P-106', 'ST4-001'].map(n => [...candidate, ...formal].find(c => c.cardNumber === n))
// Real Arena item costs, followed by printed effects and the source's HP choice.
// Damage/fainting applicability remains outside this matrix.
const cases = ['positive', 'zero-all', 'hp-skip', 'draw-skip', 'damage-skip', 'cancel-energy', 'cancel-cost', 'back-energy', 'deselect-cost', 'rested-source', 'equipped-source', 'other-cookie', 'hand-zero', 'hand-three', 'wrong-energy', 'one-energy', 'rested-energy', 'break-nine', 'refresh-draw', 'refresh-hp', 'hp-prevented']
const fixture = s => ({ 'rested-source': 'cost-rested', 'equipped-source': 'cost-equipped', 'other-cookie': 'cost-other-cookie', 'hand-zero': 'cost-hand', 'hand-three': 'cost-hand', 'wrong-energy': 'cost-wrong-energy', 'one-energy': 'cost-one-energy', 'rested-energy': 'cost-rested-energy', 'break-nine': 'cost-break-nine', 'refresh-draw': 'cost-short-deck', 'refresh-hp': 'cost-short-deck', 'hp-prevented': 'cost-prevented' }[s] ?? 'cost')
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
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]'), null, { timeout: 20000 })
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const number of ['BS12-032', 'BS12-032@1']) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const result = { number, scenario, viewport, scope: 'candidate-arena-direct-cost', status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => result.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') result.errors.push(m.text()) })
    page.on('requestfailed', r => result.networkFailures.push({ url: r.url(), error: r.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, r => r.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const route = `${number.toLowerCase()}:${fixture(scenario)}`
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${route}&contract-card=BS12-031,BS12-028,BS12-032`)
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      const sourceImage = page.locator('.bottom-field :is(.combat-card-wrap, .hand-card) img[alt="Caramel Choux Cookie"]')
      await sourceImage.evaluate(img => img.decode())
      assert.equal(await sourceImage.getAttribute('src'), cards.find(c => c.cardNumber === number).imageUrl)
      if (scenario === 'equipped-source') {
        const equippedHostImage = page.locator('.bottom-field .combat-card-wrap img[alt="Shining Glitter Cookie"]')
        await equippedHostImage.evaluate(img => img.decode())
        assert.equal(await equippedHostImage.getAttribute('src'), cards.find(c => c.cardNumber === 'P-106').imageUrl)
      }
      const handCost = scenario.startsWith('hand-')
      const itemName = handCost ? 'Luxury Red Carpet' : 'Fashionista Spotlight'
      result.before = await readState(page)
      await page.getByRole('button', { name: itemName, exact: true }).click()
      const use = page.getByRole('button', { name: '使用', exact: true })
      if (blocked.includes(scenario)) {
        if (await use.count()) assert.equal(await use.isEnabled(), false)
        assert.deepEqual(await readState(page), result.before)
        assert.deepEqual(await trace(page), [])
      } else {
        await use.click()
        const panel = page.locator('.effect-panel:not(.is-complete):visible')
        await panel.waitFor()
        const pay = panel.locator('.effect-candidates-payment .effect-candidate-entry > button')
        const next = panel.getByRole('button', { name: '下一步', exact: true })
        assert.equal(await next.isEnabled(), false)
        await pay.nth(0).click()
        if (!handCost) { assert.equal(await next.isEnabled(), false); await pay.nth(1).click() }
        if (scenario === 'cancel-energy') await panel.getByRole('button', { name: '取消技能', exact: true }).click()
        else {
          await next.click()
          const cost = panel.locator(handCost ? '.effect-candidates-cost-hand-to-break .effect-candidate-entry > button' : '.effect-candidates-trash-battle button')
          const selected = cost.filter({ hasText: scenario === 'other-cookie' ? 'GingerBrave' : 'Caramel Choux Cookie' })
          const confirm = panel.getByRole('button', { name: '確認發動', exact: true })
          assert.equal(await confirm.isEnabled(), false)
          await selected.click()
          if (scenario === 'deselect-cost') { await selected.click(); assert.equal(await confirm.isEnabled(), false); await selected.click() }
          if (scenario === 'back-energy') { await panel.getByRole('button', { name: '上一步', exact: true }).click(); await next.click(); assert.equal(await selected.getAttribute('aria-pressed'), 'true') }
          const draft = await readState(page)
          assert.deepEqual({ ...draft.bottom, support: result.before.bottom.support }, result.before.bottom)
          assert.deepEqual(draft.top, result.before.top)
          assert.deepEqual(await trace(page), [])
          await shot('cost-selection')
          if (scenario === 'cancel-cost') await panel.getByRole('button', { name: '取消技能', exact: true }).click()
          else {
            await confirm.click()
            await settle(page)
            result.paid = await readState(page)
            assert.equal(result.paid.bottom.breakLevel, scenario === 'break-nine' ? 10 : 1)
            assert.deepEqual(result.paid.bottom.support, handCost ? [true, false] : [true, true])
            assert.equal(result.paid.bottom.trash - result.before.bottom.trash, handCost ? 1 : 3)
            assert.equal(result.paid.bottom.deck, result.before.bottom.deck)
            assert.deepEqual(result.paid.top, result.before.top)
            if (scenario === 'break-nine') {
              assert.match(await page.locator('body').innerText(), /勝利|敗北/)
              assert.equal(await page.getByRole('heading', { name: 'Caramel Choux Cookie 發動休息區移入效果', exact: true }).count(), 0)
            } else {
              if (handCost) await page.locator('.effect-panel:not(.is-complete):visible').getByRole('button', { name: '確認發動', exact: true }).click()
              const draw = page.locator('.draw-up-to-modal:visible')
              await draw.waitFor()
              assert.equal(await page.getByRole('heading', { name: 'Caramel Choux Cookie 發動休息區移入效果', exact: true }).count(), 0)
              const count = scenario === 'hand-three' ? 3 : ['zero-all', 'draw-skip', 'hand-zero', 'refresh-hp'].includes(scenario) ? 0 : 1
              if (count) await draw.locator('.draw-up-to-option').filter({ hasText: `抽 ${count} 張` }).click()
              await draw.getByRole('button', { name: count ? `抽取 ${count} 張牌` : '略過抽牌', exact: true }).click()
              if (scenario === 'refresh-draw') await page.getByRole('alertdialog').getByRole('button', { name: 'Muscle Cookie Muscle Cookie', exact: true }).click()
              await settle(page)
              const damage = !handCost && !['zero-all', 'damage-skip'].includes(scenario)
              if (!handCost) {
                const targetPanel = page.locator('.effect-panel:not(.is-complete):visible')
                await targetPanel.waitFor()
                assert.equal(await page.getByRole('heading', { name: 'Caramel Choux Cookie 發動休息區移入效果', exact: true }).count(), 0)
                if (damage) await targetPanel.getByRole('button').filter({ hasText: 'AI 對手・戰鬥區第 1 張' }).click()
                await targetPanel.getByRole('button', { name: '確認發動', exact: true }).click()
                await settle(page)
              }
              if (scenario !== 'other-cookie') {
                await page.getByRole('heading', { name: 'Caramel Choux Cookie 發動休息區移入效果', exact: true }).waitFor()
                result.beforeHp = await readState(page)
                assert.deepEqual(result.beforeHp.bottom.battle, result.paid.bottom.battle)
                const hpSkipped = ['zero-all', 'hp-skip'].includes(scenario)
                if (!hpSkipped) {
                  const name = scenario === 'hand-three' ? 'GingerBrave' : scenario === 'equipped-source' ? 'Shining Glitter Cookie' : 'Candy Diver Cookie'
                  await page.locator('.bottom-field').getByRole('button', { name, exact: true }).click()
                  assert.deepEqual(await readState(page), result.beforeHp)
                }
                await page.getByRole('button', { name: hpSkipped ? '確認略過' : '確認 (1)', exact: true }).click()
                if (scenario === 'refresh-hp') await page.getByRole('alertdialog').getByRole('button', { name: 'Muscle Cookie Muscle Cookie', exact: true }).click()
              } else assert.equal(await page.getByRole('heading', { name: 'Caramel Choux Cookie 發動休息區移入效果', exact: true }).count(), 0)
              await settle(page)
              while (await page.getByRole('button', { name: '不補餅乾', exact: true }).count()) await page.getByRole('button', { name: '不補餅乾', exact: true }).click()
              result.after = await readState(page)
              const gained = !['zero-all', 'hp-skip', 'hp-prevented', 'other-cookie'].includes(scenario)
              const hpId = scenario === 'hand-three' ? 'bs12-032-ally' : 'bs12-032-mover'
              assert.deepEqual(result.after.bottom.battle, result.paid.bottom.battle.map(c => ({ ...c, hp: c.hp + (gained && c.id === hpId ? 1 : 0) })))
              assert.equal(result.after.bottom.deck, scenario === 'refresh-draw' ? 6 : scenario === 'refresh-hp' ? 7 : result.before.bottom.deck - count - (gained ? 1 : 0))
              assert.equal(result.after.bottom.breakLevel, scenario.startsWith('refresh-') ? 4 : 1)
              assert.deepEqual(result.after.top.battle, result.before.top.battle.map((c, i) => ({ ...c, hp: c.hp - (damage && i === 0 ? 1 : 0) })))
              assert.deepEqual(result.after.bottom.support, result.paid.bottom.support)
              assert.equal(result.after.bottom.hand, result.paid.bottom.hand + count)
              assert.equal(result.after.bottom.trash, scenario.startsWith('refresh-') ? 0 : result.paid.bottom.trash)
              result.trace = await trace(page)
              const kinds = result.trace.map(e => e.commandKind)
              assert.deepEqual(kinds.slice(0, handCost ? 3 : 4), handCost ? ['begin-play-item', 'resolve-ability-effect', 'resolve-draw-up-to'] : ['begin-play-item', 'resolve-ability-effect', 'resolve-draw-up-to', 'resolve-ability-effect'])
              assert.match(result.trace[0].steps.join(' '), /代價.*休息區/)
              const hpTrace = result.trace.filter(e => e.commandKind === 'resolve-after-damage-effect')
              assert.equal(hpTrace.length, scenario === 'other-cookie' ? 0 : 1)
              if (hpTrace.length) assert.match(hpTrace[0].steps.join(' '), gained ? /休息區移入效果.*增加 1.*HP/ : scenario === 'hp-prevented' ? /休息區移入效果.*增加 0 張 HP/ : /休息區移入效果.*未增加 HP/)
            }
          }
        }
        if (scenario.startsWith('cancel-')) { await settle(page); assert.deepEqual(await readState(page), result.before); assert.deepEqual(await trace(page), []) }
      }
      assert.deepEqual(result.errors, [])
      assert.deepEqual(result.networkFailures, [])
      await shot('result')
      result.status = 'PASS'
    } catch (error) { result.error = String(error.stack ?? error); result.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { results.push(result); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(results, null, 2)); await page.close() }
    console.log(`PASS Arena cost ${number} ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-032 Arena direct-cost Browser ${results.length}/${results.length}; fainting applicability excluded`)
} finally { await browser.close() }
