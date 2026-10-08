import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-048-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const fixtures = ['positive', 'placed', 'replace', 'rested-entry', 'blue-entry', 'no-arena', 'item-only', 'no-support', 'full-battle', 'no-energy', 'wrong-energy', 'rested-energy', 'entry-only-energy', 'rested-source', 'opponent-turn', 'outside-main', 'no-opponent-support', 'rested-target', 'last-deck', 'short-deck', 'refresh-lv10']
const extras = ['entry-zero', 'entry-other', 'deselect-entry', 'retarget-entry', 'cancel-placement', 'deselect-placement', 'cancel-cost', 'cancel-entry', 'back-cost', 'skip-then', 'return-then', 'deselect-then-energy', 'target-zero', 'target-item', 'target-stage', 'deselect-target', 'retarget-target', 'hand-preview']
const cases = [...fixtures, ...extras]
const readState = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return { deck: Number(field.querySelector('.deck-zone .resource-summary>strong')?.textContent), hand: field.querySelectorAll('.hand-card').length,
      trash: Number(field.querySelector('.discard-zone.resource-summary>strong')?.textContent),
      breakLevel: Number(field.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1]),
      stage: field.querySelector('.stage-zone img')?.getAttribute('src') ?? null,
      stageRested: field.querySelector('.stage-zone .card-face')?.classList.contains('is-rested') ?? false,
      support: [...field.querySelectorAll('.support-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), rested: n.querySelector('.card-face').classList.contains('is-rested') })),
      battle: [...field.querySelectorAll('.combat-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]), rested: n.querySelector('.card-face').classList.contains('is-rested') })) }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, steps: e.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]'), null, { timeout: 20000 })
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const rows = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const row = { number: 'BS12-048', scenario, viewport, scope: 'candidate-printed-stage-entry-optional-G-support-rest', status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = suffix => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${suffix}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route=>route.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp'))}))
      const fixture = extras.includes(scenario) ? 'positive' : scenario
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'positive' ? 'card:BS12-048' : process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'item-only' ? 'card-negative:BS12-048' : 'bs12-048:'+fixture
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-048,BS12-001,BS12-003,BS12-005,BS12-006,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-028,BS12-029,BS12-030,BS12-031,BS12-046,BS12-055,BS6-008,BS7-055,BS7-061,BS8-025,ST4-001,ST4-002,ST4-003,ST4-004,ST4-005')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      row.before = await readState(page)
      const stageCard = cards.find(c => c.cardNumber === 'BS12-048')
      const hand = page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-048-stage"]')
      if (scenario === 'hand-preview') {
        await hand.locator('button.card-face').click()
        await hand.getByRole('button', { name: '詳情', exact: true }).click()
        const detail = page.getByRole('dialog', { name: 'Orchestra Hall' })
        await detail.waitFor()
        assert.match(await detail.innerText(), /If you did.*support area/s)
        assert.equal(await detail.locator('img').first().getAttribute('src'), stageCard.imageUrl)
        await detail.locator('img').first().evaluate(img => img.decode())
        await detail.getByRole('button', { name: '關閉', exact: true }).click()
        assert.deepEqual(await readState(page), row.before)
      } else if (['no-energy', 'wrong-energy', 'rested-energy'].includes(scenario)) {
        await hand.locator('button.card-face').click()
        assert.equal(await page.getByRole('button', { name: '放置', exact: true }).count(), 0)
        assert.deepEqual(await readState(page), row.before)
        assert.deepEqual(await trace(page), [])
      } else {
        if (row.before.bottom.hand) {
          await hand.locator('button.card-face').click()
          await hand.getByRole('button', { name: '放置', exact: true }).click()
          const modal = page.getByRole('alertdialog', { name: 'Orchestra Hall 場景放置付款' })
          await modal.waitFor()
          const pay = modal.getByRole('button', { name: '支付並放置', exact: true })
          assert.equal(await pay.isEnabled(), false)
          assert.equal(await modal.locator('img').first().getAttribute('src'), stageCard.imageUrl)
          await modal.locator('img').first().evaluate(img => img.decode())
          const chosenName = scenario === 'item-only' ? 'E-Z Camera' : 'Basil Pesto Cookie'
          const choice = modal.locator('.modal-card-options>button').filter({ hasText: chosenName })
          await choice.click()
          if (scenario === 'deselect-placement') { await choice.click(); assert.equal(await pay.isEnabled(), false); await choice.click() }
          if (scenario === 'cancel-placement') {
            await modal.getByRole('button', { name: '取消', exact: true }).click()
            assert.deepEqual(await readState(page), row.before)
            assert.deepEqual(await trace(page), [])
          } else {
            await shot('placement')
            await pay.click()
            await modal.waitFor({ state: 'hidden' })
            await settle(page)
            row.placed = await readState(page)
            assert.equal(row.placed.bottom.stage, stageCard.imageUrl)
            assert.equal(row.placed.bottom.stageRested, false)
            assert.equal(row.placed.bottom.hand, 0)
            assert.equal(row.placed.bottom.trash, row.before.bottom.trash + (scenario === 'replace' ? 1 : 0))
            assert.deepEqual(row.placed.bottom.battle, row.before.bottom.battle)
            assert.equal(row.placed.bottom.deck, row.before.bottom.deck)
          }
        } else row.placed = row.before
        if (scenario !== 'cancel-placement') {
          if (['rested-source', 'opponent-turn', 'outside-main'].includes(scenario)) {
            assert.equal(await page.locator('.bottom-field .stage-quick-action').count(), 0)
            assert.deepEqual(await readState(page), row.placed)
          } else {
            await page.locator('.bottom-field .stage-quick-action').click()
            const panel = page.getByRole('alertdialog')
            await panel.waitFor()
            assert.match(await panel.innerText(), /將效果來源卡橫置/)
            if (scenario === 'cancel-cost') {
              await panel.getByRole('button', { name: '取消技能', exact: true }).click()
              assert.deepEqual(await readState(page), row.placed)
            } else {
              await panel.getByRole('button', { name: '下一步', exact: true }).click()
              if (scenario === 'back-cost') {
                await panel.getByRole('button', { name: '上一步', exact: true }).click()
                assert.match(await panel.innerText(), /將效果來源卡橫置/)
                assert.deepEqual(await readState(page), row.placed)
                await panel.getByRole('button', { name: '下一步', exact: true }).click()
              }
              const options = panel.locator('.effect-candidate-entry>button')
              const empty = ['no-support', 'item-only', 'full-battle'].includes(scenario)
              assert.equal(await options.count(), empty ? 0 : ['no-arena', 'entry-only-energy'].includes(scenario) ? 1 : 2)
              const zero = empty || ['no-arena', 'entry-zero', 'deselect-entry'].includes(scenario)
              if (!zero || scenario === 'deselect-entry') {
                const entryIndex = scenario === 'entry-other' ? 1 : 0
                await options.nth(entryIndex).click()
                if (scenario === 'deselect-entry') await options.nth(entryIndex).click()
                if (scenario === 'retarget-entry') { await options.nth(1).click(); assert.match(await options.nth(0).innerText(), /已選/); await options.nth(0).click(); await options.nth(1).click() }
              }
              await shot('entry')
              if (scenario === 'cancel-entry') {
                await panel.getByRole('button', { name: '取消技能', exact: true }).click()
                assert.deepEqual(await readState(page), row.placed)
              } else {
                await panel.getByRole('button', { name: '確認發動', exact: true }).click()
                if (['last-deck', 'short-deck', 'refresh-lv10'].includes(scenario)) {
                  await page.getByRole('alertdialog').getByRole('button', { name: /^Candy Diver Cookie Candy Diver Cookie/ }).click()
                  if (scenario !== 'refresh-lv10') await page.getByRole('alertdialog').getByRole('button', { name: '確認發動', exact: true }).click()
                }
                await settle(page)
                if (scenario === 'refresh-lv10') {
                  await page.getByRole('heading', { name: 'AI 對手勝利', exact: true }).waitFor()
                  const after = await readState(page)
                  assert.equal(after.bottom.breakLevel, 11)
                  assert.deepEqual(after.top, row.before.top)
                } else if (zero) {
                  await page.locator('.optional-cost-attack-inline').waitFor({ state: 'hidden' })
                  const after = await readState(page)
                  assert.equal(after.bottom.stageRested, true)
                  assert.deepEqual(after.bottom.battle, row.placed.bottom.battle)
                  assert.deepEqual(after.bottom.support, row.placed.bottom.support)
                  assert.equal(after.bottom.deck, row.placed.bottom.deck)
                  assert.deepEqual(after.top, row.before.top)
                } else {
                  const then = page.locator('.optional-cost-attack-inline')
                  await then.waitFor()
                  row.entered = await readState(page)
                  assert.equal(row.entered.bottom.stageRested, true)
                  assert.equal(row.entered.bottom.battle.at(-1).hp, 2)
                  assert.equal(row.entered.bottom.battle.at(-1).rested, false)
                  assert.equal(row.entered.bottom.support.length, row.placed.bottom.support.length - 1)
                  assert.deepEqual(row.entered.top, row.before.top)
                  assert.match(await then.innerText(), /支援區 1 點綠色能量/)
                  const skip = ['skip-then', 'entry-only-energy'].includes(scenario)
                  if (skip) {
                    assert.equal(await then.getByRole('button', { name: '支付', exact: true }).isEnabled(), scenario !== 'entry-only-energy')
                    await then.getByRole('button', { name: '略過', exact: true }).click()
                    assert.deepEqual(await readState(page), row.entered)
                  } else {
                    await then.getByRole('button', { name: '支付', exact: true }).click()
                    const energy = then.locator('.modal-card-options>button').filter({ hasText: 'E-Z Camera' })
                    const confirm = then.getByRole('button', { name: '確認', exact: true })
                    assert.equal(await confirm.isEnabled(), false)
                    await energy.click()
                    if (scenario === 'deselect-then-energy') { await energy.click(); assert.equal(await confirm.isEnabled(), false); await energy.click() }
                    if (scenario === 'return-then') {
                      await then.getByRole('button', { name: '返回', exact: true }).click()
                      assert.deepEqual(await readState(page), row.entered)
                      await then.getByRole('button', { name: '支付', exact: true }).click()
                      assert.equal(await confirm.isEnabled(), false)
                      await energy.click()
                    }
                    assert.deepEqual(await readState(page), row.entered)
                    await confirm.click()
                    await settle(page)
                    const targetPanel = page.getByRole('alertdialog')
                    await targetPanel.getByRole('button', { name: '確認發動', exact: true }).waitFor()
                    const targets = targetPanel.locator('.effect-candidate-entry>button')
                    assert.equal(await targets.count(), scenario === 'no-opponent-support' ? 0 : 3)
                    const targetZero = ['target-zero', 'no-opponent-support', 'deselect-target'].includes(scenario)
                    const index = scenario === 'target-item' ? 1 : scenario === 'target-stage' ? 2 : 0
                    if (!targetZero || scenario === 'deselect-target') {
                      await targets.nth(index).click()
                      if (scenario === 'deselect-target') await targets.nth(index).click()
                      if (scenario === 'retarget-target') { await targets.nth(1).click(); assert.match(await targets.nth(0).innerText(), /已選/); await targets.nth(0).click(); await targets.nth(1).click() }
                    }
                    await shot('target')
                    await targetPanel.getByRole('button', { name: '確認發動', exact: true }).click()
                    await settle(page)
                    const after = await readState(page)
                    const expected = structuredClone(row.before.top)
                    if (!targetZero) expected.support[scenario === 'retarget-target' ? 1 : index].rested = true
                    assert.deepEqual(after.top, expected)
                    assert.deepEqual(after.bottom.battle, row.entered.bottom.battle)
                    assert.equal(after.bottom.deck, row.entered.bottom.deck)
                    assert.equal(after.bottom.support.find(s => s.id === 'bs12-048-support-2').rested, true)
                  }
                }
                assert.equal(await page.locator('.bottom-field .stage-quick-action').count(), 0)
              }
            }
          }
        }
      }
      row.after = await readState(page)
      row.trace = await trace(page)
      if (!['hand-preview', 'no-energy', 'wrong-energy', 'rested-energy', 'cancel-placement', 'rested-source', 'opponent-turn', 'outside-main'].includes(scenario)) {
        const cancelled = ['cancel-cost', 'cancel-entry'].includes(scenario)
        if (!cancelled) assert.ok(row.trace.some(e => e.commandKind === 'begin-activate-stage'), 'Actual Stage command must be recorded')
        if (!cancelled && row.entered) assert.ok(row.trace.some(e => e.commandKind === 'resolve-optional-cost-attack'))
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
      await shot('result')
      row.status = 'PASS'
      console.log(`PASS BS12-048 ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { row.error = String(error.stack ?? error); row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { rows.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)); await page.close() }
  }
  console.log(`BS12-048 Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
