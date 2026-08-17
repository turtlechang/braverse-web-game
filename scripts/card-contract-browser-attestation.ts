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

  // Drain any response/faint/FLIP modal first; these routes are intentionally
  // positioned at different phases depending on the card type.
  for (let round = 0; round < 3; round += 1) {
    const response = page.locator('.battle-response-modal').filter({ hasText: /是否發動|是否使用|回應/ })
    const skip = response.getByRole('button', { name: /略過|不發動/ })
    if ((await skip.count()) > 0) {
      await skip.first().click({ force: true }).catch(() => {})
      await page.waitForTimeout(120)
      continue
    }
    const faint = page.locator('.faint-response-modal')
    const faintSkip = faint.getByRole('button', { name: /略過|不發動|確認/ })
    if ((await faintSkip.count()) > 0) {
      await faintSkip.first().click({ force: true }).catch(() => {})
      await page.waitForTimeout(120)
      continue
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

  if ((await page.locator('.effect-panel').count()) > 0) {
    await drainGenericEffectPanel(page)
  } else {
    const skillButton = page.locator('.bottom-field .skill-action').first()
    if ((await skillButton.count()) > 0 && !(await skillButton.isDisabled().catch(() => true))) {
      await skillButton.click({ force: true }).catch(() => {})
      await page.waitForTimeout(180)
      await drainGenericEffectPanel(page)
    } else {
      const hand = page.locator('.bottom-hand .hand-card-wrap').first()
      if ((await hand.count()) > 0) {
        await hand.locator('.hand-card').click({ force: true }).catch(() => {})
        await page.waitForTimeout(100)
        const action = hand.locator('.hand-card-action').first()
        if ((await action.count()) > 0 && !(await action.isDisabled().catch(() => true))) {
          await action.click({ force: true }).catch(() => {})
          await page.waitForTimeout(180)
          await drainGenericEffectPanel(page)
        }
      }
    }
  }

  const trace = await readTrace(page)
  const attestation = attestCardContractActionTrace(trace, {
    requiredCommandKinds: trace.length > 0 ? [trace[0].commandKind] : [],
  })
  return {
    cardId,
    traceCardId,
    passed: attestation.passed,
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
