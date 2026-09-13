import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import bs9Candidates from '../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json' with { type: 'json' }

/**
 * BS9-021 Stolen Light of Truth 的實卡陷阱 A/B Browser 驗證：
 *
 * 正向選擇有 HP 的 Burning Spice Cookie，將其最上方 HP 搬到己方
 * Lassi Guard Kulfi 的 HP 最下方，並檢查新增卡片正面朝上。負向保留同一
 * 目標但讓 Burning Spice 沒有 HP，確認陷阱仍可支付、結算後不會捏造卡片。
 * 兩條路徑都以實際陷阱回應 UI 選擇對手與己方 Cookie。
 *
 * 這是 localhost candidate fixture；BS9-021 尚未進正式牌池，不能把這條
 * test-state 路徑解讀成正式牌組或線上對局已驗收。
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES
    ? [process.env.PLAYWRIGHT_NODE_MODULES]
    : [root],
})
const playwright = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwright.chromium ?? playwright.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_BS9_021_TEST_PORT ?? 4203)
const baseUrl = `http://127.0.0.1:${port}`
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')
const browserExecutable =
  process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find((candidate) => existsSync(candidate))
const outputDirectory = resolve(root, 'output/playwright')
mkdirSync(outputDirectory, { recursive: true })

const candidateRecord = bs9Candidates.cards.find((candidate) => candidate.cardNumber === 'BS9-021')
if (!candidateRecord) throw new Error('Missing BS9 candidate BS9-021')

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const visibleTrap = (page) => page.locator('.trap-response-modal:visible').first()
const readTrace = (page) => page.evaluate(() => window.__braverseContractTrace ?? [])

const recordBrowserErrors = (page) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const location = message.location()
    const messageText = message.text()
    if (location.url?.endsWith('/favicon.ico') && messageText.includes('404')) return
    // The fixture intentionally keeps official image URLs. CardFace renders a
    // named fallback when the current environment blocks those requests.
    if (
      location.url?.includes('cookierunbraverse.com/data/en_storage/') &&
      /ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(messageText)
    ) return
    errors.push(`console: ${messageText} (${location.url || 'unknown URL'})`)
  })
  return errors
}

const waitForGame = async (page) => {
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await page.waitForTimeout(250)
}

const fieldCard = (page, position, instanceId) =>
  page.locator(`.${position}-field [data-card-instance-id="${instanceId}"]`).first()

const readHp = async (page, position, instanceId) => {
  const card = fieldCard(page, position, instanceId)
  await card.waitFor({ state: 'visible' })
  const text = await card.locator('.badge-hp').first().innerText()
  const match = text.match(/(\d+)\s*\//)
  if (!match) throw new Error(`Cannot read HP badge for ${instanceId}: ${text}`)
  return Number(match[1])
}

const assertPhysicalCard = async (cardLocator, cardName) => {
  await cardLocator.waitFor({ state: 'visible' })
  const fallback = cardLocator.locator('.card-fallback')
  const image = cardLocator.locator('img')
  const fallbackText = (await fallback.count()) > 0
    ? (await fallback.allInnerTexts()).join(' ')
    : ''
  const imageAlts = (await image.count()) > 0
    ? await image.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('alt')),
      )
    : []
  assert.ok(
    fallbackText.includes(cardName) || imageAlts.includes(cardName),
    `${cardName} must be visible in the physical card face`,
  )
}

const assertExactCardImage = async (page, record, exactImageRequested) => {
  const exactImage = page.locator(`img[src="${record.imageUrl}"]`).first()
  await exactImage.waitFor({ state: 'visible' })
  await exactImage.evaluate((node) => {
    if (!(node instanceof HTMLImageElement)) {
      throw new Error('official card image locator did not resolve to an img')
    }
    if (node.complete && node.naturalWidth > 0) return undefined
    return new Promise((resolvePromise, rejectPromise) => {
      const timeout = window.setTimeout(() => {
        cleanup()
        rejectPromise(new Error('official image load timed out'))
      }, 10_000)
      const cleanup = () => {
        window.clearTimeout(timeout)
        node.removeEventListener('load', onLoad)
        node.removeEventListener('error', onError)
      }
      const onLoad = () => {
        cleanup()
        if (node.naturalWidth > 0) resolvePromise()
        else rejectPromise(new Error('official image loaded with zero naturalWidth'))
      }
      const onError = () => {
        cleanup()
        rejectPromise(new Error('official image failed to load'))
      }
      node.addEventListener('load', onLoad, { once: true })
      node.addEventListener('error', onError, { once: true })
    })
  })
  const exactImageRendered = (await exactImage.count()) > 0
  const exactImageLoaded = await exactImage.evaluate(
    (node) => node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0,
  )
  assert.equal(exactImageRequested, true, `${record.cardNumber} exact official image request must be observed`)
  assert.equal(exactImageRendered, true, `${record.cardNumber} must render its exact official image URL`)
  assert.equal(exactImageLoaded, true, `${record.cardNumber} official image must be loaded, not merely requested`)
  return { exactImageRequested, exactImageRendered, exactImageLoaded }
}

const waitForTrapResolution = async (page) => {
  await page.waitForFunction(
    () => {
      const dialogs = Array.from(document.querySelectorAll('[role="alertdialog"]'))
      const visible = dialogs.some((dialog) => {
        const style = window.getComputedStyle(dialog)
        const rect = dialog.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' &&
          rect.width > 0 && rect.height > 0
      })
      return !visible &&
        (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === 'play-trap')
    },
    undefined,
    { timeout: 7000 },
  )
  await page.waitForTimeout(250)
}

const runCase = async (browser, viewport, negative) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(7000)
  const errors = recordBrowserErrors(page)
  let exactImageRequested = false
  page.on('request', (request) => {
    if (request.url() === candidateRecord.imageUrl) exactImageRequested = true
  })
  const route = negative ? 'card-negative:BS9-021' : 'card:BS9-021'
  const result = {
    route,
    viewport,
    status: 'FAIL',
    actions: [],
    expectedImageUrl: candidateRecord.imageUrl,
  }
  const donorId = 'bs9-trap-donor'
  const receiverId = 'bs9-trap-receiver'

  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=BS9-021`,
      { waitUntil: 'domcontentloaded' },
    )
    await waitForGame(page)
    const modal = visibleTrap(page)
    await modal.waitFor({ state: 'visible' })
    const trapCard = modal.locator('.modal-card-options button').filter({ hasText: 'Stolen Light of Truth' }).first()
    await assertPhysicalCard(trapCard, 'Stolen Light of Truth')
    result.imageEvidence = await assertExactCardImage(page, candidateRecord, exactImageRequested)
    result.actions.push('inspect-trap-card-and-text')

    await modal.locator('.modal-card-options button').filter({ hasText: 'Stolen Light of Truth' }).first().click()
    assert.match(await modal.innerText(), /Select up to 1 of your opponent's Cookies/i)
    const paymentCards = modal.locator('.trap-discard-options button')
    assert.equal(await paymentCards.count(), 6, 'BS9-021 should expose six payment cards')
    for (let index = 0; index < 3; index += 1) await paymentCards.nth(index).click()
    assert.match(await modal.innerText(), /已選 3／3/)
    await modal.getByRole('button', { name: '下一步', exact: true }).click()
    result.actions.push('pay-three-red-energy')

    const targetStep = modal.locator('.trap-effect-target-step').first()
    await targetStep.waitFor({ state: 'visible' })
    assert.match(await targetStep.innerText(), /最多 1 張/)
    const targetButtons = targetStep.locator('button').filter({ hasNotText: '略過' })
    assert.equal(await targetButtons.count(), 2, 'BS9-021 should show two opponent Cookies')
    // Clicking a second Cookie replaces the first selection; it cannot turn
    // the printed “up to 1” into a two-Cookie selection.
    await targetButtons.filter({ hasText: 'Dark Choco Cookie' }).click()
    await targetButtons.filter({ hasText: 'Burning Spice Cookie' }).click()
    assert.equal(await targetStep.locator('button.is-selected').count(), 1)
    assert.equal(await targetStep.locator('button.is-selected').filter({ hasText: 'Burning Spice Cookie' }).count(), 1)
    await modal.getByRole('button', { name: '下一步', exact: true }).click()
    result.actions.push('select-one-opponent-cookie')

    const selfButtons = modal.locator('.trap-target-options button')
    assert.equal(await selfButtons.count(), 2, 'BS9-021 should show two own receiver Cookies')
    await selfButtons.filter({ hasText: 'Lassi Guard Kulfi' }).click()
    await modal.getByRole('button', { name: '確認發動', exact: true }).click()
    await waitForTrapResolution(page)
    result.actions.push('select-own-receiver-and-confirm')

    const before = {
      donor: negative ? 0 : 5,
      receiver: 5,
    }
    const after = {
      donor: await readHp(page, 'top', donorId),
      receiver: await readHp(page, 'bottom', receiverId),
    }
    if (negative) {
      assert.deepEqual(after, { donor: 0, receiver: 1 })
      assert.equal(
        await fieldCard(page, 'bottom', receiverId).locator('.hp-card[title="Soul Jam: Light of Destruction"]').count(),
        0,
        'no-HP donor must not create a face-up receiver card',
      )
    } else {
      assert.deepEqual(after, { donor: 4, receiver: 2 })
      const receiver = fieldCard(page, 'bottom', receiverId)
      const movedCard = receiver.locator('.hp-card[title="Soul Jam: Light of Destruction"]').first()
      await movedCard.waitFor({ state: 'visible' })
      assert.equal(await movedCard.getAttribute('aria-label'), null)
      assert.equal(await movedCard.getAttribute('title'), 'Soul Jam: Light of Destruction')
      result.actions.push('verify-face-up-hp-at-bottom')
    }

    const trace = await readTrace(page)
    const playEntry = trace.find((entry) => entry.commandKind === 'play-trap')
    assert.ok(playEntry, 'BS9-021 should leave a play-trap trace')
    assert.match(playEntry.steps.join('；'), /Burning Spice Cookie/)
    assert.match(playEntry.steps.join('；'), /Lassi Guard Kulfi/)
    if (negative) {
      assert.equal(playEntry.steps.some((step) => step.includes('HP 放置')), false)
    } else {
      assert.match(playEntry.steps.join('；'), /正面朝上/)
      assert.match(playEntry.steps.join('；'), /最下方/)
    }
    assert.equal(await page.locator('[role="alertdialog"]:visible').count(), 0)
    assert.deepEqual(errors, [], `BS9-021 ${negative ? 'negative' : 'positive'} browser errors: ${errors.join('; ')}`)
    result.before = before
    result.after = after
    result.trace = trace
    result.exactImageRequested = exactImageRequested
    result.exactImageRendered = result.imageEvidence.exactImageRendered
    result.exactImageLoaded = result.imageEvidence.exactImageLoaded
    result.status = 'PASS'
    result.screenshot = resolve(
      outputDirectory,
      `bs9-021-${negative ? 'negative' : 'positive'}-${viewport.width}x${viewport.height}.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true })
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 7000)
    result.trace = await readTrace(page).catch(() => [])
    result.screenshot = resolve(
      outputDirectory,
      `bs9-021-${negative ? 'negative' : 'positive'}-${viewport.width}x${viewport.height}-failed.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true }).catch(() => {})
  } finally {
    await page.close()
  }
  return result
}

const preview = spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)

const waitForPreview = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (preview.exitCode !== null) {
      throw new Error(`Vite preview exited before serving on ${baseUrl}`)
    }
    try {
      if ((await fetch(baseUrl)).ok) return
    } catch {
      // Preview is still starting.
    }
    await wait(100)
  }
  throw new Error(`Vite preview did not start on ${baseUrl}`)
}

const results = []
let browser
try {
  await waitForPreview()
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })
  for (const viewport of [
    { width: 1907, height: 863 },
    { width: 1164, height: 777 },
  ]) {
    results.push(await runCase(browser, viewport, false))
    results.push(await runCase(browser, viewport, true))
  }
} finally {
  await browser?.close()
  if (preview.exitCode === null) preview.kill()
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  scope: 'BS9-021 Stolen Light of Truth: opponent top HP to own Cookie bottom face-up, positive and no-HP negative.',
  total: results.length,
  passed: results.filter((result) => result.status === 'PASS').length,
  failed: results.filter((result) => result.status !== 'PASS'),
  results,
}
writeFileSync(
  resolve(outputDirectory, 'bs9-021-browser.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
process.exitCode = report.failed.length > 0 ? 1 : 0
