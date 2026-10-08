import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-050-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const fixtures = ['positive', 'empty-trash', 'non-arena-only', 'opponent-only', 'battle-only', 'no-energy', 'wrong-energy', 'few-energy', 'rested-energy', 'opponent-turn', 'outside-main', 'last-deck']
const extras = ['zero', 'skip', 'cancel-payment', 'cancel-target', 'back-payment', 'deselect-payment', 'deselect-target', 'switch-target', 'target-max', 'green-high-level', 'blue', 'red', 'source-detail', 'wrong-draft-payment', 'last-deck-zero', 'return-target-zero']
const blocked = ['no-energy', 'wrong-energy', 'few-energy', 'rested-energy', 'opponent-turn', 'outside-main']
const route = s => s === 'last-deck-zero' ? 'last-deck' : fixtures.includes(s) ? s : 'positive'
const readState = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return { deck: Number(field.querySelector('.deck-zone .resource-summary>strong')?.textContent), trash: Number(field.querySelector('.discard-zone.resource-summary>strong')?.textContent), hand: field.querySelectorAll('.hand-card').length,
      battle: [...field.querySelectorAll('.combat-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]), rested: n.querySelector('.card-face').classList.contains('is-rested') })),
      support: [...field.querySelectorAll('.support-card-wrap')].map(n => ({ id: n.getAttribute('data-card-instance-id'), rested: n.querySelector('.card-face').classList.contains('is-rested') })) }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, steps: e.steps })))
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const rows = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of [...fixtures, ...extras].filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const row = { number: 'BS12-050', scenario, viewport, scope: 'candidate-printed-GGG-Arena-Cookie-trash-to-support-REST', status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route=>route.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp'))}))
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && route(scenario) === 'positive' ? 'card:'+'BS12-050' : process.env.BS12_BROWSER_ROUTE === 'generic' && route(scenario) === 'non-arena-only' ? 'card-negative:'+'BS12-050' : 'bs12-050:'+route(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card=BS12-001,BS12-003,BS12-005,BS12-006,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-019,BS12-022,BS12-028,BS12-029,BS12-030,BS12-031,BS12-038,BS12-039,BS12-041,BS12-044,BS12-046,BS12-048,BS12-049,BS12-050,BS12-051,BS12-052,BS12-053,BS12-055,BS12-070,BS6-008,BS7-055,BS7-061,ST3-001,ST4-001,ST4-002,ST4-003,ST4-004,ST4-005')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      row.before = await readState(page)
      const hand = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator('img[alt="Wonderful Melody"]') })
      await hand.locator('button.card-face').click()
      if (scenario === 'source-detail') {
        await hand.getByRole('button', { name: '詳情', exact: true }).click()
        const detail = page.getByRole('dialog', { name: 'Wonderful Melody 卡牌詳情', exact: true })
        await detail.waitFor()
        assert.match(await detail.innerText(), /Place up to 1.*Arena.*Cookie.*trash.*support area as rested/s)
        assert.equal(await detail.locator('img[alt="Wonderful Melody"]').getAttribute('src'), cards.find(c => c.cardNumber === 'BS12-050').imageUrl)
        await detail.locator('img[alt="Wonderful Melody"]').evaluate(i => i.decode())
        await shot('detail')
        await detail.getByRole('button', { name: '關閉', exact: true }).click()
        assert.deepEqual(await readState(page), row.before)
        assert.deepEqual(await trace(page), [])
      } else if (blocked.includes(scenario)) {
        const use = hand.getByRole('button', { name: '使用', exact: true })
        if (await use.count()) assert.equal(await use.isEnabled(), false)
        assert.equal(await page.getByRole('alertdialog').count(), 0)
        assert.deepEqual(await readState(page), row.before)
        assert.deepEqual(await trace(page), [])
      } else {
        await hand.getByRole('button', { name: '使用', exact: true }).click()
        const panel = page.getByRole('alertdialog')
        const next = panel.getByRole('button', { name: '下一步', exact: true })
        assert.equal(await next.isEnabled(), false)
        const energyNames = ['Greenbell Cookie', 'E-Z Camera', 'Orchestra Hall']
        for (const name of energyNames) assert.equal(await panel.getByRole('button', { name: new RegExp(`^${name} ${name}`) }).count(), 1)
        assert.equal(await panel.getByRole('button', { name: /^Candy Diver Cookie Candy Diver Cookie/ }).count(), 0)
        const cancel = ['skip', 'cancel-payment', 'cancel-target'].includes(scenario)
        if (!['skip', 'cancel-payment'].includes(scenario)) {
          for (const name of energyNames) await panel.getByRole('button', { name: new RegExp(`^${name} ${name}`) }).click()
          if (scenario === 'deselect-payment') { await panel.getByRole('button', { name: /^Greenbell Cookie Greenbell Cookie/ }).click(); assert.equal(await next.isEnabled(), false); await panel.getByRole('button', { name: /^Greenbell Cookie Greenbell Cookie/ }).click() }
          await next.click()
          if (scenario === 'back-payment') { await panel.getByRole('button', { name: '上一步', exact: true }).click(); assert.equal(await next.isEnabled(), true); await next.click() }
          assert.match(await panel.innerText(), /【Arena】餅乾以疲勞狀態放入支援區/)
          const options = panel.locator('.effect-candidates .effect-candidate-entry>button')
          const noCandidate = ['empty-trash', 'non-arena-only', 'opponent-only', 'battle-only'].includes(scenario)
          assert.equal(await options.count(), noCandidate ? 0 : 4)
          if (!noCandidate) {
            const images = await options.locator('img').evaluateAll(nodes => nodes.map(n => n.getAttribute('src')).sort())
            assert.deepEqual(images, ['BS12-041', 'BS12-039', 'BS12-070', 'BS12-019'].map(n => cards.find(c => c.cardNumber === n).imageUrl).sort())
          }
          let selected = noCandidate || ['zero', 'last-deck-zero', 'return-target-zero'].includes(scenario) ? null : scenario === 'green-high-level' ? 1 : scenario === 'blue' ? 2 : scenario === 'red' ? 3 : 0
          const names = ['Basil Pesto Cookie', 'Melon Soda Cookie', 'Stardust Cookie', 'Muscle Cookie']
          const choice = i => panel.getByRole('button', { name: new RegExp(`^${names[i]} ${names[i]}`) })
          if (selected !== null) await choice(selected).click()
          if (scenario === 'deselect-target') { await choice(0).click(); selected = null }
          if (scenario === 'switch-target') { await choice(0).click(); await choice(3).click(); selected = 3 }
          if (scenario === 'target-max') {
            await choice(1).click()
            assert.equal(await panel.locator('.effect-candidates .effect-candidate-entry>button.is-selected').count(), 1)
            for (const button of await panel.locator('.effect-candidates .effect-candidate-entry>button.is-selected').all()) await button.click()
            await choice(2).click(); selected = 2
          }
          if (scenario === 'return-target-zero') { await choice(2).click(); await panel.getByRole('button', { name: '上一步', exact: true }).click(); await next.click(); await choice(2).click() }
          assert.deepEqual(await trace(page), [])
          assert.equal((await readState(page)).bottom.hand, 1)
          assert.equal((await readState(page)).bottom.trash, row.before.bottom.trash)
          await shot('target')
          await panel.getByRole('button', { name: scenario === 'cancel-target' ? '取消技能' : '確認發動', exact: true }).click()
          if (!cancel) {
            await page.waitForFunction(() => !document.querySelector('[role="alertdialog"]'))
            const after = await readState(page)
            assert.equal(after.bottom.hand, 0)
            assert.equal(after.bottom.trash, row.before.bottom.trash + 1 - (selected === null ? 0 : 1))
            assert.equal(after.bottom.support.length, row.before.bottom.support.length + (selected === null ? 0 : 1))
            assert.ok(after.bottom.support.every(c => c.rested))
            if (selected !== null) assert.equal(after.bottom.support.at(-1).id, `bs12-050-trash-${selected}`)
            assert.equal(after.bottom.deck, row.before.bottom.deck)
            assert.deepEqual(after.bottom.battle, row.before.bottom.battle)
            assert.deepEqual(after.top, row.before.top)
            assert.deepEqual((await trace(page)).map(e => e.commandKind), ['begin-play-item', 'resolve-ability-effect'])
            const steps = (await trace(page)).at(-1).steps
            assert.ok(steps.some(s => selected === null ? s.includes('選擇 0 張，此段未移動卡牌') : s.includes(`1 張卡移入支援區（疲勞）：${names[selected]}`)))
          }
        } else await panel.getByRole('button', { name: scenario === 'skip' ? '不發動' : '取消技能', exact: true }).click()
        if (cancel) { assert.deepEqual(await readState(page), row.before); assert.deepEqual(await trace(page), []) }
      }
      row.after = await readState(page)
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
      console.log(`PASS BS12-050 ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { row.error = String(error.stack ?? error); row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { rows.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)); await page.close() }
  }
  console.log(`BS12-050 Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
