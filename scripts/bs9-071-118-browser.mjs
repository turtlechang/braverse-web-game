import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import bs9Candidates from '../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json' with { type: 'json' }

/**
 * Candidate-only Browser A/B gate for BS9-071..118.  The route is always
 * backed by demo.ts' isolated physical fixture and never promotes candidate
 * data.  Primary lanes cover every physical record; attack lanes are added
 * for cards with a printed attack-after effect so the shared continuation is
 * exercised separately from the skill/On Play surface.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const playwright = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwright.chromium ?? playwright.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_BS9_071_118_TEST_PORT ?? 4211)
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
// Nested effects can briefly coexist with the previous attack panel while
// React swaps the pending view-model.  The last visible panel is the newest
// public decision surface and therefore the one whose controls must receive
// the next click.
const panel = (page) => page.locator('.effect-panel[role="alertdialog"]:visible').last()
const flip = (page) => visible(page, '.flip-response-modal')
const draw = (page) => visible(page, '.draw-up-to-modal')
const handDiscard = (page) => visible(page, '.hand-discard-modal')
const trap = (page) => visible(page, '.trap-response-modal')
// Attack-Then can be a normal guided EffectPanel (for example BS9-079's
// activate-extra-deck-attack), not only the optional-cost embedded surface.
// Keep the selector broad here; runAttack is already limited to records with
// a printed attack continuation and resolves the panel before checking the
// separate Extra Deck candidate modal.
const optionalAttack = (page) => visible(page, '.effect-panel[role="alertdialog"], .optional-cost-attack-modal')
const inspectDeck = (page) => visible(page, '.inspect-deck-modal')
const revealTop = (page) => visible(page, '.card-reveal-modal:not(.discard-reveal-modal)')
const revealDiscard = (page) => visible(page, '.discard-reveal-modal')

// A command trace is useful evidence only when it records an executed
// resolution.  In particular, `resolve-flip` is also emitted when the player
// explicitly declines the FLIP effect, and an empty ability entry can be the
// declaration before a pending decision is left unresolved.  Keep this
// mirror of the public trace contract local to the Browser gate so a lane
// cannot pass merely because a declaration was logged.
const substantiveCommandKinds = new Set([
  'resolve-ability-effect',
  'resolve-battle',
  'resolve-attack-effect',
  'resolve-faint-effect',
  'resolve-inspect-deck',
  'resolve-draw-up-to',
  'resolve-flip',
  'resolve-choose-one',
  'resolve-opponent-hand-discard',
  'resolve-opponent-rest-support',
  'resolve-place-hand-hp',
  'resolve-reorder-hp',
  'resolve-stage-trigger',
  'resolve-after-damage-effect',
  'resolve-optional-cost-attack',
  'resolve-extra-deck-attack',
])
const noOpTracePattern = /未發動|不發動|略過|未執行|條件不成立|未生效/
const substantiveTraceStepPattern = /結果|抽牌|棄置|送入|放置|移動|回到|恢復|傷害|HP|攻擊力|橫置|活躍|發動|結算|選擇/
const isExecutedTraceEntry = (entry) => {
  if (!substantiveCommandKinds.has(entry?.commandKind)) return false
  const steps = Array.isArray(entry?.steps) ? entry.steps.map(String) : []
  if (steps.length > 0 && steps.every((step) => noOpTracePattern.test(step))) return false
  if (steps.length === 0) return entry?.commandKind === 'resolve-ability-effect'
  return steps.some((step) => !noOpTracePattern.test(step) && substantiveTraceStepPattern.test(step))
}
const hasExecutedTraceEvidence = (entries) => entries.some(isExecutedTraceEntry)

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
]

const readVisibleFinalSurfaces = async (page) => page.evaluate((selectors) =>
  selectors.filter(([, selector]) => [...document.querySelectorAll(selector)].some((node) => {
    const style = window.getComputedStyle(node)
    return style.display !== 'none' && style.visibility !== 'hidden' && node.getBoundingClientRect().width > 0
  })).map(([name]) => name), finalSurfaceSelectors)

const readPublicState = async (page) => page.evaluate(() => {
  const cardName = (node) => node?.querySelector('img')?.getAttribute('alt') ??
    node?.querySelector('.card-fallback strong')?.textContent?.trim() ?? null
  const readRow = (position) => {
    const root = document.querySelector(`.battle-row.${position}-field`)
    if (!root) return null
    return {
      deck: root.querySelector('.deck-zone .resource-summary strong')?.textContent?.trim() ?? null,
      discard: root.querySelector('.discard-zone.resource-summary strong')?.textContent?.trim() ?? null,
      break: root.querySelector('.break-zone .zone-heading b')?.textContent?.trim() ?? null,
      hand: root.querySelector('.row-stat-hand .row-stat-value')?.textContent?.trim() ?? null,
      stage: cardName(root.querySelector('.stage-zone .stage-card')),
      stageRested: root.querySelector('.stage-zone .stage-card')?.classList.contains('is-rested') ?? null,
      support: [...root.querySelectorAll('.support-card-wrap .support-card')].map((node) => ({
        name: cardName(node),
        rested: node.classList.contains('is-rested'),
      })),
      battle: [...root.querySelectorAll('.combat-slots .combat-card-wrap')].map((node) => ({
        name: cardName(node.querySelector('.card-face')),
        hp: node.querySelector('.badge-hp')?.textContent?.trim() ?? null,
        atk: node.querySelector('.badge-atk')?.textContent?.trim() ?? null,
        rested: node.classList.contains('is-rested'),
      })),
    }
  }
  return {
    phase: document.querySelector('.turn-indicator')?.textContent?.trim() ?? null,
    rows: { top: readRow('top'), bottom: readRow('bottom') },
    bottomHandCount: document.querySelectorAll('.bottom-hand .hand-card-wrap').length,
  }
})

const recordBy = (cardNumber) => {
  const record = bs9Candidates.cards.find((candidate) => candidate.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS9 candidate ${cardNumber}`)
  return record
}
const baseNumber = (cardNumber) => cardNumber.split('@')[0]
const expectedName = (cardNumber) => recordBy(cardNumber).name

// A vanilla attack has no printed Then clause (and no separate Skill/FLIP
// surface).  These lanes must exercise the normal hand -> deploy -> payment ->
// target path; an empty attack-effect panel is not evidence that the printed
// attack was actually declared or settled.
const isPureDamageAttack = (record) =>
  record.type === 'cookie' &&
  !record.skill?.text?.trim() &&
  !record.flipText?.trim() &&
  !/\bThen\s*,/i.test(record.attackText ?? '')

const parseAttackCostCount = (attackText) => {
  const cost = attackText?.match(/^\s*<([^>]+)>/)?.[1] ?? ''
  return (cost.match(/\{[A-Z]\}/g) ?? []).length
}

const browserErrors = (page) => {
  const errors = []
  const imageFailures = []
  const imageResponses = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const location = message.location()
    const text = message.text()
    if (location.url?.endsWith('/favicon.ico') && text.includes('404')) return
    errors.push(`console: ${text} (${location.url || 'unknown URL'})`)
  })
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'unknown request failure'
    const entry = `${request.url()} (${failure})`
    if (request.resourceType() === 'image') imageFailures.push(entry)
    if (!request.url().endsWith('/favicon.ico')) errors.push(`requestfailed: ${entry}`)
  })
  page.on('response', (response) => {
    if (response.request().resourceType() !== 'image') return
    imageResponses.push({ url: response.url(), status: response.status(), ok: response.ok() })
  })
  return { errors, imageFailures, imageResponses }
}

const assertNamed = async (locator, name, imageUrl) => {
  await locator.waitFor({ state: 'visible' })
  const alts = await locator.locator('img').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('alt'))).catch(() => [])
  assert.ok(alts.includes(name), `${name} must render as an image-backed physical card face`)
  if (!imageUrl) return
  const exactLoaded = await locator.locator('img').evaluateAll((nodes, expectedUrl) => {
    const matches = nodes.filter((node) => {
      const sources = [node.getAttribute('src'), node.currentSrc, node.src]
      return sources.includes(expectedUrl)
    })
    const isLoaded = (node) => node.complete && node.naturalWidth > 0
    if (matches.some(isLoaded)) return true
    return new Promise((resolvePromise) => {
      let settled = false
      const finish = (value) => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        for (const node of matches) {
          node.removeEventListener('load', onLoad)
          node.removeEventListener('error', onError)
        }
        resolvePromise(value)
      }
      const onLoad = () => {
        if (matches.some(isLoaded)) finish(true)
      }
      const onError = () => {
        if (matches.length > 0 && matches.every((node) => node.complete && node.naturalWidth === 0)) {
          finish(false)
        }
      }
      const timeout = window.setTimeout(() => finish(false), 10_000)
      for (const node of matches) {
        node.addEventListener('load', onLoad)
        node.addEventListener('error', onError)
      }
      if (matches.length === 0 || matches.every((node) => node.complete)) onError()
    })
  }, imageUrl).catch(() => false)
  assert.equal(exactLoaded, true, `${name} must load its exact official image URL (${imageUrl})`)
  // Keep a page-local witness after an effect moves the physical card out of
  // the DOM (for example a Then that places its source on the deck bottom).
  // The final image gate can then distinguish a genuinely rendered official
  // face from a fallback, without requiring the card to remain in view after
  // its legal resolution.
  await locator.locator('img').evaluateAll((nodes, expectedUrl) => {
    const loaded = nodes.some((node) => {
      const sources = [node.getAttribute('src'), node.currentSrc, node.src]
      return sources.includes(expectedUrl) && node.complete && node.naturalWidth > 0
    })
    if (!loaded) return
    const seen = (window.__bs9SeenOfficialImages ??= [])
    if (!seen.includes(expectedUrl)) seen.push(expectedUrl)
  }, imageUrl).catch(() => {})
}

const handCard = (page, name) => page.locator('.bottom-hand .hand-card-wrap').filter({ has: page.locator(`.hand-card[title="${name.replaceAll('"', '\\"')}"]`) }).first()
const battleSource = (page, cardNumber) => page.locator(`.combat-card-wrap[data-card-instance-id="bs9-${baseNumber(cardNumber).toLowerCase()}-source"], [data-card-instance-id="bs9-${baseNumber(cardNumber).toLowerCase()}-source"]`).first()
const clickIfVisible = async (locator) => {
  if (await locator.count() && await locator.isVisible().catch(() => false)) {
    await locator.click()
    return true
  }
  return false
}
const clickButton = async (container, labels) => {
  for (const label of labels) {
    const button = container.getByRole('button', { name: label, exact: true }).first()
    const fallback = container.getByRole('button', { name: new RegExp(label) }).first()
    const target = await button.count() ? button : fallback
    if (await target.count() && await target.isVisible().catch(() => false)) {
      if (await target.isEnabled()) {
        await target.click()
        return true
      }
    }
  }
  return false
}
const waitForTrace = async (page, commandKind, minimum = 1) => {
  await page.waitForFunction(({ commandKind: expected, minimum: count }) =>
    (window.__braverseContractTrace ?? []).filter((entry) => entry.commandKind === expected).length >= count,
    { commandKind, minimum },
  )
  return trace(page)
}

const openRoute = async (page, route, cardNumber) => {
  await page.goto(`${baseUrl}/?test-state=${encodeURIComponent(route)}&contract-card=${baseNumber(cardNumber)}`, { waitUntil: 'domcontentloaded' })
  const url = new URL(page.url())
  assert.equal(url.searchParams.get('test-state'), route, `${cardNumber} must preserve the exact test-state variant route`)
  assert.equal(url.searchParams.get('contract-card'), baseNumber(cardNumber), `${cardNumber} contract trace must use the base runtime id`)
  await page.locator('.game-shell').waitFor({ state: 'visible' })
  await page.waitForTimeout(220)
}

const chooseFirst = async (container, selector, count = 1) => {
  const options = container.locator(`${selector} button:not(:disabled)`)
  const total = await options.count()
  if (total < count) return false
  for (let index = 0; index < count; index += 1) await options.nth(index).click()
  return true
}

const resolveDraw = async (page, result) => {
  const modal = draw(page)
  if (!await modal.count()) return false
  await modal.waitFor({ state: 'visible' })
  const options = modal.locator('.draw-up-to-option')
  if (await options.count()) await options.last().click()
  await clickButton(modal, ['抽取 1 張牌', '抽取 2 張牌', '確認抽牌', '略過抽牌'])
  await modal.waitFor({ state: 'hidden' }).catch(() => {})
  result.actions.push('resolve-draw')
  return true
}

const resolveHandDiscard = async (page, result) => {
  const modal = handDiscard(page)
  if (!await modal.count()) return false
  await modal.waitFor({ state: 'visible' })
  // Some effects (notably BS9-085) require selecting multiple cards and
  // assigning each selected card to the top or bottom of the deck before the
  // confirmation control becomes enabled.  Selecting a second card before
  // assigning the first one merely toggles the first selection back, leaving
  // a stale modal behind.  Drive the same public per-card placement controls
  // that the user sees, bounded by the printed required count.
  const hint = await modal.locator('.faint-target-hint').innerText().catch(() => '')
  const required = Number(hint.match(/必須選擇\s*(\d+)\s*張/)?.[1] ?? 1)
  for (let index = 0; index < required; index += 1) {
    const options = modal.locator('.hand-discard-card-option')
    let optionWrap = null
    let option = null
    for (let wrapperIndex = 0; wrapperIndex < await options.count(); wrapperIndex += 1) {
      const candidateWrap = options.nth(wrapperIndex)
      const candidate = candidateWrap.locator(':scope > button:not(:disabled):not(.is-selected)').first()
      if (await candidate.count() && await candidate.isVisible().catch(() => false)) {
        optionWrap = candidateWrap
        option = candidate
        break
      }
    }
    if (!option || !optionWrap) break
    await option.click()
    // Scope placement to the card just selected.  A global first() would
    // re-click the unselected "bottom" button of the first card on the
    // second iteration, leaving the newly selected card without a placement.
    const placement = optionWrap.locator('.hand-discard-placement button:not(:disabled):not(.is-selected)').first()
    if (await placement.count() && await placement.isVisible().catch(() => false)) {
      await placement.click()
    }
  }
  if (!await clickButton(modal, ['確認棄置', '確認'])) {
    throw new Error('hand-discard modal has no enabled confirmation control after card placement')
  }
  await modal.waitFor({ state: 'hidden' }).catch(() => {})
  result.actions.push('resolve-hand-discard')
  return true
}

const effectCandidateSelectors = [
  '.effect-candidates-payment',
  '.effect-candidates-battle-to-hand',
  '.effect-candidates-cost-support',
  '.effect-candidates-discard-hand',
  '.effect-candidates-hp-cost',
  '.effect-candidates-trash-battle',
  '.effect-candidates-cost-trash-to-break',
  '.effect-candidates-cost-hand-to-break',
  '.effect-candidates-trash-deck-bottom',
  '.effect-candidates-trash-deck',
  '.effect-candidates-choice',
  '.effect-candidates-rest-support',
  '.effect-candidates-target',
  '.effect-candidates-effect-target',
  '.effect-candidates-self',
  '.effect-hp-amount-options',
]

const clickEffectCandidate = async (effect) => {
  for (const selector of effectCandidateSelectors) {
    const section = effect.locator(selector).first()
    if (!await section.count() || !await section.isVisible().catch(() => false)) continue
    const selectedCount = await section.locator('button.is-selected, button[aria-pressed="true"]').count()
    if (selector === '.effect-candidates-choice' && selectedCount > 0) continue
    // The "已選 X／Y" counter is rendered as a sibling <small> in the
    // enclosing effect-panel column, not inside the candidate button group.
    const statusText = [
      // Some nested panels render the counter outside the candidate group's
      // immediate column; keep the whole public panel as a final fallback.
      await section.locator('xpath=ancestor::section[contains(@class, "effect-panel-col")][1]').innerText().catch(() => ''),
      await section.locator('xpath=../..').innerText().catch(() => ''),
      await effect.innerText().catch(() => ''),
    ].join(' ')
    const selectionBudgets = [...statusText.matchAll(/已選\s*(\d+)\s*[／/]\s*(\d+)/g)]
    if (
      selectedCount > 0 &&
      (selectionBudgets.some(([, selected, maximum]) => Number(selected) >= Number(maximum)) ||
        (selector === '.effect-candidates-target' && /已選\s*1\s*[／/]\s*1/.test(statusText)))
    ) continue
    const unselected = section.locator('button:not(:disabled):not(.is-selected):not([aria-pressed="true"])').first()
    if (await unselected.count() && await unselected.isVisible().catch(() => false)) {
      await unselected.click()
      return true
    }
  }
  return false
}

const resolveInspectDeck = async (page, result) => {
  const modal = inspectDeck(page)
  if (!await modal.count() || !await modal.isVisible().catch(() => false)) return false
  await modal.waitFor({ state: 'visible' })
  const options = modal.locator('.inspect-deck-grid > button:not(:disabled)')
  if (await options.count()) await options.first().click()
  if (!await clickButton(modal, ['確認並放回'])) {
    throw new Error('inspect-deck modal has no enabled confirmation control')
  }
  await modal.waitFor({ state: 'hidden' }).catch(() => {})
  result.actions.push('resolve-inspect-deck')
  return true
}

const resolveRevealTop = async (page, result) => {
  const modal = revealTop(page)
  if (!await modal.count() || !await modal.isVisible().catch(() => false)) return false
  await modal.waitFor({ state: 'visible' })
  if (!await clickButton(modal, ['確認並繼續'])) {
    throw new Error('card-reveal modal has no enabled confirmation control')
  }
  await modal.waitFor({ state: 'hidden' }).catch(() => {})
  result.actions.push('resolve-card-reveal')
  return true
}

const resolveRevealDiscard = async (page, result) => {
  const modal = revealDiscard(page)
  if (!await modal.count() || !await modal.isVisible().catch(() => false)) return false
  await modal.waitFor({ state: 'visible' })
  if (!await clickButton(modal, ['確認並繼續'])) {
    throw new Error('discard-reveal modal has no enabled confirmation control')
  }
  await modal.waitFor({ state: 'hidden' }).catch(() => {})
  result.actions.push('resolve-discard-reveal')
  return true
}

const resolveKnownPendingModal = async (page, result) => {
  let resolved = false
  resolved = await resolveDraw(page, result) || resolved
  resolved = await resolveHandDiscard(page, result) || resolved
  resolved = await resolveInspectDeck(page, result) || resolved
  resolved = await resolveRevealTop(page, result) || resolved
  resolved = await resolveRevealDiscard(page, result) || resolved
  return resolved
}

const waitForEffectTransition = async (page, previousText) =>
  page.waitForFunction((text) => {
    const panels = [...document.querySelectorAll('.effect-panel[role="alertdialog"]')]
      .filter((node) => {
        const style = window.getComputedStyle(node)
        return style.display !== 'none' && style.visibility !== 'hidden' && node.getBoundingClientRect().width > 0
      })
    const extraModal = [...document.querySelectorAll('.extra-deck-attack-modal')].some((node) => {
      const style = window.getComputedStyle(node)
      return style.display !== 'none' && style.visibility !== 'hidden' && node.getBoundingClientRect().width > 0
    })
    return extraModal || panels.length === 0 || panels.some((node) => {
      const body = node.querySelector('.effect-panel-body')
      return (body?.textContent ?? '') !== text
    })
  }, previousText, { timeout: 2_500 }).then(() => true).catch(() => false)

const resolveEffectPanel = async (page, result) => {
  let sawPanel = false
  let sawPendingModal = false
  for (let round = 0; round < 8; round += 1) {
    const effect = panel(page)
    if (!await effect.count() || !await effect.isVisible().catch(() => false)) {
      const resolvedPending = await resolveKnownPendingModal(page, result)
      sawPendingModal = resolvedPending || sawPendingModal
      if (!resolvedPending) break
      continue
    }
    sawPanel = true
    const selected = await clickEffectCandidate(effect)
    // Let React commit the candidate selection before pressing the phase
    // action.  Clicking a target and confirming in the same turn can submit
    // the previous (empty) selection, leaving a stale panel that looks like
    // a resolved effect but has no corresponding command trace.
    if (selected) {
      await page.waitForTimeout(150)
      continue
    }
    // The trace/history list is appended to the panel after every command.
    // Compare only the current guided effect body so history growth cannot be
    // mistaken for a new public decision surface.
    const previousText = await effect.locator('.effect-panel-body').innerText().catch(() => '')
    const advanced = await clickButton(effect, ['下一步', '確認', '確認發動', '發動技能'])
    if (!selected && !advanced) break
    await page.waitForTimeout(150)
    if (advanced && !await waitForEffectTransition(page, previousText)) break
    const resolvedPending = await resolveKnownPendingModal(page, result)
    sawPendingModal = resolvedPending || sawPendingModal
  }
  if (!sawPanel && !sawPendingModal) return false
  await panel(page).waitFor({ state: 'hidden' }).catch(() => {})
  result.actions.push('resolve-effect-panel')
  return true
}

// A candidate click can commit the React view-model one render after the
// resolver's normal loop.  Give the still-visible panel one explicit primary
// action pass before declaring a nested effect unresolved.  This is bounded
// and only clicks the public enabled primary control; it never dispatches a
// fabricated command or bypasses the rules layer.
const forceResolveVisibleEffectPanel = async (page, result) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const effect = panel(page)
    if (!await effect.count() || !await effect.isVisible().catch(() => false)) return true
    // EffectPanel keeps its alertdialog wrapper briefly while it renders the
    // compact history view.  No body means the pending public decision has
    // already been removed, even if the wrapper has not been hidden yet.
    if (!await effect.locator('.effect-panel-body').count()) return true
    if (await clickEffectCandidate(effect)) {
      await page.waitForTimeout(180)
      continue
    }
    const primary = effect.locator('button.effect-panel-primary-action:not(:disabled)').first()
    if (!await primary.count() || !await primary.isVisible().catch(() => false)) return false
    const previousText = await effect.locator('.effect-panel-body').innerText().catch(() => '')
    await primary.click()
    await page.waitForTimeout(260)
    if (!await waitForEffectTransition(page, previousText)) return false
    await resolveKnownPendingModal(page, result)
  }
  const remaining = panel(page)
  return !await remaining.count() || !await remaining.isVisible().catch(() => false)
}

const runFlip = async (page, record, negative, result) => {
  const modal = flip(page)
  await modal.waitFor({ state: 'visible' })
  await assertNamed(modal.locator('.flip-reveal-card'), record.name, record.imageUrl)
  if (negative) {
    assert.equal(await modal.getByRole('button', { name: '不發動', exact: true }).isEnabled(), true)
    await modal.getByRole('button', { name: '不發動', exact: true }).click()
    await modal.waitFor({ state: 'hidden' })
    result.actions.push('decline-flip-negative')
    result.negativeEvidence = 'explicit-flip-decline'
    return
  }
  const discard = modal.locator('.flip-card-page button:not(:disabled), .flip-discard-options button:not(:disabled), .effect-candidates-payment button:not(:disabled)')
  if (record.cardNumber.startsWith('BS9-084') || record.cardNumber.startsWith('BS9-110') || record.cardNumber.startsWith('BS9-113')) {
    assert.ok(await discard.count() >= 1, `${record.cardNumber} must expose one discard payment`)
    await discard.first().click()
  }
  if (record.cardNumber.startsWith('BS9-113')) {
    const target = modal.locator('[aria-label="FLIP 效果目標"] button:not(:disabled), .flip-target-options button:not(:disabled), .effect-candidates-target button:not(:disabled)')
    if (await target.count()) await target.first().click()
  }
  await modal.getByRole('button', { name: '發動 FLIP', exact: true }).click()
  await modal.waitFor({ state: 'hidden' })
  await resolveDraw(page, result)
  await resolveKnownPendingModal(page, result)
  await waitForTrace(page, 'resolve-flip')
  result.actions.push('activate-flip')
  result.evidence = 'executed-flip-resolution'
}

const runPassive = async (page, record, negative, result) => {
  const source = battleSource(page, record.cardNumber)
  const sourceVisible = await source.count() && await source.isVisible().catch(() => false)
  // BS9-082's passive is a target restriction.  Put the opponent through the
  // real attack declaration surface and compare its legal target list with
  // and without Shadow Milk in the defending battle area.
  if (baseNumber(record.cardNumber) === 'BS9-082') {
    if (!sourceVisible) throw new Error(`${record.cardNumber} passive source is not visible`)
    await assertNamed(source, record.name, record.imageUrl)
    // The fixture hands control to player-two so the passive is witnessed from
    // the opponent's attack.  In the viewer-relative layout that active
    // attacker is therefore in the bottom field, while BS9-082 remains in the
    // top (defending) field.
    const attacker = page.locator('.bottom-field .combat-card-wrap .card-face.is-attackable').first()
    await attacker.waitFor({ state: 'visible' })
    await attacker.click()
    const paymentPanel = page.getByTestId('attack-payment-panel').first()
    for (let index = 0; index < 3; index += 1) {
      const payment = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').last()
      if (!await payment.count() || !await payment.isVisible().catch(() => false)) break
      await payment.press('Enter')
      await page.waitForTimeout(100)
      if (await paymentPanel.count() && /付款合法/.test(await paymentPanel.innerText().catch(() => ''))) break
    }
    await paymentPanel.waitFor({ state: 'visible' })
    assert.match(await paymentPanel.innerText(), /付款合法/, `${record.cardNumber} passive attack witness must pay legally`)
    const targets = page.locator('.top-field .combat-card-wrap .card-face[aria-label^="選擇攻擊目標："]')
    await targets.first().waitFor({ state: 'visible' })
    const targetNames = await targets.evaluateAll((nodes) => nodes.map((node) =>
      (node.getAttribute('aria-label') ?? '').replace(/^選擇攻擊目標：/, '').trim(),
    ))
    assert.ok(targetNames.includes(record.name), `${record.cardNumber} passive attack must expose its source as a legal target`)
    if (negative) {
      assert.ok(targetNames.length >= 2, `${record.cardNumber} negative passive must restore another legal Cookie target`)
      result.negativeEvidence = 'passive-target-restriction-absent'
    } else {
      assert.deepEqual(targetNames, [record.name], `${record.cardNumber} positive passive must restrict attack targets to itself`)
      result.effectResolved = true
      result.evidence = 'executed-passive-target-restriction'
    }
    await targets.first().click()
    await page.waitForTimeout(700)
    result.actions.push('passive-target-restriction')
    return
  }
  // BS9-096／111 replace the Refresh requirement itself.  The fixture opens
  // the real Refresh decision with an empty deck; selecting one legal discard
  // Cookie then provides a direct public witness for the resulting break
  // count (0 for 096, 2 for 111, versus the ordinary one-Cookie baseline on
  // the negative route).
  if (baseNumber(record.cardNumber) === 'BS9-096' || baseNumber(record.cardNumber) === 'BS9-111') {
    // Both A/B routes keep the physical source visible.  The negative fixture
    // crosses the printed controller boundary (096: the opponent refreshes;
    // 111: the source controller refreshes), so the ordinary one-Cookie
    // baseline is observed without discarding the exact card-image gate.
    if (!sourceVisible) throw new Error(`${record.cardNumber} passive source is not visible`)
    await assertNamed(source, record.name, record.imageUrl)
    const refresh = visible(page, '.decision-modal')
    await refresh.waitFor({ state: 'visible' })
    const option = refresh.locator('.decision-card-options button:not(:disabled)').first()
    await option.waitFor({ state: 'visible' })
    const before = await readPublicState(page)
    await option.click()
    await refresh.waitFor({ state: 'hidden' }).catch(() => {})
    await page.waitForTimeout(450)
    const after = await readPublicState(page)
    // Both refresh fixtures expose the affected player's row in the local
    // viewer.  Each fixture gives the refresh decision to the viewer, so the
    // affected player's public row remains the bottom field; reading the top
    // row would silently compare the opponent's unchanged break area.
    const row = after?.rows?.bottom
    const beforeRow = before?.rows?.bottom
    const breakCount = Number((row?.break ?? '0').match(/\d+/)?.[0] ?? 0)
    const beforeBreak = Number((beforeRow?.break ?? '0').match(/\d+/)?.[0] ?? 0)
    const expectedIncrease = negative ? 1 : (baseNumber(record.cardNumber) === 'BS9-111' ? 2 : 0)
    assert.equal(breakCount - beforeBreak, expectedIncrease, `${record.cardNumber} Refresh replacement must change the break count by the printed amount`)
    result.actions.push('resolve-refresh-replacement')
    if (negative) {
      result.negativeEvidence = 'refresh-default-cookie-break-count'
    } else {
      result.effectResolved = true
      result.evidence = 'executed-refresh-replacement'
    }
    return
  }
  // BS9-112 keeps its source visible on both A/B routes; the threshold is
  // witnessed by the computed attack badge rather than source absence.
  if (baseNumber(record.cardNumber) === 'BS9-112') {
    if (!sourceVisible) throw new Error(`${record.cardNumber} passive source is not visible`)
    await assertNamed(source, record.name, record.imageUrl)
    const attackBadge = source.locator('.badge-atk').first()
    await attackBadge.waitFor({ state: 'visible' })
    const attack = Number((await attackBadge.innerText()).trim())
    assert.equal(attack, negative ? 1 : 2, `${record.cardNumber} passive attack badge must reflect the trash threshold`)
    result.actions.push('passive-attack-badge')
    if (negative) {
      result.negativeEvidence = 'passive-threshold-not-met'
    } else {
      result.effectResolved = true
      result.evidence = 'executed-passive-attack-badge'
    }
    return
  }
  if (negative) {
    if (sourceVisible) {
      throw new Error(`${record.cardNumber} negative passive still exposes its source; no blocked condition was proven`)
    }
    result.actions.push('passive-source-condition-blocked')
    result.negativeEvidence = 'passive-source-absent'
    return
  }
  if (!sourceVisible) throw new Error(`${record.cardNumber} positive passive source is not visible`)
  await assertNamed(source, record.name, record.imageUrl)
  throw new Error(`${record.cardNumber} passive lane only observes the source; no runtime trigger was settled`)
}

const runSkill = async (page, record, negative, result) => {
  if (['BS9-106', 'BS9-107', 'BS9-108'].includes(baseNumber(record.cardNumber))) {
    // The Chess Piece cards trigger only when Shadow Milk sends them from
    // hand to trash.  The fixture opens that real hand-discard decision so
    // this lane can select the exact physical card before the queued passive
    // effect enters the normal EffectPanel path.
    const discard = handDiscard(page)
    await discard.waitFor({ state: 'visible' })
    const target = discard.locator('.hand-discard-card-option > button').filter({ hasText: record.name }).first()
    await assertNamed(target, record.name, record.imageUrl)
    await target.click()
    if (!await clickButton(discard, ['確認棄置', '確認'])) {
      throw new Error(`${record.cardNumber} Chess Piece discard trigger has no enabled confirmation control`)
    }
    await discard.waitFor({ state: 'hidden' }).catch(() => {})
    if (negative) {
      await page.waitForTimeout(350)
      result.actions.push('discard-non-shadow-milk-source')
      result.negativeEvidence = 'shadow-milk-discard-trigger-not-fired'
      return
    }
    if (!await resolveEffectPanel(page, result)) {
      throw new Error(`${record.cardNumber} Shadow Milk discard trigger did not resolve`)
    }
    result.effectResolved = true
    result.actions.push('resolve-shadow-milk-discard-trigger')
    result.evidence = 'executed-shadow-milk-discard-trigger'
    return
  }
  const sourceHand = handCard(page, record.name)
  const sourceHandVisible = await sourceHand.count() && await sourceHand.isVisible().catch(() => false)
  // On Play skills are declared from the hand's real "登場" action.  Do not
  // treat the unplayed card as a passive/physical-only observation: deploy it
  // through the public UI, then let the pending OnPlay wizard open from the
  // authoritative pendingOnPlay state.
  if (sourceHandVisible) {
    await assertNamed(sourceHand.locator('.hand-card').first(), record.name, record.imageUrl)
    // Hand actions are mounted only after the physical card is selected;
    // checking inside the wrapper before the click falsely reported every
    // On Play Cookie as undeployable.
    await sourceHand.locator('.hand-card').first().click()
    await page.waitForTimeout(120)
    const deploy = sourceHand.locator('.hand-card-action').filter({ hasText: '登場' }).first()
    if (negative) {
      if (await deploy.count() && await deploy.isEnabled().catch(() => false)) {
        throw new Error(`${record.cardNumber} negative On Play has an enabled deploy action; its condition is not blocked by this fixture`)
      }
      result.actions.push('blocked-onplay-deployment')
      result.negativeEvidence = 'onplay-deployment-blocked'
      return
    }
    if (!await deploy.count() || !await deploy.isEnabled().catch(() => false)) {
      throw new Error(`${record.cardNumber} positive On Play deployment is unavailable`)
    }
    await deploy.click()
    await page.waitForTimeout(240)
  }
  const sourceBattle = battleSource(page, record.cardNumber)
  const source = await sourceBattle.count() && await sourceBattle.isVisible().catch(() => false) ? sourceBattle : sourceHand
  const sourceVisible = await source.count() && await source.isVisible().catch(() => false)
  if (!sourceVisible) {
    if (negative) {
      result.actions.push('negative-skill-source-absent')
      result.negativeEvidence = 'skill-source-absent'
      return
    }
    throw new Error(`${record.cardNumber} positive skill source is not visible`)
  }
  await assertNamed(source, record.name, record.imageUrl)
  const action = source.locator('.skill-action').first()
  if (!await action.count()) {
    // A deployed On Play source has no separate battlefield Activate button;
    // its effect is represented by the pending EffectPanel instead.
    const effect = panel(page)
    if (sourceHandVisible && await effect.count() && await effect.isVisible().catch(() => false)) {
      if (negative) throw new Error(`${record.cardNumber} negative On Play opened an effect panel; no negative settlement was proven`)
      if (!await resolveEffectPanel(page, result)) throw new Error(`${record.cardNumber} On Play effect panel did not resolve`)
      result.effectResolved = true
      result.evidence = 'executed-onplay-effect'
      return
    }
    if (negative && !sourceHandVisible) {
      // An Activate source remains physically visible while its controller is
      // not the active player, but the UI intentionally does not mount an
      // action button at all.  Treat that absence as the timing gate only
      // when the source is present and no skill command was emitted.
      const traceEntries = await trace(page)
      assert.equal(traceEntries.some((entry) => entry.commandKind === 'begin-activate-skill'), false, `${record.cardNumber} out-of-turn negative must not emit a skill command`)
      result.actions.push('blocked-skill-out-of-turn')
      result.negativeEvidence = 'skill-action-hidden-outside-owner-turn'
      return
    }
    if (negative) throw new Error(`${record.cardNumber} negative skill has no explicit disabled action or absent source evidence`)
    throw new Error(`${record.cardNumber} positive skill has no action or pending effect panel`)
  }
  // BS9-101 remains activatable when the inspected top three cards contain no
  // purple Cookie.  Execute that real no-match branch and leave an explicit
  // negative witness instead of incorrectly requiring a disabled Activate
  // button.
  if (negative && baseNumber(record.cardNumber) === 'BS9-101') {
    assert.equal(await action.isEnabled(), true, `${record.cardNumber} no-match inspect branch must remain activatable`)
    await action.click()
    if (!await resolveEffectPanel(page, result)) {
      throw new Error(`${record.cardNumber} negative inspect-deck branch did not resolve`)
    }
    result.effectResolved = true
    result.actions.push('resolve-negative-inspect-deck')
    result.negativeEvidence = 'inspect-deck-no-purple-match'
    return
  }
  if (negative) {
    if (await action.isDisabled()) {
      result.actions.push('blocked-skill')
      result.negativeEvidence = 'skill-action-disabled'
      return
    }
    throw new Error(`${record.cardNumber} negative skill action is enabled; no blocked condition was proven`)
  }
  if (!await action.isEnabled()) {
    throw new Error(`${record.cardNumber} positive skill action is unavailable on the surface`)
  }
  await action.click()
  if (!await resolveEffectPanel(page, result)) {
    throw new Error(`${record.cardNumber} skill declaration did not open a resolvable effect panel`)
  }
  result.effectResolved = true
  result.actions.push('activate-skill')
  result.evidence = 'executed-skill-resolution'
}

const runExtraDeckAttackChoice = async (page, record, negative, result) => {
  const modal = visible(page, '.extra-deck-attack-modal')
  if (!await modal.count() || !await modal.isVisible().catch(() => false)) return false
  await modal.waitFor({ state: 'visible' })
  const options = modal.locator('.extra-deck-attack-option:not(:disabled)')
  if (negative) {
    const skip = modal.getByTestId('extra-deck-attack-skip').first()
    if (await skip.count() && await skip.isVisible().catch(() => false) && await skip.isEnabled()) {
      await skip.click()
      await modal.waitFor({ state: 'hidden' }).catch(() => {})
      result.actions.push('skip-extra-deck-attack-negative')
      result.negativeEvidence = 'explicit-extra-deck-attack-skip'
      return true
    }
    if (!await options.count()) {
      throw new Error(`${record.cardNumber} negative EXTRA attack modal has no optional skip and no selectable candidate`)
    }
    throw new Error(`${record.cardNumber} negative EXTRA attack still exposes a selectable candidate`)
  }
  if (!await options.count()) throw new Error(`${record.cardNumber} positive EXTRA attack modal has no candidate`)
  const candidateRecord = bs9Candidates.cards.find((candidate) => candidate.baseCardNumber === 'BS9-102')
  if (!candidateRecord) throw new Error('BS9-079 EXTRA attack fixture has no BS9-102 candidate record')
  await assertNamed(options.first(), candidateRecord.name, candidateRecord.imageUrl)
  await options.first().click()
  await modal.waitFor({ state: 'hidden' }).catch(() => {})
  // The attack continuation and the selected EXTRA ability are committed by
  // separate React effects.  Let the selected ability panel replace the
  // previous attack panel before resolving its target; otherwise the driver
  // can accidentally re-submit resolve-attack-effect against the stale view.
  await page.waitForFunction(() => {
    const panels = [...document.querySelectorAll('.effect-panel[role="alertdialog"]')]
      .filter((node) => {
        const style = window.getComputedStyle(node)
        return style.display !== 'none' && style.visibility !== 'hidden' && node.getBoundingClientRect().width > 0
      })
    return panels.some((node) =>
      node.querySelector('.effect-candidates-target') ||
      !(node.textContent ?? '').includes('攻擊後續效果'),
    )
  }, undefined, { timeout: 5_000 }).catch(() => {})
  const resolved = await resolveEffectPanel(page, result)
  const settled = resolved && await forceResolveVisibleEffectPanel(page, result)
  if (!settled) throw new Error(`${record.cardNumber} selected EXTRA attack did not settle its public attack effect panel`)
  result.effectResolved = true
  result.actions.push('select-extra-deck-attack')
  result.evidence = 'executed-extra-deck-attack-resolution'
  return true
}

/**
 * Execute a no-Then Cookie through the ordinary public attack flow.  The
 * `card:` fixture starts with the candidate in hand, so this proves the real
 * deployment, printed support payment, attack target, and final damage path;
 * it does not infer success from the absence of an attack-effect panel.
 */
const runPureDamageAttackFromHand = async (page, record, result) => {
  const hand = handCard(page, record.name)
  await hand.waitFor({ state: 'visible' })
  await assertNamed(hand.locator('.hand-card').first(), record.name, record.imageUrl)
  await hand.locator('.hand-card').first().click()
  const deploy = hand.locator('.hand-card-action').filter({ hasText: '登場' }).first()
  if (!await deploy.count() || !await deploy.isEnabled().catch(() => false)) {
    throw new Error(`${record.cardNumber} pure attack fixture must expose an enabled deploy action`)
  }
  await deploy.click()
  await page.waitForTimeout(180)
  result.actions.push('deploy-pure-attack-cookie')

  const source = battleSource(page, record.cardNumber)
  await source.waitFor({ state: 'visible' })
  await assertNamed(source.locator('.card-face').first(), record.name, record.imageUrl)
  const attacker = source.locator('.card-face.is-attackable').first()
  if (!await attacker.count() || !await attacker.isEnabled().catch(() => false)) {
    throw new Error(`${record.cardNumber} pure attack source is not attackable after deployment`)
  }
  await attacker.click()
  result.actions.push('select-pure-attack-source')
  await page.waitForTimeout(100)

  const paymentCount = parseAttackCostCount(record.attackText)
  assert.ok(paymentCount > 0, `${record.cardNumber} pure attack must expose a printed energy cost`)
  for (let index = 0; index < paymentCount; index += 1) {
    const payment = page
      .locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)')
      .last()
    await payment.waitFor({ state: 'visible' })
    const selectedBefore = await page
      .locator('.bottom-field .support-card-wrap .card-face.is-selected')
      .count()
    await payment.focus()
    await payment.press('Enter')
    await page.waitForTimeout(90)
    assert.equal(
      await page.locator('.bottom-field .support-card-wrap .card-face.is-selected').count(),
      selectedBefore + 1,
      `${record.cardNumber} attack payment must select one legal support card at a time`,
    )
  }
  const paymentPanel = page.getByTestId('attack-payment-panel').first()
  await paymentPanel.waitFor({ state: 'visible' })
  assert.match(
    await paymentPanel.innerText(),
    /付款合法/,
    `${record.cardNumber} pure attack payment must be legal before target selection`,
  )
  result.actions.push('pay-pure-attack')

  // Capture the defender immediately before declaration.  A deployment and
  // energy payment already change public state, so the generic
  // `initialState !== finalState` check would not prove that this attack
  // actually dealt damage.  The target-specific witness below keeps the
  // vanilla route honest even though `resolve-battle` has no public steps.
  const beforeResolutionState = await readPublicState(page)
  const target = page.locator('.top-field .combat-card-wrap .card-face[aria-label^="選擇攻擊目標："]').first()
  await target.waitFor({ state: 'visible' })
  const targetName = (await target.getAttribute('aria-label'))?.replace(/^選擇攻擊目標：/, '').trim()
  const targetBefore = beforeResolutionState?.rows?.top?.battle?.find((card) => card.name === targetName)
  assert.ok(targetBefore, `${record.cardNumber} pure attack target must be present before declaration`)
  await target.click()
  result.actions.push('declare-pure-attack')
  await waitForTrace(page, 'declare-attack')

  // The normal test-state controller auto-skips the defender response and
  // settles ordinary damage.  Wait for both a source-associated settlement
  // command and the disappearance of all public decision surfaces; a mere
  // declare-attack trace is intentionally insufficient.
  await page.waitForFunction(() => {
    const traces = window.__braverseContractTrace ?? []
    const settled = traces.some((entry) =>
      entry.commandKind === 'resolve-battle' ||
      entry.commandKind === 'resolve-attack-effect',
    )
    const pendingSelectors = [
      '.effect-panel[role="alertdialog"]',
      '.effect-order-modal',
      '.draw-up-to-modal',
      '.hand-discard-modal',
      '.inspect-deck-modal',
      '.stage-placement-modal',
      '.flip-response-modal',
      '.trap-response-modal',
      '.attack-response-modal',
      '.attack-response-skill-modal',
      '.blocker-response-modal',
      '.optional-cost-attack-modal',
      '.faint-response-modal',
      '.hp-reorder-modal',
      '.card-reveal-modal',
      '.discard-reveal-modal',
      '.extra-deck-attack-modal',
      '.attack-payment-panel',
    ]
    const visible = pendingSelectors.some((selector) => [...document.querySelectorAll(selector)].some((node) => {
      const style = window.getComputedStyle(node)
      return style.display !== 'none' && style.visibility !== 'hidden' && node.getBoundingClientRect().width > 0
    }))
    return settled && !visible
  }, undefined, { timeout: 10_000 }).catch(() => {})

  const finalTrace = await trace(page)
  const settlement = finalTrace.find((entry) =>
    entry.commandKind === 'resolve-battle' || entry.commandKind === 'resolve-attack-effect',
  )
  if (!settlement) {
    throw new Error(`${record.cardNumber} pure attack has no public settlement command after declaration`)
  }
  const afterResolutionState = await readPublicState(page)
  const targetAfter = afterResolutionState?.rows?.top?.battle?.find((card) => card.name === targetName)
  assert.ok(
    !targetAfter || targetAfter.hp !== targetBefore.hp,
    `${record.cardNumber} pure attack settlement must change or remove the selected target HP`,
  )
  result.pureDamageSettlementEvidence = {
    commandKind: settlement.commandKind,
    target: targetName,
    targetBeforeHp: targetBefore.hp,
    targetAfterHp: targetAfter?.hp ?? 'removed',
  }
  result.effectResolved = true
  result.actions.push('resolve-pure-damage-attack')
  result.evidence = 'executed-pure-damage-attack-resolution'
}

const runAttack = async (page, record, negative, result) => {
  if (!negative && isPureDamageAttack(record)) {
    await runPureDamageAttackFromHand(page, record, result)
    return
  }
  const source = battleSource(page, record.cardNumber)
  const sourceVisible = await source.count() && await source.isVisible().catch(() => false)
  if (!sourceVisible) {
    if (negative) {
      result.actions.push('blocked-attack-source-absent')
      result.negativeEvidence = 'attack-source-absent'
      return
    }
    throw new Error(`${record.cardNumber} positive attack source is not visible`)
  }
  await assertNamed(source, record.name, record.imageUrl)
  if (await runExtraDeckAttackChoice(page, record, negative, result)) return
  const effect = optionalAttack(page)
  if (!await effect.count() || !await effect.isVisible().catch(() => false)) {
    if (negative) {
      // `card-attack-negative` deliberately rests the real source Cookie and
      // starts with every support payment unavailable.  Check the public card
      // state as well as the absent panel so a generic no-op cannot pass this
      // lane merely because the driver found nothing to click.
      const sourceClass = await source.getAttribute('class')
      const attackable = source.locator('.card-face.is-attackable')
      assert.equal(await attackable.count(), 0, `${record.cardNumber} blocked attack must not expose an attackable source`)
      assert.ok(sourceClass?.split(/\s+/).includes('is-rested'), `${record.cardNumber} blocked attack must visibly rest the source Cookie`)
      const negativeTrace = await trace(page)
      assert.equal(
        negativeTrace.some((entry) => entry.commandKind === 'declare-attack'),
        false,
        `${record.cardNumber} blocked attack must not emit declare-attack`,
      )
      result.actions.push('blocked-attack-source-rested')
      result.negativeEvidence = 'attack-source-rested-and-unattackable'
      return
    }
    throw new Error(`${record.cardNumber} attack lane has no optional attack-effect response surface`)
  }
  await effect.waitFor({ state: 'visible' })
  if (negative) {
    const skip = effect.getByRole('button', { name: '略過', exact: true }).first()
    if (await skip.count() && await skip.isVisible().catch(() => false)) await skip.click()
    else if (!await clickButton(effect, ['確認', '確認發動'])) {
      throw new Error(`${record.cardNumber} negative attack has no explicit skip/confirm control`)
    }
    await effect.waitFor({ state: 'hidden' }).catch(() => {})
    // BS9-079 first resolves the printed attack-Then wrapper, which can open
    // the separate optional EXTRA candidate modal even on the negative lane.
    // Explicitly skip that public decision as well so the lane proves the
    // complete no-op path instead of leaving an unresolved modal behind.
    if (await runExtraDeckAttackChoice(page, record, true, result)) return
    result.actions.push('blocked-attack-effect')
    result.negativeEvidence = 'explicit-attack-effect-skip'
    return
  }
  const pay = effect.getByRole('button', { name: '支付', exact: true }).first()
  if (await pay.count() && await pay.isEnabled().catch(() => false)) await pay.click()
  if (!await resolveEffectPanel(page, result)) {
    throw new Error(`${record.cardNumber} attack effect did not resolve through the public effect panel`)
  }
  // BS9-079 enters the separate Extra Deck candidate modal only after the
  // ordinary attack-effect panel advances.  Re-check it here as well as
  // before the panel so the continuation cannot be mistaken for a settled
  // attack merely because the first decision was confirmed.
  if (await runExtraDeckAttackChoice(page, record, false, result)) return
  result.effectResolved = true
  result.actions.push('resolve-attack-effect')
  result.evidence = 'executed-attack-effect'
}

const runItem = async (page, record, negative, result) => {
  const wrap = handCard(page, record.name)
  await assertNamed(wrap.locator('.hand-card').first(), record.name, record.imageUrl)
  await wrap.locator('.hand-card').first().click()
  const use = wrap.locator('.hand-card-action').filter({ hasText: '使用' }).first()
  if (negative && (baseNumber(record.cardNumber) === 'BS9-114' || baseNumber(record.cardNumber) === 'BS9-115')) {
    // These Items remain legally playable on the negative route; the branch
    // condition is inside the effect (trash-count threshold), not the entry
    // action.  Execute it and retain an explicit witness for the alternate or
    // skipped Then path instead of demanding a disabled button.
    assert.equal(await use.count() > 0, true, `${record.cardNumber} conditional Item must expose its use action`)
    assert.equal(await use.isEnabled(), true, `${record.cardNumber} conditional Item must remain payable`)
    await use.click()
    if (!await resolveEffectPanel(page, result)) {
      throw new Error(`${record.cardNumber} negative conditional Item did not resolve`)
    }
    result.effectResolved = true
    result.actions.push('use-negative-conditional-item')
    result.negativeEvidence = baseNumber(record.cardNumber) === 'BS9-114'
      ? 'item-trash-threshold-alternate-branch'
      : 'item-opponent-trash-threshold-not-met'
    return
  }
  if (negative) {
    if (!await use.count()) {
      // A card whose printed payment/condition has no legal candidate is
      // rendered without a use control after selection.  Treat the absent
      // action as the UI's explicit blocked evidence, rather than requiring a
      // disabled button that the component intentionally does not mount.
      result.actions.push('blocked-item-action-absent')
      result.negativeEvidence = 'item-action-absent'
    } else if (await use.isDisabled()) {
      result.actions.push('blocked-item')
      result.negativeEvidence = 'item-action-disabled'
    } else {
      throw new Error(`${record.cardNumber} negative item action is not explicitly disabled`)
    }
    return
  }
  if (!await use.count() || !await use.isEnabled()) {
    throw new Error(`${record.cardNumber} positive item action is unavailable`)
  }
  await use.click()
  if (!await resolveEffectPanel(page, result)) {
    throw new Error(`${record.cardNumber} item declaration did not open a resolvable effect panel`)
  }
  result.effectResolved = true
  result.actions.push('use-item')
  result.evidence = 'executed-item-resolution'
}

const runTrap = async (page, record, negative, result) => {
  const modal = trap(page)
  if (!await modal.count()) {
    if (!negative) throw new Error(`${record.cardNumber} positive trap should open a response modal`)
    result.actions.push('blocked-trap-response-absent')
    result.negativeEvidence = 'trap-response-absent'
    return
  }
  await modal.waitFor({ state: 'visible' })
  const card = modal.locator('.modal-card-options button').filter({ hasText: record.name }).first()
  await assertNamed(card, record.name, record.imageUrl)
  if (negative) {
    // Some Trap cards have a conditional alternate branch.  In that case the
    // response card remains selectable even when the positive Cookie-match
    // branch is absent; execute the branch instead of treating availability as
    // a failure.  Truly unavailable cards still provide explicit disabled
    // evidence for the negative lane.
    if (await card.isDisabled()) {
      result.actions.push('trap-negative-disabled-card')
      result.negativeEvidence = 'trap-card-disabled'
      result.allowedFinalSurfaces = ['trap-response']
      return
    }
  }
  assert.equal(await card.isEnabled(), true, `${record.cardNumber} trap card must be selectable on the executed branch`)
  await card.click()
  const payment = modal.locator('.trap-discard-options button:not(:disabled)')
  const body = await modal.innerText()
  const requested = Number(body.match(/選擇\s*(\d+)\s*張支援卡/)?.[1] ?? 0)
  const needed = requested > 0 ? requested : Math.max(1, Math.min(3, await payment.count()))
  assert.ok(await payment.count() >= needed, `${record.cardNumber} trap response must expose its full support payment`)
  for (let index = 0; index < needed; index += 1) await payment.nth(index).click()

  // Trap resolution can ask for a target after payment.  Continue through
  // each public modal step, selecting the first legal target (or the explicit
  // skip when no target is available) until the response surface closes.
  for (let step = 0; step < 5; step += 1) {
    if (!await modal.isVisible().catch(() => false)) break
    const target = modal.locator('.trap-target-options button:not(:disabled):not(.is-selected)').first()
    if (await target.count() && await target.isVisible().catch(() => false)) {
      await target.click()
    } else {
      const skip = modal.locator('.trap-target-skip:not(:disabled)').first()
      if (await skip.count() && await skip.isVisible().catch(() => false)) await skip.click()
    }
    if (!await clickButton(modal, ['下一步', '確認發動', '確認'])) {
      throw new Error(`${record.cardNumber} trap response has no confirmation control`)
    }
    await page.waitForTimeout(160)
  }
  await modal.waitFor({ state: 'hidden' }).catch(() => {})
  for (let step = 0; step < 6; step += 1) {
    const resolvedPanel = await resolveEffectPanel(page, result)
    const knownPending = await resolveKnownPendingModal(page, result)
    if (!resolvedPanel && !knownPending) break
    if (!await modal.isVisible().catch(() => false) &&
      !await panel(page).count() &&
      !await readVisibleFinalSurfaces(page).then((surfaces) => surfaces.some((surface) => surface !== 'trap-response'))) break
  }
  result.effectResolved = true
  result.actions.push('play-trap')
  if (negative) result.negativeEvidence = 'executed-trap-condition-path'
  result.evidence = 'executed-trap-resolution'
}

const runStage = async (page, record, negative, result) => {
  const wrap = handCard(page, record.name)
  await assertNamed(wrap.locator('.hand-card').first(), record.name, record.imageUrl)
  await wrap.locator('.hand-card').first().click()
  const place = wrap.locator('.hand-card-action').filter({ hasText: '放置' }).first()
  if (!await place.count() || !await place.isEnabled().catch(() => false)) {
    if (!negative) throw new Error(`${record.cardNumber} positive stage placement is unavailable`)
    result.actions.push('blocked-stage-placement')
    result.negativeEvidence = 'stage-placement-disabled'
    return
  }
  await place.click()
  const placement = visible(page, '.stage-placement-modal')
  await placement.waitFor({ state: 'visible' })
  const payment = placement.locator('.stage-placement-payment button:not(:disabled), .faint-payment-candidates > button:not(:disabled)')
  if (await payment.count()) await payment.first().click()
  await clickButton(placement, ['支付並放置', '確認'])
  await placement.waitFor({ state: 'hidden' }).catch(() => {})
  result.actions.push('place-stage')
  if (!negative && baseNumber(record.cardNumber) === 'BS9-095') {
    // Spire of Deceit has no quick-action button: its effect is offered when
    // the real Shadow Milk Cookie declares an attack with five or fewer cards
    // in hand.  Complete that ordinary attack path, then activate the public
    // stage-trigger modal and resolve its draw.
    const attacker = page
      .locator('.bottom-field .combat-card-wrap')
      .filter({ has: page.getByTitle('Shadow Milk Cookie', { exact: true }) })
      .locator('.card-face.is-attackable')
      .first()
    await attacker.waitFor({ state: 'visible' })
    await attacker.click()
    const paymentPanel = page.getByTestId('attack-payment-panel').first()
    for (let index = 0; index < 3; index += 1) {
      const payment = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').last()
      if (!await payment.count() || !await payment.isVisible().catch(() => false)) break
      await payment.press('Enter')
      await page.waitForTimeout(100)
      if (await paymentPanel.count() && /付款合法/.test(await paymentPanel.innerText().catch(() => ''))) break
    }
    await paymentPanel.waitFor({ state: 'visible' })
    assert.match(await paymentPanel.innerText(), /付款合法/, `${record.cardNumber} stage trigger attack must pay legally`)
    const target = page.locator('.top-field .combat-card-wrap .card-face[aria-label^="選擇攻擊目標："]').first()
    await target.waitFor({ state: 'visible' })
    await target.click()
    const trigger = page.locator('.faint-response-modal:visible').filter({ hasText: record.name }).first()
    await trigger.waitFor({ state: 'visible' })
    const activate = trigger.getByRole('button', { name: '發動', exact: true }).first()
    await activate.waitFor({ state: 'visible' })
    assert.equal(await activate.isEnabled(), true, `${record.cardNumber} stage trigger must be activatable`)
    await activate.click()
    await trigger.waitFor({ state: 'hidden' }).catch(() => {})
    await resolveKnownPendingModal(page, result)
    // The attack used to open the stage trigger is Shadow Milk Cookie's
    // ordinary attack.  Its own printed attack-after continuation is an
    // independent optional public decision, so settle it explicitly before
    // checking the stage lane's final surface.  Skipping this optional
    // continuation is a truthful choice for the fixture (the stage trigger
    // has already resolved and no EXTRA candidate is required here).
    const attackFollowup = panel(page)
    // Stage-trigger resolution and the attack-after continuation are queued
    // by separate React commits; wait briefly for the latter to mount before
    // deciding that no follow-up exists.
    await attackFollowup.waitFor({ state: 'visible', timeout: 4_000 }).catch(() => {})
    if (await attackFollowup.count() && await attackFollowup.isVisible().catch(() => false)) {
      const skip = attackFollowup.locator('button.skip-effect:not(:disabled), button:has-text("略過"):not(:disabled)').first()
      if (await skip.count() && await skip.isVisible().catch(() => false) && await skip.isEnabled()) {
        await skip.click()
        await attackFollowup.waitFor({ state: 'hidden' }).catch(() => {})
        result.actions.push('skip-shadow-milk-attack-followup')
      } else if (!await resolveEffectPanel(page, result)) {
        throw new Error(`${record.cardNumber} stage trigger left an unresolved attack follow-up panel`)
      }
    }
    await runExtraDeckAttackChoice(page, record, true, result)
    await page.waitForTimeout(500)
    result.effectResolved = true
    result.actions.push('activate-stage-trigger')
    result.evidence = 'executed-stage-attack-trigger'
    return
  }
  const quick = visible(page, '.stage-quick-action')
  const quickVisible = await quick.count() && await quick.isVisible().catch(() => false)
  const quickEnabled = quickVisible && await quick.isEnabled().catch(() => false)
  if (negative) {
    if (quickEnabled) throw new Error(`${record.cardNumber} negative stage still exposes an enabled trigger action`)
    result.actions.push('blocked-stage-trigger')
    result.negativeEvidence = 'stage-trigger-disabled'
    return
  }
  if (!quickEnabled) throw new Error(`${record.cardNumber} positive stage has no enabled trigger action to settle`)
  await quick.click()
  if (!await resolveEffectPanel(page, result)) {
    throw new Error(`${record.cardNumber} stage trigger did not open a resolvable effect panel`)
  }
  result.effectResolved = true
  result.actions.push('activate-stage')
  result.evidence = 'executed-stage-resolution'
}

const runExtra = async (page, record, negative, result) => {
  const summary = page.locator('.bottom-field button.resource-summary').filter({ hasText: 'EXTRA' }).first()
  if (await summary.count() && await summary.isVisible().catch(() => false)) await summary.click()
  const extra = visible(page, '.extra-deck-card-image')
  await extra.waitFor({ state: 'visible' })
  await assertNamed(extra, record.name, record.imageUrl)
  const play = page.getByRole('button', { name: '從 EXTRA 登場', exact: true }).first()
  if (negative) {
    if (await play.count()) {
      assert.equal(await play.isEnabled(), false, `${record.cardNumber} negative EXTRA must be blocked`)
      result.negativeEvidence = 'extra-entry-disabled'
    } else {
      result.negativeEvidence = 'extra-entry-control-absent'
    }
    result.actions.push('blocked-extra-entry')
    return
  }
  if (!await play.count() || !await play.isEnabled()) {
    throw new Error(`${record.cardNumber} positive EXTRA entry action is unavailable`)
  }
  await play.click()
  await waitForTrace(page, 'play-extra-deck-cookie')
  let resolvedEffect = await resolveEffectPanel(page, result)
  const sourceById = battleSource(page, record.cardNumber)
  const source = await sourceById.count()
    ? sourceById
    : page.locator('.bottom-field .combat-card-wrap').filter({ has: page.getByTitle(record.name, { exact: true }) }).last()
  const skill = source.locator('.skill-action').first()
  if (await skill.count() && await skill.isVisible().catch(() => false) && await skill.isEnabled().catch(() => false)) {
    await skill.click()
    resolvedEffect = await resolveEffectPanel(page, result) || resolvedEffect
  }
  if (!resolvedEffect) throw new Error(`${record.cardNumber} EXTRA entry had no resolvable effect`)
  result.effectResolved = true
  result.actions.push('play-extra')
  result.evidence = 'executed-extra-resolution'
}

const collectImageEvidence = async (page, record, requestedImages, browserErrorState) => {
  const matches = await page.evaluate((expectedUrl) => [...document.images]
    .filter((node) => {
      const source = node.getAttribute('src') ?? node.currentSrc ?? node.src
      return source === expectedUrl || node.currentSrc === expectedUrl || node.src === expectedUrl
    })
    .map((node) => ({
      src: node.getAttribute('src'),
      currentSrc: node.currentSrc,
      complete: node.complete,
      naturalWidth: node.naturalWidth,
      naturalHeight: node.naturalHeight,
    })), record.imageUrl)
  const seenLoaded = await page.evaluate((expectedUrl) =>
    (window.__bs9SeenOfficialImages ?? []).includes(expectedUrl), record.imageUrl)
  const exactImageRequested = requestedImages.has(record.imageUrl)
  const exactImageRendered = matches.length > 0 || seenLoaded
  const exactImageLoaded = matches.some((match) => match.complete && match.naturalWidth > 0) || seenLoaded
  const exactImageFailure = browserErrorState.imageFailures.some((failure) => failure.startsWith(`${record.imageUrl} `)) ||
    browserErrorState.imageResponses.some((response) => response.url === record.imageUrl && !response.ok)
  return {
    expectedImageUrl: record.imageUrl,
    exactImageRequested,
    exactImageRendered,
    exactImageLoaded,
    exactImageSeenLoaded: seenLoaded,
    exactImageFailure,
    exactImageMatches: matches,
  }
}
const classifyImageGate = (result) => result.exactImageFailure
  ? 'request-failed'
  : result.exactImageRendered && !result.exactImageLoaded
    ? 'rendered-but-not-loaded'
    : result.exactImageRendered
      ? 'loaded'
      : 'negative-source-not-rendered'

const runCase = async (browser, testCase) => {
  const page = await browser.newPage({ viewport: testCase.viewport })
  page.setDefaultTimeout(10_000)
  const requestedImages = new Set()
  page.on('request', (request) => {
    if (request.resourceType() === 'image') requestedImages.add(request.url())
  })
  const browserErrorState = browserErrors(page)
  const result = { ...testCase, status: 'FAIL', actions: [], allowedFinalSurfaces: [] }
  try {
    await openRoute(page, testCase.route, testCase.cardNumber)
    const record = recordBy(testCase.cardNumber)
    result.routeIdentity = {
      testState: new URL(page.url()).searchParams.get('test-state'),
      contractCard: new URL(page.url()).searchParams.get('contract-card'),
      variant: record.cardNumber,
      baseCard: baseNumber(record.cardNumber),
    }
    result.initialState = await readPublicState(page)
    result.initialPendingSurfaces = await readVisibleFinalSurfaces(page)
    if (testCase.kind === 'flip') await runFlip(page, record, testCase.negative, result)
    else if (testCase.kind === 'passive') await runPassive(page, record, testCase.negative, result)
    else if (testCase.kind === 'skill') await runSkill(page, record, testCase.negative, result)
    else if (testCase.kind === 'attack') await runAttack(page, record, testCase.negative, result)
    else if (testCase.kind === 'item') await runItem(page, record, testCase.negative, result)
    else if (testCase.kind === 'trap') await runTrap(page, record, testCase.negative, result)
    else if (testCase.kind === 'stage') await runStage(page, record, testCase.negative, result)
    else if (testCase.kind === 'extra') await runExtra(page, record, testCase.negative, result)
    else throw new Error(`Unhandled Browser kind ${testCase.kind}`)
    await page.waitForTimeout(250)
    result.finalState = await readPublicState(page)
    result.publicStateChanged = JSON.stringify(result.initialState) !== JSON.stringify(result.finalState)
    result.finalPendingSurfaces = await readVisibleFinalSurfaces(page)
    const allowedFinalSurfaces = new Set(result.allowedFinalSurfaces)
    result.unexpectedFinalSurfaces = result.finalPendingSurfaces.filter((surface) => !allowedFinalSurfaces.has(surface))
    assert.deepEqual(result.unexpectedFinalSurfaces, [], `${record.cardNumber} must leave no unresolved public decision surface`)
    result.trace = await trace(page)
    result.traceHasExecutedEffectEvidence = hasExecutedTraceEvidence(result.trace) ||
      result.pureDamageSettlementEvidence?.targetAfterHp !== result.pureDamageSettlementEvidence?.targetBeforeHp
    result.traceCommandKinds = [...new Set(result.trace.map((entry) => entry.commandKind))]
    const imageEvidence = await collectImageEvidence(page, record, requestedImages, browserErrorState)
    Object.assign(result, imageEvidence)
    result.imageGate = classifyImageGate(result)
    result.browserErrors = browserErrorState.errors
    result.imageFailures = browserErrorState.imageFailures
    result.imageResponses = browserErrorState.imageResponses
    const namedCardVisible = await page.locator('img').evaluateAll((nodes, name) =>
      nodes.some((node) => node.getAttribute('alt') === name), record.name)
    // A few negative passive lanes intentionally remove the source card to
    // prove the condition is absent. In that lane there is no rendered face
    // from which a request could be made; the positive lane remains the exact
    // image gate for the physical record.  A fallback card never satisfies
    // this exception because the name check above only considers <img alt>.
    if (imageEvidence.exactImageFailure) {
      throw new Error(`${record.cardNumber} exact official image request failed`)
    }
    if (!imageEvidence.exactImageRendered && !(testCase.negative && !namedCardVisible)) {
      throw new Error(`${record.cardNumber} must render its exact official image URL`)
    }
    if (imageEvidence.exactImageRendered && !imageEvidence.exactImageLoaded) {
      throw new Error(`${record.cardNumber} exact official image is present but not successfully loaded`)
    }
    if (!imageEvidence.exactImageRendered) result.imageCheckSkipped = 'negative-source-not-rendered'
    assert.deepEqual(browserErrorState.errors, [], `${testCase.cardNumber} Browser errors: ${browserErrorState.errors.join('; ')}`)
    if (testCase.negative) {
      if (!result.negativeEvidence) throw new Error(`${record.cardNumber} negative lane lacks explicit blocked/declined evidence`)
    } else {
      const activeKind = ['flip', 'skill', 'attack', 'item', 'trap', 'stage', 'extra'].includes(testCase.kind)
      if (activeKind && !result.traceHasExecutedEffectEvidence && !(result.effectResolved && result.publicStateChanged)) {
        throw new Error(`${record.cardNumber} positive lane lacks substantive runtime settlement evidence`)
      }
    }
    result.status = 'PASS'
  } catch (error) {
    result.error = error instanceof Error ? error.stack ?? error.message : String(error)
    result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 10_000)
    result.trace = await trace(page).catch(() => [])
    result.traceHasExecutedEffectEvidence = hasExecutedTraceEvidence(result.trace) ||
      result.pureDamageSettlementEvidence?.targetAfterHp !== result.pureDamageSettlementEvidence?.targetBeforeHp
    result.traceCommandKinds = [...new Set(result.trace.map((entry) => entry.commandKind))]
    result.visibleEffectControls = await page.locator('.effect-panel[role="alertdialog"] button:visible').evaluateAll((buttons) => buttons.map((button) => ({
      text: button.textContent?.trim() ?? '',
      disabled: button.disabled,
      className: button.className,
    }))).catch(() => [])
    result.visibleEffectStatus = await page.locator('.effect-panel[role="alertdialog"] [role="status"]:visible').allTextContents().catch(() => [])
    if (result.initialState) {
      result.finalState = await readPublicState(page).catch(() => null)
      result.publicStateChanged = JSON.stringify(result.initialState) !== JSON.stringify(result.finalState)
      result.finalPendingSurfaces = await readVisibleFinalSurfaces(page).catch(() => [])
      result.unexpectedFinalSurfaces = result.finalPendingSurfaces.filter((surface) => !result.allowedFinalSurfaces.includes(surface))
    }
    const record = recordBy(testCase.cardNumber)
    Object.assign(result, await collectImageEvidence(page, record, requestedImages, browserErrorState).catch(() => ({})))
    result.imageGate = classifyImageGate(result)
    result.browserErrors = browserErrorState.errors
    result.imageFailures = browserErrorState.imageFailures
    result.imageResponses = browserErrorState.imageResponses
    result.failureClass = result.exactImageFailure || (result.exactImageRendered && !result.exactImageLoaded)
      ? `image-gate:${result.imageGate}`
      : result.unexpectedFinalSurfaces?.length
        ? 'unresolved-public-pending'
        : result.browserErrors.length > 0
          ? 'browser-error'
          : 'runtime-or-assertion'
  } finally {
    const slug = `${testCase.cardNumber}-${testCase.kind}-${testCase.negative ? 'negative' : 'positive'}-${testCase.viewport.width}x${testCase.viewport.height}`
    result.screenshot = resolve(outputDirectory, `bs9-${slug}${result.status === 'PASS' ? '' : '-failed'}.png`)
    await page.screenshot({ path: result.screenshot, fullPage: true }).catch(() => {})
    await page.close()
  }
  console.log(`${result.status} ${testCase.cardNumber} ${testCase.kind} ${testCase.negative ? 'negative' : 'positive'} ${testCase.viewport.width}x${testCase.viewport.height}`, result.error?.split('\n')[0] ?? '')
  return result
}

const records = bs9Candidates.cards.filter((candidate) => {
  const number = Number(candidate.baseCardNumber.split('-')[1])
  return number >= 71 && number <= 118
})

// Fixture-independent contract guard for the original false-negative class:
// exactly these physical records have a plain printed attack with no Then,
// Skill, or FLIP branch.  If the source data changes, the Browser lane must be
// reviewed rather than silently treating a new effect as a vanilla attack.
const expectedPureDamageAttackCards = [
  'BS9-072',
  'BS9-073',
  'BS9-074',
  'BS9-079@3',
  'BS9-103',
  'BS9-105',
  'BS9-109',
]
assert.deepEqual(
  records.filter(isPureDamageAttack).map((record) => record.cardNumber).sort(),
  expectedPureDamageAttackCards,
  'BS9 pure-damage attack classification changed; update the Browser witness explicitly',
)
assert.equal(isPureDamageAttack(recordBy('BS9-075')), false, 'Then attack must not use the vanilla witness')
assert.equal(isPureDamageAttack(recordBy('BS9-079')), false, 'EXTRA attack Then must not use the vanilla witness')

const primaryKind = (record) => {
  if (record.type === 'flip') return 'flip'
  if (record.type === 'extra') return 'extra'
  if (record.type === 'item') return 'item'
  if (record.type === 'trap') return 'trap'
  if (record.type === 'stage') return 'stage'
  const hasSkill = Boolean(record.skill?.text?.trim())
  if (hasSkill && record.skill?.text?.startsWith('If ')) return 'passive'
  if (hasSkill) return 'skill'
  return 'attack'
}
const routeFor = (kind, cardNumber, negative) => {
  if (kind === 'skill' || kind === 'passive') return `card-skill${negative ? '-negative' : ''}:${cardNumber}`
  if (kind === 'attack') return `card-attack${negative ? '-negative' : ''}:${cardNumber}`
  return `card${negative ? '-negative' : ''}:${cardNumber}`
}
const attackRouteFor = (record, negative) =>
  !negative && isPureDamageAttack(record)
    ? `card:${record.cardNumber}`
    : routeFor('attack', record.cardNumber, negative)
const attackLane = records.filter((record) =>
  record.type === 'cookie' && /Then,/i.test(record.attackText ?? ''),
)
const viewports = [{ width: 1907, height: 863 }, { width: 1164, height: 777 }]
const cases = viewports.flatMap((viewport) => records.flatMap((record) => {
  const kind = primaryKind(record)
  const primary = [
    { kind, cardNumber: record.cardNumber, route: kind === 'attack' ? attackRouteFor(record, false) : routeFor(kind, record.cardNumber, false), negative: false, viewport },
    { kind, cardNumber: record.cardNumber, route: routeFor(kind, record.cardNumber, true), negative: true, viewport },
  ]
  // A vanilla Cookie whose primary lane is already `attack` must not be
  // duplicated by the detached attack-Then lane.  The extra lane is only for
  // a skill/On Play primary record whose printed attack continuation needs a
  // separate post-payment fixture.
  if (kind === 'attack' || !attackLane.some((candidate) => candidate.cardNumber === record.cardNumber)) return primary
  return primary.concat([
    { kind: 'attack', cardNumber: record.cardNumber, route: routeFor('attack', record.cardNumber, false), negative: false, viewport },
    { kind: 'attack', cardNumber: record.cardNumber, route: routeFor('attack', record.cardNumber, true), negative: true, viewport },
  ])
}))
const selectedCases = process.env.BS9_071_118_CASE
  ? cases.filter((testCase) => `${testCase.cardNumber}:${testCase.kind}:${testCase.negative ? 'negative' : 'positive'}` === process.env.BS9_071_118_CASE.trim())
  : cases

const preview = spawn(process.execPath, [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)], { cwd: root, stdio: 'ignore' })
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
  browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) })
  for (const testCase of selectedCases) results.push(await runCase(browser, testCase))
} finally {
  await browser?.close()
  if (preview.exitCode === null) preview.kill()
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  scope: 'BS9-071..118 candidate-isolated physical-card Browser A/B across 1907x863 and 1164x777; exact variant route, loaded official image, explicit positive/negative evidence, and public final-state gate; not promotion, full-match, or online proof.',
  candidateRecords: records.length,
  total: results.length,
  passed: results.filter((result) => result.status === 'PASS').length,
  failed: results.filter((result) => result.status !== 'PASS'),
  commandTraces: results.filter((result) => result.status === 'PASS' && result.trace?.length).length,
  substantiveTraceLanes: results.filter((result) => result.status === 'PASS' && result.traceHasExecutedEffectEvidence).length,
  imageLoadedLanes: results.filter((result) => result.status === 'PASS' && result.exactImageLoaded).length,
  negativeEvidenceLanes: results.filter((result) => result.status === 'PASS' && result.negativeEvidence).length,
  results,
}
writeFileSync(resolve(outputDirectory, 'bs9-071-118-browser.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({
  candidateRecords: report.candidateRecords,
  total: report.total,
  passed: report.passed,
  commandTraces: report.commandTraces,
  substantiveTraceLanes: report.substantiveTraceLanes,
  imageLoadedLanes: report.imageLoadedLanes,
  negativeEvidenceLanes: report.negativeEvidenceLanes,
  failed: report.failed.map((result) => ({
    cardNumber: result.cardNumber,
    kind: result.kind,
    negative: result.negative,
    viewport: result.viewport,
    failureClass: result.failureClass,
    imageGate: result.imageGate,
    error: result.error?.split('\n')[0],
  })),
}, null, 2))
process.exitCode = report.failed.length > 0 ? 1 : 0
