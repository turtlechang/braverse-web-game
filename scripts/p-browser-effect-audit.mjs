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
const auditActionTimeout = Number(
  process.env.BRAVERSE_AUDIT_ACTION_TIMEOUT_MS ?? 7000,
)
const auditNavigationTimeout = Number(
  process.env.BRAVERSE_AUDIT_NAVIGATION_TIMEOUT_MS ?? 15000,
)
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
const auditVanillaAttacks = process.argv.includes('--vanilla-attacks')
const auditNegative = process.argv.includes('--negative')
const auditFailFast = process.argv.includes('--fail-fast')
const requestedCardNumbers = process.argv
  .filter((argument) => argument.startsWith('--card='))
  .map((argument) => argument.slice('--card='.length))

const AUDIT_CONFIGS = {
  BS1: {
    label: 'BS1',
    sources: ['data/cards/official-brave-beginning-bs1.en.json'],
    report: 'docs/bs1-effect-audit-2026-08-20.json',
    expectedEffectCardCount: 81,
    conditionTestStatePrefix: 'bs1-condition',
    conditionCardNumbers: [],
    alwaysIncludeCardNumbers: [],
  },
  BS2: {
    label: 'BS2',
    sources: ['data/cards/official-brave-beginning-bs2.en.json'],
    report: 'docs/bs2-effect-audit-2026-08-20.json',
    expectedEffectCardCount: 86,
    conditionTestStatePrefix: 'bs2-condition',
    conditionCardNumbers: [],
    alwaysIncludeCardNumbers: [],
  },
  BS3: {
    label: 'BS3',
    sources: [
      'data/cards/official-age-of-heroes-and-kingdoms-bs3.en.json',
    ],
    report: 'docs/bs3-effect-audit-2026-08-20.json',
    expectedEffectCardCount: 166,
    conditionTestStatePrefix: 'bs3-condition',
    conditionCardNumbers: [],
    alwaysIncludeCardNumbers: [],
  },
  BS4: {
    label: 'BS4',
    sources: [
      'data/cards/official-age-of-heroes-and-kingdoms-bs4.en.json',
    ],
    report: 'docs/bs4-effect-audit-2026-08-20.json',
    expectedEffectCardCount: 158,
    conditionTestStatePrefix: 'bs4-condition',
    // BS4's dedicated interaction validator asserts the resulting state and
    // DOM markers. Several met routes are passive/no-op UI paths, so this
    // generic settlement audit must not require a button click to accept them.
    conditionMetRequiresInteraction: false,
    conditionCardNumbers: [
      'BS4-011',
      'BS4-012',
      'BS4-014',
      'BS4-016',
      'BS4-020',
      'BS4-023',
      'BS4-024',
      'BS4-039',
      'BS4-040',
      'BS4-048',
      'BS4-049',
      'BS4-052',
      'BS4-053',
      'BS4-059',
      'BS4-061',
      'BS4-073',
      'BS4-083',
      'BS4-089',
      'BS4-090',
      'BS4-094',
      'BS4-106',
      'BS4-107',
    ],
    alwaysIncludeCardNumbers: [],
  },
  BS5: {
    label: 'BS5',
    sources: [
      'data/cards/official-age-of-heroes-and-kingdoms-bs5.en.json',
    ],
    report: 'docs/bs5-effect-audit-2026-08-13.json',
    // BS5 keeps every effect-bearing formal record in the audit, including
    // illustration variants, because variant records can carry normalized
    // attack/skill text that must remain safe in the card-check route.
    // BS5-089@2 is normalized at the adapter boundary into the same
    // attack-Then definition as BS5-089, so it is an effect-bearing variant
    // even though the raw API leaves `attackText` empty.
    // BS5-073 is a COOKIE-typed record with official FLIP text and counts as
    // effect-bearing through the flipText surface.
    expectedEffectCardCount: 143,
    conditionTestStatePrefix: 'bs5-condition',
    conditionTestStates: {
      'BS5-007': 'bs5-faint',
      'BS5-011': 'bs5-faint',
      'BS5-020': 'bs5-item',
      'BS5-021': 'bs5-trap',
      'BS5-022': 'bs5-stage',
      'BS5-026': 'bs5-faint',
      'BS5-043': 'bs5-trap',
      'BS5-047': 'bs5-faint',
      'BS5-065': 'bs5-trap',
      'BS5-072': 'bs5-faint',
      'BS5-087': 'bs5-trap',
      'BS5-107': 'bs5-faint',
      'BS5-109': 'bs5-trap',
      'BS5-111': 'bs5-item',
    },
    conditionCardNumbers: [
      'BS5-007',
      'BS5-011',
      'BS5-020',
      'BS5-021',
      'BS5-022',
      'BS5-026',
      'BS5-043',
      'BS5-047',
      'BS5-065',
      'BS5-072',
      'BS5-087',
      'BS5-107',
      'BS5-109',
      'BS5-111',
    ],
    alwaysIncludeCardNumbers: [],
  },
  P: {
    label: 'P-0XX',
    sources: [
      'data/cards/official-promotion-p001-p032.en.json',
      'data/cards/official-promotion-p001-p032-remaining.en.json',
      'data/cards/official-p-0xx-remaining.en.json',
    ],
    report: 'docs/p0xx-effect-audit-2026-08-20.json',
    // P-053/P-130 express attack follow-ups without `Then`; P-099/P-100 have
    // FLIP text recovered from malformed source fields by normalization.
    expectedEffectCardCount: 138,
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
    sources: [
      'data/cards/official-age-of-heroes-and-kingdoms-bs6.en.json',
    ],
    report: 'docs/bs6-effect-audit-2026-08-12.json',
    // 以基礎卡號去重後，97 張卡具有主效果、FLIP、陷阱／物品／場景或攻擊 Then。
    // BS6-091 只有 @2／@3 異圖，仍以其中一張代表記錄納入稽核。
    expectedEffectCardCount: 97,
    conditionTestStatePrefix: 'bs6-condition',
    conditionCardNumbers: ['BS6-039'],
    alwaysIncludeCardNumbers: ['BS6-091@2', 'BS6-091@3'],
  },
}
const auditConfig = AUDIT_CONFIGS[requestedSeries]
if (!auditConfig) {
  throw new Error(
    `Unsupported formal effect audit series: ${requestedSeries}. Supported series: ${Object.keys(AUDIT_CONFIGS).join(', ')}`,
  )
}
const reportPath = resolve(
  root,
  process.env.BRAVERSE_AUDIT_REPORT ?? auditConfig.report,
)
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
  auditConfig.sources.map(async (formalPath) =>
    JSON.parse(await readFile(resolve(root, formalPath), 'utf8')),
  ),
)
const source = { cards: sources.flatMap((formalSource) => formalSource.cards) }
const hasText = (value) => typeof value === 'string' && value.trim().length > 0
const knownAttackEffectVariants = new Set([
  'BS5-089@2',
  // These official texts omit `Then` even though the clause is resolved as
  // an attack follow-up by the shared runtime adapter.
  'P-053',
  'P-130',
])
const normalizedFlipVariants = new Set(['P-099', 'P-100'])
const knownNonEffectFlipTextVariants = new Set([
  // The source repeats the attack name in flipText; adapter normalization
  // correctly keeps these illustration variants as vanilla Cookies.
  'BS4-045@1',
  'BS4-097@1',
])
const normalizedSkillVariants = new Set(['BS6-091@2', 'BS6-091@3'])
const hasEffectSurface = (card) => {
  const skill = hasText(card.skill?.text)
  const attackThen =
    (hasText(card.attackText) && /\bThen\b/i.test(card.attackText)) ||
    knownAttackEffectVariants.has(card.cardNumber)
  // 官方資料把帶有 FLIP 能力的餅乾記成 COOKIE（BS5-073/074）；是否為
  // FLIP 以 flipText 判斷，不能只看 card.type。
  const flip =
    (hasText(card.flipText) &&
      !knownNonEffectFlipTextVariants.has(card.cardNumber)) ||
    normalizedFlipVariants.has(card.cardNumber)
  return (
    card.type === 'item' ||
    card.type === 'trap' ||
    card.type === 'stage' ||
    flip ||
    skill ||
    attackThen ||
    normalizedSkillVariants.has(card.cardNumber) ||
    auditConfig.alwaysIncludeCardNumbers.includes(card.cardNumber)
  )
}
const isVanillaAttackCookie = (card) =>
  // Official `flip` attachment records are converted into runtime Cookie
  // cards. When no FlipAbility exists (BS2-042/P-047), they still need the
  // same deploy/attack and no-payment checks as other vanilla Cookies.
  (card.type === 'cookie' || card.type === 'flip') && !hasEffectSurface(card)
const getBaseCardNumber = (card) => card.baseCardNumber || card.cardNumber
const selectRepresentativeCards = (records) => {
  if (auditNegative) {
    return records
  }
  if (auditVanillaAttacks) {
    // Illustration variants can be independently normalized in the runtime
    // pool, so exercise every formal vanilla Cookie record rather than
    // reducing this UI operation check to one record per base card number.
    return records.filter(isVanillaAttackCookie)
  }

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
const explicitlyRequestedEffectVariants =
  !auditVanillaAttacks && isBs6Audit && requestedCardNumbers.length > 0
    ? source.cards.filter(
        (card) =>
          requestedCardNumbers.includes(card.cardNumber) &&
          hasEffectSurface(card),
      )
    : []
const cards = [
  ...new Map(
    [
      ...selectRepresentativeCards([...source.cards]),
      ...explicitlyRequestedEffectVariants,
    ].map((card) => [card.cardNumber, card]),
  ).values(),
]
  .filter(
    (card) =>
      requestedCardNumbers.length === 0 ||
      requestedCardNumbers.includes(card.cardNumber) ||
      requestedCardNumbers.includes(card.baseCardNumber),
  )
  .sort((left, right) =>
    left.cardNumber.localeCompare(right.cardNumber, undefined, { numeric: true }),
  )
if (!auditVanillaAttacks && !auditNegative && requestedCardNumbers.length === 0) {
  assert.equal(
    cards.length,
    auditConfig.expectedEffectCardCount,
    `${auditConfig.label} formal effect-bearing inventory must contain ${auditConfig.expectedEffectCardCount} records`,
  )
}

const conditionCardNumbers = new Set(auditConfig.conditionCardNumbers)
const conditionTestState = (cardNumber, result) =>
  `${auditConfig.conditionTestStates?.[cardNumber] ?? auditConfig.conditionTestStatePrefix}:${cardNumber}:${result}`

const effectSurfaces = (card) => {
  const surfaces = []
  if (
    (card.type === 'cookie' && card.skill?.text?.trim()) ||
    normalizedSkillVariants.has(card.cardNumber)
  ) {
    surfaces.push('skill')
  }
  if (
    /\bThen\b/i.test(card.attackText ?? '') ||
    knownAttackEffectVariants.has(card.cardNumber)
  ) {
    surfaces.push('attack-then')
  }
  if (
    (hasText(card.flipText) &&
      !knownNonEffectFlipTextVariants.has(card.cardNumber)) ||
    normalizedFlipVariants.has(card.cardNumber)
  ) {
    surfaces.push('flip')
  }
  if (card.type === 'item') surfaces.push('item')
  if (card.type === 'trap') surfaces.push('trap')
  if (card.type === 'stage') surfaces.push('stage')
  return surfaces
}
const auditedSurfaces = (card) => {
  const surfaces = effectSurfaces(card)
  return surfaces.length > 0 ? surfaces : ['vanilla-attack']
}

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const MAX_DRIVER_OPERATIONS_PER_CARD = 48
const visible = async (locator) =>
  (await locator.count()) > 0 && (await locator.first().isVisible().catch(() => false))
const enabled = async (locator) =>
  (await visible(locator)) && (await locator.first().isEnabled().catch(() => false))

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
  const typedProgressPattern = (selector) => {
    if (selector.includes('trash-deck-bottom')) {
      return /已選\s*(\d+)\s*[\/／]\s*(\d+)\s*張棄牌區代價（依選取順序放到牌庫底）/
    }
    if (selector.includes('trash-deck')) {
      return /已選\s*(\d+)\s*[\/／]\s*(\d+)\s*張符合條件的棄牌區卡牌（洗回牌庫）/
    }
    if (selector.includes('cost-support')) {
      return /已選\s*(\d+)\s*[\/／]\s*(\d+)\s*張支援區代價/
    }
    if (selector.includes('discard-hand')) {
      return /已選\s*(\d+)\s*[\/／]\s*(\d+)\s*張手牌代價/
    }
    if (selector.includes('hp-cost')) {
      return /已選\s*(\d+)\s*張\s*[\/／]\s*(\d+)\s*張 HP 費用/
    }
    if (selector.includes('trash-battle')) {
      return /已選\s*(\d+)\s*[\/／]\s*(\d+)\s*張戰鬥區餅乾代價/
    }
    if (selector.includes('rest-support')) {
      return /已選\s*(\d+)\s*[\/／]\s*(\d+)/
    }
    if (selector.includes('battle-to-hand')) {
      return /已選擇\s*(\d+)\s*張，\s*需要返回\s*(\d+)\s*張戰鬥區餅乾/
    }
    return null
  }
  for (const selector of selectors) {
    const group = panel.locator(selector).first()
    if (!(await visible(group))) continue

    const groupText = await group.innerText().catch(() => '')
    const panelProgress = selector.includes('target')
      ? panelText.match(/(?:已選|選擇)\s*(\d+)\s*[\/／]\s*(\d+)/)
      : null
    if (panelProgress && Number(panelProgress[1]) >= Number(panelProgress[2])) continue
    const typedPattern = typedProgressPattern(selector)
    const progress =
      groupText.match(/(?:已選\s*)?(\d+)\s*[\/／]\s*(\d+)/) ??
      (typedPattern ? panelText.match(typedPattern) : null)
    if (progress && Number(progress[1]) >= Number(progress[2])) continue

    const selectedCount = await group.locator('button.is-selected').count()
    // `hpToTrash.amount` means how many HP cards are discarded after one
    // Cookie is selected. It is not a count of selectable Cookies, so the
    // UI always accepts exactly one source Cookie for this cost.
    const maxSelections = selector.includes('hp-cost') || selector.includes('choice')
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

const driveEffectPanel = async (
  page,
  operations,
  { negative = false, settleAttackEffects = false } = {},
) => {
  const panel = activePanel(page)
  if (!(await visible(panel))) return false

  // `card-negative` keeps an attack-Then card at the real post-attack
  // pending window. The attack payment has already happened before this
  // window, so B-path validation must resolve the actual Then UI instead of
  // trying to reject an already-declared attack as if it were a skill cost.
  if (negative && settleAttackEffects) {
    return driveEffectPanel(page, operations)
  }

  if (negative) {
    // OnPlay panels can expose both "取消技能" and "略過整個登場效果";
    // the latter is the B-path skip and is rendered last.
    // Only energy/support payment candidates are illegal in this fixture.
    // Other candidate groups are real effect targets or alternative costs
    // that still need to be resolved after the payment check (for example,
    // an OnPlay effect returning one rested support card to hand).
    const paymentCandidate = panel
      .locator(
        '.effect-candidates-payment button:not(:disabled)',
      )
      .first()
    if (await enabled(paymentCandidate)) {
      throw new Error('negative path exposed an enabled effect candidate')
    }

    const selected = await clickFirstUnselected(
      panel,
      [
        '.effect-candidates-cost-support',
        '.effect-candidates-discard-hand',
        '.effect-candidates-hp-cost',
        '.effect-candidates-trash-battle',
        '.effect-candidates-trash-deck-bottom',
        '.effect-candidates-trash-deck',
        '.effect-candidates-rest-support',
        '.effect-candidates-battle-to-hand',
        '.effect-candidates-choice',
        '.effect-candidates-target',
      ],
      operations,
    )
    if (selected) return true

    const primary = panel.locator('.effect-panel-primary-action').first()
    if (await enabled(primary)) {
      const label = (await primary.innerText()).trim()
      await primary.click({ force: true })
      operations.push(`confirm:negative-effect:${label}`)
      await wait(500)
      return true
    }

    const skip = panel.locator('.skip-effect').last()
    if (await enabled(skip)) {
      await skip.click({ force: true })
      operations.push('skip:negative-effect')
      await wait(180)
      return true
    }
    return false
  }

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

    const activeCostColumn = optionalAttack.locator('.optional-cost-col').first()
    const activeCostText = await activeCostColumn.innerText().catch(() => '')
    const optionalSelectedCount = await activeCostColumn
      .locator('.modal-card-options button.is-selected')
      .count()
    const requiredSelectionMatch = activeCostText.match(
      /(?:選擇|將)\s*(\d+)\s*(?:張|個)/,
    )
    const requiredSelectionCount = /最多選擇/.test(activeCostText)
      ? Math.min(1, Number(requiredSelectionMatch?.[1] ?? 0))
      : Number(requiredSelectionMatch?.[1] ?? 0)
    const candidate = activeCostColumn
      .locator(
        '.modal-card-options button:not(.is-selected):not(:disabled)',
      )
      .first()
    if (
      optionalSelectedCount < requiredSelectionCount &&
      (await enabled(candidate))
    ) {
      await candidate.click({ force: true })
      operations.push('select:optional-cost')
      await wait(120)
      return true
    }

    // The first sticky action is Back. Select the actual primary button even
    // while disabled so a missing selection cannot accidentally navigate
    // backwards and restart the payment flow.
    const confirm = optionalAttack
      .locator('.modal-actions-sticky button')
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
      '.effect-candidates-battle-to-hand',
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

const driveOtherModal = async (
  page,
  operations,
  { negative = false, settleAttackEffects = false } = {},
) => {
  const strictNegative = negative && !settleAttackEffects
  const flip = page.locator('.flip-response-modal').first()
  if (await visible(flip)) {
    if (strictNegative) {
      const skip = flip.locator('.modal-actions button').first()
      if (!(await enabled(skip))) return false
      await skip.click({ force: true })
      operations.push('skip:negative-flip')
      await wait(520)
      return true
    }
    const chooseOneSection = flip
      .locator('.flip-choice-section')
      .filter({ hasText: /選擇一項|Choose one/i })
      .first()
    const selectedModeCount = await chooseOneSection
      .locator('button.is-selected')
      .count()
    const chooseOneOption = chooseOneSection
      .locator('button:not(.is-selected):not(:disabled)')
      .first()
    if (
      (await visible(chooseOneSection)) &&
      selectedModeCount === 0 &&
      (await enabled(chooseOneOption))
    ) {
      await chooseOneOption.click({ force: true })
      operations.push('select:flip-choice')
      await wait(120)
      return true
    }

    const flipText = await flip.innerText().catch(() => '')
    const discardRequirement = flipText.match(
      /選擇\s*(\d+)\s*張手牌棄置|Discard\s+(\d+)\s+card/i,
    )
    const requiredDiscardCount = Number(
      discardRequirement?.[1] ?? discardRequirement?.[2] ?? 0,
    )
    const selectedDiscardCount = await flip
      .locator('.flip-hand-carousel .flip-card-page button.is-selected')
      .count()
    const discardOption = flip
      .locator(
        '.flip-hand-carousel .flip-card-page button:not(.is-selected):not(:disabled)',
      )
      .first()
    if (
      selectedDiscardCount < requiredDiscardCount &&
      (await enabled(discardOption))
    ) {
      await discardOption.click({ force: true })
      operations.push('select:flip-discard')
      await wait(120)
      return true
    }

    const targetSection = flip
      .locator('.flip-choice-section')
      .filter({ hasText: /選擇目標|Choose target/i })
      .first()
    const selectedTargetCount = await targetSection
      .locator('button.is-selected')
      .count()
    const targetOption = targetSection
      .locator('button:not(.is-selected):not(:disabled)')
      .first()
    if (
      (await visible(targetSection)) &&
      selectedTargetCount === 0 &&
      (await enabled(targetOption))
    ) {
      await targetOption.click({ force: true })
      operations.push('select:flip-target')
      await wait(120)
      return true
    }
    const activate = flip.locator(
      '.flip-activate, .modal-actions button:not(:disabled), .modal-button.primary',
    ).filter({ hasText: /發動 FLIP|Activate|確認/ }).first()
    if (!(await enabled(activate))) return false
    await activate.click({ force: true })
    operations.push('confirm:flip')
    // FLIP 的棄牌／HP 更新會先完成規則狀態，再卸載回應 modal；短等待會把
    // 正常的 React transition 誤判成「待處理 UI 仍存在」。
    await wait(520)
    return true
  }

  const attackResponse = page.locator('.attack-response-modal').first()
  if (await visible(attackResponse)) {
    const trapSelection = attackResponse
      .locator('.modal-card-options button:not(.is-selected):not(:disabled)')
      .first()
    if (!(await enabled(trapSelection))) return false
    await trapSelection.click({ force: true })
    operations.push('select:attack-response')
    await wait(180)
    return true
  }

  const blockerResponse = page.locator('.blocker-response-modal').first()
  if (await visible(blockerResponse)) {
    const blocker = blockerResponse
      .locator('.modal-card-options button:not(.is-selected):not(:disabled)')
      .first()
    if (await enabled(blocker)) {
      await blocker.click({ force: true })
      operations.push('select:blocker')
      await wait(120)
      return true
    }
    const confirm = blockerResponse
      .locator('.modal-actions button:not(:disabled)')
      .filter({ hasText: /使用 Blocker|Use Blocker/i })
      .first()
    if (!(await enabled(confirm))) return false
    await confirm.click({ force: true })
    operations.push('confirm:blocker')
    await wait(520)
    return true
  }

  const attackResponseSkill = page
    .locator('.attack-response-skill-modal')
    .first()
  if (await visible(attackResponseSkill)) {
    const discard = attackResponseSkill
      .locator(
        '.attack-response-discard-candidates button:not(.is-selected):not(:disabled)',
      )
      .first()
    if (await enabled(discard)) {
      await discard.click({ force: true })
      operations.push('select:attack-response-discard')
      await wait(120)
      return true
    }
    const trashToDeck = attackResponseSkill
      .locator(
        '.attack-response-trash-to-deck-candidates button:not(.is-selected):not(:disabled)',
      )
      .first()
    if (await enabled(trashToDeck)) {
      await trashToDeck.click({ force: true })
      operations.push('select:attack-response-trash-to-deck')
      await wait(120)
      return true
    }
    const confirm = attackResponseSkill
      .locator('.modal-actions button:not(:disabled)')
      .filter({ hasText: /支付代價並發動|Activate/i })
      .first()
    if (!(await enabled(confirm))) return false
    await confirm.click({ force: true })
    operations.push('confirm:attack-response')
    await wait(520)
    return true
  }

  const trap = page.locator('.trap-response-modal').first()
  if (await visible(trap)) {
    const trapSelectPrompt = trap
      .locator('h2')
      .filter({ hasText: /是否發動陷阱|Activate a Trap/i })
      .first()
    const trapSelection = trap
      .locator('.modal-card-options button:not(.is-selected):not(:disabled)')
      .first()
    if ((await visible(trapSelectPrompt)) && (await enabled(trapSelection))) {
      await trapSelection.click({ force: true })
      operations.push('select:trap')
      await wait(180)
      return true
    }

    const guidedSections = trap.locator('.trap-guided-section')
    for (let index = 0; index < (await guidedSections.count()); index += 1) {
      const section = guidedSections.nth(index)
      const optionGroups = section.locator('.modal-card-options')
      for (let groupIndex = 0; groupIndex < (await optionGroups.count()); groupIndex += 1) {
        const group = optionGroups.nth(groupIndex)
        const progressText = await group
          .locator('xpath=following-sibling::span[1]')
          .innerText()
          .catch(() => '')
        const progress = progressText.match(
          /(\d+)\s*[\/／]\s*(?:最多\s*)?(\d+)/,
        )
        const selectedCount = await group.locator('button.is-selected').count()
        const requiredCount = progress ? Number(progress[2]) : 1
        if (selectedCount >= requiredCount) continue

        const candidate = group
          .locator('button:not(.is-selected):not(:disabled)')
          .first()
        if (!(await enabled(candidate))) continue
        await candidate.click({ force: true })
        operations.push('select:trap-step')
        await wait(180)
        return true
      }
    }

    const optionalTarget = trap
      .locator('.trap-guided-section .trap-target-options button:not(.is-selected):not(:disabled)')
      .first()
    const selectedTargetCount = await trap
      .locator('.trap-guided-section .trap-target-options button.is-selected')
      .count()
    if (selectedTargetCount === 0 && (await enabled(optionalTarget))) {
      await optionalTarget.click({ force: true })
      operations.push('select:trap-target')
      await wait(180)
      return true
    }

    const nextStep = trap
      .locator('.modal-actions-sticky button:not(:disabled), .modal-actions button:not(:disabled)')
      .filter({ hasText: /下一步|Next/i })
      .first()
    if (await enabled(nextStep)) {
      await nextStep.click({ force: true })
      operations.push('next:trap')
      await wait(180)
      return true
    }

    const activate = trap
      .locator('.modal-actions-sticky button:not(:disabled), .modal-actions button:not(:disabled)')
      .filter({ hasText: /確認發動|Activate|Confirm/i })
      .last()
    if (await enabled(activate)) {
      await activate.click({ force: true })
      operations.push('confirm:trap')
      // Trap resolution can finish the attack and surface the optional
      // replacement prompt on the next React transition.
      await wait(520)
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
    const faintCostGroups = [
      {
        candidates: '.faint-payment-candidates',
        progress: '.faint-payment-section',
        operation: 'select:faint-payment',
      },
      {
        candidates: '.faint-cost-hand-candidates',
        progress: '.faint-cost-hand-candidates',
        operation: 'select:faint-cost-hand',
      },
      {
        candidates: '.faint-cost-support-candidates',
        progress: '.faint-cost-support-candidates',
        operation: 'select:faint-cost-support',
      },
    ]
    for (const group of faintCostGroups) {
      const progressLocator =
        group.progress === group.candidates
          ? faint.locator(group.progress).locator('xpath=..')
          : faint.locator(group.progress)
      const progressText = await progressLocator.innerText().catch(() => '')
      const progress = [...progressText.matchAll(/(\d+)\s*\/\s*(\d+)/g)].at(-1)
      if (!progress || Number(progress[1]) >= Number(progress[2])) continue
      const candidate = faint
        .locator(`${group.candidates} button:not(.is-selected):not(:disabled)`)
        .first()
      if (!(await enabled(candidate))) continue
      await candidate.click({ force: true })
      operations.push(group.operation)
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

    const confirm = faint
      .locator(
        '.modal-actions button:not(:disabled), .faint-modal-actions button:not(:disabled)',
      )
      .last()
    if (!(await enabled(confirm))) return false
    await confirm.click({ force: true })
    operations.push('confirm:faint-response')
    await wait(180)
    return true
  }

  const decisionModal = page.locator('.decision-modal').first()
  if (await visible(decisionModal)) {
    const skip = decisionModal
      .locator('button:not(:disabled)')
      .filter({ hasText: /不補餅乾|略過|Skip/i })
      .first()
    if (!(await enabled(skip))) return false
    await skip.click({ force: true })
    operations.push('skip:replacement')
    await wait(180)
    const statusMessage = (
      await page
        .locator('.battle-status-message')
        .first()
        .textContent({ timeout: 100 })
        .catch(() => '')
    )
      .replace(/\s+/g, ' ')
      .trim()
    if (statusMessage && !operations.includes(`status:${statusMessage}`)) {
      operations.push(`status:${statusMessage}`)
    }
    // Skipping a replacement can immediately hand control back to the AI,
    // which may attack and create a new replacement task.  Give that state
    // transition time to publish before handling another visually identical
    // decision modal; otherwise a second click can land on the stale prompt.
    await wait(520)
    return true
  }

  const anyReplacement = page.locator('.decision-modal').first()
  if (await visible(anyReplacement)) {
    const skip = anyReplacement
      .locator('button:not(:disabled)')
      .filter({ hasText: /不補餅乾|略過|Skip/i })
      .first()
    if (!(await enabled(skip))) return false
    await skip.click({ force: true })
    operations.push('skip:replacement')
    await wait(180)
    return true
  }

  const localizedReplacement = page.locator('.decision-modal').first()
  if (await visible(localizedReplacement)) {
    const skip = localizedReplacement
      .locator('button')
      .filter({ hasText: /不補餅乾|略過|Skip/i })
      .first()
    if (!(await enabled(skip))) return false
    await skip.click({ force: true })
    operations.push('skip:replacement')
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

  // Some replacement prompts use the shared decision modal but have localized
  // copy that is not covered by the legacy selector above. The only remaining
  // decision modal in this driver is the optional Cookie replacement prompt;
  // skip it so the attack/FLIP flow can settle.
  const genericDecision = page.locator('.decision-modal').first()
  if (await visible(genericDecision)) {
    const skip = genericDecision
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

const settlePending = async (
  page,
  operations,
  { negative = false, settleAttackEffects = false } = {},
) => {
  for (let round = 0; round < 32; round += 1) {
    if (operations.length >= MAX_DRIVER_OPERATIONS_PER_CARD) {
      throw new Error(
        `effect driver operation budget exceeded (${MAX_DRIVER_OPERATIONS_PER_CARD})`,
      )
    }
    if (
      await driveOtherModal(page, operations, {
        negative,
        settleAttackEffects,
      })
    )
      continue
    if (
      await driveEffectPanel(page, operations, {
        negative,
        settleAttackEffects,
      })
    )
      continue
    // React keeps some modal shells mounted while they are hidden.  Counting
    // DOM nodes here would therefore report a false pending surface after a
    // successful confirmation (notably after a choose-one Then effect).
    const pendingSelectors = [
      '.effect-panel[role="alertdialog"]',
      '.flip-response-modal',
      '.attack-response-modal',
      '.blocker-response-modal',
      '.attack-response-skill-modal',
      '.trap-response-modal',
      '.draw-up-to-modal',
      '.hand-discard-modal[role="alertdialog"]',
      '.inspect-deck-modal',
      '.card-reveal-modal[role="alertdialog"]',
      '.faint-response-modal',
      '.effect-order-modal',
      '.decision-modal',
    ]
    const pendingCount = (
      await Promise.all(
        pendingSelectors.map(async (selector) =>
          (await visible(page.locator(selector))) ? 1 : 0,
        ),
      )
    ).reduce((total, present) => total + present, 0)
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
  await hand.scrollIntoViewIfNeeded().catch(() => {})
  await hand.locator('.hand-card').click({ force: true })
  await wait(120)
  const action = hand.locator('.hand-card-action').first()
  if (!(await enabled(action))) return false
  await action.scrollIntoViewIfNeeded().catch(() => {})
  await action.click({ force: true })
  await wait(180)
  return true
}

const runVanillaAttack = async (page, operations) => {
  const ownCookies = page.locator('.bottom-field .combat-card-wrap')
  const beforeDeploy = await ownCookies.count()
  assert.ok(beforeDeploy < 2, 'vanilla fixture must have a free battle slot')
  assert.ok(
    await clickFirstHandAction(page),
    'vanilla Cookie must expose an enabled deploy action from the hand',
  )
  operations.push('action:deploy-vanilla')
  assert.equal(
    await ownCookies.count(),
    beforeDeploy + 1,
    'deploying the vanilla Cookie must add it to the battle area',
  )

  const attacker = ownCookies.last().locator('.card-face').first()
  assert.ok(await enabled(attacker), 'deployed vanilla Cookie must be clickable')
  await attacker.click({ force: true })
  operations.push('select:vanilla-attacker')
  await wait(120)

  // The test-state fixture provides matching active support cards. Select only
  // cards currently marked as legal payment targets; already-selected cards
  // stay targetable so excluding `.is-selected` avoids toggling them back off.
  for (let index = 0; index < 8; index += 1) {
    const payment = page
      .locator(
        '.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)',
      )
      // Support cards overlap into a fan; the final candidate is visually on
      // top, whereas forcing a click on the first one can hit its neighbour.
      .last()
    if (!(await visible(payment))) break
    const selectedBefore = await page
      .locator('.bottom-field .support-card-wrap .card-face.is-selected')
      .count()
    await payment.scrollIntoViewIfNeeded().catch(() => {})
    // Keyboard activation targets the focused card itself, rather than the
    // neighbouring card that visually overlaps it in the support fan.
    await payment.focus()
    await payment.press('Enter')
    operations.push('select:vanilla-attack-payment')
    await wait(80)
    assert.equal(
      await page
        .locator('.bottom-field .support-card-wrap .card-face.is-selected')
        .count(),
      selectedBefore + 1,
      'a legal support-card activation must select exactly one attack payment',
    )
  }

  const target = page.locator('.top-field .combat-card-wrap .card-face').first()
  assert.ok(await enabled(target), 'vanilla attack must expose an opponent target')
  await target.click({ force: true })
  operations.push('declare:vanilla-attack')
  await wait(360)
  assert.ok(
    (await ownCookies.last().locator('.card-face.is-rested').count()) > 0,
    'declaring the vanilla attack must rest the deployed attacker',
  )
}

const runVanillaNegative = async (page, operations) => {
  const ownCookies = page.locator('.bottom-field .combat-card-wrap')
  const beforeDeploy = await ownCookies.count()
  assert.ok(beforeDeploy < 2, 'negative vanilla fixture must have a free battle slot')
  assert.ok(
    await clickFirstHandAction(page),
    'negative vanilla Cookie must expose a deploy action from the hand',
  )
  operations.push('action:deploy-negative')

  const attacker = ownCookies.last().locator('.card-face').first()
  assert.ok(await enabled(attacker), 'negative vanilla Cookie must be clickable')
  await attacker.click({ force: true })
  operations.push('select:negative-attacker')
  await wait(180)

  const legalPayment = page.locator(
    '.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)',
  )
  assert.equal(
    await legalPayment.count(),
    0,
    'all rested support cards must be unavailable for a negative attack payment',
  )
  await wait(260)
  assert.equal(
    await ownCookies.last().locator('.card-face.is-rested').count(),
    0,
    'an attack with no legal payment must not rest the attacker',
  )
}

const clickNextPhase = async (page) => {
  const action = page.locator('.next-phase-button').first()
  if (!(await enabled(action))) return false
  await action.click({ force: true })
  await wait(260)
  return true
}

const bodyText = async (page) => (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim()

const pendingSurfaceCount = async (page) => {
  const selectors = [
    '.effect-panel[role="alertdialog"]',
    '.flip-response-modal',
    '.attack-response-modal',
    '.blocker-response-modal',
    '.attack-response-skill-modal',
    '.trap-response-modal',
    '.draw-up-to-modal',
    '.hand-discard-modal',
    '.inspect-deck-modal',
    '.card-reveal-modal',
    '.faint-response-modal',
    '.effect-order-modal',
    '.decision-modal',
  ]
  return (
    await Promise.all(
      selectors.map(async (selector) =>
        (await visible(page.locator(selector))) ? 1 : 0,
      ),
    )
  ).reduce((total, present) => total + present, 0)
}

const visiblePendingSurfaceNames = async (page) => {
  const selectors = [
    '.effect-panel[role="alertdialog"]',
    '.flip-response-modal',
    '.attack-response-modal',
    '.blocker-response-modal',
    '.attack-response-skill-modal',
    '.trap-response-modal',
    '.draw-up-to-modal',
    '.hand-discard-modal',
    '.inspect-deck-modal',
    '.card-reveal-modal',
    '.faint-response-modal',
    '.effect-order-modal',
    '.decision-modal',
  ]
  return (
    await Promise.all(
      selectors.map(async (selector) =>
        (await visible(page.locator(selector))) ? selector : null,
      ),
    )
  ).filter(Boolean)
}

const effectPanelDebug = async (page) => {
  const panel = activePanel(page)
  return {
    panelText: (await panel.innerText().catch(() => '')).replace(/\s+/g, ' ').trim(),
    selectedHpCost: await panel.locator('.effect-candidates-hp-cost button.is-selected').count(),
    selectedTargets: await panel.locator('.effect-candidates-target button.is-selected').count(),
    targetCandidates: await panel.locator('.effect-candidates-target button').count(),
    statusMessage: (
      await page.locator('.battle-status-message').first().textContent().catch(() => '')
    ).replace(/\s+/g, ' ').trim(),
  }
}

const pendingModalDebug = async (page) => {
  const modal = page.locator('.decision-modal').first()
  if (!(await visible(modal))) return undefined
  return {
    text: (await modal.innerText().catch(() => '')).replace(/\s+/g, ' ').trim(),
    statusMessage: (
      await page
        .locator('.battle-status-message')
        .first()
        .textContent({ timeout: 100 })
        .catch(() => '')
    )
      .replace(/\s+/g, ' ')
      .trim(),
    buttons: await modal.locator('button').evaluateAll((buttons) =>
      buttons.map((button) => ({
        text: button.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        disabled: button.disabled,
      })),
    ),
  }
}

const vanillaAttackDebug = async (page) => ({
  ownCookies: await page
    .locator('.bottom-field .combat-card-wrap .card-face')
    .evaluateAll((nodes) => nodes.map((node) => node.className)),
  supports: await page
    .locator('.bottom-field .support-card-wrap .card-face')
    .evaluateAll((nodes) => nodes.map((node) => node.className)),
  opponentCookies: await page
    .locator('.top-field .combat-card-wrap .card-face')
    .evaluateAll((nodes) => nodes.map((node) => node.className)),
})

const runCard = async (
  page,
  card,
  testState = `card:${card.cardNumber}`,
  {
    path = 'generic',
    requireInteractiveOperation = true,
    requireVanillaAttack = false,
    negative = false,
    settleAttackEffects = false,
    driveActions = true,
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
    await page.goto(
      `${baseUrl}?test-state=${encodeURIComponent(testState)}&audit-run=${Date.now()}`,
      {
      waitUntil: 'domcontentloaded',
      },
    )
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    await page.waitForTimeout(400)
    const before = await bodyText(page)
    assert.ok(!/遊戲畫面發生錯誤|Application Error|Unhandled Runtime Error/i.test(before))

    if (requireVanillaAttack) {
      if (negative) {
        await runVanillaNegative(page, operations)
      } else {
        await runVanillaAttack(page, operations)
      }
      await settlePending(page, operations, { negative, settleAttackEffects })
    } else if (driveActions) {
      for (let round = 0; round < 8; round += 1) {
        const settledBefore = operations.length
        await settlePending(page, operations, {
          negative,
          settleAttackEffects,
        })
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
    } else {
      await settlePending(page, operations, {
        negative,
        settleAttackEffects,
      })
    }

    // Some rule transitions publish a replacement/decision modal on the next
    // React tick after the effect panel itself has already disappeared.
    // Perform one final delayed settlement pass before declaring the route
    // complete so a late but valid prompt is neither missed nor misreported.
    await wait(260)
    await settlePending(page, operations, { negative, settleAttackEffects })

    const after = await bodyText(page)
    assert.ok(!/遊戲畫面發生錯誤|Application Error|Unhandled Runtime Error/i.test(after))
    assert.deepEqual(consoleErrors, [], `console errors: ${JSON.stringify(consoleErrors)}`)
    assert.deepEqual(pageErrors, [], `page errors: ${JSON.stringify(pageErrors)}`)

    const hasInteractiveOperation = operations.some((operation) =>
      /^(action:|start:|select:|declare:|confirm:|skip:)/.test(
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
        effectSurfaces: auditedSurfaces(card),
        path,
        testState,
        status: 'PASS',
        auditStatus: requireVanillaAttack
          ? negative
            ? 'Negative no-payment attack path settled'
            : 'Vanilla deploy and attack flow settled'
          : negative
            ? 'Negative no-payment effect path settled'
          : requireInteractiveOperation
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
      effectSurfaces: auditedSurfaces(card),
      path,
      testState,
      status: 'BLOCKED',
      auditStatus: hasInteractiveOperation
        ? 'Pending UI remained'
        : 'No interactive effect path',
      operations,
      pendingSurface,
      debug: {
        ...(await effectPanelDebug(page)),
        visiblePendingSurfaces: await visiblePendingSurfaceNames(page),
        decisionModal: await pendingModalDebug(page),
        ...(requireVanillaAttack ? { vanilla: await vanillaAttackDebug(page) } : {}),
      },
    }
  } catch (error) {
    return {
      cardNumber: card.cardNumber,
      baseCardNumber: card.baseCardNumber,
      variant: card.variant,
      name: card.name,
      type: card.type,
      color: card.color,
      effectSurfaces: auditedSurfaces(card),
      path,
      testState,
      status: 'FAIL',
      auditStatus: 'Browser or runtime error',
      operations,
      error: error instanceof Error ? error.message : String(error),
      debug: {
        ...(await effectPanelDebug(page)),
        decisionModal: await pendingModalDebug(page),
        ...(requireVanillaAttack ? { vanilla: await vanillaAttackDebug(page) } : {}),
      },
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
  page.setDefaultTimeout(auditActionTimeout)
  page.setDefaultNavigationTimeout(auditNavigationTimeout)

  console.log(
    `=== ${auditConfig.label} ${auditNegative ? 'negative A/B' : auditVanillaAttacks ? 'vanilla attack' : 'interactive effect'} audit (${cards.length} records, ${browserExecutable ?? 'Playwright Chromium'}) ===`,
  )
  for (const card of cards) {
    const testState = auditNegative
      ? `card-negative:${card.cardNumber}`
      : `card:${card.cardNumber}`
    const runOptions = auditNegative
      ? {
          path: 'negative-no-payment',
          requireInteractiveOperation: false,
          requireVanillaAttack: isVanillaAttackCookie(card),
          negative: true,
          settleAttackEffects: effectSurfaces(card).includes('attack-then'),
        }
      : auditVanillaAttacks
        ? { path: 'vanilla-attack', requireVanillaAttack: true }
        : undefined
    const genericResult = await runCard(
      page,
      card,
      testState,
      runOptions,
    )
    let result = genericResult
    const conditionAuditCardNumber = conditionCardNumbers.has(card.cardNumber)
      ? card.cardNumber
      : conditionCardNumbers.has(card.baseCardNumber)
        ? card.baseCardNumber
        : null
    if (!auditVanillaAttacks && !auditNegative && conditionAuditCardNumber) {
      const met = await runCard(
        page,
        card,
        conditionTestState(conditionAuditCardNumber, 'met'),
        {
          path: 'condition-met',
          requireInteractiveOperation:
            auditConfig.conditionMetRequiresInteraction ?? true,
          driveActions:
            auditConfig.conditionMetRequiresInteraction ?? true,
        },
      )
      const unmet = await runCard(
        page,
        card,
        conditionTestState(conditionAuditCardNumber, 'unmet'),
        {
          path: 'condition-unmet',
          requireInteractiveOperation: false,
          driveActions: false,
        },
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
    if (auditFailFast && result.status !== 'PASS') break
  }

  await page.close()
  await browser.close()
  browser = undefined
  server.kill()

  const report = {
    generatedAt: new Date().toISOString(),
    browser: browserExecutable ?? 'playwright-chromium',
    viewport: '1440x960',
    sources: auditConfig.sources,
    scope: auditNegative
      ? `Formal-pool negative A/B UI audit for every ${auditConfig.label} record. The localhost-only fixture keeps the formal card and timing but rests every support card; PASS means the real UI did not accept an illegal support payment, did not rest a vanilla attacker without payment, and settled without browser/runtime errors or remaining pending UI. Attack-Then records start at their real post-attack pending window, so their Then effect is resolved through the UI rather than re-testing the payment that already occurred before that window.`
      : auditVanillaAttacks
      ? `Formal-pool test-state UI audit for every ${auditConfig.label} vanilla Cookie record. PASS means the real UI deployed the Cookie from hand, selected it as attacker, paid only legal support cards, declared against an opponent Cookie, rested the attacker, and settled without browser/runtime errors or remaining pending UI.`
      : `Formal-pool test-state interaction audit for ${auditConfig.label} effect-bearing records plus dedicated A/B paths for ${conditionCardNumbers.size} condition or timing cards. PASS means the real UI opened, the required path settled without browser/runtime errors, and no pending modal remained. Unmet paths may legitimately be a no-op; passive and end-phase cards are accepted when their timing path settles.`,
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
  process.exitCode =
    report.summary.failed === 0 && report.summary.blocked === 0 ? 0 : 1
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  server.kill()
}
