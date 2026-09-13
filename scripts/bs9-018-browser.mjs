import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import bs9Candidates from '../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json' with { type: 'json' }

/**
 * BS9-018 Hero Cookie 的實卡攻擊→HP FLIP Browser 驗證：
 *
 * localhost test-state 會先以正式 Hero／Pomegranate Cookie 攻擊正式的
 * BS1-007 Melon Bun 或 BS8-007 Dark Choco，讓真實 BS1-002 Kumiho 出現在
 * 目標的最上方 HP。Browser 再由防守方選擇 Kumiho 的棄牌代價與效果目標。
 * 正向路徑保留 Hero 在戰鬥區，Kumiho 的 1 點效果傷害應被阻止；負向路徑
 * 移除 Hero，只留下 Pomegranate，該 Cookie 應承受 1 點效果傷害。
 *
 * 候選 BS9 卡只由 localhost test-state 載入，沒有寫入正式牌池。每個
 * viewport／目標／A-B 路徑都使用同一個正式 command flow，並檢查實際
 * FLIP modal、付款選擇、公開 contract trace、HP 結果與瀏覽器錯誤。
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

const port = Number(process.env.BRAVERSE_BS9_018_TEST_PORT ?? 4201)
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

const candidateRecord = bs9Candidates.cards.find((candidate) => candidate.cardNumber === 'BS9-018')
if (!candidateRecord) throw new Error('Missing BS9 candidate BS9-018')

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const readTrace = (page) => page.evaluate(() => window.__braverseContractTrace ?? [])

const recordBrowserErrors = (page) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const location = message.location()
    const messageText = message.text()
    if (location.url?.endsWith('/favicon.ico') && messageText.includes('404')) return
    // Official art remains part of the fixture. In a network-restricted run
    // CardFace renders the named fallback, which is still a physical-card UI.
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
}

const cardLocator = (page, field, instanceId) =>
  page.locator(`.${field} [data-card-instance-id="${instanceId}"]`)

const readHp = async (page, field, instanceId) => {
  const card = cardLocator(page, field, instanceId)
  await card.waitFor({ state: 'visible' })
  const text = await card.locator('.badge-hp').innerText()
  const match = text.match(/(\d+)\s*\//)
  if (!match) throw new Error(`Cannot read HP badge for ${instanceId}: ${text}`)
  return Number(match[1])
}

const waitForHp = async (page, field, instanceId, expected) => {
  await page.waitForFunction(
    ({ field: fieldName, instanceId: id, expected: expectedHp }) => {
      const card = document.querySelector(
        `.${fieldName} [data-card-instance-id="${id}"]`,
      )
      const text = card?.querySelector('.badge-hp')?.textContent ?? ''
      const match = text.match(/(\d+)\s*\//)
      return match ? Number(match[1]) === expectedHp : false
    },
    { field, instanceId, expected },
    { timeout: 10000 },
  )
}

const assertPhysicalCard = async (page, field, instanceId, cardName) => {
  const card = cardLocator(page, field, instanceId)
  await card.waitFor({ state: 'visible' })
  const fallback = card.locator('.card-fallback')
  const image = card.locator('img')
  const fallbackText = (await fallback.count()) > 0
    ? (await fallback.allInnerTexts()).join(' ')
    : ''
  const imageAlts =
    (await image.count()) > 0
      ? await image.evaluateAll((elements) =>
          elements.map((element) => element.getAttribute('alt')),
        )
      : []
  assert.ok(
    fallbackText.includes(cardName) || imageAlts.includes(cardName),
    `${cardName} must be visible in the ${field} card face`,
  )
  assert.ok(
    imageAlts.includes(cardName) || fallbackText.includes(cardName),
    `${cardName} should render official art or its named visual fallback`,
  )
}

const assertExactCardImage = async (locator, record, exactImageRequested) => {
  await locator.waitFor({ state: 'visible' })
  const exactImage = locator.locator(`img[src="${record.imageUrl}"]`).first()
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
  const alts = await locator.locator('img').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('alt')),
  )
  assert.ok(alts.includes(record.name), `${record.cardNumber} must render its named official card face`)
  const exactImageRendered = (await exactImage.count()) > 0
  const exactImageLoaded = await exactImage.evaluate(
    (node) => node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0,
  )
  assert.equal(exactImageRequested, true, `${record.cardNumber} exact official image request must be observed`)
  assert.equal(exactImageRendered, true, `${record.cardNumber} must render its exact official image URL`)
  assert.equal(exactImageLoaded, true, `${record.cardNumber} official image must be loaded, not merely requested`)
  return { exactImageRequested, exactImageRendered, exactImageLoaded }
}

const waitForFlipTrace = async (page) => {
  await page.waitForFunction(
    () =>
      (window.__braverseContractTrace ?? []).some(
        (entry) => entry.commandKind === 'resolve-flip',
      ),
    undefined,
    { timeout: 10000 },
  )
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const runCase = async (browser, viewport, negative, targetCardNumber) => {
  const target =
    targetCardNumber === 'BS8-007'
      ? {
          cardName: 'Dark Choco Cookie',
          instanceId: 'bs9-opponent-red-lv3',
          hpAfterReveal: 4,
          hpAfterBattle: negative ? 2 : 3,
        }
      : {
          cardName: 'Melon Bun Cookie',
          instanceId: 'bs9-opponent-red-lv1',
          hpAfterReveal: 3,
          hpAfterBattle: negative ? 1 : 2,
        }
  const attacker = negative
    ? {
        cardName: 'Pomegranate Cookie',
        instanceId: 'bs9-own-companion',
        hpBefore: 4,
        hpAfter: 3,
      }
    : {
        cardName: 'Hero Cookie',
        instanceId: 'bs9-bs9-018-source',
        hpBefore: 2,
        hpAfter: 2,
      }
  const route = negative
    ? 'card-negative:BS9-018'
    : 'card:BS9-018'
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(10000)
  const errors = recordBrowserErrors(page)
  let exactImageRequested = false
  page.on('request', (request) => {
    if (request.url() === candidateRecord.imageUrl) exactImageRequested = true
  })
  const result = {
    route,
    targetCardNumber,
    targetName: target.cardName,
    viewport,
    status: 'FAIL',
    actions: [],
    expectedImageUrl: candidateRecord.imageUrl,
  }

  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&bs9-target=${targetCardNumber}&contract-card=BS1-002`,
      { waitUntil: 'domcontentloaded' },
    )
    await waitForGame(page)

    await assertPhysicalCard(page, 'top-field', attacker.instanceId, attacker.cardName)
    await assertPhysicalCard(page, 'bottom-field', target.instanceId, target.cardName)
    await assertPhysicalCard(
      page,
      'bottom-field',
      targetCardNumber === 'BS8-007'
        ? 'bs9-opponent-red-lv1'
        : 'bs9-opponent-red-lv3',
      targetCardNumber === 'BS8-007' ? 'Melon Bun Cookie' : 'Dark Choco Cookie',
    )
    if (negative) {
      assert.equal(
        await cardLocator(page, 'top-field', 'bs9-bs9-018-source').count(),
        0,
        'negative route must remove Hero from the attacking battle area',
      )
    } else {
      await assertPhysicalCard(page, 'top-field', 'bs9-own-companion', 'Pomegranate Cookie')
    }
    if (negative) {
      // The negative fixture deliberately keeps Hero in the opponent's
      // concealed hand. Its front art is not public UI in this route; record
      // that boundary instead of treating the card back as exact art.
      result.imageEvidence = {
        exactImageRequested,
        exactImageRendered: false,
        exactImageLoaded: false,
        applicability: 'concealed-opponent-hand',
      }
      result.imageNote = 'negative route keeps Hero in a concealed opponent hand; exact front art is not rendered'
    } else {
      result.imageEvidence = await assertExactCardImage(
        cardLocator(page, 'top-field', attacker.instanceId),
        candidateRecord,
        exactImageRequested,
      )
    }
    result.actions.push('inspect-real-attacker-and-opponent-cards')

    const attackerBefore = await readHp(page, 'top-field', attacker.instanceId)
    const targetBefore = await readHp(page, 'bottom-field', target.instanceId)
    assert.equal(attackerBefore, attacker.hpBefore, 'attacker should expose its printed starting HP')
    assert.equal(targetBefore, target.hpAfterReveal, 'the real Kumiho HP card should already be revealed')
    result.startingHp = { attacker: attackerBefore, target: targetBefore }

    const modal = page.locator('.flip-response-modal')
    await modal.waitFor({ state: 'visible' })
    const modalText = await modal.innerText()
    assert.match(modalText, /Kumiho Cookie FLIP/)
    assert.match(modalText, /Discard 1 card/i)
    assert.match(modalText, /That Cookie receives 1 damage/i)
    const flipCard = modal.locator('.flip-reveal-card')
    const flipFallback = flipCard.locator('.card-fallback')
    const flipImage = flipCard.locator('img')
    const flipFallbackText = (await flipFallback.count()) > 0 ? await flipFallback.innerText() : ''
    const flipAlts = (await flipImage.count()) > 0
      ? await flipImage.evaluateAll((elements) => elements.map((element) => element.getAttribute('alt')))
      : []
    assert.ok(flipFallbackText.includes('Kumiho Cookie') || flipAlts.includes('Kumiho Cookie'))
    result.actions.push('inspect-kumiho-flip-modal-and-effect-text')

    const targetOptions = modal.locator(
      '[role="group"][aria-label="FLIP 效果目標"] button',
    )
    assert.equal(
      await targetOptions.count(),
      negative ? 1 : 2,
      'Kumiho should expose only the Cookies that are actually in the attacker area',
    )
    const targetButton = targetOptions.filter({ hasText: attacker.cardName })
    await targetButton.waitFor({ state: 'visible' })
    await targetButton.click()
    assert.equal(await targetButton.getAttribute('aria-pressed'), 'true')
    result.actions.push(`select-${attacker.cardName}-as-kumiho-target`)

    const handButton = modal.locator('.flip-card-page button').first()
    await handButton.waitFor({ state: 'visible' })
    const paidCardName = await handButton.innerText()
    assert.match(paidCardName, /Soul Jam: Light of Destruction/)
    await handButton.click()
    const activateButton = modal.getByRole('button', { name: '發動 FLIP', exact: true })
    assert.equal(await activateButton.isDisabled(), false, 'one selected hand card should satisfy Kumiho cost')
    result.actions.push('select-one-hand-card-as-kumiho-cost')

    await activateButton.click()
    await modal.waitFor({ state: 'detached' })
    await waitForFlipTrace(page)
    await waitForHp(page, 'top-field', attacker.instanceId, attacker.hpAfter)
    await waitForHp(page, 'bottom-field', target.instanceId, target.hpAfterBattle)
    result.actions.push('activate-kumiho-and-finish-remaining-attack-damage')

    const trace = await readTrace(page)
    assert.ok(trace.some((entry) => entry.commandKind === 'resolve-next-damage'))
    assert.ok(trace.some((entry) => entry.commandKind === 'resolve-flip'))
    assert.equal(
      trace.filter((entry) => entry.commandKind === 'resolve-flip').length,
      1,
      'Kumiho should resolve exactly once',
    )
    const flipEntry = trace.find((entry) => entry.commandKind === 'resolve-flip')
    assert.match(flipEntry?.summary ?? '', /Kumiho Cookie/)

    // The sidebar exposes the initial formal declare-attack entry, while the
    // public contract trace is intentionally filtered to BS1-002.
    const logToggle = page.locator('[data-testid="battle-log-toggle"]')
    await logToggle.click()
    const logText = await page.locator('.battle-log-sidebar').innerText()
    assert.match(
      logText,
      new RegExp(`玩家 使用「${escapeRegExp(attacker.cardName)}」攻擊「${escapeRegExp(target.cardName)}」`),
    )
    assert.equal(await page.locator('[role="alertdialog"]:visible').count(), 0)
    assert.deepEqual(errors, [], `BS9-018 ${negative ? 'negative' : 'positive'} browser errors: ${errors.join('; ')}`)

    result.status = 'PASS'
    result.exactImageRequested = exactImageRequested
    result.exactImageRendered = result.imageEvidence.exactImageRendered
    result.exactImageLoaded = result.imageEvidence.exactImageLoaded
    result.afterHp = {
      attacker: await readHp(page, 'top-field', attacker.instanceId),
      target: await readHp(page, 'bottom-field', target.instanceId),
    }
    result.trace = trace
    result.screenshot = resolve(
      outputDirectory,
      `bs9-018-${negative ? 'negative' : 'positive'}-${targetCardNumber}-${viewport.width}x${viewport.height}.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true })
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 9000)
    result.trace = await readTrace(page).catch(() => [])
    result.screenshot = resolve(
      outputDirectory,
      `bs9-018-${negative ? 'negative' : 'positive'}-${targetCardNumber}-${viewport.width}x${viewport.height}-failed.png`,
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
  for (let attempt = 0; attempt < 100; attempt += 1) {
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
    for (const targetCardNumber of ['BS1-007', 'BS8-007']) {
      results.push(await runCase(browser, viewport, false, targetCardNumber))
      results.push(await runCase(browser, viewport, true, targetCardNumber))
    }
  }
} finally {
  await browser?.close()
  if (preview.exitCode === null) preview.kill()
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  scope: 'BS9-018 Hero Cookie real attacks into BS1-007/BS8-007, revealing BS1-002 Kumiho; Hero prevents opponent effect damage on the positive route.',
  total: results.length,
  passed: results.filter((result) => result.status === 'PASS').length,
  failed: results.filter((result) => result.status !== 'PASS'),
  results,
}
writeFileSync(
  resolve(outputDirectory, 'bs9-018-browser.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
process.exitCode = report.failed.length > 0 ? 1 : 0
