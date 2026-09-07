// Formal UI deck import -> two independent standard room clients. No test-state
// or GameState injection; socket instrumentation only observes received states.
import { strict as assert } from 'node:assert'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
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

const appPort = Number(process.env.BRAVERSE_ONLINE_APP_PORT ?? 4196)
const wsPort = Number(process.env.BRAVERSE_ONLINE_WS_PORT ?? 8796)
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

const trackApplicationSockets = async (context) => {
  await context.addInitScript(() => {
    const NativeWebSocket = window.WebSocket
    const sockets = []
    window.__braverseTestSockets = sockets
    window.WebSocket = class TrackingWebSocket extends NativeWebSocket {
      constructor(...args) {
        super(...args)
        sockets.push(this)
        this.addEventListener('message', (event) => {
          const message = JSON.parse(event.data)
          if (message.state) window.__extraReceivedState = message.state
        })
      }
    }
  })
}

const trackedPage = async (context) => {
  const page = await context.newPage()
  const errors = []
  const failedImages = []
  page.on('requestfailed', (request) => {
    if (request.resourceType() === 'image') failedImages.push({ url: request.url(), error: request.failure()?.errorText })
  })
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const location = message.location()
    if (location.url?.endsWith('/favicon.ico')) return
    if (message.text().includes('net::ERR_NETWORK_ACCESS_DENIED')) return
    errors.push(message.text())
  })
  return { page, errors, failedImages }
}

const openOnlinePanel = async (page) => {

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

const extraDeckEntries = [
  ['BS8-005', 2], ['BS8-027', 1], ['BS8-069', 1], ['BS8-090', 1], ['BS8-104', 1],
].map(([cardNumber, count]) => ({ cardNumber, count }))
const expectedIds = extraDeckEntries.flatMap(({ cardNumber, count }) => Array(count).fill(cardNumber)).sort()
const outputDir = resolve(root, 'test-results/bs8-formal-extra-online')
mkdirSync(outputDir, { recursive: true })
const importFormalDeck = async (page, name) => {
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '建立第一副牌組', exact: true }).click()
  await page.locator('.deck-editor-page-io button').nth(1).click()
  const modal = page.getByTestId('deck-editor-import-modal')
  await modal.locator('textarea').fill(JSON.stringify({ name, format: 'standard', entries: deckEntries, extraDeckEntries }))
  await modal.locator('button').last().click()
  await modal.waitFor({ state: 'hidden' })
  assert.match(await page.getByTestId('deck-editor-extra-count').innerText(), /6\s*\/\s*6/)
  await page.getByTestId('deck-editor-page-save').click()
}

let browser
const results = []
try {
  await Promise.all([
    waitForPort(wsPort, serverProcess, 'WebSocket server'),
    waitForPort(appPort, appProcess, 'Vite app'),
  ])
  browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) })
  for (const viewport of [{ width: 1907, height: 863 }, { width: 1164, height: 777 }]) {
    const contexts = await Promise.all([browser.newContext({ viewport }), browser.newContext({ viewport })])
    try {
      await Promise.all(contexts.map(trackApplicationSockets))
      const [host, guest] = await Promise.all(contexts.map(trackedPage))
      const hostPage = host.page
      const guestPage = guest.page
      await Promise.all([importFormalDeck(hostPage, 'Formal EXTRA Host'), importFormalDeck(guestPage, 'Formal EXTRA Guest')])
      await Promise.all([openOnlinePanel(hostPage), openOnlinePanel(guestPage)])
      await hostPage.locator('#online-player-name').fill('Host Player')
      await guestPage.locator('#online-player-name').fill('Guest Player')
      await hostPage.locator('.online-match-btn-primary').click()
      await hostPage.locator('.online-match-status-value.is-waiting-for-opponent').waitFor()
      const roomCode = (await hostPage.locator('.online-match-notice strong').textContent())?.trim()
      assert.match(roomCode ?? '', /^[A-HJ-NP-Z2-9]{4}$/)
      await guestPage.locator('[aria-label="房號"]').fill(roomCode)
      await guestPage.locator('.online-match-btn-secondary').click()
      await hostPage.getByRole('button', { name: '石頭', exact: true }).click()
      await guestPage.getByRole('button', { name: '剪刀', exact: true }).click()
      await hostPage.getByRole('button', { name: '選擇先攻', exact: true }).click()
      const hostHand = hostPage.getByTestId('online-opening-hand')
      const guestHand = guestPage.getByTestId('online-opening-hand')
      await completeMulliganDecision(hostPage, guestPage, guestPage.getByRole('button', { name: '保留手牌', exact: true }))
      await completeMulliganDecision(guestPage, hostPage, hostHand.getByTestId('online-starting-cookie').first())
      await hostHand.getByTestId('online-starting-cookie').first().click()
      await guestHand.getByTestId('online-starting-cookie').first().click()
      await Promise.all([hostPage.locator('.table-area').waitFor(), guestPage.locator('.table-area').waitFor()])
      const sides = []
      for (const [index, page] of [hostPage, guestPage].entries()) {
        const viewerId = index === 0 ? 'player-one' : 'player-two'
        const opponentId = index === 0 ? 'player-two' : 'player-one'
        const received = await page.evaluate(() => window.__extraReceivedState)
        assert.ok(received, 'No real server state received')
        const ownExtra = received.players[viewerId].extraDeck
        const hiddenExtra = received.players[opponentId].extraDeck
        assert.deepEqual(ownExtra.map(card => card.id).sort(), expectedIds)
        assert.equal(new Set(ownExtra.map(card => card.instanceId)).size, 6)
        assert.deepEqual(hiddenExtra, Array.from({ length: 6 }, (_, slot) => ({
          id: 'hidden-extra', instanceId: `${opponentId}-hidden-extra-${slot}`, name: '???', type: 'extra',
        })))
        const ownButton = page.locator('.bottom-field .extra-zone .resource-summary')
        await ownButton.click()
        assert.equal(await page.locator('.bottom-field .extra-deck-card-entry').count(), 6)
        await page.waitForFunction(() => {
          const images = [...document.querySelectorAll('.bottom-field .extra-deck-card-image img')]
          return images.length === 6 && images.every(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)
        }).catch(async (error) => {
          const imageState = await page.locator('.bottom-field .extra-deck-card-image').evaluateAll(nodes => nodes.map(node => node.outerHTML))
          await page.screenshot({ path: resolve(outputDir, `${viewport.width}x${viewport.height}-${viewerId}-image-failure.png`), fullPage: true })
          throw new Error(`${error.message}: ${JSON.stringify({ imageState, failedImages: index === 0 ? host.failedImages : guest.failedImages })}`)
        })
        const screenshot = `${viewport.width}x${viewport.height}-${viewerId}-own.png`
        await page.screenshot({ path: resolve(outputDir, screenshot), fullPage: true })
        await ownButton.click()
        await page.locator('.top-field .extra-zone .resource-summary').click()
        assert.match(await page.locator('.top-field .extra-deck-popover').innerText(), /內容為私密資訊/)
        assert.equal(await page.locator('.top-field .extra-deck-card-entry').count(), 0)
        await page.screenshot({ path: resolve(outputDir, `${viewport.width}x${viewport.height}-${viewerId}-opponent.png`), fullPage: true })
        sides.push({ viewerId, ownIds: ownExtra.map(card => card.id), hiddenCount: hiddenExtra.length, screenshot })
      }
      assert.deepEqual(host.errors, [])
      assert.deepEqual(guest.errors, [])
      results.push({ viewport, roomCode, status: 'PASS', sides, deckInput: 'formal editor JSON import and save via UI', stateInput: 'real standard room server only' })
      console.log(`PASS ${viewport.width}x${viewport.height}: formal EXTRA 6 vs 6, both owner panels and opponent masks`)
    } finally {
      await Promise.all(contexts.map(context => context.close()))
    }
  }
} catch (error) {
  results.push({ status: 'FAIL', error: String(error) })
  throw error
} finally {
  writeFileSync(resolve(outputDir, 'report.json'), JSON.stringify({ results }, null, 2))
  await browser?.close()
  await Promise.all([stopProcess(appProcess), stopProcess(serverProcess)])
  await Promise.all([waitForPortClosed(appPort, 'Vite app'), waitForPortClosed(wsPort, 'WebSocket server')])
}
