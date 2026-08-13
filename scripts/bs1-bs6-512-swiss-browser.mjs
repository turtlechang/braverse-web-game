import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightRoot = process.env.PLAYWRIGHT_NODE_MODULES
const playwrightEntry = require.resolve('playwright', {
  paths: playwrightRoot ? [playwrightRoot] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium
if (!chromium) throw new Error('找不到 Playwright Chromium。')

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4173)
const baseUrl = `http://127.0.0.1:${port}`
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')
const inputPath = resolve(
  root,
  process.env.BS_SWISS_ROSTER_INPUT ??
    'data/decks/bs1-bs6-512-swiss-roster.json',
)
const outputPath = resolve(
  root,
  process.env.BS_SWISS_BROWSER_OUTPUT ??
    'docs/bs1-bs6-512-swiss-report.json',
)
const timeoutMs = Number(process.env.BS_SWISS_BROWSER_TIMEOUT_MS ?? 3_600_000)
const browserExecutable =
  process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ].find((candidate) => existsSync(candidate))
const headless = process.env.BRAVERSE_SWISS_HEADLESS !== 'false'
const rosterEnvelope = JSON.parse(await readFile(inputPath, 'utf8'))
const decks = Array.isArray(rosterEnvelope) ? rosterEnvelope : rosterEnvelope.decks
if (!Array.isArray(decks) || decks.length !== 512) {
  throw new Error(`Swiss roster 必須包含 512 副，實際為 ${decks?.length ?? 0} 副。`)
}

const server = spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)

const waitForServer = async () => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {
      // Preview server is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250))
  }
  throw new Error(`Vite preview 未在 ${baseUrl} 啟動。`)
}

const browserErrors = []
const browserHttpErrors = []
const browserRequestFailures = []
const pageErrors = []
let browser
let report

try {
  await waitForServer()
  browser = await chromium.launch({
    headless,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
  const page = await context.newPage()
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
      browserErrors.push(message.text())
    }
  })
  page.on('response', (response) => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) {
      browserHttpErrors.push(`${response.status()} ${response.url()}`)
    }
  })
  page.on('requestfailed', (request) => {
    if (!request.url().endsWith('/favicon.ico')) {
      browserRequestFailures.push({
        url: request.url(),
        resourceType: request.resourceType(),
        failure: request.failure()?.errorText ?? 'unknown',
      })
    }
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto(`${baseUrl}/?browser-swiss=1`, { waitUntil: 'networkidle' })
  await page.evaluate((roster) => {
    localStorage.setItem('braverse-swiss-roster-v1', JSON.stringify(roster))
    localStorage.removeItem('braverse-browser-swiss-report-v1')
  }, decks)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('start-browser-swiss').click()
  const startedAt = Date.now()
  let lastProgress = ''
  while ((await page.getByTestId('browser-swiss-report').count()) === 0) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Browser Swiss 超過 timeout ${timeoutMs}ms。`)
    }
    const progress = page.getByTestId('browser-swiss-progress')
    if (await progress.count()) {
      const nextProgress = (await progress.innerText()).replace(/\s+/g, ' ').trim()
      if (nextProgress !== lastProgress) {
        console.log(nextProgress)
        lastProgress = nextProgress
      }
    }
    await page.waitForTimeout(10_000)
  }

  const reportText = await page.getByTestId('browser-swiss-report').innerText()
  report = JSON.parse(reportText)
  report.browserEvidence = {
    browser: 'Chromium',
    executablePath: browserExecutable ?? 'Playwright bundled browser',
    headless,
    url: `${baseUrl}/?browser-swiss=1`,
    rosterInput: inputPath,
    clickedStartButton: true,
    browserErrors,
    browserHttpErrors,
    browserRequestFailures,
    pageErrors,
  }
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({
    status: report.status,
    outputPath,
    metrics: report.metrics,
    browserErrors: browserErrors.length,
    browserHttpErrors: browserHttpErrors.length,
    browserRequestFailures: browserRequestFailures.length,
    pageErrors: pageErrors.length,
  }, null, 2))
  if (report.status !== 'PASS' || browserErrors.length || browserHttpErrors.length || browserRequestFailures.length || pageErrors.length) {
    process.exitCode = 1
  }
  await context.close()
} finally {
  if (browser) await browser.close()
  server.kill()
}
