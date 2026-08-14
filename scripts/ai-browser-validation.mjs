import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { strict as assert } from 'node:assert'
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

const advanceEffectPanelToConfirm = async (panel) => {
  for (let step = 0; step < 3; step += 1) {
    const nextButton = panel.locator('button', { hasText: '下一步' })
    if ((await nextButton.count()) === 0) break
    assert.ok(
      !(await nextButton.first().isDisabled()),
      '目前效果步驟完成後，下一步按鈕應可使用',
    )
    await nextButton.first().click()
  }

  const confirmButton = panel.locator('button', { hasText: '確認發動' })
  await confirmButton.waitFor({ state: 'visible' })
  return confirmButton
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

  await page.evaluate(() => {
    const entries = [
      { cardNumber: 'ST1-002', count: 4 },
      { cardNumber: 'ST1-003', count: 4 },
      { cardNumber: 'ST1-005', count: 4 },
      { cardNumber: 'ST1-006', count: 4 },
      { cardNumber: 'ST1-007', count: 4 },
      { cardNumber: 'ST1-008', count: 4 },
      { cardNumber: 'ST1-009', count: 4 },
      { cardNumber: 'ST1-010', count: 4 },
      { cardNumber: 'ST1-011', count: 4 },
      { cardNumber: 'ST1-012', count: 4 },
      { cardNumber: 'ST1-001', count: 4 },
      { cardNumber: 'ST1-004', count: 4 },
      { cardNumber: 'ST1-013', count: 4 },
      { cardNumber: 'ST1-015', count: 4 },
      { cardNumber: 'ST1-016', count: 2 },
      { cardNumber: 'ST1-020', count: 2 },
    ]
    const deck = {
      id: 'test-auto-deck',
      name: '紅色起始牌組',
      entries,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem('braverse-custom-decks', JSON.stringify([deck]))
  })

  await page.reload({ waitUntil: 'networkidle' })

  const completeOpeningSetup = async () => {
    const startButton = page.locator('button', { hasText: '對戰入口' })
    if ((await startButton.count()) > 0 && (await startButton.isVisible())) {
      await startButton.click()
      await page.waitForTimeout(200)
    }

    let sawModal = false
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const modal = page.locator('.opening-setup-modal').first()
      if ((await modal.count()) === 0 || !(await modal.isVisible())) {
        if (sawModal) return
        await page.waitForTimeout(60)
        continue
      }
      sawModal = true

      const heading = await modal.locator('h2').innerText()
      if (heading.includes('選擇牌組')) {
        await modal.getByRole('button', { name: /紅色起始牌組/ }).click()
      } else if (heading.includes('猜拳')) {
        await modal.getByRole('button', { name: '石頭' }).click()
      } else if (heading.includes('先攻或後攻')) {
        await modal.getByRole('button', { name: '選擇先攻' }).click()
      } else if (heading.includes('第一次調度')) {
        await modal.getByRole('button', { name: '保留手牌' }).click()
      } else if (heading.includes('起始餅乾')) {
        await modal
          .locator('.modal-card-options > button:not(:disabled)')
          .first()
          .click()
      }
      await page.waitForTimeout(60)
    }
    throw new Error('開局設定流程未在安全步數內完成。')
  }

  const statusMessage = page.locator('.battle-status-message')

  await completeOpeningSetup()
  // The final opening-cookie click updates the match state asynchronously;
  // wait for both battle rows before collecting the responsive layout matrix.
  await page.locator('.bottom-field .combat-card-wrap').waitFor({
    state: 'attached',
    timeout: 5000,
  })
  await page.locator('.top-field .combat-card-wrap').waitFor({
    state: 'attached',
    timeout: 5000,
  })

  for (const viewport of [
    { width: 1600, height: 900 },
    { width: 1536, height: 864 },
    { width: 1536, height: 694 },
    { width: 1440, height: 960 },
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
    { width: 1024, height: 576 },
    { width: 900, height: 506 },
    { width: 798, height: 698 },
    { width: 768, height: 432 },
    { width: 625, height: 351 },
    { width: 600, height: 338 },
  ]) {
    await page.setViewportSize(viewport)
    const shortDesktopHoverProbe =
      viewport.width === 1024 && viewport.height === 576
    if (shortDesktopHoverProbe) {
      const hoverTarget = page.locator('.bottom-hand .hand-card-wrap').nth(1)
      const hoverTargetBox = await hoverTarget.boundingBox()
      if (hoverTargetBox) {
        await page.mouse.move(
          hoverTargetBox.x + hoverTargetBox.width / 2,
          hoverTargetBox.y + hoverTargetBox.height / 2,
        )
      }
    }
    const metrics = await page.evaluate(() => {
      const shell = document.querySelector('.game-shell')
      if (!(shell instanceof HTMLElement)) {
        throw new Error('找不到 game-shell')
      }
      const rect = shell.getBoundingClientRect()
      const bottomField = document.querySelector('.bottom-field')
      const bottomHand = document.querySelector('.bottom-hand')
      const topHand = document.querySelector('.top-hand')
      const bottomSupport = document.querySelector(
        '.bottom-field .support-zone',
      )
      if (
        !(bottomField instanceof HTMLElement) ||
        !(bottomHand instanceof HTMLElement) ||
        !(topHand instanceof HTMLElement) ||
        !(bottomSupport instanceof HTMLElement)
      ) {
        throw new Error('找不到玩家場地、支援區或手牌')
      }
      const bottomFieldRect = bottomField.getBoundingClientRect()
      const bottomHandRect = bottomHand.getBoundingClientRect()
      const topHandRect = topHand.getBoundingClientRect()
      const bottomSupportRect = bottomSupport.getBoundingClientRect()
      const bottomCombat = document.querySelector(
        '.bottom-field .combat-zone',
      )
      if (!(bottomCombat instanceof HTMLElement)) {
        throw new Error('找不到玩家戰鬥區')
      }
      const bottomCombatRect = bottomCombat.getBoundingClientRect()
      const topSupportCards = [
        ...document.querySelectorAll('.top-field .support-card'),
      ].map((element) => element.getBoundingClientRect())
      const bottomSupportCards = [
        ...document.querySelectorAll('.bottom-field .support-card'),
      ].map((element) => element.getBoundingClientRect())
      const topSupportZone = document.querySelector(
        '.top-field .support-zone',
      )
      const bottomCombatCard = document.querySelector(
        '.bottom-field .combat-card-wrap',
      )
      const topCombatCard = document.querySelector(
        '.top-field .combat-card-wrap',
      )
      const topRowMeta = document.querySelector('.top-field .row-meta')
      if (
        !(topSupportZone instanceof HTMLElement) ||
        !(bottomCombatCard instanceof HTMLElement) ||
        !(topCombatCard instanceof HTMLElement) ||
        !(topRowMeta instanceof HTMLElement)
      ) {
        throw new Error('找不到支援區、戰鬥卡或對手名稱牌')
      }
      const topSupportRect = topSupportZone.getBoundingClientRect()
      const bottomCombatCardRect = bottomCombatCard.getBoundingClientRect()
      const topCombatCardRect = topCombatCard.getBoundingClientRect()
      const topRowMetaRect = topRowMeta.getBoundingClientRect()
      const phaseRail = document.querySelector('.phase-rail')
      const matchToolbar = document.querySelector('.match-toolbar')
      const tableArea = document.querySelector('.table-area')
      if (
        !(phaseRail instanceof HTMLElement) ||
        !(matchToolbar instanceof HTMLElement) ||
        !(tableArea instanceof HTMLElement)
      ) {
        throw new Error('找不到階段列、對局工具列或牌桌')
      }
      const phaseRailRect = phaseRail.getBoundingClientRect()
      const matchToolbarRect = matchToolbar.getBoundingClientRect()
      const tableAreaRect = tableArea.getBoundingClientRect()
      const topField = document.querySelector('.top-field')
      if (!(topField instanceof HTMLElement)) {
        throw new Error('找不到上方場地')
      }
      const topFieldRect = topField.getBoundingClientRect()
      const majorRegions = [
        ...document.querySelectorAll(
          '.battle-row, .combat-zone, .support-zone, .break-zone, .utility-zones',
        ),
      ].map((element) => ({
        name: element.className,
        rect: element.getBoundingClientRect(),
      }))
      const handCards = [
        ...document.querySelectorAll('.hand-fan .hand-card'),
      ].map((element) => element.getBoundingClientRect())
      const battleCards = [
        ...document.querySelectorAll('.combat-card-wrap'),
      ].map((element) => element.getBoundingClientRect())
      const sideZones = [
        ...document.querySelectorAll('.break-zone, .utility-zones'),
      ].map((element) => element.getBoundingClientRect())
      const cardsOverlap = handCards.some((handCard) =>
        battleCards.some(
          (battleCard) =>
            Math.min(handCard.right, battleCard.right) >
              Math.max(handCard.left, battleCard.left) + 1 &&
            Math.min(handCard.bottom, battleCard.bottom) >
              Math.max(handCard.top, battleCard.top) + 1,
        ),
      )
      // Tolerate a small corner graze (a hand card's rounded/rotated edge
      // clipping a few px into a break/utility-zone corner box) rather than
      // any pixel of intersection; only flag an overlap that eats a
      // meaningful chunk of the side zone in both dimensions.
      const SIDE_ZONE_OVERLAP_TOLERANCE = 40
      const handOverlapsSideZone = handCards.some((handCard) =>
        sideZones.some((sideZone) => {
          const overlapWidth =
            Math.min(handCard.right, sideZone.right) -
            Math.max(handCard.left, sideZone.left)
          const overlapHeight =
            Math.min(handCard.bottom, sideZone.bottom) -
            Math.max(handCard.top, sideZone.top)
          return (
            overlapWidth > SIDE_ZONE_OVERLAP_TOLERANCE &&
            overlapHeight > SIDE_ZONE_OVERLAP_TOLERANCE
          )
        }),
      )
      const topUtilityZones = document.querySelector(
        '.top-field .utility-zones',
      )
      const bottomUtilityZones = document.querySelector(
        '.bottom-field .utility-zones',
      )
      const topUtilityRect = topUtilityZones instanceof HTMLElement
        ? topUtilityZones.getBoundingClientRect()
        : null
      const bottomUtilityRect = bottomUtilityZones instanceof HTMLElement
        ? bottomUtilityZones.getBoundingClientRect()
        : null
      const topHandOverlapsUtility = topUtilityRect
        ? handCards.some(
            (handCard) =>
              Math.min(handCard.right, topUtilityRect.right) >
                Math.max(handCard.left, topUtilityRect.left) + 1 &&
              Math.min(handCard.bottom, topUtilityRect.bottom) >
                Math.max(handCard.top, topUtilityRect.top) + 1,
          )
        : false
      const bottomHandOverlapsUtility = bottomUtilityRect
        ? handCards.some(
            (handCard) =>
              Math.min(handCard.right, bottomUtilityRect.right) >
                Math.max(handCard.left, bottomUtilityRect.left) + 1 &&
              Math.min(handCard.bottom, bottomUtilityRect.bottom) >
                Math.max(handCard.top, bottomUtilityRect.top) + 1,
          )
        : false
      const combatCardWidth =
        bottomCombatCard instanceof HTMLElement
          ? bottomCombatCard.getBoundingClientRect().width
          : 0
      const supportCardWidth =
        bottomSupportCards[0]?.width ?? topSupportCards[0]?.width ?? 0
      return {
        width: rect.width,
        height: rect.height,
        shellBottom: rect.bottom,
        bottomFieldBottom: bottomFieldRect.bottom,
        bottomHandBottom: bottomHandRect.bottom,
        bottomSupportTop: bottomSupportRect.top,
        bottomSupportBottom: bottomSupportRect.bottom,
        fieldRatio:
          bottomSupportRect.height /
          (bottomSupportRect.height + bottomCombatRect.height),
        topHandLeft: topHandRect.left,
        topHandRight: topHandRect.right,
        topHandTop: topHandRect.top,
        bottomHandLeft: bottomHandRect.left,
        bottomHandRight: bottomHandRect.right,
        combatCardWidth,
        supportCardWidthActual: supportCardWidth,
        topHandOverlapsUtility,
        bottomHandOverlapsUtility,
        topUtilityRect: topUtilityRect
          ? {
              left: topUtilityRect.left,
              right: topUtilityRect.right,
              top: topUtilityRect.top,
              bottom: topUtilityRect.bottom,
            }
          : null,
        bottomUtilityRect: bottomUtilityRect
          ? {
              left: bottomUtilityRect.left,
              right: bottomUtilityRect.right,
              top: bottomUtilityRect.top,
              bottom: bottomUtilityRect.bottom,
            }
          : null,
        supportCardWidth:
          bottomSupportCards[0]?.width ?? topSupportCards[0]?.width ?? 0,
        supportCardCount:
          bottomSupportCards.length + topSupportCards.length,
        bottomSupportStartsLeft:
          bottomSupportCards.length === 0 ||
          bottomSupportCards[0].left - bottomSupportRect.left <
            bottomSupportRect.width / 3,
        topSupportStartsRight:
          topSupportCards.length === 0 ||
          topSupportRect.right - topSupportCards[0].right <
            topSupportRect.width / 3,
        // The opponent's card keeps a little more room from the middle so its
        // HP dock remains inside the field; the player card stays on the
        // original near-center threshold.
        combatCardsNearCenter:
          topFieldRect.bottom - topCombatCardRect.bottom < 56 &&
          bottomCombatCardRect.top - bottomFieldRect.top < 40,
        // Nameplates are now corner-anchored (opponent near the field's own
        // top edge, player near its own bottom edge) rather than hugging the
        // combat card, since the P1-3b redesign moved row-meta out of the
        // combat-zone corner. Check it sits in the near half of its field
        // instead of relative to the combat card's position.
        topMetaNearFieldTop:
          topRowMetaRect.bottom - topFieldRect.top < topFieldRect.height * 0.5,
        compactHudValid:
          rect.width >= 900 ||
          (matchToolbarRect.top >= rect.top - 1 &&
            matchToolbarRect.bottom <= phaseRailRect.top + 1 &&
            phaseRailRect.bottom <= tableAreaRect.top + 1 &&
            tableAreaRect.bottom <= rect.bottom + 1),
        compactHudRects: {
          shell: { top: rect.top, bottom: rect.bottom, width: rect.width },
          phase: { top: phaseRailRect.top, bottom: phaseRailRect.bottom },
          table: { top: tableAreaRect.top, bottom: tableAreaRect.bottom },
          toolbar: {
            top: matchToolbarRect.top,
            bottom: matchToolbarRect.bottom,
          },
        },
        outsideMajorRegions: majorRegions
          .filter(
            ({ rect: region }) =>
              region.left < rect.left - 1 ||
              region.right > rect.right + 1 ||
              region.top < rect.top - 1 ||
              region.bottom > rect.bottom + 1,
          )
          .map(({ name, rect: region }) => ({
            name,
            left: region.left,
            right: region.right,
            top: region.top,
            bottom: region.bottom,
          })),
        cardsOverlap,
        cardRects: {
          hand: handCards.map(({ left, right, top, bottom }) => ({
            left,
            right,
            top,
            bottom,
          })),
          battle: battleCards.map(({ left, right, top, bottom }) => ({
            left,
            right,
            top,
            bottom,
          })),
          side: sideZones.map(({ left, right, top, bottom }) => ({
            left,
            right,
            top,
            bottom,
          })),
        },
        compactSideZonesVisible:
          rect.width >= 900 || !handOverlapsSideZone,
        bodyScrollHeight: document.body.scrollHeight,
        bodyClientHeight: document.body.clientHeight,
        documentScrollHeight: document.documentElement.scrollHeight,
        documentClientHeight: document.documentElement.clientHeight,
      }
    })
    if (shortDesktopHoverProbe) {
      await page.mouse.move(0, 0)
      await page.waitForTimeout(200)
    }
    assert.ok(
      metrics.bodyScrollHeight <= metrics.bodyClientHeight &&
        metrics.documentScrollHeight <= metrics.documentClientHeight,
      `${viewport.width}x${viewport.height} 不應出現垂直捲軸`,
    )
    assert.ok(
      metrics.bottomFieldBottom <= metrics.shellBottom + 1 &&
        metrics.bottomHandBottom <= metrics.shellBottom + 1,
      `${viewport.width}x${viewport.height} 的玩家場地與手牌必須完整位於遊戲畫布內`,
    )
    assert.ok(
      metrics.bottomSupportBottom <= metrics.shellBottom + 1,
      `${viewport.width}x${viewport.height} 的玩家支援區必須完整位於遊戲畫布內（支援區底部 ${metrics.bottomSupportBottom}、畫布底部 ${metrics.shellBottom}）`,
    )
    assert.ok(
      metrics.outsideMajorRegions.length === 0,
      `${viewport.width}x${viewport.height} 的主要遊戲區域必須全部位於 16:9 畫布內：${JSON.stringify(metrics.outsideMajorRegions)}`,
    )
    assert.ok(
      viewport.width <= 768 || !metrics.cardsOverlap,
      `${viewport.width}x${viewport.height} 的手牌不得遮蔽戰鬥卡或 HP 資訊：${JSON.stringify(metrics.cardRects)}`,
    )
    assert.ok(
      metrics.compactSideZonesVisible,
      `${viewport.width}x${viewport.height} 的手牌不得遮蔽休息區、牌庫、場景區或棄牌區：${JSON.stringify(metrics.cardRects)}`,
    )
    assert.ok(
      metrics.compactHudValid,
      `${viewport.width}x${viewport.height} 的窄版 HUD 應為頂部階段列、中央牌桌、底部工具列：${JSON.stringify(metrics.compactHudRects)}`,
    )
    // The card-size redesign shifted more of the desktop field-stack height
    // to the combat zone (support cards are deliberately smaller and don't
    // need as much room), so desktop tiers now run closer to 65/35 instead
    // of the old ~60/40; mobile tiers (<900px, deliberately left on the
    // pre-redesign layout) stay at ~45/55. This is a broad sanity bound, not
    // a precision check.
    assert.ok(
      metrics.fieldRatio >= 0.32 && metrics.fieldRatio <= 0.57,
      `${viewport.width}x${viewport.height} 的支援區佔比超出合理範圍，實際 ${metrics.fieldRatio}`,
    )
    if (metrics.supportCardCount > 0) {
      assert.ok(
        metrics.supportCardWidth >=
          (metrics.width > 900 ? 58 : metrics.height > 400 ? 38 : 24),
        `${viewport.width}x${viewport.height} 的支援卡不可過小，實際寬度 ${metrics.supportCardWidth}`,
      )
      assert.ok(
        metrics.bottomSupportStartsLeft && metrics.topSupportStartsRight,
        `${viewport.width}x${viewport.height} 的我方支援卡應由左向右、對手由右向左排列`,
      )
    }
    assert.ok(
      metrics.combatCardsNearCenter,
      `${viewport.width}x${viewport.height} 的雙方戰鬥卡應靠近中央分隔列`,
    )
    assert.ok(
      metrics.topMetaNearFieldTop,
      `${viewport.width}x${viewport.height} 的對手名稱與先後攻資訊應靠近對手場地上緣`,
    )
    if (viewport.width > 900) {
      assert.ok(
        metrics.topHandLeft + metrics.topHandRight > 0,
        `${viewport.width}x${viewport.height} 的對手手牌應位於對手場地左側`,
      )
      assert.ok(
        metrics.bottomHandRight > metrics.bottomHandLeft,
        `${viewport.width}x${viewport.height} 的玩家手牌應位於玩家場地右側`,
      )
    }
    if (viewport.width >= 1500 && viewport.height >= 850) {
      // Combat card height is now clamp(148px, 17.8vh, 158px), so it caps out
      // at a fixed ~158px-tall / ~111px-wide card rather than continuing to
      // grow with the viewport; 100px still confirms this tier renders
      // meaningfully larger than the compact (<900px) baseline tier.
      assert.ok(
        metrics.combatCardWidth >= 100,
        `${viewport.width}x${viewport.height} 的戰鬥卡尺寸應明顯放大，實際寬度 ${metrics.combatCardWidth}`,
      )
      if (metrics.supportCardCount > 0) {
        // Support cards are deliberately smaller than combat cards now
        // (clamp(88px, 11.1vh, 100px) high / ~62-70px wide) — this only
        // confirms they're not being squeezed below that intentional range.
        assert.ok(
          metrics.supportCardWidthActual >= 60,
          `${viewport.width}x${viewport.height} 的支援卡尺寸不可過小，實際寬度 ${metrics.supportCardWidthActual}`,
        )
      }
    }
    if (viewport.width === 1907 && viewport.height === 868) {
      await mkdir(outputDirectory, { recursive: true })
      await page.screenshot({
        path: resolve(outputDirectory, 'layout-1907x868.png'),
      })
    }
    if (viewport.width === 600 && viewport.height === 338) {
      await page.screenshot({
        path: resolve(outputDirectory, 'compact-600x338.png'),
      })
    }
  }
  await page.setViewportSize({ width: 1536, height: 864 })
  const playerDeckSummary = page
    .locator('.bottom-field .deck-zone .resource-summary')
  await playerDeckSummary.click()
  await page
    .locator('.bottom-field .deck-zone .resource-popover')
    .waitFor({ state: 'visible' })
  const deckPopoverBounds = await page.evaluate(() => {
    const shell = document.querySelector('.game-shell')
    const popover = document.querySelector(
      '.bottom-field .deck-zone .resource-popover',
    )
    if (!(shell instanceof HTMLElement) || !(popover instanceof HTMLElement)) {
      throw new Error('找不到遊戲畫布或牌庫浮層')
    }
    const shellRect = shell.getBoundingClientRect()
    const popoverRect = popover.getBoundingClientRect()
    return {
      shell: {
        left: shellRect.left,
        right: shellRect.right,
        top: shellRect.top,
        bottom: shellRect.bottom,
      },
      popover: {
        left: popoverRect.left,
        right: popoverRect.right,
        top: popoverRect.top,
        bottom: popoverRect.bottom,
      },
    }
  })
  assert.ok(
    deckPopoverBounds.popover.left >= deckPopoverBounds.shell.left &&
      deckPopoverBounds.popover.right <= deckPopoverBounds.shell.right &&
      deckPopoverBounds.popover.top >= deckPopoverBounds.shell.top &&
      deckPopoverBounds.popover.bottom <= deckPopoverBounds.shell.bottom,
    `資源浮層必須完整位於畫布內：${JSON.stringify(deckPopoverBounds)}`,
  )
  await page.keyboard.press('Escape')
  await page
    .locator('.bottom-field .deck-zone .resource-popover')
    .waitFor({ state: 'hidden' })
  await page.locator('.bottom-field .break-summary').click()
  await page
    .locator('.bottom-field .break-zone .resource-popover')
    .waitFor({ state: 'visible' })
  await page.keyboard.press('Escape')

  await page.setViewportSize({ width: 1440, height: 960 })
  const restedLayout = await page.evaluate(() => {
    const wrap = document.querySelector('.bottom-field .combat-card-wrap')
    const card = wrap?.querySelector('.card-face')
    const field = document.querySelector('.bottom-field')
    const combatZone = document.querySelector('.bottom-field .combat-zone')
    const supportZone = document.querySelector('.bottom-field .support-zone')
    if (
      !(wrap instanceof HTMLElement) ||
      !(card instanceof HTMLElement) ||
      !(field instanceof HTMLElement) ||
      !(combatZone instanceof HTMLElement) ||
      !(supportZone instanceof HTMLElement)
    ) {
      throw new Error('找不到戰鬥區餅乾或玩家場地')
    }
    const before = {
      wrapHeight: wrap.getBoundingClientRect().height,
      fieldHeight: field.getBoundingClientRect().height,
      combatHeight: combatZone.getBoundingClientRect().height,
      supportTop: supportZone.getBoundingClientRect().top,
      supportHeight: supportZone.getBoundingClientRect().height,
    }
    card.classList.add('is-rested')
    const after = {
      wrapHeight: wrap.getBoundingClientRect().height,
      fieldHeight: field.getBoundingClientRect().height,
      combatHeight: combatZone.getBoundingClientRect().height,
      supportTop: supportZone.getBoundingClientRect().top,
      supportHeight: supportZone.getBoundingClientRect().height,
    }
    card.classList.remove('is-rested')
    return { before, after }
  })
  assert.deepStrictEqual(
    restedLayout.after,
    restedLayout.before,
    '戰鬥區卡牌橫置不得改變卡牌容器、戰鬥區、支援區或玩家場地尺寸',
  )

  const runBreakToTrashTest = async (variant) => {
    const testUrl = `${baseUrl}?test-state=break-to-trash-${variant}`
    await page.goto(testUrl, { waitUntil: 'networkidle' })
    // Fixture routes hydrate the hand and pending OnPlay state after the
    // initial navigation. Give React one deterministic commit window before
    // selecting the first card so this validation does not race cold loads.
    await page.waitForTimeout(600)

    const handCardWrap = page.locator('.bottom-hand .hand-card-wrap').first()
    await handCardWrap.locator('.hand-card').click()

    const deployButton = handCardWrap.locator('.hand-card-action', { hasText: '登場' })
    await deployButton.waitFor({ state: 'visible' })
    await deployButton.click()
    // deploy-cookie dispatches the OnPlay prompt through a synchronous
    // command callback, but React may commit the effect panel on the next
    // turn when the page has just been navigated to a fixture route.
    await page.waitForTimeout(100)

    const effectPanel = page.locator('.effect-panel')
    await effectPanel.waitFor({ state: 'visible' })

    const supportCards = page.locator('.bottom-field .support-cards .support-card')
    const supportCount = await supportCards.count()
    assert.ok(supportCount >= 2, `測試狀態應有至少 2 張支援卡，實際 ${supportCount}`)

    const supportCard0 = supportCards.nth(0)
    const supportCard1 = supportCards.nth(1)
    await supportCard0.evaluate((el) => el.click())
    await page.waitForTimeout(100)
    await supportCard1.evaluate((el) => el.click())
    await page.waitForTimeout(100)
    assert.ok(
      await supportCards.nth(0).evaluate((el) => el.classList.contains('is-rested')),
      '選取技能付款後支援卡應立即顯示橫置預覽',
    )

    if (variant === 'lv1') {
      const breakCards = page.locator('.bottom-field .break-cards .break-card')
      const breakCount = await breakCards.count()
      assert.ok(breakCount >= 1, 'LV.1 測試應有至少 1 張休息區卡牌')

      const firstBreakCard = breakCards.first()
      const isTargetable = await firstBreakCard.evaluate(
        (el) => el.classList.contains('is-targetable'),
      )
      assert.ok(isTargetable, 'LV.1 休息區卡牌應標示為效果目標')

      await firstBreakCard.evaluate((el) => el.click())
      await page.locator('.bottom-field .break-cards .break-card.is-selected').waitFor()

      const confirmButton = await advanceEffectPanelToConfirm(effectPanel)
      await confirmButton.click()

      const statusMessage = page.locator('.battle-status-message')
      await statusMessage.filter({ hasText: /放入棄牌區/ }).waitFor()

      const discardZone = page.locator('.bottom-field .discard-zone')
      await discardZone.click()
      await page.locator('.card-pile-modal').waitFor({ state: 'visible' })
      assert.ok(
        (await page.locator('.card-pile-modal .card-pile-grid > button').count()) >= 1,
        '棄牌區清單應以卡圖顯示',
      )
      await page.locator('.card-pile-modal .close-modal').click()
    } else {
      const breakCards = page.locator('.bottom-field .break-cards .break-card')
      const breakCount = await breakCards.count()
      assert.ok(breakCount >= 1, 'LV.2 測試應有至少 1 張休息區卡牌')

      const firstBreakCard = breakCards.first()
      const isTargetable = await firstBreakCard.evaluate(
        (el) => el.classList.contains('is-targetable'),
      )
      assert.ok(!isTargetable, 'LV.2 休息區卡牌不應標示為效果目標')

      const confirmButton = await advanceEffectPanelToConfirm(effectPanel)
      await confirmButton.click()

      const statusMessage = page.locator('.battle-status-message')
      await statusMessage.filter({ hasText: /沒有選擇休息區目標/ }).waitFor()
    }

    await page.waitForTimeout(1200)
    assert.strictEqual(
      await effectPanel.count(),
      0,
      '完成效果通知應在 1 秒後淡出並移除',
    )
  }

  await runBreakToTrashTest('lv1')
  await runBreakToTrashTest('lv2')

  await page.goto(`${baseUrl}?test-state=attack-effect`, {
    waitUntil: 'networkidle',
  })
  const attackEffectPanel = page.locator('.effect-panel')
  await attackEffectPanel.waitFor({ state: 'visible' })
  const attackBreakCard = page
    .locator('.bottom-field .break-cards .break-card')
    .first()
  assert.ok(
    await attackBreakCard.evaluate((element) =>
      element.classList.contains('is-targetable'),
    ),
    'ST2-003 的 LV.1 休息區卡牌應標示為攻擊效果目標',
  )
  await attackBreakCard.evaluate((el) => el.click())
  await page.locator('.bottom-field .break-cards .break-card.is-selected').waitFor()
  const attackConfirmButton = await advanceEffectPanelToConfirm(attackEffectPanel)
  await attackConfirmButton.click()
  await page
    .locator('.battle-status-message')
    .filter({ hasText: /放入棄牌區/ })
    .waitFor()
  assert.strictEqual(
    await page.locator('.bottom-field .break-cards .break-card').count(),
    0,
    'ST2-003 結算後應將所選 LV.1 卡牌移出休息區',
  )

  const runItemUsageTest = async (payable) => {
    const variant = payable ? 'payable' : 'unpayable'
    const testUrl = `${baseUrl}?test-state=item-${variant}`
    await page.goto(testUrl, { waitUntil: 'networkidle' })

    const handCardWrap = page.locator('.bottom-hand .hand-card-wrap').first()
    await handCardWrap.locator('.hand-card').click()

    if (payable) {
      const useButton = handCardWrap.locator('.hand-card-action', { hasText: '使用' })
      await useButton.waitFor({ state: 'visible' })
      assert.ok(
        await handCardWrap.evaluate((element) =>
          element.classList.contains('is-selected'),
        ),
        '點選可用手牌後應呈現選取狀態',
      )
      await page.keyboard.press('Escape')
      await useButton.waitFor({ state: 'hidden' })
      await handCardWrap.locator('.hand-card').click()
      await useButton.waitFor({ state: 'visible' })
      await page.locator('.table-area').click({ position: { x: 4, y: 4 } })
      await useButton.waitFor({ state: 'hidden' })
      await handCardWrap.locator('.hand-card').click()
      await useButton.waitFor({ state: 'visible' })
      await useButton.click()

      const revealModal = page.locator('.card-reveal-modal')
      const hasRevealModal = await revealModal
        .waitFor({ state: 'visible', timeout: 1000 })
        .then(() => true)
        .catch(() => false)
      if (hasRevealModal) {
        await revealModal.getByRole('button', { name: /縮小/ }).click()
        const revealDock = page.locator('.card-reveal-dock')
        await revealDock.waitFor({ state: 'visible' })
        assert.ok(
          (await revealDock.innerText()).includes('效果待確認'),
          '縮小物品展示後應顯示效果待確認標籤',
        )
        await revealDock.click()
        await revealModal.getByRole('button', { name: '確認使用' }).click()
      }

      const effectPanel = page.locator('.effect-panel')
      await effectPanel.waitFor({ state: 'visible' })

      const supportCards = page.locator('.bottom-field .support-cards .support-card')
      const supportCount = await supportCards.count()
      assert.ok(supportCount >= 1, `物品測試應有至少 1 張支援卡，實際 ${supportCount}`)
      await supportCards.nth(0).evaluate((el) => el.click())
      assert.ok(
        await supportCards.nth(0).evaluate((el) => el.classList.contains('is-selected')),
        '選取物品付款後支援卡應顯示已選狀態',
      )

      const targetCookie = page.locator('.bottom-field .combat-card-wrap').first()
      const isTargetable = await targetCookie.locator('.card-face').first().evaluate(
        (el) => el.classList.contains('is-targetable'),
      )
      assert.ok(isTargetable, '戰鬥區餅乾應標示為效果目標')
      await targetCookie.locator('.card-face').first().evaluate((el) => el.click())

      const confirmButton = await advanceEffectPanelToConfirm(effectPanel)
      await confirmButton.click()

      const statusMessage = page.locator('.battle-status-message')
      await statusMessage.filter({ hasText: /攻擊傷害|受到.*傷害|傷害已結算/ }).waitFor()

      await page.waitForTimeout(1200)
      assert.strictEqual(
        await effectPanel.count(),
        0,
        '物品效果面板應在完成後移除',
      )

      const discardZone = page.locator('.bottom-field .discard-zone')
      await discardZone.click()
      await page.locator('.card-pile-modal').waitFor({ state: 'visible' })
      const discardCards = page.locator('.card-pile-modal .card-pile-grid > button')
      const discardCount = await discardCards.count()
      assert.ok(discardCount >= 1, '棄牌區應包含已使用的物品卡')
      await page.locator('.card-pile-modal .close-modal').click()
    } else {
      const useButton = handCardWrap.locator('.hand-card-action', { hasText: '使用' })
      assert.strictEqual(
        await useButton.count(),
        0,
        '非主要階段不應顯示物品使用按鈕',
      )
      const supportButton = handCardWrap.locator('.hand-card-action', { hasText: '支援' })
      await supportButton.waitFor({ state: 'visible' })

      const statusMessage = page.locator('.battle-status-message')
      const statusText = await statusMessage.innerText()
      assert.ok(
        statusText.includes('非主要階段'),
        '訊息應提示非主要階段',
      )
    }
  }

  await runItemUsageTest(true)
  await runItemUsageTest(false)

  const runStageUsageTest = async (payable) => {
    const variant = payable ? 'payable' : 'unpayable'
    const testUrl = `${baseUrl}?test-state=stage-${variant}`
    await page.goto(testUrl, { waitUntil: 'networkidle' })

    if (payable) {
      const handCardWrap = page.locator('.bottom-hand .hand-card-wrap').first()
      await handCardWrap.locator('.hand-card').click()

      const placeButton = handCardWrap.locator('.hand-card-action', { hasText: '放置' })
      await placeButton.waitFor({ state: 'visible' })
      await placeButton.click()

      const statusMessage = page.locator('.battle-status-message')
      await statusMessage.filter({ hasText: /已放置到場景區/ }).waitFor()

      await page.waitForTimeout(300)

      const discardZone = page.locator('.bottom-field .discard-zone')
      await discardZone.click()
      await page.locator('.card-pile-modal').waitFor({ state: 'visible' })
      const discardCards = page.locator('.card-pile-modal .card-pile-grid > button')
      const hasOldStage = await discardCards.filter({ hasText: /舊場景/ }).count()
      assert.ok(hasOldStage >= 1, '舊場景應移至棄牌區')
      await page.locator('.card-pile-modal .close-modal').click()
      await page.locator('.card-pile-modal').waitFor({ state: 'hidden' })

      const activateButton = page.locator('.stage-zone button', { hasText: '啟動' })
      await activateButton.waitFor({ state: 'visible' })
      await activateButton.click()

      await page.waitForTimeout(200)

      const effectPanel = page.locator('.effect-panel')
      await effectPanel.waitFor({ state: 'visible' })

      const allSupportCards = page.locator('.bottom-field .support-cards .support-card')
      const supportCount = await allSupportCards.count()
      assert.ok(supportCount >= 2, `場景測試應有至少 2 張支援卡，實際 ${supportCount}`)
      let paymentClicked = false
      for (let i = 0; i < supportCount; i += 1) {
        const supportCard = allSupportCards.nth(i)
        const isRested = await supportCard.evaluate((el) =>
          el.classList.contains('is-rested'),
        )
        if (!isRested) {
          await supportCard.evaluate((el) => el.click())
          paymentClicked = true
          break
        }
      }
      assert.ok(paymentClicked, '應有至少一張未橫置的支援卡可供付款')

      await page.waitForTimeout(100)

      const targetCookie = page.locator('.bottom-field .combat-card-wrap').first()
      const isTargetable = await targetCookie.locator('.card-face').first().evaluate(
        (el) => el.classList.contains('is-targetable'),
      )
      assert.ok(isTargetable, '場景啟動後戰鬥區餅乾應標示為效果目標')
      await targetCookie.locator('.card-face').first().evaluate((el) => el.click())

      const confirmButton = await advanceEffectPanelToConfirm(effectPanel)
      await confirmButton.click()

      await statusMessage.filter({ hasText: /攻擊傷害|受到.*傷害|傷害已結算/ }).waitFor()

      const stageCard = page.locator('.stage-zone .stage-card')
      const isRested = await stageCard.evaluate(
        (el) => el.classList.contains('is-rested'),
      )
      assert.ok(isRested, '場景卡啟動後應處於橫置狀態')

      await page.waitForTimeout(1200)
      assert.strictEqual(
        await effectPanel.count(),
        0,
        '場景效果面板應在完成後移除',
      )
    } else {
      const activateButton = page.locator('.stage-zone button', { hasText: '啟動' })
      assert.strictEqual(
        await activateButton.count(),
        0,
        '已橫置的場景不應顯示啟動按鈕',
      )

      const stageCard = page.locator('.stage-zone .stage-card')
      const isRested = await stageCard.evaluate(
        (el) => el.classList.contains('is-rested'),
      )
      assert.ok(isRested, '場景卡應處於橫置狀態')

      const statusMessage = page.locator('.battle-status-message')
      const statusText = await statusMessage.innerText()
      assert.ok(
        statusText.includes('已橫置'),
        '訊息應提示場景已橫置',
      )
    }
  }

  await runStageUsageTest(true)
  await runStageUsageTest(false)

  await page.goto(`${baseUrl}?test-state=trap-payable`, {
    waitUntil: 'networkidle',
  })
  await page.locator('.battle-response-modal').waitFor({ state: 'visible' })
  assert.strictEqual(
    await page.locator('.battle-response-modal').count(),
    1,
    '可支付陷阱應顯示回應視窗',
  )

  await page.goto(`${baseUrl}?test-state=trap-unpayable`, {
    waitUntil: 'networkidle',
  })
  await page.waitForFunction(
    () => document.querySelector('.battle-response-modal') === null,
  )
  assert.strictEqual(
    await page.locator('.battle-response-modal').count(),
    0,
    '不可支付陷阱不應顯示回應視窗',
  )
  assert.ok(
    !(await page.locator('.battle-status-message').innerText()).includes('陷阱'),
    '不可支付陷阱自動略過時不應顯示提示文字',
  )

  await page.goto(`${baseUrl}?test-state=flip-response`, {
    waitUntil: 'networkidle',
  })
  const flipModal = page.locator('.flip-response-modal')
  await flipModal.waitFor({ state: 'visible' })
  await flipModal.getByRole('button', { name: /縮小/ }).click()
  const flipDock = page.locator('.card-reveal-dock')
  await flipDock.waitFor({ state: 'visible' })
  await flipDock.click()
  await flipModal.waitFor({ state: 'visible' })
  const flipCards = flipModal.locator('.flip-card-page > button')
  const activateFlipButton = flipModal.getByRole('button', { name: '發動 FLIP' })
  assert.strictEqual(await flipCards.count(), 3, 'FLIP 每頁應顯示 3 張手牌')
  assert.ok(await activateFlipButton.isDisabled(), '未選棄牌時不可發動 FLIP')
  assert.strictEqual(
    await flipModal.locator('.flip-card-page').evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
    true,
    'FLIP 手牌選擇區不應出現水平卷軸',
  )

  await flipCards.first().click()
  assert.ok(!(await activateFlipButton.isDisabled()), '選擇 1 張手牌後應可發動')
  await flipModal.getByRole('button', { name: '下一頁手牌' }).click()
  assert.strictEqual(
    await flipModal.locator('.flip-page-indicator').innerText(),
    '2 / 2',
    '下一頁按鈕應切換到第 2 頁',
  )
  await flipModal.getByRole('button', { name: '上一頁手牌' }).click()
  assert.ok(
    await flipModal
      .locator('.flip-card-page > button')
      .first()
      .evaluate((element) => element.classList.contains('is-selected')),
    '切頁後應保留已選取的手牌',
  )
  await activateFlipButton.click()
  await flipModal.waitFor({ state: 'hidden' })

  const replacementUrl = `${baseUrl}?test-state=replacement-choice`
  await page.goto(replacementUrl, { waitUntil: 'networkidle' })
  const replacementModal = page.locator('.decision-modal')
  await replacementModal.waitFor({ state: 'visible' })
  assert.ok(
    (await replacementModal.innerText()).includes('是否要在戰鬥區放置新餅乾'),
    '補位視窗應詢問玩家是否放置餅乾',
  )
  assert.strictEqual(
    await replacementModal.getByRole('button', { name: '不補餅乾' }).count(),
    1,
    '補位視窗應提供不補餅乾按鈕',
  )
  await replacementModal
    .locator('.modal-card-options > button:not(:disabled)')
    .first()
    .click()
  await replacementModal.waitFor({ state: 'hidden' })
  assert.strictEqual(
    await page.locator('.bottom-field .combat-card-wrap').count(),
    2,
    '選擇餅乾後戰鬥區應補回第二張餅乾',
  )

  await page.goto(replacementUrl, { waitUntil: 'networkidle' })
  await replacementModal.waitFor({ state: 'visible' })
  await replacementModal.getByRole('button', { name: '不補餅乾' }).click()
  await replacementModal.waitFor({ state: 'hidden' })
  assert.strictEqual(
    await page.locator('.bottom-field .combat-card-wrap').count(),
    1,
    '選擇不補餅乾後應保留原本的一張戰鬥區餅乾',
  )
  await page.locator('.battle-status-message').filter({
    hasText: '已選擇不補餅乾',
  }).waitFor()

  const runFaintDamageTest = async () => {
    await page.goto(`${baseUrl}?test-state=faint-damage`, {
      waitUntil: 'networkidle',
    })

    const faintModal = page.locator('.faint-response-modal')
    await faintModal.waitFor({ state: 'visible' })

    assert.ok(
      (await faintModal.innerText()).includes('Cherry Cookie'),
      '昏厥效果視窗應顯示 Cherry Cookie 名稱',
    )

    const targetCookie = page.locator('.top-field .combat-card-wrap').first()
    const isTargetable = await targetCookie.locator('.card-face').first().evaluate(
      (el) => el.classList.contains('is-targetable'),
    )
    assert.ok(isTargetable, '對手餅乾應標示為可選目標')

    await faintModal.getByRole('button', { name: /縮小/ }).click()
    const faintDock = page.locator('.card-reveal-dock')
    await faintDock.waitFor({ state: 'visible' })
    await targetCookie.locator('.card-face').first().evaluate((el) => el.click())
    await faintDock.click()
    await faintModal.getByRole('button', { name: /確認/ }).click()
    await faintModal.waitFor({ state: 'hidden' })

    assert.strictEqual(
      await page.locator('.faint-response-modal').count(),
      0,
      '選擇目標後昏厥視窗應關閉',
    )

    await page.goto(`${baseUrl}?test-state=faint-damage`, {
      waitUntil: 'networkidle',
    })
    await faintModal.waitFor({ state: 'visible' })

    await faintModal.getByRole('button', { name: /略過|不選擇目標/ }).click()
    await faintModal.waitFor({ state: 'hidden' })
    assert.strictEqual(
      await page.locator('.faint-response-modal').count(),
      0,
      '略過後昏厥視窗應關閉',
    )
  }

  await runFaintDamageTest()

  const runPretzelSnareTests = async () => {
    const payableUrl = `${baseUrl}?test-state=trap-pretzel-payable`
    await page.goto(payableUrl, { waitUntil: 'networkidle' })

    const battleModal = page.locator('.battle-response-modal')
    await battleModal.waitFor({ state: 'visible' })
    assert.strictEqual(
      await battleModal.count(),
      1,
      '攻擊 5 時 Pretzel Snare 應顯示回應視窗',
    )

    const pretzelCard = battleModal.locator('.modal-card-options > button').first()
    await pretzelCard.click()
    const detailText = await battleModal.innerText()
    assert.ok(
      detailText.includes('Pretzel Snare'),
      '卡牌詳情應顯示 Pretzel Snare 名稱',
    )
    assert.ok(
      detailText.includes('attacks more than 4'),
      '卡牌詳情應包含發動條件',
    )

    const selectPretzelPayment = async () => {
      const paymentButtons = battleModal.locator('.trap-discard-options > button')
      const paymentCount = await paymentButtons.count()
      assert.ok(paymentCount >= 2, `Pretzel Snare 應有至少 2 張付款選項，實際 ${paymentCount}`)
      await paymentButtons.nth(0).click()
      await paymentButtons.nth(1).click()
    }

    // Capture initial HP card count for the attacker before the trap
    const hpLocator = page.locator('.top-field .combat-card-wrap .hp-card-stack .hp-card')
    const initialHp = await hpLocator.count()
    assert.ok(initialHp > 0, `攻擊者初始應有 HP 卡牌，實際 ${initialHp}`)

    // Pretzel select-1:確認發動，對攻擊者造成 1 點傷害
    await selectPretzelPayment()
    await battleModal.getByRole('button', { name: '下一步' }).click()
    const pretzelTargets = battleModal.locator('.trap-target-options > button')
    assert.ok(
      (await pretzelTargets.count()) >= 1,
      'Pretzel Snare 的目標步驟應顯示攻擊餅乾',
    )
    await pretzelTargets.first().click()
    await battleModal.getByRole('button', { name: '確認發動' }).click()
    const trapRevealModal = page.locator('.card-reveal-modal')
    const hasTrapRevealModal = await trapRevealModal
      .waitFor({ state: 'visible', timeout: 1000 })
      .then(() => true)
      .catch(() => false)
    if (hasTrapRevealModal) {
      await trapRevealModal.getByRole('button', { name: '確認發動' }).click()
    }
    await battleModal.waitFor({ state: 'hidden' })
    await page.waitForTimeout(400)
    const hpAfterTrap = await hpLocator.count()
    assert.strictEqual(
      hpAfterTrap,
      initialHp - 1,
      `選 1 目標後攻擊者應損失 1 HP（原有 ${initialHp}，實際 ${hpAfterTrap}）`,
    )

    // Pretzel select-0:不選擇目標，略過傷害效果
    await page.goto(payableUrl, { waitUntil: 'networkidle' })
    await battleModal.waitFor({ state: 'visible' })
    await pretzelCard.click()
    await page.waitForTimeout(100)
    await selectPretzelPayment()
    await battleModal.getByRole('button', { name: '下一步' }).click()
    const noTargetCheckbox = page.locator('.trap-target-toggle input[type="checkbox"]')
    await noTargetCheckbox.waitFor({ state: 'visible' })
    await noTargetCheckbox.click()
    await battleModal.getByRole('button', { name: '確認發動' }).click()
    const secondTrapRevealModal = page.locator('.card-reveal-modal')
    const hasSecondTrapRevealModal = await secondTrapRevealModal
      .waitFor({ state: 'visible', timeout: 1000 })
      .then(() => true)
      .catch(() => false)
    if (hasSecondTrapRevealModal) {
      await secondTrapRevealModal.getByRole('button', { name: '確認發動' }).click()
    }
    await battleModal.waitFor({ state: 'hidden' })
    // Wait for auto-resolution and dismiss any replacement modal
    await page.waitForTimeout(600)
    const decisionModal = page.locator('.decision-modal')
    if (await decisionModal.count() > 0) {
      const skipButton = decisionModal.getByRole('button', { name: '不補餅乾' })
      if (await skipButton.count() > 0) {
        await skipButton.click()
        await decisionModal.waitFor({ state: 'hidden' })
        await page.waitForTimeout(200)
      }
    }
    const attackerHpNoTrap = page.locator('.top-field .combat-card-wrap .hp-card-stack .hp-card')
    const hpNoTrap = await attackerHpNoTrap.count()
    assert.strictEqual(
      hpNoTrap,
      initialHp,
      `選 0 目標後攻擊者 HP 應維持 ${initialHp}，實際 ${hpNoTrap}`,
    )

    // Pretzel unpayable:攻擊 4 時不顯示回應視窗
    await page.goto(`${baseUrl}?test-state=trap-pretzel-unpayable`, {
      waitUntil: 'networkidle',
    })
    await page.waitForFunction(
      () => document.querySelector('.battle-response-modal') === null,
    )
    assert.strictEqual(
      await page.locator('.battle-response-modal').count(),
      0,
      '攻擊 4 時 Pretzel Snare 不應顯示回應視窗',
    )
  }

  await runPretzelSnareTests()

  const runOpponentDiscardHandTest = async () => {
    await page.goto(`${baseUrl}?test-state=opponent-discard-hand`, {
      waitUntil: 'networkidle',
    })

    // Opponent discard modal should be visible first
    const discardModal = page.locator('.hand-discard-modal')
    await discardModal.waitFor({ state: 'visible' })
    assert.ok(
      (await discardModal.innerText()).includes('Roguefort Cookie'),
      '對手棄牌視窗應顯示 Roguefort Cookie 名稱',
    )
    assert.ok(
      (await discardModal.innerText()).includes('棄置手牌'),
      '對手棄牌視窗應顯示要求棄置手牌',
    )

    // Verify confirm is disabled without selection
    const discardConfirm = discardModal.getByRole('button', { name: /確認棄置/ })
    assert.ok(
      await discardConfirm.isDisabled(),
      '未選棄牌時不可確認棄置',
    )

    // Select a hand card
    const handCards = discardModal.locator('.modal-card-options > button')
    const handCount = await handCards.count()
    assert.ok(handCount >= 1, `對手棄牌視窗應有至少 1 張手牌可選，實際 ${handCount}`)
    await handCards.first().click()
    await page.waitForTimeout(100)
    assert.ok(
      !(await discardConfirm.isDisabled()),
      '選擇 1 張手牌後應可確認棄置',
    )

    await discardConfirm.click()
    await discardModal.waitFor({ state: 'hidden' })
    await page.waitForTimeout(300)

    // Now verify card detail shows skill text for Roguefort Cookie
    const topCookie = page.locator('.top-field .combat-card-wrap').first()
    await topCookie.locator('.card-face').first().click()
    const detailModal = page.locator('.card-detail-modal')
    await detailModal.waitFor({ state: 'visible' })
    const detailText = await detailModal.innerText()
    assert.ok(
      detailText.includes('Roguefort Cookie'),
      '卡牌詳情應顯示 Roguefort Cookie 名稱',
    )
    assert.ok(
      detailText.includes('技能'),
      '卡牌詳情應顯示技能標題',
    )
    assert.ok(
      detailText.includes('opponent'),
      '卡牌詳情應顯示效果文字',
    )
    await page.locator('.card-detail-modal .close-modal').click()
    await detailModal.waitFor({ state: 'hidden' })
  }

  await runOpponentDiscardHandTest()

  const runSupportToTrashSkillTest = async () => {
    await page.setViewportSize({ width: 798, height: 698 })
    await page.goto(`${baseUrl}?test-state=st3-002-skill`, {
      waitUntil: 'networkidle',
    })

    const supportLayout = await page.evaluate(() => {
      const topZone = document.querySelector('.top-field .support-zone')
      const bottomZone = document.querySelector('.bottom-field .support-zone')
      const topCards = [
        ...document.querySelectorAll('.top-field .support-card'),
      ]
      const bottomCards = [
        ...document.querySelectorAll('.bottom-field .support-card'),
      ]
      if (
        !(topZone instanceof HTMLElement) ||
        !(bottomZone instanceof HTMLElement) ||
        !(topCards[0] instanceof HTMLElement) ||
        !(bottomCards[0] instanceof HTMLElement)
      ) {
        throw new Error('ST3-002 測試局面缺少支援區卡牌')
      }
      const topZoneRect = topZone.getBoundingClientRect()
      const bottomZoneRect = bottomZone.getBoundingClientRect()
      const topCardRect = topCards[0].getBoundingClientRect()
      const bottomCardRect = bottomCards[0].getBoundingClientRect()
      return {
        topGap: topZoneRect.right - topCardRect.right,
        bottomGap: bottomCardRect.left - bottomZoneRect.left,
        topWidth: topCardRect.width,
        bottomWidth: bottomCardRect.width,
      }
    })
    assert.ok(
      supportLayout.topGap < 60 && supportLayout.bottomGap < 24,
      `798x698 支援卡應由我方左側、對手右側開始排列：${JSON.stringify(supportLayout)}`,
    )
    assert.ok(
      supportLayout.topWidth >= 38 && supportLayout.bottomWidth >= 38,
      `798x698 支援卡應維持可辨識尺寸：${JSON.stringify(supportLayout)}`,
    )
    await mkdir(outputDirectory, { recursive: true })
    await page.screenshot({
      path: resolve(outputDirectory, 'layout-798x698-support.png'),
    })

    await page
      .locator('.bottom-field .skill-action', { hasText: '啟動技能' })
      .click()

    const effectPanel = page.locator('.effect-panel')
    await effectPanel.waitFor({ state: 'visible' })
    const primaryButton = effectPanel.locator('.effect-panel-primary-action')
    const opponentCookie = page
      .locator('.top-field .combat-card-wrap > .card-face')
      .first()

    await opponentCookie.evaluate((el) => el.click())
    assert.ok(
      await primaryButton.isDisabled(),
      'ST3-002 選好效果目標但未支付支援卡代價時不可進入下一步',
    )

    const costSupports = page.getByRole('button', {
      name: /作為技能代價/,
    })
    assert.strictEqual(
      await costSupports.count(),
      2,
      'ST3-002 應讓兩張支援卡都可選為代價',
    )
    const costSupport = costSupports.first()
    assert.ok(
      await costSupport.evaluate((element) =>
        element.classList.contains('is-targetable'),
      ),
      'ST3-002 發動時我方支援卡應標示為可選代價',
    )
    await costSupport.evaluate((el) => el.click())
    assert.ok(
      await costSupport.evaluate((element) =>
        element.classList.contains('is-selected'),
      ),
      '點擊支援卡後應標示為已選技能代價',
    )
    assert.strictEqual(
      await page
        .locator('.bottom-field .support-card.is-targetable')
        .count(),
      1,
      '選滿技能代價後只應保留已選支援卡可取消',
    )
    assert.ok(
      !(await primaryButton.isDisabled()),
      'ST3-002 選好目標與支援卡代價後應可進入下一步',
    )

    const confirmButton = await advanceEffectPanelToConfirm(effectPanel)
    await confirmButton.click()
    await confirmButton.waitFor({ state: 'hidden' })

    assert.strictEqual(
      await page.locator('.bottom-field .support-card').count(),
      1,
      'ST3-002 支付後所選支援卡應離開支援區',
    )
    assert.ok(
      (await page
        .locator('.bottom-field .discard-zone')
        .innerText()).includes('1'),
      'ST3-002 支付後棄牌區數量應增加 1',
    )
    assert.strictEqual(
      await page.locator('.top-field .hp-card-stack .hp-card').count(),
      1,
      'ST3-002 應對所選對手餅乾造成 1 點效果傷害',
    )
  }

  await runSupportToTrashSkillTest()

  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await completeOpeningSetup()

  assert.strictEqual(
    await page.locator('.inspect-hand-button').count(),
    0,
    '不應再顯示 inspect-hand-button',
  )
  assert.strictEqual(
    await page.locator('.phase-rail .rail-ai-status').count(),
    0,
    'PhaseRail 不應保留 AI 狀態面板',
  )
  assert.ok(
    (await page.locator('.bottom-field .hp-card-stack .hp-card').count()) > 0,
    '我方戰鬥區餅乾下方應展開 HP 卡',
  )

  // "暫停資訊" now lives inside the MatchToolbar's collapsed dropdown menu
  // (role="menuitem", not role="button") — open the toolbar trigger first.
  await page.getByRole('button', { name: '對局工具' }).click()
  await page.getByRole('menuitem', { name: '暫停資訊' }).click()
  await page.locator('.pause-modal').waitFor({ state: 'visible' })
  await page.getByRole('button', { name: '執行 20 場 AI 驗證' }).click()
  await page.getByTestId('ai-simulation-report').waitFor()

  const matches = []
  for (let index = 1; index <= 20; index += 1) {
    const row = page.getByTestId(`ai-simulation-match-${index}`)
    const validation = await row.getAttribute('data-validation')
    matches.push({
      match: index,
      seed: validation ? JSON.parse(validation).seed : null,
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
