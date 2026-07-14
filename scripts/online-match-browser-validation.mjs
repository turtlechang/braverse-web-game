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

const appPort = Number(process.env.BRAVERSE_ONLINE_APP_PORT ?? 4176)
const wsPort = Number(process.env.BRAVERSE_ONLINE_WS_PORT ?? 8788)
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

const hasExited = (child) =>
  child.exitCode !== null || child.signalCode !== null

const waitForExit = (child, timeoutMs) => {
  if (hasExited(child)) return Promise.resolve(true)
  return new Promise((resolvePromise) => {
    const onExit = () => {
      clearTimeout(timeout)
      resolvePromise(true)
    }
    const timeout = setTimeout(() => {
      child.off('exit', onExit)
      resolvePromise(false)
    }, timeoutMs)
    child.once('exit', onExit)
  })
}

const stopProcess = async (processInfo) => {
  const { child } = processInfo
  if (hasExited(child)) return

  const gracefulExit = waitForExit(child, 2000)
  child.kill()
  if (await gracefulExit) return

  const forcedExit = waitForExit(child, 2000)
  child.kill('SIGKILL')
  if (!(await forcedExit) && !hasExited(child)) {
    throw new Error(`Unable to stop child process ${child.pid ?? 'unknown'}`)
  }
}

const waitForPortClosed = async (port, label) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const available = await new Promise((resolvePromise) => {
      const socket = connect({ host: '127.0.0.1', port })
      socket.once('connect', () => {
        socket.destroy()
        resolvePromise(true)
      })
      socket.once('error', () => resolvePromise(false))
    })
    if (!available) return
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
  }
  throw new Error(`${label} still accepts connections on port ${port}`)
}

const deckEntries = [
  ['ST1-002', 4], ['ST1-003', 4], ['ST1-005', 4], ['ST1-006', 4],
  ['ST1-007', 4], ['ST1-008', 4], ['ST1-009', 4], ['ST1-010', 4],
  ['ST1-011', 4], ['ST1-012', 4], ['ST1-001', 4], ['ST1-004', 4],
  ['ST1-013', 4], ['ST1-015', 4], ['ST1-016', 2], ['ST1-020', 2],
].map(([cardNumber, count]) => ({ cardNumber, count }))

const installDeck = async (context, id, name) => {
  await context.addInitScript(({ deckId, deckName, entries }) => {
    const now = new Date().toISOString()
    localStorage.setItem('braverse-custom-decks', JSON.stringify({
      version: 1,
      decks: [{
        id: deckId,
        name: deckName,
        entries,
        createdAt: now,
        updatedAt: now,
      }],
    }))
  }, { deckId: id, deckName: name, entries: deckEntries })
}

const trackApplicationSockets = async (context) => {
  await context.addInitScript(() => {
    const NativeWebSocket = window.WebSocket
    const sockets = []
    window.__braverseTestSockets = sockets
    window.WebSocket = class TrackingWebSocket extends NativeWebSocket {
      constructor(...args) {
        super(...args)
        sockets.push(this)
      }
    }
  })
}

const trackedPage = async (context) => {
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const location = message.location()
    if (location.url?.endsWith('/favicon.ico')) return
    if (message.text().includes('net::ERR_NETWORK_ACCESS_DENIED')) return
    errors.push(message.text())
  })
  return { page, errors }
}

const openOnlinePanel = async (page) => {
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  const openButton = page.locator('[data-testid="open-online-match"]')
  await openButton.waitFor({ state: 'visible' })
  assert.equal(await openButton.isEnabled(), true)
  await openButton.click()
  await page.locator('.online-match-panel').waitFor({ state: 'visible' })
}

let browser
let hostContext
let guestContext
let failureContext
let hostPage
let guestPage
let failurePage
try {
  await Promise.all([
    waitForPort(wsPort, serverProcess, 'WebSocket server'),
    waitForPort(appPort, appProcess, 'Vite app'),
  ])
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })
  hostContext = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  guestContext = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  await installDeck(hostContext, 'host-browser-deck', 'Host Browser Deck')
  await installDeck(guestContext, 'guest-browser-deck', 'Guest Browser Deck')
  await trackApplicationSockets(guestContext)
  const host = await trackedPage(hostContext)
  const guest = await trackedPage(guestContext)
  hostPage = host.page
  guestPage = guest.page

  await Promise.all([openOnlinePanel(hostPage), openOnlinePanel(guestPage)])
  await hostPage.locator('.online-match-btn-primary').click()
  const waitingStatus = hostPage.locator(
    '.online-match-status-value.is-waiting-for-opponent',
  )
  await waitingStatus.waitFor({ state: 'visible' })
  const roomCode = (
    await hostPage.locator('.online-match-notice strong').textContent()
  )?.trim()
  assert.match(roomCode ?? '', /^[A-HJ-NP-Z2-9]{4}$/)

  await guestPage.locator('.online-match-input').fill(roomCode)
  await guestPage.locator('.online-match-btn-secondary').click()
  await Promise.all([
    hostPage.locator('.online-setup').waitFor({ state: 'visible' }),
    guestPage.locator('.online-setup').waitFor({ state: 'visible' }),
  ])
  assert.match((await hostPage.locator('.online-setup').textContent()) ?? '', new RegExp(roomCode))
  const hostOpeningHand = hostPage.getByTestId('online-opening-hand')
  const guestOpeningHand = guestPage.getByTestId('online-opening-hand')
  assert.ok(await hostOpeningHand.getByTestId('online-opening-card').count() > 0)
  assert.ok(await guestOpeningHand.getByTestId('online-opening-card').count() > 0)

  await hostPage.getByRole('button', { name: '保留手牌', exact: true }).click()
  await guestPage.getByRole('button', { name: '保留手牌', exact: true }).click()
  await Promise.all([
    hostPage.getByText('請選擇一張起始餅乾：', { exact: true }).waitFor(),
    guestPage.getByText('請選擇一張起始餅乾：', { exact: true }).waitFor(),
  ])
  assert.ok(await hostOpeningHand.getByTestId('online-starting-cookie').count() > 0)
  assert.ok(await guestOpeningHand.getByTestId('online-starting-cookie').count() > 0)
  await hostOpeningHand.getByTestId('online-starting-cookie').first().click()
  await guestOpeningHand.getByTestId('online-starting-cookie').first().click()

  await Promise.all([
    hostPage.locator('.table-area').waitFor({ state: 'visible' }),
    guestPage.locator('.table-area').waitFor({ state: 'visible' }),
  ])
  const hostActivityToggle = hostPage.getByTestId('online-activity-toggle')
  const guestActivityToggle = guestPage.getByTestId('online-activity-toggle')
  await Promise.all([
    hostActivityToggle.waitFor({ state: 'visible' }),
    guestActivityToggle.waitFor({ state: 'visible' }),
  ])
  await hostActivityToggle.click()
  const hostActivityFeed = hostPage.getByTestId('online-activity-feed')
  await hostActivityFeed.waitFor({ state: 'visible' })
  assert.ok((await hostActivityFeed.locator('li').count()) > 0)
  await hostActivityToggle.click()
  await hostActivityFeed.waitFor({ state: 'hidden' })
  await hostPage.waitForFunction(() => {
    const button = document.querySelector('.next-phase-button')
    const phase = document.querySelector('.phase-rail li.is-current strong')
    return button instanceof HTMLButtonElement && !button.disabled &&
      phase?.textContent?.includes('支援階段')
  })
  await guestPage.waitForFunction(() =>
    document.querySelector('.phase-rail li.is-current strong')?.textContent
      ?.includes('支援階段'),
  )
  const hostTurn = (await hostPage.locator('.turn-counter').textContent())?.trim()
  const guestTurn = (await guestPage.locator('.turn-counter').textContent())?.trim()
  assert.equal(hostTurn, guestTurn)

  await hostPage.locator('.next-phase-button').click()
  await Promise.all([
    hostPage.waitForFunction(() =>
      document.querySelector('.phase-rail li.is-current strong')?.textContent
        ?.includes('主要階段'),
    ),
    guestPage.waitForFunction(() =>
      document.querySelector('.phase-rail li.is-current strong')?.textContent
        ?.includes('主要階段'),
    ),
  ])
  const hostPhase = (
    await hostPage.locator('.phase-rail li.is-current strong').textContent()
  )?.trim()
  const guestPhase = (
    await guestPage.locator('.phase-rail li.is-current strong').textContent()
  )?.trim()
  assert.equal(hostPhase, '主要階段')
  assert.equal(guestPhase, hostPhase)

  const hostHandCard = hostPage.locator('.bottom-hand .hand-card').first()
  await hostHandCard.click()
  const detailButton = hostPage.locator('.hand-card-detail').first()
  await detailButton.waitFor({ state: 'visible' })
  await detailButton.click()
  const detailModal = hostPage.locator('.card-detail-modal')
  await detailModal.waitFor({ state: 'visible' })
  await detailModal.locator('.close-modal').click()
  await detailModal.waitFor({ state: 'hidden' })

  const hostPhaseButton = hostPage.locator('.next-phase-button')
  assert.equal(await hostPhaseButton.isEnabled(), true)
  await hostPhaseButton.click()
  await Promise.all([
    hostPage.waitForFunction(() =>
      document.querySelector('.phase-rail li.is-current strong')?.textContent
        ?.includes('結束階段'),
    ),
    guestPage.waitForFunction(() =>
      document.querySelector('.phase-rail li.is-current strong')?.textContent
        ?.includes('結束階段'),
    ),
  ])

  // 對手回合的下一階段按鈕在 UI 層已停用；直接透過應用程式自身的 socket
  // 送出同一個非法請求，驗證伺服器仍會拒絕不受信任的 WebSocket payload。
  const invalidCommandSent = await guestPage.evaluate(() => {
    const socket = window.__braverseTestSockets?.at(-1)
    if (!socket || socket.readyState !== WebSocket.OPEN) return false
    socket.send(JSON.stringify({
      type: 'submit-command',
      command: { kind: 'advance-phase', playerId: 'player-two' },
    }))
    return true
  })
  assert.equal(invalidCommandSent, true)
  const rejectionToast = guestPage.locator('.status-toast')
  await guestPage.waitForFunction(() =>
    document.querySelector('.status-toast')?.textContent?.includes('不是目前的回合玩家'),
  )
  assert.match(
    (await rejectionToast.textContent()) ?? '',
    /不是目前的回合玩家/,
  )

  await guestContext.close()
  guestContext = null
  const disconnectNotice = hostPage.locator('.online-match-notice')
  await disconnectNotice.waitFor({ state: 'visible' })
  assert.match((await disconnectNotice.textContent()) ?? '', /對手已離線/)
  assert.equal(host.errors.length, 0, `host errors: ${host.errors.join('; ')}`)
  assert.equal(guest.errors.length, 0, `guest errors: ${guest.errors.join('; ')}`)

  await hostContext.close()
  hostContext = null
  await stopProcess(serverProcess)
  await waitForPortClosed(wsPort, 'WebSocket server')

  failureContext = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  await installDeck(failureContext, 'failure-browser-deck', 'Failure Browser Deck')
  const failure = await trackedPage(failureContext)
  failurePage = failure.page
  await openOnlinePanel(failurePage)
  await failurePage.locator('.online-match-btn-primary').click()

  const failureStatus = failurePage.locator(
    '.online-match-status-value.is-error',
  )
  await failureStatus.waitFor({ state: 'visible' })
  const failureAlert = failurePage.getByRole('alert')
  await failureAlert.waitFor({ state: 'visible' })
  assert.ok((await failureAlert.textContent())?.trim())

  const unexpectedFailureErrors = failure.errors.filter((message) => !(
    message.includes(wsUrl) &&
    message.includes('WebSocket connection') &&
    message.includes('failed')
  ))
  assert.equal(
    unexpectedFailureErrors.length,
    0,
    `failure-path errors: ${unexpectedFailureErrors.join('; ')}`,
  )

  const returnButton = failurePage.locator(
    '.online-match-actions .online-match-btn-primary',
  )
  await returnButton.waitFor({ state: 'visible' })
  await returnButton.click()
  await failurePage.locator('.online-match-panel').waitFor({ state: 'hidden' })

  console.log(JSON.stringify({
    roomCode,
    setupCompleted: true,
    synchronizedPhase: 'main',
    synchronizedTurn: hostTurn,
    openingHandVisible: true,
    activityFeedbackVisible: true,
    cardDetailClosable: true,
    commandRejectionVisible: true,
    disconnectHandled: true,
    connectionFailureHandled: true,
  }, null, 2))
} catch (error) {
  const outputDirectory = resolve(root, 'test-results')
  mkdirSync(outputDirectory, { recursive: true })
  await Promise.allSettled([
    hostPage?.screenshot({ path: resolve(outputDirectory, 'online-match-host.png'), fullPage: true }),
    guestPage?.screenshot({ path: resolve(outputDirectory, 'online-match-guest.png'), fullPage: true }),
    failurePage?.screenshot({ path: resolve(outputDirectory, 'online-match-failure.png'), fullPage: true }),
  ])
  throw error
} finally {
  await Promise.allSettled([
    hostContext?.close(),
    guestContext?.close(),
    failureContext?.close(),
    browser?.close(),
  ])
  await Promise.all([stopProcess(appProcess), stopProcess(serverProcess)])
}
