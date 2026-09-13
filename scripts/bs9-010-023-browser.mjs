import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import bs9Candidates from '../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json' with { type: 'json' }

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const playwright = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwright.chromium ?? playwright.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_BS9_TEST_PORT ?? 4185)
const baseUrl = `http://127.0.0.1:${port}`
const preview = spawn(
  process.execPath,
  [resolve(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)
const outputDirectory = resolve(root, 'test-results')
mkdirSync(outputDirectory, { recursive: true })
const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))

const baseCases = [
  ['BS9-010', 'Shadow Milk Cookie', 'extra'],
  ['BS9-011', 'Devil Cookie', 'on-play'],
  ['BS9-012', 'Knight Cookie', 'end-opponent-turn'],
  ['BS9-013', 'Capricious Wizard', 'vanilla'],
  ['BS9-014', 'Candy Apple Cookie', 'on-play-candy'],
  ['BS9-015', 'Parfait Cookie', 'faint'],
  ['BS9-016', 'Pizza Cookie', 'on-play-pizza'],
  ['BS9-017', 'Hollyberry Cookie', 'hollyberry'],
  ['BS9-018', 'Hero Cookie', 'smoke'],
  ['BS9-019', 'Juicy Stamina Jellies', 'item'],
  ['BS9-020', 'Fateful Cookie Cutter', 'item'],
  ['BS9-021', 'Stolen Light of Truth', 'smoke'],
  ['BS9-022', 'Paper Puppet Troupe', 'trap'],
  ['BS9-023', 'Atelier of Lies', 'stage'],
]

const cases = baseCases.flatMap(([baseCard, title, mode]) => {
  const records = bs9Candidates.cards.filter((record) => record.baseCardNumber === baseCard)
  if (records.length === 0) throw new Error(`Missing BS9 candidates for ${baseCard}`)
  return records.map((record) => ({ card: record.cardNumber, baseCard, title, mode }))
})

const recordErrors = (page) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const location = message.location()
    if (location.url?.endsWith('/favicon.ico') && message.text().includes('404')) return
    if (location.url?.includes('cookierunbraverse.com/data/en_storage/') && /ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(message.text())) return
    errors.push(`console: ${message.text()}`)
  })
  return errors
}

const readTrace = (page) => page.evaluate(() => window.__braverseContractTrace ?? [])
const waitForGame = async (page) => {
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await page.waitForTimeout(280)
}
const visiblePanel = (page) => page.locator('.effect-panel:visible').first()
const assertTrace = async (page, commandKind) => {
  const trace = await readTrace(page)
  assert.ok(trace.some((entry) => entry.commandKind === commandKind), `missing ${commandKind} trace`)
}

const candidateRecord = (cardNumber) => {
  const record = bs9Candidates.cards.find((candidate) => candidate.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS9 candidate ${cardNumber}`)
  return record
}

const sourceBattle = (page, baseCard) =>
  page.locator(`.bottom-field .combat-card-wrap[data-card-instance-id="bs9-${baseCard.toLowerCase()}-source"]`).first()

const hpCards = (page, name) => page.locator(`[aria-label^="${name} HP 卡"] .hp-card`)

const assertNoTrace = async (page, commandKind, message) => {
  const trace = await readTrace(page)
  assert.equal(trace.some((entry) => entry.commandKind === commandKind), false, message)
}

const assertPhysicalCardImage = async (locator, record, imageRequested) => {
  await locator.waitFor({ state: 'visible' })
  const exactImage = locator.locator(`img[src="${record.imageUrl}"]`).first()
  await exactImage.waitFor({ state: 'visible' })
  await exactImage.evaluate((node) => {
    if (node instanceof HTMLImageElement && (!node.complete || node.naturalWidth === 0)) {
      return new Promise((resolvePromise, rejectPromise) => {
        node.addEventListener('load', () => resolvePromise(), { once: true })
        node.addEventListener('error', () => rejectPromise(new Error('official image failed to load')), { once: true })
      })
    }
    return undefined
  })
  const alts = await locator.locator('img').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('alt'))).catch(() => [])
  assert.ok(alts.includes(record.name), `${record.cardNumber} must render its named official card face`)
  const exactImageRendered = await exactImage.count() > 0
  const exactImageLoaded = await exactImage.evaluate((node) => node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0)
  const exactImageRequested = typeof imageRequested === 'function' ? imageRequested() : imageRequested
  assert.equal(exactImageRendered, true, `${record.cardNumber} must render its exact official image URL`)
  assert.equal(exactImageLoaded, true, `${record.cardNumber} official image must be loaded, not merely requested`)
  return { exactImageRendered, exactImageLoaded, exactImageRequested }
}

const clickVisibleHandAction = async (page, actionText) => {
  const action = page.locator('.hand-card-action:visible').filter({ hasText: actionText }).first()
  await action.waitFor({ state: 'visible' })
  assert.equal(await action.isEnabled(), true, `${actionText} action should be enabled`)
  await action.click()
}

const settleOnPlay = async (page, title, negative) => {
  const card = page.locator(`.bottom-hand .hand-card[title="${title}"]`).first()
  await card.click()
  await clickVisibleHandAction(page, '登場')
  await page.waitForTimeout(180)
  const panel = visiblePanel(page)
  if (negative) {
    assert.equal(await panel.count(), 0, 'condition-negative On Play should auto-skip')
    await assertTrace(page, 'skip-on-play')
    return
  }
  await panel.waitFor({ state: 'visible' })
  const target = panel.locator('.effect-candidates-target button:not(:disabled)').first()
  if (await target.count()) await target.click()
  const primary = panel.locator('.effect-panel-primary-action').first()
  assert.equal(await primary.isEnabled(), true)
  await primary.click()
  await page.waitForTimeout(180)
  await assertTrace(page, 'resolve-ability-effect')
}

const settleItem = async (page, title, negative) => {
  const card = page.locator(`.bottom-hand .hand-card[title="${title}"]`).first()
  await card.click()
  if (negative) {
    // A condition-blocked Item remains inspectable in hand, but the real UI
    // must not expose a 使用 action.  Keep this as the negative Browser
    // acceptance path instead of dispatching an illegal command by force.
    assert.equal(await page.locator('.hand-card-action').filter({ hasText: '使用' }).count(), 0)
    assert.match(await page.locator('body').innerText(), new RegExp(title))
    return
  }
  await clickVisibleHandAction(page, '使用')
  await page.waitForTimeout(120)
  const panel = visiblePanel(page)
  await panel.waitFor({ state: 'visible' })
  const payments = panel.locator('.effect-candidates-payment button:not(.is-selected):not(:disabled)')
  const needed = title === 'Juicy Stamina Jellies' ? 2 : 1
  for (let index = 0; index < needed; index += 1) await payments.nth(index).click()
  const confirm = panel.locator('.effect-panel-primary-action').first()
  await confirm.click()
  await page.waitForTimeout(150)
  if (title === 'Juicy Stamina Jellies') {
    const targetPanel = visiblePanel(page)
    const target = targetPanel.locator('.effect-candidates-target button:not(:disabled)').first()
    if (await target.count()) await target.click()
    await targetPanel.locator('.effect-panel-primary-action').first().click()
    await page.waitForTimeout(180)
    await assertTrace(page, 'resolve-ability-effect')
    return
  }
  const draw = page.locator('.draw-up-to-modal:visible')
  await draw.waitFor({ state: 'visible' })
  assert.match(await draw.innerText(), /最多 2 張|最多.*2 張/)
  await draw.locator('.draw-up-to-option').nth(2).click()
  await draw.locator('.draw-up-to-actions button').click()
  await page.waitForTimeout(120)
  const discard = page.locator('.hand-discard-modal:visible')
  await discard.waitFor({ state: 'visible' })
  await discard.locator('.hand-discard-options button:not(.is-selected)').first().click()
  await discard.locator('.hand-discard-actions button').click()
  await page.waitForTimeout(180)
  await assertTrace(page, 'resolve-opponent-hand-discard')
}

const settleExtra = async (page, negative, record, imageRequested) => {
  const summary = page.locator('button.resource-summary[aria-label^="玩家 EXTRA Deck"]').first()
  await summary.click()
  const entry = page.locator('.extra-deck-card-entry:visible').first()
  await entry.waitFor({ state: 'visible' })
  assert.match(await entry.innerText(), new RegExp(record.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  const imageEvidence = await assertPhysicalCardImage(
    entry.locator('.extra-deck-card-image').first(),
    record,
    imageRequested,
  )
  const play = page.getByRole('button', { name: '從 EXTRA 登場', exact: true })
  if (negative) {
    assert.equal(await play.count(), 0, 'negative EXTRA requirement should not offer play')
    assert.match(await page.locator('body').innerText(), /EXTRA|尚未|不能|不符合/)
    return imageEvidence
  }
  await play.click()
  await page.waitForTimeout(120)
  const panel = visiblePanel(page)
  await panel.locator('.effect-candidates-target button:not(:disabled)').first().click()
  await panel.locator('.effect-panel-primary-action').first().click()
  await page.waitForTimeout(180)
  await assertTrace(page, 'play-extra-deck-cookie')
  await assertTrace(page, 'resolve-ability-effect')
  return imageEvidence
}

const settleTrap = async (page, negative, result) => {
  const response = page.locator('.trap-response-modal:visible')
  await response.waitFor({ state: 'visible' })
  const trapButton = response.locator('button').filter({ hasText: 'Paper Puppet Troupe' }).first()
  if (negative) {
    await response.getByRole('button', { name: '不發動', exact: true }).click()
    await page.waitForTimeout(120)
    // skip-trap is a system transition without a card source, so the public
    // contract trace intentionally omits it.  The rendered message is the
    // user-visible evidence that the response window was closed.
    assert.match(await page.locator('body').innerText(), /未發動回應，進入傷害結算|未發動陷阱，進入傷害結算/)
    return
  }
  await trapButton.click()
  await page.waitForTimeout(100)
  const payment = response.locator('.trap-discard-options button:not(.is-selected):not(:disabled)').first()
  await payment.click()
  await response.getByRole('button', { name: '下一步', exact: true }).click()
  await page.waitForTimeout(100)
  // The Paper Puppet target step is rendered by the guided trap modal.  Keep
  // the legacy selector for older reports, but include the current
  // `.trap-target-options` surface so the positive route actually applies the
  // -1 attack modifier instead of silently accepting zero targets.
  const target = response.locator(
    '.trap-target-options button:not(.is-selected):not(:disabled), .trap-target-candidates button:not(.is-selected):not(:disabled), .effect-candidates-target button:not(:disabled)',
  ).first()
  assert.equal(await target.count(), 1, 'Paper Puppet positive route must expose its attack target')
  await target.click()
  const next = response.getByRole('button', { name: /下一步|發動|確認/, exact: false }).last()
  if (await next.isEnabled().catch(() => false)) await next.click()
  await page.waitForTimeout(150)
  await assertTrace(page, 'play-trap')
  const playTrap = (await readTrace(page)).find((entry) => entry.commandKind === 'play-trap')
  const targetStep = playTrap?.steps?.find((step) => /選擇目標/.test(step)) ?? null
  assert.ok(targetStep, 'Paper Puppet positive route must record its selected attack target')
  result.effectWitness = {
    kind: 'trap-attack-target-and-then-draw-choice',
    targetStep,
    targetSelected: true,
    attackReduction: -1,
    drawEffect: 'draw-up-to-1',
  }
}

const settleStage = async (page, negative) => {
  const card = page.locator('.bottom-hand .hand-card[title="Atelier of Lies"]')
  await card.click()
  await clickVisibleHandAction(page, '放置')
  const placement = page.locator('.stage-placement-modal:visible')
  await placement.waitFor({ state: 'visible' })
  await placement.locator('.faint-payment-candidates button:not(:disabled)').first().click()
  await placement.getByRole('button', { name: '支付並放置', exact: true }).click()
  await page.waitForTimeout(160)
  if (negative) {
    const activate = page.getByRole('button', { name: '啟動', exact: true })
    assert.equal(await activate.isEnabled().catch(() => false), false)
    return
  }
  await page.getByRole('button', { name: '啟動', exact: true }).click()
  const panel = visiblePanel(page)
  await panel.locator('.effect-candidates-payment button:not(:disabled)').first().click()
  await panel.locator('.effect-panel-primary-action').first().click()
  await page.waitForTimeout(100)
  // Stage activation has a separate mandatory "rest this card" step after
  // payment.  Advance that step before selecting the Cookie targets.
  let target = page.locator('.effect-panel:visible .effect-candidates-target button:not(:disabled)').first()
  if (!(await target.count())) {
    const extraCost = page.locator('.effect-panel:visible').first()
    assert.match(await extraCost.innerText(), /將效果來源卡橫置/)
    await extraCost.locator('.effect-panel-primary-action').first().click()
    await page.waitForTimeout(100)
    target = page.locator('.effect-panel:visible .effect-candidates-target button:not(:disabled)').first()
  }
  if (await target.count()) await target.click()
  await page.locator('.effect-panel:visible .effect-panel-primary-action').first().click()
  await page.waitForTimeout(150)
  await assertTrace(page, 'begin-activate-stage')
}

const runKnightEndOpponentTurn = async (page, testCase, negative, result) => {
  await page.getByRole('button', { name: '結束主要階段', exact: true }).click()
  result.actions.push('end-main-phase')
  await page.getByRole('button', { name: '結束回合', exact: true }).click()
  result.actions.push('end-turn')
  await page.waitForFunction(
    () => document.body.innerText.includes('回合結束效果') || document.body.innerText.includes('TURN 4'),
    undefined,
    { timeout: 30_000 },
  )

  if (negative) {
    assert.equal(await page.locator('.effect-panel[role="alertdialog"]:visible').count(), 0)
    await assertNoTrace(page, 'resolve-ability-effect', `${testCase.card} 條件不成立時不得結算回合結束效果`)
    result.negativeReason = '己方戰鬥區少於 2 張餅乾，回合結束被動效果不觸發'
    result.actions.push('blocked-end-opponent-turn-effect')
    return
  }

  const panel = visiblePanel(page)
  await panel.waitFor({ state: 'visible' })
  assert.match(await panel.innerText(), /選擇 1 張我方餅乾，造成 3 傷害/)
  const targets = panel.locator('.effect-candidates-target button:not(:disabled)')
  assert.equal(await targets.count(), 1, `${testCase.card} 應提供唯一的 Knight Cookie 目標`)
  assert.match(await targets.first().innerText(), /Knight Cookie/)
  await targets.first().click()
  await panel.getByRole('button', { name: '確認發動', exact: true }).click()
  result.actions.push('resolve-end-opponent-turn-effect')
  await page.waitForFunction(
    () => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === 'resolve-ability-effect'),
    undefined,
    { timeout: 10_000 },
  )
  await assertTrace(page, 'resolve-ability-effect')
  assert.equal(await sourceBattle(page, testCase.baseCard).count(), 0, `${testCase.card} 受到 3 傷害後應昏厥離場`)

  // Fainting opens a real replacement decision.  Declining it is part of the
  // legal completion path; leaving it open would make this look like a settled
  // effect while the turn is still blocked by a pending modal.
  const replacement = page.locator('.decision-modal[role="alertdialog"]:visible').filter({ hasText: '放置餅乾' }).first()
  if (await replacement.count()) {
    await replacement.getByRole('button', { name: '不補餅乾', exact: true }).click()
    result.actions.push('decline-faint-replacement')
  }
  await page.waitForTimeout(1_200)
}

const runCandyAppleOnPlay = async (page, testCase, negative, result) => {
  const hand = page.locator(`.bottom-hand .hand-card[title="${testCase.title}"]`).first()
  await hand.click()
  await clickVisibleHandAction(page, '登場')
  result.actions.push('deploy-cookie')
  await page.waitForTimeout(180)
  const panel = visiblePanel(page)

  if (negative) {
    assert.equal(await panel.count(), 0, `${testCase.card} 代價不足時不應建立 On Play 面板`)
    assert.match(await page.locator('body').innerText(), /目前不符合此技能的時機、條件或支付要求/)
    await assertTrace(page, 'skip-on-play')
    await assertNoTrace(page, 'resolve-ability-effect', `${testCase.card} 負向路徑不得結算 On Play 效果`)
    result.negativeReason = '另一張餅乾只剩 1 張 HP，無法支付卡面要求的 2 張 HP 代價'
    result.actions.push('blocked-on-play-hp-cost')
    return
  }

  await panel.waitFor({ state: 'visible' })
  assert.match(await panel.innerText(), /棄置 2 張 HP 卡|HP 費用/)
  const hpCost = panel.locator('.effect-candidates-hp-cost button:not(:disabled)')
  assert.equal(await hpCost.count(), 1, `${testCase.card} 應提供唯一合法的 HP 代價來源`)
  assert.match(await hpCost.first().innerText(), /Pomegranate Cookie/)
  await hpCost.first().click()
  await panel.getByRole('button', { name: '下一步', exact: true }).click()
  result.actions.push('pay-two-hp')
  assert.match(await panel.innerText(), /對手餅乾/)
  assert.match(await panel.innerText(), /正面朝上|face-up/)
  assert.match(await panel.innerText(), /最下方|bottom/)
  const target = panel.locator('.effect-candidates-target button:not(:disabled)').filter({ hasText: 'Melon Bun Cookie' })
  assert.equal(await target.count(), 1, `${testCase.card} 應提供唯一指定的對手目標`)
  await target.first().click()
  await panel.getByRole('button', { name: '確認發動', exact: true }).click()
  result.actions.push('resolve-on-play-transfer')
  await panel.waitFor({ state: 'hidden' })
  await page.waitForTimeout(250)
  await assertTrace(page, 'resolve-ability-effect')
  assert.equal(await hpCards(page, 'Pomegranate Cookie').count(), 2)
  assert.equal(await hpCards(page, 'Candy Apple Cookie').count(), 3)
  result.hpAfter = { donor: 2, source: 3 }
}

const runPizzaOnPlay = async (page, testCase, negative, result) => {
  const hand = page.locator(`.bottom-hand .hand-card[title="${testCase.title}"]`).first()
  await hand.click()
  await clickVisibleHandAction(page, '登場')
  result.actions.push('deploy-cookie')
  await page.waitForTimeout(180)
  const panel = visiblePanel(page)

  if (negative) {
    assert.equal(await panel.count(), 0, `${testCase.card} 沒有同名餅乾時不應建立 On Play 面板`)
    assert.match(await page.locator('body').innerText(), /尚未滿足發動條件|條件/)
    await assertTrace(page, 'skip-on-play')
    await assertNoTrace(page, 'resolve-ability-effect', `${testCase.card} 負向路徑不得套用攻擊力加成`)
    result.negativeReason = '戰鬥區沒有另一張 Pizza Cookie，卡面 On Play 條件不成立'
    result.actions.push('blocked-on-play-name-condition')
    return
  }

  await panel.waitFor({ state: 'visible' })
  assert.match(await panel.innerText(), /本回合攻擊傷害 \+1/)
  const fixedTarget = panel.locator('.effect-candidates-target button')
  assert.equal(await fixedTarget.count(), 1, `${testCase.card} 應固定套用來源餅乾`)
  assert.equal(await fixedTarget.first().isDisabled(), true)
  assert.match(await fixedTarget.first().innerText(), /Pizza Cookie/)
  await panel.getByRole('button', { name: '確認發動', exact: true }).click()
  result.actions.push('resolve-on-play-attack-bonus')
  await panel.waitFor({ state: 'hidden' })
  await page.waitForTimeout(220)
  await assertTrace(page, 'resolve-ability-effect')
  const source = sourceBattle(page, testCase.baseCard)
  assert.equal((await source.locator('.badge-atk').innerText()).trim(), '2')
  result.attackAfter = 2
}

const runParfaitFaint = async (page, testCase, negative, result) => {
  const faint = page.locator('.faint-response-modal:visible').first()
  await faint.waitFor({ state: 'visible' })
  const candidates = faint.locator('.faint-card-candidates button')
  if (negative) {
    assert.equal(await candidates.count(), 0, `${testCase.card} 負向路徑不應有可登場手牌`)
    await faint.getByRole('button', { name: '不選擇目標', exact: true }).click()
    await faint.waitFor({ state: 'hidden' })
    await page.waitForTimeout(180)
    await assertTrace(page, 'resolve-faint-effect')
    await assertNoTrace(page, 'resolve-ability-effect', `${testCase.card} 沒有手牌時不得進入 Then HP 效果`)
    result.negativeReason = '沒有可登場的 Cookie 手牌，第一段 up to 1 合法選 0，Then 不建立'
    result.actions.push('skip-faint-hand-selection')
    return
  }

  assert.equal(await candidates.count(), 1, `${testCase.card} 應提供唯一合法的手牌 Cookie`)
  assert.match(await candidates.first().innerText(), /Capricious Wizard/)
  await candidates.first().click()
  const confirm = faint.getByRole('button', { name: /^確認/ }).last()
  assert.equal(await confirm.isEnabled(), true)
  await confirm.click()
  result.actions.push('select-faint-cookie')
  await page.waitForTimeout(180)
  await assertTrace(page, 'resolve-faint-effect')

  const panel = visiblePanel(page)
  await panel.waitFor({ state: 'visible' })
  const target = panel.locator('.effect-candidates-target button:not(:disabled)')
  assert.equal(await target.count(), 1, `${testCase.card} Then 應只提供先前登場的 Cookie`)
  assert.match(await target.first().innerText(), /Capricious Wizard/)
  assert.doesNotMatch((await target.allTextContents()).join(' '), /Pomegranate Cookie/)
  await target.first().click()
  await panel.getByRole('button', { name: '確認發動', exact: true }).click()
  result.actions.push('resolve-faint-then-hp')
  await panel.waitFor({ state: 'hidden' })
  await page.waitForTimeout(220)
  await assertTrace(page, 'resolve-ability-effect')
  assert.equal(await hpCards(page, 'Capricious Wizard').count(), 3)
  assert.equal(await hpCards(page, 'Pomegranate Cookie').count(), 4)
  result.hpAfter = { capriciousWizard: 3, pomegranate: 4 }
}

const runHollyberry = async (page, testCase, negative, result) => {
  const initial = visiblePanel(page)
  await initial.waitFor({ state: 'visible' })
  assert.match(await initial.innerText(), /攻擊後續效果/)
  const targets = initial.locator('.effect-candidates-target button')
  assert.equal(await targets.count(), negative ? 1 : 2)
  assert.equal(await targets.filter({ hasText: 'Hollyberry Cookie' }).count(), 1)
  assert.equal(await targets.filter({ hasText: 'Golden Cheese Cookie' }).count(), negative ? 0 : 1)
  for (const button of await targets.all()) {
    assert.equal(await button.isDisabled(), true)
    assert.equal(await button.evaluate((node) => node.classList.contains('is-selected')), true)
  }
  await initial.getByRole('button', { name: '確認發動', exact: true }).click()
  result.actions.push('resolve-attack-then-protection')
  await page.waitForFunction(
    () => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === 'resolve-attack-effect'),
    undefined,
    { timeout: 10_000 },
  )
  await assertTrace(page, 'resolve-attack-effect')
  await page.waitForTimeout(1_100)

  const source = sourceBattle(page, testCase.baseCard)
  const skill = source.locator('.skill-action')
  assert.equal(await skill.count(), 1, `${testCase.card} 應保留技能入口`)
  if (negative) {
    assert.equal(await skill.isEnabled(), false, `${testCase.card} 沒有另一張 Ancient 時技能應停用`)
    assert.match(await source.innerText(), /目前不符合此技能的時機、條件或支付要求/)
    await assertNoTrace(page, 'begin-activate-skill', `${testCase.card} 負向路徑不得啟動技能`)
    result.negativeReason = '己方沒有另一張 Ancient Cookie，Activate 條件不成立'
    result.actions.push('blocked-ancient-skill')
    return
  }

  assert.equal(await skill.isEnabled(), true)
  await skill.click()
  result.actions.push('begin-activate-skill')
  const skillPanel = visiblePanel(page)
  await skillPanel.waitFor({ state: 'visible' })
  const payment = skillPanel.locator('.effect-candidates-payment button:not(:disabled)')
  assert.equal(await payment.count(), 6)
  await payment.first().click()
  await skillPanel.getByRole('button', { name: '下一步', exact: true }).click()
  const skillTargets = skillPanel.locator('.effect-candidates-target button')
  assert.equal(await skillTargets.count(), 1)
  assert.equal(await skillTargets.first().isDisabled(), true)
  assert.match(await skillTargets.first().innerText(), /Hollyberry Cookie/)
  await skillPanel.getByRole('button', { name: '確認發動', exact: true }).click()
  result.actions.push('resolve-activate-skill')
  await skillPanel.waitFor({ state: 'hidden' })
  await page.waitForTimeout(220)
  await assertTrace(page, 'begin-activate-skill')
  await assertTrace(page, 'resolve-ability-effect')
  assert.equal((await source.locator('.badge-atk').innerText()).trim(), '4')
  result.attackAfterSkill = 4
}

const runVanilla = async (page, testCase, negative, result) => {
  const hand = page.locator(`.bottom-hand .hand-card[title="${testCase.title}"]`).first()
  await hand.click()
  const deploy = page.locator('.hand-card-action:visible').filter({ hasText: '登場' }).first()
  assert.equal(await deploy.count(), 1, `${testCase.card} 應提供登場入口`)
  assert.equal(await deploy.isEnabled(), true)
  await deploy.click()
  result.actions.push('deploy-cookie')
  await page.waitForTimeout(250)
  assert.equal(await visiblePanel(page).count(), 0, `${testCase.card} 無技能／FLIP 不應開啟效果面板`)
  await assertTrace(page, 'deploy-cookie')
  await assertNoTrace(page, 'resolve-ability-effect', `${testCase.card} 無技能／FLIP 不應產生效果結算 trace`)
  result.noOpReason = '官方卡面沒有 Skill 或 FLIP；登場後是合法 no-op'
  if (negative) result.negativeReason = result.noOpReason
}

// The broad 010～023 matrix includes a few smoke fixtures whose independent
// trigger opens a response window immediately (Parfait faint, Hollyberry
// attack-Then, Stolen Light trap, or Paper Puppet's optional draw).  Close
// those real UI decisions explicitly so the report records a settled route;
// the dedicated card scripts still exercise their full effect branches.
const settleResidualDialogs = async (page, result) => {
  const faint = page.locator('.faint-response-modal:visible').first()
  if (await faint.count()) {
    const skip = faint.getByRole('button', { name: '不選擇目標', exact: true })
    if (await skip.count()) {
      await skip.click()
      await faint.waitFor({ state: 'hidden' })
      result.actions.push('settle-faint-response-no-target')
    }
  }

  const attackThen = page.locator('.effect-panel:visible').filter({ hasText: '攻擊後續效果' }).first()
  if (await attackThen.count()) {
    const confirm = attackThen.getByRole('button', { name: '確認發動', exact: true })
    if (await confirm.count() && await confirm.isEnabled()) {
      await confirm.click()
      await attackThen.waitFor({ state: 'hidden' })
      result.actions.push('settle-attack-then')
    }
  }

  const trap = page.locator('.trap-response-modal:visible').first()
  if (await trap.count()) {
    const decline = trap.getByRole('button', { name: '不發動', exact: true })
    if (await decline.count()) {
      await decline.click()
      await trap.waitFor({ state: 'hidden' })
      result.actions.push('settle-trap-response-decline')
    }
  }

  const draw = page.locator('.draw-up-to-modal:visible').first()
  if (await draw.count()) {
    const skip = draw.getByRole('button', { name: '略過抽牌', exact: true })
    const noDraw = draw.getByRole('button', { name: '不抽', exact: true })
    const action = (await skip.count()) ? skip : noDraw
    if (await action.count()) {
      await action.click()
      await draw.waitFor({ state: 'hidden' })
      result.actions.push('settle-draw-up-to-zero')
    }
  }
}

const run = async (browser, testCase, negative, viewport) => {
  const { card, baseCard, title, mode } = testCase
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(7_000)
  const errors = recordErrors(page)
  const route = `bs9-card${negative ? '-negative' : ''}:${card}`
  const record = candidateRecord(card)
  let exactImageRequested = false
  page.on('request', (request) => {
    if (request.url() === record.imageUrl) exactImageRequested = true
  })
  const result = { card, baseCard, title, mode, viewport, negative, route, expectedImageUrl: record.imageUrl, status: 'FAIL', actions: [] }
  try {
    await page.goto(`${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${baseCard}`, { waitUntil: 'domcontentloaded' })
    await waitForGame(page)
    if (mode !== 'extra') {
      result.imageEvidence = await assertPhysicalCardImage(page.locator(`.card-face[title="${title}"]`).first(), record, exactImageRequested)
    }
    if (mode === 'extra') result.imageEvidence = await settleExtra(page, negative, record, () => exactImageRequested)
    else if (mode === 'on-play') await settleOnPlay(page, title, negative)
    else if (mode === 'end-opponent-turn') await runKnightEndOpponentTurn(page, testCase, negative, result)
    else if (mode === 'vanilla') await runVanilla(page, testCase, negative, result)
    else if (mode === 'on-play-candy') await runCandyAppleOnPlay(page, testCase, negative, result)
    else if (mode === 'faint') await runParfaitFaint(page, testCase, negative, result)
    else if (mode === 'on-play-pizza') await runPizzaOnPlay(page, testCase, negative, result)
    else if (mode === 'hollyberry') await runHollyberry(page, testCase, negative, result)
    else if (mode === 'item') await settleItem(page, title, negative)
    else if (mode === 'trap') await settleTrap(page, negative, result)
    else if (mode === 'stage') await settleStage(page, negative)
    await settleResidualDialogs(page, result)
    result.trace = await readTrace(page)
    result.traceCommandKinds = [...new Set(result.trace.map((entry) => entry.commandKind))]
    result.finalPendingSurfaces = await page.locator('[role="alertdialog"]:visible').count()
    assert.equal(result.finalPendingSurfaces, 0, 'Browser route must settle without a pending dialog')
    result.errors = errors
    result.exactImageRequested = exactImageRequested
    result.exactImageRendered = result.imageEvidence?.exactImageRendered ?? false
    result.exactImageLoaded = result.imageEvidence?.exactImageLoaded ?? false
    assert.equal(errors.length, 0, `browser errors: ${errors.join('; ')}`)
    result.status = 'PASS'
    await page.screenshot({ path: resolve(outputDirectory, `bs9-${card}-${negative ? 'negative' : 'positive'}-${viewport.width}x${viewport.height}.png`), fullPage: true })
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    result.trace = await readTrace(page).catch(() => [])
    result.body = await page.locator('body').innerText().catch(() => '')
  } finally {
    await page.close()
  }
  return result
}

for (let attempt = 0; attempt < 80; attempt += 1) {
  try {
    if ((await fetch(baseUrl)).ok) break
  } catch { /* preview is still starting */ }
  await wait(100)
  if (attempt === 79) throw new Error(`Vite preview did not start at ${baseUrl}`)
}

let browser
const results = []
try {
  const executablePath = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find((candidate) => existsSync(candidate))
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
  for (const viewport of [{ width: 1907, height: 863 }, { width: 1164, height: 777 }]) {
    for (const testCase of cases) {
      for (const negative of [false, true]) {
        const result = await run(browser, testCase, negative, viewport)
        results.push(result)
        console.log(`${result.status} ${testCase.card} ${negative ? 'negative' : 'positive'} ${viewport.width}x${viewport.height} ${result.error ?? ''}`)
      }
    }
  }
} finally {
  await browser?.close()
  if (preview.exitCode === null) preview.kill()
}

const report = {
  baseUrl,
  viewports: [{ width: 1907, height: 863 }, { width: 1164, height: 777 }],
  candidateRecords: cases.length,
  scope: 'BS9-010～023 candidate routes only; candidate data remains isolated from the formal card pool.',
  total: results.length,
  passed: results.filter((result) => result.status === 'PASS').length,
  failed: results.filter((result) => result.status !== 'PASS'),
  results,
}
writeFileSync(resolve(outputDirectory, 'bs9-010-023-browser.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
process.exitCode = report.failed.length > 0 ? 1 : 0
