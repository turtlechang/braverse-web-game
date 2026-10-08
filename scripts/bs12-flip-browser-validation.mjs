import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const root = resolve('.')
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-flip-browser')
mkdirSync(out, { recursive: true })
const candidateRecords = JSON.parse(readFileSync('data/candidates/official-festival-arena-bs12.en.json', 'utf8')).cards
const formalRecords = readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json'))
  .flatMap(file => JSON.parse(readFileSync(resolve(root, 'data/cards', file), 'utf8')).cards ?? [])
const records = [...candidateRecords, ...formalRecords]
const requiredArtNumbers = ['BS12-001', 'BS12-002', 'BS12-003', 'BS12-004', 'BS12-006', 'BS12-019', 'BS12-024', 'BS12-028', 'BS6-017', 'ST4-001']
const artRecords = requiredArtNumbers.map(cardNumber => {
  const record = records.find(card => card.cardNumber === cardNumber)
  const path = resolve(root, 'test-results/bs12-official-art', `${cardNumber}.webp`)
  assert.ok(record, `${cardNumber} official card record required`)
  assert.ok(existsSync(path), `${cardNumber} original card art bytes required`)
  return { record, path }
})
const baseUrl = process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'
const viewports = [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]
const cases = [
  ...['positive', 'zero', 'skip', 'no-hand', 'no-arena', 'two-targets'].map((scenario) => ({ number: 'BS12-002', scenario })),
  ...['positive', 'zero', 'skip', 'no-arena', 'wrong-color', 'two-targets'].map((scenario) => ({ number: 'BS12-004', scenario })),
]
const state = (page) => page.evaluate(() => {
  const side = (name) => {
    const field = document.querySelector(`.${name}-field`)
    const count = (selector) => Number(field?.querySelector(selector)?.textContent?.match(/\d+/)?.[0] ?? NaN)
    return {
      deck: count('.deck-zone .resource-summary > strong'),
      trash: count('.discard-zone.resource-summary > strong'),
      hand: field?.querySelectorAll('.hand-card').length ?? 0,
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map((node) => ({
        id: node.getAttribute('data-card-instance-id'),
        name: node.querySelector('.card-face:not(.hp-card) img')?.getAttribute('alt') ?? null,
        artUrl: node.querySelector('.card-face:not(.hp-card) img')?.getAttribute('src') ?? null,
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
      })),
      break: [...(field?.querySelectorAll('.break-zone img') ?? [])].map(image => ({ name: image.alt, artUrl: image.getAttribute('src') })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = (page) => page.evaluate(() => (window.__braverseContractTrace ?? []).map((entry) => ({ commandKind: entry.commandKind, steps: entry.steps })))
const assertCardArt = async (page, selector, cardNumber) => {
  const record = records.find(card => card.cardNumber === cardNumber)
  assert.ok(record, `${cardNumber} official card record required`)
  const image = page.locator(selector).locator('button.card-face:not(.hp-card) img').first()
  await image.evaluate(element => element.decode())
  assert.equal(await image.getAttribute('alt'), record.name)
  assert.equal(await image.getAttribute('src'), record.imageUrl)
}
const readMountedOriginalArt = (page) => page.evaluate(async expected => {
  const byUrl = new Map(expected.map(card => [card.url, card]))
  const mounted = [...document.images].filter(image => byUrl.has(image.src))
  return Promise.all(mounted.map(async image => {
    await image.decode()
    if (!image.naturalWidth) throw new Error(`Original card art failed: ${image.src}`)
    return { cardNumber: byUrl.get(image.src).cardNumber, url: image.src, alt: image.alt, naturalWidth: image.naturalWidth }
  }))
}, artRecords.map(({ record }) => ({ cardNumber: record.cardNumber, url: record.imageUrl })))
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const results = []
try {
  for (const viewport of viewports) {
    for (const { number, scenario } of cases.filter(testCase => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(`${testCase.number}:${testCase.scenario}`))) {
      const page = await browser.newPage({ viewport })
      const result = { card: number, scenario, viewport, status: 'FAIL', errors: [], networkFailures: [] }
      page.on('pageerror', (error) => result.errors.push(error.message))
      page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
      page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText }))
      page.setDefaultTimeout(15000)
      for (const { record, path } of artRecords) {
        await page.route(record.imageUrl, (route) => route.fulfill({ contentType: 'image/webp', body: readFileSync(path) }))
      }
      try {
        const route = ['no-hand', 'no-arena', 'wrong-color', 'two-targets'].includes(scenario) ? scenario : 'positive'
        await page.goto(`${baseUrl}/?test-state=bs12-flip:${number}:${route}&contract-card=${number}`)
        await page.locator('.game-shell').waitFor({ state: 'visible' })
        result.before = await state(page)
        assert.equal(result.before.top.battle[0].name, 'Pink Choco Cookie')
        assert.equal(result.before.top.battle[0].hp, 1)
        assert.equal(result.before.top.battle[0].artUrl, records.find(card => card.cardNumber === 'BS6-017').imageUrl)
        if (number === 'BS12-004' && ['positive', 'two-targets'].includes(scenario)) {
          assert.equal(result.before.top.battle[1].id, 'bs12-opponent-other')
          assert.equal(result.before.top.battle[1].name, 'Muscle Cookie')
          assert.equal(result.before.top.battle[1].hp, 4)
          assert.equal(result.before.top.battle[1].artUrl, records.find(card => card.cardNumber === 'BS12-019').imageUrl)
        }
        await assertCardArt(page, '.top-field .combat-card-wrap[data-card-instance-id="bs12-flip-attacker"]', 'BS6-017')
        const bearerNumber = number === 'BS12-002' && scenario === 'no-arena' ? 'ST4-001' : 'BS12-001'
        const companionNumber = scenario === 'wrong-color' ? 'BS12-024' : scenario === 'no-arena' ? 'ST4-001' : number === 'BS12-004' || scenario === 'two-targets' ? 'BS12-006' : 'ST4-001'
        const companionInstanceId = companionNumber === 'ST4-001' ? 'bs12-non-arena' : 'bs12-arena-companion'
        await assertCardArt(page, '.bottom-field .combat-card-wrap[data-card-instance-id="bs12-flip-bearer"]', bearerNumber)
        await assertCardArt(page, `.bottom-field .combat-card-wrap[data-card-instance-id="${companionInstanceId}"]`, companionNumber)
        for (const opponent of result.before.top.battle.slice(1)) {
          const printed = records.find(card => card.imageUrl === opponent.artUrl)
          assert.ok(printed, `Missing printed reference for ${opponent.name}`)
          await assertCardArt(page, `.top-field .combat-card-wrap[data-card-instance-id="${opponent.id}"]`, printed.cardNumber)
        }
        if (number === 'BS12-004' && ['no-arena', 'wrong-color'].includes(scenario)) {
          await page.waitForFunction(() => document.querySelector('.bottom-field .discard-zone.resource-summary > strong')?.textContent === '1')
          assert.equal(await page.locator('.flip-response-modal').count(), 0)
          result.after = await state(page)
          result.trace = await trace(page)
          assert.equal(result.after.top.battle[0].name, 'Pink Choco Cookie')
          assert.equal(result.after.top.battle[0].hp, 1)
          assert.equal(result.after.bottom.battle[0].hp, 1)
          const companionName = scenario === 'wrong-color' ? 'GingerBrave' : 'Candy Diver Cookie'
          const companionHp = scenario === 'wrong-color' ? 2 : 3
          assert.equal(result.before.bottom.battle[1].id, companionInstanceId)
          assert.equal(result.before.bottom.battle[1].name, companionName)
          assert.equal(result.before.bottom.battle[1].hp, companionHp)
          assert.equal(result.after.bottom.battle[1].name, companionName)
          assert.equal(result.after.bottom.battle[1].hp, companionHp)
          assert.equal(result.after.bottom.deck, 10)
          assert.equal(result.trace.some((entry) => entry.commandKind === 'resolve-flip'), false)
          result.mountedOriginalArt = await readMountedOriginalArt(page)
          assert.ok(result.mountedOriginalArt.length > 0)
          assert.deepEqual(result.errors, [])
          assert.deepEqual(result.networkFailures, [])
          await page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-blocked.png`) })
          result.status = 'PASS'
          results.push(result)
          console.log(`PASS ${number} ${scenario} ${viewport.width}`)
          continue
        }
        const dialog = page.locator('.flip-response-modal')
        await dialog.waitFor({ state: 'visible' })
        result.before = await state(page)
        assert.equal(result.before.top.battle[0].name, 'Pink Choco Cookie')
        assert.equal(result.before.top.battle[0].hp, 1)
        const name = records.find((card) => card.cardNumber === number).name
        const art = dialog.locator(`img[alt="${name}"]`).first()
        await art.evaluate((image) => image.decode())
        assert.equal(await art.getAttribute('src'), records.find((card) => card.cardNumber === number).imageUrl)
        result.before = await state(page)
        const candidates = dialog.locator('.flip-choice-options[aria-label="FLIP 效果目標"] > button')
        result.candidates = await candidates.locator(':scope > span').allTextContents()
        const expectedCandidates = number === 'BS12-004'
          ? result.before.top.battle.map(card => card.name)
          : result.before.bottom.battle.filter(card => {
            const printed = records.find(record => record.imageUrl === card.artUrl)
            assert.ok(printed, `Missing printed reference for ${card.name}`)
            return printed.keywords?.includes('Arena')
          }).map(card => card.name)
        assert.deepEqual(result.candidates.map((text) => text.trim()), expectedCandidates)
        const activate = dialog.getByRole('button', { name: '發動 FLIP', exact: true })
        const decline = dialog.getByRole('button', { name: '不發動', exact: true })
        if (scenario === 'no-hand') {
          assert.equal(await activate.isEnabled(), false)
          await decline.click()
        } else if (scenario === 'skip') {
          await decline.click()
        } else {
          if (scenario === 'positive') {
            await candidates.first().click()
            assert.equal(await candidates.first().getAttribute('aria-pressed'), 'true')
            if (number === 'BS12-004') assert.equal(await candidates.nth(1).getAttribute('aria-pressed'), 'false')
          }
          if (scenario === 'two-targets') {
            await candidates.nth(1).click()
            assert.equal(await dialog.locator('.flip-choice-options[aria-label="FLIP 效果目標"] > button[aria-pressed="true"]').count(), 1)
            assert.equal(await candidates.nth(1).getAttribute('aria-pressed'), 'true')
          }
          if (number === 'BS12-002') {
            const handCostImage = dialog.locator('.flip-hand-carousel img[alt="Luxury Red Carpet"]').first()
            await handCostImage.evaluate(image => image.decode())
            assert.equal(await handCostImage.getAttribute('src'), records.find(card => card.cardNumber === 'BS12-028').imageUrl)
            await handCostImage.click()
          }
          assert.equal(await activate.isEnabled(), true)
          await page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-selection.png`) })
          await activate.click()
        }
        await page.waitForFunction(() => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === 'resolve-flip'))
        await dialog.waitFor({ state: 'hidden' })
        result.afterResolution = await state(page)
        result.trace = await trace(page)
        const gainsHp = number === 'BS12-002' && ['positive', 'two-targets'].includes(scenario)
        const damages = number === 'BS12-004' && ['positive', 'two-targets'].includes(scenario)
        const pays = number === 'BS12-002' && !['no-hand', 'skip'].includes(scenario)
        assert.equal(result.afterResolution.bottom.battle.find((card) => card.id === 'bs12-flip-bearer')?.hp, gainsHp && scenario !== 'two-targets' ? 2 : 1)
        assert.equal(result.afterResolution.bottom.battle[1].hp, gainsHp && scenario === 'two-targets' ? 4 : 3)
        assert.equal(result.before.bottom.deck - result.afterResolution.bottom.deck, gainsHp ? 1 : 0)
        assert.equal(result.afterResolution.bottom.trash - result.before.bottom.trash, pays ? 2 : 1)
        if (number === 'BS12-004' && scenario === 'positive') {
          assert.deepEqual(result.afterResolution.top.battle.map((card) => ({ id: card.id, name: card.name, hp: card.hp })), [
            { id: 'bs12-opponent-other', name: 'Muscle Cookie', hp: 4 },
          ])
          assert.equal(result.afterResolution.top.trash - result.before.top.trash, 1)
          await page.locator('.top-field .break-zone img[alt="Pink Choco Cookie"]').waitFor({ state: 'visible' })
          const logToggle = page.getByTestId('battle-log-toggle')
          await logToggle.click()
          const logSidebar = page.getByTestId('battle-log-sidebar')
          await logSidebar.waitFor({ state: 'visible' })
          const logEntries = logSidebar.locator('.battle-log-entry.is-expandable')
          for (let index = 0; index < await logEntries.count(); index += 1) {
            const entry = logEntries.nth(index)
            if (await entry.getAttribute('aria-expanded') !== 'true') await entry.click()
          }
          await page.waitForFunction(() => document.querySelector('[data-testid="battle-log-sidebar"]')?.textContent?.includes('AI 對手 選擇不補位'))
          result.publicCommandLogText = await logSidebar.innerText()
          assert.match(result.publicCommandLogText, /AI 對手 選擇不補位/)
          result.after = await state(page)
          result.trace = await trace(page)
          assert.deepEqual(result.after.top.battle.map((card) => ({ id: card.id, name: card.name, hp: card.hp })), [
            { id: 'bs12-opponent-other', name: 'Muscle Cookie', hp: 4 },
          ])
          assert.equal(result.after.top.trash - result.before.top.trash, 1)
          assert.ok(result.after.top.break.some(card => card.name === 'Pink Choco Cookie'))
          assert.equal(await page.locator('.decision-modal').count(), 0)
          assert.equal(await page.locator('.result-modal').count(), 0)
        } else {
          result.after = result.afterResolution
        }
        if (number === 'BS12-004' && scenario === 'two-targets') {
          assert.deepEqual(result.after.top.battle.map((card) => ({ name: card.name, hp: card.hp })), [
            { name: 'Pink Choco Cookie', hp: 1 }, { name: records.find(card => card.cardNumber === 'BS12-019').name, hp: 3 },
          ])
        } else if (number === 'BS12-004' && scenario !== 'positive') {
          assert.equal(result.after.top.battle[0].name, 'Pink Choco Cookie')
          assert.equal(result.after.top.battle[0].hp, 1)
        }
        result.mountedOriginalArt = await readMountedOriginalArt(page)
        assert.ok(result.mountedOriginalArt.length > 0)
        assert.deepEqual(result.errors, [])
        if (number === 'BS12-002' && scenario === 'two-targets') {
          assert.ok(result.trace.some(entry => entry.steps.some(step => step.includes('Pastel Meringue Cookie'))))
        }
        assert.deepEqual(result.errors, [])
        assert.deepEqual(result.networkFailures, [])
        await page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-result.png`) })
        result.status = 'PASS'
      } catch (error) {
        result.error = String(error.stack ?? error)
        result.debug = await page.locator('body').innerText().catch(() => '')
      } finally {
        await page.close()
      }
      results.push(result)
      console.log(`${result.status} ${number} ${scenario} ${viewport.width}${result.error ? ': ' + result.error.split('\n')[0] : ''}`)
      if (result.status !== 'PASS') throw new Error(result.error)
    }
  }
} finally {
  await browser.close()
  writeFileSync(resolve(out, 'results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2) + '\n')
}
