import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-062-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/cards/official-festival-arena-bs12.en.json'),'utf8')).cards
const references = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...references].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
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
const cases = ['equipped', 'hand-five', 'hand-six', 'hand-zero', 'no-equipment', 'wrong-host', 'short-deck', 'refresh', 'equip-blocked', 'deploy', 'attack', 'wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'cancel-payment', 'cancel-target', 'draw-zero', 'draw-one', 'skip-trigger']
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const ordinary = ['deploy', 'attack', 'wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn'].includes(scenario)
    const result = { number: 'BS12-062', scenario, viewport, printedSourceAttested: ordinary || ['equip-blocked','no-equipment'].includes(scenario), isolatedEquipment: !ordinary && scenario !== 'equip-blocked' && scenario !== 'no-equipment', errors: [], networkFailures: [] }
    const page = await browser.newPage({ viewport })
    page.on('pageerror', error => result.errors.push(String(error)))
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      result.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'equipped' ? 'card:BS12-062' : process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'hand-six' ? 'card-negative:BS12-062' : 'bs12-062:'+scenario
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+result.testState+'&contract-card=BS12-001,BS12-003,BS12-005,BS12-007,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-017,BS12-019,BS12-021,BS12-024,BS12-028,BS12-029,BS12-030,BS12-031,BS12-038,BS12-039,BS12-041,BS12-046,BS12-059,BS12-060,BS12-061,BS12-062,BS12-063,BS4-095,BS6-008,BS6-017,BS7-061,BS11-012,ST4-001,P-069')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      result.before = await state(page)
      result.beforeTrace = await trace(page)
      if (scenario === 'deploy') {
        const hand = page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-062-source"]')
        await hand.locator('.card-face').click()
        const preview = page.getByRole('complementary', { name: 'Angel Lightstick快速預覽', exact: true })
        await preview.locator('img').first().evaluate(image => image.decode())
        assert.equal(await preview.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-062').imageUrl)
        await hand.getByRole('button', { name: '登場', exact: true }).click()
        await settle(page)
        assert.equal((await state(page)).bottom.battle[0].hp, 3)
        assert.equal((await state(page)).bottom.deck, 9)
      }
      const actorId = ordinary ? 'bs12-062-source' : 'bs12-062-host'
      const actor = page.locator(`.bottom-field .combat-card-wrap[data-card-instance-id="${actorId}"]`)
      if (scenario === 'equip-blocked') {
        const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-062-source"]')
        const skill = source.locator('.skill-action')
        assert.equal(await skill.isEnabled(), false)
        assert.ok(await skill.getAttribute('aria-describedby'))
        assert.match(await source.locator('.skill-unavailable-reason').innerText(), /HP.*裁定尚未確認/)
        assert.deepEqual(await state(page), result.before)
        assert.deepEqual(await trace(page), result.beforeTrace)
      } else if (['wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn'].includes(scenario)) {
        assert.equal(await actor.locator('.card-face.is-attackable').count(), 0)
        assert.deepEqual(await state(page), result.before)
        assert.deepEqual(await trace(page), result.beforeTrace)
      } else {
        result.entered = await state(page)
        await actor.locator('.card-face.is-attackable').click()
        if (scenario === 'cancel-payment') {
          await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
          assert.deepEqual(await state(page), result.entered)
          assert.deepEqual(await trace(page), result.beforeTrace)
        } else {
          for (const support of result.entered.bottom.support) await page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="${support.id}"] .card-face`).click()
          if (scenario === 'cancel-target') {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await state(page), result.entered)
            assert.deepEqual(await trace(page), result.beforeTrace)
          } else {
            await page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-062-opponent"] .card-face:not(.hp-card)').click()
            const triggers = !ordinary && !['hand-six', 'no-equipment', 'wrong-host'].includes(scenario)
            if (triggers) {
              const trigger = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Angel Lightstick 裝備效果', exact: true }) })
              await trigger.waitFor()
              assert.match(await trigger.innerText(), /宿主已宣告攻擊，是否抽最多 2 張牌/)
              const paid = await state(page)
              assert.equal(paid.top.battle[0].hp, 6)
              assert.equal(paid.bottom.hand, result.entered.bottom.hand)
              assert.equal(paid.bottom.deck, result.entered.bottom.deck)
              assert.equal(paid.bottom.support.every(s => s.rested), true)
              await shot('trigger-before-damage')
              if (scenario === 'skip-trigger') await trigger.getByRole('button', { name: '略過', exact: true }).click()
              else {
                await trigger.getByRole('button', { name: '發動', exact: true }).click()
                const drawModal = page.locator('.draw-up-to-modal')
                await drawModal.waitFor()
                await drawModal.locator('img').first().evaluate(image => image.decode())
                assert.equal(await drawModal.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-062').imageUrl)
                assert.deepEqual(await drawModal.locator('.draw-up-to-option-label').allTextContents(), ['不抽', '抽 1 張', '抽 2 張'])
                const count = scenario === 'draw-zero' ? 0 : scenario === 'draw-one' || scenario === 'short-deck' ? 1 : 2
                await drawModal.getByRole('button', { name: count === 0 ? '不抽' : `抽 ${count} 張`, exact: false }).first().click()
                await shot('draw-choice')
                await drawModal.getByRole('button', { name: count === 0 ? '略過抽牌' : `抽取 ${count} 張牌`, exact: true }).click()
                if (scenario === 'refresh') {
                  await page.getByText('牌庫 Refresh', { exact: true }).waitFor()
                  result.beforeRefresh = await state(page)
                  assert.equal(result.beforeRefresh.top.battle[0].hp, 6)
                  await shot('refresh-before-damage')
                  await page.locator('.decision-modal:visible').getByRole('button').filter({ hasText: 'Sorbet Shark Cookie' }).click()
                }
                result.drawCount = count
              }
            }
            if (scenario === 'short-deck') {
              await page.getByRole('heading', { name: /對局結束|勝利|敗北/ }).first().waitFor()
            } else await page.waitForFunction(() => /HP 卡 5 張/.test(document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="bs12-062-opponent"] .hp-card-stack')?.getAttribute('aria-label') ?? ''), null, { timeout: 20000 })
            await settle(page)
            result.attackAfter = await state(page)
            if (scenario !== 'short-deck') {
              assert.deepEqual(result.attackAfter.top.battle.map(c => c.hp), [5, 4])
              assert.equal(result.attackAfter.bottom.hand, result.entered.bottom.hand + (result.drawCount ?? 0))
              assert.equal(result.attackAfter.bottom.battle.find(c => c.id === actorId).rested, true)
            }
            const commands = (await trace(page)).slice(result.beforeTrace.length).map(e => e.commandKind)
            assert.equal(commands.includes('declare-attack'), true)
            if (triggers) assert.equal(commands.includes('resolve-stage-trigger'), true)
            if (scenario === 'hand-six') assert.match(JSON.stringify(await trace(page)), /條件不成立，效果未執行/)
          }
        }
      }
      result.after = await state(page)
      result.trace = await trace(page)
      await shot('result')
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
      writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(results, null, 2))
      throw error
    } finally { await page.close() }
    results.push(result)
    writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(results, null, 2))
    console.log(`PASS BS12-062 ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-062 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
