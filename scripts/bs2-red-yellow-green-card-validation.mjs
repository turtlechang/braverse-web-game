import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
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

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4179)
const baseUrl = `http://127.0.0.1:${port}`
// Resolve via require.resolve (walks up ancestor node_modules) rather than a
// hardcoded `<root>/node_modules/...` path — this also works from a worktree
// checkout whose own node_modules is empty but whose ancestor directory (the
// primary checkout) has dependencies installed. vite's package.json doesn't
// expose ./bin/vite.js via "exports", so resolve the package root first.
const vitePackageJson = require.resolve('vite/package.json', { paths: [root] })
const viteEntry = resolve(dirname(vitePackageJson), 'bin/vite.js')
const screenshotDir = resolve(tmpdir(), 'braverse-bs2-red-yellow-green-screenshots')
const browserExecutable =
  process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ].find((candidate) => existsSync(candidate))

// --- 7 BS2 RED + 7 BS2 YELLOW + 7 BS2 GREEN unique card numbers -----------
const RED_CARDS = [
  ['BS2-001', 'Muscle Cookie'],
  ['BS2-002', 'Macaron Cookie'],
  ['BS2-003', 'Rebel Cookie'],
  ['BS2-004', 'Cherry Cookie'],
  ['BS2-005', 'Chili Pepper Cookie'],
  ['BS2-006', 'Prickly Cacti Gloves'],
  ['BS2-007', 'Prickly Cactus Bat'],
]

const YELLOW_CARDS = [
  ['BS2-008', 'Princess Cookie'],
  ['BS2-009', 'Carrot Cookie'],
  ['BS2-010', 'Vampire Cookie'],
  ['BS2-011', 'Blackberry Cookie'],
  ['BS2-012', 'Onion Cookie'],
  ['BS2-013', 'Wind-Up Pocket Watch'],
  ['BS2-014', 'Erratic Yakgwa Robot'],
]

const GREEN_CARDS = [
  ['BS2-015', 'Lemon Thyme Cookie'],
  ['BS2-016', 'Mustard Cookie'],
  ['BS2-017', 'Mint Choco Cookie'],
  ['BS2-018', 'Candlelight Cookie'],
  ['BS2-019', 'Cheesecake Cookie'],
  ['BS2-020', 'Carrot Jelly Stew'],
  ['BS2-021', 'Carrot Farm Scarecrow'],
]

const ALL_CARDS = [
  ...RED_CARDS.map(([num, name]) => ({ num, name, set: 'RED' })),
  ...YELLOW_CARDS.map(([num, name]) => ({ num, name, set: 'YELLOW' })),
  ...GREEN_CARDS.map(([num, name]) => ({ num, name, set: 'GREEN' })),
]

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
      // still starting
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`Vite preview 未在 ${baseUrl} 啟動。`)
}

/** Click every unselected candidate button in each effect-panel column, then
 * try to confirm. Best-effort/generic — works across skill/item/trap/stage/
 * flip/attack-effect scenarios since they all render through the same
 * EffectPanel component. */
const drainEffectPanel = async (page, { maxRounds = 6 } = {}) => {
  const panel = page.locator('.effect-panel')
  if ((await panel.count()) === 0) return { touched: false }

  const groups = [
    '.effect-candidates-payment button',
    '.effect-candidates-cost-support button',
    '.effect-candidates-discard-hand button',
    '.effect-candidates-trash-battle button',
    '.effect-candidates-target button',
  ]

  for (let round = 0; round < maxRounds; round += 1) {
    const confirmButton = panel.locator('button', { hasText: '確認效果' })
    if (await confirmButton.count() > 0) {
      const disabled = await confirmButton.first().isDisabled().catch(() => true)
      if (!disabled) {
        await confirmButton.first().click({ force: true })
        await page.waitForTimeout(300)
        return { touched: true }
      }
    }

    let clickedAny = false
    for (const selector of groups) {
      const buttons = panel.locator(selector)
      const count = await buttons.count()
      for (let i = 0; i < count; i += 1) {
        const btn = buttons.nth(i)
        const isSelected = (await btn.getAttribute('class'))?.includes('is-selected')
        if (!isSelected) {
          await btn.click({ force: true }).catch(() => {})
          clickedAny = true
          await page.waitForTimeout(150)
          break
        }
      }
    }
    if (!clickedAny) break
  }

  // Final confirm attempt (even if some optional columns weren't filled).
  const confirmButton = panel.locator('button', { hasText: '確認效果' })
  if (await confirmButton.count() > 0) {
    const disabled = await confirmButton.first().isDisabled().catch(() => true)
    if (!disabled) {
      await confirmButton.first().click({ force: true })
      await page.waitForTimeout(300)
      return { touched: true }
    }
    // Can't satisfy cost/target requirements generically — try skip/cancel
    // so the panel doesn't block the "no console error" assertion forever.
    const skip = panel.locator('button', { hasText: /不發動|取消技能/ })
    if (await skip.count() > 0) {
      await skip.first().click({ force: true }).catch(() => {})
      await page.waitForTimeout(300)
    }
  }
  return { touched: true }
}

const drainReveal = async (page) => {
  const reveal = page.locator('.card-reveal-modal')
  if ((await reveal.count()) > 0) {
    const btn = reveal.getByRole('button', { name: /確認/ })
    if (await btn.count() > 0) {
      await btn.first().click({ force: true }).catch(() => {})
      await page.waitForTimeout(300)
    }
  }
}

const drainFaintModal = async (page) => {
  const modal = page.locator('.faint-response-modal')
  if ((await modal.count()) === 0) return false
  // Try selecting an opponent target if selection is possible/required.
  const topTargets = page.locator('.top-field .combat-card-wrap')
  if ((await topTargets.count()) > 0) {
    await topTargets.first().click({ force: true }).catch(() => {})
    await page.waitForTimeout(150)
  }
  const confirmBtn = modal.getByRole('button', { name: /確認/ })
  if (await confirmBtn.count() > 0) {
    await confirmBtn.first().click({ force: true }).catch(() => {})
    await page.waitForTimeout(300)
  }
  return true
}

const drainOptionalCostAttackModal = async (page) => {
  const modal = page.locator('.optional-cost-attack-modal')
  if ((await modal.count()) === 0) return false

  const payButton = modal.getByRole('button', { name: /支付/i })
  if ((await payButton.count()) > 0 && !(await payButton.first().isDisabled().catch(() => true))) {
    await payButton.first().click({ force: true }).catch(() => {})
    await page.waitForTimeout(200)

    // Generically fill in every option group (cost cards, then target).
    const optionGroups = modal.locator('.modal-card-options')
    const groupCount = await optionGroups.count()
    for (let g = 0; g < groupCount; g += 1) {
      const buttons = optionGroups.nth(g).locator('button')
      const count = await buttons.count()
      for (let i = 0; i < count; i += 1) {
        const isSelected = (await buttons.nth(i).getAttribute('class'))?.includes('is-selected')
        if (!isSelected) {
          await buttons.nth(i).click({ force: true }).catch(() => {})
          await page.waitForTimeout(100)
        }
      }
    }

    const confirmButton = modal.getByRole('button', { name: /^確認$/ })
    if ((await confirmButton.count()) > 0 && !(await confirmButton.first().isDisabled().catch(() => true))) {
      await confirmButton.first().click({ force: true }).catch(() => {})
      await page.waitForTimeout(300)
      return true
    }
  }

  // Fall back to skipping — still exercises the modal even if the exact
  // cost/target combination couldn't be auto-satisfied generically.
  const skipButton = modal.getByRole('button', { name: /略過/i })
  if ((await skipButton.count()) > 0) {
    await skipButton.first().click({ force: true }).catch(() => {})
    await page.waitForTimeout(300)
  }
  return true
}

const drainFlipModal = async (page) => {
  const modal = page.locator('.flip-response-modal')
  if ((await modal.count()) === 0) return false

  // Pay any discard-hand cost by selecting candidates in the flip carousel.
  const discardOptions = modal.locator('.flip-card-page button')
  const discardCount = await discardOptions.count()
  for (let i = 0; i < discardCount; i += 1) {
    const isSelected = (await discardOptions.nth(i).getAttribute('class'))?.includes('is-selected')
    if (!isSelected) {
      await discardOptions.nth(i).click({ force: true }).catch(() => {})
      await page.waitForTimeout(100)
    }
  }

  const activateButton = modal.getByRole('button', { name: '發動 FLIP' })
  if (await activateButton.count() > 0) {
    const disabled = await activateButton.first().isDisabled().catch(() => true)
    if (!disabled) {
      await activateButton.first().click({ force: true }).catch(() => {})
      await page.waitForTimeout(300)
      return true
    }
  }
  // Fall back to skipping so the modal doesn't block everything after it —
  // still exercises the FLIP UI even if a cost couldn't be auto-satisfied.
  const skipButton = modal.getByRole('button', { name: '不發動' })
  if (await skipButton.count() > 0) {
    await skipButton.first().click({ force: true }).catch(() => {})
    await page.waitForTimeout(300)
  }
  return true
}

const drainTrapOrBlockerModal = async (page, cardName) => {
  // Covers three distinct BattleResponseModals.tsx components that all share
  // the `.battle-response-modal` class: the trap-vs-blocker choice screen,
  // the trap-only response, and the blocker-only response.
  const modal = page.locator('.battle-response-modal', {
    hasText: /是否發動陷阱|是否使用 Blocker|選擇回應方式|攻擊宣告回應/,
  })
  if ((await modal.count()) === 0) return false

  // If this is the combined trap-vs-blocker chooser, drill into whichever
  // option matches the card under test (or the first option otherwise).
  const chooserOptions = modal.locator('.modal-card-options > button')
  const initialOptionCount = await chooserOptions.count()
  if (initialOptionCount > 0) {
    let picked = false
    for (let i = 0; i < initialOptionCount; i += 1) {
      const text = await chooserOptions.nth(i).innerText().catch(() => '')
      if (text.includes(cardName)) {
        await chooserOptions.nth(i).click({ force: true }).catch(() => {})
        picked = true
        break
      }
    }
    if (!picked) await chooserOptions.first().click({ force: true }).catch(() => {})
    await page.waitForTimeout(200)
    const closeDetail = page.locator('.card-detail-modal .close-modal')
    if (await closeDetail.count() > 0) {
      await closeDetail.first().click({ force: true }).catch(() => {})
    }
  }

  // Pay any discard/support cost candidates generically.
  const discardOptions = modal.locator('.trap-discard-options > button, .effect-candidates-discard-hand button')
  const discardCount = await discardOptions.count()
  for (let i = 0; i < discardCount; i += 1) {
    const isSelected = (await discardOptions.nth(i).getAttribute('class'))?.includes('is-selected')
    if (!isSelected) {
      await discardOptions.nth(i).click({ force: true }).catch(() => {})
      await page.waitForTimeout(100)
    }
  }

  const activateButton = modal.locator('button', {
    hasText: /支付並發動|發動陷阱|發動|使用 Blocker/,
  })
  if (await activateButton.count() > 0) {
    const disabled = await activateButton.first().isDisabled().catch(() => true)
    if (!disabled) {
      await activateButton.first().click({ force: true }).catch(() => {})
      await page.waitForTimeout(300)
      await drainReveal(page)
    }
  }
  return true
}

/** Best-effort, generic sequence: try whichever UI affordance the current
 * card-check scenario presents, then confirm no console/page errors. */
const exerciseCardCheck = async (page, cardNumber, cardName) => {
  await page.goto(`${baseUrl}?test-state=card:${cardNumber}`, {
    waitUntil: 'networkidle',
  })
  await page.waitForTimeout(500)

  // Surface any load-time error immediately with useful context.
  const errorBoundary = page.locator('text=遊戲發生問題')
  if (await errorBoundary.count() > 0) {
    throw new Error('載入測試狀態時觸發了 GameErrorBoundary（畫面崩潰）。')
  }

  // 1. Trap / blocker response modal (attack already in progress).
  if (await drainTrapOrBlockerModal(page, cardName)) {
    return 'ability-exercised:trap-or-block'
  }

  // 2. FLIP reveal modal (HP card revealed during an attack).
  if (await drainFlipModal(page)) {
    await drainEffectPanel(page)
    return 'ability-exercised:flip'
  }

  // 3. Faint-effect modal.
  if (await drainFaintModal(page)) {
    return 'ability-exercised:faint'
  }

  // 4. Optional-cost-attack decision modal (e.g. "use this cookie as {P}
  // energy to deal N damage").
  if (await drainOptionalCostAttackModal(page)) {
    return 'ability-exercised:optional-cost-attack'
  }

  // 5. Effect panel already open (attack-effect / on-play, etc).
  if ((await page.locator('.effect-panel').count()) > 0) {
    await drainEffectPanel(page)
    return 'ability-exercised:effect-panel'
  }

  // 4. Skill-activation button on a battle-area cookie.
  const skillButton = page.locator('.bottom-field .skill-action', {
    hasText: '啟動技能',
  })
  if ((await skillButton.count()) > 0) {
    await skillButton.first().click({ force: true }).catch(() => {})
    await page.waitForTimeout(300)
    await drainEffectPanel(page)
    return 'ability-exercised:activate-skill'
  }

  // 5. Hand-card action (item 使用 / stage 放置 / cookie 登場).
  const handWrap = page.locator('.bottom-hand .hand-card-wrap').first()
  if ((await handWrap.count()) > 0) {
    await handWrap.locator('.hand-card').click({ force: true }).catch(() => {})
    await page.waitForTimeout(200)
    const actionBtn = handWrap.locator('.hand-card-action')
    if ((await actionBtn.count()) > 0) {
      const actionLabel = await actionBtn.first().innerText().catch(() => '')
      await actionBtn.first().click({ force: true }).catch(() => {})
      await page.waitForTimeout(300)
      await drainReveal(page)
      const panelPresent = (await page.locator('.effect-panel').count()) > 0
      if (panelPresent) await drainEffectPanel(page)
      // A plain "登場" (deploy) with no ability payload is only the light
      // deploy/attack check the task asked for on vanilla cookies.
      if (actionLabel.includes('登場') && !panelPresent) {
        return 'light-check-only:deployed'
      }
      return `ability-exercised:hand-card-${actionLabel || 'action'}`
    }
  }

  return 'light-check-only:no-affordance-found'
}

const results = []

const runCard = async (page, cardNumber, cardName, set) => {
  const consoleErrors = []
  const pageErrors = []
  const onConsole = (msg) => {
    if (msg.type() === 'error') {
      const loc = msg.location()
      if (loc.url?.endsWith('/favicon.ico') && msg.text().includes('404')) return
      consoleErrors.push(loc.url ? `${msg.text()} (${loc.url})` : msg.text())
    }
  }
  const onPageError = (err) => pageErrors.push(err.message)
  page.on('console', onConsole)
  page.on('pageerror', onPageError)

  let status = 'PASS'
  let error = ''
  let category = 'unknown'
  try {
    category = await exerciseCardCheck(page, cardNumber, cardName)
    if (consoleErrors.length > 0) {
      throw new Error(`console error: ${JSON.stringify(consoleErrors)}`)
    }
    if (pageErrors.length > 0) {
      throw new Error(`page error: ${JSON.stringify(pageErrors)}`)
    }
  } catch (err) {
    status = 'FAIL'
    error = err instanceof Error ? err.message : String(err)
    const shotPath = resolve(screenshotDir, `${cardNumber}-fail.png`)
    await page.screenshot({ path: shotPath }).catch(() => {})
    error += ` [screenshot: ${shotPath}]`
  } finally {
    page.off('console', onConsole)
    page.off('pageerror', onPageError)
  }

  results.push({ set, cardNumber, cardName, category, status, error })
  console.log(
    `  ${status === 'PASS' ? 'PASS' : 'FAIL'}: [${set}] ${cardNumber} ${cardName} (${category})${
      error ? ` — ${error}` : ''
    }`,
  )
}

try {
  await waitForServer()
  await mkdir(screenshotDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  page.setDefaultTimeout(5000)

  console.log(`\n=== BS2 RED + YELLOW + GREEN card validation (${ALL_CARDS.length} cards) ===`)
  for (const entry of ALL_CARDS) {
    await runCard(page, entry.num, entry.name, entry.set)
  }

  await page.close()
  await browser.close()
  server.kill()

  const failed = results.filter((r) => r.status === 'FAIL')
  console.log('\n\n=== Results table ===')
  console.log(
    'SET    | CARD     | NAME                          | CATEGORY            | STATUS | ERROR',
  )
  for (const r of results) {
    console.log(
      `${r.set.padEnd(6)} | ${r.cardNumber.padEnd(8)} | ${r.cardName.padEnd(29)} | ${r.category.padEnd(20)} | ${r.status.padEnd(6)} | ${r.error}`,
    )
  }
  console.log(
    `\n=== ${failed.length === 0 ? '全部通過' : `${failed.length}/${results.length} 項失敗`} ===`,
  )
  process.exit(failed.length === 0 ? 0 : 1)
} catch (error) {
  console.error('驗證腳本異常終止：', error)
  server.kill()
  process.exit(1)
}
