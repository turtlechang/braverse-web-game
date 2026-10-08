import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-032-choice-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-festival-arena-bs12.en.json'), 'utf8')).cards
const formal = readdirSync(resolve(root, 'data/cards')).filter(f => f.endsWith('.json')).flatMap(f => JSON.parse(readFileSync(resolve(root, 'data/cards', f), 'utf8')).cards ?? [])
const cards = ['BS12-032', 'BS12-032@1', 'BS12-024', 'BS12-019', 'BS12-001', 'BS6-008', 'ST4-001'].map(number => [...candidate, ...formal].find(card => card.cardNumber === number))
// These deliberately prepared queues attest only to selection UI and settlement.
// They never attest to an Arena card's movement, cost, damage, or faint trigger.
const cases = ['red', 'blue-non-arena', 'rested', 'skip', 'confirm-zero', 'deselect', 'switch', 'limit-one', 'opponent-ignored', 'source-ignored', 'refresh', 'prevented', 'public-source']
const readState = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'),
      breakLevel: Number(field?.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1] ?? NaN),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(node => node.querySelector('.card-face')?.classList.contains('is-rested') ?? false),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'), hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN), rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })) }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const readTrace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({ commandKind: entry.commandKind, steps: entry.steps, summary: entry.summary })))
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const number of ['BS12-032', 'BS12-032@1']) for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(s => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page = await browser.newPage({ viewport })
    const result = { number, scenario, viewport, scope: 'prepared-choice-ui-only', triggerAttested: false, status: 'RUNNING', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(String(error)))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), error: request.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const fixture = ['rested', 'refresh', 'prevented', 'public-source'].includes(scenario) ? `ui-choice-${scenario}` : 'ui-choice'
      await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'}/?test-state=${number.toLowerCase()}:${fixture}&contract-card=BS12-032`)
      await page.getByRole('heading', { name: 'Caramel Choux Cookie 發動休息區移入效果', exact: true }).waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      assert.match(await page.locator('.faint-target-hint').innerText(), /最多 1 個己方餅乾/)
      const source = page.locator('.bottom-field').getByRole('button', { name: 'Caramel Choux Cookie', exact: true })
      if (scenario !== 'public-source') {
        await source.locator('img').evaluate(img => img.decode())
        assert.equal(await source.locator('img').getAttribute('src'), cards.find(card => card.cardNumber === number).imageUrl)
      }
      result.before = await readState(page)
      assert.equal(result.before.bottom.battle.length, 2)
      assert.equal(result.before.bottom.breakLevel, scenario === 'public-source' ? 0 : 1)
      assert.deepEqual(await readTrace(page), [])
      const red = page.locator('.bottom-field .combat-card-wrap').getByRole('button', { name: 'GingerBrave', exact: true })
      const blue = page.locator('.bottom-field .combat-card-wrap').getByRole('button', { name: 'Candy Diver Cookie', exact: true })
      let targetId = null
      if (scenario === 'opponent-ignored') {
        await page.locator('.top-field').getByRole('button', { name: 'Sugar Swan Cookie', exact: true }).click()
        const detail = page.getByRole('dialog', { name: 'Sugar Swan Cookie 卡牌詳情', exact: true })
        await detail.waitFor()
        await detail.getByRole('button', { name: '關閉', exact: true }).click()
        assert.equal(await page.getByRole('button', { name: '確認略過', exact: true }).count(), 1)
      } else if (scenario === 'source-ignored') {
        await source.click()
        await page.getByRole('dialog', { name: '玩家休息區資訊', exact: true }).getByRole('button', { name: 'Caramel Choux Cookie Caramel Choux Cookie', exact: true }).click()
        const detail = page.getByRole('dialog', { name: 'Caramel Choux Cookie 卡牌詳情', exact: true })
        await detail.waitFor()
        await detail.getByRole('button', { name: '關閉', exact: true }).click()
        assert.equal(await page.getByRole('button', { name: '確認略過', exact: true }).count(), 1)
      } else if (!['skip', 'confirm-zero'].includes(scenario)) {
        targetId = ['blue-non-arena', 'prevented'].includes(scenario) ? 'bs12-032-ally-other' : 'bs12-032-ally'
        await (targetId.endsWith('other') ? blue : red).click()
        if (scenario === 'deselect') { await red.click(); targetId = null }
        if (scenario === 'switch') { await red.click(); await blue.click(); targetId = 'bs12-032-ally-other' }
        if (scenario === 'limit-one') { await blue.click(); assert.equal(await page.locator('.bottom-field .combat-card-wrap .is-selected').count(), 1) }
      }
      await shot('selection')
      assert.deepEqual(await readState(page), result.before)
      if (scenario === 'skip') await page.getByRole('button', { name: '略過', exact: true }).click()
      else await page.getByRole('button', { name: targetId ? '確認 (1)' : '確認略過', exact: true }).click()
      await page.getByRole('heading', { name: 'Caramel Choux Cookie 發動休息區移入效果', exact: true }).waitFor({ state: 'hidden' })
      if (scenario === 'refresh') {
        const during = await readState(page)
        assert.equal(during.bottom.deck, 0)
        assert.equal(during.bottom.battle[0].hp, 3)
        await page.getByRole('alertdialog').getByRole('button', { name: 'Langue de Chat Cookie Langue de Chat Cookie', exact: true }).click()
        await page.waitForFunction(() => Number(document.querySelector('.bottom-field .deck-zone .resource-summary > strong')?.textContent) === 6)
      }
      result.after = await readState(page)
      assert.deepEqual(result.after.top, result.before.top)
      assert.deepEqual(result.after.bottom.support, result.before.bottom.support)
      const gained = Boolean(targetId) && scenario !== 'prevented'
      for (const before of result.before.bottom.battle) {
        const after = result.after.bottom.battle.find(entry => entry.id === before.id)
        assert.equal(after.hp, before.hp + (gained && targetId === before.id ? 1 : 0))
        assert.equal(after.rested, before.rested)
      }
      assert.equal(result.after.bottom.deck, scenario === 'refresh' ? 6 : result.before.bottom.deck - (gained ? 1 : 0))
      assert.equal(result.after.bottom.breakLevel, scenario === 'refresh' ? 4 : result.before.bottom.breakLevel)
      assert.equal(result.after.bottom.trash, scenario === 'refresh' ? 0 : result.before.bottom.trash)
      result.trace = await readTrace(page)
      assert.equal(result.trace[0].commandKind, 'resolve-after-damage-effect')
      assert.match(result.trace[0].steps.join(' '), gained ? /休息區移入效果.*增加 1.*HP/ : targetId ? /休息區移入效果.*增加 0 張 HP/ : /休息區移入效果.*未增加 HP/)
      assert.deepEqual(result.errors, [])
      assert.deepEqual(result.networkFailures, [])
      await shot('result')
      result.status = 'PASS'
    } catch (error) { result.status = 'FAIL'; result.error = String(error.stack ?? error); result.dom = await page.locator('body').innerText().catch(() => ''); await shot('failure').catch(() => {}); throw error }
    finally { results.push(result); writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(results, null, 2)); await page.close() }
    console.log(`PASS prepared-choice-only ${number} ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-032 prepared-choice UI ${results.length}/${results.length}; trigger acceptance excluded`)
} finally { await browser.close() }
