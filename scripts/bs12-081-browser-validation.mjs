import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-081-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const references = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...references].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'), hand: field?.querySelectorAll('.hand-card').length ?? 0,
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'), hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN), rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'), rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({ commandKind: entry.commandKind, summary: entry.summary, steps: entry.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') && ![...document.querySelectorAll('button')].some(button => button.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
const ordinary = ['deploy', 'attack', 'wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main', 'cancel-payment', 'cancel-target']
const blocked = ['no-hand', 'wrong-color', 'non-arena', 'split-cost', 'original-target']
const cases = ['response', 'item-cost', 'stage-cost', 'trap-cost', 'rested-source', 'second-response', ...blocked, 'skip', 'cancel-draft', 'back', 'back-paid', 'minimize', 'deselect', 'select-second', ...ordinary]
const routeCase = scenario => ['skip', 'cancel-draft', 'back', 'back-paid', 'minimize', 'deselect'].includes(scenario) ? 'response' : scenario === 'select-second' ? 'twice' : ['cancel-payment', 'cancel-target'].includes(scenario) ? 'attack' : scenario
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({ viewport })
    const result = { number: 'BS12-081', scenario, viewport, printedSourceAttested: true, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      result.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'response' ? 'card:BS12-081' : process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'non-arena' ? 'card-negative:BS12-081' : 'bs12-081:'+routeCase(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+result.testState+'&contract-card='+cards.map(card=>card.cardNumber).join(','))
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      if (blocked.includes(scenario)) await page.waitForFunction(original => document.querySelector(`.bottom-field .combat-card-wrap[data-card-instance-id="${original ? 'bs12-081-source' : 'bs12-081-ally'}"] .hp-card-stack`)?.getAttribute('aria-label')?.includes(`HP 卡 ${original ? 1 : 3} 張`), scenario === 'original-target')
      else if (!ordinary.includes(scenario)) await page.getByRole('alertdialog').waitFor()
      await settle(page)
      result.before = await state(page)
      result.beforeTrace = await trace(page)
      assert.ok(result.before.bottom.battle.length <= 2 && result.before.top.battle.length <= 2)
      const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-081-source"]')
      if (scenario === 'deploy') {
        const hand = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator('img[alt="Pudding Cookie"]') })
        await hand.locator('button.card-face').click()
        await hand.getByRole('button', { name: '登場', exact: true }).click()
        await source.waitFor()
        await settle(page)
        const after = await state(page)
        assert.deepEqual(after.bottom.battle.map(c => c.hp), [2, 2])
        assert.equal(after.bottom.deck, 10)
        assert.equal(after.bottom.hand, 0)
        assert.deepEqual(after.top, result.before.top)
        assert.deepEqual(after.bottom.support, result.before.bottom.support)
        assert.deepEqual((await trace(page)).map(entry => entry.commandKind), ['deploy-cookie'])
      } else if (ordinary.includes(scenario)) {
        if (!['attack', 'cancel-payment', 'cancel-target'].includes(scenario)) {
          assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
          assert.deepEqual(await state(page), result.before)
          assert.deepEqual(await trace(page), result.beforeTrace)
        } else {
          await source.locator('.card-face.is-attackable').click()
          if (scenario !== 'cancel-payment') await page.locator('.bottom-field .support-card-wrap[data-card-instance-id="bs12-081-payment"] .card-face').click()
          await shot('payment')
          if (scenario !== 'attack') {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await state(page), result.before)
            assert.deepEqual(await trace(page), result.beforeTrace)
          } else {
            await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-081-attacker"] .card-face[aria-label^="選擇攻擊目標："]').click()
            await page.waitForFunction(() => /HP 卡 3 張/.test(document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="bs12-081-attacker"] .hp-card-stack')?.getAttribute('aria-label') ?? ''))
            await settle(page)
            const after = await state(page)
            assert.deepEqual(after.top.battle.map(c => c.hp), [3, 2])
            assert.equal(after.top.trash, 1)
            assert.equal(after.bottom.battle[0].hp, 2)
            assert.equal(after.bottom.battle[0].rested, true)
            assert.deepEqual(after.bottom.support, result.before.bottom.support.map(s => ({ ...s, rested: true })))
            assert.equal(after.bottom.deck, 12)
            assert.equal(after.bottom.trash, 0)
            assert.equal((await trace(page)).filter(entry => entry.commandKind === 'declare-attack').length, 1)
            assert.equal((await trace(page)).some(entry => entry.commandKind === 'play-blocker' || entry.commandKind === 'resolve-attack-effect'), false)
          }
        }
      } else if (blocked.includes(scenario)) {
        assert.equal(await page.locator('.blocker-response-modal').count(), 0)
        assert.deepEqual(result.before.bottom.battle.map(c => c.hp), scenario === 'original-target' ? [1, 4] : [2, 3])
        assert.equal(result.before.bottom.trash, 1)
        assert.equal(result.before.bottom.hand, scenario === 'no-hand' ? 0 : scenario === 'split-cost' ? 2 : 1)
        assert.equal((await trace(page)).some(entry => entry.commandKind === 'play-blocker'), false)
      } else {
        let dialog = page.getByRole('alertdialog')
        await dialog.getByRole('button', { name: 'Pudding Cookie Pudding Cookie', exact: true }).click()
        dialog = page.locator('.blocker-response-modal')
        await dialog.waitFor()
        assert.equal(await dialog.locator('img[alt="紫色能量"]').count(), 1)
        assert.doesNotMatch(await dialog.innerText(), /\{P\}|REST|每回合一次/)
        const box = await dialog.boundingBox()
        assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1)
        const cost = () => dialog.getByRole('group', { name: 'Blocker 手牌代價' }).getByRole('button')
        const confirm = () => dialog.getByRole('button', { name: '使用 Blocker', exact: true })
        assert.equal(await confirm().isEnabled(), false)
        assert.equal(await cost().count(), scenario === 'select-second' ? 2 : 1)
        const declined = ['skip', 'cancel-draft'].includes(scenario)
        if (scenario !== 'skip') {
          await cost().first().click()
          assert.equal(await confirm().isEnabled(), true)
          assert.deepEqual(await state(page), result.before)
          assert.deepEqual(await trace(page), result.beforeTrace)
        }
        if (scenario === 'deselect') {
          await cost().first().click()
          assert.equal(await confirm().isEnabled(), false)
          assert.deepEqual(await state(page), result.before)
          await cost().first().click()
        } else if (scenario === 'select-second') {
          assert.equal(await cost().nth(1).isEnabled(), false)
          await cost().first().click()
          assert.equal(await cost().nth(1).isEnabled(), true)
          await cost().nth(1).click()
          assert.equal(await cost().first().getAttribute('aria-pressed'), 'false')
          assert.equal(await cost().nth(1).getAttribute('aria-pressed'), 'true')
        } else if (scenario === 'minimize') {
          await dialog.getByRole('button', { name: '縮小', exact: true }).click()
          await page.locator('.card-reveal-dock:visible').click()
          assert.equal(await cost().first().getAttribute('aria-pressed'), 'true')
          assert.deepEqual(await state(page), result.before)
        } else if (scenario === 'back' || scenario === 'back-paid') {
          await dialog.getByRole('button', { name: '返回', exact: true }).click()
          assert.deepEqual(await state(page), result.before)
          assert.deepEqual(await trace(page), result.beforeTrace)
          await page.getByRole('alertdialog').getByRole('button', { name: 'Pudding Cookie Pudding Cookie', exact: true }).click()
          assert.equal(await confirm().isEnabled(), false)
          if (scenario === 'back-paid') await cost().first().click()
        }
        await shot('before-confirm')
        const skipped = declined || scenario === 'back'
        await dialog.getByRole('button', { name: skipped ? '不使用' : '使用 Blocker', exact: true }).click()
        if (scenario === 'second-response') {
          await page.waitForFunction(() => !document.querySelector('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-081-source"]'))
          await page.getByRole('button', { name: '不補餅乾', exact: true }).click()
        } else await page.waitForFunction(skip => /HP 卡 1 張/.test(document.querySelector('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-081-source"] .hp-card-stack')?.getAttribute('aria-label') ?? '') || (skip && /HP 卡 3 張/.test(document.querySelector('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-081-ally"] .hp-card-stack')?.getAttribute('aria-label') ?? '')), skipped)
        await settle(page)
        const after = await state(page)
        assert.deepEqual(after.top, result.before.top)
        assert.equal(after.bottom.deck, 12)
        assert.deepEqual(after.bottom.support, result.before.bottom.support)
        assert.equal(after.bottom.hand, result.before.bottom.hand - (skipped ? 0 : 1))
        assert.equal(after.bottom.trash, result.before.bottom.trash + (skipped ? 1 : 2))
        assert.deepEqual(after.bottom.battle.map(c => c.hp), scenario === 'second-response' ? [4] : skipped ? [2, 3] : [1, 4])
        if (scenario !== 'second-response') assert.equal(after.bottom.battle[0].rested, scenario === 'rested-source')
        const blocks = (await trace(page)).filter(entry => entry.commandKind === 'play-blocker')
        const beforeBlocks = result.beforeTrace.filter(entry => entry.commandKind === 'play-blocker').length
        assert.equal(blocks.length - beforeBlocks, skipped ? 0 : 1)
        if (!skipped) assert.match(blocks.at(-1).steps[0], /Blocker 代價：棄置手牌/)
        if (scenario === 'select-second') assert.equal(await page.locator('.bottom-field .hand-card img[alt="Gnome Band"]').count(), 1)
        await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
        await shot('public-trace')
        await page.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
      }
      if (scenario !== 'second-response') {
        const art = source.locator('img[alt="Pudding Cookie"]').first()
        await art.evaluate(image => image.decode())
        assert.equal(await art.getAttribute('src'), cards.find(card=>card.cardNumber==='BS12-081').imageUrl)
      }
      result.after = await state(page)
      result.trace = await trace(page)
      await shot('result')
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
      result.status = 'PASS'
    } catch (error) {
      result.error = String(error.stack ?? error)
      result.after = await state(page).catch(() => null)
      result.trace = await trace(page).catch(() => [])
      result.dom = await page.locator('body').innerText().catch(() => '')
      results.push(result)
      writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(results, null, 2))
      throw error
    } finally { await page.close() }
    results.push(result)
    writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(results, null, 2))
    console.log(`PASS BS12-081 ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-081 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
