import { strict as assert } from 'node:assert'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { connect } from 'node:net'
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
if (!chromium) throw new Error('Playwright Chromium unavailable')

const appPort = Number(process.env.BRAVERSE_BS8_STAGING_APP_PORT ?? 4177)
const wsPort = Number(process.env.BRAVERSE_BS8_STAGING_WS_PORT ?? 8789)
const baseUrl = `http://127.0.0.1:${appPort}`
const wsUrl = `ws://127.0.0.1:${wsPort}`
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')
const tsxEntry = require.resolve('tsx/cli', { paths: [root] })
const browserExecutable =
  process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ].find((candidate) => existsSync(candidate))

const mainDeckEntries = [
  ['ST1-002', 4], ['ST1-003', 4], ['ST1-005', 4], ['ST1-006', 4],
  ['ST1-007', 4], ['ST1-008', 4], ['ST1-009', 4], ['ST1-010', 4],
  ['ST1-011', 4], ['ST1-012', 4], ['ST1-001', 4], ['ST1-004', 4],
  ['ST1-013', 4], ['ST1-015', 4], ['ST1-016', 2], ['ST1-020', 2],
].map(([cardNumber, count]) => ({ cardNumber, count }))

const candidateExtraDeckEntries = [
  { cardNumber: 'BS8-005', count: 4 },
  { cardNumber: 'BS8-027', count: 2 },
]

const startProcess = (entry, args, env) => {
  const child = spawn(process.execPath, [entry, ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout?.on('data', (chunk) => { output += chunk.toString() })
  child.stderr?.on('data', (chunk) => { output += chunk.toString() })
  return { child, getOutput: () => output }
}

const serverProcess = startProcess(tsxEntry, ['server/src/index.ts'], {
  WS_PORT: String(wsPort),
})
const appProcess = startProcess(
  viteEntry,
  ['--host', '127.0.0.1', '--port', String(appPort), '--strictPort'],
  { VITE_WS_URL: wsUrl },
)

const isExited = (child) => child.exitCode !== null || child.signalCode !== null

const waitForExit = (child, timeoutMs) => {
  if (isExited(child)) return Promise.resolve(true)
  return new Promise((resolvePromise) => {
    const timeout = setTimeout(() => {
      child.off('exit', onExit)
      resolvePromise(false)
    }, timeoutMs)
    const onExit = () => {
      clearTimeout(timeout)
      resolvePromise(true)
    }
    child.once('exit', onExit)
  })
}

const stopProcess = async (processInfo) => {
  if (isExited(processInfo.child)) return
  const gracefulExit = waitForExit(processInfo.child, 2_000)
  processInfo.child.kill()
  if (await gracefulExit) return
  const forcedExit = waitForExit(processInfo.child, 2_000)
  processInfo.child.kill('SIGKILL')
  if (!(await forcedExit) && !isExited(processInfo.child)) {
    throw new Error(`Unable to stop child process ${processInfo.child.pid ?? 'unknown'}`)
  }
}

const waitForPort = async (port, processInfo, label) => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (processInfo.child.exitCode !== null) {
      throw new Error(`${label} exited early:\n${processInfo.getOutput()}`)
    }
    const available = await new Promise((resolvePromise) => {
      const socket = connect({ host: '127.0.0.1', port })
      socket.once('connect', () => {
        socket.destroy()
        resolvePromise(true)
      })
      socket.once('error', () => resolvePromise(false))
    })
    if (available) return
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
  }
  throw new Error(`${label} unavailable on port ${port}:\n${processInfo.getOutput()}`)
}

const installCandidateDeck = async (context, id, name) => {
  await context.addInitScript(({ deckId, deckName, entries, extraDeckEntries }) => {
    const now = new Date().toISOString()
    localStorage.setItem('braverse-custom-decks', JSON.stringify({
      version: 1,
      decks: [{
        id: deckId,
        name: deckName,
        entries,
        candidateStaging: {
          kind: 'bs8-candidate-staging',
          extraDeckEntries,
        },
        createdAt: now,
        updatedAt: now,
      }],
    }))
  }, {
    deckId: id,
    deckName: name,
    entries: mainDeckEntries,
    extraDeckEntries: candidateExtraDeckEntries,
  })
}

const trackedPage = async (context) => {
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    if (message.location().url?.endsWith('/favicon.ico')) return
    errors.push(message.text())
  })
  return { page, errors }
}

const openOnlinePanel = async (page) => {
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  const openButton = page.locator('[data-testid="open-online-match"]')
  await openButton.waitFor({ state: 'visible' })
  await openButton.click()
  await page.locator('.online-match-panel').waitFor({ state: 'visible' })
}

const completeMulliganDecision = async (playerPage, opponentPage, nextStage) => {
  await playerPage.getByRole('button', { name: '保留手牌', exact: true }).click()

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const forcedButton = playerPage.getByRole('button', {
      name: '公開並重新抽牌',
      exact: true,
    })
    const outcome = await Promise.race([
      forcedButton
        .waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => 'forced'),
      nextStage.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'next'),
    ])
    if (outcome === 'next') return
    await forcedButton.click()
    const declineCompensation = opponentPage.getByRole('button', {
      name: '不抽取',
      exact: true,
    })
    await declineCompensation.waitFor({ state: 'visible' })
    await declineCompensation.click()
  }
  throw new Error('Opening mulligan did not resolve within 10 attempts')
}

let browser
let hostContext
let guestContext
let hostPage
let guestPage
try {
  await Promise.all([
    waitForPort(wsPort, serverProcess, 'BS8 candidate WebSocket server'),
    waitForPort(appPort, appProcess, 'BS8 candidate Vite app'),
  ])
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })
  hostContext = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  guestContext = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  await Promise.all([
    installCandidateDeck(hostContext, 'bs8-candidate-host', 'Host Candidate'),
    installCandidateDeck(guestContext, 'bs8-candidate-guest', 'Guest Candidate'),
  ])
  const host = await trackedPage(hostContext)
  const guest = await trackedPage(guestContext)
  hostPage = host.page
  guestPage = guest.page

  await Promise.all([openOnlinePanel(hostPage), openOnlinePanel(guestPage)])
  for (const page of [hostPage, guestPage]) {
    assert.match(
      (await page.locator('#deck-select option:checked').textContent()) ?? '',
      /^\[BS8 候選驗收\]/,
    )
  }
  await hostPage.locator('#online-player-name').fill('Host Candidate')
  await guestPage.locator('#online-player-name').fill('Guest Candidate')
  await hostPage.locator('.online-match-btn-primary').click()
  await hostPage
    .locator('.online-match-status-value.is-waiting-for-opponent')
    .waitFor({ state: 'visible' })
  const roomCode = (
    await hostPage.locator('.online-match-notice strong').textContent()
  )?.trim()
  assert.match(roomCode ?? '', /^[A-HJ-NP-Z2-9]{4}$/)

  await guestPage.locator('[aria-label="房號"]').fill(roomCode)
  await guestPage.locator('.online-match-btn-secondary').click()
  await Promise.all([
    hostPage.locator('.online-opening-overlay').waitFor({ state: 'visible' }),
    guestPage.locator('.online-opening-overlay').waitFor({ state: 'visible' }),
  ])

  await hostPage.getByRole('button', { name: '石頭', exact: true }).click()
  await guestPage.getByRole('button', { name: '剪刀', exact: true }).click()
  const chooseFirst = hostPage.getByRole('button', { name: '選擇先攻', exact: true })
  await chooseFirst.waitFor({ state: 'visible' })
  await chooseFirst.click()

  const hostOpeningHand = hostPage.getByTestId('online-opening-hand')
  const guestOpeningHand = guestPage.getByTestId('online-opening-hand')
  await completeMulliganDecision(
    hostPage,
    guestPage,
    guestPage.getByRole('button', { name: '保留手牌', exact: true }),
  )
  await completeMulliganDecision(
    guestPage,
    hostPage,
    hostOpeningHand.getByTestId('online-starting-cookie').first(),
  )
  await hostOpeningHand.getByTestId('online-starting-cookie').first().click()
  await guestOpeningHand.getByTestId('online-starting-cookie').first().click()
  await Promise.all([
    hostPage.locator('.table-area').waitFor({ state: 'visible' }),
    guestPage.locator('.table-area').waitFor({ state: 'visible' }),
  ])

  const ownExtraButton = hostPage.getByLabel('Host Candidate EXTRA Deck 6 張')
  await ownExtraButton.click()
  const ownExtraPopover = hostPage.getByRole('dialog', {
    name: 'Host Candidate EXTRA Deck',
  })
  await ownExtraPopover.waitFor({ state: 'visible' })
  assert.match(
    (await ownExtraPopover.textContent()) ?? '',
    /Avatar of Ruin.*Golden Cheese Cookie/s,
  )

  const opponentExtraButton = hostPage.getByLabel('Guest Candidate EXTRA Deck 6 張')
  await opponentExtraButton.click()
  const opponentExtraPopover = hostPage.getByRole('dialog', {
    name: 'Guest Candidate EXTRA Deck',
  })
  await opponentExtraPopover.waitFor({ state: 'visible' })
  const opponentExtraText = (await opponentExtraPopover.textContent()) ?? ''
  assert.match(opponentExtraText, /對手的 EXTRA Deck 內容為私密資訊。/)
  assert.doesNotMatch(opponentExtraText, /Avatar of Ruin|Golden Cheese Cookie/)

  assert.equal(host.errors.length, 0, `host errors: ${host.errors.join('; ')}`)
  assert.equal(guest.errors.length, 0, `guest errors: ${guest.errors.join('; ')}`)
  console.log(JSON.stringify({
    roomCode,
    candidateEnvironmentJoined: true,
    ownExtraCardsVisible: true,
    opponentExtraCardsMasked: true,
  }, null, 2))
} catch (error) {
  const outputDirectory = resolve(root, 'test-results')
  mkdirSync(outputDirectory, { recursive: true })
  await Promise.allSettled([
    hostPage?.screenshot({ path: resolve(outputDirectory, 'bs8-candidate-host.png'), fullPage: true }),
    guestPage?.screenshot({ path: resolve(outputDirectory, 'bs8-candidate-guest.png'), fullPage: true }),
  ])
  throw error
} finally {
  await Promise.allSettled([
    hostContext?.close(),
    guestContext?.close(),
    browser?.close(),
  ])
  await Promise.all([stopProcess(appProcess), stopProcess(serverProcess)])
}
