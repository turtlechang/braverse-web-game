import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import bs9Candidates from '../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json' with { type: 'json' }

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightRoot = process.env.PLAYWRIGHT_NODE_MODULES
const playwrightEntry = require.resolve('playwright', {
  paths: playwrightRoot ? [playwrightRoot] : [root],
})
const playwright = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwright.chromium ?? playwright.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_BS9_TEST_PORT ?? 4184)
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

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const outputDirectory = resolve(root, 'test-results')
mkdirSync(outputDirectory, { recursive: true })

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
  throw new Error(`Vite preview did not start at ${baseUrl}`)
}

const recordBrowserErrors = (page) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const location = message.location()
    if (location.url?.endsWith('/favicon.ico')) return
    if (
      location.url?.includes('cookierunbraverse.com/data/en_storage/') &&
      /ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(message.text())
    ) return
    errors.push(`console: ${message.text()} (${location.url || 'unknown URL'})`)
  })
  return errors
}

const readTrace = async (page) =>
  page.evaluate(() => window.__braverseContractTrace ?? [])

const waitForTrace = async (page) => {
  await page.waitForFunction(
    () => Array.isArray(window.__braverseContractTrace) &&
      window.__braverseContractTrace.some((entry) => entry.commandKind === 'resolve-flip'),
    undefined,
    { timeout: 7_000 },
  )
  return readTrace(page)
}

const candidateRecord = (cardNumber) => {
  const record = bs9Candidates.cards.find((candidate) => candidate.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS9 candidate ${cardNumber}`)
  return record
}

const assertPhysicalCardImage = async (locator, record, exactImageRequested) => {
  await locator.waitFor({ state: 'visible' })
  const exactImage = locator.locator(`img[src="${record.imageUrl}"]`).first()
  await exactImage.waitFor({ state: 'visible' })
  await exactImage.evaluate((node) => {
    if (node instanceof HTMLImageElement && (!node.complete || node.naturalWidth === 0)) {
      return new Promise((resolvePromise, rejectPromise) => {
        node.addEventListener('load', () => resolvePromise(), { once: true })
        node.addEventListener('error', () => rejectPromise(new Error('official image failed to load')), { once: true })
      })
    }
    return undefined
  })
  const alts = await locator.locator('img').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('alt'))).catch(() => [])
  assert.ok(alts.includes(record.name), `${record.cardNumber} must render its named official card face`)
  const exactImageRendered = await exactImage.count() > 0
  const exactImageLoaded = await exactImage.evaluate((node) => node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0)
  assert.equal(exactImageRendered, true, `${record.cardNumber} must render its exact official image URL`)
  assert.equal(exactImageLoaded, true, `${record.cardNumber} official image must be loaded, not merely requested`)
  return { exactImageRendered, exactImageLoaded, exactImageRequested }
}

const runScenario = async (browser, viewport, cardNumber, negative) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(7_000)
  const errors = recordBrowserErrors(page)
  const record = candidateRecord(cardNumber)
  let exactImageRequested = false
  page.on('request', (request) => {
    if (request.url() === record.imageUrl) exactImageRequested = true
  })
  const route = `${negative ? 'bs9-card-negative' : 'bs9-card'}:${cardNumber}`
  const result = {
    card: cardNumber,
    viewport,
    negative,
    route,
    expectedImageUrl: record.imageUrl,
    targetCount: 0,
    actions: [],
  }

  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${cardNumber.replace(/@\d+$/, '')}`,
      { waitUntil: 'domcontentloaded' },
    )
    await page.locator('.game-shell').waitFor({ state: 'visible' })

    const modal = page.locator('.flip-response-modal[role="alertdialog"]')
    await modal.waitFor({ state: 'visible' })
    result.imageEvidence = await assertPhysicalCardImage(
      modal.locator('.flip-reveal-card'),
      record,
      exactImageRequested,
    )
    assert.match(
      await modal.locator('h2').innerText(),
      /Icicle Yeti Cookie FLIP/,
      'FLIP modal must identify the revealed BS9-001 card',
    )
    assert.match(
      await modal.innerText(),
      /Select up to 1 of your Cookies\. During this turn, that Cookie receives -2 effect damage\./,
      'FLIP modal must expose the converted official effect text',
    )

    const targetGroup = modal.locator(
      '.flip-choice-options[aria-label="FLIP 效果目標"]',
    )
    const targetButtons = targetGroup.locator('button')
    result.targetCount = await targetButtons.count()
    result.targetNames = await targetButtons.evaluateAll((buttons) =>
      buttons.map((button) => button.innerText.trim()),
    )
    const playerArea = page.getByRole('region', { name: '玩家場地' })
    const attackedCookieHp = playerArea.locator(
      '[aria-label="Lassi Guard Kulfi HP 卡 4 張"]',
    )
    assert.equal(
      await attackedCookieHp.count(),
      1,
      'the attacked Cookie must already show one lost HP while its FLIP is pending',
    )
    const modalScreenshotPath = resolve(
      outputDirectory,
      `bs9-001-${cardNumber.replace('@', '-at-')}-${negative ? 'negative' : 'positive'}-${viewport.width}x${viewport.height}-modal.png`,
    )
    await page.screenshot({ path: modalScreenshotPath, fullPage: true })
    result.modalScreenshot = modalScreenshotPath

    if (negative) {
      assert.equal(
        result.targetCount,
        2,
        'negative route keeps the optional target selector available for a real skip path',
      )
      await modal.getByRole('button', { name: '不發動', exact: true }).click()
      result.actions.push('skip-flip')
      await modal.waitFor({ state: 'hidden' })
    } else {
      assert.equal(result.targetCount, 2, 'positive route must expose two own Cookie targets')
      // Select Pomegranate so the attack target remains a visible HP witness
      // while the selected modifier is carried through the battle command.
      await targetButtons.nth(1).click()
      result.actions.push('select-one-target')
      assert.equal(
        await targetGroup.locator('button.is-selected').count(),
        1,
        'FLIP target selector must allow exactly one selected Cookie',
      )
      const activate = modal.getByRole('button', { name: '發動 FLIP', exact: true })
      assert.equal(await activate.isEnabled(), true, 'one optional target must make FLIP activatable')
      await activate.click()
      result.actions.push('activate-flip')
      await modal.waitFor({ state: 'hidden' })
    }

    const trace = await waitForTrace(page)
    const completedAttackedCookieHp = playerArea.locator(
      '[aria-label="Lassi Guard Kulfi HP 卡 3 張"]',
    )
    await completedAttackedCookieHp.waitFor({ state: 'visible' })
    assert.equal(
      await completedAttackedCookieHp.count(),
      1,
      'BS1-007 second attack damage must resolve after the BS9-001 FLIP decision',
    )
    result.effectWitness = {
      kind: 'optional-target-selection-and-attack-continuation',
      selectedTarget: negative ? null : result.targetNames[1] ?? null,
      attackTargetHpBefore: 4,
      attackTargetHpAfter: 3,
      attackDamageContinued: true,
    }
    result.trace = trace
    result.observedCommandKinds = [...new Set(trace.map((entry) => entry.commandKind))]
    result.finalPendingSurfaces = await page.locator('[role="alertdialog"]:visible').count()
    assert.equal(result.finalPendingSurfaces, 0, 'Browser route must settle without a pending dialog')
    const flipEntry = trace.find((entry) => entry.commandKind === 'resolve-flip')
    assert.ok(flipEntry, 'public contract trace must include resolve-flip')
    if (negative) {
      assert.match(
        `${flipEntry.summary ?? ''} ${flipEntry.steps.join(' ')}`,
        /略過|不發動|未執行/,
        'negative route must record that FLIP was skipped',
      )
    } else {
      assert.doesNotMatch(
        `${flipEntry.summary ?? ''} ${flipEntry.steps.join(' ')}`,
        /略過|不發動|未執行/,
        'positive route must not record a skipped FLIP',
      )
    }
    result.errors = errors
    result.exactImageRequested = exactImageRequested
    result.exactImageRendered = result.imageEvidence?.exactImageRendered ?? false
    result.exactImageLoaded = result.imageEvidence?.exactImageLoaded ?? false
    assert.equal(errors.length, 0, `browser errors: ${errors.join('; ')}`)
    const screenshotPath = resolve(
      outputDirectory,
      `bs9-001-${cardNumber.replace('@', '-at-')}-${negative ? 'negative' : 'positive'}-${viewport.width}x${viewport.height}.png`,
    )
    await page.screenshot({ path: screenshotPath, fullPage: true })
    result.screenshot = screenshotPath
    result.status = 'PASS'
  } catch (error) {
    result.status = 'FAIL'
    result.error = error instanceof Error ? error.message : String(error)
    result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 5000)
    await page.screenshot({
      path: resolve(
        outputDirectory,
        `bs9-001-${cardNumber.replace('@', '-at-')}-${negative ? 'negative' : 'positive'}-${viewport.width}x${viewport.height}.png`,
      ),
      fullPage: true,
    }).catch(() => {})
  } finally {
    await page.close()
  }
  return result
}

let browser
const results = []
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
    for (const cardNumber of ['BS9-001', 'BS9-001@1', 'BS9-001@2']) {
      for (const negative of [false, true]) {
        const result = await runScenario(browser, viewport, cardNumber, negative)
        results.push(result)
        console.log(
          `${result.status} ${result.route} ${viewport.width}x${viewport.height}`,
          `targets=${result.targetCount}`,
          result.error ?? '',
        )
      }
    }
  }
} finally {
  await browser?.close()
  if (preview.exitCode === null) preview.kill()
}

writeFileSync(
  resolve(outputDirectory, 'bs9-001-browser.json'),
  JSON.stringify({ baseUrl, results }, null, 2),
)
console.log(JSON.stringify({ baseUrl, results }, null, 2))
process.exitCode = results.some((result) => result.status === 'FAIL') ? 1 : 0
