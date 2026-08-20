import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from 'playwright'
import {
  attestCardContractActionTrace,
  type CardContractActionTraceEntry,
} from '../src/cards/contracts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4180)
const baseUrl = `http://127.0.0.1:${port}`
const viteEntry = resolve(
  dirname(require.resolve('vite/package.json', { paths: [root] })),
  'bin/vite.js',
)

const waitForPreview = async (): Promise<void> => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(baseUrl)).ok) return
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
  }
  throw new Error(`Vite preview did not start at ${baseUrl}`)
}

const readTrace = (page: Page): Promise<CardContractActionTraceEntry[]> =>
  page.evaluate(() => {
    const trace = (window as Window & {
      __braverseContractTrace?: CardContractActionTraceEntry[]
    }).__braverseContractTrace
    return trace ?? []
  })

const assertHealthy = async (page: Page, cardId: string) => {
  const body = await page.locator('body').innerText()
  assert.equal(
    /遊戲發生問題|Application Error|Unhandled Runtime Error/i.test(body),
    false,
    `${cardId} Browser fixture rendered an error boundary`,
  )
}

const openCardRoute = async (
  page: Page,
  cardId: string,
  negative = false,
  testState?: string,
): Promise<void> => {
  const route =
    testState ?? (negative ? `card-negative:${cardId}` : `card:${cardId}`)
  await page.goto(
    `${baseUrl}?test-state=${encodeURIComponent(route)}&contract-card=${cardId}`,
    { waitUntil: 'networkidle' },
  )
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await page.waitForTimeout(160)
  await assertHealthy(page, `${cardId}${negative ? ' negative' : ''}`)
}

const clickByText = async (page: Page, text: RegExp | string): Promise<void> => {
  const button = page.getByRole('button', { name: text }).first()
  await button.waitFor({ state: 'visible' })
  try {
    await button.click({ force: true })
  } catch {
    // The hand-card action can remain below the viewport at tablet-sized
    // layouts.  DOM click still exercises the same React handler without
    // changing the command path.
    await button.evaluate((element) => (element as HTMLElement).click())
  }
}

const clickPrimary = async (page: Page): Promise<void> => {
  const button = page.locator('.effect-panel-primary-action').first()
  await button.waitFor({ state: 'visible' })
  assert.equal(await button.isDisabled(), false, 'effect panel primary action is disabled')
  await button.click({ force: true })
  await page.waitForTimeout(180)
}

const placeStageFromHand = async (page: Page, cardName: string): Promise<void> => {
  const card = page
    .locator('.bottom-hand .hand-card-wrap')
    .filter({ hasText: cardName })
    .first()
  await card.scrollIntoViewIfNeeded().catch(() => {})
  await card.locator('.hand-card').click({ force: true })
  const action = card.locator('.hand-card-action').first()
  await action.scrollIntoViewIfNeeded().catch(() => {})
  await action.click({ force: true }).catch(async () => {
    await action.evaluate((element) => (element as HTMLElement).click())
  })

  const modal = page.locator('.stage-placement-modal')
  await modal.waitFor({ state: 'visible' })
  const candidates = modal.locator(
    '.stage-placement-payment .faint-payment-candidates > button',
  )
  const confirm = modal.getByRole('button', { name: '支付並放置' })
  for (
    let index = 0;
    index < (await candidates.count()) && (await confirm.isDisabled());
    index += 1
  ) {
    await candidates.nth(index).click({ force: true })
  }
  assert.equal(
    await confirm.isDisabled(),
    false,
    `${cardName} stage placement payment should be payable`,
  )
  await confirm.click({ force: true })
  await modal.waitFor({ state: 'hidden' })
}

const selectAttackTrap = async (page: Page, cardName: string) => {
  const response = page.locator('.attack-response-modal')
  const trap = page.locator('.trap-response-modal')
  await page
    .locator('.attack-response-modal, .trap-response-modal')
    .first()
    .waitFor({ state: 'visible' })
  const selectionRoot = (await response.isVisible().catch(() => false))
    ? response
    : trap
  await selectionRoot
    .locator('button')
    .filter({ hasText: cardName })
    .first()
    .click({ force: true })
  await trap.waitFor({ state: 'visible' })
  return trap
}

const waitForTrace = async (page: Page): Promise<CardContractActionTraceEntry[]> => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const trace = await readTrace(page)
    if (trace.length > 0) return trace
    await page.waitForTimeout(100)
  }
  return readTrace(page)
}

const runBs6036 = async (browser: Browser) => {
  const positivePage = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  positivePage.setDefaultTimeout(7000)
  await openCardRoute(positivePage, 'BS6-036')
  await clickByText(positivePage, /^支付$/)
  const payment = positivePage
    .locator('.optional-cost-attack-inline .modal-card-options button')
    .filter({ hasText: 'support-pay-0' })
    .first()
  await payment.waitFor({ state: 'visible' })
  await payment.click({ force: true })
  await positivePage
    .locator('.optional-cost-attack-inline .modal-actions button')
    .filter({ hasText: '確認' })
    .click({ force: true })
  const positiveTrace = await waitForTrace(positivePage)
  const positive = attestCardContractActionTrace(positiveTrace, {
    requiredCommandKinds: ['resolve-attack-effect', 'resolve-optional-cost-attack'],
    orderedStepFragments: ['攻擊後代價：支付能量', '攻擊後效果結果：'],
  })
  assert.equal(positive.passed, true, `BS6-036 positive trace failed: ${positive.errors.join('; ')}`)
  await positivePage.close()

  const negativePage = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  negativePage.setDefaultTimeout(7000)
  await openCardRoute(negativePage, 'BS6-036', true)
  const pay = negativePage.getByRole('button', { name: /^支付$/ }).first()
  assert.equal(await pay.isDisabled(), true, 'BS6-036 negative payment should be disabled')
  await clickByText(negativePage, /^略過$/)
  const negativeTrace = await waitForTrace(negativePage)
  const negative = attestCardContractActionTrace(negativeTrace, {
    requiredCommandKinds: ['resolve-optional-cost-attack'],
    orderedStepFragments: ['玩家選擇略過攻擊後效果'],
  })
  assert.equal(negative.passed, true, `BS6-036 negative trace failed: ${negative.errors.join('; ')}`)
  await negativePage.close()
  return { positive, negative }
}

const runBs6042 = async (browser: Browser) => {
  const positivePage = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  positivePage.setDefaultTimeout(7000)
  await openCardRoute(positivePage, 'BS6-042')
  // A lone Trap opens directly; the generic response selector only appears
  // when Blocker/response-skill choices compete with it.
  const trap = await selectAttackTrap(positivePage, 'Clever Advice')
  await trap.locator('button').filter({ hasText: 'support-pay-' }).first().click({ force: true })
  await trap.getByRole('button', { name: '下一步' }).click({ force: true })
  await trap.getByRole('button', { name: /opp-lv3/ }).click({ force: true })
  await trap.getByRole('button', { name: '確認發動' }).click({ force: true })
  await positivePage.waitForTimeout(220)
  const positiveTrace = await waitForTrace(positivePage)
  const positive = attestCardContractActionTrace(positiveTrace, {
    requiredCommandKinds: ['play-trap', 'resolve-draw-up-to'],
    orderedStepFragments: [
      '支付能量（橫置）',
      '選擇目標：opp-lv3',
      '抽牌原因：「BS6-042 Clever Advice」效果觸發抽牌',
    ],
  })
  assert.equal(positive.passed, true, `BS6-042 positive trace failed: ${positive.errors.join('; ')}`)
  await positivePage.close()

  const negativePage = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  negativePage.setDefaultTimeout(7000)
  await openCardRoute(negativePage, 'BS6-042', true)
  await negativePage.waitForTimeout(300)
  assert.equal(await negativePage.locator('.trap-response-modal').count(), 0)
  const negativeTrace = await readTrace(negativePage)
  assert.equal(
    negativeTrace.some((entry) => entry.commandKind === 'play-trap'),
    false,
    'BS6-042 negative condition must not produce a play-trap command',
  )
  await negativePage.close()
  return { positive, negative: { passed: true, errors: [] as string[] } }
}

const runBs6043 = async (browser: Browser) => {
  const positivePage = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  positivePage.setDefaultTimeout(7000)
  await openCardRoute(positivePage, 'BS6-043')
  await placeStageFromHand(positivePage, 'Timecraft Garage')
  await clickByText(positivePage, /結束主要階段/)
  await clickByText(positivePage, /結束回合/)
  const panel = positivePage.locator('.effect-panel')
  await panel.waitFor({ state: 'visible' })
  await panel.locator('.effect-candidates-target button').filter({ hasText: 'hand-cookie-filler' }).click({ force: true })
  await clickPrimary(positivePage)
  await panel.locator('.effect-candidates-target button').nth(0).click({ force: true })
  await panel.locator('.effect-candidates-target button').nth(1).click({ force: true })
  await clickPrimary(positivePage)
  await clickPrimary(positivePage)
  const positiveTrace = await waitForTrace(positivePage)
  const positive = attestCardContractActionTrace(positiveTrace, {
    requiredCommandKinds: ['play-stage', 'resolve-ability-effect', 'resolve-draw-up-to'],
    orderedStepFragments: [
      '抽牌原因：「BS6-043 Timecraft Garage」效果觸發抽牌',
      '抽牌結果：',
    ],
  })
  assert.equal(positive.passed, true, `BS6-043 positive trace failed: ${positive.errors.join('; ')}`)
  await positivePage.close()

  const negativePage = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  negativePage.setDefaultTimeout(7000)
  await openCardRoute(negativePage, 'BS6-043', true)
  await placeStageFromHand(negativePage, 'Timecraft Garage')
  await clickByText(negativePage, /結束主要階段/)
  await clickByText(negativePage, /結束回合/)
  const negativePanel = negativePage.locator('.effect-panel')
  await negativePanel.waitFor({ state: 'visible' })
  const negativeCandidateCount = await negativePanel.locator('.effect-candidates-target button').count()
  assert.equal(negativeCandidateCount, 0, 'BS6-043 negative must have no yellow hand target')
  await clickPrimary(negativePage)
  await pageDrainUntilNoPanel(negativePage)
  const negativeTrace = await waitForTrace(negativePage)
  const negative = attestCardContractActionTrace(negativeTrace, {
    requiredCommandKinds: ['play-stage', 'resolve-ability-effect', 'resolve-draw-up-to'],
    orderedStepFragments: ['抽牌原因：「BS6-043 Timecraft Garage」效果觸發抽牌'],
  })
  assert.equal(negative.passed, true, `BS6-043 negative trace failed: ${negative.errors.join('; ')}`)
  await negativePage.close()
  return { positive, negative }
}

const runBs5109 = async (browser: Browser) => {
  const positivePage = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  positivePage.setDefaultTimeout(7000)
  await openCardRoute(
    positivePage,
    'BS5-109',
    false,
    'bs5-trap:BS5-109:met',
  )
  const trap = await selectAttackTrap(positivePage, 'Charmed Miners')
  await trap.locator('button').filter({ hasText: 'support-pay-' }).first().click({ force: true })
  await trap.getByRole('button', { name: '下一步' }).click({ force: true })
  const targetSteps = trap.locator('.trap-effect-target-step')
  assert.equal(await targetSteps.count(), 2, 'BS5-109 positive should expose two target steps')
  await targetSteps.nth(0).getByRole('button', { name: /trap-attacker/ }).click({ force: true })
  await targetSteps.nth(1).getByRole('button', { name: /opp-lv1/ }).click({ force: true })
  await trap.getByRole('button', { name: '確認發動' }).click({ force: true })
  await positivePage.waitForTimeout(220)
  const positiveTrace = await waitForTrace(positivePage)
  const positive = attestCardContractActionTrace(positiveTrace, {
    requiredCommandKinds: ['play-trap'],
    orderedStepFragments: [
      '選擇目標：trap-attacker',
      '選擇目標（第 2 段）：opp-lv1',
    ],
  })
  assert.equal(positive.passed, true, `BS5-109 positive trace failed: ${positive.errors.join('; ')}`)
  await positivePage.close()

  const negativePage = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  negativePage.setDefaultTimeout(7000)
  await openCardRoute(
    negativePage,
    'BS5-109',
    true,
    'bs5-trap:BS5-109:unmet',
  )
  const negativeTrap = await selectAttackTrap(negativePage, 'Charmed Miners')
  await negativeTrap.locator('button').filter({ hasText: 'support-pay-' }).first().click({ force: true })
  await negativeTrap.getByRole('button', { name: '下一步' }).click({ force: true })
  const negativeSteps = negativeTrap.locator('.trap-effect-target-step')
  assert.equal(await negativeSteps.count(), 1, 'BS5-109 negative should hide the conditional second target step')
  await negativeSteps.nth(0).getByRole('button', { name: /trap-attacker/ }).click({ force: true })
  await negativeTrap.getByRole('button', { name: '確認發動' }).click({ force: true })
  await negativePage.waitForTimeout(220)
  const negativeTrace = await waitForTrace(negativePage)
  const negative = attestCardContractActionTrace(negativeTrace, {
    requiredCommandKinds: ['play-trap'],
    orderedStepFragments: ['選擇目標：trap-attacker'],
  })
  assert.equal(
    negativeTrace.some((entry) => entry.steps.some((step) => step.includes('第 2 段'))),
    false,
    'BS5-109 negative must not trace the unmet conditional second target',
  )
  assert.equal(negative.passed, true, `BS5-109 negative trace failed: ${negative.errors.join('; ')}`)
  await negativePage.close()
  return { positive, negative }
}

const pageDrainUntilNoPanel = async (page: Page): Promise<void> => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const panel = page.locator('.effect-panel')
    if ((await panel.count()) === 0) return
    const primary = panel.locator('.effect-panel-primary-action')
    if ((await primary.count()) > 0 && !(await primary.isDisabled())) {
      await primary.click({ force: true })
      await page.waitForTimeout(180)
      continue
    }
    break
  }
}

const server = spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)
let browser: Browser | undefined

try {
  await waitForPreview()
  browser = await chromium.launch({ headless: true })
  const results = {
    browser: 'playwright',
    cards: {
      'BS6-036': await runBs6036(browser),
      'BS6-042': await runBs6042(browser),
      'BS6-043': await runBs6043(browser),
      'BS5-109': await runBs5109(browser),
    },
  }
  console.log(JSON.stringify(results, null, 2))
} finally {
  await browser?.close()
  server.kill()
}
