import assert from 'node:assert/strict'
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
