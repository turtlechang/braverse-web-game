import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const candidatePath = resolve(root, 'data/candidates/st6-st10/official-st10.en.json')
const formalPath = resolve(root, 'data/cards/official-st10-009.en.json')
const candidateDocument = existsSync(candidatePath) ? JSON.parse(readFileSync(candidatePath, 'utf8')) : undefined
const formalDocument = existsSync(formalPath) ? JSON.parse(readFileSync(formalPath, 'utf8')) : undefined
const card = formalDocument?.cards.find(record => record.cardNumber === 'ST10-009') ??
  candidateDocument?.cards.find(record => record.cardNumber === 'ST10-009')
assert.ok(card?.imageUrl, 'original printed ST10-009 record is required')
assert.equal(card.skill.text,
  'When this Cookie is placed from your battle area into your trash, draw up to 1 card from your deck.')

const loadArt = cardNumber => {
  const path = resolve(root, `output/st6-st10/images/${cardNumber}.webp`)
  assert.ok(existsSync(path), `original printed ${cardNumber} art is required`)
  const data = readFileSync(path)
  assert.equal(data.toString('ascii', 0, 4), 'RIFF')
  assert.equal(data.toString('ascii', 8, 12), 'WEBP')
  return { data, dimensions: { width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1 } }
}
const doughnutArt = loadArt('ST10-009')
const dreamcatcherArt = loadArt('ST10-005')
const faintAttacker = (() => {
  const formal = resolve(root, 'data/cards/official-st10-005.en.json')
  const document = existsSync(formal) ? JSON.parse(readFileSync(formal, 'utf8')) : undefined
  const candidate = candidateDocument?.cards.find(record => record.cardNumber === 'ST10-005')
  const record = document?.cards.find(item => item.cardNumber === 'ST10-005') ?? candidate
  assert.ok(record?.imageUrl, 'original ST10-005 print is required for the faint control')
  return record
})()

const require = createRequire(import.meta.url)
const playwrightEntry = require.resolve('playwright', {
  paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root],
})
const playwright = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwright.chromium ?? playwright.default?.chromium
if (!chromium) throw new Error('Playwright Chromium is unavailable')

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4198)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}`
const output = resolve(root, 'output/st6-st10/st10-009-browser')
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')
const distIndex = resolve(root, 'dist/index.html')
const browserExecutable = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
if (!process.env.BRAVERSE_BASE_URL) {
  if (!existsSync(distIndex)) throw new Error('dist/index.html is missing; build must finish before Browser validation')
  const buildTime = statSync(distIndex).mtimeMs
  const inputs = [
    'src/game/demo.ts', 'src/game/st10-009-demo.ts', 'src/game/commands.ts',
    'src/game/effects/execute.ts', 'src/game/skills.ts', 'src/game/generated-card-pool.ts',
    'src/hooks/useMatchController.ts', 'src/components/battle/PendingDecisionModals.tsx',
    'src/components/effects/EffectPanel.tsx',
  ].map(path => resolve(root, path)).filter(existsSync)
  const stale = inputs.filter(path => statSync(path).mtimeMs > buildTime)
  if (stale.length) throw new Error(`dist/index.html is older than ST10-009 sources; build required: ${stale.join(', ')}`)
}

mkdirSync(output, { recursive: true })
let server
const wait = milliseconds => new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds))
const visible = async locator => await locator.count() > 0 && await locator.first().isVisible().catch(() => false)
const clickReady = async (locator, label) => {
  await locator.waitFor({ state: 'visible' })
  assert.equal(await locator.isEnabled(), true, `${label} must be enabled`)
  await locator.click()
}
const settleAnimation = async page => {
  for (let step = 0; step < 18; step += 1) {
    const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
    if (await visible(skip)) await skip.click({ timeout: 1000 }).catch(() => {})
    await page.waitForTimeout(80)
  }
}
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({
  id: entry.id,
  groupId: entry.groupId,
  commandKind: entry.commandKind,
  summary: entry.summary,
  steps: entry.steps,
})))
const state = page => page.evaluate(() => {
  const side = playerId => {
    const field = document.querySelector(`.battle-row[data-animation-player="${playerId}"]`)
    const number = selector => Number(field?.querySelector(selector)?.textContent?.match(/\d+/)?.[0] ?? 0)
    const card = node => ({
      id: node.getAttribute('data-card-instance-id'),
      name: node.querySelector('.card-face')?.getAttribute('title') ?? node.querySelector('img')?.getAttribute('alt') ?? '',
      rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
      hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
    })
    return {
      hand: [...(field?.querySelectorAll('.hand-card-wrap') ?? [])].map(card),
      deck: number('.deck-zone .resource-summary > strong'),
      trash: number('.discard-zone.resource-summary > strong'),
      break: number('.break-zone .zone-heading b'),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(card),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(card),
    }
  }
  return { players: { one: side('player-one'), two: side('player-two') } }
})
const waitForCommand = (page, kind) => page.waitForFunction(
  expected => (window.__braverseContractTrace ?? []).some(entry => entry.commandKind === expected),
  kind,
  { timeout: 20000 },
)
const waitForObservedState = async (page, predicate, label) => {
  let latest
  for (let attempt = 0; attempt < 140; attempt += 1) {
    latest = await state(page)
    if (predicate(latest)) return latest
    await page.waitForTimeout(120)
  }
  throw new Error(`${label}; latest visible state: ${JSON.stringify(latest)}`)
}
const advanceToFinalAction = async panel => {
  for (let step = 0; step < 8; step += 1) {
    const primary = panel.locator('.effect-panel-primary-action:visible').last()
    await primary.waitFor({ state: 'visible' })
    const label = (await primary.innerText()).trim()
    if (!label.includes('下一步')) return primary
    await clickReady(primary, `advance effect panel: ${label}`)
  }
  throw new Error('ST10-009 parent effect panel did not reach its final action')
}

const cases = [
  { id: 'owner-turn-trash-draw-zero', testState: 'card:ST10-009', flow: 'field-trash', actor: 'player-one', draw: 0 },
  { id: 'owner-turn-trash-draw-one', testState: 'card:ST10-009', flow: 'field-trash', actor: 'player-one', draw: 1 },
  { id: 'opponent-turn-trash-draw-one', testState: 'card-negative:ST10-009', flow: 'field-trash', actor: 'player-two', draw: 1 },
  { id: 'both-players-trash-sequential-draws', testState: 'st10-009-both-departure', flow: 'both-field-trash', actor: 'player-one', draw: 0, opponentDraw: 1 },
  { id: 'both-players-last-card-refresh-and-replacement', testState: 'st10-009-both-departure-refresh', flow: 'both-field-trash-refresh', actor: 'player-one', draw: 0, opponentDraw: 1 },
  { id: 'item-cost-draw-zero', testState: 'st10-009-cost', flow: 'item-cost', actor: 'player-one', draw: 0 },
  { id: 'item-cost-draw-one', testState: 'st10-009-cost', flow: 'item-cost', actor: 'player-one', draw: 1 },
  { id: 'attack-faint-no-draw', testState: 'st10-009-faint', flow: 'faint', actor: 'player-two' },
]
const viewports = [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]
const requestedCase = process.env.ST10_009_BROWSER_SCENARIO
const requestedWidth = Number(process.env.ST10_009_BROWSER_VIEWPORT_WIDTH ?? 0)
const activeCases = requestedCase ? cases.filter(item => item.id === requestedCase) : cases
const activeViewports = requestedWidth ? viewports.filter(item => item.width === requestedWidth) : viewports
if (!activeCases.length) throw new Error(`Unknown ST10_009_BROWSER_SCENARIO: ${requestedCase}`)
if (!activeViewports.length) throw new Error(`Unknown ST10_009_BROWSER_VIEWPORT_WIDTH: ${requestedWidth}`)

const chooseDraw = async (page, drawCount, evidence) => {
  const modal = page.locator('.draw-up-to-modal:visible').last()
  await modal.waitFor({ state: 'visible' })
  evidence.drawPanel = await modal.innerText()
  assert.match(evidence.drawPanel, /Space Doughnut/)
  assert.match(evidence.drawPanel, /最多.*1 張|最多可抽 1 張/)
  const image = modal.locator('.draw-up-to-source-card img').first()
  evidence.triggerArt = await image.evaluate(node => ({
    src: node.getAttribute('src'), alt: node.getAttribute('alt'),
    loaded: node.complete && node.naturalWidth > 0,
  }))
  assert.equal(evidence.triggerArt.src, card.imageUrl)
  assert.equal(evidence.triggerArt.alt, 'Space Doughnut')
  assert.equal(evidence.triggerArt.loaded, true)
  await clickReady(modal.locator('.draw-up-to-option').nth(drawCount), `choose draw ${drawCount}`)
  evidence.drawChoice = await modal.innerText()
  await clickReady(modal.locator('.draw-up-to-actions button').last(), `confirm draw ${drawCount}`)
  await modal.waitFor({ state: 'hidden' })
  await waitForCommand(page, 'resolve-draw-up-to')
}

const runFieldTrash = async (page, testCase, evidence) => {
  const beforeOwner = evidence.before.players.one
  const actorKey = testCase.actor === 'player-one' ? 'one' : 'two'
  const target = beforeOwner.battle.find(item => item.name === 'Space Doughnut')
  assert.ok(target?.id, 'the physical Space Doughnut must begin in its owner battle area')
  assert.equal(target.hp, 1, 'Space Doughnut must begin with its printed 1 HP')

  const source = page.locator('.bottom-field .hand-card-wrap').filter({
    has: page.locator('.card-face[title*="Poison Mushroom"]'),
  }).first()
  await source.waitFor({ state: 'visible' })
  const sourceId = await source.getAttribute('data-card-instance-id')
  assert.ok(sourceId)
  await clickReady(source.locator('.card-face').first(), 'select original Poison Mushroom Cookie')
  await clickReady(source.locator('.hand-card-action').filter({ hasText: '登場' }).first(), 'deploy Poison Mushroom')
  await waitForObservedState(page, current => current.players[actorKey].battle.some(item => item.name.includes('Poison Mushroom')),
    'the original Poison Mushroom did not enter the active player battle area')
  await settleAnimation(page)

  let panel = page.locator('.effect-panel[role="alertdialog"]:visible').filter({ hasText: 'Poison Mushroom Cookie' }).last()
  await panel.waitFor({ state: 'visible' })
  evidence.activationPanel = await panel.innerText()
  assert.match(evidence.activationPanel, /Poison Mushroom/)
  assert.match(evidence.activationPanel, /P|紫/)
  const payment = panel.locator('.effect-candidates-payment button:not(.is-selected)').first()
  await clickReady(payment, 'pay the printed purple energy for Poison Mushroom')
  panel = page.locator('.effect-panel[role="alertdialog"]:visible').filter({ hasText: 'Poison Mushroom Cookie' }).last()
  await panel.locator('.effect-candidates-payment button.is-selected').waitFor({ state: 'visible' })
  assert.match(await panel.innerText(), /已選\s*1／\s*1 張能量支援卡/)
  const resolve = await advanceToFinalAction(panel)
  evidence.fieldEffectPanel = await panel.innerText()
  assert.match(evidence.fieldEffectPanel, /LV\.2|LV.2|2 以下/)
  await clickReady(resolve, 'pay P and resolve Poison Mushroom across both battle areas')

  evidence.afterTrash = await waitForObservedState(page, current =>
    !current.players.one.battle.some(item => item.id === target.id) &&
    current.players.one.trash === beforeOwner.trash + 2 &&
    (!testCase.flow.startsWith('both-field-trash') || (
      !current.players.two.battle.some(item => item.name === 'Space Doughnut') &&
      current.players.two.trash === evidence.before.players.two.trash + 2
    )),
  'the actual field-to-trash effect did not move each Space Doughnut and printed HP card to its owner trash')
  await settleAnimation(page)
  if (testCase.actor === 'player-two') {
    await page.waitForFunction(() => document.querySelector('.bottom-field')?.getAttribute('data-animation-player') === 'player-one')
  }
  assert.ok(await visible(page.locator('.draw-up-to-modal:visible')),
    'the passive owner must receive the draw decision even when the opposing player caused the trash event')
  evidence.afterViewer = await page.locator('.bottom-field').getAttribute('data-animation-player')
  assert.equal(evidence.afterViewer, 'player-one')

  const expectedHand = beforeOwner.hand.length - (testCase.actor === 'player-one' ? 1 : 0) + testCase.draw
  const expectedDeck = beforeOwner.deck - (testCase.actor === 'player-one' ? 5 : 0) - testCase.draw
  await chooseDraw(page, testCase.draw, evidence)
  evidence.afterOwnerDraw = await waitForObservedState(page, current =>
    current.players.one.hand.length === expectedHand &&
    current.players.one.deck === expectedDeck &&
    current.players.one.trash === beforeOwner.trash + 2 &&
    current.players[actorKey].battle.some(item => item.id === sourceId),
  'the owner draw choice did not settle hand, deck, and trash zones')

  if (testCase.flow.startsWith('both-field-trash')) {
    await page.waitForFunction(() => document.querySelector('.bottom-field')?.getAttribute('data-animation-player') === 'player-two')
    evidence.afterViewer = await page.locator('.bottom-field').getAttribute('data-animation-player')
    const opponentPanel = page.locator('.effect-panel[role="alertdialog"]:visible').filter({ hasText: 'Space Doughnut' }).last()
    await opponentPanel.waitFor({ state: 'visible' })
    evidence.opponentTriggerPanel = await opponentPanel.innerText()
    assert.match(evidence.opponentTriggerPanel, /Space Doughnut/)
    const opponentResolve = await advanceToFinalAction(opponentPanel)
    await clickReady(opponentResolve, 'resolve the queued opposing Space Doughnut departure effect')
    await page.locator('.draw-up-to-modal:visible').last().waitFor({ state: 'visible' })
    await chooseDraw(page, testCase.opponentDraw, evidence.opponentDrawChoice = {})
    const beforeOpponent = evidence.before.players.two
    if (testCase.flow === 'both-field-trash-refresh') {
      const refreshPanel = page.locator('.decision-modal[role="alertdialog"]:visible').filter({ hasText: '牌庫 Refresh' }).last()
      await refreshPanel.waitFor({ state: 'visible' })
      evidence.refreshPanel = await refreshPanel.innerText()
      assert.match(evidence.refreshPanel, /必須選擇一張餅乾放入休息區/)
      assert.equal(await page.locator('.bottom-field').getAttribute('data-animation-player'), 'player-two')
      await clickReady(refreshPanel.locator('.decision-card-options button').first(), 'choose an original Cookie for the opponent Refresh')
      evidence.afterRefresh = await waitForObservedState(page, current =>
        current.players.two.deck > 0 && current.players.two.hand.length === beforeOpponent.hand.length + testCase.opponentDraw,
      'the second owner Refresh did not rebuild its deck after drawing the last card')
    }
    evidence.after = await waitForObservedState(page, current =>
      current.players.one.hand.length === expectedHand &&
      current.players.one.deck === expectedDeck &&
      current.players.one.trash === beforeOwner.trash + 2 &&
      current.players.two.hand.length === beforeOpponent.hand.length + testCase.opponentDraw &&
      (testCase.flow === 'both-field-trash-refresh'
        ? current.players.two.deck > 0
        : current.players.two.deck === beforeOpponent.deck - testCase.opponentDraw) &&
      (testCase.flow === 'both-field-trash-refresh'
        ? current.players.two.trash < beforeOpponent.trash + 2
        : current.players.two.trash === beforeOpponent.trash + 2),
    'the second owner draw did not settle independently across both players')
    const replacementPanel = page.locator('.decision-modal[role="alertdialog"]:visible').last()
    await replacementPanel.waitFor({ state: 'visible' })
    evidence.firstReplacementPanel = await replacementPanel.innerText()
    const skipReplacement = replacementPanel.locator('.decision-modal-actions button').filter({ hasText: '不補餅乾' })
    if (await visible(skipReplacement)) {
      await clickReady(skipReplacement, 'skip the first player optional replacement')
      await settleAnimation(page)
    }
    await page.waitForFunction(() => document.querySelector('.bottom-field')?.getAttribute('data-animation-player') === 'player-two')
    const opponentReplacement = page.locator('.decision-modal[role="alertdialog"]:visible').last()
    await opponentReplacement.waitFor({ state: 'visible' })
    evidence.opponentReplacementPanel = await opponentReplacement.innerText()
    assert.match(evidence.opponentReplacementPanel, /放置餅乾|player-two|玩家二/i)
    const replacementChoice = opponentReplacement.locator('.decision-card-options button').first()
    await clickReady(replacementChoice, 'fill the opponent battle area with its real Cookie')
    evidence.afterReplacement = await waitForObservedState(page, current =>
      current.players.two.battle.length > 0,
    'the second player replacement was not settled')
  } else {
    evidence.after = evidence.afterOwnerDraw
    if (testCase.actor === 'player-two') {
      await page.waitForFunction(() => document.querySelector('.bottom-field')?.getAttribute('data-animation-player') === 'player-one')
      evidence.replacementViewer = await page.locator('.bottom-field').getAttribute('data-animation-player')
      const replacementPanel = page.locator('.decision-modal[role="alertdialog"]:visible').last()
      await replacementPanel.waitFor({ state: 'visible' })
      evidence.ownerReplacementPanel = await replacementPanel.innerText()
      assert.match(evidence.ownerReplacementPanel, /餅乾/)
      assert.match(evidence.ownerReplacementPanel, /Goblin Cookie/)
      const replacementChoice = replacementPanel.locator('.decision-card-options button').first()
      await clickReady(replacementChoice, 'fill player one battle area after ST10-009 leaves during the opponent turn')
      evidence.afterReplacement = await waitForObservedState(page, current =>
        current.players.one.battle.some(item => item.name === 'Goblin Cookie' && item.hp === 2) &&
        current.players.one.hand.length === expectedHand - 1 &&
        current.players.one.deck === expectedDeck - 2 &&
        current.players.one.trash === beforeOwner.trash + 2,
      'the owner did not complete the replacement after its departure draw')
      evidence.after = evidence.afterReplacement
      evidence.afterReplacementViewer = await page.locator('.bottom-field').getAttribute('data-animation-player')
      assert.equal(evidence.afterReplacementViewer, 'player-two')
    }
  }
  evidence.trace = await trace(page)
  const drawCommands = evidence.trace.filter(entry => entry.commandKind === 'resolve-draw-up-to' &&
    entry.summary?.includes('Space Doughnut'))
  assert.equal(drawCommands.length, testCase.flow.startsWith('both-field-trash') ? 2 : 1,
    'formal trace must attribute every draw settlement to the correct Space Doughnut trigger')
}

const runItemCost = async (page, testCase, evidence) => {
  const beforeOwner = evidence.before.players.one
  const source = page.locator('.bottom-field .hand-card-wrap').filter({
    has: page.locator('.card-face[title*="Little Star"]'),
  }).first()
  const target = page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator('.card-face[title="Space Doughnut"]'),
  }).first()
  await source.waitFor({ state: 'visible' })
  await target.waitFor({ state: 'visible' })
  await clickReady(source.locator('.card-face').first(), 'select original Little Star')
  await clickReady(source.locator('.hand-card-action').filter({ hasText: '使用' }).first(), 'use Little Star')
  await settleAnimation(page)

  let panel = page.locator('.effect-panel[role="alertdialog"]:visible').filter({ hasText: 'Little Star' }).last()
  await panel.waitFor({ state: 'visible' })
  evidence.paymentPanel = await panel.innerText()
  assert.match(evidence.paymentPanel, /Little Star/)
  const payment = panel.locator('.effect-candidates-payment button:not(.is-selected)').first()
  await clickReady(payment, 'select original purple support for Little Star')
  panel = page.locator('.effect-panel[role="alertdialog"]:visible').filter({ hasText: 'Little Star' }).last()
  await panel.locator('.effect-candidates-payment button.is-selected').waitFor({ state: 'visible' })
  const nextCostStep = panel.locator('.effect-panel-primary-action:visible').last()
  await clickReady(nextCostStep, 'advance to Little Star battle Cookie cost')
  panel = page.locator('.effect-panel[role="alertdialog"]:visible').filter({ hasText: 'Little Star' }).last()
  const cookieCost = panel.locator('.effect-candidates-trash-battle button').filter({ hasText: 'Space Doughnut' }).first()
  await clickReady(cookieCost, 'select Space Doughnut as the printed direct-trash cost')
  panel = page.locator('.effect-panel[role="alertdialog"]:visible').filter({ hasText: 'Little Star' }).last()
  await panel.locator('.effect-candidates-trash-battle button.is-selected').waitFor({ state: 'visible' })
  evidence.cookieCostPanel = await panel.innerText()
  assert.match(evidence.cookieCostPanel, /Space Doughnut/)
  const confirm = await advanceToFinalAction(panel)
  evidence.parentPanel = await panel.innerText()
  assert.match(evidence.parentPanel, /對手|Opponent/)
  await clickReady(confirm, 'pay Little Star and choose zero optional opponent targets')

  await waitForObservedState(page, current =>
    !current.players.one.battle.some(item => item.name === 'Space Doughnut') &&
    current.players.one.trash === beforeOwner.trash + 3,
  'Little Star did not move Space Doughnut and its attached HP card to trash')
  await settleAnimation(page)
  assert.ok(await visible(page.locator('.draw-up-to-modal:visible')),
    'the cost event must open the Space Doughnut draw decision')
  const expectedHand = beforeOwner.hand.length - 1 + testCase.draw
  const expectedDeck = beforeOwner.deck - testCase.draw
  await chooseDraw(page, testCase.draw, evidence)
  evidence.after = await waitForObservedState(page, current =>
    current.players.one.hand.length === expectedHand &&
    current.players.one.deck === expectedDeck &&
    current.players.one.trash === beforeOwner.trash + 3,
  'Little Star cost and Space Doughnut draw did not settle')
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some(entry => entry.commandKind === 'resolve-draw-up-to' &&
    entry.summary?.includes('Space Doughnut')))
}

const runFaint = async (page, evidence) => {
  const before = evidence.before.players
  const source = page.locator('.bottom-field .combat-card-wrap').filter({
    has: page.locator('.card-face[title="Dreamcatcher"]'),
  }).first()
  await source.waitFor({ state: 'visible' })
  const attacker = before.two.battle.find(item => item.name === 'Dreamcatcher')
  const target = before.one.battle.find(item => item.name === 'Space Doughnut')
  assert.ok(attacker?.id && target?.id)
  assert.equal(target.hp, 1)
  const image = source.locator('.card-face img').first()
  evidence.attackerArt = await image.evaluate(node => ({
    src: node.getAttribute('src'), alt: node.getAttribute('alt'), loaded: node.complete && node.naturalWidth > 0,
    width: node.naturalWidth, height: node.naturalHeight,
  }))
  assert.equal(evidence.attackerArt.src, faintAttacker.imageUrl)
  assert.equal(evidence.attackerArt.alt, 'Dreamcatcher')
  assert.equal(evidence.attackerArt.loaded, true)
  assert.deepEqual([evidence.attackerArt.width, evidence.attackerArt.height],
    [dreamcatcherArt.dimensions.width, dreamcatcherArt.dimensions.height])

  await clickReady(source.locator('.card-face.is-attackable'), 'select Dreamcatcher printed ordinary attack')
  await page.locator('[data-testid="attack-payment-panel"]:visible').waitFor({ state: 'visible' })
  const payment = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').first()
  await clickReady(payment, 'pay the printed P attack with purple Support')
  const targetButton = page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${target.id}"] .card-face[aria-label^="選擇攻擊目標："]`)
  await clickReady(targetButton, 'target the original 1 HP Space Doughnut')
  await waitForCommand(page, 'declare-attack')
  evidence.after = await waitForObservedState(page, current =>
    !current.players.one.battle.some(item => item.id === target.id) &&
    current.players.one.break === before.one.break + 1 &&
    current.players.two.battle.some(item => item.id === attacker.id && item.rested),
  'the printed attack did not faint Space Doughnut into the Break Area')
  await settleAnimation(page)
  assert.equal(await visible(page.locator('.draw-up-to-modal:visible')), false,
    'fainting into the Break Area must not be treated as placement into trash')
  assert.equal(evidence.after.players.one.trash, before.one.trash + 1,
    'only Space Doughnut’s attached HP card enters trash on faint')
  evidence.trace = await trace(page)
  assert.ok(evidence.trace.some(entry => entry.commandKind === 'declare-attack'))
  assert.equal(evidence.trace.some(entry => entry.commandKind === 'resolve-draw-up-to'), false)
  assert.equal(evidence.trace.some(entry => entry.commandKind === 'resolve-ability-effect' &&
    entry.summary?.includes('Space Doughnut')), false)
}

const results = []
let browser
try {
  if (!process.env.BRAVERSE_BASE_URL) {
    server = spawn(process.execPath, [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)], {
      cwd: root, stdio: 'ignore',
    })
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        if ((await fetch(baseUrl)).ok) break
      } catch { /* preview is starting */ }
      await wait(100)
    }
  }
  browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) })
  for (const viewport of activeViewports) for (const testCase of activeCases) {
    const page = await browser.newPage({ viewport })
    page.setDefaultTimeout(15000)
    const errors = []
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
    page.on('console', message => {
      if (message.type() === 'error' && !message.location().url?.includes('cookierunbraverse.com')) {
        errors.push(`console: ${message.text()}`)
      }
    })
    const evidence = { id: testCase.id, testState: testCase.testState, flow: testCase.flow, viewport, status: 'FAIL', errors }
    try {
      await page.route(card.imageUrl, route => route.fulfill({ status: 200, contentType: 'image/webp', body: doughnutArt.data }))
      if (testCase.flow === 'faint') {
        await page.route(faintAttacker.imageUrl, route => route.fulfill({ status: 200, contentType: 'image/webp', body: dreamcatcherArt.data }))
      }
      const url = new URL('/', baseUrl)
      url.searchParams.set('test-state', testCase.testState)
      url.searchParams.set('contract-card', testCase.flow === 'faint' ? 'ST10-009,ST10-005' : 'ST10-009')
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      await settleAnimation(page)
      evidence.before = await state(page)
      evidence.traceBefore = await trace(page)
      assert.deepEqual(evidence.traceBefore, [], 'fixture setup must not fabricate Browser commands')

      const cardOnField = page.locator(`.battle-row[data-animation-player="player-one"] .combat-card-wrap[data-card-instance-id="${evidence.before.players.one.battle.find(item => item.name === 'Space Doughnut')?.id}"]`)
      await cardOnField.waitFor({ state: 'visible' })
      evidence.art = await cardOnField.locator('.card-face img').first().evaluate(node => ({
        alt: node.getAttribute('alt'), src: node.getAttribute('src'), loaded: node.complete && node.naturalWidth > 0,
        width: node.naturalWidth, height: node.naturalHeight,
      }))
      assert.equal(evidence.art.src, card.imageUrl)
      assert.equal(evidence.art.alt, 'Space Doughnut')
      assert.equal(evidence.art.loaded, true)
      assert.deepEqual([evidence.art.width, evidence.art.height],
        [doughnutArt.dimensions.width, doughnutArt.dimensions.height])
      if (testCase.flow.startsWith('both-field-trash')) {
        const opposingCookie = evidence.before.players.two.battle.find(item => item.name === 'Space Doughnut')
        assert.ok(opposingCookie?.id, 'the opposing field must also contain its own physical Space Doughnut')
        const opposingCard = page.locator(`.battle-row[data-animation-player="player-two"] .combat-card-wrap[data-card-instance-id="${opposingCookie.id}"]`)
        await opposingCard.waitFor({ state: 'visible' })
        evidence.opposingArt = await opposingCard.locator('.card-face img').first().evaluate(node => ({
          alt: node.getAttribute('alt'), src: node.getAttribute('src'), loaded: node.complete && node.naturalWidth > 0,
          width: node.naturalWidth, height: node.naturalHeight,
        }))
        assert.equal(evidence.opposingArt.src, card.imageUrl)
        assert.equal(evidence.opposingArt.alt, 'Space Doughnut')
        assert.equal(evidence.opposingArt.loaded, true)
        assert.deepEqual([evidence.opposingArt.width, evidence.opposingArt.height],
          [doughnutArt.dimensions.width, doughnutArt.dimensions.height])
      }

      if (testCase.flow === 'field-trash' || testCase.flow.startsWith('both-field-trash')) await runFieldTrash(page, testCase, evidence)
      else if (testCase.flow === 'item-cost') await runItemCost(page, testCase, evidence)
      else await runFaint(page, evidence)

      await settleAnimation(page)
      evidence.finalState = await state(page)
      assert.deepEqual(errors, [])
      evidence.status = 'PASS'
    } catch (error) {
      evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
      evidence.trace ??= await trace(page).catch(() => [])
      evidence.finalState ??= await state(page).catch(() => null)
      evidence.debug = await page.evaluate(() => ({
        viewer: document.querySelector('.bottom-field')?.getAttribute('data-animation-player'),
        effectPanels: [...document.querySelectorAll('.effect-panel')].map(node => ({
          visible: node.getBoundingClientRect().width > 0,
          display: getComputedStyle(node).display,
          text: node.textContent?.trim().slice(0, 1000),
          classes: node.className,
        })),
        animationSkipVisible: [...document.querySelectorAll('button')]
          .some(node => node.textContent?.trim() === '略過目前演出' && node.getBoundingClientRect().width > 0),
        toasts: [...document.querySelectorAll('.status-toast')].filter(node => node.getBoundingClientRect().width > 0)
          .map(node => node.textContent?.trim()),
        dialogs: [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')]
          .filter(node => node.getBoundingClientRect().width > 0).map(node => node.textContent?.trim().slice(0, 1000)),
        buttons: [...document.querySelectorAll('button')].filter(node => node.getBoundingClientRect().width > 0)
          .map(node => node.textContent?.trim()).filter(Boolean).slice(-24),
      })).catch(() => null)
    } finally {
      evidence.screenshot = resolve(output, `${testCase.id}-${viewport.width}-${evidence.status}.png`)
      await page.screenshot({ path: evidence.screenshot, fullPage: true }).catch(() => {})
      results.push(evidence)
      await page.close()
    }
  }
} finally {
  writeFileSync(resolve(output, 'results.json'), JSON.stringify(results, null, 2))
  await browser?.close().catch(() => {})
  server?.kill()
}

console.log(JSON.stringify({ total: results.length, passed: results.filter(result => result.status === 'PASS').length, results }, null, 2))
if (results.some(result => result.status !== 'PASS')) process.exitCode = 1
