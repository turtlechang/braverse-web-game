import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-030-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-festival-arena-bs12.en.json'), 'utf8')).cards
const references = readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json')).flatMap(file => JSON.parse(readFileSync(resolve(root, 'data/cards', file), 'utf8')).cards ?? [])
const cards = [...candidate.filter(card => existsSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`))), ...references.filter(card => ["BS7-061","ST4-001","BS4-095"].includes(card.cardNumber))]
const readState = page => page.evaluate(() => {
  const side = placement => {
    const field = document.querySelector(`.${placement}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'), hand: field?.querySelectorAll('.hand-card').length ?? 0,
      stage: field?.querySelector('.stage-zone img')?.getAttribute('src') ?? null,
      stageRested: field?.querySelector('.stage-zone .card-face')?.classList.contains('is-rested') ?? false,
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'), hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN), rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'), rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
      breakLevel: Number(field?.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1] ?? NaN),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({ commandKind: entry.commandKind, summary: entry.summary, steps: entry.steps })))
const draftState = baseline => ({ ...baseline, bottom: { ...baseline.bottom, support: baseline.bottom.support.map((s, i) => ({ ...s, rested: s.rested || i === 1 })) } })
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') && ![...document.querySelectorAll('button')].some(button => button.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
const fixtures = ['positive', 'faint', 'green-arena', 'hand-break', 'removed-break', 'old-break', 'previous-turn', 'non-arena', 'opponent-break', 'trash-arena', 'no-event', 'no-energy', 'wrong-energy', 'rested-energy', 'one-energy', 'rested-source', 'opponent-turn', 'wrong-phase', 'non-arena-target', 'red-target', 'rested-target', 'equipment', 'support-only', 'no-target', 'replace', 'placed', 'refresh']
const extras = ['zero', 'other-target', 'cancel-placement', 'deselect-placement', 'cancel-energy', 'cancel-cost', 'cancel-target', 'back-cost', 'back-energy', 'deselect-energy', 'deselect-target', 'target-max', 'hand-preview']
const cases = [...fixtures, ...extras]
const routeCase = value => extras.includes(value) ? 'positive' : value
const falseConditions = ['old-break', 'previous-turn', 'non-arena', 'opponent-break', 'trash-arena', 'no-event']
const prepared = ['placed', 'rested-source', 'opponent-turn', 'wrong-phase']
const placementBlocked = ['no-energy', 'wrong-energy', 'rested-energy']
const activationBlocked = ['one-energy', 'rested-source', 'opponent-turn', 'wrong-phase']
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({ viewport })
    const result = { number: 'BS12-030', scenario, viewport, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const fixtureScenario = routeCase(scenario)
      result.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && fixtureScenario === 'positive' ? 'card:BS12-030' : process.env.BS12_BROWSER_ROUTE === 'generic' && fixtureScenario === 'no-event' ? 'card-negative:BS12-030' : `bs12-030:${fixtureScenario}`
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${result.testState}&contract-card=BS12-030`)
      await page.locator('.game-shell').waitFor()
      await settle(page)
      result.before = await readState(page)
      assert.deepEqual(await trace(page), [])
      if (scenario === 'hand-preview') {
        await page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-030-stage"] .card-face').click()
        await page.getByRole('button', { name: '詳情', exact: true }).click()
        const details = page.getByRole('dialog', { name: 'Well-Lit Workshop' })
        await details.waitFor()
        assert.match(await details.innerText(), /During this turn.*Arena.*break area/s)
        assert.equal(await details.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-030').imageUrl)
        await details.locator('img').first().evaluate(image => image.decode())
        await details.getByRole('button', { name: '關閉', exact: true }).click()
        result.after = await readState(page)
        assert.deepEqual(result.after, result.before)
      } else if (placementBlocked.includes(scenario)) {
        await page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-030-stage"] .card-face').click()
        assert.equal(await page.getByRole('button', { name: '放置', exact: true }).count(), 0)
        assert.equal(await page.getByRole('alertdialog', { name: 'Well-Lit Workshop 場景放置付款', exact: true }).count(), 0)
        assert.match(await page.locator('body').innerText(), /BS12-030/)
        result.after = await readState(page)
        assert.deepEqual(result.after, result.before)
        assert.deepEqual(await trace(page), [])
      } else {
        if (!prepared.includes(scenario)) {
          await page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-030-stage"] .card-face').click()
          await page.getByRole('button', { name: '放置', exact: true }).click()
          const modal = page.getByRole('alertdialog', { name: 'Well-Lit Workshop 場景放置付款', exact: true })
          await modal.waitFor()
          assert.match(await modal.innerText(), /BS12-030/)
          assert.equal(await modal.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-030').imageUrl)
          await modal.locator('img').first().evaluate(image => image.decode())
          const pay = modal.getByRole('button', { name: '支付並放置', exact: true })
          assert.equal(await pay.isEnabled(), false)
          const choices = modal.locator('.modal-card-options > button')
          if (placementBlocked.includes(scenario)) {
            assert.equal(await choices.count(), 0)
            await shot('blocked')
            await modal.getByRole('button', { name: '取消', exact: true }).click()
          } else {
            assert.equal(await choices.count(), scenario === 'one-energy' ? 1 : 2)
            await choices.nth(0).click()
            assert.equal(await pay.isEnabled(), true)
            if (scenario === 'deselect-placement') {
              await choices.nth(0).click()
              assert.equal(await pay.isEnabled(), false)
              await choices.nth(0).click()
            }
            if (scenario === 'cancel-placement') await modal.getByRole('button', { name: '取消', exact: true }).click()
            else {
              await shot('placement-payment')
              await pay.click()
              await modal.waitFor({ state: 'hidden' })
              await settle(page)
              result.placed = await readState(page)
              assert.equal(result.placed.bottom.stage, cards.find(card => card.cardNumber === 'BS12-030').imageUrl)
              assert.equal(result.placed.bottom.stageRested, false)
              assert.equal(result.placed.bottom.hand, 0)
              assert.equal(result.placed.bottom.support[0].rested, true)
              assert.equal(result.placed.bottom.trash, result.before.bottom.trash + (scenario === 'replace' ? 1 : 0))
              assert.deepEqual(result.placed.bottom.battle, result.before.bottom.battle)
              assert.equal(result.placed.bottom.deck, result.before.bottom.deck)
            }
          }
        } else result.placed = result.before
        if (placementBlocked.includes(scenario) || scenario === 'cancel-placement') {
          result.after = await readState(page)
          assert.deepEqual(result.after, result.before)
          assert.deepEqual(await trace(page), [])
        } else if (activationBlocked.includes(scenario)) {
          assert.equal(await page.locator('.bottom-field .stage-quick-action').count(), 0)
          result.after = await readState(page)
          assert.deepEqual(result.after, result.placed)
        } else {
          await page.locator('.bottom-field .stage-quick-action').click()
          const panel = page.locator('.effect-panel:not(.is-complete):visible')
          await panel.waitFor()
          assert.match(await panel.innerText(), /啟動場景.*BS12-030/s)
          assert.equal(await panel.getByRole('img', { name: 'Well-Lit Workshop', exact: true }).getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-030').imageUrl)
          const next = panel.getByRole('button', { name: '下一步', exact: true })
          assert.equal(await next.isEnabled(), false)
          const energy = panel.getByRole('button', { name: /Muscle Cookie.*點擊選取/ })
          assert.equal(await energy.count(), scenario === 'placed' ? 2 : 1)
          await energy.nth(scenario === 'placed' ? 1 : 0).click()
          assert.equal(await next.isEnabled(), true)
          if (scenario === 'deselect-energy') {
            await panel.getByRole('button', { name: /Muscle Cookie.*已選取/ }).click()
            assert.equal(await next.isEnabled(), false)
            await energy.nth(0).click()
          }
          const cancel = async () => {
            await panel.getByRole('button', { name: '取消技能', exact: true }).click()
            await settle(page)
            assert.deepEqual(await readState(page), result.placed)
          }
          if (scenario === 'cancel-energy') await cancel()
          else {
            await next.click()
            assert.match(await panel.innerText(), /額外代價.*將效果來源卡橫置/s)
            assert.deepEqual(await readState(page), draftState(result.placed))
            if (scenario === 'back-energy') {
              await panel.getByRole('button', { name: '上一步', exact: true }).click()
              assert.match(await panel.innerText(), /能量支付/)
              assert.deepEqual(await readState(page), draftState(result.placed))
              await next.click()
            }
            if (scenario === 'cancel-cost') await cancel()
            else {
              if (!falseConditions.includes(scenario)) await next.click()
              if (scenario === 'back-cost') {
                await panel.getByRole('button', { name: '上一步', exact: true }).click()
                assert.match(await panel.innerText(), /將效果來源卡橫置/)
                assert.deepEqual(await readState(page), draftState(result.placed))
                await next.click()
              }
              const noTarget = ['support-only', 'no-target'].includes(scenario)
              const targets = panel.getByRole('button', { name: /戰鬥區第/ })
              assert.equal(await targets.count(), noTarget || falseConditions.includes(scenario) ? 0 : 2)
              if (falseConditions.includes(scenario)) assert.equal(await page.getByText('效果目標', { exact: true }).count(), 0)
              if (scenario === 'cancel-target') await cancel()
              else {
                const zero = scenario === 'zero' || noTarget || falseConditions.includes(scenario)
                if (!zero) {
                  await targets.nth(scenario === 'other-target' ? 1 : 0).click()
                  if (scenario === 'deselect-target') {
                    await targets.nth(0).click()
                    assert.match(await panel.innerText(), /已選 0／1/)
                    await targets.nth(0).click()
                  }
                  if (scenario === 'target-max') {
                    await targets.nth(1).click()
                    assert.match(await panel.innerText(), /已選 1／1/)
                    assert.equal(await targets.nth(0).getAttribute('aria-pressed'), 'true')
                    assert.equal(await targets.nth(1).getAttribute('aria-pressed'), 'false')
                  }
                }
                await shot('activation-target')
                await panel.getByRole('button', { name: '確認發動', exact: true }).click()
                await panel.waitFor({ state: 'hidden' })
                await settle(page)
                if (scenario === 'refresh') {
                  const refresh = page.locator('.decision-modal:visible')
                  await refresh.waitFor()
                  result.beforeRefresh = await readState(page)
                  assert.equal(result.beforeRefresh.bottom.battle[0].hp, result.placed.bottom.battle[0].hp + 1)
                  assert.equal(result.beforeRefresh.bottom.deck, 0)
                  await refresh.getByRole('button').filter({ hasText: 'Muscle Cookie' }).click()
                  await refresh.waitFor({ state: 'hidden' })
                  await settle(page)
                }
                result.after = await readState(page)
                assert.equal(result.after.bottom.stageRested, true)
                assert.equal(result.after.bottom.stage, cards.find(card => card.cardNumber === 'BS12-030').imageUrl)
                assert.deepEqual(result.after.bottom.support, draftState(result.placed).bottom.support)
                assert.equal(result.after.bottom.deck, scenario === 'refresh' ? 6 : result.placed.bottom.deck - (zero ? 0 : 1))
                assert.equal(result.after.bottom.trash, scenario === 'refresh' ? 0 : result.placed.bottom.trash)
                assert.deepEqual(result.after.top, result.before.top)
                for (let i = 0; i < result.after.bottom.battle.length; i++) assert.equal(result.after.bottom.battle[i].hp, result.placed.bottom.battle[i].hp + (!zero && i === (scenario === 'other-target' ? 1 : 0) ? 1 : 0))
                assert.equal(await page.locator('.bottom-field .stage-quick-action').count(), 0)
                result.trace = await trace(page)
                assert.deepEqual(result.trace.map(e => e.commandKind), [...(prepared.includes(scenario) ? [] : ['play-stage']), 'begin-activate-stage', ...(falseConditions.includes(scenario) ? [] : ['resolve-ability-effect'])])
                const details = result.trace.flatMap(e => e.steps ?? []).map(s => typeof s === 'string' ? s : s.text).join('\n')
                assert.match(details, /場景代價.*Well-Lit Workshop/)
                assert.match(details, /支付能量/)
                if (falseConditions.includes(scenario)) assert.match(details, /場景效果結果：條件不成立，效果未執行/)
                else if (zero) assert.match(details, /未增加 HP/)
                else assert.match(details, /增加 1 點 HP/)
              }
            }
          }
          if (scenario.startsWith('cancel-') && scenario !== 'cancel-placement') {
            result.after = await readState(page)
            assert.deepEqual(result.after, result.placed)
            assert.deepEqual((await trace(page)).map(e => e.commandKind), ['play-stage'])
          }
        }
      }
      result.after ??= await readState(page)
      result.trace ??= await trace(page)
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
      await shot('result')
      result.status = 'PASS'
      console.log(`PASS BS12-030 ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) {
      result.failure = error.stack ?? String(error)
      result.dom = await page.locator('body').innerText().catch(() => '')
      console.error(`FAIL BS12-030 ${scenario} ${viewport.width}x${viewport.height}`, error)
      await shot('failure').catch(() => {})
      throw error
    } finally {
      results.push(result)
      writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(results, null, 2))
      await page.close()
    }
  }
  console.log(`BS12-030 Browser ${results.filter(r => r.status === 'PASS').length}/${results.length}`)
} finally { await browser.close() }
