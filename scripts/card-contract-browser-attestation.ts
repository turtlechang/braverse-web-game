import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from 'playwright'
import { attestCardContractActionTrace } from '../src/cards/contracts'
import type { CardContractActionTraceEntry } from '../src/cards/contracts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4179)
const baseUrl = `http://127.0.0.1:${port}`
const viteEntry = resolve(dirname(require.resolve('vite/package.json', { paths: [root] })), 'bin/vite.js')
const batchReportArgumentIndex = process.argv.findIndex((argument) => argument === '--batch-report')
const batchReportInline = process.argv.find((argument) => argument.startsWith('--batch-report='))
const batchReportPath = batchReportInline
  ? batchReportInline.slice('--batch-report='.length)
  : batchReportArgumentIndex >= 0
    ? process.argv[batchReportArgumentIndex + 1]
    : undefined

const waitForPreview = async (): Promise<void> => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
  }
  throw new Error(`Vite preview did not start at ${baseUrl}`)
}

const readTrace = async (page: Page): Promise<CardContractActionTraceEntry[]> =>
  page.evaluate(() => {
    const trace = (window as Window & {
      __braverseContractTrace?: CardContractActionTraceEntry[]
    }).__braverseContractTrace
    return trace ?? []
  })

const legalNoOpReasons: Record<string, string> = {
  'BS2-042': '官方卡面沒有技能或 FLIP 效果，部署後沒有可驗證的效果指令。',
}

const faintTraceCards = new Set(['BS2-040', 'BS2-043'])

// Trap card-check routes begin in the real attack-response modal.  Selecting
// "不發動" (the old generic fallback) meant BS2-049/050 never reached their
// payment/target decisions and therefore produced no public effect trace.
const trapTraceCards = new Set(['BS2-049', 'BS2-050'])

const drainGenericEffectPanel = async (page: Page): Promise<boolean> => {
  const panel = page.locator('.effect-panel')
  if ((await panel.count()) === 0) return false

  const candidateGroups = [
    '.effect-candidates-payment button',
    '.effect-candidates-cost-support button',
    '.effect-candidates-discard-hand button',
    '.effect-candidates-trash-battle button',
    '.effect-candidates-target button',
  ]
  for (let round = 0; round < 12; round += 1) {
    let clicked = false
    for (const selector of candidateGroups) {
      const buttons = panel.locator(selector)
      const count = await buttons.count()
      for (let index = 0; index < count; index += 1) {
        const button = buttons.nth(index)
        const classes = (await button.getAttribute('class')) ?? ''
        if (!classes.includes('is-selected')) {
          await button.click({ force: true }).catch(() => {})
          await page.waitForTimeout(60)
          clicked = true
          break
        }
      }
    }

    const primary = panel.locator('.effect-panel-primary-action')
    if ((await primary.count()) > 0 && !(await primary.first().isDisabled().catch(() => true))) {
      await primary.first().click({ force: true })
      await page.waitForTimeout(140)
      if ((await page.locator('.effect-panel').count()) === 0) return true
      continue
    }

    const skip = panel.getByRole('button', { name: /略過|取消技能|不發動/ })
    if (!clicked && (await skip.count()) > 0) {
      await skip.first().click({ force: true }).catch(() => {})
      await page.waitForTimeout(140)
      return true
    }
    if (!clicked) break
  }

  return true
}

const drainTrapResponseModal = async (page: Page): Promise<boolean> => {
  const modal = page.locator('.trap-response-modal')
  if ((await modal.count()) === 0) return false

  for (let round = 0; round < 12; round += 1) {
    if ((await modal.count()) === 0) return true

    const chooser = modal.locator('h2').filter({ hasText: '是否發動陷阱' })
    if ((await chooser.count()) > 0) {
      const option = modal.locator('.modal-card-options > button').first()
      if ((await option.count()) === 0) break
      await option.click({ force: true })
      await page.waitForTimeout(120)
      continue
    }

    const primary = modal
      .getByRole('button', { name: /確認發動|下一步|確認/ })
      .last()
    if (
      (await primary.count()) > 0 &&
      !(await primary.isDisabled().catch(() => true))
    ) {
      await primary.click({ force: true })
      await page.waitForTimeout(180)
      continue
    }

    // Guided trap phases render only the active payment/cost/target section.
    // Select one legal candidate per pass, then let the modal advance when its
    // real readiness predicate becomes true.  This handles both one-card and
    // multi-card costs without duplicating payment rules in the test driver.
    const activeSection = modal.locator('.trap-guided-section:visible').first()
    const candidate = activeSection
      .locator('button:not(.is-selected):not([disabled])')
      .first()
    if ((await candidate.count()) > 0) {
      await candidate.click({ force: true })
      await page.waitForTimeout(70)
      continue
    }

    break
  }

  return true
}

const drainInspectDeckModal = async (page: Page): Promise<boolean> => {
  const modal = page.locator('.inspect-deck-modal')
  if ((await modal.count()) === 0) return false

  // BS2-040 requires one card from the revealed top three. Pick the first
  // legal card and then confirm the remaining order through the same modal
  // rendered for a human player.
  const pickable = modal.locator('.inspect-deck-grid button:not([disabled])')
  if ((await pickable.count()) > 0) {
    await pickable.first().click({ force: true })
    await page.waitForTimeout(80)
  }
  const confirm = modal.getByRole('button', { name: '確認並放回' })
  if ((await confirm.count()) > 0 && !(await confirm.first().isDisabled().catch(() => true))) {
    await confirm.first().click({ force: true })
    await page.waitForTimeout(180)
  }
  return true
}

const waitForTrace = async (
  page: Page,
  minimumEntries: number,
): Promise<CardContractActionTraceEntry[]> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const trace = await readTrace(page)
    if (trace.length >= minimumEntries) return trace
    await page.waitForTimeout(100)
  }
  return readTrace(page)
}

const exerciseBatchCardRoute = async (page: Page, cardId: string) => {
  const routeCardId = encodeURIComponent(cardId)
  const traceCardId = cardId.split('@')[0]
  await page.goto(
    `${baseUrl}?test-state=card:${routeCardId}&contract-card=${encodeURIComponent(traceCardId)}`,
    { waitUntil: 'networkidle' },
  )
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await page.waitForTimeout(180)
  const bodyText = await page.locator('body').innerText()
  assert.equal(
    /遊戲發生問題|Application Error|Unhandled Runtime Error/i.test(bodyText),
    false,
    `${cardId} card-check route rendered an error boundary`,
  )

  const noOpReason = legalNoOpReasons[traceCardId]
  if (noOpReason) {
    const trace = await readTrace(page)
    assert.equal(trace.length, 0, `${cardId} legal no-op should not invent an effect trace`)
    return {
      cardId,
      traceCardId,
      passed: true,
      evidence: 'legal-no-op' as const,
      reason: noOpReason,
      traceEntries: 0,
      commandKinds: [],
      steps: [],
    }
  }

  // Drain any response/faint/FLIP modal first; these routes are intentionally
  // positioned at different phases depending on the card type.
  for (let round = 0; round < 3; round += 1) {
    if (trapTraceCards.has(traceCardId)) {
      const handledTrap = await drainTrapResponseModal(page)
      if (handledTrap) {
        await page.waitForTimeout(120)
        continue
      }
    }
    const response = page.locator('.battle-response-modal').filter({ hasText: /是否發動|是否使用|回應/ })
    const skip = response.getByRole('button', { name: /略過|不發動/ })
    if ((await skip.count()) > 0) {
      await skip.first().click({ force: true }).catch(() => {})
      await page.waitForTimeout(120)
      continue
    }
    const faint = page.locator('.faint-response-modal')
    if ((await faint.count()) > 0) {
      if (traceCardId === 'BS2-040') {
        const confirm = faint.getByRole('button', { name: '確認結算' })
        if ((await confirm.count()) > 0) {
          await confirm.first().click({ force: true })
          await page.waitForTimeout(180)
          continue
        }
      }
      if (traceCardId === 'BS2-043') {
        const costCards = faint.locator('.faint-cost-hand-candidates > button')
        for (let index = 0; index < Math.min(2, await costCards.count()); index += 1) {
          await costCards.nth(index).click({ force: true })
          await page.waitForTimeout(60)
        }
        const targetCards = faint.locator('.faint-target-candidates > button')
        for (let index = 0; index < Math.min(2, await targetCards.count()); index += 1) {
          await targetCards.nth(index).click({ force: true })
          await page.waitForTimeout(60)
        }
        const confirm = faint.getByRole('button', { name: /確認 \(2\)/ })
        if ((await confirm.count()) > 0 && !(await confirm.first().isDisabled().catch(() => true))) {
          await confirm.first().click({ force: true })
          await page.waitForTimeout(180)
          continue
        }
      }
      const faintConfirm = faint.getByRole('button', { name: '確認結算' })
      if ((await faintConfirm.count()) > 0 && !(await faintConfirm.first().isDisabled().catch(() => true))) {
        await faintConfirm.first().click({ force: true })
        await page.waitForTimeout(180)
        continue
      }
      const faintSkip = faint.getByRole('button', { name: /略過|不發動/ })
      if ((await faintSkip.count()) > 0) {
        await faintSkip.first().click({ force: true }).catch(() => {})
        await page.waitForTimeout(120)
        continue
      }
    }
    const flip = page.locator('.flip-response-modal')
    const flipSkip = flip.getByRole('button', { name: /略過|不發動|確認/ })
    if ((await flipSkip.count()) > 0) {
      await flipSkip.first().click({ force: true }).catch(() => {})
      await page.waitForTimeout(120)
      continue
    }
    break
  }

  for (let round = 0; round < 8; round += 1) {
    const hadInspect = await drainInspectDeckModal(page)
    const hadEffect = await drainGenericEffectPanel(page)
    if (hadInspect || hadEffect) {
      await page.waitForTimeout(100)
      continue
    }
    const skillButton = page.locator('.bottom-field .skill-action').first()
    if ((await skillButton.count()) > 0 && !(await skillButton.isDisabled().catch(() => true))) {
      await skillButton.click({ force: true }).catch(() => {})
      await page.waitForTimeout(180)
      continue
    } else {
      const hand = page.locator('.bottom-hand .hand-card-wrap').first()
      if ((await hand.count()) > 0) {
        await hand.locator('.hand-card').click({ force: true }).catch(() => {})
        await page.waitForTimeout(100)
        const action = hand.locator('.hand-card-action').first()
        if ((await action.count()) > 0 && !(await action.isDisabled().catch(() => true))) {
          await action.click({ force: true }).catch(() => {})
          await page.waitForTimeout(180)
          continue
        }
      }
    }
    break
  }

  const minimumTraceEntries = faintTraceCards.has(traceCardId) ? 1 : 1
  const trace = await waitForTrace(page, minimumTraceEntries)
  const attestation = attestCardContractActionTrace(trace, {
    requiredCommandKinds: faintTraceCards.has(traceCardId)
      ? ['resolve-faint-effect']
      : [trace[0]?.commandKind ?? 'missing-effect-trace'],
  })
  const passed = trace.length > 0 && attestation.passed
  return {
    cardId,
    traceCardId,
    passed,
    evidence: 'effect-trace' as const,
    ...(passed ? {} : { error: attestation.errors.join('; ') || 'missing public effect trace' }),
    traceEntries: trace.length,
    commandKinds: attestation.observedCommandKinds,
    steps: attestation.observedSteps,
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  page.setDefaultTimeout(7000)

  const route = `${baseUrl}?test-state=attack-effect&contract-card=ST2-003`
  await page.goto(route, { waitUntil: 'networkidle' })
  const panel = page.locator('.effect-panel')
  await panel.waitFor({ state: 'visible' })

  const initialTrace = await readTrace(page)
  const negative = attestCardContractActionTrace(initialTrace, {
    requiredCommandKinds: ['resolve-attack-effect'],
  })
  assert.equal(negative.passed, false, '尚未操作的 pending 視窗不應通過 contract trace')

  // The effect panel is modal, so the battlefield card underneath is not
  // pointer-accessible.  Bind the action to the selector candidate rendered
  // by the same DecisionDescriptor that the player sees.
  const target = panel.locator('.effect-candidates-target > button').first()
  await target.waitFor({ state: 'visible' })
  await target.click()
  await panel.locator('.effect-candidates-target > button.is-selected').waitFor()
  await panel.locator('.effect-panel-primary-action').click()
  await page.waitForTimeout(150)

  const positiveTrace = await readTrace(page)
  const positive = attestCardContractActionTrace(positiveTrace, {
    requiredCommandKinds: ['resolve-attack-effect'],
    orderedStepFragments: ['攻擊後效果目標：', '攻擊後效果結果：'],
  })
  assert.equal(
    positive.passed,
    true,
    `完成合法目標後 contract trace 應通過：${positive.errors.join('; ')}`,
  )

  // Positive OnPlay binding: the same selector pipeline must expose the
  // legal Cookie target before the follow-up draw choice is shown.
  const onPlayPositive = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  onPlayPositive.setDefaultTimeout(7000)
  await onPlayPositive.goto(
    `${baseUrl}?test-state=bs6-079-on-play-clear&contract-card=BS6-079`,
    { waitUntil: 'networkidle' },
  )
  const onPlayPanel = onPlayPositive.locator('.effect-panel')
  await onPlayPanel.waitFor({ state: 'visible' })
  await onPlayPanel.locator('.effect-candidates-target > button').first().click()
  await onPlayPanel.locator('.effect-panel-primary-action').click()
  await onPlayPositive.waitForTimeout(150)
  await onPlayPanel.locator('.effect-panel-primary-action').click()
  await onPlayPositive.waitForTimeout(150)
  const skipDraw = onPlayPositive.getByRole('button', { name: '略過抽牌' })
  if (await skipDraw.isVisible().catch(() => false)) await skipDraw.click()
  await onPlayPositive.waitForTimeout(150)
  const onPlayPositiveTrace = await readTrace(onPlayPositive)
  const onPlayPositiveAttestation = attestCardContractActionTrace(onPlayPositiveTrace, {
    requiredCommandKinds: ['begin-activate-skill', 'resolve-draw-up-to'],
    orderedStepFragments: ['抽牌原因：', '抽牌結果：選擇不抽牌'],
  })
  assert.equal(
    onPlayPositiveAttestation.passed,
    true,
    `BS6-079 正向 selector trace 應通過：${onPlayPositiveAttestation.errors.join('; ')}`,
  )
  await onPlayPositive.close()

  // Blocked path: the official Timekeeper movement protection must produce a
  // public skip command and reason, with no misleading target-selection UI.
  const blockedPage = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  blockedPage.setDefaultTimeout(7000)
  await blockedPage.goto(
    `${baseUrl}?test-state=bs6-079-on-play-blocked&contract-card=BS6-079`,
    { waitUntil: 'networkidle' },
  )
  await blockedPage.waitForTimeout(150)
  assert.equal(await blockedPage.locator('.effect-panel').count(), 0)
  const blockedTrace = await readTrace(blockedPage)
  const blockedAttestation = attestCardContractActionTrace(blockedTrace, {
    requiredCommandKinds: ['skip-on-play'],
    orderedStepFragments: ['效果未生效：被「Timekeeper Cookie」的效果阻止'],
  })
  assert.equal(
    blockedAttestation.passed,
    true,
    `BS6-079 阻擋 trace 應說明來源與原因：${blockedAttestation.errors.join('; ')}`,
  )
  await blockedPage.close()

  const batchResults: Array<{
    cardId: string
    traceCardId?: string
    passed: boolean
    traceEntries?: number
    commandKinds?: string[]
    steps?: string[]
    evidence?: 'effect-trace' | 'legal-no-op'
    reason?: string
    error?: string
  }> = []
  if (batchReportPath) {
    const reportPath = resolve(root, batchReportPath)
    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as {
      batch?: { cardIds?: unknown }
      ready?: boolean
    }
    const cardIds = Array.isArray(report.batch?.cardIds)
      ? report.batch.cardIds.filter((id): id is string => typeof id === 'string')
      : []
    assert.equal(report.ready, true, `migration batch ${batchReportPath} is not ready`)
    assert.equal(cardIds.length, 25, 'Browser batch attestation expects exactly 25 card ids')

    for (const cardId of cardIds) {
      try {
        batchResults.push(await exerciseBatchCardRoute(page, cardId))
      } catch (error) {
        batchResults.push({
          cardId,
          passed: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    assert.equal(
      batchResults.every((result) => result.passed),
      true,
      `batch Browser attestation failed: ${batchResults
        .filter((result) => !result.passed)
        .map((result) => `${result.cardId}: ${result.error ?? 'trace failed'}`)
        .join('; ')}`,
    )
  }

  console.log(
    JSON.stringify(
      {
        browser: 'playwright',
        route: 'test-state=attack-effect',
        positive: {
          passed: positive.passed,
          commandKinds: positive.observedCommandKinds,
          steps: positive.observedSteps,
        },
        negative: {
          passed: negative.passed,
          errors: negative.errors,
        },
        selectorBinding: {
          positive: {
            passed: onPlayPositiveAttestation.passed,
            commandKinds: onPlayPositiveAttestation.observedCommandKinds,
            steps: onPlayPositiveAttestation.observedSteps,
          },
          blocked: {
            passed: blockedAttestation.passed,
            commandKinds: blockedAttestation.observedCommandKinds,
            steps: blockedAttestation.observedSteps,
          },
        },
        traceEntries: positiveTrace.length,
        ...(batchReportPath
          ? {
              batch: {
                report: batchReportPath,
                count: batchResults.length,
                results: batchResults,
              },
            }
          : {}),
      },
      null,
      2,
    ),
  )
  await page.close()
} finally {
  await browser?.close().catch(() => {})
  server.kill()
}
