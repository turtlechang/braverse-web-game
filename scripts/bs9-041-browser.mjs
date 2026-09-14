import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import bs9Candidates from '../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json' with { type: 'json' }

/**
 * BS9-041 Pistachio Cookie 的實卡攻擊後 FLIP A/B Browser 驗證：
 *
 * - 正向 `met`：保留 BS9-018 Hero 的真實攻擊已移除第一張 HP 卡，
 *   由防守方在自己的回合控制 BS9-041，抽牌後選攻擊方 Hero，確認
 *   Then 的 1 點效果傷害，再續接原本攻擊的剩餘傷害。
 * - 負向 `unmet`：同一張 BS9-018／BS9-041 與目標資源保留，切回自然
 *   的攻擊者回合；FLIP 仍可翻開並抽牌，但 `activated during your turn`
 *   不成立，不應出現傷害目標或對 Hero 造成傷害。
 *
 * 這是 localhost candidate fixture：畫面上的 Hero、Pistachio、目標
 * Cookie、HP 與牌庫均由正式 adapter 的實卡資料建立；候選資料不會寫入
 * 正式牌池。正向 route 暫時把本機控制面切到防守方，讓測試能操作其
 * 真實 FLIP 回應；正常對局仍由 HP 持有者決定是否發動 FLIP。
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

const port = Number(process.env.BRAVERSE_BS9_041_TEST_PORT ?? 4202)
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

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const visibleFlip = (page) => page.locator('.flip-response-modal:visible').first()
const visibleDraw = (page) => page.locator('.draw-up-to-modal:visible').first()
const visibleEffect = (page) => page.locator('.effect-panel[role="alertdialog"]:visible').first()
const readTrace = (page) => page.evaluate(() => window.__braverseContractTrace ?? [])

const recordBrowserErrors = (page) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const location = message.location()
    const messageText = message.text()
    if (location.url?.endsWith('/favicon.ico') && messageText.includes('404')) return
    // The fixture deliberately keeps the official image URL.  CardFace's
    // named fallback remains the card evidence when the sandbox blocks it.
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

const assertPhysicalCard = async (page, position, instanceId, cardName) => {
  const card = fieldCard(page, position, instanceId)
  await card.waitFor({ state: 'visible' })
  const fallback = card.locator('.card-fallback')
  const image = card.locator('img')
  const fallbackText = (await fallback.count()) > 0 ? (await fallback.allInnerTexts()).join(' ') : ''
  const imageAlts =
    (await image.count()) > 0
      ? await image.evaluateAll((elements) =>
          elements.map((element) => element.getAttribute('alt')),
        )
      : []
  assert.ok(
    fallbackText.includes(cardName) || imageAlts.includes(cardName),
    `${cardName} must be visible in the card face`,
  )
}

const assertTraceKind = (trace, kind, message) => {
  assert.ok(trace.some((entry) => entry.commandKind === kind), message)
}

const assertNoTraceKind = (trace, kind, message) => {
  assert.equal(trace.some((entry) => entry.commandKind === kind), false, message)
}

const finalSurfaceSelectors = [
  ['effect-panel', '.effect-panel[role="alertdialog"]'],
  ['effect-order', '.effect-order-modal'],
  ['draw-up-to', '.draw-up-to-modal'],
  ['hand-discard', '.hand-discard-modal'],
  ['inspect-deck', '.inspect-deck-modal'],
  ['stage-placement', '.stage-placement-modal'],
  ['flip-response', '.flip-response-modal'],
  ['trap-response', '.trap-response-modal'],
  ['attack-response', '.attack-response-modal'],
  ['attack-response-skill', '.attack-response-skill-modal'],
  ['blocker-response', '.blocker-response-modal'],
  ['optional-cost-attack', '.optional-cost-attack-modal'],
  ['faint-response', '.faint-response-modal'],
  ['hp-reorder', '.hp-reorder-modal'],
  ['card-reveal', '.card-reveal-modal'],
  ['discard-reveal', '.discard-reveal-modal'],
  ['extra-deck-attack', '.extra-deck-attack-modal'],
  ['attack-payment', '.attack-payment-panel'],
  ['card-detail', '.card-detail-modal'],
]

const readVisibleFinalSurfaces = async (page) => page.evaluate((selectors) =>
  selectors.filter(([, selector]) => [...document.querySelectorAll(selector)].some((node) => {
    const style = window.getComputedStyle(node)
    return style.display !== 'none' && style.visibility !== 'hidden' && node.getBoundingClientRect().width > 0
  })).map(([name]) => name), finalSurfaceSelectors)

const assertExactImageLoaded = async (page, record, requested) => {
  const imageEvidence = await page.locator('img').evaluateAll((nodes, options) => {
    const { expectedUrl, exactRequested } = options
    const matches = nodes.filter((node) => [node.getAttribute('src'), node.currentSrc, node.src].includes(expectedUrl))
    const isLoaded = (node) => node.complete && node.naturalWidth > 0
    if (matches.some(isLoaded)) return { exactImageRendered: true, exactImageLoaded: true, exactImageRequested: exactRequested }
    return new Promise((resolvePromise) => {
      let settled = false
      const timeout = window.setTimeout(() => finish(false), 10_000)
      const finish = (loaded) => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        for (const node of matches) {
          node.removeEventListener('load', onLoad)
          node.removeEventListener('error', onError)
        }
        resolvePromise({ exactImageRendered: matches.length > 0, exactImageLoaded: loaded, exactImageRequested: exactRequested })
      }
      const onLoad = () => { if (matches.some(isLoaded)) finish(true) }
      const onError = () => {
        if (matches.length > 0 && matches.every((node) => node.complete && node.naturalWidth === 0)) finish(false)
      }
      for (const node of matches) {
        node.addEventListener('load', onLoad)
        node.addEventListener('error', onError)
      }
      if (matches.length === 0) finish(false)
      else if (matches.every((node) => node.complete)) onError()
    })
  }, { expectedUrl: record.imageUrl, exactRequested: requested }).catch(() => ({
    exactImageRendered: false,
    exactImageLoaded: false,
    exactImageRequested: requested,
  }))
  assert.equal(imageEvidence.exactImageRendered, true, `${record.cardNumber} must render its exact official image URL`)
  assert.equal(imageEvidence.exactImageLoaded, true, `${record.cardNumber} must load its exact official image URL`)
  return imageEvidence
}

const resolveFlipAndDraw = async (page, drawCount) => {
  const flip = visibleFlip(page)
  await flip.waitFor({ state: 'visible' })
  assert.match(await flip.innerText(), /Pistachio Cookie FLIP/)
  assert.match(await flip.innerText(), /Draw up to 1 card/i)
  assert.equal(await flip.locator('.flip-reveal-card').count(), 1)
  assert.ok(
    (await flip.locator('.flip-reveal-card img').count()) === 1 ||
      (await flip.locator('.flip-reveal-card .card-fallback').count()) === 1,
    'BS9-041 should render official art or its named visual fallback',
  )
  // The Then target is intentionally selected after the draw decision.  The
  // first FLIP modal may show the same optional selector, but its targetIds
  // are not executed until the queued Then reaches the normal effect panel.
  await flip.getByRole('button', { name: '發動 FLIP', exact: true }).click()

  const draw = visibleDraw(page)
  await draw.waitFor({ state: 'visible' })
  assert.match(await draw.innerText(), /Pistachio Cookie/)
  assert.match(await draw.innerText(), /最多 1 張牌/)
  const options = draw.locator('.draw-up-to-option')
  assert.equal(await options.count(), 2, 'BS9-041 should offer draw 0 or 1')
  await options.nth(drawCount).click()
  await draw.getByRole('button', {
    name: drawCount === 0 ? '略過抽牌' : '抽取 1 張牌',
    exact: true,
  }).click()
  await draw.waitFor({ state: 'hidden' })
}

const resolveThenDamage = async (page) => {
  const panel = visibleEffect(page)
  await panel.waitFor({ state: 'visible' })
  assert.match(await panel.innerText(), /Pistachio Cookie/)
  assert.match(await panel.innerText(), /receives 1 damage|造成 1(?: 點)? ?傷害/i)
  const targets = panel.locator('.effect-candidates-target button:not(:disabled)')
  assert.equal(await targets.count(), 2, 'BS9-041 should expose both opponent Cookies')
  const hero = targets.filter({ hasText: 'Hero Cookie' }).first()
  await hero.click()
  await panel.getByRole('button', { name: '確認發動', exact: true }).click()
  await panel.waitFor({ state: 'hidden' })
}

const waitForResolution = async (page, expectedCommandKind) => {
  await page.waitForFunction(
    ({ commandKind }) => {
      const dialogs = Array.from(document.querySelectorAll('[role="alertdialog"]'))
      const hasVisibleDialog = dialogs.some((dialog) => {
        const style = window.getComputedStyle(dialog)
        const rect = dialog.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      })
      const trace = window.__braverseContractTrace ?? []
      return !hasVisibleDialog && trace.some((entry) => entry.commandKind === commandKind)
    },
    { commandKind: expectedCommandKind },
    { timeout: 7000 },
  )
  await page.waitForTimeout(250)
}

const runCase = async (browser, viewport, negative, cardNumber) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(7000)
  const requestedImages = new Set()
  page.on('request', (request) => {
    if (request.resourceType() === 'image') requestedImages.add(request.url())
  })
  const errors = recordBrowserErrors(page)
  const route = negative
    ? `bs9-041-attack:${cardNumber}:unmet`
    : `bs9-041-attack:${cardNumber}:met`
  const result = { route, cardNumber, viewport, negative, status: 'FAIL', actions: [] }
  const heroId = 'bs9-bs9-018-source'
  const attackedId = 'bs9-opponent-red-lv1'
  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=BS9-041`,
      { waitUntil: 'domcontentloaded' },
    )
    await waitForGame(page)
    const record = bs9Candidates.cards.find((candidate) => candidate.cardNumber === cardNumber)
    if (!record) throw new Error(`Missing BS9 candidate ${cardNumber}`)
    Object.assign(result, await assertExactImageLoaded(page, record, requestedImages.has(record.imageUrl)))

    // Positive and negative attack fixtures expose the defender as the local
    // control surface, so the original attacker's cards are in the top field.
    await assertPhysicalCard(page, 'top', heroId, 'Hero Cookie')
    await assertPhysicalCard(page, 'bottom', attackedId, 'Melon Bun Cookie')
    const before = {
      hero: await readHp(page, 'top', heroId),
      attacked: await readHp(page, 'bottom', attackedId),
    }
    assert.deepEqual(
      before,
      { hero: 2, attacked: 3 },
      'fixture should begin after the first attack damage point',
    )
    result.actions.push('inspect-hero-and-attacked-cookie')

    await resolveFlipAndDraw(page, negative ? 0 : 1)
    result.actions.push(`resolve-flip-draw-${negative ? 0 : 1}`)

    if (negative) {
      await page.waitForTimeout(350)
      assert.equal(await visibleEffect(page).count(), 0)
      // A condition-false Then is skipped inside the resolve-draw-up-to
      // command, so the original battle is finished without a separate
      // resolve-battle trace entry.
      await page.waitForFunction(
        () => Array.from(document.querySelectorAll('[role="alertdialog"]')).every((dialog) => {
          const style = window.getComputedStyle(dialog)
          const rect = dialog.getBoundingClientRect()
          return style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0
        }),
        undefined,
        { timeout: 7000 },
      )
      const after = {
        hero: await readHp(page, 'top', heroId),
        attacked: await readHp(page, 'bottom', attackedId),
      }
      assert.deepEqual(
        after,
        { hero: 2, attacked: 2 },
        'condition-false route should skip BS9-041 damage and finish the attack',
      )
      result.after = after
    } else {
      await resolveThenDamage(page)
      result.actions.push('select-opponent-hero-target')
      await waitForResolution(page, 'resolve-ability-effect')
      const after = {
        hero: await readHp(page, 'top', heroId),
        attacked: await readHp(page, 'bottom', attackedId),
      }
      assert.deepEqual(
        after,
        { hero: 1, attacked: 2 },
        "condition-met route should damage the attacker's Hero, then resume attack damage",
      )
      result.after = after
    }

    const trace = await readTrace(page)
    assertTraceKind(trace, 'resolve-flip', 'BS9-041 route should leave a FLIP trace')
    assertTraceKind(trace, 'resolve-draw-up-to', 'BS9-041 route should leave a draw trace')
    if (negative) {
      assertNoTraceKind(trace, 'resolve-ability-effect', 'condition-false route must not resolve Then damage')
    } else {
      assertTraceKind(trace, 'resolve-ability-effect', 'condition-met route should resolve Then target damage')
    }
    result.expectedImageUrl = record.imageUrl
    result.trace = trace
    result.traceCommandKinds = trace.map((entry) => entry.commandKind)
    result.finalPendingSurfaces = await readVisibleFinalSurfaces(page)
    assert.deepEqual(result.finalPendingSurfaces, [], `${cardNumber} must settle pending UI surfaces: ${result.finalPendingSurfaces.join(', ')}`)
    result.negativeEvidence = negative
      ? !trace.some((entry) => entry.commandKind === 'resolve-ability-effect')
      : trace.some((entry) => entry.commandKind === 'resolve-ability-effect')
    assert.equal(result.negativeEvidence, true, `${cardNumber} ${negative ? 'negative' : 'positive'} route must retain Then outcome evidence`)
    result.publicState = await page.evaluate(() => ({
      body: document.body.innerText.slice(0, 7_000),
      battleCards: [...document.querySelectorAll('.battle-row .combat-card-wrap')].map((node) => ({
        id: node.getAttribute('data-card-instance-id'),
        title: node.querySelector('.card-face')?.getAttribute('title') ?? null,
        hp: node.querySelector('.badge-hp')?.textContent?.trim() ?? null,
        atk: node.querySelector('.badge-atk')?.textContent?.trim() ?? null,
      })),
    }))
    assert.deepEqual(errors, [], `BS9-041 ${negative ? 'negative' : 'positive'} browser errors: ${errors.join('; ')}`)
    result.status = 'PASS'
    result.before = before
    result.screenshot = resolve(
      outputDirectory,
      `bs9-041-${cardNumber}-${negative ? 'negative' : 'positive'}-${viewport.width}x${viewport.height}.png`,
    )
    await page.screenshot({ path: result.screenshot, fullPage: true })
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 7000)
    result.trace = await readTrace(page).catch(() => [])
    result.traceCommandKinds = result.trace.map((entry) => entry.commandKind)
    result.finalPendingSurfaces = await readVisibleFinalSurfaces(page).catch(() => [])
    result.negativeEvidence = negative
      ? !result.trace.some((entry) => entry.commandKind === 'resolve-ability-effect')
      : result.trace.some((entry) => entry.commandKind === 'resolve-ability-effect')
    result.screenshot = resolve(
      outputDirectory,
      `bs9-041-${cardNumber}-${negative ? 'negative' : 'positive'}-${viewport.width}x${viewport.height}-failed.png`,
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
const cardNumbers = bs9Candidates.cards
  .filter((record) => record.baseCardNumber === 'BS9-041')
  .map((record) => record.cardNumber)
if (cardNumbers.length === 0) throw new Error('Missing BS9-041 candidate records')
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
    for (const cardNumber of cardNumbers) {
      results.push(await runCase(browser, viewport, false, cardNumber))
      results.push(await runCase(browser, viewport, true, cardNumber))
    }
  }
} finally {
  await browser?.close()
  if (preview.exitCode === null) preview.kill()
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  scope: 'BS9-018 attack -> BS9-041 HP FLIP, draw 0/1, Then opponent-Cookie damage, and condition A/B.',
  total: results.length,
  passed: results.filter((result) => result.status === 'PASS').length,
  failed: results.filter((result) => result.status !== 'PASS'),
  results,
}
writeFileSync(
  resolve(outputDirectory, 'bs9-041-browser.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
process.exitCode = report.failed.length > 0 ? 1 : 0
