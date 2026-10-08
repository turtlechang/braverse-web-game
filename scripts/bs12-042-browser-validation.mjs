import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-042-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...formal].filter(card=>existsSync(resolve(root,`test-results/bs12-official-art/${card.cardNumber}.webp`)))
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'),
      hand: field?.querySelectorAll('.hand-card').length ?? 0,
      stage: field?.querySelector('.stage-zone img')?.getAttribute('src') ?? null,
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'),
        name: node.querySelector('.card-face:not(.hp-card) img')?.getAttribute('alt') ?? null,
        artUrl: node.querySelector('.card-face:not(.hp-card) img')?.getAttribute('src') ?? null,
        attack: Number(node.querySelector('.badge-atk')?.textContent ?? NaN),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
        rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
        equipped: node.querySelector('.badge-equip')?.getAttribute('aria-label') ?? null })),
      break: [...(field?.querySelectorAll('.break-cards .break-card-wrap img') ?? [])].map(image => ({ name: image.alt, artUrl: image.getAttribute('src') })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'),
        rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({ commandKind: entry.commandKind, summary: entry.summary, steps: entry.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') &&
  ![...document.querySelectorAll('button')].some(button => button.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
const cases = ['deploy', 'red-arena', 'refresh', 'positive', 'other', 'zero', 'skip', 'deselect', 'retarget', 'cancel-draft', 'green-arena', 'non-arena', 'no-arena', 'no-hand', 'item-hand', 'last-hp', 'last-hp-other', 'follow-up', 'rested-target', 'equipment', 'attack', 'wrong-energy', 'few-energy', 'rested-energy', 'opponent-turn', 'source-rested', 'cancel-target', 'hand-deselect']
const routeCase = scenario => ['other', 'zero', 'skip', 'deselect', 'retarget', 'cancel-draft', 'hand-deselect'].includes(scenario) ? 'positive' : scenario === 'last-hp-other' ? 'last-hp' : scenario === 'cancel-target' ? 'attack' : scenario === 'follow-up' ? 'follow-up-live' : scenario
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({ viewport })
    const result = { number: 'BS12-042', scenario, viewport, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      result.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && routeCase(scenario) === 'positive' ? 'card:BS12-042' : process.env.BS12_BROWSER_ROUTE === 'generic' && routeCase(scenario) === 'no-arena' ? 'card-negative:BS12-042' : `bs12-042:${routeCase(scenario)}`
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${result.testState}&contract-card=BS12-042,BS12-003,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-019,BS12-021,BS12-028,BS12-029,BS12-030,BS12-031,BS12-046`)
      await page.locator('.game-shell').waitFor()
      await settle(page)
      result.before = await state(page)
      result.beforeTrace = await trace(page)
      assert.ok(result.before.bottom.battle.length <= 2 && result.before.top.battle.length <= 2)
      if (scenario === 'follow-up') {
        result.preAttack = result.before
        const mango = cards.find(card => card.cardNumber === 'BS12-021')
        const muscle = cards.find(card => card.cardNumber === 'BS12-019')
        const attackerWrap = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-042-attacker"]')
        await attackerWrap.waitFor()
        const attackerArt = attackerWrap.locator('img[alt="Muscle Cookie"]').first()
        await attackerArt.evaluate(image => image.decode())
        assert.equal(await attackerArt.getAttribute('src'), muscle.imageUrl)
        assert.deepEqual({ name: result.preAttack.bottom.battle[0].name, artUrl: result.preAttack.bottom.battle[0].artUrl,
          hp: result.preAttack.bottom.battle[0].hp, attack: result.preAttack.bottom.battle[0].attack },
        { name: muscle.name, artUrl: muscle.imageUrl, hp: muscle.hp, attack: 4 })
        assert.deepEqual(result.preAttack.bottom.battle.map(card => card.hp), [4])
        assert.equal(result.preAttack.bottom.support.length, 3)
        await attackerWrap.locator('.card-face.is-attackable').click()
        for (let i = 0; i < 3; i++) {
          await page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="bs12-042-attack-payment-${i}"] .card-face`).click()
        }
        const target = page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-042-bearer"] .card-face:not(.hp-card)')
        assert.match(await target.getAttribute('aria-label'), /^選擇攻擊目標：Mango Cookie$/)
        await target.click()
        await page.locator('.flip-response-modal').waitFor({ timeout: 30000 })
        await settle(page)
        result.before = await state(page)
        result.beforeTrace = await trace(page)
        const bearer = result.before.bottom.battle.find(card => card.id === 'bs12-042-bearer')
        const attacker = result.before.top.battle.find(card => card.id === 'bs12-042-attacker')
        assert.deepEqual({ name: bearer.name, artUrl: bearer.artUrl, hp: bearer.hp }, { name: mango.name, artUrl: mango.imageUrl, hp: 1 })
        assert.equal(mango.hp, 2)
        assert.deepEqual({ name: attacker.name, artUrl: attacker.artUrl, hp: attacker.hp, attack: attacker.attack }, { name: muscle.name, artUrl: muscle.imageUrl, hp: muscle.hp, attack: 4 })
        assert.equal(result.beforeTrace.some(entry => entry.commandKind === 'declare-attack'), true)
        assert.equal(await page.locator('.trap-response-modal').count(), 0)
        assert.equal(result.beforeTrace.filter(entry => entry.commandKind === 'resolve-next-damage').length, 1)
      }
      if (scenario === 'red-arena') {
        const peach = cards.find(card => card.cardNumber === 'BS12-003')
        const companion = result.before.bottom.battle.find(card => card.id === 'bs12-042-companion')
        assert.equal(peach.hp, 2)
        assert.deepEqual({ name: companion.name, artUrl: companion.artUrl, hp: companion.hp }, { name: peach.name, artUrl: peach.imageUrl, hp: peach.hp })
      }
      const attack = ['attack', 'wrong-energy', 'few-energy', 'rested-energy', 'opponent-turn', 'source-rested', 'cancel-target'].includes(scenario)
      if (scenario === 'deploy') {
        const hand = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator('img[alt="Chamomile Cookie"]') })
        await hand.locator('button.card-face').click()
        await hand.getByRole('button', { name: '登場', exact: true }).click()
        const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-042-source"]')
        await source.waitFor()
        await settle(page)
        await source.locator('img[alt="Chamomile Cookie"]').evaluate(image => image.decode())
        assert.equal(await source.locator('img[alt="Chamomile Cookie"]').getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-042').imageUrl)
        const after = await state(page)
        assert.deepEqual(after.bottom.battle.map(c => c.hp), [2, 1])
        assert.equal(after.bottom.deck, 11)
        assert.equal(after.bottom.hand, 0)
        assert.deepEqual(after.bottom.support, result.before.bottom.support)
        assert.deepEqual(after.top, result.before.top)
        assert.deepEqual((await trace(page)).map(t => t.commandKind), ['deploy-cookie'])
        assert.equal(await source.locator('.skill-action').count(), 0)
      } else if (attack) {
        const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-042-source"]')
        const art = source.locator('img[alt="Chamomile Cookie"]').first()
        await art.evaluate(image => image.decode())
        assert.equal(await art.getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-042').imageUrl)
        assert.equal(await source.locator('.skill-action').count(), 0)
        if (!['attack', 'cancel-target'].includes(scenario)) {
          assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
          assert.deepEqual(await state(page), result.before)
          assert.deepEqual(await trace(page), result.beforeTrace)
        } else {
          await source.locator('.card-face.is-attackable').click()
          await page.locator('.bottom-field .support-card-wrap[data-card-instance-id="bs12-042-payment-0"] .card-face').click()
          await shot('payment')
          if (scenario === 'cancel-target') {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await state(page), result.before)
            assert.deepEqual(await trace(page), result.beforeTrace)
          } else {
            await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-019-opponent"] .card-face[aria-label^="選擇攻擊目標："]').click()
            await page.waitForFunction(() => /HP 卡 5 張/.test(document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="bs12-019-opponent"] .hp-card-stack')?.getAttribute('aria-label') ?? ''))
            await settle(page)
            const after = await state(page)
            assert.deepEqual(after.top.battle.map(c => c.hp), [5, 4])
            assert.equal(after.top.trash, 1)
            assert.equal(after.bottom.battle[0].hp, 1)
            assert.equal(after.bottom.battle[0].rested, true)
            assert.deepEqual(after.bottom.support, result.before.bottom.support.map(s => ({ ...s, rested: true })))
            assert.equal(after.bottom.deck, 12)
            assert.equal(after.bottom.trash, 0)
            assert.equal((await trace(page)).filter(t => t.commandKind === 'declare-attack').length, 1)
            assert.equal((await trace(page)).some(t => t.commandKind === 'resolve-attack-effect'), false)
          }
        }
      } else {
        const dialog = page.locator('.flip-response-modal')
        await dialog.waitFor()
        const art = dialog.locator('img[alt="Chamomile Cookie"]').first()
        await art.evaluate(image => image.decode())
        assert.equal(await art.getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-042').imageUrl)
        assert.match(await dialog.innerText(), /Arena/)
        const box = await dialog.boundingBox()
        assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1)
        const targets = dialog.locator('.flip-choice-options[aria-label="FLIP 效果目標"] > button')
        const names = (await targets.locator(':scope > span').allTextContents()).map(s => s.trim())
        assert.deepEqual(names, scenario === 'follow-up' ? ['Mango Cookie'] : scenario === 'no-arena' ? [] : ['non-arena', 'equipment'].includes(scenario) ? ['Mango Cookie']
          : ['Mango Cookie', scenario === 'red-arena' ? 'Peach Cookie' : scenario === 'green-arena' ? cards.find(c => c.cardNumber === 'BS7-061').name : 'Muscle Cookie'])
        const pay = dialog.locator('.modal-card-options > button')
        const activate = dialog.getByRole('button', { name: '發動 FLIP', exact: true })
        assert.equal(await activate.isEnabled(), false)
        const declined = ['no-hand', 'skip', 'cancel-draft'].includes(scenario)
        const zero = ['zero', 'no-arena'].includes(scenario)
        const other = ['other', 'red-arena', 'green-arena', 'last-hp-other', 'retarget'].includes(scenario)
        if (scenario === 'no-hand' || scenario === 'skip') {
          assert.equal(await pay.count(), scenario === 'no-hand' ? 0 : 1)
          await dialog.getByRole('button', { name: '不發動', exact: true }).click()
        } else {
          if (!zero) await targets.nth(other && scenario !== 'retarget' ? 1 : 0).click()
          if (scenario === 'retarget') {
            await targets.nth(1).click()
            assert.deepEqual(await targets.evaluateAll(buttons => buttons.map(b => b.getAttribute('aria-pressed'))), ['true', 'false'])
            await targets.nth(0).click()
            await targets.nth(1).click()
          }
          await pay.click()
          if (scenario === 'deselect') {
            await targets.nth(0).click()
            assert.deepEqual(await targets.evaluateAll(buttons => buttons.map(b => b.getAttribute('aria-pressed'))), ['false', 'false'])
            assert.deepEqual(await state(page), result.before)
            await targets.nth(0).click()
          }
          if (scenario === 'hand-deselect') {
            await pay.click()
            assert.equal(await activate.isEnabled(), false)
            assert.deepEqual(await state(page), result.before)
            await pay.click()
          }
          assert.equal(await activate.isEnabled(), true)
          await shot('selection')
          await (scenario === 'cancel-draft' ? dialog.getByRole('button', { name: '不發動', exact: true }) : activate).click()
        }
        await dialog.waitFor({ state: 'hidden' })
        if (scenario === 'refresh') {
          const refresh = page.getByRole('alertdialog')
          await refresh.waitFor()
          await refresh.getByRole('button', { name: /^Candy Diver Cookie Candy Diver Cookie/ }).click()
          await refresh.waitFor({ state: 'hidden' })
        }
        await settle(page)
        result.flipAfter = await state(page)
        const after = result.flipAfter
        if (scenario === 'follow-up') {
          const mango = cards.find(card => card.cardNumber === 'BS12-021')
          const muscle = cards.find(card => card.cardNumber === 'BS12-019')
          assert.equal(after.bottom.battle.find(card => card.id === 'bs12-042-bearer'), undefined)
          assert.ok(after.bottom.break.some(card => card.artUrl === cards.find(print => print.cardNumber === 'BS12-021').imageUrl))
          await page.getByRole('button', { name: '不補餅乾', exact: true }).click()
          await settle(page)
          await page.locator('.result-backdrop').waitFor()
          assert.match(await page.locator('.result-backdrop').innerText(), /AI 對手勝利/)
          result.afterReplacement = await state(page)
          assert.equal(result.afterReplacement.bottom.battle.some(card => card.id === 'bs12-042-bearer'), false)
          assert.ok(result.afterReplacement.top.break.some(card => card.name === mango.name && card.artUrl === mango.imageUrl))
          assert.deepEqual(result.afterReplacement.bottom.battle.map(card => ({ id: card.id, name: card.name, hp: card.hp })),
            [{ id: 'bs12-042-attacker', name: muscle.name, hp: muscle.hp }])
        }
        const count = declined || zero ? 0 : 1
        const bearerGain = !declined && !zero && !other
        const otherGain = !declined && !zero && other
        assert.equal(after.bottom.battle.find(c => c.id === 'bs12-042-bearer')?.hp, scenario === 'last-hp-other' || scenario === 'follow-up' ? undefined : scenario === 'last-hp' ? 1 : bearerGain ? 2 : 1)
        assert.equal(after.bottom.battle.find(c => c.id === 'bs12-042-companion')?.hp, scenario === 'follow-up' ? undefined : otherGain ? scenario === 'red-arena' ? 3 : 4 : scenario === 'red-arena' ? 2 : 3)
        assert.equal(after.bottom.deck, scenario === 'refresh' ? 7 : 12 - count)
        assert.equal(after.bottom.hand, scenario === 'no-hand' || !declined ? 0 : 1)
        assert.equal(after.bottom.trash, scenario === 'refresh' ? 0 : scenario === 'follow-up' ? 4 : declined ? 1 : 2)
        assert.deepEqual(after.bottom.support, result.before.bottom.support)
        assert.deepEqual(after.top, result.before.top)
        const flipTrace = (await trace(page)).filter(t => t.commandKind === 'resolve-flip')
        assert.equal(flipTrace.length, 1)
        assert.match(flipTrace[0].steps.join(' '), declined ? /不發動|略過/ : count === 0 ? /未增加|沒有/ : /增加 1 點 HP/)
        if (!declined) assert.match(flipTrace[0].steps.join(' '), /FLIP 代價：棄置手牌/)
        if (scenario === 'last-hp-other') {
          await page.getByRole('button', { name: '不補餅乾', exact: true }).click()
          await settle(page)
          assert.deepEqual(await state(page), after)
        }
        if (scenario === 'follow-up' && await page.locator('.result-backdrop').count()) {
          await page.getByRole('button', { name: '查看對戰紀錄', exact: true }).click()
          const reviewLog = page.locator('.battle-log-review-modal')
          await reviewLog.waitFor()
          await reviewLog.getByRole('button', { name: '全部展開', exact: true }).click()
          result.publicTraceText = await reviewLog.innerText()
          assert.match(result.publicTraceText, /AI 對手勝利/)
          assert.match(result.publicTraceText, /Muscle Cookie/)
          assert.match(result.publicTraceText, /Mango Cookie/)
          assert.match(result.publicTraceText, /Chamomile Cookie/)
          assert.match(result.publicTraceText, /選擇不發動陷阱/)
          assert.equal([...result.publicTraceText.matchAll(/玩家 翻開了 HP 卡「Clumsy Day」/g)].length, 2)
          assert.match(result.publicTraceText, /選擇不補位/)
          await shot('public-trace')
          await reviewLog.getByRole('button', { name: '關閉對戰紀錄回顧', exact: true }).click()
        } else {
          await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
          await shot('public-trace')
          await page.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
        }
      }
      result.after = await state(page)
      result.trace = await trace(page)
      if (scenario === 'follow-up') {
        assert.equal(result.trace.some(entry => entry.commandKind === 'declare-attack'), true)
        assert.equal(result.trace.filter(entry => entry.commandKind === 'resolve-next-damage').length, 3)
      }
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
      result.dom = await page.locator('body').innerText().catch(() => '')
      results.push(result)
      writeFileSync(resolve(out, 'results.json'), JSON.stringify(results, null, 2))
      throw error
    } finally { await page.close() }
    results.push(result)
    writeFileSync(resolve(out, 'results.json'), JSON.stringify(results, null, 2))
    console.log(`PASS BS12-042 ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-042 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
