import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
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
const artifactDir = resolve(root, 'test-results/bs11-054-058-browser')
mkdirSync(artifactDir, { recursive: true })
const viewports = [
  { width: 1280, height: 720 },
  { width: 1164, height: 777 },
]
const candidate = JSON.parse(await readFile(
  resolve(root, 'data/cards/official-dark-enchantress-war-bs11.en.json'),
  'utf8',
))
const cards = Object.fromEntries(candidate.cards
  .filter((card) => /^BS11-05[4-8]$/.test(card.cardNumber))
  .map((card) => [card.cardNumber, { name: card.name, imageUrl: card.imageUrl }]))
const contractCards = Object.keys(cards).join(',')

const cases = [
  { id: '054-on-play-one', route: 'card:BS11-054', cardNumber: 'BS11-054', behavior: 'on-play', targetCount: 1 },
  { id: '054-on-play-zero', route: 'card-negative:BS11-054', cardNumber: 'BS11-054', behavior: 'on-play', targetCount: 0 },
  { id: '054-followthrough-positive', route: 'card-attack:BS11-054', cardNumber: 'BS11-054', behavior: 'attack-054' },
  { id: '054-followthrough-blocked', route: 'card-attack-negative:BS11-054', cardNumber: 'BS11-054', behavior: 'attack-054-blocked' },
  { id: '055-attack-positive', route: 'card-attack:BS11-055', cardNumber: 'BS11-055', behavior: 'attack-055' },
  { id: '055-attack-blocked', route: 'card-attack-negative:BS11-055', cardNumber: 'BS11-055', behavior: 'attack-055-blocked' },
  { id: '056-activate-draw-one', route: 'card-skill:BS11-056', cardNumber: 'BS11-056', behavior: 'activate-056', drawCount: 1 },
  { id: '056-activate-draw-zero', route: 'card-skill:BS11-056', cardNumber: 'BS11-056', behavior: 'activate-056', drawCount: 0 },
  { id: '056-condition-blocked', route: 'card-skill-negative:BS11-056', cardNumber: 'BS11-056', behavior: 'activate-056-blocked' },
  { id: '058-response-one', route: 'card-skill:BS11-058', cardNumber: 'BS11-058', behavior: 'response-058', targetCount: 1 },
  { id: '058-response-zero', route: 'card-skill:BS11-058', cardNumber: 'BS11-058', behavior: 'response-058', targetCount: 0 },
  { id: '058-response-blocked', route: 'card-skill-negative:BS11-058', cardNumber: 'BS11-058', behavior: 'response-058-blocked' },
]

const requestedCases = process.env.BS11_BROWSER_CASES?.split(',').map((value) => value.trim()).filter(Boolean)
const selectedCases = requestedCases?.length
  ? cases.filter((testCase) => requestedCases.includes(testCase.id))
  : cases
if (!selectedCases.length) throw new Error('No BS11-054～058 Browser cases were selected')
if (requestedCases?.some((caseId) => !cases.some((testCase) => testCase.id === caseId))) {
  throw new Error(`Unknown BS11_BROWSER_CASES entry: ${requestedCases.filter((caseId) => !cases.some((testCase) => testCase.id === caseId)).join(', ')}`)
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
  (Array.isArray(window.__braverseContractTrace) ? window.__braverseContractTrace : [])
    .map((entry) => ({
      commandKind: entry.commandKind,
      steps: Array.isArray(entry.steps) ? entry.steps.join('\n') : '',
    })),
)
const hasCommand = async (page, commandKind) =>
  (await trace(page)).some((entry) => entry.commandKind === commandKind)
const waitForCommand = (page, commandKind) => page.waitForFunction(
  (kind) => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === kind),
  commandKind,
)
const hasVisible = async (locator) => (await locator.count()) > 0 && locator.first().isVisible().catch(() => false)

const readArt = async (face) => face.evaluate((node) => {
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
  const expected = cards[cardNumber]
  if (art.image) {
    assert.equal(art.image.src, expected.imageUrl, `${cardNumber} must render its candidate image URL`)
    assert.equal(art.image.alt, expected.name, `${cardNumber} image alt text`)
  } else {
    assert.equal(art.fallbackName, expected.name, `${cardNumber} fallback must name the candidate card`)
  }
}

const readField = async (page, side) => page.locator(`.${side}-field`).evaluate((field, fieldSide) => {
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
  // The test report never serializes the opponent's hand or hidden deck order.
  const hand = fieldSide === 'bottom'
    ? [...field.querySelectorAll('.hand-card-wrap')].map((entry) => ({
      id: entry.getAttribute('data-card-instance-id'),
      name: getName(entry),
    }))
    : undefined
  const count = (selector) => Number(field.querySelector(selector)?.textContent?.match(/\d+/)?.[0] ?? NaN)
  return {
    supports,
    battle,
    ...(hand ? { hand } : {}),
    deckCount: fieldSide === 'bottom' ? count('.deck-zone .resource-summary > strong') : undefined,
    discardCount: count('.discard-zone.resource-summary > strong'),
  }
}, side)
const readFields = async (page) => ({
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

const sourceCard = (page, side, cardName) => page.locator(`.${side}-field .combat-card-wrap`).filter({
  has: page.locator(`.card-face[title="${cardName}"]`),
}).first()
const readCardName = async (button) => button.locator('.card-face img').getAttribute('alt').catch(async () =>
  button.locator('.card-fallback strong').textContent().then((value) => value?.trim() ?? null),
)
const activeEffectPanel = (page) => page.locator('.effect-panel[role="alertdialog"]:visible').last()

const deployFromHand = async (page, cardNumber, evidence) => {
  const card = cards[cardNumber]
  const handEntry = page.locator('.bottom-field .hand-card-wrap').filter({
    has: page.locator(`.card-face[title="${card.name}"]`),
  }).first()
  await handEntry.waitFor({ state: 'visible' })
  const face = handEntry.locator('.card-face').first()
  evidence.art = await readArt(face)
  assertArt(evidence.art, cardNumber)
  await face.click()
  const deploy = handEntry.locator('.hand-card-action').filter({ hasText: '登場' }).first()
  assert.equal(await deploy.isEnabled(), true, `${cardNumber} should allow normal deployment`)
  await deploy.click()
  await skipAnimations(page)
  const source = sourceCard(page, 'bottom', card.name)
  await source.waitFor({ state: 'visible' })
  return source
}

const resolveEffectPanel = async (page, commandKind, maxSteps = 4) => {
  for (let step = 0; step < maxSteps; step += 1) {
    if (await hasCommand(page, commandKind)) return
    const panel = activeEffectPanel(page)
    await panel.waitFor({ state: 'visible' })
    const primary = panel.locator('.effect-panel-primary-action').last()
    await primary.waitFor({ state: 'visible' })
    assert.equal(await primary.isEnabled(), true, `${commandKind} effect step ${step + 1} should be confirmable`)
    await primary.click()
    await wait(180)
  }
  await waitForCommand(page, commandKind)
}

const run054OnPlay = async (page, testCase, evidence) => {
  const before = await readFields(page)
  const source = await deployFromHand(page, 'BS11-054', evidence)
  const panel = activeEffectPanel(page)
  await panel.waitFor({ state: 'visible' })
  evidence.effectPanelText = await panel.innerText()
  const targets = panel.locator('.effect-candidates-target button')
  const targetNames = await targets.allTextContents()
  assert.equal(await targets.count(), 2, '054 On Play should expose both opponent Cookies as legal targets')
  assert.ok(targetNames.some((value) => value.includes(cards['BS11-055'].name)))
  assert.ok(targetNames.some((value) => value.includes(cards['BS11-058'].name)))
  const targetBefore = before.top.battle.find(({ name }) => name === cards['BS11-055'].name)
  const witnessBefore = before.top.battle.find(({ name }) => name === cards['BS11-058'].name)
  assert.ok(targetBefore && witnessBefore, '054 fixture must contain its intended Cookie and a public witness')

  if (testCase.targetCount === 1) {
    const target = panel.locator('.effect-candidates-target button').filter({
      hasText: cards['BS11-055'].name,
    }).first()
    await target.click()
    evidence.selectedTarget = cards['BS11-055'].name
  } else {
    evidence.selectedTarget = null
    evidence.legalNoOp = 'The up-to-one target selection was confirmed with zero Cookies selected.'
  }
  await resolveEffectPanel(page, 'resolve-ability-effect')
  await skipAnimations(page)
  evidence.after = await readFields(page)
  evidence.trace = await trace(page)
  evidence.sourceInstanceId = await source.getAttribute('data-card-instance-id')
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'begin-activate-skill'))
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect'))
  const targetAfter = evidence.after.top.battle.find(({ id }) => id === targetBefore.id)
  const witnessAfter = evidence.after.top.battle.find(({ id }) => id === witnessBefore.id)
  assert.equal(targetAfter?.hp, targetBefore.hp, '054 only adds an attack requirement; it must not alter HP')
  assert.equal(witnessAfter?.hp, witnessBefore.hp, '054 must not change the unselected Cookie')
  evidence.result = testCase.targetCount === 1
    ? 'Normal On Play UI selected the intended opponent Cookie; no HP changed.'
    : 'Normal On Play UI confirmed the legal zero-target path; no opponent Cookie changed.'
}

const finishRequiredHandDiscard = async (page, evidence) => {
  const modal = page.locator('.hand-discard-modal:visible').first()
  await modal.waitFor({ state: 'visible' })
  evidence.handDiscardPrompt = await modal.locator('.faint-target-hint').innerText()
  assert.match(evidence.handDiscardPrompt, /必須選擇 2 張手牌棄置/)
  const choices = modal.locator('.hand-discard-card-option button')
  assert.equal(await choices.count(), 2, '054 follow-through fixture should expose exactly two own hand cards')
  evidence.discardedOwnHandCards = [await readCardName(choices.nth(0)), await readCardName(choices.nth(1))]
  await choices.nth(0).click()
  await choices.nth(1).click()
  const confirm = modal.getByRole('button', { name: '確認棄置 (2)', exact: true })
  assert.equal(await confirm.isEnabled(), true, 'exactly two cards should enable the required discard')
  await confirm.click()
  await waitForCommand(page, 'resolve-opponent-hand-discard')
}

const waitForAttackSettlement = async (page) => {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const response = page.locator('.attack-response-modal:visible').first()
    if (await hasVisible(response)) {
      const skip = response.getByRole('button', { name: '不發動', exact: true })
      if (await hasVisible(skip)) await skip.click()
    }
    const optional = page.locator('.optional-cost-attack-inline:visible')
    const discard = page.locator('.hand-discard-modal:visible')
    const effect = page.locator('.effect-panel[role="alertdialog"]:visible')
    const nextPhase = page.locator('.next-phase-button')
    if (!(await hasVisible(optional)) && !(await hasVisible(discard)) && !(await hasVisible(effect)) &&
      await nextPhase.count() && await nextPhase.isEnabled()) return
    const animation = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await hasVisible(animation)) await animation.click()
    await wait(100)
  }
  throw new Error('Attack did not settle into the next legal action state')
}

const runAttack = async (page, testCase, evidence, cardNumber, cost, damage) => {
  const card = cards[cardNumber]
  const source = sourceCard(page, 'bottom', card.name)
  await source.waitFor({ state: 'visible' })
  evidence.art = await readArt(source.locator('.card-face').first())
  assertArt(evidence.art, cardNumber)
  evidence.before = await readFields(page)
  evidence.sourceInstanceId = await source.getAttribute('data-card-instance-id')
  const attackFace = source.locator('.card-face.is-attackable')

  if (testCase.behavior.endsWith('-blocked')) {
    if (cardNumber === 'BS11-054') {
      assert.equal(await attackFace.count(), 1, '054 should expose the attack action before its hand-discard rule is checked')
      await attackFace.click()
      const payment = page.locator('[data-testid="attack-payment-panel"]')
      await payment.waitFor({ state: 'visible' })
      for (let index = 0; index < cost; index += 1) {
        const choices = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)')
        assert.ok(await choices.count() > 0, `054 should offer legal B payment ${index + 1}/${cost}`)
        await choices.first().click()
      }
      const targetBefore = evidence.before.top.battle[0]
      const target = page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${targetBefore.id}"] .card-face[aria-label^="選擇攻擊目標："]`)
      await target.waitFor({ state: 'visible' })
      await target.click()
      const status = page.locator('.status-toast:visible')
      await status.waitFor({ state: 'visible' })
      evidence.blockedReason = await status.innerText()
      assert.match(evidence.blockedReason, /無法宣告攻擊：必須先棄置 2 張手牌/)
    } else {
      assert.equal(evidence.before.bottom.supports.filter(({ rested }) => !rested).length, 2)
      if (await attackFace.count()) {
        await attackFace.click()
        const payment = page.locator('[data-testid="attack-payment-panel"]')
        await payment.waitFor({ state: 'visible' })
        const choices = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)')
        assert.equal(await choices.count(), 2, '055 blocked fixture should expose only two active supports for NNN')
        await choices.nth(0).click()
        await choices.nth(1).click()
        evidence.blockedPaymentText = await payment.innerText()
        await payment.getByRole('button', { name: '取消攻擊', exact: true }).click()
      } else {
        evidence.blockedReason = 'No attack action was available while only two of three NNN supports were active.'
      }
    }
    evidence.trace = await trace(page)
    assert.equal(evidence.trace.some((entry) => entry.commandKind === 'declare-attack'), false)
    if (cardNumber === 'BS11-054') {
      await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
    }
    evidence.after = await readFields(page)
    assert.deepEqual(evidence.after.bottom.supports, evidence.before.bottom.supports, `${cardNumber} blocked path must not rest support cards`)
    assert.deepEqual(evidence.after.top.battle, evidence.before.top.battle, `${cardNumber} blocked path must not change the target`)
    evidence.result = cardNumber === 'BS11-054'
      ? 'With legal B3 but only one hand card, the normal UI rejected the attack with the exact two-card prerequisite; no command resolved.'
      : 'NNN remained unpaid with only two active supports; no attack command or state change occurred.'
    return
  }

  await attackFace.click()
  const payment = page.locator('[data-testid="attack-payment-panel"]')
  await payment.waitFor({ state: 'visible' })
  const paymentNames = []
  const paymentIds = []
  for (let index = 0; index < cost; index += 1) {
    const choices = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)')
    assert.ok(await choices.count() > 0, `${cardNumber} should offer legal attack payment ${index + 1}/${cost}`)
    const choice = choices.first()
    paymentNames.push(await readCardName(choice))
    paymentIds.push(await choice.evaluate((node) => node.closest('.support-card-wrap')?.getAttribute('data-card-instance-id') ?? null))
    await choice.click()
  }
  evidence.attackPaymentNames = paymentNames
  evidence.attackPaymentIds = paymentIds
  assert.match(await payment.innerText(), /付款合法/)

  const targetBefore = evidence.before.top.battle[0]
  assert.ok(targetBefore, `${cardNumber} fixture must provide a visible opponent Cookie target`)
  evidence.target = { name: targetBefore.name, hpBefore: targetBefore.hp }
  const target = page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${targetBefore.id}"] .card-face[aria-label^="選擇攻擊目標："]`)
  await target.waitFor({ state: 'visible' })
  await target.click()
  await waitForCommand(page, 'declare-attack')

  if (cardNumber === 'BS11-054') {
    await finishRequiredHandDiscard(page, evidence)
  }
  await waitForAttackSettlement(page)
  await skipAnimations(page)
  evidence.after = await readFields(page)
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'declare-attack'))
  if (cardNumber === 'BS11-054') {
    assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-opponent-hand-discard'))
  }
  const targetAfter = evidence.after.top.battle.find(({ id }) => id === targetBefore.id)
  assert.ok(targetAfter, `${cardNumber} target should survive this damage fixture`)
  assert.equal(targetAfter.hp, targetBefore.hp - damage, `${cardNumber} should deal exactly ${damage} attack damage`)
  if (cardNumber === 'BS11-055') {
    assert.equal(new Set(paymentIds).size, 3, '055 should pay with three distinct active supports')
  }
  evidence.result = cardNumber === 'BS11-054'
    ? 'Normal attack paid B3, discarded exactly two own hand cards through the required prompt, then dealt 3 damage.'
    : 'Normal NNN attack paid with three active supports of mixed colors and dealt 4 damage.'
}

const run056Activate = async (page, testCase, evidence) => {
  const card = cards['BS11-056']
  const source = sourceCard(page, 'bottom', card.name)
  await source.waitFor({ state: 'visible' })
  evidence.art = await readArt(source.locator('.card-face').first())
  assertArt(evidence.art, 'BS11-056')
  evidence.before = await readFields(page)
  evidence.sourceInstanceId = await source.getAttribute('data-card-instance-id')
  const skill = source.locator('.skill-action').filter({ hasText: '啟動技能' })

  if (testCase.behavior.endsWith('-blocked')) {
    assert.ok((await skill.count()) === 0 || !(await skill.isEnabled()), '056 must be disabled without Cream Soda Cookie')
    evidence.trace = await trace(page)
    assert.equal(evidence.trace.some((entry) => entry.commandKind === 'begin-activate-skill'), false)
    evidence.after = await readFields(page)
    evidence.result = 'Activate was unavailable because the named Cream Soda Cookie condition was absent.'
    return
  }

  assert.equal(await skill.isEnabled(), true, '056 Activate should be available with Cream Soda Cookie in battle')
  await skill.click()
  await resolveEffectPanel(page, 'resolve-ability-effect')
  const drawModal = page.locator('.draw-up-to-modal:visible').first()
  await drawModal.waitFor({ state: 'visible' })
  const drawOption = drawModal.locator('.draw-up-to-option').nth(testCase.drawCount)
  await drawOption.waitFor({ state: 'visible' })
  await drawOption.click()
  evidence.drawCount = testCase.drawCount
  await drawModal.locator('.draw-up-to-actions button').last().click()
  await waitForCommand(page, 'resolve-draw-up-to')
  await skipAnimations(page)
  evidence.after = await readFields(page)
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'begin-activate-skill'))
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect'))
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-draw-up-to'))
  assert.equal(evidence.after.bottom.hand.length, evidence.before.bottom.hand.length + testCase.drawCount)
  assert.equal(evidence.after.bottom.deckCount, evidence.before.bottom.deckCount - testCase.drawCount)
  const currentSkill = sourceCard(page, 'bottom', card.name).locator('.skill-action').filter({ hasText: '啟動技能' })
  assert.ok((await currentSkill.count()) === 0 || !(await currentSkill.isEnabled()), '056 once-per-turn Activate must not remain available')
  evidence.result = `Cream Soda condition was met; Activate resolved and the player selected draw ${testCase.drawCount}. The once-per-turn action is no longer available.`
}

const run058Response = async (page, testCase, evidence) => {
  evidence.before = await readFields(page)
  const source = sourceCard(page, 'bottom', cards['BS11-058'].name)
  await source.waitFor({ state: 'visible' })
  evidence.art = await readArt(source.locator('.card-face').first())
  assertArt(evidence.art, 'BS11-058')
  const responseModal = page.locator('.attack-response-modal:visible').first()
  const responseOption = responseModal.locator('.attack-response-skill-option[data-card-id="BS11-058"]')

  if (testCase.behavior.endsWith('-blocked')) {
    if (await hasVisible(responseModal)) {
      assert.equal(await responseOption.count(), 0, '058 must not be offered with only one card to discard')
      await responseModal.getByRole('button', { name: '不發動', exact: true }).click()
    } else {
      evidence.responseWindowAutoAdvanced = true
    }
    await waitForAttackSettlement(page)
    evidence.trace = await trace(page)
    evidence.after = await readFields(page)
    assert.equal(evidence.trace.some((entry) => entry.commandKind === 'play-attack-response'), false)
    evidence.result = 'Opponent-attack response was not offered because the exact two-card hand cost could not be paid.'
    return
  }

  await responseModal.waitFor({ state: 'visible' })
  assert.equal(await responseOption.count(), 1, '058 should be offered in the legal opponent-attack response window')
  evidence.responsePrompt = await responseModal.innerText()
  await responseOption.click()
  const skillModal = page.locator('.attack-response-skill-modal:visible').first()
  await skillModal.waitFor({ state: 'visible' })
  const discardChoices = skillModal.locator('.attack-response-discard-candidates button')
  assert.equal(await discardChoices.count(), 2, '058 should expose exactly two own hand cards for its cost')
  evidence.discardedOwnHandCards = [await readCardName(discardChoices.nth(0)), await readCardName(discardChoices.nth(1))]
  await discardChoices.nth(0).click()
  await discardChoices.nth(1).click()
  const confirm = skillModal.getByRole('button', { name: '支付代價並發動', exact: true })
  assert.equal(await confirm.isEnabled(), true)
  await confirm.click()
  await waitForCommand(page, 'play-attack-response')

  const panel = activeEffectPanel(page)
  await panel.waitFor({ state: 'visible' })
  const candidates = panel.locator('.effect-candidates-target button')
  assert.ok(await candidates.count() > 0, '058 should offer at least one own Cookie target for +1 HP')
  const sourceName = cards['BS11-058'].name
  const sourceBefore = evidence.before.bottom.battle.find(({ name }) => name === sourceName)
  assert.ok(sourceBefore, '058 source Cookie must be public in its battle area')
  let selectedTarget = null
  if (testCase.targetCount === 1) {
    const ally = evidence.before.bottom.battle.find(({ id, hp }) => id !== sourceBefore.id && hp > 0)
    assert.ok(ally, '058 positive target fixture must contain a non-source ally')
    const targetButton = panel.locator('.effect-candidates-target button').filter({
      hasText: ally.name,
    }).first()
    await targetButton.waitFor({ state: 'visible' })
    await targetButton.click()
    selectedTarget = ally
    evidence.selectedTarget = ally.name
  } else {
    evidence.selectedTarget = null
    evidence.legalNoOp = 'The up-to-one Cookie target was confirmed with zero selected after paying the two-card cost.'
  }
  await resolveEffectPanel(page, 'resolve-ability-effect')
  await skipAnimations(page)
  evidence.after = await readFields(page)
  evidence.trace = await trace(page)
  const responseTrace = evidence.trace.find((entry) => entry.commandKind === 'play-attack-response')
  assert.ok(responseTrace, '058 response must resolve through the opponent-attack command')
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect'))
  assert.match(responseTrace.steps, /攻擊回應代價：棄置手牌：/)
  for (const discardedName of evidence.discardedOwnHandCards) {
    assert.ok(responseTrace.steps.includes(discardedName), `058 response trace should record the paid own-hand card ${discardedName}`)
  }
  if (selectedTarget) {
    const targetAfter = evidence.after.bottom.battle.find(({ id }) => id === selectedTarget.id)
    assert.equal(targetAfter?.hp, selectedTarget.hp + 1, '058 should add exactly one HP to the selected ally')
  } else {
    assert.deepEqual(
      evidence.after.bottom.battle.filter(({ id }) => id !== sourceBefore.id).map(({ id, hp }) => ({ id, hp })),
      evidence.before.bottom.battle.filter(({ id }) => id !== sourceBefore.id).map(({ id, hp }) => ({ id, hp })),
      '058 zero-target path must not change an unselected ally HP; the pending opponent attack may damage its declared target',
    )
  }
  const sourceAfter = evidence.after.bottom.battle.find(({ id }) => id === sourceBefore.id)
  assert.ok(sourceAfter, '058 source should survive the fixture opponent attack')
  assert.ok(sourceAfter.hp <= sourceBefore.hp, '058 response must not add HP to the unselected attack target')
  evidence.result = testCase.targetCount === 1
    ? 'Opponent-attack response paid exactly two cards and gave the selected ally +1 HP.'
    : 'Opponent-attack response paid exactly two cards, selected zero Cookies, and changed no Cookie HP.'
}

const runCase = async (browser, viewport, testCase) => {
  const card = cards[testCase.cardNumber]
  const page = await browser.newPage({ viewport })
  await routeBs11OfficialArt(page)
  page.setDefaultTimeout(20000)
  const evidence = {
    caseId: testCase.id,
    cardNumber: testCase.cardNumber,
    name: card.name,
    route: testCase.route,
    viewport,
    status: 'FAIL',
    errors: [],
    knownImageNetworkRestrictions: [],
  }
  recordBrowserIssues(page, evidence)
  try {
    const url = new URL('/', baseUrl)
    url.searchParams.set('test-state', testCase.route)
    url.searchParams.set('contract-card', contractCards)
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    evidence.initialFields = await readFields(page)

    if (testCase.behavior === 'on-play') await run054OnPlay(page, testCase, evidence)
    else if (testCase.behavior === 'attack-054') await runAttack(page, testCase, evidence, 'BS11-054', 3, 3)
    else if (testCase.behavior === 'attack-054-blocked') await runAttack(page, testCase, evidence, 'BS11-054', 3, 3)
    else if (testCase.behavior === 'attack-055') await runAttack(page, testCase, evidence, 'BS11-055', 3, 4)
    else if (testCase.behavior === 'attack-055-blocked') await runAttack(page, testCase, evidence, 'BS11-055', 3, 4)
    else if (testCase.behavior === 'activate-056') await run056Activate(page, testCase, evidence)
    else if (testCase.behavior === 'activate-056-blocked') await run056Activate(page, testCase, evidence)
    else if (testCase.behavior === 'response-058') await run058Response(page, testCase, evidence)
    else if (testCase.behavior === 'response-058-blocked') await run058Response(page, testCase, evidence)
    else throw new Error(`Unsupported case behavior: ${testCase.behavior}`)

    assert.deepEqual(evidence.errors, [], `${testCase.id} Browser errors: ${evidence.errors.join('; ')}`)
    evidence.status = 'PASS'
  } catch (error) {
    evidence.error = error.stack ?? String(error)
    evidence.trace = await trace(page).catch(() => [])
    evidence.fieldsAtFailure = await readFields(page).catch(() => null)
  } finally {
    await page.close()
  }
  console.log(`${evidence.status} ${testCase.id} ${viewport.width}x${viewport.height}${evidence.error ? `: ${evidence.error.split('\n')[0]}` : ''}`)
  return evidence
}

const browserExecutable = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
const browser = await chromium.launch({
  headless: true,
  ...(browserExecutable ? { executablePath: browserExecutable } : {}),
})
const results = []
try {
  for (const viewport of selectedViewports) {
    for (const testCase of selectedCases) {
      results.push(await runCase(browser, viewport, testCase))
    }
  }
} finally {
  await browser.close()
}

const failed = results.filter((entry) => entry.status !== 'PASS').length
const artifactPath = resolve(artifactDir, `bs11-054-058-browser-${Date.now()}.json`)
const artifact = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  candidateSource: 'data/cards/official-dark-enchantress-war-bs11.en.json',
  routeFormat: 'normal candidate test-state routes: card/card-negative/card-attack/card-attack-negative/card-skill/card-skill-negative',
  scope: `Candidate-only Browser interaction through normal UI. Cases: ${selectedCases.map(({ id }) => id).join(', ')}; viewports: ${selectedViewports.map(({ width, height }) => `${width}x${height}`).join(', ')}. Reuses prior BS11-057 simple-FLIP artifact separately. Not formal-deck, full-battle, physical-device, or online acceptance. Opponent hand and hidden deck order are omitted from the artifact.`,
  viewports: selectedViewports,
  summary: {
    total: results.length,
    passed: results.length - failed,
    failed,
    knownImageNetworkRestrictions: results.reduce((total, entry) => total + entry.knownImageNetworkRestrictions.length, 0),
  },
  results,
}
writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ artifactPath, summary: artifact.summary }, null, 2))
const expectedTotal = selectedViewports.length * selectedCases.length
if (results.length !== expectedTotal || failed > 0) process.exitCode = 1
