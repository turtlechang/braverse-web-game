import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-005-browser')
mkdirSync(out, { recursive: true })
const records = JSON.parse(readFileSync(resolve(root, 'data/cards/official-festival-arena-bs12.en.json'), 'utf8')).cards
const referenceRecords = [
  JSON.parse(readFileSync(resolve(root, 'data/cards/official-promotion-p001-p032.en.json'), 'utf8')).cards.find(card => card.cardNumber === 'P-018'),
  JSON.parse(readFileSync(resolve(root, 'data/cards/official-a-game-of-truth-and-deceit-bs9.en.json'), 'utf8')).cards.find(card => card.cardNumber === 'BS9-032'),
  JSON.parse(readFileSync(resolve(root, 'data/cards/official-age-of-heroes-and-kingdoms-bs6.en.json'), 'utf8')).cards.find(card => card.cardNumber === 'BS6-008'),
]
const viewports = [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]
const cases = ['self', 'other', 'zero', 'cancel', 'normal-active', 'previous-turn', 'other-cookie', 'used', 'reentered', 'opponent-turn', 'rested-after-effect', 'enable', 'enable-zero']
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
  for (const viewport of viewports) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({ viewport })
    const result = { scenario, viewport, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), error: request.failure()?.errorText }))
    try {
      for (const record of [...records.filter(card => existsSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`))), ...referenceRecords]) {
        const number = record.cardNumber
        const path = resolve(root, `test-results/bs12-official-art/${number}.webp`)
        assert.ok(existsSync(path), `${number} original image bytes required`)
        await page.route(record.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(path) }))
      }
      const route = ['self', 'other', 'zero', 'cancel'].includes(scenario) ? 'positive' : scenario === 'enable-zero' ? 'enable' : scenario
      const testState = process.env.BS12_BROWSER_ROUTE === 'generic' && route === 'positive' ? 'card:BS12-005'
        : process.env.BS12_BROWSER_ROUTE === 'generic' && route === 'normal-active' ? 'card-negative:BS12-005' : `bs12-005:${route}`
      const genericPrintedParent = process.env.BS12_BROWSER_ROUTE === 'generic' && route === 'positive'
      result.testState = testState
      await page.goto(`${baseUrl}/?test-state=${testState}&contract-card=BS12-005,BS9-032,P-018,BS6-008`)
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-005-source"]')
      const image = source.locator('img').first()
      await image.evaluate(image => image.decode())
      assert.equal(await image.getAttribute('src'), records.find(card => card.cardNumber === 'BS12-005').imageUrl)
      const companionImage = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-005-companion"] img').first()
      await companionImage.evaluate(image => image.decode())
      assert.equal(await companionImage.getAttribute('src'), referenceRecords[0].imageUrl)
      const combatCards = page.locator('.combat-card-wrap')
      assert.equal(await combatCards.count(), 4)
      for (const combat of await combatCards.all()) {
        const face = combat.locator('img').first()
        await face.evaluate(image => image.decode())
        assert.ok([records.find(card => card.cardNumber === 'BS12-005').imageUrl,
          referenceRecords[0].imageUrl, referenceRecords[2].imageUrl].includes(await face.getAttribute('src')))
      }
      result.before = await state(page)
      result.setupTrace = await trace(page)
      assert.equal(result.before.top.deck, 20)
      if (scenario !== 'normal-active') assert.deepEqual(result.setupTrace.slice(0, 8).map(entry => entry.commandKind), [
        'declare-attack', 'deploy-cookie', 'begin-activate-skill', 'resolve-ability-effect',
        'resolve-ability-effect', 'resolve-next-damage', 'resolve-flip', 'resolve-draw-up-to',
      ])
      const actionTrace = async () => (await trace(page)).slice(result.setupTrace.length)
      result.scope = ['other-cookie', 'reentered', 'previous-turn', 'opponent-turn'].includes(scenario)
        ? 'Prepared history/timing control; not printed parent acceptance'
        : 'Original printed cards and actual attack/Mustard/Yoga parent commands'
      const skill = source.getByRole('button', { name: '啟動技能', exact: true })
      const needsEnabler = scenario === 'enable' || scenario === 'enable-zero' || genericPrintedParent
      if (needsEnabler) {
        const panel = page.locator('.effect-panel:visible')
        await panel.waitFor({ state: 'visible' })
        assert.match(await panel.innerText(), /Yoga Cookie/)
        if (scenario !== 'enable-zero') await panel.locator('.effect-candidate-entry > button').filter({ hasText: 'Cheerleader Cookie' }).click()
        await panel.getByRole('button', { name: '確認發動', exact: true }).click()
        await panel.waitFor({ state: 'hidden' })
        await settle(page)
        result.afterEnabler = await state(page)
        assert.equal(result.afterEnabler.bottom.battle[0].rested, scenario === 'enable-zero')
        assert.equal(result.afterEnabler.bottom.deck, 16)
        const enablerTrace = await actionTrace()
        assert.deepEqual(enablerTrace.map(entry => entry.commandKind), ['resolve-ability-effect'])
        if (scenario === 'enable-zero') {
          assert.equal(await skill.isEnabled(), false)
          assert.match(await source.innerText(), /尚未被效果設為活躍/)
          result.after = await state(page)
          result.trace = enablerTrace
          assert.deepEqual(result.after, result.before)
        }
      }
      if (['normal-active', 'previous-turn', 'other-cookie', 'used', 'reentered', 'opponent-turn'].includes(scenario)) {
        assert.ok(await skill.count() === 0 || !await skill.isEnabled())
        if (scenario !== 'opponent-turn') assert.match(await source.innerText(), scenario === 'used' ? /每回合一次/ : /尚未被效果設為活躍/)
        result.after = await state(page)
        result.trace = await actionTrace()
        assert.deepEqual(result.after, result.before)
        assert.deepEqual(result.trace, [])
      } else if (scenario !== 'enable-zero') {
        assert.equal(await skill.isEnabled(), true)
        await skill.click()
        const panel = page.locator('.effect-panel:visible')
        await panel.waitFor({ state: 'visible' })
        assert.match(await panel.innerText(), /BS12-005/)
        assert.match(await panel.innerText(), /每回合一次/)
        assert.match(await panel.innerText(), /可選 0 張/)
        const targets = panel.locator('.effect-candidate-entry > button')
        assert.equal(await targets.count(), 2)
        const names = await targets.allTextContents()
        assert.ok(names[0].includes('Cheerleader Cookie') && names[1].includes('Mustard Cookie'))
        const confirm = panel.getByRole('button', { name: '確認發動', exact: true })
        assert.equal(await confirm.isEnabled(), true)
        if (scenario === 'cancel') {
          await targets.nth(1).click()
          await panel.getByRole('button', { name: '取消技能', exact: true }).click()
          await panel.waitFor({ state: 'hidden' })
          result.after = await state(page)
          result.trace = await actionTrace()
          assert.deepEqual(result.after, needsEnabler ? result.afterEnabler : result.before)
          assert.deepEqual(result.trace.map(entry => entry.commandKind), needsEnabler ? ['resolve-ability-effect'] : [])
          assert.equal(await skill.isEnabled(), true)
        } else {
          if (scenario !== 'zero') {
            await targets.nth(scenario === 'self' ? 0 : 1).click()
            if (scenario === 'other') {
              await targets.nth(0).click()
              assert.equal(await targets.nth(0).getAttribute('aria-pressed'), 'false')
              assert.equal(await targets.nth(1).getAttribute('aria-pressed'), 'true')
            }
          }
          await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-selection.png`) })
          await confirm.click()
          await panel.waitFor({ state: 'hidden' })
          await settle(page)
          result.after = await state(page)
          result.trace = await actionTrace()
          assert.deepEqual(result.after.bottom.battle.map(card => card.hp), scenario === 'zero' ? [3, 4] : scenario === 'self' ? [4, 4] : [3, 5])
          assert.equal(result.after.bottom.deck, scenario === 'zero' ? 16 : 15)
          assert.equal(result.after.bottom.trash, 2)
          assert.deepEqual(result.after.bottom.support, result.before.bottom.support)
          assert.deepEqual(result.after.top, result.before.top)
          assert.equal(result.after.bottom.battle[0].rested, scenario === 'rested-after-effect')
          assert.equal(await skill.isEnabled(), false)
          assert.match(await source.innerText(), /每回合一次/)
          assert.deepEqual(result.trace.map(entry => entry.commandKind), needsEnabler
            ? ['resolve-ability-effect', 'begin-activate-skill', 'resolve-ability-effect']
            : ['begin-activate-skill', 'resolve-ability-effect'])
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
