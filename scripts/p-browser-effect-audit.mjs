import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
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
const baseUrl = `http://127.0.0.1:${port}`
const requestedSeries = (() => {
  const inline = process.argv.find((argument) =>
    argument.startsWith('--series='),
  )
  if (inline) return inline.slice('--series='.length).toUpperCase()
  const index = process.argv.indexOf('--series')
  if (index >= 0) return process.argv[index + 1]?.toUpperCase()
  return process.env.BRAVERSE_AUDIT_SERIES?.toUpperCase() ?? 'P'
})()
const isBs6Audit = requestedSeries === 'BS6'
const requestedCardNumbers = process.argv
  .filter((argument) => argument.startsWith('--card='))
  .map((argument) => argument.slice('--card='.length))

const AUDIT_CONFIGS = {
  P: {
    label: 'P-0XX',
    source: 'data/cards/official-p-0xx-remaining.en.json',
    report: 'docs/p0xx-effect-audit-2026-08-10.json',
    expectedEffectCardCount: 108,
    conditionTestStatePrefix: 'p-condition',
    conditionCardNumbers: [
      'P-041',
      'P-058',
      'P-059',
      'P-064',
      'P-065',
      'P-067',
      'P-071',
      'P-074',
      'P-075',
      'P-093',
      'P-094',
      'P-095',
      'P-098',
      'P-103',
      'P-103@1',
      'P-106',
      'P-109',
      'P-110',
      'P-119',
      'P-121',
      'P-128',
      'P-131',
      'P-134',
      'P-137',
      'P-142',
      'P-145',
    ],
    alwaysIncludeCardNumbers: [],
  },
  BS6: {
    label: 'BS6',
    source: 'data/cards/official-age-of-heroes-and-kingdoms-bs6.en.json',
    report: 'docs/bs6-effect-audit-2026-08-12.json',
    // 以基礎卡號去重後，97 張卡具有主效果、FLIP、陷阱／物品／場景或攻擊 Then。
    // BS6-091 只有 @2／@3 異圖，仍以其中一張代表記錄納入稽核。
    expectedEffectCardCount: 97,
    conditionTestStatePrefix: 'bs6-condition',
    conditionCardNumbers: ['BS6-039'],
    alwaysIncludeCardNumbers: ['BS6-091@2'],
  },
}
const auditConfig = AUDIT_CONFIGS[requestedSeries]
if (!auditConfig) {
  throw new Error(
    `Unsupported formal effect audit series: ${requestedSeries}. Supported series: ${Object.keys(AUDIT_CONFIGS).join(', ')}`,
  )
}
const formalPath = resolve(root, auditConfig.source)
const reportPath = resolve(root, auditConfig.report)
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

const source = JSON.parse(await readFile(formalPath, 'utf8'))
const hasText = (value) => typeof value === 'string' && value.trim().length > 0
const hasEffectSurface = (card) => {
  const skill = hasText(card.skill?.text)
  const attackThen = hasText(card.attackText) && /\bThen\b/i.test(card.attackText)
  return (
    card.type === 'item' ||
    card.type === 'trap' ||
    card.type === 'stage' ||
    (card.type === 'flip' && hasText(card.flipText)) ||
    skill ||
    attackThen ||
    auditConfig.alwaysIncludeCardNumbers.includes(card.cardNumber)
  )
}
const getBaseCardNumber = (card) => card.baseCardNumber || card.cardNumber
const selectRepresentativeCards = (records) => {
  if (!isBs6Audit) {
    return records.filter((card) => hasEffectSurface(card))
  }

  const representativesByBase = new Map()
  for (const card of records) {
    const base = getBaseCardNumber(card)
    const previous = representativesByBase.get(base)
    if (
      hasEffectSurface(card) &&
      (!previous || card.cardNumber === base)
    ) {
      representativesByBase.set(base, card)
    }
  }
  return [...representativesByBase.values()]
}
const cards = selectRepresentativeCards([...source.cards])
  .filter(
    (card) =>
      requestedCardNumbers.length === 0 ||
      requestedCardNumbers.includes(card.cardNumber) ||
      requestedCardNumbers.includes(card.baseCardNumber),
  )
  .sort((left, right) =>
    left.cardNumber.localeCompare(right.cardNumber, undefined, { numeric: true }),
  )
if (requestedCardNumbers.length === 0) {
  assert.equal(
    cards.length,
    auditConfig.expectedEffectCardCount,
    `${auditConfig.label} formal effect-bearing inventory must contain ${auditConfig.expectedEffectCardCount} records`,
  )
}

const conditionCardNumbers = new Set(auditConfig.conditionCardNumbers)

const effectSurfaces = (card) => {
  const surfaces = []
  if (card.type === 'cookie' && card.skill?.text?.trim()) surfaces.push('skill')
  if (/\bThen\b/i.test(card.attackText ?? '')) surfaces.push('attack-then')
  if (card.type === 'flip') surfaces.push('flip')
  if (card.type === 'item') surfaces.push('item')
  if (card.type === 'trap') surfaces.push('trap')
  if (card.type === 'stage') surfaces.push('stage')
  return surfaces
}

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const MAX_DRIVER_OPERATIONS_PER_CARD = 48
const visible = async (locator) =>
  (await locator.count()) > 0 && (await locator.first().isVisible().catch(() => false))
const enabled = async (locator) =>
  (await visible(locator)) && (await locator.first().isEnabled().catch(() => false))
const count = async (page, selector) => page.locator(selector).count()

const ignoredConsoleError = (message) => {
  if (message.type() !== 'error') return true
  const location = message.location()
  const text = message.text()
  if (location.url?.endsWith('/favicon.ico') && text.includes('404')) return true
  return Boolean(
    location.url?.includes('cookierunbraverse.com/data/en_storage/') &&
      /ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(text),
  )
}

const waitForPreview = async () => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(baseUrl)).ok) return
    } catch {
      // Preview server is still starting.
    }
    await wait(100)
  }
  throw new Error(`Vite preview did not start at ${baseUrl}`)
}

const activePanel = (page) => page.locator('.effect-panel[role="alertdialog"]')

const clickFirstUnselected = async (panel, selectors, operations) => {
  const panelText = await panel.innerText().catch(() => '')
  for (const selector of selectors) {
    const group = panel.locator(selector).first()
    if (!(await visible(group))) continue

    const groupText = await group.innerText().catch(() => '')
    const panelProgress = selector.includes('target')
      ? panelText.match(/(?:已選|選擇)\s*(\d+)\s*[\/／]\s*(\d+)/)
      : null
    if (panelProgress && Number(panelProgress[1]) >= Number(panelProgress[2])) continue
    const progress = groupText.match(/(?:已選\s*)?(\d+)\s*[\/／]\s*(\d+)/)
    if (progress && Number(progress[1]) >= Number(progress[2])) continue

    const selectedCount = await group.locator('button.is-selected').count()
    // `hpToTrash.amount` means how many HP cards are discarded after one
    // Cookie is selected. It is not a count of selectable Cookies, so the
    // UI always accepts exactly one source Cookie for this cost.
    const maxSelections = selector.includes('hp-cost')
      ? 1
      : progress
        ? Number(progress[2])
        : undefined
    if (maxSelections !== undefined && selectedCount >= maxSelections) continue
    if (!progress && !panelProgress && selector.includes('target') && selectedCount > 0) continue

    const candidate = group.locator('button:not(.is-selected):not(:disabled)').first()
    if (!(await enabled(candidate))) continue
    await candidate.click({ force: true })
    operations.push(`select:${selector}`)
    await wait(120)
    return true
  }
  return false
}

const driveEffectPanel = async (page, operations) => {
  const panel = activePanel(page)
  if (!(await visible(panel))) return false

  const optionalAttack = panel.locator('.optional-cost-attack-inline').first()
  if (await visible(optionalAttack)) {
    const pay = optionalAttack
      .locator('.modal-actions-decision button')
      .filter({ hasText: /支付|Pay/i })
      .first()
    if (await enabled(pay)) {
      await pay.click({ force: true })
      operations.push('start:optional-cost-attack')
      await wait(180)
      return true
    }

    const candidate = optionalAttack
      .locator(
        '.optional-cost-col .modal-card-options button:not(.is-selected):not(:disabled)',
      )
      .first()
    const optionalSelectedCount = await optionalAttack
      .locator('.optional-cost-col .modal-card-options button.is-selected')
      .count()
    if (optionalSelectedCount === 0 && (await enabled(candidate))) {
      await candidate.click({ force: true })
      operations.push('select:optional-cost')
      await wait(120)
      return true
    }

    const confirm = optionalAttack
      .locator('.modal-actions-sticky button:not(:disabled)')
      .last()
    if (await enabled(confirm)) {
      await confirm.click({ force: true })
      operations.push('confirm:optional-cost')
      await wait(180)
      return true
    }

    const skip = optionalAttack
      .locator('.modal-actions-decision button')
      .filter({ hasText: /略過|Skip/i })
      .first()
    if (await enabled(skip)) {
      await skip.click({ force: true })
      operations.push('skip:optional-cost')
      await wait(180)
      return true
    }
    return false
  }

  const selected = await clickFirstUnselected(
    panel,
    [
      '.effect-candidates-payment',
      '.effect-candidates-cost-support',
      '.effect-candidates-discard-hand',
      '.effect-candidates-hp-cost',
      '.effect-candidates-trash-battle',
      '.effect-candidates-trash-deck-bottom',
      '.effect-candidates-trash-deck',
      '.effect-candidates-rest-support',
      '.effect-candidates-choice',
      '.effect-candidates-target',
      '.optional-cost-col .modal-card-options',
    ],
    operations,
  )
  if (selected) return true

  const primary = panel.locator('.effect-panel-primary-action').first()
  if (await enabled(primary)) {
    const primaryLabel = (await primary.innerText()).trim()
    await primary.click({ force: true })
    operations.push(`confirm:effect-panel:${primaryLabel}`)
    // React state and pending-response modals settle asynchronously. Give
    // the next modal enough time to replace the effect panel before the next
    // driver pass, otherwise a stale confirm can be clicked repeatedly.
    await wait(500)
    return true
  }

  const skip = panel.locator('.skip-effect').first()
  if (await enabled(skip)) {
    await skip.click({ force: true })
    operations.push('skip:optional-effect')
    await wait(180)
    return true
  }

  return false
}

const driveOtherModal = async (page, operations) => {
  const flip = page.locator('.flip-response-modal').first()
  if (await visible(flip)) {
    const option = flip.locator(
      '.flip-hand-carousel button:not(.is-selected):not(:disabled), .modal-card-options button:not(.is-selected):not(:disabled)',
    ).first()
    const selectedOptionCount = await flip.locator(
      '.flip-hand-carousel button.is-selected, .modal-card-options button.is-selected',
    ).count()
    if (selectedOptionCount === 0 && (await enabled(option))) {
      await option.click({ force: true })
      operations.push('select:flip')
      await wait(120)
      return true
    }
    const activate = flip.locator(
      '.flip-activate, .modal-actions button:not(:disabled), .modal-button.primary',
    ).filter({ hasText: /發動 FLIP|Activate|確認/ }).first()
    if (!(await enabled(activate))) return false
    await activate.click({ force: true })
    operations.push('confirm:flip')
    await wait(180)
    return true
  }

  const trap = page.locator('.trap-response-modal').first()
  if (await visible(trap)) {
    const card = trap.locator('.modal-card-options button:not(.is-selected)').first()
    const selectedTrapCount = await trap.locator('.modal-card-options button.is-selected').count()
    if (selectedTrapCount === 0 && (await enabled(card))) {
      await card.click({ force: true })
      operations.push('select:trap')
      await wait(180)
      return true
    }
    const activate = trap.locator(
      '.modal-actions-sticky button:not(:disabled), .modal-actions button:not(:disabled)',
    ).filter({ hasText: /發動|Activate|確認/ }).first()
    if (await enabled(activate)) {
      await activate.click({ force: true })
      operations.push('confirm:trap')
      await wait(180)
      return true
    }
    return false
  }

  const draw = page.locator('.draw-up-to-modal').first()
  if (await visible(draw)) {
    const option = draw.locator('.draw-up-to-option').first()
    if (await enabled(option)) await option.click({ force: true })
    const confirm = draw.locator('.draw-up-to-actions button:not(:disabled)').last()
    if (!(await enabled(confirm))) return false
    await confirm.click({ force: true })
    operations.push('confirm:draw-up-to')
    await wait(180)
    return true
  }

  const discard = page.locator('.hand-discard-modal[role="alertdialog"]')
  if (await visible(discard)) {
    const option = discard.locator('.hand-discard-options button:not(.is-selected)').first()
    if (await enabled(option)) await option.click({ force: true })
    const confirm = discard.locator('.hand-discard-actions button:not(:disabled)').first()
    if (!(await enabled(confirm))) return false
    await confirm.click({ force: true })
    operations.push('confirm:hand-discard')
    await wait(180)
    return true
  }

  const inspect = page.locator('.inspect-deck-modal').first()
  if (await visible(inspect)) {
    const option = inspect.locator('.inspect-deck-grid button:not(.is-selected)').first()
    if (await enabled(option)) await option.click({ force: true })
    const confirm = inspect.locator('.modal-actions button:not(:disabled)').last()
    if (!(await enabled(confirm))) return false
    await confirm.click({ force: true })
    operations.push('confirm:inspect-deck')
    await wait(180)
    return true
  }

  const reveal = page.locator('.card-reveal-modal[role="alertdialog"]')
  if (await visible(reveal)) {
    const confirm = reveal.locator('.reveal-confirm').first()
    if (!(await enabled(confirm))) return false
    await confirm.click({ force: true })
    operations.push('confirm:reveal')
    await wait(180)
    return true
  }

  const faint = page.locator('.faint-response-modal').first()
  if (await visible(faint)) {
    const payment = faint.locator(
      '.faint-payment-candidates button:not(.is-selected):not(:disabled), .faint-cost-hand-candidates button:not(.is-selected):not(:disabled), .faint-cost-support-candidates button:not(.is-selected):not(:disabled)',
    ).first()
    if (await enabled(payment)) {
      await payment.click({ force: true })
      operations.push('select:faint-cost')
      await wait(120)
      return true
    }

    const target = faint.locator(
      '.faint-target-candidates button:not(.is-selected):not(:disabled), .faint-card-candidates button:not(.is-selected):not(:disabled), .top-field .combat-card-wrap.is-attack-target',
    ).first()
    const selectedTargetCount = await faint.locator(
      '.faint-target-candidates button.is-selected, .faint-card-candidates button.is-selected',
    ).count()
    if (selectedTargetCount === 0 && (await enabled(target))) {
      await target.click({ force: true })
      operations.push('select:faint-target')
      await wait(120)
      return true
    }

    const confirm = faint.locator('.modal-actions button:not(:disabled)').last()
    if (!(await enabled(confirm))) return false
    await confirm.click({ force: true })
    operations.push('confirm:faint-response')
    await wait(180)
    return true
  }

  const replacement = page
    .locator('.decision-modal')
    .filter({ hasText: /尚可補|放置餅乾|補餅乾/ })
    .first()
  if (await visible(replacement)) {
    const skip = replacement
      .locator('button')
      .filter({ hasText: /不補餅乾|略過|Skip/i })
      .first()
    if (!(await enabled(skip))) return false
    await skip.click({ force: true })
    operations.push('skip:replacement')
    await wait(180)
    return true
  }

  const order = page.locator('.effect-order-modal').first()
  if (await visible(order)) {
    const option = order.locator('.modal-card-options button').first()
    if (await enabled(option)) await option.click({ force: true })
    const confirm = order.locator('.modal-actions button:not(:disabled)').last()
    if (!(await enabled(confirm))) return false
    await confirm.click({ force: true })
    operations.push('confirm:effect-order')
    await wait(180)
    return true
  }

  return false
}

const settlePending = async (page, operations) => {
  for (let round = 0; round < 32; round += 1) {
    if (operations.length >= MAX_DRIVER_OPERATIONS_PER_CARD) {
      throw new Error(
        `effect driver operation budget exceeded (${MAX_DRIVER_OPERATIONS_PER_CARD})`,
      )
    }
    if (await driveOtherModal(page, operations)) continue
    if (await driveEffectPanel(page, operations)) continue
    const pendingCount =
      (await count(page, '.effect-panel[role="alertdialog"]')) +
      (await count(page, '.flip-response-modal')) +
      (await count(page, '.trap-response-modal')) +
      (await count(page, '.draw-up-to-modal')) +
      (await count(page, '.hand-discard-modal[role="alertdialog"]')) +
      (await count(page, '.inspect-deck-modal')) +
      (await count(page, '.card-reveal-modal[role="alertdialog"]')) +
      (await count(page, '.faint-response-modal')) +
      (await count(page, '.effect-order-modal')) +
      (await count(page, '.decision-modal'))
    if (pendingCount === 0) return
    await wait(180)
  }
  throw new Error('pending UI did not settle')
}

const clickSkill = async (page) => {
  const action = page.locator('.bottom-field .skill-action').first()
  if (!(await enabled(action))) return false
  await action.click({ force: true })
  await wait(180)
  return true
}

const clickFirstHandAction = async (page) => {
  const hand = page.locator('.bottom-hand .hand-card-wrap').first()
  if (!(await visible(hand))) return false
  await hand.locator('.hand-card').click({ force: true })
  await wait(120)
  const action = hand.locator('.hand-card-action').first()
  if (!(await enabled(action))) return false
  await action.click({ force: true })
  await wait(180)
  return true
}

const clickNextPhase = async (page) => {
  const action = page.locator('.next-phase-button').first()
  if (!(await enabled(action))) return false
  await action.click({ force: true })
  await wait(260)
  return true
}

const bodyText = async (page) => (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim()

const pendingSurfaceCount = async (page) =>
  (await count(page, '.effect-panel[role="alertdialog"]')) +
  (await count(page, '.flip-response-modal')) +
  (await count(page, '.trap-response-modal')) +
  (await count(page, '.draw-up-to-modal')) +
  (await count(page, '.hand-discard-modal')) +
  (await count(page, '.inspect-deck-modal')) +
  (await count(page, '.card-reveal-modal')) +
  (await count(page, '.faint-response-modal')) +
  (await count(page, '.effect-order-modal')) +
  (await count(page, '.decision-modal'))

const effectPanelDebug = async (page) => {
  const panel = activePanel(page)
  return {
    panelText: (await panel.innerText().catch(() => '')).replace(/\s+/g, ' ').trim(),
    selectedHpCost: await panel.locator('.effect-candidates-hp-cost button.is-selected').count(),
    selectedTargets: await panel.locator('.effect-candidates-target button.is-selected').count(),
  }
}

const runCard = async (
  page,
  card,
  testState = `card:${card.cardNumber}`,
  {
    path = 'generic',
    requireInteractiveOperation = true,
  } = {},
) => {
  const consoleErrors = []
  const pageErrors = []
  const onConsole = (message) => {
    if (!ignoredConsoleError(message)) consoleErrors.push(message.text())
  }
  const onPageError = (error) => pageErrors.push(error.message)
  page.on('console', onConsole)
  page.on('pageerror', onPageError)
  const operations = []

  try {
    await page.goto(`${baseUrl}?test-state=${encodeURIComponent(testState)}`, {
      waitUntil: 'domcontentloaded',
    })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    await page.waitForTimeout(400)
    const before = await bodyText(page)
    assert.ok(!/遊戲畫面發生錯誤|Application Error|Unhandled Runtime Error/i.test(before))

    for (let round = 0; round < 8; round += 1) {
      const settledBefore = operations.length
      await settlePending(page, operations)
      if (operations.length !== settledBefore) continue
      if (await clickSkill(page)) {
        operations.push('action:skill')
        continue
      }
      if (await clickFirstHandAction(page)) {
        operations.push('action:hand')
        continue
      }
      if (await clickNextPhase(page)) {
        operations.push('action:next-phase')
        continue
      }
      break
    }

    const after = await bodyText(page)
    assert.ok(!/遊戲畫面發生錯誤|Application Error|Unhandled Runtime Error/i.test(after))
    assert.deepEqual(consoleErrors, [], `console errors: ${JSON.stringify(consoleErrors)}`)
    assert.deepEqual(pageErrors, [], `page errors: ${JSON.stringify(pageErrors)}`)

    const hasInteractiveOperation = operations.some((operation) =>
      /^(action:(skill|hand|next-phase)|start:|select:|confirm:|skip:)/.test(
        operation,
      ),
    )
    const pendingSurface = await pendingSurfaceCount(page)

    if (
      pendingSurface === 0 &&
      (hasInteractiveOperation || !requireInteractiveOperation)
    ) {
      return {
        cardNumber: card.cardNumber,
        baseCardNumber: card.baseCardNumber,
        variant: card.variant,
        name: card.name,
        type: card.type,
        color: card.color,
        effectSurfaces: effectSurfaces(card),
        path,
        testState,
        status: 'PASS',
        auditStatus: requireInteractiveOperation
          ? 'Effect flow settled'
          : 'No-op or timing path settled',
        operations,
      }
    }

    return {
      cardNumber: card.cardNumber,
      baseCardNumber: card.baseCardNumber,
      variant: card.variant,
      name: card.name,
      type: card.type,
      color: card.color,
      effectSurfaces: effectSurfaces(card),
      path,
      testState,
      status: 'BLOCKED',
      auditStatus: hasInteractiveOperation
        ? 'Pending UI remained'
        : 'No interactive effect path',
      operations,
      pendingSurface,
      debug: await effectPanelDebug(page),
    }
  } catch (error) {
    return {
      cardNumber: card.cardNumber,
      baseCardNumber: card.baseCardNumber,
      variant: card.variant,
      name: card.name,
      type: card.type,
      color: card.color,
      effectSurfaces: effectSurfaces(card),
      path,
      testState,
      status: 'FAIL',
      auditStatus: 'Browser or runtime error',
      operations,
      error: error instanceof Error ? error.message : String(error),
      debug: await effectPanelDebug(page),
    }
  } finally {
    page.off('console', onConsole)
    page.off('pageerror', onPageError)
  }
}

const server = spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  page.setDefaultTimeout(7000)

  console.log(
    `=== ${auditConfig.label} interactive effect audit (${cards.length} records, ${browserExecutable ?? 'Playwright Chromium'}) ===`,
  )
  for (const card of cards) {
    const genericResult = await runCard(page, card)
    let result = genericResult
    if (conditionCardNumbers.has(card.cardNumber)) {
      const met = await runCard(
        page,
        card,
        `${auditConfig.conditionTestStatePrefix}:${card.cardNumber}:met`,
        { path: 'condition-met', requireInteractiveOperation: true },
      )
      const unmet = await runCard(
        page,
        card,
        `${auditConfig.conditionTestStatePrefix}:${card.cardNumber}:unmet`,
        { path: 'condition-unmet', requireInteractiveOperation: false },
      )
      const conditionPaths = { met, unmet }
      const pathStatuses = [met.status, unmet.status]
      const dedicatedFailed = pathStatuses.includes('FAIL')
      const dedicatedPassed = pathStatuses.every((status) => status === 'PASS')
      result = {
        ...genericResult,
        status:
          genericResult.status === 'FAIL' || dedicatedFailed
            ? 'FAIL'
            : dedicatedPassed
              ? 'PASS'
              : 'BLOCKED',
        auditStatus: dedicatedPassed
          ? 'Dedicated condition A/B paths settled'
          : dedicatedFailed
            ? 'Dedicated condition path failed'
            : 'Dedicated condition path blocked',
        genericStatus: genericResult.status,
        conditionPaths,
      }
      console.log(
        `  A/B ${card.cardNumber} met=${met.status} unmet=${unmet.status}`,
      )
    }
    results.push(result)
    console.log(
      `${result.status} ${card.cardNumber} ${card.name} ${result.auditStatus} ${result.operations.join(',')}`,
    )
  }

  await page.close()
  await browser.close()
  browser = undefined
  server.kill()

  const report = {
    generatedAt: new Date().toISOString(),
    browser: browserExecutable ?? 'playwright-chromium',
    viewport: '1440x960',
    source: auditConfig.source,
    scope:
      `Formal-pool test-state interaction audit for ${auditConfig.label} effect-bearing records plus dedicated A/B paths for ${conditionCardNumbers.size} condition or timing cards. PASS means the real UI opened, the required path settled without browser/runtime errors, and no pending modal remained. Unmet paths may legitimately be a no-op; passive and end-phase cards are accepted when their timing path settles.`,
    summary: {
      total: results.length,
      effectFlowPassed: results.filter((result) => result.status === 'PASS').length,
      blocked: results.filter((result) => result.status === 'BLOCKED').length,
      failed: results.filter((result) => result.status === 'FAIL').length,
      dedicatedConditionCards: results.filter((result) => result.conditionPaths).length,
      dedicatedConditionCardsPassed: results.filter(
        (result) => result.conditionPaths && result.status === 'PASS',
      ).length,
      byStatus: Object.fromEntries(
        [...new Set(results.map((result) => result.auditStatus))].map((status) => [
          status,
          results.filter((result) => result.auditStatus === status).length,
        ]),
      ),
    },
    results,
  }
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(
    `\nSummary: ${report.summary.effectFlowPassed} passed, ${report.summary.blocked} blocked, ${report.summary.failed} failed`,
  )
  console.log(`Evidence: ${reportPath}`)
  process.exitCode = report.summary.failed === 0 ? 0 : 1
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  server.kill()
}
