import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
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
const outputDir = resolve(root, 'test-results/bs11-041-044-browser')
mkdirSync(outputDir, { recursive: true })
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
  'BS11-041': {
    name: 'Peach Blossom Cookie',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/TJ6BUvIfocKweCNvQNUVGQ.webp',
    fixture: { positive: 'seven BS8-071 green supports', negative: 'seven BS8-021 red supports' },
  },
  'BS11-042': {
    name: 'Shine Muscat Cookie',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/hPbuWevgeq6K5ILjOTo24Q.webp',
    fixture: { positive: 'two rested BS8-071 supports', negative: 'six active BS8-071 supports' },
  },
  'BS11-043': {
    name: 'Ginseng Cookie',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/XRP8wWnxPf4r2WxW7y95LA.webp',
    fixture: { positive: 'six active BS8-071 supports', negative: 'six rested BS8-071 supports' },
  },
  'BS11-044': {
    name: 'Silverbell Cookie',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/0L5n_T5ckFK14T8z8gpICQ.webp',
    fixture: { positive: 'seven active BS8-071 supports', negative: 'six active BS8-071 supports' },
  },
}

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const trace = (page) => page.evaluate(() =>
  Array.isArray(window.__braverseContractTrace) ? window.__braverseContractTrace : [],
)
const waitForTrace = (page, commandKind) => page.waitForFunction(
  (kind) => (window.__braverseContractTrace ?? []).some((entry) => entry.commandKind === kind),
  commandKind,
)
const skipAnimations = async (page) => {
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await skip.isVisible().catch(() => false)) {
      await skip.click()
      await wait(100)
    } else {
      await wait(100)
    }
  }
}

const readField = async (page, side) => page.locator(`.${side}-field`).evaluate((field) => {
  const cardName = (node) => node.querySelector('.card-face')?.getAttribute('title') ??
    node.querySelector('.card-face img')?.getAttribute('alt') ??
    node.querySelector('.card-fallback strong')?.textContent?.trim() ?? null
  return {
    supports: [...field.querySelectorAll('.support-card-wrap')].map((entry) => ({
      id: entry.getAttribute('data-card-instance-id'),
      name: cardName(entry),
      rested: Boolean(entry.querySelector('.card-face.is-rested')),
    })),
    battle: [...field.querySelectorAll('.combat-card-wrap')].map((entry) => ({
      id: entry.getAttribute('data-card-instance-id'),
      name: cardName(entry),
      hp: Number(entry.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
      rested: Boolean(entry.querySelector('.card-face.is-rested')),
    })),
    hand: [...field.querySelectorAll('.hand-card-wrap')].map((entry) => ({
      id: entry.getAttribute('data-card-instance-id'),
      name: cardName(entry),
    })),
  }
})

const readArt = async (face) => face.evaluate((node) => {
  const image = node.querySelector('img')
  const fallback = node.querySelector('.card-fallback')
  return {
    image: image ? { src: image.getAttribute('src'), alt: image.getAttribute('alt') } : null,
    fallbackName: fallback?.querySelector('strong')?.textContent?.trim() ?? null,
  }
})
const assertArt = (art, cardId) => {
  const expected = cards[cardId]
  if (art.image) {
    assert.equal(art.image.src, expected.imageUrl, `${cardId} must use its official card image URL`)
    assert.equal(art.image.alt, expected.name, `${cardId} official card image alt text`)
  } else {
    assert.equal(art.fallbackName, expected.name, `${cardId} fallback must explicitly name the official card`)
  }
}

const sourceFace = (page, side, name) => page.locator(
  `.${side}-field .combat-card-wrap .card-face[title="${name}"]`,
).first()
const targetFaces = (page) => page.locator(
  '.top-field .combat-card-wrap .card-face[aria-label^="選擇攻擊目標："]',
)
const waitForBattle = async (page) => {
  await page.waitForFunction(() => {
    const entries = window.__braverseContractTrace ?? []
    return entries.some((entry) => entry.commandKind === 'resolve-battle')
  })
  await skipAnimations(page)
}

const deployCard = async (page, cardId, evidence) => {
  const card = cards[cardId]
  const handEntry = page.locator('.bottom-field .hand-card-wrap').filter({
    has: page.locator(`.card-face[title="${card.name}"]`),
  }).first()
  await handEntry.waitFor({ state: 'visible' })
  const face = handEntry.locator('.card-face').first()
  evidence.art = await readArt(face)
  assertArt(evidence.art, cardId)
  await face.click()
  const deploy = handEntry.locator('.hand-card-action').filter({ hasText: '登場' }).first()
  assert.equal(await deploy.isEnabled(), true, `${cardId} should allow normal deploy`)
  await deploy.click()
  await skipAnimations(page)
  await sourceFace(page, 'bottom', card.name).waitFor({ state: 'visible' })
}

const finishEffectPanel = async (panel) => {
  for (let step = 0; step < 3; step += 1) {
    const next = panel.getByRole('button', { name: '下一步', exact: true })
    if (await next.count() && await next.isVisible()) {
      assert.equal(await next.isEnabled(), true, 'current effect step should be advanceable')
      await next.click()
      continue
    }
    const confirm = panel.getByRole('button', { name: '確認發動', exact: true })
    assert.equal(await confirm.isEnabled(), true, 'effect should be confirmable at the current legal selection')
    await confirm.click()
    return
  }
  throw new Error('effect panel did not reach a confirmation step')
}

const run041 = async (page, evidence) => {
  const card = cards['BS11-041']
  const face = sourceFace(page, 'bottom', card.name)
  await face.waitFor({ state: 'visible' })
  evidence.art = await readArt(face)
  assertArt(evidence.art, 'BS11-041')
  const before = await readField(page, 'bottom')
  const source = page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator(`.card-face[title="${card.name}"]`),
  }).first()
  const skill = source.locator('.skill-action').first()
  if (evidence.negative) {
    const skillCount = await skill.count()
    assert.ok(skillCount === 0 || !(await skill.isEnabled()), '041 red-only support fixture must not expose an enabled Activate action')
    evidence.skillActionDisabled = skillCount === 0 || !(await skill.isEnabled())
    evidence.supports = before.supports
    assert.equal((await trace(page)).some((entry) => entry.commandKind === 'begin-activate-skill'), false)
    evidence.before = before
    evidence.after = before
    evidence.trace = await trace(page)
    evidence.result = 'Activate unavailable with only red support; no command declared'
    return
  }

  assert.equal(await skill.count(), 1, '041 should expose its Activate skill in the supported route')
  assert.equal(await skill.isEnabled(), true, '041 green support should make its Activate skill legal')
  await skill.click()
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').first()
  await panel.waitFor({ state: 'visible' })
  const paymentButtons = panel.locator('.effect-candidates-cost-support button')
  assert.equal(await paymentButtons.count(), before.supports.length, '041 should offer every green support as a support-to-hand cost candidate')
  const expectedPaymentInstanceId = before.supports[0]?.id
  assert.ok(expectedPaymentInstanceId, '041 should expose a first green support cost candidate')
  await paymentButtons.first().click()
  assert.equal(await paymentButtons.first().getAttribute('aria-pressed'), 'true')
  await finishEffectPanel(panel)
  await waitForTrace(page, 'resolve-ability-effect')
  await skipAnimations(page)
  evidence.before = before
  evidence.after = await readField(page, 'bottom')
  const hpById = new Map(evidence.before.battle.map((entry) => [entry.id, entry.hp]))
  evidence.hpChanges = evidence.after.battle.map((entry) => ({
    name: entry.name,
    before: hpById.get(entry.id),
    after: entry.hp,
    delta: entry.hp - hpById.get(entry.id),
  }))
  assert.ok(evidence.hpChanges.length > 0)
  assert.ok(evidence.hpChanges.every((entry) => entry.delta === 1), '041 must add 1 HP to every own Cookie')
  const remainingSupportIds = new Set(evidence.after.supports.map((entry) => entry.id))
  const returnedSupportIds = evidence.before.supports
    .filter((entry) => !remainingSupportIds.has(entry.id))
    .map((entry) => entry.id)
  assert.equal(returnedSupportIds.length, 1, '041 must move exactly one support card out of the support area')
  assert.deepEqual(returnedSupportIds, [expectedPaymentInstanceId], '041 must return the support instance selected in the cost UI')
  evidence.paymentInstanceId = returnedSupportIds[0]
  assert.equal(
    evidence.after.hand.some((entry) => entry.id === evidence.paymentInstanceId),
    true,
    'paid green support must return to hand',
  )
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'begin-activate-skill'))
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect'))
  assert.ok(await skill.count() === 0 || !(await skill.isEnabled()), '041 Once Per Turn must block a second activation')
  evidence.secondActivationBlocked = true
  evidence.result = 'Paid one green support to hand; every own Cookie gained 1 HP'
}

const run042 = async (page, evidence) => {
  const card = cards['BS11-042']
  await deployCard(page, 'BS11-042', evidence)
  const before = await readField(page, 'bottom')
  const panel = page.locator('.effect-panel[role="alertdialog"]:visible').first()
  await panel.waitFor({ state: 'visible' })
  const targetButtons = panel.locator('.effect-candidates-target button')
  if (evidence.negative) {
    assert.equal(await targetButtons.count(), 0, '042 all-active support fixture must have no legal set-active target')
    assert.equal(before.supports.filter((support) => support.rested).length, 0)
    evidence.selectedTargets = 0
    await finishEffectPanel(panel)
    await waitForTrace(page, 'resolve-ability-effect')
    await skipAnimations(page)
    evidence.after = await readField(page, 'bottom')
    assert.deepEqual(evidence.after.supports, before.supports, '042 zero-target On Play should leave active supports unchanged')
    evidence.result = 'Confirmed zero selected targets; all active supports remained unchanged'
  } else {
    assert.equal(before.supports.filter((support) => support.rested).length, 2, '042 positive route starts with two rested green supports')
    assert.equal(await targetButtons.count(), 2, '042 should offer both rested supports as legal candidates')
    await targetButtons.first().click()
    assert.equal(await targetButtons.first().getAttribute('aria-pressed'), 'true', '042 first target should be selected through the UI')
    if (await targetButtons.nth(1).isEnabled()) await targetButtons.nth(1).click()
    const pressed = await targetButtons.evaluateAll((buttons) => buttons.filter((button) => button.getAttribute('aria-pressed') === 'true').length)
    assert.equal(pressed, 1, '042 UI must not allow selecting more than one support')
    evidence.selectedTargets = 1
    await finishEffectPanel(panel)
    await waitForTrace(page, 'resolve-ability-effect')
    await skipAnimations(page)
    evidence.after = await readField(page, 'bottom')
    const originallyRested = new Set(before.supports.filter((support) => support.rested).map((support) => support.id))
    const readied = evidence.after.supports.filter((support) => originallyRested.has(support.id) && !support.rested)
    assert.equal(readied.length, 1, '042 should ready exactly one of the two rested supports')
    assert.equal(evidence.after.supports.filter((support) => support.rested).length, 1)
    evidence.selectedSupportId = readied[0].id
    evidence.result = 'Over-selection was blocked; exactly one of two rested supports became active'
  }
  evidence.before = before
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'deploy-cookie'))
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-ability-effect'))
}

const declareAndResolveAttack = async (page, evidence, cardId, { cost, expectedDamage }) => {
  const card = cards[cardId]
  const face = sourceFace(page, 'bottom', card.name)
  await face.waitFor({ state: 'visible' })
  evidence.art = await readArt(face)
  assertArt(evidence.art, cardId)
  const source = page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator(`.card-face[title="${card.name}"]`),
  }).first()
  const attackable = source.locator('.card-face.is-attackable')
  if (evidence.negative && cardId !== 'BS11-044') {
    const before = await readField(page, 'bottom')
    if (await attackable.count()) {
      await attackable.click()
      const payment = page.locator('[data-testid="attack-payment-panel"]:visible').first()
      await payment.waitFor({ state: 'visible' })
      assert.equal(await page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').count(), 0)
      assert.match(await payment.innerText(), /不足|需要|不合法/)
      evidence.blockedPayment = await payment.innerText()
      await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
    } else {
      evidence.blockedPayment = await source.innerText()
      assert.match(evidence.blockedPayment, /能量不足|需要|支援/)
    }
    evidence.before = before
    evidence.after = await readField(page, 'bottom')
    evidence.trace = await trace(page)
    assert.equal(evidence.trace.some((entry) => entry.commandKind === 'declare-attack'), false, `${cardId} insufficient-payment route must not declare an attack`)
    assert.deepEqual(evidence.after, before, `${cardId} failed attack should not change the board`)
    evidence.result = 'Payment unavailable; no declare-attack command was emitted'
    return
  }

  assert.equal(await attackable.count(), 1, `${cardId} must be attackable in the positive route`)
  const beforeBottom = await readField(page, 'bottom')
  const beforeTop = await readField(page, 'top')
  await attackable.click()
  const payment = page.locator('[data-testid="attack-payment-panel"]:visible').first()
  await payment.waitFor({ state: 'visible' })
  const paymentFaces = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)')
  if (cardId === 'BS11-044') {
    assert.equal(await paymentFaces.count(), evidence.negative ? 6 : 7, '044 must expose the fixture support count before payment')
  } else {
    assert.equal(await paymentFaces.count(), 6, `${cardId} should have six active fixture supports before payment`)
  }
  const chosenPaymentInstanceIds = []
  for (let index = 0; index < cost; index += 1) {
    const support = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').first()
    await support.waitFor({ state: 'visible' })
    const instanceId = await support.evaluate((node) =>
      node.closest('.support-card-wrap')?.getAttribute('data-card-instance-id') ?? null,
    )
    assert.ok(instanceId, `${cardId} payment candidate must expose its support instance id`)
    assert.equal(beforeBottom.supports.some((entry) => entry.id === instanceId && !entry.rested), true)
    chosenPaymentInstanceIds.push(instanceId)
    await support.click()
  }
  assert.match(await payment.innerText(), /付款合法/)
  evidence.paymentInstanceIds = chosenPaymentInstanceIds
  evidence.payments = chosenPaymentInstanceIds.map((id) =>
    beforeBottom.supports.find((entry) => entry.id === id)?.name ?? id,
  )
  evidence.before = { bottom: beforeBottom, top: beforeTop }
  const candidates = targetFaces(page)
  assert.ok(await candidates.count() > 0, `${cardId} must have a legal opponent Cookie target`)
  const selectedTarget = candidates.first()
  evidence.target = {
    name: await selectedTarget.getAttribute('title'),
    id: await selectedTarget.evaluate((node) => node.closest('.combat-card-wrap')?.getAttribute('data-card-instance-id')),
  }
  await selectedTarget.click()
  await waitForBattle(page)
  evidence.after = { bottom: await readField(page, 'bottom'), top: await readField(page, 'top') }
  const beforeTarget = beforeTop.battle.find((entry) => entry.id === evidence.target.id)
  const afterTarget = evidence.after.top.battle.find((entry) => entry.id === evidence.target.id)
  assert.ok(beforeTarget, 'target must be a Cookie in the opponent battle area before the attack')
  assert.ok(afterTarget, 'target Cookie must survive this low-damage acceptance fixture')
  evidence.damage = beforeTarget.hp - afterTarget.hp
  assert.equal(evidence.damage, expectedDamage, `${cardId} actual HP change must match the printed attack damage`)
  const restedAfterPayment = evidence.after.bottom.supports
    .filter((support) => support.rested)
    .map((support) => support.id)
    .sort()
  assert.deepEqual(
    restedAfterPayment,
    [...chosenPaymentInstanceIds].sort(),
    `${cardId} must rest exactly the support instances selected in the attack payment UI`,
  )
  assert.equal(
    evidence.after.bottom.supports.length,
    evidence.before.bottom.supports.length,
    `${cardId} attack payment rests supports without removing them from the support area`,
  )
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'declare-attack'))
  assert.ok(evidence.trace.some((entry) => entry.commandKind === 'resolve-battle'))
  evidence.result = `Paid ${cost} support card(s), then dealt ${evidence.damage} battle damage`
}

const run043 = async (page, evidence) => {
  await declareAndResolveAttack(page, evidence, 'BS11-043', {
    cost: 1,
    expectedDamage: 1,
  })
}

const run044 = async (page, evidence) => {
  await declareAndResolveAttack(page, evidence, 'BS11-044', {
    cost: 3,
    expectedDamage: evidence.negative ? 2 : 3,
  })
  if (!evidence.negative) {
    assert.equal(evidence.before.bottom.supports.length, 7, '044 positive condition must have seven support cards')
  } else {
    assert.equal(evidence.before.bottom.supports.length, 6, '044 negative condition must have six support cards')
  }
}

const runCase = async (browser, viewport, cardId, negative) => {
  const card = cards[cardId]
  const route = `bs11-twelfth-batch:${cardId}:${negative ? 'negative' : 'positive'}`
  const page = await browser.newPage({ viewport })
  await routeBs11OfficialArt(page)
  page.setDefaultTimeout(15000)
  const evidence = {
    cardNumber: cardId,
    name: card.name,
    route,
    viewport,
    negative,
    fixture: negative ? card.fixture.negative : card.fixture.positive,
    status: 'FAIL',
    errors: [],
    knownImageNetworkRestrictions: [],
  }
  page.on('pageerror', (error) => evidence.errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const url = message.location().url ?? ''
    if ((url.includes('cookierunbraverse.com/data/en_storage/') || message.text().includes('cookierunbraverse.com/data/en_storage/')) && /ERR_NETWORK_ACCESS_DENIED|Failed to load resource|ERR_BLOCKED_BY_CLIENT/i.test(message.text())) {
      evidence.knownImageNetworkRestrictions.push({ type: 'console', text: message.text(), url })
      return
    }
    if (url.endsWith('/favicon.ico') && message.text().includes('404')) return
    evidence.errors.push(`console: ${message.text()} @ ${url}`)
  })
  page.on('requestfailed', (request) => {
    const url = request.url()
    if (url.startsWith('https://cookierunbraverse.com/data/en_storage/')) {
      evidence.knownImageNetworkRestrictions.push({ type: 'requestfailed', url, reason: request.failure()?.errorText ?? 'unknown' })
      return
    }
    if (url.endsWith('/favicon.ico')) return
    evidence.errors.push(`request failed: ${url} ${request.failure()?.errorText ?? 'unknown'}`)
  })
  page.on('response', (response) => {
    if (response.status() < 400) return
    const url = response.url()
    if (url.startsWith('https://cookierunbraverse.com/data/en_storage/')) {
      evidence.knownImageNetworkRestrictions.push({ type: 'image-response', status: response.status(), url })
      return
    }
    if (!url.endsWith('/favicon.ico')) evidence.errors.push(`${response.status()} response: ${url}`)
  })

  try {
    await page.goto(`${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${cardId}`, { waitUntil: 'domcontentloaded' })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    if (cardId === 'BS11-041') await run041(page, evidence)
    else if (cardId === 'BS11-042') await run042(page, evidence)
    else if (cardId === 'BS11-043') await run043(page, evidence)
    else await run044(page, evidence)
    assert.deepEqual(evidence.errors, [], `${cardId} browser errors: ${evidence.errors.join('; ')}`)
    evidence.status = 'PASS'
  } catch (error) {
    evidence.error = error.stack ?? String(error)
    evidence.body = await page.locator('body').innerText().catch(() => '')
    evidence.trace = await trace(page).catch(() => [])
  } finally {
    await page.close()
  }
  console.log(`${evidence.status} ${cardId} ${negative ? 'negative' : 'positive'} ${viewport.width}x${viewport.height}${evidence.error ? `: ${evidence.error.split('\n')[0]}` : ''}`)
  return evidence
}

const browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) })
const results = []
try {
  for (const viewport of viewports) {
    for (const cardId of Object.keys(cards)) {
      for (const negative of [false, true]) {
        results.push(await runCase(browser, viewport, cardId, negative))
      }
    }
  }
} finally {
  await browser.close()
}

for (const viewport of viewports) {
  const pair = results.filter((entry) => entry.cardNumber === 'BS11-044' && entry.viewport.width === viewport.width)
  const positive = pair.find((entry) => !entry.negative)
  const negative = pair.find((entry) => entry.negative)
  if (positive?.status === 'PASS' && negative?.status === 'PASS') {
    try {
      assert.equal(positive.target.id, negative.target.id, '044 positive and negative routes must target the same opponent Cookie instance')
      assert.equal(positive.target.name, negative.target.name, '044 positive and negative routes must target the same opponent Cookie')
      assert.equal(positive.before.top.battle.find((entry) => entry.id === positive.target.id)?.hp,
        negative.before.top.battle.find((entry) => entry.id === negative.target.id)?.hp,
        '044 comparison must start from the same target HP')
      assert.equal(positive.damage - negative.damage, 1, '044 seven-support passive must account for exactly +1 battle damage')
    } catch (error) {
      positive.status = 'FAIL'
      positive.error = String(error)
      negative.status = 'FAIL'
      negative.error = String(error)
    }
  }
}

const passed = results.filter((entry) => entry.status === 'PASS').length
const artifactPath = resolve(outputDir, `bs11-041-044-browser-${Date.now()}.json`)
const artifact = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  scope: 'BS11-041 Activate support-to-hand and all-Cookie HP; BS11-042 On Play set active and zero-target no-op; BS11-043 vanilla neutral-cost attack and insufficient payment; BS11-044 three-green-support attack with seven-versus-six support damage comparison. Candidate-only localhost Browser evidence, not formal or online acceptance.',
  viewports,
  summary: { total: results.length, passed, failed: results.length - passed },
  results,
}
writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ artifactPath, summary: artifact.summary }, null, 2))
if (results.length !== 16 || passed !== 16) process.exitCode = 1
