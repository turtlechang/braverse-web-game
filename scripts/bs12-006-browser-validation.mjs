import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})).href)
const chromium = module.chromium ?? module.default?.chromium
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-006-browser')
mkdirSync(out, { recursive: true })
const records = JSON.parse(readFileSync(resolve(root, 'data/cards/official-festival-arena-bs12.en.json'), 'utf8')).cards
const fsRecords = number => {
  const files = ['official-a-game-of-truth-and-deceit-bs9.en.json', ...readdirSync(resolve(root, 'data/cards')).filter(f => f.endsWith('.json'))]
  for (const file of files) { const card = JSON.parse(readFileSync(resolve(root, 'data/cards', file), 'utf8')).cards?.find(c => c.cardNumber === number); if (card) return [card] }
  throw new Error('Missing reference ' + number)
}
const referenceRecords = [
  JSON.parse(readFileSync(resolve(root, 'data/cards/official-starter-deck-blue.en.json'), 'utf8')).cards.find(card => card.cardNumber === 'ST4-001'),
  ...fsRecords('BS7-061'),
  ...fsRecords('BS6-008'),
]
const viewports = [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]
const cases = ['other', 'self', 'zero', 'cancel-payment', 'cancel-cost', 'cancel-target', 'deselect', 'overselect', 'no-cost', 'wrong-keyword', 'no-energy', 'wrong-energy', 'rested-energy', 'used', 'opponent-turn']
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return {
      deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({
        id: node.getAttribute('data-card-instance-id'),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
        rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
      })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(node => ({
        id: node.getAttribute('data-card-instance-id'), rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
      })),
      hand: field?.querySelectorAll('.hand-card').length ?? 0,
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({ commandKind: entry.commandKind, steps: entry.steps })))
const settle = async page => {
  await page.waitForFunction(() => !document.querySelector('.animation-overlay, .presentation-overlay') &&
    ![...document.querySelectorAll('button')].some(button => button.textContent?.trim() === '略過目前演出'), null, { timeout: 10000 })
}
const browser = await chromium.launch({ headless: true, executablePath })
const results = []
try {
  for (const viewport of viewports) for (const scenario of cases) {
    const page = await browser.newPage({ viewport })
    const result = { scenario, viewport, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), error: request.failure()?.errorText }))
    try {
      for (const record of [...records.filter(card => existsSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`))), ...referenceRecords]) {
        const path = resolve(root, `test-results/bs12-official-art/${record.cardNumber}.webp`)
        assert.ok(existsSync(path), 'Official image required: ' + record.cardNumber)
        await page.route(record.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(path) }))
      }
      const blocked = ['no-cost', 'wrong-keyword', 'no-energy', 'wrong-energy', 'rested-energy', 'used', 'opponent-turn'].includes(scenario)
      const route = blocked ? scenario : ['self', 'overselect'].includes(scenario) ? 'self' : 'positive'
      const testState = process.env.BS12_BROWSER_ROUTE === 'generic' && route === 'positive' ? 'card:BS12-006'
        : process.env.BS12_BROWSER_ROUTE === 'generic' && route === 'no-cost' ? 'card-negative:BS12-006' : `bs12-006:${route}`
      result.testState = testState
      await page.goto(`${baseUrl}/?test-state=${testState}&contract-card=BS12-006`)
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-006-source"]')
      for (const [id, record] of [['bs12-006-source', records.find(c => c.cardNumber === 'BS12-006')], ['bs12-006-companion', scenario === 'wrong-keyword' ? referenceRecords[0] : referenceRecords[1]]]) {
        const img = page.locator(`.bottom-field .combat-card-wrap[data-card-instance-id="${id}"] img`).first()
        await img.evaluate(image => image.decode())
        assert.equal(await img.getAttribute('src'), record.imageUrl)
      }
      result.before = await state(page)
      const skill = source.getByRole('button', { name: '啟動技能', exact: true })
      if (blocked) {
        assert.ok(await skill.count() === 0 || !await skill.isEnabled())
        if (['no-cost', 'wrong-keyword'].includes(scenario)) assert.match(await source.innerText(), /狀態代價/)
        result.after = await state(page)
        assert.deepEqual(result.after, result.before)
        assert.deepEqual(await trace(page), [])
      } else {
        await skill.click()
        const panel = page.locator('.effect-panel:visible')
        await panel.waitFor({ state: 'visible' })
        assert.match(await panel.innerText(), /BS12-006/)
        const next = panel.getByRole('button', { name: '下一步', exact: true })
        assert.equal(await next.isEnabled(), false)
        if (scenario !== 'cancel-payment') {
          await panel.locator('.effect-candidate-entry > button').click()
          await next.click()
          assert.match(await panel.innerText(), /技能代價.*活躍/s)
          assert.equal(await next.isEnabled(), false)
          const costs = panel.locator('.effect-candidates-position-cost .effect-candidate-entry > button')
          assert.equal(await costs.count(), route === 'self' ? 2 : 1)
          assert.ok((await costs.allTextContents()).every(name => !name.includes('Candy Diver')))
          if (scenario !== 'cancel-cost') {
            const chosen = costs.filter({ hasText: scenario === 'self' ? 'Pastel Meringue Cookie' : 'Pancake Cookie' })
            await chosen.click()
            if (scenario === 'deselect') {
              await chosen.click()
              assert.equal(await next.isEnabled(), false)
              await chosen.click()
            }
            if (scenario === 'overselect') {
              await costs.filter({ hasText: 'Pastel Meringue Cookie' }).click()
              assert.equal(await costs.filter({ hasText: 'Pastel Meringue Cookie' }).getAttribute('aria-pressed'), 'false')
              assert.equal(await chosen.getAttribute('aria-pressed'), 'true')
            }
            const preview = await state(page)
            assert.deepEqual({ ...preview, bottom: { ...preview.bottom, support: result.before.bottom.support } }, result.before, 'Cost and target selection do not change game zones')
            assert.deepEqual(await trace(page), [], 'Payment is a visual preview until confirmation')
            await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-cost.png`) })
            await next.click()
            const targets = panel.locator('.effect-candidate-entry > button')
            assert.equal(await targets.count(), 1)
            assert.match(await targets.innerText(), /Sugar Swan Cookie/)
            const confirm = panel.getByRole('button', { name: '確認發動', exact: true })
            assert.equal(await confirm.isEnabled(), true, 'Zero targets are permitted')
            if (scenario !== 'zero') await targets.click()
            assert.deepEqual(await trace(page), [])
            if (scenario !== 'cancel-target') {
              await confirm.click()
              await panel.waitFor({ state: 'hidden' })
              await settle(page)
              result.after = await state(page)
              assert.deepEqual(result.after.bottom.battle.map(c => c.hp), [3, 4])
              assert.deepEqual(result.after.bottom.battle.map(c => c.rested), scenario === 'self' ? [false, true] : route === 'self' ? [true, false] : [false, false])
              assert.equal(result.after.bottom.support[0].rested, true)
              assert.equal(result.after.bottom.deck, 20)
              assert.equal(result.after.top.battle[0].hp, scenario === 'zero' ? 6 : 5)
              assert.equal(result.after.top.trash, scenario === 'zero' ? 0 : 1)
              assert.equal(await skill.isEnabled(), false)
              result.trace = await trace(page)
              assert.deepEqual(result.trace.map(e => e.commandKind), ['begin-activate-skill', 'resolve-ability-effect'])
              assert.match(JSON.stringify(result.trace[0].steps), /技能代價.*活躍/)
              assert.match(JSON.stringify(result.trace[0].steps), scenario === 'self' ? /Pastel Meringue Cookie/ : /Pancake Cookie/)
            }
          }
        }
        if (scenario.startsWith('cancel')) {
          await panel.getByRole('button', { name: '取消技能', exact: true }).click()
          await panel.waitFor({ state: 'hidden' })
          result.after = await state(page)
          assert.deepEqual(result.after, result.before)
          assert.deepEqual(await trace(page), [])
          assert.equal(await skill.isEnabled(), true)
        }
      }
      assert.deepEqual(result.errors, [])
      assert.deepEqual(result.networkFailures, [])
      await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-result.png`) })
      result.status = 'PASS'
    } catch (error) {
      result.error = String(error.stack ?? error)
      result.debug = await page.locator('body').innerText().catch(() => '')
    } finally {
      results.push(result)
      await page.close()
    }
    console.log(`${result.status} ${scenario} ${viewport.width}${result.error ? ': ' + result.error.split('\n')[0] : ''}`)
    if (result.status !== 'PASS') throw new Error(result.error)
  }
} finally {
  await browser.close()
  writeFileSync(resolve(out, 'results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2) + '\n')
}
