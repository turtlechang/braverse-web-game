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

const completeMulliganDecision = async (
  playerPage,
  opponentPage,
  nextStageLocator,
) => {
  await playerPage
    .getByRole('button', { name: '保留手牌', exact: true })
    .click()

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const forcedButton = playerPage.getByRole('button', {
      name: '公開並重新抽牌',
      exact: true,
    })
    const outcome = await Promise.race([
      forcedButton
        .waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => 'forced'),
      nextStageLocator
        .waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => 'next'),
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
  await Promise.all([
    trackApplicationSockets(hostContext),
    trackApplicationSockets(guestContext),
  ])
  const host = await trackedPage(hostContext)
  const guest = await trackedPage(guestContext)
  hostPage = host.page
  guestPage = guest.page

  await Promise.all([openOnlinePanel(hostPage), openOnlinePanel(guestPage)])
  await hostPage.locator('#online-player-name').fill('Host Player')
  await guestPage.locator('#online-player-name').fill('Guest Player')
  await hostPage.locator('.online-match-btn-primary').click()
  const waitingStatus = hostPage.locator(
    '.online-match-status-value.is-waiting-for-opponent',
  )
  await waitingStatus.waitFor({ state: 'visible' })
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
  await Promise.all([
    hostPage.setViewportSize({ width: 600, height: 338 }),
    guestPage.setViewportSize({ width: 600, height: 338 }),
  ])
  for (const page of [hostPage, guestPage]) {
    const openingFitsViewport = await page.evaluate(() => {
      const layer = document.querySelector('.online-opening-layer')
      if (!(layer instanceof HTMLElement)) return false
      const rect = layer.getBoundingClientRect()
      return (
        document.documentElement.scrollWidth <= window.innerWidth &&
        rect.left >= 0 &&
        rect.right <= window.innerWidth
      )
    })
    assert.equal(openingFitsViewport, true)
  }
  assert.match(
    (await hostPage.locator('.online-opening-overlay').textContent()) ?? '',
    new RegExp(roomCode),
  )

  await hostPage.getByRole('button', { name: '石頭', exact: true }).click()
  await hostPage
    .getByText('已送出選擇，等待對手完成猜拳…', { exact: true })
    .waitFor()
  assert.equal(await hostPage.getByTestId('online-rps-result').count(), 0)
  assert.equal(await guestPage.getByTestId('online-rps-result').count(), 0)
  await guestPage.getByRole('button', { name: '剪刀', exact: true }).click()

  const chooseFirstButton = hostPage.getByRole('button', {
    name: '選擇先攻',
    exact: true,
  })
  await chooseFirstButton.waitFor({ state: 'visible' })
  await guestPage
    .getByText('Host Player 正在選擇先攻或後攻…', { exact: true })
    .waitFor()
  assert.match(
    (await hostPage.getByTestId('online-rps-result').textContent()) ?? '',
    /Host Player：石頭.*你獲勝.*Guest Player：剪刀/s,
  )
  await chooseFirstButton.click()

  const hostOpeningOverlay = hostPage.locator('.online-opening-overlay')
  const guestOpeningOverlay = guestPage.locator('.online-opening-overlay')
  await Promise.all([
    hostOpeningOverlay.getByText('先攻', { exact: true }).waitFor(),
    guestOpeningOverlay.getByText('後攻', { exact: true }).waitFor(),
  ])
  const hostOpeningHand = hostPage.getByTestId('online-opening-hand')
  const guestOpeningHand = guestPage.getByTestId('online-opening-hand')
  assert.ok(await hostOpeningHand.getByTestId('online-opening-card').count() > 0)
  assert.ok(await guestOpeningHand.getByTestId('online-opening-card').count() > 0)
  assert.equal(
    await guestPage
      .getByRole('button', { name: '保留手牌', exact: true })
      .count(),
    0,
  )

  const guestKeepButton = guestPage.getByRole('button', {
    name: '保留手牌',
    exact: true,
  })
  await completeMulliganDecision(hostPage, guestPage, guestKeepButton)
  await completeMulliganDecision(
    guestPage,
    hostPage,
    hostOpeningHand.getByTestId('online-starting-cookie').first(),
  )
  assert.ok(await hostOpeningHand.getByTestId('online-starting-cookie').count() > 0)
  assert.ok(await guestOpeningHand.getByTestId('online-starting-cookie').count() > 0)
  await hostOpeningHand.getByTestId('online-starting-cookie').first().click()
  await hostPage
    .getByText('起始餅乾已覆蓋，等待對手完成選擇…', { exact: true })
    .waitFor()
  assert.ok(await guestOpeningHand.getByTestId('online-starting-cookie').count() > 0)
  await guestOpeningHand.getByTestId('online-starting-cookie').first().click()

  await Promise.all([
    hostPage.locator('.table-area').waitFor({ state: 'visible' }),
    guestPage.locator('.table-area').waitFor({ state: 'visible' }),
  ])
  await Promise.all([
    hostPage.setViewportSize({ width: 1366, height: 768 }),
    guestPage.setViewportSize({ width: 1366, height: 768 }),
  ])
  assert.match(
    (await hostPage.locator('.bottom-field .row-meta').textContent()) ?? '',
    /Host Player/,
  )
  assert.match(
    (await hostPage.locator('.top-field .row-meta').textContent()) ?? '',
    /Guest Player/,
  )
  assert.equal(
    (await hostPage.locator('.bottom-field .turn-order-badge').textContent())?.trim(),
    '先攻',
  )
  assert.equal(
    (await guestPage.locator('.bottom-field .turn-order-badge').textContent())?.trim(),
    '後攻',
  )
  assert.match(
    (await guestPage.locator('.remote-action-banner').textContent()) ?? '',
    /對手 Host Player 正在進行活躍階段/,
  )
  for (const zone of ['deck', 'stage', 'break']) {
    const resourceButton = hostPage.locator(
      `.bottom-field .${zone}-zone > .resource-summary`,
    )
    await resourceButton.click()
    await hostPage
      .locator(`.bottom-field .${zone}-zone .resource-popover`)
      .waitFor({ state: 'visible' })
    await resourceButton.click()
  }
  const hostActivityToggle = hostPage.getByTestId('online-activity-toggle')
  const guestActivityToggle = guestPage.getByTestId('online-activity-toggle')
  await Promise.all([
    hostActivityToggle.waitFor({ state: 'visible' }),
    guestActivityToggle.waitFor({ state: 'visible' }),
  ])
  await hostActivityToggle.click()
  const hostActivityFeed = hostPage.getByTestId('online-activity-feed')
  await hostActivityFeed.waitFor({ state: 'visible' })
  await hostActivityFeed.getByTestId('command-log-filters').waitFor({ state: 'visible' })
  assert.ok((await hostActivityFeed.locator('li').count()) > 0)
  await hostActivityToggle.click()
  await hostActivityFeed.waitFor({ state: 'hidden' })
  await hostPage.waitForFunction(() => {
    const button = document.querySelector('.next-phase-button')
    const phase = document.querySelector('.phase-rail .turn-indicator strong')
    return button instanceof HTMLButtonElement && !button.disabled &&
      phase?.textContent?.includes('支援階段')
  })
  await guestPage.waitForFunction(() =>
    document.querySelector('.phase-rail .turn-indicator strong')?.textContent
      ?.includes('支援階段'),
  )
  assert.match(
    (await guestPage.locator('.remote-action-banner').textContent()) ?? '',
    /對手 Host Player 正在進行支援階段/,
  )
  const hostTurn = (await hostPage.locator('.phase-rail .turn-indicator span').textContent())?.trim()
  const guestTurn = (await guestPage.locator('.phase-rail .turn-indicator span').textContent())?.trim()
  assert.equal(hostTurn, guestTurn)

  const hostSupportHandCard = hostPage.locator('.bottom-hand .hand-card').first()
  await hostSupportHandCard.click({ force: true })
  await hostPage.locator('.bottom-hand .hand-card-action', { hasText: '支援' }).click()
  await Promise.all([
    hostPage.waitForFunction(() =>
      document.querySelector('.phase-rail .turn-indicator strong')?.textContent
        ?.includes('主要階段'),
    ),
    guestPage.waitForFunction(() =>
      document.querySelector('.phase-rail .turn-indicator strong')?.textContent
        ?.includes('主要階段'),
    ),
  ])
  const hostPhase = (
    await hostPage.locator('.phase-rail .turn-indicator strong').textContent()
  )?.trim()
  const guestPhase = (
    await guestPage.locator('.phase-rail .turn-indicator strong').textContent()
  )?.trim()
  assert.equal(hostPhase, '主要階段')
  assert.equal(guestPhase, hostPhase)

  const hostHandCard = hostPage
    .locator('.bottom-hand .hand-card-wrap.is-actionable .hand-card')
    .last()
  await hostHandCard.click({ force: true })
  await hostPage.locator('.bottom-hand .hand-card-wrap.is-selected').first().waitFor()
  await hostPage.locator('.table-area').click({ position: { x: 5, y: 5 } })
  assert.equal(
    await hostPage.locator('.bottom-hand .hand-card-wrap.is-selected').count(),
    0,
  )
  await hostHandCard.click({ force: true })
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
      document.querySelector('.phase-rail .turn-indicator strong')?.textContent
        ?.includes('結束階段'),
    ),
    guestPage.waitForFunction(() =>
      document.querySelector('.phase-rail .turn-indicator strong')?.textContent
        ?.includes('結束階段'),
    ),
  ])

  await hostPhaseButton.click()
  await Promise.all([
    hostPage.waitForFunction(() =>
      document.querySelector('.phase-rail .turn-indicator strong')?.textContent
        ?.includes('支援階段'),
    ),
    guestPage.waitForFunction(() => {
      const button = document.querySelector('.next-phase-button')
      const phase = document.querySelector('.phase-rail .turn-indicator strong')
      return button instanceof HTMLButtonElement && !button.disabled &&
        phase?.textContent?.includes('支援階段')
    }),
  ])

  const guestSupportHandCard = guestPage.locator('.bottom-hand .hand-card').first()
  await guestSupportHandCard.click({ force: true })
  await guestPage.locator('.bottom-hand .hand-card-action', { hasText: '支援' }).click()
  await Promise.all([
    hostPage.waitForFunction(() =>
      document.querySelector('.phase-rail .turn-indicator strong')?.textContent
        ?.includes('主要階段'),
    ),
    guestPage.waitForFunction(() =>
      document.querySelector('.phase-rail .turn-indicator strong')?.textContent
        ?.includes('主要階段'),
    ),
  ])

  const previewIds = await guestPage.evaluate(() => {
    const socket = window.__braverseTestSockets?.at(-1)
    const attackerInstanceId = document
      .querySelector('.bottom-field .combat-card-wrap')
      ?.getAttribute('data-card-instance-id')
    const supportInstanceId = document
      .querySelector('.bottom-field .support-card-wrap')
      ?.getAttribute('data-card-instance-id')
    if (
      !socket ||
      socket.readyState !== WebSocket.OPEN ||
      !attackerInstanceId ||
      !supportInstanceId
    ) {
      return null
    }
    socket.send(JSON.stringify({
      type: 'update-attack-selection',
      selection: { attackerInstanceId, supportPaymentIds: [] },
    }))
    return { attackerInstanceId, supportInstanceId }
  })
  assert.ok(previewIds)
  await hostPage.locator('.top-field .combat-card-wrap .card-face.is-selected').waitFor()
  assert.match(
    (await hostPage.locator('.center-card-preview-label').textContent()) ?? '',
    /對手正在選擇支援卡支付攻擊費用/,
  )
  await hostPage.locator('[data-testid="attack-preview-arrow"] svg').waitFor({ state: 'visible' })
  await hostPage.locator('.card-preview-panel').waitFor({ state: 'visible' })
  await guestPage.evaluate(({ attackerInstanceId, supportInstanceId }) => {
    const socket = window.__braverseTestSockets?.at(-1)
    socket?.send(JSON.stringify({
      type: 'update-attack-selection',
      selection: {
        attackerInstanceId,
        supportPaymentIds: [supportInstanceId],
      },
    }))
  }, previewIds)
  await hostPage.locator('.top-field .support-card.is-rested.is-selected').waitFor()
  await guestPage.evaluate(() => {
    const socket = window.__braverseTestSockets?.at(-1)
    socket?.send(JSON.stringify({
      type: 'update-attack-selection',
      selection: { attackerInstanceId: null, supportPaymentIds: [] },
    }))
  })
  await hostPage
    .locator('.top-field .combat-card-wrap .card-face.is-selected')
    .waitFor({ state: 'hidden' })

  // 對手回合的下一階段按鈕在 UI 層已停用；直接透過應用程式自身的 socket
  // 送出同一個非法請求，驗證伺服器仍會拒絕不受信任的 WebSocket payload。
  const invalidCommandSent = await hostPage.evaluate(() => {
    const socket = window.__braverseTestSockets?.at(-1)
    if (!socket || socket.readyState !== WebSocket.OPEN) return false
    socket.send(JSON.stringify({
      type: 'submit-command',
      command: { kind: 'advance-phase', playerId: 'player-one' },
    }))
    return true
  })
  assert.equal(invalidCommandSent, true)
  const rejectionToast = hostPage.locator('.status-toast')
  await hostPage.waitForFunction(() =>
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
  await failurePage.locator('#online-player-name').fill('Failure Player')
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
    openingResponsive: true,
    openingHandVisible: true,
    activityFeedbackVisible: true,
    customPlayerNamesVisible: true,
    handSelectionDismissed: true,
    opponentAttackPreviewVisible: true,
    opponentAttackArrowVisible: true,
    opponentCardPreviewVisible: true,
    opponentSupportPaymentRested: true,
    onlineResourcePopoversVisible: true,
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
