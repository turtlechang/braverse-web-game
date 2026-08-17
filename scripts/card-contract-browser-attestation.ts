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
