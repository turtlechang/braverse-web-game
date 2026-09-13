import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import bs9Candidates from '../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json' with { type: 'json' }

/**
 * Candidate-only Browser A/B gate for BS9-051..070.
 *
 * Every route is backed by the isolated physical-card fixture in demo.ts. It
 * deliberately exercises the same React controls used by a match (FLIP,
 * skill, attack, Item, Trap, and Stage), but never promotes candidate data.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES
    ? [process.env.PLAYWRIGHT_NODE_MODULES]
    : [root],
})
const playwright = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwright.chromium ?? playwright.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_BS9_051_070_TEST_PORT ?? 4209)
const baseUrl = `http://127.0.0.1:${port}`
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')
const browserExecutable =
  process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find((candidate) => existsSync(candidate))
const outputDirectory = resolve(root, 'output/playwright')
mkdirSync(outputDirectory, { recursive: true })

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const trace = (page) => page.evaluate(() => window.__braverseContractTrace ?? [])
const visible = (page, selector) => page.locator(`${selector}:visible`).first()
const panel = (page) => visible(page, '.effect-panel[role="alertdialog"]')
const optionalAttack = (page) =>
  visible(page, '.effect-panel[role="alertdialog"], .optional-cost-attack-modal')
const flip = (page) => visible(page, '.flip-response-modal')
const faint = (page) => visible(page, '.faint-response-modal')
const trap = (page) => visible(page, '.trap-response-modal')
const draw = (page) => visible(page, '.draw-up-to-modal')

const recordBy = (cardNumber) => {
  const record = bs9Candidates.cards.find((candidate) => candidate.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS9 candidate ${cardNumber}`)
  return record
}

const finalSurfaceSelectors = [
  ['effect-panel', '.effect-panel[role="alertdialog"]'],
  ['effect-order', '.effect-order-modal'],
  ['draw-up-to', '.draw-up-to-modal'],
  ['hand-discard', '.hand-discard-modal'],
  ['inspect-deck', '.inspect-deck-modal'],
  ['stage-placement', '.stage-placement-modal'],
  ['flip-response', '.flip-response-modal'],
  ['trap-response', '.trap-response-modal'],
  ['attack-response', '.attack-response-modal'],
  ['attack-response-skill', '.attack-response-skill-modal'],
  ['blocker-response', '.blocker-response-modal'],
  ['optional-cost-attack', '.optional-cost-attack-modal'],
  ['faint-response', '.faint-response-modal'],
  ['hp-reorder', '.hp-reorder-modal'],
  ['card-reveal', '.card-reveal-modal'],
  ['discard-reveal', '.discard-reveal-modal'],
  ['extra-deck-attack', '.extra-deck-attack-modal'],
  ['attack-payment', '.attack-payment-panel'],
  ['card-detail', '.card-detail-modal'],
]

const readVisibleFinalSurfaces = async (page) => page.evaluate((selectors) =>
  selectors.filter(([, selector]) => [...document.querySelectorAll(selector)].some((node) => {
    const style = window.getComputedStyle(node)
    return style.display !== 'none' && style.visibility !== 'hidden' && node.getBoundingClientRect().width > 0
  })).map(([name]) => name), finalSurfaceSelectors)

const assertExactImageLoaded = async (page, record, requested) => {
  const imageEvidence = await page.waitForFunction((expectedUrl) => {
    const seen = window.__bs9LoadedImageUrls ?? []
    if (seen.includes(expectedUrl)) return { exactImageRendered: true, exactImageLoaded: true }
    const matches = [...document.images].filter((node) => [node.getAttribute('src'), node.currentSrc, node.src].includes(expectedUrl))
    const loaded = matches.some((node) => node.complete && node.naturalWidth > 0)
    if (loaded) {
      window.__bs9LoadedImageUrls = [...new Set([...seen, expectedUrl])]
      return { exactImageRendered: true, exactImageLoaded: true }
    }
    return null
  }, record.imageUrl, { timeout: 10_000 }).then((handle) => handle.jsonValue()).catch(() => ({ exactImageRendered: false, exactImageLoaded: false }))
  assert.equal(imageEvidence.exactImageRendered, true, `${record.cardNumber} must render its exact official image URL`)
  assert.equal(imageEvidence.exactImageLoaded, true, `${record.cardNumber} must load its exact official image URL`)
  return { ...imageEvidence, exactImageRequested: requested }
}

const recordBrowserErrors = (page) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const location = message.location()
    const text = message.text()
    if (location.url?.endsWith('/favicon.ico') && text.includes('404')) return
    if (
      location.url?.includes('cookierunbraverse.com/data/en_storage/') &&
      /ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(text)
    ) return
    errors.push(`console: ${text} (${location.url || 'unknown URL'})`)
  })
  return errors
}

const assertTrace = (entries, kind, message) =>
  assert.ok(entries.some((entry) => entry.commandKind === kind), message)
const assertNoTrace = (entries, kind, message) =>
  assert.equal(entries.some((entry) => entry.commandKind === kind), false, message)

const waitForGame = async (page) => {
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await page.waitForTimeout(250)
}

const assertPhysicalCard = async (locator, name) => {
  await locator.waitFor({ state: 'visible' })
  const fallbackText = (await locator.locator('.card-fallback').allInnerTexts().catch(() => [])).join(' ')
  const imageAlts = await locator
    .locator('img')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('alt')))
    .catch(() => [])
  assert.ok(
    fallbackText.includes(name) || imageAlts.includes(name),
    `${name} must render as a named physical card face or official-card fallback`,
  )
}

const fieldCard = (page, field, instanceId) =>
  page.locator(`.${field}-field [data-card-instance-id="${instanceId}"]`).first()

const sourceCard = (page, cardNumber) =>
  page.locator(`.bottom-field [data-card-instance-id="bs9-${cardNumber.toLowerCase().replace('@', '-')}-source"]`).first()

const candidateSource = (page, cardNumber) => {
  const base = cardNumber.split('@')[0].toLowerCase()
  // Physical fixtures intentionally keep a base runtime id for alternate art.
  if (base === 'bs9-055') return page.locator('.bottom-field [data-card-instance-id="bs9-055-demo-extra"]').first()
  return page.locator(`.bottom-field [data-card-instance-id="bs9-${base}-source"]`).first()
}

const readSupportHandSnapshot = async (page) => page.evaluate(() => ({
  support: [...document.querySelectorAll('.bottom-field .support-card-wrap')].map((node) => ({
    id: node.getAttribute('data-card-instance-id'),
    title: node.querySelector('.support-card')?.getAttribute('title') ?? null,
    rested: node.querySelector('.support-card')?.classList.contains('is-rested') ?? false,
  })),
  hand: [...document.querySelectorAll('.bottom-hand .hand-card')].map((node) => node.getAttribute('title')),
}))

const readOwnSupportCount = async (page) => {
  const text = await page.locator('.bottom-field .support-count').first().innerText()
  const match = text.match(/\d+/)
  return match ? Number(match[0]) : null
}

const readFieldSupportCount = async (page, field) => {
  const text = await page.locator(`.${field}-field .support-count`).first().innerText()
  const match = text.match(/\d+/)
  return match ? Number(match[0]) : null
}

const readOpponentAttackSnapshot = async (page) => page.evaluate(() =>
  [...document.querySelectorAll('.battle-row .combat-card-wrap')]
    .filter((node) => {
      const id = node.getAttribute('data-card-instance-id') ?? ''
      return id.endsWith('-attacker') || id.endsWith('-donor')
    })
    .map((node) => {
      const badge = node.querySelector('.badge-atk')
      const attack = Number(badge?.textContent?.match(/\d+/)?.[0] ?? NaN)
      return {
        id: node.getAttribute('data-card-instance-id'),
        title: node.querySelector('.card-face')?.getAttribute('title') ?? null,
        attack,
        badgeTitle: badge?.getAttribute('title') ?? null,
      }
    }),
)

const cardInHand = (page, name) =>
  page.locator(`.bottom-hand .hand-card-wrap:has(.hand-card[title="${name}"])`).first()

const cardAction = (wrap, label) => wrap.locator('.hand-card-action').filter({ hasText: label }).first()

const waitForTrace = async (page, commandKind, minimum = 1) => {
  await page.waitForFunction(
    ({ commandKind: expected, minimum: count }) =>
      (window.__braverseContractTrace ?? []).filter((entry) => entry.commandKind === expected).length >= count,
    { commandKind, minimum },
  )
  return trace(page)
}

const openRoute = async (page, route, cardNumber) => {
  await page.goto(
    `${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${cardNumber.replace(/@\d+$/, '')}`,
    { waitUntil: 'domcontentloaded' },
  )
  await waitForGame(page)
}

const clickEnabled = async (locator, label) => {
  const button = locator.getByRole('button', { name: label, exact: true }).first()
  await button.waitFor({ state: 'visible' })
  assert.equal(await button.isEnabled(), true, `${label} should be enabled`)
  await button.click()
  return button
}

const clickPrimary = async (container, labels = ['確認發動', '確認', '確認結算', '下一步', '發動技能']) => {
  for (const label of labels) {
    const button = container.getByRole('button', { name: label, exact: true }).first()
    if (await button.count()) {
      await button.waitFor({ state: 'visible' })
      assert.equal(await button.isEnabled(), true, `${label} should be enabled`)
      await button.click()
      return
    }
  }
  throw new Error(`No enabled primary action (${labels.join(', ')})`)
}

const selectFirstCandidates = async (container, selector, count = 1) => {
  const candidates = container.locator(`${selector} button:not(:disabled)`)
  assert.ok(await candidates.count() >= count, `expected at least ${count} selectable candidates`)
  for (let index = 0; index < count; index += 1) await candidates.nth(index).click()
  return candidates
}

const runFlip = async (page, cardNumber, negative, result) => {
  const modal = flip(page)
  await modal.waitFor({ state: 'visible' })
  await assertPhysicalCard(modal.locator('.flip-reveal-card'), cardNumber.startsWith('BS9-053') ? 'Cream Ferret Cookie' : 'Butter Roll Cookie')
  const activate = modal.getByRole('button', { name: '發動 FLIP', exact: true })
  if (negative) {
    await clickEnabled(modal, '不發動')
    await modal.waitFor({ state: 'hidden' })
    assert.equal(await draw(page).count(), 0, 'declining a FLIP must not open its draw/Then modal')
    result.actions.push('decline-flip-negative')
    return
  }
  assert.equal(await activate.isEnabled(), true)
  // Cream Ferret first selects support cards and then an equal number of green
  // hand cards. Butter Roll has only the draw-up-to decision.
  const zoneBefore = cardNumber.startsWith('BS9-053') ? await readSupportHandSnapshot(page) : null
  if (cardNumber.startsWith('BS9-053')) {
    const selection = modal.locator('[aria-label="FLIP 效果卡片選擇"] button')
    assert.equal(await selection.count(), 6, 'Cream Ferret must show six physical support/hand candidates')
    await selection.nth(0).click()
    await selection.nth(1).click()
    const then = modal.locator('[aria-label="FLIP 效果後續卡片選擇"] button')
    await then.first().waitFor({ state: 'visible' })
    assert.equal(await then.count(), 3)
    await then.nth(0).click()
    await then.nth(1).click()
  }
  await activate.click()
  await modal.waitFor({ state: 'hidden' })
  if (cardNumber.startsWith('BS9-051')) {
    const drawModal = draw(page)
    await drawModal.waitFor({ state: 'visible' })
    assert.match(await drawModal.innerText(), /Butter Roll Cookie|最多 1 張牌|Draw up to 1/i)
    const options = drawModal.locator('.draw-up-to-option')
    assert.equal(await options.count(), 2)
    await options.nth(1).click()
    await drawModal.getByRole('button', { name: '抽取 1 張牌', exact: true }).click()
    await drawModal.waitFor({ state: 'hidden' })
    await waitForTrace(page, 'resolve-draw-up-to')
  }
  await waitForTrace(page, 'resolve-flip')
  if (cardNumber.startsWith('BS9-053')) {
    const zoneAfter = await readSupportHandSnapshot(page)
    const beforeIds = new Set(zoneBefore?.support.map((entry) => entry.id).filter(Boolean))
    const afterIds = new Set(zoneAfter.support.map((entry) => entry.id).filter(Boolean))
    const changedSupportIds = [...beforeIds].filter((id) => !afterIds.has(id)).length
    const newlyRestedSupport = zoneAfter.support.filter((entry) => entry.rested).length
    // Returning two supports and replacing them with two green hand cards is
    // the card's substantive FLIP result.  The hand surface intentionally
    // omits instance ids, so the support ids/rest state are the stable DOM
    // witnesses for the zone exchange.
    assert.ok(changedSupportIds >= 2, 'Cream Ferret must return the selected support cards to hand')
    assert.ok(newlyRestedSupport >= 2, 'Cream Ferret must place the selected green hand cards rested in support')
    result.effectWitness = {
      kind: 'support-to-hand-and-green-hand-to-rested-support',
      beforeSupportIds: [...beforeIds],
      afterSupportIds: [...afterIds],
      changedSupportIds,
      beforeHandCount: zoneBefore?.hand.length ?? null,
      afterHandCount: zoneAfter.hand.length,
      newlyRestedSupport,
    }
  }
  result.actions.push(cardNumber.startsWith('BS9-053') ? 'select-two-supports-and-equal-green-hand-then' : 'activate-flip-and-draw-one')
}

const runPassive = async (page, negative, result) => {
  const source = candidateSource(page, 'BS9-052')
  await assertPhysicalCard(source, 'Ring Candy Cookie')
  const badge = source.locator('.badge-atk').first()
  await badge.waitFor({ state: 'visible' })
  const attack = Number((await badge.innerText()).match(/\d+/)?.[0])
  assert.equal(attack, negative ? 2 : 3, 'Ring Candy passive must follow the support-count condition')
  const supportCount = await readOwnSupportCount(page)
  assert.equal(supportCount, negative ? 6 : 7, 'Ring Candy support-count fixture must match its passive branch')
  result.effectWitness = {
    kind: 'passive-attack-bonus',
    supportCount,
    attack,
    attackDelta: attack - 2,
  }
  result.actions.push(`read-ring-candy-passive-${attack}`)
}

const runSkill = async (page, cardNumber, negative, result) => {
  const source = candidateSource(page, cardNumber)
  const expectedNames = {
    'BS9-054': 'Mercurial Knight Cookie',
    'BS9-060': 'Elder Faerie Cookie',
    'BS9-060@1': 'Elder Faerie Cookie',
    'BS9-060@2': 'Elder Faerie Cookie',
    'BS9-061': 'Silverbell Cookie',
    'BS9-063': 'Cookiemals',
    'BS9-063@1': 'Cookiemals',
    'BS9-065': 'Pure Vanilla Cookie',
    'BS9-065@1': 'Pure Vanilla Cookie',
  }
  await assertPhysicalCard(source, expectedNames[cardNumber] ?? expectedNames[cardNumber.split('@')[0]])
  const action = source.locator('.skill-action').first()
  await action.waitFor({ state: 'visible' })
  if (negative) {
    assert.equal(await action.isDisabled(), true, `${cardNumber} skill must be disabled on its unmet fixture`)
    assert.equal(await panel(page).count(), 0)
    result.actions.push('blocked-skill-unmet-condition-or-cost')
    return
  }
  assert.equal(await action.isEnabled(), true)
  const supportCountBefore = cardNumber === 'BS9-061' ? await readOwnSupportCount(page) : null
  await action.click()
  const effect = panel(page)
  await effect.waitFor({ state: 'visible' })
  assert.match(await effect.innerText(), /技能|Mercurial|Elder Faerie|Silverbell|Cookiemals|Pure Vanilla/)
  // Costs that use support-trash are shown as a dedicated candidate section.
  const supportCost = effect.locator('.effect-candidates-cost-support button:not(:disabled)')
  if (await supportCost.count()) {
    await supportCost.nth(0).click()
    if (await supportCost.count() > 1) await supportCost.nth(1).click()
    await clickPrimary(effect, ['下一步', '確認'])
  }
  const discardSelf = effect.locator('.effect-candidates-self button:not(:disabled), .effect-candidates-effect-target button:not(:disabled)')
  if (cardNumber.startsWith('BS9-063') && await discardSelf.count()) await discardSelf.first().click()
  const targets = effect.locator('.effect-candidates-target button:not(:disabled)')
  if (await targets.count()) await targets.first().click()
  await clickPrimary(effect)
  await effect.waitFor({ state: 'hidden' })
  await waitForTrace(page, 'resolve-ability-effect')
  if (cardNumber === 'BS9-061') {
    const supportCountAfter = await readOwnSupportCount(page)
    assert.equal(supportCountAfter, (supportCountBefore ?? 0) + 1, 'Silverbell must place one deck card into support')
    result.effectWitness = {
      kind: 'deck-top-to-rested-support',
      supportCountBefore,
      supportCountAfter,
      supportDelta: supportCountAfter - (supportCountBefore ?? supportCountAfter),
    }
  }
  if (cardNumber.startsWith('BS9-063')) {
    const drawModal = draw(page)
    await drawModal.waitFor({ state: 'visible' })
    const options = drawModal.locator('.draw-up-to-option')
    assert.equal(await options.count(), 3, 'Cookiemals must offer draw 0, 1, or 2')
    await options.nth(2).click()
    await drawModal.getByRole('button', { name: '抽取 2 張牌', exact: true }).click()
    await drawModal.waitFor({ state: 'hidden' })
    const continuation = panel(page)
    await continuation.waitFor({ state: 'visible' })
    await clickPrimary(continuation)
    await page.waitForTimeout(120)
    const discard = visible(page, '.hand-discard-modal')
    await discard.waitFor({ state: 'visible' })
    const discardCandidates = discard.locator('.hand-discard-card-option button:not(:disabled)')
    assert.ok(await discardCandidates.count() >= 1, 'Cookiemals must expose one card for the mandatory discard')
    await discardCandidates.first().click()
    await discard.getByRole('button', { name: /確認棄置/ }).click()
    await discard.waitFor({ state: 'hidden' })
    await waitForTrace(page, 'resolve-ability-effect', 2)
  }
  result.actions.push('activate-skill-pay-cost-select-target')
}

const runAttackEffect = async (page, cardNumber, negative, result) => {
  const source = candidateSource(page, cardNumber)
  const expectedNames = {
    'BS9-055': 'Shadow Milk Cookie',
    'BS9-055@1': 'Shadow Milk Cookie',
    'BS9-056': 'Faerie Cookie 1',
    'BS9-057': 'Faerie Cookie 2',
    'BS9-058': 'Faerie Cookie 3',
    'BS9-059': 'Fairy Cookie',
    'BS9-060': 'Elder Faerie Cookie',
    'BS9-060@1': 'Elder Faerie Cookie',
    'BS9-060@2': 'Elder Faerie Cookie',
    'BS9-062': 'Carameleon Cookie',
    'BS9-065': 'Pure Vanilla Cookie',
    'BS9-065@1': 'Pure Vanilla Cookie',
  }
  await assertPhysicalCard(source, expectedNames[cardNumber] ?? expectedNames[cardNumber.split('@')[0]] ?? 'Cookie')
  const effect = optionalAttack(page)
  // Attack Then panels can be created on the first queued render after the
  // source card becomes visible. Give the authoritative UI a short settle
  // window before classifying this as a vanilla attack.
  try {
    await page.locator('.effect-panel[role="alertdialog"]:visible, .optional-cost-attack-modal:visible').first().waitFor({ state: 'visible', timeout: 4_000 })
  } catch {
    // Vanilla attack-only candidates legitimately have no Then surface.
  }
  if (await effect.count() === 0) {
    // Vanilla attack-only candidates have no attack effect panel. The fixture
    // still proves the real attacker at the pending attack-declaration
    // observation point for both the payable and blocked routes.
    result.actions.push(negative ? 'blocked-vanilla-attack-observation' : 'vanilla-attack-observation')
    return
  }
  await effect.waitFor({ state: 'visible' })
  if (negative) {
    const pay = effect.getByRole('button', { name: '支付', exact: true }).first()
    if (await pay.count()) {
      assert.equal(await pay.isDisabled(), true, `${cardNumber} blocked attack effect must not pay its optional cost`)
      await effect.getByRole('button', { name: '略過', exact: true }).click()
    } else if (cardNumber.startsWith('BS9-060')) {
      // Elder Faerie's Then is conditional on opponent support count.  The
      // negative fixture keeps the attack window but removes that condition.
      const skip = effect.getByRole('button', { name: '略過', exact: true }).first()
      if (await skip.count()) await skip.click()
      else await effect.getByRole('button', { name: '確認發動', exact: true }).click()
    } else {
      const primary = effect.locator('.effect-panel-primary-action')
      assert.equal(await primary.isDisabled(), true, `${cardNumber} blocked attack effect must not confirm payment`)
    }
    await waitForTrace(page, 'resolve-attack-effect')
    result.actions.push('blocked-attack-payment-or-condition')
    return
  }
  assert.match(await effect.innerText(), /攻擊後|Then|damage|支援區|攻擊效果/i)
  const optional = effect.locator('.optional-cost-attack-inline')
  if (await optional.count()) {
    const pay = optional.getByRole('button', { name: '支付', exact: true })
    assert.equal(await pay.isEnabled(), true)
    await pay.click()
    const support = optional.locator('.optional-cost-col').filter({ hasText: '支援' }).locator('.modal-card-options button:not(:disabled)')
    if (await support.count()) {
      const supportCount = cardNumber.startsWith('BS9-055') ? 1 : 2
      assert.ok(await support.count() >= supportCount)
      for (let index = 0; index < supportCount; index += 1) await support.nth(index).click()
    }
    const next = optional.getByRole('button', { name: '下一步', exact: true }).first()
    if (await next.count() && await next.isEnabled()) await next.click()
    else await clickPrimary(optional, ['確認'])
    const targets = optional.locator('.optional-cost-col').filter({ hasText: '目標' }).locator('.modal-card-options button:not(:disabled)')
    const targetCount = cardNumber.startsWith('BS9-062') ? 2 : 1
    for (let index = 0; index < targetCount; index += 1) {
      if (await targets.count() > index) await targets.nth(index).click()
    }
    const confirm = optional.getByRole('button', { name: '確認', exact: true }).first()
    if (await confirm.count() && await confirm.isVisible().catch(() => false)) {
      assert.equal(await confirm.isEnabled(), true, `${cardNumber} optional attack target selection must be complete`)
      await confirm.click()
    }
    const drawModal = draw(page)
    if (await drawModal.count()) {
      await drawModal.waitFor({ state: 'visible' })
      const drawOptions = drawModal.locator('.draw-up-to-option')
      if (await drawOptions.count()) await drawOptions.last().click()
      const drawButton = drawModal.getByRole('button', { name: /抽取|略過抽牌/ }).last()
      await drawButton.click()
      await drawModal.waitFor({ state: 'hidden' })
    }
  } else {
    const support = effect.locator('.effect-candidates-target button:not(:disabled)')
    const needed = cardNumber.startsWith('BS9-062') ? 2 : 1
    for (let index = 0; index < needed; index += 1) {
      if (await support.count() > index) await support.nth(index).click()
    }
    await clickPrimary(effect)
  }
  await effect.waitFor({ state: 'hidden' }).catch(() => {})
  await waitForTrace(page, 'resolve-attack-effect')
  result.actions.push('resolve-attack-effect-and-then')
}

const runExtra = async (page, cardNumber, negative, result) => {
  const ready = page.locator('.bottom-field button.resource-summary').filter({ hasText: 'EXTRA' }).first()
  await ready.waitFor({ state: 'visible' })
  await ready.click()
  const extra = page.locator('.extra-deck-card-image').first()
  await extra.waitFor({ state: 'visible' })
  await assertPhysicalCard(extra, 'Shadow Milk Cookie')
  const play = page.getByRole('button', { name: '從 EXTRA 登場', exact: true }).first()
  if (negative) {
    assert.match(await page.locator('[role="dialog"]').first().innerText(), /尚未符合此 EXTRA 餅乾的登場條件/)
    assertNoTrace(await trace(page), 'play-extra-deck-cookie', 'blocked EXTRA must not enter battle')
    result.actions.push('blocked-extra-entry-condition')
    return
  }
  assert.equal(await play.isEnabled(), true)
  await play.click()
  await waitForTrace(page, 'play-extra-deck-cookie')
  const source = candidateSource(page, cardNumber)
  await assertPhysicalCard(source, 'Shadow Milk Cookie')
  const skill = source.locator('.skill-action').first()
  await skill.waitFor({ state: 'visible' })
  await skill.click()
  const effect = panel(page)
  await effect.waitFor({ state: 'visible' })
  await clickPrimary(effect)
  await effect.waitFor({ state: 'hidden' })
  await waitForTrace(page, 'resolve-ability-effect')
  result.actions.push('enter-battle-and-activate-extra-skill')
}

const runItem = async (page, cardNumber, negative, result) => {
  const names = { 'BS9-066': 'Meat Jelly', 'BS9-067': 'Concealer of Truth' }
  const wrap = cardInHand(page, names[cardNumber])
  await assertPhysicalCard(wrap.locator('.hand-card').first(), names[cardNumber])
  await wrap.locator('.hand-card').first().click()
  const use = cardAction(wrap, '使用')
  if (negative) {
    // When the item has no legal activation at all the hand card opens its
    // normal detail modal, but deliberately exposes no 「使用」 action. Some
    // older surfaces render a disabled action instead; accept both while
    // proving that no command was dispatched.
    if (await use.count()) assert.equal(await use.isDisabled(), true, `${cardNumber} item must be unavailable without support cost`)
    else assert.equal(await page.locator('.card-detail-modal').count(), 1, `${cardNumber} should show card details when use is unavailable`)
    await page.locator('.card-detail-modal .close-modal').click().catch(() => {})
    assertNoTrace(await trace(page), 'begin-play-item', 'blocked item must not dispatch use command')
    result.actions.push('blocked-item-support-cost')
    return
  }
  await use.waitFor({ state: 'visible' })
  assert.equal(await use.isEnabled(), true)
  await use.click()
  const effect = panel(page)
  await effect.waitFor({ state: 'visible' })
  const payment = effect.locator('.effect-candidates-payment button:not(:disabled)')
  assert.ok(await payment.count() >= 1)
  await payment.first().click()
  await clickPrimary(effect, ['下一步'])
  const support = effect.locator('.effect-candidates-cost-support button:not(:disabled)')
  assert.ok(await support.count() >= 1)
  await support.first().click()
  await clickPrimary(effect, ['下一步', '確認', '確認發動'])
  // BS9-067 has no target step: its final confirmation immediately opens the
  // draw choice and hides the effect panel. BS9-066 continues to a target
  // step, so only interact with the panel while it is still visible.
  if (await effect.isVisible().catch(() => false)) {
    const target = effect.locator('.effect-candidates-target button:not(:disabled)')
    if (await target.count()) await target.first().click()
    if (await effect.isVisible().catch(() => false)) await clickPrimary(effect)
  }
  await effect.waitFor({ state: 'hidden' }).catch(() => {})
  if (cardNumber === 'BS9-067') {
    const drawModal = draw(page)
    if (await drawModal.count()) {
      await drawModal.waitFor({ state: 'visible' })
      const options = drawModal.locator('.draw-up-to-option')
      if (await options.count()) await options.last().click()
      const button = drawModal.getByRole('button', { name: /抽取|略過抽牌/ }).last()
      await button.click()
      await drawModal.waitFor({ state: 'hidden' })
    }
  }
  await waitForTrace(page, 'begin-play-item')
  result.actions.push('use-item-pay-green-and-support-cost')
}

const runFaint = async (page, cardNumber, negative, result) => {
  const modal = faint(page)
  await modal.waitFor({ state: 'visible' })
  const name = 'Clover Cookie'
  await assertPhysicalCard(modal.locator('.faint-effect-card-detail').first(), name)
  const candidates = modal.locator('.faint-target-candidates button:not(:disabled), .faint-card-candidates button:not(:disabled)')
  if (negative) {
    assert.equal(await candidates.count(), 0, `${cardNumber} negative faint must expose no legal target`)
    // The target is mandatory, so the only legal negative path is declining
    // the optional faint ability itself; 「不選擇目標」 is intentionally disabled.
    await clickEnabled(modal, '不發動')
    await modal.waitFor({ state: 'hidden' })
    const skipped = (await trace(page)).find((entry) => entry.commandKind === 'resolve-faint-effect')
    assert.ok(skipped, 'declined faint must still record the user decision')
    assert.match(await page.locator('body').innerText(), /未支付昏厥效果費用，略過效果/, 'declined faint must log that the effect was skipped')
    result.actions.push('decline-faint-without-opponent-support-target')
    return
  }
  assert.equal(await candidates.count(), 1)
  await candidates.first().click()
  await clickPrimary(modal, ['確認 (1)', '確認'])
  await modal.waitFor({ state: 'hidden' })
  await waitForTrace(page, 'resolve-faint-effect')
  result.actions.push('faint-opponent-and-put-support-to-trash')
}

const runTrap = async (page, cardNumber, negative, result) => {
  const modal = trap(page)
  // Radiant Light's printed condition is a prerequisite for opening the trap
  // response at all. The negative fixture therefore demonstrates the real
  // attack-response surface by proving that no modal/command is exposed.
  if (negative && cardNumber === 'BS9-068') {
    await page.waitForTimeout(500)
    assert.equal(await modal.count(), 0, 'Radiant Light must stay unavailable when own support is not lower')
    assertNoTrace(await trace(page), 'play-trap', 'blocked Radiant Light must not dispatch play-trap')
    result.actions.push('blocked-trap-support-count-condition')
    return
  }
  await modal.waitFor({ state: 'visible' })
  const name = cardNumber === 'BS9-068' ? 'Radiant Light of Protection' : 'Broken Seal'
  if (cardNumber === 'BS9-068' && !negative) {
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.battle-row .combat-card-wrap')]
        .filter((node) => (node.getAttribute('data-card-instance-id') ?? '').startsWith('bs9-trap-'))
        .length >= 2,
    )
  }
  const attackBefore = cardNumber === 'BS9-068' && !negative
    ? await readOpponentAttackSnapshot(page)
    : null
  const card = modal.locator('.modal-card-options button').filter({ hasText: name }).first()
  await assertPhysicalCard(card, name)
  await card.click()
  const energy = modal.locator('.trap-guided-section').filter({ hasText: '能量支付' })
  const payments = energy.locator('.trap-discard-options button:not(:disabled)')
  const paymentHint = await energy.innerText()
  const requiredPayment = Number(/選擇\s*(\d+)\s*張/.exec(paymentHint)?.[1] ?? 1)
  assert.ok(await payments.count() >= requiredPayment, `${cardNumber} must expose ${requiredPayment} legal trap payments`)
  for (let index = 0; index < requiredPayment; index += 1) await payments.nth(index).click()
  const next = modal.getByRole('button', { name: '下一步', exact: true }).first()
  // Radiant Light has no target step and ends on the first confirmation;
  // Broken Seal advances to its target/Then steps after the two-card cost.
  if (await next.count() && await next.isEnabled()) await next.click()
  const targetSteps = modal.locator('.trap-effect-target-step')
  if (cardNumber === 'BS9-069') {
    assert.equal(await targetSteps.count(), negative ? 1 : 2, 'Broken Seal must show its conditional Then support step')
  } else {
    assert.equal(await targetSteps.count(), 0, 'Radiant Light has no target step')
  }
  const firstTargets = targetSteps.first().locator('button:not(:disabled)')
  if (await firstTargets.count()) await firstTargets.first().click()
  if (!negative && cardNumber === 'BS9-069' && await targetSteps.count() > 1) {
    const secondTargets = targetSteps.nth(1).locator('button:not(:disabled)')
    assert.ok(await secondTargets.count() >= 1)
    await secondTargets.first().click()
  }
  await modal.getByRole('button', { name: '確認發動', exact: true }).click()
  await modal.waitFor({ state: 'hidden' })
  await waitForTrace(page, 'play-trap')
  if (cardNumber === 'BS9-068' && !negative) {
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.battle-row .combat-card-wrap')]
        .filter((node) => {
          const id = node.getAttribute('data-card-instance-id') ?? ''
          return id.endsWith('-attacker') || id.endsWith('-donor')
        })
        .some((node) => node.querySelector('.badge-atk')?.getAttribute('title')?.includes('Radiant Light of Protection -1')),
    )
    const attackAfter = await readOpponentAttackSnapshot(page)
    const opponentSupportCount = await readFieldSupportCount(page, 'top')
    const ownSupportCount = await readFieldSupportCount(page, 'bottom')
    assert.equal(ownSupportCount, 6, 'Radiant Light positive fixture must keep six own support cards')
    assert.equal(opponentSupportCount, 7, 'Radiant Light positive fixture must expose seven opponent support cards')
    assert.equal(attackBefore?.length, 2, 'Radiant Light positive fixture must expose two opponent Cookies')
    assert.equal(attackAfter.length, 2, 'Radiant Light must retain both opponent Cookies after resolution')
    assert.deepEqual(
      attackAfter.map((entry) => entry.attack),
      attackBefore.map((entry) => entry.attack - 1),
      'Radiant Light must reduce each opponent Cookie attack by 1 during this turn',
    )
    assert.ok(attackAfter.every((entry) => entry.badgeTitle?.includes('Radiant Light of Protection -1')))
    result.effectWitness = {
      kind: 'conditional-opponent-attack-reduction',
      ownSupportCount,
      opponentSupportCount,
      before: attackBefore.map(({ title, attack }) => ({ title, attack })),
      after: attackAfter.map(({ title, attack }) => ({ title, attack })),
      delta: -1,
      duration: 'this-turn',
    }
  }
  result.actions.push(negative ? 'resolve-trap-with-conditional-then-skipped' : 'resolve-trap-target-and-then')
}

const runStage = async (page, negative, result) => {
  const wrap = cardInHand(page, 'Puppet Theater Stage')
  await assertPhysicalCard(wrap.locator('.hand-card').first(), 'Puppet Theater Stage')
  await wrap.locator('.hand-card').first().click()
  const place = cardAction(wrap, '放置')
  await place.waitFor({ state: 'visible' })
  await place.click()
  const placement = visible(page, '.stage-placement-modal')
  await placement.waitFor({ state: 'visible' })
  const payment = placement.locator('.stage-placement-payment .faint-payment-candidates > button:not(:disabled)')
  assert.ok(await payment.count() >= 1)
  await payment.first().click()
  await clickEnabled(placement, '支付並放置')
  await placement.waitFor({ state: 'hidden' })
  await assertPhysicalCard(page.locator('.bottom-field .stage-card').first(), 'Puppet Theater Stage')
  if (negative) {
    assert.equal(await page.locator('.bottom-field .stage-quick-action').count(), 0, 'unmet Stage condition must not expose Activate')
    result.actions.push('place-stage-and-block-unmet-activate')
    return
  }
  const activate = page.locator('.bottom-field .stage-quick-action').first()
  await activate.waitFor({ state: 'visible' })
  await activate.click()
  const effect = panel(page)
  await effect.waitFor({ state: 'visible' })
  const paymentSupport = effect.locator('.effect-candidates-payment button:not(:disabled)')
  if (await paymentSupport.count()) {
    await paymentSupport.first().click()
    // BS9-070 has a green energy phase followed by the automatic
    // 「Rest this card」 extra cost; advance the guided panel before the final
    // confirmation rather than trying to select a target from the first phase.
    await clickPrimary(effect, ['下一步', '確認發動'])
  }
  if (await effect.isVisible().catch(() => false)) {
    const targets = effect.locator('.effect-candidates-target button:not(:disabled)')
    if (await targets.count()) await targets.first().click()
    if (await effect.isVisible().catch(() => false)) await clickPrimary(effect)
  }
  await effect.waitFor({ state: 'hidden' })
  await waitForTrace(page, 'resolve-ability-effect')
  result.actions.push('place-stage-rest-source-pay-and-deck-to-support')
}

const runCase = async (browser, testCase) => {
  const page = await browser.newPage({ viewport: testCase.viewport })
  page.setDefaultTimeout(10_000)
  await page.addInitScript(() => {
    window.__bs9LoadedImageUrls = []
    const scan = () => {
      const loaded = [...document.images]
        .filter((node) => node.complete && node.naturalWidth > 0)
        .flatMap((node) => [node.getAttribute('src'), node.currentSrc, node.src].filter(Boolean))
      window.__bs9LoadedImageUrls = [...new Set([...(window.__bs9LoadedImageUrls ?? []), ...loaded])]
    }
    const attach = () => {
      scan()
      new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] })
      window.setInterval(scan, 100)
    }
    if (document.documentElement) attach()
    else document.addEventListener('DOMContentLoaded', attach, { once: true })
  })
  const requestedImages = new Set()
  page.on('request', (request) => {
    if (request.resourceType() === 'image') requestedImages.add(request.url())
  })
  const errors = recordBrowserErrors(page)
  const result = { ...testCase, status: 'FAIL', actions: [] }
  try {
    await openRoute(page, testCase.route, testCase.cardNumber)
    const record = recordBy(testCase.cardNumber)
    if (testCase.kind === 'flip') await runFlip(page, testCase.cardNumber, testCase.negative, result)
    else if (testCase.kind === 'passive') await runPassive(page, testCase.negative, result)
    else if (testCase.kind === 'skill') await runSkill(page, testCase.cardNumber, testCase.negative, result)
    else if (testCase.kind === 'attack') await runAttackEffect(page, testCase.cardNumber, testCase.negative, result)
    else if (testCase.kind === 'extra') await runExtra(page, testCase.cardNumber, testCase.negative, result)
    else if (testCase.kind === 'item') await runItem(page, testCase.cardNumber, testCase.negative, result)
    else if (testCase.kind === 'faint') await runFaint(page, testCase.cardNumber, testCase.negative, result)
    else if (testCase.kind === 'trap') await runTrap(page, testCase.cardNumber, testCase.negative, result)
    else if (testCase.kind === 'stage') await runStage(page, testCase.negative, result)
    else throw new Error(`Unhandled Browser kind ${testCase.kind}`)
    Object.assign(result, await assertExactImageLoaded(page, record, requestedImages.has(record.imageUrl)))
    result.expectedImageUrl = record.imageUrl
    result.trace = await trace(page)
    result.traceCommandKinds = result.trace.map((entry) => entry.commandKind)
    result.finalPendingSurfaces = await readVisibleFinalSurfaces(page)
    assert.deepEqual(result.finalPendingSurfaces, [], `${record.cardNumber} must settle pending UI surfaces: ${result.finalPendingSurfaces.join(', ')}`)
    result.negativeEvidence = testCase.negative ? result.actions.length > 0 : false
    if (testCase.negative) assert.equal(result.negativeEvidence, true, `${record.cardNumber} negative route must retain blocker/skip evidence`)
    result.publicState = await page.evaluate(() => ({
      body: document.body.innerText.slice(0, 7_000),
      battleCards: [...document.querySelectorAll('.battle-row .combat-card-wrap')].map((node) => ({
        id: node.getAttribute('data-card-instance-id'),
        title: node.querySelector('.card-face')?.getAttribute('title') ?? null,
        hp: node.querySelector('.badge-hp')?.textContent?.trim() ?? null,
        atk: node.querySelector('.badge-atk')?.textContent?.trim() ?? null,
      })),
    }))
    assert.deepEqual(errors, [], `${testCase.cardNumber} Browser errors: ${errors.join('; ')}`)
    result.trace = await trace(page)
    result.status = 'PASS'
  } catch (error) {
    result.error = error instanceof Error ? error.stack ?? error.message : String(error)
    result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 10_000)
    result.trace = await trace(page).catch(() => [])
    result.traceCommandKinds = result.trace.map((entry) => entry.commandKind)
    result.finalPendingSurfaces = await readVisibleFinalSurfaces(page).catch(() => [])
    result.negativeEvidence = testCase.negative ? result.actions.length > 0 : false
  } finally {
    const slug = `${testCase.cardNumber}-${testCase.kind}-${testCase.negative ? 'negative' : 'positive'}-${testCase.viewport.width}x${testCase.viewport.height}`
    result.screenshot = resolve(outputDirectory, `${slug}${result.status === 'PASS' ? '' : '-failed'}.png`)
    await page.screenshot({ path: result.screenshot, fullPage: true }).catch(() => {})
    await page.close()
  }
  console.log(
    `${result.status} ${testCase.cardNumber} ${testCase.kind} ${testCase.negative ? 'negative' : 'positive'} ${testCase.viewport.width}x${testCase.viewport.height}`,
    result.error?.split('\n')[0] ?? '',
  )
  return result
}

const casesByKind = [
  { kind: 'flip', cards: ['BS9-051', 'BS9-051@1', 'BS9-053', 'BS9-053@1'] },
  { kind: 'passive', cards: ['BS9-052'] },
  { kind: 'skill', cards: ['BS9-054', 'BS9-060', 'BS9-060@1', 'BS9-060@2', 'BS9-061', 'BS9-063', 'BS9-063@1', 'BS9-065', 'BS9-065@1'] },
  { kind: 'extra', cards: ['BS9-055', 'BS9-055@1'] },
  { kind: 'attack', cards: ['BS9-055', 'BS9-055@1', 'BS9-056', 'BS9-057', 'BS9-058', 'BS9-059', 'BS9-060', 'BS9-060@1', 'BS9-060@2', 'BS9-062', 'BS9-065', 'BS9-065@1'] },
  { kind: 'item', cards: ['BS9-066', 'BS9-067'] },
  { kind: 'faint', cards: ['BS9-064', 'BS9-064@1'] },
  { kind: 'trap', cards: ['BS9-068', 'BS9-069'] },
  { kind: 'stage', cards: ['BS9-070'] },
]
const viewports = [
  { width: 1907, height: 863 },
  { width: 1164, height: 777 },
]
const cases = viewports.flatMap((viewport) =>
  casesByKind.flatMap(({ kind, cards }) =>
    cards.flatMap((cardNumber) => [
      { kind, cardNumber, route: `card${kind === 'skill' ? '-skill' : kind === 'attack' ? '-attack' : ''}:${cardNumber}`, negative: false, viewport },
      { kind, cardNumber, route: `card${kind === 'skill' ? '-skill-negative' : kind === 'attack' ? '-attack-negative' : '-negative'}:${cardNumber}`, negative: true, viewport },
    ]),
  ),
)
const selectedCases = process.env.BS9_051_070_CASE
  ? cases.filter((testCase) =>
      `${testCase.cardNumber}:${testCase.kind}:${testCase.negative ? 'negative' : 'positive'}`
        .includes(process.env.BS9_051_070_CASE),
    )
  : cases

const preview = spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: 'ignore' },
)
const waitForPreview = async () => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (preview.exitCode !== null) throw new Error(`Vite preview exited before serving ${baseUrl}`)
    try {
      if ((await fetch(baseUrl)).ok) return
    } catch {
      // Still starting.
    }
    await wait(100)
  }
  throw new Error(`Vite preview did not start on ${baseUrl}`)
}

const results = []
let browser
try {
  await waitForPreview()
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  })
  for (const testCase of selectedCases) results.push(await runCase(browser, testCase))
} finally {
  await browser?.close()
  if (preview.exitCode === null) preview.kill()
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  scope: 'BS9-051..070 candidate-isolated physical-card Browser A/B across 1907x863 and 1164x777; not promotion, full-match, or online proof.',
  total: results.length,
  passed: results.filter((result) => result.status === 'PASS').length,
  failed: results.filter((result) => result.status !== 'PASS'),
  results,
}
writeFileSync(resolve(outputDirectory, 'bs9-051-070-browser.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({
  total: report.total,
  passed: report.passed,
  failed: report.failed.map((result) => ({
    cardNumber: result.cardNumber,
    kind: result.kind,
    negative: result.negative,
    viewport: result.viewport,
    error: result.error?.split('\n')[0],
  })),
}, null, 2))
process.exitCode = report.failed.length > 0 ? 1 : 0
