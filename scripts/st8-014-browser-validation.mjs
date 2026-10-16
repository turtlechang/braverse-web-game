import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const card = JSON.parse(readFileSync(resolve(root, 'data/cards/official-st8-014-017.en.json'), 'utf8'))
  .cards.find(record => record.cardNumber === 'ST8-014')
assert.ok(card?.imageUrl, 'original printed ST8-014 record is required')
const imagePath = resolve(root, 'output/st6-st10/images/ST8-014.webp')
assert.ok(existsSync(imagePath), 'original printed ST8-014 image is required')
const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4184)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}`
const output = resolve(root, 'output/st6-st10/st8-014')
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')
const browserExecutable = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)

mkdirSync(output, { recursive: true })
const server = process.env.BRAVERSE_BASE_URL ? undefined : spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)
const wait = ms => new Promise(resolvePromise => setTimeout(resolvePromise, ms))
const waitForPreview = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(baseUrl)).ok) return
    } catch {
      // Vite preview is still starting.
    }
    await wait(100)
  }
  throw new Error(`Vite preview did not start at ${baseUrl}`)
}
const settle = page => page.waitForFunction(() =>
  !document.querySelector('.match-animation-layer[data-playing="true"]') &&
  ![...document.querySelectorAll('button')].some(button => button.textContent?.trim() === '略過目前演出'),
null, { timeout: 20000 })
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return {
      deck: count('.deck-zone .resource-summary > strong'),
      trash: count('.discard-zone.resource-summary > strong'),
      hand: field?.querySelectorAll('.hand-card-wrap').length ?? 0,
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({
        id: node.getAttribute('data-card-instance-id'),
        name: node.querySelector('img')?.getAttribute('alt') ?? '',
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
        rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
      })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(node => ({
        id: node.getAttribute('data-card-instance-id'),
        name: node.querySelector('img')?.getAttribute('alt') ?? '',
        rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
      })),
    }
  }
  return { own: side('bottom'), opponent: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({
  commandKind: entry.commandKind,
  summary: entry.summary,
  steps: entry.steps,
})))

const browserErrors = page => {
  const errors = []
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
  page.on('console', message => {
    if (message.type() !== 'error') return
    const text = message.text()
    const url = message.location().url ?? ''
    if (url.endsWith('/favicon.ico') && text.includes('404')) return
    if (url.includes('cookierunbraverse.com/data/en_storage/') && /ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(text)) return
    errors.push(`console: ${text} (${url || 'unknown URL'})`)
  })
  return errors
}

const viewports = [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]
const results = []
let browser
try {
  await waitForPreview()
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })

  for (const viewport of viewports) for (const scenario of ['positive', 'support-below-threshold']) {
    const page = await browser.newPage({ viewport })
    page.setDefaultTimeout(10000)
    const result = { card: 'ST8-014', scenario, viewport, status: 'FAIL', errors: [] }
    result.errors = browserErrors(page)

    try {
      const testState = scenario === 'positive' ? 'card:ST8-014' : 'card-negative:ST8-014'
      result.testState = testState
      await page.route(card.imageUrl, route => route.fulfill({
        status: 200,
        contentType: 'image/webp',
        body: readFileSync(imagePath),
      }))
      await page.goto(`${baseUrl}/?test-state=${testState}&contract-card=ST8-014`, { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      await settle(page)
      result.before = await state(page)
      assert.equal(result.before.own.support.length, scenario === 'positive' ? 5 : 4)
      assert.deepEqual(result.before.own.battle.map(cookie => cookie.hp), [3, 4, 2])
      await page.waitForFunction(imageUrl => [...document.images].some(image =>
        image.src === imageUrl && image.complete && image.naturalWidth > 0), card.imageUrl)
      result.originalArt = await page.evaluate(imageUrl => {
        const image = [...document.images].find(candidate => candidate.src === imageUrl)
        return image ? { src: image.src, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight } : null
      }, card.imageUrl)
      assert.ok(result.originalArt?.naturalWidth > 0 && result.originalArt.naturalHeight > 0,
        'the original printed ST8-014 art must render from the locally verified card image')

      const handItem = page.getByRole('button', { name: 'Cape of the Vanquisher', exact: true })
      assert.equal(await handItem.count(), 1, 'physical Item must be present in hand')
      await handItem.click()
      const use = page.getByRole('button', { name: '使用', exact: true })
      assert.equal(await use.count(), 1, 'the Item must expose its use action even if the support condition is false')
      await use.click()

      const paymentPanel = page.locator('.effect-panel:not(.is-complete):visible').first()
      await paymentPanel.waitFor({ state: 'visible' })
      assert.match(await paymentPanel.innerText(), /Cape of the Vanquisher/)
      const payment = paymentPanel.locator('.effect-candidates-payment .effect-candidate-entry > button')
      assert.equal(await payment.count(), 1, 'exactly one active green support can pay G')
      assert.match(await payment.first().innerText(), /Supreme Whipped Cream/)
      await payment.first().click()
      await page.screenshot({ path: resolve(output, `${scenario}-${viewport.width}-payment.png`), fullPage: true })
      assert.deepEqual(await trace(page), [], 'selecting payment must remain a draft until confirmed')
      const continueAction = page.locator('.effect-panel-primary-action:visible').last()
      assert.ok(await continueAction.isEnabled(), 'selected G payment must allow advancing to the target step')
      await continueAction.click()

      if (scenario === 'positive') {
        const targetPanel = page.locator('.effect-panel:not(.is-complete):visible').first()
        await targetPanel.waitFor({ state: 'visible' })
        assert.match(await targetPanel.innerText(), /最多 1 張我方餅乾.*可選 0 張/s)
        const targets = targetPanel.locator('.effect-candidates-target .effect-candidate-entry > button')
        assert.equal(await targets.count(), 1, 'only the green Cookie with at most 3 remaining HP is a legal target')
        assert.match(await targets.first().innerText(), /Wind Archer Cookie/)
        await targets.first().click()
        await page.screenshot({ path: resolve(output, `positive-${viewport.width}-target.png`), fullPage: true })
        await targetPanel.getByRole('button', { name: '確認發動', exact: true }).click()
      } else {
        await page.getByRole('status').filter({ hasText: /^Cape of the Vanquisher已支付代價；效果條件未滿足，效果未執行。$/ })
          .waitFor({ state: 'visible' })
      }

      await settle(page)
      result.after = await state(page)
      result.trace = await trace(page)
      const kinds = result.trace.map(entry => entry.commandKind)
      assert.ok(kinds.includes('begin-play-item'), `expected the real Item command, got ${kinds.join(', ')}`)
      if (scenario === 'positive') {
        assert.ok(kinds.includes('resolve-ability-effect'), `expected target effect resolution, got ${kinds.join(', ')}`)
      } else {
        assert.ok(result.trace.some(entry => entry.steps.join(' ').includes('條件不成立')),
          'the below-threshold Item command must record its no-op at settlement')
      }
      assert.equal(result.after.own.hand, 0)
      assert.equal(result.after.own.trash, result.before.own.trash + 1)
      assert.equal(result.after.own.support.length, result.before.own.support.length)
      assert.equal(result.after.own.support.filter(card => card.rested).length, result.before.own.support.filter(card => card.rested).length + 1)

      if (scenario === 'positive') {
        assert.deepEqual(result.after.own.battle.map(cookie => cookie.hp), [4, 4, 2])
        assert.equal(result.after.own.deck, result.before.own.deck - 1)
        assert.ok(result.trace.some(entry => entry.steps.join(' ').includes('Supreme Whipped Cream')))
      } else {
        assert.deepEqual(result.after.own.battle.map(cookie => cookie.hp), [3, 4, 2])
        assert.equal(result.after.own.deck, result.before.own.deck)
        assert.ok(result.trace.some(entry => entry.steps.join(' ').includes('條件不成立')))
        await page.getByTestId('battle-log-toggle').click()
        const activation = page.getByRole('button', { name: /使用了道具卡「Cape of the Vanquisher」/ })
        await activation.waitFor({ state: 'visible' })
        await activation.click()
        await page.getByText('道具效果結果：條件不成立，效果未執行。', { exact: true }).waitFor({ state: 'visible' })
      }

      result.status = 'PASS'
    } catch (error) {
      result.error = String(error.stack ?? error)
      result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 5000)
      throw error
    } finally {
      await page.screenshot({ path: resolve(output, `${scenario}-${viewport.width}-${result.status}.png`), fullPage: true }).catch(() => {})
      results.push(result)
      await page.close()
    }
  }
} finally {
  await writeFileSync(resolve(output, 'results.json'), JSON.stringify(results, null, 2))
  await browser?.close().catch(() => {})
  server?.kill()
}

console.log(JSON.stringify(results, null, 2))
