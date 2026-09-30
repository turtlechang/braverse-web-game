import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

// Candidate-only Browser evidence for BS10-001..005 (including 005@1).
// Actions are driven through rendered controls; DOM snapshots are the public
// state witness and __braverseContractTrace is retained as the command trace.
const root = resolve(import.meta.dirname, '..')
const output = resolve(root, 'test-results/bs10-first-batch-browser')
mkdirSync(output, { recursive: true })
const baseUrl = process.env.BRAVERSE_BS10_BASE_URL ?? 'http://127.0.0.1:4190'
const executablePath = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find(existsSync)
const viewports = [
  { width: 1907, height: 863 },
  { width: 1164, height: 777 },
]
const selectedViewports = process.env.BRAVERSE_BS10_VIEWPORTS
  ? viewports.filter((viewport) => process.env.BRAVERSE_BS10_VIEWPORTS.split(',').includes(String(viewport.width)))
  : viewports
const only = process.env.BRAVERSE_BS10_ONLY ?? 'all'

const cardNames = {
  'BS10-001': 'Princess Cookie',
  'BS10-002': 'Grandberry Merchant',
  'BS10-003': 'Raspberry Mousse Cookie',
  'BS10-004': 'Bumbleberry Cookie',
  'BS10-005': 'Cherry Blossom Cookie',
  'BS10-005@1': 'Cherry Blossom Cookie',
}
const candidateRecords = JSON.parse(readFileSync(resolve(root, 'data/cards/official-paradise-of-passion-and-sloth-catacombs-of-silence-bs10.en.json'), 'utf8')).cards
const candidateImagePaths = Object.fromEntries(candidateRecords.map((record) => [record.cardNumber, new URL(record.imageUrl).pathname]))
const formalBs6Records = JSON.parse(readFileSync(resolve(root, 'data/cards/official-age-of-heroes-and-kingdoms-bs6.en.json'), 'utf8')).cards
const energyColorByImagePath = Object.fromEntries(formalBs6Records.map((record) => [
  new URL(record.imageUrl).pathname,
  record.color.toLowerCase(),
]))
const attackCases = [
  ['BS10-002', 1, 2],
  ['BS10-005', 2, 3],
  ['BS10-005@1', 2, 3],
]

const panel = (page) => page.locator('.effect-panel:visible').first()
const sourceCard = (page, name) => page.locator('.bottom-field .combat-card-wrap').filter({
  has: page.locator(`.card-face[title="${name}"]`),
}).first()
const numberFrom = (text) => {
  assert.equal(typeof text, 'string', `expected a non-empty numeric string, received ${String(text)}`)
  const value = text.trim().split('/')[0].trim()
  assert.ok(value.length > 0, 'expected a non-empty numeric string')
  assert.match(value, /^-?\d+$/, `expected a numeric counter, received ${text}`)
  const number = Number(value)
  assert.ok(Number.isFinite(number), `expected a finite numeric counter, received ${text}`)
  return number
}

const assertFinitePublicState = (state) => {
  assert.ok(state?.bottom && state?.top, 'public field state is missing')
  for (const side of ['bottom', 'top']) {
    const field = state[side]
    assert.ok(Number.isFinite(numberFrom(field.hand)), `${side} hand counter is not numeric: ${field.hand}`)
    assert.ok(Number.isFinite(numberFrom(field.deck)), `${side} deck counter is not numeric: ${field.deck}`)
    assert.ok(Number.isFinite(numberFrom(field.trash)), `${side} trash counter is not numeric: ${field.trash}`)
    for (const entry of field.battle) {
      if (entry.hp !== null) assert.ok(Number.isFinite(numberFrom(entry.hp)), `${side} HP is not numeric: ${entry.hp}`)
      if (entry.attack !== null) assert.ok(Number.isFinite(numberFrom(entry.attack)), `${side} attack is not numeric: ${entry.attack}`)
    }
  }
}

const publicState = async (page) => page.evaluate(() => {
  const readField = (side) => {
    const root = document.querySelector(`.${side}-field`)
    if (!root) return null
    const text = (selector) => root.querySelector(selector)?.textContent?.trim() ?? null
    return {
      hand: text('.row-stat-hand .row-stat-value'),
      deck: text('.deck-zone .resource-summary > strong'),
      trash: text('button.discard-zone.resource-summary > strong'),
      support: [...root.querySelectorAll('.support-card-wrap .card-face')].map((card) => ({
        title: card.getAttribute('title'),
        rested: card.classList.contains('is-rested'),
      })),
      battle: [...root.querySelectorAll('.combat-card-wrap')].map((entry) => ({
        id: entry.getAttribute('data-card-instance-id'),
        name: entry.querySelector('.card-face')?.getAttribute('title'),
        hp: entry.querySelector('.badge-hp')?.textContent?.trim() ?? null,
        attack: entry.querySelector('.badge-atk')?.textContent?.trim() ?? null,
        rested: entry.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
      })),
    }
  }
  const turnIndicator = document.querySelector('.turn-indicator')
  return {
    bottom: readField('bottom'),
    top: readField('top'),
    turn: turnIndicator?.querySelector('span')?.textContent?.trim() ?? null,
    phase: turnIndicator?.querySelector('strong')?.textContent?.trim() ?? null,
  }
})

const trace = async (page) => page.evaluate(() => Array.isArray(window.__braverseContractTrace)
  ? window.__braverseContractTrace
  : [])

const waitTrace = async (page, kinds) => {
  const expected = Array.isArray(kinds) ? kinds : [kinds]
  await page.waitForFunction((wanted) => {
    const entries = window.__braverseContractTrace ?? []
    return wanted.every((kind) => entries.some((entry) => entry.commandKind === kind))
  }, expected)
}

const assertTraceSequence = (entries, kinds) => {
  let cursor = -1
  for (const kind of kinds) {
    const next = entries.findIndex((entry, index) => index > cursor && entry.commandKind === kind)
    assert.notEqual(next, -1, `trace must contain ${kinds.join(' -> ')} in order`)
    cursor = next
  }
}

const waitForInteractionReady = async (page) => {
  await page.waitForFunction(() => {
    const animation = document.querySelector('.match-animation-layer')
    const animationPlaying = animation?.getAttribute('data-playing') === 'true'
    const visible = (selector) => [...document.querySelectorAll(selector)].some((element) => {
      const style = window.getComputedStyle(element)
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0
    })
    const nextPhase = document.querySelector('.next-phase-button')
    return !animationPlaying &&
      !visible('.effect-panel, [data-testid="attack-payment-panel"], .battle-response-modal') &&
      Boolean(nextPhase && !nextPhase.disabled)
  })
}

const waitForVisualSettled = async (page) => {
  await page.waitForFunction(() => {
    const visible = (selector) => [...document.querySelectorAll(selector)].some((element) => {
      const style = window.getComputedStyle(element)
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0
    })
    const animation = document.querySelector('.match-animation-layer')
    return animation?.getAttribute('data-playing') !== 'true' &&
      !visible('.flip-response-modal, .draw-up-to-modal, .decision-modal, .effect-panel, [data-testid="attack-payment-panel"], .battle-response-modal')
  })
}

const ensureImage = async (page, card) => {
  const expectedPath = candidateImagePaths[card]
  assert.ok(expectedPath, `candidate image URL is missing for ${card}`)
  await page.waitForFunction((path) => [...document.images].some((image) => {
    return new URL(image.src, window.location.href).pathname === path && image.complete && image.naturalWidth > 0
  }), expectedPath)
  const image = page.locator(`img[src*="${expectedPath.split('/').pop()}"]`).first()
  return { name: cardNames[card], src: await image.getAttribute('src'), expectedPath }
}

const runOnPage = async (card, viewport, action) => {
  const page = await action.browser.newPage({ viewport })
  page.setDefaultTimeout(15000)
  const evidence = {
    card,
    label: action.label,
    route: action.route,
    viewport,
    status: 'FAIL',
    errors: [],
    knownWarnings: [],
    imageFailures: [],
    requests: [],
    responses: [],
  }
  page.on('pageerror', (error) => evidence.errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('favicon') && !message.text().startsWith('Failed to load resource')) {
      evidence.errors.push(`console:${message.type()}: ${message.text()}`)
    }
  })
  page.on('requestfailed', (request) => {
    const item = { url: request.url(), type: request.resourceType(), reason: request.failure()?.errorText ?? 'unknown' }
    if (request.url().includes('favicon')) {
      evidence.knownWarnings.push(item)
      return
    }
    if (request.resourceType() === 'image') evidence.imageFailures.push(item)
    else evidence.errors.push(`${item.type} request failed: ${item.url} ${item.reason}`)
  })
  page.on('request', (request) => evidence.requests.push({ method: request.method(), type: request.resourceType(), url: request.url() }))
  page.on('response', (response) => {
    const item = { status: response.status(), type: response.request().resourceType(), url: response.url() }
    evidence.responses.push(item)
    if (response.status() === 404 && response.url().includes('favicon')) evidence.knownWarnings.push(item)
  })
  try {
    // Variant routes keep the printed card id in command-log entries while
    // preserving the @variant suffix only for the candidate image/instance.
    const contractCard = action.contractCard ?? card.split('@')[0]
    await page.goto(`${baseUrl}/?test-state=${action.route}&contract-card=${encodeURIComponent(contractCard)}`, { waitUntil: 'domcontentloaded' })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    evidence.before = await publicState(page)
    assertFinitePublicState(evidence.before)
    evidence.image = await ensureImage(page, card)
    evidence.beforeScreenshot = resolve(output, `${card.replace('@', '-')}-${action.label}-${viewport.width}-before.png`)
    await page.screenshot({ path: evidence.beforeScreenshot, fullPage: true })
    await action.run(page, evidence)
    evidence.after = await publicState(page)
    assertFinitePublicState(evidence.after)
    evidence.trace = await trace(page)
    assert.deepEqual(evidence.imageFailures, [], 'card images and other assets must load')
    assert.deepEqual(evidence.errors, [], 'console/page errors must remain empty')
    evidence.status = 'PASS'
  } catch (error) {
    evidence.error = error.stack ?? String(error)
    evidence.body = await page.locator('body').innerText().catch(() => '')
    evidence.after = await publicState(page).catch(() => null)
    evidence.trace = await trace(page).catch(() => [])
  } finally {
    evidence.screenshot = resolve(output, `${card.replace('@', '-')}-${action.label}-${viewport.width}-${evidence.status}.png`)
    await page.screenshot({ path: evidence.screenshot, fullPage: true }).catch(() => {})
    await page.close()
  }
  console.log(`${card} ${action.label} ${viewport.width}x${viewport.height}: ${evidence.status}${evidence.error ? ` ${evidence.error.split('\n')[0]}` : ''}`)
  return evidence
}

const run001 = async (page, evidence) => {
  const source = sourceCard(page, cardNames['BS10-001'])
  await source.waitFor()
  const before = evidence.before
  await source.locator('.skill-action').click()
  const firstPanel = panel(page)
  await firstPanel.waitFor()
  await firstPanel.locator('.effect-candidates-discard-hand button').first().click()
  assert.equal(await firstPanel.locator('.effect-panel-primary-action').isEnabled(), false)
  await firstPanel.locator('.skip-effect').click()
  assert.deepEqual(await publicState(page), before, 'cancel must preserve public resources')
  await page.screenshot({ path: resolve(output, `BS10-001-cancel-${evidence.viewport.width}.png`), fullPage: true })

  await source.locator('.skill-action').click()
  const skillPanel = panel(page)
  await skillPanel.locator('.effect-candidates-discard-hand button').nth(1).click()
  await skillPanel.locator('.effect-candidates-discard-hand button').nth(0).click()
  assert.equal(await skillPanel.locator('.effect-panel-primary-action').isEnabled(), true)
  await page.screenshot({ path: resolve(output, `BS10-001-cost-${evidence.viewport.width}.png`) })
  await skillPanel.locator('.effect-panel-primary-action').click()
  const target = skillPanel.locator('.effect-candidates-target button').first()
  if (await target.isEnabled()) await target.click()
  else assert.equal(await target.getAttribute('data-fixed-target'), 'true')
  await skillPanel.locator('.effect-panel-primary-action').click()
  await skillPanel.waitFor({ state: 'hidden' })
  await waitTrace(page, 'resolve-ability-effect')
  await waitForInteractionReady(page)
  const afterSkill = await publicState(page)
  assert.equal(numberFrom(afterSkill.bottom.hand), numberFrom(before.bottom.hand) - 2)
  assert.equal(numberFrom(afterSkill.bottom.trash), numberFrom(before.bottom.trash) + 2)
  assert.equal(await source.locator('.badge-atk').innerText(), '3')
  assert.equal(await source.locator('.skill-action').isEnabled(), false, 'once per turn')

  await source.locator('.card-face.is-attackable').click()
  for (let index = 0; index < 2; index += 1) {
    await page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').last().click()
  }
  assert.match(await page.locator('[data-testid="attack-payment-panel"]').innerText(), /付款合法/)
  const attackTarget = page.locator('.top-field .combat-card-wrap .card-face[aria-label^="選擇攻擊目標："]').first()
  const targetId = await attackTarget.evaluate((node) => node.closest('.combat-card-wrap')?.getAttribute('data-card-instance-id'))
  await attackTarget.click()
  await waitTrace(page, 'resolve-battle')
  const afterAttack = await publicState(page)
  const targetBefore = before.top.battle.find((entry) => entry.id === targetId)
  const targetAfter = afterAttack.top.battle.find((entry) => entry.id === targetId)
  assert.equal(numberFrom(targetAfter?.hp), numberFrom(targetBefore?.hp) - 3, 'printed 2 plus skill 1')
  const attackTrace = await trace(page)
  assertTraceSequence(attackTrace, [
    'begin-activate-skill',
    'resolve-ability-effect',
    'declare-attack',
    'resolve-battle',
  ])
  await waitForInteractionReady(page)
  const phaseBefore = await page.locator('.turn-indicator strong').innerText()
  const nextPhase = page.locator('.next-phase-button')
  assert.equal(await nextPhase.isEnabled(), true, 'next phase must be enabled after animation and decisions settle')
  evidence.continuation = {
    beforePhase: phaseBefore,
    button: await nextPhase.innerText(),
    screenshot: resolve(output, `BS10-001-continuation-${evidence.viewport.width}.png`),
  }
  await page.screenshot({ path: evidence.continuation.screenshot, fullPage: true })
  await nextPhase.click()
  await page.waitForFunction((previous) => document.querySelector('.turn-indicator strong')?.textContent?.trim() !== previous, phaseBefore)
  evidence.continuation.afterPhase = await page.locator('.turn-indicator strong').innerText()
}

const runSkillNegative = async (page, evidence) => {
  const source = sourceCard(page, cardNames['BS10-001'])
  await source.waitFor()
  assert.equal(await source.locator('.skill-action').isEnabled(), false, 'one hand card cannot pay Discard 2')
  assert.equal(await panel(page).count(), 0)
  assert.equal(numberFrom(evidence.before.bottom.hand), 1, 'negative fixture must expose exactly one hand card')
  assert.match(await source.locator('.skill-unavailable-reason').innerText(), /支付要求/)
  assert.equal((await trace(page)).some((entry) => entry.commandKind === 'begin-activate-skill'), false)
  assert.deepEqual(await publicState(page), evidence.before, 'negative skill route must preserve all public state')
}

const runSimpleAttack = async (page, evidence, expectedDamage, cost, negative, targetInstanceId, requireMixedPayment = false) => {
  const source = sourceCard(page, cardNames[evidence.card])
  await source.waitFor()
  const before = evidence.before
  const targetBefore = before.top.battle.find((entry) => entry.id === (targetInstanceId ?? before.top.battle[0]?.id))
  assert.ok(targetBefore, `fixture target ${targetInstanceId ?? '(default)'} is missing`)
  if (negative) {
    const sourceId = await source.getAttribute('data-card-instance-id')
    const sourceBefore = before.bottom.battle.find((entry) => entry.id === sourceId)
    assert.equal(sourceBefore?.rested, false, 'negative fixture source must remain active')
    assert.equal(before.bottom.support.filter((support) => !support.rested).length, Math.max(0, cost - 1))
    assert.match(await source.innerText(), /能量不足|支付要求|需要/)
    const attackable = source.locator('.card-face.is-attackable')
    if (await attackable.count()) {
      await attackable.click()
      const payment = page.locator('[data-testid="attack-payment-panel"]')
      await payment.waitFor()
      evidence.blockedPayment = {
        text: await payment.innerText(),
        state: await publicState(page),
      }
      assert.match(evidence.blockedPayment.text, /不合法|不足|缺少|需要/)
      await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
      await payment.waitFor({ state: 'hidden' })
    }
    assert.equal((await trace(page)).some((entry) => entry.commandKind === 'declare-attack'), false)
    assert.deepEqual(await publicState(page), before)
    return
  }
  await source.locator('.card-face.is-attackable').click()
  const payment = page.locator('[data-testid="attack-payment-panel"]')
  await payment.waitFor()
  const restedBefore = before.bottom.support.filter((support) => support.rested).length
  const supports = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)')
  assert.ok(await supports.count() >= cost, `requires ${cost} active payment cards`)
  const selectedPayments = []
  for (let index = 0; index < cost; index += 1) {
    const availableSupports = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)')
    const nextSupport = index === cost - 1 ? availableSupports.last() : availableSupports.first()
    const paymentName = await nextSupport.locator('img').getAttribute('alt')
    assert.ok(paymentName, 'selected payment must expose a real card name')
    const paymentSrc = await nextSupport.locator('img').getAttribute('src')
    const paymentPath = paymentSrc ? new URL(paymentSrc, 'http://127.0.0.1').pathname : undefined
    const energyColor = paymentPath ? energyColorByImagePath[paymentPath] : undefined
    assert.ok(energyColor, `selected payment ${paymentName} must match a formal BS6 color record`)
    selectedPayments.push({
      name: paymentName,
      energyColor,
      src: paymentSrc,
    })
    await nextSupport.click()
  }
  if (requireMixedPayment) {
    assert.ok(selectedPayments.some((payment) => payment.energyColor === 'green'), 'positive payment must include a real green support')
    assert.ok(selectedPayments.some((payment) => payment.energyColor === 'red'), 'positive payment must include a real red support')
  }
  evidence.payments = selectedPayments
  assert.match(await payment.innerText(), /付款合法/)
  const target = page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${targetBefore.id}"] .card-face[aria-label^="選擇攻擊目標："]`)
  await target.waitFor()
  const targetId = await target.evaluate((node) => node.closest('.combat-card-wrap')?.getAttribute('data-card-instance-id'))
  assert.equal(targetId, targetBefore.id, 'attack must use the shared fixture target instance')
  await target.click()
  await waitTrace(page, ['resolve-battle'])
  const after = await publicState(page)
  evidence.afterSettlement = after
  const targetAfter = after.top.battle.find((entry) => entry.id === targetId)
  assert.ok(targetAfter, 'the shared fixture target must remain available after this attack')
  assert.equal(numberFrom(targetAfter.hp), numberFrom(targetBefore.hp) - expectedDamage)
  assert.equal(after.bottom.support.filter((support) => support.rested).length, restedBefore + cost)
  await waitForInteractionReady(page)
  const phaseBefore = await page.locator('.turn-indicator strong').innerText()
  const nextPhase = page.locator('.next-phase-button')
  assert.equal(await nextPhase.isEnabled(), true, 'next phase must be enabled after attack settlement')
  evidence.continuation = { beforePhase: phaseBefore, button: await nextPhase.innerText() }
  await nextPhase.click()
  await page.waitForFunction((previous) => document.querySelector('.turn-indicator strong')?.textContent?.trim() !== previous, phaseBefore)
  evidence.continuation.afterPhase = await page.locator('.turn-indicator strong').innerText()
}

const run004Positive = async (page, evidence) => {
  const source = sourceCard(page, cardNames['BS10-004'])
  await source.waitFor()
  await source.locator('.skill-action').click()
  const effect = panel(page)
  await effect.waitFor()
  const target = effect.locator('.effect-candidates-target button').first()
  if (await target.count()) {
    if (await target.isEnabled()) await target.click()
    else assert.equal(await target.getAttribute('data-fixed-target'), 'true')
  }
  await effect.locator('.effect-panel-primary-action').click()
  await effect.waitFor({ state: 'hidden' })
  await waitTrace(page, 'resolve-ability-effect')
  assert.equal(await source.locator('.badge-atk').innerText(), '2', 'opponent faint counter grants +1')
  await runSimpleAttack(page, evidence, 2, 2, false, 'opp-lv3')
}

const run004Negative = async (page, evidence) => {
  const source = sourceCard(page, cardNames['BS10-004'])
  await source.waitFor()
  assert.equal(await source.locator('.skill-action').isEnabled(), false, 'no opponent faint this turn')
  assert.equal(await panel(page).count(), 0)
  await runSimpleAttack(page, evidence, 1, 2, false, 'opp-lv3')
}

const run003Flip = async (page, evidence, mode) => {
  const flip = page.locator('.flip-response-modal')
  await flip.waitFor()
  assert.match(await flip.innerText(), /Raspberry Mousse Cookie FLIP/)
  if (mode === 'decline') {
    await flip.getByRole('button', { name: '不發動', exact: true }).click()
    await waitTrace(page, 'resolve-flip')
  } else {
    await flip.getByRole('button', { name: '發動 FLIP', exact: true }).click()
    const draw = page.locator('.draw-up-to-modal')
    await draw.waitFor()
    await draw.locator('.draw-up-to-option').nth(Number(mode.replace('draw', ''))).click()
    await draw.locator('.draw-up-to-actions button').click()
    await waitTrace(page, ['resolve-flip', 'resolve-draw-up-to'])
  }
  await waitForVisualSettled(page)
  evidence.flipMode = mode
  const after = await publicState(page)
  assert.equal(numberFrom(after.bottom.hand), numberFrom(evidence.before.bottom.hand) + (mode === 'draw1' ? 1 : 0))
  assert.equal(numberFrom(after.bottom.deck), numberFrom(evidence.before.bottom.deck) - (mode === 'draw1' ? 1 : 0))
  assert.equal(numberFrom(after.bottom.trash), numberFrom(evidence.before.bottom.trash) + 1)
  assert.equal(after.bottom.battle[0]?.id, evidence.before.bottom.battle[0]?.id)
  assert.equal(after.bottom.battle[0]?.name, 'Lemon Cookie')
  assert.equal(after.bottom.battle[0]?.hp, '1/2')
  assert.deepEqual(after.bottom.support, evidence.before.bottom.support)
  evidence.afterSettlement = after
  const flipTrace = await trace(page)
  assertTraceSequence(flipTrace, mode === 'decline'
    ? ['resolve-next-damage', 'resolve-flip']
    : ['resolve-next-damage', 'resolve-flip', 'resolve-draw-up-to'])
}

const run003Lethal = async (page, evidence, mode) => {
  const flip = page.locator('.flip-response-modal')
  await flip.waitFor()
  assert.match(await flip.innerText(), /Raspberry Mousse Cookie FLIP/)
  if (mode === 'decline') {
    await flip.getByRole('button', { name: '不發動', exact: true }).click()
  } else {
    await flip.getByRole('button', { name: '發動 FLIP', exact: true }).click()
    const draw = page.locator('.draw-up-to-modal')
    await draw.waitFor()
    await draw.locator('.draw-up-to-option').nth(Number(mode.replace('draw', ''))).click()
    await draw.locator('.draw-up-to-actions button').click()
  }
  const decision = page.locator('.decision-modal')
  await decision.waitFor()
  const replacement = decision.locator('.decision-card-options button').filter({ hasText: 'Croissant Cookie' }).first()
  await replacement.waitFor()
  const replacementImage = replacement.locator('img[alt="Croissant Cookie"]')
  assert.equal(await replacementImage.count(), 1)
  assert.ok(await replacementImage.getAttribute('src'))
  await replacement.click()
  // BS6-079 has no legal LV.2-or-lower blue Cookie target after the faint,
  // so the local OnPlay flow resolves through the rendered no-target skip.
  await waitTrace(page, 'skip-on-play')
  await waitForVisualSettled(page)
  const after = await publicState(page)
  assert.equal(numberFrom(after.bottom.hand), numberFrom(evidence.before.bottom.hand) - 1 + (mode === 'draw1' ? 1 : 0))
  assert.equal(numberFrom(after.bottom.deck), numberFrom(evidence.before.bottom.deck) - (mode === 'draw1' ? 1 : 0) - 5)
  assert.equal(after.bottom.battle.length, 1)
  assert.equal(after.bottom.battle[0].id, 'BS10-003-replacement')
  assert.equal(after.bottom.battle[0].name, 'Croissant Cookie')
  assert.equal(numberFrom(after.bottom.battle[0].hp), 5)
  assert.equal(numberFrom(after.bottom.trash), numberFrom(evidence.before.bottom.trash) + 1)
  assert.deepEqual(after.bottom.support, evidence.before.bottom.support)
  evidence.flipMode = mode
  evidence.replacement = {
    name: after.bottom.battle[0].name,
    hp: after.bottom.battle[0].hp,
    deck: after.bottom.deck,
    hand: after.bottom.hand,
  }
  const lethalTrace = await trace(page)
  assertTraceSequence(lethalTrace, mode === 'decline'
    ? ['resolve-next-damage', 'resolve-flip', 'replace-cookie', 'skip-on-play']
    : ['resolve-next-damage', 'resolve-flip', 'resolve-draw-up-to', 'replace-cookie', 'skip-on-play'])
}

const run003WrongColor = async (page, evidence) => {
  const source = sourceCard(page, cardNames['BS10-003'])
  await source.waitFor()
  assert.equal(evidence.before.bottom.support.length, 6)
  assert.equal(evidence.before.bottom.support.filter((support) => support.rested).length, 0)
  const shortfall = source.locator('.energy-shortfall-hint')
  await shortfall.waitFor()
  assert.match(await shortfall.innerText(), /能量不足：需要 2/)
  assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
  assert.equal((await trace(page)).some((entry) => entry.commandKind === 'declare-attack'), false)
  assert.deepEqual(await publicState(page), evidence.before)
}

const main = async () => {
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
  const results = []
  const record = (result) => {
    results.push(result)
    writeFileSync(resolve(output, 'report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, viewports: selectedViewports, results }, null, 2))
    if (result.status !== 'PASS') throw new Error(`${result.card} ${result.viewport.width} ${result.error ?? 'Browser case failed'}`)
  }
  try {
    for (const viewport of selectedViewports) {
      if (only === 'all' || only === '001') {
        record(await runOnPage('BS10-001', viewport, { browser, label: 'skill', route: 'card:BS10-001', run: run001 }))
        record(await runOnPage('BS10-001', viewport, { browser, label: 'skill-negative', route: 'card-negative:BS10-001', run: runSkillNegative }))
      }
      if (only === 'all' || only === '004') {
        record(await runOnPage('BS10-004', viewport, { browser, label: 'condition', route: 'card:BS10-004', run: run004Positive }))
        record(await runOnPage('BS10-004', viewport, { browser, label: 'condition-negative', route: 'card-negative:BS10-004', run: run004Negative }))
      }
      if (only === 'all' || only === 'attack') for (const [card, damage, cost] of attackCases) {
        record(await runOnPage(card, viewport, { browser, label: 'attack', route: `card:${card}`, run: (page, evidence) => runSimpleAttack(page, evidence, damage, cost, false, undefined, true) }))
        record(await runOnPage(card, viewport, { browser, label: 'attack-negative', route: `card-negative:${card}`, run: (page, evidence) => runSimpleAttack(page, evidence, damage, cost, true) }))
      }
      if (only === 'all' || only === '003-attack') {
        record(await runOnPage('BS10-003', viewport, { browser, label: 'attack', route: 'card-attack:BS10-003', run: (page, evidence) => runSimpleAttack(page, evidence, 2, 2, false) }))
      }
      if (only === 'all' || only === '003-flip') {
        for (const mode of ['draw0', 'draw1', 'decline']) {
          record(await runOnPage('BS10-003', viewport, { browser, label: `flip-${mode}`, route: 'card:BS10-003', run: (page, evidence) => run003Flip(page, evidence, mode) }))
        }
        for (const mode of ['draw0', 'draw1', 'decline']) {
          record(await runOnPage('BS10-003', viewport, { browser, label: `lethal-${mode}`, route: 'card-negative:BS10-003', contractCard: 'BS10-003,BS6-079', run: (page, evidence) => run003Lethal(page, evidence, mode) }))
        }
        record(await runOnPage('BS10-003', viewport, { browser, label: 'wrong-color', route: 'card-attack-negative:BS10-003', run: run003WrongColor }))
      }
    }
  } finally {
    await browser.close()
  }
  const report = { generatedAt: new Date().toISOString(), baseUrl, viewports: selectedViewports, results }
  writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2))
  const expectedCount = only === '001' ? selectedViewports.length * 2
    : only === '004' ? selectedViewports.length * 2
      : only === 'attack' ? selectedViewports.length * attackCases.length * 2
        : only === '003-flip' ? selectedViewports.length * 7
          : only === '003-attack' ? selectedViewports.length
            : 36
  if (results.length !== expectedCount || results.some((result) => result.status !== 'PASS')) process.exitCode = 1
}

await main()
