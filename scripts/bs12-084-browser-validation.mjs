import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-084-browser')
mkdirSync(out, { recursive: true })
const candidate=JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal=readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards=[...candidate,...formal].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'), hand: field?.querySelectorAll('.hand-card').length ?? 0,
      stage: field?.querySelector('.stage-zone img')?.getAttribute('src') ?? null, stageRested: field?.querySelector('.stage-zone .card-face')?.classList.contains('is-rested') ?? false,
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'), hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN), rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'), rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({ commandKind: entry.commandKind, summary: entry.summary, steps: entry.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') && ![...document.querySelectorAll('button')].some(button => button.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
const activationBlocked = ['one-blocker', 'no-blocker', 'wrong-energy', 'rested-energy', 'no-energy', 'rested-source', 'opponent-turn', 'outside-main']
const placementBlocked = ['placement-wrong-energy', 'placement-rested-energy', 'placement-no-energy']
const cases = ['positive', 'five', 'seven', 'three-blockers', ...activationBlocked, 'place', 'replace', 'one-energy', ...placementBlocked, 'receiver', 'reverse', 'deselect-cost', 'cost-limit', 'cancel-energy', 'cancel-cost', 'back', 'minimize', 'deselect-energy', 'receiver-deselect', 'receiver-limit', 'receiver-item', 'receiver-stage', 'cancel-placement', 'deselect-placement', 'details']
const route = scenario => scenario.startsWith('receiver') ? 'receiver' : ['cost-limit'].includes(scenario) ? 'three-blockers' : ['cancel-placement', 'deselect-placement'].includes(scenario) ? 'place' : ['reverse', 'deselect-cost', 'cancel-energy', 'cancel-cost', 'back', 'minimize', 'deselect-energy', 'details'].includes(scenario) ? 'positive' : scenario
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({ viewport })
    const result = { number: 'BS12-084', scenario, viewport, printedSourceAttested: true, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, request => request.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      result.testState=process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='positive'?'card:'+'BS12-084':process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='no-blocker'?'card-negative:'+'BS12-084':'bs12-084:'+route(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state='+result.testState+'&contract-card='+cards.map(card=>card.cardNumber).join(','))
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      result.before = await state(page)
      result.setupTrace = await trace(page)
      const dialog = () => page.getByRole('alertdialog')
      let expectedOrder = ['bs12-084-blocker', 'bs12-084-red-blocker']
      if (scenario.startsWith('receiver')) {
        assert.deepEqual(result.setupTrace.map(entry => entry.commandKind), ['begin-activate-stage'])
        await dialog().filter({ hasText: 'Summer Soda Festival 要求你棄置手牌' }).waitFor()
        assert.equal(await dialog().getByRole('button', { name: /^確認棄置/ }).isEnabled(), false)
        const choices = dialog().locator('.modal-card-options button')
        assert.equal(await choices.count(), 6)
        const index = scenario === 'receiver-item' ? 1 : scenario === 'receiver-stage' ? 2 : 0
        await choices.nth(index).click()
        if (scenario === 'receiver-deselect') { await choices.nth(index).click(); assert.equal(await dialog().getByRole('button', { name: /^確認棄置/ }).isEnabled(), false); await choices.nth(index).click() }
        if (scenario === 'receiver-limit') {
          await choices.nth(1).click()
          assert.equal(await dialog().locator('.modal-card-options button.is-selected').count(), 1)
          assert.equal(await choices.nth(1).evaluate(button => button.classList.contains('is-selected')), false)
          assert.equal(await dialog().getByRole('button', { name: '確認棄置 (1)', exact: true }).isEnabled(), true)
        }
        await shot('receiver-selection')
        await dialog().getByRole('button', { name: /^確認棄置/ }).click()
        await settle(page)
        const after = await state(page)
        assert.equal(after.bottom.hand, 5)
        assert.equal(after.bottom.trash, result.before.bottom.trash + 1)
        assert.deepEqual(after.top, result.before.top)
        assert.deepEqual(after.bottom.battle, result.before.bottom.battle)
        assert.deepEqual((await trace(page)).map(entry => entry.commandKind), ['begin-activate-stage', 'resolve-opponent-hand-discard'])
      } else if (scenario === 'details') {
        await page.getByRole('button', { name: '玩家場景區', exact: true }).click()
        await page.getByRole('button', { name: '查看卡牌詳情', exact: true }).click()
        const detail = page.getByRole('dialog', { name: 'Summer Soda Festival 卡牌詳情', exact: true })
        assert.match(await detail.innerText(), /Place 2 Cookies.*Blocker.*bottom of your deck.*6 cards/s)
        assert.equal(await detail.locator('img[alt="Summer Soda Festival"]').getAttribute('src'), cards.find(card=>card.cardNumber==='BS12-084').imageUrl)
        await detail.getByRole('button', { name: '關閉', exact: true }).click()
        assert.deepEqual(await state(page), result.before)
      } else if (placementBlocked.includes(scenario)) {
        await page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-084-stage"] .card-face').click()
        assert.equal(await page.getByRole('button', { name: '放置', exact: true }).count(), 0)
        assert.deepEqual(await state(page), result.before)
        assert.deepEqual(await trace(page), [])
      } else {
        let placed = result.before
        const placement = ['place', 'replace', 'one-energy', 'cancel-placement', 'deselect-placement'].includes(scenario)
        if (placement) {
          await page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-084-stage"] .card-face').click()
          await page.getByRole('button', { name: '放置', exact: true }).click()
          const pay = dialog().getByRole('button', { name: '支付並放置', exact: true })
          assert.equal(await pay.isEnabled(), false)
          await dialog().locator('.modal-card-options button').first().click()
          if (scenario === 'deselect-placement') { await dialog().locator('.modal-card-options button').first().click(); assert.equal(await pay.isEnabled(), false); await dialog().locator('.modal-card-options button').first().click() }
          if (scenario === 'cancel-placement') {
            await dialog().getByRole('button', { name: '取消', exact: true }).click()
            assert.deepEqual(await state(page), result.before)
            assert.deepEqual(await trace(page), [])
          } else {
            await pay.click()
            await settle(page)
            placed = await state(page)
            assert.equal(placed.bottom.stageRested, false)
            assert.equal(placed.bottom.hand, result.before.bottom.hand - 1)
            assert.equal(placed.bottom.trash, result.before.bottom.trash + (scenario === 'replace' ? 1 : 0))
            assert.equal(placed.bottom.deck, 12)
            assert.equal(placed.bottom.support[0].rested, true)
          }
        }
        if (scenario !== 'cancel-placement') {
          const activate = page.getByRole('button', { name: '啟動', exact: true })
          if (activationBlocked.includes(scenario) || scenario === 'one-energy') {
            assert.ok(await activate.count() === 0 || !await activate.isEnabled())
            assert.deepEqual(await state(page), placed)
            assert.deepEqual((await trace(page)).map(entry => entry.commandKind), scenario === 'one-energy' ? ['play-stage'] : [])
          } else {
            await activate.click()
            assert.equal(await dialog().getByRole('button', { name: '下一步', exact: true }).isEnabled(), false)
            await dialog().locator('.effect-candidates-payment button').click()
            if (scenario === 'deselect-energy') { await dialog().locator('.effect-candidates-payment button').click(); assert.equal(await dialog().getByRole('button', { name: '下一步', exact: true }).isEnabled(), false); await dialog().locator('.effect-candidates-payment button').click() }
            if (scenario === 'cancel-energy') {
              await dialog().getByRole('button', { name: '取消技能', exact: true }).click()
              assert.deepEqual(await state(page), placed)
              assert.deepEqual(await trace(page), [])
            } else {
              await dialog().getByRole('button', { name: '下一步', exact: true }).click()
              if (scenario === 'back') {
                await dialog().getByRole('button', { name: '上一步', exact: true }).click()
                // Selected energy is visibly previewed as rested until deselected;
                // the authoritative cost is still unpaid (no command trace).
                await dialog().locator('.effect-candidates-payment button').click()
                assert.deepEqual(await state(page), placed)
                assert.deepEqual(await trace(page), [])
                await dialog().locator('.effect-candidates-payment button').click()
                await dialog().getByRole('button', { name: '下一步', exact: true }).click()
              }
              const candidates = dialog().locator('.effect-candidates-trash-deck-bottom button')
              assert.equal(await candidates.count(), ['three-blockers', 'cost-limit'].includes(scenario) ? 3 : 2)
              assert.match(await dialog().innerText(), /具有 Blocker 的餅乾/)
              assert.equal(await dialog().getByRole('button', { name: '確認發動', exact: true }).isEnabled(), false)
              const order = scenario === 'reverse' ? [1, 0] : [0, 1]
              await candidates.nth(order[0]).click()
              assert.equal(await dialog().getByRole('button', { name: '確認發動', exact: true }).isEnabled(), false)
              await candidates.nth(order[1]).click()
              if (scenario === 'reverse') expectedOrder.reverse()
              if (scenario === 'deselect-cost') { await candidates.nth(0).click(); assert.equal(await dialog().getByRole('button', { name: '確認發動', exact: true }).isEnabled(), false); await candidates.nth(0).click(); expectedOrder.reverse() }
              if (['three-blockers', 'cost-limit'].includes(scenario)) { await candidates.nth(2).click(); assert.match(await dialog().innerText(), /已選 2／2/); assert.equal(await candidates.nth(2).getAttribute('aria-pressed'), 'false') }
              assert.match(await candidates.nth(expectedOrder[0].endsWith('red-blocker') ? 1 : 0).innerText(), /第 1 順位/)
              assert.match(await candidates.nth(expectedOrder[1].endsWith('red-blocker') ? 1 : 0).innerText(), /第 2 順位/)
              if (scenario === 'minimize') { await dialog().getByRole('button', { name: '縮小', exact: true }).click(); await page.getByRole('button', { name: 'Summer Soda Festival 啟動場景', exact: true }).click(); assert.match(await dialog().innerText(), /已選 2／2/) }
              await shot('cost-selection')
              if (scenario === 'cancel-cost') {
                await dialog().getByRole('button', { name: '取消技能', exact: true }).click()
                assert.deepEqual(await state(page), placed)
                assert.deepEqual(await trace(page), [])
              } else {
                await dialog().getByRole('button', { name: '確認發動', exact: true }).click()
                if (scenario !== 'five') {
                  const reveal = page.getByRole('alertdialog', { name: '對手棄置的卡牌', exact: true })
                  await reveal.waitFor()
                  assert.equal(await reveal.locator('article').count(), 1)
                  await reveal.getByRole('button', { name: '確認並繼續', exact: true }).click()
                }
                await settle(page)
                const after = await state(page)
                assert.equal(after.bottom.deck, 14)
                assert.equal(after.bottom.trash, placed.bottom.trash - 2)
                assert.equal(after.bottom.stageRested, true)
                assert.ok(after.bottom.support.every(support => support.rested))
                assert.equal(after.top.hand, placed.top.hand - (scenario === 'five' ? 0 : 1))
                assert.equal(after.top.trash, placed.top.trash + (scenario === 'five' ? 0 : 1))
                assert.deepEqual(after.bottom.battle, placed.bottom.battle)
                assert.deepEqual(after.top.battle, placed.top.battle)
                assert.equal(after.bottom.hand, placed.bottom.hand)
                assert.ok(await page.getByRole('button', { name: '結束主要階段', exact: true }).isEnabled())
                const log = await trace(page)
                const bottomStep = log.flatMap(entry => entry.steps ?? []).find(step => /棄牌區.*牌庫底/.test(step))
                assert.equal(bottomStep, `場景代價：棄牌區卡片依選取順序放到牌庫底：${expectedOrder.map(id => id.endsWith('red-blocker') ? 'Affogato Cookie' : 'Pudding Cookie').join('、')}`)
                assert.deepEqual(log.map(entry => entry.commandKind), [...(placement ? ['play-stage'] : []), 'begin-activate-stage', ...(scenario === 'five' ? [] : ['resolve-ability-effect', 'resolve-opponent-hand-discard'])])
                if (scenario === 'five') assert.ok(log.some(entry => entry.steps.some(step => /條件不成立，效果未執行/.test(step))))
              }
            }
          }
        }
      }
      result.after = await state(page)
      result.trace = await trace(page)
      result.images = await page.locator('img').evaluateAll(images => images.filter(img => img.getBoundingClientRect().width > 0).map(img => ({ alt: img.alt, loaded: img.complete && img.naturalWidth > 0 })))
      assert.ok(result.images.every(img => img.loaded), JSON.stringify(result.images.filter(img => !img.loaded)))
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
      await shot('final')
      result.status = 'PASS'
      console.log(`PASS ${scenario} ${viewport.width}`)
    } catch (error) {
      result.error = String(error?.stack ?? error)
      result.trace = await trace(page).catch(() => [])
      await shot('failure').catch(() => {})
      console.log(`FAIL ${scenario} ${viewport.width}: ${result.error}`)
      results.push(result)
      writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'), JSON.stringify({ results }, null, 2))
      throw error
    } finally { await page.close() }
    results.push(result)
    writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'), JSON.stringify({ results }, null, 2))
  }
} finally { await browser.close() }
console.log(`BS12-084 Browser ${results.length}/${results.length} passed`)
