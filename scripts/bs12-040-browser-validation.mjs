import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-040-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/cards/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,`test-results/bs12-official-art/${card.cardNumber}.webp`)))
const cases = ['positive', 'item-hand', 'stage-hand', 'yellow-hand', 'returned-arena', 'rested-cost', 'non-arena-cost', 'non-arena-hand', 'source-rested', 'all-support-rested', 'skill-zero', 'cancel-cost', 'cancel-target', 'deselect-cost', 'back-cost', 'target-upper-bound', 'item-support-only', 'no-support', 'opponent-turn', 'outside-main', 'used', 'attack', 'attack-wrong', 'attack-few', 'attack-rested-energy', 'attack-rested-source', 'cancel-attack', 'deploy']
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return { hand: field.querySelectorAll('.hand-card').length, deck: Number(field.querySelector('.deck-zone .resource-summary > strong')?.textContent), trash: Number(field.querySelector('.discard-zone.resource-summary > strong')?.textContent),
      breakLevel: Number(field.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1]),
      support: [...field.querySelectorAll('.support-card-wrap')].map(node => node.querySelector('.card-face').classList.contains('is-rested')),
      battle: [...field.querySelectorAll('.combat-card-wrap')].map(node => { const image = node.querySelector('.card-face:not(.hp-card) img'); return { id: node.getAttribute('data-card-instance-id'), name: image?.getAttribute('alt') ?? null, artUrl: image?.getAttribute('src') ?? null, rested: node.querySelector('.card-face').classList.contains('is-rested'), hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]) } }) }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, summary: e.summary, steps: e.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]'), null, { timeout: 20000 })
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const rows = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const row = { number: 'BS12-040', scenario, viewport, scope: 'candidate-printed-040-cost-skill-ordinary', status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', e => row.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()) })
    page.on('requestfailed', r => row.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = suffix => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${suffix}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route=>route.fulfill({contentType:'image/webp',body:readFileSync(resolve(root,`test-results/bs12-official-art/${card.cardNumber}.webp`))}))
      const attack = scenario.startsWith('attack') || scenario === 'cancel-attack'
      const fixture = ['skill-zero', 'cancel-cost', 'cancel-target', 'deselect-cost', 'back-cost', 'target-upper-bound'].includes(scenario) ? 'positive' : scenario === 'cancel-attack' ? 'attack' : scenario
      row.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'positive' ? 'card:BS12-040' : process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'item-support-only' ? 'card-negative:BS12-040' : `bs12-040:${fixture}`
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${row.testState}&contract-card=BS12-040,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-028,BS12-029,BS12-030,BS12-031,BS12-046`)
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      row.before = await state(page)
      row.beforeTrace = await trace(page)
      const wrap = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-040-source"]')
      const source = wrap.locator('button.card-face:not(.hp-card)')
      const opponent = page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-040-opponent"]')
      const opponentImage = opponent.locator('button.card-face:not(.hp-card) img').first()
      assert.deepEqual(row.before.top.battle.map(card => ({ name: card.name, hp: card.hp })), [
        { name: 'Sugar Swan Cookie', hp: 6 }, { name: 'Candy Diver Cookie', hp: 3 },
      ])
      await opponentImage.evaluate(img => img.decode())
      assert.equal(await opponentImage.getAttribute('alt'), 'Sugar Swan Cookie')
      assert.equal(await opponentImage.getAttribute('src'), cards.find(card => card.cardNumber === 'BS6-008').imageUrl)
      if (scenario === 'deploy') {
        const hand = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator('img[alt="Baguette Cookie"]') })
        await hand.locator('button.card-face').click()
        await hand.getByRole('button', { name: '登場', exact: true }).click()
        await source.waitFor()
        await settle(page)
        const after = await state(page)
        assert.deepEqual(after.bottom.battle.map(c => c.hp), [2, 3])
        assert.equal(after.bottom.deck, 9)
        assert.equal(after.bottom.hand, 0)
        assert.deepEqual(after.bottom.support, row.before.bottom.support)
        assert.deepEqual(after.top, row.before.top)
        assert.deepEqual((await trace(page)).map(e => e.commandKind), ['deploy-cookie'])
      } else if (attack) {
        if (!['attack', 'cancel-attack'].includes(scenario)) {
          assert.equal(await source.locator(':scope.is-attackable').count(), 0)
          await source.click()
          assert.equal(await page.getByRole('button', { name: '取消攻擊', exact: true }).count(), 0)
          assert.deepEqual(await state(page), row.before)
          assert.deepEqual(await trace(page), row.beforeTrace)
        } else {
          await source.click()
          for (let i = 0; i < 3; i++) await page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="bs12-040-payment-${i}"] button.card-face`).click({ position: { x: 10, y: 25 } })
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
            assert.deepEqual(after.bottom.support, [true, true, true, false])
            assert.equal(after.bottom.battle[0].rested, true)
            assert.equal(after.bottom.battle[0].hp, 3)
            assert.deepEqual((await trace(page)).map(e => e.commandKind), ['declare-attack', 'resolve-battle'])
          }
        }
      } else {
        const skill = wrap.getByRole('button', { name: '啟動技能', exact: true })
        if (['item-support-only', 'no-support', 'opponent-turn', 'outside-main', 'used'].includes(scenario)) {
          if (await skill.count()) assert.equal(await skill.isEnabled(), false)
          assert.deepEqual(await state(page), row.before)
          assert.deepEqual(await trace(page), row.beforeTrace)
        } else {
          await skill.click()
          const panel = page.getByRole('alertdialog')
          await panel.waitFor()
          const next = panel.getByRole('button', { name: '下一步', exact: true })
          assert.equal(await next.isEnabled(), false)
          assert.equal(await panel.getByRole('button', { name: /^Sweet Jams Guitar Sweet Jams Guitar/ }).count(), 0)
          const costName = ['non-arena-cost', 'non-arena-hand'].includes(scenario) ? 'Candy Diver Cookie' : 'Greenbell Cookie'
          const cost = panel.getByRole('button', { name: new RegExp(`^${costName} ${costName}`) }).first()
          await cost.click()
          if (scenario === 'deselect-cost') { await cost.click(); assert.equal(await next.isEnabled(), false); await cost.click() }
          if (scenario === 'cancel-cost') {
            await panel.getByRole('button', { name: '取消技能', exact: true }).click()
            assert.deepEqual(await state(page), row.before)
            assert.deepEqual(await trace(page), row.beforeTrace)
          } else {
            await next.click()
            const targetName = scenario === 'item-hand' ? 'Sweet Jams Guitar' : scenario === 'stage-hand' ? 'Crown Stage' : scenario === 'yellow-hand' ? 'GingerBrave' : scenario === 'returned-arena' ? 'Greenbell Cookie' : 'Peach Cookie'
            assert.equal(await panel.getByRole('button', { name: /^Candy Diver Cookie Candy Diver Cookie/ }).count(), 0)
            if (scenario === 'returned-arena') assert.equal(await panel.getByRole('button', { name: /^Greenbell Cookie Greenbell Cookie/ }).count(), 1)
            if (scenario === 'back-cost') {
              await panel.getByRole('button', { name: /^Greenbell Cookie Greenbell Cookie/ }).click()
              await panel.getByRole('button', { name: '上一步', exact: true }).click()
              await cost.click()
              await panel.getByRole('button', { name: /^Candy Diver Cookie Candy Diver Cookie/ }).click()
              await next.click()
              assert.equal(await panel.getByRole('button', { name: /^Greenbell Cookie Greenbell Cookie/ }).count(), 0)
              assert.match(await panel.innerText(), /已選 0／1/)
            }
            if (!['skill-zero', 'non-arena-hand'].includes(scenario)) await panel.getByRole('button', { name: new RegExp(`^${targetName} ${targetName}`) }).click()
            if (scenario === 'target-upper-bound') {
              await panel.getByRole('button', { name: /^Greenbell Cookie Greenbell Cookie/ }).click()
              assert.equal(await panel.locator('button[aria-pressed="true"]').count(), 1)
            }
            assert.deepEqual(await state(page), row.before)
            await shot('selection')
            if (scenario === 'cancel-target') {
              await panel.getByRole('button', { name: '取消技能', exact: true }).click()
              assert.deepEqual(await state(page), row.before)
              assert.deepEqual(await trace(page), row.beforeTrace)
            } else {
              await panel.getByRole('button', { name: '確認發動', exact: true }).click()
              await page.waitForFunction(() => !document.querySelector('.effect-panel:not(.is-complete)'))
              await settle(page)
              const after = await state(page)
              const zero = ['skill-zero', 'non-arena-hand'].includes(scenario)
              const paidIndex = scenario === 'back-cost' ? 2 : 0
              assert.deepEqual(after.bottom.support, [...row.before.bottom.support.filter((_, i) => i !== paidIndex), ...(zero ? [] : [true])])
              assert.equal(after.bottom.hand, row.before.bottom.hand + 1 - (zero ? 0 : 1))
              assert.deepEqual(after.bottom.battle, row.before.bottom.battle)
              assert.equal(after.bottom.deck, 12)
              assert.equal(after.bottom.trash, 0)
              assert.equal(after.bottom.breakLevel, 0)
              assert.deepEqual(after.top, row.before.top)
              if (!zero) {
                const placed = page.locator('.bottom-field .support-card-wrap').last().locator('img')
                assert.equal(await placed.getAttribute('alt'), targetName)
                await placed.evaluate(img => img.decode())
              }
              assert.equal(await skill.isEnabled(), false)
              assert.deepEqual((await trace(page)).map(e => e.commandKind), ['begin-activate-skill', 'resolve-ability-effect'])
            }
          }
        }
      }
      await source.locator('img').evaluate(img => img.decode())
      assert.equal(await source.locator('img').getAttribute('src'), cards.find(c => c.cardNumber === 'BS12-040').imageUrl)
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
      console.log(`PASS BS12-040 ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) { row.error = String(error.stack ?? error); row.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { rows.push(row); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(rows, null, 2)); await page.close() }
  }
  console.log(`BS12-040 printed Browser ${rows.length}/${rows.length}`)
} finally { await browser.close() }
