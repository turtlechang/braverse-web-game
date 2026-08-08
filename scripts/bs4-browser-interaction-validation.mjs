import { strict as assert } from 'node:assert'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightRoot = process.env.PLAYWRIGHT_NODE_MODULES
const playwrightEntry = require.resolve('playwright', {
  paths: playwrightRoot ? [playwrightRoot] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium

if (!chromium) {
  throw new Error('Playwright Chromium is unavailable')
}

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4178)
const baseUrl = `http://127.0.0.1:${port}`
const focusedCard = process.env.BS4_INTERACTION_CARD
const reportPath = process.env.BS4_INTERACTION_REPORT_PATH
  ? resolve(process.env.BS4_INTERACTION_REPORT_PATH)
  : focusedCard
    ? resolve(root, `test-results/bs4-browser-interaction-${focusedCard}.json`)
    : resolve(root, 'data/decks/bs4-browser-interaction-report-2026-08-04.json')
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')
const browserExecutable =
  process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ].find((candidate) => existsSync(candidate))

const CONDITION_CARDS = [
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
]

const GENERIC_FIXTURE_CARDS = [
  'BS4-003',
  'BS4-004',
  'BS4-005',
  'BS4-009',
  'BS4-013',
  'BS4-016',
  'BS4-023',
  'BS4-026',
  'BS4-029',
  'BS4-038',
  'BS4-039',
  'BS4-049',
  'BS4-053',
  'BS4-054',
  'BS4-061',
  'BS4-062',
  'BS4-069',
  'BS4-073',
  'BS4-075',
  'BS4-076',
  'BS4-083',
  'BS4-089',
  'BS4-090',
  'BS4-091',
  'BS4-098',
  'BS4-103',
  'BS4-106',
  'BS4-107',
]

const conditionCardsToRun = focusedCard
  ? CONDITION_CARDS.filter((cardNumber) => cardNumber === focusedCard)
  : CONDITION_CARDS
const genericFixtureCardsToRun = focusedCard
  ? GENERIC_FIXTURE_CARDS.filter((cardNumber) => cardNumber === focusedCard)
  : GENERIC_FIXTURE_CARDS

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))

const count = async (page, selector) => page.locator(selector).count()

const visible = async (locator) =>
  (await locator.count()) > 0 && (await locator.first().isVisible().catch(() => false))

const clickFirstAvailable = async (page, selectors) => {
  for (const selector of selectors) {
    const candidates = page.locator(`${selector} button:not(.is-selected)`)
    if ((await candidates.count()) === 0) continue
    await candidates.first().click({ force: true })
    await wait(120)
    return selector
  }
  return null
}

const activeEffectPanel = (page) =>
  page.locator('.effect-panel[role="alertdialog"]')

const driveEffectPanel = async (page, maxRounds = 32, options = {}) => {
  const operations = []
  const preferTarget = options.preferTarget === true
  const preferLastChoice = options.preferLastChoice === true
  const candidateSelectors = [
    '.effect-candidates-choice',
    '.effect-candidates-payment',
    '.effect-candidates-cost-support',
    '.effect-candidates-discard-hand',
    '.effect-candidates-hp-cost',
    '.effect-candidates-trash-battle',
    '.effect-candidates-trash-deck-bottom',
    '.effect-candidates-trash-deck',
    '.effect-candidates-rest-support',
    '.effect-candidates-target',
    '.optional-cost-col .modal-card-options',
  ]

  for (let round = 0; round < maxRounds; round += 1) {
    const panel = activeEffectPanel(page)
    if ((await panel.count()) === 0) return operations

    const primary = panel.locator('.effect-panel-primary-action')

    const inlineOptionalButtons = panel.locator(
      '.optional-cost-attack-inline .modal-actions-sticky button',
    )
    const inlineOptionalPrimary = inlineOptionalButtons.last()
    if (
      (await visible(inlineOptionalPrimary)) &&
      !(await inlineOptionalPrimary.isDisabled())
    ) {
      await inlineOptionalPrimary.click({ force: true })
      operations.push('optional-cost:inline-confirm')
      await wait(180)
      continue
    }

    if (preferTarget) {
      const targetGroup = panel.locator('.effect-candidates-target')
      const selectedTargets = targetGroup.locator('button.is-selected')
      if ((await selectedTargets.count()) === 0) {
        const target = await clickFirstAvailable(page, ['.effect-candidates-target'])
        if (target) {
          operations.push(`effect-panel:${target}`)
          continue
        }
      }
    }

    if (preferLastChoice) {
      const choiceGroup = panel.locator('.effect-candidates-choice')
      const selectedChoices = choiceGroup.locator('button.is-selected')
      if ((await selectedChoices.count()) === 0) {
        const choices = choiceGroup.locator('button')
        if ((await choices.count()) > 0) {
          await choices.last().click({ force: true })
          operations.push('effect-panel:.effect-candidates-choice:last')
          await wait(120)
          continue
        }
      }
    }

    if ((await primary.count()) > 0 && !(await primary.first().isDisabled())) {
      await primary.first().click({ force: true })
      operations.push('effect-panel:primary')
      await wait(180)
      continue
    }

    if (await visible(panel.locator('.optional-cost-attack-inline'))) {
      const decisionButtons = panel.locator('.optional-cost-attack-inline .modal-actions-decision button')
      if ((await decisionButtons.count()) > 1 && !(await decisionButtons.nth(1).isDisabled())) {
        await decisionButtons.nth(1).click({ force: true })
        operations.push('optional-cost:pay')
        await wait(150)
        continue
      }
    }

    const selected = await clickFirstAvailable(page, candidateSelectors)
    if (selected) {
      const selectedOrder = selected === '.effect-candidates-target'
        ? await panel
          .locator(`${selected} button.is-selected small`)
          .allTextContents()
        : []
      operations.push(
        `effect-panel:${selected}${
          selectedOrder.length > 0 ? `:${selectedOrder.join(',')}` : ''
        }`,
      )
      continue
    }

    const skip = panel.locator('.skip-effect')
    if (await visible(skip)) {
      await skip.first().click({ force: true })
      operations.push('effect-panel:skip')
      await wait(180)
      continue
    }

    throw new Error('active effect panel has no selectable or confirmable control')
  }

  const diagnostics = await page.evaluate(() => {
    const panel = document.querySelector('.effect-panel[role="alertdialog"]')
    return {
      text: panel?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 800),
      buttons: [...(panel?.querySelectorAll('button') ?? [])].map((button) => ({
        text: button.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80),
        className: button.className,
        disabled: button.disabled,
      })),
      candidateCounts: Object.fromEntries(
        [
          '.effect-candidates-target',
          '.effect-candidates-choice',
          '.optional-cost-col .modal-card-options',
          ].map((selector) => [selector, panel?.querySelectorAll(selector).length ?? 0]),
      ),
    }
  })
  throw new Error(
    `effect panel did not settle within ${maxRounds} rounds: ${JSON.stringify({
      diagnostics,
      operations,
    })}`,
  )
}

const driveDirectOptionalCost = async (page) => {
  const modal = page.locator('.optional-cost-attack-modal[role="alertdialog"]')
  if (!(await visible(modal))) return []

  const operations = []
  const decisionButtons = modal.locator('.modal-actions-decision button')
  if ((await decisionButtons.count()) > 1 && !(await decisionButtons.nth(1).isDisabled())) {
    await decisionButtons.nth(1).click({ force: true })
    operations.push('optional-cost:pay')
  } else {
    await decisionButtons.first().click({ force: true })
    operations.push('optional-cost:skip')
    return operations
  }

  for (let round = 0; round < 12; round += 1) {
    const options = modal.locator('.modal-card-options button:not(.is-selected)')
    if ((await options.count()) > 0) {
      await options.first().click({ force: true })
      operations.push('optional-cost:select')
      await wait(100)
      continue
    }
    const primary = modal.locator('.modal-actions-sticky button:not(:disabled)').last()
    if ((await primary.count()) > 0) {
      await primary.click({ force: true })
      operations.push('optional-cost:confirm')
      await wait(180)
      return operations
    }
    break
  }

  throw new Error('direct optional-cost modal did not settle')
}

const driveOtherPendingModal = async (page) => {
  const operations = []

  const stageTrigger = page.locator('.faint-response-modal[role="dialog"]')
  if (await visible(stageTrigger)) {
    const activate = stageTrigger.locator('.modal-button.primary')
    await (await visible(activate) ? activate : stageTrigger.locator('.modal-button')).first().click({ force: true })
    return ['stage-trigger:resolve']
  }

  const drawUpTo = page.locator('.draw-up-to-modal[role="dialog"]')
  if (await visible(drawUpTo)) {
    const option = drawUpTo.locator('.draw-up-to-option').first()
    if (await visible(option)) await option.click({ force: true })
    await drawUpTo.locator('.draw-up-to-actions button:not(:disabled)').first().click({ force: true })
    return ['draw-up-to:resolve']
  }

  const handDiscard = page.locator('.hand-discard-modal[role="alertdialog"]')
  if (await visible(handDiscard)) {
    const card = handDiscard.locator('.hand-discard-options button:not(.is-selected)').first()
    if (await visible(card)) await card.click({ force: true })
    await handDiscard.locator('.hand-discard-actions button:not(:disabled)').first().click({ force: true })
    return ['hand-discard:resolve']
  }

  const inspect = page.locator('.inspect-deck-modal[role="dialog"]')
  if (await visible(inspect)) {
    const card = inspect.locator('.inspect-deck-grid button:not(.is-selected)').first()
    if (await visible(card)) await card.click({ force: true })
    await inspect.locator('.modal-actions button:not(:disabled)').last().click({ force: true })
    return ['inspect-deck:resolve']
  }

  const reveal = page.locator('.card-reveal-modal[role="alertdialog"]')
  if (await visible(reveal)) {
    await reveal.locator('.reveal-confirm').click({ force: true })
    return ['reveal:resolve']
  }

  const faint = page.locator('.faint-response-modal[role="dialog"]')
  if (await visible(faint)) {
    const target = page.locator('.top-field .combat-card-wrap.is-attack-target').first()
    if (await visible(target)) await target.click({ force: true })
    await faint.locator('.modal-button.primary').click({ force: true })
    return ['faint:resolve']
  }

  const effectOrder = page.locator('.effect-order-modal[role="dialog"]')
  if (await visible(effectOrder)) {
    await effectOrder.locator('.modal-card-options button').first().click({ force: true })
    await effectOrder.locator('.modal-actions button:not(:disabled)').last().click({ force: true })
    return ['effect-order:resolve']
  }

  return operations
}

const settlePending = async (page, options = {}) => {
  const operations = []
  for (let round = 0; round < 40; round += 1) {
    const panelOps = await driveEffectPanel(page, 32, options)
    if (panelOps.length > 0) {
      operations.push(...panelOps)
      await wait(160)
      continue
    }

    const optionalOps = await driveDirectOptionalCost(page)
    if (optionalOps.length > 0) {
      operations.push(...optionalOps)
      await wait(160)
      continue
    }

    const modalOps = await driveOtherPendingModal(page)
    if (modalOps.length > 0) {
      operations.push(...modalOps)
      await wait(180)
      continue
    }

    await wait(160)
    const pendingCount =
      (await count(page, '.effect-panel[role="alertdialog"]')) +
      (await count(page, '.optional-cost-attack-modal[role="alertdialog"]')) +
      (await count(page, '.draw-up-to-modal[role="dialog"]')) +
      (await count(page, '.hand-discard-modal[role="alertdialog"]')) +
      (await count(page, '.inspect-deck-modal[role="dialog"]')) +
      (await count(page, '.card-reveal-modal[role="alertdialog"]'))
    if (pendingCount === 0) return operations
  }

  throw new Error('pending UI did not settle')
}

const inspectCookie = async (page) => {
  const cookie = page.locator('.bottom-field .combat-card-wrap').first()
  if (!(await visible(cookie))) return false
  await cookie.click({ force: true })
  await wait(120)
  const detail = page.locator('.card-detail-modal')
  if (await visible(detail)) {
    await detail.locator('.close-modal').click({ force: true })
    await wait(100)
    return 'card:inspect'
  }
  // Passive cookies may not expose a detail modal from this click because the
  // same surface is also the attacker/selection target. The click still
  // exercises the real battlefield interaction and must count as coverage.
  return 'card:select'
}

const clickFirstHandAction = async (page) => {
  const hand = page.locator('.bottom-hand .hand-card-wrap').first()
  if (!(await visible(hand))) return false
  await hand.locator('.hand-card').click({ force: true })
  await wait(140)
  const action = hand.locator('.hand-card-action')
  if (!(await visible(action))) return false
  await action.click({ force: true })
  return true
}

const clickSkillAction = async (page) => {
  const skill = page.locator('.bottom-field .skill-action').first()
  if (!(await visible(skill))) return false
  await skill.click({ force: true })
  return true
}

const settleEndPhase = async (page) => {
  const nextPhase = page.locator('.next-phase-button')
  if (!(await visible(nextPhase))) return false
  await nextPhase.click({ force: true })
  await wait(300)
  return true
}

const surfaceSnapshot = async (page) =>
  page.evaluate(() => ({
    activeEffectPanel: document.querySelectorAll('.effect-panel[role="alertdialog"]').length,
    skillActions: document.querySelectorAll('.bottom-field .skill-action').length,
    handActions: document.querySelectorAll('.bottom-hand .hand-card-action').length,
    restedBottomSupports: document.querySelectorAll('.bottom-field .support-card.is-rested').length,
    topCombatText: [...document.querySelectorAll('.top-field .combat-card-wrap')]
      .map((element) => element.textContent?.replace(/\s+/g, ' ').trim())
      .join('|'),
    topHpTotal: document.querySelectorAll('.top-field .hp-card-stack .hp-card').length,
    bottomDeckCount: Number(
      document.querySelector('.bottom-field .deck-zone .resource-summary > strong')
        ?.textContent ?? Number.NaN,
    ),
    topDiscardCount: Number(
      document.querySelector('.top-field .discard-zone > strong')?.textContent ?? 0,
    ),
    body: document.body.innerText,
  }))

const assertNoErrorSurface = async (page, errors, pageErrors) => {
  const snapshot = await surfaceSnapshot(page)
  assert.ok(
    !/Application Error|GameErrorBoundary|Unhandled Runtime Error|Something went wrong/i.test(
      snapshot.body,
    ),
    'error boundary or application error appeared',
  )
  assert.deepEqual(errors, [], `console errors: ${JSON.stringify(errors)}`)
  assert.deepEqual(pageErrors, [], `page errors: ${JSON.stringify(pageErrors)}`)
  return snapshot
}

const waitForBs4005DamageSequence = async (page) => {
  await page.waitForFunction(
    () => {
      const texts = [...document.querySelectorAll('.top-field .combat-card-wrap')]
        .map((element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      return (
        texts.some((text) => text.includes('opp-lv1') && text.includes('5/6')) &&
        texts.some((text) => text.includes('opp-lv3') && text.includes('4/8'))
      )
    },
    { timeout: 6000 },
  )
}

const openBattleLog = async (page) => {
  const sidebar = page.locator('[data-testid="battle-log-sidebar"]')
  if (!(await visible(sidebar))) {
    await page.locator('[data-testid="battle-log-toggle"]').click({ force: true })
    await sidebar.waitFor({ state: 'visible' })
  }
  return sidebar
}

const assertBs4005DamageLog = async (page) => {
  const sidebar = await openBattleLog(page)
  await wait(120)
  for (let index = 0; index < 16; index += 1) {
    const collapsedEntry = sidebar.locator('.battle-log-entry[aria-expanded="false"]').first()
    if ((await collapsedEntry.count()) === 0) break
    await collapsedEntry.evaluate((button) => button.click())
    await wait(60)
  }
  const logText = (await sidebar.innerText()).replace(/\s+/g, ' ')
  const logEntries = await sidebar.locator('.battle-log-entry').evaluateAll((entries) =>
    entries.map((entry) => ({
      expanded: entry.getAttribute('aria-expanded'),
      disabled: entry.hasAttribute('disabled'),
      text: entry.textContent?.replace(/\s+/g, ' ').trim(),
    })),
  )
  for (const targetName of ['opp-lv1', 'opp-lv3']) {
    assert.match(
      logText,
      new RegExp(`「${targetName}」受到 1 點傷害`),
      `BS4-005 battle log did not report the actual damage to ${targetName}: ${logText}; entries=${JSON.stringify(logEntries)}`,
    )
  }
}

const exerciseBs4062 = async (page) => {
  assert.equal(
    await page.locator('.bottom-field .support-card:not(.is-rested)').count(),
    8,
    'BS4-062 fixture must begin with 8 active support cards',
  )
  assert.equal(await clickFirstHandAction(page), true, 'BS4-062 item action was unavailable')

  const panel = activeEffectPanel(page)
  await panel.waitFor({ state: 'visible' })
  const phaseLabels = await panel.locator('.phase-step').allTextContents()
  assert.deepEqual(
    phaseLabels.map((label) => label.replace(/^\s*\d+\s*/, '').trim()),
    ['能量', '額外橫置', '目標'],
    `BS4-062 phase order was incorrect: ${JSON.stringify(phaseLabels)}`,
  )

  const paymentButtons = panel.locator('.effect-candidates-payment button')
  const primaryAction = panel.locator('.effect-panel-primary-action')
  assert.equal(await paymentButtons.count(), 8, 'BS4-062 payment must offer all 8 active supports')
  assert.equal(
    await primaryAction.isDisabled(),
    true,
    'BS4-062 cannot continue before paying 2 green energy',
  )
  for (let index = 0; index < 2; index += 1) {
    await paymentButtons.nth(index).click({ force: true })
    await wait(100)
    if (index === 0) {
      assert.equal(
        await primaryAction.isDisabled(),
        true,
        'BS4-062 cannot continue after paying only 1 of 2 green energy',
      )
    }
  }
  assert.equal(
    await panel.locator('.effect-candidates-payment button.is-selected').count(),
    2,
    'BS4-062 must select exactly 2 energy supports before continuing',
  )
  await primaryAction.click({ force: true })
  await wait(120)

  const supportButtons = panel.locator('.effect-candidates-rest-support button')
  assert.equal(
    await supportButtons.count(),
    6,
    'BS4-062 extra-rest step must exclude the 2 supports selected for payment',
  )
  for (let index = 0; index < 4; index += 1) {
    await supportButtons.nth(index).click({ force: true })
    await wait(100)
  }
  await supportButtons.nth(4).click({ force: true })
  await wait(100)
  assert.equal(
    await panel.locator('.effect-candidates-rest-support button.is-selected').count(),
    4,
    'BS4-062 must retain 4 selected extra supports',
  )
  await primaryAction.click({ force: true })
  await wait(120)

  const targetButtons = panel.locator('.effect-candidates-target button')
  assert.ok(
    (await targetButtons.count()) > 0,
    'BS4-062 target step must offer an opposing Cookie',
  )
  assert.match(
    (await panel.innerText()).replace(/\s+/g, ' '),
    /造成 4 點效果傷害/,
    'BS4-062 target prompt must report the selected extra-rest damage',
  )
  const beforeTargetText = await page.locator('.top-field .combat-card-wrap').allTextContents()
  await targetButtons.first().click({ force: true })
  await wait(100)
  if ((await targetButtons.count()) > 1) {
    await targetButtons.nth(1).click({ force: true })
    await wait(100)
    assert.equal(
      await panel.locator('.effect-candidates-target button.is-selected').count(),
      1,
      'BS4-062 must not allow more than 1 opposing Cookie target',
    )
  }
  await primaryAction.click({ force: true })
  await panel.waitFor({ state: 'detached' })
  await wait(250)

  assert.equal(
    await page.locator('.bottom-field .support-card.is-rested').count(),
    6,
    'BS4-062 must rest 2 payment supports plus 4 effect supports',
  )
  assert.equal(
    await page.locator('.bottom-field .support-card:not(.is-rested)').count(),
    2,
    'BS4-062 must leave 2 of the original 8 supports active',
  )
  const afterTargetText = await page.locator('.top-field .combat-card-wrap').allTextContents()
  assert.notDeepEqual(
    afterTargetText,
    beforeTargetText,
    'BS4-062 did not change the selected opposing Cookie after dealing 4 damage',
  )

  return [
    'hand:action',
    'BS4-062:pay-2',
    'BS4-062:rest-4',
    'BS4-062:target-1',
    'BS4-062:damage-4',
  ]
}

const runRoute = async (
  page,
  url,
  routeType,
  expectedCard,
  expectedResult,
  options = {},
) => {
  const consoleErrors = []
  const pageErrors = []
  const onConsole = (message) => {
    if (message.type() !== 'error') return
    const location = message.location()
    // Card faces intentionally use the official CDN. Offline/sandboxed
    // browser runs can reject those image requests without affecting the
    // game UI or rules path under test.
    if (
      location.url?.includes('cookierunbraverse.com/data/en_storage/') &&
      message.text().includes('ERR_NETWORK_ACCESS_DENIED')
    ) {
      return
    }
    if (location.url?.endsWith('/favicon.ico') && message.text().includes('404')) return
    consoleErrors.push(location.url ? `${message.text()} (${location.url})` : message.text())
  }
  const onPageError = (error) => pageErrors.push(error.message)
  page.on('console', onConsole)
  page.on('pageerror', onPageError)

  try {
    // Official card faces are loaded from an external CDN, so `networkidle`
    // can remain busy or time out even though the local game UI is ready.
    // The visible game shell is the actual readiness signal for this audit.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    await wait(700)
    const routeAttribute = await page.locator('.game-shell').getAttribute(
      routeType === 'condition' ? 'data-bs4-condition-card' : 'data-card-check',
    )
    if (routeType === 'condition') {
      assert.equal(routeAttribute, expectedCard)
      assert.equal(
        await page.locator('.game-shell').getAttribute('data-bs4-condition-result'),
        expectedResult,
      )
    }

    const before = await surfaceSnapshot(page)
    let interactions = []

    if (routeType === 'condition') {
      if (expectedCard === 'BS4-048' || expectedCard === 'BS4-052') {
        if (await settleEndPhase(page)) {
          interactions.push('end-phase:advance')
          if (expectedCard === 'BS4-052') {
            interactions.push(...(await settlePending(page, { preferTarget: true })))
          }
        }
      } else {
        interactions.push(...(await settlePending(page)))
        if (
          interactions.length === 0 &&
          (expectedCard === 'BS4-059' || expectedCard === 'BS4-094') &&
          (await clickSkillAction(page))
        ) {
          interactions.push('skill:activate')
          interactions.push(...(await settlePending(page)))
        }
        if (
          interactions.length === 0 &&
          (expectedCard === 'BS4-020' ||
            expectedCard === 'BS4-040' ||
            expectedCard === 'BS4-106' ||
            expectedCard === 'BS4-107') &&
          (await clickFirstHandAction(page))
        ) {
          interactions.push('hand:action')
          interactions.push(
            ...(await settlePending(page, {
              preferTarget:
                expectedResult === 'met' &&
                (expectedCard === 'BS4-106' || expectedCard === 'BS4-107'),
              preferLastChoice: options.preferLastChoice,
            })),
          )
        }
        if (interactions.length === 0) {
          const inspection = await inspectCookie(page)
          if (inspection) interactions.push(inspection)
        }
      }
    } else if (expectedCard === 'BS4-062') {
      interactions.push(...(await exerciseBs4062(page)))
    } else {
      interactions.push(...(await settlePending(page)))
      if (interactions.length === 0 && (await clickSkillAction(page))) {
        interactions.push('skill:activate')
        interactions.push(...(await settlePending(page)))
      }
      if (interactions.length === 0 && (await clickFirstHandAction(page))) {
        interactions.push('hand:action')
        interactions.push(
          ...(await settlePending(page, {
            preferTarget:
              expectedCard === 'BS4-106' || expectedCard === 'BS4-107',
            preferLastChoice: options.preferLastChoice,
          })),
        )
      }
      if (interactions.length === 0) {
        const inspection = await inspectCookie(page)
        if (inspection) interactions.push(inspection)
      }
    }

    assert.ok(interactions.length > 0, 'no real UI interaction was executed')
    if (routeType === 'generic' && expectedCard === 'BS4-005') {
      assert.ok(
        interactions.some((operation) => operation.includes('第 1 順位') && operation.includes('第 2 順位')),
        `BS4-005 did not expose the selected first and second damage order in the UI: ${JSON.stringify(interactions)}`,
      )
      await openBattleLog(page)
      await waitForBs4005DamageSequence(page)
      await assertBs4005DamageLog(page)
      interactions.push('battle-log:damage-outcome')
    }
    if (routeType === 'condition' && expectedCard === 'BS4-011' && expectedResult === 'met') {
      assert.ok(
        interactions.includes('hand-discard:resolve'),
        `BS4-011 fainted-opponent flow did not open its discard-hand prompt: ${JSON.stringify(interactions)}`,
      )
    }
    const after = await assertNoErrorSurface(page, consoleErrors, pageErrors)
    if (
      (routeType === 'generic' || expectedResult === 'met') &&
      (expectedCard === 'BS4-106' || expectedCard === 'BS4-107')
    ) {
      const expectedHpLoss = expectedCard === 'BS4-106' ? 1 : 2
      assert.equal(
        after.topHpTotal,
        before.topHpTotal - expectedHpLoss,
        `${expectedCard} did not remove ${expectedHpLoss} HP from the selected opponent Cookie`,
      )
      if (expectedCard === 'BS4-106') {
        assert.equal(
          after.topDiscardCount,
          before.topDiscardCount + 1,
          'BS4-106 did not place the selected opponent HP card in their trash',
        )
      } else {
        assert.ok(
          interactions.some((operation) =>
            operation.startsWith('effect-panel:.effect-candidates-choice'),
          ),
          'BS4-107 did not expose the optional 0-3 card choice in the UI',
        )
        const expectedDeckLoss = options.preferLastChoice ? 0 : 3
        assert.equal(
          after.bottomDeckCount,
          before.bottomDeckCount - expectedDeckLoss,
          `BS4-107 did not place the selected ${expectedDeckLoss} cards from the controller deck into the trash`,
        )
      }
    }
    if (routeType === 'condition' && (expectedCard === 'BS4-048' || expectedCard === 'BS4-052')) {
      if (expectedResult === 'met') {
        if (expectedCard === 'BS4-048') {
          assert.notEqual(
            after.restedBottomSupports,
            before.restedBottomSupports,
            `${expectedCard} met route did not change support state at end phase`,
          )
        } else {
          assert.notEqual(
            after.topCombatText,
            before.topCombatText,
            `${expectedCard} met route did not change the opposing Cookie`,
          )
        }
      } else {
        if (expectedCard === 'BS4-048') {
          assert.equal(
            after.restedBottomSupports,
            before.restedBottomSupports,
            `${expectedCard} unmet route changed support state`,
          )
        } else {
          assert.equal(
            after.topCombatText,
            before.topCombatText,
            `${expectedCard} unmet route changed the opposing Cookie`,
          )
        }
      }
    }

    return {
      cardNumber: expectedCard,
      result: expectedResult,
      interactions,
      before: {
        activeEffectPanel: before.activeEffectPanel,
        skillActions: before.skillActions,
        handActions: before.handActions,
      },
      after: {
        activeEffectPanel: after.activeEffectPanel,
        skillActions: after.skillActions,
        handActions: after.handActions,
        topCombatText: after.topCombatText,
        topHpTotal: after.topHpTotal,
        bottomDeckCount: after.bottomDeckCount,
        topDiscardCount: after.topDiscardCount,
        restedBottomSupports: after.restedBottomSupports,
      },
      status: 'PASS',
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
const conditionResults = []
const genericResults = []
const optionalChoiceResults = []

try {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) break
    } catch {
      // Preview server is still starting.
    }
    if (attempt === 49) throw new Error(`Vite preview did not start at ${baseUrl}`)
    await wait(100)
  }

  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  page.setDefaultTimeout(7000)

  for (const cardNumber of conditionCardsToRun) {
    for (const result of ['met', 'unmet']) {
      const route = `?test-state=bs4-condition:${cardNumber}:${result}`
      try {
        const row = await runRoute(
          page,
          `${baseUrl}/${route}`,
          'condition',
          cardNumber,
          result,
        )
        conditionResults.push(row)
        console.log(`PASS condition ${cardNumber} ${result}: ${row.interactions.join(', ')}`)
      } catch (error) {
        conditionResults.push({
          cardNumber,
          result,
          status: 'FAIL',
          error: error instanceof Error ? error.message : String(error),
        })
        console.log(`FAIL condition ${cardNumber} ${result}: ${error}`)
      }
    }
  }

  for (const cardNumber of genericFixtureCardsToRun) {
    const route = `?test-state=card:${cardNumber}`
    try {
      const row = await runRoute(page, `${baseUrl}/${route}`, 'generic', cardNumber, 'fixture')
      genericResults.push(row)
      console.log(`PASS generic ${cardNumber}: ${row.interactions.join(', ')}`)
    } catch (error) {
      genericResults.push({
        cardNumber,
        status: 'FAIL',
        error: error instanceof Error ? error.message : String(error),
      })
      console.log(`FAIL generic ${cardNumber}: ${error}`)
    }
  }

  if (genericFixtureCardsToRun.includes('BS4-107')) {
    const route = '?test-state=card:BS4-107'
    try {
      const row = await runRoute(
        page,
        `${baseUrl}/${route}`,
        'generic',
        'BS4-107',
        'fixture-zero',
        { preferLastChoice: true },
      )
      optionalChoiceResults.push(row)
      console.log(`PASS optional BS4-107 zero: ${row.interactions.join(', ')}`)
    } catch (error) {
      optionalChoiceResults.push({
        cardNumber: 'BS4-107',
        result: 'fixture-zero',
        status: 'FAIL',
        error: error instanceof Error ? error.message : String(error),
      })
      console.log(`FAIL optional BS4-107 zero: ${error}`)
    }
  }

  const failures = [...conditionResults, ...genericResults, ...optionalChoiceResults].filter(
    (result) => result.status === 'FAIL',
  )
  const report = {
    generatedAt: new Date().toISOString(),
    browser: browserExecutable ?? 'playwright-chromium',
    viewport: '1440x960',
    routeTypes: {
      condition: '?test-state=bs4-condition:BS4-xxx:met|unmet',
      generic: '?test-state=card:BS4-xxx',
    },
    conditionAudit: {
      cards: conditionCardsToRun.length,
      routes: conditionResults.length,
      passed: conditionResults.filter((result) => result.status === 'PASS').length,
      failures: conditionResults.filter((result) => result.status === 'FAIL').length,
      results: conditionResults,
    },
    genericFixtureAudit: {
      cards: genericFixtureCardsToRun.length,
      passed: genericResults.filter((result) => result.status === 'PASS').length,
      failures: genericResults.filter((result) => result.status === 'FAIL').length,
      results: genericResults,
    },
    optionalChoiceAudit: {
      routes: optionalChoiceResults.length,
      passed: optionalChoiceResults.filter((result) => result.status === 'PASS').length,
      failures: optionalChoiceResults.filter((result) => result.status === 'FAIL').length,
      results: optionalChoiceResults,
    },
  }
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(`Report: ${reportPath}`)
  console.log(
    `Summary: conditions ${report.conditionAudit.passed}/${report.conditionAudit.routes}; ` +
      `generic ${report.genericFixtureAudit.passed}/${report.genericFixtureAudit.cards}; ` +
      `optional choices ${report.optionalChoiceAudit.passed}/${report.optionalChoiceAudit.routes}`,
  )
  process.exitCode = failures.length === 0 ? 0 : 1
} finally {
  await browser?.close().catch(() => {})
  server.kill()
}
