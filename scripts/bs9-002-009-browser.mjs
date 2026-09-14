import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import bs9Candidates from '../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json' with { type: 'json' }

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

const baseCases = [
  {
    card: 'BS9-002',
    title: 'Princess Cookie',
    mode: 'activate',
    positiveRoute: 'bs9-card:BS9-002',
    negativeRoute: 'bs9-card-negative:BS9-002@1',
  },
  {
    card: 'BS9-003',
    title: 'Strawberry Cookie',
    mode: 'on-play',
    positiveRoute: 'bs9-card:BS9-003',
    negativeRoute: 'bs9-card-negative:BS9-003@1',
  },
  {
    card: 'BS9-004',
    title: 'Linzer Cookie',
    mode: 'attack',
    positiveRoute: 'bs9-card:BS9-004',
    negativeRoute: 'bs9-card-negative:BS9-004@1',
  },
  {
    card: 'BS9-005',
    title: 'Macaron Cookie',
    mode: 'flip',
    positiveRoute: 'bs9-card:BS9-005',
    negativeRoute: 'bs9-card-negative:BS9-005@1',
  },
  {
    card: 'BS9-006',
    title: 'Melted Choco Cookie',
    mode: 'on-play',
    positiveRoute: 'bs9-card:BS9-006',
    negativeRoute: 'bs9-card-negative:BS9-006@1',
  },
  {
    card: 'BS9-007',
    title: 'Cherry Blossom Cookie',
    mode: 'flip',
    positiveRoute: 'bs9-card:BS9-007',
    negativeRoute: 'bs9-card-negative:BS9-007@1',
  },
  {
    card: 'BS9-008',
    title: 'Blueberry Cookie',
    mode: 'attack',
    positiveRoute: 'bs9-card:BS9-008',
    negativeRoute: 'bs9-card-negative:BS9-008',
  },
  {
    card: 'BS9-009',
    title: 'Birthday Cake Cookie',
    mode: 'on-play',
    positiveRoute: 'bs9-card:BS9-009',
    negativeRoute: 'bs9-card-negative:BS9-009',
  },
]

const cases = baseCases.flatMap((testCase) => {
  const records = bs9Candidates.cards.filter((record) => record.baseCardNumber === testCase.card)
  if (records.length === 0) throw new Error(`Missing BS9 candidates for ${testCase.card}`)
  return records.map((record) => ({
    ...testCase,
    card: record.cardNumber,
    baseCard: testCase.card,
    // Pure-damage Cookies need the ordinary attack flow for Browser A.  The
    // negative route uses the shared card-attack fixture so the source is
    // visibly rested before declaration, rather than deploying the card and
    // merely observing a no-op.
    positiveRoute: `bs9-card:${record.cardNumber}`,
    negativeRoute: testCase.mode === 'attack'
      ? `card-attack-negative:${record.cardNumber}`
      : `bs9-card-negative:${record.cardNumber}`,
  }))
})
const selectedCaseKey = process.env.BS9_002_009_CASE?.trim() || null

const recordBrowserErrors = (page) => {
  const errors = []
  const imageFailures = []
  const imageResponses = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const location = message.location()
    const text = message.text()
    if (location.url?.endsWith('/favicon.ico') && text.includes('404')) return
    errors.push(`console: ${text} (${location.url || 'unknown URL'})`)
  })
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'unknown request failure'
    const entry = `${request.url()} (${failure})`
    if (request.resourceType() === 'image') imageFailures.push(entry)
    if (!request.url().endsWith('/favicon.ico')) errors.push(`requestfailed: ${entry}`)
  })
  page.on('response', (response) => {
    if (response.request().resourceType() !== 'image') return
    imageResponses.push({ url: response.url(), status: response.status(), ok: response.ok() })
  })
  return { errors, imageFailures, imageResponses }
}

const readTrace = async (page) =>
  page.evaluate(() => window.__braverseContractTrace ?? [])

const readSnapshot = async (page) =>
  page.evaluate(() => ({
    body: document.body.innerText,
    handTitles: [...document.querySelectorAll('.bottom-hand .hand-card')]
      .map((node) => node.getAttribute('title'))
      .filter(Boolean),
    battleCards: [...document.querySelectorAll('.bottom-field .combat-card-wrap')]
      .map((node) => ({
        id: node.getAttribute('data-card-instance-id'),
        title: node.querySelector('.card-face')?.getAttribute('title'),
        text: node.innerText,
      })),
    trace: window.__braverseContractTrace ?? [],
  }))

// Keep Browser state evidence public: counts, named face-up cards and visible
// battle badges are safe to preserve, while hand/deck contents and HP-card
// identities remain intentionally omitted from this snapshot.
const readPublicState = async (page) => page.evaluate(() => {
  const cardName = (node) => node?.querySelector('img')?.getAttribute('alt') ??
    node?.querySelector('.card-fallback strong')?.textContent?.trim() ?? null
  const readRow = (position) => {
    const root = document.querySelector(`.battle-row.${position}-field`)
    if (!root) return null
    return {
      deck: root.querySelector('.deck-zone .resource-summary strong')?.textContent?.trim() ?? null,
      discard: root.querySelector('.discard-zone.resource-summary strong')?.textContent?.trim() ?? null,
      break: root.querySelector('.break-zone .zone-heading b')?.textContent?.trim() ?? null,
      hand: root.querySelector('.row-stat-hand .row-stat-value')?.textContent?.trim() ?? null,
      stage: cardName(root.querySelector('.stage-zone .stage-card')),
      stageRested: root.querySelector('.stage-zone .stage-card')?.classList.contains('is-rested') ?? null,
      support: [...root.querySelectorAll('.support-card-wrap .support-card')].map((node) => ({
        name: cardName(node),
        rested: node.classList.contains('is-rested'),
      })),
      battle: [...root.querySelectorAll('.combat-slots .combat-card-wrap')].map((node) => ({
        name: cardName(node.querySelector('.card-face')),
        hp: node.querySelector('.badge-hp')?.textContent?.trim() ?? null,
        atk: node.querySelector('.badge-atk')?.textContent?.trim() ?? null,
        rested: node.classList.contains('is-rested'),
      })),
    }
  }
  return {
    phase: document.querySelector('.turn-indicator')?.textContent?.trim() ?? null,
    rows: { top: readRow('top'), bottom: readRow('bottom') },
    bottomHandCount: document.querySelectorAll('.bottom-hand .hand-card-wrap').length,
  }
})

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
]

const readVisibleFinalSurfaces = async (page) => page.evaluate((selectors) =>
  selectors.filter(([, selector]) => [...document.querySelectorAll(selector)].some((node) => {
    const style = window.getComputedStyle(node)
    return style.display !== 'none' && style.visibility !== 'hidden' && node.getBoundingClientRect().width > 0
  })).map(([name]) => name), finalSurfaceSelectors)

const substantiveCommandKinds = new Set([
  'resolve-ability-effect',
  'resolve-battle',
  'resolve-draw-up-to',
  'resolve-flip',
])
const noOpTracePattern = /未發動|不發動|略過|未執行|條件不成立|未生效/
const substantiveTraceStepPattern = /結果|抽牌|棄置|送入|放置|移動|回到|恢復|傷害|HP|攻擊力|橫置|活躍|發動|結算|選擇/
const hasExecutedTraceEvidence = (entries) => entries.some((entry) => {
  if (!substantiveCommandKinds.has(entry?.commandKind)) return false
  const steps = Array.isArray(entry?.steps) ? entry.steps.map(String) : []
  if (steps.length > 0 && steps.every((step) => noOpTracePattern.test(step))) return false
  if (steps.length === 0) return entry.commandKind === 'resolve-ability-effect' || entry.commandKind === 'resolve-battle'
  return steps.some((step) => !noOpTracePattern.test(step) && substantiveTraceStepPattern.test(step))
})

const waitForTrace = async (page, commandKind, timeout = 10_000) => {
  await page.waitForFunction((expected) =>
    (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === expected), commandKind, { timeout })
  return readTrace(page)
}

const behaviorCard = (testCase) => testCase.baseCard ?? testCase.card

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

const assertSourceImage = async (page, record, exactImageRequested) => {
  await page.waitForTimeout(100)
  const title = record.name.replaceAll('"', '\\"')
  const source = page.locator(
    `.bottom-field .card-face[title="${title}"], .bottom-hand .hand-card[title="${title}"], .flip-response-modal:visible .flip-reveal-card`,
  ).first()
  return assertPhysicalCardImage(source, record, exactImageRequested)
}

const waitForGame = async (page) => {
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await page.waitForTimeout(260)
}

const visibleEffectPanel = (page) => page.locator('.effect-panel:visible').first()

const sourceBattleCard = (page, title) =>
  page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator(`.card-face[title="${title}"]`),
  }).first()

const sourceHandCard = (page, title) =>
  page.locator('.bottom-hand .hand-card-wrap').filter({
    has: page.locator(`.hand-card[title="${title}"]`),
  }).first()

const assertTraceKind = (trace, kind, message) => {
  assert.ok(trace.some((entry) => entry.commandKind === kind), message)
}

const assertNoTraceKind = (trace, kind, message) => {
  assert.equal(trace.some((entry) => entry.commandKind === kind), false, message)
}

const runActivate = async (page, testCase, negative, result) => {
  const source = sourceBattleCard(page, testCase.title)
  await source.waitFor({ state: 'visible' })
  const skill = source.locator('.skill-action')
  assert.equal(await skill.count(), 1, 'BS9-002 應有啟動技能入口')
  if (negative) {
    assert.equal(await skill.isEnabled(), false, '上一回合條件不成立時技能入口應停用')
    const body = await page.locator('body').innerText()
    assert.match(body, /對手上一回合.*尚未達到/, '負向路徑應顯示上一回合昏厥條件原因')
    assertNoTraceKind(await readTrace(page), 'begin-activate-skill', '負向路徑不應送出技能啟動命令')
    result.actions.push('blocked-activate')
    result.negativeEvidence = 'activate-prior-turn-condition-not-met'
    return
  }

  assert.equal(await skill.isEnabled(), true, '上一回合條件成立時技能入口應可用')
  await skill.click()
  result.actions.push('begin-activate')
  const panel = visibleEffectPanel(page)
  await panel.waitFor({ state: 'visible' })
  assert.match(await panel.innerText(), /Princess Cookie|LV\.1 Cookie fainted|上一回合/)
  const targets = panel.locator('.effect-candidates-target button')
  assert.equal(await targets.count(), 1, 'BS9-002 應只提供來源餅乾作為目標')
  if (await targets.first().isEnabled()) {
    await targets.first().click()
    result.actions.push('select-source-target')
  } else {
    assert.equal(await targets.first().getAttribute('data-fixed-target'), 'true', '固定目標應明確標示')
    assert.equal(await targets.first().evaluate((button) => button.classList.contains('is-selected')), true, '固定目標應已套用')
    result.actions.push('fixed-source-target')
  }
  const confirm = panel.locator('.effect-panel-primary-action')
  assert.equal(await confirm.isEnabled(), true)
  await confirm.click()
  result.actions.push('resolve-activate')
  await panel.waitFor({ state: 'hidden' })
  await page.waitForTimeout(220)
  const snapshot = await readSnapshot(page)
  assertTraceKind(snapshot.trace, 'begin-activate-skill', '正向路徑應留下 begin-activate-skill')
  assertTraceKind(snapshot.trace, 'resolve-ability-effect', '正向路徑應留下 resolve-ability-effect')
  assert.match(snapshot.body, /Princess Cookie 攻擊傷害 \+1/, '正向路徑應顯示 +1 攻擊傷害結果')
}

const runOnPlay = async (page, testCase, negative, result) => {
  const hand = sourceHandCard(page, testCase.title)
  await hand.waitFor({ state: 'visible' })
  await hand.locator('.hand-card').click()
  result.actions.push('select-hand-cookie')
  const deploy = hand.locator('.hand-card-action').filter({ hasText: '登場' })
  assert.equal(await deploy.count(), 1, `${testCase.card} 應提供登場入口`)
  await deploy.click()
  result.actions.push('deploy-cookie')
  await page.waitForTimeout(320)

  const panel = visibleEffectPanel(page)
  if (negative && (behaviorCard(testCase) === 'BS9-006' || behaviorCard(testCase) === 'BS9-009')) {
    assert.equal(await panel.count(), 0, `${testCase.card} 負向條件不成立時不應開啟效果面板`)
    const snapshot = await readSnapshot(page)
    assert.match(snapshot.body, /效果尚未滿足發動條件/)
    assertTraceKind(snapshot.trace, 'skip-on-play', '條件不成立時應留下跳過登場效果紀錄')
    assertNoTraceKind(snapshot.trace, 'resolve-ability-effect', '條件不成立時不應結算效果')
    result.actions.push('blocked-on-play')
    result.negativeEvidence = 'onplay-condition-not-met'
    return
  }

  await panel.waitFor({ state: 'visible' })
  if (negative) {
    assert.equal(behaviorCard(testCase), 'BS9-003')
    await panel.locator('.skip-effect').click()
    result.actions.push('skip-on-play')
    await panel.waitFor({ state: 'hidden' })
    const snapshot = await readSnapshot(page)
    assert.match(snapshot.body, /OnPlay 技能未發動/)
    assertTraceKind(snapshot.trace, 'skip-on-play', '負向路徑應留下跳過登場效果紀錄')
    assertNoTraceKind(snapshot.trace, 'resolve-ability-effect', '跳過登場效果不應結算效果')
    result.negativeEvidence = 'explicit-onplay-skip'
    return
  }

  if (behaviorCard(testCase) === 'BS9-003') {
    assert.match(await panel.innerText(), /Select up to 1.*\+1 attack damage/)
    const targets = panel.locator('.effect-candidates-target button')
    assert.equal(await targets.count(), 2, 'BS9-003 應提供兩張我方餅乾目標')
    await targets.first().click()
    result.actions.push('select-own-target')
    await panel.locator('.effect-panel-primary-action').click()
    result.actions.push('resolve-on-play')
    await panel.waitFor({ state: 'hidden' })
    const snapshot = await readSnapshot(page)
    assertTraceKind(snapshot.trace, 'resolve-ability-effect', 'BS9-003 應留下效果結算')
    assert.match(snapshot.body, /Pomegranate Cookie 攻擊傷害 \+1/)
    return
  }

  if (behaviorCard(testCase) === 'BS9-006') {
    assert.match(await panel.innerText(), /受到的傷害.*-3/)
    const targets = panel.locator('.effect-candidates-target button')
    assert.equal(await targets.count(), 1, 'BS9-006 應只提供來源餅乾目標')
    assert.match(await targets.first().innerText(), /Melted Choco Cookie/)
    if (await targets.first().isEnabled()) {
      await targets.first().click()
      result.actions.push('select-source-target')
    } else {
      assert.equal(await targets.first().getAttribute('data-fixed-target'), 'true', '固定目標應明確標示')
      assert.equal(await targets.first().evaluate((button) => button.classList.contains('is-selected')), true, '固定目標應已套用')
      result.actions.push('fixed-source-target')
    }
    await panel.locator('.effect-panel-primary-action').click()
    result.actions.push('resolve-on-play')
    await panel.waitFor({ state: 'hidden' })
    const snapshot = await readSnapshot(page)
    assertTraceKind(snapshot.trace, 'resolve-ability-effect', 'BS9-006 應留下效果結算')
    assert.match(snapshot.body, /Melted Choco Cookie.*-3/)
    result.effectResolved = true
    result.evidence = 'executed-onplay-damage-reduction'
    return
  }

  assert.equal(behaviorCard(testCase), 'BS9-009')
  assert.match(await panel.innerText(), /最多抽 1 張牌/)
  await panel.locator('.effect-panel-primary-action').click()
  result.actions.push('open-draw-up-to')
  const draw = page.locator('.draw-up-to-modal:visible').first()
  await draw.waitFor({ state: 'visible' })
  assert.match(await draw.innerText(), /最多.*1 張牌/)
  const drawOptions = draw.locator('.draw-up-to-option')
  assert.equal(await drawOptions.count(), 2)
  await drawOptions.nth(1).click()
  result.actions.push('select-draw-one')
  await draw.locator('.draw-up-to-actions button').click()
  result.actions.push('resolve-draw-up-to')
  await draw.waitFor({ state: 'hidden' })
  const snapshot = await readSnapshot(page)
  assertTraceKind(snapshot.trace, 'resolve-draw-up-to', 'BS9-009 應留下抽牌結算')
  assert.match(snapshot.body, /已從牌庫抽取 1 張牌/)
}

const parseAttackCostCount = (attackText) => {
  const cost = attackText?.match(/^\s*<([^>]+)>/)?.[1] ?? ''
  return (cost.match(/\{[A-Z]\}/g) ?? []).length
}

/**
 * A no-Skill/no-FLIP Cookie still has a real printed attack.  Browser A must
 * therefore deploy the candidate, pay its printed support cost, choose a
 * public opponent target, and observe the ordinary battle settlement.  The
 * negative route is the shared card-attack fixture with the source already
 * rested; it must never emit a fabricated attack declaration.
 */
const runAttack = async (page, testCase, negative, result) => {
  let source = sourceBattleCard(page, testCase.title)
  const sourceVisible = await source.count() && await source.isVisible().catch(() => false)

  if (negative) {
    if (!sourceVisible) throw new Error(`${testCase.card} negative attack source is not visible`)
    const sourceFace = source.locator('.card-face').first()
    const sourceClass = await sourceFace.getAttribute('class')
    assert.ok(sourceClass?.split(/\s+/).includes('is-rested'), `${testCase.card} blocked attack must visibly rest the source Cookie`)
    assert.equal(await source.locator('.card-face.is-attackable').count(), 0, `${testCase.card} blocked attack must not expose an attackable source`)
    assertNoTraceKind(await readTrace(page), 'declare-attack', `${testCase.card} blocked attack must not emit declare-attack`)
    result.actions.push('blocked-attack-source-rested')
    result.negativeEvidence = 'attack-source-rested-and-unattackable'
    return
  }

  if (!sourceVisible) {
    const hand = sourceHandCard(page, testCase.title)
    await hand.waitFor({ state: 'visible' })
    await hand.locator('.hand-card').click()
    const deploy = hand.locator('.hand-card-action').filter({ hasText: '登場' }).first()
    assert.equal(await deploy.count(), 1, `${testCase.card} pure attack fixture must expose deploy`)
    assert.equal(await deploy.isEnabled(), true, `${testCase.card} pure attack deployment must be enabled`)
    await deploy.click()
    await page.waitForTimeout(320)
    result.actions.push('deploy-pure-attack-cookie')
  }

  source = sourceBattleCard(page, testCase.title)
  await source.waitFor({ state: 'visible' })
  const attacker = source.locator('.card-face.is-attackable').first()
  assert.equal(await attacker.count(), 1, `${testCase.card} pure attack source must be attackable after deployment`)
  assert.equal(await attacker.isEnabled(), true, `${testCase.card} pure attack source must be enabled`)
  await attacker.click()
  result.actions.push('select-pure-attack-source')
  await page.waitForTimeout(100)

  const paymentCount = parseAttackCostCount(candidateRecord(testCase.card).attackText)
  assert.ok(paymentCount > 0, `${testCase.card} pure attack must expose a printed energy cost`)
  for (let index = 0; index < paymentCount; index += 1) {
    const payment = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').last()
    await payment.waitFor({ state: 'visible' })
    const selectedBefore = await page.locator('.bottom-field .support-card-wrap .card-face.is-selected').count()
    await payment.focus()
    await payment.press('Enter')
    await page.waitForTimeout(90)
    assert.equal(
      await page.locator('.bottom-field .support-card-wrap .card-face.is-selected').count(),
      selectedBefore + 1,
      `${testCase.card} attack payment must select one legal support card at a time`,
    )
  }
  const paymentPanel = page.locator('[data-testid="attack-payment-panel"]').first()
  await paymentPanel.waitFor({ state: 'visible' })
  assert.match(await paymentPanel.innerText(), /付款合法/, `${testCase.card} attack payment must be legal before target selection`)
  result.actions.push('pay-pure-attack')

  const beforeResolutionState = await readPublicState(page)
  const target = page.locator('.top-field .combat-card-wrap .card-face[aria-label^="選擇攻擊目標："]').first()
  await target.waitFor({ state: 'visible' })
  const targetName = (await target.getAttribute('aria-label'))?.replace(/^選擇攻擊目標：/, '').trim()
  const targetBefore = beforeResolutionState?.rows?.top?.battle?.find((card) => card.name === targetName)
  assert.ok(targetBefore, `${testCase.card} attack target must be present before declaration`)
  await target.click()
  result.actions.push('declare-pure-attack')
  await waitForTrace(page, 'declare-attack')
  await waitForTrace(page, 'resolve-battle')
  await page.waitForTimeout(320)

  const afterResolutionState = await readPublicState(page)
  const targetAfter = afterResolutionState?.rows?.top?.battle?.find((card) => card.name === targetName)
  assert.ok(!targetAfter || targetAfter.hp !== targetBefore.hp, `${testCase.card} attack settlement must change or remove the selected target HP`)
  result.pureDamageSettlementEvidence = {
    commandKind: 'resolve-battle',
    target: targetName,
    targetBeforeHp: targetBefore.hp,
    targetAfterHp: targetAfter?.hp ?? 'removed',
  }
  result.effectResolved = true
  result.actions.push('resolve-pure-damage-attack')
  result.evidence = 'executed-pure-damage-attack-resolution'
}

const runVanilla = async (page, testCase, negative, result) => {
  const hand = sourceHandCard(page, testCase.title)
  await hand.waitFor({ state: 'visible' })
  await hand.locator('.hand-card').click()
  const deploy = hand.locator('.hand-card-action').filter({ hasText: '登場' })
  assert.equal(await deploy.count(), 1, `${testCase.card} 應提供登場入口`)
  await deploy.click()
  result.actions.push('deploy-cookie')
  await page.waitForTimeout(320)
  assert.equal(await visibleEffectPanel(page).count(), 0, '無技能餅乾不應開啟效果面板')
  const snapshot = await readSnapshot(page)
  assert.ok(
    snapshot.battleCards.some((entry) => entry.title === testCase.title),
    `${testCase.card} 登場後應在我方戰鬥區保留實卡名稱`,
  )
  assertTraceKind(snapshot.trace, 'deploy-cookie', 'vanilla 路徑應留下 deploy-cookie')
  if (negative) result.negativeEvidence = 'vanilla-deployment-no-op'
}

const runFlip = async (page, testCase, negative, result) => {
  const modal = page.locator('.flip-response-modal:visible').first()
  await modal.waitFor({ state: 'visible' })
  assert.equal(await modal.locator('h2').innerText(), `${testCase.title} FLIP`)
  if (behaviorCard(testCase) === 'BS9-005') {
    assert.match(await modal.innerText(), /Discard 1 card.*gains \+1 HP/)
  } else {
    assert.match(await modal.innerText(), /Draw up to 1 card from your deck/)
  }

  if (negative) {
    await modal.getByRole('button', { name: '不發動', exact: true }).click()
    result.actions.push('skip-flip')
    await modal.waitFor({ state: 'hidden' })
    await page.waitForTimeout(240)
    const snapshot = await readSnapshot(page)
    assert.match(snapshot.body, /未發動 FLIP/)
    const flipEntry = snapshot.trace.find((entry) => entry.commandKind === 'resolve-flip')
    assert.ok(flipEntry, '負向 FLIP 路徑應留下 resolve-flip')
    assert.match(`${flipEntry.summary ?? ''} ${flipEntry.steps?.join(' ') ?? ''}`, /未發動|略過|未執行/)
    result.negativeEvidence = 'explicit-flip-decline'
    return
  }

  if (behaviorCard(testCase) === 'BS9-005') {
    const handChoices = modal.locator('.flip-card-page button')
    assert.ok((await handChoices.count()) > 0, 'BS9-005 應提供可棄置的手牌')
    await handChoices.first().click()
    result.actions.push('select-discard-hand')
  }
  await modal.getByRole('button', { name: '發動 FLIP', exact: true }).click()
  result.actions.push('activate-flip')
  await modal.waitFor({ state: 'hidden' })
  await page.waitForTimeout(280)

  if (behaviorCard(testCase) === 'BS9-005') {
    const snapshot = await readSnapshot(page)
    const defender = snapshot.battleCards.find((entry) => entry.title === 'Lassi Guard Kulfi')
    assert.match(defender?.text ?? '', /2\/5/, 'BS9-005 應使附著餅乾獲得 +1 HP')
    assert.match(snapshot.body, /已發動Macaron Cookie/)
    assertTraceKind(snapshot.trace, 'resolve-flip', 'BS9-005 應留下 resolve-flip')
    return
  }

  const draw = page.locator('.draw-up-to-modal:visible').first()
  await draw.waitFor({ state: 'visible' })
  const options = draw.locator('.draw-up-to-option')
  assert.equal(await options.count(), 2)
  await options.nth(1).click()
  result.actions.push('select-draw-one')
  await draw.locator('.draw-up-to-actions button').click()
  result.actions.push('resolve-draw-up-to')
  await draw.waitFor({ state: 'hidden' })
  const snapshot = await readSnapshot(page)
  assertTraceKind(snapshot.trace, 'resolve-flip', 'BS9-007 應留下 resolve-flip')
  assertTraceKind(snapshot.trace, 'resolve-draw-up-to', 'BS9-007 應留下抽牌結算')
  assert.match(snapshot.body, /已從牌庫抽取 1 張牌/)
}

const runScenario = async (browser, viewport, testCase, negative) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(10_000)
  const browserErrorState = recordBrowserErrors(page)
  const route = negative ? testCase.negativeRoute : testCase.positiveRoute
  const record = candidateRecord(testCase.card)
  let exactImageRequested = false
  page.on('request', (request) => {
    if (request.url() === record.imageUrl) exactImageRequested = true
  })
  const result = {
    card: testCase.card,
    baseCard: behaviorCard(testCase),
    mode: testCase.mode,
    viewport,
    negative,
    route,
    expectedImageUrl: record.imageUrl,
    status: 'FAIL',
    actions: [],
    allowedFinalSurfaces: [],
  }

  try {
    await page.goto(
      `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${behaviorCard(testCase)}`,
      { waitUntil: 'domcontentloaded' },
    )
    await waitForGame(page)
    const routeUrl = new URL(page.url())
    assert.equal(routeUrl.searchParams.get('test-state'), route, `${testCase.card} must preserve its exact route`)
    assert.equal(routeUrl.searchParams.get('contract-card'), behaviorCard(testCase), `${testCase.card} trace must use its base runtime id`)
    result.routeIdentity = {
      testState: routeUrl.searchParams.get('test-state'),
      contractCard: routeUrl.searchParams.get('contract-card'),
      variant: record.cardNumber,
      baseCard: behaviorCard(testCase),
    }
    result.initialState = await readPublicState(page)
    result.initialPendingSurfaces = await readVisibleFinalSurfaces(page)
    result.imageEvidence = await assertSourceImage(page, record, exactImageRequested)
    if (testCase.mode === 'activate') {
      await runActivate(page, testCase, negative, result)
    } else if (testCase.mode === 'on-play') {
      await runOnPlay(page, testCase, negative, result)
    } else if (testCase.mode === 'flip') {
      await runFlip(page, testCase, negative, result)
    } else if (testCase.mode === 'attack') {
      await runAttack(page, testCase, negative, result)
    } else {
      await runVanilla(page, testCase, negative, result)
    }
    await page.waitForTimeout(250)
    result.finalState = await readPublicState(page)
    result.publicStateChanged = JSON.stringify(result.initialState) !== JSON.stringify(result.finalState)
    result.finalPendingSurfaces = await readVisibleFinalSurfaces(page)
    result.unexpectedFinalSurfaces = result.finalPendingSurfaces.filter((surface) => !result.allowedFinalSurfaces.includes(surface))
    assert.deepEqual(result.unexpectedFinalSurfaces, [], `${testCase.card} must settle all public decision surfaces`)
    result.snapshot = await readSnapshot(page)
    result.trace = result.snapshot.trace
    result.traceCommandKinds = [...new Set(result.trace.map((entry) => entry.commandKind))]
    result.traceHasExecutedEffectEvidence = hasExecutedTraceEvidence(result.trace) ||
      result.pureDamageSettlementEvidence?.targetAfterHp !== result.pureDamageSettlementEvidence?.targetBeforeHp ||
      (result.effectResolved && result.publicStateChanged)
    result.errors = browserErrorState.errors
    result.imageFailures = browserErrorState.imageFailures
    result.imageResponses = browserErrorState.imageResponses
    result.exactImageRequested = exactImageRequested
    result.exactImageRendered = result.imageEvidence?.exactImageRendered ?? false
    result.exactImageLoaded = result.imageEvidence?.exactImageLoaded ?? false
    result.exactImageFailure = browserErrorState.imageFailures.some((failure) => failure.startsWith(`${record.imageUrl} `)) ||
      browserErrorState.imageResponses.some((response) => response.url === record.imageUrl && !response.ok)
    assert.equal(result.exactImageFailure, false, `${testCase.card} exact official image request failed`)
    assert.equal(result.exactImageRendered, true, `${testCase.card} must render its exact official image URL`)
    assert.equal(result.exactImageLoaded, true, `${testCase.card} exact official image must be loaded`)
    assert.equal(browserErrorState.errors.length, 0, `browser errors: ${browserErrorState.errors.join('; ')}`)
    if (negative) {
      assert.ok(result.negativeEvidence, `${testCase.card} negative route lacks explicit blocked/declined evidence`)
    } else if (['activate', 'on-play', 'flip', 'attack'].includes(testCase.mode)) {
      assert.equal(result.traceHasExecutedEffectEvidence, true, `${testCase.card} positive route lacks substantive runtime settlement evidence`)
    }
    const screenshotPath = resolve(
      outputDirectory,
      `bs9-${testCase.card}-${negative ? 'negative' : 'positive'}-${viewport.width}x${viewport.height}.png`,
    )
    await page.screenshot({ path: screenshotPath, fullPage: true })
    result.screenshot = screenshotPath
    result.status = 'PASS'
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 6000)
    result.trace = await readTrace(page).catch(() => [])
    result.traceCommandKinds = [...new Set(result.trace.map((entry) => entry.commandKind))]
    result.traceHasExecutedEffectEvidence = hasExecutedTraceEvidence(result.trace)
    result.errors = browserErrorState.errors
    result.imageFailures = browserErrorState.imageFailures
    result.imageResponses = browserErrorState.imageResponses
    result.finalState = await readPublicState(page).catch(() => null)
    result.publicStateChanged = result.initialState
      ? JSON.stringify(result.initialState) !== JSON.stringify(result.finalState)
      : undefined
    result.finalPendingSurfaces = await readVisibleFinalSurfaces(page).catch(() => [])
    result.unexpectedFinalSurfaces = result.finalPendingSurfaces.filter((surface) => !result.allowedFinalSurfaces.includes(surface))
    result.exactImageRequested = exactImageRequested
    result.exactImageRendered = result.imageEvidence?.exactImageRendered ?? false
    result.exactImageLoaded = result.imageEvidence?.exactImageLoaded ?? false
    await page.screenshot({
      path: resolve(
        outputDirectory,
        `bs9-${testCase.card}-${negative ? 'negative' : 'positive'}-${viewport.width}x${viewport.height}.png`,
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
    for (const testCase of cases) {
      for (const negative of [false, true]) {
        const caseKey = `${testCase.card}:${testCase.mode}:${negative ? 'negative' : 'positive'}`
        if (selectedCaseKey && caseKey !== selectedCaseKey) continue
        const result = await runScenario(browser, viewport, testCase, negative)
        results.push(result)
        console.log(
          `${result.status} ${testCase.card} ${negative ? 'negative' : 'positive'} ${viewport.width}x${viewport.height}`,
          result.error ?? '',
        )
      }
    }
  }
} finally {
  await browser?.close()
  if (preview.exitCode === null) preview.kill()
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  scope: 'BS9-002..009 candidate-isolated physical-card Browser A/B across 1907x863 and 1164x777; exact variant route, loaded official image, explicit positive/negative evidence, and public final-state gate; vanilla Cookies use real attack declaration/payment/settlement; not promotion, full-match, or online proof.',
  candidateRecords: cases.length,
  total: results.length,
  commandTraces: results.filter((result) => result.status === 'PASS' && result.trace?.length).length,
  substantiveTraceLanes: results.filter((result) => result.status === 'PASS' && result.traceHasExecutedEffectEvidence).length,
  imageLoadedLanes: results.filter((result) => result.status === 'PASS' && result.exactImageLoaded).length,
  negativeEvidenceLanes: results.filter((result) => result.status === 'PASS' && result.negativeEvidence).length,
  passed: results.filter((result) => result.status === 'PASS').length,
  failed: results.filter((result) => result.status !== 'PASS'),
  results,
}
writeFileSync(
  resolve(outputDirectory, 'bs9-002-009-browser.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify({
  candidateRecords: report.candidateRecords,
  total: report.total,
  passed: report.passed,
  commandTraces: report.commandTraces,
  substantiveTraceLanes: report.substantiveTraceLanes,
  imageLoadedLanes: report.imageLoadedLanes,
  negativeEvidenceLanes: report.negativeEvidenceLanes,
  failed: report.failed.map((result) => ({
    card: result.card,
    mode: result.mode,
    negative: result.negative,
    viewport: result.viewport,
    error: result.error?.split('\n')[0],
  })),
}, null, 2))
process.exitCode = report.failed.length > 0 ? 1 : 0
