import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightRoot = process.env.PLAYWRIGHT_NODE_MODULES
const playwrightEntry = require.resolve('playwright', {
  paths: playwrightRoot ? [playwrightRoot] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium =
  playwrightModule.chromium ?? playwrightModule.default?.chromium

if (!chromium) {
  throw new Error('載入 Playwright 後找不到 Chromium。')
}
const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4173)
const baseUrl = `http://127.0.0.1:${port}`
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')
const outputDirectory = resolve(root, 'test-results')
const browserExecutable =
  process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ].find((candidate) => existsSync(candidate))
const server = spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  {
    cwd: root,
    stdio: 'ignore',
  },
)

const waitForServer = async () => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {
      // Preview server is still starting.
    }
    await new Promise((resolvePromise) =>
      setTimeout(resolvePromise, 100),
    )
  }
  throw new Error(`Vite preview 未在 ${baseUrl} 啟動。`)
}

try {
  await waitForServer()
  const browser = await chromium.launch({
    headless: true,
    ...(browserExecutable
      ? { executablePath: browserExecutable }
      : {}),
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '執行 20 場 AI 驗證' }).click()
  await page.getByTestId('ai-simulation-report').waitFor()

  const matches = []
  for (let index = 1; index <= 20; index += 1) {
    const row = page.getByTestId(`ai-simulation-match-${index}`)
    const validation = await row.getAttribute('data-validation')
    matches.push({
      match: index,
      text: (await row.innerText()).replace(/\s+/g, ' ').trim(),
      validation: validation ? JSON.parse(validation) : null,
    })
  }

  const stuckMatches = matches.filter(
    (match) => match.validation?.error,
  )
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    completed: 20 - stuckMatches.length,
    stuck: stuckMatches.length,
    matches,
  }

  await mkdir(outputDirectory, { recursive: true })
  await writeFile(
    resolve(outputDirectory, 'ai-browser-validation.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  )
  await page.screenshot({
    path: resolve(outputDirectory, 'ai-browser-validation.png'),
    fullPage: true,
  })
  await browser.close()

  console.log(JSON.stringify(report, null, 2))
  if (stuckMatches.length > 0) {
    process.exitCode = 1
  }
} finally {
  server.kill()
}
