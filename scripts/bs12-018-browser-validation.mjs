import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-018-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-festival-arena-bs12.en.json'), 'utf8')).cards
const references = readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json')).flatMap(file => JSON.parse(readFileSync(resolve(root, 'data/cards', file), 'utf8')).cards ?? [])
const cards = [...candidate.filter(card => existsSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`))), ...["BS4-095","BS7-061","ST1-001","ST4-001","BS6-008"].map(number => references.find(card => card.cardNumber === number))]
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
const rawTrace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({ commandKind: entry.commandKind, summary: entry.summary, steps: entry.steps })))
let setupTraceLength = 0
const trace = async page => (await rawTrace(page)).slice(setupTraceLength)
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') &&
  ![...document.querySelectorAll('button')].some(button => button.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
const cases = ['extra', 'green-hand', 'item-hand', 'break-low', 'no-hand', 'non-arena-hand', 'full-battle', 'close-extra', 'entry-back', 'entry-deselect', 'positive', 'active-target', 'source-rested', 'solo', 'green-arena', 'non-arena', 'equipment', 'support-only', 'opponent-only', 'no-energy', 'opponent-turn', 'skill-zero', 'skill-deselect', 'cancel-skill', 'attack-original', 'attack-other', 'attack-zero', 'attack-skip', 'attack-reselect', 'first-player', 'target-faints', 'wrong-energy', 'few-energy', 'rested-energy', 'cancel-attack']
const routeCase = scenario => ['close-extra', 'entry-back', 'entry-deselect'].includes(scenario) ? 'extra' : scenario.startsWith('attack-') || ['skill-zero', 'skill-deselect', 'cancel-skill', 'cancel-attack'].includes(scenario) ? 'positive' : scenario
const panelFor = page => page.locator('.effect-panel:not(.is-complete):visible')
const candidatesFor = panel => panel.locator('.effect-candidates-target .effect-candidate-entry > button')
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const number of ['BS12-018', 'BS12-018@1']) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({ viewport })
    const result = { number, scenario, viewport, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), error: request.failure()?.errorText, resourceType: request.resourceType() }))
    const shot = label => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const fixture = routeCase(scenario)
      const testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'extra' ? `card:${number}`
        : process.env.BS12_BROWSER_ROUTE === 'generic' && fixture === 'break-low' ? `card-negative:${number}` : `bs12-018:${number}:${fixture}`
      result.testState = testState
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${testState}&contract-card=BS12-018`)
      await page.locator('.game-shell').waitFor()
      await settle(page)
      result.before = await state(page)
      result.combatArt = await page.locator('.combat-card-wrap').evaluateAll(async (nodes, urls) => Promise.all(nodes.map(async node => {
        const image = node.querySelector('img')
        if (!image || !urls.includes(image.src)) throw new Error('Missing original combat art')
        await image.decode()
        if (!image.naturalWidth) throw new Error('Original combat art did not load')
        return { id: node.getAttribute('data-card-instance-id'), url: image.src }
      })), cards.map(card => card.imageUrl))
      assert.equal(result.combatArt.length, result.before.bottom.battle.length + result.before.top.battle.length)
      assert.ok(result.before.bottom.battle.length <= 2 && result.before.top.battle.length <= 2)
      const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-018-source"]')
      const entering = ['extra', 'green-hand', 'item-hand', 'break-low', 'no-hand', 'non-arena-hand', 'full-battle', 'close-extra', 'entry-back', 'entry-deselect'].includes(scenario)
      assert.equal(result.before.bottom.deck, entering ? 16 : 11)
      assert.equal(result.before.bottom.hand, entering && scenario !== 'no-hand' ? 1 : 0)
      assert.equal(result.before.bottom.trash, entering ? 0 : 1)
      result.setupTrace = await rawTrace(page)
      setupTraceLength = result.setupTrace.length
      // Contract trace filters by the source card id. Defender trap/damage
      // commands are checked in the full rule log regression, not this trace.
      assert.deepEqual(result.setupTrace.map(entry => entry.commandKind), entering ? [] : scenario === 'source-rested'
        ? ['play-extra-deck-cookie', 'resolve-optional-cost-attack', 'declare-attack', 'resolve-attack-effect']
        : ['play-extra-deck-cookie', 'resolve-optional-cost-attack'])
      if (scenario === 'source-rested') {
        assert.equal(result.before.top.battle.find(cookie => cookie.id === 'bs12-018-opponent').hp, 2)
        assert.equal(result.before.bottom.battle.find(cookie => cookie.id === 'bs12-018-source').rested, true)
        assert.equal(result.before.bottom.support.every(support => support.rested), true)
        assert.match(result.setupTrace[2].steps.join(' '), /Shining Glitter Cookie.*Sugar Swan Cookie/)
        assert.match(result.setupTrace[3].steps.join(' '), /未選擇目標/)
      }
      result.scope = ['equipment', 'opponent-turn'].includes(fixture) ? 'Prepared equipment/timing control with actual EXTRA entry; parent lifecycle not accepted' : 'Printed local effect operation with actual EXTRA entry or entry decision'
      const blockedEntry = ['break-low', 'no-hand', 'non-arena-hand', 'full-battle'].includes(scenario)
      if (entering) {
        assert.equal(await source.count(), 0)
        await page.getByRole('button', { name: '玩家 EXTRA Deck 1 張', exact: true }).click()
        const extra = page.getByRole('dialog', { name: '玩家 EXTRA Deck', exact: true })
        await extra.locator('img').evaluate(image => image.decode())
        assert.equal(await extra.locator('img').getAttribute('src'), cards.find(card => card.cardNumber === number).imageUrl)
        if (blockedEntry) {
          assert.equal(await extra.getByRole('button', { name: '從 EXTRA 登場', exact: true }).count(), 0)
          assert.match(await extra.innerText(), scenario === 'break-low' ? /尚未符合/ : scenario === 'full-battle' ? /最多.*兩/ : /合格手牌.*代價/)
          await shot('entry-blocked')
          await page.getByRole('button', { name: '玩家 EXTRA Deck 1 張', exact: true }).click()
          assert.deepEqual(await state(page), result.before)
          assert.deepEqual(await trace(page), [])
        } else if (scenario === 'close-extra') {
          await page.getByRole('button', { name: '玩家 EXTRA Deck 1 張', exact: true }).click()
          assert.deepEqual(await state(page), result.before)
          assert.deepEqual(await trace(page), [])
        } else {
          await extra.getByRole('button', { name: '從 EXTRA 登場', exact: true }).click()
          const panel = panelFor(page)
          assert.match(await panel.innerText(), /EXTRA 登場代價（必須支付）/)
          assert.match(await panel.innerText(), /棄置 1 張【Arena】手牌/)
          assert.doesNotMatch(await panel.innerText(), /Then 可選效果/)
          assert.equal(await panel.getByRole('button', { name: '略過', exact: true }).count(), 0)
          assert.deepEqual(await state(page), result.before)
          await panel.getByRole('button', { name: '支付代價', exact: true }).click()
          const cost = panel.locator('.modal-card-options > button')
          assert.equal(await cost.count(), 1)
          assert.equal(await panel.getByRole('button', { name: '確認', exact: true }).isEnabled(), false)
          await cost.click()
          if (scenario === 'entry-deselect') {
            await cost.click()
            assert.equal(await panel.getByRole('button', { name: '確認', exact: true }).isEnabled(), false)
            await cost.click()
          }
          if (scenario === 'entry-back') {
            await panel.getByRole('button', { name: '返回', exact: true }).click()
            assert.deepEqual(await state(page), result.before)
            await panel.getByRole('button', { name: '支付代價', exact: true }).click()
            assert.equal(await panel.getByRole('button', { name: '確認', exact: true }).isEnabled(), false)
            await cost.click()
          }
          await shot('entry-cost')
          await panel.getByRole('button', { name: '確認', exact: true }).click()
          await settle(page)
          result.entryAfter = await state(page)
          assert.equal(result.entryAfter.bottom.hand, 0)
          assert.equal(result.entryAfter.bottom.trash, 1)
          assert.equal(result.entryAfter.bottom.deck, 11)
          assert.equal(result.entryAfter.bottom.battle.length, 2)
          assert.deepEqual(result.entryAfter.bottom.battle[0], result.before.bottom.battle[0])
          assert.equal(result.entryAfter.bottom.battle[1].id, 'bs12-018-source')
          assert.equal(result.entryAfter.bottom.battle[1].hp, 5)
          assert.deepEqual(result.entryAfter.bottom.support, result.before.bottom.support)
          assert.deepEqual(result.entryAfter.top, result.before.top)
          assert.equal(await page.getByRole('button', { name: '玩家 EXTRA Deck 0 張', exact: true }).count(), 1)
          assert.deepEqual((await trace(page)).map(entry => entry.commandKind), ['play-extra-deck-cookie', 'resolve-optional-cost-attack'])
        }
      }
      const entered = entering && !blockedEntry && scenario !== 'close-extra'
      if (!entering || entered) {
        await source.locator('img').first().evaluate(image => image.decode())
        assert.equal(await source.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === number).imageUrl)
        assert.equal((await state(page)).bottom.battle.find(c => c.id === 'bs12-018-source').hp, 5)
        const skillCase = entered || ['positive', 'active-target', 'source-rested', 'solo', 'green-arena', 'non-arena', 'equipment', 'support-only', 'opponent-only', 'no-energy', 'skill-zero', 'skill-deselect', 'cancel-skill'].includes(scenario)
        if (scenario === 'opponent-turn') {
          assert.equal(await source.locator('.skill-action').count(), 0)
          assert.deepEqual(await trace(page), [])
        } else if (skillCase) {
          const beforeSkill = await state(page)
          await source.getByRole('button', { name: '啟動技能', exact: true }).click()
          const panel = panelFor(page)
          await panel.waitFor()
          assert.match(await panel.innerText(), /另一張.*紅色.*Arena|另一張.*Arena.*紅色/s)
          assert.doesNotMatch(await panel.innerText(), /已選.*手牌代價|棄置.*手牌/)
          const noCandidate = ['solo', 'green-arena', 'non-arena', 'equipment', 'support-only', 'opponent-only'].includes(scenario)
          assert.equal(await candidatesFor(panel).count(), noCandidate ? 0 : 1)
          const zero = noCandidate || ['skill-zero', 'skill-deselect'].includes(scenario)
          if (!noCandidate && scenario !== 'skill-zero') await candidatesFor(panel).click()
          if (scenario === 'skill-deselect') await candidatesFor(panel).click()
          await shot('free-skill')
          await panel.getByRole('button', { name: scenario === 'cancel-skill' ? '取消技能' : '確認發動', exact: true }).click()
          await settle(page)
          result.skillAfter = await state(page)
          if (scenario === 'cancel-skill') {
            assert.deepEqual(result.skillAfter, beforeSkill)
            assert.deepEqual(await trace(page), [])
            assert.equal(await source.getByRole('button', { name: '啟動技能', exact: true }).isEnabled(), true)
          } else {
            assert.deepEqual(result.skillAfter.bottom.support, beforeSkill.bottom.support)
            assert.equal(result.skillAfter.bottom.hand, beforeSkill.bottom.hand)
            assert.equal(result.skillAfter.bottom.trash, beforeSkill.bottom.trash)
            assert.equal(result.skillAfter.bottom.deck, beforeSkill.bottom.deck)
            assert.deepEqual(result.skillAfter.top, beforeSkill.top)
            assert.deepEqual(result.skillAfter.bottom.battle.find(c => c.id === 'bs12-018-source'), beforeSkill.bottom.battle.find(c => c.id === 'bs12-018-source'))
            if (zero) assert.deepEqual(result.skillAfter.bottom.battle, beforeSkill.bottom.battle)
            else assert.equal(result.skillAfter.bottom.battle.find(c => c.id === 'bs12-018-other').rested, false)
            assert.equal(await source.getByRole('button', { name: '啟動技能', exact: true }).isEnabled(), false)
            const skillTrace = (await trace(page)).filter(entry => ['begin-activate-skill', 'resolve-ability-effect'].includes(entry.commandKind))
            assert.deepEqual(skillTrace.map(entry => entry.commandKind), ['begin-activate-skill', 'resolve-ability-effect'])
            assert.match(skillTrace[1].steps.join(' '), zero ? /未將任何餅乾設為活躍/ : /Langue de Chat Cookie 已設為活躍/)
          }
        }
        if (scenario === 'cancel-attack') {
          await source.locator('.card-face.is-attackable').click()
          await page.locator('.bottom-field .support-card-wrap[data-card-instance-id="bs12-018-payment-0"] .card-face').click()
          await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
          assert.deepEqual(await state(page), result.before)
          assert.deepEqual(await trace(page), [])
        }
        const attackCase = entered || scenario.startsWith('attack-') || ['first-player', 'target-faints'].includes(scenario)
        if (attackCase) {
          await source.locator('.card-face.is-attackable').click()
          for (const index of [3, 1, 2, 0]) await page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="bs12-018-payment-${index}"] .card-face`).click()
          await shot('payment')
          await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-018-opponent"] .card-face[aria-label^="選擇攻擊目標："]').click()
          await page.waitForFunction(faint => {
            const target = document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="bs12-018-opponent"]')
            return faint ? !target : /HP 卡 2 張/.test(target?.querySelector('.hp-card-stack')?.getAttribute('aria-label') ?? '')
          }, scenario === 'target-faints', { timeout: 20000 })
          await settle(page)
          const qualifies = scenario !== 'first-player'
          const zero = ['attack-zero', 'attack-skip'].includes(scenario)
          const original = ['attack-original', 'attack-reselect'].includes(scenario)
          const panel = panelFor(page)
          if (qualifies) {
            await panel.waitFor()
            assert.match(await panel.innerText(), /最多 1 張對手餅乾，造成 1 傷害/)
            assert.doesNotMatch(await panel.innerText(), /不能改選|對原受攻擊的同一張/)
            assert.equal(await candidatesFor(panel).count(), scenario === 'target-faints' ? 1 : 2)
            if (!zero) await candidatesFor(panel).nth(original ? 0 : (scenario === 'target-faints' ? 0 : 1)).click()
            if (scenario === 'attack-reselect') {
              await candidatesFor(panel).nth(1).click()
              assert.equal(await candidatesFor(panel).nth(0).getAttribute('aria-pressed'), 'true')
              assert.equal(await candidatesFor(panel).nth(1).getAttribute('aria-pressed'), 'false')
              await candidatesFor(panel).nth(0).click()
              await candidatesFor(panel).nth(1).click()
              await candidatesFor(panel).nth(1).click()
              await candidatesFor(panel).nth(0).click()
            }
            await shot('then')
            await panel.getByRole('button', { name: scenario === 'attack-skip' ? '略過' : '確認發動', exact: true }).click()
          }
          await settle(page)
          result.attackAfter = await state(page)
          assert.equal(result.attackAfter.top.battle.find(c => c.id === 'bs12-018-opponent')?.hp, scenario === 'target-faints' ? undefined : qualifies && !zero && original ? 1 : 2)
          assert.equal(result.attackAfter.top.battle.find(c => c.id === 'bs12-018-opponent-other').hp, qualifies && !zero && !original ? 3 : 4)
          assert.equal(result.attackAfter.top.trash, qualifies && !zero ? 5 : 4)
          assert.equal(result.attackAfter.bottom.battle.find(c => c.id === 'bs12-018-source').hp, 5)
          assert.equal(result.attackAfter.bottom.battle.find(c => c.id === 'bs12-018-source').rested, true)
          assert.equal(result.attackAfter.bottom.support.every(s => s.rested), true)
          assert.equal(result.attackAfter.bottom.hand, 0)
          assert.equal(result.attackAfter.bottom.trash, 1)
          assert.equal(result.attackAfter.bottom.deck, 11)
          result.attackTrace = (await trace(page)).filter(entry => ['declare-attack', 'resolve-attack-effect'].includes(entry.commandKind))
          assert.deepEqual(result.attackTrace.map(entry => entry.commandKind), ['declare-attack', 'resolve-attack-effect'])
          assert.match(result.attackTrace[1].steps.join(' '), !qualifies ? /條件不成立，效果未執行/ : zero ? /未選擇目標|略過|未造成傷害/ : original ? /Sugar Swan Cookie.*受到 1 點傷害/ : /Langue de Chat Cookie.*受到 1 點傷害/)
          await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
          await page.getByRole('button', { name: /Shining Glitter Cookie 攻擊 玩家/ }).click()
          result.publicAttackText = await page.locator('body').innerText()
          await shot('public-trace')
          await page.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
        }
        if (['wrong-energy', 'few-energy', 'rested-energy', 'no-energy', 'source-rested'].includes(scenario)) assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
      }
      result.after = await state(page)
      if (['opponent-turn', 'wrong-energy', 'few-energy', 'rested-energy'].includes(scenario)) {
        assert.deepEqual(result.after, result.before)
        assert.deepEqual(await trace(page), [])
      }
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
      result.dom = await page.locator('body').innerText().catch(() => '')
      results.push(result)
      writeFileSync(resolve(out, 'results.json'), JSON.stringify(results, null, 2))
      throw error
    } finally { await page.close() }
    results.push(result)
    writeFileSync(resolve(out, 'results.json'), JSON.stringify(results, null, 2))
    console.log(`PASS ${number} ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-018 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
