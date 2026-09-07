import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightRoot = process.env.PLAYWRIGHT_NODE_MODULES
const playwrightEntry = require.resolve('playwright', {
  paths: playwrightRoot ? [playwrightRoot] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium

if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4179)
const viewport = {
  width: Number(process.env.BRAVERSE_TEST_WIDTH ?? 1440),
  height: Number(process.env.BRAVERSE_TEST_HEIGHT ?? 960),
}
for (const [dimension, value] of Object.entries(viewport)) {
  assert.ok(Number.isInteger(value) && value > 0, `Invalid viewport ${dimension}: ${value}`)
}
const baseUrl = `http://127.0.0.1:${port}`
const requestedSeries = (
  process.argv
    .find((argument) => argument.startsWith('--series='))
    ?.slice('--series='.length)
    .toUpperCase() ?? 'P'
)
const cardAuditConfigs = {
  BS1: {
    label: 'BS1',
    formalPaths: ['data/cards/official-brave-beginning-bs1.en.json'],
    reportPath: 'docs/bs1-browser-card-audit-2026-08-20.json',
    expectedRecordCount: 99,
  },
  BS2: {
    label: 'BS2',
    formalPaths: ['data/cards/official-brave-beginning-bs2.en.json'],
    reportPath: 'docs/bs2-browser-card-audit-2026-08-20.json',
    expectedRecordCount: 104,
  },
  BS3: {
    label: 'BS3',
    formalPaths: [
      'data/cards/official-age-of-heroes-and-kingdoms-bs3.en.json',
    ],
    reportPath: 'docs/bs3-browser-card-audit-2026-08-20.json',
    expectedRecordCount: 176,
  },
  BS4: {
    label: 'BS4',
    formalPaths: [
      'data/cards/official-age-of-heroes-and-kingdoms-bs4.en.json',
    ],
    reportPath: 'docs/bs4-browser-card-audit-2026-08-20.json',
    expectedRecordCount: 170,
  },
  P: {
    label: 'P-0XX',
    formalPaths: [
      'data/cards/official-promotion-p001-p032.en.json',
      'data/cards/official-promotion-p001-p032-remaining.en.json',
      'data/cards/official-p-0xx-remaining.en.json',
    ],
    reportPath: 'docs/p0xx-browser-card-audit-2026-08-20.json',
    expectedRecordCount: 153,
  },
  BS5: {
    label: 'BS5',
    formalPaths: [
      'data/cards/official-age-of-heroes-and-kingdoms-bs5.en.json',
    ],
    reportPath: 'docs/bs5-browser-card-audit-2026-08-13.json',
    expectedRecordCount: 153,
  },
  BS6: {
    label: 'BS6',
    formalPaths: [
      'data/cards/official-age-of-heroes-and-kingdoms-bs6.en.json',
    ],
    reportPath: 'docs/bs6-browser-card-audit-2026-08-13.json',
    expectedRecordCount: 138,
  },
  BS7: {
    label: 'BS7',
    formalPaths: ['data/cards/official-arena-of-glory-bs7.en.json'],
    reportPath: 'docs/bs7-browser-card-audit-2026-08-21.json',
    expectedRecordCount: 143,
  },
  BS8: {
    label: 'BS8',
    formalPaths: ['data/cards/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json'],
    expectedRecordCount: 171,
  },
}
const auditConfig = cardAuditConfigs[requestedSeries]
if (!auditConfig) {
  throw new Error(
    `Unsupported card audit series ${requestedSeries}; expected ${Object.keys(cardAuditConfigs).join(', ')}`,
  )
}
const reportPath = resolve(
  root,
  process.env.BRAVERSE_AUDIT_REPORT ?? `test-results/${requestedSeries.toLowerCase()}-browser-card-audit-${viewport.width}x${viewport.height}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
)
assert.ok(!existsSync(reportPath), `Refusing to overwrite existing report: ${reportPath}`)
const vitePackageJson = require.resolve('vite/package.json', { paths: [root] })
const viteEntry = resolve(dirname(vitePackageJson), 'bin/vite.js')
const browserExecutable =
  process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find((candidate) => existsSync(candidate))

const sources = await Promise.all(
  auditConfig.formalPaths.map(async (formalPath) =>
    JSON.parse(await readFile(resolve(root, formalPath), 'utf8')),
  ),
)
let cards = sources.flatMap((source) => source.cards).sort((left, right) =>
  left.cardNumber.localeCompare(right.cardNumber, undefined, { numeric: true }),
)
assert.equal(
  cards.length,
  auditConfig.expectedRecordCount,
  `${auditConfig.label} formal pool must contain ${auditConfig.expectedRecordCount} records`,
)
const requestedCards = process.argv.find(argument => argument.startsWith('--cards='))?.slice(8).split(',')
if (requestedCards) {
  cards = cards.filter(card => requestedCards.includes(card.cardNumber))
  assert.equal(cards.length, new Set(requestedCards).size, 'every requested exact card must exist')
}

const hasText = (value) => typeof value === 'string' && value.trim().length > 0

const getEffectSurfaces = (card) => {
  const surfaces = []
  if (['cookie', 'extra'].includes(card.type) && hasText(card.skill?.text)) surfaces.push('skill')
  if (card.type === 'extra') surfaces.push('extra-deck')
  if (hasText(card.attackText) && /\bThen\b/i.test(card.attackText)) {
    surfaces.push('attack-then')
  }
  if (card.type === 'flip' && hasText(card.flipText)) surfaces.push('flip')
  if (card.type === 'item') surfaces.push('item')
  if (card.type === 'trap') surfaces.push('trap')
  if (card.type === 'stage') surfaces.push('stage')
  return surfaces.length > 0 ? surfaces : ['vanilla-attack']
}

const ignoredConsoleError = (message) => {
  if (message.type() !== 'error') return true
  const location = message.location()
  const text = message.text()
  if (location.url?.endsWith('/favicon.ico') && text.includes('404')) return true
  if (
    location.url?.includes('cookierunbraverse.com/data/en_storage/') &&
    /ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(text)
  ) {
    return true
  }
  return false
}

const waitForPreview = async () => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {
      // Preview server is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
  }
  throw new Error(`Vite preview did not start at ${baseUrl}`)
}

const firstPrompt = (bodyText) => {
  const lines = bodyText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  return (
    lines.find((line) =>
      /選擇|支付|費用|目標|效果|發動|攻擊|陷阱|FLIP|On Play|Activate/i.test(line),
    ) ?? null
  )
}

const runCardCheck = async (page, card) => {
  const consoleErrors = []
  const pageErrors = []
  let exactImageRequested = false
  let exactImageFailure = null
  const onRequest = (request) => {
    if (request.url() === card.imageUrl) exactImageRequested = true
  }
  const onRequestFailed = (request) => {
    if (request.url() === card.imageUrl) exactImageFailure = request.failure()?.errorText ?? 'image request failed'
  }
  const onConsole = (message) => {
    if (!ignoredConsoleError(message)) {
      const location = message.location()
      consoleErrors.push(
        location.url ? `${message.text()} (${location.url})` : message.text(),
      )
    }
  }
  const onPageError = (error) => pageErrors.push(error.message)
  page.on('console', onConsole)
  page.on('pageerror', onPageError)
  page.on('request', onRequest)
  page.on('requestfailed', onRequestFailed)

  try {
    await page.goto(
      `${baseUrl}?test-state=card:${encodeURIComponent(card.cardNumber)}`,
      { waitUntil: 'domcontentloaded' },
    )
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    let detailIssue = null
    let detailSurface = null
    if (card.type === 'extra') {
      await page.getByLabel('玩家 EXTRA Deck 1 張', { exact: true }).click()
      const dialog = page.getByRole('dialog', { name: '玩家 EXTRA Deck', exact: true })
      await dialog.waitFor({ state: 'visible' })
      const entry = dialog.locator('.extra-deck-card-entry').filter({ hasText: card.name })
      assert.equal(await entry.count(), 1, 'exact route must expose one matching EXTRA entry')
      assert.equal(await entry.locator('.extra-deck-card-details small').innerText(), card.baseCardNumber)
      detailSurface = 'extra-deck-entry'
    } else {
      // Inspect through existing visible controls only; pending effect overlays
      // may legitimately prevent detail access, which remains an explicit gap.
      try {
        await page.waitForTimeout(350)
        const face = page.locator('button.card-face').filter({ has: page.locator(`img[alt="${card.name}"]`) }).first()
        const fallbackFace = page.locator('button.card-face').filter({ hasText: card.name }).first()
        const hand = page.locator('.hand-card-wrap').filter({ has: page.locator(`button[title="${card.name}"]`) }).first()
        const battle = page.locator('.combat-card-wrap').filter({ has: page.locator(`button[title="${card.name}"]`) }).first()
        if (await hand.count()) {
          await hand.locator('button.card-face').first().click({ timeout: 1500 })
          if (!await page.locator('.card-detail-modal').count()) await hand.getByRole('button', { name: '詳情', exact: true }).click({ timeout: 1500 })
        } else if (await battle.locator('.hp-card').count()) {
          await battle.locator('.hp-card').first().click({ timeout: 1500 })
        } else if (await face.count()) {
          await face.click({ timeout: 1500 })
        } else if (await fallbackFace.count()) {
          await fallbackFace.click({ timeout: 1500 })
        } else {
          throw new Error('No visible inspect control for this exact card')
        }
        await page.getByRole('dialog', { name: `${card.name} 卡牌詳情`, exact: true }).waitFor({ state: 'visible', timeout: 1500 })
        detailSurface = 'card-detail-modal'
      } catch (error) {
        detailIssue = error instanceof Error ? error.message.split('\n')[0] : String(error)
      }
    }
    // Modal creation is intentionally deferred by the React controller. The
    // delay avoids treating a valid lazy modal as a failed card route.
    await page.waitForTimeout(350)

    const bodyText = await page.locator('body').innerText()
    assert.ok(
      !/Application Error|GameErrorBoundary|Unhandled Runtime Error|Something went wrong/i.test(
        bodyText,
      ),
      'error boundary or application error appeared',
    )
    const renderedCardName = await page
      .locator('img[alt], .card-fallback')
      .evaluateAll((nodes, expectedName) =>
        nodes.some((node) => {
          const value =
            node instanceof HTMLImageElement ? node.alt : node.textContent ?? ''
          return value.includes(expectedName)
        }),
      card.name,
      )
    assert.ok(
      bodyText.includes(card.name) || renderedCardName,
      `card face for ${card.cardNumber} (${card.name}) was not rendered`,
    )
    assert.equal(
      consoleErrors.length,
      0,
      `console errors: ${JSON.stringify(consoleErrors)}`,
    )
    assert.equal(pageErrors.length, 0, `page errors: ${JSON.stringify(pageErrors)}`)

    let detailFallbackIssue = null
    if (!detailSurface && card.type !== 'extra') {
      try {
        // Route rendering above is already recorded. Use the ordinary deck
        // editor's read-only detail selector; never settle the game decision.
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
        await page.getByRole('button', { name: '新增牌組', exact: true }).click()
        const editor = page.getByTestId('deck-editor-page')
        await editor.getByTestId('deck-editor-search').fill(card.cardNumber)
        await editor.getByRole('button', { name: `查看 ${card.cardNumber} ${card.name}`, exact: true }).click()
        await editor.locator('.deck-editor-page-detail-heading').filter({ hasText: card.cardNumber }).waitFor()
        detailSurface = 'standard-deck-editor-detail'
      } catch (error) {
        detailFallbackIssue = error instanceof Error ? error.message : String(error)
      }
    }

    const modalCount = await page.locator('[role="dialog"]').count()
    const actionCount = await page
      .locator('button:not([disabled]), [role="button"]:not([aria-disabled="true"])')
      .count()
    const surfaces = getEffectSurfaces(card)
    // Wait for real image completion, bounded even when the network is blocked.
    await page.waitForFunction((expectedUrl) => {
      const images = [...document.images].filter(image => image.src === expectedUrl)
      return images.length === 0 || images.every(image => image.complete)
    }, card.imageUrl, { timeout: 3000 }).catch(() => {})
    const imageEvidence = await page.locator('img').evaluateAll((images, expectedUrl) => {
      const matching = images.filter(image => image.src === expectedUrl)
      return {
        expectedUrl,
        matchingImages: matching.length,
        loadedImages: matching.filter(image => image.complete && image.naturalWidth > 0).length,
      }
    }, card.imageUrl)
    imageEvidence.requested = exactImageRequested
    imageEvidence.failure = exactImageFailure
    imageEvidence.status = imageEvidence.loadedImages > 0 ? 'PASS' : 'NOT_LOADED'
    if (card.type === 'extra') {
      assert.ok(imageEvidence.matchingImages > 0 || exactImageRequested,
        'EXTRA exact illustration URL must be observed in the rendered image or its request')
    }
    const visibleDetailText = detailSurface
      ? await page.locator(detailSurface === 'card-detail-modal' ? '.card-detail-modal'
        : detailSurface === 'standard-deck-editor-detail' ? '.deck-editor-page-detail' : '.extra-deck-card-entry').allInnerTexts()
      : []
    return {
      cardNumber: card.cardNumber,
      baseCardNumber: card.baseCardNumber,
      variant: card.variant,
      name: card.name,
      type: card.type,
      color: card.color,
      effectSurfaces: surfaces,
      status: 'PASS',
      auditStatus: '載入通過',
      flow: card.type === 'extra' ? 'extra-exact-card-check-entry' : auditConfig.candidate
        ? 'candidate-card-check-entry'
        : 'formal-card-check-entry',
      promptVisible: firstPrompt(bodyText),
      modalVisible: modalCount > 0,
      actionableControls: actionCount,
      imageEvidence,
      visibleDetailText,
      detailSurface,
      detailIssue,
      detailFallbackIssue,
      textSemanticVerification: false,
      interactiveEffectProof: false,
    }
  } finally {
    page.off('console', onConsole)
    page.off('pageerror', onPageError)
    page.off('request', onRequest)
    page.off('requestfailed', onRequestFailed)
  }
}

const server = spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: root, stdio: 'ignore' },
)
let browser
const results = []

try {
  await waitForPreview()
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(7000)

  console.log(
    `=== ${auditConfig.label} Browser ${auditConfig.candidate ? 'candidate' : 'formal'}-pool audit (${cards.length} records, ${browserExecutable ?? 'Playwright Chromium'}) ===`,
  )
  for (const card of cards) {
    try {
      const result = await runCardCheck(page, card)
      results.push(result)
      console.log(`${result.status} ${card.cardNumber} ${card.name} [${result.effectSurfaces.join(',')}]`)
    } catch (error) {
      const failure = {
        cardNumber: card.cardNumber,
        baseCardNumber: card.baseCardNumber,
        variant: card.variant,
        name: card.name,
        type: card.type,
        color: card.color,
        effectSurfaces: getEffectSurfaces(card),
        status: 'FAIL',
        auditStatus: '阻塞',
        flow: card.type === 'extra' ? 'extra-exact-card-check-entry' : auditConfig.candidate
          ? 'candidate-card-check-entry'
          : 'formal-card-check-entry',
        error: error instanceof Error ? error.message : String(error),
      }
      results.push(failure)
      console.log(`FAIL ${card.cardNumber} ${card.name}: ${failure.error}`)
    }
  }

  await page.close()
  await browser.close()
  browser = undefined
  server.kill()

  const passed = results.filter((result) => result.status === 'PASS').length
  const failed = results.filter((result) => result.status === 'FAIL').length
  const blocked = results.filter((result) => result.status === 'BLOCKED').length
  const effectCards = results.filter((result) =>
    result.effectSurfaces.some((surface) => surface !== 'vanilla-attack'),
  )
  const report = {
    generatedAt: new Date().toISOString(),
    browser: browserExecutable ?? 'playwright-chromium',
    viewport: `${viewport.width}x${viewport.height}`,
    sources: auditConfig.formalPaths,
    scope:
      `Load smoke for every ${auditConfig.label} source record: exact card-check routes for all records including EXTRA variants, with visible detail controls where accessible. PASS proves route/card-name rendering only; imageEvidence separately records exact image loading, and visibleDetailText captures UI copy without certifying its semantics or interactive effects.`,
    summary: {
      total: results.length,
      passed,
      failed,
      blocked,
      exactCardImageLoaded: results.filter(result => result.imageEvidence?.loadedImages > 0).length,
      effectBearingRecords: effectCards.length,
      interactiveEffectProof: 0,
      byType: Object.fromEntries(
        [...new Set(cards.map((card) => card.type))].map((type) => [
          type,
          {
            total: results.filter((result) => result.type === type).length,
            passed: results.filter(
              (result) => result.type === type && result.status === 'PASS',
            ).length,
            failed: results.filter(
              (result) => result.type === type && result.status === 'FAIL',
            ).length,
            blocked: results.filter(result => result.type === type && result.status === 'BLOCKED').length,
          },
        ]),
      ),
    },
    results,
  }
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  console.log(`\nSummary: ${passed}/${results.length} loaded; ${failed} failed; ${blocked} blocked`)
  console.log(`Effect-bearing records needing interactive proof: ${effectCards.length}`)
  console.log(`Evidence: ${reportPath}`)
  process.exitCode = failed === 0 && blocked === 0 ? 0 : 1
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  server.kill()
}
