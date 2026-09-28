import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const baseUrl = process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173'
const artifactDir = resolve(root, 'test-results/bs11-060-063-browser')
mkdirSync(artifactDir, { recursive: true })
const viewports = [
  { width: 1280, height: 720 },
  { width: 1164, height: 777 },
]
const browserExecutable = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)

const cases = [
  { id: '060-attack-positive', cardNumber: 'BS11-060', route: 'card-attack:BS11-060', kind: 'attack-positive' },
  { id: '060-attack-blocked', cardNumber: 'BS11-060', route: 'card-attack-negative:BS11-060', kind: 'attack-blocked' },
  { id: '061-activate-positive', cardNumber: 'BS11-061', route: 'card-skill:BS11-061', kind: 'activate-positive' },
  { id: '061-activate-blocked', cardNumber: 'BS11-061', route: 'card-skill-negative:BS11-061', kind: 'activate-blocked' },
  { id: '062-stage-positive', cardNumber: 'BS11-062', route: 'card:BS11-062', kind: 'stage-positive' },
  { id: '062-stage-blocked', cardNumber: 'BS11-062', route: 'card-skill-negative:BS11-062', kind: 'stage-blocked' },
  { id: '062-stage-empty-hand', cardNumber: 'BS11-062', route: 'card-skill:BS11-062', kind: 'stage-empty-hand' },
  { id: '063-trap-positive', cardNumber: 'BS11-063', route: 'card-skill:BS11-063', kind: 'trap-positive' },
  { id: '063-trap-blocked', cardNumber: 'BS11-063', route: 'card-skill-negative:BS11-063', kind: 'trap-blocked' },
  { id: '063-trap-no-condition', cardNumber: 'BS11-063', route: 'bs11-063-no-condition:BS11-063', kind: 'trap-no-condition' },
  { id: '063-variant-positive', cardNumber: 'BS11-063@1', route: 'card-skill:BS11-063@1', kind: 'trap-positive' },
  { id: '063-variant-blocked', cardNumber: 'BS11-063@1', route: 'card-skill-negative:BS11-063@1', kind: 'trap-blocked' },
  { id: '063-variant-no-condition', cardNumber: 'BS11-063@1', route: 'bs11-063-no-condition:BS11-063@1', kind: 'trap-no-condition' },
]

const requestedCases = process.env.BS11_BROWSER_CASES
  ?.split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const selectedCases = requestedCases?.length
  ? cases.filter((testCase) => requestedCases.includes(testCase.id))
  : cases
if (!selectedCases.length) throw new Error('No BS11-060～063 Browser cases were selected')
if (requestedCases?.some((id) => !cases.some((testCase) => testCase.id === id))) {
  const unknown = requestedCases.filter((id) => !cases.some((testCase) => testCase.id === id))
  throw new Error('Unknown BS11_BROWSER_CASES entry: ' + unknown.join(', '))
}

const requestedWidths = process.env.BS11_BROWSER_WIDTHS
  ?.split(',')
  .map(Number)
  .filter(Number.isFinite)
const selectedViewports = requestedWidths?.length
  ? viewports.filter((viewport) => requestedWidths.includes(viewport.width))
  : viewports
if (!selectedViewports.length) throw new Error('No supported BS11 Browser viewport was selected')
if (requestedWidths?.some((width) => !viewports.some((viewport) => viewport.width === width))) {
  const unknown = requestedWidths.filter((width) => !viewports.some((viewport) => viewport.width === width))
  throw new Error('Unknown BS11_BROWSER_WIDTHS entry: ' + unknown.join(', '))
}

const candidate = JSON.parse(await readFile(
  resolve(root, 'data/candidates/official-dark-enchantress-war-bs11.en.json'),
  'utf8',
))
const selectedCardNumbers = [...new Set(selectedCases.map((testCase) => testCase.cardNumber))]
const cards = Object.fromEntries(candidate.cards
  .filter((card) => selectedCardNumbers.includes(card.cardNumber))
  .map((card) => [card.cardNumber, { name: card.name, imageUrl: card.imageUrl }]))
for (const cardNumber of selectedCardNumbers) {
  if (!cards[cardNumber]) throw new Error('Missing candidate card: ' + cardNumber)
}
const contractCards = selectedCardNumbers.join(',')

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const trace = (page) => page.evaluate(() =>
  (Array.isArray(window.__braverseContractTrace) ? window.__braverseContractTrace : [])
    .map((entry) => ({
      commandKind: entry.commandKind,
      steps: Array.isArray(entry.steps) ? entry.steps.map(String) : [],
    })),
)
const hasCommand = async (page, commandKind) =>
  (await trace(page)).some((entry) => entry.commandKind === commandKind)
const waitForCommand = (page, commandKind) => page.waitForFunction(
  (kind) => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === kind),
  commandKind,
)
const isVisible = async (locator) =>
  (await locator.count()) > 0 && locator.first().isVisible().catch(() => false)

const scrubString = (value, privateTokens) => {
  let result = value
  for (const token of privateTokens) {
    if (token) result = result.split(token).join('[private hand card]')
  }
  return result
}
const scrubValue = (value, privateTokens) => {
  if (typeof value === 'string') return scrubString(value, privateTokens)
  if (Array.isArray(value)) return value.map((entry) => scrubValue(entry, privateTokens))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
      key,
      scrubValue(entry, privateTokens),
    ]))
  }
  return value
}

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
    loaded: Boolean(image && image.complete && image.naturalWidth > 0),
  }
})
const assertArt = (art, cardNumber) => {
  const expected = cards[cardNumber]
  if (art.image) {
    assert.equal(art.image.src, expected.imageUrl, cardNumber + ' must render its candidate image URL')
    assert.equal(art.image.alt, expected.name, cardNumber + ' image alt text')
  } else {
    assert.equal(art.fallbackName, expected.name, cardNumber + ' fallback must name the candidate card')
  }
}

const readField = async (page, side) => page.locator('.' + side + '-field').evaluate((field) => {
  const getName = (entry) => entry.querySelector('.card-face')?.getAttribute('title') ??
    entry.querySelector('.card-face img')?.getAttribute('alt') ??
    entry.querySelector('.card-fallback strong')?.textContent?.trim() ?? null
  const getHp = (entry) => Number(
    entry.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN,
  )
  const zoneCount = (selector) =>
    Number(field.querySelector(selector)?.textContent?.match(/\d+/)?.[0] ?? NaN)
  const stage = field.querySelector('.stage-zone .resource-summary')
  return {
    supports: [...field.querySelectorAll('.support-card-wrap')].map((entry) => ({
      id: entry.getAttribute('data-card-instance-id'),
      name: getName(entry),
      rested: Boolean(entry.querySelector('.card-face.is-rested')),
    })),
    battle: [...field.querySelectorAll('.combat-card-wrap')].map((entry) => ({
      id: entry.getAttribute('data-card-instance-id'),
      name: getName(entry),
      hp: getHp(entry),
      rested: Boolean(entry.querySelector('.card-face.is-rested')),
    })),
    // Preserve hand sizes only. Never serialize either player's hand identities.
    handCount: field.querySelectorAll('.hand-card-wrap').length,
    deckCount: zoneCount('.deck-zone .resource-summary > strong'),
    discardCount: zoneCount('.discard-zone.resource-summary > strong'),
    stageTitle: stage?.getAttribute('title') ?? null,
  }
})
const readState = async (page) => ({
  bottom: await readField(page, 'bottom'),
  top: await readField(page, 'top'),
})

const recordBrowserIssues = (page, evidence) => {
  page.on('pageerror', (error) => evidence.errors.push('pageerror: ' + error.message))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const url = message.location().url ?? ''
    if (
      (url.includes('cookierunbraverse.com/data/en_storage/') ||
        message.text().includes('cookierunbraverse.com/data/en_storage/')) &&
      /ERR_NETWORK_ACCESS_DENIED|Failed to load resource|ERR_BLOCKED_BY_CLIENT/i.test(message.text())
    ) return
    if (url.endsWith('/favicon.ico') && message.text().includes('404')) return
    evidence.errors.push('console: ' + message.text() + ' @ ' + url)
  })
  page.on('requestfailed', (request) => {
    const url = request.url()
    if (url.startsWith('https://cookierunbraverse.com/data/en_storage/')) {
      evidence.imageRequestFailures.push({
        url,
        reason: request.failure()?.errorText ?? 'unknown',
      })
    } else if (!url.endsWith('/favicon.ico')) {
      evidence.errors.push('request failed: ' + url + ' ' + (request.failure()?.errorText ?? 'unknown'))
    }
  })
  page.on('response', (response) => {
    if (response.status() < 400) return
    const url = response.url()
    if (url.startsWith('https://cookierunbraverse.com/data/en_storage/')) {
      evidence.imageHttpFailures.push({ status: response.status(), url })
    } else if (!url.endsWith('/favicon.ico')) {
      evidence.errors.push(response.status() + ' response: ' + url)
    }
  })
}

const skipAnimations = async (page) => {
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const button = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await isVisible(button)) await button.click()
    await wait(100)
  }
}

const exactFaceSelector = (name) => '.card-face[title=' + JSON.stringify(name) + ']'
const sourceCard = (page, side, name) => page.locator(
  '.' + side + '-field .combat-card-wrap',
).filter({ has: page.locator(exactFaceSelector(name)) }).first()
const handEntry = (page, name) => page.locator('.bottom-field .hand-card-wrap')
  .filter({ has: page.locator(exactFaceSelector(name)) })
  .first()
const buttonCardName = async (button) => {
  const title = await button.locator('.card-face').getAttribute('title').catch(() => null)
  if (title) return title
  const alt = await button.locator('.card-face img').getAttribute('alt').catch(() => null)
  if (alt) return alt
  return button.locator('.card-fallback strong').textContent()
    .then((value) => value?.trim() ?? null)
}
const clickEnabled = async (locator, description) => {
  await locator.waitFor({ state: 'visible' })
  assert.equal(await locator.isEnabled(), true, description + ' must be enabled')
  await locator.click()
}
const activeEffectPanel = (page) =>
  page.locator('.effect-panel[role="alertdialog"]:visible').last()
const targetInstanceByName = (battle, name, description) => {
  const matches = battle.filter((entry) => entry.name === name)
  assert.equal(matches.length, 1, description + ' must identify one visible Cookie instance')
  return matches[0].id
}

const waitForAttackSettlement = async (page) => {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const response = page.locator('.attack-response-modal:visible').first()
    if (await isVisible(response)) {
      const skip = response.getByRole('button', { name: '不發動', exact: true }).first()
      if (await isVisible(skip)) await skip.click()
    }
    const pending = [
      page.locator('.trap-response-modal:visible'),
      page.locator('.attack-response-modal:visible'),
      page.locator('.optional-cost-attack-inline:visible'),
      page.locator('.hand-discard-modal:visible'),
      page.locator('.draw-up-to-modal:visible'),
      page.locator('.effect-panel[role="alertdialog"]:visible'),
    ]
    const anyPending = (await Promise.all(pending.map(isVisible))).some(Boolean)
    const nextPhase = page.locator('.next-phase-button')
    if (!anyPending && await nextPhase.count() && await nextPhase.isEnabled()) return
    const animation = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await isVisible(animation)) await animation.click()
    await wait(100)
  }
  throw new Error('Battle response did not settle into the next legal action state')
}

const run060 = async (page, testCase, evidence) => {
  const before = await readState(page)
  evidence.before = before
  const source = sourceCard(page, 'bottom', cards['BS11-060'].name)
  await source.waitFor({ state: 'visible' })
  evidence.art = await readArt(source.locator('.card-face').first())
  assertArt(evidence.art, 'BS11-060')
  const attack = source.locator('.card-face.is-attackable').first()

  if (testCase.kind === 'attack-blocked') {
    const offered = await source.locator('.card-face.is-attackable')
    assert.ok(
      await offered.count() === 0 || !(await offered.first().isEnabled()),
      '060 must not offer an unpaid attack with no active support',
    )
    evidence.trace = await trace(page)
    assert.equal(evidence.trace.some((entry) => entry.commandKind === 'declare-attack'), false)
    evidence.after = await readState(page)
    assert.deepEqual(evidence.after, before, '060 blocked route must not change payment, target, or hand state')
    evidence.result = 'Normal attack remained unavailable with no active support; no attack command was sent.'
    return
  }

  const defenderBefore = before.top.battle[0]
  assert.ok(defenderBefore, '060 fixture must provide an opponent Cookie')
  await clickEnabled(attack, '060 normal attack')
  const paymentPanel = page.locator('[data-testid="attack-payment-panel"]:visible')
  await paymentPanel.waitFor({ state: 'visible' })
  const paymentChoices = page.locator(
    '.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)',
  )
  assert.equal(await paymentChoices.count(), 1, '060 {N} must accept the active red support')
  const paymentId = await paymentChoices.first().evaluate(
    (node) => node.closest('.support-card-wrap')?.getAttribute('data-card-instance-id') ?? null,
  )
  await paymentChoices.first().click()
  const target = page.locator(
    '.top-field .combat-card-wrap[data-card-instance-id="' + defenderBefore.id +
      '"] .card-face[aria-label^="選擇攻擊目標："]',
  )
  await target.waitFor({ state: 'visible' })
  await target.click()
  await waitForCommand(page, 'declare-attack')
  await waitForAttackSettlement(page)
  await skipAnimations(page)
  evidence.after = await readState(page)
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'declare-attack'))
  const defenderAfter = evidence.after.top.battle.find((entry) => entry.id === defenderBefore.id)
  assert.ok(defenderAfter, '060 target must remain in the battle area')
  evidence.damageDealt = defenderBefore.hp - defenderAfter.hp
  assert.equal(evidence.damageDealt, 1, '060 must settle its 1 attack damage')
  const paymentAfter = evidence.after.bottom.supports.find((entry) => entry.id === paymentId)
  assert.equal(paymentAfter?.rested, true, '060 must rest the selected red support for {N}')
  evidence.result = 'Paid {N} with the active red support and settled exactly 1 attack damage.'
}

const run061 = async (page, testCase, evidence) => {
  const before = await readState(page)
  evidence.before = before
  const source = sourceCard(page, 'bottom', cards['BS11-061'].name)
  await source.waitFor({ state: 'visible' })
  evidence.art = await readArt(source.locator('.card-face').first())
  assertArt(evidence.art, 'BS11-061')
  const skill = source.locator('.skill-action').filter({ hasText: '啟動技能' }).first()

  if (testCase.kind === 'activate-blocked') {
    if (await skill.count() > 0 && await skill.isEnabled()) {
      await skill.click()
      const panel = activeEffectPanel(page)
      await panel.waitFor({ state: 'visible' })
      const payments = panel.locator('.effect-candidates-payment:visible button:not(.is-selected)')
      evidence.legalPaymentCandidateCount = await payments.count()
      assert.ok(evidence.legalPaymentCandidateCount < 2, '061 negative fixture must not expose two legal blue payments')
      if (evidence.legalPaymentCandidateCount === 1) await payments.first().click()
      const primary = panel.locator('.effect-panel-primary-action').last()
      assert.equal(await primary.isEnabled(), false, '061 must not confirm with fewer than two blue supports')
      const cancel = panel.getByRole('button', { name: '取消技能', exact: true })
      if (await isVisible(cancel)) await cancel.click()
    } else {
      evidence.legalPaymentCandidateCount = 1
    }
    evidence.trace = await trace(page)
    assert.equal(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect'), false)
    evidence.after = await readState(page)
    assert.deepEqual(evidence.after, before, '061 blocked route must not move HP or rest payment')
    evidence.result = 'Two-blue Activate was blocked with fewer than two legal payments; no HP or deck state changed.'
    return
  }

  await clickEnabled(skill, '061 Activate')
  const panel = activeEffectPanel(page)
  await panel.waitFor({ state: 'visible' })
  const paymentChoices = panel.locator('.effect-candidates-payment:visible button:not(.is-selected)')
  assert.ok(await paymentChoices.count() >= 2, '061 must expose two legal blue payments')
  for (let index = 0; index < 2; index += 1) {
    const remaining = panel.locator('.effect-candidates-payment:visible button:not(.is-selected)')
    await clickEnabled(remaining.first(), '061 blue payment ' + (index + 1))
  }
  await clickEnabled(panel.locator('.effect-panel-primary-action').last(), '061 advance to target')
  const targetChoices = panel.locator('.effect-candidates-target:visible button:not(.is-selected)')
  assert.ok(await targetChoices.count() > 0, '061 must offer an opposing Cookie target')
  const targetName = await buttonCardName(targetChoices.first())
  const targetId = targetInstanceByName(before.top.battle, targetName, '061 selected target')
  await targetChoices.first().click()
  await clickEnabled(panel.locator('.effect-panel-primary-action').last(), '061 resolve selected target')
  await waitForCommand(page, 'resolve-ability-effect')
  await skipAnimations(page)
  evidence.after = await readState(page)
  evidence.trace = await trace(page)
  const targetBefore = before.top.battle.find((entry) => entry.id === targetId)
  const targetAfter = evidence.after.top.battle.find((entry) => entry.id === targetId)
  assert.ok(targetBefore && targetAfter, '061 target Cookie must remain in the battle area')
  assert.equal(targetAfter.hp, targetBefore.hp - 1, '061 must move exactly the target Cookie top HP')
  assert.equal(evidence.after.top.deckCount, before.top.deckCount + 1, '061 top HP must go to its owner deck bottom')
  assert.equal(
    evidence.after.bottom.supports.filter((entry) => entry.rested).length -
      before.bottom.supports.filter((entry) => entry.rested).length,
    2,
    '061 must rest two supports for the 2B cost',
  )
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'begin-activate-skill'))
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect'))
  const sourceAfter = sourceCard(page, 'bottom', cards['BS11-061'].name)
  const skillAfter = sourceAfter.locator('.skill-action').filter({ hasText: '啟動技能' }).first()
  assert.ok(await skillAfter.count() === 0 || !(await skillAfter.isEnabled()), '061 Once Per Turn must prevent a second activation')
  evidence.result = 'Paid 2B; target Cookie lost one top HP and its owner deck gained one card.'
}

const run062 = async (page, testCase, evidence, privateTokens) => {
  const before = await readState(page)
  evidence.before = before
  const entry = handEntry(page, cards['BS11-062'].name)
  await entry.waitFor({ state: 'visible' })
  evidence.art = await readArt(entry.locator('.card-face').first())
  assertArt(evidence.art, 'BS11-062')
  await entry.locator('.card-face').click()
  const place = entry.locator('.hand-card-action').filter({ hasText: '放置' }).first()

  if (testCase.kind === 'stage-blocked') {
    assert.equal(await place.count(), 0, '062 must not offer placement when 2B cannot be paid')
    evidence.trace = await trace(page)
    assert.equal(evidence.trace.some((command) => command.commandKind === 'play-stage'), false)
    evidence.after = await readState(page)
    assert.deepEqual(evidence.after, before, '062 unpaid placement must not move the Stage or rest support')
    evidence.result = 'Two-blue Stage placement action was unavailable with only one active support; no Stage command or payment occurred.'
    return
  }

  await clickEnabled(place, '062 stage placement action')
  const placement = page.locator('.stage-placement-modal:visible').first()
  await placement.waitFor({ state: 'visible' })
  const payments = placement.locator('.faint-payment-candidates button:not(.is-selected)')
  assert.equal(await payments.count(), 2, '062 payable route must offer exactly two active blue supports')
  evidence.paymentIds = []
  for (let index = 0; index < 2; index += 1) {
    const payment = placement.locator('.faint-payment-candidates button:not(.is-selected)').first()
    const name = await buttonCardName(payment)
    const support = before.bottom.supports.find((candidate) => candidate.name === name)
    assert.ok(support, '062 payment candidate must map to one visible support instance')
    evidence.paymentIds.push(support.id)
    await payment.click()
  }
  const confirmPlacement = placement.getByRole('button', { name: '支付並放置', exact: true })
  await clickEnabled(confirmPlacement, '062 pay and place Stage')
  await waitForCommand(page, 'play-stage')
  const placed = await readState(page)
  assert.ok(placed.bottom.stageTitle?.includes(cards['BS11-062'].name), '062 must appear in the Stage zone after payment')
  assert.equal(placed.bottom.handCount, before.bottom.handCount - 1, '062 must leave hand when placed')
  const stageAction = page.locator('.bottom-field .stage-quick-action')
  await clickEnabled(stageAction, '062 activate placed Stage')
  const activation = activeEffectPanel(page)
  await activation.waitFor({ state: 'visible' })
  const automaticCost = activation.locator('.effect-panel-extra-cost-col')
  await automaticCost.waitFor({ state: 'visible' })
  assert.match(await automaticCost.innerText(), /將效果來源場景卡置入棄牌區/)
  assert.doesNotMatch(await automaticCost.innerText(), /將效果來源卡橫置/)
  await clickEnabled(
    activation.getByRole('button', { name: '確認發動', exact: true }),
    '062 confirm Stage trash cost and activate',
  )
  await waitForCommand(page, 'begin-activate-stage')

  for (let step = 0; step < 4 && !(await hasCommand(page, 'resolve-ability-effect')); step += 1) {
    const panel = activeEffectPanel(page)
    await panel.waitFor({ state: 'visible' })
    await clickEnabled(panel.locator('.effect-panel-primary-action').last(), '062 resolve hand inspection')
    await wait(120)
  }
  await waitForCommand(page, 'resolve-ability-effect')
  const inspection = page.locator('.hand-inspection-modal[role="dialog"]:visible').first()
  await inspection.waitFor({ state: 'visible' })
  const snapshotCards = inspection.locator('.hand-inspection-card')
  const snapshotCount = await snapshotCards.count()
  const names = await snapshotCards.evaluateAll((nodes) => nodes.flatMap((node) => {
    const face = node.querySelector('.card-face')
    const image = face?.querySelector('img')
    return [face?.getAttribute('title'), image?.getAttribute('alt')]
      .filter((value) => typeof value === 'string' && value.length > 0)
  }))
  names.forEach((name) => privateTokens.add(name))
  const rawTrace = await trace(page)
  const traceText = JSON.stringify(rawTrace)
  assert.equal(
    names.some((name) => traceText.includes(name)),
    false,
    '062 private hand identity must not appear in the public command trace',
  )
  evidence.snapshotCardCount = snapshotCount
  evidence.ownerSnapshotVisible = true
  evidence.privateTraceScan = 'passed'

  if (testCase.kind === 'stage-empty-hand') {
    assert.equal(snapshotCount, 0, '062 empty-hand fixture must show no revealed cards')
    assert.match(await inspection.innerText(), /對手目前沒有手牌/)
  } else {
    assert.equal(snapshotCount, 3, '062 must show the three-card opponent hand snapshot to its owner')
  }

  const traceAfterReveal = await trace(page)
  evidence.trace = scrubValue(traceAfterReveal, privateTokens)
  await clickEnabled(
    inspection.getByRole('button', { name: '關閉檢視結果', exact: true }),
    '062 close private inspection result',
  )
  await inspection.waitFor({ state: 'hidden' })
  evidence.after = await readState(page)
  assert.equal(
    evidence.after.bottom.discardCount,
    before.bottom.discardCount + 1,
    '062 activation cost must move its Stage source to trash',
  )
  assert.ok(
    !evidence.after.bottom.stageTitle?.includes(cards['BS11-062'].name),
    '062 source Stage must leave the Stage zone as its activation cost',
  )
  assert.equal(evidence.after.top.handCount, before.top.handCount, '062 view effect must not move opponent hand cards')
  assert.equal(evidence.after.top.deckCount, before.top.deckCount)
  evidence.result = testCase.kind === 'stage-empty-hand'
    ? 'Paid 2B, activated and trashed the Stage, and the owner saw the explicit empty-hand result.'
    : 'Paid 2B, activated and trashed the Stage, and the owner saw three snapshot cards; public trace contained no hand identity.'
}

const openTrap = async (page, cardNumber) => {
  const chooser = page.locator('.attack-response-modal:visible').first()
  const modal = page.locator('.trap-response-modal[role="alertdialog"]:visible').first()
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (await isVisible(modal)) break
    if (await isVisible(chooser)) {
      const option = chooser.locator('.modal-card-options button')
        .filter({ hasText: cards[cardNumber].name })
        .first()
      await clickEnabled(option, cardNumber + ' attack-response Trap choice')
    }
    await wait(100)
  }
  await modal.waitFor({ state: 'visible' })
  if ((await modal.innerText()).includes('是否發動陷阱？')) {
    const option = modal.locator('.modal-card-options button')
      .filter({ hasText: cards[cardNumber].name })
      .first()
    await clickEnabled(option, cardNumber + ' trap selection')
  }
  await modal.getByRole('heading', { name: new RegExp(cards[cardNumber].name) }).waitFor({ state: 'visible' })
  return modal
}

const confirmTrap = async (modal, cardNumber) => {
  for (let step = 0; step < 5; step += 1) {
    const next = modal.getByRole('button', { name: '下一步', exact: true }).first()
    if (await isVisible(next)) {
      await clickEnabled(next, cardNumber + ' trap next phase')
      continue
    }
    const confirm = modal.getByRole('button', { name: '確認發動', exact: true }).last()
    await clickEnabled(confirm, cardNumber + ' confirm Trap')
    return
  }
  throw new Error(cardNumber + ' Trap did not reach its confirmation step')
}

const resolveTrapThen = async (page, expectedDraw, evidence) => {
  let drawResolved = false
  for (let step = 0; step < 12; step += 1) {
    const draw = page.locator('.draw-up-to-modal:visible').first()
    if (await isVisible(draw)) {
      assert.equal(expectedDraw, true, '063 no-condition route must not open a draw decision')
      const option = draw.locator('.draw-up-to-option').nth(1)
      await option.waitFor({ state: 'visible' })
      await option.click()
      await clickEnabled(
        draw.locator('.draw-up-to-actions button').last(),
        '063 confirm draw one',
      )
      await waitForCommand(page, 'resolve-draw-up-to')
      evidence.drawCount = 1
      drawResolved = true
      break
    }
    const panel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
    if (await isVisible(panel)) {
      const primary = panel.locator('.effect-panel-primary-action').last()
      if (!(await primary.isEnabled())) {
        await wait(150)
        continue
      }
      await primary.click()
      await wait(150)
      await skipAnimations(page)
      continue
    }
    if (await hasCommand(page, 'resolve-draw-up-to')) {
      drawResolved = true
      break
    }
    if (!expectedDraw && await hasCommand(page, 'resolve-ability-effect')) break
    await wait(150)
  }
  if (expectedDraw) {
    assert.equal(drawResolved, true, '063 satisfied Then must resolve the draw-up-to-one choice')
  } else {
    assert.equal(drawResolved, false, '063 unsatisfied condition must not draw')
  }
}

const run063 = async (page, testCase, evidence) => {
  const before = await readState(page)
  evidence.before = before
  const cardNumber = testCase.cardNumber
  const ownTrap = handEntry(page, cards[cardNumber].name)
  await ownTrap.waitFor({ state: 'visible' })
  evidence.art = await readArt(ownTrap.locator('.card-face').first())
  assertArt(evidence.art, cardNumber)
  const defenderBefore = before.bottom.battle[0]
  assert.ok(defenderBefore, cardNumber + ' fixture must provide a defending Cookie')

  if (testCase.kind === 'trap-blocked') {
    const response = page.locator('.trap-response-modal[role="alertdialog"]:visible').first()
    if (await isVisible(response)) {
      const offered = response.locator('.modal-card-options button').filter({
        hasText: cards[cardNumber].name,
      })
      assert.equal(await offered.count(), 0, cardNumber + ' must not be offered without legal blue payment')
      const skip = response.getByRole('button', { name: '不發動', exact: true }).first()
      if (await isVisible(skip)) await skip.click()
    }
    await waitForAttackSettlement(page)
    evidence.after = await readState(page)
    evidence.trace = await trace(page)
    assert.equal(evidence.trace.some((entry) => entry.commandKind === 'play-trap'), false)
    const defenderAfter = evidence.after.bottom.battle.find((entry) => entry.id === defenderBefore.id)
    assert.ok(defenderAfter, cardNumber + ' defender must remain visible after the attack')
    evidence.damageReceived = defenderBefore.hp - defenderAfter.hp
    assert.equal(evidence.damageReceived, 1, cardNumber + ' unpaid Trap must not reduce attack damage')
    assert.equal(
      evidence.trace.some((entry) => entry.commandKind === 'play-trap'),
      false,
      cardNumber + ' unpaid Trap must not issue a Trap payment command',
    )
    evidence.result = 'Trap was unavailable without active blue payment; no Trap command or payment occurred and attack damage settled.'
    return
  }

  const modal = await openTrap(page, cardNumber)
  evidence.art = await readArt(modal.locator('.trap-selected-card-detail .card-face').first())
  assertArt(evidence.art, cardNumber)
  const energy = modal.locator('.trap-guided-section').filter({ hasText: '能量支付' }).first()
  await energy.waitFor({ state: 'visible' })
  const payment = energy.locator('.modal-card-options button:not(.is-selected)').first()
  const paymentName = await buttonCardName(payment)
  const paymentSupport = before.bottom.supports.find((support) => support.name === paymentName)
  assert.ok(paymentSupport, cardNumber + ' selected Trap payment must map to an active support instance')
  evidence.paymentId = paymentSupport.id
  await clickEnabled(payment, cardNumber + ' blue Trap payment')
  const next = modal.getByRole('button', { name: '下一步', exact: true }).first()
  if (await isVisible(next)) await clickEnabled(next, cardNumber + ' continue to target')
  const attackerTarget = modal.locator('.trap-target-options button.is-attacker').first()
  await clickEnabled(attackerTarget, cardNumber + ' attacking Cookie target')
  await confirmTrap(modal, cardNumber)
  await waitForCommand(page, 'play-trap')
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'play-trap'))
  await resolveTrapThen(page, testCase.kind === 'trap-positive', evidence)
  await waitForAttackSettlement(page)
  await skipAnimations(page)
  evidence.after = await readState(page)
  evidence.trace = await trace(page)
  const defenderAfter = evidence.after.bottom.battle.find((entry) => entry.id === defenderBefore.id)
  assert.ok(defenderAfter, cardNumber + ' defender must remain visible after the attack')
  evidence.damageReceived = defenderBefore.hp - defenderAfter.hp
  assert.equal(evidence.damageReceived, 0, cardNumber + ' Trap must reduce the 1-damage attack to zero')
  const trapCommand = evidence.trace.find((entry) => entry.commandKind === 'play-trap')
  assert.ok(trapCommand, cardNumber + ' must publish its Trap payment command')
  assert.ok(
    trapCommand.steps.some((step) => step.includes(evidence.paymentId)),
    cardNumber + ' Trap command must show the selected blue support payment',
  )
  if (testCase.kind === 'trap-positive') {
    assert.equal(evidence.drawCount, 1, cardNumber + ' satisfied Then must draw one card')
    assert.equal(evidence.after.bottom.handCount, before.bottom.handCount + 2, cardNumber + ' includes the two normal turn-draw cards and one Then draw after paying the Trap')
    assert.equal(evidence.after.bottom.deckCount, before.bottom.deckCount - 3, cardNumber + ' must draw one Then card plus two normal turn-draw cards')
    evidence.result = 'Paid 1B, reduced the attack to zero damage, chose one Then draw, and reached the next turn draw.'
  } else {
    assert.equal(evidence.drawCount, undefined, cardNumber + ' no-condition path must not draw from the Trap Then')
    assert.equal(evidence.after.bottom.handCount, before.bottom.handCount + 1, cardNumber + ' includes the two normal turn-draw cards after paying the Trap')
    assert.equal(evidence.after.bottom.deckCount, before.bottom.deckCount - 2, cardNumber + ' must show only the two normal turn-draw cards')
    assert.equal(
      before.bottom.battle.some((entry) => entry.name === 'Sea Fairy Cookie' || entry.name === 'Ancient Cookie'),
      false,
      cardNumber + ' no-condition fixture must not contain a named witness',
    )
    evidence.result = 'Paid 1B and reduced the attack to zero; absent Sea Fairy/Ancient condition produced no Trap draw, followed by the normal two-card turn draw.'
  }
}

const runCase = async (browser, viewport, testCase) => {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(15000)
  const privateTokens = new Set()
  const evidence = {
    id: testCase.id,
    cardNumber: testCase.cardNumber,
    name: cards[testCase.cardNumber].name,
    route: testCase.route,
    kind: testCase.kind,
    viewport,
    status: 'FAIL',
    errors: [],
    imageRequestFailures: [],
    imageHttpFailures: [],
  }
  recordBrowserIssues(page, evidence)
  try {
    const url = new URL('/', baseUrl)
    url.searchParams.set('test-state', testCase.route)
    url.searchParams.set('contract-card', contractCards)
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
    await page.locator('.game-shell').waitFor({ state: 'visible' })

    if (testCase.kind.startsWith('attack-')) {
      await run060(page, testCase, evidence)
    } else if (testCase.kind.startsWith('activate-')) {
      await run061(page, testCase, evidence)
    } else if (testCase.kind.startsWith('stage-')) {
      await run062(page, testCase, evidence, privateTokens)
    } else {
      await run063(page, testCase, evidence)
    }
    assert.deepEqual(evidence.errors, [], testCase.id + ' browser errors must be empty')
    evidence.status = 'PASS'
  } catch (error) {
    evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
    evidence.trace = await trace(page).catch(() => [])
  } finally {
    await page.close()
  }
  const sanitized = scrubValue(evidence, privateTokens)
  console.log(
    sanitized.status + ' ' + testCase.id + ' ' + viewport.width + 'x' + viewport.height +
      (sanitized.error ? ': ' + String(sanitized.error).split('\n')[0] : ''),
  )
  return sanitized
}

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
const artifactPath = resolve(artifactDir, 'bs11-060-063-browser-' + Date.now() + '.json')
const artifact = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  routeFormat: 'candidate-only test-state routes for BS11-060～063 and BS11-063@1',
  scope: 'Local candidate-only Browser evidence at desktop/tablet sizes. No formal deck, multiplayer, or online acceptance is claimed. Hand identities are not serialized.',
  viewports: selectedViewports,
  summary: {
    total: results.length,
    passed: results.length - failed,
    failed,
  },
  results,
}
writeFileSync(artifactPath, JSON.stringify(artifact, null, 2) + '\n', 'utf8')
console.log(JSON.stringify({ artifactPath, summary: artifact.summary }, null, 2))
const expectedTotal = selectedCases.length * selectedViewports.length
if (results.length !== expectedTotal || failed > 0) process.exitCode = 1
