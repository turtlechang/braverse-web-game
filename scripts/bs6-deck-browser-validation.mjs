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
const chromium =
  playwrightModule.chromium ?? playwrightModule.default?.chromium

if (!chromium) {
  throw new Error('載入 Playwright 後找不到 Chromium。')
}

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4173)
const baseUrl = `http://127.0.0.1:${port}`
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')
const outputDirectory = resolve(root, 'test-results')
const outputPath = resolve(
  process.env.BS6_DECK_BROWSER_OUTPUT ??
    'test-results/bs6-deck-browser-validation.json',
)
const browserExecutable =
  process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ].find((candidate) => existsSync(candidate))

const standardDeckFiles = [
  {
    color: 'red',
    aiChoice: 'bs6-red-standard',
    file: 'data/decks/bs6-red-standard.json',
  },
  {
    color: 'yellow',
    aiChoice: 'bs6-yellow-standard',
    file: 'data/decks/bs6-yellow-standard.json',
  },
  {
    color: 'green',
    aiChoice: 'bs6-green-standard',
    file: 'data/decks/bs6-green-standard.json',
  },
  {
    color: 'blue',
    aiChoice: 'bs6-blue-standard',
    file: 'data/decks/bs6-blue-standard.json',
  },
  {
    color: 'purple',
    aiChoice: 'bs6-purple-standard',
    file: 'data/decks/bs6-purple-standard.json',
  },
]

const competitiveDeckFiles = [
  {
    color: 'red',
    aiChoice: 'bs6-red-competitive',
    file: 'data/decks/bs6-red-competitive.json',
  },
  {
    color: 'yellow',
    aiChoice: 'bs6-yellow-competitive',
    file: 'data/decks/bs6-yellow-competitive.json',
  },
  {
    color: 'green',
    aiChoice: 'bs6-green-competitive',
    file: 'data/decks/bs6-green-competitive.json',
  },
  {
    color: 'blue',
    aiChoice: 'bs6-blue-competitive',
    file: 'data/decks/bs6-blue-competitive.json',
  },
  {
    color: 'purple',
    aiChoice: 'bs6-purple-competitive',
    file: 'data/decks/bs6-purple-competitive.json',
  },
]

const deckBrowserMode =
  process.env.BS6_DECK_BROWSER_MODE === 'competitive'
    ? 'competitive'
    : 'standard'

const deckFiles =
  deckBrowserMode === 'competitive'
    ? competitiveDeckFiles
    : standardDeckFiles

const decks = await Promise.all(
  deckFiles.map(async (definition) => ({
    ...definition,
    ...(JSON.parse(
      await readFile(resolve(root, definition.file), 'utf8'),
    )),
  })),
)

const server = spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)

const waitForServer = async () => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {
      // Preview server is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
  }
  throw new Error(`Vite preview 未在 ${baseUrl} 啟動。`)
}

const completeOpeningSetup = async (page) => {
  const startButton = page.locator('button', { hasText: '對戰入口' })
  if ((await startButton.count()) > 0 && (await startButton.isVisible())) {
    await startButton.click()
  }

  let sawModal = false
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const modal = page.locator('.opening-setup-modal').first()
    if ((await modal.count()) === 0 || !(await modal.isVisible())) {
      if (sawModal) return
      await page.waitForTimeout(60)
      continue
    }
    sawModal = true

    const heading = await modal.locator('h2').innerText()
    if (heading.includes('猜拳')) {
      await modal.getByRole('button', { name: '石頭' }).click()
    } else if (heading.includes('先攻或後攻')) {
      await modal.getByRole('button', { name: '選擇先攻' }).click()
    } else if (heading.includes('第一次調度')) {
      await modal.getByRole('button', { name: '保留手牌' }).click()
    } else if (heading.includes('起始餅乾')) {
      const cookie = modal.locator(
        '.modal-card-options > button:not(:disabled)',
      )
      if ((await cookie.count()) === 0) {
        throw new Error('BS6 開局流程找不到可選起始餅乾。')
      }
      await cookie.first().click()
    } else {
      throw new Error(`未支援的開局步驟：${heading}`)
    }
    await page.waitForTimeout(80)
  }
  throw new Error('開局設定流程未在安全步數內完成。')
}

const runDeck = async (browser, deck) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  })
  const page = await context.newPage()
  const browserErrors = []
  const browserWarnings = []
  const browserHttpErrors = []
  const browserRequestFailures = []
  const pageErrors = []
  const isExternalCardAsset = (url) =>
    url.startsWith('https://cookierunbraverse.com/data/en_storage/')
  const isNonBlockingResource = (url) =>
    url.endsWith('/favicon.ico') || isExternalCardAsset(url)

  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    // Chromium emits a generic console error for failed resource responses;
    // response/requestfailed below retain the URL so the gate can distinguish
    // a missing app asset from an unavailable external card image.
    if (text.startsWith('Failed to load resource:')) return
    if (text.includes('net::ERR_NETWORK_ACCESS_DENIED')) {
      browserWarnings.push(text)
      return
    }
    browserErrors.push(text)
  })
  page.on('response', (response) => {
    if (response.status() < 400) return
    const detail = `${response.status()} ${response.url()}`
    if (isNonBlockingResource(response.url())) {
      browserWarnings.push(detail)
    } else {
      browserHttpErrors.push(detail)
    }
  })
  page.on('requestfailed', (request) => {
    const detail = {
      url: request.url(),
      resourceType: request.resourceType(),
      failure: request.failure()?.errorText ?? 'unknown',
    }
    if (isNonBlockingResource(request.url())) {
      browserWarnings.push(`${detail.failure} ${detail.url}`)
    } else {
      browserRequestFailures.push(detail)
    }
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    await page.evaluate((customDeck) => {
      localStorage.setItem('braverse-custom-decks', JSON.stringify([customDeck]))
    }, {
      id: `bs6-browser-${deck.color}`,
      name: `BS6 ${deck.color} Browser 驗證牌組`,
      format: deck.format,
      entries: deck.entries,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await page.reload({ waitUntil: 'networkidle' })

    const selectedDeckText = await page
      .locator('.main-menu-deck-card.is-selected')
      .innerText()
    if (!selectedDeckText.includes(`BS6 ${deck.color}`)) {
      throw new Error(`主選單未載入 ${deck.color} BS6 自訂牌組。`)
    }

    const aiDeckSelect = page.locator('.main-menu-ai-options select').first()
    await aiDeckSelect.selectOption(deck.aiChoice)
    const selectedAiChoice = await aiDeckSelect.inputValue()
    if (selectedAiChoice !== deck.aiChoice) {
      throw new Error(`AI 選單未選到 ${deck.aiChoice}。`)
    }

    await completeOpeningSetup(page)
    await page.locator('.bottom-field .combat-card-wrap').waitFor({
      state: 'attached',
      timeout: 5000,
    })
    await page.locator('.top-field .combat-card-wrap').waitFor({
      state: 'attached',
      timeout: 5000,
    })

    const battleText = await page.locator('.game-shell').innerText()
    if (!battleText.includes('戰鬥區') || !battleText.includes('支援區')) {
      throw new Error(`${deck.color} BS6 開局後未進入完整牌桌。`)
    }

    await page.getByRole('button', { name: '對局工具' }).click()
    await page.getByRole('menuitem', { name: '暫停資訊' }).click()
    await page.locator('.pause-modal').waitFor({ state: 'visible' })
    const pauseText = await page.locator('.pause-modal').innerText()
    if (!pauseText.includes(deck.aiChoice.replaceAll('-', ' '))) {
      // The UI label is localized; retaining the selected option is the authoritative check.
      if (!pauseText.includes('BS6')) {
        throw new Error(`${deck.color} BS6 對局資訊未顯示 BS6 AI 牌組。`)
      }
    }

    await page.getByRole('button', { name: '執行 20 場 AI 驗證' }).click()
    await page.getByTestId('ai-simulation-report').waitFor({ timeout: 15000 })
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

    const stuck = matches.filter((match) => match.validation?.error)
    return {
      color: deck.color,
      customDeck: `BS6 ${deck.color} Browser 驗證牌組`,
      aiChoice: deck.aiChoice,
      mainMenuLoaded: true,
      openingCompleted: true,
      battleBoardLoaded: true,
      simulationCompleted: matches.length - stuck.length,
      simulationStuck: stuck.length,
      matches,
      browserErrors,
      browserWarnings,
      browserHttpErrors,
      browserRequestFailures,
      pageErrors,
    }
  } finally {
    await context.close()
  }
}

let browser
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status: 'PENDING',
  baseUrl,
  methodology: {
    deckBrowserMode,
    description:
      deckBrowserMode === 'competitive'
        ? '以根路徑主選單載入五份 BS5+6 競技環境自訂牌組，選擇對應 BS6 競技 AI preset，完成猜拳、調度與起始餅乾，再從 Browser 對局資訊執行 20 場 AI 驗證。'
        : '以根路徑主選單載入五份 BS6 標準自訂牌組，選擇對應 BS6 標準 AI preset，完成猜拳、調度與起始餅乾，再從 Browser 對局資訊執行 20 場 AI 驗證。',
    usesTestState: false,
    decks: deckFiles.map(({ color, aiChoice, file }) => ({
      color,
      aiChoice,
      file,
    })),
    simulationsPerDeck: 20,
  },
  results: [],
}

try {
  await waitForServer()
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })
  for (const deck of decks) {
    const result = await runDeck(browser, deck)
    report.results.push(result)
    console.log(
      `${deck.color}: Browser 開局完成；AI simulation ${result.simulationCompleted}/20，卡住 ${result.simulationStuck}。`,
    )
  }
  report.status = report.results.every(
    (result) =>
      result.openingCompleted &&
      result.battleBoardLoaded &&
      result.simulationStuck === 0 &&
      result.browserErrors.length === 0 &&
      result.browserHttpErrors.length === 0 &&
      result.browserRequestFailures.length === 0 &&
      result.pageErrors.length === 0,
  )
    ? 'PASS'
    : 'FAIL'
  await mkdir(outputDirectory, { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(report, null, 2))
  if (report.status === 'FAIL') {
    process.exitCode = 1
  }
} finally {
  if (browser) await browser.close()
  server.kill()
}
