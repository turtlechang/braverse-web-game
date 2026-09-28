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
const artifactDir = resolve(root, 'test-results/bs11-045-049-browser')
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

const cards = {
  'BS11-045': {
    name: 'Grand Dust Hotel',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/VAoB7XQSusXTeBtSMCbBUA.webp',
    fixture: {
      positive: 'stage in hand; one green placement support, two green activation supports, two rested green Cookie targets',
      negative: 'stage already placed; only one active green plus one active red support for G2 activation',
    },
  },
  'BS11-046': {
    name: 'Awakened Apathy',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/dB63swLGUg6n-YwQeWphXQ.webp',
    fixture: {
      positive: 'during the same opponent attack, own support 2 and opponent support 4 (difference 2)',
      negative: 'during the same opponent attack, own support 2 and opponent support 3 (difference 1)',
    },
  },
  'BS11-047': {
    name: 'Dumpling Censer',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/jeJ0q4m3sECBV87h0o95oA.webp',
    fixture: {
      positive: 'item in hand; active green energy and a distinct support-to-hand cost; opponent On Play witness controllable from Browser',
      negative: 'item in hand with no legal green energy and/or support-to-hand cost',
      replacement: 'Dumpling Censer already resolved by formal commands; player-two is active viewer with an On Play Cookie, one active neutral payment support, and an opponent support target',
    },
  },
  'BS11-048': {
    name: "Wind's Protection",
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/yI99-LvE86NjI8a2tPL71Q.webp',
    fixture: {
      positive: 'during opponent attack; Wind Archer or Ancient in own battle area; green trap payment, neutral Then payment, active opponent support',
      negative: 'same attack/payment surface but no Wind Archer and no Ancient in own battle area',
    },
  },
  'BS11-048@1': {
    name: "Wind's Protection",
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/D9F3lLXNvzCkyhHhKpYQ3A.webp',
    fixture: {
      positive: 'variant image; during opponent attack; Wind Archer or Ancient in own battle area; green trap payment, neutral Then payment, active opponent support',
      negative: 'variant image; same attack/payment surface but no Wind Archer and no Ancient in own battle area',
    },
  },
  'BS11-049': {
    name: 'Emerald of the Wind',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/jD-atczILVP9mSQhQqFW_g.webp',
    fixture: {
      positive: 'item in hand; one active green support and one Wind Archer Cookie in trash',
      negative: 'item in hand; one active green support and no Wind Archer Cookie in trash',
    },
  },
}
const requestedCards = process.env.BS11_BROWSER_CARDS?.split(',').map((value) => value.trim()).filter(Boolean)
const selectedCards = requestedCards?.length
  ? Object.keys(cards).filter((cardId) => requestedCards.includes(cardId))
  : Object.keys(cards)
if (requestedCards?.some((cardId) => !Object.hasOwn(cards, cardId))) {
  throw new Error(`Unknown BS11_BROWSER_CARDS entry: ${requestedCards.filter((cardId) => !Object.hasOwn(cards, cardId)).join(', ')}`)
}
const requestedWidths = process.env.BS11_BROWSER_WIDTHS?.split(',').map(Number).filter(Number.isFinite)
const selectedViewports = requestedWidths?.length
  ? viewports.filter((viewport) => requestedWidths.includes(viewport.width))
  : viewports
if (requestedWidths?.some((width) => !viewports.some((viewport) => viewport.width === width))) {
  throw new Error(`Unknown BS11_BROWSER_WIDTHS entry: ${requestedWidths.filter((width) => !viewports.some((viewport) => viewport.width === width)).join(', ')}`)
}
const contractCards = Object.keys(cards).join(',')

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const trace = (page) => page.evaluate(() =>
  Array.isArray(window.__braverseContractTrace) ? window.__braverseContractTrace : [],
)
const waitForCommand = (page, kind) => page.waitForFunction(
  (wanted) => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === wanted),
  kind,
)
const waitForTraceGrowth = (page, previousLength, kind) => page.waitForFunction(
  ({ previousLength: from, kind: wanted }) => {
    const entries = window.__braverseContractTrace ?? []
    return entries.length > from && entries.slice(from).some((entry) => entry.commandKind === wanted)
  },
  { previousLength, kind },
)
const waitForTurnThreeAfterAttack = (page) => page.waitForFunction(
  () => document.querySelector('.turn-indicator')?.textContent?.includes('TURN 3') === true,
  null,
  { timeout: 15000 },
)
const faceName = (node) => node.querySelector('.card-face')?.getAttribute('title') ??
  node.querySelector('.card-face img')?.getAttribute('alt') ??
  node.querySelector('.card-fallback strong')?.textContent?.trim() ?? null

const readArt = async (locator) => locator.evaluate((node) => {
  const image = node.querySelector('img')
  const fallback = node.querySelector('.card-fallback')
  return {
    image: image ? { src: image.getAttribute('src'), alt: image.getAttribute('alt') } : null,
    fallbackName: fallback?.querySelector('strong')?.textContent?.trim() ?? null,
  }
})
const assertArt = (art, cardId) => {
  const card = cards[cardId]
  if (art.image) {
    assert.equal(art.image.src, card.imageUrl, `${cardId} must render its official card image URL`)
    assert.equal(art.image.alt, card.name, `${cardId} official image alt text`)
  } else {
    assert.equal(art.fallbackName, card.name, `${cardId} image fallback must name the official card`)
  }
}

const readField = async (page, side) => page.locator(`.${side}-field`).evaluate((field) => {
  const getName = (entry) => entry.querySelector('.card-face')?.getAttribute('title') ??
    entry.querySelector('.card-face img')?.getAttribute('alt') ??
    entry.querySelector('.card-fallback strong')?.textContent?.trim() ?? null
  const getHp = (entry) => Number(entry.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN)
  const zoneCount = (selector) => Number(field.querySelector(selector)?.textContent?.match(/\d+/)?.[0] ?? NaN)
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
    hand: [...field.querySelectorAll('.hand-card-wrap')].map((entry) => ({
      id: entry.getAttribute('data-card-instance-id'), name: getName(entry),
    })),
    discardCount: zoneCount('.discard-zone.resource-summary > strong'),
    breakCount: zoneCount('.break-zone .zone-heading b'),
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

const visible = async (locator) => (await locator.count()) > 0 && locator.first().isVisible().catch(() => false)
const clickEnabled = async (locator, description) => {
  await locator.waitFor({ state: 'visible' })
  assert.equal(await locator.isEnabled(), true, `${description} must be enabled`)
  await locator.click()
}
const skipAnimations = async (page) => {
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const button = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(button)) await button.click()
    await wait(100)
  }
}

const uniqueZoneIdByName = (zone, name, description) => {
  const matches = zone.filter((entry) => entry.name === name)
  assert.equal(matches.length, 1, `${description}: expected one visible instance named ${name}`)
  return matches[0].id
}
const selectedButtonName = async (button) => button.locator('.card-face img').getAttribute('alt').catch(async () =>
  button.locator('.card-fallback strong').textContent().then((value) => value?.trim() ?? null),
)

const handCardAction = async (page, cardId, actionText, evidence) => {
  const card = cards[cardId]
  const entry = page.locator('.bottom-field .hand-card-wrap').filter({
    has: page.locator(`.card-face[title="${card.name}"]`),
  }).first()
  await entry.waitFor({ state: 'visible' })
  evidence.art = await readArt(entry.locator('.card-face').first())
  assertArt(evidence.art, cardId)
  await entry.locator('.card-face').click()
  const action = entry.locator('.hand-card-action').filter({ hasText: actionText }).first()
  await clickEnabled(action, `${cardId} ${actionText} action`)
  return entry
}

const nextOrConfirmEffectPanel = async (panel) => {
  const primary = panel.locator('.effect-panel-primary-action').first()
  await primary.waitFor({ state: 'visible' })
  assert.equal(await primary.isEnabled(), true, 'effect panel current step must be ready')
  const label = (await primary.innerText()).trim()
  await primary.click()
  return label.includes('下一步') ? 'next' : 'confirmed'
}

const progressEffectPanel = async (panel, evidence) => {
  for (let step = 0; step < 6; step += 1) {
    const result = await nextOrConfirmEffectPanel(panel)
    if (result === 'confirmed') return
  }
  throw new Error('effect panel did not complete within six explicitly selected UI phases')
}

const run045 = async (page, evidence) => {
  if (evidence.negative) {
    const both = await readBothFields(page)
    const stage = page.locator('.bottom-field .stage-zone .resource-summary').first()
    await stage.waitFor({ state: 'visible' })
    assert.match(await stage.getAttribute('title') ?? '', /Grand Dust Hotel/)
    const activate = page.locator('.bottom-field .stage-quick-action')
    assert.equal(await activate.count(), 0, '045 with only one green and one red support must not expose G2 activation')
    assert.equal(both.bottom.supports.filter((support) => !support.rested).length, 2)
    evidence.art = await readArt(stage.locator('.card-face').first())
    assertArt(evidence.art, 'BS11-045')
    evidence.before = both
    evidence.after = both
    evidence.trace = await trace(page)
    assert.equal(evidence.trace.some((entry) => entry.commandKind === 'begin-activate-stage' || entry.commandKind === 'activate-stage'), false)
    evidence.result = 'G2 activation unavailable with one green plus one red support; no stage activation command'
    return
  }

  const before = await readBothFields(page)
  await handCardAction(page, 'BS11-045', '放置', evidence)
  const placement = page.locator('.stage-placement-modal')
  await placement.waitFor({ state: 'visible' })
  const placementButtons = placement.locator('.faint-payment-candidates button')
  assert.ok(await placementButtons.count() > 0, '045 placement requires a real active green support candidate')
  const placementName = await selectedButtonName(placementButtons.first())
  const placementId = uniqueZoneIdByName(before.bottom.supports, placementName, '045 placement payment')
  evidence.placementPaymentId = placementId
  await placementButtons.first().click()
  await clickEnabled(placement.getByRole('button', { name: '支付並放置', exact: true }), '045 stage placement confirmation')
  await waitForCommand(page, 'play-stage')
  const placed = await readBothFields(page)
  const stage = page.locator('.bottom-field .stage-zone .resource-summary').first()
  assert.match(await stage.getAttribute('title') ?? '', /Grand Dust Hotel/)
  await stage.waitFor({ state: 'visible' })
  await clickEnabled(page.locator('.bottom-field .stage-quick-action'), '045 stage activation')
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').first()
  await panel.waitFor({ state: 'visible' })
  const paymentButtons = panel.locator('.effect-candidates-payment:visible button:not(.is-selected)')
  assert.equal(await paymentButtons.count(), 2, '045 must expose the two remaining active G payments after placement')
  const activationIds = []
  for (let index = 0; index < 2; index += 1) {
    const button = paymentButtons.first()
    const name = await selectedButtonName(button)
    activationIds.push(uniqueZoneIdByName(placed.bottom.supports, name, '045 G2 activation payment'))
    await button.click()
  }
  evidence.activationPaymentIds = activationIds
  await clickEnabled(panel.locator('.effect-panel-primary-action'), '045 advance from G2 payment to automatic source-rest cost')
  const costPhase = panel.locator('.effect-panel-extra-cost-col:visible')
  await costPhase.waitFor({ state: 'visible' })
  assert.match(await costPhase.innerText(), /將效果來源卡橫置/)
  await clickEnabled(panel.locator('.effect-panel-primary-action'), '045 advance after automatic source-rest cost')
  await panel.locator('.effect-panel-target-col:visible').waitFor({ state: 'visible' })
  const targetButtons = panel.locator('.effect-candidates-target:visible button:not(.is-selected)')
  const targetButtonCount = await targetButtons.count()
  assert.equal(targetButtonCount, 2, '045 should offer both rested green Cookies and exclude the red control')
  const expectedGreenTargets = placed.bottom.battle.slice(0, 2)
  const targetIds = []
  for (const expectedTarget of expectedGreenTargets) {
    const target = targetButtons.filter({ hasText: expectedTarget.name })
    assert.equal(await target.count(), 1, `045 should offer exactly one candidate named ${expectedTarget.name}`)
    await target.waitFor({ state: 'visible' })
    assert.equal(await selectedButtonName(target), expectedTarget.name)
    targetIds.push(expectedTarget.id)
    await target.click()
  }
  evidence.targetIds = targetIds
  await progressEffectPanel(panel, evidence)
  await waitForCommand(page, 'resolve-ability-effect')
  await skipAnimations(page)
  evidence.before = before
  evidence.after = await readBothFields(page)
  for (const id of targetIds) {
    assert.equal(evidence.after.bottom.battle.find((entry) => entry.id === id)?.rested, false, `045 selected Cookie ${id} must become active`)
  }
  assert.equal(evidence.after.bottom.supports.find((entry) => entry.id === placementId)?.rested, true, '045 G placement support must be rested')
  for (const id of activationIds) assert.equal(evidence.after.bottom.supports.find((entry) => entry.id === id)?.rested, true)
  assert.equal(evidence.after.bottom.supports.length, evidence.before.bottom.supports.length)
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'play-stage'))
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'begin-activate-stage'))
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect'))
  evidence.result = 'Paid G to place, G2 to activate, and readied both selected green Cookies'
}

const openTrap = async (page, cardId) => {
  const modal = page.locator('.trap-response-modal[role="alertdialog"]:visible').first()
  await modal.waitFor({ state: 'visible' })
  if ((await modal.innerText()).includes('是否發動陷阱？')) {
    const trapButton = modal.locator('.modal-card-options button').filter({ hasText: cards[cardId].name }).first()
    await clickEnabled(trapButton, `${cardId} trap selection`)
  }
  await modal.getByRole('heading', { name: new RegExp(cards[cardId].name) }).waitFor({ state: 'visible' })
  return modal
}

const selectTrapPaymentsAndTarget = async (page, modal, cardId, before, count) => {
  const energy = modal.locator('.trap-guided-section').filter({ hasText: '能量支付' }).first()
  await energy.waitFor({ state: 'visible' })
  const buttons = energy.locator('.modal-card-options button:not(.is-selected)')
  assert.ok(await buttons.count() >= count, `${cardId} must have enough legal trap payment candidates`)
  const ids = []
  for (let index = 0; index < count; index += 1) {
    const button = buttons.first()
    const name = await selectedButtonName(button)
    ids.push(uniqueZoneIdByName(before.bottom.supports, name, `${cardId} trap payment`))
    await button.click()
  }
  const next = modal.getByRole('button', { name: '下一步', exact: true }).first()
  if (await next.count()) await clickEnabled(next, `${cardId} payment-to-target step`)
  const targetStep = modal.locator('.trap-effect-target-step').first()
  await targetStep.waitFor({ state: 'visible' })
  const target = targetStep.locator('.trap-target-options button.is-attacker').first()
  await clickEnabled(target, `${cardId} attacking Cookie target`)
  const targetName = await selectedButtonName(target)
  const targetMatches = [...before.bottom.battle, ...before.top.battle].filter((entry) => entry.name === targetName)
  assert.equal(targetMatches.length, 1, `${cardId} attacking Cookie target must resolve to one visible instance ID`)
  return { ids, targetName, targetId: targetMatches[0].id }
}

const clickTrapConfirmation = async (modal, cardId) => {
  for (let step = 0; step < 4; step += 1) {
    const next = modal.getByRole('button', { name: '下一步', exact: true }).first()
    if (await next.count() && await next.isVisible()) {
      await clickEnabled(next, `${cardId} trap next step`)
      continue
    }
    await clickEnabled(modal.getByRole('button', { name: '確認發動', exact: true }), `${cardId} trap confirmation`)
    return
  }
  throw new Error(`${cardId} trap response did not reach confirmation`)
}

const run046 = async (page, evidence) => {
  const before = await readBothFields(page)
  const ownCount = before.bottom.supports.length
  const opponentCount = before.top.supports.length
  assert.equal(ownCount, 2, '046 fixture must expose two own supports')
  assert.equal(opponentCount, evidence.negative ? 3 : 4, '046 support gap must be exactly one or at least two')
  evidence.art = evidence.trapArt
  evidence.before = before
  const modal = await openTrap(page, 'BS11-046')
  const { ids, targetName, targetId } = await selectTrapPaymentsAndTarget(page, modal, 'BS11-046', before, 2)
  evidence.paymentInstanceIds = ids
  evidence.effectTargetName = targetName
  evidence.effectTargetId = targetId
  assert.ok(before.top.battle.some((entry) => entry.id === targetId), '046 must target the opponent Cookie instance actually attacking')
  await clickTrapConfirmation(modal, 'BS11-046')
  await waitForCommand(page, 'play-trap')
  await waitForTurnThreeAfterAttack(page)
  await skipAnimations(page)
  evidence.after = await readBothFields(page)
  const defenderBefore = before.bottom.battle[0]
  const defenderAfter = evidence.after.bottom.battle.find((entry) => entry.id === defenderBefore.id)
  assert.ok(defenderAfter, '046 defended Cookie should survive the reduced attack')
  evidence.damageReceived = defenderBefore.hp - defenderAfter.hp
  assert.equal(evidence.damageReceived, evidence.negative ? 4 : 3, '046 should apply -2 damage, plus the conditional -1 only when the support gap is at least two')
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'play-trap'))
  assert.ok(evidence.trace.find((entry) => entry.commandKind === 'play-trap')?.steps.some((step) => step.includes(targetName)))
  evidence.result = `Applied the -2 attack modifier${evidence.negative ? ' without the support-gap Then' : ' with the additional -1 support-gap Then'}; received ${evidence.damageReceived} damage`
}

const run047 = async (page, evidence) => {
  await skipAnimations(page)
  const before = await readBothFields(page)
  evidence.before = before
  const entry = page.locator('.bottom-field .hand-card-wrap').filter({
    has: page.locator(`.card-face[title="${cards['BS11-047'].name}"]`),
  }).first()
  await entry.waitFor({ state: 'visible' })
  evidence.art = await readArt(entry.locator('.card-face').first())
  assertArt(evidence.art, 'BS11-047')
  await entry.locator('.card-face').click()
  const useAction = entry.locator('.hand-card-action').filter({ hasText: '使用' }).first()
  if (evidence.negative && (!(await useAction.count()) || !(await useAction.isEnabled()))) {
    evidence.after = await readBothFields(page)
    evidence.trace = await trace(page)
    assert.deepEqual(evidence.after, before, '047 unpayable item must leave all zones unchanged')
    assert.equal(evidence.trace.some((item) => item.commandKind === 'begin-play-item' || item.commandKind === 'play-item'), false)
    evidence.result = 'Item use is unavailable before declaration because its costs cannot be paid'
    return
  }
  await clickEnabled(useAction, '047 item use action')
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').first()
  await panel.waitFor({ state: 'visible' })
  const paymentButtons = panel.locator('.effect-candidates-payment:visible button:not(.is-selected)')
  if (evidence.negative) {
    assert.equal(await paymentButtons.count(), 0, '047 negative fixture must not offer green energy')
    assert.equal(await panel.locator('.effect-candidates-cost-support:visible button:not(.is-selected)').count(), 0, '047 negative fixture must not offer support-to-hand cost')
    evidence.trace = await trace(page)
    evidence.result = 'Item cost is unavailable; no play-item command should be sent'
    assert.equal(evidence.trace.some((entry) => entry.commandKind === 'begin-play-item' || entry.commandKind === 'play-item'), false)
    evidence.after = await readBothFields(page)
    assert.deepEqual(evidence.after, before)
    await page.getByRole('button', { name: '取消', exact: true }).click().catch(() => {})
    return
  }

  assert.ok(await paymentButtons.count() > 0, '047 positive route needs a legal green payment')
  const greenName = await selectedButtonName(paymentButtons.first())
  evidence.greenPaymentId = uniqueZoneIdByName(before.bottom.supports, greenName, '047 green energy payment')
  evidence.selectedPaymentNames.push(greenName)
  await paymentButtons.first().click()
  await clickEnabled(panel.locator('.effect-panel-primary-action'), '047 advance from green payment to support-to-hand cost')
  const activeSupportCostButtons = panel.locator('.effect-candidates-cost-support:visible button:not(.is-selected)')
  assert.ok(await activeSupportCostButtons.count() > 0, '047 must show the support-to-hand cost only after the G payment phase')
  const activeSupportCostName = await selectedButtonName(activeSupportCostButtons.first())
  evidence.supportReturnId = uniqueZoneIdByName(before.bottom.supports, activeSupportCostName, '047 support-to-hand item cost')
  assert.notEqual(evidence.greenPaymentId, evidence.supportReturnId, '047 energy and support-to-hand costs must use distinct support instances')
  evidence.selectedCostNames.push(activeSupportCostName)
  await activeSupportCostButtons.first().click()
  await progressEffectPanel(panel, evidence)
  await waitForCommand(page, 'begin-play-item')
  evidence.after = await readBothFields(page)
  const itemTrace = await trace(page)
  assert.ok(itemTrace.some((entry) => entry.commandKind === 'begin-play-item' || entry.commandKind === 'play-item'))
  assert.ok(itemTrace.some((entry) => entry.commandKind === 'resolve-ability-effect'), '047 must resolve its replacement effect after paying its item costs')
  assert.equal(evidence.after.bottom.supports.find((entry) => entry.id === evidence.greenPaymentId)?.rested, true)
  assert.equal(evidence.after.bottom.supports.some((entry) => entry.id === evidence.supportReturnId), false)
  assert.equal(evidence.after.bottom.hand.some((entry) => entry.id === evidence.supportReturnId), true)
  evidence.itemEffectTrace = itemTrace
  evidence.result = 'Paid G, returned the selected support as an item cost, and resolved Dumpling Censer through its normal UI'
}

const readExpandedBattleLog = async (page) => {
  const toggle = page.getByTestId('battle-log-toggle')
  if (!(await visible(page.getByTestId('battle-log-sidebar')))) await clickEnabled(toggle, 'open public battle log')
  const sidebar = page.getByTestId('battle-log-sidebar')
  await sidebar.waitFor({ state: 'visible' })
  const entries = sidebar.locator('.battle-log-entry.is-expandable')
  for (let index = 0; index < await entries.count(); index += 1) {
    const entry = entries.nth(index)
    if (await entry.getAttribute('aria-expanded') !== 'true') await entry.click()
  }
  return sidebar.innerText()
}

const run047Replacement = async (page, evidence) => {
  await skipAnimations(page)
  const before = await readBothFields(page)
  evidence.before = before
  evidence.turnIndicatorBefore = await page.locator('.turn-indicator').innerText()
  assert.match(evidence.turnIndicatorBefore, /你的回合/, '047 replacement route must expose player-two as the active local viewer')
  assert.ok(before.bottom.supports.length >= 1, '047 replacement fixture needs player-two neutral-payment support')
  assert.ok(before.top.supports.length >= 1, '047 replacement fixture needs an opponent support target')
  const fixtureTrace = await trace(page)
  evidence.fixtureCommandTrace = fixtureTrace
  assert.ok(fixtureTrace.some((item) => item.commandKind === 'begin-play-item'), '047 replacement fixture must preserve the formal Dumpling Censer begin-play command')
  assert.ok(fixtureTrace.some((item) => item.commandKind === 'resolve-ability-effect'), '047 replacement fixture must preserve formal Dumpling Censer effect settlement')
  const onPlayCookie = before.bottom.battle.find((entry) => entry.name === 'On Play Replacement Witness')
  assert.ok(onPlayCookie, '047 fixture must deploy the witness Cookie through deploy-cookie before Browser entry')
  assert.equal(before.bottom.hand.some((entry) => entry.name === onPlayCookie.name), false, '047 deployed Cookie must no longer be in hand')
  evidence.onPlayCookieName = onPlayCookie.name
  evidence.onPlayCookieId = onPlayCookie.id
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').first()
  await panel.waitFor({ state: 'visible' })
  evidence.onPlayPanelText = await panel.innerText()
  const paymentButtons = panel.locator('.effect-candidates-payment:visible button:not(.is-selected)')
  assert.ok(await paymentButtons.count() > 0, '047 replacement On Play must expose a legal 1N payment through the normal effect panel')
  const paymentName = await selectedButtonName(paymentButtons.first())
  evidence.replacementPaymentId = uniqueZoneIdByName(before.bottom.supports, paymentName, '047 replacement neutral payment')
  await paymentButtons.first().click()
  const next = panel.locator('.effect-panel-primary-action').first()
  await clickEnabled(next, '047 replacement payment step')

  const targetButtons = panel.locator('.effect-candidates-target:visible button:not(.is-selected)')
  assert.ok(await targetButtons.count() > 0, '047 replacement must expose a support-to-hand target after paying N')
  const opponentTargetIds = new Map(before.bottom.supports
    .filter((support) => support.id !== evidence.replacementPaymentId)
    .map((support) => [support.name, support.id]))
  const targetCandidates = []
  for (let index = 0; index < await targetButtons.count(); index += 1) {
    const button = targetButtons.nth(index)
    const name = await selectedButtonName(button)
    if (name && opponentTargetIds.has(name)) targetCandidates.push({ button, name, id: opponentTargetIds.get(name) })
  }
  assert.equal(targetCandidates.length, 1, '047 replacement must target the distinct player-two support, controlled by the opponent of Dumpling Censer')
  const selectedTarget = targetCandidates[0]
  evidence.returnedOpponentSupportId = selectedTarget.id
  evidence.returnedOpponentSupportName = selectedTarget.name
  await selectedTarget.button.click()
  await progressEffectPanel(panel, evidence)
  await page.waitForFunction((instanceId) => {
    const supportIds = [...document.querySelectorAll('.bottom-field .support-card-wrap')]
      .map((entry) => entry.getAttribute('data-card-instance-id'))
    const handIds = [...document.querySelectorAll('.bottom-field .hand-card-wrap')]
      .map((entry) => entry.getAttribute('data-card-instance-id'))
    return !supportIds.includes(instanceId) && handIds.includes(instanceId)
  }, evidence.returnedOpponentSupportId)
  await skipAnimations(page)

  evidence.after = await readBothFields(page)
  evidence.turnIndicatorAfter = await page.locator('.turn-indicator').innerText()
  assert.equal(evidence.turnIndicatorAfter, evidence.turnIndicatorBefore, '047 follow-through must not advance the turn number or ownership')
  assert.equal(evidence.after.bottom.supports.find((support) => support.id === evidence.replacementPaymentId)?.rested, true, '047 replacement must rest the selected player-two N payment')
  assert.equal(evidence.after.bottom.supports.some((support) => support.id === evidence.returnedOpponentSupportId), false, '047 replacement must remove the selected opponent support from player-two support area')
  assert.equal(evidence.after.bottom.hand.some((card) => card.id === evidence.returnedOpponentSupportId), true, '047 replacement must return the selected opponent support to player-two hand')

  evidence.trace = await trace(page)
  evidence.publicCommandTrace = await readExpandedBattleLog(page)
  assert.ok(evidence.publicCommandTrace.includes(onPlayCookie.name), 'battle log must show the normally deployed On Play Cookie')
  assert.ok(evidence.publicCommandTrace.includes(selectedTarget.name), 'battle log must show the selected opponent support return')
  evidence.result = 'A normal deploy-cookie command opened the On Play flow; Browser paid one neutral support and returned the selected support by instance ID'
}

const run048 = async (page, evidence) => {
  const before = await readBothFields(page)
  const defendedCookieBefore = before.bottom.battle[0]
  assert.ok(defendedCookieBefore, '048 fixture requires the Cookie currently receiving attack damage')
  evidence.before = before
  evidence.defendedCookieId = defendedCookieBefore.id
  assert.equal(defendedCookieBefore.hp, 7, '048 fixture must keep the reduced and unreduced attack paths observable without fainting')
  evidence.art = evidence.trapArt
  const modal = await openTrap(page, 'BS11-048')
  const { ids, targetName, targetId } = await selectTrapPaymentsAndTarget(page, modal, 'BS11-048', before, 1)
  evidence.greenPaymentId = ids[0]
  evidence.effectTargetName = targetName
  evidence.effectTargetId = targetId
  assert.ok(before.top.battle.some((entry) => entry.id === targetId), '048 must target the opponent Cookie instance actually attacking')
  await clickTrapConfirmation(modal, 'BS11-048')
  await waitForCommand(page, 'play-trap')
  const effectPanel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
  await effectPanel.waitFor({ state: 'visible' })
  const traceLengthBeforeThen = (await trace(page)).length
  await progressEffectPanel(effectPanel, evidence)
  await waitForTraceGrowth(page, traceLengthBeforeThen, 'resolve-ability-effect')
  const then = effectPanel.locator('.optional-cost-attack-inline')
  await then.waitFor({ state: 'visible' })
  const conditionWarning = then.locator('.optional-cost-attack-condition-warning').first()
  if (evidence.negative) {
    assert.match(await conditionWarning.innerText(), /目前條件不成立/)
  } else {
    assert.equal(await conditionWarning.count(), 0, '048 positive route must satisfy Wind Archer/Ancient before Then payment')
  }
  await clickEnabled(then.getByRole('button', { name: '支付', exact: true }), '048 optional Then 1N payment decision')
  const energyColumn = then.locator('.optional-cost-col').filter({ hasText: '能量' }).first()
  await energyColumn.waitFor({ state: 'visible' })
  const neutralCandidate = energyColumn.locator('.modal-card-options button:not(.is-selected)').first()
  const neutralName = await selectedButtonName(neutralCandidate)
  evidence.neutralPaymentId = uniqueZoneIdByName(before.bottom.supports, neutralName, '048 neutral Then payment')
  assert.notEqual(evidence.neutralPaymentId, evidence.greenPaymentId, '048 G and 1N payments must use distinct support instances')
  await neutralCandidate.click()
  await clickEnabled(then.getByRole('button', { name: '確認', exact: true }).last(), '048 confirm optional Then payment')
  await waitForCommand(page, 'resolve-optional-cost-attack')
  evidence.afterThenPayment = await readBothFields(page)
  assert.equal(evidence.afterThenPayment.bottom.supports.find((entry) => entry.id === evidence.greenPaymentId)?.rested, true, '048 G trap payment must remain rested before turn refresh')
  assert.equal(evidence.afterThenPayment.bottom.supports.find((entry) => entry.id === evidence.neutralPaymentId)?.rested, true, '048 neutral Then payment must remain rested before turn refresh')
  if (evidence.negative) {
    assert.equal(await page.locator('.effect-panel[role="alertdialog"]:visible .effect-candidates-target button:not(.is-selected)').count(), 0, '048 failed post-payment condition must not offer an opponent support target')
    const skippedEffectPanel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
    await skippedEffectPanel.waitFor({ state: 'visible' })
    const traceLengthBeforeSkippedEffect = (await trace(page)).length
    await progressEffectPanel(skippedEffectPanel, evidence)
    await waitForTraceGrowth(page, traceLengthBeforeSkippedEffect, 'resolve-ability-effect')
  } else {
    const restEffectPanel = page.locator('.effect-panel[role="alertdialog"]:visible').last()
    await restEffectPanel.waitFor({ state: 'visible' })
    const restCandidates = restEffectPanel.locator('.effect-candidates-target:visible button:not(.is-selected)')
    assert.ok(await restCandidates.count() > 0, '048 positive condition must expose an active opponent support target')
    const restName = await selectedButtonName(restCandidates.first())
    evidence.restTargetId = uniqueZoneIdByName(before.top.supports, restName, '048 opponent support rest target')
    await restCandidates.first().click()
    const traceLengthBeforeRest = (await trace(page)).length
    await progressEffectPanel(restEffectPanel, evidence)
    await waitForTraceGrowth(page, traceLengthBeforeRest, 'resolve-ability-effect')
  }
  await waitForTurnThreeAfterAttack(page)
  await skipAnimations(page)
  evidence.after = await readBothFields(page)
  const defenderAfter = evidence.after.bottom.battle.find((entry) => entry.id === evidence.defendedCookieId)
  assert.ok(defenderAfter, '048 defender must survive both attack paths in the seven-HP fixture')
  evidence.damageReceived = defendedCookieBefore.hp - defenderAfter.hp
  assert.equal(evidence.damageReceived, 5, '048 must apply the base -1 attack damage in both condition routes')
  if (evidence.negative) {
    assert.deepEqual(evidence.after.top.supports, before.top.supports, '048 failed condition must not rest an opponent support')
  } else {
    assert.equal(evidence.after.top.supports.find((entry) => entry.id === evidence.restTargetId)?.rested, true)
  }
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'play-trap'))
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect'))
  const optionalThenTrace = evidence.trace.find((entry) => entry.commandKind === 'resolve-optional-cost-attack')
  assert.ok(optionalThenTrace, '048 must publish the optional-cost Then command')
  const optionalThenLog = [optionalThenTrace.summary, ...optionalThenTrace.steps].join('\n')
  if (evidence.negative) {
    assert.match(optionalThenLog, /條件不成立，效果未執行/, '048 failed post-payment condition must be logged as a no-op')
  } else {
    assert.doesNotMatch(optionalThenLog, /條件不成立|效果未執行/, '048 satisfied Then condition must not be logged as a no-op')
    assert.match(optionalThenLog, /等待後續傷害／FLIP 或巢狀效果結算/, '048 positive Then log must report that its nested target resolution follows')
  }
  evidence.result = evidence.negative
    ? 'Paid G and optional 1N; the post-payment condition failed, so no opponent support was rested'
    : 'Paid G and optional 1N; selected and rested one active opponent support after the condition passed'
}

const run049 = async (page, evidence) => {
  const before = await readBothFields(page)
  evidence.before = before
  await handCardAction(page, 'BS11-049', '使用', evidence)
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').first()
  await panel.waitFor({ state: 'visible' })
  const paymentButtons = panel.locator('.effect-candidates-payment:visible button:not(.is-selected)')
  assert.ok(await paymentButtons.count() > 0, '049 needs one active green energy payment')
  const paymentName = await selectedButtonName(paymentButtons.first())
  evidence.paymentId = uniqueZoneIdByName(before.bottom.supports, paymentName, '049 green item payment')
  evidence.selectedPaymentNames.push(paymentName)
  await paymentButtons.first().click()
  await clickEnabled(panel.locator('.effect-panel-primary-action'), '049 advance from green payment to trash target selection')

  const targetButtons = panel.locator('.effect-candidates-target:visible button:not(.is-selected)')
  if (evidence.negative) {
    assert.equal(await targetButtons.count(), 0, '049 negative fixture must have no legal named Wind Archer target')
    evidence.selectedTargetIds = []
    await progressEffectPanel(panel, evidence)
  } else {
    const target = targetButtons.filter({ hasText: 'Wind Archer Cookie' }).first()
    await target.waitFor({ state: 'visible' })
    assert.equal(await targetButtons.filter({ hasText: 'Wind Archer Cookie' }).count(), 1, '049 positive fixture should offer exactly one named Wind Archer target')
    evidence.selectedTargetName = 'Wind Archer Cookie'
    await target.click()
    evidence.selectedTargetIds = ['Wind Archer Cookie']
    await progressEffectPanel(panel, evidence)
  }
  await waitForCommand(page, 'begin-play-item')
  await waitForCommand(page, 'resolve-ability-effect')
  await skipAnimations(page)
  evidence.after = await readBothFields(page)
  evidence.trace = await trace(page)
  assert.equal(evidence.after.bottom.supports.find((entry) => entry.id === evidence.paymentId)?.rested, true)
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'begin-play-item' || entry.commandKind === 'play-item'))
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect'))
  const windArchersAfter = evidence.after.bottom.battle.filter((entry) => entry.name === 'Wind Archer Cookie')
  if (evidence.negative) {
    assert.equal(windArchersAfter.length, 0, '049 no-target resolution must not invent a Wind Archer Cookie')
    assert.equal(evidence.selectedTargetIds.length, 0)
    evidence.result = 'Paid G; no legal Wind Archer target was selected and none entered battle'
  } else {
    assert.equal(windArchersAfter.length, 1, '049 selected Wind Archer must enter battle')
    assert.ok(evidence.trace.flatMap((entry) => entry.steps).some((step) => step.includes('Wind Archer Cookie')))
    evidence.result = 'Paid G and played the selected Wind Archer Cookie from trash'
  }
}

const runCase = async (browser, viewport, cardId, routeKind) => {
  const card = cards[cardId]
  const negative = routeKind === 'negative'
  const route = `bs11-thirteenth-batch:${cardId}:${routeKind}`
  const page = await browser.newPage({ viewport })
  await routeBs11OfficialArt(page)
  page.setDefaultTimeout(15000)
  const evidence = {
    cardNumber: cardId,
    name: card.name,
    route,
    viewport,
    negative,
    fixture: card.fixture[routeKind],
    status: 'FAIL',
    errors: [],
    knownImageNetworkRestrictions: [],
    selectedPaymentNames: [],
    selectedCostNames: [],
  }
  recordBrowserIssues(page, evidence)
  try {
    const url = new URL('/', baseUrl)
    url.searchParams.set('test-state', route)
    url.searchParams.set('contract-card', contractCards)
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    evidence.initialStateText = await page.locator('.game-shell').innerText()
    if (cardId === 'BS11-046' || cardId === 'BS11-048' || cardId === 'BS11-048@1') {
      evidence.trapArt = await readArt(page.locator('.trap-response-modal .trap-selected-card-detail .card-face').first()).catch(() => null)
      if (evidence.trapArt) assertArt(evidence.trapArt, cardId)
      if (!evidence.trapArt) {
        const option = page.locator('.trap-response-modal .modal-card-options button').filter({ hasText: card.name }).first()
        evidence.trapArt = await readArt(option.locator('.card-face').first())
        assertArt(evidence.trapArt, cardId)
      }
    }
    if (cardId === 'BS11-045') await run045(page, evidence)
    else if (cardId === 'BS11-046') await run046(page, evidence)
    else if (cardId === 'BS11-047' && routeKind === 'replacement') await run047Replacement(page, evidence)
    else if (cardId === 'BS11-047') await run047(page, evidence)
    else if (cardId === 'BS11-048' || cardId === 'BS11-048@1') await run048(page, evidence)
    else await run049(page, evidence)
    assert.deepEqual(evidence.errors, [], `${cardId} Browser errors: ${evidence.errors.join('; ')}`)
    evidence.status = 'PASS'
  } catch (error) {
    evidence.error = error.stack ?? String(error)
    evidence.body = await page.locator('body').innerText().catch(() => '')
    evidence.trace = await trace(page).catch(() => [])
  } finally {
    await page.close()
  }
  console.log(`${evidence.status} ${cardId} ${routeKind} ${viewport.width}x${viewport.height}${evidence.error ? `: ${evidence.error.split('\n')[0]}` : ''}`)
  return evidence
}

const chromiumBrowser = await chromium.launch({
  headless: true,
  ...(browserExecutable ? { executablePath: browserExecutable } : {}),
})
const results = []
try {
  for (const viewport of selectedViewports) {
    for (const cardId of selectedCards) {
      for (const routeKind of ['positive', 'negative']) {
        results.push(await runCase(chromiumBrowser, viewport, cardId, routeKind))
      }
    }
    if (selectedCards.includes('BS11-047')) {
      results.push(await runCase(chromiumBrowser, viewport, 'BS11-047', 'replacement'))
    }
  }
} finally {
  await chromiumBrowser.close()
}

for (const viewport of selectedViewports) {
  const pair046 = results.filter((entry) => entry.cardNumber === 'BS11-046' && entry.viewport.width === viewport.width)
  const positive046 = pair046.find((entry) => !entry.negative)
  const negative046 = pair046.find((entry) => entry.negative)
  if (positive046?.status === 'PASS' && negative046?.status === 'PASS') {
    try {
      assert.equal(positive046.effectTargetId, negative046.effectTargetId, '046 A/B must select the same attacking Cookie instance')
      assert.equal(positive046.before.bottom.battle[0]?.id, negative046.before.bottom.battle[0]?.id, '046 A/B must use the same defending Cookie instance')
      assert.equal(positive046.before.bottom.battle[0]?.hp, negative046.before.bottom.battle[0]?.hp, '046 A/B must start at the same defender HP')
      assert.equal(negative046.damageReceived - positive046.damageReceived, 1, '046 support gap >=2 must reduce damage by one more than the gap <2 route')
    } catch (error) {
      positive046.status = 'FAIL'
      positive046.error = String(error)
      negative046.status = 'FAIL'
      negative046.error = String(error)
    }
  }
}
const failed = results.filter((entry) => entry.status !== 'PASS').length
const artifactPath = resolve(artifactDir, `bs11-045-049-browser-${Date.now()}.json`)
const artifact = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  routeFormat: 'test-state=bs11-thirteenth-batch:BS11-045|046|047|048|048@1|049:positive|negative; plus bs11-thirteenth-batch:BS11-047:replacement',
  scope: `Candidate-only Browser evidence using the normal local game UI. Selected cards: ${selectedCards.join(', ')}; selected viewports: ${selectedViewports.map(({ width, height }) => `${width}x${height}`).join(', ')}. Each selected card runs positive and negative routes; BS11-047 additionally runs replacement follow-through. Not formal or online acceptance.`,
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
const expectedTotal = selectedViewports.length * (selectedCards.length * 2 + (selectedCards.includes('BS11-047') ? 1 : 0))
if (results.length !== expectedTotal || failed > 0) process.exitCode = 1
