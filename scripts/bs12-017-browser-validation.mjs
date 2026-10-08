import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-017-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/candidates/official-festival-arena-bs12.en.json'), 'utf8')).cards
const references = readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json')).flatMap(file => JSON.parse(readFileSync(resolve(root, 'data/cards', file), 'utf8')).cards ?? [])
const cards = [...candidate.filter(card => existsSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`))), ...["BS9-037","BS9-037@1","BS4-095","BS7-061","ST1-001","ST4-001"].map(number => references.find(card => card.cardNumber === number))]
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'),
      hand: field?.querySelectorAll('.hand-card').length ?? 0,
      stage: field?.querySelector('.stage-zone img')?.getAttribute('src') ?? null,
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'),
        attack: Number(node.querySelector('.badge-atk')?.textContent ?? NaN),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
        rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
        equipped: node.querySelector('.badge-equip')?.getAttribute('aria-label') ?? null })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'),
        rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({ commandKind: entry.commandKind, summary: entry.summary, steps: entry.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') &&
  ![...document.querySelectorAll('button')].some(button => button.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
const cases = ['select-cookie', 'select-item', 'zero', 'deselect', 'cancel-cost', 'cancel-target', 'back', 'green-arena', 'active-target', 'source-rested', 'solo', 'non-arena', 'equipment', 'support-only', 'opponent-only', 'no-energy', 'no-hand', 'one-hand', 'opponent-turn', 'attack-original', 'attack-other', 'attack-zero', 'attack-skip', 'attack-deselect', 'attack-reselect', 'faerie-variant', 'no-faerie', 'faerie-support', 'faerie-opponent', 'target-faints', 'wrong-energy', 'few-energy', 'rested-energy', 'cancel-attack', 'faerie-only', 'cost-reselect', 'cost-deselect']
const routeCase = scenario => scenario.startsWith('attack-') ? 'attack' : ['select-cookie', 'select-item', 'zero', 'deselect', 'cancel-cost', 'cancel-target', 'back', 'cancel-attack', 'cost-reselect', 'cost-deselect'].includes(scenario) ? 'positive' : scenario
const panelFor = page => page.locator('.effect-panel:not(.is-complete):visible')
const candidatesFor = panel => panel.locator('.effect-candidates-target .effect-candidate-entry > button')
const costChoice = (panel, cookie) => panel.getByRole('button', { name: cookie ? 'Peach Cookie Peach Cookie 點擊選取' : 'Sweet Jams Guitar Sweet Jams Guitar 點擊選取', exact: true })
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const number of ['BS12-017', 'BS12-017@1']) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({ viewport })
    const result = { number, scenario, viewport, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), error: request.failure()?.errorText, resourceType: request.resourceType() }))
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const fixture = routeCase(scenario)
      const testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'positive' ? `card:${number}`
        : process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'no-hand' ? `card-negative:${number}` : `bs12-017:${number}:${fixture}`
      result.testState = testState
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${testState}&contract-card=BS12-017`)
      await page.locator('.game-shell').waitFor()
      const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-017-source"]')
      await source.locator('img').first().evaluate(image => image.decode())
      assert.equal(await source.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === number).imageUrl)
      await settle(page)
      result.before = await state(page)
      assert.ok(result.before.bottom.battle.length <= 2)
      assert.ok(result.before.top.battle.length <= 2)
      assert.equal(result.before.bottom.battle[0].hp, 2)
      assert.equal(result.before.bottom.battle[0].attack, 2)
      assert.equal(result.before.bottom.hand, scenario === 'no-hand' ? 0 : scenario === 'one-hand' ? 1 : 2)
      assert.equal(result.before.top.battle[0].hp, scenario === 'target-faints' ? 2 : 4)
      assert.equal(result.before.bottom.deck, 12)
      assert.equal(result.before.bottom.trash, 0)
      const attackCase = scenario.startsWith('attack-') || ['select-item', 'faerie-variant', 'no-faerie', 'faerie-support', 'faerie-opponent', 'target-faints'].includes(scenario)
      const skillCase = !scenario.startsWith('attack-') && !['opponent-turn', 'no-hand', 'faerie-variant', 'no-faerie', 'faerie-support', 'faerie-opponent', 'target-faints', 'wrong-energy', 'few-energy', 'rested-energy', 'cancel-attack'].includes(scenario)
      if (scenario === 'opponent-turn') {
        assert.equal(await source.locator('.skill-action').count(), 0)
        assert.deepEqual(await trace(page), [])
      } else if (scenario === 'no-hand') {
        assert.equal(await source.getByRole('button', { name: '啟動技能', exact: true }).isEnabled(), false)
        assert.match(await source.innerText(), /手牌.*不足|不足.*手牌/)
        assert.deepEqual(await trace(page), [])
      } else if (skillCase) {
        await source.getByRole('button', { name: '啟動技能', exact: true }).click()
        const panel = panelFor(page)
        await panel.waitFor()
        assert.match(await panel.innerText(), /已選 0／1 張手牌代價/)
        assert.equal(await panel.getByRole('button', { name: '下一步', exact: true }).isEnabled(), false)
        const cookieCost = ['select-cookie', 'one-hand', 'cost-reselect'].includes(scenario)
        if (scenario === 'cost-reselect') {
          await costChoice(panel, false).click()
          assert.match(await panel.innerText(), /已選 1／1 張手牌代價/)
          assert.equal(await costChoice(panel, true).count(), 0)
          await panel.getByRole('button', { name: /Sweet Jams Guitar.*點擊取消/ }).click()
        }
        await costChoice(panel, cookieCost).click()
        if (scenario === 'cost-deselect') {
          await panel.getByRole('button', { name: /Sweet Jams Guitar.*點擊取消/ }).click()
          assert.equal(await panel.getByRole('button', { name: '下一步', exact: true }).isEnabled(), false)
          await costChoice(panel, false).click()
        }
        assert.match(await panel.innerText(), /已選 1／1 張手牌代價/)
        await page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-cost.png`) })
        if (scenario === 'cancel-cost') await panel.getByRole('button', { name: '取消技能', exact: true }).click()
        else {
          await panel.getByRole('button', { name: '下一步', exact: true }).click()
          assert.match(await panel.innerText(), /另一張【Arena】餅乾.*可選 0 張/s)
          const noCandidates = ['solo', 'non-arena', 'equipment', 'support-only', 'opponent-only', 'faerie-only'].includes(scenario)
          assert.equal(await candidatesFor(panel).count(), noCandidates ? 0 : 1)
          if (!noCandidates) assert.doesNotMatch((await candidatesFor(panel).allTextContents()).join(' '), /Candy Apple Cookie|Apple Faerie Cookie/)
          const zero = noCandidates || ['zero', 'deselect'].includes(scenario)
          if (!noCandidates && scenario !== 'zero') await candidatesFor(panel).first().click()
          if (scenario === 'deselect') await candidatesFor(panel).click()
          if (scenario === 'cancel-target') await panel.getByRole('button', { name: '取消技能', exact: true }).click()
          else {
            if (scenario === 'back') {
              await panel.getByRole('button', { name: '上一步', exact: true }).click()
              assert.deepEqual(await state(page), result.before)
              assert.deepEqual(await trace(page), [])
              await panel.getByRole('button', { name: '下一步', exact: true }).click()
              assert.equal(await candidatesFor(panel).count(), 1)
            }
            await page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-ready.png`) })
            await panel.getByRole('button', { name: '確認發動', exact: true }).click()
            await settle(page)
            result.skillAfter = await state(page)
            assert.equal(result.skillAfter.bottom.hand, result.before.bottom.hand - 1)
            assert.equal(result.skillAfter.bottom.trash, 1)
            assert.equal(result.skillAfter.bottom.battle[0].rested, result.before.bottom.battle[0].rested)
            assert.deepEqual(result.skillAfter.bottom.battle.map(c => c.hp), result.before.bottom.battle.map(c => c.hp))
            assert.deepEqual(result.skillAfter.bottom.support, result.before.bottom.support)
            assert.deepEqual(result.skillAfter.top, result.before.top)
            assert.equal(result.skillAfter.bottom.deck, 12)
            if (!zero) assert.equal(result.skillAfter.bottom.battle[1].rested, false)
            else assert.deepEqual(result.skillAfter.bottom.battle, result.before.bottom.battle)
            assert.equal(await source.getByRole('button', { name: '啟動技能', exact: true }).isEnabled(), false)
            result.skillTrace = await trace(page)
            assert.deepEqual(result.skillTrace.map(entry => entry.commandKind), ['begin-activate-skill', 'resolve-ability-effect'])
            assert.match(result.skillTrace[0].steps.join(' '), cookieCost ? /棄置手牌：Peach Cookie/ : /棄置手牌：Sweet Jams Guitar/)
            assert.match(result.skillTrace[1].steps.join(' '), zero ? /未將任何餅乾設為活躍/ : scenario === 'green-arena' ? /Pancake Cookie 已設為活躍/ : /Langue de Chat Cookie 已設為活躍/)
            await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
            await page.getByRole('button', { name: /Candy Apple Cookie 陷阱／道具／技能/ }).click()
            result.publicSkillText = await page.locator('body').innerText()
            await page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-skill-trace.png`) })
            await page.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
          }
        }
        if (scenario.startsWith('cancel-')) {
          assert.deepEqual(await state(page), result.before)
          assert.deepEqual(await trace(page), [])
          assert.equal(await source.getByRole('button', { name: '啟動技能', exact: true }).isEnabled(), true)
        }
      }
      if (scenario === 'cancel-attack') {
        await source.locator('.card-face.is-attackable').click()
        await page.locator('.bottom-field .support-card-wrap[data-card-instance-id="bs12-017-payment-0"] .card-face').click()
        await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
        assert.deepEqual(await state(page), result.before)
        assert.deepEqual(await trace(page), [])
      }
      if (attackCase) {
        await source.locator('.card-face.is-attackable').click()
        for (const index of [1, 0]) await page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="bs12-017-payment-${index}"] .card-face`).click()
        await page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-payment.png`) })
        await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-017-opponent"] .card-face[aria-label^="選擇攻擊目標："]').click()
        await page.waitForFunction(isFaint => {
          const target = document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="bs12-017-opponent"]')
          return isFaint ? !target : /HP 卡 2 張/.test(target?.querySelector('.hp-card-stack')?.getAttribute('aria-label') ?? '')
        }, scenario === 'target-faints', { timeout: 20000 })
        await settle(page)
        const qualifies = !['select-item', 'no-faerie', 'faerie-support', 'faerie-opponent'].includes(scenario)
        const skip = ['attack-zero', 'attack-skip', 'attack-deselect'].includes(scenario)
        const original = ['attack-original', 'attack-reselect'].includes(scenario)
        const panel = panelFor(page)
        if (qualifies) {
          await panel.waitFor()
          assert.match(await panel.innerText(), /最多 1 張對手餅乾，造成 1 傷害/)
          assert.doesNotMatch(await panel.innerText(), /不能改選|對原受攻擊的同一張/)
          const targetCount = scenario === 'target-faints' ? 1 : 2
          assert.equal(await candidatesFor(panel).count(), targetCount)
          if (!['attack-zero', 'attack-skip'].includes(scenario)) await candidatesFor(panel).nth(original ? 0 : targetCount - 1).click()
          if (scenario === 'attack-deselect') await candidatesFor(panel).last().click()
          if (scenario === 'attack-reselect') {
            await candidatesFor(panel).nth(1).click()
            assert.match(await panel.innerText(), /已選 1／1/)
            assert.equal(await candidatesFor(panel).nth(0).getAttribute('aria-pressed'), 'true')
            assert.equal(await candidatesFor(panel).nth(1).getAttribute('aria-pressed'), 'false')
            await candidatesFor(panel).nth(0).click()
            await candidatesFor(panel).nth(1).click()
            await candidatesFor(panel).nth(1).click()
            await candidatesFor(panel).nth(0).click()
          }
          await page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-then.png`) })
          await panel.getByRole('button', { name: scenario === 'attack-skip' ? '略過' : '確認發動', exact: true }).click()
        }
        await settle(page)
        result.attackAfter = await state(page)
        assert.equal(result.attackAfter.top.battle.find(c => c.id === 'bs12-017-opponent')?.hp, scenario === 'target-faints' ? undefined : qualifies && !skip && original ? 1 : 2)
        assert.equal(result.attackAfter.top.battle.find(c => c.id === 'bs12-017-opponent-other').hp, qualifies && !skip && !original ? 3 : result.before.top.battle[1].hp)
        assert.equal(result.attackAfter.top.trash, qualifies && !skip ? 3 : 2)
        assert.equal(result.attackAfter.bottom.battle[0].hp, 2)
        assert.equal(result.attackAfter.bottom.battle[0].rested, true)
        assert.equal(result.attackAfter.bottom.support.every(s => s.rested), true)
        assert.equal(result.attackAfter.bottom.hand, scenario === 'select-item' ? 1 : 2)
        assert.equal(result.attackAfter.bottom.trash, scenario === 'select-item' ? 1 : 0)
        result.attackTrace = (await trace(page)).filter(entry => ['declare-attack', 'resolve-attack-effect'].includes(entry.commandKind))
        assert.deepEqual(result.attackTrace.map(entry => entry.commandKind), ['declare-attack', 'resolve-attack-effect'])
        assert.match(result.attackTrace[1].steps.join(' '), !qualifies ? /條件不成立，效果未執行/ : skip ? /未選擇目標|略過|未造成傷害/ : /Langue de Chat Cookie.*受到 1 點傷害/)
        await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
        await page.getByRole('button', { name: /Candy Apple Cookie 攻擊 玩家/ }).click()
        result.publicAttackText = await page.locator('body').innerText()
        await page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-attack-trace.png`) })
        await page.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
      }
      if (['wrong-energy', 'few-energy', 'rested-energy', 'no-energy', 'source-rested'].includes(scenario)) assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
      result.after = await state(page)
      if (['opponent-turn', 'no-hand', 'wrong-energy', 'few-energy', 'rested-energy'].includes(scenario)) {
        assert.deepEqual(result.after, result.before)
        assert.deepEqual(await trace(page), [])
      }
      await page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-result.png`) })
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
    console.log(`PASS ${number} ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-017 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
