import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { routeBs11OfficialArt } from './bs11-official-art-route.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const baseUrl = process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'
const artifactDir = resolve(root, 'test-results/bs11-050-053-browser')
mkdirSync(artifactDir, { recursive: true })
const viewports = [
  { width: 1280, height: 720 },
  { width: 1164, height: 777 },
]
const candidate = JSON.parse(await (await import('node:fs/promises')).readFile(
  resolve(root, 'data/cards/official-dark-enchantress-war-bs11.en.json'),
  'utf8',
))
const cards = Object.fromEntries(candidate.cards
  .filter((card) => /^BS11-05[0-3](?:@1)?$/.test(card.cardNumber))
  .map((card) => [card.cardNumber, { name: card.name, imageUrl: card.imageUrl }]))
const contractCards = Object.keys(cards).join(',')
const requestedCards = process.env.BS11_BROWSER_CARDS?.split(',').map((value) => value.trim()).filter(Boolean)
const selectedCards = requestedCards?.length
  ? Object.keys(cards).filter((cardId) => requestedCards.includes(cardId))
  : Object.keys(cards)
if (!selectedCards.length) throw new Error('No BS11-050～053 cards were selected')
if (requestedCards?.some((cardId) => !Object.hasOwn(cards, cardId))) {
  throw new Error(`Unknown BS11_BROWSER_CARDS entry: ${requestedCards.filter((cardId) => !Object.hasOwn(cards, cardId)).join(', ')}`)
}
const requestedWidths = process.env.BS11_BROWSER_WIDTHS?.split(',').map(Number).filter(Number.isFinite)
const selectedViewports = requestedWidths?.length
  ? viewports.filter((viewport) => requestedWidths.includes(viewport.width))
  : viewports
if (!selectedViewports.length) throw new Error('No supported BS11 Browser viewport was selected')
if (requestedWidths?.some((width) => !viewports.some((viewport) => viewport.width === width))) {
  throw new Error(`Unknown BS11_BROWSER_WIDTHS entry: ${requestedWidths.filter((width) => !viewports.some((viewport) => viewport.width === width)).join(', ')}`)
}

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const trace = (page) => page.evaluate(() =>
  Array.isArray(window.__braverseContractTrace) ? window.__braverseContractTrace : [],
)
const waitForCommand = (page, kind) => page.waitForFunction(
  (wanted) => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === wanted),
  kind,
)
const hasVisible = async (locator) => (await locator.count()) > 0 && locator.first().isVisible().catch(() => false)

const readArt = async (locator) => locator.evaluate((node) => {
  const image = node.querySelector('img')
  const fallback = node.querySelector('.card-fallback')
  return {
    image: image ? {
      src: image.getAttribute('src'),
      alt: image.getAttribute('alt'),
      loaded: image.complete && image.naturalWidth > 0,
    } : null,
    fallbackName: fallback?.querySelector('strong')?.textContent?.trim() ?? null,
  }
})
const assertArt = (art, cardNumber) => {
  const card = cards[cardNumber]
  if (art.image) {
    assert.equal(art.image.src, card.imageUrl, `${cardNumber} must render its exact candidate image URL`)
    assert.equal(art.image.alt, card.name, `${cardNumber} image alt text`)
  } else {
    assert.equal(art.fallbackName, card.name, `${cardNumber} fallback must name the official card`)
  }
}

const readField = async (page, side) => page.locator(`.${side}-field`).evaluate((field) => {
  const getName = (entry) => entry.querySelector('.card-face')?.getAttribute('title') ??
    entry.querySelector('.card-face img')?.getAttribute('alt') ??
    entry.querySelector('.card-fallback strong')?.textContent?.trim() ?? null
  const getHp = (entry) => Number(entry.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN)
  const supports = [...field.querySelectorAll('.support-card-wrap')].map((entry) => ({
    id: entry.getAttribute('data-card-instance-id'),
    name: getName(entry),
    rested: Boolean(entry.querySelector('.card-face.is-rested')),
  }))
  const battle = [...field.querySelectorAll('.combat-card-wrap')].map((entry) => ({
    id: entry.getAttribute('data-card-instance-id'),
    name: getName(entry),
    hp: getHp(entry),
    rested: Boolean(entry.querySelector('.card-face.is-rested')),
  }))
  const hand = [...field.querySelectorAll('.hand-card-wrap')].map((entry) => ({
    id: entry.getAttribute('data-card-instance-id'),
    name: getName(entry),
  }))
  const zoneCount = (selector) => Number(field.querySelector(selector)?.textContent?.match(/\d+/)?.[0] ?? NaN)
  return {
    supports,
    battle,
    hand,
    deckCount: zoneCount('.deck-zone .resource-summary > strong'),
    discardCount: zoneCount('.discard-zone.resource-summary > strong'),
  }
})
const readBothFields = async (page) => ({
  bottom: await readField(page, 'bottom'),
  top: await readField(page, 'top'),
})

const recordBrowserIssues = (page, evidence) => {
  page.on('pageerror', (error) => evidence.errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const url = message.location().url ?? ''
    if ((url.includes('cookierunbraverse.com/data/en_storage/') || message.text().includes('cookierunbraverse.com/data/en_storage/')) && /ERR_NETWORK_ACCESS_DENIED|Failed to load resource|ERR_BLOCKED_BY_CLIENT/i.test(message.text())) {
      evidence.knownImageNetworkRestrictions.push({ type: 'console', url, text: message.text() })
      return
    }
    if (url.endsWith('/favicon.ico') && message.text().includes('404')) return
    evidence.errors.push(`console: ${message.text()} @ ${url}`)
  })
  page.on('requestfailed', (request) => {
    const url = request.url()
    if (url.startsWith('https://cookierunbraverse.com/data/en_storage/')) {
      evidence.knownImageNetworkRestrictions.push({ type: 'requestfailed', url, reason: request.failure()?.errorText ?? 'unknown' })
    } else if (!url.endsWith('/favicon.ico')) {
      evidence.errors.push(`request failed: ${url} ${request.failure()?.errorText ?? 'unknown'}`)
    }
  })
  page.on('response', (response) => {
    if (response.status() < 400) return
    const url = response.url()
    if (url.startsWith('https://cookierunbraverse.com/data/en_storage/')) {
      evidence.knownImageNetworkRestrictions.push({ type: 'image-response', status: response.status(), url })
    } else if (!url.endsWith('/favicon.ico')) {
      evidence.errors.push(`${response.status()} response: ${url}`)
    }
  })
}

const skipAnimations = async (page) => {
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const button = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await hasVisible(button)) await button.click()
    await wait(100)
  }
}
const waitForPostAttack = async (page) => {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const optionalCost = page.locator('.optional-cost-attack-inline:visible')
    if (await optionalCost.count()) return 'optional-cost'
    const effectPanel = page.locator('.effect-panel[role="alertdialog"]:visible')
    if (await effectPanel.count()) return 'effect-panel'
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await hasVisible(skip)) await skip.click()
    const nextPhase = page.locator('.next-phase-button')
    if (await nextPhase.count() && await nextPhase.isEnabled()) return 'ready'
    await wait(100)
  }
  throw new Error('attack did not settle into a decision or ready state')
}

const sourceCard = (page, cardName) => page.locator('.bottom-field .combat-card-wrap').filter({
  has: page.locator(`.card-face[title="${cardName}"]`),
}).first()
const optionalModal = (page) => page.locator('.optional-cost-attack-inline:visible').first()
const activeEffectPanel = (page) => page.locator('.effect-panel[role="alertdialog"]:visible').last()
const readButtonName = async (button) => button.locator('.card-face img').getAttribute('alt').catch(async () =>
  button.locator('.card-fallback strong').textContent().then((value) => value?.trim() ?? null),
)
const clickEffectPrimary = async (panel, description) => {
  const button = panel.locator('.effect-panel-primary-action').last()
  await button.waitFor({ state: 'visible' })
  assert.equal(await button.isEnabled(), true, `${description} confirmation must be enabled`)
  await button.click()
}

const declareAttack = async (page, evidence, attackCost) => {
  const source = sourceCard(page, evidence.name)
  await source.waitFor({ state: 'visible' })
  evidence.art = await readArt(source.locator('.card-face').first())
  assertArt(evidence.art, evidence.cardNumber)
  evidence.sourceId = await source.getAttribute('data-card-instance-id')
  evidence.before = await readBothFields(page)
  const targetBefore = evidence.before.top.battle[0]
  assert.ok(targetBefore, `${evidence.cardNumber} fixture must expose an opponent Cookie target`)
  evidence.targetId = targetBefore.id
  await source.locator('.card-face.is-attackable').click()
  const payment = page.locator('[data-testid="attack-payment-panel"]')
  await payment.waitFor({ state: 'visible' })
  const chosenPaymentIds = []
  for (let index = 0; index < attackCost; index += 1) {
    const candidates = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)')
    assert.ok(await candidates.count() > 0, `${evidence.cardNumber} needs active green attack payment ${index + 1}/${attackCost}`)
    const choice = candidates.first()
    const paymentName = await readButtonName(choice)
    assert.ok(paymentName, 'attack payment must display a named support card')
    evidence.attackPaymentNames.push(paymentName)
    await choice.click()
    chosenPaymentIds.push(index)
  }
  evidence.attackPaymentCount = chosenPaymentIds.length
  assert.match(await payment.innerText(), /付款合法/)
  const target = page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${targetBefore.id}"] .card-face[aria-label^="選擇攻擊目標："]`)
  await target.waitFor({ state: 'visible' })
  await target.click()
  await waitForCommand(page, 'declare-attack')
  evidence.afterAttackDecision = await waitForPostAttack(page)
  await skipAnimations(page)
  return { source, targetBefore }
}

const finishOptionalCost = async (page, evidence, mode) => {
  const modal = optionalModal(page)
  await modal.waitFor({ state: 'visible' })
  evidence.optionalCostText = await modal.innerText()
  if (['BS11-050', 'BS11-053'].includes(evidence.cardNumber.split('@')[0])) {
    assert.match(evidence.optionalCostText, /將此餅乾送入棄牌區/)
  }
  if (mode === 'skip') {
    await modal.getByRole('button', { name: '略過', exact: true }).click()
    await waitForCommand(page, 'resolve-optional-cost-attack')
    return
  }

  await modal.getByRole('button', { name: '支付', exact: true }).click()
  if (evidence.cardNumber.startsWith('BS11-050')) {
    const energy = modal.locator('.optional-cost-col').filter({ hasText: '能量' }).first()
    await energy.waitFor({ state: 'visible' })
    const choices = energy.locator('.modal-card-options button:not(.is-selected)')
    assert.ok(await choices.count() > 0, '050 Then must offer one active G payment after the normal attack cost')
    evidence.thenPaymentName = await readButtonName(choices.first())
    await choices.first().click()
    const primary = modal.locator('.modal-actions-sticky button').last()
    await primary.waitFor({ state: 'visible' })
    assert.equal(await primary.isEnabled(), true)
    await primary.click()
  } else if (evidence.cardNumber.startsWith('BS11-052')) {
    const cost = modal.locator('.optional-cost-col').filter({ hasText: '代價' }).first()
    await cost.waitFor({ state: 'visible' })
    const discard = cost.locator('.modal-card-options button').filter({ hasText: 'Peach Baos' }).first()
    await discard.waitFor({ state: 'visible' })
    evidence.discardedItem = await readButtonName(discard)
    await discard.click()
    await modal.locator('.modal-actions-sticky button').last().click()
    const targetStep = modal.locator('.optional-cost-col').filter({ hasText: '目標' }).first()
    await targetStep.waitFor({ state: 'visible' })
    const targetChoice = targetStep.locator('.modal-card-options button:not(.is-selected)').first()
    assert.ok(await targetChoice.count(), '052 positive Then must expose its opponent Cookie as the optional damage target')
    evidence.thenTargetName = await readButtonName(targetChoice)
    await targetChoice.click()
    await modal.locator('.modal-actions-sticky button').last().click()
  } else {
    const confirm = modal.locator('.modal-actions-sticky button').last()
    await confirm.waitFor({ state: 'visible' })
    assert.equal(await confirm.isEnabled(), true)
    await confirm.click()
  }
  await waitForCommand(page, 'resolve-optional-cost-attack')
}

const finishDrawIfPresent = async (page, evidence, drawCount) => {
  const modal = page.locator('.draw-up-to-modal:visible')
  await modal.waitFor({ state: 'visible' })
  const option = modal.locator('.draw-up-to-option').nth(drawCount)
  await option.waitFor({ state: 'visible' })
  await option.click()
  evidence.drawCount = drawCount
  await modal.locator('.draw-up-to-actions button').last().click()
  await waitForCommand(page, 'resolve-draw-up-to')
}

const runAttackCase = async (page, evidence) => {
  const baseCardNumber = evidence.cardNumber.split('@')[0]
  const attackCost = baseCardNumber === 'BS11-050' ? 1 : 3
  const damage = baseCardNumber === 'BS11-050' ? 1 : baseCardNumber === 'BS11-051' ? 3 : baseCardNumber === 'BS11-052' ? 2 : 3
  await declareAttack(page, evidence, attackCost)

  if (baseCardNumber === 'BS11-051') {
    if (evidence.negative) {
      await page.locator('.next-phase-button').waitFor({ state: 'visible' })
      await page.waitForFunction(() => {
        const button = document.querySelector('.next-phase-button')
        return button instanceof HTMLButtonElement && !button.disabled
      })
    } else {
      const panel = activeEffectPanel(page)
      await panel.waitFor({ state: 'visible' })
      const targets = panel.locator('.effect-candidates-target:visible button:not(.is-selected)')
      assert.equal(await targets.count(), 3, '051 should expose only its three rested attack-payment supports as ready targets')
      const activatedSupportNames = [await readButtonName(targets.nth(0)), await readButtonName(targets.nth(1))]
      await targets.nth(0).click()
      await targets.nth(0).click()
      evidence.activatedSupportNames = activatedSupportNames
      await clickEffectPrimary(panel, '051 set-active Then')
      await waitForCommand(page, 'resolve-attack-effect')
    }
  } else if (baseCardNumber === 'BS11-052') {
    if (evidence.negative) {
      const modal = optionalModal(page)
      await modal.waitFor({ state: 'visible' })
      assert.match(await modal.innerText(), /支付|綠色|道具/)
      const pay = modal.getByRole('button', { name: '支付', exact: true })
      assert.equal(await pay.isEnabled(), false, '052 negative route has no green Item cost candidate')
      await finishOptionalCost(page, evidence, 'skip')
    } else {
      await finishOptionalCost(page, evidence, 'pay')
      await finishDrawIfPresent(page, evidence, 2)
    }
  } else if (evidence.negative) {
    await page.waitForFunction(() => {
      const next = document.querySelector('.next-phase-button')
      const modal = document.querySelector('.optional-cost-attack-inline')
      const effect = document.querySelector('.effect-panel[role="alertdialog"]')
      const visible = (node) => node instanceof HTMLElement && node.getClientRects().length > 0
      return next instanceof HTMLButtonElement && !next.disabled && !visible(modal) && !visible(effect)
    })
  } else {
    await finishOptionalCost(page, evidence, 'pay')
  }

  await skipAnimations(page)
  const after = await readBothFields(page)
  evidence.after = after
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'declare-attack'), 'attack must use the normal declare-attack command')
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-attack-effect'), 'normal attack Then must resolve through the attack-effect command')
  const targetAfter = after.top.battle.find((entry) => entry.id === evidence.targetId)
  if (baseCardNumber === 'BS11-051' && !evidence.negative) {
    assert.equal(targetAfter, undefined, '051 positive attack must faint the target Cookie')
    const supports = after.bottom.supports
    assert.equal(supports.filter(({ rested }) => !rested).length, 6, '051 Then must ready exactly two of the three attack payments')
  } else {
    assert.ok(targetAfter, `${evidence.cardNumber} target should survive this fixture attack`)
    const expectedDamage = baseCardNumber === 'BS11-052' && !evidence.negative ? damage + 1 : damage
    assert.equal(targetAfter.hp, evidence.before.top.battle[0].hp - expectedDamage)
  }
  if (baseCardNumber === 'BS11-050' || baseCardNumber === 'BS11-053') {
    const sourceAfter = after.bottom.battle.find((entry) => entry.id === evidence.sourceId)
    if (evidence.negative) {
      assert.ok(sourceAfter, `${baseCardNumber} negative route must not pay the self-trash Then cost`)
    } else {
      assert.equal(sourceAfter, undefined, `${baseCardNumber} positive route must pay the self-trash Then cost`)
      const newSupport = after.bottom.supports.find((support) => support.name === 'Peach Baos' && !evidence.before.bottom.supports.some((beforeSupport) => beforeSupport.id === support.id))
      assert.ok(newSupport, `${baseCardNumber} positive Then must place the top card into support`)
      assert.equal(newSupport.rested, true, `${baseCardNumber} top-deck support must enter rested`)
    }
  }
  if (baseCardNumber === 'BS11-052') {
    if (evidence.negative) {
      assert.equal(after.bottom.hand.length, evidence.before.bottom.hand.length, '052 skipped cost must preserve the hand')
      assert.equal(after.bottom.deckCount, evidence.before.bottom.deckCount, '052 skipped cost must not draw')
    } else {
      assert.equal(after.bottom.hand.length, evidence.before.bottom.hand.length + 1, '052 discards one, then draws two')
      assert.equal(after.bottom.deckCount, evidence.before.bottom.deckCount - 2)
    }
  }
  evidence.result = evidence.negative
    ? `${baseCardNumber} negative path: normal attack paid/resolved; its Then condition or cost did not change the gated state`
    : `${baseCardNumber} positive path: normal attack paid/resolved and the card-specific Then effect completed`
}

const run053ActivateCase = async (page, evidence) => {
  const source = sourceCard(page, evidence.name)
  await source.waitFor({ state: 'visible' })
  evidence.art = await readArt(source.locator('.card-face').first())
  assertArt(evidence.art, evidence.cardNumber)
  evidence.before = await readBothFields(page)
  const sourceId = await source.getAttribute('data-card-instance-id')
  const skillButton = source.locator('.skill-action').filter({ hasText: '啟動技能' })
  await skillButton.waitFor({ state: 'visible' })
  assert.equal(await skillButton.isEnabled(), true, '053 Activate should be available with an active green payment')
  await skillButton.click()
  const panel = activeEffectPanel(page)
  await panel.waitFor({ state: 'visible' })
  const payment = panel.locator('.effect-candidates-payment:visible button:not(.is-selected)')
  assert.ok(await payment.count() > 0, '053 Activate must offer its green energy payment')
  evidence.skillPaymentName = await readButtonName(payment.first())
  await payment.first().click()
  await clickEffectPrimary(panel, '053 Activate payment')
  await waitForCommand(page, 'begin-activate-skill')

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const commands = await trace(page)
    if (commands.some((entry) => entry.commandKind === 'resolve-ability-effect')) break
    const currentPanel = activeEffectPanel(page)
    if (!(await hasVisible(currentPanel))) break
    await clickEffectPrimary(currentPanel, '053 Activate effect')
    await wait(200)
  }
  await waitForCommand(page, 'resolve-ability-effect')
  await skipAnimations(page)
  evidence.after = await readBothFields(page)
  evidence.trace = await trace(page)
  const beforeTargets = evidence.before.top.battle
  const afterById = new Map(evidence.after.top.battle.map((entry) => [entry.id, entry]))
  const resultTrace = evidence.trace.find((entry) => entry.commandKind === 'resolve-ability-effect')
  const resultSteps = resultTrace?.steps.join('\n') ?? ''
  if (evidence.negative) {
    assert.match(resultSteps, /沒有符合效果目標條件（剩餘 HP 至少 5 張）/)
    assert.deepEqual(evidence.after.top.battle.map(({ id, hp }) => ({ id, hp })), beforeTargets.map(({ id, hp }) => ({ id, hp })), '053 negative route must not affect Cookies below five remaining HP')
  } else {
    assert.match(resultSteps, /HP 張數 5→4/)
    assert.equal(afterById.get(beforeTargets[0].id)?.hp, beforeTargets[0].hp - 1, '053 must remove one HP from an opponent at exactly five remaining HP')
    assert.equal(afterById.get(beforeTargets[1].id)?.hp, beforeTargets[1].hp, '053 must leave the four-HP Cookie unchanged')
  }
  assert.equal(evidence.after.bottom.supports.find((entry) => entry.name === evidence.skillPaymentName)?.rested, true, '053 Activate must rest the selected G payment')
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'begin-activate-skill'))
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect'))
  assert.equal(evidence.after.bottom.battle.find((entry) => entry.id === sourceId)?.name, evidence.name)
  evidence.result = evidence.negative
    ? '053 Activate paid G and resolved; no opponent Cookie met the five-HP threshold'
    : '053 Activate paid G and removed exactly one HP from the five-HP target only'
}

const routeKindsForCard = (cardNumber) => cardNumber.startsWith('BS11-053')
  ? ['positive', 'negative', 'activate-positive', 'activate-negative']
  : ['positive', 'negative']

const runCase = async (browser, viewport, cardNumber, routeKind) => {
  const card = cards[cardNumber]
  const negative = routeKind.endsWith('negative')
  const route = `bs11-fourteenth-batch:${cardNumber}:${routeKind}`
  const page = await browser.newPage({ viewport })
  await routeBs11OfficialArt(page)
  page.setDefaultTimeout(20000)
  const evidence = {
    cardNumber,
    name: card.name,
    route,
    routeKind,
    viewport,
    negative,
    status: 'FAIL',
    errors: [],
    knownImageNetworkRestrictions: [],
    attackPaymentNames: [],
  }
  recordBrowserIssues(page, evidence)
  try {
    const url = new URL('/', baseUrl)
    url.searchParams.set('test-state', route)
    url.searchParams.set('contract-card', contractCards)
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    evidence.initialStateText = await page.locator('.game-shell').innerText()
    if (routeKind.startsWith('activate-')) await run053ActivateCase(page, evidence)
    else await runAttackCase(page, evidence)
    assert.deepEqual(evidence.errors, [], `${cardNumber} Browser errors: ${evidence.errors.join('; ')}`)
    evidence.status = 'PASS'
  } catch (error) {
    evidence.error = error.stack ?? String(error)
    evidence.body = await page.locator('body').innerText().catch(() => '')
    evidence.trace = await trace(page).catch(() => [])
    evidence.state = await readBothFields(page).catch(() => null)
  } finally {
    await page.close()
  }
  console.log(`${evidence.status} ${cardNumber} ${routeKind} ${viewport.width}x${viewport.height}${evidence.error ? `: ${evidence.error.split('\n')[0]}` : ''}`)
  return evidence
}

const browserExecutable = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
const chromiumBrowser = await chromium.launch({
  headless: true,
  ...(browserExecutable ? { executablePath: browserExecutable } : {}),
})
const results = []
try {
  for (const viewport of selectedViewports) {
    for (const cardNumber of selectedCards) {
      for (const routeKind of routeKindsForCard(cardNumber)) {
        results.push(await runCase(chromiumBrowser, viewport, cardNumber, routeKind))
      }
    }
  }
} finally {
  await chromiumBrowser.close()
}

const failed = results.filter((entry) => entry.status !== 'PASS').length
const artifactPath = resolve(artifactDir, `bs11-050-053-browser-${Date.now()}.json`)
const artifact = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  routeFormat: 'test-state=bs11-fourteenth-batch:BS11-050|051|052|053[@1]:positive|negative; plus BS11-053[@1]:activate-positive|activate-negative',
  scope: `Candidate-only Browser evidence through normal local UI, including attack declaration/payment and the 053 Activate G payment. Selected cards: ${selectedCards.join(', ')}; selected viewports: ${selectedViewports.map(({ width, height }) => `${width}x${height}`).join(', ')}. Not formal deck, full battle, or online acceptance.`,
  viewports: selectedViewports,
  summary: {
    total: results.length,
    passed: results.length - failed,
    failed,
    blocked: results.filter((entry) => Boolean(entry.blocker)).length,
  },
  results,
}
writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ artifactPath, summary: artifact.summary }, null, 2))
const expectedTotal = selectedViewports.length * selectedCards.reduce(
  (total, cardNumber) => total + routeKindsForCard(cardNumber).length,
  0,
)
if (results.length !== expectedTotal || failed > 0) process.exitCode = 1
